import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
import { storage } from './storage';
import { sendEmail, sendWelcomeEmail, notifyOwnerNewSignup } from './emailClient';

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
              
              // Notify owner about new signup (non-blocking)
              notifyOwnerNewSignup(email, firstName, lastName, 'replit_oauth').catch(err => {
                console.error('[auth] Failed to notify owner:', err);
              });
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
        
        // Log login activity (don't await to avoid blocking redirect)
        storage.logUserActivity(user.userId, 'login', { method: 'replit_oauth' }).catch(console.error);
        
        storage.createAuditLog({
          userId: user.userId, userEmail: user.email, action: 'login', resourceType: 'session',
          resourceId: null, resourceName: 'OAuth Login', details: JSON.stringify({ method: 'replit_oauth' }),
          ipAddress: req.ip || null, userAgent: req.headers['user-agent'] || null, success: true, errorMessage: null,
        }).catch(() => {});
        
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

      // Send welcome email (non-blocking)
      sendWelcomeEmail(email, firstName || null).catch(err => {
        console.error('[auth] Failed to send welcome email:', err);
      });
      
      // Notify owner about new signup (non-blocking)
      notifyOwnerNewSignup(email, firstName || null, lastName || null, 'email').catch(err => {
        console.error('[auth] Failed to notify owner:', err);
      });

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
      
      // Log login activity
      await storage.logUserActivity(user.id, 'login', { method: 'email' });
      
      // Audit log for login
      storage.createAuditLog({
        userId: user.id, userEmail: user.email, action: 'login', resourceType: 'session',
        resourceId: null, resourceName: 'Email Login', details: JSON.stringify({ method: 'email' }),
        ipAddress: clientIp, userAgent: req.headers['user-agent'] || null, success: true, errorMessage: null,
      }).catch(() => {});
      
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

  // Request password reset endpoint
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      // Always return success to prevent email enumeration attacks
      if (!user) {
        console.log(`[auth] Password reset requested for non-existent email: ${email}`);
        return res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
      }

      // Generate secure random token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Store token in database
      await db.update(users).set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      }).where(eq(users.id, user.id));

      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || (process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(',')[0] : 'localhost:5000');
      const baseUrl = `${protocol}://${host}`;
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      // Send email
      const emailSent = await sendEmail(
        email,
        'Reset Your Vendor Watch Password',
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f172a;">Reset Your Password</h2>
          <p>Hello ${user.firstName || 'there'},</p>
          <p>We received a request to reset your password for your Vendor Watch account.</p>
          <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you didn't request this password reset, you can safely ignore this email.
          </p>
        </div>
        `,
        `Reset Your Password

Hello ${user.firstName || 'there'},

We received a request to reset your password for your Vendor Watch account.

Click this link to reset your password (expires in 1 hour):
${resetUrl}

If you didn't request this password reset, you can safely ignore this email.`
      );

      if (emailSent) {
        console.log(`[auth] Password reset email sent to: ${email}`);
      } else {
        console.log(`[auth] Failed to send password reset email to: ${email}`);
      }

      res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
    } catch (error) {
      console.error('[auth] Forgot password error:', error);
      res.status(500).json({ message: 'Failed to process password reset request' });
    }
  });

  // Reset password with token endpoint
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }

      // Find user with valid token
      const [user] = await db.select().from(users)
        .where(eq(users.passwordResetToken, token))
        .limit(1);

      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset link' });
      }

      // Check if token is expired
      if (!user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
        return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
      }

      // Hash and set new password, clear reset token
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      await db.update(users).set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      }).where(eq(users.id, user.id));

      console.log(`[auth] Password reset completed for: ${user.email}`);
      res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
    } catch (error) {
      console.error('[auth] Reset password error:', error);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  });

  // Verify reset token endpoint (for UI validation)
  app.get('/api/auth/verify-reset-token', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: 'Token is required' });
      }

      const [user] = await db.select().from(users)
        .where(eq(users.passwordResetToken, token))
        .limit(1);

      if (!user) {
        return res.json({ valid: false, message: 'Invalid or expired reset link' });
      }

      if (!user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
        return res.json({ valid: false, message: 'Reset link has expired. Please request a new one.' });
      }

      res.json({ valid: true, email: user.email });
    } catch (error) {
      console.error('[auth] Verify reset token error:', error);
      res.status(500).json({ valid: false, message: 'Failed to verify token' });
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

      // Check if user has active trial (promo accounts bypass billing)
      const hasActiveTrial = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
      const needsOnboarding = !user.profileCompleted || (!user.billingCompleted && !hasActiveTrial);

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin,
        isOwner: user.isOwner,
        subscriptionTier: user.subscriptionTier,
        twoFactorEnabled: user.twoFactorEnabled,
        profileCompleted: user.profileCompleted,
        billingCompleted: user.billingCompleted || hasActiveTrial, // Trial accounts bypass billing
        trialEndsAt: user.trialEndsAt,
        billingStatus: user.billingStatus,
        needsOnboarding,
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
