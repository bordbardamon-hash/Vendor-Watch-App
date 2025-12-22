import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { seedVendorsIfEmpty, seedBlockchainChainsIfEmpty } from './storage';
import { syncVendorStatus } from './statusSync';
import { syncAllBlockchainChains } from './blockchainSync';

const app = express();
const httpServer = createServer(app);

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('[stripe] DATABASE_URL not found, skipping Stripe initialization');
    return;
  }

  try {
    console.log('[stripe] Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('[stripe] Stripe schema ready');

    const stripeSync = await getStripeSync();

    const replitDomains = process.env.REPLIT_DOMAINS;
    if (replitDomains) {
      console.log('[stripe] Setting up managed webhook...');
      const webhookBaseUrl = `https://${replitDomains.split(',')[0]}`;
      try {
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        if (result?.webhook?.url) {
          console.log(`[stripe] Webhook configured: ${result.webhook.url}`);
        } else {
          console.log('[stripe] Webhook setup returned without URL, continuing...');
        }
      } catch (webhookError) {
        console.log('[stripe] Webhook setup skipped:', webhookError);
      }
    } else {
      console.log('[stripe] No REPLIT_DOMAINS, skipping webhook setup');
    }

    stripeSync.syncBackfill()
      .then(() => console.log('[stripe] Stripe data synced'))
      .catch((err: Error) => console.error('[stripe] Error syncing Stripe data:', err));
  } catch (error) {
    console.error('[stripe] Failed to initialize Stripe:', error);
  }
}

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('[stripe] WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[stripe] Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Stripe integration
  await initStripe();

  // Seed vendors and blockchain chains if database is empty (for new deployments)
  await seedVendorsIfEmpty();
  await seedBlockchainChainsIfEmpty();

  // Health check endpoint - registered first
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  await registerRoutes(httpServer, app);

  // API 404 handler - catches unmatched API routes
  app.use("/api/*", (req, res) => {
    log(`API 404: ${req.method} ${req.path}`);
    res.status(404).json({ error: "API endpoint not found", path: req.path });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    log("Setting up static file serving for production");
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start automatic vendor status sync
      const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
      
      // Run initial sync after short delay to let server stabilize
      setTimeout(async () => {
        console.log('[sync] Starting initial status sync...');
        try {
          const result = await syncVendorStatus();
          console.log(`[sync] Initial vendor sync complete: ${result.synced} synced, ${result.skipped} skipped`);
        } catch (err) {
          console.error('[sync] Initial vendor sync failed:', err);
        }
        
        try {
          await syncAllBlockchainChains();
          console.log('[sync] Initial blockchain sync complete');
        } catch (err) {
          console.error('[sync] Initial blockchain sync failed:', err);
        }
      }, 5000);
      
      // Set up recurring sync every 5 minutes
      setInterval(async () => {
        console.log('[sync] Starting scheduled status sync...');
        try {
          const result = await syncVendorStatus();
          console.log(`[sync] Scheduled vendor sync complete: ${result.synced} synced, ${result.skipped} skipped`);
        } catch (err) {
          console.error('[sync] Scheduled vendor sync failed:', err);
        }
        
        try {
          await syncAllBlockchainChains();
          console.log('[sync] Scheduled blockchain sync complete');
        } catch (err) {
          console.error('[sync] Scheduled blockchain sync failed:', err);
        }
      }, SYNC_INTERVAL_MS);
      
      console.log(`[sync] Automatic sync configured: every ${SYNC_INTERVAL_MS / 60000} minutes (vendors + blockchain)`);
    },
  );
})();
