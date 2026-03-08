import { storage } from '../storage';
import type { Incident, Vendor, BlockchainIncident, BlockchainChain, LifecycleEvent } from '@shared/schema';

export async function sendPagerDutyEvent(params: {
  integrationKey: string;
  action: 'trigger' | 'acknowledge' | 'resolve';
  dedupKey: string;
  summary: string;
  source: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  customDetails?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: any = {
      routing_key: params.integrationKey,
      event_action: params.action,
      dedup_key: params.dedupKey,
    };

    if (params.action === 'trigger') {
      payload.payload = {
        summary: params.summary,
        source: params.source,
        severity: params.severity,
        custom_details: params.customDetails || {},
      };
    }

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`[pagerduty] Successfully sent ${params.action} event for dedup_key=${params.dedupKey}`);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error(`[pagerduty] Failed to send ${params.action} event: ${response.status} ${errorText}`);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[pagerduty] Error sending ${params.action} event:`, errMsg);
    return { success: false, error: errMsg };
  }
}

type EventType = 'new' | 'update' | 'resolved' | 'escalation' | 'long_running';

function mapEventToAction(eventType: EventType): 'trigger' | 'acknowledge' | 'resolve' {
  switch (eventType) {
    case 'new':
      return 'trigger';
    case 'resolved':
      return 'resolve';
    case 'update':
    case 'escalation':
      return 'acknowledge';
    case 'long_running':
      return 'trigger';
    default:
      return 'trigger';
  }
}

function mapSeverity(severity: string): 'critical' | 'error' | 'warning' | 'info' {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'major':
      return 'error';
    case 'minor':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'warning';
  }
}

export async function dispatchPagerDutyNotification(
  incidentId: string,
  summary: string,
  source: string,
  severity: string,
  eventType: EventType,
  userId: string,
  customDetails?: Record<string, any>
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  try {
    const integrations = await storage.getUserIntegrations(userId);
    const activeIntegrations = integrations.filter(
      i => i.integrationType === 'pagerduty' && i.isActive
    );

    for (const integration of activeIntegrations) {
      const fullIntegration = await storage.getUserIntegrationFull(integration.id);
      const integrationKey = fullIntegration?.apiKey || 
        (fullIntegration?.additionalConfig ? JSON.parse(fullIntegration.additionalConfig)?.integrationKey : null);

      if (!integrationKey) {
        errors.push(`PagerDuty integration "${integration.name}" missing integration key`);
        continue;
      }

      const result = await sendPagerDutyEvent({
        integrationKey,
        action: mapEventToAction(eventType),
        dedupKey: incidentId,
        summary,
        source,
        severity: mapSeverity(severity),
        customDetails,
      });

      if (result.success) {
        sent++;
      } else {
        errors.push(`PagerDuty "${integration.name}": ${result.error}`);
      }
    }
  } catch (error) {
    console.error('[pagerduty] Error dispatching notifications:', error);
    errors.push(`PagerDuty dispatch error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return { sent, errors };
}

export async function dispatchPagerDutyForAllSubscribedUsers(
  incident: Incident | BlockchainIncident,
  vendorOrChain: Vendor | BlockchainChain,
  eventType: EventType
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let totalSent = 0;

  const isBlockchain = 'chainKey' in incident;
  const key = isBlockchain ? (incident as BlockchainIncident).chainKey : (incident as Incident).vendorKey;
  const name = vendorOrChain.name;

  try {
    const usersWithNotifications = await storage.getUsersWithNotificationsEnabled();

    for (const user of usersWithNotifications) {
      const userSubscriptions = isBlockchain
        ? await storage.getUserBlockchainSubscriptions(user.id)
        : await storage.getUserVendorSubscriptions(user.id);

      if (userSubscriptions.length === 0 || !userSubscriptions.includes(key)) {
        continue;
      }

      const tier = user.subscriptionTier;
      if (!tier || tier === 'free' || tier === 'essential') {
        continue;
      }

      const customDetails: Record<string, any> = {
        vendor: name,
        status: incident.status,
        severity: incident.severity,
        url: incident.url,
        startedAt: incident.startedAt,
      };
      if ('impact' in incident && incident.impact) {
        customDetails.impact = incident.impact;
      }

      const result = await dispatchPagerDutyNotification(
        incident.incidentId,
        `${name}: ${incident.title}`,
        name,
        incident.severity,
        eventType,
        user.id,
        customDetails
      );

      totalSent += result.sent;
      errors.push(...result.errors);
    }
  } catch (error) {
    console.error('[pagerduty] Error dispatching to all users:', error);
    errors.push(`PagerDuty dispatch error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  if (totalSent > 0) {
    console.log(`[pagerduty] Dispatched ${totalSent} PagerDuty notifications`);
  }

  return { sent: totalSent, errors };
}
