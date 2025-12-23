import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVendorSchema, insertIncidentSchema, insertJobSchema, insertConfigSchema, insertFeedbackSchema, insertNotificationConsentSchema, insertCustomVendorRequestSchema, SUBSCRIPTION_TIERS } from "@shared/schema";
import { setupEmailAuth, isAuthenticated } from "./emailAuth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sendSMS } from "./twilioClient";
import { syncVendorStatus } from "./statusSync";
import { syncAllBlockchainChains } from "./blockchainSync";
import { setupTwoFactor, verifyTOTP, verifyRecoveryCode, generateRecoveryCodes } from "./twoFactor";
import { z } from "zod";

// Stripe price IDs for each subscription tier
const TIER_PRICE_IDS = {
  standard: process.env.STRIPE_PRICE_STANDARD || "price_1SgaJ67qLOdMTGqKWTLEYixp", // $89.99
  gold: process.env.STRIPE_PRICE_GOLD || "price_1SgaL47qLOdMTGqKNjygjmsw", // $99.99
  platinum: process.env.STRIPE_PRICE_PLATINUM || "price_1SgaLT7qLOdMTGqKMT8J02bw", // $129.99
} as const;

// Map price IDs to tiers for webhook processing
const PRICE_ID_TO_TIER: Record<string, 'standard' | 'gold' | 'platinum'> = {
  [TIER_PRICE_IDS.standard]: 'standard',
  [TIER_PRICE_IDS.gold]: 'gold',
  [TIER_PRICE_IDS.platinum]: 'platinum',
};

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  tier: z.enum(['standard', 'gold', 'platinum']).default('standard'),
});

