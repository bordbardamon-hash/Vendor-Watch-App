import { 
  users, vendors, incidents, incidentArchive, jobs, config, feedback, notificationConsents, incidentAlerts, userVendorSubscriptions, userVendorOrder, customVendorRequests, parserHealth,
  blockchainChains, blockchainIncidents, blockchainIncidentArchive, userBlockchainSubscriptions, incidentAcknowledgements, maintenanceAcknowledgements,
  vendorMaintenances, blockchainMaintenances, userActivityEvents, vendorDailyMetrics, psaWebhooks,
  slaContracts, slaBreaches, syntheticProbes, syntheticProbeResults,
  clients, clientVendorLinks, incidentPlaybooks, incidentPlaybookSteps, userIntegrations,
  organizations, organizationMembers, organizationInvitations, orgAlertAssignments,
  clientPortals, portalVendorAssignments, portalSubscribers,
  psaIntegrations, psaTicketRules, psaTicketLinks,
  vendorTelemetryMetrics, outagePredictions, predictionPatterns,
  vendorComponents,
  userWebhooks, webhookLogs, apiKeys, apiRequestLogs, auditLogs, ssoConfigurations,
  uptimeReports, reportSchedules,
  notificationQueue, systemHealthState,
  type Organization, type InsertOrganization,
  type OrganizationMember, type InsertOrganizationMember,
  type OrganizationInvitation, type InsertOrganizationInvitation,
  type OrgAlertAssignment, type InsertOrgAlertAssignment,
  type MemberRole,
  type User, type UpsertUser,
  type Vendor, type InsertVendor,
  type Incident, type InsertIncident,
  type IncidentArchive, type InsertIncidentArchive,
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
  type BlockchainIncidentArchive, type InsertBlockchainIncidentArchive,
  type IncidentAcknowledgement,
  type MaintenanceAcknowledgement,
  type VendorMaintenance, type InsertVendorMaintenance,
  type BlockchainMaintenance, type InsertBlockchainMaintenance,
  type PsaWebhook, type InsertPsaWebhook,
  type SlaContract, type InsertSlaContract,
  type SlaBreach, type InsertSlaBreach,
  type SyntheticProbe, type InsertSyntheticProbe,
  type SyntheticProbeResult, type InsertSyntheticProbeResult,
  type Client, type InsertClient,
  type ClientVendorLink, type InsertClientVendorLink,
  type IncidentPlaybook, type InsertIncidentPlaybook,
  type IncidentPlaybookStep, type InsertIncidentPlaybookStep,
  type UserIntegration, type InsertUserIntegration,
  type ClientPortal, type InsertClientPortal,
  type PortalVendorAssignment, type InsertPortalVendorAssignment,
  type PortalSubscriber, type InsertPortalSubscriber,
  type PsaIntegration, type InsertPsaIntegration,
  type PsaTicketRule, type InsertPsaTicketRule,
  type PsaTicketLink, type InsertPsaTicketLink,
  type VendorTelemetryMetric, type InsertVendorTelemetryMetric,
  type OutagePrediction, type InsertOutagePrediction,
  type PredictionPattern, type InsertPredictionPattern,
  type VendorComponent, type InsertVendorComponent,
  type UserWebhook, type InsertUserWebhook,
  type WebhookLog, type InsertWebhookLog,
  type ApiKey, type InsertApiKey,
  type ApiRequestLog, type InsertApiRequestLog,
  type AuditLog, type InsertAuditLog,
  type SsoConfiguration, type InsertSsoConfiguration,
  type UptimeReport, type InsertUptimeReport,
  type ReportSchedule, type InsertReportSchedule,
  SUBSCRIPTION_TIERS
} from "@shared/schema";
import { and, isNull, inArray, gte, lte, lt, sql, count, ilike, or } from "drizzle-orm";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// Helper to normalize subscription tier (handle legacy 'platinum' tier)
function normalizeTier(tier: string | null): 'essential' | 'growth' | 'enterprise' | null {
  if (!tier) return null;
  // Map 'platinum' to 'enterprise' for backwards compatibility
  if (tier === 'platinum') return 'enterprise';
  if (tier === 'essential' || tier === 'growth' || tier === 'enterprise') {
    return tier;
  }
  return null;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string | null; billingStatus?: string; billingCompleted?: boolean }): Promise<User | undefined>;
  updateUserTrialEnd(userId: string, trialEndsAt: Date): Promise<User | undefined>;
  updateUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined>;
  deleteUser(userId: string): Promise<boolean>;
  createUserManual(data: { email: string; firstName: string; lastName: string; companyName?: string; phone?: string; subscriptionTier?: 'essential' | 'growth' | 'enterprise' | null; isAdmin?: boolean }): Promise<User>;
  
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
  updateIncident(id: string, data: { status?: string; severity?: string; impact?: string; updatedAt?: string; manuallyResolvedAt?: Date | null }): Promise<Incident | undefined>;
  deleteIncident(id: string): Promise<boolean>;
  
  // Incident Archive
  archiveIncident(incident: Incident): Promise<IncidentArchive>;
  searchArchivedIncidents(options: { vendorKey?: string; query?: string; dateRange?: string; limit?: number; offset?: number }): Promise<IncidentArchive[]>;
  getArchivedIncidentsCount(options?: { vendorKey?: string; query?: string }): Promise<number>;
  archiveResolvedIncidents(olderThanDays: number): Promise<number>;
  purgeOldArchivedIncidents(olderThanDays: number): Promise<number>;
  
  // Blockchain Incident Archive
  archiveBlockchainIncident(incident: BlockchainIncident): Promise<BlockchainIncidentArchive>;
  searchArchivedBlockchainIncidents(options: { chainKey?: string; query?: string; dateRange?: string; limit?: number; offset?: number }): Promise<BlockchainIncidentArchive[]>;
  getArchivedBlockchainIncidentsCount(options?: { chainKey?: string; query?: string }): Promise<number>;
  archiveResolvedBlockchainIncidents(olderThanDays: number): Promise<number>;
  purgeOldArchivedBlockchainIncidents(olderThanDays: number): Promise<number>;
  
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
  updateUserNotifications(userId: string, prefs: { notificationEmail?: string; phone?: string; notifyEmail?: boolean; notifySms?: boolean; timezone?: string }): Promise<User | undefined>;
  
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
  getAlertDeliveryHistory(userId: string, limit?: number, offset?: number): Promise<{ alerts: IncidentAlert[]; total: number }>;
  tryReserveAlert(alert: { incidentId: string; userId: string; channel: string; eventType: string; statusSnapshot: string; destination: string; deliveryStatus?: string; errorMessage?: string }): Promise<boolean>;
  
  // System Health
  upsertHealthState(componentName: string, data: Partial<{ status: string; lastRunAt: Date; lastSuccessAt: Date; lastErrorAt: Date; lastErrorMessage: string; consecutiveFailures: number; metadata: string }>): Promise<void>;
  getHealthStates(): Promise<Array<{ componentName: string; status: string; lastRunAt: Date | null; lastSuccessAt: Date | null; lastErrorAt: Date | null; lastErrorMessage: string | null; consecutiveFailures: number; updatedAt: Date }>>;
  
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
  getBlockchainIncidentsForUser(userId: string): Promise<BlockchainIncident[]>;
  
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
  updateUserSubscriptionTier(userId: string, tier: 'essential' | 'growth' | 'enterprise' | null): Promise<User | undefined>;
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
  getBlockchainIncident(id: string): Promise<BlockchainIncident | undefined>;
  getBlockchainIncidentsByChain(chainKey: string): Promise<BlockchainIncident[]>;
  getActiveBlockchainIncidents(): Promise<BlockchainIncident[]>;
  createBlockchainIncident(incident: InsertBlockchainIncident): Promise<BlockchainIncident>;
  updateBlockchainIncident(id: string, data: Partial<InsertBlockchainIncident>): Promise<BlockchainIncident | undefined>;
  
  // Blockchain Subscriptions
  getUserBlockchainSubscriptions(userId: string): Promise<string[]>;
  setUserBlockchainSubscriptions(userId: string, chainKeys: string[]): Promise<void>;
  hasUserSetBlockchainSubscriptions(userId: string): Promise<boolean>;
  resetUserBlockchainSubscriptions(userId: string): Promise<void>;
  checkBlockchainLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number | null; tier: string | null }>;
  hasBlockchainAlertBeenSent(incidentId: string, userId: string, channel: string, eventType: string, statusSnapshot: string): Promise<boolean>;
  recordBlockchainAlert(alert: { incidentId: string; userId: string; channel: string; eventType: string; statusSnapshot: string; destination: string }): Promise<void>;
  tryReserveBlockchainAlert(alert: { incidentId: string; userId: string; channel: string; eventType: string; statusSnapshot: string; destination: string }): Promise<boolean>;
  
  // Toggle individual vendor/blockchain subscription
  toggleVendorSubscription(userId: string, vendorKey: string): Promise<{ subscribed: boolean; current: number; limit: number | null }>;
  toggleBlockchainSubscription(userId: string, chainKey: string): Promise<{ subscribed: boolean; current: number; limit: number | null }>;
  
  // Incident Acknowledgements
  acknowledgeIncident(userId: string, incidentId: string, incidentType: 'vendor' | 'blockchain'): Promise<IncidentAcknowledgement>;
  unacknowledgeIncident(userId: string, incidentId: string): Promise<boolean>;
  isIncidentAcknowledged(userId: string, incidentId: string): Promise<boolean>;
  getUserAcknowledgements(userId: string): Promise<IncidentAcknowledgement[]>;
  getIncidentAcknowledgementHistory(incidentId: string): Promise<Array<{ userId: string; userName: string; userEmail: string; acknowledgedAt: Date }>>;
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
  
  // PSA Webhooks
  getPsaWebhooks(userId: string): Promise<PsaWebhook[]>;
  getPsaWebhook(id: string): Promise<PsaWebhook | undefined>;
  createPsaWebhook(webhook: InsertPsaWebhook): Promise<PsaWebhook>;
  updatePsaWebhook(id: string, data: Partial<InsertPsaWebhook>): Promise<PsaWebhook | undefined>;
  deletePsaWebhook(id: string): Promise<boolean>;
  getActiveWebhooksForEvent(event: string): Promise<PsaWebhook[]>;
  recordWebhookResult(id: string, success: boolean): Promise<void>;
  
  // SLA Contracts
  getSlaContracts(userId: string): Promise<SlaContract[]>;
  getSlaContract(id: string): Promise<SlaContract | undefined>;
  createSlaContract(contract: InsertSlaContract): Promise<SlaContract>;
  updateSlaContract(id: string, data: Partial<InsertSlaContract>): Promise<SlaContract | undefined>;
  deleteSlaContract(id: string): Promise<boolean>;
  
  // SLA Breaches
  getSlaBreaches(userId: string): Promise<SlaBreach[]>;
  getSlaBreachesByContract(contractId: string): Promise<SlaBreach[]>;
  createSlaBreach(breach: InsertSlaBreach): Promise<SlaBreach>;
  updateSlaBreach(id: string, data: Partial<InsertSlaBreach>): Promise<SlaBreach | undefined>;
  
  // Synthetic Monitoring
  getSyntheticProbes(userId: string): Promise<SyntheticProbe[]>;
  getSyntheticProbe(id: string): Promise<SyntheticProbe | undefined>;
  createSyntheticProbe(probe: InsertSyntheticProbe): Promise<SyntheticProbe>;
  updateSyntheticProbe(id: string, data: Partial<InsertSyntheticProbe>): Promise<SyntheticProbe | undefined>;
  deleteSyntheticProbe(id: string): Promise<boolean>;
  getSyntheticProbeResults(probeId: string, limit?: number): Promise<SyntheticProbeResult[]>;
  createSyntheticProbeResult(result: InsertSyntheticProbeResult): Promise<SyntheticProbeResult>;
  
  // MSP Clients
  getClients(userId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  
  // Client-Vendor Links
  getClientVendorLinks(userId: string): Promise<ClientVendorLink[]>;
  getVendorClients(userId: string, vendorKey: string): Promise<Client[]>;
  getClientVendors(clientId: string): Promise<string[]>;
  linkVendorToClient(userId: string, clientId: string, vendorKey: string, priority?: string): Promise<ClientVendorLink>;
  unlinkVendorFromClient(userId: string, clientId: string, vendorKey: string): Promise<boolean>;
  
  // Incident Playbooks
  getPlaybooks(userId: string): Promise<IncidentPlaybook[]>;
  getPlaybook(id: string): Promise<IncidentPlaybook | undefined>;
  getPlaybookForIncident(userId: string, vendorKey: string, severity?: string): Promise<IncidentPlaybook | undefined>;
  createPlaybook(playbook: InsertIncidentPlaybook): Promise<IncidentPlaybook>;
  updatePlaybook(id: string, data: Partial<InsertIncidentPlaybook>): Promise<IncidentPlaybook | undefined>;
  deletePlaybook(id: string): Promise<boolean>;
  
  // Playbook Steps
  getPlaybookSteps(playbookId: string): Promise<IncidentPlaybookStep[]>;
  createPlaybookStep(step: InsertIncidentPlaybookStep): Promise<IncidentPlaybookStep>;
  updatePlaybookStep(id: string, data: Partial<InsertIncidentPlaybookStep>): Promise<IncidentPlaybookStep | undefined>;
  deletePlaybookStep(id: string): Promise<boolean>;
  reorderPlaybookSteps(playbookId: string, stepIds: string[]): Promise<void>;
  
  // SLA Countdown Timers
  getActiveSlaTimers(userId: string): Promise<Array<{
    contractId: string;
    contractName: string;
    vendorKey: string;
    resourceType: string;
    incidentId: string;
    incidentTitle: string;
    incidentStartedAt: string;
    responseTimeMinutes: number | null;
    resolutionTimeMinutes: number | null;
    responseDeadline: Date | null;
    resolutionDeadline: Date | null;
    isResponseBreached: boolean;
    isResolutionBreached: boolean;
  }>>;
  
  // User Integrations (Slack, Teams, PSA, Webhooks, etc.)
  getUserIntegrations(userId: string): Promise<Array<{
    id: string;
    userId: string;
    integrationType: string;
    name: string;
    isActive: boolean;
    isDefault: boolean | null;
    lastTestedAt: Date | null;
    lastTestSuccess: boolean | null;
    createdAt: Date;
    hasWebhook: boolean;
    hasApiKey: boolean;
    hasPhone: boolean;
  }>>;
  getUserIntegration(id: string): Promise<any>;
  getUserIntegrationFull(id: string): Promise<any>;
  createUserIntegration(data: any): Promise<any>;
  updateUserIntegration(id: string, data: any): Promise<any>;
  deleteUserIntegration(id: string): Promise<boolean>;
  testUserIntegration(id: string, success: boolean): Promise<any>;
  getDefaultIntegrationForType(userId: string, integrationType: string): Promise<any>;
  
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationByDomain(domain: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;
  getUserOrganization(userId: string): Promise<Organization | undefined>;
  
  // Organization Members
  getOrganizationMembers(orgId: string): Promise<Array<OrganizationMember & { user: User }>>;
  getOrganizationMember(orgId: string, userId: string): Promise<OrganizationMember | undefined>;
  getMasterAdminCount(orgId: string): Promise<number>;
  addOrganizationMember(member: InsertOrganizationMember): Promise<OrganizationMember>;
  updateOrganizationMemberRole(orgId: string, userId: string, role: MemberRole): Promise<OrganizationMember | undefined>;
  removeOrganizationMember(orgId: string, userId: string): Promise<boolean>;
  getUserRole(userId: string): Promise<{ organizationId: string; role: MemberRole } | undefined>;
  
  // Organization Invitations
  getOrganizationInvitations(orgId: string): Promise<OrganizationInvitation[]>;
  getInvitationByToken(token: string): Promise<OrganizationInvitation | undefined>;
  getInvitationByEmail(orgId: string, email: string): Promise<OrganizationInvitation | undefined>;
  createOrganizationInvitation(invitation: InsertOrganizationInvitation): Promise<OrganizationInvitation>;
  updateInvitationStatus(id: string, status: string): Promise<OrganizationInvitation | undefined>;
  deleteOrganizationInvitation(id: string): Promise<boolean>;
  
  // Alert Assignments
  getAlertAssignments(orgId: string): Promise<OrgAlertAssignment[]>;
  getAlertAssignmentsForMember(orgId: string, userId: string): Promise<OrgAlertAssignment[]>;
  getAssignedUsersForTarget(orgId: string, targetType: string, targetKey: string): Promise<OrgAlertAssignment[]>;
  createAlertAssignment(assignment: InsertOrgAlertAssignment): Promise<OrgAlertAssignment>;
  deleteAlertAssignment(id: string): Promise<boolean>;
  deleteAlertAssignmentsByMember(orgId: string, userId: string): Promise<void>;
  getGlobalAssignmentsForTarget(targetType: string, targetKey: string): Promise<OrgAlertAssignment[]>;
  
  // ============ CLIENT PORTALS ============
  getClientPortals(userId: string): Promise<ClientPortal[]>;
  getClientPortal(id: string): Promise<ClientPortal | undefined>;
  getClientPortalBySlug(slug: string): Promise<ClientPortal | undefined>;
  createClientPortal(portal: InsertClientPortal): Promise<ClientPortal>;
  updateClientPortal(id: string, data: Partial<InsertClientPortal>): Promise<ClientPortal | undefined>;
  deleteClientPortal(id: string): Promise<boolean>;
  incrementPortalViewCount(id: string): Promise<void>;
  
  // Portal Vendor Assignments
  getPortalVendorAssignments(portalId: string): Promise<PortalVendorAssignment[]>;
  createPortalVendorAssignment(assignment: InsertPortalVendorAssignment): Promise<PortalVendorAssignment>;
  updatePortalVendorAssignment(id: string, data: Partial<InsertPortalVendorAssignment>): Promise<PortalVendorAssignment | undefined>;
  deletePortalVendorAssignment(id: string): Promise<boolean>;
  deletePortalVendorAssignmentsByPortal(portalId: string): Promise<void>;
  
  // Portal Subscribers
  getPortalSubscribers(portalId: string): Promise<PortalSubscriber[]>;
  createPortalSubscriber(subscriber: InsertPortalSubscriber): Promise<PortalSubscriber>;
  verifyPortalSubscriber(token: string): Promise<PortalSubscriber | undefined>;
  unsubscribePortalSubscriber(token: string): Promise<PortalSubscriber | undefined>;
  
  // ============ PSA INTEGRATIONS ============
  getPsaIntegrations(userId: string): Promise<PsaIntegration[]>;
  getPsaIntegration(id: string): Promise<PsaIntegration | undefined>;
  createPsaIntegration(integration: InsertPsaIntegration): Promise<PsaIntegration>;
  updatePsaIntegration(id: string, data: Partial<InsertPsaIntegration>): Promise<PsaIntegration | undefined>;
  deletePsaIntegration(id: string): Promise<boolean>;
  updatePsaIntegrationSync(id: string, success: boolean, error?: string): Promise<void>;
  
  // PSA Ticket Rules
  getPsaTicketRules(integrationId: string): Promise<PsaTicketRule[]>;
  getPsaTicketRule(id: string): Promise<PsaTicketRule | undefined>;
  createPsaTicketRule(rule: InsertPsaTicketRule): Promise<PsaTicketRule>;
  updatePsaTicketRule(id: string, data: Partial<InsertPsaTicketRule>): Promise<PsaTicketRule | undefined>;
  deletePsaTicketRule(id: string): Promise<boolean>;
  getMatchingPsaTicketRules(vendorKey: string | null, chainKey: string | null, severity: string): Promise<PsaTicketRule[]>;
  
  // PSA Ticket Links
  getPsaTicketLinks(integrationId: string): Promise<PsaTicketLink[]>;
  getPsaTicketLink(incidentId: string): Promise<PsaTicketLink | undefined>;
  createPsaTicketLink(link: InsertPsaTicketLink): Promise<PsaTicketLink>;
  updatePsaTicketLink(id: string, data: Partial<InsertPsaTicketLink>): Promise<PsaTicketLink | undefined>;
  
  // ============ PREDICTIVE ANALYTICS ============
  getVendorTelemetryMetrics(vendorKey: string, days?: number): Promise<VendorTelemetryMetric[]>;
  getBlockchainTelemetryMetrics(chainKey: string, days?: number): Promise<VendorTelemetryMetric[]>;
  createVendorTelemetryMetric(metric: InsertVendorTelemetryMetric): Promise<VendorTelemetryMetric>;
  aggregateTelemetryForPredictions(resourceType: string, sinceDate?: Date): Promise<Array<{
    resourceKey: string;
    dayOfWeek: number;
    hourOfDay: number;
    avgIncidentCount: number;
    totalIncidents: number;
    occurrences: number;
    criticalCount: number;
    majorCount: number;
    minorCount: number;
  }>>;
  
  // Outage Predictions
  getOutagePredictions(userId: string): Promise<OutagePrediction[]>;
  getActivePredictions(): Promise<OutagePrediction[]>;
  getOutagePrediction(id: string): Promise<OutagePrediction | undefined>;
  createOutagePrediction(prediction: InsertOutagePrediction): Promise<OutagePrediction>;
  updateOutagePrediction(id: string, data: Partial<InsertOutagePrediction> & { actualIncidentId?: string | null }): Promise<OutagePrediction | undefined>;
  getAllOutagePredictions(): Promise<OutagePrediction[]>;
  acknowledgePrediction(id: string, userId: string): Promise<OutagePrediction | undefined>;
  dismissPrediction(id: string): Promise<OutagePrediction | undefined>;
  providePredictionFeedback(id: string, score: number, notes?: string): Promise<OutagePrediction | undefined>;
  deletePrediction(id: string): Promise<boolean>;
  
  // Prediction Patterns
  getPredictionPatterns(resourceType?: string): Promise<PredictionPattern[]>;
  getPredictionPattern(id: string): Promise<PredictionPattern | undefined>;
  createPredictionPattern(pattern: InsertPredictionPattern): Promise<PredictionPattern>;
  updatePredictionPattern(id: string, data: Partial<InsertPredictionPattern>): Promise<PredictionPattern | undefined>;
  deletePredictionPattern(id: string): Promise<boolean>;
  
  // Data Retention / Purge
  purgeOldTelemetry(olderThanDays: number): Promise<number>;
  purgeOldPredictions(olderThanDays: number): Promise<number>;
  purgeOldActivityEvents(olderThanDays: number): Promise<number>;
  
  // Vendor Components
  getVendorComponents(vendorKey: string): Promise<VendorComponent[]>;
  getAllVendorComponents(): Promise<VendorComponent[]>;
  upsertVendorComponent(data: InsertVendorComponent): Promise<VendorComponent>;

  // User Webhooks
  getUserWebhooks(userId: string): Promise<UserWebhook[]>;
  getUserWebhook(id: string): Promise<UserWebhook | undefined>;
  createUserWebhook(webhook: InsertUserWebhook): Promise<UserWebhook>;
  updateUserWebhook(id: string, data: Partial<InsertUserWebhook>): Promise<UserWebhook | undefined>;
  deleteUserWebhook(id: string): Promise<boolean>;
  getActiveWebhooksForVendorEvent(vendorKey: string, eventType: string): Promise<UserWebhook[]>;
  recordWebhookDelivery(id: string, success: boolean, status?: number, error?: string): Promise<void>;
  
  // Webhook Logs
  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  getWebhookLogs(webhookId: string, limit?: number): Promise<WebhookLog[]>;
  
  // API Keys
  getApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, data: Partial<InsertApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<boolean>;
  recordApiKeyUsage(id: string): Promise<void>;
  
  // API Request Logs  
  createApiRequestLog(log: InsertApiRequestLog): Promise<ApiRequestLog>;
  getApiRequestLogs(apiKeyId: string, limit?: number): Promise<ApiRequestLog[]>;
  
  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(options?: { userId?: string; action?: string; resourceType?: string; limit?: number; offset?: number }): Promise<AuditLog[]>;
  getAuditLogsCount(options?: { userId?: string; action?: string; resourceType?: string }): Promise<number>;
  
  // SSO Configurations
  getSsoConfigurations(organizationId: string): Promise<SsoConfiguration[]>;
  getSsoConfiguration(id: string): Promise<SsoConfiguration | undefined>;
  getSsoConfigurationByDomain(emailDomain: string): Promise<SsoConfiguration | undefined>;
  createSsoConfiguration(config: InsertSsoConfiguration): Promise<SsoConfiguration>;
  updateSsoConfiguration(id: string, data: Partial<InsertSsoConfiguration>): Promise<SsoConfiguration | undefined>;
  deleteSsoConfiguration(id: string): Promise<boolean>;
  
  // ============ UPTIME REPORTS ============
  getUptimeReports(userId: string): Promise<UptimeReport[]>;
  getUptimeReport(id: string): Promise<UptimeReport | undefined>;
  createUptimeReport(report: InsertUptimeReport): Promise<UptimeReport>;
  updateUptimeReport(id: string, data: Partial<InsertUptimeReport>): Promise<UptimeReport | undefined>;
  deleteUptimeReport(id: string): Promise<boolean>;
  
  // Report Schedules
  getReportSchedules(userId: string): Promise<ReportSchedule[]>;
  createReportSchedule(schedule: InsertReportSchedule): Promise<ReportSchedule>;
  updateReportSchedule(id: string, data: Partial<InsertReportSchedule>): Promise<ReportSchedule | undefined>;
  deleteReportSchedule(id: string): Promise<boolean>;
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

  async updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; stripeSubscriptionId?: string | null; billingStatus?: string; billingCompleted?: boolean }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...stripeInfo, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async updateUserTrialEnd(userId: string, trialEndsAt: Date): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ trialEndsAt, updatedAt: new Date() })
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

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async createUserManual(data: { email: string; firstName: string; lastName: string; companyName?: string; phone?: string; subscriptionTier?: 'essential' | 'growth' | 'enterprise' | null; isAdmin?: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        companyName: data.companyName || null,
        phone: data.phone || null,
        subscriptionTier: data.subscriptionTier || null,
        isAdmin: data.isAdmin || false,
        notifyEmail: false,
        notifySms: false,
      })
      .returning();
    return user;
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
    const allIncidents = await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(100);
    return allIncidents.filter(i => !i.title.startsWith('_system') && !i.title.includes('_system_metadata'));
  }
  
  async getIncidentsByVendor(vendorKey: string): Promise<Incident[]> {
    const vendorIncidents = await db.select().from(incidents)
      .where(eq(incidents.vendorKey, vendorKey))
      .orderBy(desc(incidents.createdAt));
    return vendorIncidents.filter(i => !i.title.startsWith('_system') && !i.title.includes('_system_metadata'));
  }
  
  async getIncidentById(id: string): Promise<Incident | undefined> {
    const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
    return incident || undefined;
  }
  
  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [newIncident] = await db
      .insert(incidents)
      .values(incident)
      .returning();
    return newIncident;
  }
  
  async updateIncident(id: string, data: { status?: string; severity?: string; impact?: string; updatedAt?: string; manuallyResolvedAt?: Date | null }): Promise<Incident | undefined> {
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
  
  // Incident Archive
  async archiveIncident(incident: Incident): Promise<IncidentArchive> {
    const [archived] = await db.insert(incidentArchive).values({
      originalId: incident.id,
      vendorKey: incident.vendorKey,
      incidentId: incident.incidentId,
      title: incident.title,
      status: incident.status,
      severity: incident.severity,
      impact: incident.impact,
      url: incident.url,
      rawHash: incident.rawHash,
      startedAt: incident.startedAt,
      updatedAt: incident.updatedAt,
      resolvedAt: new Date(),
      createdAt: incident.createdAt,
    }).returning();
    return archived;
  }
  
  async searchArchivedIncidents(options: { vendorKey?: string; query?: string; dateRange?: string; limit?: number; offset?: number }): Promise<IncidentArchive[]> {
    const conditions = [];
    
    if (options.vendorKey) {
      conditions.push(eq(incidentArchive.vendorKey, options.vendorKey));
    }
    
    if (options.query) {
      conditions.push(or(
        ilike(incidentArchive.title, `%${options.query}%`),
        ilike(incidentArchive.impact, `%${options.query}%`)
      ));
    }
    
    if (options.dateRange) {
      const now = new Date();
      let cutoffDate: Date;
      switch (options.dateRange) {
        case '7d':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '6m':
          cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }
      conditions.push(gte(incidentArchive.resolvedAt, cutoffDate));
    }
    
    const query = db
      .select()
      .from(incidentArchive)
      .orderBy(desc(incidentArchive.archivedAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }
  
  async getArchivedIncidentsCount(options?: { vendorKey?: string; query?: string }): Promise<number> {
    const conditions = [];
    
    if (options?.vendorKey) {
      conditions.push(eq(incidentArchive.vendorKey, options.vendorKey));
    }
    
    if (options?.query) {
      conditions.push(or(
        ilike(incidentArchive.title, `%${options.query}%`),
        ilike(incidentArchive.impact, `%${options.query}%`)
      ));
    }
    
    const [result] = conditions.length > 0
      ? await db.select({ count: count() }).from(incidentArchive).where(and(...conditions))
      : await db.select({ count: count() }).from(incidentArchive);
    
    return result?.count || 0;
  }
  
  async archiveResolvedIncidents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const resolvedIncidents = await db
      .select()
      .from(incidents)
      .where(and(
        eq(incidents.status, 'resolved'),
        lte(incidents.createdAt, cutoffDate)
      ));
    
    let archivedCount = 0;
    for (const incident of resolvedIncidents) {
      await this.archiveIncident(incident);
      await this.deleteIncident(incident.id);
      archivedCount++;
    }
    
    return archivedCount;
  }
  
  async purgeOldArchivedIncidents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db
      .delete(incidentArchive)
      .where(lte(incidentArchive.archivedAt, cutoffDate));
    
    return result.rowCount || 0;
  }
  
  // Blockchain Incident Archive
  async archiveBlockchainIncident(incident: BlockchainIncident): Promise<BlockchainIncidentArchive> {
    const [archived] = await db.insert(blockchainIncidentArchive).values({
      originalId: incident.id,
      chainKey: incident.chainKey,
      incidentId: incident.incidentId,
      incidentType: incident.incidentType,
      title: incident.title,
      description: incident.description,
      status: incident.status,
      severity: incident.severity,
      affectedServices: incident.affectedServices,
      url: incident.url,
      rawHash: incident.rawHash,
      startedAt: incident.startedAt,
      updatedAt: incident.updatedAt,
      resolvedAt: incident.resolvedAt || new Date(),
      createdAt: incident.createdAt,
    }).returning();
    return archived;
  }
  
  async searchArchivedBlockchainIncidents(options: { chainKey?: string; query?: string; dateRange?: string; limit?: number; offset?: number }): Promise<BlockchainIncidentArchive[]> {
    const conditions = [];
    
    if (options.chainKey) {
      conditions.push(eq(blockchainIncidentArchive.chainKey, options.chainKey));
    }
    
    if (options.query) {
      conditions.push(or(
        ilike(blockchainIncidentArchive.title, `%${options.query}%`),
        ilike(blockchainIncidentArchive.description || '', `%${options.query}%`)
      ));
    }
    
    if (options.dateRange) {
      const now = new Date();
      let startDate: Date;
      switch (options.dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      conditions.push(gte(blockchainIncidentArchive.archivedAt, startDate));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    return db.select()
      .from(blockchainIncidentArchive)
      .where(whereClause)
      .orderBy(desc(blockchainIncidentArchive.archivedAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);
  }
  
  async getArchivedBlockchainIncidentsCount(options?: { chainKey?: string; query?: string }): Promise<number> {
    const conditions = [];
    
    if (options?.chainKey) {
      conditions.push(eq(blockchainIncidentArchive.chainKey, options.chainKey));
    }
    
    if (options?.query) {
      conditions.push(or(
        ilike(blockchainIncidentArchive.title, `%${options.query}%`),
        ilike(blockchainIncidentArchive.description || '', `%${options.query}%`)
      ));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [result] = whereClause
      ? await db.select({ count: count() }).from(blockchainIncidentArchive).where(whereClause)
      : await db.select({ count: count() }).from(blockchainIncidentArchive);
    
    return result?.count || 0;
  }
  
  async archiveResolvedBlockchainIncidents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const resolvedIncidents = await db
      .select()
      .from(blockchainIncidents)
      .where(and(
        eq(blockchainIncidents.status, 'resolved'),
        lte(blockchainIncidents.createdAt, cutoffDate)
      ));
    
    let archivedCount = 0;
    for (const incident of resolvedIncidents) {
      await this.archiveBlockchainIncident(incident);
      await db.delete(blockchainIncidents).where(eq(blockchainIncidents.id, incident.id));
      archivedCount++;
    }
    
    return archivedCount;
  }
  
  async purgeOldArchivedBlockchainIncidents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db
      .delete(blockchainIncidentArchive)
      .where(lte(blockchainIncidentArchive.archivedAt, cutoffDate));
    
    return result.rowCount || 0;
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
  async updateUserNotifications(userId: string, prefs: { notificationEmail?: string; phone?: string; notifyEmail?: boolean; notifySms?: boolean; timezone?: string }): Promise<User | undefined> {
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

  async tryReserveAlert(alert: { incidentId: string; userId: string; channel: string; eventType: string; statusSnapshot: string; destination: string; deliveryStatus?: string; errorMessage?: string }): Promise<boolean> {
    try {
      await db.insert(incidentAlerts).values({
        incidentId: alert.incidentId,
        userId: alert.userId,
        channel: alert.channel,
        eventType: alert.eventType,
        statusSnapshot: alert.statusSnapshot,
        destination: alert.destination,
        deliveryStatus: alert.deliveryStatus || 'pending',
        errorMessage: alert.errorMessage,
      });
      return true;
    } catch (error: any) {
      if (error?.code === '23505' || error?.message?.includes('unique constraint') || error?.message?.includes('duplicate key')) {
        return false;
      }
      throw error;
    }
  }

  async getAlertDeliveryHistory(userId: string, limit: number = 50, offset: number = 0): Promise<{ alerts: IncidentAlert[]; total: number }> {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(incidentAlerts)
      .where(eq(incidentAlerts.userId, userId));
    
    const alerts = await db
      .select()
      .from(incidentAlerts)
      .where(eq(incidentAlerts.userId, userId))
      .orderBy(desc(incidentAlerts.sentAt))
      .limit(limit)
      .offset(offset);
    
    return { alerts, total: countResult?.count || 0 };
  }

  async upsertHealthState(componentName: string, data: Partial<{ status: string; lastRunAt: Date; lastSuccessAt: Date; lastErrorAt: Date; lastErrorMessage: string; consecutiveFailures: number; metadata: string }>): Promise<void> {
    const existing = await db.select().from(systemHealthState).where(eq(systemHealthState.componentName, componentName)).limit(1);
    if (existing.length > 0) {
      await db.update(systemHealthState)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(systemHealthState.componentName, componentName));
    } else {
      await db.insert(systemHealthState).values({
        componentName,
        status: data.status || 'healthy',
        lastRunAt: data.lastRunAt,
        lastSuccessAt: data.lastSuccessAt,
        lastErrorAt: data.lastErrorAt,
        lastErrorMessage: data.lastErrorMessage,
        consecutiveFailures: data.consecutiveFailures || 0,
        metadata: data.metadata,
      });
    }
  }

  async getHealthStates(): Promise<Array<{ componentName: string; status: string; lastRunAt: Date | null; lastSuccessAt: Date | null; lastErrorAt: Date | null; lastErrorMessage: string | null; consecutiveFailures: number; updatedAt: Date }>> {
    return await db.select({
      componentName: systemHealthState.componentName,
      status: systemHealthState.status,
      lastRunAt: systemHealthState.lastRunAt,
      lastSuccessAt: systemHealthState.lastSuccessAt,
      lastErrorAt: systemHealthState.lastErrorAt,
      lastErrorMessage: systemHealthState.lastErrorMessage,
      consecutiveFailures: systemHealthState.consecutiveFailures,
      updatedAt: systemHealthState.updatedAt,
    }).from(systemHealthState);
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
    const subscribedKeys = await this.getUserVendorSubscriptions(userId);
    
    // Users start with no subscriptions - return only what they've subscribed to
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
    const subscribedKeys = await this.getUserVendorSubscriptions(userId);
    
    // Users start with no subscriptions - return only incidents from subscribed vendors
    if (subscribedKeys.length === 0) {
      return [];
    }
    
    return await db
      .select()
      .from(incidents)
      .where(inArray(incidents.vendorKey, subscribedKeys))
      .orderBy(desc(incidents.createdAt));
  }

  async getBlockchainIncidentsForUser(userId: string): Promise<BlockchainIncident[]> {
    const subscribedKeys = await this.getUserBlockchainSubscriptions(userId);
    
    // Users start with no subscriptions - return only incidents from subscribed chains
    if (subscribedKeys.length === 0) {
      return [];
    }
    
    return await db
      .select()
      .from(blockchainIncidents)
      .where(inArray(blockchainIncidents.chainKey, subscribedKeys))
      .orderBy(desc(blockchainIncidents.createdAt));
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
  async updateUserSubscriptionTier(userId: string, tier: 'essential' | 'growth' | 'enterprise' | null): Promise<User | undefined> {
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
    
    const tier = normalizeTier(user.subscriptionTier);
    if (!tier) {
      return { allowed: false, current: 0, limit: 0, tier: null };
    }
    
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const subscriptions = await this.getUserVendorSubscriptions(userId);
    const currentCount = subscriptions.length;
    
    // Enterprise has no limit
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

  async getBlockchainIncident(id: string): Promise<BlockchainIncident | undefined> {
    const [incident] = await db.select().from(blockchainIncidents).where(eq(blockchainIncidents.id, id));
    return incident;
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

  async tryReserveBlockchainAlert(alert: { incidentId: string; userId: string; channel: string; eventType: string; statusSnapshot: string; destination: string }): Promise<boolean> {
    try {
      await db.insert(incidentAlerts).values({
        incidentId: `blockchain:${alert.incidentId}`,
        userId: alert.userId,
        channel: alert.channel,
        eventType: alert.eventType,
        statusSnapshot: alert.statusSnapshot,
        destination: alert.destination,
      });
      return true; // Successfully reserved - caller should send notification
    } catch (error: any) {
      // Check if it's a unique constraint violation (code 23505 in PostgreSQL)
      if (error?.code === '23505' || error?.message?.includes('unique constraint') || error?.message?.includes('duplicate key')) {
        return false; // Already sent - skip notification
      }
      throw error; // Re-throw other errors
    }
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

  async resetUserBlockchainSubscriptions(userId: string): Promise<void> {
    await db.delete(userBlockchainSubscriptions).where(eq(userBlockchainSubscriptions.userId, userId));
    await db.delete(config).where(eq(config.key, `blockchain_subscriptions_set:${userId}`));
  }

  async checkBlockchainLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number | null; tier: string | null }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { allowed: false, current: 0, limit: 0, tier: null };
    }
    
    const tier = normalizeTier(user.subscriptionTier);
    if (!tier) {
      return { allowed: false, current: 0, limit: 0, tier: null };
    }
    
    const tierInfo = SUBSCRIPTION_TIERS[tier];
    const subscriptions = await this.getUserBlockchainSubscriptions(userId);
    const currentCount = subscriptions.length;
    
    // Enterprise has no limit
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
    
    const tier = normalizeTier(user.subscriptionTier);
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
    
    const tier = normalizeTier(user.subscriptionTier);
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

  async getIncidentAcknowledgementHistory(incidentId: string): Promise<Array<{ userId: string; userName: string; userEmail: string; acknowledgedAt: Date }>> {
    const acks = await db
      .select({
        userId: incidentAcknowledgements.userId,
        acknowledgedAt: incidentAcknowledgements.acknowledgedAt,
        userName: users.firstName,
        userEmail: users.email,
      })
      .from(incidentAcknowledgements)
      .leftJoin(users, eq(incidentAcknowledgements.userId, users.id))
      .where(eq(incidentAcknowledgements.incidentId, incidentId))
      .orderBy(desc(incidentAcknowledgements.acknowledgedAt));
    
    return acks.map(a => ({
      userId: a.userId,
      userName: a.userName || 'Unknown User',
      userEmail: a.userEmail || '',
      acknowledgedAt: a.acknowledgedAt,
    }));
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
  // For unresolved incidents older than 72 hours, we cap their downtime impact
  // to prevent stale incidents from dragging SLA to 0%
  async getVendorPerformanceStats(vendorKey: string, days: number = 30): Promise<{ uptimePercent: number; incidentCount: number; avgResolutionMinutes: number | null }> {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();
    
    // Maximum downtime for unresolved incidents (72 hours = 3 days)
    const MAX_UNRESOLVED_DOWNTIME_MINUTES = 72 * 60;
    
    const allVendorIncidents = await db.select()
      .from(incidents)
      .where(eq(incidents.vendorKey, vendorKey));
    
    // Only count incidents that started within the lookback window
    // OR resolved incidents that overlapped with the window
    const relevantIncidents = allVendorIncidents.filter(incident => {
      const start = new Date(incident.startedAt);
      
      // For resolved incidents, check if they overlap with window
      if (incident.status === 'resolved' && incident.updatedAt) {
        const end = new Date(incident.updatedAt);
        return start < now && end > cutoff;
      }
      
      // For unresolved incidents, only count if started within the window
      // This prevents very old stale incidents from affecting SLA
      return start >= cutoff && start < now;
    });
    
    const incidentCount = relevantIncidents.length;
    
    if (incidentCount === 0) {
      return { uptimePercent: 100, incidentCount: 0, avgResolutionMinutes: null };
    }
    
    let totalDowntimeMinutes = 0;
    const resolutionTimes: number[] = [];
    
    for (const incident of relevantIncidents) {
      const incidentStart = new Date(incident.startedAt);
      
      if (incident.status === 'resolved' && incident.updatedAt) {
        // Resolved incident - calculate actual downtime within window
        const incidentEnd = new Date(incident.updatedAt);
        const windowStart = incidentStart < cutoff ? cutoff : incidentStart;
        const windowEnd = incidentEnd > now ? now : incidentEnd;
        const durationMinutes = Math.max(0, (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60));
        totalDowntimeMinutes += durationMinutes;
        
        const fullDuration = (incidentEnd.getTime() - incidentStart.getTime()) / (1000 * 60);
        resolutionTimes.push(fullDuration);
      } else {
        // Unresolved incident - cap downtime at 72 hours to prevent stale incidents
        // from causing 0% uptime
        const windowStart = incidentStart < cutoff ? cutoff : incidentStart;
        const durationMinutes = Math.max(0, (now.getTime() - windowStart.getTime()) / (1000 * 60));
        totalDowntimeMinutes += Math.min(durationMinutes, MAX_UNRESOLVED_DOWNTIME_MINUTES);
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
  // Same logic as vendor performance - caps unresolved incident impact at 72 hours
  async getBlockchainPerformanceStats(chainKey: string, days: number = 30): Promise<{ uptimePercent: number; incidentCount: number; avgResolutionMinutes: number | null }> {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    // Maximum downtime for unresolved incidents (72 hours = 3 days)
    const MAX_UNRESOLVED_DOWNTIME_MINUTES = 72 * 60;
    
    const allChainIncidents = await db.select()
      .from(blockchainIncidents)
      .where(eq(blockchainIncidents.chainKey, chainKey));
    
    // Only count incidents that started within the lookback window
    // OR resolved incidents that overlapped with the window
    const relevantIncidents = allChainIncidents.filter(incident => {
      const start = new Date(incident.startedAt);
      
      if (incident.status === 'resolved' && incident.updatedAt) {
        const end = new Date(incident.updatedAt);
        return start < now && end > cutoff;
      }
      
      // For unresolved incidents, only count if started within the window
      return start >= cutoff && start < now;
    });
    
    const incidentCount = relevantIncidents.length;
    
    if (incidentCount === 0) {
      return { uptimePercent: 100, incidentCount: 0, avgResolutionMinutes: null };
    }
    
    let totalDowntimeMinutes = 0;
    const resolutionTimes: number[] = [];
    
    for (const incident of relevantIncidents) {
      const incidentStart = new Date(incident.startedAt);
      
      if (incident.status === 'resolved' && incident.updatedAt) {
        const incidentEnd = new Date(incident.updatedAt);
        const windowStart = incidentStart < cutoff ? cutoff : incidentStart;
        const windowEnd = incidentEnd > now ? now : incidentEnd;
        const durationMinutes = Math.max(0, (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60));
        totalDowntimeMinutes += durationMinutes;
        
        const fullDuration = (incidentEnd.getTime() - incidentStart.getTime()) / (1000 * 60);
        resolutionTimes.push(fullDuration);
      } else {
        // Unresolved incident - cap downtime at 72 hours
        const windowStart = incidentStart < cutoff ? cutoff : incidentStart;
        const durationMinutes = Math.max(0, (now.getTime() - windowStart.getTime()) / (1000 * 60));
        totalDowntimeMinutes += Math.min(durationMinutes, MAX_UNRESOLVED_DOWNTIME_MINUTES);
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

  // PSA Webhooks
  async getPsaWebhooks(userId: string): Promise<PsaWebhook[]> {
    return db.select().from(psaWebhooks).where(eq(psaWebhooks.userId, userId)).orderBy(desc(psaWebhooks.createdAt));
  }

  async getPsaWebhook(id: string): Promise<PsaWebhook | undefined> {
    const [webhook] = await db.select().from(psaWebhooks).where(eq(psaWebhooks.id, id));
    return webhook || undefined;
  }

  async createPsaWebhook(webhook: InsertPsaWebhook): Promise<PsaWebhook> {
    const [created] = await db.insert(psaWebhooks).values(webhook).returning();
    return created;
  }

  async updatePsaWebhook(id: string, data: Partial<InsertPsaWebhook>): Promise<PsaWebhook | undefined> {
    const [updated] = await db.update(psaWebhooks).set(data).where(eq(psaWebhooks.id, id)).returning();
    return updated || undefined;
  }

  async deletePsaWebhook(id: string): Promise<boolean> {
    const result = await db.delete(psaWebhooks).where(eq(psaWebhooks.id, id)).returning();
    return result.length > 0;
  }

  async getActiveWebhooksForEvent(event: string): Promise<PsaWebhook[]> {
    const allActive = await db.select().from(psaWebhooks).where(eq(psaWebhooks.isActive, true));
    return allActive.filter(w => w.events.split(',').includes(event));
  }

  async recordWebhookResult(id: string, success: boolean): Promise<void> {
    const webhook = await this.getPsaWebhook(id);
    if (!webhook) return;
    
    if (success) {
      await db.update(psaWebhooks)
        .set({ 
          lastTriggered: new Date(), 
          successCount: webhook.successCount + 1 
        })
        .where(eq(psaWebhooks.id, id));
    } else {
      await db.update(psaWebhooks)
        .set({ 
          lastTriggered: new Date(), 
          failureCount: webhook.failureCount + 1 
        })
        .where(eq(psaWebhooks.id, id));
    }
  }

  // SLA Contracts
  async getSlaContracts(userId: string): Promise<SlaContract[]> {
    return db.select().from(slaContracts).where(eq(slaContracts.userId, userId)).orderBy(desc(slaContracts.createdAt));
  }

  async getSlaContract(id: string): Promise<SlaContract | undefined> {
    const [contract] = await db.select().from(slaContracts).where(eq(slaContracts.id, id));
    return contract || undefined;
  }

  async createSlaContract(contract: InsertSlaContract): Promise<SlaContract> {
    const [created] = await db.insert(slaContracts).values(contract).returning();
    return created;
  }

  async updateSlaContract(id: string, data: Partial<InsertSlaContract>): Promise<SlaContract | undefined> {
    const [updated] = await db.update(slaContracts).set(data).where(eq(slaContracts.id, id)).returning();
    return updated || undefined;
  }

  async deleteSlaContract(id: string): Promise<boolean> {
    const result = await db.delete(slaContracts).where(eq(slaContracts.id, id)).returning();
    return result.length > 0;
  }

  // SLA Breaches
  async getSlaBreaches(userId: string): Promise<SlaBreach[]> {
    const userContracts = await this.getSlaContracts(userId);
    const contractIds = userContracts.map(c => c.id);
    if (contractIds.length === 0) return [];
    return db.select().from(slaBreaches).where(inArray(slaBreaches.contractId, contractIds)).orderBy(desc(slaBreaches.createdAt));
  }

  async getSlaBreachesByContract(contractId: string): Promise<SlaBreach[]> {
    return db.select().from(slaBreaches).where(eq(slaBreaches.contractId, contractId)).orderBy(desc(slaBreaches.createdAt));
  }

  async createSlaBreach(breach: InsertSlaBreach): Promise<SlaBreach> {
    const [created] = await db.insert(slaBreaches).values(breach).returning();
    return created;
  }

  async updateSlaBreach(id: string, data: Partial<InsertSlaBreach>): Promise<SlaBreach | undefined> {
    const [updated] = await db.update(slaBreaches).set(data).where(eq(slaBreaches.id, id)).returning();
    return updated || undefined;
  }

  // Synthetic Monitoring
  async getSyntheticProbes(userId: string): Promise<SyntheticProbe[]> {
    return db.select().from(syntheticProbes).where(eq(syntheticProbes.userId, userId)).orderBy(desc(syntheticProbes.createdAt));
  }

  async getSyntheticProbe(id: string): Promise<SyntheticProbe | undefined> {
    const [probe] = await db.select().from(syntheticProbes).where(eq(syntheticProbes.id, id));
    return probe || undefined;
  }

  async createSyntheticProbe(probe: InsertSyntheticProbe): Promise<SyntheticProbe> {
    const [created] = await db.insert(syntheticProbes).values(probe).returning();
    return created;
  }

  async updateSyntheticProbe(id: string, data: Partial<InsertSyntheticProbe>): Promise<SyntheticProbe | undefined> {
    const [updated] = await db.update(syntheticProbes).set(data).where(eq(syntheticProbes.id, id)).returning();
    return updated || undefined;
  }

  async deleteSyntheticProbe(id: string): Promise<boolean> {
    const result = await db.delete(syntheticProbes).where(eq(syntheticProbes.id, id)).returning();
    return result.length > 0;
  }

  async getSyntheticProbeResults(probeId: string, limit: number = 100): Promise<SyntheticProbeResult[]> {
    return db.select().from(syntheticProbeResults).where(eq(syntheticProbeResults.probeId, probeId)).orderBy(desc(syntheticProbeResults.createdAt)).limit(limit);
  }

  async createSyntheticProbeResult(result: InsertSyntheticProbeResult): Promise<SyntheticProbeResult> {
    const [created] = await db.insert(syntheticProbeResults).values(result).returning();
    return created;
  }

  // MSP Clients
  async getClients(userId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.userId, userId)).orderBy(clients.name);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients).set({ ...data, updatedAt: new Date() }).where(eq(clients.id, id)).returning();
    return updated || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    await db.delete(clientVendorLinks).where(eq(clientVendorLinks.clientId, id));
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }

  // Client-Vendor Links
  async getClientVendorLinks(userId: string): Promise<ClientVendorLink[]> {
    return db.select().from(clientVendorLinks).where(eq(clientVendorLinks.userId, userId));
  }

  async getVendorClients(userId: string, vendorKey: string): Promise<Client[]> {
    const links = await db.select().from(clientVendorLinks)
      .where(and(eq(clientVendorLinks.userId, userId), eq(clientVendorLinks.vendorKey, vendorKey)));
    
    if (links.length === 0) return [];
    
    const clientIds = links.map(l => l.clientId);
    return db.select().from(clients).where(inArray(clients.id, clientIds));
  }

  async getClientVendors(clientId: string): Promise<string[]> {
    const links = await db.select().from(clientVendorLinks).where(eq(clientVendorLinks.clientId, clientId));
    return links.map(l => l.vendorKey);
  }

  async linkVendorToClient(userId: string, clientId: string, vendorKey: string, priority: string = 'medium'): Promise<ClientVendorLink> {
    const existing = await db.select().from(clientVendorLinks)
      .where(and(
        eq(clientVendorLinks.userId, userId),
        eq(clientVendorLinks.clientId, clientId),
        eq(clientVendorLinks.vendorKey, vendorKey)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [created] = await db.insert(clientVendorLinks).values({ userId, clientId, vendorKey, priority }).returning();
    return created;
  }

  async unlinkVendorFromClient(userId: string, clientId: string, vendorKey: string): Promise<boolean> {
    const result = await db.delete(clientVendorLinks)
      .where(and(
        eq(clientVendorLinks.userId, userId),
        eq(clientVendorLinks.clientId, clientId),
        eq(clientVendorLinks.vendorKey, vendorKey)
      )).returning();
    return result.length > 0;
  }

  // Incident Playbooks
  async getPlaybooks(userId: string): Promise<IncidentPlaybook[]> {
    return db.select().from(incidentPlaybooks).where(eq(incidentPlaybooks.userId, userId)).orderBy(desc(incidentPlaybooks.createdAt));
  }

  async getPlaybook(id: string): Promise<IncidentPlaybook | undefined> {
    const [playbook] = await db.select().from(incidentPlaybooks).where(eq(incidentPlaybooks.id, id));
    return playbook || undefined;
  }

  async getPlaybookForIncident(userId: string, vendorKey: string, severity?: string): Promise<IncidentPlaybook | undefined> {
    const allPlaybooks = await db.select().from(incidentPlaybooks)
      .where(and(eq(incidentPlaybooks.userId, userId), eq(incidentPlaybooks.isActive, true)));
    
    let bestMatch: IncidentPlaybook | undefined;
    
    for (const pb of allPlaybooks) {
      if (pb.vendorKey === vendorKey) {
        if (!severity || !pb.severityFilter || pb.severityFilter === severity) {
          return pb;
        }
      }
      if (pb.isDefault && !bestMatch) {
        bestMatch = pb;
      }
    }
    
    return bestMatch;
  }

  async createPlaybook(playbook: InsertIncidentPlaybook): Promise<IncidentPlaybook> {
    const [created] = await db.insert(incidentPlaybooks).values(playbook).returning();
    return created;
  }

  async updatePlaybook(id: string, data: Partial<InsertIncidentPlaybook>): Promise<IncidentPlaybook | undefined> {
    const [updated] = await db.update(incidentPlaybooks).set({ ...data, updatedAt: new Date() }).where(eq(incidentPlaybooks.id, id)).returning();
    return updated || undefined;
  }

  async deletePlaybook(id: string): Promise<boolean> {
    await db.delete(incidentPlaybookSteps).where(eq(incidentPlaybookSteps.playbookId, id));
    const result = await db.delete(incidentPlaybooks).where(eq(incidentPlaybooks.id, id)).returning();
    return result.length > 0;
  }

  // Playbook Steps
  async getPlaybookSteps(playbookId: string): Promise<IncidentPlaybookStep[]> {
    return db.select().from(incidentPlaybookSteps)
      .where(eq(incidentPlaybookSteps.playbookId, playbookId))
      .orderBy(incidentPlaybookSteps.stepOrder);
  }

  async createPlaybookStep(step: InsertIncidentPlaybookStep): Promise<IncidentPlaybookStep> {
    const [created] = await db.insert(incidentPlaybookSteps).values(step).returning();
    return created;
  }

  async updatePlaybookStep(id: string, data: Partial<InsertIncidentPlaybookStep>): Promise<IncidentPlaybookStep | undefined> {
    const [updated] = await db.update(incidentPlaybookSteps).set(data).where(eq(incidentPlaybookSteps.id, id)).returning();
    return updated || undefined;
  }

  async deletePlaybookStep(id: string): Promise<boolean> {
    const result = await db.delete(incidentPlaybookSteps).where(eq(incidentPlaybookSteps.id, id)).returning();
    return result.length > 0;
  }

  async reorderPlaybookSteps(playbookId: string, stepIds: string[]): Promise<void> {
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(incidentPlaybookSteps)
        .set({ stepOrder: i + 1 })
        .where(and(eq(incidentPlaybookSteps.id, stepIds[i]), eq(incidentPlaybookSteps.playbookId, playbookId)));
    }
  }

  // SLA Countdown Timers
  async getActiveSlaTimers(userId: string): Promise<Array<{
    contractId: string;
    contractName: string;
    vendorKey: string;
    resourceType: string;
    incidentId: string;
    incidentTitle: string;
    incidentStartedAt: string;
    responseTimeMinutes: number | null;
    resolutionTimeMinutes: number | null;
    responseDeadline: Date | null;
    resolutionDeadline: Date | null;
    isResponseBreached: boolean;
    isResolutionBreached: boolean;
  }>> {
    const contracts = await db.select().from(slaContracts)
      .where(and(eq(slaContracts.userId, userId), eq(slaContracts.isActive, true)));
    
    const timers: Array<{
      contractId: string;
      contractName: string;
      vendorKey: string;
      resourceType: string;
      incidentId: string;
      incidentTitle: string;
      incidentStartedAt: string;
      responseTimeMinutes: number | null;
      resolutionTimeMinutes: number | null;
      responseDeadline: Date | null;
      resolutionDeadline: Date | null;
      isResponseBreached: boolean;
      isResolutionBreached: boolean;
    }> = [];
    
    for (const contract of contracts) {
      let activeIncidents: Array<{ id: string; title: string; startedAt: string }> = [];
      
      if (contract.resourceType === 'vendor') {
        const vendorIncidents = await db.select().from(incidents)
          .where(eq(incidents.vendorKey, contract.vendorKey));
        activeIncidents = vendorIncidents
          .filter(i => i.status !== 'resolved')
          .map(i => ({ id: i.id, title: i.title, startedAt: i.startedAt }));
      } else {
        const chainIncidents = await db.select().from(blockchainIncidents)
          .where(eq(blockchainIncidents.chainKey, contract.vendorKey));
        activeIncidents = chainIncidents
          .filter(i => i.status !== 'resolved')
          .map(i => ({ id: i.id, title: i.title, startedAt: i.startedAt }));
      }
      
      for (const incident of activeIncidents) {
        const startTime = new Date(incident.startedAt);
        const now = new Date();
        
        const responseDeadline = contract.responseTimeMinutes 
          ? new Date(startTime.getTime() + contract.responseTimeMinutes * 60 * 1000)
          : null;
        const resolutionDeadline = contract.resolutionTimeMinutes
          ? new Date(startTime.getTime() + contract.resolutionTimeMinutes * 60 * 1000)
          : null;
        
        timers.push({
          contractId: contract.id,
          contractName: contract.name,
          vendorKey: contract.vendorKey,
          resourceType: contract.resourceType,
          incidentId: incident.id,
          incidentTitle: incident.title,
          incidentStartedAt: incident.startedAt,
          responseTimeMinutes: contract.responseTimeMinutes,
          resolutionTimeMinutes: contract.resolutionTimeMinutes,
          responseDeadline,
          resolutionDeadline,
          isResponseBreached: responseDeadline ? now > responseDeadline : false,
          isResolutionBreached: resolutionDeadline ? now > resolutionDeadline : false,
        });
      }
    }
    
    return timers;
  }

  // User Integrations (Slack, Teams, PSA, Webhooks, etc.)
  async getUserIntegrations(userId: string): Promise<Array<{
    id: string;
    userId: string;
    integrationType: string;
    name: string;
    isActive: boolean;
    isDefault: boolean | null;
    lastTestedAt: Date | null;
    lastTestSuccess: boolean | null;
    createdAt: Date;
    hasWebhook: boolean;
    hasApiKey: boolean;
    hasPhone: boolean;
  }>> {
    const integrations = await db.select().from(userIntegrations)
      .where(eq(userIntegrations.userId, userId))
      .orderBy(desc(userIntegrations.createdAt));
    
    return integrations.map(i => ({
      id: i.id,
      userId: i.userId,
      integrationType: i.integrationType,
      name: i.name,
      isActive: i.isActive,
      isDefault: i.isDefault,
      lastTestedAt: i.lastTestedAt,
      lastTestSuccess: i.lastTestSuccess,
      createdAt: i.createdAt,
      hasWebhook: !!i.webhookUrl,
      hasApiKey: !!i.apiKey,
      hasPhone: !!i.phoneNumber,
    }));
  }

  async getUserIntegration(id: string): Promise<any> {
    const [integration] = await db.select({
      id: userIntegrations.id,
      userId: userIntegrations.userId,
      integrationType: userIntegrations.integrationType,
      name: userIntegrations.name,
      isActive: userIntegrations.isActive,
      isDefault: userIntegrations.isDefault,
      lastTestedAt: userIntegrations.lastTestedAt,
      lastTestSuccess: userIntegrations.lastTestSuccess,
      createdAt: userIntegrations.createdAt,
      updatedAt: userIntegrations.updatedAt,
    }).from(userIntegrations).where(eq(userIntegrations.id, id));
    return integration || undefined;
  }

  async getUserIntegrationFull(id: string): Promise<UserIntegration | undefined> {
    const [integration] = await db.select().from(userIntegrations).where(eq(userIntegrations.id, id));
    return integration || undefined;
  }

  async createUserIntegration(data: InsertUserIntegration): Promise<UserIntegration> {
    const [created] = await db.insert(userIntegrations).values(data).returning();
    return created;
  }

  async updateUserIntegration(id: string, data: Partial<InsertUserIntegration>): Promise<UserIntegration | undefined> {
    const [updated] = await db.update(userIntegrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userIntegrations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUserIntegration(id: string): Promise<boolean> {
    const result = await db.delete(userIntegrations).where(eq(userIntegrations.id, id)).returning();
    return result.length > 0;
  }

  async testUserIntegration(id: string, success: boolean): Promise<UserIntegration | undefined> {
    const [updated] = await db.update(userIntegrations)
      .set({ lastTestedAt: new Date(), lastTestSuccess: success, updatedAt: new Date() })
      .where(eq(userIntegrations.id, id))
      .returning();
    return updated || undefined;
  }

  async getDefaultIntegrationForType(userId: string, integrationType: string): Promise<UserIntegration | undefined> {
    const [integration] = await db.select().from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.integrationType, integrationType),
        eq(userIntegrations.isDefault, true),
        eq(userIntegrations.isActive, true)
      ));
    return integration || undefined;
  }

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async getOrganizationByDomain(domain: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.primaryDomain, domain.toLowerCase()));
    return org || undefined;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values({
      ...org,
      primaryDomain: org.primaryDomain.toLowerCase()
    }).returning();
    return created;
  }

  async updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    if (updateData.primaryDomain) {
      updateData.primaryDomain = updateData.primaryDomain.toLowerCase();
    }
    const [updated] = await db.update(organizations)
      .set(updateData)
      .where(eq(organizations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.delete(organizationInvitations).where(eq(organizationInvitations.organizationId, id));
      const members = await tx.select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, id));
      await tx.delete(organizationMembers).where(eq(organizationMembers.organizationId, id));
      for (const member of members) {
        await tx.update(users)
          .set({ organizationId: null })
          .where(eq(users.id, member.userId));
      }
      const result = await tx.delete(organizations).where(eq(organizations.id, id)).returning();
      return result.length > 0;
    });
  }

  async getUserOrganization(userId: string): Promise<Organization | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.organizationId) return undefined;
    return this.getOrganization(user.organizationId);
  }

  // Organization Members
  async getOrganizationMembers(orgId: string): Promise<Array<OrganizationMember & { user: User }>> {
    const members = await db.select()
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId));
    
    return members.map(row => ({
      ...row.organization_members,
      user: row.users
    }));
  }

  async getOrganizationMember(orgId: string, userId: string): Promise<OrganizationMember | undefined> {
    const [member] = await db.select().from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ));
    return member || undefined;
  }

  async getMasterAdminCount(orgId: string): Promise<number> {
    const result = await db.select({ count: count() })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.role, 'master_admin')
      ));
    return result[0]?.count || 0;
  }

  async addOrganizationMember(member: InsertOrganizationMember): Promise<OrganizationMember> {
    const [created] = await db.insert(organizationMembers).values(member).returning();
    await db.update(users)
      .set({ organizationId: member.organizationId })
      .where(eq(users.id, member.userId));
    return created;
  }

  async updateOrganizationMemberRole(orgId: string, userId: string, role: MemberRole): Promise<OrganizationMember | undefined> {
    const [updated] = await db.update(organizationMembers)
      .set({ role })
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .returning();
    return updated || undefined;
  }

  async removeOrganizationMember(orgId: string, userId: string): Promise<boolean> {
    const result = await db.delete(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId)
      ))
      .returning();
    if (result.length > 0) {
      await db.update(users)
        .set({ organizationId: null })
        .where(eq(users.id, userId));
    }
    return result.length > 0;
  }

  async getUserRole(userId: string): Promise<{ organizationId: string; role: MemberRole } | undefined> {
    const [member] = await db.select().from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));
    if (!member) return undefined;
    return { organizationId: member.organizationId, role: member.role as MemberRole };
  }

  // Organization Invitations
  async getOrganizationInvitations(orgId: string): Promise<OrganizationInvitation[]> {
    return db.select().from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.status, 'pending')
      ))
      .orderBy(desc(organizationInvitations.createdAt));
  }

  async getInvitationByToken(token: string): Promise<OrganizationInvitation | undefined> {
    const [invitation] = await db.select().from(organizationInvitations)
      .where(eq(organizationInvitations.token, token));
    return invitation || undefined;
  }

  async getInvitationByEmail(orgId: string, email: string): Promise<OrganizationInvitation | undefined> {
    const [invitation] = await db.select().from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.email, email.toLowerCase()),
        eq(organizationInvitations.status, 'pending')
      ));
    return invitation || undefined;
  }

  async createOrganizationInvitation(invitation: InsertOrganizationInvitation): Promise<OrganizationInvitation> {
    const [created] = await db.insert(organizationInvitations).values({
      ...invitation,
      email: invitation.email.toLowerCase()
    }).returning();
    return created;
  }

  async updateInvitationStatus(id: string, status: string): Promise<OrganizationInvitation | undefined> {
    const [updated] = await db.update(organizationInvitations)
      .set({ status })
      .where(eq(organizationInvitations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteOrganizationInvitation(id: string): Promise<boolean> {
    const result = await db.delete(organizationInvitations)
      .where(eq(organizationInvitations.id, id))
      .returning();
    return result.length > 0;
  }

  // Alert Assignments
  async getAlertAssignments(orgId: string): Promise<OrgAlertAssignment[]> {
    return db.select().from(orgAlertAssignments)
      .where(eq(orgAlertAssignments.organizationId, orgId))
      .orderBy(desc(orgAlertAssignments.createdAt));
  }

  async getAlertAssignmentsForMember(orgId: string, userId: string): Promise<OrgAlertAssignment[]> {
    return db.select().from(orgAlertAssignments)
      .where(and(
        eq(orgAlertAssignments.organizationId, orgId),
        eq(orgAlertAssignments.memberUserId, userId)
      ));
  }

  async getAssignedUsersForTarget(orgId: string, targetType: string, targetKey: string): Promise<OrgAlertAssignment[]> {
    return db.select().from(orgAlertAssignments)
      .where(and(
        eq(orgAlertAssignments.organizationId, orgId),
        eq(orgAlertAssignments.targetType, targetType),
        eq(orgAlertAssignments.targetKey, targetKey)
      ));
  }

  async createAlertAssignment(assignment: InsertOrgAlertAssignment): Promise<OrgAlertAssignment> {
    const [created] = await db.insert(orgAlertAssignments).values(assignment).returning();
    return created;
  }

  async deleteAlertAssignment(id: string): Promise<boolean> {
    const result = await db.delete(orgAlertAssignments)
      .where(eq(orgAlertAssignments.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteAlertAssignmentsByMember(orgId: string, userId: string): Promise<void> {
    await db.delete(orgAlertAssignments)
      .where(and(
        eq(orgAlertAssignments.organizationId, orgId),
        eq(orgAlertAssignments.memberUserId, userId)
      ));
  }

  async getGlobalAssignmentsForTarget(targetType: string, targetKey: string): Promise<OrgAlertAssignment[]> {
    return db.select().from(orgAlertAssignments)
      .where(and(
        eq(orgAlertAssignments.targetType, targetType),
        eq(orgAlertAssignments.targetKey, targetKey)
      ));
  }

  // ============ CLIENT PORTALS ============
  async getClientPortals(userId: string): Promise<ClientPortal[]> {
    return await db.select().from(clientPortals)
      .where(eq(clientPortals.userId, userId))
      .orderBy(desc(clientPortals.createdAt));
  }

  async getClientPortal(id: string): Promise<ClientPortal | undefined> {
    const [portal] = await db.select().from(clientPortals)
      .where(eq(clientPortals.id, id));
    return portal || undefined;
  }

  async getClientPortalBySlug(slug: string): Promise<ClientPortal | undefined> {
    const [portal] = await db.select().from(clientPortals)
      .where(eq(clientPortals.slug, slug));
    return portal || undefined;
  }

  async createClientPortal(portal: InsertClientPortal): Promise<ClientPortal> {
    const [created] = await db.insert(clientPortals).values(portal).returning();
    return created;
  }

  async updateClientPortal(id: string, data: Partial<InsertClientPortal>): Promise<ClientPortal | undefined> {
    const [updated] = await db.update(clientPortals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clientPortals.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteClientPortal(id: string): Promise<boolean> {
    await db.delete(portalVendorAssignments).where(eq(portalVendorAssignments.portalId, id));
    await db.delete(portalSubscribers).where(eq(portalSubscribers.portalId, id));
    const result = await db.delete(clientPortals).where(eq(clientPortals.id, id)).returning();
    return result.length > 0;
  }

  async incrementPortalViewCount(id: string): Promise<void> {
    await db.update(clientPortals)
      .set({ 
        viewCount: sql`COALESCE(${clientPortals.viewCount}, 0) + 1`,
        lastAccessedAt: new Date()
      })
      .where(eq(clientPortals.id, id));
  }

  // Portal Vendor Assignments
  async getPortalVendorAssignments(portalId: string): Promise<PortalVendorAssignment[]> {
    return await db.select().from(portalVendorAssignments)
      .where(eq(portalVendorAssignments.portalId, portalId))
      .orderBy(portalVendorAssignments.displayOrder);
  }

  async createPortalVendorAssignment(assignment: InsertPortalVendorAssignment): Promise<PortalVendorAssignment> {
    const [created] = await db.insert(portalVendorAssignments).values(assignment).returning();
    return created;
  }

  async updatePortalVendorAssignment(id: string, data: Partial<InsertPortalVendorAssignment>): Promise<PortalVendorAssignment | undefined> {
    const [updated] = await db.update(portalVendorAssignments)
      .set(data)
      .where(eq(portalVendorAssignments.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePortalVendorAssignment(id: string): Promise<boolean> {
    const result = await db.delete(portalVendorAssignments)
      .where(eq(portalVendorAssignments.id, id))
      .returning();
    return result.length > 0;
  }

  async deletePortalVendorAssignmentsByPortal(portalId: string): Promise<void> {
    await db.delete(portalVendorAssignments)
      .where(eq(portalVendorAssignments.portalId, portalId));
  }

  // Portal Subscribers
  async getPortalSubscribers(portalId: string): Promise<PortalSubscriber[]> {
    return await db.select().from(portalSubscribers)
      .where(and(
        eq(portalSubscribers.portalId, portalId),
        isNull(portalSubscribers.unsubscribedAt)
      ));
  }

  async createPortalSubscriber(subscriber: InsertPortalSubscriber): Promise<PortalSubscriber> {
    const [created] = await db.insert(portalSubscribers).values(subscriber).returning();
    return created;
  }

  async verifyPortalSubscriber(token: string): Promise<PortalSubscriber | undefined> {
    const [updated] = await db.update(portalSubscribers)
      .set({ isVerified: true, verificationToken: null })
      .where(eq(portalSubscribers.verificationToken, token))
      .returning();
    return updated || undefined;
  }

  async unsubscribePortalSubscriber(token: string): Promise<PortalSubscriber | undefined> {
    const [updated] = await db.update(portalSubscribers)
      .set({ unsubscribedAt: new Date() })
      .where(eq(portalSubscribers.unsubscribeToken, token))
      .returning();
    return updated || undefined;
  }

  // ============ PSA INTEGRATIONS ============
  async getPsaIntegrations(userId: string): Promise<PsaIntegration[]> {
    return await db.select().from(psaIntegrations)
      .where(eq(psaIntegrations.userId, userId))
      .orderBy(desc(psaIntegrations.createdAt));
  }

  async getPsaIntegration(id: string): Promise<PsaIntegration | undefined> {
    const [integration] = await db.select().from(psaIntegrations)
      .where(eq(psaIntegrations.id, id));
    return integration || undefined;
  }

  async createPsaIntegration(integration: InsertPsaIntegration): Promise<PsaIntegration> {
    const [created] = await db.insert(psaIntegrations).values(integration).returning();
    return created;
  }

  async updatePsaIntegration(id: string, data: Partial<InsertPsaIntegration>): Promise<PsaIntegration | undefined> {
    const [updated] = await db.update(psaIntegrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(psaIntegrations.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePsaIntegration(id: string): Promise<boolean> {
    await db.delete(psaTicketRules).where(eq(psaTicketRules.psaIntegrationId, id));
    await db.delete(psaTicketLinks).where(eq(psaTicketLinks.psaIntegrationId, id));
    const result = await db.delete(psaIntegrations).where(eq(psaIntegrations.id, id)).returning();
    return result.length > 0;
  }

  async updatePsaIntegrationSync(id: string, success: boolean, error?: string): Promise<void> {
    await db.update(psaIntegrations)
      .set({ 
        lastSyncAt: new Date(),
        lastSyncSuccess: success,
        lastSyncError: error || null,
        updatedAt: new Date()
      })
      .where(eq(psaIntegrations.id, id));
  }

  // PSA Ticket Rules
  async getPsaTicketRules(integrationId: string): Promise<PsaTicketRule[]> {
    return await db.select().from(psaTicketRules)
      .where(eq(psaTicketRules.psaIntegrationId, integrationId))
      .orderBy(desc(psaTicketRules.createdAt));
  }

  async getPsaTicketRule(id: string): Promise<PsaTicketRule | undefined> {
    const [rule] = await db.select().from(psaTicketRules)
      .where(eq(psaTicketRules.id, id));
    return rule || undefined;
  }

  async createPsaTicketRule(rule: InsertPsaTicketRule): Promise<PsaTicketRule> {
    const [created] = await db.insert(psaTicketRules).values(rule).returning();
    return created;
  }

  async updatePsaTicketRule(id: string, data: Partial<InsertPsaTicketRule>): Promise<PsaTicketRule | undefined> {
    const [updated] = await db.update(psaTicketRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(psaTicketRules.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePsaTicketRule(id: string): Promise<boolean> {
    const result = await db.delete(psaTicketRules)
      .where(eq(psaTicketRules.id, id))
      .returning();
    return result.length > 0;
  }

  async getMatchingPsaTicketRules(vendorKey: string | null, chainKey: string | null, severity: string): Promise<PsaTicketRule[]> {
    const allRules = await db.select().from(psaTicketRules)
      .where(eq(psaTicketRules.isActive, true));
    
    return allRules.filter(rule => {
      if (vendorKey && rule.vendorKey && rule.vendorKey !== vendorKey) return false;
      if (chainKey && rule.chainKey && rule.chainKey !== chainKey) return false;
      if (rule.severityFilter && rule.severityFilter !== 'any' && rule.severityFilter !== severity) return false;
      return true;
    });
  }

  // PSA Ticket Links
  async getPsaTicketLinks(integrationId: string): Promise<PsaTicketLink[]> {
    return await db.select().from(psaTicketLinks)
      .where(eq(psaTicketLinks.psaIntegrationId, integrationId))
      .orderBy(desc(psaTicketLinks.createdAt));
  }

  async getPsaTicketLink(incidentId: string): Promise<PsaTicketLink | undefined> {
    const [link] = await db.select().from(psaTicketLinks)
      .where(or(
        eq(psaTicketLinks.incidentId, incidentId),
        eq(psaTicketLinks.blockchainIncidentId, incidentId)
      ));
    return link || undefined;
  }

  async createPsaTicketLink(link: InsertPsaTicketLink): Promise<PsaTicketLink> {
    const [created] = await db.insert(psaTicketLinks).values(link).returning();
    return created;
  }

  async updatePsaTicketLink(id: string, data: Partial<InsertPsaTicketLink>): Promise<PsaTicketLink | undefined> {
    const [updated] = await db.update(psaTicketLinks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(psaTicketLinks.id, id))
      .returning();
    return updated || undefined;
  }

  // ============ PREDICTIVE ANALYTICS ============
  async getVendorTelemetryMetrics(vendorKey: string, days: number = 90): Promise<VendorTelemetryMetric[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return await db.select().from(vendorTelemetryMetrics)
      .where(and(
        eq(vendorTelemetryMetrics.vendorKey, vendorKey),
        eq(vendorTelemetryMetrics.resourceType, 'vendor'),
        gte(vendorTelemetryMetrics.metricDate, cutoffDate)
      ))
      .orderBy(desc(vendorTelemetryMetrics.metricDate));
  }

  async getBlockchainTelemetryMetrics(chainKey: string, days: number = 90): Promise<VendorTelemetryMetric[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return await db.select().from(vendorTelemetryMetrics)
      .where(and(
        eq(vendorTelemetryMetrics.chainKey, chainKey),
        eq(vendorTelemetryMetrics.resourceType, 'blockchain'),
        gte(vendorTelemetryMetrics.metricDate, cutoffDate)
      ))
      .orderBy(desc(vendorTelemetryMetrics.metricDate));
  }

  async createVendorTelemetryMetric(metric: InsertVendorTelemetryMetric): Promise<VendorTelemetryMetric> {
    const [created] = await db.insert(vendorTelemetryMetrics).values(metric).returning();
    return created;
  }

  async aggregateTelemetryForPredictions(resourceType: string, sinceDate?: Date): Promise<Array<{
    resourceKey: string;
    dayOfWeek: number;
    hourOfDay: number;
    avgIncidentCount: number;
    totalIncidents: number;
    occurrences: number;
    criticalCount: number;
    majorCount: number;
    minorCount: number;
  }>> {
    const cutoffDate = sinceDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const metrics = await db.select().from(vendorTelemetryMetrics)
      .where(and(
        eq(vendorTelemetryMetrics.resourceType, resourceType),
        gte(vendorTelemetryMetrics.metricDate, cutoffDate)
      ));
    
    const aggregated = new Map<string, { 
      totalIncidents: number; 
      occurrences: number; 
      resourceKey: string; 
      dayOfWeek: number; 
      hourOfDay: number;
      criticalCount: number;
      majorCount: number;
      minorCount: number;
    }>();
    
    for (const m of metrics) {
      const resourceKey = resourceType === 'vendor' ? m.vendorKey : m.chainKey;
      if (!resourceKey || m.dayOfWeek === null || m.hourOfDay === null) continue;
      
      const key = `${resourceKey}-${m.dayOfWeek}-${m.hourOfDay}`;
      const existing = aggregated.get(key) || { 
        totalIncidents: 0, 
        occurrences: 0, 
        resourceKey, 
        dayOfWeek: m.dayOfWeek, 
        hourOfDay: m.hourOfDay,
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
      };
      existing.totalIncidents += m.incidentCount || 0;
      existing.criticalCount += m.criticalCount || 0;
      existing.majorCount += m.majorCount || 0;
      existing.minorCount += m.minorCount || 0;
      existing.occurrences += 1;
      aggregated.set(key, existing);
    }
    
    return Array.from(aggregated.values()).map(a => ({
      ...a,
      avgIncidentCount: a.occurrences > 0 ? a.totalIncidents / a.occurrences : 0
    }));
  }

  // Outage Predictions
  async getOutagePredictions(userId: string): Promise<OutagePrediction[]> {
    return await db.select().from(outagePredictions)
      .where(eq(outagePredictions.status, 'active'))
      .orderBy(outagePredictions.predictedStartAt);
  }

  async getActivePredictions(): Promise<OutagePrediction[]> {
    const now = new Date();
    return await db.select().from(outagePredictions)
      .where(and(
        eq(outagePredictions.status, 'active'),
        gte(outagePredictions.predictedStartAt, now)
      ))
      .orderBy(outagePredictions.predictedStartAt);
  }

  async getAllOutagePredictions(): Promise<OutagePrediction[]> {
    return await db.select().from(outagePredictions)
      .orderBy(desc(outagePredictions.createdAt));
  }

  async getOutagePrediction(id: string): Promise<OutagePrediction | undefined> {
    const [prediction] = await db.select().from(outagePredictions)
      .where(eq(outagePredictions.id, id));
    return prediction || undefined;
  }

  async createOutagePrediction(prediction: InsertOutagePrediction): Promise<OutagePrediction> {
    const [created] = await db.insert(outagePredictions).values(prediction).returning();
    return created;
  }

  async updateOutagePrediction(id: string, data: Partial<InsertOutagePrediction> & { actualIncidentId?: string | null }): Promise<OutagePrediction | undefined> {
    const [updated] = await db.update(outagePredictions)
      .set(data)
      .where(eq(outagePredictions.id, id))
      .returning();
    return updated || undefined;
  }

  async acknowledgePrediction(id: string, userId: string): Promise<OutagePrediction | undefined> {
    const [updated] = await db.update(outagePredictions)
      .set({ 
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      })
      .where(eq(outagePredictions.id, id))
      .returning();
    return updated || undefined;
  }

  async dismissPrediction(id: string): Promise<OutagePrediction | undefined> {
    const [updated] = await db.update(outagePredictions)
      .set({ status: 'dismissed' })
      .where(eq(outagePredictions.id, id))
      .returning();
    return updated || undefined;
  }

  async providePredictionFeedback(id: string, score: number, notes?: string): Promise<OutagePrediction | undefined> {
    const [updated] = await db.update(outagePredictions)
      .set({ 
        feedbackScore: score,
        feedbackNotes: notes || null
      })
      .where(eq(outagePredictions.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePrediction(id: string): Promise<boolean> {
    const result = await db.delete(outagePredictions)
      .where(eq(outagePredictions.id, id))
      .returning();
    return result.length > 0;
  }

  // Prediction Patterns
  async getPredictionPatterns(resourceType?: string): Promise<PredictionPattern[]> {
    if (resourceType) {
      return await db.select().from(predictionPatterns)
        .where(and(
          eq(predictionPatterns.resourceType, resourceType),
          eq(predictionPatterns.isActive, true)
        ))
        .orderBy(desc(predictionPatterns.occurrenceCount));
    }
    return await db.select().from(predictionPatterns)
      .where(eq(predictionPatterns.isActive, true))
      .orderBy(desc(predictionPatterns.occurrenceCount));
  }

  async getPredictionPattern(id: string): Promise<PredictionPattern | undefined> {
    const [pattern] = await db.select().from(predictionPatterns)
      .where(eq(predictionPatterns.id, id));
    return pattern || undefined;
  }

  async createPredictionPattern(pattern: InsertPredictionPattern): Promise<PredictionPattern> {
    const [created] = await db.insert(predictionPatterns).values(pattern).returning();
    return created;
  }

  async updatePredictionPattern(id: string, data: Partial<InsertPredictionPattern>): Promise<PredictionPattern | undefined> {
    const [updated] = await db.update(predictionPatterns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(predictionPatterns.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePredictionPattern(id: string): Promise<boolean> {
    const result = await db.delete(predictionPatterns)
      .where(eq(predictionPatterns.id, id))
      .returning();
    return result.length > 0;
  }
  
  async purgeOldTelemetry(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db.delete(vendorTelemetryMetrics)
      .where(lt(vendorTelemetryMetrics.metricDate, cutoffDate))
      .returning();
    return result.length;
  }
  
  async purgeOldPredictions(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db.delete(outagePredictions)
      .where(lt(outagePredictions.createdAt, cutoffDate))
      .returning();
    return result.length;
  }
  
  async purgeOldActivityEvents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const result = await db.delete(userActivityEvents)
      .where(lt(userActivityEvents.createdAt, cutoffDate))
      .returning();
    return result.length;
  }

  // ==========================================
  // VENDOR COMPONENTS
  // ==========================================

  async getVendorComponents(vendorKey: string): Promise<VendorComponent[]> {
    return await db.select().from(vendorComponents)
      .where(eq(vendorComponents.vendorKey, vendorKey));
  }

  async getAllVendorComponents(): Promise<VendorComponent[]> {
    return await db.select().from(vendorComponents);
  }

  async upsertVendorComponent(data: InsertVendorComponent): Promise<VendorComponent> {
    const [component] = await db.insert(vendorComponents)
      .values(data)
      .onConflictDoUpdate({
        target: [vendorComponents.vendorKey, vendorComponents.componentId],
        set: {
          name: data.name,
          description: data.description,
          groupName: data.groupName,
          status: data.status,
          position: data.position,
          updatedAt: new Date(),
        }
      })
      .returning();
    return component;
  }

  // ==========================================
  // USER WEBHOOKS
  // ==========================================

  async getUserWebhooks(userId: string): Promise<UserWebhook[]> {
    return await db.select().from(userWebhooks)
      .where(eq(userWebhooks.userId, userId))
      .orderBy(desc(userWebhooks.createdAt));
  }

  async getUserWebhook(id: string): Promise<UserWebhook | undefined> {
    const [webhook] = await db.select().from(userWebhooks)
      .where(eq(userWebhooks.id, id));
    return webhook || undefined;
  }

  async createUserWebhook(webhook: InsertUserWebhook): Promise<UserWebhook> {
    const [created] = await db.insert(userWebhooks).values(webhook).returning();
    return created;
  }

  async updateUserWebhook(id: string, data: Partial<InsertUserWebhook>): Promise<UserWebhook | undefined> {
    const [updated] = await db.update(userWebhooks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userWebhooks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUserWebhook(id: string): Promise<boolean> {
    const result = await db.delete(userWebhooks)
      .where(eq(userWebhooks.id, id))
      .returning();
    return result.length > 0;
  }

  async getActiveWebhooksForVendorEvent(vendorKey: string, eventType: string): Promise<UserWebhook[]> {
    const activeWebhooks = await db.select().from(userWebhooks)
      .where(eq(userWebhooks.isActive, true));
    
    return activeWebhooks.filter(webhook => {
      const events = webhook.events === 'all' ? ['all'] : JSON.parse(webhook.events || '[]');
      const matchesEvent = events.includes('all') || events.includes(eventType);
      
      const vendorKeys = webhook.vendorKeys ? JSON.parse(webhook.vendorKeys) : null;
      const matchesVendor = !vendorKeys || vendorKeys.includes(vendorKey);
      
      return matchesEvent && matchesVendor;
    });
  }

  async recordWebhookDelivery(id: string, success: boolean, status?: number, error?: string): Promise<void> {
    const webhook = await this.getUserWebhook(id);
    if (!webhook) return;
    
    await db.update(userWebhooks)
      .set({
        lastTriggeredAt: new Date(),
        lastStatus: status || null,
        lastError: error || null,
        totalSent: success ? webhook.totalSent + 1 : webhook.totalSent,
        totalFailed: success ? webhook.totalFailed : webhook.totalFailed + 1,
      })
      .where(eq(userWebhooks.id, id));
  }

  // ==========================================
  // WEBHOOK LOGS
  // ==========================================

  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const [created] = await db.insert(webhookLogs).values(log).returning();
    return created;
  }

  async getWebhookLogs(webhookId: string, limit: number = 50): Promise<WebhookLog[]> {
    return await db.select().from(webhookLogs)
      .where(eq(webhookLogs.webhookId, webhookId))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit);
  }

  // ==========================================
  // API KEYS
  // ==========================================

  async getApiKeys(userId: string): Promise<ApiKey[]> {
    return await db.select().from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys)
      .where(eq(apiKeys.id, id));
    return key || undefined;
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash));
    return key || undefined;
  }

  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [created] = await db.insert(apiKeys).values(apiKey).returning();
    return created;
  }

  async updateApiKey(id: string, data: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const [updated] = await db.update(apiKeys)
      .set(data)
      .where(eq(apiKeys.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys)
      .where(eq(apiKeys.id, id))
      .returning();
    return result.length > 0;
  }

  async recordApiKeyUsage(id: string): Promise<void> {
    await db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  // ==========================================
  // API REQUEST LOGS
  // ==========================================

  async createApiRequestLog(log: InsertApiRequestLog): Promise<ApiRequestLog> {
    const [created] = await db.insert(apiRequestLogs).values(log).returning();
    return created;
  }

  async getApiRequestLogs(apiKeyId: string, limit: number = 100): Promise<ApiRequestLog[]> {
    return await db.select().from(apiRequestLogs)
      .where(eq(apiRequestLogs.apiKeyId, apiKeyId))
      .orderBy(desc(apiRequestLogs.createdAt))
      .limit(limit);
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(options: {
    userId?: string;
    action?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const { userId, action, resourceType, limit = 100, offset = 0 } = options;
    
    const conditions = [];
    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
    
    const query = db.select().from(auditLogs);
    
    if (conditions.length > 0) {
      return await query
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }
    
    return await query
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAuditLogsCount(options: {
    userId?: string;
    action?: string;
    resourceType?: string;
  }): Promise<number> {
    const { userId, action, resourceType } = options;
    
    const conditions = [];
    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (action) conditions.push(eq(auditLogs.action, action));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));
    
    if (conditions.length > 0) {
      const [result] = await db.select({ count: count() }).from(auditLogs)
        .where(and(...conditions));
      return result?.count ?? 0;
    }
    
    const [result] = await db.select({ count: count() }).from(auditLogs);
    return result?.count ?? 0;
  }

  // ==========================================
  // SSO CONFIGURATIONS
  // ==========================================

  async getSsoConfigurations(organizationId: string): Promise<SsoConfiguration[]> {
    return await db.select().from(ssoConfigurations)
      .where(eq(ssoConfigurations.organizationId, organizationId))
      .orderBy(desc(ssoConfigurations.createdAt));
  }

  async getSsoConfiguration(id: string): Promise<SsoConfiguration | undefined> {
    const [config] = await db.select().from(ssoConfigurations)
      .where(eq(ssoConfigurations.id, id));
    return config || undefined;
  }

  async getSsoConfigurationByDomain(emailDomain: string): Promise<SsoConfiguration | undefined> {
    const [config] = await db.select().from(ssoConfigurations)
      .where(and(
        eq(ssoConfigurations.emailDomain, emailDomain),
        eq(ssoConfigurations.isActive, true)
      ));
    return config || undefined;
  }

  async createSsoConfiguration(config: InsertSsoConfiguration): Promise<SsoConfiguration> {
    const [created] = await db.insert(ssoConfigurations).values(config).returning();
    return created;
  }

  async updateSsoConfiguration(id: string, data: Partial<InsertSsoConfiguration>): Promise<SsoConfiguration | undefined> {
    const [updated] = await db.update(ssoConfigurations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ssoConfigurations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSsoConfiguration(id: string): Promise<boolean> {
    const result = await db.delete(ssoConfigurations)
      .where(eq(ssoConfigurations.id, id))
      .returning();
    return result.length > 0;
  }

  // ============ UPTIME REPORTS ============
  async getUptimeReports(userId: string): Promise<UptimeReport[]> {
    return await db.select().from(uptimeReports)
      .where(eq(uptimeReports.userId, userId))
      .orderBy(desc(uptimeReports.createdAt));
  }

  async getUptimeReport(id: string): Promise<UptimeReport | undefined> {
    const [report] = await db.select().from(uptimeReports)
      .where(eq(uptimeReports.id, id));
    return report || undefined;
  }

  async createUptimeReport(report: InsertUptimeReport): Promise<UptimeReport> {
    const [created] = await db.insert(uptimeReports).values(report).returning();
    return created;
  }

  async updateUptimeReport(id: string, data: Partial<InsertUptimeReport>): Promise<UptimeReport | undefined> {
    const [updated] = await db.update(uptimeReports)
      .set(data)
      .where(eq(uptimeReports.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUptimeReport(id: string): Promise<boolean> {
    const result = await db.delete(uptimeReports)
      .where(eq(uptimeReports.id, id))
      .returning();
    return result.length > 0;
  }

  // Report Schedules
  async getReportSchedules(userId: string): Promise<ReportSchedule[]> {
    return await db.select().from(reportSchedules)
      .where(eq(reportSchedules.userId, userId))
      .orderBy(desc(reportSchedules.createdAt));
  }

  async createReportSchedule(schedule: InsertReportSchedule): Promise<ReportSchedule> {
    const [created] = await db.insert(reportSchedules).values(schedule).returning();
    return created;
  }

  async updateReportSchedule(id: string, data: Partial<InsertReportSchedule>): Promise<ReportSchedule | undefined> {
    const [updated] = await db.update(reportSchedules)
      .set(data)
      .where(eq(reportSchedules.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteReportSchedule(id: string): Promise<boolean> {
    const result = await db.delete(reportSchedules)
      .where(eq(reportSchedules.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();

// Default vendors to seed - adds any missing vendors on startup
// parser types: statuspage_json (Statuspage.io API), generic_html (HTML scraping), manual (no API)
const DEFAULT_VENDORS: InsertVendor[] = [
  // Core Cloud & Infrastructure
  { key: "aws", name: "AWS", statusUrl: "https://status.aws.amazon.com", parser: "generic_html", status: "operational" },
  { key: "azure", name: "Azure", statusUrl: "https://status.azure.com", parser: "generic_html", status: "operational" },
  { key: "microsoft365", name: "Microsoft 365", statusUrl: "https://status.office.com", parser: "generic_html", status: "operational" },
  { key: "googlews", name: "Google Workspace", statusUrl: "https://www.google.com/appsstatus/dashboard/", parser: "generic_html", status: "operational" },
  { key: "gcp", name: "Google Cloud Platform", statusUrl: "https://status.cloud.google.com", parser: "generic_html", status: "operational" },
  { key: "cloudflare", name: "Cloudflare", statusUrl: "https://www.cloudflarestatus.com", parser: "statuspage_json", status: "operational" },
  { key: "digitalocean", name: "DigitalOcean", statusUrl: "https://status.digitalocean.com", parser: "statuspage_json", status: "operational" },
  { key: "linode", name: "Linode", statusUrl: "https://status.linode.com", parser: "statuspage_json", status: "operational" },
  { key: "akamai", name: "Akamai", statusUrl: "https://www.akamaistatus.com/", parser: "statuspage_json", status: "operational" },
  // Collaboration & Communication
  { key: "zoom", name: "Zoom", statusUrl: "https://status.zoom.us", parser: "statuspage_json", status: "operational" },
  { key: "atlassian", name: "Atlassian", statusUrl: "https://status.atlassian.com", parser: "statuspage_json", status: "operational" },
  { key: "slack", name: "Slack", statusUrl: "https://status.slack.com/", parser: "statuspage_json", status: "operational" },
  { key: "salesforce", name: "Salesforce", statusUrl: "https://status.salesforce.com", parser: "generic_html", status: "operational" },
  { key: "notion", name: "Notion", statusUrl: "https://status.notion.so/", parser: "statuspage_json", status: "operational" },
  { key: "asana", name: "Asana", statusUrl: "https://status.asana.com/", parser: "statuspage_json", status: "operational" },
  // Authentication & Identity
  { key: "pingidentity", name: "Ping Identity", statusUrl: "https://status.pingidentity.com/", parser: "statuspage_json", status: "operational" },
  { key: "duo", name: "Duo Security", statusUrl: "https://status.duo.com", parser: "statuspage_json", status: "operational" },
  { key: "1password", name: "1Password", statusUrl: "https://status.1password.com/", parser: "statuspage_json", status: "operational" },
  { key: "lastpass", name: "LastPass", statusUrl: "https://status.lastpass.com/", parser: "statuspage_json", status: "operational" },
  // Payments & Revenue
  { key: "paypal", name: "PayPal", statusUrl: "https://www.paypal-status.com", parser: "generic_html", status: "operational" },
  { key: "quickbooks", name: "QuickBooks Online", statusUrl: "https://status.quickbooks.intuit.com/", parser: "statuspage_json", status: "operational" },
  // File Storage & Collaboration
  { key: "dropbox", name: "Dropbox", statusUrl: "https://status.dropbox.com", parser: "statuspage_json", status: "operational" },
  { key: "box", name: "Box", statusUrl: "https://status.box.com", parser: "statuspage_json", status: "operational" },
  // Remote Access & Support
  { key: "teamviewer", name: "TeamViewer", statusUrl: "https://status.teamviewer.com", parser: "statuspage_json", status: "operational" },
  // Backup & Disaster Recovery
  { key: "datto", name: "Datto", statusUrl: "https://status.kaseya.com", parser: "statuspage_json", status: "operational" },
  { key: "carbonite", name: "Carbonite", statusUrl: "https://status.opentext.com", parser: "statuspage_json", status: "operational" },
  // Business Applications
  { key: "hubspot", name: "HubSpot", statusUrl: "https://status.hubspot.com/", parser: "statuspage_json", status: "operational" },
  { key: "netsuite", name: "Oracle NetSuite", statusUrl: "https://status.netsuite.com/", parser: "statuspage_json", status: "operational" },
  // DevOps & Monitoring
  { key: "github", name: "GitHub", statusUrl: "https://www.githubstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "datadog", name: "Datadog", statusUrl: "https://status.datadoghq.com", parser: "statuspage_json", status: "operational" },
  { key: "newrelic", name: "New Relic", statusUrl: "https://status.newrelic.com", parser: "statuspage_json", status: "operational" },
  { key: "sentinelone", name: "SentinelOne", statusUrl: "https://status.sentinelone.com/", parser: "statuspage_json", status: "operational" },
  // MSP Tools
  { key: "kaseya", name: "Kaseya", statusUrl: "https://status.kaseya.com/", parser: "statuspage_json", status: "operational" },
  // Crypto & Fintech
  { key: "fireblocks", name: "Fireblocks", statusUrl: "https://status.fireblocks.com/", parser: "statuspage_json", status: "operational" },
  // Developer Tools & Platforms
  { key: "twilio", name: "Twilio", statusUrl: "https://status.twilio.com/", parser: "statuspage_json", status: "operational" },
  { key: "openai", name: "OpenAI", statusUrl: "https://status.openai.com/", parser: "statuspage_json", status: "operational" },
  { key: "vercel", name: "Vercel", statusUrl: "https://www.vercel-status.com/", parser: "statuspage_json", status: "operational" },
  { key: "mongodb", name: "MongoDB Atlas", statusUrl: "https://status.cloud.mongodb.com/", parser: "statuspage_json", status: "operational" },
  { key: "sentry", name: "Sentry", statusUrl: "https://status.sentry.io/", parser: "statuspage_json", status: "operational" },
  { key: "circleci", name: "CircleCI", statusUrl: "https://status.circleci.com/", parser: "statuspage_json", status: "operational" },
  { key: "linear", name: "Linear", statusUrl: "https://linearstatus.com/", parser: "statuspage_json", status: "operational" },
  { key: "render", name: "Render", statusUrl: "https://status.render.com/", parser: "statuspage_json", status: "operational" },
  { key: "supabase", name: "Supabase", statusUrl: "https://status.supabase.com/", parser: "statuspage_json", status: "operational" },
  { key: "cloudinary", name: "Cloudinary", statusUrl: "https://status.cloudinary.com/", parser: "statuspage_json", status: "operational" },
  { key: "mailgun", name: "Mailgun", statusUrl: "https://status.mailgun.com/", parser: "statuspage_json", status: "operational" },
  { key: "sendgrid", name: "SendGrid", statusUrl: "https://status.sendgrid.com/", parser: "statuspage_json", status: "operational" },
  // E-commerce
  { key: "shopify", name: "Shopify", statusUrl: "https://status.shopify.com/", parser: "statuspage_json", status: "operational" },
  { key: "bigcommerce", name: "BigCommerce", statusUrl: "https://status.bigcommerce.com", parser: "statuspage_json", status: "operational" },
  { key: "square", name: "Square", statusUrl: "https://issquareup.com", parser: "statuspage_json", status: "operational" },
  // Communication & Collaboration
  { key: "discord", name: "Discord", statusUrl: "https://discordstatus.com", parser: "statuspage_json", status: "operational" },
  { key: "intercom", name: "Intercom", statusUrl: "https://status.intercom.com", parser: "statuspage_json", status: "operational" },
  { key: "calendly", name: "Calendly", statusUrl: "https://status.calendly.com", parser: "statuspage_json", status: "operational" },
  { key: "canva", name: "Canva", statusUrl: "https://status.canva.com", parser: "statuspage_json", status: "operational" },
  // CRM & Marketing
  { key: "klaviyo", name: "Klaviyo", statusUrl: "https://status.klaviyo.com", parser: "statuspage_json", status: "operational" },
  { key: "activecampaign", name: "ActiveCampaign", statusUrl: "https://status.activecampaign.com", parser: "statuspage_json", status: "operational" },
  { key: "constantcontact", name: "Constant Contact", statusUrl: "https://status.constantcontact.com", parser: "statuspage_json", status: "operational" },
  // Developer Tools
  { key: "bitbucket", name: "Bitbucket", statusUrl: "https://bitbucket.status.atlassian.com", parser: "statuspage_json", status: "operational" },
  { key: "confluence", name: "Confluence", statusUrl: "https://confluence.status.atlassian.com", parser: "statuspage_json", status: "operational" },
  { key: "npm", name: "npm", statusUrl: "https://status.npmjs.org", parser: "statuspage_json", status: "operational" },
  // Analytics & Data
  { key: "amplitude", name: "Amplitude", statusUrl: "https://status.amplitude.com", parser: "statuspage_json", status: "operational" },
  { key: "mixpanel", name: "Mixpanel", statusUrl: "https://status.mixpanel.com", parser: "statuspage_json", status: "operational" },
  { key: "segment", name: "Segment", statusUrl: "https://status.segment.com", parser: "statuspage_json", status: "operational" },
  { key: "snowflake", name: "Snowflake", statusUrl: "https://status.snowflake.com", parser: "statuspage_json", status: "operational" },
  { key: "plaid", name: "Plaid", statusUrl: "https://status.plaid.com", parser: "statuspage_json", status: "operational" },
  // Security
  { key: "bitdefender", name: "Bitdefender", statusUrl: "https://status.gravityzone.bitdefender.com", parser: "statuspage_json", status: "operational" },
  { key: "webroot", name: "Webroot", statusUrl: "https://status.webroot.com", parser: "statuspage_json", status: "operational" },
  // Other Services
  { key: "redis", name: "Redis Cloud", statusUrl: "https://status.redis.io", parser: "statuspage_json", status: "operational" },
  { key: "reddit", name: "Reddit", statusUrl: "https://www.redditstatus.com", parser: "statuspage_json", status: "operational" },
  // Additional Services
  { key: "docusign", name: "DocuSign", statusUrl: "https://status.docusign.com/", parser: "statuspage_json", status: "operational" },
  { key: "monday", name: "Monday.com", statusUrl: "https://status.monday.com/", parser: "statuspage_json", status: "operational" },
  { key: "airtable", name: "Airtable", statusUrl: "https://status.airtable.com/", parser: "statuspage_json", status: "operational" },
  { key: "figma", name: "Figma", statusUrl: "https://status.figma.com/", parser: "statuspage_json", status: "operational" },
  { key: "miro", name: "Miro", statusUrl: "https://status.miro.com/", parser: "statuspage_json", status: "operational" },
  { key: "launchdarkly", name: "LaunchDarkly", statusUrl: "https://status.launchdarkly.com/", parser: "statuspage_json", status: "operational" },
  { key: "contentful", name: "Contentful", statusUrl: "https://status.contentful.com/", parser: "statuspage_json", status: "operational" },
  // Expanded Directory - Developer Tools & APIs
  { key: "vercel", name: "Vercel", statusUrl: "https://www.vercel-status.com/", parser: "statuspage_json", status: "operational" },
  { key: "netlify", name: "Netlify", statusUrl: "https://www.netlifystatus.com/", parser: "statuspage_json", status: "operational" },
  { key: "render", name: "Render", statusUrl: "https://status.render.com/", parser: "statuspage_json", status: "operational" },
  { key: "railway", name: "Railway", statusUrl: "https://status.railway.app/", parser: "statuspage_json", status: "operational" },
  { key: "supabase", name: "Supabase", statusUrl: "https://status.supabase.com/", parser: "statuspage_json", status: "operational" },
  { key: "prisma", name: "Prisma", statusUrl: "https://status.prisma.io/", parser: "statuspage_json", status: "operational" },
  { key: "postman", name: "Postman", statusUrl: "https://status.postman.com/", parser: "statuspage_json", status: "operational" },
  { key: "circleci", name: "CircleCI", statusUrl: "https://status.circleci.com/", parser: "statuspage_json", status: "operational" },
  { key: "travisci", name: "Travis CI", statusUrl: "https://www.traviscistatus.com/", parser: "statuspage_json", status: "operational" },
  { key: "jfrog", name: "JFrog", statusUrl: "https://status.jfrog.com/", parser: "statuspage_json", status: "operational" },
  { key: "sanity", name: "Sanity", statusUrl: "https://status.sanity.io/", parser: "statuspage_json", status: "operational" },
  { key: "storyblok", name: "Storyblok", statusUrl: "https://status.storyblok.com/", parser: "statuspage_json", status: "operational" },
  { key: "sentry", name: "Sentry", statusUrl: "https://status.sentry.io/", parser: "statuspage_json", status: "operational" },
  { key: "snyk", name: "Snyk", statusUrl: "https://status.snyk.io/", parser: "statuspage_json", status: "operational" },
  { key: "sonarcloud", name: "SonarCloud", statusUrl: "https://sonarcloud.statuspage.io/", parser: "statuspage_json", status: "operational" },
  { key: "openai", name: "OpenAI", statusUrl: "https://status.openai.com/", parser: "statuspage_json", status: "operational" },
  { key: "anthropic", name: "Anthropic", statusUrl: "https://status.anthropic.com/", parser: "statuspage_json", status: "operational" },
  { key: "notion", name: "Notion", statusUrl: "https://status.notion.so/", parser: "statuspage_json", status: "operational" },
  { key: "linear", name: "Linear", statusUrl: "https://status.linear.app/", parser: "statuspage_json", status: "operational" },
  // Expanded Directory - Cloud & Infrastructure
  { key: "flyio", name: "Fly.io", statusUrl: "https://status.flyio.net/", parser: "statuspage_json", status: "operational" },
  { key: "mongodb", name: "MongoDB Atlas", statusUrl: "https://status.cloud.mongodb.com/", parser: "statuspage_json", status: "operational" },
  { key: "elastic", name: "Elastic Cloud", statusUrl: "https://status.elastic.co/", parser: "statuspage_json", status: "operational" },
  { key: "confluent", name: "Confluent", statusUrl: "https://status.confluent.cloud/", parser: "statuspage_json", status: "operational" },
  { key: "cockroachdb", name: "CockroachDB", statusUrl: "https://status.cockroachlabs.cloud/", parser: "statuspage_json", status: "operational" },
  { key: "planetscale", name: "PlanetScale", statusUrl: "https://www.planetscalestatus.com/", parser: "statuspage_json", status: "operational" },
  { key: "neon", name: "Neon", statusUrl: "https://neonstatus.com/", parser: "statuspage_json", status: "operational" },
  { key: "upstash", name: "Upstash", statusUrl: "https://status.upstash.com/", parser: "statuspage_json", status: "operational" },
  { key: "grafana", name: "Grafana Cloud", statusUrl: "https://status.grafana.com/", parser: "statuspage_json", status: "operational" },
  { key: "deno", name: "Deno Deploy", statusUrl: "https://www.denostatus.com/", parser: "statuspage_json", status: "operational" },
  // Expanded Directory - Security & Identity
  { key: "onepassword", name: "1Password", statusUrl: "https://status.1password.com/", parser: "statuspage_json", status: "operational" },
  { key: "lastpass", name: "LastPass", statusUrl: "https://status.lastpass.com/", parser: "statuspage_json", status: "operational" },
  // Expanded Directory - Payments & E-Commerce
  { key: "coinbase", name: "Coinbase", statusUrl: "https://status.coinbase.com/", parser: "statuspage_json", status: "operational" },
  { key: "shopify", name: "Shopify", statusUrl: "https://status.shopify.com/", parser: "statuspage_json", status: "operational" },
  { key: "wix", name: "Wix", statusUrl: "https://www.wixstatus.com/", parser: "statuspage_json", status: "operational" },
  // Expanded Directory - Collaboration & Productivity
  { key: "asana", name: "Asana", statusUrl: "https://trust.asana.com/", parser: "statuspage_json", status: "operational" },
  { key: "trello", name: "Trello", statusUrl: "https://trello.status.atlassian.com/", parser: "statuspage_json", status: "operational" },
  { key: "adobe", name: "Adobe Creative Cloud", statusUrl: "https://status.adobe.com/", parser: "statuspage_json", status: "operational" },
  { key: "retool", name: "Retool", statusUrl: "https://status.retool.com/", parser: "statuspage_json", status: "operational" },
  // Expanded Directory - Communication
  { key: "sendgrid", name: "SendGrid", statusUrl: "https://status.sendgrid.com/", parser: "statuspage_json", status: "operational" },
  // Expanded Directory - Other
  { key: "hashicorp", name: "HashiCorp", statusUrl: "https://status.hashicorp.com/", parser: "statuspage_json", status: "operational" },
  { key: "algolia", name: "Algolia", statusUrl: "https://status.algolia.com/", parser: "statuspage_json", status: "operational" },
  { key: "docker", name: "Docker", statusUrl: "https://www.dockerstatus.com/", parser: "statuspage_json", status: "operational" },
  { key: "cloudinary", name: "Cloudinary", statusUrl: "https://status.cloudinary.com/", parser: "statuspage_json", status: "operational" },
  { key: "mapbox", name: "Mapbox", statusUrl: "https://status.mapbox.com/", parser: "statuspage_json", status: "operational" },
  { key: "webflow", name: "Webflow", statusUrl: "https://status.webflow.com/", parser: "statuspage_json", status: "operational" },
  { key: "ghost", name: "Ghost", statusUrl: "https://status.ghost.org/", parser: "statuspage_json", status: "operational" },
  { key: "expo", name: "Expo", statusUrl: "https://status.expo.dev/", parser: "statuspage_json", status: "operational" },
];

export async function seedVendorsIfEmpty(): Promise<void> {
  const existingVendors = await storage.getVendors();
  const existingKeys = new Set(existingVendors.map(v => v.key));
  const defaultKeys = new Set(DEFAULT_VENDORS.map(v => v.key));
  
  // Remove vendors that are no longer in DEFAULT_VENDORS
  const vendorsToRemove = existingVendors.filter(v => !defaultKeys.has(v.key));
  if (vendorsToRemove.length > 0) {
    console.log(`[seed] Removing ${vendorsToRemove.length} vendors no longer in default list...`);
    for (const vendor of vendorsToRemove) {
      try {
        // Delete parser health records first
        await db.delete(parserHealth).where(eq(parserHealth.vendorKey, vendor.key));
        // Delete incidents
        await db.delete(incidents).where(eq(incidents.vendorKey, vendor.key));
        // Delete the vendor
        await db.delete(vendors).where(eq(vendors.key, vendor.key));
        console.log(`[seed] Removed vendor: ${vendor.name}`);
      } catch (error) {
        console.log(`[seed] Error removing vendor ${vendor.key}:`, error);
      }
    }
  }
  
  // Clean up orphaned parser_health entries (vendor_key not in vendors table or DEFAULT_VENDORS)
  try {
    const orphanedResult = await db.delete(parserHealth)
      .where(sql`${parserHealth.vendorKey} NOT IN (SELECT key FROM ${vendors})`)
      .returning({ vendorKey: parserHealth.vendorKey });
    if (orphanedResult.length > 0) {
      console.log(`[seed] Cleaned up ${orphanedResult.length} orphaned parser_health entries: ${orphanedResult.map(r => r.vendorKey).join(', ')}`);
    }
  } catch (error) {
    console.log(`[seed] Error cleaning up orphaned parser_health entries:`, error);
  }
  
  const missingVendors = DEFAULT_VENDORS.filter(v => !existingKeys.has(v.key));
  
  if (missingVendors.length > 0) {
    console.log(`[seed] Adding ${missingVendors.length} missing vendors...`);
    for (const vendor of missingVendors) {
      try {
        await storage.createVendor(vendor);
        console.log(`[seed] Created vendor: ${vendor.name}`);
      } catch (error) {
        console.log(`[seed] Vendor ${vendor.key} may already exist, skipping`);
      }
    }
    console.log('[seed] Vendor seeding complete');
  } else if (vendorsToRemove.length === 0) {
    console.log(`[seed] Found ${existingVendors.length} vendors, all up to date`);
  } else {
    console.log(`[seed] Vendor cleanup complete, ${existingVendors.length - vendorsToRemove.length} vendors remaining`);
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
  // Additional L2s with Statuspage
  { key: "zksync", name: "zkSync Era", symbol: "ZK", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.zksync.io", explorerUrl: "https://explorer.zksync.io", avgBlockTime: 1 },
  { key: "scroll", name: "Scroll", symbol: "SCR", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.scroll.io", explorerUrl: "https://scrollscan.com", avgBlockTime: 3 },
  { key: "linea", name: "Linea", symbol: "ETH", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.linea.build", explorerUrl: "https://lineascan.build", avgBlockTime: 2 },
  { key: "mode", name: "Mode", symbol: "MODE", tier: "tier3", category: "l2", sourceType: "statuspage", statusUrl: "https://status.mode.network", explorerUrl: "https://explorer.mode.network", avgBlockTime: 2 },
  { key: "mantle", name: "Mantle", symbol: "MNT", tier: "tier3", category: "l2", sourceType: "statuspage", statusUrl: "https://status.mantle.xyz", explorerUrl: "https://explorer.mantle.xyz", avgBlockTime: 2 },
  { key: "celo", name: "Celo", symbol: "CELO", tier: "tier3", category: "chain", sourceType: "statuspage", statusUrl: "https://status.celo.org", explorerUrl: "https://explorer.celo.org", avgBlockTime: 5 },
  { key: "near", name: "NEAR Protocol", symbol: "NEAR", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.nearprotocol.com", explorerUrl: "https://nearblocks.io", avgBlockTime: 1 },
  { key: "sui", name: "Sui", symbol: "SUI", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.sui.io", explorerUrl: "https://suiscan.xyz", avgBlockTime: 1 },
  { key: "aptos", name: "Aptos", symbol: "APT", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.aptoslabs.com", explorerUrl: "https://aptoscan.com", avgBlockTime: 1 },
  
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
  
  // WalletConnect: Popular Compatible Wallets
  { key: "metamask", name: "MetaMask", symbol: "MM", tier: "tier1", category: "wallet", sourceType: "statuspage", statusUrl: "https://status.infura.io" },
  { key: "trustwallet", name: "Trust Wallet", symbol: "TW", tier: "tier1", category: "wallet", sourceType: "manual", statusUrl: "https://status.trustwallet.com" },
  { key: "ledger", name: "Ledger Live", symbol: "LDG", tier: "tier1", category: "wallet", sourceType: "statuspage", statusUrl: "https://status.ledger.com" },
  { key: "coinbasewallet", name: "Coinbase Wallet", symbol: "CBW", tier: "tier1", category: "wallet", sourceType: "statuspage", statusUrl: "https://status.coinbase.com" },
  { key: "rainbow", name: "Rainbow", symbol: "RBW", tier: "tier2", category: "wallet", sourceType: "manual", statusUrl: "https://rainbow.me" },
  { key: "argent", name: "Argent", symbol: "AGT", tier: "tier2", category: "wallet", sourceType: "statuspage", statusUrl: "https://argentxwallet.statuspage.io" },
  { key: "gnosissafe", name: "Gnosis Safe", symbol: "SAFE", tier: "tier1", category: "wallet", sourceType: "statuspage", statusUrl: "https://safe.statuspage.io" },
  { key: "bybitwallet", name: "Bybit Web3 Wallet", symbol: "BYB", tier: "tier2", category: "wallet", sourceType: "statuspage", statusUrl: "https://bybit.statuspage.io" },
  // Additional Wallets with Statuspage
  { key: "phantom", name: "Phantom", symbol: "PHT", tier: "tier1", category: "wallet", sourceType: "statuspage", statusUrl: "https://status.phantom.app" },
  { key: "trezor", name: "Trezor", symbol: "TRZ", tier: "tier1", category: "wallet", sourceType: "statuspage", statusUrl: "https://status.trezor.io" },
  { key: "okxwallet", name: "OKX Wallet", symbol: "OKX", tier: "tier2", category: "wallet", sourceType: "statuspage", statusUrl: "https://status.okx.com" },
  { key: "exodus", name: "Exodus", symbol: "EXO", tier: "tier2", category: "wallet", sourceType: "statuspage", statusUrl: "https://status.exodus.com" },
  { key: "uniswap", name: "Uniswap Wallet", symbol: "UNI", tier: "tier2", category: "wallet", sourceType: "statuspage", statusUrl: "https://status.uniswap.org" },
  
  // Staking Platforms: Centralized Exchanges (CEXs)
  { key: "binance", name: "Binance", symbol: "BNB", tier: "tier1", category: "staking", sourceType: "manual", statusUrl: "https://www.binance.com/en/network" },
  { key: "coinbase", name: "Coinbase", symbol: "COIN", tier: "tier1", category: "staking", sourceType: "statuspage", statusUrl: "https://status.coinbase.com" },
  { key: "kraken", name: "Kraken", symbol: "KRK", tier: "tier1", category: "staking", sourceType: "statuspage", statusUrl: "https://status.kraken.com" },
  { key: "gemini", name: "Gemini", symbol: "GEM", tier: "tier1", category: "staking", sourceType: "statuspage", statusUrl: "https://status.gemini.com" },
  
  // Staking Platforms: Decentralized & Liquid Staking
  { key: "lido", name: "Lido Finance", symbol: "LDO", tier: "tier1", category: "staking", sourceType: "manual", statusUrl: "https://lido.fi" },
  { key: "rocketpool", name: "Rocket Pool", symbol: "RPL", tier: "tier2", category: "staking", sourceType: "manual", statusUrl: "https://rocketpool.net" },
  { key: "stakewise", name: "StakeWise", symbol: "SWISE", tier: "tier2", category: "staking", sourceType: "manual", statusUrl: "https://stakewise.io" },
  { key: "stakedao", name: "Stake DAO", symbol: "SDT", tier: "tier2", category: "staking", sourceType: "manual", statusUrl: "https://stakedao.org" },
  { key: "marinade", name: "Marinade Finance", symbol: "MNDE", tier: "tier2", category: "staking", sourceType: "manual", statusUrl: "https://marinade.finance" },
  
  // Staking Platforms: Institutional & Infrastructure Providers
  { key: "rockx", name: "RockX", symbol: "RKX", tier: "tier2", category: "staking", sourceType: "manual", statusUrl: "https://www.rockx.com" },
  { key: "figment", name: "Figment", symbol: "FIG", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.figment.io" },
  { key: "ankr", name: "Ankr", symbol: "ANKR", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.ankr.com" },
  { key: "cryptocom", name: "Crypto.com", symbol: "CRO", tier: "tier1", category: "staking", sourceType: "statuspage", statusUrl: "https://status.crypto.com" },
  { key: "kiln", name: "Kiln", symbol: "KLN", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.kiln.fi" },
  { key: "bybit", name: "Bybit", symbol: "BYB", tier: "tier1", category: "staking", sourceType: "statuspage", statusUrl: "https://bybit.statuspage.io" },
  // Additional Staking Infrastructure Providers
  { key: "allnodes", name: "Allnodes", symbol: "ALL", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.allnodes.com" },
  { key: "blockdaemon", name: "Blockdaemon", symbol: "BD", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.blockdaemon.com" },
  { key: "everstake", name: "Everstake", symbol: "EVR", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.everstake.one" },
  { key: "chorusone", name: "Chorus One", symbol: "CHO", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.chorus.one" },
  { key: "p2p", name: "P2P Validator", symbol: "P2P", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.p2p.org" },
  { key: "stakefish", name: "Stakefish", symbol: "STF", tier: "tier2", category: "staking", sourceType: "statuspage", statusUrl: "https://status.stake.fish" },
  
  // Layer 1 Blockchains (Additional)
  { key: "fantom", name: "Fantom", symbol: "FTM", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.fantom.foundation" },
  { key: "cardano", name: "Cardano", symbol: "ADA", tier: "tier1", category: "chain", sourceType: "statuspage", statusUrl: "https://status.cardano.org" },
  { key: "polkadot", name: "Polkadot", symbol: "DOT", tier: "tier1", category: "chain", sourceType: "statuspage", statusUrl: "https://status.polkadot.network" },
  { key: "algorand", name: "Algorand", symbol: "ALGO", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.algorand.org" },
  { key: "hedera", name: "Hedera", symbol: "HBAR", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.hedera.com" },
  { key: "flow", name: "Flow", symbol: "FLOW", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.flow.com" },
  { key: "tezos", name: "Tezos", symbol: "XTZ", tier: "tier2", category: "chain", sourceType: "statuspage", statusUrl: "https://status.tezos.com" },
  { key: "kaspa", name: "Kaspa", symbol: "KAS", tier: "tier3", category: "chain", sourceType: "statuspage", statusUrl: "https://status.kaspa.org" },
  
  // Layer 2 & Sidechains (Additional)
  { key: "starknet", name: "Starknet", symbol: "STRK", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.starknet.io" },
  { key: "immutablex", name: "Immutable X", symbol: "IMX", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.immutable.com" },
  { key: "ronin", name: "Ronin", symbol: "RON", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.roninchain.com" },
  { key: "blast", name: "Blast", symbol: "BLAST", tier: "tier2", category: "l2", sourceType: "statuspage", statusUrl: "https://status.blast.io" },
  { key: "metis", name: "Metis", symbol: "METIS", tier: "tier3", category: "l2", sourceType: "statuspage", statusUrl: "https://status.metis.io" },
  
  // DeFi Protocols
  { key: "dydx", name: "dYdX", symbol: "DYDX", tier: "tier2", category: "defi", sourceType: "statuspage", statusUrl: "https://status.dydx.trade" },
  { key: "aave", name: "Aave", symbol: "AAVE", tier: "tier1", category: "defi", sourceType: "statuspage", statusUrl: "https://status.aave.com" },
  { key: "oneinch", name: "1inch", symbol: "1INCH", tier: "tier2", category: "defi", sourceType: "statuspage", statusUrl: "https://status.1inch.io" },
  { key: "gmx", name: "GMX", symbol: "GMX", tier: "tier2", category: "defi", sourceType: "statuspage", statusUrl: "https://status.gmx.io" },
  { key: "jupiter", name: "Jupiter", symbol: "JUP", tier: "tier2", category: "defi", sourceType: "statuspage", statusUrl: "https://status.jup.ag" },
  
  // NFT Marketplaces
  { key: "opensea", name: "OpenSea", tier: "tier1", category: "nft", sourceType: "statuspage", statusUrl: "https://status.opensea.io" },
  { key: "rarible", name: "Rarible", tier: "tier2", category: "nft", sourceType: "statuspage", statusUrl: "https://status.rarible.com" },
  { key: "magiceden", name: "Magic Eden", tier: "tier2", category: "nft", sourceType: "statuspage", statusUrl: "https://status.magiceden.io" },
  { key: "blur", name: "Blur", tier: "tier2", category: "nft", sourceType: "statuspage", statusUrl: "https://status.blur.io" },
  
  // Crypto Exchanges
  { key: "okx", name: "OKX", tier: "tier1", category: "exchange", sourceType: "statuspage", statusUrl: "https://status.okx.com" },
  { key: "kucoin", name: "KuCoin", tier: "tier2", category: "exchange", sourceType: "statuspage", statusUrl: "https://status.kucoin.com" },
  { key: "gateio", name: "Gate.io", tier: "tier2", category: "exchange", sourceType: "statuspage", statusUrl: "https://status.gate.io" },
  { key: "bitfinex", name: "Bitfinex", tier: "tier2", category: "exchange", sourceType: "statuspage", statusUrl: "https://status.bitfinex.com" },
  { key: "bitstamp", name: "Bitstamp", tier: "tier2", category: "exchange", sourceType: "statuspage", statusUrl: "https://status.bitstamp.net" },
  { key: "upbit", name: "Upbit", tier: "tier2", category: "exchange", sourceType: "statuspage", statusUrl: "https://status.upbit.com" },
  { key: "htx", name: "HTX (Huobi)", tier: "tier2", category: "exchange", sourceType: "statuspage", statusUrl: "https://status.htx.com" },
  
  // Blockchain Security & Analytics
  { key: "chainalysis", name: "Chainalysis", tier: "tier2", category: "security", sourceType: "statuspage", statusUrl: "https://status.chainalysis.com" },
  { key: "elliptic", name: "Elliptic", tier: "tier2", category: "security", sourceType: "statuspage", statusUrl: "https://status.elliptic.co" },
  { key: "certik", name: "Certik", tier: "tier2", category: "security", sourceType: "statuspage", statusUrl: "https://status.certik.com" },
  { key: "hacken", name: "Hacken", tier: "tier3", category: "security", sourceType: "statuspage", statusUrl: "https://status.hacken.io" },
  
  // Institutional Custody
  { key: "bitgo", name: "BitGo", tier: "tier1", category: "custody", sourceType: "statuspage", statusUrl: "https://status.bitgo.com" },
  { key: "copper", name: "Copper", tier: "tier2", category: "custody", sourceType: "statuspage", statusUrl: "https://status.copper.co" },
  { key: "hextrust", name: "Hex Trust", tier: "tier3", category: "custody", sourceType: "statuspage", statusUrl: "https://status.hextrust.com" },
  
  // RPC Providers (Additional)
  { key: "moralis", name: "Moralis", tier: "tier2", category: "rpc_provider", sourceType: "statuspage", statusUrl: "https://status.moralis.io" },
  { key: "chainstack", name: "Chainstack", tier: "tier2", category: "rpc_provider", sourceType: "statuspage", statusUrl: "https://status.chainstack.com" },
  { key: "getblock", name: "GetBlock", tier: "tier3", category: "rpc_provider", sourceType: "statuspage", statusUrl: "https://status.getblock.io" },
  { key: "nownodes", name: "NOWNodes", tier: "tier3", category: "rpc_provider", sourceType: "statuspage", statusUrl: "https://status.nownodes.io" },
  { key: "tenderly", name: "Tenderly", tier: "tier2", category: "rpc_provider", sourceType: "statuspage", statusUrl: "https://status.tenderly.co" },
  
  // Bridges & Cross-Chain
  { key: "layerzero", name: "LayerZero", tier: "tier1", category: "bridge", sourceType: "statuspage", statusUrl: "https://status.layerzero.network" },
  { key: "wormhole", name: "Wormhole", tier: "tier1", category: "bridge", sourceType: "statuspage", statusUrl: "https://status.wormhole.com" },
  { key: "axelar", name: "Axelar", tier: "tier2", category: "bridge", sourceType: "statuspage", statusUrl: "https://status.axelar.network" },
  { key: "stargate", name: "Stargate", tier: "tier2", category: "bridge", sourceType: "statuspage", statusUrl: "https://status.stargate.finance" },
  
  // Oracles
  { key: "pyth", name: "Pyth Network", tier: "tier2", category: "oracle", sourceType: "statuspage", statusUrl: "https://status.pyth.network" },
  { key: "band", name: "Band Protocol", tier: "tier3", category: "oracle", sourceType: "statuspage", statusUrl: "https://status.bandprotocol.com" },
  
  // Stablecoins
  { key: "circle", name: "Circle (USDC)", symbol: "USDC", tier: "tier1", category: "stablecoin", sourceType: "statuspage", statusUrl: "https://status.circle.com" },
  { key: "paxos", name: "Paxos", symbol: "USDP", tier: "tier2", category: "stablecoin", sourceType: "statuspage", statusUrl: "https://status.paxos.com" },
  { key: "tether", name: "Tether", symbol: "USDT", tier: "tier1", category: "stablecoin", sourceType: "statuspage", statusUrl: "https://status.tether.to" },
];

export async function seedBlockchainChainsIfEmpty(): Promise<void> {
  const existingChains = await storage.getBlockchainChains();
  const existingKeys = new Set(existingChains.map(c => c.key));
  
  const missingChains = DEFAULT_BLOCKCHAIN_CHAINS.filter(c => !existingKeys.has(c.key));
  
  if (missingChains.length > 0) {
    console.log(`[seed] Adding ${missingChains.length} missing blockchain chains...`);
    for (const chain of missingChains) {
      try {
        await storage.createBlockchainChain(chain);
        console.log(`[seed] Created blockchain: ${chain.name}`);
      } catch (error) {
        console.log(`[seed] Chain ${chain.key} may already exist, skipping`);
      }
    }
    console.log('[seed] Blockchain seeding complete');
  } else {
    console.log(`[seed] Found ${existingChains.length} blockchain chains, all up to date`);
  }
}
