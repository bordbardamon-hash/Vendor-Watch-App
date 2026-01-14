import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { db } from "../../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

// Onboarding schema - all fields required to complete profile
const onboardingSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  phone: z.string().min(1, "Phone number is required"),
  notificationEmail: z.string().email("Valid email is required").optional(),
});

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Complete onboarding - save required profile information
  app.post("/api/onboarding/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const result = onboardingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid profile data", 
          details: result.error.flatten().fieldErrors 
        });
      }

      const { firstName, lastName, companyName, phone, notificationEmail } = result.data;

      // Update user profile and mark as completed
      const [updatedUser] = await db
        .update(users)
        .set({
          firstName,
          lastName,
          companyName,
          phone,
          notificationEmail: notificationEmail || null,
          profileCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      console.log(`[onboarding] User ${userId} completed onboarding`);
      res.json({ 
        success: true, 
        user: updatedUser,
        message: "Profile completed successfully" 
      });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // Check onboarding status
  app.get("/api/onboarding/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        profileCompleted: user.profileCompleted ?? false,
        trialEndsAt: user.trialEndsAt,
        hasSubscription: !!user.subscriptionTier,
        subscriptionTier: user.subscriptionTier,
      });
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      res.status(500).json({ error: "Failed to check onboarding status" });
    }
  });
}
