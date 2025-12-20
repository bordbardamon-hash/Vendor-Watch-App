import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models (users and sessions tables for Replit Auth)
export * from "./models/auth";

// Vendors - third-party services being monitored
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  statusUrl: text("status_url").notNull(),
  parser: text("parser").notNull(),
  status: text("status").notNull().default('operational'),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Incidents - outages and issues detected from vendors
export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key").notNull(),
  incidentId: text("incident_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  severity: text("severity").notNull(),
  impact: text("impact").notNull(),
  url: text("url").notNull(),
  rawHash: text("raw_hash"),
  startedAt: text("started_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Jobs - scraping tasks and schedules
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  target: text("target").notNull(),
  schedule: text("schedule").notNull(),
  status: text("status").notNull().default('idle'),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  success: boolean("success").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Configuration - alert and notification settings
export const config = pgTable("config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Feedback - user suggestions and bug reports
export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  type: text("type").notNull(), // 'suggestion' or 'bug'
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default('open'), // 'open', 'in_progress', 'resolved', 'closed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Incident Alerts - track sent notifications to prevent duplicates
export const incidentAlerts = pgTable("incident_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: text("incident_id").notNull(),
  userId: text("user_id").notNull(),
  channel: text("channel").notNull(), // 'sms' or 'email'
  eventType: text("event_type").notNull(), // 'new', 'update', 'resolved'
  statusSnapshot: text("status_snapshot").notNull(), // the incident status at time of alert
  destination: text("destination").notNull(), // phone number or email address
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Custom Vendor Requests - for Standard/Gold users to request new vendors
export const customVendorRequests = pgTable("custom_vendor_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  statusPageUrl: text("status_page_url").notNull(),
  integrationNotes: text("integration_notes"), // user's notes about integration requirements
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected', 'integrated'
  adminNotes: text("admin_notes"), // admin feedback on request
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User Vendor Order - custom ordering of vendors per user
export const userVendorOrder = pgTable("user_vendor_order", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  vendorKey: text("vendor_key").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User Vendor Subscriptions - which vendors each user monitors
export const userVendorSubscriptions = pgTable("user_vendor_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  vendorKey: text("vendor_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notification Consents - proof of opt-in for SMS/Email (Twilio compliance)
export const notificationConsents = pgTable("notification_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userEmail: text("user_email"),
  channel: text("channel").notNull(), // 'sms' or 'email'
  destination: text("destination").notNull(), // phone number or email address
  consentText: text("consent_text").notNull(), // the exact text user agreed to
  consentMethod: text("consent_method").notNull(), // 'checkbox', 'dialog', etc.
  sourceContext: text("source_context").notNull(), // where consent was collected (e.g., 'Dashboard > SMS Alerts')
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentedAt: timestamp("consented_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

// Insert schemas
export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export const insertConfigSchema = createInsertSchema(config).omit({
  id: true,
  updatedAt: true,
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationConsentSchema = createInsertSchema(notificationConsents).omit({
  id: true,
  consentedAt: true,
  revokedAt: true,
});

export const insertIncidentAlertSchema = createInsertSchema(incidentAlerts).omit({
  id: true,
  sentAt: true,
});

export const insertUserVendorSubscriptionSchema = createInsertSchema(userVendorSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertUserVendorOrderSchema = createInsertSchema(userVendorOrder).omit({
  id: true,
  createdAt: true,
});

export const insertCustomVendorRequestSchema = createInsertSchema(customVendorRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertConfig = z.infer<typeof insertConfigSchema>;
export type Config = typeof config.$inferSelect;

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

export type InsertNotificationConsent = z.infer<typeof insertNotificationConsentSchema>;
export type NotificationConsent = typeof notificationConsents.$inferSelect;

export type InsertIncidentAlert = z.infer<typeof insertIncidentAlertSchema>;
export type IncidentAlert = typeof incidentAlerts.$inferSelect;

export type InsertUserVendorSubscription = z.infer<typeof insertUserVendorSubscriptionSchema>;
export type UserVendorSubscription = typeof userVendorSubscriptions.$inferSelect;

export type InsertUserVendorOrder = z.infer<typeof insertUserVendorOrderSchema>;
export type UserVendorOrder = typeof userVendorOrder.$inferSelect;

export type InsertCustomVendorRequest = z.infer<typeof insertCustomVendorRequestSchema>;
export type CustomVendorRequest = typeof customVendorRequests.$inferSelect;

// Subscription tier constants
export const SUBSCRIPTION_TIERS = {
  standard: { name: 'Standard', price: 89.99, vendorLimit: 10, customVendorRequests: 0 },
  gold: { name: 'Gold', price: 99.99, vendorLimit: 25, customVendorRequests: 5 },
  platinum: { name: 'Platinum', price: 129.99, vendorLimit: null, customVendorRequests: null },
} as const;
