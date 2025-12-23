import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models (users and sessions tables for Replit Auth)
export * from "./models/auth";

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
  customerImpact: text("customer_impact").notNull().default('medium'), // 'high', 'medium', 'low'
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

// Subscription tier constants
export const SUBSCRIPTION_TIERS = {
  standard: { name: 'Standard', price: 89.99, vendorLimit: 10, customVendorRequests: 0, blockchainLimit: 2 },
  gold: { name: 'Gold', price: 99.99, vendorLimit: 25, customVendorRequests: 5, blockchainLimit: 10 },
  platinum: { name: 'Platinum', price: 129.99, vendorLimit: null, customVendorRequests: null, blockchainLimit: 25 },
} as const;

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

// Types for blockchain tables
export type InsertBlockchainChain = z.infer<typeof insertBlockchainChainSchema>;
export type BlockchainChain = typeof blockchainChains.$inferSelect;

export type InsertBlockchainIncident = z.infer<typeof insertBlockchainIncidentSchema>;
export type BlockchainIncident = typeof blockchainIncidents.$inferSelect;

export type InsertUserBlockchainSubscription = z.infer<typeof insertUserBlockchainSubscriptionSchema>;
export type UserBlockchainSubscription = typeof userBlockchainSubscriptions.$inferSelect;

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
