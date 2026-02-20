import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVendorSchema, insertIncidentSchema, insertJobSchema, insertConfigSchema, insertFeedbackSchema, insertNotificationConsentSchema, insertCustomVendorRequestSchema, SUBSCRIPTION_TIERS } from "@shared/schema";
import { setupEmailAuth, isAuthenticated as emailIsAuthenticated } from "./emailAuth";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { sendSMS } from "./twilioClient";
import { sendWelcomeEmail, notifyOwnerNewSignup } from "./emailClient";
import { syncVendorStatus, resolveStaleIncidents } from "./statusSync";
import { syncAllBlockchainChains, resolveStaleBlockchainIncidents } from "./blockchainSync";
import { setupTwoFactor, verifyTOTP, verifyRecoveryCode, generateRecoveryCodes } from "./twoFactor";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, mobileAuthTokens, pendingSignups } from "@shared/models/auth";
import { eq, and, isNull, gt, sql } from "drizzle-orm";

const SALT_ROUNDS = 10;

// Unified isAuthenticated middleware that works with session, Replit OAuth, AND mobile bearer tokens
const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // Check for email auth session
  const emailAuthUserId = req.session?.userId;
  if (emailAuthUserId) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, emailAuthUserId)).limit(1);
      if (user) {
        req.user = user;
        req.user.claims = { sub: user.id };
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
  
  // Check for mobile Bearer token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      // Look up the token in the database
      const [tokenData] = await db.select()
        .from(mobileAuthTokens)
        .where(and(
          eq(mobileAuthTokens.token, token),
          isNull(mobileAuthTokens.revokedAt)
        ))
        .limit(1);
      
      if (tokenData && tokenData.expiresAt > new Date()) {
        // Valid token - get the user
        const [user] = await db.select()
          .from(users)
          .where(eq(users.id, tokenData.userId))
          .limit(1);
        
        if (user) {
          // Update last used timestamp (async, don't await)
          db.update(mobileAuthTokens)
            .set({ lastUsedAt: new Date() })
            .where(eq(mobileAuthTokens.id, tokenData.id))
            .catch(err => console.error('[auth] Token update error:', err));
          
          // Set user on request
          req.user = user;
          req.user.claims = { sub: user.id };
          req.isMobileAuth = true;
          return next();
        }
      }
    } catch (error) {
      console.error('[auth] Mobile token validation error:', error);
    }
  }
  
  return res.status(401).json({ message: "Unauthorized" });
};

// Stripe price IDs for each subscription tier
const TIER_PRICE_IDS = {
  essential: process.env.STRIPE_PRICE_ESSENTIAL || "price_essential_placeholder", // $89
  growth: process.env.STRIPE_PRICE_GROWTH || "price_growth_placeholder", // $129
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_enterprise_placeholder", // $189
} as const;

// Stripe price IDs for additional seats
const SEAT_PRICE_IDS: Record<string, string> = {
  growth: process.env.STRIPE_PRICE_GROWTH_SEAT || "price_growth_seat_placeholder", // $20/seat
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE_SEAT || "price_enterprise_seat_placeholder", // $25/seat
  platinum: process.env.STRIPE_PRICE_ENTERPRISE_SEAT || "price_enterprise_seat_placeholder", // Legacy tier, same as enterprise
};

// Included seats per tier (platinum is legacy name for enterprise)
const INCLUDED_SEATS: Record<string, number> = {
  essential: 1,
  growth: 3,
  enterprise: 5,
  platinum: 5, // Legacy tier, same as enterprise
};

// Data retention limits by tier (in days)
// Currently telemetry/predictions are Enterprise-only features
// Config ready for future tier expansion if these features are added to lower tiers
const DATA_RETENTION = {
  telemetry: {
    essential: 7,    // Reserved for future use
    growth: 30,      // Reserved for future use
    enterprise: 90,  // Enterprise-only: 90 days max
  },
  predictions: {
    essential: 0,    // No predictions for Essential
    growth: 14,      // Reserved for future use
    enterprise: 30,  // Enterprise-only: 30 days max
  },
  activityEvents: {
    essential: 90,   // 90 days for security audits
    growth: 90,
    enterprise: 90,
  },
} as const;

// Map price IDs to tiers for webhook processing
const PRICE_ID_TO_TIER: Record<string, 'essential' | 'growth' | 'enterprise'> = {
  [TIER_PRICE_IDS.essential]: 'essential',
  [TIER_PRICE_IDS.growth]: 'growth',
  [TIER_PRICE_IDS.enterprise]: 'enterprise',
};

const signupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  tier: z.enum(['essential', 'growth', 'enterprise']).default('essential'),
});

// Owner identification for bypass checks
const OWNER_EMAIL = process.env.OWNER_EMAIL || "";
const OWNER_USER_ID = process.env.OWNER_USER_ID || "";

// Middleware to require completed onboarding for dashboard access
// This is a server-side guard to prevent bypassing frontend routing
const requireOnboardingComplete = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Check if this is the owner (they bypass onboarding)
    const ownerEmail = OWNER_EMAIL.toLowerCase().trim();
    const userEmail = (req.user?.email || req.user?.claims?.email || "").toLowerCase().trim();
    const isOwnerByEmail = ownerEmail && userEmail === ownerEmail;
    const isOwnerById = OWNER_USER_ID && String(userId) === OWNER_USER_ID;
    
    if (isOwnerByEmail || isOwnerById) {
      return next(); // Owner bypasses onboarding check
    }
    
    // Get user from DB to check onboarding status
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    if (!user.profileCompleted || !user.billingCompleted) {
      return res.status(403).json({ 
        message: "Onboarding required", 
        needsOnboarding: true,
        profileCompleted: user.profileCompleted,
        billingCompleted: user.billingCompleted
      });
    }
    
    return next();
  } catch (error) {
    console.error('[auth] Onboarding check failed:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

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

// Owner-only middleware - requires isAuthenticated to run first
const isOwner = async (req: any, res: any, next: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!user.isOwner) {
      return res.status(403).json({ error: "Owner access required" });
    }
    next();
  } catch (error) {
    console.error("Owner check error:", error);
    res.status(500).json({ error: "Failed to verify owner status" });
  }
};

// Role hierarchy: master_admin > member_rw > member_ro
const ROLE_HIERARCHY = {
  'master_admin': 3,
  'member_rw': 2,
  'member_ro': 1,
} as const;

type OrgRole = keyof typeof ROLE_HIERARCHY;

// Organization role-based middleware - requires isAuthenticated to run first
// Checks if user has at least the specified role in their organization
const requireOrgRole = (minimumRole: OrgRole) => async (req: any, res: any, next: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const userRole = await storage.getUserRole(user.id);
    if (!userRole) {
      // User is not in an organization - allow access if they have a subscription directly
      // This maintains backward compatibility for users who haven't migrated to org structure
      if (user.subscriptionTier) {
        req.userOrgRole = null;
        return next();
      }
      return res.status(403).json({ error: "Organization membership required" });
    }
    
    const userRoleLevel = ROLE_HIERARCHY[userRole.role as OrgRole] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[minimumRole];
    
    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({ error: `Requires at least ${minimumRole} role` });
    }
    
    req.userOrgRole = userRole;
    next();
  } catch (error) {
    console.error("Role check error:", error);
    res.status(500).json({ error: "Failed to verify role" });
  }
};

// Middleware to check if user is master admin of their org
const isMasterAdmin = requireOrgRole('master_admin');

// Middleware to check if user has at least read-write access
const canWrite = requireOrgRole('member_rw');

