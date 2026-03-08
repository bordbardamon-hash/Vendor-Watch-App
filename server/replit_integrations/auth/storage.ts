import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Owner email/ID that bypasses onboarding and has full enterprise + admin access
// Read dynamically to ensure it's always current
function getOwnerEmail(): string {
  return process.env.OWNER_EMAIL || "";
}

function getOwnerUserId(): string {
  return process.env.OWNER_USER_ID || "";
}

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if this is the owner - they get full access automatically
    // Match by email OR by user ID for flexibility
    const ownerEmail = getOwnerEmail();
    const ownerUserId = getOwnerUserId();
    const userEmail = userData.email?.toLowerCase().trim() || "";
    const userId = userData.id || "";
    const ownerEmailLower = ownerEmail?.toLowerCase().trim() || "";
    
    const isOwnerByEmail = ownerEmailLower.length > 0 && userEmail === ownerEmailLower;
    const isOwnerById = ownerUserId.length > 0 && userId === ownerUserId;
    const isOwner = isOwnerByEmail || isOwnerById;
    
    console.log(`[auth] upsertUser called:`);
    console.log(`[auth]   - userData.id: "${userId}"`);
    console.log(`[auth]   - userData.email: "${userData.email}"`);
    console.log(`[auth]   - userEmail (normalized): "${userEmail}"`);
    console.log(`[auth]   - OWNER_EMAIL env: "${ownerEmail}"`);
    console.log(`[auth]   - OWNER_USER_ID env: "${ownerUserId}"`);
    console.log(`[auth]   - isOwnerByEmail: ${isOwnerByEmail}, isOwnerById: ${isOwnerById}, isOwner: ${isOwner}`);
    
    // Check if user already exists
    const existingUser = await this.getUser(userData.id!);
    
    if (existingUser) {
      // For owner, ALWAYS ensure they have full access (update every login)
      if (isOwner) {
        console.log(`[auth] Updating owner account with full enterprise access for ${userEmail}`);
        const [user] = await db
          .update(users)
          .set({
            email: userData.email,
            profileImageUrl: userData.profileImageUrl,
            profileCompleted: true,
            billingCompleted: true,
            billingStatus: 'active',
            subscriptionTier: 'enterprise',
            isAdmin: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userData.id!))
          .returning();
        console.log(`[auth] Owner updated: profileCompleted=${user.profileCompleted}, billingCompleted=${user.billingCompleted}`);
        return user;
      }
      
      // Regular existing user - only update basic profile info from Replit, preserve everything else
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    } else {
      // New user
      if (isOwner) {
        // Owner gets full enterprise access immediately
        console.log(`[auth] Creating owner account with full enterprise access`);
        const [user] = await db
          .insert(users)
          .values({
            ...userData,
            profileCompleted: true,
            billingCompleted: true,
            billingStatus: 'active',
            subscriptionTier: 'enterprise',
            isAdmin: true,
          })
          .returning();
        return user;
      }
      
      // Regular new user - set 14-day trial and mark profile as incomplete
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
      
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          profileCompleted: false,
          billingCompleted: false,
          trialEndsAt: trialEndsAt,
          subscriptionTier: null, // No tier until they complete onboarding
        })
        .returning();
      
      console.log(`[auth] New user created with 14-day trial ending ${trialEndsAt.toISOString()}`);
      return user;
    }
  }
}

export const authStorage = new AuthStorage();
