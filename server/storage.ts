import { 
  users, vendors, incidents, jobs, config, feedback, notificationConsents, incidentAlerts, userVendorSubscriptions, userVendorOrder,
  type User, type UpsertUser,
  type Vendor, type InsertVendor,
  type Incident, type InsertIncident,
  type Job, type InsertJob,
  type Config, type InsertConfig,
  type Feedback, type InsertFeedback,
  type NotificationConsent, type InsertNotificationConsent,
  type IncidentAlert, type InsertIncidentAlert,
  type UserVendorSubscription,
  type UserVendorOrder
} from "@shared/schema";
import { and, isNull, inArray } from "drizzle-orm";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string | null }): Promise<User | undefined>;
  
  // Vendors
  getVendors(): Promise<Vendor[]>;
  getVendor(key: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(key: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(key: string): Promise<boolean>;
  
  // Incidents
  getIncidents(): Promise<Incident[]>;
  getIncidentsByVendor(vendorKey: string): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, data: { status?: string; updatedAt?: string }): Promise<Incident | undefined>;
  deleteIncident(id: string): Promise<boolean>;
  
  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  
  // Config
  getConfig(key: string): Promise<Config | undefined>;
  setConfig(key: string, value: string): Promise<Config>;
  getAllConfig(): Promise<Config[]>;
  
  // Feedback
  getFeedback(): Promise<Feedback[]>;
  createFeedback(feedbackData: InsertFeedback): Promise<Feedback>;
  
  // User notifications
  updateUserNotifications(userId: string, prefs: { phone?: string; notifyEmail?: boolean; notifySms?: boolean }): Promise<User | undefined>;
  
  // Notification Consents
  recordConsent(consent: InsertNotificationConsent): Promise<NotificationConsent>;
  getConsents(options?: { channel?: string; limit?: number; offset?: number }): Promise<NotificationConsent[]>;
  getConsentsByUser(userId: string): Promise<NotificationConsent[]>;
  revokeConsent(id: string): Promise<NotificationConsent | undefined>;
  getConsentsCount(): Promise<number>;
  
  // Incident Alerts
  recordAlert(alert: InsertIncidentAlert): Promise<IncidentAlert>;
  hasAlertBeenSent(incidentId: string, userId: string, channel: string, eventType: string, statusSnapshot?: string): Promise<boolean>;
  getAlertsByIncident(incidentId: string): Promise<IncidentAlert[]>;
  
  // Users with notifications enabled
  getUsersWithNotificationsEnabled(): Promise<User[]>;
  getActiveConsentsForChannel(channel: string): Promise<NotificationConsent[]>;
  
  // Vendor Subscriptions
  getUserVendorSubscriptions(userId: string): Promise<string[]>;
  setUserVendorSubscriptions(userId: string, vendorKeys: string[]): Promise<void>;
  hasUserSetSubscriptions(userId: string): Promise<boolean>;
  resetUserSubscriptions(userId: string): Promise<void>;
  getUsersSubscribedToVendor(vendorKey: string): Promise<User[]>;
  getVendorsForUser(userId: string): Promise<Vendor[]>;
  getIncidentsForUser(userId: string): Promise<Incident[]>;
  
  // Vendor Ordering
  getUserVendorOrder(userId: string): Promise<UserVendorOrder[]>;
  setUserVendorOrder(userId: string, vendorKeys: string[]): Promise<void>;
  getOrderedVendorsForUser(userId: string): Promise<Vendor[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string | null }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...stripeInfo, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }
  
  // Vendors
  async getVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).orderBy(vendors.name);
  }
  
  async getVendor(key: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.key, key));
    return vendor || undefined;
  }
  
  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db
      .insert(vendors)
      .values(vendor)
      .returning();
    return newVendor;
  }
  
  async updateVendor(key: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [updated] = await db
      .update(vendors)
      .set(vendor)
      .where(eq(vendors.key, key))
      .returning();
    return updated || undefined;
  }
  
  async deleteVendor(key: string): Promise<boolean> {
    const result = await db.delete(vendors).where(eq(vendors.key, key));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Incidents
  async getIncidents(): Promise<Incident[]> {
    return await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(100);
  }
  
  async getIncidentsByVendor(vendorKey: string): Promise<Incident[]> {
    return await db.select().from(incidents)
      .where(eq(incidents.vendorKey, vendorKey))
      .orderBy(desc(incidents.createdAt));
  }
  
  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [newIncident] = await db
      .insert(incidents)
      .values(incident)
      .returning();
    return newIncident;
  }
  
  async updateIncident(id: string, data: { status?: string; updatedAt?: string }): Promise<Incident | undefined> {
    const [updated] = await db
      .update(incidents)
      .set(data)
      .where(eq(incidents.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteIncident(id: string): Promise<boolean> {
    const result = await db.delete(incidents).where(eq(incidents.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Jobs
  async getJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(jobs.name);
  }
  
  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }
  
  async createJob(job: InsertJob): Promise<Job> {
    const [newJob] = await db
      .insert(jobs)
      .values(job)
      .returning();
    return newJob;
  }
  
  async updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined> {
    const [updated] = await db
      .update(jobs)
      .set(job)
      .where(eq(jobs.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteJob(id: string): Promise<boolean> {
    const result = await db.delete(jobs).where(eq(jobs.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Config
  async getConfig(key: string): Promise<Config | undefined> {
    const [cfg] = await db.select().from(config).where(eq(config.key, key));
    return cfg || undefined;
  }
  
  async setConfig(key: string, value: string): Promise<Config> {
    const existing = await this.getConfig(key);
    
    if (existing) {
      const [updated] = await db
        .update(config)
        .set({ value, updatedAt: new Date() })
        .where(eq(config.key, key))
        .returning();
      return updated;
    } else {
      const [newConfig] = await db
        .insert(config)
        .values({ key, value })
        .returning();
      return newConfig;
    }
  }
  
  async getAllConfig(): Promise<Config[]> {
    return await db.select().from(config);
  }
  
  // Feedback
  async getFeedback(): Promise<Feedback[]> {
    return await db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(100);
  }
  
  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db
      .insert(feedback)
      .values(feedbackData)
      .returning();
    return newFeedback;
  }
  
  // User notifications
  async updateUserNotifications(userId: string, prefs: { phone?: string; notifyEmail?: boolean; notifySms?: boolean }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...prefs, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }
  
  // Notification Consents
  async recordConsent(consent: InsertNotificationConsent): Promise<NotificationConsent> {
    const [newConsent] = await db
      .insert(notificationConsents)
      .values(consent)
      .returning();
    return newConsent;
  }
  
  async getConsents(options?: { channel?: string; limit?: number; offset?: number }): Promise<NotificationConsent[]> {
    let query = db.select().from(notificationConsents).orderBy(desc(notificationConsents.consentedAt));
    
    if (options?.channel) {
      query = query.where(eq(notificationConsents.channel, options.channel)) as typeof query;
    }
    
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    
    return await query.limit(limit).offset(offset);
  }
  
  async getConsentsByUser(userId: string): Promise<NotificationConsent[]> {
    return await db
      .select()
      .from(notificationConsents)
      .where(eq(notificationConsents.userId, userId))
      .orderBy(desc(notificationConsents.consentedAt));
  }
  
  async revokeConsent(id: string): Promise<NotificationConsent | undefined> {
    const [updated] = await db
      .update(notificationConsents)
      .set({ revokedAt: new Date() })
      .where(eq(notificationConsents.id, id))
      .returning();
    return updated || undefined;
  }
  
  async getConsentsCount(): Promise<number> {
    const result = await db.select().from(notificationConsents);
    return result.length;
  }
  
  // Incident Alerts
  async recordAlert(alert: InsertIncidentAlert): Promise<IncidentAlert> {
    const [newAlert] = await db
      .insert(incidentAlerts)
      .values(alert)
      .returning();
    return newAlert;
  }
  
  async hasAlertBeenSent(incidentId: string, userId: string, channel: string, eventType: string, statusSnapshot?: string): Promise<boolean> {
    const conditions = [
      eq(incidentAlerts.incidentId, incidentId),
      eq(incidentAlerts.userId, userId),
      eq(incidentAlerts.channel, channel),
      eq(incidentAlerts.eventType, eventType)
    ];
    
    if (eventType === 'update' && statusSnapshot) {
      conditions.push(eq(incidentAlerts.statusSnapshot, statusSnapshot));
    }
    
    const [existing] = await db
      .select()
      .from(incidentAlerts)
      .where(and(...conditions));
    return !!existing;
  }
  
  async getAlertsByIncident(incidentId: string): Promise<IncidentAlert[]> {
    return await db
      .select()
      .from(incidentAlerts)
      .where(eq(incidentAlerts.incidentId, incidentId))
      .orderBy(desc(incidentAlerts.sentAt));
  }
  
  // Users with notifications enabled
  async getUsersWithNotificationsEnabled(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers.filter(u => u.notifyEmail || u.notifySms);
  }
  
  async getActiveConsentsForChannel(channel: string): Promise<NotificationConsent[]> {
    return await db
      .select()
      .from(notificationConsents)
      .where(
        and(
          eq(notificationConsents.channel, channel),
          isNull(notificationConsents.revokedAt)
        )
      );
  }
  
  // Vendor Subscriptions
  async getUserVendorSubscriptions(userId: string): Promise<string[]> {
    const subs = await db
      .select()
      .from(userVendorSubscriptions)
      .where(eq(userVendorSubscriptions.userId, userId));
    return subs.map(s => s.vendorKey);
  }
  
  async setUserVendorSubscriptions(userId: string, vendorKeys: string[]): Promise<void> {
    await db.delete(userVendorSubscriptions).where(eq(userVendorSubscriptions.userId, userId));
    
    if (vendorKeys.length > 0) {
      await db.insert(userVendorSubscriptions).values(
        vendorKeys.map(vendorKey => ({ userId, vendorKey }))
      );
    }
    
    await this.setConfig(`vendor_subscriptions_set:${userId}`, 'true');
  }
  
  async hasUserSetSubscriptions(userId: string): Promise<boolean> {
    const configEntry = await this.getConfig(`vendor_subscriptions_set:${userId}`);
    return configEntry?.value === 'true';
  }
  
  async resetUserSubscriptions(userId: string): Promise<void> {
    await db.delete(userVendorSubscriptions).where(eq(userVendorSubscriptions.userId, userId));
    await db.delete(config).where(eq(config.key, `vendor_subscriptions_set:${userId}`));
  }
  
  async getUsersSubscribedToVendor(vendorKey: string): Promise<User[]> {
    const subs = await db
      .select()
      .from(userVendorSubscriptions)
      .where(eq(userVendorSubscriptions.vendorKey, vendorKey));
    
    if (subs.length === 0) {
      return [];
    }
    
    const userIds = subs.map(s => s.userId);
    return await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
  }
  
  async getVendorsForUser(userId: string): Promise<Vendor[]> {
    const hasSetSubscriptions = await this.hasUserSetSubscriptions(userId);
    const subscribedKeys = await this.getUserVendorSubscriptions(userId);
    
    if (!hasSetSubscriptions) {
      return await this.getVendors();
    }
    
    if (subscribedKeys.length === 0) {
      return [];
    }
    
    return await db
      .select()
      .from(vendors)
      .where(inArray(vendors.key, subscribedKeys))
      .orderBy(vendors.name);
  }
  
  async getIncidentsForUser(userId: string): Promise<Incident[]> {
    const hasSetSubscriptions = await this.hasUserSetSubscriptions(userId);
    const subscribedKeys = await this.getUserVendorSubscriptions(userId);
    
    if (!hasSetSubscriptions) {
      return await this.getIncidents();
    }
    
    if (subscribedKeys.length === 0) {
      return [];
    }
    
    return await db
      .select()
      .from(incidents)
      .where(inArray(incidents.vendorKey, subscribedKeys))
      .orderBy(desc(incidents.createdAt));
  }
  
  // Vendor Ordering
  async getUserVendorOrder(userId: string): Promise<UserVendorOrder[]> {
    return await db
      .select()
      .from(userVendorOrder)
      .where(eq(userVendorOrder.userId, userId))
      .orderBy(userVendorOrder.displayOrder);
  }
  
  async setUserVendorOrder(userId: string, vendorKeys: string[]): Promise<void> {
    await db.delete(userVendorOrder).where(eq(userVendorOrder.userId, userId));
    
    if (vendorKeys.length > 0) {
      await db.insert(userVendorOrder).values(
        vendorKeys.map((vendorKey, index) => ({ 
          userId, 
          vendorKey, 
          displayOrder: index 
        }))
      );
    }
  }
  
  async getOrderedVendorsForUser(userId: string): Promise<Vendor[]> {
    const vendorsList = await this.getVendorsForUser(userId);
    const orderData = await this.getUserVendorOrder(userId);
    
    if (orderData.length === 0) {
      return vendorsList;
    }
    
    const orderMap = new Map(orderData.map(o => [o.vendorKey, o.displayOrder]));
    
    return vendorsList.sort((a, b) => {
      const orderA = orderMap.get(a.key) ?? 999;
      const orderB = orderMap.get(b.key) ?? 999;
      return orderA - orderB;
    });
  }
}

export const storage = new DatabaseStorage();
