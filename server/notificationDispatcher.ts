import { storage } from './storage';
import { sendSMS } from './twilioClient';
import { sendEmail } from './emailClient';
import type { Incident, Vendor, User } from '@shared/schema';

type EventType = 'new' | 'update' | 'resolved';

interface IncidentNotification {
  incident: Incident;
  vendor: Vendor;
  eventType: EventType;
  previousStatus?: string;
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
