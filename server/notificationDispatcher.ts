import { storage } from './storage';
import { sendSMS } from './twilioClient';
import { sendEmail } from './emailClient';
import { shouldSendAlert, recordAlertSent } from './cooldownManager';
import { formatSeverityDisplay, formatStatusDisplay } from './statusNormalizer';
import { generateCustomerSummary, generateCustomerSummarySms } from './customerSummaryGenerator';
import { dispatchSlackTeamsForAllSubscribedUsers } from './notifications/slack-teams';
import { dispatchPagerDutyForAllSubscribedUsers } from './notifications/pagerduty';
import { dispatchDiscordForAllSubscribedUsers } from './notifications/discord';
import { dispatchWebhooksForIncident, dispatchWebhooksForBlockchainIncident } from './webhookDispatcher';
import type { Incident, Vendor, User, LifecycleEvent, CanonicalSeverity, CanonicalStatus, BlockchainIncident, BlockchainChain, SyntheticProbe } from '@shared/schema';

type EventType = 'new' | 'update' | 'resolved';

async function getAssignedUserIds(targetType: 'vendor' | 'blockchain', targetKey: string): Promise<string[] | null> {
  try {
    const assignments = await storage.getGlobalAssignmentsForTarget(targetType, targetKey);
    if (assignments.length > 0) {
      return assignments.map(a => a.memberUserId);
    }
    return null;
  } catch (error) {
    console.error(`[notify] Error checking alert assignments for ${targetType}:${targetKey}:`, error);
    return null;
  }
}

interface IncidentNotification {
  incident: Incident;
  vendor: Vendor;
  eventType: EventType;
  previousStatus?: string;
}

interface LifecycleNotification {
  incident: Incident;
  vendor: Vendor;
  lifecycleEvent: LifecycleEvent;
  previousStatus?: string;
  previousSeverity?: string;
  affectedServices?: string;
}

function sanitizeText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDateInTimezone(date: Date | string, timezone: string = 'UTC'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return d.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return d.toLocaleString();
  }
}

function formatSmsMessage(notification: IncidentNotification): string {
  const { incident, vendor, eventType } = notification;
  
  const statusEmoji = eventType === 'resolved' ? '✅' : eventType === 'new' ? '🚨' : '⚠️';
  const eventLabel = eventType === 'resolved' ? 'RESOLVED' : eventType === 'new' ? 'NEW INCIDENT' : 'UPDATE';
  const title = sanitizeText(incident.title);
  
  return `${statusEmoji} Vendor Watch ${eventLabel}: ${vendor.name} - ${title}. Status: ${incident.status}. More info: ${incident.url}`;
}

function sanitizeSubject(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 100);
}

function formatEmailSubject(notification: IncidentNotification): string {
  const { incident, vendor, eventType } = notification;
  
  const prefix = eventType === 'resolved' 
    ? '✅ [RESOLVED]' 
    : eventType === 'new' 
    ? '🚨 [NEW INCIDENT]' 
    : '⚠️ [UPDATE]';
  
  return sanitizeSubject(`${prefix} ${vendor.name}: ${incident.title}`);
}

