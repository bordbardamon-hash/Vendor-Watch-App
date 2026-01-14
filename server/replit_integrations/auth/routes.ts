import type { Express, RequestHandler } from "express";
import { authStorage } from "./storage";
import { z } from "zod";
import { db } from "../../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";

// Stripe price IDs for subscription tiers
const TIER_PRICE_IDS = {
  essential: process.env.STRIPE_PRICE_ESSENTIAL || "price_essential_placeholder",
  growth: process.env.STRIPE_PRICE_GROWTH || "price_growth_placeholder",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_enterprise_placeholder",
} as const;

// Unified auth middleware that works with both email auth and Replit OAuth
// It checks session.userId first (email auth), then falls back to passport user (Replit OAuth)
const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // Check for email auth session
  const emailAuthUserId = req.session?.userId;
  if (emailAuthUserId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, emailAuthUserId)).limit(1);
      if (user) {
        req.user = user;
        req.user.claims = { sub: user.id }; // Add claims for compatibility
        return next();
      }
    } catch (error) {
      console.error('[auth] Email auth check failed:', error);
    }
  }
  
  // Check for Replit OAuth session (passport)
  if (req.isAuthenticated && req.isAuthenticated() && req.user?.claims?.sub) {
    return next();
  }
  
  return res.status(401).json({ message: "Unauthorized" });
};

// Onboarding schema - all fields required to complete profile
const onboardingSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  phone: z.string().min(1, "Phone number is required"),
  notificationEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
}).transform((data) => ({
  ...data,
  notificationEmail: data.notificationEmail === "" ? undefined : data.notificationEmail,
}));

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await authStorage.getUser(userId);
      
      // If user doesn't exist in database (new Replit OAuth user), create them
      // This ensures the user record exists with proper onboarding flags
      if (!user && req.user.claims) {
        console.log(`[auth] Creating new user record for ${req.user.claims.email}`);
        user = await authStorage.upsertUser({
          id: userId,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        });
      }
      
      console.log(`[auth] Returning user ${userId}: profileCompleted=${user?.profileCompleted}, billingCompleted=${user?.billingCompleted}`);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Complete onboarding - save required profile information
  app.post("/api/onboarding/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const result = onboardingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid profile data", 
          details: result.error.flatten().fieldErrors 
        });
      }

      const { firstName, lastName, companyName, phone, notificationEmail } = result.data;

      // Update user profile and mark as completed
      const [updatedUser] = await db
        .update(users)
        .set({
          firstName,
          lastName,
          companyName,
          phone,
          notificationEmail: notificationEmail || null,
          profileCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`[onboarding] User ${userId} completed onboarding`);
      res.json({ 
        success: true, 
        user: updatedUser,
        message: "Profile completed successfully" 
      });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // Check onboarding status
  app.get("/api/onboarding/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        profileCompleted: user.profileCompleted ?? false,
        billingCompleted: user.billingCompleted ?? false,
        billingStatus: user.billingStatus,
        trialEndsAt: user.trialEndsAt,
        hasSubscription: !!user.subscriptionTier,
        subscriptionTier: user.subscriptionTier,
      });
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      res.status(500).json({ error: "Failed to check onboarding status" });
    }
  });

  // Create Stripe checkout session for billing setup during onboarding
  app.post("/api/onboarding/billing/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.profileCompleted) {
        return res.status(400).json({ error: "Profile must be completed first" });
      }

      // Validate tier selection
      const tierSchema = z.object({
        tier: z.enum(['essential', 'growth', 'enterprise']).default('essential'),
      });
      const { tier } = tierSchema.parse(req.body);
      const priceId = TIER_PRICE_IDS[tier];

      const stripe = await getUncachableStripeClient();

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: `${user.firstName} ${user.lastName}`,
          phone: user.phone || undefined,
          metadata: {
            userId: userId,
            companyName: user.companyName || '',
          },
        });
        customerId = customer.id;
        
        // Save Stripe customer ID
        await db.update(users)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }

      // Create checkout session with 7-day trial
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/onboarding/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/onboarding/billing`,
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            userId: userId,
            subscriptionTier: tier,
          },
        },
      });

      console.log(`[billing] Created checkout session for user ${userId}, tier: ${tier}`);
      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error("Error creating billing checkout:", error);
      res.status(500).json({ error: "Failed to create checkout session", details: error.message });
    }
  });

  // Confirm billing after Stripe checkout success
  app.post("/api/onboarding/billing/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID required" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });

      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const subscription = session.subscription as any;
      if (!subscription) {
        return res.status(400).json({ error: "No subscription found" });
      }

      // Determine tier from subscription metadata or price
      const tier = subscription.metadata?.subscriptionTier || 'essential';
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

      // Update user with subscription info
      const [updatedUser] = await db.update(users)
        .set({
          stripeSubscriptionId: subscription.id,
          subscriptionTier: tier,
          billingCompleted: true,
          billingStatus: subscription.status, // 'trialing', 'active', etc.
          trialEndsAt: trialEnd,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      console.log(`[billing] User ${userId} completed billing setup, tier: ${tier}, status: ${subscription.status}`);
      res.json({
        success: true,
        user: updatedUser,
        subscriptionTier: tier,
        billingStatus: subscription.status,
        trialEndsAt: trialEnd,
      });
    } catch (error: any) {
      console.error("Error confirming billing:", error);
      res.status(500).json({ error: "Failed to confirm billing", details: error.message });
    }
  });
}
