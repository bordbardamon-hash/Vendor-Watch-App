import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVendorSchema, insertIncidentSchema, insertJobSchema, insertConfigSchema, insertFeedbackSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sendSMS } from "./twilioClient";
import { syncVendorStatus } from "./statusSync";
import { z } from "zod";

const PRICE_ID = "price_1SgJviBHVJ1HPGTMdYAPJFNi";

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
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

      const customer = await stripe.customers.create({
        email: validatedData.email,
        name: `${validatedData.firstName} ${validatedData.lastName}`,
        phone: validatedData.phone,
        metadata: {
          companyName: validatedData.companyName,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
        },
      });

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [{ price: PRICE_ID, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/signup`,
        subscription_data: {
          trial_period_days: 7,
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
