import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { z } from "zod";
import { eq, lt, and, isNull } from "drizzle-orm";
import { authStorage } from "./storage";
import { db } from "../../db";
import { mobileAuthCodes, mobileAuthTokens, users } from "@shared/models/auth";

// Allowed mobile redirect URI (strict allowlist)
const ALLOWED_MOBILE_REDIRECT = "vendorwatch://auth/replit/callback";

// Cleanup expired auth codes every 5 minutes
setInterval(async () => {
  try {
    const now = new Date();
    await db.delete(mobileAuthCodes).where(lt(mobileAuthCodes.expiresAt, now));
  } catch (error) {
    console.error('[auth] Error cleaning up expired auth codes:', error);
  }
}, 5 * 60 * 1000);

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  try {
    console.log('[auth] Upserting user with email:', claims["email"]);
    await authStorage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
    console.log('[auth] User upserted successfully');
  } catch (error) {
    console.error('[auth] Error upserting user:', error);
    throw error;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      verified(null, user);
    } catch (error) {
      console.error('[auth] Verify function error:', error);
      verified(error as Error);
    }
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req: any, res, next) => {
    // Check for mobile redirect parameter and store in session
    const mobileRedirect = req.query.mobile_redirect as string;
    if (mobileRedirect) {
      req.session.mobileRedirect = mobileRedirect;
      console.log('[auth] Mobile redirect stored in session:', mobileRedirect);
    }
    
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req: any, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any, info: any) => {
      if (err) {
        console.error('[auth] Callback error:', err);
        return res.status(500).json({ error: 'Authentication failed', details: err.message });
      }
      if (!user) {
        console.error('[auth] Callback - no user returned:', info);
        return res.redirect('/api/login');
      }
      req.logIn(user, async (loginErr: any) => {
        if (loginErr) {
          console.error('[auth] Login error:', loginErr);
          return res.status(500).json({ error: 'Login failed', details: loginErr.message });
        }
        
        // Check if this was a mobile app login
        const mobileRedirect = req.session?.mobileRedirect;
        
        // Strict validation: only allow exact match with allowed redirect URI
        if (mobileRedirect && mobileRedirect === ALLOWED_MOBILE_REDIRECT) {
          console.log('[auth] Mobile redirect detected (validated)');
          
          try {
            // Generate a one-time, short-lived auth code (not the session ID)
            const authCode = crypto.randomBytes(32).toString('hex');
            const claims = user.claims || {};
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
            
            // Store auth code in database (persisted, one-time use)
            await db.insert(mobileAuthCodes).values({
              code: authCode,
              userId: claims.sub,
              email: claims.email,
              displayName: `${claims.first_name || ''} ${claims.last_name || ''}`.trim(),
              avatarUrl: claims.profile_image_url,
              expiresAt,
            });
            
            // Clear the mobile redirect from session
            delete req.session.mobileRedirect;
            
            // Save session before redirecting
            req.session.save((saveErr: any) => {
              if (saveErr) {
                console.error('[auth] Session save error:', saveErr);
              }
              
              // Redirect back to mobile app with auth code (not session ID)
              const redirectUrl = `${ALLOWED_MOBILE_REDIRECT}?code=${authCode}`;
              console.log('[auth] Redirecting to mobile app with auth code');
              return res.redirect(redirectUrl);
            });
          } catch (dbError) {
            console.error('[auth] Error storing mobile auth code:', dbError);
            return res.status(500).json({ error: 'Failed to process mobile login' });
          }
          return;
        }
        
        // If mobile redirect doesn't match allowlist, log and redirect to web
        if (mobileRedirect) {
          console.warn('[auth] Invalid mobile redirect attempted:', mobileRedirect);
          delete req.session.mobileRedirect;
        }
        
        // Normal web redirect
        return res.redirect('/');
      });
    })(req, res, next);
  });
  
  // Mobile auth code exchange endpoint
  // The mobile app calls this with the auth code to get user data and a bearer token
  const mobileExchangeSchema = z.object({
    code: z.string().min(1, "Auth code is required"),
    deviceInfo: z.string().optional(),
  });
  
  app.post("/api/mobile/auth/exchange", async (req: any, res) => {
    try {
      // Validate request body with Zod
      const parseResult = mobileExchangeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request', 
          details: parseResult.error.flatten().fieldErrors 
        });
      }
      
      const { code, deviceInfo } = parseResult.data;
      
      // Look up and validate the auth code from database
      const [authData] = await db.select()
        .from(mobileAuthCodes)
        .where(and(
          eq(mobileAuthCodes.code, code),
          isNull(mobileAuthCodes.usedAt) // Not already used
        ))
        .limit(1);
      
      if (!authData) {
        return res.status(401).json({ error: 'Invalid or expired auth code' });
      }
      
      // Check if expired
      if (authData.expiresAt < new Date()) {
        await db.delete(mobileAuthCodes).where(eq(mobileAuthCodes.code, code));
        return res.status(401).json({ error: 'Auth code expired' });
      }
      
      // Verify user exists before issuing token
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, authData.userId))
        .limit(1);
      
      if (!user) {
        console.error('[auth] Mobile exchange: User not found:', authData.userId);
        await db.update(mobileAuthCodes)
          .set({ usedAt: new Date() })
          .where(eq(mobileAuthCodes.code, code));
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Mark the auth code as used (one-time use)
      await db.update(mobileAuthCodes)
        .set({ usedAt: new Date() })
        .where(eq(mobileAuthCodes.code, code));
      
      // Generate a secure API token for the mobile app
      const apiToken = crypto.randomBytes(48).toString('hex');
      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      // Store the API token in the database
      await db.insert(mobileAuthTokens).values({
        userId: authData.userId,
        token: apiToken,
        deviceInfo: deviceInfo || null,
        expiresAt: tokenExpiresAt,
      });
      
      console.log('[auth] Mobile auth code exchanged for user:', authData.email);
      
      // Return user data and bearer token
      res.json({
        success: true,
        token: apiToken,
        expiresAt: tokenExpiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || authData.displayName,
          avatarUrl: user.profileImageUrl || authData.avatarUrl,
          subscriptionTier: user.subscriptionTier,
        },
      });
    } catch (error) {
      console.error('[auth] Mobile auth exchange error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Note: Mobile token validation is now handled by the unified isAuthenticated 
  // middleware in routes.ts which checks session, Replit OAuth, AND Bearer tokens
  
  // Mobile token revocation endpoint
  app.post("/api/mobile/auth/logout", async (req: any, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        await db.update(mobileAuthTokens)
          .set({ revokedAt: new Date() })
          .where(eq(mobileAuthTokens.token, token));
        
        console.log('[auth] Mobile token revoked');
        return res.json({ success: true });
      } catch (error) {
        console.error('[auth] Mobile logout error:', error);
      }
    }
    
    res.status(400).json({ error: 'No valid token provided' });
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
