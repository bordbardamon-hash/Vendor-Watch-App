import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { seedVendorsIfEmpty, seedBlockchainChainsIfEmpty, storage } from './storage';
import { syncVendorStatus, resolveStaleIncidents } from './statusSync';
import { syncAllBlockchainChains, resolveStaleBlockchainIncidents } from './blockchainSync';
import { collectTelemetryMetrics, generatePredictions, maintainPredictions, updatePredictionConfidence } from './predictionEngine';
import { apiLimiter, authLimiter, strictLimiter } from './rateLimiter';
import { registerEmbedRoutes } from './embedRoutes';

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught Exception:', error);
});

const app = express();
const httpServer = createServer(app);

// CORS configuration to allow requests from various origins
const allowedOrigins = [
  'https://vendorwatch.app',
  'http://localhost:8081',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check against allowed origins and Replit dev domains
    const isAllowed = allowedOrigins.includes(origin) ||
      /\.replit\.dev$/.test(origin) ||
      /\.janeway\.replit\.dev$/.test(origin) ||
      /\.repl\.co$/.test(origin);
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`[cors] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

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
      .catch((err: any) => {
        if (err?.code === 'resource_missing' || err?.statusCode === 404) {
          console.log('[stripe] Stripe sync: some resources no longer exist in Stripe (this is normal after deletions)');
        } else {
          console.error('[stripe] Error syncing Stripe data:', err);
        }
      });
  } catch (error) {
    console.error('[stripe] Failed to initialize Stripe:', error);
  }
}

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    console.log('[stripe] Webhook request received');
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.error('[stripe] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('[stripe] WEBHOOK ERROR: req.body is not a Buffer, got:', typeof req.body);
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      console.log('[stripe] Processing webhook with signature:', sig.substring(0, 20) + '...');
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      console.log('[stripe] Webhook processed successfully');
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[stripe] Webhook error:', error.message);
      console.error('[stripe] Webhook error stack:', error.stack);
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

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot-password', strictLimiter);
  app.use('/api/auth/reset-password', strictLimiter);
  app.use('/api/', apiLimiter);

  // Health check endpoint - registered first (exempt from rate limiting via placement)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  registerEmbedRoutes(app);
  await registerRoutes(httpServer, app);

  // API 404 handler - catches unmatched API routes
  app.use("/api/*", (req, res) => {
    log(`API 404: ${req.method} ${req.path}`);
    res.status(404).json({ error: "API endpoint not found", path: req.path });
  });

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[error] ${req.method} ${req.path} - Status ${status}:`, err.stack || err);
    res.status(status).json({ message });
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
      let syncRunning = false;
      
      async function runSync(label: string) {
        if (syncRunning) {
          console.log(`[sync] Skipping ${label} sync - previous sync still running`);
          return;
        }
        syncRunning = true;
        try {
          console.log(`[sync] Starting ${label} status sync...`);
          const result = await syncVendorStatus();
          console.log(`[sync] ${label} vendor sync complete: ${result.synced} synced, ${result.skipped} skipped`);
          
          await syncAllBlockchainChains();
          console.log(`[sync] ${label} blockchain sync complete`);
        } catch (err) {
          console.error(`[sync] ${label} sync failed:`, err);
        } finally {
          syncRunning = false;
        }
      }
      
      // Run initial sync after short delay to let server stabilize
      setTimeout(() => runSync('initial'), 5000);
      
      // Set up recurring sync every 5 minutes
      setInterval(async () => {
        await runSync('scheduled');
        
        // Auto-resolve stale incidents (not updated in 7 days)
        try {
          const staleVendor = await resolveStaleIncidents(7);
          const staleBlockchain = await resolveStaleBlockchainIncidents(7);
          if (staleVendor.resolved > 0 || staleBlockchain.resolved > 0) {
            console.log(`[sync] Auto-resolved ${staleVendor.resolved} vendor + ${staleBlockchain.resolved} blockchain stale incidents`);
          }
        } catch (err) {
          console.error('[sync] Stale incident cleanup failed:', err);
        }
      }, SYNC_INTERVAL_MS);
      
      console.log(`[sync] Automatic sync configured: every ${SYNC_INTERVAL_MS / 60000} minutes (vendors + blockchain)`);
      
      // Incident archival cleanup: runs every hour
      const ARCHIVE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
      const ARCHIVE_AFTER_DAYS = 1; // Archive resolved incidents after 1 day
      const PURGE_AFTER_DAYS = 365; // Purge archived incidents after 1 year
      
      setInterval(async () => {
        console.log('[archive] Starting incident archival cleanup...');
        try {
          // Archive vendor incidents
          const archived = await storage.archiveResolvedIncidents(ARCHIVE_AFTER_DAYS);
          if (archived > 0) {
            console.log(`[archive] Archived ${archived} resolved vendor incidents older than ${ARCHIVE_AFTER_DAYS} days`);
          }
          
          const purged = await storage.purgeOldArchivedIncidents(PURGE_AFTER_DAYS);
          if (purged > 0) {
            console.log(`[archive] Purged ${purged} archived vendor incidents older than ${PURGE_AFTER_DAYS} days`);
          }
          
          // Archive blockchain incidents
          const blockchainArchived = await storage.archiveResolvedBlockchainIncidents(ARCHIVE_AFTER_DAYS);
          if (blockchainArchived > 0) {
            console.log(`[archive] Archived ${blockchainArchived} resolved blockchain incidents older than ${ARCHIVE_AFTER_DAYS} days`);
          }
          
          const blockchainPurged = await storage.purgeOldArchivedBlockchainIncidents(PURGE_AFTER_DAYS);
          if (blockchainPurged > 0) {
            console.log(`[archive] Purged ${blockchainPurged} archived blockchain incidents older than ${PURGE_AFTER_DAYS} days`);
          }
        } catch (err) {
          console.error('[archive] Archival cleanup failed:', err);
        }
      }, ARCHIVE_INTERVAL_MS);
      
      console.log(`[archive] Automatic archival configured: resolved incidents archived after ${ARCHIVE_AFTER_DAYS} days, purged after ${PURGE_AFTER_DAYS} days`);
      
      // Predictive Analytics: Telemetry collection and prediction generation
      const TELEMETRY_INTERVAL_MS = 60 * 60 * 1000; // Collect telemetry every hour
      const PREDICTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // Generate predictions every 6 hours
      
      // Initial telemetry collection after server stabilizes
      setTimeout(async () => {
        console.log('[predictions] Starting initial telemetry collection...');
        try {
          await collectTelemetryMetrics();
          console.log('[predictions] Initial telemetry collection complete');
        } catch (err) {
          console.error('[predictions] Initial telemetry collection failed:', err);
        }
      }, 10000); // 10 seconds after startup
      
      // Hourly telemetry collection
      setInterval(async () => {
        console.log('[predictions] Collecting hourly telemetry...');
        try {
          await collectTelemetryMetrics();
          console.log('[predictions] Hourly telemetry collection complete');
        } catch (err) {
          console.error('[predictions] Hourly telemetry collection failed:', err);
        }
      }, TELEMETRY_INTERVAL_MS);
      
      // Generate predictions every 6 hours
      setInterval(async () => {
        console.log('[predictions] Generating predictions from patterns...');
        try {
          await generatePredictions();
          console.log('[predictions] Prediction generation complete');
        } catch (err) {
          console.error('[predictions] Prediction generation failed:', err);
        }
      }, PREDICTION_INTERVAL_MS);
      
      // Initial prediction generation after 30 seconds (allow telemetry to build up)
      setTimeout(async () => {
        console.log('[predictions] Running initial prediction generation...');
        try {
          await generatePredictions();
          console.log('[predictions] Initial prediction generation complete');
        } catch (err) {
          console.error('[predictions] Initial prediction generation failed:', err);
        }
      }, 30000);
      
      // Prediction maintenance every hour (clean up expired, validate against actual incidents)
      const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
      setInterval(async () => {
        console.log('[predictions] Running prediction maintenance...');
        try {
          const result = await maintainPredictions();
          console.log(`[predictions] Maintenance complete: expired=${result.expired}, validated=${result.validated}, invalidated=${result.invalidated}`);
          
          // Also update confidence levels based on new telemetry
          const confidenceUpdates = await updatePredictionConfidence();
          if (confidenceUpdates > 0) {
            console.log(`[predictions] Updated confidence for ${confidenceUpdates} predictions`);
          }
        } catch (err) {
          console.error('[predictions] Prediction maintenance failed:', err);
        }
      }, MAINTENANCE_INTERVAL_MS);
      
      // Run initial maintenance after 2 minutes (after initial predictions are created)
      setTimeout(async () => {
        console.log('[predictions] Running initial prediction maintenance...');
        try {
          await maintainPredictions();
          await updatePredictionConfidence();
          console.log('[predictions] Initial maintenance complete');
        } catch (err) {
          console.error('[predictions] Initial maintenance failed:', err);
        }
      }, 120000);
      
      console.log(`[predictions] Predictive analytics configured: telemetry every ${TELEMETRY_INTERVAL_MS / 60000} minutes, predictions every ${PREDICTION_INTERVAL_MS / 3600000} hours, maintenance hourly`);
      
      // Data retention - run daily at startup and then every 24 hours
      // Uses the LONGEST retention period to ensure data availability for all tiers
      // Tier-based access restrictions are enforced at the API level, not storage level
      const DATA_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
      const TELEMETRY_RETENTION_DAYS = 90;  // Enterprise tier (longest)
      const PREDICTION_RETENTION_DAYS = 30; // Enterprise tier (longest)
      const ACTIVITY_RETENTION_DAYS = 90;   // Same for all tiers
      
      const runDataRetention = async () => {
        console.log('[retention] Running data retention cleanup...');
        try {
          const telemetryPurged = await storage.purgeOldTelemetry(TELEMETRY_RETENTION_DAYS);
          const predictionsPurged = await storage.purgeOldPredictions(PREDICTION_RETENTION_DAYS);
          const activityPurged = await storage.purgeOldActivityEvents(ACTIVITY_RETENTION_DAYS);
          console.log(`[retention] Cleanup complete: telemetry=${telemetryPurged}, predictions=${predictionsPurged}, activity=${activityPurged}`);
        } catch (err) {
          console.error('[retention] Data retention cleanup failed:', err);
        }
      };
      
      // Run initial cleanup after 5 minutes
      setTimeout(runDataRetention, 5 * 60 * 1000);
      
      // Then run daily
      setInterval(runDataRetention, DATA_RETENTION_INTERVAL_MS);
      
      console.log(`[retention] Data retention configured: telemetry ${TELEMETRY_RETENTION_DAYS} days, predictions ${PREDICTION_RETENTION_DAYS} days, activity ${ACTIVITY_RETENTION_DAYS} days (runs daily)`);

      // Synthetic probe monitoring: run every minute
      const PROBE_INTERVAL_MS = 60 * 1000;
      setInterval(async () => {
        try {
          const { runAllActiveProbes } = await import('./syntheticMonitor');
          const result = await runAllActiveProbes();
          if (result.total > 0) {
            console.log(`[probes] Ran ${result.total} probes: ${result.healthy} healthy, ${result.degraded} degraded, ${result.down} down`);
          }
        } catch (err) {
          console.error('[probes] Probe execution failed:', err);
        }
      }, PROBE_INTERVAL_MS);
      console.log(`[probes] Synthetic monitoring configured: every 1 minute`);
    },
  );
})();
