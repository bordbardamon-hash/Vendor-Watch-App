import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models (users and sessions tables for Replit Auth)
export * from "./models/auth";

// Export chat models for AI integration
export * from "./models/chat";

// Canonical status values for incidents
export const CANONICAL_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
export type CanonicalStatus = typeof CANONICAL_STATUSES[number];

// Canonical severity values for incidents
export const CANONICAL_SEVERITIES = ['critical', 'major', 'minor', 'info'] as const;
export type CanonicalSeverity = typeof CANONICAL_SEVERITIES[number];

// Incident lifecycle event types
export const LIFECYCLE_EVENTS = ['new', 'escalation', 'update', 'resolved', 'long_running'] as const;
export type LifecycleEvent = typeof LIFECYCLE_EVENTS[number];

// Vendors - third-party services being monitored
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  statusUrl: text("status_url").notNull(),
  parser: text("parser").notNull(),
  category: text("category").default('Other'),
  status: text("status").notNull().default('operational'),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userVendorFavorites = pgTable("user_vendor_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  vendorKey: text("vendor_key").notNull(),
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
  manuallyResolvedAt: timestamp("manually_resolved_at"), // Set when stale cleanup resolves - sync respects this
});

// Incident Archive - resolved incidents moved here after 3 days, searchable for 1 year
export const incidentArchive = pgTable("incident_archive", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalId: text("original_id").notNull(),
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
  resolvedAt: timestamp("resolved_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  archivedAt: timestamp("archived_at").notNull().defaultNow(),
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
  deliveryStatus: text("delivery_status").notNull().default('success'), // 'pending', 'success', 'failed'
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
}, (t) => [
  // Unique constraint to prevent duplicate notifications via atomic insert
  unique('unique_alert').on(t.incidentId, t.userId, t.channel, t.eventType, t.statusSnapshot)
]);

