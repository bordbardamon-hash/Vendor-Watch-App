import { storage } from './storage';
import { sendSMS } from './twilioClient';
import { sendEmail } from './emailClient';
import { shouldSendAlert, recordAlertSent } from './cooldownManager';
import { formatSeverityDisplay, formatStatusDisplay } from './statusNormalizer';
import type { Incident, Vendor, User, LifecycleEvent, CanonicalSeverity, CanonicalStatus } from '@shared/schema';

type EventType = 'new' | 'update' | 'resolved';

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

function formatSmsMessage(notification: IncidentNotification): string {
  const { incident, vendor, eventType } = notification;
  
  const statusEmoji = eventType === 'resolved' ? '✅' : eventType === 'new' ? '🚨' : '⚠️';
  const eventLabel = eventType === 'resolved' ? 'RESOLVED' : eventType === 'new' ? 'NEW INCIDENT' : 'UPDATE';
  
  return `${statusEmoji} Vendor Watch ${eventLabel}: ${vendor.name} - ${incident.title}. Status: ${incident.status}. More info: ${incident.url}`;
}

function formatEmailSubject(notification: IncidentNotification): string {
  const { incident, vendor, eventType } = notification;
  
  const prefix = eventType === 'resolved' 
    ? '[RESOLVED]' 
    : eventType === 'new' 
    ? '[NEW INCIDENT]' 
    : '[UPDATE]';
  
  return `${prefix} ${vendor.name}: ${incident.title}`;
}

