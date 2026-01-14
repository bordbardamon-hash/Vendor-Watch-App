import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

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
    // Check if user already exists
    const existingUser = await this.getUser(userData.id!);
    
    if (existingUser) {
      // Existing user - only update basic profile info from Replit, preserve everything else
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
      // New user - set 7-day trial and mark profile as incomplete
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);
      
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          profileCompleted: false,
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