// Admin-only middleware - requires isAuthenticated to run first
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (error) {
    console.error("Admin check error:", error);
    res.status(500).json({ error: "Failed to verify admin status" });
  }
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication BEFORE other routes
  try {
    await setupEmailAuth(app);
  } catch (error) {
    console.error("[auth] Failed to setup authentication:", error);
  }
  
  // ============ STRIPE CONNECTION TEST ============
  app.get("/api/stripe/test", async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const account = await stripe.accounts.retrieve();
      res.json({
        success: true,
        message: "Stripe API connection successful",
        accountId: account.id,
        livemode: (account as any).livemode ?? false,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      });
    } catch (error: any) {
      console.error("Stripe connection test failed:", error);
      res.status(500).json({
        success: false,
        message: "Stripe API connection failed",
        error: error.message,
      });
    }
  });
  
  // ============ VENDORS ============
  
  // Get all vendors (protected)
  app.get("/api/vendors", isAuthenticated, async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });
  
  // Get vendor by key (protected)
  app.get("/api/vendors/:key", isAuthenticated, async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.key);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      console.error("Error fetching vendor:", error);
      res.status(500).json({ error: "Failed to fetch vendor" });
    }
  });
  
  // Create vendor (protected)
  app.post("/api/vendors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only Platinum users can create vendors directly
      if (user.subscriptionTier !== 'platinum') {
        return res.status(403).json({ error: "Only Platinum users can add vendors directly. Use the vendor request form instead." });
      }
      
      const validatedData = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(validatedData);
      res.status(201).json(vendor);
    } catch (error) {
      console.error("Error creating vendor:", error);
      res.status(400).json({ error: "Invalid vendor data" });
    }
  });
  
  // Update vendor (protected)
  app.patch("/api/vendors/:key", isAuthenticated, async (req, res) => {
    try {
      const vendor = await storage.updateVendor(req.params.key, req.body);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      console.error("Error updating vendor:", error);
      res.status(500).json({ error: "Failed to update vendor" });
    }
  });
  
  // Delete vendor (protected)
  app.delete("/api/vendors/:key", isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteVendor(req.params.key);
      if (!success) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vendor:", error);
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });
  
  // Sync vendor statuses from real status pages (protected)
  app.post("/api/vendors/sync", isAuthenticated, async (req, res) => {
    try {
      const vendorKey = req.body?.vendorKey;
      console.log(`[sync] Starting status sync${vendorKey ? ` for ${vendorKey}` : ' for all vendors'}...`);
      const result = await syncVendorStatus(vendorKey);
      res.json({ 
        success: true, 
        synced: result.synced, 
        skipped: result.skipped,
        errors: result.errors,
        message: `Synced ${result.synced} vendor(s), skipped ${result.skipped} (no API)`
      });
    } catch (error) {
      console.error("Error syncing vendor statuses:", error);
      res.status(500).json({ error: "Failed to sync vendor statuses" });
    }
  });
  
  // ============ INCIDENTS ============
  
  // Get all incidents (protected)
  app.get("/api/incidents", isAuthenticated, async (req, res) => {
    try {
      const incidents = await storage.getIncidents();
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching incidents:", error);
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });
  
  // Get incidents by vendor (protected)
  app.get("/api/incidents/vendor/:vendorKey", isAuthenticated, async (req, res) => {
    try {
      const incidents = await storage.getIncidentsByVendor(req.params.vendorKey);
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching vendor incidents:", error);
      res.status(500).json({ error: "Failed to fetch vendor incidents" });
    }
  });
  
  // Create incident (protected)
  app.post("/api/incidents", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertIncidentSchema.parse(req.body);
      const incident = await storage.createIncident(validatedData);
      res.status(201).json(incident);
    } catch (error) {
      console.error("Error creating incident:", error);
      res.status(400).json({ error: "Invalid incident data" });
    }
  });
  
  // ============ JOBS (Admin Only) ============
  
  // Get all jobs (admin only)
  app.get("/api/jobs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
  
  // Get job by id (admin only)
  app.get("/api/jobs/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });
  
  // Create job (admin only)
  app.post("/api/jobs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertJobSchema.parse(req.body);
      const job = await storage.createJob(validatedData);
      res.status(201).json(job);
    } catch (error) {
      console.error("Error creating job:", error);
      res.status(400).json({ error: "Invalid job data" });
    }
  });
  
  // Update job (admin only)
  app.patch("/api/jobs/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const job = await storage.updateJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  });
  
  // Delete job (admin only)
  app.delete("/api/jobs/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteJob(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });
  
  // ============ CONFIG ============
  
  // Get all config (protected)
  app.get("/api/config", isAuthenticated, async (req, res) => {
    try {
      const allConfig = await storage.getAllConfig();
      res.json(allConfig);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });
  
  // Get config by key (protected)
  app.get("/api/config/:key", isAuthenticated, async (req, res) => {
    try {
      const cfg = await storage.getConfig(req.params.key);
      if (!cfg) {
        return res.status(404).json({ error: "Config not found" });
      }
      res.json(cfg);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });
  
  // Set config (protected)
  app.post("/api/config", isAuthenticated, async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key || !value) {
        return res.status(400).json({ error: "Key and value are required" });
      }
      const cfg = await storage.setConfig(key, value);
      res.json(cfg);
    } catch (error) {
      console.error("Error setting config:", error);
      res.status(500).json({ error: "Failed to set config" });
    }
  });

  // ============ EMAIL CONFIGURATION ============

  // Get email config (protected)
  app.get("/api/email/config", isAuthenticated, async (req, res) => {
    try {
      const fromConfig = await storage.getConfig('email_from');
      res.json({
        configured: !!process.env.RESEND_API_KEY,
        fromEmail: fromConfig?.value || 'notifications@resend.dev',
      });
    } catch (error) {
      console.error("Error fetching email config:", error);
      res.status(500).json({ error: "Failed to fetch email config" });
    }
  });

  // Update email from address (protected)
  app.put("/api/email/config", isAuthenticated, async (req, res) => {
    try {
      const { fromEmail } = req.body;
      if (!fromEmail || typeof fromEmail !== 'string') {
        return res.status(400).json({ error: "fromEmail is required" });
      }
      await storage.setConfig('email_from', fromEmail);
      res.json({ success: true, fromEmail });
    } catch (error) {
      console.error("Error updating email config:", error);
      res.status(500).json({ error: "Failed to update email config" });
    }
  });

  // Test email (protected)
  app.post("/api/email/test", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.email) {
        return res.status(400).json({ error: "No email address on your account" });
      }
      
      const { sendEmail } = await import('./emailClient');
      const success = await sendEmail(
        user.email,
        'Vendor Watch - Test Email',
        `<h1>Test Email</h1><p>This is a test email from Vendor Watch to confirm your email notifications are working correctly.</p><p>If you received this, your email alerts are configured properly!</p>`
      );
      
      if (success) {
        res.json({ success: true, message: `Test email sent to ${user.email}` });
      } else {
        res.status(500).json({ error: "Failed to send test email. Check Resend API key configuration." });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  // ============ VENDOR SUBSCRIPTIONS ============

  app.get("/api/vendor-subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscriptions = await storage.getUserVendorSubscriptions(userId);
      const hasSetSubscriptions = await storage.hasUserSetSubscriptions(userId);
      res.json({ vendorKeys: subscriptions, hasSetSubscriptions });
    } catch (error) {
      console.error("Error fetching vendor subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch vendor subscriptions" });
    }
  });

  app.put("/api/vendor-subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { vendorKeys } = req.body;
      
      if (!Array.isArray(vendorKeys)) {
        return res.status(400).json({ error: "vendorKeys must be an array" });
      }
      
      await storage.setUserVendorSubscriptions(userId, vendorKeys);
      res.json({ success: true, vendorKeys });
    } catch (error) {
      console.error("Error updating vendor subscriptions:", error);
      res.status(500).json({ error: "Failed to update vendor subscriptions" });
    }
  });

  app.delete("/api/vendor-subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.resetUserSubscriptions(userId);
      res.json({ success: true, message: "Reset to monitor all vendors" });
    } catch (error) {
      console.error("Error resetting vendor subscriptions:", error);
      res.status(500).json({ error: "Failed to reset vendor subscriptions" });
    }
  });

  app.get("/api/my-vendors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const vendors = await storage.getOrderedVendorsForUser(userId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching user vendors:", error);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  // Vendor ordering
  app.get("/api/vendor-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const order = await storage.getUserVendorOrder(userId);
      res.json({ vendorKeys: order.map(o => o.vendorKey) });
    } catch (error) {
      console.error("Error fetching vendor order:", error);
      res.status(500).json({ error: "Failed to fetch vendor order" });
    }
  });

  app.put("/api/vendor-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { vendorKeys } = req.body;
      
      if (!Array.isArray(vendorKeys)) {
        return res.status(400).json({ error: "vendorKeys must be an array" });
      }
      
      await storage.setUserVendorOrder(userId, vendorKeys);
      res.json({ success: true, vendorKeys });
    } catch (error) {
      console.error("Error updating vendor order:", error);
      res.status(500).json({ error: "Failed to update vendor order" });
    }
  });

  app.get("/api/my-incidents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const incidents = await storage.getIncidentsForUser(userId);
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching user incidents:", error);
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  // ============ CUSTOMER IMPACT TAGGING ============
  
  app.get("/api/vendor-impact", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const vendors = await storage.getVendorsForUser(userId);
      const savedImpacts = await storage.getUserVendorSubscriptionsWithImpact(userId);
      const impactMap = new Map(savedImpacts.map(i => [i.vendorKey, i.customerImpact]));
      
      const impacts = vendors.map(v => ({
        vendorKey: v.key,
        customerImpact: impactMap.get(v.key) || 'medium'
      }));
      
      res.json(impacts);
    } catch (error) {
      console.error("Error fetching vendor impacts:", error);
      res.status(500).json({ error: "Failed to fetch vendor impacts" });
    }
  });
  
  app.put("/api/vendor-impact/:vendorKey", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { vendorKey } = req.params;
      const { customerImpact } = req.body;
      
      if (!['high', 'medium', 'low'].includes(customerImpact)) {
        return res.status(400).json({ error: "customerImpact must be 'high', 'medium', or 'low'" });
      }
      
      const vendors = await storage.getVendors();
      const vendorExists = vendors.some(v => v.key === vendorKey);
      if (!vendorExists) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      
      const updated = await storage.setUserVendorImpact(userId, vendorKey, customerImpact);
      if (!updated) {
        return res.status(400).json({ error: "You must be subscribed to this vendor to set its impact level" });
      }
      
      res.json({ success: true, vendorKey, customerImpact });
    } catch (error) {
      console.error("Error updating vendor impact:", error);
      res.status(500).json({ error: "Failed to update vendor impact" });
    }
  });

  // ============ VENDOR RELIABILITY STATS ============
  
  app.get("/api/vendor-reliability", isAuthenticated, async (req: any, res) => {
    try {
      const { getAllVendorReliability } = await import('./reliabilityTracker');
      const stats = await getAllVendorReliability();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching vendor reliability:", error);
      res.status(500).json({ error: "Failed to fetch vendor reliability" });
    }
  });
  
  app.get("/api/vendor-reliability/:vendorKey", isAuthenticated, async (req: any, res) => {
    try {
      const { vendorKey } = req.params;
      const { getVendorReliability } = await import('./reliabilityTracker');
      const stats = await getVendorReliability(vendorKey);
      if (!stats) {
        return res.status(404).json({ error: "No reliability data for this vendor" });
      }
      res.json(stats);
    } catch (error) {
      console.error("Error fetching vendor reliability:", error);
      res.status(500).json({ error: "Failed to fetch vendor reliability" });
    }
  });
  
  app.post("/api/vendor-reliability/refresh", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { updateAllVendorReliabilityStats } = await import('./reliabilityTracker');
      await updateAllVendorReliabilityStats();
      res.json({ success: true, message: "Reliability stats refreshed" });
    } catch (error) {
      console.error("Error refreshing reliability stats:", error);
      res.status(500).json({ error: "Failed to refresh reliability stats" });
    }
  });

  // ============ WEEKLY DIGEST ============
  
  app.post("/api/digest/send", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { sendWeeklyDigest } = await import('./weeklyDigest');
      const result = await sendWeeklyDigest();
      res.json({ success: true, sent: result.sent, errors: result.errors });
    } catch (error) {
      console.error("Error sending weekly digest:", error);
      res.status(500).json({ error: "Failed to send weekly digest" });
    }
  });

  // ============ USER MANAGEMENT (Admin Only) ============

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:userId/admin", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { isAdmin: makeAdmin } = req.body;
      
      if (typeof makeAdmin !== 'boolean') {
        return res.status(400).json({ error: "isAdmin must be a boolean" });
      }
      
      const user = await storage.updateUserAdmin(userId, makeAdmin);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user admin status:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.put("/api/admin/users/:userId/tier", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { tier } = req.body;
      
      if (tier !== null && !['standard', 'gold', 'platinum'].includes(tier)) {
        return res.status(400).json({ error: "Invalid tier. Must be standard, gold, platinum, or null" });
      }
      
      const user = await storage.updateUserSubscriptionTier(userId, tier);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user tier:", error);
      res.status(500).json({ error: "Failed to update user tier" });
    }
  });

  // ============ STRIPE / SIGNUP ============

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting publishable key:", error);
      res.status(500).json({ error: "Failed to get publishable key" });
    }
  });

  app.post("/api/signup/checkout", async (req, res) => {
    try {
      const validatedData = signupSchema.parse(req.body);
      const stripe = await getUncachableStripeClient();
      
      const priceId = TIER_PRICE_IDS[validatedData.tier];

      const customer = await stripe.customers.create({
        email: validatedData.email,
        name: `${validatedData.firstName} ${validatedData.lastName}`,
        phone: validatedData.phone,
        metadata: {
          companyName: validatedData.companyName,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          subscriptionTier: validatedData.tier,
        },
      });

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/signup`,
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            subscriptionTier: validatedData.tier,
          },
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid signup data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });
  
  // Get subscription tier info
  app.get("/api/subscription/tier", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const tier = user.subscriptionTier as 'standard' | 'gold' | 'platinum' | null;
      const tierInfo = tier ? SUBSCRIPTION_TIERS[tier] : null;
      const vendorCount = await storage.getUserVendorSubscriptions(user.id);
      
      res.json({
        tier,
        tierInfo,
        currentVendorCount: vendorCount.length,
        canAddVendors: tier === 'platinum',
        canRequestVendors: tier === 'gold' || tier === 'standard',
      });
    } catch (error) {
      console.error("Error fetching subscription tier:", error);
      res.status(500).json({ error: "Failed to fetch subscription tier" });
    }
  });

  app.get("/api/subscription/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.stripeSubscriptionId) {
        return res.json({ status: 'none', subscription: null });
      }

      const stripe = await getUncachableStripeClient();
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      
      res.json({ 
        status: subscription.status,
        trialEnd: subscription.trial_end,
        currentPeriodEnd: (subscription as any).current_period_end,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  // Create customer portal session for subscription management
  app.post("/api/subscription/portal", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: "No active subscription found. Please subscribe first." });
      }

      const stripe = await getUncachableStripeClient();
      const returnUrl = `${req.protocol}://${req.get('host')}/settings`;
      
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ error: "Failed to open subscription management portal" });
    }
  });

  // ============ CUSTOM VENDOR REQUESTS ============
  
  // Get user's custom vendor requests
  app.get("/api/vendor-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const requests = await storage.getCustomVendorRequests({ userId });
      res.json(requests);
    } catch (error) {
      console.error("Error fetching vendor requests:", error);
      res.status(500).json({ error: "Failed to fetch vendor requests" });
    }
  });
  
  // Create a custom vendor request (Standard/Gold users)
  app.post("/api/vendor-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const tier = user.subscriptionTier as 'standard' | 'gold' | 'platinum' | null;
      
      // Platinum users should use direct vendor add endpoint
      if (tier === 'platinum') {
        return res.status(400).json({ error: "Platinum users can add vendors directly" });
      }
      
      // Check if Standard user (no custom requests allowed)
      if (tier === 'standard') {
        return res.status(403).json({ error: "Standard plan does not include custom vendor requests. Upgrade to Gold or Platinum." });
      }
      
      // Gold users get 5 custom requests max
      if (tier === 'gold') {
        const requestCount = await storage.getUserRequestCount(userId);
        if (requestCount >= SUBSCRIPTION_TIERS.gold.customVendorRequests!) {
          return res.status(403).json({ 
            error: "You have reached your custom vendor request limit (5). Upgrade to Platinum for unlimited additions.",
            limit: SUBSCRIPTION_TIERS.gold.customVendorRequests,
            current: requestCount
          });
        }
      }
      
      const validated = insertCustomVendorRequestSchema.parse({
        ...req.body,
        userId,
      });
      
      const request = await storage.createCustomVendorRequest(validated);
      res.status(201).json(request);
    } catch (error: any) {
      console.error("Error creating vendor request:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create vendor request" });
    }
  });
  
  // Delete a custom vendor request (only pending requests)
  app.delete("/api/vendor-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const request = await storage.getCustomVendorRequest(req.params.id);
      
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }
      
      if (request.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this request" });
      }
      
      if (request.status !== 'pending') {
        return res.status(400).json({ error: "Can only delete pending requests" });
      }
      
      await storage.deleteCustomVendorRequest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vendor request:", error);
      res.status(500).json({ error: "Failed to delete vendor request" });
    }
  });
  
  // Check vendor limit for current user
  app.get("/api/vendor-limit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limitInfo = await storage.checkVendorLimit(userId);
      const user = await storage.getUser(userId);
      const requestCount = await storage.getUserRequestCount(userId);
      
      const tier = user?.subscriptionTier as 'standard' | 'gold' | 'platinum' | null;
      const tierInfo = tier ? SUBSCRIPTION_TIERS[tier] : null;
      
      res.json({
        ...limitInfo,
        requestCount,
        requestLimit: tierInfo?.customVendorRequests ?? 0,
        canRequestVendors: tier === 'gold' && requestCount < (tierInfo?.customVendorRequests || 0),
        canAddVendorsDirectly: tier === 'platinum',
      });
    } catch (error) {
      console.error("Error checking vendor limit:", error);
      res.status(500).json({ error: "Failed to check vendor limit" });
    }
  });
  
  // Toggle vendor subscription (for selecting which vendors to monitor)
  app.post("/api/vendors/:key/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const vendorKey = req.params.key;
      
      const result = await storage.toggleVendorSubscription(userId, vendorKey);
      res.json(result);
    } catch (error: any) {
      console.error("Error toggling vendor subscription:", error);
      res.status(400).json({ error: error.message || "Failed to toggle subscription" });
    }
  });

  // Get user's subscribed vendors
  app.get("/api/subscriptions/vendors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscribedKeys = await storage.getUserVendorSubscriptions(userId);
      const hasSetSubscriptions = await storage.hasUserSetSubscriptions(userId);
      const limitInfo = await storage.checkVendorLimit(userId);
      
      res.json({
        subscribedVendors: subscribedKeys,
        hasSetSubscriptions,
        ...limitInfo
      });
    } catch (error) {
      console.error("Error getting vendor subscriptions:", error);
      res.status(500).json({ error: "Failed to get subscriptions" });
    }
  });

  // Check blockchain limit for current user
  app.get("/api/blockchain-limit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limitInfo = await storage.checkBlockchainLimit(userId);
      
      res.json(limitInfo);
    } catch (error) {
      console.error("Error checking blockchain limit:", error);
      res.status(500).json({ error: "Failed to check blockchain limit" });
    }
  });

  // Toggle blockchain subscription
  app.post("/api/blockchain/:key/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const chainKey = req.params.key;
      
      const result = await storage.toggleBlockchainSubscription(userId, chainKey);
      res.json(result);
    } catch (error: any) {
      console.error("Error toggling blockchain subscription:", error);
      res.status(400).json({ error: error.message || "Failed to toggle subscription" });
    }
  });

  // Get user's subscribed blockchains
  app.get("/api/subscriptions/blockchain", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscribedKeys = await storage.getUserBlockchainSubscriptions(userId);
      const hasSetSubscriptions = await storage.hasUserSetBlockchainSubscriptions(userId);
      const limitInfo = await storage.checkBlockchainLimit(userId);
      
      res.json({
        subscribedChains: subscribedKeys,
        hasSetSubscriptions,
        ...limitInfo
      });
    } catch (error) {
      console.error("Error getting blockchain subscriptions:", error);
      res.status(500).json({ error: "Failed to get subscriptions" });
    }
  });

  // Direct vendor add for Platinum users
  app.post("/api/vendors/direct", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.subscriptionTier !== 'platinum') {
        return res.status(403).json({ error: "Only Platinum users can add vendors directly" });
      }
      
      const validated = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(validated);
      res.status(201).json(vendor);
    } catch (error: any) {
      console.error("Error adding vendor directly:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid vendor data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add vendor" });
    }
  });

  // ============ NOTIFICATIONS ============

  app.get("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        notificationEmail: user.notificationEmail || user.email || "",
        phone: user.phone || "",
        notifyEmail: user.notifyEmail ?? true,
        notifySms: user.notifySms ?? false,
      });
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.put("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const { notificationEmail, phone, notifyEmail, notifySms } = req.body;
      const user = await storage.updateUserNotifications(req.user.id, {
        notificationEmail,
        phone,
        notifyEmail,
        notifySms,
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ 
        success: true, 
        preferences: { 
          notificationEmail: user.notificationEmail || user.email, 
          phone: user.phone, 
          notifyEmail: user.notifyEmail, 
          notifySms: user.notifySms 
        } 
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // ============ SMS ============

  app.post("/api/sms/test", isAuthenticated, async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      const success = await sendSMS(phone, "Vendor Watch: This is a test alert. Your SMS notifications are working correctly!");
      if (success) {
        res.json({ success: true, message: "Test SMS sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send SMS" });
      }
    } catch (error) {
      console.error("Error sending test SMS:", error);
      res.status(500).json({ error: "Failed to send test SMS" });
    }
  });

  // ============ CONSENT MANAGEMENT ============

  app.post("/api/consents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const forwardedFor = req.headers['x-forwarded-for'];
      const ipAddress = forwardedFor 
        ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim())
        : req.socket.remoteAddress || null;

      const consentData = {
        userId: user.id,
        userEmail: user.email || undefined,
        channel: req.body.channel,
        destination: req.body.destination,
        consentText: req.body.consentText,
        consentMethod: req.body.consentMethod || 'checkbox',
        sourceContext: req.body.sourceContext || 'Dashboard',
        ipAddress,
        userAgent: req.headers['user-agent'] || null,
      };

      const validatedData = insertNotificationConsentSchema.parse(consentData);
      const consent = await storage.recordConsent(validatedData);
      res.status(201).json(consent);
    } catch (error: any) {
      console.error("Error recording consent:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid consent data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to record consent" });
    }
  });

  // Get all consents (admin only - for viewing consent records)
  app.get("/api/consents", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const channel = req.query.channel as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const consents = await storage.getConsents({ channel, limit, offset });
      const total = await storage.getConsentsCount();
      
      res.json({ consents, total, limit, offset });
    } catch (error) {
      console.error("Error fetching consents:", error);
      res.status(500).json({ error: "Failed to fetch consents" });
    }
  });

  app.get("/api/consents/user", isAuthenticated, async (req: any, res) => {
    try {
      const consents = await storage.getConsentsByUser(req.user.id);
      res.json(consents);
    } catch (error) {
      console.error("Error fetching user consents:", error);
      res.status(500).json({ error: "Failed to fetch consents" });
    }
  });

  app.post("/api/consents/:id/revoke", isAuthenticated, async (req: any, res) => {
    try {
      const consent = await storage.revokeConsent(req.params.id);
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }
      res.json(consent);
    } catch (error) {
      console.error("Error revoking consent:", error);
      res.status(500).json({ error: "Failed to revoke consent" });
    }
  });

  // ============ COMPLIANCE ENDPOINT (Token-protected for Twilio) ============
  
  app.get("/compliance/consents", async (req, res) => {
    const token = req.query.token as string;
    const expectedToken = process.env.COMPLIANCE_ACCESS_TOKEN;
    
    if (!expectedToken) {
      return res.status(503).send("Compliance access not configured. Set COMPLIANCE_ACCESS_TOKEN environment variable.");
    }
    
    if (token !== expectedToken) {
      return res.status(401).send("Unauthorized: Invalid or missing access token");
    }
    
    try {
      const channel = req.query.channel as string | undefined;
      const consents = await storage.getConsents({ channel, limit: 500 });
      
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Vendor Watch - Notification Consent Records</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    h1 { color: #333; }
    .info { background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #333; color: white; }
    tr:hover { background: #f9f9f9; }
    .channel-sms { background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 4px; }
    .channel-email { background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 4px; }
    .revoked { color: #d32f2f; }
    .active { color: #2e7d32; }
  </style>
</head>
<body>
  <h1>Vendor Watch - Notification Consent Records</h1>
  <div class="info">
    <strong>Compliance Report</strong><br>
    Generated: ${new Date().toISOString()}<br>
    Total Records: ${consents.length}
  </div>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>User ID</th>
        <th>User Email</th>
        <th>Channel</th>
        <th>Destination</th>
        <th>Consent Text</th>
        <th>Method</th>
        <th>Source</th>
        <th>IP Address</th>
        <th>Consented At</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${consents.map(c => `
        <tr>
          <td>${c.id}</td>
          <td>${c.userId}</td>
          <td>${c.userEmail || '-'}</td>
          <td><span class="channel-${c.channel}">${c.channel.toUpperCase()}</span></td>
          <td>${c.destination}</td>
          <td>${c.consentText}</td>
          <td>${c.consentMethod}</td>
          <td>${c.sourceContext}</td>
          <td>${c.ipAddress || '-'}</td>
          <td>${new Date(c.consentedAt).toISOString()}</td>
          <td class="${c.revokedAt ? 'revoked' : 'active'}">${c.revokedAt ? 'Revoked ' + new Date(c.revokedAt).toISOString() : 'Active'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error("Error generating compliance report:", error);
      res.status(500).send("Failed to generate compliance report");
    }
  });

  // ============ FEEDBACK ============

  app.get("/api/feedback", isAuthenticated, async (req, res) => {
    try {
      const allFeedback = await storage.getFeedback();
      res.json(allFeedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertFeedbackSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      const newFeedback = await storage.createFeedback(validatedData);
      res.status(201).json(newFeedback);
    } catch (error: any) {
      console.error("Error creating feedback:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid feedback data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // ============ BLOCKCHAIN MONITORING ============

  // Get all blockchain chains
  app.get("/api/blockchain/chains", isAuthenticated, async (req, res) => {
    try {
      const chains = await storage.getBlockchainChains();
      res.json(chains);
    } catch (error) {
      console.error("Error fetching blockchain chains:", error);
      res.status(500).json({ error: "Failed to fetch blockchain chains" });
    }
  });

  // Get chains by tier
  app.get("/api/blockchain/chains/tier/:tier", isAuthenticated, async (req, res) => {
    try {
      const { tier } = req.params;
      const chains = await storage.getBlockchainChainsByTier(tier);
      res.json(chains);
    } catch (error) {
      console.error("Error fetching chains by tier:", error);
      res.status(500).json({ error: "Failed to fetch chains by tier" });
    }
  });

  // Get single chain
  app.get("/api/blockchain/chains/:key", isAuthenticated, async (req, res) => {
    try {
      const chain = await storage.getBlockchainChain(req.params.key);
      if (!chain) {
        return res.status(404).json({ error: "Chain not found" });
      }
      res.json(chain);
    } catch (error) {
      console.error("Error fetching chain:", error);
      res.status(500).json({ error: "Failed to fetch chain" });
    }
  });

  // Get all blockchain incidents
  app.get("/api/blockchain/incidents", isAuthenticated, async (req, res) => {
    try {
      const incidents = await storage.getBlockchainIncidents();
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching blockchain incidents:", error);
      res.status(500).json({ error: "Failed to fetch blockchain incidents" });
    }
  });

  // Get active blockchain incidents
  app.get("/api/blockchain/incidents/active", isAuthenticated, async (req, res) => {
    try {
      const incidents = await storage.getActiveBlockchainIncidents();
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching active blockchain incidents:", error);
      res.status(500).json({ error: "Failed to fetch active blockchain incidents" });
    }
  });

  // Get incidents for a specific chain
  app.get("/api/blockchain/incidents/chain/:chainKey", isAuthenticated, async (req, res) => {
    try {
      const incidents = await storage.getBlockchainIncidentsByChain(req.params.chainKey);
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching chain incidents:", error);
      res.status(500).json({ error: "Failed to fetch chain incidents" });
    }
  });

  // Blockchain stats overview
  app.get("/api/blockchain/stats", isAuthenticated, async (req, res) => {
    try {
      const chains = await storage.getBlockchainChains();
      const activeIncidents = await storage.getActiveBlockchainIncidents();
      
      const stats = {
        totalChains: chains.length,
        operationalChains: chains.filter(c => c.status === 'operational').length,
        degradedChains: chains.filter(c => c.status === 'degraded').length,
        outageChains: chains.filter(c => c.status === 'major_outage').length,
        activeIncidents: activeIncidents.length,
        chainsByTier: {
          tier1: chains.filter(c => c.tier === 'tier1').length,
          tier2: chains.filter(c => c.tier === 'tier2').length,
          tier3: chains.filter(c => c.tier === 'tier3').length,
          tier4: chains.filter(c => c.tier === 'tier4').length,
        },
        chainsByCategory: {
          chain: chains.filter(c => c.category === 'chain').length,
          l2: chains.filter(c => c.category === 'l2').length,
          rpc_provider: chains.filter(c => c.category === 'rpc_provider').length,
          indexer: chains.filter(c => c.category === 'indexer').length,
        }
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching blockchain stats:", error);
      res.status(500).json({ error: "Failed to fetch blockchain stats" });
    }
  });

  // Manual blockchain sync trigger
  app.post("/api/blockchain/sync", isAuthenticated, async (req, res) => {
    try {
      console.log("[blockchain] Manual sync triggered");
      await syncAllBlockchainChains();
      res.json({ success: true, message: "Blockchain sync completed" });
    } catch (error) {
      console.error("Error syncing blockchain chains:", error);
      res.status(500).json({ error: "Failed to sync blockchain chains" });
    }
  });

  // ============ INCIDENT ACKNOWLEDGEMENTS ============
  
  // Get user's acknowledged incidents
  app.get("/api/incidents/acknowledgements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const acknowledgements = await storage.getUserAcknowledgements(userId);
      res.json(acknowledgements);
    } catch (error) {
      console.error("Error fetching acknowledgements:", error);
      res.status(500).json({ error: "Failed to fetch acknowledgements" });
    }
  });

  // Acknowledge a vendor incident
  app.post("/api/incidents/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const incidentId = req.params.id;
      const ack = await storage.acknowledgeIncident(userId, incidentId, 'vendor');
      res.json({ success: true, acknowledgement: ack });
    } catch (error) {
      console.error("Error acknowledging incident:", error);
      res.status(500).json({ error: "Failed to acknowledge incident" });
    }
  });

  // Unacknowledge a vendor incident
  app.delete("/api/incidents/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const incidentId = req.params.id;
      await storage.unacknowledgeIncident(userId, incidentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unacknowledging incident:", error);
      res.status(500).json({ error: "Failed to unacknowledge incident" });
    }
  });

  // Acknowledge a blockchain incident
  app.post("/api/blockchain/incidents/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const incidentId = req.params.id;
      const ack = await storage.acknowledgeIncident(userId, incidentId, 'blockchain');
      res.json({ success: true, acknowledgement: ack });
    } catch (error) {
      console.error("Error acknowledging blockchain incident:", error);
      res.status(500).json({ error: "Failed to acknowledge blockchain incident" });
    }
  });

  // Unacknowledge a blockchain incident
  app.delete("/api/blockchain/incidents/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const incidentId = req.params.id;
      await storage.unacknowledgeIncident(userId, incidentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unacknowledging blockchain incident:", error);
      res.status(500).json({ error: "Failed to unacknowledge blockchain incident" });
    }
  });

  // ============ MAINTENANCE TRACKING ============

  // Get all vendor maintenances
  app.get("/api/maintenance/vendors", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getVendorMaintenances();
      res.json(maintenances);
    } catch (error) {
      console.error("Error fetching vendor maintenances:", error);
      res.status(500).json({ error: "Failed to fetch vendor maintenances" });
    }
  });

  // Get active vendor maintenances (in progress)
  app.get("/api/maintenance/vendors/active", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getActiveVendorMaintenances();
      res.json(maintenances);
    } catch (error) {
      console.error("Error fetching active vendor maintenances:", error);
      res.status(500).json({ error: "Failed to fetch active vendor maintenances" });
    }
  });

  // Get upcoming vendor maintenances (scheduled)
  app.get("/api/maintenance/vendors/upcoming", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getUpcomingVendorMaintenances();
      res.json(maintenances);
    } catch (error) {
      console.error("Error fetching upcoming vendor maintenances:", error);
      res.status(500).json({ error: "Failed to fetch upcoming vendor maintenances" });
    }
  });

  // Get all blockchain maintenances
  app.get("/api/maintenance/blockchain", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getBlockchainMaintenances();
      res.json(maintenances);
    } catch (error) {
      console.error("Error fetching blockchain maintenances:", error);
      res.status(500).json({ error: "Failed to fetch blockchain maintenances" });
    }
  });

  // Get active blockchain maintenances (in progress)
  app.get("/api/maintenance/blockchain/active", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getActiveBlockchainMaintenances();
      res.json(maintenances);
    } catch (error) {
      console.error("Error fetching active blockchain maintenances:", error);
      res.status(500).json({ error: "Failed to fetch active blockchain maintenances" });
    }
  });

  // Get upcoming blockchain maintenances (scheduled)
  app.get("/api/maintenance/blockchain/upcoming", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getUpcomingBlockchainMaintenances();
      res.json(maintenances);
    } catch (error) {
      console.error("Error fetching upcoming blockchain maintenances:", error);
      res.status(500).json({ error: "Failed to fetch upcoming blockchain maintenances" });
    }
  });

  // Get maintenance statistics
  app.get("/api/maintenance/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getMaintenanceStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching maintenance stats:", error);
      res.status(500).json({ error: "Failed to fetch maintenance stats" });
    }
  });

  // ============ TWO-FACTOR AUTHENTICATION ============
  
  // Get 2FA status for current user
  app.get("/api/2fa/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ 
        enabled: user.twoFactorEnabled || false,
        hasSecret: !!user.twoFactorSecret
      });
    } catch (error) {
      console.error("Error getting 2FA status:", error);
      res.status(500).json({ error: "Failed to get 2FA status" });
    }
  });

  // Start 2FA setup - generates secret and QR code
  app.post("/api/2fa/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.twoFactorEnabled) {
        return res.status(400).json({ error: "2FA is already enabled" });
      }
      
      const email = user.notificationEmail || user.email || 'user@vendorwatch.app';
      const setup = await setupTwoFactor(email);
      
      // Store the secret and recovery codes (not yet enabled)
      await storage.setUserTwoFactorSecret(userId, setup.secret, setup.recoveryCodes);
      
      res.json({
        qrCodeDataUrl: setup.qrCodeDataUrl,
        recoveryCodes: setup.recoveryCodes,
        secret: setup.secret // Allow manual entry if QR scan fails
      });
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      res.status(500).json({ error: "Failed to setup 2FA" });
    }
  });

  // Verify and enable 2FA
  app.post("/api/2fa/verify-setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.twoFactorEnabled) {
        return res.status(400).json({ error: "2FA is already enabled" });
      }
      
      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: "Please start 2FA setup first" });
      }
      
      const isValid = verifyTOTP(token.replace(/\s/g, ''), user.twoFactorSecret);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      await storage.enableUserTwoFactor(userId);
      
      res.json({ success: true, message: "2FA enabled successfully" });
    } catch (error) {
      console.error("Error verifying 2FA setup:", error);
      res.status(500).json({ error: "Failed to verify 2FA setup" });
    }
  });

  // Disable 2FA
  app.post("/api/2fa/disable", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (!user.twoFactorEnabled) {
        return res.status(400).json({ error: "2FA is not enabled" });
      }
      
      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: "2FA secret not found" });
      }
      
      // Verify the token first
      const isValid = verifyTOTP(token.replace(/\s/g, ''), user.twoFactorSecret);
      if (!isValid) {
        // Try recovery code
        const storedCodes = user.twoFactorRecoveryCodes?.split(',') || [];
        const recoveryResult = verifyRecoveryCode(token, storedCodes);
        if (!recoveryResult.valid) {
          return res.status(400).json({ error: "Invalid verification code" });
        }
      }
      
      await storage.disableUserTwoFactor(userId);
      
      res.json({ success: true, message: "2FA disabled successfully" });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      res.status(500).json({ error: "Failed to disable 2FA" });
    }
  });

  // Verify 2FA code during login (called after Replit Auth)
  app.post("/api/2fa/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { token, useRecovery } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: "2FA is not enabled for this account" });
      }
      
      if (useRecovery) {
        // Verify recovery code
        const storedCodes = user.twoFactorRecoveryCodes?.split(',') || [];
        const result = verifyRecoveryCode(token, storedCodes);
        
        if (!result.valid) {
          return res.status(400).json({ error: "Invalid recovery code" });
        }
        
        // Update remaining recovery codes
        await storage.updateUserRecoveryCodes(userId, result.remainingCodes);
        
        // Set session as 2FA verified
        if (req.session) {
          req.session.twoFactorVerified = true;
        }
        
        res.json({ 
          success: true, 
          message: "Recovery code verified", 
          remainingCodes: result.remainingCodes.length 
        });
      } else {
        // Verify TOTP token
        const isValid = verifyTOTP(token.replace(/\s/g, ''), user.twoFactorSecret);
        if (!isValid) {
          return res.status(400).json({ error: "Invalid verification code" });
        }
        
        // Set session as 2FA verified
        if (req.session) {
          req.session.twoFactorVerified = true;
        }
        
        res.json({ success: true, message: "2FA verified" });
      }
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      res.status(500).json({ error: "Failed to verify 2FA" });
    }
  });

  // Regenerate recovery codes
  app.post("/api/2fa/regenerate-codes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: "2FA is not enabled" });
      }
      
      // Verify the current token
      const isValid = verifyTOTP(token.replace(/\s/g, ''), user.twoFactorSecret);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      // Generate new recovery codes
      const newCodes = generateRecoveryCodes(10);
      await storage.updateUserRecoveryCodes(userId, newCodes);
      
      res.json({ success: true, recoveryCodes: newCodes });
    } catch (error) {
      console.error("Error regenerating recovery codes:", error);
      res.status(500).json({ error: "Failed to regenerate recovery codes" });
    }
  });

  // Check if current session has completed 2FA verification
  app.get("/api/2fa/session-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // If 2FA is not enabled, they're verified by default
      if (!user.twoFactorEnabled) {
        return res.json({ requires2FA: false, verified: true });
      }
      
      // Check session for 2FA verification
      const verified = req.session?.twoFactorVerified === true;
      
      res.json({ 
        requires2FA: true, 
        verified 
      });
    } catch (error) {
      console.error("Error checking 2FA session:", error);
      res.status(500).json({ error: "Failed to check 2FA session" });
    }
  });

  return httpServer;
}