function formatEmailHtml(notification: IncidentNotification): string {
  const { incident, vendor, eventType } = notification;
  
  const statusColor = eventType === 'resolved' 
    ? '#22c55e' 
    : incident.severity === 'critical' 
    ? '#ef4444' 
    : incident.severity === 'major' 
    ? '#f97316' 
    : '#eab308';
  
  const eventLabel = eventType === 'resolved' 
    ? 'Incident Resolved' 
    : eventType === 'new' 
    ? 'New Incident Detected' 
    : 'Incident Update';
  
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
          <span class="detail-value">${new Date(incident.startedAt).toLocaleString()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Updated:</span>
          <span class="detail-value">${new Date(incident.updatedAt).toLocaleString()}</span>
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
  
  const usersWithNotifications = await storage.getUsersWithNotificationsEnabled();
  
  for (const user of usersWithNotifications) {
    const hasSetSubscriptions = await storage.hasUserSetSubscriptions(user.id);
    const userSubscriptions = await storage.getUserVendorSubscriptions(user.id);
    
    let isSubscribed: boolean;
    if (!hasSetSubscriptions) {
      isSubscribed = true;
    } else if (userSubscriptions.length === 0) {
      isSubscribed = false;
    } else {
      isSubscribed = userSubscriptions.includes(vendor.key);
    }
    
    if (!isSubscribed) {
      continue;
    }
    if (user.notifySms && user.phone) {
      const alreadySent = await storage.hasAlertBeenSent(incident.incidentId, user.id, 'sms', eventType, incident.status);
      if (!alreadySent) {
        try {
          const message = formatSmsMessage(notification);
          const success = await sendSMS(user.phone, message);
          if (success) {
            await storage.recordAlert({
              incidentId: incident.incidentId,
              userId: user.id,
              channel: 'sms',
              eventType,
              statusSnapshot: incident.status,
              destination: user.phone,
            });
            smsSent++;
            console.log(`[notify] SMS sent to ${user.phone} for ${eventType} incident`);
          } else {
            errors.push(`Failed to send SMS to ${user.phone}`);
          }
        } catch (error) {
          errors.push(`SMS error for ${user.phone}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
    }
    
    if (user.notifyEmail && user.email) {
      const alreadySent = await storage.hasAlertBeenSent(incident.incidentId, user.id, 'email', eventType, incident.status);
      if (!alreadySent) {
        try {
          const subject = formatEmailSubject(notification);
          const html = formatEmailHtml(notification);
          const success = await sendEmail(user.email, subject, html);
          if (success) {
            await storage.recordAlert({
              incidentId: incident.incidentId,
              userId: user.id,
              channel: 'email',
              eventType,
              statusSnapshot: incident.status,
              destination: user.email,
            });
            emailSent++;
            console.log(`[notify] Email sent to ${user.email} for ${eventType} incident`);
          } else {
            console.log(`[notify] Email skipped (not configured) for ${user.email}`);
          }
        } catch (error) {
          errors.push(`Email error for ${user.email}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
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
}

export async function notifyIncidentUpdate(incident: Incident, vendor: Vendor, previousStatus: string): Promise<void> {
  console.log(`[notify] Dispatching UPDATE notification: ${incident.title} (${previousStatus} -> ${incident.status})`);
  const result = await dispatchIncidentNotification({ incident, vendor, eventType: 'update', previousStatus });
  console.log(`[notify] Sent ${result.sms} SMS, ${result.email} emails for incident update`);
  if (result.errors.length > 0) {
    console.warn('[notify] Errors:', result.errors);
  }
}

export async function notifyIncidentResolved(incident: Incident, vendor: Vendor): Promise<void> {
  console.log(`[notify] Dispatching RESOLVED notification: ${incident.title}`);
  const result = await dispatchIncidentNotification({ incident, vendor, eventType: 'resolved' });
  console.log(`[notify] Sent ${result.sms} SMS, ${result.email} emails for resolved incident`);
  if (result.errors.length > 0) {
    console.warn('[notify] Errors:', result.errors);
  }
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
    'new': '[NEW INCIDENT]',
    'escalation': '[ESCALATED]',
    'update': '[UPDATE]',
    'resolved': '[RESOLVED]',
    'long_running': '[LONG RUNNING]',
  };
  
  const prefix = prefixes[lifecycleEvent] || '[UPDATE]';
  const severity = formatSeverityDisplay(incident.severity as CanonicalSeverity);
  
  return `${prefix} ${severity} - ${vendor.name}: ${incident.title}`;
}

function formatLifecycleEmailHtml(notification: LifecycleNotification): string {
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
    'new': 'New Incident Detected',
    'escalation': 'Incident Escalated',
    'update': 'Incident Update',
    'resolved': 'Incident Resolved',
    'long_running': 'Long Running Incident',
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
          <span class="detail-value">${new Date(incident.startedAt).toLocaleString()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Last Updated:</span>
          <span class="detail-value">${new Date(incident.updatedAt).toLocaleString()}</span>
        </div>
      </div>
      
      ${affectedServices ? `
      <div class="affected-services">
        <h4>Affected Services</h4>
        <p style="margin: 0; color: #92400e;">${affectedServices}</p>
      </div>
      ` : ''}
      
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
  
  const usersWithNotifications = await storage.getUsersWithNotificationsEnabled();
  
  for (const user of usersWithNotifications) {
    const hasSetSubscriptions = await storage.hasUserSetSubscriptions(user.id);
    const userSubscriptions = await storage.getUserVendorSubscriptions(user.id);
    
    let isSubscribed: boolean;
    if (!hasSetSubscriptions) {
      isSubscribed = true;
    } else if (userSubscriptions.length === 0) {
      isSubscribed = false;
    } else {
      isSubscribed = userSubscriptions.includes(vendor.key);
    }
    
    if (!isSubscribed) continue;
    
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
      const alreadySent = await storage.hasAlertBeenSent(incident.incidentId, user.id, 'sms', lifecycleEvent, incident.status);
      if (!alreadySent) {
        try {
          const message = formatLifecycleSms(notification);
          const success = await sendSMS(user.phone, message);
          if (success) {
            await storage.recordAlert({
              incidentId: incident.incidentId,
              userId: user.id,
              channel: 'sms',
              eventType: lifecycleEvent,
              statusSnapshot: incident.status,
              destination: user.phone,
            });
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
      }
    }
    
    if (user.notifyEmail && user.email) {
      const alreadySent = await storage.hasAlertBeenSent(incident.incidentId, user.id, 'email', lifecycleEvent, incident.status);
      if (!alreadySent) {
        try {
          const subject = formatLifecycleEmailSubject(notification);
          const html = formatLifecycleEmailHtml(notification);
          const success = await sendEmail(user.email, subject, html);
          if (success) {
            await storage.recordAlert({
              incidentId: incident.incidentId,
              userId: user.id,
              channel: 'email',
              eventType: lifecycleEvent,
              statusSnapshot: incident.status,
              destination: user.email,
            });
            await recordAlertSent(
              incident.incidentId,
              user.id,
              incident.severity as CanonicalSeverity,
              incident.status as CanonicalStatus
            );
            emailSent++;
            console.log(`[notify] Email sent to ${user.email} for ${lifecycleEvent}`);
          } else {
            console.log(`[notify] Email skipped (not configured) for ${user.email}`);
          }
        } catch (error: unknown) {
          errors.push(`Email error for ${user.email}: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
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
          <span class="detail-value">${new Date().toLocaleString()}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  
  const usersWithNotifications = await storage.getUsersWithNotificationsEnabled();
  
  for (const user of usersWithNotifications) {
    if (user.notifyEmail && user.email) {
      try {
        await sendEmail(user.email, subject, html);
        console.log(`[notify] Parser health alert sent to ${user.email}`);
      } catch (error: unknown) {
        console.error(`[notify] Failed to send parser health alert to ${user.email}:`, error instanceof Error ? error.message : 'Unknown');
      }
    }
    
    if (user.notifySms && user.phone) {
      try {
        await sendSMS(user.phone, message);
        console.log(`[notify] Parser health SMS sent to ${user.phone}`);
      } catch (error: unknown) {
        console.error(`[notify] Failed to send parser health SMS to ${user.phone}:`, error instanceof Error ? error.message : 'Unknown');
      }
    }
  }
}
