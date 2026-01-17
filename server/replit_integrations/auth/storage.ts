import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Owner email that bypasses onboarding and has full enterprise + admin access
// Stored in environment variable for security
const OWNER_EMAIL = process.env.OWNER_EMAIL || "";

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
    // Check if this is the owner email - they get full access automatically
    const isOwner = userData.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
    
    // Check if user already exists
    const existingUser = await this.getUser(userData.id!);
    
    if (existingUser) {
      // For owner, ensure they always have full access
      if (isOwner && (!existingUser.profileCompleted || !existingUser.billingCompleted || !existingUser.isAdmin)) {
        console.log(`[auth] Updating owner account with full enterprise access`);
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
      
      // Regular new user - set 7-day trial and mark profile as incomplete
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);
      
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
      
      console.log(`[auth] New user created with 7-day trial ending ${trialEndsAt.toISOString()}`);
      return user;
    }
  }
}

export const authStorage = new AuthStorage();