// Notification Queue - retry failed notifications
export const notificationQueue = pgTable("notification_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  channel: text("channel").notNull(), // 'sms' or 'email'
  destination: text("destination").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'sent', 'failed'
  errorMessage: text("error_message"),
  nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// System Health State - track scheduler runs and service health
export const systemHealthState = pgTable("system_health_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  componentName: text("component_name").notNull().unique(), // 'vendor_sync', 'blockchain_sync', 'email_service', 'sms_service'
  status: text("status").notNull().default('healthy'), // 'healthy', 'degraded', 'down'
  lastRunAt: timestamp("last_run_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastErrorMessage: text("last_error_message"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  metadata: text("metadata"), // JSON string for extra info
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Custom Vendor Requests - for Growth users to request new vendors
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

// Parser Health - track parser reliability and failures
export const parserHealth = pgTable("parser_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key").notNull().unique(),
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  totalSuccesses: integer("total_successes").notNull().default(0),
  totalFailures: integer("total_failures").notNull().default(0),
  lastHttpStatus: integer("last_http_status"),
  lastErrorMessage: text("last_error_message"),
  incidentsParsed: integer("incidents_parsed").notNull().default(0),
  isHealthy: boolean("is_healthy").notNull().default(true),
  alertSentAt: timestamp("alert_sent_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Alert Cooldowns - prevent notification spam
export const alertCooldowns = pgTable("alert_cooldowns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: text("incident_id").notNull(),
  userId: text("user_id").notNull(),
  lastAlertAt: timestamp("last_alert_at").notNull().defaultNow(),
  alertCount: integer("alert_count").notNull().default(1),
  lastSeverity: text("last_severity").notNull(),
  lastStatus: text("last_status").notNull(),
});

// Customer Impact Levels
export const CUSTOMER_IMPACT_LEVELS = ['high', 'medium', 'low'] as const;
export type CustomerImpactLevel = typeof CUSTOMER_IMPACT_LEVELS[number];

// User Vendor Subscriptions - which vendors each user monitors (with impact tagging)
export const userVendorSubscriptions = pgTable("user_vendor_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  vendorKey: text("vendor_key").notNull(),
  customerImpact: text("customer_impact").notNull().default('medium'),
  componentFilters: text("component_filters").array(),
  alertOnNew: boolean("alert_on_new").notNull().default(true),
  alertOnUpdate: boolean("alert_on_update").notNull().default(true),
  alertOnResolved: boolean("alert_on_resolved").notNull().default(true),
  alertOnMaintenance: boolean("alert_on_maintenance").notNull().default(true),
  maintenanceReminder: boolean("maintenance_reminder").notNull().default(false),
  maintenanceReminderMinutes: integer("maintenance_reminder_minutes").notNull().default(60),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Vendor Reliability Stats - aggregated reliability metrics
export const vendorReliabilityStats = pgTable("vendor_reliability_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key").notNull().unique(),
  incidents30Days: integer("incidents_30_days").notNull().default(0),
  incidents90Days: integer("incidents_90_days").notNull().default(0),
  avgResolutionMinutes: integer("avg_resolution_minutes"),
  escalationPercent: integer("escalation_percent").notNull().default(0),
  longRunningCount: integer("long_running_count").notNull().default(0),
  reliabilityRating: text("reliability_rating").notNull().default('good'), // 'good', 'fair', 'poor'
  lastCalculatedAt: timestamp("last_calculated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Weekly Digest Tracking - track when digests were sent
export const weeklyDigests = pgTable("weekly_digests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  weekStartDate: text("week_start_date").notNull(), // ISO date string for the week
  incidentCount: integer("incident_count").notNull().default(0),
  vendorsAffected: text("vendors_affected"), // comma-separated list
  longestIncidentMinutes: integer("longest_incident_minutes"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
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

// Incident Acknowledgements - track which incidents users have acknowledged to stop notifications
export const incidentAcknowledgements = pgTable("incident_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  incidentId: text("incident_id").notNull(), // references incidents.id
  incidentType: text("incident_type").notNull().default('vendor'), // 'vendor' or 'blockchain'
  acknowledgedAt: timestamp("acknowledged_at").notNull().defaultNow(),
});

// Maintenance Acknowledgements - track which maintenances users have acknowledged to stop notifications
export const maintenanceAcknowledgements = pgTable("maintenance_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  maintenanceId: text("maintenance_id").notNull(), // references vendorMaintenances.id or blockchainMaintenances.id
  maintenanceType: text("maintenance_type").notNull().default('vendor'), // 'vendor' or 'blockchain'
  acknowledgedAt: timestamp("acknowledged_at").notNull().defaultNow(),
});

// Maintenance statuses
export const MAINTENANCE_STATUSES = ['scheduled', 'in_progress', 'verifying', 'completed'] as const;
export type MaintenanceStatus = typeof MAINTENANCE_STATUSES[number];

// Vendor Maintenances - scheduled maintenance windows from vendor status pages
export const vendorMaintenances = pgTable("vendor_maintenances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key").notNull(),
  maintenanceId: text("maintenance_id").notNull(), // External ID from status page
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default('scheduled'), // scheduled, in_progress, verifying, completed
  impact: text("impact").notNull().default('maintenance'), // none, minor, major, critical
  url: text("url"),
  scheduledStartAt: text("scheduled_start_at").notNull(),
  scheduledEndAt: text("scheduled_end_at"),
  actualStartAt: text("actual_start_at"),
  actualEndAt: text("actual_end_at"),
  affectedComponents: text("affected_components"), // comma-separated list
  rawHash: text("raw_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Blockchain Maintenances - scheduled maintenance for blockchain infrastructure
export const blockchainMaintenances = pgTable("blockchain_maintenances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chainKey: text("chain_key").notNull(),
  maintenanceId: text("maintenance_id").notNull(), // External ID from status page
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default('scheduled'), // scheduled, in_progress, verifying, completed
  impact: text("impact").notNull().default('maintenance'),
  url: text("url"),
  scheduledStartAt: text("scheduled_start_at").notNull(),
  scheduledEndAt: text("scheduled_end_at"),
  actualStartAt: text("actual_start_at"),
  actualEndAt: text("actual_end_at"),
  affectedServices: text("affected_services"), // comma-separated list
  rawHash: text("raw_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Maintenance Reminder Tracking - prevent duplicate reminders
export const maintenanceRemindersSent = pgTable("maintenance_reminders_sent", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  maintenanceId: text("maintenance_id").notNull(),
  vendorKey: text("vendor_key").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

// Insert schemas for core tables
export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
});

export const insertIncidentArchiveSchema = createInsertSchema(incidentArchive).omit({
  id: true,
  archivedAt: true,
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

export const insertNotificationQueueSchema = createInsertSchema(notificationQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemHealthStateSchema = createInsertSchema(systemHealthState).omit({
  id: true,
  updatedAt: true,
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

export const insertParserHealthSchema = createInsertSchema(parserHealth).omit({
  id: true,
  updatedAt: true,
});

export const insertAlertCooldownSchema = createInsertSchema(alertCooldowns).omit({
  id: true,
});

export const insertVendorReliabilityStatsSchema = createInsertSchema(vendorReliabilityStats).omit({
  id: true,
  lastCalculatedAt: true,
  updatedAt: true,
});

export const insertWeeklyDigestSchema = createInsertSchema(weeklyDigests).omit({
  id: true,
  sentAt: true,
});

export const insertIncidentAcknowledgementSchema = createInsertSchema(incidentAcknowledgements).omit({
  id: true,
  acknowledgedAt: true,
});

export const insertMaintenanceAcknowledgementSchema = createInsertSchema(maintenanceAcknowledgements).omit({
  id: true,
  acknowledgedAt: true,
});

export const insertVendorMaintenanceSchema = createInsertSchema(vendorMaintenances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlockchainMaintenanceSchema = createInsertSchema(blockchainMaintenances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserVendorFavoriteSchema = createInsertSchema(userVendorFavorites).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

export type InsertUserVendorFavorite = z.infer<typeof insertUserVendorFavoriteSchema>;
export type UserVendorFavorite = typeof userVendorFavorites.$inferSelect;

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

export type InsertIncidentArchive = z.infer<typeof insertIncidentArchiveSchema>;
export type IncidentArchive = typeof incidentArchive.$inferSelect;

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

export type InsertNotificationQueue = z.infer<typeof insertNotificationQueueSchema>;
export type NotificationQueueItem = typeof notificationQueue.$inferSelect;

export type InsertSystemHealthState = z.infer<typeof insertSystemHealthStateSchema>;
export type SystemHealthState = typeof systemHealthState.$inferSelect;

export type InsertUserVendorSubscription = z.infer<typeof insertUserVendorSubscriptionSchema>;
export type UserVendorSubscription = typeof userVendorSubscriptions.$inferSelect;

export type InsertUserVendorOrder = z.infer<typeof insertUserVendorOrderSchema>;
export type UserVendorOrder = typeof userVendorOrder.$inferSelect;

export type InsertCustomVendorRequest = z.infer<typeof insertCustomVendorRequestSchema>;
export type CustomVendorRequest = typeof customVendorRequests.$inferSelect;

export type InsertParserHealth = z.infer<typeof insertParserHealthSchema>;
export type ParserHealth = typeof parserHealth.$inferSelect;

export type InsertAlertCooldown = z.infer<typeof insertAlertCooldownSchema>;
export type AlertCooldown = typeof alertCooldowns.$inferSelect;

export type InsertVendorReliabilityStats = z.infer<typeof insertVendorReliabilityStatsSchema>;
export type VendorReliabilityStats = typeof vendorReliabilityStats.$inferSelect;

export type InsertWeeklyDigest = z.infer<typeof insertWeeklyDigestSchema>;
export type WeeklyDigest = typeof weeklyDigests.$inferSelect;

export type InsertIncidentAcknowledgement = z.infer<typeof insertIncidentAcknowledgementSchema>;
export type IncidentAcknowledgement = typeof incidentAcknowledgements.$inferSelect;

export type InsertMaintenanceAcknowledgement = z.infer<typeof insertMaintenanceAcknowledgementSchema>;
export type MaintenanceAcknowledgement = typeof maintenanceAcknowledgements.$inferSelect;

export type InsertVendorMaintenance = z.infer<typeof insertVendorMaintenanceSchema>;
export type VendorMaintenance = typeof vendorMaintenances.$inferSelect;

export type InsertBlockchainMaintenance = z.infer<typeof insertBlockchainMaintenanceSchema>;
export type BlockchainMaintenance = typeof blockchainMaintenances.$inferSelect;

// Subscription tier constants with per-seat pricing
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    vendorLimit: 2,
    customVendorRequests: 0,
    blockchainLimit: 1,
    smsEnabled: false,
    slackEnabled: false,
    webhookEnabled: false,
    automationEnabled: false,
    aiCopilotEnabled: false,
    stakingEnabled: false,
    includedSeats: 1,
    seatPrice: 0,
    supportsSeats: false,
  },
  essential: { 
    name: 'Essential', 
    price: 89, 
    vendorLimit: 25, 
    customVendorRequests: 0, 
    blockchainLimit: 0,
    smsEnabled: false,
    slackEnabled: true,
    webhookEnabled: true,
    automationEnabled: false,
    aiCopilotEnabled: false,
    stakingEnabled: false,
    includedSeats: 1,
    seatPrice: 0,
    supportsSeats: false,
  },
  growth: { 
    name: 'Growth', 
    price: 129, 
    vendorLimit: 100, 
    customVendorRequests: 5, 
    blockchainLimit: 25,
    smsEnabled: true,
    slackEnabled: true,
    webhookEnabled: true,
    automationEnabled: true,
    aiCopilotEnabled: false,
    stakingEnabled: false,
    includedSeats: 3,
    seatPrice: 20,
    supportsSeats: true,
  },
  enterprise: { 
    name: 'Enterprise', 
    price: 189, 
    vendorLimit: null, 
    customVendorRequests: null, 
    blockchainLimit: null,
    smsEnabled: true,
    slackEnabled: true,
    webhookEnabled: true,
    automationEnabled: true,
    aiCopilotEnabled: true,
    stakingEnabled: true,
    includedSeats: 5,
    seatPrice: 25,
    supportsSeats: true,
  },
} as const;

export type SubscriptionTierKey = keyof typeof SUBSCRIPTION_TIERS;

// ==========================================
// BLOCKCHAIN INFRASTRUCTURE MONITORING
// ==========================================

// Blockchain tier classifications
export const BLOCKCHAIN_TIERS = ['tier1', 'tier2', 'tier3', 'tier4'] as const;
export type BlockchainTier = typeof BLOCKCHAIN_TIERS[number];

// Blockchain categories
export const BLOCKCHAIN_CATEGORIES = ['chain', 'l2', 'rpc_provider', 'indexer', 'bridge', 'explorer'] as const;
export type BlockchainCategory = typeof BLOCKCHAIN_CATEGORIES[number];

// Blockchain incident types
export const BLOCKCHAIN_INCIDENT_TYPES = [
  'block_halt',           // Block production halted
  'finality_delay',       // Finality/confirmation delays
  'rpc_unavailable',      // RPC/API unavailable
  'tx_failure_spike',     // Transaction failure rate spike
  'congestion',           // Network congestion beyond threshold
  'chain_reorg',          // Chain reorg above safe depth
  'dependency_failure',   // Dependency failure (sequencer, indexer, bridge)
  'degraded',             // General degraded performance
  'maintenance',          // Scheduled maintenance
] as const;
export type BlockchainIncidentType = typeof BLOCKCHAIN_INCIDENT_TYPES[number];

// Blockchain chains/entities table
export const blockchainChains = pgTable("blockchain_chains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  symbol: text("symbol"),                    // e.g., BTC, ETH, SOL
  logoUrl: text("logo_url"),                 // URL to blockchain/wallet logo image
  tier: text("tier").notNull(),              // tier1, tier2, tier3, tier4
  category: text("category").notNull(),      // chain, l2, rpc_provider, indexer, bridge, explorer
  statusUrl: text("status_url"),             // Official status page URL
  rpcEndpoint: text("rpc_endpoint"),         // RPC endpoint for health checks
  explorerUrl: text("explorer_url"),         // Block explorer URL
  sourceType: text("source_type").notNull(), // statuspage, rpc_probe, api, manual
  status: text("status").notNull().default('operational'), // operational, degraded, outage, unknown
  lastBlockHeight: text("last_block_height"),
  lastBlockTime: timestamp("last_block_time"),
  avgBlockTime: integer("avg_block_time"),   // Average block time in seconds
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Blockchain incidents table
export const blockchainIncidents = pgTable("blockchain_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chainKey: text("chain_key").notNull(),
  incidentId: text("incident_id").notNull(), // External or generated ID
  incidentType: text("incident_type").notNull(), // block_halt, finality_delay, etc.
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(),          // investigating, identified, monitoring, resolved
  severity: text("severity").notNull(),      // critical, major, minor, info
  affectedServices: text("affected_services"), // comma-separated list
  url: text("url"),
  rawHash: text("raw_hash"),
  startedAt: text("started_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  manuallyResolvedAt: timestamp("manually_resolved_at"), // Set when stale cleanup resolves - sync respects this
});

// Blockchain Incident Archive - resolved blockchain incidents moved here after 3 days
export const blockchainIncidentArchive = pgTable("blockchain_incident_archive", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalId: text("original_id").notNull(),
  chainKey: text("chain_key").notNull(),
  incidentId: text("incident_id").notNull(),
  incidentType: text("incident_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(),
  severity: text("severity").notNull(),
  affectedServices: text("affected_services"),
  url: text("url"),
  rawHash: text("raw_hash"),
  startedAt: text("started_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  resolvedAt: timestamp("resolved_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  archivedAt: timestamp("archived_at").notNull().defaultNow(),
});

// Blockchain subscriptions - which chains each user monitors
export const userBlockchainSubscriptions = pgTable("user_blockchain_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  chainKey: text("chain_key").notNull(),
  customerImpact: text("customer_impact").notNull().default('medium'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for blockchain tables
export const insertBlockchainChainSchema = createInsertSchema(blockchainChains).omit({
  id: true,
  createdAt: true,
});

export const insertBlockchainIncidentSchema = createInsertSchema(blockchainIncidents).omit({
  id: true,
  createdAt: true,
});

export const insertUserBlockchainSubscriptionSchema = createInsertSchema(userBlockchainSubscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertBlockchainIncidentArchiveSchema = createInsertSchema(blockchainIncidentArchive).omit({
  id: true,
  archivedAt: true,
});

// Types for blockchain tables
export type InsertBlockchainChain = z.infer<typeof insertBlockchainChainSchema>;
export type BlockchainChain = typeof blockchainChains.$inferSelect;

export type InsertBlockchainIncident = z.infer<typeof insertBlockchainIncidentSchema>;
export type BlockchainIncident = typeof blockchainIncidents.$inferSelect;

export type InsertUserBlockchainSubscription = z.infer<typeof insertUserBlockchainSubscriptionSchema>;
export type UserBlockchainSubscription = typeof userBlockchainSubscriptions.$inferSelect;

export type InsertBlockchainIncidentArchive = z.infer<typeof insertBlockchainIncidentArchiveSchema>;
export type BlockchainIncidentArchive = typeof blockchainIncidentArchive.$inferSelect;

// Analytics - User Activity Events
export const USER_ACTIVITY_TYPES = ['login', 'page_view', 'incident_ack', 'maintenance_ack', 'settings_change'] as const;
export type UserActivityType = typeof USER_ACTIVITY_TYPES[number];

export const userActivityEvents = pgTable("user_activity_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  metadata: text("metadata"), // JSON string for additional context (page path, incident ID, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Analytics - Vendor Daily Metrics (aggregated stats per vendor per day)
export const vendorDailyMetrics = pgTable("vendor_daily_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  uptimeMinutes: integer("uptime_minutes").notNull().default(0),
  downtimeMinutes: integer("downtime_minutes").notNull().default(0),
  incidentCount: integer("incident_count").notNull().default(0),
  avgResolutionMinutes: integer("avg_resolution_minutes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas for analytics tables
export const insertUserActivityEventSchema = createInsertSchema(userActivityEvents).omit({
  id: true,
  createdAt: true,
});

export const insertVendorDailyMetricsSchema = createInsertSchema(vendorDailyMetrics).omit({
  id: true,
  createdAt: true,
});

// Types for analytics tables
export type InsertUserActivityEvent = z.infer<typeof insertUserActivityEventSchema>;
export type UserActivityEvent = typeof userActivityEvents.$inferSelect;

export type InsertVendorDailyMetrics = z.infer<typeof insertVendorDailyMetricsSchema>;
export type VendorDailyMetrics = typeof vendorDailyMetrics.$inferSelect;

// ==========================================
// PSA WEBHOOKS INTEGRATION
// ==========================================

export const PSA_PLATFORMS = ['connectwise', 'autotask', 'custom'] as const;
export type PsaPlatform = typeof PSA_PLATFORMS[number];

export const WEBHOOK_EVENTS = ['incident_created', 'incident_updated', 'incident_resolved', 'maintenance_scheduled'] as const;
export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export const psaWebhooks = pgTable("psa_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // connectwise, autotask, custom
  webhookUrl: text("webhook_url").notNull(),
  secret: text("secret"), // Optional HMAC secret for signature verification
  events: text("events").notNull(), // comma-separated list of events to trigger on
  isActive: boolean("is_active").notNull().default(true),
  lastTriggered: timestamp("last_triggered"),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPsaWebhookSchema = createInsertSchema(psaWebhooks).omit({
  id: true,
  lastTriggered: true,
  successCount: true,
  failureCount: true,
  createdAt: true,
});

export type InsertPsaWebhook = z.infer<typeof insertPsaWebhookSchema>;
export type PsaWebhook = typeof psaWebhooks.$inferSelect;

// ==========================================
// AUTONOMOUS RESPONSE ORCHESTRATOR
// ==========================================

export const AUTOMATION_TRIGGER_TYPES = ['incident_created', 'incident_escalated', 'incident_resolved', 'sla_breach', 'long_running'] as const;
export type AutomationTriggerType = typeof AUTOMATION_TRIGGER_TYPES[number];

export const AUTOMATION_ACTION_TYPES = ['create_ticket', 'send_slack', 'send_teams', 'call_escalation', 'send_email', 'webhook'] as const;
export type AutomationActionType = typeof AUTOMATION_ACTION_TYPES[number];

// Runbook templates for incident response
export const runbooks = pgTable("runbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  vendorKey: text("vendor_key"), // null = applies to all vendors
  severityFilter: text("severity_filter"), // comma-separated: critical,major,minor
  steps: text("steps").notNull(), // JSON array of steps
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Escalation policies (call trees)
export const escalationPolicies = pgTable("escalation_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  levels: text("levels").notNull(), // JSON array of escalation levels with contacts
  delayMinutes: integer("delay_minutes").notNull().default(15), // Time before escalating to next level
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Automation rules - when X happens, do Y
export const automationRules = pgTable("automation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(), // incident_created, incident_escalated, etc.
  conditions: text("conditions").notNull(), // JSON: severity, vendor, time conditions
  actionType: text("action_type").notNull(), // create_ticket, send_slack, etc.
  actionConfig: text("action_config").notNull(), // JSON: action-specific config
  runbookId: text("runbook_id"), // Optional linked runbook
  escalationPolicyId: text("escalation_policy_id"), // Optional linked escalation policy
  requiresApproval: boolean("requires_approval").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  executionCount: integer("execution_count").notNull().default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Pending automation approvals (for human-in-the-loop)
export const automationApprovals = pgTable("automation_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: text("rule_id").notNull(),
  incidentId: text("incident_id").notNull(),
  userId: text("user_id").notNull(), // User who should approve
  actionType: text("action_type").notNull(),
  actionPayload: text("action_payload").notNull(), // JSON: what would be executed
  status: text("status").notNull().default('pending'), // pending, approved, rejected, expired
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Automation audit log - every action taken
export const automationAuditLog = pgTable("automation_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: text("rule_id"),
  incidentId: text("incident_id"),
  userId: text("user_id"),
  actionType: text("action_type").notNull(),
  actionPayload: text("action_payload"), // JSON: what was executed
  result: text("result").notNull(), // success, failed, pending_approval
  errorMessage: text("error_message"),
  executionTimeMs: integer("execution_time_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// SLA Contracts for breach tracking
export const slaContracts = pgTable("sla_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  vendorKey: text("vendor_key").notNull(), // Can be vendor key or chain key
  resourceType: text("resource_type").notNull().default("vendor"), // "vendor" or "blockchain"
  name: text("name").notNull(),
  uptimeTarget: text("uptime_target").notNull(), // e.g., "99.9"
  measurementPeriod: text("measurement_period").notNull(), // monthly, quarterly, annual
  serviceCreditTiers: text("service_credit_tiers").notNull(), // JSON: [{ threshold: 99.0, creditPercent: 10 }]
  contractStartDate: text("contract_start_date").notNull(),
  contractEndDate: text("contract_end_date"),
  notificationEmail: text("notification_email"),
  responseTimeMinutes: integer("response_time_minutes"), // SLA response time requirement
  resolutionTimeMinutes: integer("resolution_time_minutes"), // SLA resolution time requirement
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// SLA Breach records
export const slaBreaches = pgTable("sla_breaches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: text("contract_id").notNull(),
  vendorKey: text("vendor_key").notNull(), // Can be vendor key or chain key
  resourceType: text("resource_type").notNull().default("vendor"), // "vendor" or "blockchain"
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  targetUptime: text("target_uptime").notNull(),
  actualUptime: text("actual_uptime").notNull(),
  downtimeMinutes: integer("downtime_minutes").notNull(),
  creditPercent: text("credit_percent"),
  claimStatus: text("claim_status").notNull().default('detected'), // detected, drafted, submitted, approved, rejected
  claimDraftedAt: timestamp("claim_drafted_at"),
  claimSubmittedAt: timestamp("claim_submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Synthetic monitoring probes
export const syntheticProbes = pgTable("synthetic_probes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  vendorKey: text("vendor_key").notNull(), // Can be vendor key or chain key
  resourceType: text("resource_type").notNull().default("vendor"), // "vendor" or "blockchain"
  probeType: text("probe_type").notNull(), // http, api, page_load
  targetUrl: text("target_url").notNull(),
  expectedStatus: integer("expected_status").default(200),
  timeoutMs: integer("timeout_ms").notNull().default(30000),
  intervalMinutes: integer("interval_minutes").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  lastStatus: text("last_status"), // healthy, degraded, down
  lastLatencyMs: integer("last_latency_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Synthetic probe results history
export const syntheticProbeResults = pgTable("synthetic_probe_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  probeId: text("probe_id").notNull(),
  status: text("status").notNull(), // healthy, degraded, down
  latencyMs: integer("latency_ms"),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  correlatedIncidentId: text("correlated_incident_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==========================================
// MSP CLIENT ORGANIZATION
// ==========================================

// Clients - MSP customer/client labels for organizing vendors
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").default('#6366f1'), // hex color for UI display
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Client Vendor Links - many-to-many relationship between clients and vendors per user
export const clientVendorLinks = pgTable("client_vendor_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  clientId: text("client_id").notNull(),
  vendorKey: text("vendor_key").notNull(),
  priority: text("priority").default('medium'), // high, medium, low
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==========================================
// INCIDENT PLAYBOOKS
// ==========================================

// Incident Playbooks - step-by-step response guidance for incidents
export const incidentPlaybooks = pgTable("incident_playbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  vendorKey: text("vendor_key"), // optional: apply to specific vendor
  incidentType: text("incident_type"), // optional: 'outage', 'degraded', 'maintenance'
  severityFilter: text("severity_filter"), // optional: 'critical', 'major', 'minor'
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Incident Playbook Steps - ordered steps within a playbook
export const incidentPlaybookSteps = pgTable("incident_playbook_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playbookId: text("playbook_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  title: text("title").notNull(),
  guidance: text("guidance").notNull(),
  role: text("role"), // optional: who should perform this step
  expectedDurationMinutes: integer("expected_duration_minutes"),
  isOptional: boolean("is_optional").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User Integrations - webhook URLs and API configurations for automation actions
export const userIntegrations = pgTable("user_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  integrationType: text("integration_type").notNull(), // slack, teams, psa, webhook, escalation_phone
  name: text("name").notNull(), // Display name for this integration
  webhookUrl: text("webhook_url"), // For Slack, Teams, PSA, custom webhooks
  apiKey: text("api_key"), // For PSA systems that require API keys
  phoneNumber: text("phone_number"), // For escalation calls (Twilio)
  additionalConfig: text("additional_config"), // JSON for extra settings
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").default(false), // Default for this integration type
  lastTestedAt: timestamp("last_tested_at"),
  lastTestSuccess: boolean("last_test_success"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas for new tables
export const insertUserIntegrationSchema = createInsertSchema(userIntegrations).omit({ id: true, lastTestedAt: true, lastTestSuccess: true, createdAt: true, updatedAt: true });
export type InsertUserIntegration = z.infer<typeof insertUserIntegrationSchema>;
export type UserIntegration = typeof userIntegrations.$inferSelect;

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientVendorLinkSchema = createInsertSchema(clientVendorLinks).omit({ id: true, createdAt: true });
export const insertIncidentPlaybookSchema = createInsertSchema(incidentPlaybooks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIncidentPlaybookStepSchema = createInsertSchema(incidentPlaybookSteps).omit({ id: true, createdAt: true });

// Types for new tables
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertClientVendorLink = z.infer<typeof insertClientVendorLinkSchema>;
export type ClientVendorLink = typeof clientVendorLinks.$inferSelect;

export type InsertIncidentPlaybook = z.infer<typeof insertIncidentPlaybookSchema>;
export type IncidentPlaybook = typeof incidentPlaybooks.$inferSelect;

export type InsertIncidentPlaybookStep = z.infer<typeof insertIncidentPlaybookStepSchema>;
export type IncidentPlaybookStep = typeof incidentPlaybookSteps.$inferSelect;

// Insert schemas
export const insertRunbookSchema = createInsertSchema(runbooks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEscalationPolicySchema = createInsertSchema(escalationPolicies).omit({ id: true, createdAt: true });
export const insertAutomationRuleSchema = createInsertSchema(automationRules).omit({ id: true, executionCount: true, lastExecutedAt: true, createdAt: true });
export const insertAutomationApprovalSchema = createInsertSchema(automationApprovals).omit({ id: true, approvedBy: true, approvedAt: true, createdAt: true });
export const insertAutomationAuditLogSchema = createInsertSchema(automationAuditLog).omit({ id: true, createdAt: true });
export const insertSlaContractSchema = createInsertSchema(slaContracts).omit({ id: true, createdAt: true });
export const insertSlaBreachSchema = createInsertSchema(slaBreaches).omit({ id: true, createdAt: true });
export const insertSyntheticProbeSchema = createInsertSchema(syntheticProbes).omit({ id: true, lastCheckedAt: true, lastStatus: true, lastLatencyMs: true, createdAt: true });
export const insertSyntheticProbeResultSchema = createInsertSchema(syntheticProbeResults).omit({ id: true, createdAt: true });

// Types
export type InsertRunbook = z.infer<typeof insertRunbookSchema>;
export type Runbook = typeof runbooks.$inferSelect;

export type InsertEscalationPolicy = z.infer<typeof insertEscalationPolicySchema>;
export type EscalationPolicy = typeof escalationPolicies.$inferSelect;

export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type AutomationRule = typeof automationRules.$inferSelect;

export type InsertAutomationApproval = z.infer<typeof insertAutomationApprovalSchema>;
export type AutomationApproval = typeof automationApprovals.$inferSelect;

export type InsertAutomationAuditLog = z.infer<typeof insertAutomationAuditLogSchema>;
export type AutomationAuditLog = typeof automationAuditLog.$inferSelect;

export type InsertSlaContract = z.infer<typeof insertSlaContractSchema>;
export type SlaContract = typeof slaContracts.$inferSelect;

export type InsertSlaBreach = z.infer<typeof insertSlaBreachSchema>;
export type SlaBreach = typeof slaBreaches.$inferSelect;

export type InsertSyntheticProbe = z.infer<typeof insertSyntheticProbeSchema>;
export type SyntheticProbe = typeof syntheticProbes.$inferSelect;

export type InsertSyntheticProbeResult = z.infer<typeof insertSyntheticProbeResultSchema>;
export type SyntheticProbeResult = typeof syntheticProbeResults.$inferSelect;

// ============ WHITE-LABELED CLIENT STATUS PORTALS ============

// Client Portals - branded public status pages for MSP clients
export const clientPortals = pgTable("client_portals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id").notNull(), // Owner organization
  userId: text("user_id").notNull(), // Creator user
  name: text("name").notNull(), // Portal display name
  slug: text("slug").notNull().unique(), // URL slug (e.g., acme-corp)
  customDomain: text("custom_domain"), // Optional custom domain
  isActive: boolean("is_active").notNull().default(true),
  isPublic: boolean("is_public").notNull().default(true), // Public access or require token
  accessToken: text("access_token"), // Optional token for private portals
  accessType: text("access_type").notNull().default('public'), // 'public' | 'password' | 'private'
  accessPassword: text("access_password"), // Hashed password for password-protected portals
  // Branding
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default('#3b82f6'), // Blue default
  secondaryColor: text("secondary_color").default('#1e293b'),
  backgroundColor: text("background_color").default('#0f172a'),
  accentColor: text("accent_color").default('#22c55e'),
  fontFamily: text("font_family").default('Inter'),
  headerText: text("header_text"), // Custom header text
  footerText: text("footer_text"), // Custom footer text
  // Settings
  showIncidentHistory: boolean("show_incident_history").notNull().default(true),
  showUptimeStats: boolean("show_uptime_stats").notNull().default(true),
  showSubscribeOption: boolean("show_subscribe_option").notNull().default(false),
  incidentHistoryDays: integer("incident_history_days").default(30),
  // Metadata
  lastAccessedAt: timestamp("last_accessed_at"),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Portal Vendor Assignments - which vendors appear on each portal
export const portalVendorAssignments = pgTable("portal_vendor_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalId: text("portal_id").notNull(),
  vendorKey: text("vendor_key"), // For vendor monitoring
  chainKey: text("chain_key"), // For blockchain monitoring
  resourceType: text("resource_type").notNull(), // 'vendor' or 'blockchain'
  displayName: text("display_name"), // Optional custom display name
  displayOrder: integer("display_order").default(0),
  showOnPortal: boolean("show_on_portal").notNull().default(true),
  customSlaTarget: text("custom_sla_target"), // e.g., "99.9%"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Portal Subscribers - users who want email updates from a portal
export const portalSubscribers = pgTable("portal_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalId: text("portal_id").notNull(),
  email: text("email").notNull(),
  isVerified: boolean("is_verified").default(false),
  verificationToken: text("verification_token"),
  unsubscribeToken: text("unsubscribe_token"),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

// ============ VENDOR COMPONENTS ============

// Vendor Components - individual service components within each vendor (e.g., AWS EC2, AWS S3)
export const vendorComponents = pgTable("vendor_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key").notNull(),
  componentId: text("component_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  groupName: text("group_name"),
  status: text("status").notNull().default('operational'),
  position: integer("position").default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique('unique_vendor_component').on(t.vendorKey, t.componentId)
]);

export const insertVendorComponentSchema = createInsertSchema(vendorComponents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVendorComponent = z.infer<typeof insertVendorComponentSchema>;
export type VendorComponent = typeof vendorComponents.$inferSelect;

// ============ PSA/TICKETING INTEGRATION ============

// PSA Integrations - organization-level PSA system connections
export const psaIntegrations = pgTable("psa_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id"), // Optional org scope
  userId: text("user_id").notNull(), // Owner user
  name: text("name").notNull(), // Display name
  psaType: text("psa_type").notNull(), // 'connectwise', 'autotask', 'kaseya', 'servicenow', 'jira', 'custom'
  isActive: boolean("is_active").notNull().default(true),
  // Connection credentials (encrypted in practice)
  apiUrl: text("api_url"), // Base API URL
  apiKey: text("api_key"), // API key or token
  apiSecret: text("api_secret"), // API secret if needed
  companyId: text("company_id"), // ConnectWise company ID
  clientId: text("client_id"), // OAuth client ID
  clientSecret: text("client_secret"), // OAuth client secret
  accessToken: text("access_token"), // OAuth access token
  refreshToken: text("refresh_token"), // OAuth refresh token
  tokenExpiresAt: timestamp("token_expires_at"),
  // Configuration
  defaultBoardId: text("default_board_id"), // Default ticket board/queue
  defaultPriorityId: text("default_priority_id"),
  defaultStatusId: text("default_status_id"),
  additionalConfig: text("additional_config"), // JSON for extra settings
  // Status tracking
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncSuccess: boolean("last_sync_success"),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// PSA Ticket Rules - per-vendor/incident rules for ticket creation
export const psaTicketRules = pgTable("psa_ticket_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  psaIntegrationId: text("psa_integration_id").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  // Matching criteria
  vendorKey: text("vendor_key"), // Specific vendor or null for all
  chainKey: text("chain_key"), // Specific blockchain or null for all
  severityFilter: text("severity_filter"), // 'critical', 'major', 'minor', 'any'
  incidentTypeFilter: text("incident_type_filter"), // 'outage', 'degraded', 'maintenance', 'any'
  // Ticket settings
  boardId: text("board_id"), // Override default board
  priorityId: text("priority_id"), // Override default priority
  statusId: text("status_id"), // Override default status
  ticketTypeId: text("ticket_type_id"),
  companyId: text("company_id"), // Assign to specific company
  contactId: text("contact_id"), // Assign to specific contact
  assigneeId: text("assignee_id"), // Auto-assign to technician
  titleTemplate: text("title_template"), // Template for ticket title
  descriptionTemplate: text("description_template"), // Template for description
  autoClose: boolean("auto_close").default(true), // Auto-close when incident resolves
  addUpdates: boolean("add_updates").default(true), // Add ticket notes on updates
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// PSA Ticket Links - mapping between incidents and PSA tickets
export const psaTicketLinks = pgTable("psa_ticket_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  psaIntegrationId: text("psa_integration_id").notNull(),
  incidentId: text("incident_id"), // Internal incident ID
  blockchainIncidentId: text("blockchain_incident_id"), // Or blockchain incident
  psaTicketId: text("psa_ticket_id").notNull(), // External PSA ticket ID
  psaTicketNumber: text("psa_ticket_number"), // Human-readable ticket number
  psaTicketUrl: text("psa_ticket_url"), // Direct link to ticket
  status: text("status").notNull(), // 'open', 'syncing', 'closed', 'error'
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============ PREDICTIVE OUTAGE DETECTION ============

// Vendor Telemetry Metrics - aggregated historical data for predictions
export const vendorTelemetryMetrics = pgTable("vendor_telemetry_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key"),
  chainKey: text("chain_key"),
  resourceType: text("resource_type").notNull(), // 'vendor' or 'blockchain'
  metricDate: timestamp("metric_date").notNull(), // Date of metrics
  dayOfWeek: integer("day_of_week"), // 0-6
  hourOfDay: integer("hour_of_day"), // 0-23
  // Incident counts
  incidentCount: integer("incident_count").default(0),
  criticalCount: integer("critical_count").default(0),
  majorCount: integer("major_count").default(0),
  minorCount: integer("minor_count").default(0),
  maintenanceCount: integer("maintenance_count").default(0),
  // Duration metrics
  totalDowntimeMinutes: integer("total_downtime_minutes").default(0),
  avgResolutionMinutes: integer("avg_resolution_minutes"),
  maxResolutionMinutes: integer("max_resolution_minutes"),
  // Reliability
  uptimePercent: text("uptime_percent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Outage Predictions - AI-generated predictions of potential issues
export const outagePredictions = pgTable("outage_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key"),
  chainKey: text("chain_key"),
  resourceType: text("resource_type").notNull(), // 'vendor' or 'blockchain'
  predictionType: text("prediction_type").notNull(), // 'scheduled_risk', 'pattern_detected', 'anomaly', 'maintenance_window'
  severity: text("severity").notNull(), // 'high', 'medium', 'low'
  confidence: text("confidence").notNull(), // '0.0' to '1.0'
  title: text("title").notNull(),
  description: text("description"),
  predictedStartAt: timestamp("predicted_start_at").notNull(),
  predictedEndAt: timestamp("predicted_end_at"),
  // Pattern data
  patternBasis: text("pattern_basis"), // JSON: what triggered this prediction
  historicalIncidents: text("historical_incidents"), // JSON: related past incidents
  // Status
  status: text("status").notNull().default('active'), // 'active', 'acknowledged', 'dismissed', 'occurred', 'false_positive'
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  actualIncidentId: text("actual_incident_id"), // If prediction came true
  feedbackScore: integer("feedback_score"), // User rating -1, 0, 1
  feedbackNotes: text("feedback_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // When prediction is no longer relevant
});

// Prediction Patterns - learned patterns for recurring issues
export const predictionPatterns = pgTable("prediction_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key"),
  chainKey: text("chain_key"),
  resourceType: text("resource_type").notNull(),
  patternType: text("pattern_type").notNull(), // 'time_based', 'event_correlation', 'seasonal', 'maintenance_cycle'
  patternName: text("pattern_name").notNull(),
  description: text("description"),
  // Pattern details
  dayOfWeek: integer("day_of_week"), // 0-6, null if not applicable
  hourStart: integer("hour_start"), // 0-23
  hourEnd: integer("hour_end"), // 0-23
  occurrenceCount: integer("occurrence_count").default(0),
  lastOccurrence: timestamp("last_occurrence"),
  avgDurationMinutes: integer("avg_duration_minutes"),
  // Confidence metrics
  confidence: text("confidence"), // Pattern strength
  accuracy: text("accuracy"), // Historical prediction accuracy
  // Status
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============ WEBHOOKS ============

// User Webhooks - custom HTTP webhooks for incident alerts
export const userWebhooks = pgTable("user_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(), // Webhook endpoint URL
  secret: text("secret"), // Optional secret for signing payloads
  events: text("events").notNull().default('all'), // JSON array: ['new_incident', 'incident_update', 'incident_resolved'] or 'all'
  vendorKeys: text("vendor_keys"), // JSON array of vendor keys, null = all vendors
  chainKeys: text("chain_keys"), // JSON array of chain keys, null = all chains
  headers: text("headers"), // JSON object of custom headers
  payloadTemplate: text("payload_template"), // Custom JSON template
  isActive: boolean("is_active").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastStatus: integer("last_status"), // Last HTTP status code
  lastError: text("last_error"),
  totalSent: integer("total_sent").notNull().default(0),
  totalFailed: integer("total_failed").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Webhook Logs - track webhook delivery attempts
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: text("webhook_id").notNull(),
  incidentId: text("incident_id"),
  blockchainIncidentId: text("blockchain_incident_id"),
  eventType: text("event_type").notNull(), // 'new_incident', 'incident_update', 'incident_resolved'
  payload: text("payload").notNull(), // JSON payload sent
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  durationMs: integer("duration_ms"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============ API ACCESS ============

// API Keys - for programmatic access
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(), // Hashed API key
  keyPrefix: text("key_prefix").notNull(), // First 8 chars for display (vw_xxxx)
  scopes: text("scopes").notNull().default('read'), // 'read', 'read_write', 'full'
  rateLimit: integer("rate_limit").notNull().default(1000), // Requests per hour
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// API Request Logs - track API usage
export const apiRequestLogs = pgTable("api_request_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: text("api_key_id").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code").notNull(),
  durationMs: integer("duration_ms"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============ AUDIT LOGS ============

// Audit Logs - comprehensive action tracking for compliance
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  userEmail: text("user_email"),
  action: text("action").notNull(), // 'login', 'logout', 'create', 'update', 'delete', 'invite', 'export', etc.
  resourceType: text("resource_type").notNull(), // 'user', 'organization', 'webhook', 'portal', 'incident', 'settings', etc.
  resourceId: text("resource_id"),
  resourceName: text("resource_name"),
  details: text("details"), // JSON with action-specific details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============ SSO/SAML ============

// SSO Configurations - Enterprise SAML/SSO settings
export const ssoConfigurations = pgTable("sso_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id").notNull(),
  provider: text("provider").notNull(), // 'saml', 'oidc', 'azure_ad', 'okta', 'google'
  displayName: text("display_name").notNull(),
  // SAML config
  entityId: text("entity_id"),
  ssoUrl: text("sso_url"),
  certificate: text("certificate"),
  // OIDC config
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  issuerUrl: text("issuer_url"),
  // Common
  emailDomain: text("email_domain"), // Auto-detect domain for SSO
  autoProvision: boolean("auto_provision").notNull().default(true), // Create users on first login
  defaultRole: text("default_role").notNull().default('member_ro'), // Default role for new users
  isActive: boolean("is_active").notNull().default(false),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============ UPTIME REPORTS ============

// Uptime Reports - generated PDF reports
export const uptimeReports = pgTable("uptime_reports", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 255 }).notNull(),
  organizationId: varchar("organization_id", { length: 36 }),
  reportType: varchar("report_type", { length: 50 }).notNull().default("weekly"),
  name: varchar("name", { length: 255 }).notNull(),
  period: varchar("period", { length: 20 }),
  vendorKeys: text("vendor_keys").array(),
  chainKeys: text("chain_keys").array(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  data: text("data"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Report Schedules for automatic generation
export const reportSchedules = pgTable("report_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  frequency: varchar("frequency", { length: 20 }).notNull().default("monthly"),
  vendorKeys: text("vendor_keys").array(),
  chainKeys: text("chain_keys").array(),
  recipients: text("recipients").array(),
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for Uptime Reports
export const insertUptimeReportSchema = createInsertSchema(uptimeReports).omit({ id: true, createdAt: true, generatedAt: true });
export const insertReportScheduleSchema = createInsertSchema(reportSchedules).omit({ id: true, createdAt: true, lastRunAt: true, nextRunAt: true });

// Types for Uptime Reports
export type InsertUptimeReport = z.infer<typeof insertUptimeReportSchema>;
export type UptimeReport = typeof uptimeReports.$inferSelect;

export type InsertReportSchedule = z.infer<typeof insertReportScheduleSchema>;
export type ReportSchedule = typeof reportSchedules.$inferSelect;

// Insert schemas for new tables
export const insertClientPortalSchema = createInsertSchema(clientPortals).omit({ id: true, lastAccessedAt: true, viewCount: true, createdAt: true, updatedAt: true });
export const insertPortalVendorAssignmentSchema = createInsertSchema(portalVendorAssignments).omit({ id: true, createdAt: true });
export const insertPortalSubscriberSchema = createInsertSchema(portalSubscribers).omit({ id: true, subscribedAt: true, unsubscribedAt: true });
export const insertPsaIntegrationSchema = createInsertSchema(psaIntegrations).omit({ id: true, lastSyncAt: true, lastSyncSuccess: true, lastSyncError: true, createdAt: true, updatedAt: true });
export const insertPsaTicketRuleSchema = createInsertSchema(psaTicketRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPsaTicketLinkSchema = createInsertSchema(psaTicketLinks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVendorTelemetryMetricSchema = createInsertSchema(vendorTelemetryMetrics).omit({ id: true, createdAt: true });
export const insertOutagePredictionSchema = createInsertSchema(outagePredictions).omit({ id: true, acknowledgedBy: true, acknowledgedAt: true, actualIncidentId: true, feedbackScore: true, feedbackNotes: true, createdAt: true });
export const insertPredictionPatternSchema = createInsertSchema(predictionPatterns).omit({ id: true, createdAt: true, updatedAt: true });

// Insert schemas for webhooks, API keys, audit logs, and SSO
export const insertUserWebhookSchema = createInsertSchema(userWebhooks).omit({ id: true, lastTriggeredAt: true, lastStatus: true, lastError: true, totalSent: true, totalFailed: true, createdAt: true, updatedAt: true });
export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({ id: true, createdAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, lastUsedAt: true, createdAt: true });
export const insertApiRequestLogSchema = createInsertSchema(apiRequestLogs).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertSsoConfigurationSchema = createInsertSchema(ssoConfigurations).omit({ id: true, lastUsedAt: true, createdAt: true, updatedAt: true });

// Types for new tables
export type InsertClientPortal = z.infer<typeof insertClientPortalSchema>;
export type ClientPortal = typeof clientPortals.$inferSelect;

export type InsertPortalVendorAssignment = z.infer<typeof insertPortalVendorAssignmentSchema>;
export type PortalVendorAssignment = typeof portalVendorAssignments.$inferSelect;

export type InsertPortalSubscriber = z.infer<typeof insertPortalSubscriberSchema>;
export type PortalSubscriber = typeof portalSubscribers.$inferSelect;

export type InsertPsaIntegration = z.infer<typeof insertPsaIntegrationSchema>;
export type PsaIntegration = typeof psaIntegrations.$inferSelect;

export type InsertPsaTicketRule = z.infer<typeof insertPsaTicketRuleSchema>;
export type PsaTicketRule = typeof psaTicketRules.$inferSelect;

export type InsertPsaTicketLink = z.infer<typeof insertPsaTicketLinkSchema>;
export type PsaTicketLink = typeof psaTicketLinks.$inferSelect;

export type InsertVendorTelemetryMetric = z.infer<typeof insertVendorTelemetryMetricSchema>;
export type VendorTelemetryMetric = typeof vendorTelemetryMetrics.$inferSelect;

export type InsertOutagePrediction = z.infer<typeof insertOutagePredictionSchema>;
export type OutagePrediction = typeof outagePredictions.$inferSelect;

export type InsertPredictionPattern = z.infer<typeof insertPredictionPatternSchema>;
export type PredictionPattern = typeof predictionPatterns.$inferSelect;

export type InsertUserWebhook = z.infer<typeof insertUserWebhookSchema>;
export type UserWebhook = typeof userWebhooks.$inferSelect;

export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export type InsertApiRequestLog = z.infer<typeof insertApiRequestLogSchema>;
export type ApiRequestLog = typeof apiRequestLogs.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertSsoConfiguration = z.infer<typeof insertSsoConfigurationSchema>;
export type SsoConfiguration = typeof ssoConfigurations.$inferSelect;

// ==========================================
// VENDOR RELIABILITY SCORES
// ==========================================

export const RELIABILITY_BADGES = ['Highly Reliable', 'Moderate Risk', 'Frequent Incidents'] as const;
export type ReliabilityBadge = typeof RELIABILITY_BADGES[number];

export const vendorScores = pgTable("vendor_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key").notNull().unique(),
  // Overall score 0-100
  score: integer("score").notNull().default(0),
  // Component scores (each already weighted)
  uptimeScore: integer("uptime_score").notNull().default(0),    // 0-40
  mttrScore: integer("mttr_score").notNull().default(0),        // 0-30
  frequencyScore: integer("frequency_score").notNull().default(0), // 0-20
  severityScore: integer("severity_score").notNull().default(0),  // 0-10
  // Raw input data (for display)
  uptimePercent: integer("uptime_percent").notNull().default(100),
  mttrHours: integer("mttr_hours"),                             // null = no incidents
  incidentFrequency30d: integer("incident_frequency_30d").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  majorCount: integer("major_count").notNull().default(0),
  minorCount: integer("minor_count").notNull().default(0),
  infoCount: integer("info_count").notNull().default(0),
  // Derived
  badge: text("badge").notNull().default('Highly Reliable'),    // 'Highly Reliable' | 'Moderate Risk' | 'Frequent Incidents'
  trend: text("trend").notNull().default('stable'),             // 'improving' | 'declining' | 'stable'
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
});

export const vendorScoreHistory = pgTable("vendor_score_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorKey: text("vendor_key").notNull(),
  score: integer("score").notNull(),
  month: text("month").notNull(),                               // YYYY-MM
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
});

export const insertVendorScoreSchema = createInsertSchema(vendorScores).omit({ id: true, calculatedAt: true });
export const insertVendorScoreHistorySchema = createInsertSchema(vendorScoreHistory).omit({ id: true, calculatedAt: true });

export type VendorScore = typeof vendorScores.$inferSelect;
export type InsertVendorScore = z.infer<typeof insertVendorScoreSchema>;
export type VendorScoreHistory = typeof vendorScoreHistory.$inferSelect;

// ==========================================
// INCIDENT WAR ROOMS
// ==========================================

export const warRooms = pgTable("war_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").notNull().unique(),    // FK to incidents.id
  vendorKey: text("vendor_key").notNull(),
  vendorName: text("vendor_name").notNull(),
  status: text("status").notNull().default('open'),          // 'open' | 'closed'
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const warRoomPosts = pgTable("war_room_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  warRoomId: varchar("war_room_id").notNull(),
  userId: varchar("user_id"),                                // null for system posts
  content: text("content").notNull(),                        // max 280 chars
  detail: text("detail"),                                    // optional longer detail
  isSystemUpdate: boolean("is_system_update").notNull().default(false),
  upvotes: integer("upvotes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const warRoomParticipants = pgTable("war_room_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  warRoomId: varchar("war_room_id").notNull(),
  userId: varchar("user_id").notNull(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
});

export const warRoomUpvotes = pgTable("war_room_upvotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWarRoomSchema = createInsertSchema(warRooms).omit({ id: true, createdAt: true });
export const insertWarRoomPostSchema = createInsertSchema(warRoomPosts).omit({ id: true, createdAt: true, upvotes: true });
export const insertWarRoomParticipantSchema = createInsertSchema(warRoomParticipants).omit({ id: true, joinedAt: true, lastActiveAt: true });
export const insertWarRoomUpvoteSchema = createInsertSchema(warRoomUpvotes).omit({ id: true, createdAt: true });

export type WarRoom = typeof warRooms.$inferSelect;
export type InsertWarRoom = z.infer<typeof insertWarRoomSchema>;
export type WarRoomPost = typeof warRoomPosts.$inferSelect;
export type InsertWarRoomPost = z.infer<typeof insertWarRoomPostSchema>;
export type WarRoomParticipant = typeof warRoomParticipants.$inferSelect;
export type WarRoomUpvote = typeof warRoomUpvotes.$inferSelect;

// ===== Outage Blog Posts =====
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),                         // AI-generated markdown
  metaDescription: text("meta_description").notNull(),  // ≤155 char SEO summary
  vendorKey: text("vendor_key").notNull(),
  vendorName: text("vendor_name").notNull(),
  incidentId: text("incident_id").notNull().unique(),   // one post per incident
  severity: text("severity").notNull(),
  durationMinutes: integer("duration_minutes"),         // resolved - started, in minutes
  affectedComponents: text("affected_components"),      // comma-separated
  status: text("status").notNull().default("draft"),    // draft | published
  promptVersion: text("prompt_version").notNull().default("v2"),  // tracks prompt version
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
