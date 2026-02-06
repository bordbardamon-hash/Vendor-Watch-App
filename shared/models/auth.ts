import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organization member roles
export const MEMBER_ROLES = ['master_admin', 'member_rw', 'member_ro'] as const;
export type MemberRole = typeof MEMBER_ROLES[number];

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Subscription tier type
export type SubscriptionTier = 'essential' | 'growth' | 'enterprise' | null;

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"), // bcrypt hashed password for email/password auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  companyName: varchar("company_name"),
  phone: varchar("phone"),
  organizationId: varchar("organization_id"), // links user to their organization
  notificationEmail: varchar("notification_email"), // separate from auth email, for receiving alerts
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionTier: varchar("subscription_tier"), // 'essential', 'growth', 'enterprise'
  isAdmin: boolean("is_admin").default(false),
  isOwner: boolean("is_owner").default(false), // Owner receives parser/system alerts
  notifyEmail: boolean("notify_email").default(false),
  notifySms: boolean("notify_sms").default(false),
  // Timezone preference for alerts and dashboard display
  timezone: varchar("timezone").default("UTC"),
  // Two-Factor Authentication fields
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret"), // encrypted TOTP secret
  twoFactorRecoveryCodes: varchar("two_factor_recovery_codes"), // comma-separated encrypted recovery codes
  // Password reset fields
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  // Onboarding and trial fields
  profileCompleted: boolean("profile_completed").default(false),
  billingCompleted: boolean("billing_completed").default(false), // True when Stripe checkout is done
  billingStatus: varchar("billing_status"), // 'trialing', 'active', 'past_due', 'canceled', 'incomplete'
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Organizations table - groups users under a shared subscription
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  primaryDomain: varchar("primary_domain").notNull(), // e.g., "company.com" - only users with matching email domain can join
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionTier: varchar("subscription_tier"), // 'essential', 'growth', 'enterprise'
  createdBy: varchar("created_by").notNull(), // user ID who created the org
  maxMasterAdmins: integer("max_master_admins").default(3),
  // Per-seat pricing fields
  includedSeats: integer("included_seats").default(1), // Seats included in base plan (Essential=1, Growth=3, Enterprise=5)
  additionalSeats: integer("additional_seats").default(0), // Paid extra seats beyond included
  seatSubscriptionItemId: varchar("seat_subscription_item_id"), // Stripe subscription item ID for seat add-on
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// Organization members - links users to organizations with roles
export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: varchar("role").notNull().default('member_ro'), // 'master_admin', 'member_rw', 'member_ro'
  invitedBy: varchar("invited_by"), // user ID who invited this member
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({ id: true, createdAt: true });
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;

// Organization invitations - pending invites that haven't been accepted yet
export const organizationInvitations = pgTable("organization_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  email: varchar("email").notNull(),
  role: varchar("role").notNull().default('member_ro'), // 'master_admin', 'member_rw', 'member_ro'
  invitedBy: varchar("invited_by").notNull(), // user ID who sent the invite
  token: varchar("token").notNull().unique(), // secure token for accepting
  expiresAt: timestamp("expires_at").notNull(),
  status: varchar("status").notNull().default('pending'), // 'pending', 'accepted', 'expired', 'cancelled'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrganizationInvitationSchema = createInsertSchema(organizationInvitations).omit({ id: true, createdAt: true });
export type InsertOrganizationInvitation = z.infer<typeof insertOrganizationInvitationSchema>;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;

// Alert Assignments - master admins assign specific vendors/blockchains to team members
export const orgAlertAssignments = pgTable("org_alert_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  memberUserId: varchar("member_user_id").notNull(),
  targetType: varchar("target_type").notNull(), // 'vendor' or 'blockchain'
  targetKey: varchar("target_key").notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrgAlertAssignmentSchema = createInsertSchema(orgAlertAssignments).omit({ id: true, createdAt: true });
export type InsertOrgAlertAssignment = z.infer<typeof insertOrgAlertAssignmentSchema>;
export type OrgAlertAssignment = typeof orgAlertAssignments.$inferSelect;

// Mobile auth tokens table - for native mobile app authentication
export const mobileAuthTokens = pgTable("mobile_auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: varchar("token").notNull().unique(), // The bearer token
  deviceInfo: varchar("device_info"), // Optional device identifier
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at").notNull(), // Token expiration
  revokedAt: timestamp("revoked_at"), // Null if active, timestamp if revoked
  createdAt: timestamp("created_at").defaultNow(),
});

export type MobileAuthToken = typeof mobileAuthTokens.$inferSelect;
export type InsertMobileAuthToken = typeof mobileAuthTokens.$inferInsert;

// Mobile auth codes table - temporary codes exchanged for tokens
export const mobileAuthCodes = pgTable("mobile_auth_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").notNull().unique(),
  userId: varchar("user_id").notNull(),
  email: varchar("email"),
  displayName: varchar("display_name"),
  avatarUrl: varchar("avatar_url"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // Null if unused, timestamp when exchanged
  createdAt: timestamp("created_at").defaultNow(),
});

export type MobileAuthCode = typeof mobileAuthCodes.$inferSelect;
export type InsertMobileAuthCode = typeof mobileAuthCodes.$inferInsert;

// Pending signups table - stores signup data until Stripe payment completes
// Account is only created after webhook confirms payment success
export const pendingSignups = pgTable("pending_signups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signupToken: varchar("signup_token").notNull().unique(), // Token for mobile to retrieve auth after payment
  email: varchar("email").notNull(),
  passwordHash: varchar("password_hash").notNull(), // bcrypt hashed password
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  companyName: varchar("company_name"),
  phone: varchar("phone"),
  tier: varchar("tier").notNull(), // 'essential', 'growth', 'enterprise'
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id"), // Links to Stripe session
  completedAt: timestamp("completed_at"), // Set when user created after payment
  createdUserId: varchar("created_user_id"), // Links to created user after payment
  tokenExchangedAt: timestamp("token_exchanged_at"), // Set when token exchanged for auth - prevents reuse
  expiresAt: timestamp("expires_at").notNull(), // Expires after 24 hours if not completed
  createdAt: timestamp("created_at").defaultNow(),
});

export type PendingSignup = typeof pendingSignups.$inferSelect;
export type InsertPendingSignup = typeof pendingSignups.$inferInsert;
