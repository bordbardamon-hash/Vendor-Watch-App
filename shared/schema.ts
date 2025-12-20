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

// Types
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertConfig = z.infer<typeof insertConfigSchema>;
export type Config = typeof config.$inferSelect;