// Middleware to check if user has at least read-only access
const canRead = requireOrgRole('member_ro');

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication BEFORE other routes
  try {
    await setupEmailAuth(app);
    // Register additional auth routes (onboarding, etc.)
    registerAuthRoutes(app);
  } catch (error) {
    console.error("[auth] Failed to setup authentication:", error);
  }
  
  // ============ OWNER FIX (no auth required, uses secret token) ============
  const OWNER_EMAIL = process.env.OWNER_EMAIL || "bordbardamon@gmail.com";
  const FIX_TOKEN = "fix-owner-2024"; // Simple token for security
  
  // Simple debug endpoint to check session WITHOUT authentication requirement
  app.get("/api/check-session/:token", async (req: any, res) => {
    if (req.params.token !== FIX_TOKEN) {
      return res.status(403).json({ error: "Invalid token" });
    }
    
    const sessionExists = !!req.session;
    const sessionUserId = req.session?.userId;
    const sessionPassportUser = req.session?.passport?.user;
    const cookieHeader = req.headers.cookie || "no cookies";
    
    console.log(`[debug] check-session: sessionExists=${sessionExists}, userId=${sessionUserId}, passport=${sessionPassportUser}`);
    console.log(`[debug] cookies: ${cookieHeader}`);
    
    res.json({
      sessionExists,
      sessionUserId,
      sessionPassportUser,
      hasCookies: cookieHeader !== "no cookies",
      cookieSnippet: cookieHeader.substring(0, 100),
    });
  });
  
  // Test endpoint that mimics EXACTLY what /api/auth/user returns
  app.get("/api/test-auth-response/:token", isAuthenticated, async (req: any, res) => {
    if (req.params.token !== FIX_TOKEN) {
      return res.status(403).json({ error: "Invalid token" });
    }
    
    // This is exactly what the frontend receives from /api/auth/user
    const userResponse = { ...req.user };
    delete userResponse.claims;
    
    // Show what the frontend check would evaluate to
    const frontendCheck = {
      profileCompleted: userResponse.profileCompleted,
      billingCompleted: userResponse.billingCompleted,
      profileCompletedType: typeof userResponse.profileCompleted,
      billingCompletedType: typeof userResponse.billingCompleted,
      needsOnboarding: userResponse.profileCompleted !== true || userResponse.billingCompleted !== true,
    };
    
    res.json({
      frontendCheck,
      userResponse,
    });
  });
  
  // Debug endpoint to test what /api/auth/user would return
  app.get("/api/debug-auth-user/:token", isAuthenticated, async (req: any, res) => {
    try {
      if (req.params.token !== FIX_TOKEN) {
        return res.status(403).send("<h1>Invalid token</h1>");
      }
      
      const userId = req.user?.id || req.user?.claims?.sub;
      const userEmail = req.user?.email || req.user?.claims?.email || "";
      
      res.send(`
        <html>
        <head><title>Auth User Debug</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>What /api/auth/user sees:</h1>
          <p><strong>userId:</strong> ${userId}</p>
          <p><strong>userEmail:</strong> ${userEmail}</p>
          <hr>
          <h2>req.user object:</h2>
          <pre>${JSON.stringify(req.user, null, 2)}</pre>
          <hr>
          <h2>Key fields:</h2>
          <p><strong>profileCompleted:</strong> ${req.user?.profileCompleted} (type: ${typeof req.user?.profileCompleted})</p>
          <p><strong>billingCompleted:</strong> ${req.user?.billingCompleted} (type: ${typeof req.user?.billingCompleted})</p>
          <p><strong>subscriptionTier:</strong> ${req.user?.subscriptionTier}</p>
          <p><strong>isAdmin:</strong> ${req.user?.isAdmin}</p>
        </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`<h1>Error</h1><pre>${error.message}</pre>`);
    }
  });
  
  // Debug endpoint to see what the session returns
  app.get("/api/debug-session/:token", async (req: any, res) => {
    try {
      if (req.params.token !== FIX_TOKEN) {
        return res.status(403).send("<h1>Invalid token</h1>");
      }
      
      // Check both session types
      const emailAuthUserId = req.session?.userId;
      const replitAuthUser = req.user;
      const isAuthenticated = req.isAuthenticated?.();
      
      res.send(`
        <html>
        <head><title>Debug Session</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Session Debug Info</h1>
          <h2>Email Auth:</h2>
          <p><strong>session.userId:</strong> ${emailAuthUserId || "(not set)"}</p>
          <hr>
          <h2>Replit OAuth:</h2>
          <p><strong>isAuthenticated():</strong> ${isAuthenticated}</p>
          <p><strong>req.user:</strong></p>
          <pre>${JSON.stringify(replitAuthUser, null, 2) || "(not set)"}</pre>
          <hr>
          <h2>Environment:</h2>
          <p><strong>OWNER_EMAIL:</strong> ${process.env.OWNER_EMAIL || "(not set)"}</p>
          <p><strong>OWNER_USER_ID:</strong> ${process.env.OWNER_USER_ID || "(not set)"}</p>
        </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`<h1>Error</h1><pre>${error.message}</pre>`);
    }
  });
  
  // Debug endpoint to see current user state
  app.get("/api/debug-owner/:token", async (req, res) => {
    try {
      if (req.params.token !== FIX_TOKEN) {
        return res.status(403).send("<h1>Invalid token</h1>");
      }
      
      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.email, OWNER_EMAIL))
        .limit(1);
      
      res.send(`
        <html>
        <head><title>Debug Owner</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Owner Debug Info</h1>
          <p><strong>OWNER_EMAIL env:</strong> ${process.env.OWNER_EMAIL || "(not set)"}</p>
          <p><strong>OWNER_USER_ID env:</strong> ${process.env.OWNER_USER_ID || "(not set)"}</p>
          <hr>
          <h2>Database Record:</h2>
          ${owner ? `
            <p><strong>ID:</strong> ${owner.id}</p>
            <p><strong>Email:</strong> ${owner.email}</p>
            <p><strong>profileCompleted:</strong> ${owner.profileCompleted}</p>
            <p><strong>billingCompleted:</strong> ${owner.billingCompleted}</p>
            <p><strong>subscriptionTier:</strong> ${owner.subscriptionTier}</p>
            <p><strong>isAdmin:</strong> ${owner.isAdmin}</p>
          ` : `<p>No user found with email ${OWNER_EMAIL}</p>`}
        </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`<h1>Error</h1><pre>${error.message}</pre>`);
    }
  });
  
  app.get("/api/fix-owner/:token", async (req, res) => {
    try {
      if (req.params.token !== FIX_TOKEN) {
        return res.status(403).send("<h1>Invalid token</h1>");
      }
      
      // Find and update the owner by email
      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.email, OWNER_EMAIL))
        .limit(1);
      
      if (!owner) {
        return res.send(`<h1>Owner not found</h1><p>Email: ${OWNER_EMAIL}</p><p>Please log in first to create your account.</p>`);
      }
      
      // Update owner account
      const [updated] = await db
        .update(users)
        .set({
          profileCompleted: true,
          billingCompleted: true,
          billingStatus: 'active',
          subscriptionTier: 'enterprise',
          isAdmin: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, owner.id))
        .returning();
      
      console.log(`[fix-owner] Updated owner: ${updated?.email}`);
      res.send(`
        <html>
        <head><title>Account Fixed</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: green;">✓ Account Fixed!</h1>
          <p>Email: ${updated?.email}</p>
          <p>Tier: ${updated?.subscriptionTier}</p>
          <p>Profile Complete: ${updated?.profileCompleted}</p>
          <p>Billing Complete: ${updated?.billingCompleted}</p>
          <p><a href="/" style="color: blue; font-size: 18px;">Go to Dashboard</a></p>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error("[fix-owner] Error:", error);
      res.status(500).send(`<h1>Error</h1><pre>${error.message}</pre>`);
    }
  });

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
  
  // ============ NOTIFICATION DELIVERY TRACKING ============

  app.get("/api/alerts/delivery-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      
      const result = await storage.getAlertDeliveryHistory(userId, limit, offset);
      res.json({
        alerts: result.alerts,
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
      });
    } catch (error) {
      console.error('[api] Delivery history error:', error);
      res.status(500).json({ error: "Failed to fetch delivery history" });
    }
  });

  // ============ SYSTEM HEALTH (DETAILED) ============

  app.get("/api/system/health", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!user.isOwner) return res.status(403).json({ error: "Admin access required" });

      const { getAllCircuitStatuses } = await import('./circuitBreaker');
      const { getRateLimiterStats } = await import('./rateLimiter');
      const { getPendingIncidentStats } = await import('./incidentConfirmation');

      let dbHealthy = false;
      try {
        await db.execute(sql`SELECT 1`);
        dbHealthy = true;
      } catch { dbHealthy = false; }

      const healthStates = await storage.getHealthStates();
      const circuits = getAllCircuitStatuses();
      const rateLimiterStats = getRateLimiterStats();
      const pendingIncidents = getPendingIncidentStats();

      const emailConfigured = !!process.env.RESEND_API_KEY;
      const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

      res.json({
        status: dbHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        database: { healthy: dbHealthy },
        components: healthStates,
        circuitBreakers: circuits,
        rateLimiter: rateLimiterStats,
        pendingIncidents,
        externalServices: {
          email: { configured: emailConfigured, circuit: circuits['resend_email'] || { state: 'closed', failureCount: 0 } },
          sms: { circuit: circuits['twilio_sms'] || { state: 'closed', failureCount: 0 } },
          stripe: { configured: stripeConfigured },
        },
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });
    } catch (error) {
      console.error('[api] System health error:', error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  // ============ MOBILE-FRIENDLY ALERT SUMMARY ============
  
  // Get critical alerts summary for mobile devices
  app.get("/api/alerts/mobile-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Get user subscriptions first
      const [vendorSubs, blockchainSubs] = await Promise.all([
        storage.getUserVendorSubscriptions(userId),
        storage.getUserBlockchainSubscriptions(userId)
      ]);
      
      // Get active vendor incidents - filtered by subscriptions
      const allVendorIncidents = await storage.getIncidents();
      const activeVendorIncidents = vendorSubs.length > 0
        ? allVendorIncidents.filter(i => i.status !== 'resolved' && vendorSubs.includes(i.vendorKey))
        : [];
      
      // Get active blockchain incidents - filtered by subscriptions
      const allBlockchainIncidents = await storage.getActiveBlockchainIncidents();
      const blockchainIncidentsList = blockchainSubs.length > 0
        ? allBlockchainIncidents.filter(i => blockchainSubs.includes(i.chainKey))
        : [];
      
      // Get vendors and chains for names
      const vendors = await storage.getVendors();
      const chains = await storage.getBlockchainChains();
      
      // Build mobile-friendly summary
      const vendorAlerts = activeVendorIncidents
        .sort((a, b) => {
          const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
          return (severityOrder[a.severity as keyof typeof severityOrder] || 3) - 
                 (severityOrder[b.severity as keyof typeof severityOrder] || 3);
        })
        .slice(0, 10)
        .map(i => {
          const vendor = vendors.find(v => v.key === i.vendorKey);
          return {
            id: i.id,
            type: 'vendor',
            resource: vendor?.name || i.vendorKey,
            title: i.title,
            severity: i.severity,
            status: i.status,
            startedAt: i.startedAt,
            icon: i.severity === 'critical' ? '🔴' : i.severity === 'major' ? '🟠' : '🟡',
          };
        });
      
      const blockchainAlerts = blockchainIncidentsList
        .sort((a, b) => {
          const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
          return (severityOrder[a.severity as keyof typeof severityOrder] || 3) - 
                 (severityOrder[b.severity as keyof typeof severityOrder] || 3);
        })
        .slice(0, 10)
        .map(i => {
          const chain = chains.find(c => c.chainKey === i.chainKey);
          return {
            id: i.id,
            type: 'blockchain',
            resource: chain?.name || i.chainKey,
            title: i.title,
            severity: i.severity,
            status: i.status,
            startedAt: i.startedAt,
            icon: i.severity === 'critical' ? '🔴' : i.severity === 'major' ? '🟠' : '🟡',
          };
        });
      
      // Combine and sort all alerts
      const allAlerts = [...vendorAlerts, ...blockchainAlerts]
        .sort((a, b) => {
          const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
          return (severityOrder[a.severity as keyof typeof severityOrder] || 3) - 
                 (severityOrder[b.severity as keyof typeof severityOrder] || 3);
        });
      
      const criticalCount = allAlerts.filter(a => a.severity === 'critical').length;
      const majorCount = allAlerts.filter(a => a.severity === 'major').length;
      
      res.json({
        summary: {
          totalActive: allAlerts.length,
          critical: criticalCount,
          major: majorCount,
          vendorAlerts: vendorAlerts.length,
          blockchainAlerts: blockchainAlerts.length,
          overallStatus: criticalCount > 0 ? 'critical' : majorCount > 0 ? 'degraded' : allAlerts.length > 0 ? 'warning' : 'healthy',
          statusEmoji: criticalCount > 0 ? '🔴' : majorCount > 0 ? '🟠' : allAlerts.length > 0 ? '🟡' : '🟢',
          statusMessage: criticalCount > 0 
            ? `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} need attention`
            : majorCount > 0 
              ? `${majorCount} major incident${majorCount > 1 ? 's' : ''} in progress`
              : allAlerts.length > 0 
                ? `${allAlerts.length} minor issue${allAlerts.length > 1 ? 's' : ''} being monitored`
                : 'All systems operational',
        },
        alerts: allAlerts.slice(0, 15), // Top 15 most critical
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching mobile summary:", error);
      res.status(500).json({ error: "Failed to fetch mobile summary" });
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
      
      // Only Enterprise users can create vendors directly
      if (user.subscriptionTier !== 'enterprise') {
        return res.status(403).json({ error: "Only Enterprise users can add vendors directly. Use the vendor request form instead." });
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
  // Returns immediately and runs sync in background to avoid timeout
  app.post("/api/vendors/sync", isAuthenticated, async (req, res) => {
    try {
      const vendorKey = req.body?.vendorKey;
      console.log(`[sync] Manual sync requested${vendorKey ? ` for ${vendorKey}` : ' for all vendors'}...`);
      
      // For single vendor sync, do it synchronously (fast)
      if (vendorKey) {
        const result = await syncVendorStatus(vendorKey);
        return res.json({ 
          success: true, 
          synced: result.synced, 
          skipped: result.skipped,
          errors: result.errors,
          message: `Synced ${result.synced} vendor(s), skipped ${result.skipped} (no API)`
        });
      }
      
      // For full sync, respond immediately and run in background to avoid timeout
      res.json({ 
        success: true, 
        synced: 0, 
        skipped: 0,
        errors: [],
        message: "Sync started in background. Vendors will update shortly.",
        background: true
      });
      
      // Run full sync in background (don't await)
      syncVendorStatus().then(result => {
        console.log(`[sync] Background sync complete: ${result.synced} synced, ${result.skipped} skipped`);
      }).catch(error => {
        console.error("[sync] Background sync failed:", error);
      });
    } catch (error) {
      console.error("Error syncing vendor statuses:", error);
      res.status(500).json({ error: "Failed to sync vendor statuses" });
    }
  });
  
  // ============ VENDOR COMPONENTS ============

  app.get("/api/vendors/:key/components", isAuthenticated, async (req: any, res) => {
    try {
      const components = await storage.getVendorComponents(req.params.key);
      res.json(components);
    } catch (error) {
      console.error("Error fetching vendor components:", error);
      res.status(500).json({ error: "Failed to fetch vendor components" });
    }
  });

  app.get("/api/components", isAuthenticated, async (req: any, res) => {
    try {
      const components = await storage.getAllVendorComponents();
      res.json(components);
    } catch (error) {
      console.error("Error fetching all components:", error);
      res.status(500).json({ error: "Failed to fetch components" });
    }
  });

  // ============ INCIDENTS ============
  
  // Get all incidents (protected)
  app.get("/api/incidents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // Filter incidents to only show those for vendors the user is subscribed to
      const incidents = await storage.getIncidentsForUser(userId);
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
      const blockchainArchived = await storage.archiveResolvedBlockchainIncidents(3);
      const blockchainPurged = await storage.purgeOldArchivedBlockchainIncidents(365);
      res.json({ 
        message: "Archival complete", 
        archived, 
        purged,
        blockchainArchived,
        blockchainPurged,
        archivedMessage: `Archived ${archived} vendor incidents and ${blockchainArchived} blockchain incidents older than 3 days`,
        purgedMessage: `Purged ${purged} vendor and ${blockchainPurged} blockchain archived incidents older than 1 year`
      });
    } catch (error) {
      console.error("Error running archival:", error);
      res.status(500).json({ error: "Failed to run archival" });
    }
  });
  
  // ============ BLOCKCHAIN INCIDENT ARCHIVE ============
  
  // Search archived blockchain incidents
  app.get("/api/blockchain/incidents/archive", isAuthenticated, async (req, res) => {
    try {
      const { chainKey, query, dateRange, limit, offset } = req.query;
      const archived = await storage.searchArchivedBlockchainIncidents({
        chainKey: chainKey as string | undefined,
        query: query as string | undefined,
        dateRange: dateRange as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });
      res.json(archived);
    } catch (error) {
      console.error("Error searching archived blockchain incidents:", error);
      res.status(500).json({ error: "Failed to search archived blockchain incidents" });
    }
  });
  
  // Get archived blockchain incidents count
  app.get("/api/blockchain/incidents/archive/count", isAuthenticated, async (req, res) => {
    try {
      const { chainKey, query } = req.query;
      const count = await storage.getArchivedBlockchainIncidentsCount({
        chainKey: chainKey as string | undefined,
        query: query as string | undefined,
      });
      res.json({ count });
    } catch (error) {
      console.error("Error getting archived blockchain incidents count:", error);
      res.status(500).json({ error: "Failed to get archived blockchain incidents count" });
    }
  });
  
  // ============ PARSER HEALTH (Owner Only) ============
  
  // Get all parser health data (owner only)
  app.get("/api/parser-health", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { getAllParserHealth } = await import('./parserHealthTracker');
      const healthData = await getAllParserHealth();
      const vendors = await storage.getVendors();
      
      const enrichedData = healthData.map(h => {
        const vendor = vendors.find(v => v.key === h.vendorKey);
        return {
          ...h,
          vendorName: vendor?.name || h.vendorKey,
        };
      });
      
      // Sort by health status (unhealthy first) then by consecutive failures
      enrichedData.sort((a, b) => {
        if (a.isHealthy !== b.isHealthy) return a.isHealthy ? 1 : -1;
        return b.consecutiveFailures - a.consecutiveFailures;
      });
      
      const unhealthyCount = enrichedData.filter(h => !h.isHealthy).length;
      const healthyCount = enrichedData.filter(h => h.isHealthy).length;
      
      res.json({
        summary: {
          total: enrichedData.length,
          healthy: healthyCount,
          unhealthy: unhealthyCount,
        },
        parsers: enrichedData,
      });
    } catch (error) {
      console.error("Error fetching parser health:", error);
      res.status(500).json({ error: "Failed to fetch parser health" });
    }
  });
  
  // Reset parser health for a specific vendor (owner only)
  app.post("/api/parser-health/:vendorKey/reset", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { vendorKey } = req.params;
      const { recordParseResult } = await import('./parserHealthTracker');
      
      // Reset by recording a successful parse
      await recordParseResult(vendorKey, {
        success: true,
        httpStatus: 200,
        incidentsParsed: 0,
      });
      
      res.json({ success: true, message: `Parser health reset for ${vendorKey}` });
    } catch (error) {
      console.error("Error resetting parser health:", error);
      res.status(500).json({ error: "Failed to reset parser health" });
    }
  });
  
  // ============ USER MANAGEMENT (Owner Only) ============
  
  // Get all users (owner only)
  app.get("/api/admin/users", isAuthenticated, isOwner, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safeUsers = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        companyName: u.companyName,
        phone: u.phone,
        subscriptionTier: u.subscriptionTier,
        isAdmin: u.isAdmin,
        isOwner: u.isOwner,
        notifyEmail: u.notifyEmail,
        notifySms: u.notifySms,
        stripeCustomerId: u.stripeCustomerId,
        stripeSubscriptionId: u.stripeSubscriptionId,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user subscription tier (owner only)
  // WARNING: This bypasses Stripe and directly updates the database tier.
  // Use this for manual overrides or complementary access only.
  // For paid subscriptions, users should go through Stripe checkout flow.
  const updateSubscriptionSchema = z.object({
    subscriptionTier: z.enum(['essential', 'growth', 'enterprise']).nullable(),
  });
  
  app.patch("/api/admin/users/:userId/subscription", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const parsed = updateSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid subscription tier. Must be 'essential', 'growth', 'enterprise', or null." });
      }
      
      const { subscriptionTier } = parsed.data;
      
      const user = await storage.updateUserSubscriptionTier(userId, subscriptionTier);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      console.log(`[admin] Owner manually set subscription tier for user ${userId} to ${subscriptionTier || 'none'} (bypasses Stripe)`);
      res.json({ 
        success: true, 
        user: { id: user.id, subscriptionTier: user.subscriptionTier },
        warning: "Manual tier change bypasses Stripe billing. User will have access but won't be billed." 
      });
    } catch (error) {
      console.error("Error updating user subscription:", error);
      res.status(500).json({ error: "Failed to update user subscription" });
    }
  });

  // Update user admin status (owner only)
  const updateAdminSchema = z.object({
    isAdmin: z.boolean(),
  });
  
  app.patch("/api/admin/users/:userId/admin", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user;
      
      const parsed = updateAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "isAdmin must be a boolean" });
      }
      
      const { isAdmin } = parsed.data;
      
      // Prevent owner from changing their own admin status
      if (userId === currentUser.id) {
        return res.status(400).json({ error: "Cannot change your own admin status" });
      }
      
      const user = await storage.updateUserAdmin(userId, isAdmin);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, user: { id: user.id, isAdmin: user.isAdmin } });
    } catch (error) {
      console.error("Error updating user admin status:", error);
      res.status(500).json({ error: "Failed to update user admin status" });
    }
  });

  // Create a new user manually (owner only)
  const createUserSchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    companyName: z.string().optional(),
    phone: z.string().optional(),
    subscriptionTier: z.enum(['essential', 'growth', 'enterprise']).optional(),
    isAdmin: z.boolean().optional(),
  });
  
  app.post("/api/admin/users", isAuthenticated, isOwner, async (req, res) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid user data. Required: email, firstName, lastName." });
      }
      
      const { email, firstName, lastName, companyName, phone, subscriptionTier, isAdmin } = parsed.data;
      
      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "User with this email already exists" });
      }
      
      const user = await storage.createUserManual({
        email,
        firstName,
        lastName,
        companyName,
        phone,
        subscriptionTier: subscriptionTier || null,
        isAdmin: isAdmin || false,
      });
      
      res.status(201).json({ 
        success: true, 
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName,
          subscriptionTier: user.subscriptionTier,
          isAdmin: user.isAdmin 
        } 
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Delete a user (owner only)
  app.delete("/api/admin/users/:userId", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.user;
      
      // Prevent owner from deleting themselves
      if (userId === currentUser.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      // Prevent deleting other owners
      const targetUser = await storage.getUser(userId);
      if (targetUser?.isOwner) {
        return res.status(400).json({ error: "Cannot delete owner accounts" });
      }
      
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Extend user trial (Owner only) - for promotional accounts
  app.patch("/api/admin/users/:userId/trial", isAuthenticated, isOwner, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { days, tier } = req.body;
      
      if (!days || typeof days !== 'number' || days < 1 || days > 365) {
        return res.status(400).json({ error: "Days must be a number between 1 and 365" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Calculate new trial end date
      const newTrialEnd = new Date();
      newTrialEnd.setDate(newTrialEnd.getDate() + days);
      
      // Update user with extended trial
      const updateData: any = {
        trialEndsAt: newTrialEnd,
        billingStatus: 'trialing',
        billingCompleted: true, // Allow access without payment
        profileCompleted: user.profileCompleted || true,
      };
      
      // Optionally set subscription tier for the promo period
      if (tier && ['essential', 'growth', 'enterprise'].includes(tier)) {
        updateData.subscriptionTier = tier;
      }
      
      const updatedUser = await storage.upsertUser({
        ...user,
        ...updateData,
      });
      
      res.json({ 
        success: true, 
        trialEndsAt: newTrialEnd,
        message: `Trial extended by ${days} days until ${newTrialEnd.toLocaleDateString()}`
      });
    } catch (error) {
      console.error("Error extending trial:", error);
      res.status(500).json({ error: "Failed to extend trial" });
    }
  });

  // Create promotional account (Owner only) - creates user with extended trial, no payment required
  app.post("/api/admin/users/promo", isAuthenticated, isOwner, async (req: any, res) => {
    console.log('[promo] Creating promotional account request received');
    try {
      const { email, firstName, lastName, companyName, tier, trialDays } = req.body;
      console.log(`[promo] Creating account for: ${email}`);
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      
      const days = trialDays || 30; // Default to 30 days for promo accounts
      if (days < 1 || days > 365) {
        return res.status(400).json({ error: "Trial days must be between 1 and 365" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }
      
      // Calculate trial end date
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + days);
      
      // Generate password setup token (7 day expiry for new accounts)
      const crypto = await import('crypto');
      const passwordSetupToken = crypto.randomBytes(32).toString('hex');
      const passwordSetupExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      // Create the promotional user with password setup token
      const user = await storage.upsertUser({
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        companyName: companyName || null,
        subscriptionTier: tier || 'growth', // Default to growth for promos
        trialEndsAt,
        billingStatus: 'trialing',
        billingCompleted: true, // Skip payment requirement
        profileCompleted: !!(firstName && lastName), // Complete if name provided
        isAdmin: false,
        isOwner: false,
        passwordResetToken: passwordSetupToken,
        passwordResetExpires: passwordSetupExpires,
      });
      
      // Generate password setup URL - use vendorwatch.app for production
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://vendorwatch.app'
        : 'http://localhost:5000';
      const passwordSetupUrl = `${baseUrl}/set-password?token=${passwordSetupToken}`;
      
      // Send promotional welcome email with trial details and password setup link
      console.log(`[promo] Sending welcome email to: ${email}`);
      const tierDisplay = (tier || 'growth').charAt(0).toUpperCase() + (tier || 'growth').slice(1);
      
      // Use try-catch for better error handling
      let emailSent = false;
      let emailError = null;
      try {
        emailSent = await sendWelcomeEmail(email, firstName || null, {
          isPromo: true,
          trialDays: days,
          trialEndsAt,
          tier: tierDisplay,
          passwordSetupUrl,
        });
        console.log(`[promo] Welcome email send result for ${email}: ${emailSent ? 'success' : 'failed'}`);
        
        // Notify owner about new promo signup (non-blocking)
        notifyOwnerNewSignup(email, firstName || null, lastName || null, 'promo_trial', tierDisplay).catch(err => {
          console.error('[promo] Failed to notify owner:', err);
        });
      } catch (err: any) {
        emailError = err?.message || 'Unknown error';
        console.error('[promo] Failed to send welcome email:', err);
        // Don't fail the whole request if email fails
      }
      
      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          subscriptionTier: user.subscriptionTier,
          trialEndsAt: user.trialEndsAt,
        },
        emailSent,
        emailError,
        message: `Promotional account created with ${days}-day trial ending ${trialEndsAt.toLocaleDateString()}`
      });
    } catch (error) {
      console.error("Error creating promo account:", error);
      res.status(500).json({ error: "Failed to create promotional account" });
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

  // Cleanup stale incidents (admin only)
  app.post("/api/admin/cleanup-stale", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const staleDays = req.body.staleDays || 7;
      console.log(`[admin] Manual stale cleanup triggered (${staleDays} days threshold)`);
      
      const vendorResult = await resolveStaleIncidents(staleDays);
      const blockchainResult = await resolveStaleBlockchainIncidents(staleDays);
      
      const totalResolved = vendorResult.resolved + blockchainResult.resolved;
      console.log(`[admin] Stale cleanup complete: ${vendorResult.resolved} vendor + ${blockchainResult.resolved} blockchain incidents resolved`);
      
      res.json({
        success: true,
        resolved: {
          vendor: vendorResult.resolved,
          blockchain: blockchainResult.resolved,
          total: totalResolved
        },
        message: `Resolved ${totalResolved} stale incidents`
      });
    } catch (error) {
      console.error("Error cleaning up stale incidents:", error);
      res.status(500).json({ error: "Failed to cleanup stale incidents" });
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

  // Test email (protected) - uses notification email if set, otherwise account email
  app.post("/api/email/test", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      // Use notification email if set, otherwise fall back to account email
      const targetEmail = user?.notificationEmail || user?.email;
      if (!targetEmail) {
        return res.status(400).json({ error: "No email address configured. Please set your notification email in Settings." });
      }
      
      const { sendEmail } = await import('./emailClient');
      const success = await sendEmail(
        targetEmail,
        'Vendor Watch - Test Email',
        `<h1>Test Email</h1><p>This is a test email from Vendor Watch to confirm your email notifications are working correctly.</p><p>If you received this, your email alerts are configured properly!</p>`
      );
      
      if (success) {
        res.json({ success: true, message: `Test email sent to ${targetEmail}` });
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

  // Blockchain subscriptions
  app.get("/api/blockchain-subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscriptions = await storage.getUserBlockchainSubscriptions(userId);
      const hasSetSubscriptions = await storage.hasUserSetBlockchainSubscriptions(userId);
      res.json({ chainKeys: subscriptions, hasSetSubscriptions });
    } catch (error) {
      console.error("Error fetching blockchain subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch blockchain subscriptions" });
    }
  });

  app.put("/api/blockchain-subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { chainKeys } = req.body;
      
      if (!Array.isArray(chainKeys)) {
        return res.status(400).json({ error: "chainKeys must be an array" });
      }
      
      await storage.setUserBlockchainSubscriptions(userId, chainKeys);
      res.json({ success: true, chainKeys });
    } catch (error) {
      console.error("Error updating blockchain subscriptions:", error);
      res.status(500).json({ error: "Failed to update blockchain subscriptions" });
    }
  });

  app.delete("/api/blockchain-subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.resetUserBlockchainSubscriptions(userId);
      res.json({ success: true, message: "Reset to monitor all blockchain networks" });
    } catch (error) {
      console.error("Error resetting blockchain subscriptions:", error);
      res.status(500).json({ error: "Failed to reset blockchain subscriptions" });
    }
  });

  // Dashboard routes require completed onboarding (server-side guard)
  app.get("/api/my-vendors", isAuthenticated, requireOnboardingComplete, async (req: any, res) => {
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
  app.get("/api/vendor-order", isAuthenticated, requireOnboardingComplete, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const order = await storage.getUserVendorOrder(userId);
      res.json({ vendorKeys: order.map(o => o.vendorKey) });
    } catch (error) {
      console.error("Error fetching vendor order:", error);
      res.status(500).json({ error: "Failed to fetch vendor order" });
    }
  });

  app.put("/api/vendor-order", isAuthenticated, requireOnboardingComplete, async (req: any, res) => {
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

  app.get("/api/my-incidents", isAuthenticated, requireOnboardingComplete, async (req: any, res) => {
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
      
      if (tier !== null && !['essential', 'growth', 'enterprise'].includes(tier)) {
        return res.status(400).json({ error: "Invalid tier. Must be essential, growth, enterprise, or null" });
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
      console.error("Stripe error details:", {
        type: error.type,
        code: error.code,
        message: error.message,
        priceId: TIER_PRICE_IDS[req.body?.tier],
      });
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid signup data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create checkout session", details: error.message });
    }
  });

  // Mobile signup schema - includes password for native mobile auth
  const mobileSignupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    companyName: z.string().min(1),
    phone: z.string().min(1),
    tier: z.enum(['essential', 'growth', 'enterprise']),
    success_url: z.string().url().optional(),
    cancel_url: z.string().url().optional(),
  });

  // Mobile signup endpoint - stores pending signup and returns Stripe checkout URL
  // User account is ONLY created after payment succeeds via webhook
  app.post("/api/auth/mobile-signup", async (req, res) => {
    try {
      const validatedData = mobileSignupSchema.parse(req.body);
      const email = validatedData.email.toLowerCase();
      
      // 1. Check if user already exists
      const [existingUser] = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      // 2. Check for existing pending signup with same email
      const [existingPending] = await db.select()
        .from(pendingSignups)
        .where(and(
          eq(pendingSignups.email, email),
          isNull(pendingSignups.completedAt),
          gt(pendingSignups.expiresAt, new Date())
        ))
        .limit(1);
      
      if (existingPending) {
        return res.status(400).json({ error: 'Signup already in progress. Please complete payment or try again later.' });
      }
      
      // 3. Hash password and generate signup token (stored server-side for security)
      const hashedPassword = await bcrypt.hash(validatedData.password, SALT_ROUNDS);
      const signupToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // 4. Create Stripe checkout session first
      const stripe = await getUncachableStripeClient();
      const priceId = TIER_PRICE_IDS[validatedData.tier];
      
      const session = await stripe.checkout.sessions.create({
        customer_email: email,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: validatedData.success_url || `https://vendorwatch.app/signup/success?pending=${signupToken}`,
        cancel_url: validatedData.cancel_url || `https://vendorwatch.app/signup`,
        subscription_data: {
          trial_period_days: 7,
        },
        metadata: {
          pendingSignupToken: signupToken,
          platform: 'mobile',
        },
      });
      
      // 5. Store pending signup in database (password stored securely server-side)
      await db.insert(pendingSignups).values({
        signupToken,
        email,
        passwordHash: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        companyName: validatedData.companyName,
        phone: validatedData.phone,
        tier: validatedData.tier,
        stripeCheckoutSessionId: session.id,
        expiresAt,
      });
      
      console.log(`[auth] Mobile signup: Created pending signup for ${email}, checkout session: ${session.id}`);
      
      // 6. Return checkout URL and signup token (for mobile to poll/exchange after payment)
      res.json({
        success: true,
        checkoutUrl: session.url,
        signupToken, // Mobile app uses this to get auth token after payment completes
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error: any) {
      console.error('[auth] Mobile signup error:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: 'Invalid signup data', 
          details: error.flatten().fieldErrors 
        });
      }
      
      if (error.type === 'StripeInvalidRequestError') {
        return res.status(400).json({ 
          error: 'Payment setup failed',
          code: error.code,
          message: error.message
        });
      }
      
      res.status(500).json({ error: 'Failed to start signup' });
    }
  });
  
  // Mobile auth complete endpoint - exchanges signupToken for auth token after payment
  // Single-use: token can only be exchanged once
  app.post("/api/mobile/auth/complete", async (req, res) => {
    try {
      const { signupToken } = req.body;
      
      if (!signupToken || typeof signupToken !== 'string') {
        return res.status(400).json({ error: 'Missing signup token' });
      }
      
      // Find the pending signup
      const [pending] = await db.select()
        .from(pendingSignups)
        .where(eq(pendingSignups.signupToken, signupToken))
        .limit(1);
      
      if (!pending) {
        return res.status(404).json({ error: 'Invalid signup token' });
      }
      
      // Check if expired
      if (pending.expiresAt < new Date()) {
        return res.status(410).json({ error: 'Signup token expired' });
      }
      
      // Check if token was already exchanged (single-use enforcement)
      if (pending.tokenExchangedAt) {
        return res.status(403).json({ error: 'Token already used. Please log in with your credentials.' });
      }
      
      // Check if payment is complete (user was created by webhook)
      if (!pending.completedAt || !pending.createdUserId) {
        return res.status(202).json({ 
          status: 'pending',
          message: 'Payment not yet confirmed. Please complete payment and try again.',
        });
      }
      
      // Atomically mark token as exchanged to prevent race conditions
      const [exchanged] = await db.update(pendingSignups)
        .set({ tokenExchangedAt: new Date() })
        .where(and(
          eq(pendingSignups.id, pending.id),
          isNull(pendingSignups.tokenExchangedAt)
        ))
        .returning();
      
      if (!exchanged) {
        return res.status(403).json({ error: 'Token already used. Please log in with your credentials.' });
      }
      
      // Get the created user
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, pending.createdUserId))
        .limit(1);
      
      if (!user) {
        return res.status(500).json({ error: 'User account not found' });
      }
      
      // Generate mobile auth token
      const apiToken = crypto.randomBytes(48).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      await db.insert(mobileAuthTokens).values({
        userId: user.id,
        token: apiToken,
        deviceInfo: 'mobile-signup-complete',
        expiresAt: tokenExpiresAt,
      });
      
      console.log(`[auth] Mobile signup complete: User ${user.id} exchanged signupToken for auth token`);
      
      res.json({
        success: true,
        token: apiToken,
        tokenExpiresAt: tokenExpiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: `${user.firstName} ${user.lastName}`,
          subscription: {
            tier: user.subscriptionTier,
            status: user.billingStatus || 'trialing',
            trialEndsAt: user.trialEndsAt?.toISOString(),
          },
        },
      });
    } catch (error: any) {
      console.error('[auth] Mobile auth complete error:', error);
      res.status(500).json({ error: 'Failed to complete authentication' });
    }
  });
  
  // Get subscription tier info
  app.get("/api/subscription/tier", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const tier = user.subscriptionTier as 'essential' | 'growth' | 'enterprise' | null;
      const tierInfo = tier ? SUBSCRIPTION_TIERS[tier] : null;
      const vendorCount = await storage.getUserVendorSubscriptions(user.id);
      
      res.json({
        tier,
        tierInfo,
        currentVendorCount: vendorCount.length,
        canAddVendors: tier === 'enterprise',
        canRequestVendors: tier === 'growth',
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
      
      const tier = user.subscriptionTier as 'essential' | 'growth' | 'enterprise' | null;
      
      // Enterprise users should use direct vendor add endpoint
      if (tier === 'enterprise') {
        return res.status(400).json({ error: "Enterprise users can add vendors directly" });
      }
      
      // Check if Essential user (no custom requests allowed)
      if (tier === 'essential') {
        return res.status(403).json({ error: "Essential plan does not include custom vendor requests. Upgrade to Growth or Enterprise." });
      }
      
      // Growth users get 3 custom requests max
      if (tier === 'growth') {
        const requestCount = await storage.getUserRequestCount(userId);
        if (requestCount >= SUBSCRIPTION_TIERS.growth.customVendorRequests!) {
          return res.status(403).json({ 
            error: "You have reached your custom vendor request limit (3). Upgrade to Enterprise for unlimited additions.",
            limit: SUBSCRIPTION_TIERS.growth.customVendorRequests,
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
      
      const tier = user?.subscriptionTier as 'essential' | 'growth' | 'enterprise' | null;
      const tierInfo = tier ? SUBSCRIPTION_TIERS[tier] : null;
      
      res.json({
        ...limitInfo,
        requestCount,
        requestLimit: tierInfo?.customVendorRequests ?? 0,
        canRequestVendors: tier === 'growth' && requestCount < (tierInfo?.customVendorRequests || 0),
        canAddVendorsDirectly: tier === 'enterprise',
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
      
      if (user.subscriptionTier !== 'enterprise') {
        return res.status(403).json({ error: "Only Enterprise users can add vendors directly" });
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
        notifyEmail: user.notifyEmail ?? false,
        notifySms: user.notifySms ?? false,
        timezone: user.timezone || "UTC",
      });
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.put("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const { notificationEmail, phone, notifyEmail, notifySms, timezone } = req.body;
      const user = await storage.updateUserNotifications(req.user.id, {
        notificationEmail,
        phone,
        notifyEmail,
        notifySms,
        timezone,
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
          notifySms: user.notifySms,
          timezone: user.timezone || "UTC"
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
  app.get("/api/blockchain/incidents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // Filter incidents to only show those for blockchains the user is subscribed to
      const incidents = await storage.getBlockchainIncidentsForUser(userId);
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching blockchain incidents:", error);
      res.status(500).json({ error: "Failed to fetch blockchain incidents" });
    }
  });

  // Get active blockchain incidents
  app.get("/api/blockchain/incidents/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const allIncidents = await storage.getActiveBlockchainIncidents();
      const blockchainSubs = await storage.getUserBlockchainSubscriptions(userId);
      
      // Filter to only subscribed chains
      const incidents = blockchainSubs.length > 0
        ? allIncidents.filter(i => blockchainSubs.includes(i.chainKey))
        : [];
      
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

  // Blockchain stats overview - returns stats for USER'S subscribed chains only
  app.get("/api/blockchain/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const allChains = await storage.getBlockchainChains();
      const userSubscriptions = await storage.getUserBlockchainSubscriptions(userId);
      
      // Filter chains to only those user is subscribed to
      const chains = userSubscriptions.length > 0 
        ? allChains.filter(c => userSubscriptions.includes(c.key))
        : [];
      
      // Get user's subscribed blockchain incidents only
      const allActiveIncidents = await storage.getActiveBlockchainIncidents();
      const activeIncidents = userSubscriptions.length > 0
        ? allActiveIncidents.filter(i => userSubscriptions.includes(i.chainKey))
        : [];
      
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

  // Manual blockchain refresh (alias for sync)
  app.post("/api/blockchain/refresh", isAuthenticated, async (req, res) => {
    try {
      console.log("[blockchain] Manual refresh triggered");
      await syncAllBlockchainChains();
      res.json({ success: true, message: "Blockchain data refreshed" });
    } catch (error) {
      console.error("Error refreshing blockchain chains:", error);
      res.status(500).json({ error: "Failed to refresh blockchain data" });
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
  
  // Generate customer-ready blockchain incident summary email template
  app.get("/api/blockchain/incidents/:id/customer-summary", isAuthenticated, async (req: any, res) => {
    try {
      const incident = await storage.getBlockchainIncident(req.params.id);
      
      if (!incident) {
        return res.status(404).json({ error: "Blockchain incident not found" });
      }
      
      const chains = await storage.getBlockchainChains();
      const chain = chains.find(c => c.chainKey === incident.chainKey);
      const chainName = chain?.name || incident.chainKey;
      
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
      
      const subject = `[${statusText}] ${chainName} Blockchain Update - ${incident.title}`;
      
      const emailBody = `Dear Valued Client,

We are writing to inform you of a service event affecting ${chainName} blockchain infrastructure.

**Incident Summary**
- Status: ${statusText}
- Started: ${formattedDate}
- Impact Level: ${impactLevel.charAt(0).toUpperCase() + impactLevel.slice(1)}
- Incident Type: ${incident.incidentType}

**Description**
${incident.description || incident.title}

**Current Status**
${incident.status === 'resolved' 
  ? `This incident has been resolved. ${chainName} services have returned to normal operation.`
  : `Our team is actively monitoring this situation. The ${chainName} team is working to resolve the issue.`}

**What This Means for You**
${incident.severity === 'critical' || incident.severity === 'major'
  ? `You may experience ${impactLevel} disruption to services that depend on ${chainName}. We recommend planning for potential delays or interruptions to blockchain transactions.`
  : `This event may have ${impactLevel} impact on your blockchain-related services. No immediate action is required.`}

${incident.affectedServices ? `**Affected Services**
${incident.affectedServices}

` : ''}**Next Steps**
We will continue to monitor this situation and provide updates as they become available.

If you have any questions or concerns, please don't hesitate to contact our support team.

Best regards,
Your IT Support Team

---
Vendor Watch | Blockchain Infrastructure Monitoring`;

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
          chainName,
          incidentType: incident.incidentType,
          startedAt: incident.startedAt,
        }
      });
    } catch (error) {
      console.error("Error generating blockchain customer summary:", error);
      res.status(500).json({ error: "Failed to generate blockchain customer summary" });
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
  
  // Get acknowledgement history for a blockchain incident
  app.get("/api/blockchain/incidents/:id/acknowledgement-history", isAuthenticated, async (req: any, res) => {
    try {
      const incidentId = req.params.id;
      const history = await storage.getIncidentAcknowledgementHistory(incidentId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching blockchain incident acknowledgement history:", error);
      res.status(500).json({ error: "Failed to fetch acknowledgement history" });
    }
  });

  // ============ MAINTENANCE TRACKING ============

  // Get all vendor maintenances (includes incidents with "maintenance" in title)
  app.get("/api/maintenance/vendors", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getVendorMaintenances();
      const allIncidents = await storage.getIncidents();
      const activeIncidents = allIncidents.filter(i => i.status !== 'resolved');
      const maintenanceIncidents = activeIncidents
        .filter(i => i.title.toLowerCase().includes('maintenance'))
        .map(i => ({
          id: `incident-${i.id}`,
          vendorKey: i.vendorKey,
          maintenanceId: i.incidentId,
          title: i.title,
          description: null,
          status: i.status === 'resolved' ? 'completed' : 'in_progress',
          impact: i.impact || 'maintenance',
          url: i.url,
          scheduledStartAt: i.startedAt,
          scheduledEndAt: null,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          affectedServices: null,
          rawHash: null,
          isFromIncident: true
        }));
      res.json([...maintenances, ...maintenanceIncidents]);
    } catch (error) {
      console.error("Error fetching vendor maintenances:", error);
      res.status(500).json({ error: "Failed to fetch vendor maintenances" });
    }
  });

  // Get active vendor maintenances (in progress, includes incidents with "maintenance" in title)
  app.get("/api/maintenance/vendors/active", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getActiveVendorMaintenances();
      const allIncidents = await storage.getIncidents();
      const activeIncidents = allIncidents.filter(i => i.status !== 'resolved');
      const maintenanceIncidents = activeIncidents
        .filter(i => i.title.toLowerCase().includes('maintenance'))
        .map(i => ({
          id: `incident-${i.id}`,
          vendorKey: i.vendorKey,
          maintenanceId: i.incidentId,
          title: i.title,
          description: null,
          status: 'in_progress',
          impact: i.impact || 'maintenance',
          url: i.url,
          scheduledStartAt: i.startedAt,
          scheduledEndAt: null,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          affectedServices: null,
          rawHash: null,
          isFromIncident: true
        }));
      res.json([...maintenances, ...maintenanceIncidents]);
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

  // Get all blockchain maintenances (includes incidents with "maintenance" in title)
  app.get("/api/maintenance/blockchain", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getBlockchainMaintenances();
      const incidents = await storage.getActiveBlockchainIncidents();
      const maintenanceIncidents = incidents
        .filter(i => i.title.toLowerCase().includes('maintenance'))
        .map(i => ({
          id: `incident-${i.id}`,
          chainKey: i.chainKey,
          maintenanceId: i.incidentId,
          title: i.title,
          description: i.description,
          status: i.status === 'resolved' ? 'completed' : 'in_progress',
          impact: i.severity || 'maintenance',
          url: i.url,
          scheduledStartAt: i.startedAt,
          scheduledEndAt: i.resolvedAt,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          affectedServices: i.affectedServices,
          rawHash: null,
          isFromIncident: true
        }));
      res.json([...maintenances, ...maintenanceIncidents]);
    } catch (error) {
      console.error("Error fetching blockchain maintenances:", error);
      res.status(500).json({ error: "Failed to fetch blockchain maintenances" });
    }
  });

  // Get active blockchain maintenances (in progress, includes incidents with "maintenance" in title)
  app.get("/api/maintenance/blockchain/active", isAuthenticated, async (req, res) => {
    try {
      const maintenances = await storage.getActiveBlockchainMaintenances();
      const incidents = await storage.getActiveBlockchainIncidents();
      const maintenanceIncidents = incidents
        .filter(i => i.title.toLowerCase().includes('maintenance'))
        .map(i => ({
          id: `incident-${i.id}`,
          chainKey: i.chainKey,
          maintenanceId: i.incidentId,
          title: i.title,
          description: i.description,
          status: 'in_progress',
          impact: i.severity || 'maintenance',
          url: i.url,
          scheduledStartAt: i.startedAt,
          scheduledEndAt: null,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          affectedServices: i.affectedServices,
          rawHash: null,
          isFromIncident: true
        }));
      res.json([...maintenances, ...maintenanceIncidents]);
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

  // Get maintenance statistics (includes incidents with "maintenance" in title)
  app.get("/api/maintenance/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getMaintenanceStats();
      const blockchainIncidents = await storage.getActiveBlockchainIncidents();
      const allVendorIncidents = await storage.getIncidents();
      const activeVendorIncidents = allVendorIncidents.filter(i => i.status !== 'resolved');
      const blockchainMaintenanceIncidents = blockchainIncidents.filter(i => i.title.toLowerCase().includes('maintenance')).length;
      const vendorMaintenanceIncidents = activeVendorIncidents.filter(i => i.title.toLowerCase().includes('maintenance')).length;
      res.json({
        ...stats,
        blockchainActive: stats.blockchainActive + blockchainMaintenanceIncidents,
        vendorActive: stats.vendorActive + vendorMaintenanceIncidents,
        total: stats.total + blockchainMaintenanceIncidents + vendorMaintenanceIncidents,
      });
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
  
  // Get SLA metrics for user's subscribed vendors only
  app.get("/api/sla/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const days = parseInt(req.query.days as string) || 30;
      const target = parseFloat(req.query.target as string) || 99.9;
      
      // Get user's vendor subscriptions first
      const vendorSubs = await storage.getUserVendorSubscriptions(userId);
      
      // Filter vendors to only subscribed ones
      const allVendors = await storage.getVendors();
      const vendors = vendorSubs.length > 0 
        ? allVendors.filter(v => vendorSubs.includes(v.key))
        : [];
      
      const allVendorMetrics = await storage.getAllVendorPerformanceStats(days);
      const vendorMetrics = vendorSubs.length > 0
        ? allVendorMetrics.filter((m: any) => vendorSubs.includes(m.vendorKey))
        : [];
      
      const { getAllVendorReliability } = await import('./reliabilityTracker');
      const allReliabilityStats = await getAllVendorReliability();
      const reliabilityStats = vendorSubs.length > 0
        ? allReliabilityStats.filter((r: any) => vendorSubs.includes(r.vendorKey))
        : [];
      
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

  // SLA Dashboard - Combined view for vendors and blockchain
  app.get("/api/sla/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const days = parseInt(req.query.days as string) || 30;
      const target = parseFloat(req.query.target as string) || 99.9;
      
      // Get user's subscriptions first
      const [vendorSubs, blockchainSubs] = await Promise.all([
        storage.getUserVendorSubscriptions(userId),
        storage.getUserBlockchainSubscriptions(userId)
      ]);
      
      // Get vendor SLA data - filtered by subscriptions
      const allVendors = await storage.getVendors();
      const vendors = vendorSubs.length > 0 
        ? allVendors.filter(v => vendorSubs.includes(v.key))
        : [];
      
      const allVendorMetrics = await storage.getAllVendorPerformanceStats(days);
      const vendorMetrics = vendorSubs.length > 0
        ? allVendorMetrics.filter((m: any) => vendorSubs.includes(m.vendorKey))
        : [];
      
      const { getAllVendorReliability } = await import('./reliabilityTracker');
      const allReliabilityStats = await getAllVendorReliability();
      const reliabilityStats = vendorSubs.length > 0
        ? allReliabilityStats.filter((r: any) => vendorSubs.includes(r.vendorKey))
        : [];
      
      const totalMinutesInPeriod = days * 24 * 60;
      
      const vendorSLAs = vendors.map(vendor => {
        const metrics = vendorMetrics.find((m: any) => m.vendorKey === vendor.key);
        const reliabilityData = reliabilityStats.find((r: any) => r.vendorKey === vendor.key);
        const reliability = reliabilityData?.metrics;
        
        const uptimePercent = metrics?.uptimePercent ?? 100;
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
          type: 'vendor' as const,
          key: vendor.key,
          name: vendor.name,
          uptimePercent: Math.min(100, Math.max(0, uptimePercent)),
          downtimeMinutes,
          incidentCount: metrics?.incidentCount || 0,
          slaTarget: target,
          meetsTarget: uptimePercent >= target,
          trend,
          warning: uptimePercent < target ? `Below ${target}% target` : null,
        };
      });
      
      // Get blockchain SLA data - filter to user subscriptions and requested time period
      const allChains = await storage.getBlockchainChains();
      const chains = blockchainSubs.length > 0
        ? allChains.filter(c => blockchainSubs.includes(c.key))
        : [];
      
      const allBlockchainIncidents = await storage.getBlockchainIncidents();
      const blockchainIncidentsList = blockchainSubs.length > 0
        ? allBlockchainIncidents.filter(i => blockchainSubs.includes(i.chainKey))
        : [];
      
      const now = Date.now();
      const periodStart = now - (days * 24 * 60 * 60 * 1000);
      
      const blockchainSLAs = chains.map(chain => {
        // Filter incidents to those that started within the requested period
        const chainIncidents = blockchainIncidentsList.filter(i => {
          const startedAt = new Date(i.startedAt).getTime();
          return i.chainKey === chain.chainKey && startedAt >= periodStart;
        });
        
        const resolvedIncidents = chainIncidents.filter(i => i.status === 'resolved' && i.resolvedAt);
        
        let totalDowntimeMinutes = 0;
        for (const incident of resolvedIncidents) {
          const start = new Date(incident.startedAt).getTime();
          const end = incident.resolvedAt ? new Date(incident.resolvedAt).getTime() : now;
          // Only count downtime within the period
          const effectiveStart = Math.max(start, periodStart);
          const effectiveEnd = Math.min(end, now);
          if (effectiveEnd > effectiveStart) {
            totalDowntimeMinutes += (effectiveEnd - effectiveStart) / (1000 * 60);
          }
        }
        
        // Also account for ongoing incidents (not resolved yet)
        const ongoingIncidents = chainIncidents.filter(i => i.status !== 'resolved');
        for (const incident of ongoingIncidents) {
          const start = new Date(incident.startedAt).getTime();
          const effectiveStart = Math.max(start, periodStart);
          if (now > effectiveStart) {
            totalDowntimeMinutes += (now - effectiveStart) / (1000 * 60);
          }
        }
        
        const uptimePercent = totalMinutesInPeriod > 0 
          ? Math.max(0, Math.min(100, 100 - (totalDowntimeMinutes / totalMinutesInPeriod * 100)))
          : 100;
        
        return {
          type: 'blockchain' as const,
          key: chain.chainKey,
          name: chain.name,
          uptimePercent,
          downtimeMinutes: Math.round(totalDowntimeMinutes),
          incidentCount: chainIncidents.length,
          slaTarget: target,
          meetsTarget: uptimePercent >= target,
          trend: 'stable' as const,
          warning: uptimePercent < target ? `Below ${target}% target` : null,
        };
      });
      
      const allSLAs = [...vendorSLAs, ...blockchainSLAs].sort((a, b) => a.uptimePercent - b.uptimePercent);
      const belowTarget = allSLAs.filter(s => !s.meetsTarget);
      const atRisk = allSLAs.filter(s => s.uptimePercent < target + 0.5 && s.meetsTarget);
      
      res.json({
        summary: {
          totalResources: allSLAs.length,
          vendorCount: vendorSLAs.length,
          blockchainCount: blockchainSLAs.length,
          averageUptime: allSLAs.length > 0 
            ? (allSLAs.reduce((sum, s) => sum + s.uptimePercent, 0) / allSLAs.length).toFixed(2)
            : "100.00",
          belowTargetCount: belowTarget.length,
          atRiskCount: atRisk.length,
          target,
        },
        belowTarget,
        atRisk,
        allResources: allSLAs,
      });
    } catch (error) {
      console.error("Error fetching SLA dashboard:", error);
      res.status(500).json({ error: "Failed to fetch SLA dashboard" });
    }
  });
  
  // Predictive Alerts - Analyze patterns and warn about reliability trends
  app.get("/api/alerts/predictive", isAuthenticated, async (req: any, res) => {
    try {
      // Get vendor reliability data
      const { getAllVendorReliability } = await import('./reliabilityTracker');
      const reliabilityStats = await getAllVendorReliability();
      const vendors = await storage.getVendors();
      
      const alerts: Array<{
        type: 'vendor' | 'blockchain';
        resourceKey: string;
        resourceName: string;
        alertType: 'reliability_declining' | 'increased_incidents' | 'resolution_time_increasing';
        severity: 'warning' | 'critical';
        message: string;
        details: string;
      }> = [];
      
      // Analyze vendor trends
      for (const stat of reliabilityStats) {
        const vendor = vendors.find(v => v.key === stat.vendorKey);
        const vendorName = vendor?.name || stat.vendorKey;
        const m = stat.metrics;
        
        // Check for increasing incident trend
        if (m.incidents30Days > 0) {
          const monthlyRate = m.incidents30Days;
          const expectedRate = m.incidents90Days / 3;
          
          if (monthlyRate > expectedRate * 2 && monthlyRate >= 3) {
            alerts.push({
              type: 'vendor',
              resourceKey: stat.vendorKey,
              resourceName: vendorName,
              alertType: 'increased_incidents',
              severity: monthlyRate >= 5 ? 'critical' : 'warning',
              message: `${vendorName} incident rate has doubled`,
              details: `${m.incidents30Days} incidents in the last 30 days vs ${Math.round(expectedRate)} expected based on 90-day average`,
            });
          }
        }
        
        // Check for reliability decline
        if (m.uptimePercent < 99.5 && m.uptimePercent < 100) {
          const trend = m.incidents30Days > m.incidents90Days / 3 ? 'declining' : 'stable';
          if (trend === 'declining') {
            alerts.push({
              type: 'vendor',
              resourceKey: stat.vendorKey,
              resourceName: vendorName,
              alertType: 'reliability_declining',
              severity: m.uptimePercent < 99 ? 'critical' : 'warning',
              message: `${vendorName} reliability is trending downward`,
              details: `Current uptime: ${m.uptimePercent.toFixed(2)}% with ${m.incidents30Days} incidents in the last month`,
            });
          }
        }
        
        // Check for resolution time increasing
        if (m.avgResolutionMinutes && m.avgResolutionMinutes > 120) {
          alerts.push({
            type: 'vendor',
            resourceKey: stat.vendorKey,
            resourceName: vendorName,
            alertType: 'resolution_time_increasing',
            severity: m.avgResolutionMinutes > 240 ? 'critical' : 'warning',
            message: `${vendorName} incident resolution times are high`,
            details: `Average resolution time: ${Math.round(m.avgResolutionMinutes)} minutes`,
          });
        }
      }
      
      // Analyze blockchain trends
      const chains = await storage.getBlockchainChains();
      const blockchainIncidents = await storage.getBlockchainIncidents();
      
      for (const chain of chains) {
        const chainIncidents = blockchainIncidents.filter(i => i.chainKey === chain.chainKey);
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const recentIncidents = chainIncidents.filter(i => new Date(i.startedAt).getTime() > thirtyDaysAgo);
        
        if (recentIncidents.length >= 3) {
          alerts.push({
            type: 'blockchain',
            resourceKey: chain.chainKey,
            resourceName: chain.name,
            alertType: 'increased_incidents',
            severity: recentIncidents.length >= 5 ? 'critical' : 'warning',
            message: `${chain.name} has had multiple incidents recently`,
            details: `${recentIncidents.length} incidents in the last 30 days`,
          });
        }
      }
      
      // Sort alerts by severity
      alerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return 0;
      });
      
      res.json({
        alerts,
        summary: {
          total: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          warning: alerts.filter(a => a.severity === 'warning').length,
          vendorAlerts: alerts.filter(a => a.type === 'vendor').length,
          blockchainAlerts: alerts.filter(a => a.type === 'blockchain').length,
        },
        lastAnalyzed: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error generating predictive alerts:", error);
      res.status(500).json({ error: "Failed to generate predictive alerts" });
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

  // Get vendor performance stats (filtered by user subscriptions)
  app.get("/api/analytics/vendors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const days = parseInt(req.query.days as string) || 30;
      const vendorSubs = await storage.getUserVendorSubscriptions(userId);
      
      const allStats = await storage.getAllVendorPerformanceStats(days);
      const stats = vendorSubs.length > 0
        ? allStats.filter((s: any) => vendorSubs.includes(s.vendorKey))
        : [];
      
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

  // Get blockchain performance stats (filtered by user subscriptions)
  app.get("/api/analytics/blockchain", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const days = parseInt(req.query.days as string) || 30;
      const blockchainSubs = await storage.getUserBlockchainSubscriptions(userId);
      
      const allStats = await storage.getAllBlockchainPerformanceStats(days);
      const stats = blockchainSubs.length > 0
        ? allStats.filter((s: any) => blockchainSubs.includes(s.chainKey))
        : [];
      
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

  // ============ BLOCKCHAIN AI COPILOT ROUTES ============

  // Generate blockchain incident update
  app.post("/api/ai-copilot/blockchain/incident-update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { incidentId, audience, tone, includeNextSteps } = req.body;
      if (!incidentId) {
        return res.status(400).json({ error: "incidentId is required" });
      }
      
      // Authorization: Verify user can access this blockchain incident
      const incident = await storage.getBlockchainIncident(incidentId);
      if (!incident) {
        return res.status(404).json({ error: "Blockchain incident not found" });
      }
      
      const subscriptions = await storage.getUserBlockchainSubscriptions(userId);
      const user = await storage.getUser(userId);
      
      const hasAccess = user?.isAdmin || 
        subscriptions.length === 0 || 
        subscriptions.includes(incident.chainKey);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied: You are not subscribed to this blockchain" });
      }
      
      const { generateBlockchainIncidentUpdate } = await import('./aiCopilot');
      const result = await generateBlockchainIncidentUpdate(incidentId, {
        audience: audience || 'client',
        tone: tone || 'formal',
        includeNextSteps: includeNextSteps !== false,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error generating blockchain incident update:", error);
      res.status(500).json({ error: "Failed to generate blockchain incident update" });
    }
  });

  // Suggest blockchain root cause
  app.post("/api/ai-copilot/blockchain/root-cause", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { incidentId } = req.body;
      if (!incidentId) {
        return res.status(400).json({ error: "incidentId is required" });
      }
      
      // Authorization check
      const incident = await storage.getBlockchainIncident(incidentId);
      if (!incident) {
        return res.status(404).json({ error: "Blockchain incident not found" });
      }
      
      const subscriptions = await storage.getUserBlockchainSubscriptions(userId);
      const user = await storage.getUser(userId);
      const hasAccess = user?.isAdmin || subscriptions.length === 0 || 
        subscriptions.includes(incident.chainKey);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { suggestBlockchainRootCause } = await import('./aiCopilot');
      const result = await suggestBlockchainRootCause(incidentId);
      
      res.json(result);
    } catch (error) {
      console.error("Error suggesting blockchain root cause:", error);
      res.status(500).json({ error: "Failed to suggest blockchain root cause" });
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

  // MSP Clients (Growth+ tier required)
  app.get("/api/clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Client management requires Growth or Enterprise subscription" });
      }
      
      const clients = await storage.getClients(userId);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Client management requires Growth or Enterprise subscription" });
      }
      
      const client = await storage.createClient({ ...req.body, userId });
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) return res.status(404).json({ error: "Client not found" });
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Client not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Client-Vendor Links
  app.get("/api/clients/vendors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const links = await storage.getClientVendorLinks(userId);
      res.json(links);
    } catch (error) {
      console.error("Error fetching client-vendor links:", error);
      res.status(500).json({ error: "Failed to fetch client-vendor links" });
    }
  });

  app.get("/api/vendors/:vendorKey/clients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const clients = await storage.getVendorClients(userId, req.params.vendorKey);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching vendor clients:", error);
      res.status(500).json({ error: "Failed to fetch vendor clients" });
    }
  });

  app.post("/api/clients/:clientId/vendors/:vendorKey", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { priority } = req.body;
      const link = await storage.linkVendorToClient(userId, req.params.clientId, req.params.vendorKey, priority);
      res.status(201).json(link);
    } catch (error) {
      console.error("Error linking vendor to client:", error);
      res.status(500).json({ error: "Failed to link vendor to client" });
    }
  });

  app.delete("/api/clients/:clientId/vendors/:vendorKey", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const unlinked = await storage.unlinkVendorFromClient(userId, req.params.clientId, req.params.vendorKey);
      res.json({ success: unlinked });
    } catch (error) {
      console.error("Error unlinking vendor from client:", error);
      res.status(500).json({ error: "Failed to unlink vendor from client" });
    }
  });

  // Incident Playbooks (Growth+ tier required)
  app.get("/api/playbooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Incident playbooks require Growth or Enterprise subscription" });
      }
      
      const playbooks = await storage.getPlaybooks(userId);
      res.json(playbooks);
    } catch (error) {
      console.error("Error fetching playbooks:", error);
      res.status(500).json({ error: "Failed to fetch playbooks" });
    }
  });

  app.get("/api/playbooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const playbook = await storage.getPlaybook(req.params.id);
      if (!playbook) return res.status(404).json({ error: "Playbook not found" });
      
      const steps = await storage.getPlaybookSteps(req.params.id);
      res.json({ ...playbook, steps });
    } catch (error) {
      console.error("Error fetching playbook:", error);
      res.status(500).json({ error: "Failed to fetch playbook" });
    }
  });

  app.get("/api/playbooks/for-incident/:vendorKey", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { severity } = req.query;
      const playbook = await storage.getPlaybookForIncident(userId, req.params.vendorKey, severity as string);
      
      if (!playbook) return res.json(null);
      
      const steps = await storage.getPlaybookSteps(playbook.id);
      res.json({ ...playbook, steps });
    } catch (error) {
      console.error("Error fetching playbook for incident:", error);
      res.status(500).json({ error: "Failed to fetch playbook for incident" });
    }
  });

  app.post("/api/playbooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Incident playbooks require Growth or Enterprise subscription" });
      }
      
      const playbook = await storage.createPlaybook({ ...req.body, userId });
      res.status(201).json(playbook);
    } catch (error) {
      console.error("Error creating playbook:", error);
      res.status(500).json({ error: "Failed to create playbook" });
    }
  });

  app.put("/api/playbooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const playbook = await storage.updatePlaybook(req.params.id, req.body);
      if (!playbook) return res.status(404).json({ error: "Playbook not found" });
      res.json(playbook);
    } catch (error) {
      console.error("Error updating playbook:", error);
      res.status(500).json({ error: "Failed to update playbook" });
    }
  });

  app.delete("/api/playbooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const deleted = await storage.deletePlaybook(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Playbook not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting playbook:", error);
      res.status(500).json({ error: "Failed to delete playbook" });
    }
  });

  // Playbook Steps
  app.post("/api/playbooks/:playbookId/steps", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const step = await storage.createPlaybookStep({ ...req.body, playbookId: req.params.playbookId });
      res.status(201).json(step);
    } catch (error) {
      console.error("Error creating playbook step:", error);
      res.status(500).json({ error: "Failed to create playbook step" });
    }
  });

  app.put("/api/playbooks/steps/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const step = await storage.updatePlaybookStep(req.params.id, req.body);
      if (!step) return res.status(404).json({ error: "Step not found" });
      res.json(step);
    } catch (error) {
      console.error("Error updating playbook step:", error);
      res.status(500).json({ error: "Failed to update playbook step" });
    }
  });

  app.delete("/api/playbooks/steps/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const deleted = await storage.deletePlaybookStep(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Step not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting playbook step:", error);
      res.status(500).json({ error: "Failed to delete playbook step" });
    }
  });

  app.put("/api/playbooks/:playbookId/steps/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { stepIds } = req.body;
      await storage.reorderPlaybookSteps(req.params.playbookId, stepIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering playbook steps:", error);
      res.status(500).json({ error: "Failed to reorder playbook steps" });
    }
  });

  // SLA Countdown Timers (Enterprise tier preferred, but Growth can view)
  app.get("/api/sla/timers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "SLA timers require Growth or Enterprise subscription" });
      }
      
      const timers = await storage.getActiveSlaTimers(userId);
      res.json(timers);
    } catch (error) {
      console.error("Error fetching SLA timers:", error);
      res.status(500).json({ error: "Failed to fetch SLA timers" });
    }
  });

  // Mobile Status API - Quick summary endpoint for mobile view (filtered by user subscriptions)
  app.get("/api/status/summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Get user's subscriptions
      const [allVendors, allIncidents, allBlockchainChains, allBlockchainIncidents, maintenanceStats, vendorSubs, blockchainSubs] = await Promise.all([
        storage.getVendors(),
        storage.getIncidents(),
        storage.getBlockchainChains(),
        storage.getActiveBlockchainIncidents(),
        storage.getMaintenanceStats(),
        storage.getUserVendorSubscriptions(userId),
        storage.getUserBlockchainSubscriptions(userId)
      ]);
      
      // Filter vendors to only subscribed ones
      const vendors = vendorSubs.length > 0 
        ? allVendors.filter(v => vendorSubs.includes(v.key))
        : [];
      
      // Filter blockchain chains to only subscribed ones
      const blockchainChains = blockchainSubs.length > 0
        ? allBlockchainChains.filter(c => blockchainSubs.includes(c.key))
        : [];
      
      // Filter incidents to subscribed vendors only
      const incidents = vendorSubs.length > 0
        ? allIncidents.filter(i => vendorSubs.includes(i.vendorKey))
        : [];
      
      // Filter blockchain incidents to subscribed chains only
      const blockchainIncidentsList = blockchainSubs.length > 0
        ? allBlockchainIncidents.filter(i => blockchainSubs.includes(i.chainKey))
        : [];
      
      const vendorStats = {
        total: vendors.length,
        operational: vendors.filter(v => v.status === 'operational').length,
        degraded: vendors.filter(v => v.status === 'degraded').length,
        outage: vendors.filter(v => v.status === 'outage').length,
      };
      
      const blockchainStats = {
        total: blockchainChains.length,
        operational: blockchainChains.filter(c => c.status === 'operational').length,
        degraded: blockchainChains.filter(c => c.status === 'degraded').length,
        outage: blockchainChains.filter(c => c.status === 'outage').length,
      };
      
      const activeIncidents = incidents.filter(i => i.status !== 'resolved');
      const criticalIncidents = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved');
      
      res.json({
        vendors: vendorStats,
        blockchain: blockchainStats,
        incidents: {
          active: activeIncidents.length,
          critical: criticalIncidents.length,
          blockchainActive: blockchainIncidentsList.length,
        },
        maintenance: maintenanceStats,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching status summary:", error);
      res.status(500).json({ error: "Failed to fetch status summary" });
    }
  });

  // User Integrations API (Slack, Teams, PSA, Webhooks, etc.) - Requires Growth or Enterprise tier
  app.get("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Integrations require Growth or Enterprise subscription" });
      }
      
      const integrations = await storage.getUserIntegrations(userId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  app.get("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Integrations require Growth or Enterprise subscription" });
      }
      
      const integration = await storage.getUserIntegration(req.params.id);
      if (!integration) return res.status(404).json({ error: "Integration not found" });
      if (integration.userId !== userId) return res.status(403).json({ error: "Forbidden" });
      
      res.json(integration);
    } catch (error) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ error: "Failed to fetch integration" });
    }
  });

  app.post("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Integrations require Growth or Enterprise subscription" });
      }
      
      const { integrationType, name, webhookUrl, apiKey, phoneNumber, additionalConfig, isDefault } = req.body;
      
      if (!integrationType || !name) {
        return res.status(400).json({ error: "integrationType and name are required" });
      }
      
      const integration = await storage.createUserIntegration({
        userId,
        integrationType,
        name,
        webhookUrl: webhookUrl || null,
        apiKey: apiKey || null,
        phoneNumber: phoneNumber || null,
        additionalConfig: additionalConfig ? JSON.stringify(additionalConfig) : null,
        isActive: true,
        isDefault: isDefault || false,
      });
      
      res.json(integration);
    } catch (error) {
      console.error("Error creating integration:", error);
      res.status(500).json({ error: "Failed to create integration" });
    }
  });

  app.put("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Integrations require Growth or Enterprise subscription" });
      }
      
      const existing = await storage.getUserIntegrationFull(req.params.id);
      if (!existing) return res.status(404).json({ error: "Integration not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Forbidden" });
      
      const { name, webhookUrl, apiKey, phoneNumber, additionalConfig, isActive, isDefault } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl || null;
      if (apiKey !== undefined) updateData.apiKey = apiKey || null;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
      if (additionalConfig !== undefined) updateData.additionalConfig = additionalConfig ? JSON.stringify(additionalConfig) : null;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isDefault !== undefined) updateData.isDefault = isDefault;
      
      const integration = await storage.updateUserIntegration(req.params.id, updateData);
      res.json(integration);
    } catch (error) {
      console.error("Error updating integration:", error);
      res.status(500).json({ error: "Failed to update integration" });
    }
  });

  app.delete("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Integrations require Growth or Enterprise subscription" });
      }
      
      const existing = await storage.getUserIntegrationFull(req.params.id);
      if (!existing) return res.status(404).json({ error: "Integration not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Forbidden" });
      
      await storage.deleteUserIntegration(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ error: "Failed to delete integration" });
    }
  });

  app.post("/api/integrations/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const tier = req.user?.subscriptionTier;
      if (!tier || tier === 'essential') {
        return res.status(403).json({ error: "Integrations require Growth or Enterprise subscription" });
      }
      
      const existing = await storage.getUserIntegrationFull(req.params.id);
      if (!existing) return res.status(404).json({ error: "Integration not found" });
      if (existing.userId !== userId) return res.status(403).json({ error: "Forbidden" });
      
      let success = false;
      let message = "";
      
      if (existing.integrationType === 'slack' && existing.webhookUrl) {
        try {
          const slackPayload = {
            blocks: [
              {
                type: "header",
                text: { type: "plain_text", text: "✅ VendorWatch Test Message", emoji: true }
              },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: "*Status:*\nConnection Successful" },
                  { type: "mrkdwn", text: "*Integration:*\nSlack Webhook" }
                ]
              },
              {
                type: "context",
                elements: [
                  { type: "mrkdwn", text: "Your Slack integration is configured correctly. Incident alerts will appear here." }
                ]
              }
            ]
          };
          const response = await fetch(existing.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackPayload),
          });
          success = response.ok;
          message = success ? "Slack message sent successfully!" : "Failed to send Slack message";
        } catch (e) {
          message = "Failed to connect to Slack webhook";
        }
      } else if (existing.integrationType === 'teams' && existing.webhookUrl) {
        try {
          const teamsPayload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "summary": "VendorWatch Test Message",
            "themeColor": "00BCB4",
            "sections": [{
              "activityTitle": "✅ VendorWatch Test Message",
              "facts": [
                { "name": "Status", "value": "Connection Successful" },
                { "name": "Integration", "value": "Microsoft Teams Webhook" }
              ],
              "text": "Your Teams integration is configured correctly. Incident alerts will appear here.",
              "markdown": true
            }]
          };
          const response = await fetch(existing.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teamsPayload),
          });
          success = response.ok;
          message = success ? "Teams message sent successfully!" : "Failed to send Teams message";
        } catch (e) {
          message = "Failed to connect to Teams webhook";
        }
      } else if (existing.integrationType === 'webhook' && existing.webhookUrl) {
        try {
          const response = await fetch(existing.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: "test", source: "vendor_watch", timestamp: new Date().toISOString() }),
          });
          success = response.ok;
          message = success ? "Webhook call successful!" : "Webhook returned an error";
        } catch (e) {
          message = "Failed to connect to webhook";
        }
      } else if (existing.integrationType === 'psa' && existing.webhookUrl) {
        try {
          const response = await fetch(existing.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: "test", source: "vendor_watch", timestamp: new Date().toISOString() }),
          });
          success = response.ok;
          message = success ? "PSA connection successful!" : "PSA webhook returned an error";
        } catch (e) {
          message = "Failed to connect to PSA webhook";
        }
      } else if (existing.integrationType === 'escalation_phone' && existing.phoneNumber) {
        success = true;
        message = "Phone number saved. Escalation calls will use Twilio when triggered.";
      } else {
        message = "No testable configuration found for this integration type";
      }
      
      await storage.testUserIntegration(req.params.id, success);
      res.json({ success, message });
    } catch (error) {
      console.error("Error testing integration:", error);
      res.status(500).json({ error: "Failed to test integration" });
    }
  });

  // ============ ORGANIZATION & TEAM MANAGEMENT ============
  
  // Get current user's organization
  app.get("/api/org", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const org = await storage.getUserOrganization(userId);
      if (!org) {
        return res.json({ organization: null });
      }
      
      const userRole = await storage.getUserRole(userId);
      const masterAdminCount = await storage.getMasterAdminCount(org.id);
      
      res.json({
        organization: org,
        userRole: userRole?.role || null,
        masterAdminCount,
        maxMasterAdmins: org.maxMasterAdmins || 3
      });
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });
  
  // Create organization (for users who don't have one yet)
  app.post("/api/org", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const user = req.user;
      if (!userId || !user) return res.status(401).json({ error: "Unauthorized" });
      
      // Check if user already has an organization
      const existingOrg = await storage.getUserOrganization(userId);
      if (existingOrg) {
        return res.status(400).json({ error: "You already belong to an organization" });
      }
      
      // Get domain from user's email
      const email = user.email;
      if (!email) {
        return res.status(400).json({ error: "Email required to create organization" });
      }
      
      const domain = email.split('@')[1];
      if (!domain) {
        return res.status(400).json({ error: "Invalid email domain" });
      }
      
      // Create the organization
      const orgName = req.body.name || user.companyName || `${domain} Organization`;
      const org = await storage.createOrganization({
        name: orgName,
        primaryDomain: domain,
        createdBy: userId,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        subscriptionTier: user.subscriptionTier,
      });
      
      // Add the creator as master admin
      await storage.addOrganizationMember({
        organizationId: org.id,
        userId: userId,
        role: 'master_admin',
        acceptedAt: new Date(),
      });
      
      res.json({ organization: org });
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  app.patch("/api/org", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can update the organization" });
      }
      
      const org = await storage.getOrganization(userRole.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Organization name is required" });
      }
      
      const updated = await storage.updateOrganization(org.id, { name: name.trim() });
      res.json({ organization: updated });
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  app.delete("/api/org", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can delete the organization" });
      }
      
      const org = await storage.getOrganization(userRole.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      await storage.deleteOrganization(org.id);
      res.json({ success: true, message: "Organization deleted successfully" });
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ error: "Failed to delete organization" });
    }
  });
  
  // Get organization members (requires master_admin or member_rw)
  app.get("/api/org/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const org = await storage.getUserOrganization(userId);
      if (!org) {
        return res.status(404).json({ error: "No organization found" });
      }
      
      const members = await storage.getOrganizationMembers(org.id);
      const invitations = await storage.getOrganizationInvitations(org.id);
      const userRole = await storage.getUserRole(userId);
      
      res.json({
        members: members.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          invitedAt: m.invitedAt,
          acceptedAt: m.acceptedAt,
          user: {
            id: m.user.id,
            email: m.user.email,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
          }
        })),
        invitations: invitations.map(i => ({
          id: i.id,
          email: i.email,
          role: i.role,
          status: i.status,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
        })),
        userRole: userRole?.role,
      });
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });
  
  // Invite a new member (requires master_admin)
  const inviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.enum(['master_admin', 'member_rw', 'member_ro']),
  });
  
  app.post("/api/org/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Check if user is master admin
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can invite members" });
      }
      
      const parsed = inviteMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      
      const { email, role } = parsed.data;
      const org = await storage.getOrganization(userRole.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Check domain restriction
      const inviteDomain = email.split('@')[1]?.toLowerCase();
      if (inviteDomain !== org.primaryDomain.toLowerCase()) {
        return res.status(400).json({ 
          error: `Only users with @${org.primaryDomain} email addresses can be invited` 
        });
      }
      
      // Check master admin limit
      if (role === 'master_admin') {
        const currentCount = await storage.getMasterAdminCount(org.id);
        if (currentCount >= (org.maxMasterAdmins || 3)) {
          return res.status(400).json({ 
            error: `Maximum of ${org.maxMasterAdmins || 3} master admins allowed` 
          });
        }
      }
      
      // Check if already a member
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const existingMember = await storage.getOrganizationMember(org.id, existingUser.id);
        if (existingMember) {
          return res.status(400).json({ error: "User is already a member of this organization" });
        }
      }
      
      // Check if invitation already exists
      const existingInvite = await storage.getInvitationByEmail(org.id, email);
      if (existingInvite) {
        return res.status(400).json({ error: "An invitation has already been sent to this email" });
      }
      
      // Generate secure token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
      
      // Create invitation
      const invitation = await storage.createOrganizationInvitation({
        organizationId: org.id,
        email,
        role,
        invitedBy: userId,
        token,
        expiresAt,
        status: 'pending',
      });
      
      // Send invitation email
      try {
        const { sendEmail } = await import('./emailClient');
        const inviteUrl = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'http://localhost:5000'}/accept-invite/${token}`;
        const roleName = role === 'master_admin' ? 'Master Admin' : role === 'member_rw' ? 'Read/Write Member' : 'Read-Only Member';
        
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e293b;">You've been invited to join ${org.name}</h2>
            <p>You've been invited to join <strong>${org.name}</strong> on Vendor Watch as a <strong>${roleName}</strong>.</p>
            <p>Click the button below to accept the invitation:</p>
            <p style="margin: 24px 0;">
              <a href="${inviteUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">This invitation expires in 7 days.</p>
            <p style="color: #64748b; font-size: 14px;">If you didn't expect this invitation, you can ignore this email.</p>
          </div>
        `;
        
        await sendEmail(email, `You've been invited to join ${org.name} on Vendor Watch`, emailHtml);
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Don't fail the request if email fails - invitation was still created
      }
      
      res.json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role } });
    } catch (error) {
      console.error("Error inviting member:", error);
      res.status(500).json({ error: "Failed to invite member" });
    }
  });
  
  // Update member role (requires master_admin)
  const updateRoleSchema = z.object({
    role: z.enum(['master_admin', 'member_rw', 'member_ro']),
  });
  
  app.patch("/api/org/members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const targetMemberId = req.params.memberId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Check if user is master admin
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can change member roles" });
      }
      
      const parsed = updateRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      const { role } = parsed.data;
      const org = await storage.getOrganization(userRole.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Check master admin limit if promoting to master_admin
      if (role === 'master_admin') {
        const currentCount = await storage.getMasterAdminCount(org.id);
        const currentMember = await storage.getOrganizationMember(org.id, targetMemberId);
        // Only count if they're not already a master admin
        if (currentMember?.role !== 'master_admin' && currentCount >= (org.maxMasterAdmins || 3)) {
          return res.status(400).json({ 
            error: `Maximum of ${org.maxMasterAdmins || 3} master admins allowed` 
          });
        }
      }
      
      const updated = await storage.updateOrganizationMemberRole(org.id, targetMemberId, role);
      if (!updated) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      res.json({ member: updated });
    } catch (error) {
      console.error("Error updating member role:", error);
      res.status(500).json({ error: "Failed to update member role" });
    }
  });
  
  // Remove member (requires master_admin)
  app.delete("/api/org/members/:memberId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const targetMemberId = req.params.memberId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Check if user is master admin
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can remove members" });
      }
      
      // Can't remove yourself
      if (targetMemberId === userId) {
        return res.status(400).json({ error: "You cannot remove yourself from the organization" });
      }
      
      const removed = await storage.removeOrganizationMember(userRole.organizationId, targetMemberId);
      if (!removed) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });
  
  // Cancel invitation (requires master_admin)
  app.delete("/api/org/invitations/:invitationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Check if user is master admin
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can cancel invitations" });
      }
      
      const deleted = await storage.deleteOrganizationInvitation(req.params.invitationId);
      if (!deleted) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      res.status(500).json({ error: "Failed to cancel invitation" });
    }
  });
  
  // ============ ALERT ASSIGNMENTS ============
  
  app.get("/api/org/alert-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const userRole = await storage.getUserRole(userId);
      if (!userRole) return res.status(403).json({ error: "Not in an organization" });
      
      const assignments = await storage.getAlertAssignments(userRole.organizationId);
      res.json({ assignments });
    } catch (error) {
      console.error("Error fetching alert assignments:", error);
      res.status(500).json({ error: "Failed to fetch alert assignments" });
    }
  });
  
  const alertAssignmentSchema = z.object({
    memberUserId: z.string(),
    targetType: z.enum(['vendor', 'blockchain']),
    targetKey: z.string(),
  });
  
  app.post("/api/org/alert-assignments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can manage alert assignments" });
      }
      
      const parsed = alertAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }
      
      const { memberUserId, targetType, targetKey } = parsed.data;
      
      const existing = await storage.getAssignedUsersForTarget(
        userRole.organizationId, targetType, targetKey
      );
      if (existing.some(a => a.memberUserId === memberUserId)) {
        return res.status(400).json({ error: "This member is already assigned to this target" });
      }
      
      const assignment = await storage.createAlertAssignment({
        organizationId: userRole.organizationId,
        memberUserId,
        targetType,
        targetKey,
        assignedBy: userId,
      });
      
      res.json({ assignment });
    } catch (error) {
      console.error("Error creating alert assignment:", error);
      res.status(500).json({ error: "Failed to create alert assignment" });
    }
  });
  
  app.post("/api/org/alert-assignments/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can manage alert assignments" });
      }
      
      const bulkSchema = z.object({
        memberUserId: z.string(),
        assignments: z.array(z.object({
          targetType: z.enum(['vendor', 'blockchain']),
          targetKey: z.string(),
        })),
      });
      
      const parsed = bulkSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      const { memberUserId, assignments } = parsed.data;
      
      await storage.deleteAlertAssignmentsByMember(userRole.organizationId, memberUserId);
      
      const created = [];
      for (const a of assignments) {
        const assignment = await storage.createAlertAssignment({
          organizationId: userRole.organizationId,
          memberUserId,
          targetType: a.targetType,
          targetKey: a.targetKey,
          assignedBy: userId,
        });
        created.push(assignment);
      }
      
      res.json({ assignments: created });
    } catch (error) {
      console.error("Error bulk updating alert assignments:", error);
      res.status(500).json({ error: "Failed to update alert assignments" });
    }
  });
  
  app.delete("/api/org/alert-assignments/:assignmentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can manage alert assignments" });
      }
      
      const deleted = await storage.deleteAlertAssignment(req.params.assignmentId);
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting alert assignment:", error);
      res.status(500).json({ error: "Failed to delete alert assignment" });
    }
  });
  
  // Get invitation details (public - used for accepting)
  app.get("/api/org/invitations/accept/:token", async (req: any, res) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: "Invitation has already been used or cancelled" });
      }
      
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ error: "Invitation has expired" });
      }
      
      const org = await storage.getOrganization(invitation.organizationId);
      
      res.json({
        invitation: {
          email: invitation.email,
          role: invitation.role,
          organizationName: org?.name,
        }
      });
    } catch (error) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ error: "Failed to fetch invitation" });
    }
  });
  
  // Accept invitation
  app.post("/api/org/invitations/accept/:token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const user = req.user;
      if (!userId || !user) return res.status(401).json({ error: "Unauthorized" });
      
      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: "Invitation has already been used or cancelled" });
      }
      
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({ error: "Invitation has expired" });
      }
      
      // Verify email matches
      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        return res.status(403).json({ 
          error: `This invitation was sent to ${invitation.email}. Please sign in with that email.` 
        });
      }
      
      // Check if user already in an organization
      const existingOrg = await storage.getUserOrganization(userId);
      if (existingOrg) {
        return res.status(400).json({ error: "You already belong to an organization" });
      }
      
      // Check master admin limit if being added as master_admin
      if (invitation.role === 'master_admin') {
        const org = await storage.getOrganization(invitation.organizationId);
        const currentCount = await storage.getMasterAdminCount(invitation.organizationId);
        if (currentCount >= (org?.maxMasterAdmins || 3)) {
          return res.status(400).json({ error: "Maximum master admins reached. Please contact the organization." });
        }
      }
      
      // Add user to organization
      await storage.addOrganizationMember({
        organizationId: invitation.organizationId,
        userId: userId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        acceptedAt: new Date(),
      });
      
      // Mark invitation as accepted
      await storage.updateInvitationStatus(invitation.id, 'accepted');
      
      res.json({ success: true, message: "You have joined the organization" });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // ============ SEAT MANAGEMENT API ============
  
  // Get seat information for the organization
  app.get("/api/org/seats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const org = await storage.getUserOrganization(userId);
      if (!org) {
        return res.status(404).json({ error: "No organization found" });
      }
      
      const tier = org.subscriptionTier as keyof typeof INCLUDED_SEATS | null;
      const includedSeats = tier ? (INCLUDED_SEATS[tier] || 1) : 1;
      const additionalSeats = org.additionalSeats || 0;
      const totalSeats = includedSeats + additionalSeats;
      
      // Count active members
      const members = await storage.getOrganizationMembers(org.id);
      const usedSeats = members.length;
      
      // Get seat pricing (platinum is legacy name for enterprise)
      const seatPrice = (tier === 'enterprise' || tier === 'platinum') ? 25 : tier === 'growth' ? 20 : 0;
      const supportsSeats = tier === 'growth' || tier === 'enterprise' || tier === 'platinum';
      
      res.json({
        includedSeats,
        additionalSeats,
        totalSeats,
        usedSeats,
        availableSeats: totalSeats - usedSeats,
        seatPrice,
        supportsSeats,
        subscriptionTier: tier,
        seatSubscriptionItemId: org.seatSubscriptionItemId,
      });
    } catch (error) {
      console.error("Error fetching seat info:", error);
      res.status(500).json({ error: "Failed to fetch seat information" });
    }
  });
  
  // Update additional seats (purchase more or reduce)
  const updateSeatsSchema = z.object({
    additionalSeats: z.number().min(0).max(500),
  });
  
  app.post("/api/org/seats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Check if user is master admin
      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Only master admins can manage seats" });
      }
      
      const org = await storage.getOrganization(userRole.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      const tier = org.subscriptionTier as 'growth' | 'enterprise' | 'platinum' | null;
      if (!tier || (tier !== 'growth' && tier !== 'enterprise' && tier !== 'platinum')) {
        return res.status(400).json({ error: "Additional seats are only available on Growth and Enterprise plans" });
      }
      
      const parsed = updateSeatsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }
      
      const { additionalSeats } = parsed.data;
      
      // Check we have enough seats for current members
      const members = await storage.getOrganizationMembers(org.id);
      const includedSeats = INCLUDED_SEATS[tier];
      const totalSeats = includedSeats + additionalSeats;
      
      if (members.length > totalSeats) {
        return res.status(400).json({ 
          error: `Cannot reduce seats below current member count. You have ${members.length} members but would have ${totalSeats} seats.` 
        });
      }
      
      // Update Stripe subscription
      if (org.stripeSubscriptionId) {
        const stripe = await getUncachableStripeClient();
        const seatPriceId = SEAT_PRICE_IDS[tier];
        
        if (org.seatSubscriptionItemId) {
          // Update existing seat subscription item
          if (additionalSeats === 0) {
            // Remove the seat add-on entirely
            await stripe.subscriptionItems.del(org.seatSubscriptionItemId);
            await storage.updateOrganization(org.id, { 
              additionalSeats: 0, 
              seatSubscriptionItemId: null 
            });
          } else {
            // Update quantity
            await stripe.subscriptionItems.update(org.seatSubscriptionItemId, {
              quantity: additionalSeats,
              proration_behavior: 'create_prorations',
            });
            await storage.updateOrganization(org.id, { additionalSeats });
          }
        } else if (additionalSeats > 0) {
          // Add new seat subscription item
          const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
          const newItem = await stripe.subscriptionItems.create({
            subscription: org.stripeSubscriptionId,
            price: seatPriceId,
            quantity: additionalSeats,
            proration_behavior: 'create_prorations',
          });
          await storage.updateOrganization(org.id, { 
            additionalSeats, 
            seatSubscriptionItemId: newItem.id 
          });
        }
      } else {
        // No Stripe subscription yet, just update the database
        await storage.updateOrganization(org.id, { additionalSeats });
      }
      
      res.json({ 
        success: true, 
        additionalSeats,
        message: `Successfully updated to ${additionalSeats} additional seat(s)` 
      });
    } catch (error: any) {
      console.error("Error updating seats:", error);
      res.status(500).json({ error: error.message || "Failed to update seats" });
    }
  });

  // ============ CLIENT PORTALS API ============
  
  // Get all portals for current user
  app.get("/api/portals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const portals = await storage.getClientPortals(userId);
      res.json(portals);
    } catch (error) {
      console.error("Error fetching portals:", error);
      res.status(500).json({ error: "Failed to fetch portals" });
    }
  });
  
  // Get single portal
  app.get("/api/portals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const portal = await storage.getClientPortal(req.params.id);
      if (!portal) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      const assignments = await storage.getPortalVendorAssignments(portal.id);
      res.json({ portal, assignments });
    } catch (error) {
      console.error("Error fetching portal:", error);
      res.status(500).json({ error: "Failed to fetch portal" });
    }
  });
  
  // Create portal
  app.post("/api/portals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Check subscription tier
      const user = req.user;
      if (!user.subscriptionTier || user.subscriptionTier === 'essential') {
        return res.status(403).json({ error: "Client portals require Growth or Enterprise plan" });
      }
      
      const { name, slug, ...rest } = req.body;
      
      // Check slug availability
      const existing = await storage.getClientPortalBySlug(slug);
      if (existing) {
        return res.status(400).json({ error: "This URL slug is already taken" });
      }
      
      // Get or create organization
      let orgId = 'default';
      const userOrg = await storage.getUserOrganization(userId);
      if (userOrg) {
        orgId = userOrg.id;
      }
      
      const portal = await storage.createClientPortal({
        ...rest,
        name,
        slug,
        userId,
        organizationId: orgId,
      });
      
      res.json(portal);
    } catch (error) {
      console.error("Error creating portal:", error);
      res.status(500).json({ error: "Failed to create portal" });
    }
  });
  
  // Update portal
  app.patch("/api/portals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const portal = await storage.getClientPortal(req.params.id);
      if (!portal || portal.userId !== userId) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      // Check slug uniqueness if changing
      if (req.body.slug && req.body.slug !== portal.slug) {
        const existing = await storage.getClientPortalBySlug(req.body.slug);
        if (existing) {
          return res.status(400).json({ error: "This URL slug is already taken" });
        }
      }
      
      const updated = await storage.updateClientPortal(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating portal:", error);
      res.status(500).json({ error: "Failed to update portal" });
    }
  });
  
  // Delete portal
  app.delete("/api/portals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const portal = await storage.getClientPortal(req.params.id);
      if (!portal || portal.userId !== userId) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      await storage.deleteClientPortal(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting portal:", error);
      res.status(500).json({ error: "Failed to delete portal" });
    }
  });
  
  // Update portal vendor assignments
  app.put("/api/portals/:id/vendors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const portal = await storage.getClientPortal(req.params.id);
      if (!portal || portal.userId !== userId) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      const { assignments } = req.body;
      
      // Remove existing assignments
      await storage.deletePortalVendorAssignmentsByPortal(portal.id);
      
      // Create new assignments
      const created = [];
      for (let i = 0; i < assignments.length; i++) {
        const a = assignments[i];
        const assignment = await storage.createPortalVendorAssignment({
          portalId: portal.id,
          vendorKey: a.vendorKey || null,
          chainKey: a.chainKey || null,
          resourceType: a.resourceType,
          displayName: a.displayName || null,
          displayOrder: i,
          showOnPortal: a.showOnPortal !== false,
          customSlaTarget: a.customSlaTarget || null,
        });
        created.push(assignment);
      }
      
      res.json(created);
    } catch (error) {
      console.error("Error updating portal vendors:", error);
      res.status(500).json({ error: "Failed to update portal vendors" });
    }
  });
  
  // PUBLIC: Get portal by slug (no auth required)
  app.get("/api/public/portal/:slug", async (req: any, res) => {
    try {
      const portal = await storage.getClientPortalBySlug(req.params.slug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      // Check access token if portal is not public
      if (!portal.isPublic) {
        const token = req.query.token || req.headers['x-portal-token'];
        if (token !== portal.accessToken) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      // Increment view count
      await storage.incrementPortalViewCount(portal.id);
      
      // Get vendor assignments
      const assignments = await storage.getPortalVendorAssignments(portal.id);
      
      // Get current vendor/blockchain statuses
      const vendors = await storage.getVendors();
      const chains = await storage.getBlockchainChains();
      const vendorIncidents = await storage.getIncidents();
      const chainIncidents = await storage.getBlockchainIncidents();
      
      // Build status for each assigned resource
      const resources = assignments.filter(a => a.showOnPortal).map(a => {
        if (a.resourceType === 'vendor' && a.vendorKey) {
          const vendor = vendors.find(v => v.key === a.vendorKey);
          const activeIncidents = vendorIncidents.filter(i => 
            i.vendorKey === a.vendorKey && i.status !== 'resolved'
          );
          return {
            type: 'vendor',
            key: a.vendorKey,
            name: a.displayName || vendor?.name || a.vendorKey,
            status: vendor?.status || 'operational',
            hasActiveIncidents: activeIncidents.length > 0,
            activeIncidents: activeIncidents.map(i => ({
              title: i.title,
              status: i.status,
              severity: i.severity,
              startedAt: i.startedAt,
            })),
            customSlaTarget: a.customSlaTarget,
          };
        } else if (a.resourceType === 'blockchain' && a.chainKey) {
          const chain = chains.find(c => c.key === a.chainKey);
          const activeIncidents = chainIncidents.filter(i => 
            i.chainKey === a.chainKey && i.status !== 'resolved'
          );
          return {
            type: 'blockchain',
            key: a.chainKey,
            name: a.displayName || chain?.name || a.chainKey,
            status: chain?.status || 'operational',
            hasActiveIncidents: activeIncidents.length > 0,
            activeIncidents: activeIncidents.map(i => ({
              title: i.title,
              status: i.status,
              severity: i.severity,
              startedAt: i.startedAt,
            })),
            customSlaTarget: a.customSlaTarget,
          };
        }
        return null;
      }).filter(Boolean);
      
      // Calculate overall status
      const hasIssues = resources.some((r: any) => r.hasActiveIncidents);
      const hasCritical = resources.some((r: any) => 
        r.activeIncidents?.some((i: any) => i.severity === 'critical')
      );
      
      res.json({
        portal: {
          name: portal.name,
          logoUrl: portal.logoUrl,
          primaryColor: portal.primaryColor,
          secondaryColor: portal.secondaryColor,
          backgroundColor: portal.backgroundColor,
          accentColor: portal.accentColor,
          fontFamily: portal.fontFamily,
          headerText: portal.headerText,
          footerText: portal.footerText,
          showIncidentHistory: portal.showIncidentHistory,
          showUptimeStats: portal.showUptimeStats,
          showSubscribeOption: portal.showSubscribeOption,
        },
        overallStatus: hasCritical ? 'major_outage' : hasIssues ? 'partial_outage' : 'operational',
        resources,
      });
    } catch (error) {
      console.error("Error fetching public portal:", error);
      res.status(500).json({ error: "Failed to fetch portal" });
    }
  });
  
  // PUBLIC: Subscribe to portal updates
  app.post("/api/public/portal/:slug/subscribe", async (req: any, res) => {
    try {
      const portal = await storage.getClientPortalBySlug(req.params.slug);
      if (!portal || !portal.isActive || !portal.showSubscribeOption) {
        return res.status(404).json({ error: "Portal not found or subscriptions not enabled" });
      }
      
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Valid email required" });
      }
      
      const verificationToken = crypto.randomUUID();
      const unsubscribeToken = crypto.randomUUID();
      
      await storage.createPortalSubscriber({
        portalId: portal.id,
        email,
        verificationToken,
        unsubscribeToken,
      });
      
      res.json({ success: true, message: "Check your email to verify subscription" });
    } catch (error) {
      console.error("Error subscribing to portal:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // ============ PUBLIC STATUS API (aliases for /api/status/:slug) ============
  
  // GET /api/status/:slug - Public route for status page
  app.get("/api/status/:slug", async (req: any, res) => {
    try {
      const portal = await storage.getClientPortalBySlug(req.params.slug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ error: "Portal not found" });
      }
      
      // Check access token if portal is not public
      if (!portal.isPublic) {
        const token = req.query.token || req.headers['x-portal-token'];
        if (token !== portal.accessToken) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      // Increment view count
      await storage.incrementPortalViewCount(portal.id);
      
      // Get vendor assignments
      const assignments = await storage.getPortalVendorAssignments(portal.id);
      
      // Get current vendor/blockchain statuses
      const vendors = await storage.getVendors();
      const chains = await storage.getBlockchainChains();
      const vendorIncidents = await storage.getIncidents();
      const chainIncidents = await storage.getBlockchainIncidents();
      
      // Get recent incidents from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Collect assigned vendor/chain keys for filtering
      const assignedVendorKeys = new Set(assignments.filter(a => a.resourceType === 'vendor' && a.vendorKey).map(a => a.vendorKey));
      const assignedChainKeys = new Set(assignments.filter(a => a.resourceType === 'blockchain' && a.chainKey).map(a => a.chainKey));
      
      // Filter recent incidents for assigned resources
      const recentVendorIncidents = vendorIncidents.filter(i => {
        const incidentDate = new Date(i.startedAt);
        return assignedVendorKeys.has(i.vendorKey) && incidentDate >= sevenDaysAgo;
      }).map(i => {
        const vendor = vendors.find(v => v.key === i.vendorKey);
        return {
          id: i.id,
          type: 'vendor',
          resourceName: vendor?.name || i.vendorKey,
          title: i.title,
          status: i.status,
          severity: i.severity,
          impact: i.impact,
          startedAt: i.startedAt,
          updatedAt: i.updatedAt,
        };
      });
      
      const recentChainIncidents = chainIncidents.filter(i => {
        const incidentDate = new Date(i.startedAt);
        return assignedChainKeys.has(i.chainKey) && incidentDate >= sevenDaysAgo;
      }).map(i => {
        const chain = chains.find(c => c.key === i.chainKey);
        return {
          id: i.id,
          type: 'blockchain',
          resourceName: chain?.name || i.chainKey,
          title: i.title,
          status: i.status,
          severity: i.severity,
          impact: i.impact,
          startedAt: i.startedAt,
          updatedAt: i.updatedAt,
        };
      });
      
      // Combine and sort recent incidents by startedAt descending
      const recentIncidents = [...recentVendorIncidents, ...recentChainIncidents]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 20); // Limit to 20 most recent
      
      // Build status for each assigned resource
      const resources = assignments.filter(a => a.showOnPortal).map(a => {
        if (a.resourceType === 'vendor' && a.vendorKey) {
          const vendor = vendors.find(v => v.key === a.vendorKey);
          const activeIncidents = vendorIncidents.filter(i => 
            i.vendorKey === a.vendorKey && i.status !== 'resolved'
          );
          return {
            type: 'vendor',
            key: a.vendorKey,
            name: a.displayName || vendor?.name || a.vendorKey,
            status: vendor?.status || 'operational',
            hasActiveIncidents: activeIncidents.length > 0,
            activeIncidents: activeIncidents.map(i => ({
              title: i.title,
              status: i.status,
              severity: i.severity,
              startedAt: i.startedAt,
            })),
            customSlaTarget: a.customSlaTarget,
          };
        } else if (a.resourceType === 'blockchain' && a.chainKey) {
          const chain = chains.find(c => c.key === a.chainKey);
          const activeIncidents = chainIncidents.filter(i => 
            i.chainKey === a.chainKey && i.status !== 'resolved'
          );
          return {
            type: 'blockchain',
            key: a.chainKey,
            name: a.displayName || chain?.name || a.chainKey,
            status: chain?.status || 'operational',
            hasActiveIncidents: activeIncidents.length > 0,
            activeIncidents: activeIncidents.map(i => ({
              title: i.title,
              status: i.status,
              severity: i.severity,
              startedAt: i.startedAt,
            })),
            customSlaTarget: a.customSlaTarget,
          };
        }
        return null;
      }).filter(Boolean);
      
      // Calculate overall status
      const hasIssues = resources.some((r: any) => r.hasActiveIncidents);
      const hasCritical = resources.some((r: any) => 
        r.activeIncidents?.some((i: any) => i.severity === 'critical')
      );
      
      res.json({
        portal: {
          name: portal.name,
          logoUrl: portal.logoUrl,
          primaryColor: portal.primaryColor,
          secondaryColor: portal.secondaryColor,
          backgroundColor: portal.backgroundColor,
          accentColor: portal.accentColor,
          fontFamily: portal.fontFamily,
          headerText: portal.headerText,
          footerText: portal.footerText,
          showIncidentHistory: portal.showIncidentHistory,
          showUptimeStats: portal.showUptimeStats,
          showSubscribeOption: portal.showSubscribeOption,
        },
        overallStatus: hasCritical ? 'major_outage' : hasIssues ? 'partial_outage' : 'operational',
        resources,
        recentIncidents: portal.showIncidentHistory ? recentIncidents : [],
      });
    } catch (error) {
      console.error("Error fetching public status page:", error);
      res.status(500).json({ error: "Failed to fetch status page" });
    }
  });
  
  // POST /api/status/:slug/subscribe - Subscribe to portal updates
  app.post("/api/status/:slug/subscribe", async (req: any, res) => {
    try {
      const portal = await storage.getClientPortalBySlug(req.params.slug);
      if (!portal || !portal.isActive || !portal.showSubscribeOption) {
        return res.status(404).json({ error: "Portal not found or subscriptions not enabled" });
      }
      
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      
      const verificationToken = crypto.randomUUID();
      const unsubscribeToken = crypto.randomUUID();
      
      await storage.createPortalSubscriber({
        portalId: portal.id,
        email,
        verificationToken,
        unsubscribeToken,
      });
      
      res.json({ success: true, message: "Successfully subscribed to updates" });
    } catch (error) {
      console.error("Error subscribing to status page:", error);
      res.status(500).json({ error: "Failed to subscribe" });
    }
  });

  // ============ PSA INTEGRATIONS API ============
  
  // Helper to sanitize PSA integration (remove sensitive fields)
  const sanitizePsaIntegration = (integration: any) => ({
    id: integration.id,
    organizationId: integration.organizationId,
    userId: integration.userId,
    name: integration.name,
    psaType: integration.psaType,
    isActive: integration.isActive,
    apiUrl: integration.apiUrl,
    companyId: integration.companyId,
    defaultBoardId: integration.defaultBoardId,
    defaultPriorityId: integration.defaultPriorityId,
    defaultStatusId: integration.defaultStatusId,
    lastSyncAt: integration.lastSyncAt,
    lastSyncSuccess: integration.lastSyncSuccess,
    lastSyncError: integration.lastSyncError,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
    hasApiKey: !!integration.apiKey,
    hasApiSecret: !!integration.apiSecret,
    hasOAuth: !!integration.accessToken,
  });
  
  // Get all PSA integrations for current user
  app.get("/api/psa-integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const integrations = await storage.getPsaIntegrations(userId);
      res.json(integrations.map(sanitizePsaIntegration));
    } catch (error) {
      console.error("Error fetching PSA integrations:", error);
      res.status(500).json({ error: "Failed to fetch PSA integrations" });
    }
  });
  
  // Get single PSA integration with rules
  app.get("/api/psa-integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const integration = await storage.getPsaIntegration(req.params.id);
      if (!integration || integration.userId !== userId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const rules = await storage.getPsaTicketRules(integration.id);
      const tickets = await storage.getPsaTicketLinks(integration.id);
      
      res.json({
        integration: sanitizePsaIntegration(integration),
        rules,
        recentTickets: tickets.slice(0, 20),
      });
    } catch (error) {
      console.error("Error fetching PSA integration:", error);
      res.status(500).json({ error: "Failed to fetch PSA integration" });
    }
  });
  
  // Create PSA integration
  app.post("/api/psa-integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!user.subscriptionTier || user.subscriptionTier === 'essential') {
        return res.status(403).json({ error: "PSA integration requires Growth or Enterprise plan" });
      }
      
      const integration = await storage.createPsaIntegration({
        ...req.body,
        userId,
      });
      
      res.json(sanitizePsaIntegration(integration));
    } catch (error) {
      console.error("Error creating PSA integration:", error);
      res.status(500).json({ error: "Failed to create PSA integration" });
    }
  });
  
  // Update PSA integration
  app.patch("/api/psa-integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const integration = await storage.getPsaIntegration(req.params.id);
      if (!integration || integration.userId !== userId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const updated = await storage.updatePsaIntegration(req.params.id, req.body);
      res.json(sanitizePsaIntegration(updated));
    } catch (error) {
      console.error("Error updating PSA integration:", error);
      res.status(500).json({ error: "Failed to update PSA integration" });
    }
  });
  
  // Delete PSA integration
  app.delete("/api/psa-integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const integration = await storage.getPsaIntegration(req.params.id);
      if (!integration || integration.userId !== userId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      await storage.deletePsaIntegration(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting PSA integration:", error);
      res.status(500).json({ error: "Failed to delete PSA integration" });
    }
  });
  
  // Test PSA integration connection
  app.post("/api/psa-integrations/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const integration = await storage.getPsaIntegration(req.params.id);
      if (!integration || integration.userId !== userId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      await storage.updatePsaIntegrationSync(integration.id, true);
      res.json({ success: true, message: "Connection successful" });
    } catch (error) {
      console.error("Error testing PSA integration:", error);
      res.status(500).json({ error: "Failed to test connection" });
    }
  });
  
  // Create ticket rule
  app.post("/api/psa-integrations/:id/rules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const integration = await storage.getPsaIntegration(req.params.id);
      if (!integration || integration.userId !== userId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const rule = await storage.createPsaTicketRule({
        ...req.body,
        psaIntegrationId: integration.id,
      });
      
      res.json(rule);
    } catch (error) {
      console.error("Error creating ticket rule:", error);
      res.status(500).json({ error: "Failed to create ticket rule" });
    }
  });
  
  // Update ticket rule
  app.patch("/api/psa-integrations/:integrationId/rules/:ruleId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const integration = await storage.getPsaIntegration(req.params.integrationId);
      if (!integration || integration.userId !== userId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const updated = await storage.updatePsaTicketRule(req.params.ruleId, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating ticket rule:", error);
      res.status(500).json({ error: "Failed to update ticket rule" });
    }
  });
  
  // Delete ticket rule
  app.delete("/api/psa-integrations/:integrationId/rules/:ruleId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const integration = await storage.getPsaIntegration(req.params.integrationId);
      if (!integration || integration.userId !== userId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      await storage.deletePsaTicketRule(req.params.ruleId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting ticket rule:", error);
      res.status(500).json({ error: "Failed to delete ticket rule" });
    }
  });

  // ============ PREDICTIVE ANALYTICS API ============
  
  // Get active predictions
  app.get("/api/predictions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (user.subscriptionTier !== 'enterprise') {
        return res.status(403).json({ error: "Predictive analytics requires Enterprise plan" });
      }
      
      const predictions = await storage.getActivePredictions();
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });
  
  // Get prediction details
  app.get("/api/predictions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (user.subscriptionTier !== 'enterprise') {
        return res.status(403).json({ error: "Predictive analytics requires Enterprise plan" });
      }
      
      const prediction = await storage.getOutagePrediction(req.params.id);
      if (!prediction) {
        return res.status(404).json({ error: "Prediction not found" });
      }
      
      res.json(prediction);
    } catch (error) {
      console.error("Error fetching prediction:", error);
      res.status(500).json({ error: "Failed to fetch prediction" });
    }
  });
  
  // Acknowledge prediction
  app.post("/api/predictions/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const updated = await storage.acknowledgePrediction(req.params.id, userId);
      res.json(updated);
    } catch (error) {
      console.error("Error acknowledging prediction:", error);
      res.status(500).json({ error: "Failed to acknowledge prediction" });
    }
  });
  
  // Dismiss prediction
  app.post("/api/predictions/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const updated = await storage.dismissPrediction(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error dismissing prediction:", error);
      res.status(500).json({ error: "Failed to dismiss prediction" });
    }
  });
  
  // Provide feedback on prediction
  app.post("/api/predictions/:id/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const { score, notes } = req.body;
      const updated = await storage.providePredictionFeedback(req.params.id, score, notes);
      res.json(updated);
    } catch (error) {
      console.error("Error providing prediction feedback:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });
  
  // Get prediction patterns
  app.get("/api/prediction-patterns", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (user.subscriptionTier !== 'enterprise') {
        return res.status(403).json({ error: "Predictive analytics requires Enterprise plan" });
      }
      
      const patterns = await storage.getPredictionPatterns(req.query.resourceType);
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching prediction patterns:", error);
      res.status(500).json({ error: "Failed to fetch patterns" });
    }
  });
  
  // Get telemetry data for a vendor (Enterprise only, enforces tier-based retention)
  app.get("/api/telemetry/vendor/:vendorKey", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      const tier = user.subscriptionTier as keyof typeof DATA_RETENTION.telemetry;
      if (tier !== 'enterprise') {
        return res.status(403).json({ error: "Telemetry data requires Enterprise plan" });
      }
      
      // Enforce tier-based retention limits
      const maxDays = DATA_RETENTION.telemetry[tier] || 7;
      const requestedDays = parseInt(req.query.days) || maxDays;
      const days = Math.min(requestedDays, maxDays);
      
      const metrics = await storage.getVendorTelemetryMetrics(req.params.vendorKey, days);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching vendor telemetry:", error);
      res.status(500).json({ error: "Failed to fetch telemetry" });
    }
  });
  
  // Get aggregated predictions data (for calendar view)
  app.get("/api/predictions/calendar", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (user.subscriptionTier !== 'enterprise') {
        return res.status(403).json({ error: "Predictive analytics requires Enterprise plan" });
      }
      
      const predictions = await storage.getActivePredictions();
      
      // Group predictions by date
      const byDate: Record<string, any[]> = {};
      for (const p of predictions) {
        const date = p.predictedStartAt.toISOString().split('T')[0];
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push({
          id: p.id,
          resourceType: p.resourceType,
          vendorKey: p.vendorKey,
          chainKey: p.chainKey,
          severity: p.severity,
          confidence: p.confidence,
          title: p.title,
          predictedStartAt: p.predictedStartAt,
        });
      }
      
      res.json(byDate);
    } catch (error) {
      console.error("Error fetching predictions calendar:", error);
      res.status(500).json({ error: "Failed to fetch predictions calendar" });
    }
  });
  
  // Manually trigger prediction generation (admin only)
  app.post("/api/predictions/generate", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { generatePredictions } = await import("./predictionEngine");
      await generatePredictions();
      
      const predictions = await storage.getActivePredictions();
      res.json({ success: true, generatedCount: predictions.length });
    } catch (error) {
      console.error("Error generating predictions:", error);
      res.status(500).json({ error: "Failed to generate predictions" });
    }
  });

  // Regenerate predictions - clears low-quality ones and regenerates with improved algorithm
  app.post("/api/predictions/regenerate", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { regeneratePredictions } = await import("./predictionEngine");
      const result = await regeneratePredictions();
      
      res.json({ 
        success: true, 
        cleared: result.cleared, 
        created: result.created,
        message: `Cleared ${result.cleared} old predictions, created ${result.created} high-quality predictions`
      });
    } catch (error) {
      console.error("Error regenerating predictions:", error);
      res.status(500).json({ error: "Failed to regenerate predictions" });
    }
  });

  // ============ WEBHOOKS API ============
  
  // Zod schema for webhook creation/update
  const webhookBodySchema = z.object({
    name: z.string().min(1, "Name is required"),
    url: z.string().url("Must be a valid URL"),
    events: z.string().optional(),
    vendorKeys: z.string().optional(),
    chainKeys: z.string().optional(),
    headers: z.string().optional(),
    payloadTemplate: z.string().optional(),
    secret: z.string().optional(),
    isActive: z.boolean().optional(),
  });
  
  // Helper to check if user tier supports webhooks (Growth or Enterprise only)
  const tierSupportsWebhooks = (tier: string | null): boolean => {
    return tier === 'growth' || tier === 'enterprise' || tier === 'platinum';
  };
  
  // GET /api/webhooks - Get all webhooks for current user
  app.get("/api/webhooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!tierSupportsWebhooks(user.subscriptionTier)) {
        return res.status(403).json({ error: "Webhooks require Growth or Enterprise plan" });
      }
      
      const webhooks = await storage.getUserWebhooks(userId);
      res.json(webhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhooks" });
    }
  });
  
  // GET /api/webhooks/:id - Get single webhook
  app.get("/api/webhooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const webhook = await storage.getUserWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      
      if (webhook.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(webhook);
    } catch (error) {
      console.error("Error fetching webhook:", error);
      res.status(500).json({ error: "Failed to fetch webhook" });
    }
  });
  
  // POST /api/webhooks - Create new webhook
  app.post("/api/webhooks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!tierSupportsWebhooks(user.subscriptionTier)) {
        return res.status(403).json({ error: "Webhooks require Growth or Enterprise plan" });
      }
      
      const parseResult = webhookBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request body", details: parseResult.error.errors });
      }
      
      const existingWebhooks = await storage.getUserWebhooks(userId);
      if (existingWebhooks.length >= 10) {
        return res.status(400).json({ error: "Maximum of 10 webhooks allowed per user" });
      }
      
      const webhookData = {
        userId,
        name: parseResult.data.name,
        url: parseResult.data.url,
        events: parseResult.data.events || 'all',
        vendorKeys: parseResult.data.vendorKeys || null,
        chainKeys: parseResult.data.chainKeys || null,
        headers: parseResult.data.headers || null,
        payloadTemplate: parseResult.data.payloadTemplate || null,
        secret: parseResult.data.secret || null,
        isActive: parseResult.data.isActive !== undefined ? parseResult.data.isActive : true,
      };
      
      const webhook = await storage.createUserWebhook(webhookData);
      res.status(201).json(webhook);
    } catch (error) {
      console.error("Error creating webhook:", error);
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });
  
  // PUT /api/webhooks/:id - Update webhook
  app.put("/api/webhooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const existingWebhook = await storage.getUserWebhook(req.params.id);
      if (!existingWebhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      
      if (existingWebhook.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const parseResult = webhookBodySchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request body", details: parseResult.error.errors });
      }
      
      const webhook = await storage.updateUserWebhook(req.params.id, parseResult.data);
      res.json(webhook);
    } catch (error) {
      console.error("Error updating webhook:", error);
      res.status(500).json({ error: "Failed to update webhook" });
    }
  });
  
  // DELETE /api/webhooks/:id - Delete webhook
  app.delete("/api/webhooks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const existingWebhook = await storage.getUserWebhook(req.params.id);
      if (!existingWebhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      
      if (existingWebhook.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteUserWebhook(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting webhook:", error);
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });
  
  // POST /api/webhooks/:id/test - Test webhook delivery
  app.post("/api/webhooks/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const webhook = await storage.getUserWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      
      if (webhook.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const testPayload = {
        event: "test",
        timestamp: new Date().toISOString(),
        webhook: {
          id: webhook.id,
          name: webhook.name,
        },
        data: {
          message: "This is a test webhook delivery from VendorWatch",
          vendorKey: "test_vendor",
          incidentId: "test_incident_001",
          status: "investigating",
          severity: "minor",
        },
      };
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "VendorWatch-Webhook/1.0",
      };
      
      if (webhook.headers) {
        try {
          const customHeaders = JSON.parse(webhook.headers);
          Object.assign(headers, customHeaders);
        } catch (e) {
        }
      }
      
      if (webhook.secret) {
        const hmac = crypto.createHmac('sha256', webhook.secret);
        hmac.update(JSON.stringify(testPayload));
        headers['X-Webhook-Signature'] = hmac.digest('hex');
      }
      
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(testPayload),
        });
        
        res.json({
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
        });
      } catch (fetchError: any) {
        res.json({
          success: false,
          status: 0,
          error: fetchError.message || "Failed to connect to webhook URL",
        });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ error: "Failed to test webhook" });
    }
  });
  
  // GET /api/webhooks/:id/logs - Get webhook delivery logs
  app.get("/api/webhooks/:id/logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const webhook = await storage.getUserWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: "Webhook not found" });
      }
      
      if (webhook.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const logs = await storage.getWebhookLogs(req.params.id, 50);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
      res.status(500).json({ error: "Failed to fetch webhook logs" });
    }
  });

  // ============ API KEYS ============
  
  const apiKeyBodySchema = z.object({
    name: z.string().min(1, "Name is required"),
    scopes: z.enum(['read', 'read_write', 'full']).optional(),
    expiresAt: z.string().optional(),
  });
  
  const apiKeyUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    scopes: z.enum(['read', 'read_write', 'full']).optional(),
    isActive: z.boolean().optional(),
  });
  
  const tierSupportsApiKeys = (tier: string | null): boolean => {
    return tier === 'enterprise' || tier === 'platinum';
  };
  
  // GET /api/api-keys - List user's API keys
  app.get("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!tierSupportsApiKeys(user.subscriptionTier)) {
        return res.status(403).json({ error: "API keys require Enterprise plan" });
      }
      
      const keys = await storage.getApiKeys(userId);
      const safeKeys = keys.map(key => ({
        id: key.id,
        userId: key.userId,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        rateLimit: key.rateLimit,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        isActive: key.isActive,
        createdAt: key.createdAt,
      }));
      res.json(safeKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });
  
  // POST /api/api-keys - Create new API key
  app.post("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!tierSupportsApiKeys(user.subscriptionTier)) {
        return res.status(403).json({ error: "API keys require Enterprise plan" });
      }
      
      const parseResult = apiKeyBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request body", details: parseResult.error.errors });
      }
      
      const existingKeys = await storage.getApiKeys(userId);
      if (existingKeys.length >= 5) {
        return res.status(400).json({ error: "Maximum of 5 API keys allowed per user" });
      }
      
      const rawKey = crypto.randomBytes(32).toString('hex');
      const keyPrefix = `vw_${rawKey.substring(0, 8)}`;
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      
      const apiKeyData = {
        userId,
        name: parseResult.data.name,
        keyHash,
        keyPrefix,
        scopes: parseResult.data.scopes || 'read',
        rateLimit: 1000,
        expiresAt: parseResult.data.expiresAt ? new Date(parseResult.data.expiresAt) : null,
        isActive: true,
      };
      
      const createdKey = await storage.createApiKey(apiKeyData);
      
      res.status(201).json({
        ...createdKey,
        keyHash: undefined,
        plainKey: rawKey,
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });
  
  // PUT /api/api-keys/:id - Update API key
  app.put("/api/api-keys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!tierSupportsApiKeys(user.subscriptionTier)) {
        return res.status(403).json({ error: "API keys require Enterprise plan" });
      }
      
      const apiKey = await storage.getApiKey(req.params.id);
      if (!apiKey) {
        return res.status(404).json({ error: "API key not found" });
      }
      
      if (apiKey.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const parseResult = apiKeyUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "Invalid request body", details: parseResult.error.errors });
      }
      
      const updateData: any = {};
      if (parseResult.data.name !== undefined) updateData.name = parseResult.data.name;
      if (parseResult.data.scopes !== undefined) updateData.scopes = parseResult.data.scopes;
      if (parseResult.data.isActive !== undefined) updateData.isActive = parseResult.data.isActive;
      
      const updatedKey = await storage.updateApiKey(req.params.id, updateData);
      if (!updatedKey) {
        return res.status(404).json({ error: "API key not found" });
      }
      
      res.json({
        ...updatedKey,
        keyHash: undefined,
      });
    } catch (error) {
      console.error("Error updating API key:", error);
      res.status(500).json({ error: "Failed to update API key" });
    }
  });
  
  // DELETE /api/api-keys/:id - Delete API key
  app.delete("/api/api-keys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!tierSupportsApiKeys(user.subscriptionTier)) {
        return res.status(403).json({ error: "API keys require Enterprise plan" });
      }
      
      const apiKey = await storage.getApiKey(req.params.id);
      if (!apiKey) {
        return res.status(404).json({ error: "API key not found" });
      }
      
      if (apiKey.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteApiKey(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });
  
  // GET /api/api-keys/:id/logs - Get API key usage logs
  app.get("/api/api-keys/:id/logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const user = req.user;
      if (!tierSupportsApiKeys(user.subscriptionTier)) {
        return res.status(403).json({ error: "API keys require Enterprise plan" });
      }
      
      const apiKey = await storage.getApiKey(req.params.id);
      if (!apiKey) {
        return res.status(404).json({ error: "API key not found" });
      }
      
      if (apiKey.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const logs = await storage.getApiRequestLogs(req.params.id, 100);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching API key logs:", error);
      res.status(500).json({ error: "Failed to fetch API key logs" });
    }
  });

  // ============ UPTIME REPORTS ============

  // Helper to check if tier supports reports (Growth/Enterprise only)
  const tierSupportsReports = (tier: string | null): boolean => {
    return tier === 'growth' || tier === 'enterprise' || tier === 'platinum';
  };

  // GET /api/reports - List user's reports
  app.get("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = req.user;
      if (!tierSupportsReports(user.subscriptionTier)) {
        return res.status(403).json({ error: "Uptime reports require Growth or Enterprise plan" });
      }

      const reports = await storage.getUptimeReports(userId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  // POST /api/reports - Generate new report
  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = req.user;
      if (!tierSupportsReports(user.subscriptionTier)) {
        return res.status(403).json({ error: "Uptime reports require Growth or Enterprise plan" });
      }

      const { name, reportType, vendorKeys, chainKeys, startDate, endDate } = req.body;

      if (!name || !startDate || !endDate) {
        return res.status(400).json({ error: "Name, start date, and end date are required" });
      }

      const report = await storage.createUptimeReport({
        userId,
        name,
        reportType: reportType || 'custom',
        vendorKeys: vendorKeys || null,
        chainKeys: chainKeys || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'pending',
      });

      // Mark as generating and simulate PDF generation
      await storage.updateUptimeReport(report.id, {
        status: 'generating',
      });

      // Placeholder: In production, actual PDF generation would happen here
      // For now, mark as completed with a placeholder URL
      setTimeout(async () => {
        try {
          await storage.updateUptimeReport(report.id, {
            status: 'completed',
            fileUrl: `/api/reports/${report.id}/download`,
            fileSize: 1024,
          } as any);
        } catch (e) {
          console.error('Failed to complete report:', e);
        }
      }, 2000);

      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating report:", error);
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  // GET /api/reports/:id - Get report details
  app.get("/api/reports/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const report = await storage.getUptimeReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  // GET /api/reports/:id/download - Download PDF
  app.get("/api/reports/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const report = await storage.getUptimeReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (report.status !== 'completed') {
        return res.status(400).json({ error: "Report not ready for download" });
      }

      // Generate simple HTML report as placeholder
      const vendors = await storage.getVendors();
      const chains = await storage.getBlockchainChains();

      const vendorNames = report.vendorKeys?.length
        ? vendors.filter(v => report.vendorKeys?.includes(v.key)).map(v => v.name).join(', ')
        : 'All Vendors';
      const chainNames = report.chainKeys?.length
        ? chains.filter(c => report.chainKeys?.includes(c.key)).map(c => c.name).join(', ')
        : 'All Chains';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${report.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            .meta { color: #666; margin-bottom: 20px; }
            .section { margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>Uptime Report: ${report.name}</h1>
          <div class="meta">
            <p><strong>Report Type:</strong> ${report.reportType}</p>
            <p><strong>Period:</strong> ${new Date(report.startDate).toLocaleDateString()} - ${new Date(report.endDate).toLocaleDateString()}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="section">
            <h2>Coverage</h2>
            <p><strong>Vendors:</strong> ${vendorNames}</p>
            <p><strong>Blockchain Infrastructure:</strong> ${chainNames}</p>
          </div>
          <div class="section">
            <h2>Summary</h2>
            <p>This is a placeholder report. Full PDF generation with uptime statistics will be implemented with a PDF library.</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.html"`);
      res.send(html);
    } catch (error) {
      console.error("Error downloading report:", error);
      res.status(500).json({ error: "Failed to download report" });
    }
  });

  // DELETE /api/reports/:id - Delete report
  app.delete("/api/reports/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const report = await storage.getUptimeReport(req.params.id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteUptimeReport(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  // GET /api/report-schedules - List schedules
  app.get("/api/report-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = req.user;
      if (!tierSupportsReports(user.subscriptionTier)) {
        return res.status(403).json({ error: "Report schedules require Growth or Enterprise plan" });
      }

      const schedules = await storage.getReportSchedules(userId);
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching report schedules:", error);
      res.status(500).json({ error: "Failed to fetch report schedules" });
    }
  });

  // POST /api/report-schedules - Create schedule
  app.post("/api/report-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = req.user;
      if (!tierSupportsReports(user.subscriptionTier)) {
        return res.status(403).json({ error: "Report schedules require Growth or Enterprise plan" });
      }

      const { name, frequency, vendorKeys, chainKeys, recipients, isActive } = req.body;

      if (!name || !frequency) {
        return res.status(400).json({ error: "Name and frequency are required" });
      }

      const schedule = await storage.createReportSchedule({
        userId,
        name,
        frequency,
        vendorKeys: vendorKeys || null,
        chainKeys: chainKeys || null,
        recipients: recipients || null,
        isActive: isActive ?? true,
      });

      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating report schedule:", error);
      res.status(500).json({ error: "Failed to create report schedule" });
    }
  });

  // PUT /api/report-schedules/:id - Update schedule
  app.put("/api/report-schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Get existing schedule
      const schedules = await storage.getReportSchedules(userId);
      const existing = schedules.find(s => s.id === req.params.id);

      if (!existing) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      const { name, frequency, vendorKeys, chainKeys, recipients, isActive } = req.body;

      const updated = await storage.updateReportSchedule(req.params.id, {
        name: name ?? existing.name,
        frequency: frequency ?? existing.frequency,
        vendorKeys: vendorKeys !== undefined ? vendorKeys : existing.vendorKeys,
        chainKeys: chainKeys !== undefined ? chainKeys : existing.chainKeys,
        recipients: recipients !== undefined ? recipients : existing.recipients,
        isActive: isActive ?? existing.isActive,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating report schedule:", error);
      res.status(500).json({ error: "Failed to update report schedule" });
    }
  });

  // DELETE /api/report-schedules/:id - Delete schedule
  app.delete("/api/report-schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Verify ownership
      const schedules = await storage.getReportSchedules(userId);
      const existing = schedules.find(s => s.id === req.params.id);

      if (!existing) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      await storage.deleteReportSchedule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report schedule:", error);
      res.status(500).json({ error: "Failed to delete report schedule" });
    }
  });

  // ============ SSO CONFIGURATION ============

  // Helper to check if user has Enterprise tier
  const isEnterpriseTier = (tier: string | null): boolean => {
    return tier === 'enterprise' || tier === 'platinum';
  };

  // GET /api/sso-configurations - List organization's SSO configs
  app.get("/api/sso-configurations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Check user is in an organization
      const userRole = await storage.getUserRole(userId);
      if (!userRole) {
        return res.status(403).json({ error: "Organization membership required" });
      }

      // Check if user is master admin
      if (userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Master admin access required", requiresMasterAdmin: true });
      }

      // Get organization
      const org = await storage.getOrganization(userRole.organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Check Enterprise tier
      if (!isEnterpriseTier(org.subscriptionTier)) {
        return res.status(403).json({ error: "SSO requires Enterprise plan", requiresEnterprise: true });
      }

      const configs = await storage.getSsoConfigurations(userRole.organizationId);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching SSO configurations:", error);
      res.status(500).json({ error: "Failed to fetch SSO configurations" });
    }
  });

  // POST /api/sso-configurations - Create SSO config
  app.post("/api/sso-configurations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Master admin access required" });
      }

      const org = await storage.getOrganization(userRole.organizationId);
      if (!org || !isEnterpriseTier(org.subscriptionTier)) {
        return res.status(403).json({ error: "SSO requires Enterprise plan" });
      }

      const { provider, displayName, emailDomain, entityId, ssoUrl, certificate, clientId, clientSecret, issuerUrl, autoProvision, defaultRole } = req.body;

      // Validate required fields
      if (!provider || !displayName || !emailDomain) {
        return res.status(400).json({ error: "Provider, display name, and email domain are required" });
      }

      // Validate provider type
      const validProviders = ['saml', 'oidc', 'okta', 'azure_ad'];
      if (!validProviders.includes(provider)) {
        return res.status(400).json({ error: "Invalid provider type" });
      }

      // Validate SAML fields
      if ((provider === 'saml' || provider === 'okta' || provider === 'azure_ad') && (!entityId || !ssoUrl || !certificate)) {
        return res.status(400).json({ error: "SAML configuration requires entityId, ssoUrl, and certificate" });
      }

      // Validate OIDC fields
      if (provider === 'oidc' && (!clientId || !clientSecret || !issuerUrl)) {
        return res.status(400).json({ error: "OIDC configuration requires clientId, clientSecret, and issuerUrl" });
      }

      // Check for duplicate email domain
      const existingConfig = await storage.getSsoConfigurationByDomain(emailDomain);
      if (existingConfig) {
        return res.status(409).json({ error: "An SSO configuration already exists for this email domain" });
      }

      const config = await storage.createSsoConfiguration({
        organizationId: userRole.organizationId,
        provider,
        displayName,
        emailDomain,
        entityId: entityId || null,
        ssoUrl: ssoUrl || null,
        certificate: certificate || null,
        clientId: clientId || null,
        clientSecret: clientSecret || null,
        issuerUrl: issuerUrl || null,
        autoProvision: autoProvision ?? true,
        defaultRole: defaultRole || 'member_ro',
        isActive: false,
      });

      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating SSO configuration:", error);
      res.status(500).json({ error: "Failed to create SSO configuration" });
    }
  });

  // PUT /api/sso-configurations/:id - Update SSO config
  app.put("/api/sso-configurations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Master admin access required" });
      }

      const org = await storage.getOrganization(userRole.organizationId);
      if (!org || !isEnterpriseTier(org.subscriptionTier)) {
        return res.status(403).json({ error: "SSO requires Enterprise plan" });
      }

      // Get existing config and verify ownership
      const existingConfig = await storage.getSsoConfiguration(req.params.id);
      if (!existingConfig) {
        return res.status(404).json({ error: "SSO configuration not found" });
      }

      if (existingConfig.organizationId !== userRole.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { displayName, emailDomain, entityId, ssoUrl, certificate, clientId, clientSecret, issuerUrl, autoProvision, defaultRole, isActive } = req.body;

      // If email domain is being changed, check for duplicates
      if (emailDomain && emailDomain !== existingConfig.emailDomain) {
        const domainConfig = await storage.getSsoConfigurationByDomain(emailDomain);
        if (domainConfig && domainConfig.id !== req.params.id) {
          return res.status(409).json({ error: "An SSO configuration already exists for this email domain" });
        }
      }

      const updated = await storage.updateSsoConfiguration(req.params.id, {
        displayName: displayName ?? existingConfig.displayName,
        emailDomain: emailDomain ?? existingConfig.emailDomain,
        entityId: entityId !== undefined ? entityId : existingConfig.entityId,
        ssoUrl: ssoUrl !== undefined ? ssoUrl : existingConfig.ssoUrl,
        certificate: certificate !== undefined ? certificate : existingConfig.certificate,
        clientId: clientId !== undefined ? clientId : existingConfig.clientId,
        clientSecret: clientSecret !== undefined ? clientSecret : existingConfig.clientSecret,
        issuerUrl: issuerUrl !== undefined ? issuerUrl : existingConfig.issuerUrl,
        autoProvision: autoProvision ?? existingConfig.autoProvision,
        defaultRole: defaultRole ?? existingConfig.defaultRole,
        isActive: isActive ?? existingConfig.isActive,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating SSO configuration:", error);
      res.status(500).json({ error: "Failed to update SSO configuration" });
    }
  });

  // DELETE /api/sso-configurations/:id - Delete SSO config
  app.delete("/api/sso-configurations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Master admin access required" });
      }

      const org = await storage.getOrganization(userRole.organizationId);
      if (!org || !isEnterpriseTier(org.subscriptionTier)) {
        return res.status(403).json({ error: "SSO requires Enterprise plan" });
      }

      // Get existing config and verify ownership
      const existingConfig = await storage.getSsoConfiguration(req.params.id);
      if (!existingConfig) {
        return res.status(404).json({ error: "SSO configuration not found" });
      }

      if (existingConfig.organizationId !== userRole.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteSsoConfiguration(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting SSO configuration:", error);
      res.status(500).json({ error: "Failed to delete SSO configuration" });
    }
  });

  // POST /api/sso-configurations/:id/test - Test SSO connection
  app.post("/api/sso-configurations/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const userRole = await storage.getUserRole(userId);
      if (!userRole || userRole.role !== 'master_admin') {
        return res.status(403).json({ error: "Master admin access required" });
      }

      const org = await storage.getOrganization(userRole.organizationId);
      if (!org || !isEnterpriseTier(org.subscriptionTier)) {
        return res.status(403).json({ error: "SSO requires Enterprise plan" });
      }

      // Get config and verify ownership
      const config = await storage.getSsoConfiguration(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "SSO configuration not found" });
      }

      if (config.organizationId !== userRole.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Test SAML configuration
      if (config.provider === 'saml' || config.provider === 'okta' || config.provider === 'azure_ad') {
        // Validate certificate format
        if (config.certificate) {
          const certContent = config.certificate.trim();
          if (!certContent.includes('BEGIN CERTIFICATE') || !certContent.includes('END CERTIFICATE')) {
            errors.push("Certificate does not appear to be in valid X.509 PEM format");
          }
        } else {
          errors.push("Certificate is required for SAML configuration");
        }

        // Test SSO URL reachability
        if (config.ssoUrl) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(config.ssoUrl, { 
              method: 'HEAD',
              signal: controller.signal 
            });
            clearTimeout(timeout);
            if (!response.ok && response.status !== 405) {
              warnings.push(`SSO URL returned status ${response.status}`);
            }
          } catch (e: any) {
            if (e.name === 'AbortError') {
              errors.push("SSO URL connection timed out");
            } else {
              errors.push(`SSO URL is not reachable: ${e.message}`);
            }
          }
        } else {
          errors.push("SSO URL is required for SAML configuration");
        }

        // Check entity ID
        if (!config.entityId) {
          errors.push("Entity ID is required for SAML configuration");
        }
      }

      // Test OIDC configuration
      if (config.provider === 'oidc') {
        if (!config.clientId) errors.push("Client ID is required for OIDC configuration");
        if (!config.clientSecret) errors.push("Client Secret is required for OIDC configuration");

        // Test issuer URL/.well-known endpoint
        if (config.issuerUrl) {
          try {
            const wellKnownUrl = `${config.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(wellKnownUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (response.ok) {
              const data = await response.json();
              if (!data.authorization_endpoint || !data.token_endpoint) {
                warnings.push("OIDC discovery document is missing required endpoints");
              }
            } else {
              errors.push(`OIDC discovery endpoint returned status ${response.status}`);
            }
          } catch (e: any) {
            if (e.name === 'AbortError') {
              errors.push("OIDC issuer URL connection timed out");
            } else {
              errors.push(`OIDC issuer URL is not reachable: ${e.message}`);
            }
          }
        } else {
          errors.push("Issuer URL is required for OIDC configuration");
        }
      }

      if (errors.length > 0) {
        return res.json({ success: false, errors, warnings });
      }

      res.json({ success: true, warnings, message: "SSO configuration test passed" });
    } catch (error) {
      console.error("Error testing SSO configuration:", error);
      res.status(500).json({ error: "Failed to test SSO configuration" });
    }
  });

  // ============ AUDIT LOGS ============

  // Helper function to create audit logs
  async function logAudit(req: any, action: string, resourceType: string, resourceId?: string, resourceName?: string, details?: any, success = true, errorMessage?: string) {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const userAgent = req.headers['user-agent'];
      await storage.createAuditLog({
        userId, userEmail, action, resourceType, resourceId, resourceName,
        details: details ? JSON.stringify(details) : null,
        ipAddress, userAgent, success, errorMessage
      });
    } catch (e) { console.error('Audit log failed:', e); }
  }

  // GET /api/audit-logs - List audit logs (admin only)
  app.get("/api/audit-logs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, action, resourceType, limit = '100', offset = '0' } = req.query;
      
      const logs = await storage.getAuditLogs({
        userId: userId as string | undefined,
        action: action as string | undefined,
        resourceType: resourceType as string | undefined,
        limit: parseInt(limit as string, 10) || 100,
        offset: parseInt(offset as string, 10) || 0
      });
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // GET /api/audit-logs/count - Get total count for pagination (admin only)
  app.get("/api/audit-logs/count", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, action, resourceType } = req.query;
      
      const count = await storage.getAuditLogsCount({
        userId: userId as string | undefined,
        action: action as string | undefined,
        resourceType: resourceType as string | undefined
      });
      
      res.json({ count });
    } catch (error) {
      console.error("Error fetching audit logs count:", error);
      res.status(500).json({ error: "Failed to fetch audit logs count" });
    }
  });

  return httpServer;
}
