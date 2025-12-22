import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean } from "drizzle-orm/pg-core";

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
export type SubscriptionTier = 'standard' | 'gold' | 'platinum' | null;

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  companyName: varchar("company_name"),
  phone: varchar("phone"),
  notificationEmail: varchar("notification_email"), // separate from auth email, for receiving alerts
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionTier: varchar("subscription_tier"), // 'standard', 'gold', 'platinum'
  isAdmin: boolean("is_admin").default(false),
  isOwner: boolean("is_owner").default(false), // Owner receives parser/system alerts
  notifyEmail: boolean("notify_email").default(true),
  notifySms: boolean("notify_sms").default(false),
  // Two-Factor Authentication fields
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret"), // encrypted TOTP secret
  twoFactorRecoveryCodes: varchar("two_factor_recovery_codes"), // comma-separated encrypted recovery codes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
