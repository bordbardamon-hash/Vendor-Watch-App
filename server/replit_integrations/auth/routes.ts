import type { Express, RequestHandler } from "express";
import { authStorage } from "./storage";
import { z } from "zod";
import { db } from "../../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

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
      const user = await authStorage.getUser(userId);
      console.log(`[auth] Returning user ${userId}: profileCompleted=${user?.profileCompleted}, type=${typeof user?.profileCompleted}`);
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
        trialEndsAt: user.trialEndsAt,
        hasSubscription: !!user.subscriptionTier,
        subscriptionTier: user.subscriptionTier,
      });
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      res.status(500).json({ error: "Failed to check onboarding status" });
    }
  });
}
