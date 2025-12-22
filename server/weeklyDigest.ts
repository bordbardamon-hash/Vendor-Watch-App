import { db } from './db';
import { weeklyDigests, incidents, vendors, users } from '@shared/schema';
import { storage } from './storage';
import { sendEmail } from './emailClient';
import { eq, and, gte, lte } from 'drizzle-orm';

interface WeeklyDigestData {
  incidentCount: number;
  vendorsAffected: string[];
  longestIncidentMinutes: number | null;
  criticalIncidents: number;
  majorIncidents: number;
  resolvedIncidents: number;
}

function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getPreviousWeekDates(): { start: Date; end: Date; weekStartDate: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 7 : dayOfWeek;
  
  const end = new Date(now);
  end.setDate(now.getDate() - daysToSubtract);
  end.setHours(23, 59, 59, 999);
  
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  
  return {
    start,
    end,
    weekStartDate: start.toISOString().split('T')[0],
  };
}

async function getWeeklyDigestData(startDate: Date, endDate: Date): Promise<WeeklyDigestData> {
  const allIncidents = await db.select().from(incidents);
  
  const weekIncidents = allIncidents.filter(i => {
    const incidentDate = new Date(i.startedAt);
    return incidentDate >= startDate && incidentDate <= endDate;
  });
  
  const vendorsAffected = Array.from(new Set(weekIncidents.map(i => i.vendorKey)));
  
  let longestIncidentMinutes: number | null = null;
  let criticalCount = 0;
  let majorCount = 0;
  let resolvedCount = 0;
  
  for (const incident of weekIncidents) {
    const start = new Date(incident.startedAt).getTime();
    const end = new Date(incident.updatedAt).getTime();
    const durationMinutes = Math.round((end - start) / (1000 * 60));
    
    if (longestIncidentMinutes === null || durationMinutes > longestIncidentMinutes) {
      longestIncidentMinutes = durationMinutes;
    }
    
    if (incident.severity === 'critical') criticalCount++;
    if (incident.severity === 'major') majorCount++;
    if (incident.status === 'resolved') resolvedCount++;
  }
  
  return {
    incidentCount: weekIncidents.length,
    vendorsAffected,
    longestIncidentMinutes,
    criticalIncidents: criticalCount,
    majorIncidents: majorCount,
    resolvedIncidents: resolvedCount,
  };
}

function formatDigestEmail(data: WeeklyDigestData, weekStartDate: string): { subject: string; html: string } {
  const weekDate = new Date(weekStartDate);
  const weekEndDate = new Date(weekDate);
  weekEndDate.setDate(weekDate.getDate() + 6);
  
  const dateRange = `${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  
  if (data.incidentCount === 0) {
    return {
      subject: `Weekly Vendor Status Digest: All Clear (${dateRange})`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #22c55e; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 32px 24px; text-align: center; }
    .success-icon { font-size: 48px; margin-bottom: 16px; }
    .message { font-size: 18px; color: #374151; margin-bottom: 8px; }
    .submessage { font-size: 14px; color: #6b7280; }
    .footer { padding: 16px 24px; background: #f9f9f9; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Vendor Status Digest</h1>
    </div>
    <div class="content">
      <div class="success-icon">✅</div>
      <div class="message">No major vendor incidents this week.</div>
      <div class="submessage">${dateRange}</div>
      <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
        All monitored vendors operated normally. Your customers experienced uninterrupted service.
      </p>
    </div>
    <div class="footer">
      <p>Vendor Watch - Keeping you informed, even when nothing happens.</p>
    </div>
  </div>
</body>
</html>`
    };
  }
  
  const longestDisplay = data.longestIncidentMinutes 
    ? data.longestIncidentMinutes < 60 
      ? `${data.longestIncidentMinutes} min` 
      : `${Math.round(data.longestIncidentMinutes / 60)}h ${data.longestIncidentMinutes % 60}m`
    : 'N/A';
  
  return {
    subject: `Weekly Vendor Status Digest: ${data.incidentCount} Incident${data.incidentCount !== 1 ? 's' : ''} (${dateRange})`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: #3b82f6; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-box { background: #f9fafb; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-number { font-size: 28px; font-weight: bold; color: #374151; }
    .stat-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .stat-critical .stat-number { color: #ef4444; }
    .stat-major .stat-number { color: #f97316; }
    .vendors-list { background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .vendors-list h4 { margin: 0 0 8px 0; color: #92400e; font-size: 14px; }
    .vendors-list p { margin: 0; color: #78350f; }
    .footer { padding: 16px 24px; background: #f9f9f9; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Vendor Status Digest</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${dateRange}</p>
    </div>
    <div class="content">
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-number">${data.incidentCount}</div>
          <div class="stat-label">Total Incidents</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${data.vendorsAffected.length}</div>
          <div class="stat-label">Vendors Affected</div>
        </div>
        <div class="stat-box stat-critical">
          <div class="stat-number">${data.criticalIncidents}</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat-box stat-major">
          <div class="stat-number">${data.majorIncidents}</div>
          <div class="stat-label">Major</div>
        </div>
      </div>
      
      <div class="vendors-list">
        <h4>Vendors Affected</h4>
        <p>${data.vendorsAffected.join(', ') || 'None'}</p>
      </div>
      
      <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #0369a1; font-weight: 600;">Longest Incident</span>
          <span style="color: #0284c7; font-size: 18px; font-weight: bold;">${longestDisplay}</span>
        </div>
      </div>
      
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #15803d; font-weight: 600;">Resolved This Week</span>
          <span style="color: #16a34a; font-size: 18px; font-weight: bold;">${data.resolvedIncidents}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Vendor Watch - Weekly summary of vendor health.</p>
    </div>
  </div>
</body>
</html>`
  };
}

export async function sendWeeklyDigest(): Promise<{ sent: number; errors: string[] }> {
  const { start, end, weekStartDate } = getPreviousWeekDates();
  const data = await getWeeklyDigestData(start, end);
  const { subject, html } = formatDigestEmail(data, weekStartDate);
  
  const usersWithNotifications = await storage.getUsersWithNotificationsEnabled();
  let sent = 0;
  const errors: string[] = [];
  
  for (const user of usersWithNotifications) {
    if (!user.notifyEmail || !user.email) continue;
    
    const alreadySent = await db.select()
      .from(weeklyDigests)
      .where(and(
        eq(weeklyDigests.userId, user.id),
        eq(weeklyDigests.weekStartDate, weekStartDate)
      ))
      .limit(1);
    
    if (alreadySent.length > 0) continue;
    
    try {
      const success = await sendEmail(user.email, subject, html);
      if (success) {
        await db.insert(weeklyDigests).values({
          userId: user.id,
          weekStartDate,
          incidentCount: data.incidentCount,
          vendorsAffected: data.vendorsAffected.join(','),
          longestIncidentMinutes: data.longestIncidentMinutes,
        });
        sent++;
        console.log(`[digest] Weekly digest sent to ${user.email}`);
      }
    } catch (error) {
      const msg = `Failed to send digest to ${user.email}: ${error instanceof Error ? error.message : 'Unknown'}`;
      errors.push(msg);
      console.error(`[digest] ${msg}`);
    }
  }
  
  console.log(`[digest] Sent ${sent} weekly digests for week of ${weekStartDate}`);
  return { sent, errors };
}

export async function shouldSendWeeklyDigest(): Promise<boolean> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  
  return dayOfWeek === 1 && hour >= 8 && hour < 10;
}
