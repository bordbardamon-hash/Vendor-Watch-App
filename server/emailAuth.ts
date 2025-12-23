import bcrypt from 'bcryptjs';
import type { Express, RequestHandler } from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import passport from 'passport';
import * as client from 'openid-client';
import { Strategy, type VerifyFunction } from 'openid-client/passport';
import memoize from 'memoizee';
import { db } from './db';
import { users } from '@shared/models/auth';
import { eq } from 'drizzle-orm';

const SALT_ROUNDS = 10;

// Memoized OIDC config for Replit Auth
const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

// Simple in-memory rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { allowed: boolean; remainingTime?: number } {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  
  if (!attempt) {
    return { allowed: true };
  }
  
  // Reset if lockout period has passed
  if (now - attempt.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    const remainingTime = Math.ceil((LOCKOUT_DURATION - (now - attempt.lastAttempt)) / 1000 / 60);
    return { allowed: false, remainingTime };
  }
  
  return { allowed: true };
}

function recordLoginAttempt(ip: string, success: boolean) {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  
  const now = Date.now();
  const attempt = loginAttempts.get(ip);
  
  if (!attempt) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(ip, { count: attempt.count + 1, lastAttempt: now });
  }
}

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
    secret: process.env.SESSION_SECRET || 'vendor-watch-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupEmailAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup Replit OAuth (Google, GitHub, Apple, etc.)
  try {
    const config = await getOidcConfig();
    const registeredStrategies = new Set<string>();

    const ensureStrategy = (domain: string) => {
      const strategyName = `replitauth:${domain}`;
      if (!registeredStrategies.has(strategyName)) {
        const verify: VerifyFunction = async (tokens, verified) => {
          try {
            const claims = tokens.claims();
            
            if (!claims || !claims.email) {
              return verified(new Error('No email in claims'));
            }
            
            const email = claims.email as string;
            const firstName = (claims as any).first_name || null;
            const lastName = (claims as any).last_name || null;
            const profileImageUrl = (claims as any).profile_image_url || null;
            
            // Find or create user in our database
            let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
            
            if (!user) {
              // Create new user from Replit OAuth
              [user] = await db.insert(users).values({
                email,
                firstName,
                lastName,
                profileImageUrl,
              }).returning();
              console.log(`[auth] Created new user from Replit OAuth: ${email}`);
            } else {
              // Update profile info if needed
              await db.update(users).set({
                firstName: firstName || user.firstName,
                lastName: lastName || user.lastName,
                profileImageUrl: profileImageUrl || user.profileImageUrl,
              }).where(eq(users.id, user.id));
            }
            
            verified(null, { userId: user.id, email: user.email });
          } catch (error) {
            console.error('[auth] Replit OAuth verify error:', error);
            verified(error as Error);
          }
        };

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

    passport.serializeUser((user: any, cb) => cb(null, user));
    passport.deserializeUser((user: any, cb) => cb(null, user));

    // Replit OAuth login route
    app.get("/api/login", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    // Replit OAuth callback route
    app.get("/api/callback", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, (err: any, user: any, info: any) => {
        if (err) {
          console.error('[auth] OAuth callback error:', err);
          return res.redirect('/login?error=auth_failed');
        }
        if (!user) {
          console.error('[auth] OAuth callback - no user returned:', info);
          return res.redirect('/login?error=no_user');
        }
        
        // Set our session with the user ID
        (req.session as any).userId = user.userId;
        (req.session as any).twoFactorVerified = true; // OAuth users skip 2FA initially
        
        console.log(`[auth] User logged in via Replit OAuth: ${user.email}`);
        return res.redirect('/');
      })(req, res, next);
    });

    // Replit OAuth logout route
    app.get("/api/logout", (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          console.error('[auth] Logout error:', err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
      });
    });

    console.log('[auth] Replit OAuth routes registered successfully');
  } catch (error) {
    console.error('[auth] Failed to setup Replit OAuth:', error);
  }

  // Register endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }

      // Check if user already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const [newUser] = await db.insert(users).values({
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
      }).returning();

      // Set session
      (req.session as any).userId = newUser.id;

      console.log(`[auth] User registered: ${email}`);
      res.json({ 
        id: newUser.id, 
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      });
    } catch (error) {
      console.error('[auth] Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      
      // Check rate limit
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return res.status(429).json({ 
          message: `Too many login attempts. Try again in ${rateCheck.remainingTime} minutes.` 
        });
      }

      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        recordLoginAttempt(clientIp, false);
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.password) {
        return res.status(401).json({ message: 'Please use Replit login for this account' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        recordLoginAttempt(clientIp, false);
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      // Successful login - clear rate limit
      recordLoginAttempt(clientIp, true);

      // Set session
      (req.session as any).userId = user.id;
      
      // Check if 2FA is required
      if (user.twoFactorEnabled) {
        (req.session as any).twoFactorVerified = false;
      } else {
        (req.session as any).twoFactorVerified = true;
      }

      console.log(`[auth] User logged in: ${email}`);
      res.json({ 
        id: user.id, 
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        twoFactorEnabled: user.twoFactorEnabled,
      });
    } catch (error) {
      console.error('[auth] Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Set password endpoint (for users who signed up via Replit Auth)
  app.post('/api/auth/set-password', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        return res.status(404).json({ message: 'No account found with this email' });
      }

      if (user.password) {
        return res.status(400).json({ message: 'This account already has a password. Use the login page.' });
      }

      // Hash and set password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));

      console.log(`[auth] Password set for user: ${email}`);
      res.json({ message: 'Password set successfully' });
    } catch (error) {
      console.error('[auth] Set password error:', error);
      res.status(500).json({ message: 'Failed to set password' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('[auth] Logout error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Get current user endpoint
  app.get('/api/auth/user', async (req, res) => {
    const userId = (req.session as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin,
        subscriptionTier: user.subscriptionTier,
        twoFactorEnabled: user.twoFactorEnabled,
      });
    } catch (error) {
      console.error('[auth] Get user error:', error);
      res.status(500).json({ message: 'Failed to get user' });
    }
  });

  console.log('[auth] Email authentication routes registered successfully');
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Attach user to request for downstream use
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('[auth] Auth check error:', error);
    res.status(500).json({ message: 'Authentication check failed' });
  }
};
