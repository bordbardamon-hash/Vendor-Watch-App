import { storage } from '../storage';
import { SUBSCRIPTION_TIERS } from '@shared/schema';
import type { Incident, Vendor, BlockchainIncident, BlockchainChain, LifecycleEvent, SubscriptionTierKey } from '@shared/schema';

type EventType = 'new' | 'update' | 'resolved' | 'escalation' | 'long_running';

interface IncidentData {
  title: string;
  vendorKey?: string;
  vendorName?: string;
  chainKey?: string;
  chainName?: string;
  severity: string;
  status: string;
  url: string;
  impact?: string;
  startedAt?: string;
}

export function formatSlackMessage(incident: IncidentData, eventType: EventType): object {
  const emoji = eventType === 'resolved' ? '✅' : eventType === 'new' ? '🚨' : eventType === 'escalation' ? '⬆️' : '⚠️';
  const eventLabel = eventType.toUpperCase().replace('_', ' ');
  const vendorOrChain = incident.vendorName || incident.chainName || incident.vendorKey || incident.chainKey || 'Unknown';
  
  const severityEmoji = {
    critical: '🔴',
    major: '🟠',
    minor: '🟡',
    info: '🔵'
  }[incident.severity.toLowerCase()] || '⚪';

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${emoji} ${eventLabel}: ${incident.title}`,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Vendor:*\n${vendorOrChain}`
          },
          {
            type: "mrkdwn",
            text: `*Severity:*\n${severityEmoji} ${incident.severity}`
          },
          {
            type: "mrkdwn",
            text: `*Status:*\n${incident.status}`
          },
          ...(incident.impact ? [{
            type: "mrkdwn",
            text: `*Impact:*\n${incident.impact}`
          }] : [])
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Details",
              emoji: true
            },
            url: incident.url,
            style: eventType === 'resolved' ? undefined : "danger"
          }
        ]
      }
    ]
  };
}

export function formatTeamsMessage(incident: IncidentData, eventType: EventType): object {
  const eventLabel = eventType.toUpperCase().replace('_', ' ');
  const vendorOrChain = incident.vendorName || incident.chainName || incident.vendorKey || incident.chainKey || 'Unknown';
  
  const themeColor = {
    resolved: "00FF00",
    new: "FF0000",
    escalation: "FF6600",
    update: "FFA500",
    long_running: "FF9900"
  }[eventType] || "FF0000";

  const facts = [
    { name: "Vendor", value: vendorOrChain },
    { name: "Severity", value: incident.severity },
    { name: "Status", value: incident.status }
  ];

  if (incident.impact) {
    facts.push({ name: "Impact", value: incident.impact });
  }

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": themeColor,
    "summary": `${eventLabel}: ${incident.title}`,
    "sections": [{
      "activityTitle": `🚨 ${eventLabel}`,
      "activitySubtitle": incident.title,
      "facts": facts,
      "markdown": true
    }],
    "potentialAction": [{
      "@type": "OpenUri",
      "name": "View Details",
      "targets": [{ "os": "default", "uri": incident.url }]
    }]
  };
}

async function sendToWebhook(webhookUrl: string, payload: object, integrationType: 'slack' | 'teams'): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (response.ok) {
      console.log(`[slack-teams] Successfully sent ${integrationType} notification`);
      return true;
    } else {
      console.error(`[slack-teams] Failed to send ${integrationType} notification: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`[slack-teams] Error sending ${integrationType} notification:`, error);
    return false;
  }
}

export async function dispatchSlackTeamsNotification(
  incidentData: IncidentData,
  eventType: EventType,
  userId: string
): Promise<{ slack: number; teams: number; errors: string[] }> {
  const errors: string[] = [];
  let slackSent = 0;
  let teamsSent = 0;

  try {
    const integrations = await storage.getUserIntegrations(userId);
    const activeIntegrations = integrations.filter(i => i.isActive);

    for (const integration of activeIntegrations) {
      if (integration.integrationType === 'slack' && integration.hasWebhook) {
        const fullIntegration = await storage.getUserIntegrationFull(integration.id);
        if (fullIntegration?.webhookUrl) {
          const payload = formatSlackMessage(incidentData, eventType);
          const success = await sendToWebhook(fullIntegration.webhookUrl, payload, 'slack');
          if (success) {
            slackSent++;
          } else {
            errors.push(`Failed to send to Slack integration: ${integration.name}`);
          }
        }
      } else if (integration.integrationType === 'teams' && integration.hasWebhook) {
        const fullIntegration = await storage.getUserIntegrationFull(integration.id);
        if (fullIntegration?.webhookUrl) {
          const payload = formatTeamsMessage(incidentData, eventType);
          const success = await sendToWebhook(fullIntegration.webhookUrl, payload, 'teams');
          if (success) {
            teamsSent++;
          } else {
            errors.push(`Failed to send to Teams integration: ${integration.name}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[slack-teams] Error dispatching notifications:', error);
    errors.push(`Integration dispatch error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return { slack: slackSent, teams: teamsSent, errors };
}

export async function dispatchSlackTeamsForAllSubscribedUsers(
  incident: Incident | BlockchainIncident,
  vendorOrChain: Vendor | BlockchainChain,
  eventType: EventType
): Promise<{ slack: number; teams: number; errors: string[] }> {
  const errors: string[] = [];
  let totalSlackSent = 0;
  let totalTeamsSent = 0;

  const isBlockchain = 'chainKey' in incident;
  const key = isBlockchain ? (incident as BlockchainIncident).chainKey : (incident as Incident).vendorKey;
  const name = vendorOrChain.name;

  const incidentData: IncidentData = {
    title: incident.title,
    vendorKey: isBlockchain ? undefined : key,
    vendorName: isBlockchain ? undefined : name,
    chainKey: isBlockchain ? key : undefined,
    chainName: isBlockchain ? name : undefined,
    severity: incident.severity,
    status: incident.status,
    url: incident.url,
    impact: incident.impact,
    startedAt: incident.startedAt,
  };

  try {
    const usersWithNotifications = await storage.getUsersWithNotificationsEnabled();
    
    for (const user of usersWithNotifications) {
      const userSubscriptions = isBlockchain 
        ? await storage.getUserBlockchainSubscriptions(user.id)
        : await storage.getUserVendorSubscriptions(user.id);
      
      if (userSubscriptions.length === 0 || !userSubscriptions.includes(key)) {
        continue;
      }

      const tier = user.subscriptionTier as SubscriptionTierKey;
      const tierConfig = tier ? SUBSCRIPTION_TIERS[tier] : null;
      if (!tierConfig || !tierConfig.slackEnabled) {
        continue;
      }

      const result = await dispatchSlackTeamsNotification(incidentData, eventType, user.id);
      totalSlackSent += result.slack;
      totalTeamsSent += result.teams;
      errors.push(...result.errors);
    }
  } catch (error) {
    console.error('[slack-teams] Error dispatching to all users:', error);
    errors.push(`Dispatch error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  if (totalSlackSent > 0 || totalTeamsSent > 0) {
    console.log(`[slack-teams] Dispatched notifications - Slack: ${totalSlackSent}, Teams: ${totalTeamsSent}`);
  }

  return { slack: totalSlackSent, teams: totalTeamsSent, errors };
}
