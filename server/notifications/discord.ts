import { storage } from '../storage';
import type { Incident, Vendor, BlockchainIncident, BlockchainChain } from '@shared/schema';

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

export function formatDiscordEmbed(incident: IncidentData, eventType: EventType): object {
  const eventLabel = eventType.toUpperCase().replace('_', ' ');
  const vendorOrChain = incident.vendorName || incident.chainName || incident.vendorKey || incident.chainKey || 'Unknown';

  const colorMap: Record<string, number> = {
    resolved: 0x00FF00,
    new: 0xFF0000,
    escalation: 0xFF6600,
    update: 0xFFA500,
    long_running: 0xFF9900,
  };

  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    major: '🟠',
    minor: '🟡',
    info: '🔵',
  };

  const eventEmoji: Record<string, string> = {
    resolved: '✅',
    new: '🚨',
    update: '⚠️',
    escalation: '⬆️',
    long_running: '⏰',
  };

  const fields = [
    { name: 'Vendor', value: vendorOrChain, inline: true },
    { name: 'Severity', value: `${severityEmoji[incident.severity.toLowerCase()] || '⚪'} ${incident.severity}`, inline: true },
    { name: 'Status', value: incident.status, inline: true },
  ];

  if (incident.impact) {
    fields.push({ name: 'Impact', value: incident.impact, inline: false });
  }

  return {
    embeds: [
      {
        title: `${eventEmoji[eventType] || '⚠️'} ${eventLabel}: ${incident.title}`,
        url: incident.url,
        color: colorMap[eventType] || 0xFF0000,
        fields,
        footer: { text: 'VendorWatch' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function sendToDiscordWebhook(webhookUrl: string, payload: object): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 204) {
      console.log(`[discord] Successfully sent Discord notification`);
      return true;
    } else {
      console.error(`[discord] Failed to send Discord notification: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`[discord] Error sending Discord notification:`, error);
    return false;
  }
}

export async function dispatchDiscordNotification(
  incidentData: IncidentData,
  eventType: EventType,
  userId: string
): Promise<{ discord: number; errors: string[] }> {
  const errors: string[] = [];
  let discordSent = 0;

  try {
    const integrations = await storage.getUserIntegrations(userId);
    const activeDiscord = integrations.filter(i => i.isActive && i.integrationType === 'discord' && i.hasWebhook);

    for (const integration of activeDiscord) {
      const fullIntegration = await storage.getUserIntegrationFull(integration.id);
      if (fullIntegration?.webhookUrl) {
        const payload = formatDiscordEmbed(incidentData, eventType);
        const success = await sendToDiscordWebhook(fullIntegration.webhookUrl, payload);
        if (success) {
          discordSent++;
        } else {
          errors.push(`Failed to send to Discord integration: ${integration.name}`);
        }
      }
    }
  } catch (error) {
    console.error('[discord] Error dispatching notifications:', error);
    errors.push(`Discord dispatch error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return { discord: discordSent, errors };
}

export async function dispatchDiscordForAllSubscribedUsers(
  incident: Incident | BlockchainIncident,
  vendorOrChain: Vendor | BlockchainChain,
  eventType: EventType
): Promise<{ discord: number; errors: string[] }> {
  const errors: string[] = [];
  let totalDiscordSent = 0;

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

      const tier = user.subscriptionTier;
      if (!tier || tier === 'essential') {
        continue;
      }

      const result = await dispatchDiscordNotification(incidentData, eventType, user.id);
      totalDiscordSent += result.discord;
      errors.push(...result.errors);
    }
  } catch (error) {
    console.error('[discord] Error dispatching to all users:', error);
    errors.push(`Discord dispatch error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  if (totalDiscordSent > 0) {
    console.log(`[discord] Dispatched ${totalDiscordSent} Discord notifications`);
  }

  return { discord: totalDiscordSent, errors };
}