function formatEmailHtml(notification: IncidentNotification, timezone: string = 'UTC'): string {
  const { incident, vendor, eventType } = notification;
  
  const statusColor = eventType === 'resolved' 
    ? '#22c55e' 
    : incident.severity === 'critical' 
    ? '#ef4444' 
    : incident.severity === 'major' 
    ? '#f97316' 
    : '#eab308';
  
  const eventLabel = eventType === 'resolved' 
    ? '✅ Incident Resolved' 
    : eventType === 'new' 
    ? '🚨 New Incident Detected' 
    : '⚠️ Incident Update';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 24px; }
    .vendor { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 8px; }
    .incident-title { font-size: 16px; color: #666; margin-bottom: 16px; }
    .details { background: #f9f9f9; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; margin-bottom: 8px; }
    .detail-label { font-weight: 600; width: 100px; color: #666; }
    .detail-value { color: #333; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: ${statusColor}; color: white; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .button { display: inline-block; background: #0066cc; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #f9f9f9; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${eventLabel}</h1>
    </div>
    <div class="content">
      <div class="vendor">${vendor.name}</div>
      <div class="incident-title">${incident.title}</div>
      
      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value"><span class="status-badge">${incident.status}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Severity:</span>
          <span class="detail-value">${incident.severity}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Impact:</span>
          <span class="detail-value">${incident.impact || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Started:</span>
          <span class="detail-value">${formatDateInTimezone(incident.startedAt, timezone)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Updated:</span>
          <span class="detail-value">${formatDateInTimezone(incident.updatedAt, timezone)}</span>
        </div>
      </div>
      
      <a href="${incident.url}" class="button">View Incident Details</a>
    </div>
    <div class="footer">
      <p>You received this alert because you subscribed to Vendor Watch notifications.</p>
      <p>To manage your notification preferences, visit your <a href="#">Settings</a>.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function dispatchIncidentNotification(notification: IncidentNotification): Promise<{ sms: number; email: number; errors: string[] }> {
  const { incident, vendor, eventType } = notification;
  const errors: string[] = [];
  let smsSent = 0;
  let emailSent = 0;
  
  const subscribedUsers = await storage.getUsersSubscribedToVendor(vendor.key);
  const eligibleUsers = subscribedUsers.filter(u => u.notifyEmail || u.notifySms);
  
  const assignedUserIds = await getAssignedUserIds('vendor', vendor.key);
  if (assignedUserIds) {
    console.log(`[notify] Alert assignments found for vendor ${vendor.key}: ${assignedUserIds.length} assigned users`);
  }
  
  console.log(`[notify] ${vendor.key}: ${subscribedUsers.length} subscribed, ${eligibleUsers.length} with notifications enabled`);
  
  for (const user of eligibleUsers) {
    if (assignedUserIds && !assignedUserIds.includes(user.id)) {
      continue;
    }
    
    const subPrefs = await storage.getUserVendorSubscriptionPreferences(user.id, vendor.key);
    if (subPrefs) {
      if (eventType === 'new' && !subPrefs.alertOnNew) {
        console.log(`[notify] Skipping ${user.email} - alertOnNew disabled for ${vendor.key}`);
        continue;
      }
      if (eventType === 'update' && !subPrefs.alertOnUpdate) {
        console.log(`[notify] Skipping ${user.email} - alertOnUpdate disabled for ${vendor.key}`);
        continue;
      }
      if (eventType === 'resolved' && !subPrefs.alertOnResolved) {
        console.log(`[notify] Skipping ${user.email} - alertOnResolved disabled for ${vendor.key}`);
        continue;
      }
      if (subPrefs.componentFilters && subPrefs.componentFilters.length > 0) {
        const affectedText = incident.title + ' ' + (incident.impact || '');
        const hasOverlap = subPrefs.componentFilters.some((f: string) => 
          affectedText.toLowerCase().includes(f.toLowerCase())
        );
        if (!hasOverlap) {
          console.log(`[notify] Skipping ${user.email} - incident doesn't match component filters for ${vendor.key}`);
          continue;
        }
      }
    }

    // Check if user has acknowledged this incident - skip notifications if so
    const isAcknowledged = await storage.isIncidentAcknowledged(user.id, incident.id);
    if (isAcknowledged) {
      console.log(`[notify] Skipping notification for ${user.email} - incident ${incident.id} is acknowledged`);
      continue;
    }
    
    if (user.notifySms && user.phone) {
      const reserved = await storage.tryReserveAlert({
        incidentId: incident.incidentId,
        userId: user.id,
        channel: 'sms',
        eventType,
        statusSnapshot: incident.status,
        destination: user.phone,
      });
      
      if (reserved) {
        try {
          const message = formatSmsMessage(notification);
          const success = await sendSMS(user.phone, message);
          if (success) {
            smsSent++;
            console.log(`[notify] SMS sent to ${user.phone} for ${eventType} incident`);
          } else {
            errors.push(`Failed to send SMS to ${user.phone}`);
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Unknown';
          errors.push(`SMS error for ${user.phone}: ${errMsg}`);
        }
      } else {
        console.log(`[notify] SMS already sent to ${user.phone} for incident ${incident.incidentId} (dedup)`);
      }
    }
    
    const targetEmail = user.notificationEmail || user.email;
    if (user.notifyEmail && targetEmail) {
      const reserved = await storage.tryReserveAlert({
        incidentId: incident.incidentId,
        userId: user.id,
        channel: 'email',
        eventType,
        statusSnapshot: incident.status,
        destination: targetEmail,
      });
      
      if (reserved) {
        try {
          const subject = formatEmailSubject(notification);
          const html = formatEmailHtml(notification, user.timezone || 'UTC');
          const success = await sendEmail(targetEmail, subject, html);
          if (success) {
            emailSent++;
            console.log(`[notify] Email sent to ${targetEmail} for ${eventType} incident`);
          } else {
            console.log(`[notify] Email failed/skipped for ${targetEmail}`);
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Unknown';
          errors.push(`Email error for ${targetEmail}: ${errMsg}`);
        }
      } else {
        console.log(`[notify] Email already sent to ${targetEmail} for incident ${incident.incidentId} (dedup)`);
      }
    }
  }
  
  return { sms: smsSent, email: emailSent, errors };
}

export async function notifyNewIncident(incident: Incident, vendor: Vendor): Promise<void> {
  console.log(`[notify] Dispatching NEW incident notification: ${incident.title}`);
  const result = await dispatchIncidentNotification({ incident, vendor, eventType: 'new' });
  console.log(`[notify] Sent ${result.sms} SMS, ${result.email} emails for new incident`);
  if (result.errors.length > 0) {
    console.warn('[notify] Errors:', result.errors);
  }
  
  const slackTeamsResult = await dispatchSlackTeamsForAllSubscribedUsers(incident, vendor, 'new');
  if (slackTeamsResult.slack > 0 || slackTeamsResult.teams > 0) {
    console.log(`[notify] Sent ${slackTeamsResult.slack} Slack, ${slackTeamsResult.teams} Teams notifications for new incident`);
  }

  dispatchDiscordForAllSubscribedUsers(incident, vendor, 'new').catch(err =>
    console.error('[notify] Discord dispatch error for new incident:', err));

  dispatchPagerDutyForAllSubscribedUsers(incident, vendor, 'new').catch(err =>
    console.error('[notify] PagerDuty dispatch error for new incident:', err));

  dispatchWebhooksForIncident(incident, vendor, 'new').catch(err =>
    console.error('[notify] Webhook dispatch error for new incident:', err));
}

export async function notifyIncidentUpdate(incident: Incident, vendor: Vendor, previousStatus: string): Promise<void> {
  console.log(`[notify] Dispatching UPDATE notification: ${incident.title} (${previousStatus} -> ${incident.status})`);
  const result = await dispatchIncidentNotification({ incident, vendor, eventType: 'update', previousStatus });
  console.log(`[notify] Sent ${result.sms} SMS, ${result.email} emails for incident update`);
  if (result.errors.length > 0) {
    console.warn('[notify] Errors:', result.errors);
  }
  
  const slackTeamsResult = await dispatchSlackTeamsForAllSubscribedUsers(incident, vendor, 'update');
  if (slackTeamsResult.slack > 0 || slackTeamsResult.teams > 0) {
    console.log(`[notify] Sent ${slackTeamsResult.slack} Slack, ${slackTeamsResult.teams} Teams notifications for incident update`);
  }

  dispatchDiscordForAllSubscribedUsers(incident, vendor, 'update').catch(err =>
    console.error('[notify] Discord dispatch error for incident update:', err));

  dispatchPagerDutyForAllSubscribedUsers(incident, vendor, 'update').catch(err =>
    console.error('[notify] PagerDuty dispatch error for incident update:', err));

  dispatchWebhooksForIncident(incident, vendor, 'update').catch(err =>
    console.error('[notify] Webhook dispatch error for incident update:', err));
}

export async function notifyIncidentResolved(incident: Incident, vendor: Vendor): Promise<void> {
  console.log(`[notify] Dispatching RESOLVED notification: ${incident.title}`);
  const result = await dispatchIncidentNotification({ incident, vendor, eventType: 'resolved' });
  console.log(`[notify] Sent ${result.sms} SMS, ${result.email} emails for resolved incident`);
  if (result.errors.length > 0) {
    console.warn('[notify] Errors:', result.errors);
  }
  
  const slackTeamsResult = await dispatchSlackTeamsForAllSubscribedUsers(incident, vendor, 'resolved');
  if (slackTeamsResult.slack > 0 || slackTeamsResult.teams > 0) {
    console.log(`[notify] Sent ${slackTeamsResult.slack} Slack, ${slackTeamsResult.teams} Teams notifications for resolved incident`);
  }

  dispatchDiscordForAllSubscribedUsers(incident, vendor, 'resolved').catch(err =>
    console.error('[notify] Discord dispatch error for resolved incident:', err));

  dispatchPagerDutyForAllSubscribedUsers(incident, vendor, 'resolved').catch(err =>
    console.error('[notify] PagerDuty dispatch error for resolved incident:', err));

  dispatchWebhooksForIncident(incident, vendor, 'resolved').catch(err =>
    console.error('[notify] Webhook dispatch error for resolved incident:', err));
}

function formatLifecycleSms(notification: LifecycleNotification): string {
  const { incident, vendor, lifecycleEvent, affectedServices } = notification;
  
  const eventEmojis: Record<LifecycleEvent, string> = {
    'new': '🚨',
    'escalation': '⬆️',
    'update': '📝',
    'resolved': '✅',
    'long_running': '⏰',
  };
  
  const eventLabels: Record<LifecycleEvent, string> = {
    'new': 'NEW INCIDENT',
    'escalation': 'ESCALATED',
    'update': 'UPDATE',
    'resolved': 'RESOLVED',
    'long_running': 'LONG RUNNING',
  };
  
  const emoji = eventEmojis[lifecycleEvent] || '⚠️';
  const label = eventLabels[lifecycleEvent] || 'UPDATE';
  const severity = formatSeverityDisplay(incident.severity as CanonicalSeverity);
  const status = formatStatusDisplay(incident.status as CanonicalStatus);
  
  let msg = `${emoji} ${label}: ${vendor.name} - ${incident.title}. Severity: ${severity}. Status: ${status}.`;
  if (affectedServices) {
    msg += ` Affected: ${affectedServices}.`;
  }
  msg += ` ${incident.url}`;
  
  return msg;
}

function formatLifecycleEmailSubject(notification: LifecycleNotification): string {
  const { incident, vendor, lifecycleEvent } = notification;
  
  const prefixes: Record<LifecycleEvent, string> = {
    'new': '🚨 [NEW INCIDENT]',
    'escalation': '⬆️ [ESCALATED]',
    'update': '📝 [UPDATE]',
    'resolved': '✅ [RESOLVED]',
    'long_running': '⏰ [LONG RUNNING]',
  };
  
  const prefix = prefixes[lifecycleEvent] || '[UPDATE]';
  const severity = formatSeverityDisplay(incident.severity as CanonicalSeverity);
  
  return `${prefix} ${severity} - ${vendor.name}: ${incident.title}`;
}

function formatLifecycleEmailHtml(notification: LifecycleNotification, timezone: string = 'UTC'): string {
  const { incident, vendor, lifecycleEvent, previousStatus, previousSeverity, affectedServices } = notification;
  
  const severity = incident.severity as CanonicalSeverity;
  const status = incident.status as CanonicalStatus;
  
  const severityColors: Record<CanonicalSeverity, string> = {
    'critical': '#ef4444',
    'major': '#f97316',
    'minor': '#eab308',
    'info': '#3b82f6',
  };
  
  const statusColor = lifecycleEvent === 'resolved' ? '#22c55e' : severityColors[severity] || '#eab308';
  
  const eventTitles: Record<LifecycleEvent, string> = {
    'new': '🚨 New Incident Detected',
    'escalation': '⬆️ Incident Escalated',
    'update': '📝 Incident Update',
    'resolved': '✅ Incident Resolved',
    'long_running': '⏰ Long Running Incident',
  };
  
  const eventTitle = eventTitles[lifecycleEvent] || 'Incident Update';
  
  let changeInfo = '';
  if (previousStatus && previousStatus !== incident.status) {
    changeInfo += `<div class="detail-row"><span class="detail-label">Status Change:</span><span class="detail-value">${formatStatusDisplay(previousStatus as CanonicalStatus)} → ${formatStatusDisplay(status)}</span></div>`;
  }
  if (previousSeverity && previousSeverity !== incident.severity) {
    changeInfo += `<div class="detail-row"><span class="detail-label">Severity Change:</span><span class="detail-value">${formatSeverityDisplay(previousSeverity as CanonicalSeverity)} → ${formatSeverityDisplay(severity)}</span></div>`;
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 24px; }
    .vendor { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 8px; }
    .incident-title { font-size: 16px; color: #666; margin-bottom: 16px; }
    .details { background: #f9f9f9; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; margin-bottom: 8px; }
    .detail-label { font-weight: 600; width: 120px; color: #666; }
    .detail-value { color: #333; }
    .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: ${statusColor}; color: white; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: #e5e7eb; color: #374151; font-size: 12px; font-weight: 600; }
    .button { display: inline-block; background: #0066cc; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #f9f9f9; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #666; }
    .affected-services { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin: 16px 0; }
    .affected-services h4 { margin: 0 0 8px 0; color: #92400e; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${eventTitle}</h1>
    </div>
    <div class="content">
      <div class="vendor">${vendor.name}</div>
      <div class="incident-title">${incident.title}</div>
      
      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Severity:</span>
          <span class="detail-value"><span class="severity-badge">${formatSeverityDisplay(severity)}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value"><span class="status-badge">${formatStatusDisplay(status)}</span></span>
        </div>
        ${changeInfo}
        <div class="detail-row">
          <span class="detail-label">Started:</span>
          <span class="detail-value">${formatDateInTimezone(incident.startedAt, timezone)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Last Updated:</span>
          <span class="detail-value">${formatDateInTimezone(incident.updatedAt, timezone)}</span>
        </div>
      </div>
      
      ${affectedServices ? `
      <div class="affected-services">
        <h4>Affected Services</h4>
        <p style="margin: 0; color: #92400e;">${affectedServices}</p>
      </div>
      ` : ''}
      
      <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin: 0 0 12px 0; color: #15803d; font-size: 14px; display: flex; align-items: center;">
          <span style="margin-right: 8px;">📋</span> Customer-Ready Summary
          <span style="margin-left: auto; font-size: 11px; font-weight: normal; color: #16a34a;">(Safe to copy & paste)</span>
        </h4>
        <div style="background: white; border-radius: 6px; padding: 14px; font-size: 14px; line-height: 1.6; color: #374151; border: 1px solid #dcfce7;">
          ${generateCustomerSummary({ incident, vendor, lifecycleEvent, affectedServices })}
        </div>
      </div>
      
      <a href="${incident.url}" class="button">View Incident Details</a>
    </div>
    <div class="footer">
      <p>You received this alert because you subscribed to Vendor Watch notifications.</p>
      <p>To manage your notification preferences, visit your <a href="#">Settings</a>.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function dispatchLifecycleNotification(notification: LifecycleNotification): Promise<{ sms: number; email: number; errors: string[] }> {
  const { incident, vendor, lifecycleEvent } = notification;
  const errors: string[] = [];
  let smsSent = 0;
  let emailSent = 0;
  
  console.log(`[notify] Dispatching ${lifecycleEvent.toUpperCase()} notification: ${vendor.name} - ${incident.title}`);
  
  const subscribedUsers = await storage.getUsersSubscribedToVendor(vendor.key);
  const eligibleUsers = subscribedUsers.filter(u => u.notifyEmail || u.notifySms);
  
  const assignedUserIds = await getAssignedUserIds('vendor', vendor.key);
  if (assignedUserIds) {
    console.log(`[notify] Alert assignments found for lifecycle vendor ${vendor.key}: ${assignedUserIds.length} assigned users`);
  }
  
  console.log(`[notify] ${vendor.key}: ${subscribedUsers.length} subscribed, ${eligibleUsers.length} with notifications enabled`);
  
  for (const user of eligibleUsers) {
    if (assignedUserIds && !assignedUserIds.includes(user.id)) {
      continue;
    }

    const subPrefs = await storage.getUserVendorSubscriptionPreferences(user.id, vendor.key);
    if (subPrefs) {
      const lcEvent = lifecycleEvent;
      if (lcEvent === 'new' && !subPrefs.alertOnNew) {
        console.log(`[notify] Skipping ${user.email} - alertOnNew disabled for ${vendor.key}`);
        continue;
      }
      if ((lcEvent === 'update' || lcEvent === 'escalation' || lcEvent === 'long_running') && !subPrefs.alertOnUpdate) {
        console.log(`[notify] Skipping ${user.email} - alertOnUpdate disabled for ${vendor.key}`);
        continue;
      }
      if (lcEvent === 'resolved' && !subPrefs.alertOnResolved) {
        console.log(`[notify] Skipping ${user.email} - alertOnResolved disabled for ${vendor.key}`);
        continue;
      }
      if (subPrefs.componentFilters && subPrefs.componentFilters.length > 0 && notification.affectedServices) {
        const affectedList = notification.affectedServices.split(',').map((c: string) => c.trim().toLowerCase());
        const hasOverlap = subPrefs.componentFilters.some((f: string) => 
          affectedList.some((a: string) => a.includes(f.toLowerCase()) || f.toLowerCase().includes(a))
        );
        if (!hasOverlap) {
          console.log(`[notify] Skipping ${user.email} - lifecycle components don't match filters for ${vendor.key}`);
          continue;
        }
      }
    }

    const canSend = await shouldSendAlert(
      incident.incidentId,
      user.id,
      incident.severity as CanonicalSeverity,
      incident.status as CanonicalStatus
    );
    
    if (!canSend && lifecycleEvent === 'update') {
      continue;
    }
    
    if (user.notifySms && user.phone) {
      const reserved = await storage.tryReserveAlert({
        incidentId: incident.incidentId,
        userId: user.id,
        channel: 'sms',
        eventType: lifecycleEvent,
        statusSnapshot: incident.status,
        destination: user.phone,
      });
      
      if (reserved) {
        try {
          const message = formatLifecycleSms(notification);
          const success = await sendSMS(user.phone, message);
          if (success) {
            await recordAlertSent(
              incident.incidentId,
              user.id,
              incident.severity as CanonicalSeverity,
              incident.status as CanonicalStatus
            );
            smsSent++;
            console.log(`[notify] SMS sent to ${user.phone} for ${lifecycleEvent}`);
          } else {
            errors.push(`Failed to send SMS to ${user.phone}`);
          }
        } catch (error: unknown) {
          errors.push(`SMS error for ${user.phone}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else {
        console.log(`[notify] SMS already sent to ${user.phone} for incident ${incident.incidentId} (dedup)`);
      }
    }
    
    const targetEmail = user.notificationEmail || user.email;
    if (user.notifyEmail && targetEmail) {
      const reserved = await storage.tryReserveAlert({
        incidentId: incident.incidentId,
        userId: user.id,
        channel: 'email',
        eventType: lifecycleEvent,
        statusSnapshot: incident.status,
        destination: targetEmail,
      });
      
      if (reserved) {
        try {
          const subject = formatLifecycleEmailSubject(notification);
          const html = formatLifecycleEmailHtml(notification, user.timezone || 'UTC');
          const success = await sendEmail(targetEmail, subject, html);
          if (success) {
            await recordAlertSent(
              incident.incidentId,
              user.id,
              incident.severity as CanonicalSeverity,
              incident.status as CanonicalStatus
            );
            emailSent++;
            console.log(`[notify] Email sent to ${targetEmail} for ${lifecycleEvent}`);
          } else {
            console.log(`[notify] Email skipped (not configured) for ${targetEmail}`);
          }
        } catch (error: unknown) {
          errors.push(`Email error for ${targetEmail}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else {
        console.log(`[notify] Email already sent to ${targetEmail} for incident ${incident.incidentId} (dedup)`);
      }
    }
  }
  
  console.log(`[notify] Sent ${smsSent} SMS, ${emailSent} emails for ${lifecycleEvent}`);
  if (errors.length > 0) {
    console.warn('[notify] Errors:', errors);
  }
  
  return { sms: smsSent, email: emailSent, errors };
}

export async function sendParserHealthAlert(vendorKey: string, consecutiveFailures: number, lastError?: string): Promise<void> {
  console.log(`[notify] Sending parser health alert for ${vendorKey}: ${consecutiveFailures} consecutive failures`);
  
  const subject = `[PARSER ALERT] ${vendorKey} parser failing`;
  const message = `Parser health alert: ${vendorKey} has failed ${consecutiveFailures} consecutive times. Last error: ${lastError || 'Unknown'}. Manual investigation required.`;
  
  const owner = await storage.getOwnerUser();
  const timezone = owner?.timezone || 'UTC';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 24px; }
    .alert-box { background: #fef2f2; border: 1px solid #dc2626; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; margin-bottom: 8px; }
    .detail-label { font-weight: 600; width: 140px; color: #666; }
    .detail-value { color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Parser Health Alert</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <p style="margin: 0; color: #991b1b;"><strong>${vendorKey}</strong> parser is experiencing failures and requires investigation.</p>
      </div>
      <div style="margin-top: 16px;">
        <div class="detail-row">
          <span class="detail-label">Vendor Key:</span>
          <span class="detail-value">${vendorKey}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Consecutive Failures:</span>
          <span class="detail-value">${consecutiveFailures}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Last Error:</span>
          <span class="detail-value">${lastError || 'Unknown'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Alert Time:</span>
          <span class="detail-value">${formatDateInTimezone(new Date(), timezone)}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  
  if (!owner) {
    console.log('[notify] No owner configured - parser health alert not sent');
    return;
  }
  
  if (owner.notifyEmail && owner.email) {
    try {
      await sendEmail(owner.email, subject, html);
      console.log(`[notify] Parser health alert sent to owner: ${owner.email}`);
    } catch (error: unknown) {
      console.error(`[notify] Failed to send parser health alert to owner:`, error instanceof Error ? error.message : 'Unknown');
    }
  }
  
  if (owner.notifySms && owner.phone) {
    try {
      await sendSMS(owner.phone, message);
      console.log(`[notify] Parser health SMS sent to owner: ${owner.phone}`);
    } catch (error: unknown) {
      console.error(`[notify] Failed to send parser health SMS to owner:`, error instanceof Error ? error.message : 'Unknown');
    }
  }
}

// Blockchain Incident Notifications
interface BlockchainNotification {
  incident: BlockchainIncident;
  chain: BlockchainChain;
  eventType: EventType;
  previousStatus?: string;
}

function formatBlockchainSms(notification: BlockchainNotification): string {
  const { incident, chain, eventType } = notification;
  
  const statusEmoji = eventType === 'resolved' ? '✅' : eventType === 'new' ? '🚨' : '⚠️';
  const eventLabel = eventType === 'resolved' ? 'RESOLVED' : eventType === 'new' ? 'NEW INCIDENT' : 'UPDATE';
  const title = sanitizeText(incident.title);
  
  return `${statusEmoji} Blockchain ${eventLabel}: ${chain.name} - ${title}. Type: ${incident.incidentType}. Status: ${incident.status}. ${incident.url || ''}`;
}

function formatBlockchainEmailSubject(notification: BlockchainNotification): string {
  const { incident, chain, eventType } = notification;
  
  const prefix = eventType === 'resolved' 
    ? '✅ [RESOLVED]' 
    : eventType === 'new' 
    ? '🚨 [NEW INCIDENT]' 
    : '⚠️ [UPDATE]';
  
  return sanitizeSubject(`${prefix} Blockchain: ${chain.name} - ${incident.title}`);
}

function formatBlockchainEmailHtml(notification: BlockchainNotification, timezone: string = 'UTC'): string {
  const { incident, chain, eventType } = notification;
  
  const statusColor = eventType === 'resolved' 
    ? '#22c55e' 
    : incident.severity === 'critical' 
    ? '#ef4444' 
    : incident.severity === 'major' 
    ? '#f97316' 
    : '#eab308';
  
  const eventLabel = eventType === 'resolved' 
    ? '✅ Incident Resolved' 
    : eventType === 'new' 
    ? '🚨 New Blockchain Incident' 
    : '⚠️ Incident Update';
  
  const tierLabel = chain.tier === '1' ? 'Tier 1 (Core)' : chain.tier === '2' ? 'Tier 2 (Infrastructure)' : chain.tier === '3' ? 'Tier 3 (Enterprise)' : 'Tier 4 (Dependencies)';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 24px; }
    .chain-name { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 8px; }
    .incident-title { font-size: 16px; color: #666; margin-bottom: 16px; }
    .details { background: #f9f9f9; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; margin-bottom: 8px; }
    .detail-label { font-weight: 600; width: 120px; color: #666; }
    .detail-value { color: #333; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: ${statusColor}; color: white; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .tier-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: #6366f1; color: white; font-size: 12px; font-weight: 600; }
    .button { display: inline-block; background: #0066cc; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px; }
    .footer { padding: 16px 24px; background: #f9f9f9; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${eventLabel}</h1>
    </div>
    <div class="content">
      <div class="chain-name">${chain.name}</div>
      <div class="incident-title">${incident.title}</div>
      
      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value"><span class="status-badge">${incident.status}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Severity:</span>
          <span class="detail-value">${incident.severity}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Type:</span>
          <span class="detail-value">${incident.incidentType}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Tier:</span>
          <span class="detail-value"><span class="tier-badge">${tierLabel}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Category:</span>
          <span class="detail-value">${chain.category}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Started:</span>
          <span class="detail-value">${formatDateInTimezone(incident.startedAt, timezone)}</span>
        </div>
      </div>
      
      ${incident.url ? `<a href="${incident.url}" class="button">View Incident Details</a>` : ''}
    </div>
    <div class="footer">
      <p>You received this alert because you subscribed to Vendor Watch blockchain notifications.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function dispatchBlockchainNotification(notification: BlockchainNotification): Promise<{ sms: number; email: number; errors: string[] }> {
  const { incident, chain, eventType } = notification;
  const errors: string[] = [];
  let smsSent = 0;
  let emailSent = 0;
  
  console.log(`[notify] Dispatching blockchain ${eventType.toUpperCase()} notification: ${chain.name} - ${incident.title}`);
  
  const subscribedUsers = await storage.getUsersSubscribedToBlockchain(chain.key);
  const eligibleUsers = subscribedUsers.filter(u => u.notifyEmail || u.notifySms);
  
  const assignedUserIds = await getAssignedUserIds('blockchain', chain.key);
  if (assignedUserIds) {
    console.log(`[notify] Alert assignments found for blockchain ${chain.key}: ${assignedUserIds.length} assigned users`);
  }
  
  console.log(`[notify] ${chain.key}: ${subscribedUsers.length} subscribed, ${eligibleUsers.length} with notifications enabled`);
  
  for (const user of eligibleUsers) {
    if (assignedUserIds && !assignedUserIds.includes(user.id)) {
      continue;
    }
    
    // Check if user has acknowledged this blockchain incident - skip notifications if so
    const isAcknowledged = await storage.isIncidentAcknowledged(user.id, incident.id);
    if (isAcknowledged) {
      console.log(`[notify] Skipping blockchain notification for ${user.email} - incident ${incident.id} is acknowledged`);
      continue;
    }
    
    if (user.notifySms && user.phone) {
      // Use atomic reserve to prevent race condition duplicates
      const reserved = await storage.tryReserveBlockchainAlert({
        incidentId: incident.incidentId,
        userId: user.id,
        channel: 'sms',
        eventType,
        statusSnapshot: incident.status,
        destination: user.phone,
      });
      
      if (reserved) {
        try {
          const message = formatBlockchainSms(notification);
          const success = await sendSMS(user.phone, message);
          if (success) {
            smsSent++;
            console.log(`[notify] Blockchain SMS sent to ${user.phone} for ${eventType}`);
          } else {
            errors.push(`Failed to send blockchain SMS to ${user.phone}`);
          }
        } catch (error) {
          errors.push(`Blockchain SMS error for ${user.phone}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else {
        console.log(`[notify] Blockchain SMS already sent to ${user.phone} for incident ${incident.incidentId} (dedup)`);
      }
    }
    
    const targetEmail = user.notificationEmail || user.email;
    if (user.notifyEmail && targetEmail) {
      // Use atomic reserve to prevent race condition duplicates
      const reserved = await storage.tryReserveBlockchainAlert({
        incidentId: incident.incidentId,
        userId: user.id,
        channel: 'email',
        eventType,
        statusSnapshot: incident.status,
        destination: targetEmail,
      });
      
      if (reserved) {
        try {
          const subject = formatBlockchainEmailSubject(notification);
          const html = formatBlockchainEmailHtml(notification, user.timezone || 'UTC');
          const success = await sendEmail(targetEmail, subject, html);
          if (success) {
            emailSent++;
            console.log(`[notify] Blockchain email sent to ${targetEmail} for ${eventType}`);
          } else {
            console.log(`[notify] Blockchain email skipped (not configured) for ${targetEmail}`);
          }
        } catch (error) {
          errors.push(`Blockchain email error for ${targetEmail}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      } else {
        console.log(`[notify] Blockchain email already sent to ${targetEmail} for incident ${incident.incidentId} (dedup)`);
      }
    }
  }
  
  console.log(`[notify] Sent ${smsSent} SMS, ${emailSent} emails for blockchain ${eventType}`);
  if (errors.length > 0) {
    console.warn('[notify] Blockchain notification errors:', errors);
  }
  
  return { sms: smsSent, email: emailSent, errors };
}

export async function notifyNewBlockchainIncident(incident: BlockchainIncident, chain: BlockchainChain): Promise<void> {
  await dispatchBlockchainNotification({ incident, chain, eventType: 'new' });
  dispatchDiscordForAllSubscribedUsers(incident, chain, 'new').catch(err =>
    console.error('[notify] Discord dispatch error for new blockchain incident:', err));
  dispatchPagerDutyForAllSubscribedUsers(incident, chain, 'new').catch(err =>
    console.error('[notify] PagerDuty dispatch error for new blockchain incident:', err));
  dispatchWebhooksForBlockchainIncident(incident, chain, 'new').catch(err =>
    console.error('[notify] Webhook dispatch error for new blockchain incident:', err));
}

export async function notifyBlockchainIncidentUpdate(incident: BlockchainIncident, chain: BlockchainChain, previousStatus: string): Promise<void> {
  await dispatchBlockchainNotification({ incident, chain, eventType: 'update', previousStatus });
  dispatchDiscordForAllSubscribedUsers(incident, chain, 'update').catch(err =>
    console.error('[notify] Discord dispatch error for blockchain incident update:', err));
  dispatchPagerDutyForAllSubscribedUsers(incident, chain, 'update').catch(err =>
    console.error('[notify] PagerDuty dispatch error for blockchain incident update:', err));
  dispatchWebhooksForBlockchainIncident(incident, chain, 'update').catch(err =>
    console.error('[notify] Webhook dispatch error for blockchain incident update:', err));
}

export async function notifyBlockchainIncidentResolved(incident: BlockchainIncident, chain: BlockchainChain): Promise<void> {
  await dispatchBlockchainNotification({ incident, chain, eventType: 'resolved' });
  dispatchDiscordForAllSubscribedUsers(incident, chain, 'resolved').catch(err =>
    console.error('[notify] Discord dispatch error for resolved blockchain incident:', err));
  dispatchPagerDutyForAllSubscribedUsers(incident, chain, 'resolved').catch(err =>
    console.error('[notify] PagerDuty dispatch error for resolved blockchain incident:', err));
  dispatchWebhooksForBlockchainIncident(incident, chain, 'resolved').catch(err =>
    console.error('[notify] Webhook dispatch error for resolved blockchain incident:', err));
}

interface ProbeAlertNotification {
  probe: SyntheticProbe;
  alertType: 'down' | 'degraded' | 'recovery';
  currentStatus: string;
  previousStatus: string;
  latencyMs: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  consecutiveFailures: number;
}

function formatProbeAlertSms(notification: ProbeAlertNotification): string {
  const { probe, alertType, currentStatus, latencyMs, errorMessage, consecutiveFailures } = notification;

  if (alertType === 'recovery') {
    return `✅ PROBE RECOVERED: "${probe.name}" (${probe.targetUrl}) is back to healthy.${latencyMs ? ` Latency: ${latencyMs}ms.` : ''}`;
  }

  const emoji = alertType === 'down' ? '🔴' : '🟡';
  const label = alertType === 'down' ? 'DOWN' : 'DEGRADED';
  let msg = `${emoji} PROBE ${label}: "${probe.name}" (${probe.targetUrl}) is ${currentStatus}. ${consecutiveFailures} consecutive failures.`;
  if (errorMessage) msg += ` Error: ${errorMessage}`;
  if (latencyMs) msg += ` Latency: ${latencyMs}ms.`;
  return msg;
}

function formatProbeAlertEmailSubject(notification: ProbeAlertNotification): string {
  const { probe, alertType } = notification;

  if (alertType === 'recovery') {
    return sanitizeSubject(`✅ [RECOVERED] Probe: ${probe.name} is back online`);
  }

  const prefix = alertType === 'down' ? '🔴 [DOWN]' : '🟡 [DEGRADED]';
  return sanitizeSubject(`${prefix} Probe: ${probe.name}`);
}

function formatProbeAlertEmailHtml(notification: ProbeAlertNotification, timezone: string = 'UTC'): string {
  const { probe, alertType, currentStatus, previousStatus, latencyMs, statusCode, errorMessage, consecutiveFailures } = notification;

  const statusColor = alertType === 'recovery' ? '#22c55e' : alertType === 'down' ? '#ef4444' : '#eab308';

  const eventTitle = alertType === 'recovery'
    ? '✅ Probe Recovered'
    : alertType === 'down'
    ? '🔴 Probe Down'
    : '🟡 Probe Degraded';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 24px; }
    .probe-name { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 8px; }
    .probe-url { font-size: 14px; color: #666; margin-bottom: 16px; word-break: break-all; }
    .details { background: #f9f9f9; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .detail-row { display: flex; margin-bottom: 8px; }
    .detail-label { font-weight: 600; width: 140px; color: #666; }
    .detail-value { color: #333; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: ${statusColor}; color: white; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .footer { padding: 16px 24px; background: #f9f9f9; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${eventTitle}</h1>
    </div>
    <div class="content">
      <div class="probe-name">${probe.name}</div>
      <div class="probe-url">${probe.targetUrl}</div>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Current Status:</span>
          <span class="detail-value"><span class="status-badge">${currentStatus}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Previous Status:</span>
          <span class="detail-value">${previousStatus}</span>
        </div>
        ${statusCode ? `<div class="detail-row">
          <span class="detail-label">HTTP Status:</span>
          <span class="detail-value">${statusCode}</span>
        </div>` : ''}
        ${latencyMs ? `<div class="detail-row">
          <span class="detail-label">Latency:</span>
          <span class="detail-value">${latencyMs}ms</span>
        </div>` : ''}
        ${errorMessage ? `<div class="detail-row">
          <span class="detail-label">Error:</span>
          <span class="detail-value">${errorMessage}</span>
        </div>` : ''}
        ${consecutiveFailures > 0 ? `<div class="detail-row">
          <span class="detail-label">Consecutive Failures:</span>
          <span class="detail-value">${consecutiveFailures}</span>
        </div>` : ''}
        <div class="detail-row">
          <span class="detail-label">Checked At:</span>
          <span class="detail-value">${formatDateInTimezone(new Date(), timezone)}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>You received this alert because you have synthetic monitoring configured in Vendor Watch.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function dispatchProbeAlert(notification: ProbeAlertNotification): Promise<void> {
  const { probe, alertType } = notification;
  const errors: string[] = [];
  let smsSent = 0;
  let emailSent = 0;

  console.log(`[probe-notify] Dispatching ${alertType.toUpperCase()} alert for probe "${probe.name}" (${probe.targetUrl})`);

  const probeOwner = await storage.getUser(probe.userId);
  if (!probeOwner) {
    console.log(`[probe-notify] Probe owner ${probe.userId} not found, skipping notification`);
    return;
  }

  const usersToNotify = [probeOwner];

  for (const user of usersToNotify) {
    if (user.notifySms && user.phone) {
      try {
        const message = formatProbeAlertSms(notification);
        const success = await sendSMS(user.phone, message);
        if (success) {
          smsSent++;
          console.log(`[probe-notify] SMS sent to ${user.phone} for probe ${alertType}`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown';
        errors.push(`SMS error for ${user.phone}: ${errMsg}`);
      }
    }

    const targetEmail = user.notificationEmail || user.email;
    if (user.notifyEmail && targetEmail) {
      try {
        const subject = formatProbeAlertEmailSubject(notification);
        const html = formatProbeAlertEmailHtml(notification, user.timezone || 'UTC');
        const success = await sendEmail(targetEmail, subject, html);
        if (success) {
          emailSent++;
          console.log(`[probe-notify] Email sent to ${targetEmail} for probe ${alertType}`);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown';
        errors.push(`Email error for ${targetEmail}: ${errMsg}`);
      }
    }
  }

  const dummyIncident = {
    id: `probe-${probe.id}`,
    incidentId: `probe-${probe.id}-${Date.now()}`,
    vendorKey: probe.vendorKey,
    title: `Probe ${alertType}: ${probe.name}`,
    status: alertType === 'recovery' ? 'resolved' : 'investigating',
    severity: alertType === 'down' ? 'major' : alertType === 'degraded' ? 'minor' : 'info',
    impact: alertType === 'recovery' ? 'none' : alertType === 'down' ? 'major' : 'minor',
    url: probe.targetUrl,
    startedAt: new Date(),
    updatedAt: new Date(),
    source: 'synthetic_monitor',
  } as any;

  const dummyVendor = {
    key: probe.vendorKey,
    name: probe.name,
    statusUrl: probe.targetUrl,
  } as any;

  const eventType: EventType = alertType === 'recovery' ? 'resolved' : 'new';

  try {
    const slackResult = await dispatchSlackTeamsForAllSubscribedUsers(dummyIncident, dummyVendor, eventType);
    if (slackResult.slack > 0 || slackResult.teams > 0) {
      console.log(`[probe-notify] Sent ${slackResult.slack} Slack, ${slackResult.teams} Teams for probe ${alertType}`);
    }
  } catch (err) {
    console.error('[probe-notify] Slack/Teams dispatch error:', err);
  }

  dispatchDiscordForAllSubscribedUsers(dummyIncident, dummyVendor, eventType).catch(err =>
    console.error('[probe-notify] Discord dispatch error:', err));

  dispatchPagerDutyForAllSubscribedUsers(dummyIncident, dummyVendor, eventType).catch(err =>
    console.error('[probe-notify] PagerDuty dispatch error:', err));

  console.log(`[probe-notify] Probe alert complete: ${smsSent} SMS, ${emailSent} emails sent`);
  if (errors.length > 0) {
    console.warn('[probe-notify] Errors:', errors);
  }
}
