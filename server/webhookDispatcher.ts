import crypto from 'crypto';
import { storage } from './storage';
import type { Incident, Vendor, BlockchainIncident, BlockchainChain, UserWebhook } from '@shared/schema';

type WebhookEventType = 'new' | 'update' | 'resolved';

export function buildWebhookPayload(
  incident: Incident | BlockchainIncident,
  entity: Vendor | BlockchainChain,
  eventType: WebhookEventType,
  isBlockchain: boolean = false
): Record<string, any> {
  const entityField = isBlockchain
    ? { chain: { key: (entity as BlockchainChain).key, name: entity.name } }
    : { vendor: { key: (entity as Vendor).key, name: entity.name } };

  return {
    event: `incident.${eventType}`,
    timestamp: new Date().toISOString(),
    data: {
      id: incident.id,
      title: incident.title,
      ...entityField,
      severity: incident.severity,
      status: incident.status,
      impact: 'impact' in incident ? incident.impact : undefined,
      url: 'url' in incident ? incident.url : undefined,
      startedAt: incident.startedAt,
      updatedAt: incident.updatedAt,
    },
  };
}

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function sendWebhook(
  webhook: UserWebhook,
  payloadObj: Record<string, any>,
  incidentId: string | null,
  blockchainIncidentId: string | null,
  eventType: WebhookEventType
): Promise<void> {
  const payloadStr = JSON.stringify(payloadObj);
  const startTime = Date.now();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': `incident.${eventType}`,
  };

  if (webhook.secret) {
    headers['X-Webhook-Signature'] = signPayload(payloadStr, webhook.secret);
  }

  if (webhook.headers) {
    try {
      const customHeaders = JSON.parse(webhook.headers);
      Object.assign(headers, customHeaders);
    } catch {
    }
  }

  let responseStatus: number | undefined;
  let responseBody: string | undefined;
  let success = false;
  let errorMessage: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = response.status;
    responseBody = await response.text().catch(() => undefined);
    success = response.ok;

    if (!success) {
      errorMessage = `HTTP ${responseStatus}: ${responseBody?.substring(0, 500)}`;
    }
  } catch (err: any) {
    errorMessage = err.name === 'AbortError'
      ? 'Request timed out after 10 seconds'
      : err.message || 'Unknown error';
  }

  const durationMs = Date.now() - startTime;

  try {
    await storage.createWebhookLog({
      webhookId: webhook.id,
      incidentId,
      blockchainIncidentId,
      eventType: `incident.${eventType}`,
      payload: payloadStr,
      responseStatus: responseStatus ?? null,
      responseBody: responseBody?.substring(0, 2000) ?? null,
      durationMs,
      success,
      errorMessage: errorMessage ?? null,
    });

    await storage.recordWebhookDelivery(webhook.id, success, responseStatus, errorMessage);
  } catch (err) {
    console.error(`[WebhookDispatcher] Failed to record delivery for webhook ${webhook.id}:`, err);
  }
}

export async function dispatchWebhooksForIncident(
  incident: Incident,
  vendor: Vendor,
  eventType: WebhookEventType
): Promise<void> {
  try {
    const webhooks = await storage.getActiveWebhooksForVendorEvent(vendor.key, eventType);
    if (webhooks.length === 0) return;

    const payload = buildWebhookPayload(incident, vendor, eventType, false);

    const promises = webhooks.map(webhook =>
      sendWebhook(webhook, payload, incident.id, null, eventType).catch(err => {
        console.error(`[WebhookDispatcher] Error dispatching to webhook ${webhook.id}:`, err);
      })
    );

    await Promise.allSettled(promises);
  } catch (err) {
    console.error(`[WebhookDispatcher] Failed to dispatch webhooks for incident ${incident.id}:`, err);
  }
}

export async function dispatchWebhooksForBlockchainIncident(
  incident: BlockchainIncident,
  chain: BlockchainChain,
  eventType: WebhookEventType
): Promise<void> {
  try {
    const activeWebhooks = await storage.getActiveWebhooksForVendorEvent(chain.key, eventType);

    const webhooks = activeWebhooks.filter(webhook => {
      const chainKeys = webhook.chainKeys ? JSON.parse(webhook.chainKeys) : null;
      return !chainKeys || chainKeys.includes(chain.key);
    });

    if (webhooks.length === 0) return;

    const payload = buildWebhookPayload(incident, chain, eventType, true);

    const promises = webhooks.map(webhook =>
      sendWebhook(webhook, payload, null, incident.id, eventType).catch(err => {
        console.error(`[WebhookDispatcher] Error dispatching to webhook ${webhook.id}:`, err);
      })
    );

    await Promise.allSettled(promises);
  } catch (err) {
    console.error(`[WebhookDispatcher] Failed to dispatch webhooks for blockchain incident ${incident.id}:`, err);
  }
}
