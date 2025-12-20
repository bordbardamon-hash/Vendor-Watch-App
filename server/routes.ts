import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVendorSchema, insertIncidentSchema, insertJobSchema, insertConfigSchema, insertFeedbackSchema, insertNotificationConsentSchema, insertCustomVendorRequestSchema, SUBSCRIPTION_TIERS } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sendSMS } from "./twilioClient";
import { syncVendorStatus } from "./statusSync";
import { z } from "zod";

// Stripe price IDs for each subscription tier
const TIER_PRICE_IDS = {
  standard: process.env.STRIPE_PRICE_STANDARD || "price_1SgJviBHVJ1HPGTMdYAPJFNi", // $89.99
  gold: process.env.STRIPE_PRICE_GOLD || "price_gold_placeholder", // $99.99
  platinum: process.env.STRIPE_PRICE_PLATINUM || "price_platinum_placeholder", // $129.99
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication BEFORE other routes
  try {
    await setupAuth(app);
    registerAuthRoutes(app);
    console.log("[auth] Authentication routes registered successfully");
  } catch (error) {
    console.error("[auth] Failed to setup authentication:", error);
  }
  
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
  app.post("/api/vendors", isAuthenticated, async (req, res) => {
    try {
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
  
  // ============ JOBS ============
  
  // Get all jobs (protected)
  app.get("/api/jobs", isAuthenticated, async (req, res) => {
    try {
      const jobs = await storage.getJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });
  
  // Get job by id (protected)
  app.get("/api/jobs/:id", isAuthenticated, async (req, res) => {
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
  
  // Create job (protected)
  app.post("/api/jobs", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertJobSchema.parse(req.body);
      const job = await storage.createJob(validatedData);
      res.status(201).json(job);
    } catch (error) {
      console.error("Error creating job:", error);
      res.status(400).json({ error: "Invalid job data" });
    }
  });
  
  // Update job (protected)
  app.patch("/api/jobs/:id", isAuthenticated, async (req, res) => {
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
  
  // Delete job (protected)
  app.delete("/api/jobs/:id", isAuthenticated, async (req, res) => {
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
      const user = await storage.getUser(req.user.claims.sub);
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      await storage.resetUserSubscriptions(userId);
      res.json({ success: true, message: "Reset to monitor all vendors" });
    } catch (error) {
      console.error("Error resetting vendor subscriptions:", error);
      res.status(500).json({ error: "Failed to reset vendor subscriptions" });
    }
  });

  app.get("/api/my-vendors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const order = await storage.getUserVendorOrder(userId);
      res.json({ vendorKeys: order.map(o => o.vendorKey) });
    } catch (error) {
      console.error("Error fetching vendor order:", error);
      res.status(500).json({ error: "Failed to fetch vendor order" });
    }
  });

  app.put("/api/vendor-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const incidents = await storage.getIncidentsForUser(userId);
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching user incidents:", error);
      res.status(500).json({ error: "Failed to fetch incidents" });
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
      const user = await storage.getUser(req.user.claims.sub);
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
      const user = await storage.getUser(req.user.claims.sub);
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

  // ============ NOTIFICATIONS ============

  app.get("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
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
      const { phone, notifyEmail, notifySms } = req.body;
      const user = await storage.updateUserNotifications(req.user.claims.sub, {
        phone,
        notifyEmail,
        notifySms,
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, preferences: { phone: user.phone, notifyEmail: user.notifyEmail, notifySms: user.notifySms } });
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
      const user = await storage.getUser(req.user.claims.sub);
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

  app.get("/api/consents", isAuthenticated, async (req: any, res) => {
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
      const consents = await storage.getConsentsByUser(req.user.claims.sub);
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
        userId: req.user.claims.sub,
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

  return httpServer;
}
