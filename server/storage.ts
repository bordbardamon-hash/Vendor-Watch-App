import { 
  users, vendors, incidents, jobs, config, feedback, notificationConsents, incidentAlerts, userVendorSubscriptions, userVendorOrder, customVendorRequests,
  blockchainChains, blockchainIncidents, userBlockchainSubscriptions, incidentAcknowledgements, maintenanceAcknowledgements,
  vendorMaintenances, blockchainMaintenances, userActivityEvents, vendorDailyMetrics,
  type User, type UpsertUser,
  type Vendor, type InsertVendor,
  type Incident, type InsertIncident,
  type Job, type InsertJob,
  type Config, type InsertConfig,
  type Feedback, type InsertFeedback,
  type NotificationConsent, type InsertNotificationConsent,
  type IncidentAlert, type InsertIncidentAlert,
  type UserVendorSubscription,
  type UserVendorOrder,
  type CustomVendorRequest, type InsertCustomVendorRequest,
  type BlockchainChain, type InsertBlockchainChain,
  type BlockchainIncident, type InsertBlockchainIncident,
  type IncidentAcknowledgement,
  type MaintenanceAcknowledgement,
  type VendorMaintenance, type InsertVendorMaintenance,
  type BlockchainMaintenance, type InsertBlockchainMaintenance,
  SUBSCRIPTION_TIERS
} from "@shared/schema";
import { and, isNull, inArray, gte, sql, count } from "drizzle-orm";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string | null }): Promise<User | undefined>;
  updateUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined>;
  
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
  updateIncident(id: string, data: { status?: string; severity?: string; impact?: string; updatedAt?: string }): Promise<Incident | undefined>;
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
  updateUserNotifications(userId: string, prefs: { notificationEmail?: string; phone?: string; notifyEmail?: boolean; notifySms?: boolean }): Promise<User | undefined>;
  
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
  getOwnerUser(): Promise<User | undefined>;
  
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
  
  // Custom Vendor Requests
  createCustomVendorRequest(request: InsertCustomVendorRequest): Promise<CustomVendorRequest>;
  getCustomVendorRequests(options?: { userId?: string; status?: string }): Promise<CustomVendorRequest[]>;
  getCustomVendorRequest(id: string): Promise<CustomVendorRequest | undefined>;
  updateCustomVendorRequest(id: string, data: Partial<InsertCustomVendorRequest>): Promise<CustomVendorRequest | undefined>;
  deleteCustomVendorRequest(id: string): Promise<boolean>;
  getUserRequestCount(userId: string): Promise<number>;
  
  // Subscription Tier Helpers
  updateUserSubscriptionTier(userId: string, tier: 'standard' | 'gold' | 'platinum' | null): Promise<User | undefined>;
  checkVendorLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number | null; tier: string | null }>;
  
  // Two-Factor Authentication
  setUserTwoFactorSecret(userId: string, secret: string, recoveryCodes: string[]): Promise<User | undefined>;
  enableUserTwoFactor(userId: string): Promise<User | undefined>;
  disableUserTwoFactor(userId: string): Promise<User | undefined>;
  updateUserRecoveryCodes(userId: string, recoveryCodes: string[]): Promise<User | undefined>;
  
  // Customer Impact for Vendor Subscriptions
  getUserVendorImpact(userId: string, vendorKey: string): Promise<string>;
  setUserVendorImpact(userId: string, vendorKey: string, impact: string): Promise<boolean>;
  getUserVendorSubscriptionsWithImpact(userId: string): Promise<Array<{ vendorKey: string; customerImpact: string }>>;
  
  // Blockchain Chains
  getBlockchainChains(): Promise<BlockchainChain[]>;
  getBlockchainChainsByTier(tier: string): Promise<BlockchainChain[]>;
  getBlockchainChain(key: string): Promise<BlockchainChain | undefined>;
  createBlockchainChain(chain: InsertBlockchainChain): Promise<BlockchainChain>;
  updateBlockchainChain(key: string, data: Partial<InsertBlockchainChain>): Promise<BlockchainChain | undefined>;
  
  // Blockchain Incidents
  getBlockchainIncidents(): Promise<BlockchainIncident[]>;
  getBlockchainIncidentsByChain(chainKey: string): Promise<BlockchainIncident[]>;
  getActiveBlockchainIncidents(): Promise<BlockchainIncident[]>;
  createBlockchainIncident(incident: InsertBlockchainIncident): Promise<BlockchainIncident>;
  updateBlockchainIncident(id: string, data: Partial<InsertBlockchainIncident>): Promise<BlockchainIncident | undefined>;
  
  // Blockchain Subscriptions
  getUserBlockchainSubscriptions(userId: string): Promise<string[]>;
  setUserBlockchainSubscriptions(userId: string, chainKeys: string[]): Promise<void>;
  hasUserSetBlockchainSubscriptions(userId: string): Promise<boolean>;
  checkBlockchainLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number | null; tier: string | null }>;
  hasBlockchainAlertBeenSent(incidentId: string, userId: string, channel: string, eventType: string, statusSnapshot: string): Promise<boolean>;
  recordBlockchainAlert(alert: { incidentId: string; userId: string; channel: string; eventType: string; statusSnapshot: string; destination: string }): Promise<void>;
  
  // Toggle individual vendor/blockchain subscription
  toggleVendorSubscription(userId: string, vendorKey: string): Promise<{ subscribed: boolean; current: number; limit: number | null }>;
  toggleBlockchainSubscription(userId: string, chainKey: string): Promise<{ subscribed: boolean; current: number; limit: number | null }>;
  
  // Incident Acknowledgements
  acknowledgeIncident(userId: string, incidentId: string, incidentType: 'vendor' | 'blockchain'): Promise<IncidentAcknowledgement>;
  unacknowledgeIncident(userId: string, incidentId: string): Promise<boolean>;
  isIncidentAcknowledged(userId: string, incidentId: string): Promise<boolean>;
  getUserAcknowledgements(userId: string): Promise<IncidentAcknowledgement[]>;
  clearAcknowledgementsForIncident(incidentId: string): Promise<void>;
  
  // Maintenance Acknowledgements
  acknowledgeMaintenance(userId: string, maintenanceId: string, maintenanceType: 'vendor' | 'blockchain'): Promise<MaintenanceAcknowledgement>;
  unacknowledgeMaintenance(userId: string, maintenanceId: string): Promise<boolean>;
  isMaintenanceAcknowledged(userId: string, maintenanceId: string): Promise<boolean>;
  getUserMaintenanceAcknowledgements(userId: string): Promise<MaintenanceAcknowledgement[]>;
  clearAcknowledgementsForMaintenance(maintenanceId: string): Promise<void>;
  
  // Vendor Maintenances
  getVendorMaintenances(): Promise<VendorMaintenance[]>;
  getActiveVendorMaintenances(): Promise<VendorMaintenance[]>;
  getUpcomingVendorMaintenances(): Promise<VendorMaintenance[]>;
  getVendorMaintenancesByVendor(vendorKey: string): Promise<VendorMaintenance[]>;
  upsertVendorMaintenance(maintenance: InsertVendorMaintenance): Promise<VendorMaintenance>;
  updateVendorMaintenance(id: string, data: Partial<InsertVendorMaintenance>): Promise<VendorMaintenance | undefined>;
  
  // Blockchain Maintenances
  getBlockchainMaintenances(): Promise<BlockchainMaintenance[]>;
  getActiveBlockchainMaintenances(): Promise<BlockchainMaintenance[]>;
  getUpcomingBlockchainMaintenances(): Promise<BlockchainMaintenance[]>;
  getBlockchainMaintenancesByChain(chainKey: string): Promise<BlockchainMaintenance[]>;
  upsertBlockchainMaintenance(maintenance: InsertBlockchainMaintenance): Promise<BlockchainMaintenance>;
  updateBlockchainMaintenance(id: string, data: Partial<InsertBlockchainMaintenance>): Promise<BlockchainMaintenance | undefined>;
  
  // Maintenance stats
  getMaintenanceStats(): Promise<{ vendorActive: number; vendorUpcoming: number; blockchainActive: number; blockchainUpcoming: number; total: number }>;
  
  // Analytics - User Activity
  logUserActivity(userId: string, eventType: string, metadata?: Record<string, any>): Promise<void>;
  getUserActivityStats(userId: string, days?: number): Promise<{ logins: number; pageViews: number; acknowledgements: number; lastActive: Date | null }>;
  getUserRecentActivity(userId: string, limit?: number): Promise<Array<{ eventType: string; metadata: string | null; createdAt: Date }>>;
  
  // Analytics - Vendor Performance
  getVendorPerformanceStats(vendorKey: string, days?: number): Promise<{ uptimePercent: number; incidentCount: number; avgResolutionMinutes: number | null }>;
  getAllVendorPerformanceStats(days?: number): Promise<Array<{ vendorKey: string; vendorName: string; uptimePercent: number; incidentCount: number }>>;
  recordVendorDailyMetrics(vendorKey: string, date: string, metrics: { uptimeMinutes: number; downtimeMinutes: number; incidentCount: number; avgResolutionMinutes?: number }): Promise<void>;
  
  // Analytics - Blockchain Performance
  getBlockchainPerformanceStats(chainKey: string, days?: number): Promise<{ uptimePercent: number; incidentCount: number; avgResolutionMinutes: number | null }>;
  getAllBlockchainPerformanceStats(days?: number): Promise<Array<{ chainKey: string; chainName: string; uptimePercent: number; incidentCount: number }>>;
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isAdmin, updatedAt: new Date() })
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
  
  async updateIncident(id: string, data: { status?: string; severity?: string; impact?: string; updatedAt?: string }): Promise<Incident | undefined> {
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
  async updateUserNotifications(userId: string, prefs: { notificationEmail?: string; phone?: string; notifyEmail?: boolean; notifySms?: boolean }): Promise<User | undefined> {
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
  
  async getOwnerUser(): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.isOwner, true))
      .limit(1);
    return result[0];
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
  
  // Custom Vendor Requests
  async createCustomVendorRequest(request: InsertCustomVendorRequest): Promise<CustomVendorRequest> {
    const [created] = await db.insert(customVendorRequests).values(request).returning();
    return created;
  }
  
  async getCustomVendorRequests(options?: { userId?: string; status?: string }): Promise<CustomVendorRequest[]> {
    let query = db.select().from(customVendorRequests);
    
    if (options?.userId && options?.status) {
      query = query.where(and(
        eq(customVendorRequests.userId, options.userId),
        eq(customVendorRequests.status, options.status)
      )) as any;
    } else if (options?.userId) {
      query = query.where(eq(customVendorRequests.userId, options.userId)) as any;
    } else if (options?.status) {
      query = query.where(eq(customVendorRequests.status, options.status)) as any;
    }
    
    return await query.orderBy(desc(customVendorRequests.createdAt));
  }
  
  async getCustomVendorRequest(id: string): Promise<CustomVendorRequest | undefined> {
    const [request] = await db.select().from(customVendorRequests).where(eq(customVendorRequests.id, id));
    return request || undefined;
  }
  
  async updateCustomVendorRequest(id: string, data: Partial<InsertCustomVendorRequest>): Promise<CustomVendorRequest | undefined> {
    const [updated] = await db
      .update(customVendorRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customVendorRequests.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteCustomVendorRequest(id: string): Promise<boolean> {
    const result = await db.delete(customVendorRequests).where(eq(customVendorRequests.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async getUserRequestCount(userId: string): Promise<number> {
    const requests = await db
      .select()
      .from(customVendorRequests)
      .where(eq(customVendorRequests.userId, userId));
    return requests.length;
  }
  
  // Subscription Tier Helpers
  async updateUserSubscriptionTier(userId: string, tier: 'standard' | 'gold' | 'platinum' | null): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ subscriptionTier: tier, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }
  
  async checkVendorLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number | null; tier: string | null }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { allowed: false, current: 0, limit: 0, tier: null };
    }
    
    const tier = user.subscriptionTier as 'standard' | 'gold' | 'platinum' | null;
    if (!tier) {
      return { allowed: false, current: 0, limit: 0, tier: null };
    }
    
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const subscriptions = await this.getUserVendorSubscriptions(userId);
    const currentCount = subscriptions.length;
    
    // Platinum has no limit
    if (tierInfo.vendorLimit === null) {
      return { allowed: true, current: currentCount, limit: null, tier };
    }
    
    return {
      allowed: currentCount < tierInfo.vendorLimit,
      current: currentCount,
      limit: tierInfo.vendorLimit,
      tier
    };
  }
  
  async getUserVendorImpact(userId: string, vendorKey: string): Promise<string> {
    const [sub] = await db.select()
      .from(userVendorSubscriptions)
      .where(and(
        eq(userVendorSubscriptions.userId, userId),
        eq(userVendorSubscriptions.vendorKey, vendorKey)
      ));
    return sub?.customerImpact || 'medium';
  }
  
  async setUserVendorImpact(userId: string, vendorKey: string, impact: string): Promise<boolean> {
    const existing = await db.select()
      .from(userVendorSubscriptions)
      .where(and(
        eq(userVendorSubscriptions.userId, userId),
        eq(userVendorSubscriptions.vendorKey, vendorKey)
      ));
    
    if (existing.length > 0) {
      await db.update(userVendorSubscriptions)
        .set({ customerImpact: impact })
        .where(and(
          eq(userVendorSubscriptions.userId, userId),
          eq(userVendorSubscriptions.vendorKey, vendorKey)
        ));
      return true;
    }
    
    const hasSetSubscriptions = await this.getConfig(`vendor_subscriptions_set:${userId}`);
    if (!hasSetSubscriptions) {
      await db.insert(userVendorSubscriptions).values({
        userId,
        vendorKey,
        customerImpact: impact,
      });
      return true;
    }
    
    return false;
  }
  
  async getUserVendorSubscriptionsWithImpact(userId: string): Promise<Array<{ vendorKey: string; customerImpact: string }>> {
    const subs = await db.select()
      .from(userVendorSubscriptions)
      .where(eq(userVendorSubscriptions.userId, userId));
    return subs.map(s => ({ vendorKey: s.vendorKey, customerImpact: s.customerImpact || 'medium' }));
  }

  // Blockchain Chains
  async getBlockchainChains(): Promise<BlockchainChain[]> {
    return db.select().from(blockchainChains).orderBy(blockchainChains.tier, blockchainChains.name);
  }

  async getBlockchainChainsByTier(tier: string): Promise<BlockchainChain[]> {
    return db.select().from(blockchainChains).where(eq(blockchainChains.tier, tier)).orderBy(blockchainChains.name);
  }

  async getBlockchainChain(key: string): Promise<BlockchainChain | undefined> {
    const [chain] = await db.select().from(blockchainChains).where(eq(blockchainChains.key, key));
    return chain || undefined;
  }

  async createBlockchainChain(chain: InsertBlockchainChain): Promise<BlockchainChain> {
    const [newChain] = await db.insert(blockchainChains).values(chain).returning();
    return newChain;
  }

  async updateBlockchainChain(key: string, data: Partial<InsertBlockchainChain>): Promise<BlockchainChain | undefined> {
    const [updated] = await db.update(blockchainChains).set(data).where(eq(blockchainChains.key, key)).returning();
    return updated || undefined;
  }

  // Blockchain Incidents
  async getBlockchainIncidents(): Promise<BlockchainIncident[]> {
    return db.select().from(blockchainIncidents).orderBy(desc(blockchainIncidents.createdAt));
  }

  async getBlockchainIncidentsByChain(chainKey: string): Promise<BlockchainIncident[]> {
    return db.select().from(blockchainIncidents).where(eq(blockchainIncidents.chainKey, chainKey)).orderBy(desc(blockchainIncidents.createdAt));
  }

  async getActiveBlockchainIncidents(): Promise<BlockchainIncident[]> {
    return db.select().from(blockchainIncidents)
      .where(and(
        isNull(blockchainIncidents.resolvedAt),
        inArray(blockchainIncidents.status, ['investigating', 'identified', 'monitoring'])
      ))
      .orderBy(desc(blockchainIncidents.createdAt));
  }

  async createBlockchainIncident(incident: InsertBlockchainIncident): Promise<BlockchainIncident> {
    const [newIncident] = await db.insert(blockchainIncidents).values(incident).returning();
    return newIncident;
  }

  async updateBlockchainIncident(id: string, data: Partial<InsertBlockchainIncident>): Promise<BlockchainIncident | undefined> {
    const [updated] = await db.update(blockchainIncidents).set(data).where(eq(blockchainIncidents.id, id)).returning();
    return updated || undefined;
  }

  // Two-Factor Authentication
  async setUserTwoFactorSecret(userId: string, secret: string, recoveryCodes: string[]): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        twoFactorSecret: secret, 
        twoFactorRecoveryCodes: recoveryCodes.join(','),
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async enableUserTwoFactor(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ twoFactorEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async disableUserTwoFactor(userId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        twoFactorEnabled: false, 
        twoFactorSecret: null, 
        twoFactorRecoveryCodes: null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async updateUserRecoveryCodes(userId: string, recoveryCodes: string[]): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        twoFactorRecoveryCodes: recoveryCodes.join(','),
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  // Blockchain Subscriptions
  async getUserBlockchainSubscriptions(userId: string): Promise<string[]> {
    const subs = await db
      .select()
      .from(userBlockchainSubscriptions)
      .where(eq(userBlockchainSubscriptions.userId, userId));
    return subs.map(s => s.chainKey);
  }

  async hasUserSetBlockchainSubscriptions(userId: string): Promise<boolean> {
    const configKey = `blockchain_subscriptions_set:${userId}`;
    const configRow = await db.select().from(config).where(eq(config.key, configKey)).limit(1);
    return configRow.length > 0 && configRow[0].value === 'true';
  }

  async hasBlockchainAlertBeenSent(incidentId: string, userId: string, channel: string, eventType: string, statusSnapshot: string): Promise<boolean> {
    const alerts = await db
      .select()
      .from(incidentAlerts)
      .where(
        and(
          eq(incidentAlerts.incidentId, `blockchain:${incidentId}`),
          eq(incidentAlerts.userId, userId),
          eq(incidentAlerts.channel, channel),
          eq(incidentAlerts.eventType, eventType),
          eq(incidentAlerts.statusSnapshot, statusSnapshot)
        )
      );
    return alerts.length > 0;
  }

  async recordBlockchainAlert(alert: { incidentId: string; userId: string; channel: string; eventType: string; statusSnapshot: string; destination: string }): Promise<void> {
    await db.insert(incidentAlerts).values({
      incidentId: `blockchain:${alert.incidentId}`,
      userId: alert.userId,
      channel: alert.channel,
      eventType: alert.eventType,
      statusSnapshot: alert.statusSnapshot,
      destination: alert.destination,
    });
  }

  async setUserBlockchainSubscriptions(userId: string, chainKeys: string[]): Promise<void> {
    await db.delete(userBlockchainSubscriptions).where(eq(userBlockchainSubscriptions.userId, userId));
    
    if (chainKeys.length > 0) {
      await db.insert(userBlockchainSubscriptions).values(
        chainKeys.map(chainKey => ({ userId, chainKey }))
      );
    }
    
    await this.setConfig(`blockchain_subscriptions_set:${userId}`, 'true');
  }

  async checkBlockchainLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number | null; tier: string | null }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { allowed: false, current: 0, limit: 0, tier: null };
    }
    
    const tier = user.subscriptionTier as 'standard' | 'gold' | 'platinum' | null;
    if (!tier) {
      return { allowed: false, current: 0, limit: 0, tier: null };
    }
    
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const subscriptions = await this.getUserBlockchainSubscriptions(userId);
    const currentCount = subscriptions.length;
    
    // Platinum has no limit
    if (tierInfo.blockchainLimit === null) {
      return { allowed: true, current: currentCount, limit: null, tier };
    }
    
    return {
      allowed: currentCount < tierInfo.blockchainLimit,
      current: currentCount,
      limit: tierInfo.blockchainLimit,
      tier
    };
  }

  async toggleVendorSubscription(userId: string, vendorKey: string): Promise<{ subscribed: boolean; current: number; limit: number | null }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const tier = user.subscriptionTier as 'standard' | 'gold' | 'platinum' | null;
    if (!tier) {
      throw new Error('No active subscription');
    }
    
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const currentSubs = await this.getUserVendorSubscriptions(userId);
    const isCurrentlySubscribed = currentSubs.includes(vendorKey);
    
    if (isCurrentlySubscribed) {
      // Unsubscribe
      await db.delete(userVendorSubscriptions).where(
        and(
          eq(userVendorSubscriptions.userId, userId),
          eq(userVendorSubscriptions.vendorKey, vendorKey)
        )
      );
      await this.setConfig(`vendor_subscriptions_set:${userId}`, 'true');
      return { subscribed: false, current: currentSubs.length - 1, limit: tierInfo.vendorLimit };
    } else {
      // Check limit before subscribing
      if (tierInfo.vendorLimit !== null && currentSubs.length >= tierInfo.vendorLimit) {
        throw new Error(`Vendor limit reached (${tierInfo.vendorLimit})`);
      }
      
      await db.insert(userVendorSubscriptions).values({ userId, vendorKey });
      await this.setConfig(`vendor_subscriptions_set:${userId}`, 'true');
      return { subscribed: true, current: currentSubs.length + 1, limit: tierInfo.vendorLimit };
    }
  }

  async toggleBlockchainSubscription(userId: string, chainKey: string): Promise<{ subscribed: boolean; current: number; limit: number | null }> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const tier = user.subscriptionTier as 'standard' | 'gold' | 'platinum' | null;
    if (!tier) {
      throw new Error('No active subscription');
    }
    
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    
    const currentSubs = await this.getUserBlockchainSubscriptions(userId);
    const isCurrentlySubscribed = currentSubs.includes(chainKey);
    
    if (isCurrentlySubscribed) {
      // Unsubscribe
      await db.delete(userBlockchainSubscriptions).where(
        and(
          eq(userBlockchainSubscriptions.userId, userId),
          eq(userBlockchainSubscriptions.chainKey, chainKey)
        )
      );
      await this.setConfig(`blockchain_subscriptions_set:${userId}`, 'true');
      return { subscribed: false, current: currentSubs.length - 1, limit: tierInfo.blockchainLimit };
    } else {
      // Check limit before subscribing
      if (tierInfo.blockchainLimit !== null && currentSubs.length >= tierInfo.blockchainLimit) {
        throw new Error(`Blockchain limit reached (${tierInfo.blockchainLimit})`);
      }
      
      await db.insert(userBlockchainSubscriptions).values({ userId, chainKey });
      await this.setConfig(`blockchain_subscriptions_set:${userId}`, 'true');
      return { subscribed: true, current: currentSubs.length + 1, limit: tierInfo.blockchainLimit };
    }
  }

  // Incident Acknowledgements
  async acknowledgeIncident(userId: string, incidentId: string, incidentType: 'vendor' | 'blockchain'): Promise<IncidentAcknowledgement> {
    // Check if already acknowledged
    const existing = await db
      .select()
      .from(incidentAcknowledgements)
      .where(
        and(
          eq(incidentAcknowledgements.userId, userId),
          eq(incidentAcknowledgements.incidentId, incidentId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [ack] = await db.insert(incidentAcknowledgements).values({
      userId,
      incidentId,
      incidentType,
    }).returning();
    return ack;
  }

  async unacknowledgeIncident(userId: string, incidentId: string): Promise<boolean> {
    const result = await db.delete(incidentAcknowledgements).where(
      and(
        eq(incidentAcknowledgements.userId, userId),
        eq(incidentAcknowledgements.incidentId, incidentId)
      )
    );
    return true;
  }

  async isIncidentAcknowledged(userId: string, incidentId: string): Promise<boolean> {
    const ack = await db
      .select()
      .from(incidentAcknowledgements)
      .where(
        and(
          eq(incidentAcknowledgements.userId, userId),
          eq(incidentAcknowledgements.incidentId, incidentId)
        )
      )
      .limit(1);
    return ack.length > 0;
  }

  async getUserAcknowledgements(userId: string): Promise<IncidentAcknowledgement[]> {
    return db.select().from(incidentAcknowledgements).where(eq(incidentAcknowledgements.userId, userId));
  }

  async clearAcknowledgementsForIncident(incidentId: string): Promise<void> {
    await db.delete(incidentAcknowledgements).where(eq(incidentAcknowledgements.incidentId, incidentId));
  }

  // Maintenance Acknowledgements
  async acknowledgeMaintenance(userId: string, maintenanceId: string, maintenanceType: 'vendor' | 'blockchain'): Promise<MaintenanceAcknowledgement> {
    const existing = await db
      .select()
      .from(maintenanceAcknowledgements)
      .where(
        and(
          eq(maintenanceAcknowledgements.userId, userId),
          eq(maintenanceAcknowledgements.maintenanceId, maintenanceId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }

    const [ack] = await db.insert(maintenanceAcknowledgements).values({
      userId,
      maintenanceId,
      maintenanceType,
    }).returning();
    return ack;
  }

  async unacknowledgeMaintenance(userId: string, maintenanceId: string): Promise<boolean> {
    await db.delete(maintenanceAcknowledgements).where(
      and(
        eq(maintenanceAcknowledgements.userId, userId),
        eq(maintenanceAcknowledgements.maintenanceId, maintenanceId)
      )
    );
    return true;
  }

  async isMaintenanceAcknowledged(userId: string, maintenanceId: string): Promise<boolean> {
    const ack = await db
      .select()
      .from(maintenanceAcknowledgements)
      .where(
        and(
          eq(maintenanceAcknowledgements.userId, userId),
          eq(maintenanceAcknowledgements.maintenanceId, maintenanceId)
        )
      )
      .limit(1);
    return ack.length > 0;
  }

  async getUserMaintenanceAcknowledgements(userId: string): Promise<MaintenanceAcknowledgement[]> {
    return db.select().from(maintenanceAcknowledgements).where(eq(maintenanceAcknowledgements.userId, userId));
  }

  async clearAcknowledgementsForMaintenance(maintenanceId: string): Promise<void> {
    await db.delete(maintenanceAcknowledgements).where(eq(maintenanceAcknowledgements.maintenanceId, maintenanceId));
  }

  // Vendor Maintenances
  async getVendorMaintenances(): Promise<VendorMaintenance[]> {
    return db.select().from(vendorMaintenances).orderBy(desc(vendorMaintenances.scheduledStartAt));
  }

  async getActiveVendorMaintenances(): Promise<VendorMaintenance[]> {
    return db.select().from(vendorMaintenances)
      .where(eq(vendorMaintenances.status, 'in_progress'))
      .orderBy(desc(vendorMaintenances.scheduledStartAt));
  }

  async getUpcomingVendorMaintenances(): Promise<VendorMaintenance[]> {
    return db.select().from(vendorMaintenances)
      .where(eq(vendorMaintenances.status, 'scheduled'))
      .orderBy(vendorMaintenances.scheduledStartAt);
  }

  async getVendorMaintenancesByVendor(vendorKey: string): Promise<VendorMaintenance[]> {
    return db.select().from(vendorMaintenances)
      .where(eq(vendorMaintenances.vendorKey, vendorKey))
      .orderBy(desc(vendorMaintenances.scheduledStartAt));
  }

  async upsertVendorMaintenance(maintenance: InsertVendorMaintenance): Promise<VendorMaintenance> {
    const existing = await db.select().from(vendorMaintenances)
      .where(and(
        eq(vendorMaintenances.vendorKey, maintenance.vendorKey),
        eq(vendorMaintenances.maintenanceId, maintenance.maintenanceId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(vendorMaintenances)
        .set({ ...maintenance, updatedAt: new Date() })
        .where(eq(vendorMaintenances.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(vendorMaintenances).values(maintenance).returning();
    return created;
  }

  async updateVendorMaintenance(id: string, data: Partial<InsertVendorMaintenance>): Promise<VendorMaintenance | undefined> {
    const [updated] = await db.update(vendorMaintenances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vendorMaintenances.id, id))
      .returning();
    return updated;
  }

  // Blockchain Maintenances
  async getBlockchainMaintenances(): Promise<BlockchainMaintenance[]> {
    return db.select().from(blockchainMaintenances).orderBy(desc(blockchainMaintenances.scheduledStartAt));
  }

  async getActiveBlockchainMaintenances(): Promise<BlockchainMaintenance[]> {
    return db.select().from(blockchainMaintenances)
      .where(eq(blockchainMaintenances.status, 'in_progress'))
      .orderBy(desc(blockchainMaintenances.scheduledStartAt));
  }

  async getUpcomingBlockchainMaintenances(): Promise<BlockchainMaintenance[]> {
    return db.select().from(blockchainMaintenances)
      .where(eq(blockchainMaintenances.status, 'scheduled'))
      .orderBy(blockchainMaintenances.scheduledStartAt);
  }

  async getBlockchainMaintenancesByChain(chainKey: string): Promise<BlockchainMaintenance[]> {
    return db.select().from(blockchainMaintenances)
      .where(eq(blockchainMaintenances.chainKey, chainKey))
      .orderBy(desc(blockchainMaintenances.scheduledStartAt));
  }

  async upsertBlockchainMaintenance(maintenance: InsertBlockchainMaintenance): Promise<BlockchainMaintenance> {
    const existing = await db.select().from(blockchainMaintenances)
      .where(and(
        eq(blockchainMaintenances.chainKey, maintenance.chainKey),
        eq(blockchainMaintenances.maintenanceId, maintenance.maintenanceId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(blockchainMaintenances)
        .set({ ...maintenance, updatedAt: new Date() })
        .where(eq(blockchainMaintenances.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(blockchainMaintenances).values(maintenance).returning();
    return created;
  }

  async updateBlockchainMaintenance(id: string, data: Partial<InsertBlockchainMaintenance>): Promise<BlockchainMaintenance | undefined> {
    const [updated] = await db.update(blockchainMaintenances)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(blockchainMaintenances.id, id))
      .returning();
    return updated;
  }

  // Maintenance stats
  async getMaintenanceStats(): Promise<{ vendorActive: number; vendorUpcoming: number; blockchainActive: number; blockchainUpcoming: number; total: number }> {
    const vendorActive = await db.select().from(vendorMaintenances).where(eq(vendorMaintenances.status, 'in_progress'));
    const vendorUpcoming = await db.select().from(vendorMaintenances).where(eq(vendorMaintenances.status, 'scheduled'));
    const blockchainActive = await db.select().from(blockchainMaintenances).where(eq(blockchainMaintenances.status, 'in_progress'));
    const blockchainUpcoming = await db.select().from(blockchainMaintenances).where(eq(blockchainMaintenances.status, 'scheduled'));
    
    return {
      vendorActive: vendorActive.length,
      vendorUpcoming: vendorUpcoming.length,
      blockchainActive: blockchainActive.length,
      blockchainUpcoming: blockchainUpcoming.length,
      total: vendorActive.length + vendorUpcoming.length + blockchainActive.length + blockchainUpcoming.length,
    };
  }

  // Analytics - User Activity
  async logUserActivity(userId: string, eventType: string, metadata?: Record<string, any>): Promise<void> {
    await db.insert(userActivityEvents).values({
      userId,
      eventType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  }

  async getUserActivityStats(userId: string, days: number = 30): Promise<{ logins: number; pageViews: number; acknowledgements: number; lastActive: Date | null }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const events = await db.select()
      .from(userActivityEvents)
      .where(and(
        eq(userActivityEvents.userId, userId),
        gte(userActivityEvents.createdAt, cutoff)
      ));
    
    const logins = events.filter(e => e.eventType === 'login').length;
    const pageViews = events.filter(e => e.eventType === 'page_view').length;
    const acknowledgements = events.filter(e => e.eventType === 'incident_ack' || e.eventType === 'maintenance_ack').length;
    
    const lastEvent = await db.select()
      .from(userActivityEvents)
      .where(eq(userActivityEvents.userId, userId))
      .orderBy(desc(userActivityEvents.createdAt))
      .limit(1);
    
    return {
      logins,
      pageViews,
      acknowledgements,
      lastActive: lastEvent[0]?.createdAt || null,
    };
  }

  async getUserRecentActivity(userId: string, limit: number = 20): Promise<Array<{ eventType: string; metadata: string | null; createdAt: Date }>> {
    const events = await db.select({
      eventType: userActivityEvents.eventType,
      metadata: userActivityEvents.metadata,
      createdAt: userActivityEvents.createdAt,
    })
      .from(userActivityEvents)
      .where(eq(userActivityEvents.userId, userId))
      .orderBy(desc(userActivityEvents.createdAt))
      .limit(limit);
    
    return events;
  }

  // Analytics - Vendor Performance (calculated from actual incidents)
  async getVendorPerformanceStats(vendorKey: string, days: number = 30): Promise<{ uptimePercent: number; incidentCount: number; avgResolutionMinutes: number | null }> {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();
    
    const allVendorIncidents = await db.select()
      .from(incidents)
      .where(eq(incidents.vendorKey, vendorKey));
    
    const relevantIncidents = allVendorIncidents.filter(incident => {
      const start = new Date(incident.startedAt);
      const end = incident.status === 'resolved' && incident.updatedAt 
        ? new Date(incident.updatedAt) 
        : now;
      return start < now && end > cutoff;
    });
    
    const incidentCount = relevantIncidents.length;
    
    if (incidentCount === 0) {
      return { uptimePercent: 100, incidentCount: 0, avgResolutionMinutes: null };
    }
    
    let totalDowntimeMinutes = 0;
    const resolutionTimes: number[] = [];
    
    for (const incident of relevantIncidents) {
      const incidentStart = new Date(incident.startedAt);
      const incidentEnd = incident.status === 'resolved' && incident.updatedAt 
        ? new Date(incident.updatedAt) 
        : now;
      const windowStart = incidentStart < cutoff ? cutoff : incidentStart;
      const windowEnd = incidentEnd > now ? now : incidentEnd;
      const durationMinutes = Math.max(0, (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60));
      totalDowntimeMinutes += durationMinutes;
      
      if (incident.status === 'resolved' && incident.updatedAt) {
        const fullDuration = (incidentEnd.getTime() - incidentStart.getTime()) / (1000 * 60);
        resolutionTimes.push(fullDuration);
      }
    }
    
    const totalPeriodMinutes = days * 24 * 60;
    const uptimePercent = Math.max(0, 100 - (totalDowntimeMinutes / totalPeriodMinutes) * 100);
    const avgResolution = resolutionTimes.length > 0 
      ? Math.round(resolutionTimes.reduce((sum, r) => sum + r, 0) / resolutionTimes.length)
      : null;
    
    return {
      uptimePercent: Math.round(uptimePercent * 100) / 100,
      incidentCount,
      avgResolutionMinutes: avgResolution,
    };
  }

  async getAllVendorPerformanceStats(days: number = 30): Promise<Array<{ vendorKey: string; vendorName: string; uptimePercent: number; incidentCount: number }>> {
    const allVendors = await this.getVendors();
    const results: Array<{ vendorKey: string; vendorName: string; uptimePercent: number; incidentCount: number }> = [];
    
    for (const vendor of allVendors) {
      const stats = await this.getVendorPerformanceStats(vendor.key, days);
      results.push({
        vendorKey: vendor.key,
        vendorName: vendor.name,
        uptimePercent: stats.uptimePercent,
        incidentCount: stats.incidentCount,
      });
    }
    
    return results.sort((a, b) => b.incidentCount - a.incidentCount);
  }

  // Analytics - Blockchain Performance (calculated from actual incidents)
  async getBlockchainPerformanceStats(chainKey: string, days: number = 30): Promise<{ uptimePercent: number; incidentCount: number; avgResolutionMinutes: number | null }> {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const allChainIncidents = await db.select()
      .from(blockchainIncidents)
      .where(eq(blockchainIncidents.chainKey, chainKey));
    
    const relevantIncidents = allChainIncidents.filter(incident => {
      const start = new Date(incident.startedAt);
      const end = incident.status === 'resolved' && incident.updatedAt 
        ? new Date(incident.updatedAt) 
        : now;
      return start < now && end > cutoff;
    });
    
    const incidentCount = relevantIncidents.length;
    
    if (incidentCount === 0) {
      return { uptimePercent: 100, incidentCount: 0, avgResolutionMinutes: null };
    }
    
    let totalDowntimeMinutes = 0;
    const resolutionTimes: number[] = [];
    
    for (const incident of relevantIncidents) {
      const incidentStart = new Date(incident.startedAt);
      const incidentEnd = incident.status === 'resolved' && incident.updatedAt 
        ? new Date(incident.updatedAt) 
        : now;
      const windowStart = incidentStart < cutoff ? cutoff : incidentStart;
      const windowEnd = incidentEnd > now ? now : incidentEnd;
      const durationMinutes = Math.max(0, (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60));
      totalDowntimeMinutes += durationMinutes;
      
      if (incident.status === 'resolved' && incident.updatedAt) {
        const fullDuration = (incidentEnd.getTime() - incidentStart.getTime()) / (1000 * 60);
        resolutionTimes.push(fullDuration);
      }
    }
    
    const totalPeriodMinutes = days * 24 * 60;
    const uptimePercent = Math.max(0, 100 - (totalDowntimeMinutes / totalPeriodMinutes) * 100);
    const avgResolution = resolutionTimes.length > 0 
      ? Math.round(resolutionTimes.reduce((sum, r) => sum + r, 0) / resolutionTimes.length)
      : null;
    
    return {
      uptimePercent: Math.round(uptimePercent * 100) / 100,
      incidentCount,
      avgResolutionMinutes: avgResolution,
    };
  }

  async getAllBlockchainPerformanceStats(days: number = 30): Promise<Array<{ chainKey: string; chainName: string; uptimePercent: number; incidentCount: number }>> {
    const allChains = await this.getBlockchainChains();
    const results: Array<{ chainKey: string; chainName: string; uptimePercent: number; incidentCount: number }> = [];
    
    for (const chain of allChains) {
      const stats = await this.getBlockchainPerformanceStats(chain.key, days);
      results.push({
        chainKey: chain.key,
        chainName: chain.name,
        uptimePercent: stats.uptimePercent,
        incidentCount: stats.incidentCount,
      });
    }
    
    return results.sort((a, b) => b.incidentCount - a.incidentCount);
  }

  async recordVendorDailyMetrics(vendorKey: string, date: string, metrics: { uptimeMinutes: number; downtimeMinutes: number; incidentCount: number; avgResolutionMinutes?: number }): Promise<void> {
    const existing = await db.select()
      .from(vendorDailyMetrics)
      .where(and(
        eq(vendorDailyMetrics.vendorKey, vendorKey),
        eq(vendorDailyMetrics.date, date)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(vendorDailyMetrics)
        .set({
          uptimeMinutes: metrics.uptimeMinutes,
          downtimeMinutes: metrics.downtimeMinutes,
          incidentCount: metrics.incidentCount,
          avgResolutionMinutes: metrics.avgResolutionMinutes ?? null,
        })
        .where(eq(vendorDailyMetrics.id, existing[0].id));
    } else {
      await db.insert(vendorDailyMetrics).values({
        vendorKey,
        date,
        ...metrics,
        avgResolutionMinutes: metrics.avgResolutionMinutes ?? null,
      });
    }
  }
}

export const storage = new DatabaseStorage();

// Default vendors to seed when database is empty
// parser types: statuspage_json (Statuspage.io API), aws_json (AWS Health Dashboard), manual (no API - manual monitoring)
const DEFAULT_VENDORS: InsertVendor[] = [
  { key: "aws", name: "AWS", statusUrl: "https://status.aws.amazon.com", parser: "aws_json", status: "operational" },
  { key: "azure", name: "Azure", statusUrl: "https://status.azure.com", parser: "manual", status: "operational" },
  { key: "microsoft365", name: "Microsoft 365", statusUrl: "https://status.office.com", parser: "manual", status: "operational" },
  { key: "googlews", name: "Google Workspace", statusUrl: "https://www.google.com/appsstatus/dashboard/", parser: "manual", status: "operational" },
  { key: "salesforce", name: "Salesforce", statusUrl: "https://status.salesforce.com", parser: "manual", status: "operational" },
  { key: "cloudflare", name: "Cloudflare", statusUrl: "https://www.cloudflarestatus.com", parser: "statuspage_json", status: "operational" },
  { key: "okta", name: "Okta", statusUrl: "https://status.okta.com", parser: "manual", status: "operational" },
  { key: "zoom", name: "Zoom", statusUrl: "https://status.zoom.us", parser: "statuspage_json", status: "operational" },
  { key: "atlassian", name: "Atlassian", statusUrl: "https://status.atlassian.com", parser: "statuspage_json", status: "operational" },
  { key: "connectwise", name: "ConnectWise", statusUrl: "https://status.connectwise.com/", parser: "manual", status: "operational" },
  { key: "nable", name: "N-able", statusUrl: "https://status.n-able.com/", parser: "manual", status: "operational" },
  { key: "kaseya", name: "Kaseya", statusUrl: "https://status.kaseya.com/", parser: "statuspage_json", status: "operational" },
  { key: "syncro", name: "Syncro", statusUrl: "https://www.syncrostatus.com/", parser: "manual", status: "operational" },
  { key: "sentinelone", name: "SentinelOne", statusUrl: "https://status.sentinelone.com/", parser: "statuspage_json", status: "operational" },
  { key: "auth0", name: "Auth0", statusUrl: "https://status.auth0.com/", parser: "manual", status: "operational" },
  { key: "pingidentity", name: "Ping Identity", statusUrl: "https://status.pingidentity.com/", parser: "statuspage_json", status: "operational" },
  { key: "slack", name: "Slack", statusUrl: "https://status.slack.com/", parser: "manual", status: "operational" },
  { key: "hubspot", name: "HubSpot", statusUrl: "https://status.hubspot.com/", parser: "statuspage_json", status: "operational" },
  { key: "quickbooks", name: "QuickBooks Online", statusUrl: "https://status.quickbooks.intuit.com/", parser: "statuspage_json", status: "operational" },
  { key: "netsuite", name: "Oracle NetSuite", statusUrl: "https://status.netsuite.com/", parser: "statuspage_json", status: "operational" },
  { key: "fastly", name: "Fastly", statusUrl: "https://status.fastly.com/", parser: "manual", status: "operational" },
  { key: "akamai", name: "Akamai", statusUrl: "https://www.akamaistatus.com/", parser: "statuspage_json", status: "operational" },
  { key: "veeam_datacloud", name: "Veeam Data Cloud", statusUrl: "https://vdcstatus.veeam.com/", parser: "statuspage_json", status: "operational" },
  { key: "fireblocks", name: "Fireblocks", statusUrl: "https://status.fireblocks.com/", parser: "statuspage_json", status: "operational" },
];

export async function seedVendorsIfEmpty(): Promise<void> {
  const existingVendors = await storage.getVendors();
  if (existingVendors.length === 0) {
    console.log('[seed] No vendors found, seeding default vendors...');
    for (const vendor of DEFAULT_VENDORS) {
      try {
        await storage.createVendor(vendor);
        console.log(`[seed] Created vendor: ${vendor.name}`);
      } catch (error) {
        console.log(`[seed] Vendor ${vendor.key} may already exist, skipping`);
      }
    }
    console.log('[seed] Vendor seeding complete');
  } else {
    console.log(`[seed] Found ${existingVendors.length} vendors, skipping seed`);
  }
}

// Default blockchain chains to seed
const DEFAULT_BLOCKCHAIN_CHAINS: InsertBlockchainChain[] = [
  // Tier 1: Must-Monitor (High Business Impact)
  { key: "bitcoin", name: "Bitcoin", symbol: "BTC", tier: "tier1", category: "chain", sourceType: "api", statusUrl: "https://www.blockchain.com/explorer", explorerUrl: "https://www.blockchain.com/explorer", avgBlockTime: 600 },
  { key: "ethereum", name: "Ethereum", symbol: "ETH", tier: "tier1", category: "chain", sourceType: "api", statusUrl: "https://etherscan.io", explorerUrl: "https://etherscan.io", avgBlockTime: 12 },
  { key: "solana", name: "Solana", symbol: "SOL", tier: "tier1", category: "chain", sourceType: "statuspage", statusUrl: "https://status.solana.com", explorerUrl: "https://explorer.solana.com", avgBlockTime: 1 },
  { key: "polygon", name: "Polygon PoS", symbol: "MATIC", tier: "tier1", category: "chain", sourceType: "statuspage", statusUrl: "https://polygon.technology/status", explorerUrl: "https://polygonscan.com", avgBlockTime: 2 },
  { key: "bsc", name: "BNB Smart Chain", symbol: "BNB", tier: "tier1", category: "chain", sourceType: "api", statusUrl: "https://bscscan.com", explorerUrl: "https://bscscan.com", avgBlockTime: 3 },
  
  // Tier 2: Infrastructure-Critical
  { key: "avalanche", name: "Avalanche", symbol: "AVAX", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.avax.network", explorerUrl: "https://snowtrace.io", avgBlockTime: 2 },
  { key: "arbitrum", name: "Arbitrum One", symbol: "ARB", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.arbitrum.io", explorerUrl: "https://arbiscan.io", avgBlockTime: 1 },
  { key: "optimism", name: "Optimism", symbol: "OP", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.optimism.io", explorerUrl: "https://optimistic.etherscan.io", avgBlockTime: 2 },
  { key: "base", name: "Base", symbol: "ETH", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.base.org", explorerUrl: "https://basescan.org", avgBlockTime: 2 },
  
  // Tier 3: Enterprise / Custody-Relevant
  { key: "tron", name: "TRON", symbol: "TRX", tier: "tier3", category: "chain", sourceType: "api", explorerUrl: "https://tronscan.org", avgBlockTime: 3 },
  { key: "stellar", name: "Stellar", symbol: "XLM", tier: "tier3", category: "chain", sourceType: "api", statusUrl: "https://status.stellar.org", explorerUrl: "https://stellar.expert", avgBlockTime: 5 },
  { key: "ripple", name: "XRP Ledger", symbol: "XRP", tier: "tier3", category: "chain", sourceType: "api", explorerUrl: "https://xrpscan.com", avgBlockTime: 4 },
  { key: "cosmos", name: "Cosmos Hub", symbol: "ATOM", tier: "tier3", category: "chain", sourceType: "api", explorerUrl: "https://www.mintscan.io/cosmos", avgBlockTime: 6 },
  
  // Tier 4: Dependencies & Ecosystem
  { key: "infura", name: "Infura", tier: "tier4", category: "rpc_provider", sourceType: "statuspage", statusUrl: "https://status.infura.io" },
  { key: "alchemy", name: "Alchemy", tier: "tier4", category: "rpc_provider", sourceType: "statuspage", statusUrl: "https://status.alchemy.com" },
  { key: "quicknode", name: "QuickNode", tier: "tier4", category: "rpc_provider", sourceType: "statuspage", statusUrl: "https://status.quicknode.com" },
  { key: "thegraph", name: "The Graph", tier: "tier4", category: "indexer", sourceType: "statuspage", statusUrl: "https://status.thegraph.com" },
];

export async function seedBlockchainChainsIfEmpty(): Promise<void> {
  const existingChains = await storage.getBlockchainChains();
  if (existingChains.length === 0) {
    console.log('[seed] No blockchain chains found, seeding defaults...');
    for (const chain of DEFAULT_BLOCKCHAIN_CHAINS) {
      try {
        await storage.createBlockchainChain(chain);
        console.log(`[seed] Created blockchain: ${chain.name}`);
      } catch (error) {
        console.log(`[seed] Chain ${chain.key} may already exist, skipping`);
      }
    }
    console.log('[seed] Blockchain seeding complete');
  } else {
    console.log(`[seed] Found ${existingChains.length} blockchain chains, skipping seed`);
  }
}
