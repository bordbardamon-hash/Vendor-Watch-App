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
  
  // ============ INCIDENT ARCHIVE ============
  
  // Search archived incidents (protected)
  app.get("/api/incidents/archive", isAuthenticated, async (req, res) => {
    try {
      const { vendorKey, query, dateRange, limit, offset } = req.query;
      const archived = await storage.searchArchivedIncidents({
        vendorKey: vendorKey as string | undefined,
        query: query as string | undefined,
        dateRange: dateRange as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });
      res.json(archived);
    } catch (error) {
      console.error("Error searching archived incidents:", error);
      res.status(500).json({ error: "Failed to search archived incidents" });
    }
  });
  
  // Get archived incidents count (protected)
  app.get("/api/incidents/archive/count", isAuthenticated, async (req, res) => {
    try {
      const { vendorKey, query } = req.query;
      const count = await storage.getArchivedIncidentsCount({
        vendorKey: vendorKey as string | undefined,
        query: query as string | undefined,
      });
      res.json({ count });
    } catch (error) {
      console.error("Error getting archived incidents count:", error);
      res.status(500).json({ error: "Failed to get archived incidents count" });
    }
  });
  
  // Manual trigger for archival (admin only)
  app.post("/api/incidents/archive/run", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const archived = await storage.archiveResolvedIncidents(3); // 3 days
      const purged = await storage.purgeOldArchivedIncidents(365); // 1 year
      res.json({ 
        message: "Archival complete", 
        archived, 
        purged,
        archivedMessage: `Archived ${archived} resolved incidents older than 3 days`,
        purgedMessage: `Purged ${purged} archived incidents older than 1 year`
      });
    } catch (error) {
      console.error("Error running archival:", error);
      res.status(500).json({ error: "Failed to run archival" });
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
      await storage.logUserActivity(userId, 'incident_ack', { incidentId, type: 'vendor' });
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

  // Get acknowledgement history for an incident (with user details)
  app.get("/api/incidents/:id/acknowledgement-history", isAuthenticated, async (req: any, res) => {
    try {
      const incidentId = req.params.id;
      const history = await storage.getIncidentAcknowledgementHistory(incidentId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching acknowledgement history:", error);
      res.status(500).json({ error: "Failed to fetch acknowledgement history" });
    }
  });

  // Generate customer-ready incident summary email template
  app.get("/api/incidents/:id/customer-summary", isAuthenticated, async (req: any, res) => {
    try {
      const incidents = await storage.getIncidents();
      const incident = incidents.find(i => i.id === req.params.id);
      
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      
      const vendors = await storage.getVendors();
      const vendor = vendors.find(v => v.key === incident.vendorKey);
      const vendorName = vendor?.name || incident.vendorKey;
      
      const statusText = incident.status === 'resolved' 
        ? 'RESOLVED' 
        : incident.status === 'investigating' 
          ? 'Under Investigation' 
          : 'In Progress';
      
      const impactLevel = incident.severity === 'critical' 
        ? 'significant' 
        : incident.severity === 'major' 
          ? 'moderate' 
          : 'minimal';
      
      const startDate = new Date(incident.startedAt);
      const formattedDate = startDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
      
      const subject = `[${statusText}] ${vendorName} Service Update - ${incident.title}`;
      
      const emailBody = `Dear Valued Client,

We are writing to inform you of a service event affecting ${vendorName}.

**Incident Summary**
- Status: ${statusText}
- Started: ${formattedDate}
- Impact Level: ${impactLevel.charAt(0).toUpperCase() + impactLevel.slice(1)}

**Description**
${incident.impact || incident.title}

**Current Status**
${incident.status === 'resolved' 
  ? `This incident has been resolved. Services have returned to normal operation.`
  : `Our team is actively monitoring this situation. ${vendorName}'s engineering team is working to resolve the issue.`}

**What This Means for You**
${incident.severity === 'critical' || incident.severity === 'major'
  ? `You may experience ${impactLevel} disruption to services that depend on ${vendorName}. We recommend planning for potential delays or interruptions.`
  : `This event may have ${impactLevel} impact on your services. No immediate action is required.`}

**Next Steps**
We will continue to monitor this situation and provide updates as they become available.

If you have any questions or concerns, please don't hesitate to contact our support team.

Best regards,
Your IT Support Team

---
Vendor Watch | Automated Service Monitoring`;

      const plainText = emailBody
        .replace(/\*\*/g, '')
        .replace(/\n\n/g, '\n\n');

      res.json({
        subject,
        emailBody,
        plainText,
        incident: {
          id: incident.id,
          title: incident.title,
          status: incident.status,
          severity: incident.severity,
          vendorName,
          startedAt: incident.startedAt,
        }
      });
    } catch (error) {
      console.error("Error generating customer summary:", error);
      res.status(500).json({ error: "Failed to generate customer summary" });
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
      await storage.logUserActivity(userId, 'incident_ack', { incidentId, type: 'blockchain' });
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

  // Get user's maintenance acknowledgements
  app.get("/api/maintenance/acknowledgements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const acks = await storage.getUserMaintenanceAcknowledgements(userId);
      res.json(acks);
    } catch (error) {
      console.error("Error fetching maintenance acknowledgements:", error);
      res.status(500).json({ error: "Failed to fetch maintenance acknowledgements" });
    }
  });

  // Acknowledge a vendor maintenance
  app.post("/api/maintenance/vendors/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const maintenanceId = req.params.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const ack = await storage.acknowledgeMaintenance(userId, maintenanceId, 'vendor');
      await storage.logUserActivity(userId, 'maintenance_ack', { maintenanceId, type: 'vendor' });
      res.json(ack);
    } catch (error) {
      console.error("Error acknowledging vendor maintenance:", error);
      res.status(500).json({ error: "Failed to acknowledge vendor maintenance" });
    }
  });

  // Unacknowledge a vendor maintenance
  app.delete("/api/maintenance/vendors/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const maintenanceId = req.params.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.unacknowledgeMaintenance(userId, maintenanceId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unacknowledging vendor maintenance:", error);
      res.status(500).json({ error: "Failed to unacknowledge vendor maintenance" });
    }
  });

  // Acknowledge a blockchain maintenance
  app.post("/api/maintenance/blockchain/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const maintenanceId = req.params.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const ack = await storage.acknowledgeMaintenance(userId, maintenanceId, 'blockchain');
      await storage.logUserActivity(userId, 'maintenance_ack', { maintenanceId, type: 'blockchain' });
      res.json(ack);
    } catch (error) {
      console.error("Error acknowledging blockchain maintenance:", error);
      res.status(500).json({ error: "Failed to acknowledge blockchain maintenance" });
    }
  });

  // Unacknowledge a blockchain maintenance
  app.delete("/api/maintenance/blockchain/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const maintenanceId = req.params.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      await storage.unacknowledgeMaintenance(userId, maintenanceId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unacknowledging blockchain maintenance:", error);
      res.status(500).json({ error: "Failed to unacknowledge blockchain maintenance" });
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

  // ============ SLA DASHBOARD ROUTES ============
  
  // Get SLA metrics for all vendors
  app.get("/api/sla/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const target = parseFloat(req.query.target as string) || 99.9;
      
      const vendors = await storage.getVendors();
      const vendorMetrics = await storage.getAllVendorPerformanceStats(days);
      const { getAllVendorReliability } = await import('./reliabilityTracker');
      const reliabilityStats = await getAllVendorReliability();
      
      const totalMinutesInPeriod = days * 24 * 60;
      
      const vendorSLAs = vendors.map(vendor => {
        const metrics = vendorMetrics.find((m: any) => m.vendorKey === vendor.key);
        const reliabilityData = reliabilityStats.find((r: any) => r.vendorKey === vendor.key);
        const reliability = reliabilityData?.metrics;
        
        // Use uptimePercent from metrics if available
        const uptimePercent = metrics?.uptimePercent ?? 100;
        // Calculate downtime from uptime percentage
        const downtimeMinutes = Math.round(totalMinutesInPeriod * (1 - uptimePercent / 100));
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (reliability) {
          if (reliability.incidents30Days > reliability.incidents90Days / 3) {
            trend = 'down';
          } else if (reliability.incidents30Days < reliability.incidents90Days / 4) {
            trend = 'up';
          }
        }
        
        return {
          vendorKey: vendor.key,
          vendorName: vendor.name,
          uptimePercent: Math.min(100, Math.max(0, uptimePercent)),
          downtimeMinutes,
          incidentCount: metrics?.incidentCount || 0,
          avgResolutionMinutes: reliability?.avgResolutionMinutes ?? null,
          slaTarget: target,
          meetsTarget: uptimePercent >= target,
          trend,
        };
      });
      
      vendorSLAs.sort((a, b) => a.uptimePercent - b.uptimePercent);
      
      const totalUptime = vendorSLAs.reduce((sum, v) => sum + v.uptimePercent, 0);
      const overallUptime = vendorSLAs.length > 0 ? totalUptime / vendorSLAs.length : 100;
      const totalIncidents = vendorSLAs.reduce((sum, v) => sum + v.incidentCount, 0);
      const resolutionTimes = vendorSLAs.filter(v => v.avgResolutionMinutes !== null).map(v => v.avgResolutionMinutes!);
      const avgResolution = resolutionTimes.length > 0 
        ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
        : 0;
      const vendorsBelowTarget = vendorSLAs.filter(v => !v.meetsTarget).length;
      
      res.json({
        vendors: vendorSLAs,
        overallUptime,
        totalIncidents,
        avgResolution,
        vendorsBelowTarget,
      });
    } catch (error) {
      console.error("Error fetching SLA metrics:", error);
      res.status(500).json({ error: "Failed to fetch SLA metrics" });
    }
  });

  // ============ ANALYTICS ROUTES ============
  
  // Log user activity (page views, etc.)
  app.post("/api/analytics/activity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { eventType, metadata } = req.body;
      if (!eventType) {
        return res.status(400).json({ error: "Event type is required" });
      }
      
      await storage.logUserActivity(userId, eventType, metadata);
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging activity:", error);
      res.status(500).json({ error: "Failed to log activity" });
    }
  });

  // Get current user's activity stats
  app.get("/api/analytics/my-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const days = parseInt(req.query.days as string) || 30;
      const stats = await storage.getUserActivityStats(userId, days);
      res.json(stats);
    } catch (error) {
      console.error("Error getting user stats:", error);
      res.status(500).json({ error: "Failed to get user stats" });
    }
  });

  // Get current user's recent activity
  app.get("/api/analytics/my-activity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const limit = parseInt(req.query.limit as string) || 20;
      const activity = await storage.getUserRecentActivity(userId, limit);
      res.json(activity);
    } catch (error) {
      console.error("Error getting user activity:", error);
      res.status(500).json({ error: "Failed to get user activity" });
    }
  });

  // Get vendor performance stats (all vendors)
  app.get("/api/analytics/vendors", isAuthenticated, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const stats = await storage.getAllVendorPerformanceStats(days);
      res.json(stats);
    } catch (error) {
      console.error("Error getting vendor stats:", error);
      res.status(500).json({ error: "Failed to get vendor stats" });
    }
  });

  // Get single vendor performance stats
  app.get("/api/analytics/vendors/:vendorKey", isAuthenticated, async (req: any, res) => {
    try {
      const { vendorKey } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const stats = await storage.getVendorPerformanceStats(vendorKey, days);
      res.json(stats);
    } catch (error) {
      console.error("Error getting vendor stats:", error);
      res.status(500).json({ error: "Failed to get vendor stats" });
    }
  });

  // Admin: Record vendor daily metrics (for scheduled jobs)
  app.post("/api/analytics/vendors/:vendorKey/metrics", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { vendorKey } = req.params;
      const { date, uptimeMinutes, downtimeMinutes, incidentCount, avgResolutionMinutes } = req.body;
      
      if (!date || uptimeMinutes === undefined || downtimeMinutes === undefined || incidentCount === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      await storage.recordVendorDailyMetrics(vendorKey, date, {
        uptimeMinutes,
        downtimeMinutes,
        incidentCount,
        avgResolutionMinutes,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording vendor metrics:", error);
      res.status(500).json({ error: "Failed to record vendor metrics" });
    }
  });

  // Get blockchain performance stats (all blockchains)
  app.get("/api/analytics/blockchain", isAuthenticated, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const stats = await storage.getAllBlockchainPerformanceStats(days);
      res.json(stats);
    } catch (error) {
      console.error("Error getting blockchain stats:", error);
      res.status(500).json({ error: "Failed to get blockchain stats" });
    }
  });

  // Get single blockchain performance stats
  app.get("/api/analytics/blockchain/:chainKey", isAuthenticated, async (req: any, res) => {
    try {
      const { chainKey } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const stats = await storage.getBlockchainPerformanceStats(chainKey, days);
      res.json(stats);
    } catch (error) {
      console.error("Error getting blockchain stats:", error);
      res.status(500).json({ error: "Failed to get blockchain stats" });
    }
  });

  // ============ ANALYTICS PRECOMPUTE ============

  // Admin: Precompute vendor metrics for a date range (for scheduled nightly jobs)
  app.post("/api/analytics/precompute", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { date } = req.body;
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const vendors = await storage.getVendors();
      const incidents = await storage.getIncidents();
      let computed = 0;
      
      for (const vendor of vendors) {
        const vendorIncidents = incidents.filter(i => {
          const incidentDate = new Date(i.startedAt).toISOString().split('T')[0];
          return i.vendorKey === vendor.key && incidentDate === targetDate;
        });
        
        let totalDowntimeMinutes = 0;
        let totalResolutionMinutes = 0;
        let resolvedCount = 0;
        
        for (const incident of vendorIncidents) {
          const start = new Date(incident.startedAt).getTime();
          const end = new Date(incident.updatedAt).getTime();
          const durationMinutes = Math.round((end - start) / (1000 * 60));
          
          totalDowntimeMinutes += durationMinutes;
          
          if (incident.status === 'resolved') {
            totalResolutionMinutes += durationMinutes;
            resolvedCount++;
          }
        }
        
        const uptimeMinutes = 1440 - totalDowntimeMinutes;
        const avgResolutionMinutes = resolvedCount > 0 
          ? Math.round(totalResolutionMinutes / resolvedCount) 
          : undefined;
        
        await storage.recordVendorDailyMetrics(vendor.key, targetDate, {
          uptimeMinutes: Math.max(0, uptimeMinutes),
          downtimeMinutes: totalDowntimeMinutes,
          incidentCount: vendorIncidents.length,
          avgResolutionMinutes,
        });
        
        computed++;
      }
      
      console.log(`[analytics] Precomputed metrics for ${computed} vendors on ${targetDate}`);
      res.json({ success: true, computed, date: targetDate });
    } catch (error) {
      console.error("Error precomputing analytics:", error);
      res.status(500).json({ error: "Failed to precompute analytics" });
    }
  });

  // Admin: Backfill analytics for past N days
  app.post("/api/analytics/backfill", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { days = 30 } = req.body;
      const today = new Date();
      let totalComputed = 0;
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const vendors = await storage.getVendors();
        const incidents = await storage.getIncidents();
        
        for (const vendor of vendors) {
          const vendorIncidents = incidents.filter(i => {
            const incidentDate = new Date(i.startedAt).toISOString().split('T')[0];
            return i.vendorKey === vendor.key && incidentDate === dateStr;
          });
          
          let totalDowntimeMinutes = 0;
          let totalResolutionMinutes = 0;
          let resolvedCount = 0;
          
          for (const incident of vendorIncidents) {
            const start = new Date(incident.startedAt).getTime();
            const end = new Date(incident.updatedAt).getTime();
            const durationMinutes = Math.round((end - start) / (1000 * 60));
            
            totalDowntimeMinutes += durationMinutes;
            
            if (incident.status === 'resolved') {
              totalResolutionMinutes += durationMinutes;
              resolvedCount++;
            }
          }
          
          const uptimeMinutes = 1440 - totalDowntimeMinutes;
          const avgResolutionMinutes = resolvedCount > 0 
            ? Math.round(totalResolutionMinutes / resolvedCount) 
            : undefined;
          
          await storage.recordVendorDailyMetrics(vendor.key, dateStr, {
            uptimeMinutes: Math.max(0, uptimeMinutes),
            downtimeMinutes: totalDowntimeMinutes,
            incidentCount: vendorIncidents.length,
            avgResolutionMinutes,
          });
          
          totalComputed++;
        }
      }
      
      console.log(`[analytics] Backfilled ${totalComputed} vendor-day metrics for ${days} days`);
      res.json({ success: true, totalComputed, days });
    } catch (error) {
      console.error("Error backfilling analytics:", error);
      res.status(500).json({ error: "Failed to backfill analytics" });
    }
  });

  // ============ PREDICTIVE RELIABILITY ALERTS ============

  // Get vendors with declining reliability trends
  app.get("/api/reliability/trends", isAuthenticated, async (req: any, res) => {
    try {
      const vendors = await storage.getVendors();
      const incidents = await storage.getIncidents();
      const now = new Date();
      
      const trends: Array<{
        vendorKey: string;
        vendorName: string;
        trend: 'declining' | 'stable' | 'improving';
        recentIncidents: number;
        previousIncidents: number;
        changePercent: number;
        riskLevel: 'high' | 'medium' | 'low';
        recommendation: string;
      }> = [];
      
      for (const vendor of vendors) {
        const vendorIncidents = incidents.filter(i => i.vendorKey === vendor.key);
        
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        
        const recentIncidents = vendorIncidents.filter(i => new Date(i.startedAt) >= thirtyDaysAgo).length;
        const previousIncidents = vendorIncidents.filter(i => {
          const date = new Date(i.startedAt);
          return date >= sixtyDaysAgo && date < thirtyDaysAgo;
        }).length;
        
        let trend: 'declining' | 'stable' | 'improving' = 'stable';
        let changePercent = 0;
        
        if (previousIncidents > 0) {
          changePercent = Math.round(((recentIncidents - previousIncidents) / previousIncidents) * 100);
          if (changePercent >= 50) trend = 'declining';
          else if (changePercent <= -30) trend = 'improving';
        } else if (recentIncidents > 0) {
          changePercent = 100;
          trend = 'declining';
        }
        
        let riskLevel: 'high' | 'medium' | 'low' = 'low';
        let recommendation = 'Continue normal monitoring.';
        
        if (trend === 'declining') {
          if (recentIncidents >= 5 || changePercent >= 100) {
            riskLevel = 'high';
            recommendation = 'Consider notifying stakeholders and reviewing backup options.';
          } else {
            riskLevel = 'medium';
            recommendation = 'Monitor closely for further incidents.';
          }
        } else if (trend === 'improving') {
          recommendation = 'Reliability is improving. Consider reducing alert thresholds.';
        }
        
        if (trend !== 'stable' || recentIncidents > 0 || previousIncidents > 0) {
          trends.push({
            vendorKey: vendor.key,
            vendorName: vendor.name,
            trend,
            recentIncidents,
            previousIncidents,
            changePercent,
            riskLevel,
            recommendation,
          });
        }
      }
      
      trends.sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        }
        return b.recentIncidents - a.recentIncidents;
      });
      
      res.json({
        trends,
        summary: {
          total: trends.length,
          declining: trends.filter(t => t.trend === 'declining').length,
          improving: trends.filter(t => t.trend === 'improving').length,
          highRisk: trends.filter(t => t.riskLevel === 'high').length,
        }
      });
    } catch (error) {
      console.error("Error calculating reliability trends:", error);
      res.status(500).json({ error: "Failed to calculate reliability trends" });
    }
  });

  // ============ PSA WEBHOOKS ============

  // Get user's PSA webhooks
  app.get("/api/webhooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const webhooks = await storage.getPsaWebhooks(userId);
      res.json(webhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });

  // Create a new PSA webhook
  app.post("/api/webhooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { name, platform, webhookUrl, secret, events, isActive } = req.body;
      
      if (!name || !platform || !webhookUrl || !events) {
        return res.status(400).json({ error: "Missing required fields: name, platform, webhookUrl, events" });
      }
      
      const webhook = await storage.createPsaWebhook({
        userId,
        name,
        platform,
        webhookUrl,
        secret: secret || null,
        events: Array.isArray(events) ? events.join(',') : events,
        isActive: isActive !== false,
      });
      
      res.status(201).json(webhook);
    } catch (error) {
      console.error("Error creating webhook:", error);
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });

  // Update a PSA webhook
  app.put("/api/webhooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const webhook = await storage.getPsaWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      if (webhook.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this webhook" });
      }
      
      const { name, platform, webhookUrl, secret, events, isActive } = req.body;
      
      const updated = await storage.updatePsaWebhook(req.params.id, {
        ...(name && { name }),
        ...(platform && { platform }),
        ...(webhookUrl && { webhookUrl }),
        ...(secret !== undefined && { secret }),
        ...(events && { events: Array.isArray(events) ? events.join(',') : events }),
        ...(isActive !== undefined && { isActive }),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating webhook:", error);
      res.status(500).json({ error: "Failed to update webhook" });
    }
  });

  // Delete a PSA webhook
  app.delete("/api/webhooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const webhook = await storage.getPsaWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      if (webhook.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this webhook" });
      }
      
      await storage.deletePsaWebhook(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });

  // Test a PSA webhook
  app.post("/api/webhooks/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const webhook = await storage.getPsaWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      if (webhook.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to test this webhook" });
      }
      
      const testPayload = {
        event: "test",
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test webhook from Vendor Watch",
          source: "vendor-watch",
        }
      };
      
      try {
        const response = await fetch(webhook.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.secret && { 'X-Webhook-Secret': webhook.secret }),
          },
          body: JSON.stringify(testPayload),
        });
        
        if (response.ok) {
          await storage.recordWebhookResult(webhook.id, true);
          res.json({ success: true, status: response.status });
        } else {
          await storage.recordWebhookResult(webhook.id, false);
          res.json({ success: false, status: response.status, error: await response.text() });
        }
      } catch (fetchError: any) {
        await storage.recordWebhookResult(webhook.id, false);
        res.json({ success: false, error: fetchError.message });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ error: "Failed to test webhook" });
    }
  });

  // ============ AUTONOMOUS RESPONSE ORCHESTRATOR ============

  // Get runbooks
  app.get("/api/orchestrator/runbooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const runbooks = await orchestrator.getRunbooks(userId);
      res.json(runbooks);
    } catch (error) {
      console.error("Error fetching runbooks:", error);
      res.status(500).json({ error: "Failed to fetch runbooks" });
    }
  });

  // Create runbook
  app.post("/api/orchestrator/runbooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const runbook = await orchestrator.createRunbook({ ...req.body, userId });
      res.status(201).json(runbook);
    } catch (error) {
      console.error("Error creating runbook:", error);
      res.status(500).json({ error: "Failed to create runbook" });
    }
  });

  // Update runbook
  app.put("/api/orchestrator/runbooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const existing = await orchestrator.getRunbook(req.params.id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Runbook not found" });
      }
      
      const runbook = await orchestrator.updateRunbook(req.params.id, req.body);
      res.json(runbook);
    } catch (error) {
      console.error("Error updating runbook:", error);
      res.status(500).json({ error: "Failed to update runbook" });
    }
  });

  // Delete runbook
  app.delete("/api/orchestrator/runbooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const existing = await orchestrator.getRunbook(req.params.id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Runbook not found" });
      }
      
      await orchestrator.deleteRunbook(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting runbook:", error);
      res.status(500).json({ error: "Failed to delete runbook" });
    }
  });

  // Get automation rules
  app.get("/api/orchestrator/rules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const rules = await orchestrator.getAutomationRules(userId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching automation rules:", error);
      res.status(500).json({ error: "Failed to fetch automation rules" });
    }
  });

  // Create automation rule
  app.post("/api/orchestrator/rules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const rule = await orchestrator.createAutomationRule({ ...req.body, userId });
      res.status(201).json(rule);
    } catch (error) {
      console.error("Error creating automation rule:", error);
      res.status(500).json({ error: "Failed to create automation rule" });
    }
  });

  // Update automation rule
  app.put("/api/orchestrator/rules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const existing = await orchestrator.getAutomationRule(req.params.id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Rule not found" });
      }
      
      const rule = await orchestrator.updateAutomationRule(req.params.id, req.body);
      res.json(rule);
    } catch (error) {
      console.error("Error updating automation rule:", error);
      res.status(500).json({ error: "Failed to update automation rule" });
    }
  });

  // Delete automation rule
  app.delete("/api/orchestrator/rules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const existing = await orchestrator.getAutomationRule(req.params.id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Rule not found" });
      }
      
      await orchestrator.deleteAutomationRule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting automation rule:", error);
      res.status(500).json({ error: "Failed to delete automation rule" });
    }
  });

  // Get escalation policies
  app.get("/api/orchestrator/escalation-policies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const policies = await orchestrator.getEscalationPolicies(userId);
      res.json(policies);
    } catch (error) {
      console.error("Error fetching escalation policies:", error);
      res.status(500).json({ error: "Failed to fetch escalation policies" });
    }
  });

  // Create escalation policy
  app.post("/api/orchestrator/escalation-policies", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const policy = await orchestrator.createEscalationPolicy({ ...req.body, userId });
      res.status(201).json(policy);
    } catch (error) {
      console.error("Error creating escalation policy:", error);
      res.status(500).json({ error: "Failed to create escalation policy" });
    }
  });

  // Get pending approvals
  app.get("/api/orchestrator/approvals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const approvals = await orchestrator.getPendingApprovals(userId);
      res.json(approvals);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  // Approve automation
  app.post("/api/orchestrator/approvals/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const approval = await orchestrator.approveAutomation(req.params.id, userId);
      res.json(approval);
    } catch (error) {
      console.error("Error approving automation:", error);
      res.status(500).json({ error: "Failed to approve automation" });
    }
  });

  // Reject automation
  app.post("/api/orchestrator/approvals/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { orchestrator } = await import('./orchestrator');
      const approval = await orchestrator.rejectAutomation(req.params.id, userId);
      res.json(approval);
    } catch (error) {
      console.error("Error rejecting automation:", error);
      res.status(500).json({ error: "Failed to reject automation" });
    }
  });

  // Get audit log
  app.get("/api/orchestrator/audit-log", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const limit = parseInt(req.query.limit as string) || 50;
      const { orchestrator } = await import('./orchestrator');
      const logs = await orchestrator.getAuditLog(userId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // ============ AI COMMUNICATION COPILOT ============

  // Generate incident update
  app.post("/api/ai-copilot/incident-update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { incidentId, audience, tone, includeNextSteps } = req.body;
      if (!incidentId) {
        return res.status(400).json({ error: "incidentId is required" });
      }
      
      // Authorization: Verify user can access this incident
      const incident = await storage.getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      
      const subscriptions = await storage.getUserVendorSubscriptions(userId);
      const user = await storage.getUser(userId);
      
      // Allow access if: user is admin, or incident vendor is in their subscriptions, or they have no subscriptions
      const hasAccess = user?.isAdmin || 
        subscriptions.length === 0 || 
        subscriptions.includes(incident.vendorKey);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied: You are not subscribed to this vendor" });
      }
      
      const { generateIncidentUpdate } = await import('./aiCopilot');
      const result = await generateIncidentUpdate(incidentId, {
        audience: audience || 'client',
        tone: tone || 'formal',
        includeNextSteps: includeNextSteps !== false,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error generating incident update:", error);
      res.status(500).json({ error: "Failed to generate incident update" });
    }
  });

  // Suggest root cause
  app.post("/api/ai-copilot/root-cause", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { incidentId } = req.body;
      if (!incidentId) {
        return res.status(400).json({ error: "incidentId is required" });
      }
      
      // Authorization check
      const incident = await storage.getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      
      const subscriptions = await storage.getUserVendorSubscriptions(userId);
      const user = await storage.getUser(userId);
      const hasAccess = user?.isAdmin || subscriptions.length === 0 || 
        subscriptions.includes(incident.vendorKey);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { suggestRootCause } = await import('./aiCopilot');
      const result = await suggestRootCause(incidentId);
      
      res.json(result);
    } catch (error) {
      console.error("Error suggesting root cause:", error);
      res.status(500).json({ error: "Failed to suggest root cause" });
    }
  });

  // Generate client persona message
  app.post("/api/ai-copilot/client-persona", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { incidentId, clientType } = req.body;
      if (!incidentId || !clientType) {
        return res.status(400).json({ error: "incidentId and clientType are required" });
      }
      
      // Authorization check
      const incident = await storage.getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      
      const subscriptions = await storage.getUserVendorSubscriptions(userId);
      const user = await storage.getUser(userId);
      const hasAccess = user?.isAdmin || subscriptions.length === 0 || 
        subscriptions.includes(incident.vendorKey);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { generateClientPersona } = await import('./aiCopilot');
      const result = await generateClientPersona(incidentId, clientType);
      
      res.json(result);
    } catch (error) {
      console.error("Error generating client persona:", error);
      res.status(500).json({ error: "Failed to generate client persona message" });
    }
  });

  // ============ SLA CONTRACTS & BREACH TRACKING ============

  // Get SLA contracts
  app.get("/api/sla/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const contracts = await storage.getSlaContracts(userId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching SLA contracts:", error);
      res.status(500).json({ error: "Failed to fetch SLA contracts" });
    }
  });

  // Create SLA contract
  app.post("/api/sla/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const contract = await storage.createSlaContract({ ...req.body, userId });
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating SLA contract:", error);
      res.status(500).json({ error: "Failed to create SLA contract" });
    }
  });

  // Get SLA breaches
  app.get("/api/sla/breaches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const breaches = await storage.getSlaBreaches(userId);
      res.json(breaches);
    } catch (error) {
      console.error("Error fetching SLA breaches:", error);
      res.status(500).json({ error: "Failed to fetch SLA breaches" });
    }
  });

  // Update SLA breach claim status
  app.put("/api/sla/breaches/:id/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { claimStatus } = req.body;
      const breach = await storage.updateSlaBreach(req.params.id, { claimStatus });
      res.json(breach);
    } catch (error) {
      console.error("Error updating SLA breach:", error);
      res.status(500).json({ error: "Failed to update SLA breach" });
    }
  });

  // Generate service credit claim
  app.post("/api/sla/breaches/:id/generate-claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { generateServiceCreditClaim } = await import('./slaBreachTracker');
      const claim = await generateServiceCreditClaim(req.params.id);
      res.json(claim);
    } catch (error) {
      console.error("Error generating service credit claim:", error);
      res.status(500).json({ error: "Failed to generate service credit claim" });
    }
  });

  // ============ SYNTHETIC MONITORING ============

  // Get synthetic probes
  app.get("/api/synthetic/probes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const probes = await storage.getSyntheticProbes(userId);
      res.json(probes);
    } catch (error) {
      console.error("Error fetching synthetic probes:", error);
      res.status(500).json({ error: "Failed to fetch synthetic probes" });
    }
  });

  // Create synthetic probe
  app.post("/api/synthetic/probes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const probe = await storage.createSyntheticProbe({ ...req.body, userId });
      res.status(201).json(probe);
    } catch (error) {
      console.error("Error creating synthetic probe:", error);
      res.status(500).json({ error: "Failed to create synthetic probe" });
    }
  });

  // Update synthetic probe
  app.put("/api/synthetic/probes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const probe = await storage.updateSyntheticProbe(req.params.id, req.body);
      res.json(probe);
    } catch (error) {
      console.error("Error updating synthetic probe:", error);
      res.status(500).json({ error: "Failed to update synthetic probe" });
    }
  });

  // Delete synthetic probe
  app.delete("/api/synthetic/probes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      await storage.deleteSyntheticProbe(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting synthetic probe:", error);
      res.status(500).json({ error: "Failed to delete synthetic probe" });
    }
  });

  // Get probe results
  app.get("/api/synthetic/probes/:id/results", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const limit = parseInt(req.query.limit as string) || 100;
      const results = await storage.getSyntheticProbeResults(req.params.id, limit);
      res.json(results);
    } catch (error) {
      console.error("Error fetching probe results:", error);
      res.status(500).json({ error: "Failed to fetch probe results" });
    }
  });

  // Run probe manually
  app.post("/api/synthetic/probes/:id/run", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { runSyntheticProbe } = await import('./syntheticMonitor');
      const result = await runSyntheticProbe(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Error running synthetic probe:", error);
      res.status(500).json({ error: "Failed to run synthetic probe" });
    }
  });

  return httpServer;
}
