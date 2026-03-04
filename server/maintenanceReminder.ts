import { storage } from './storage';
import { sendSMS } from './twilioClient';
import { sendEmail } from './emailClient';
import { db } from './db';
import { vendorMaintenances, blockchainMaintenances } from '@shared/schema';
import { and, eq, gte, lte, not } from 'drizzle-orm';

export async function checkAndSendMaintenanceReminders(): Promise<{ sent: number; errors: string[] }> {
  let sent = 0;
  const errors: string[] = [];
  const now = new Date();

  try {
    const upcomingMaintenances = await db
      .select()
      .from(vendorMaintenances)
      .where(
        and(
          eq(vendorMaintenances.status, 'scheduled'),
          not(eq(vendorMaintenances.status, 'completed'))
        )
      );

    for (const maintenance of upcomingMaintenances) {
      const scheduledStart = new Date(maintenance.scheduledStartAt);
      if (scheduledStart <= now) continue;

      const minutesUntilStart = (scheduledStart.getTime() - now.getTime()) / (1000 * 60);

      const subscribedUsers = await storage.getSubscriptionsWithMaintenanceReminders(maintenance.vendorKey);
      if (subscribedUsers.length === 0) continue;

      for (const sub of subscribedUsers) {
        const reminderMinutes = sub.maintenanceReminderMinutes || 60;

        if (minutesUntilStart > reminderMinutes || minutesUntilStart < 0) continue;

        const alreadySent = await storage.hasMaintenanceReminderBeenSent(sub.userId, maintenance.maintenanceId);
        if (alreadySent) continue;

        try {
          const user = await storage.getUser(sub.userId);
          if (!user) continue;

          const vendor = await storage.getVendor(maintenance.vendorKey);
          const vendorName = vendor?.name || maintenance.vendorKey;
          const timeStr = minutesUntilStart < 60
            ? `${Math.round(minutesUntilStart)} minutes`
            : `${Math.round(minutesUntilStart / 60)} hours`;

          const subject = `Maintenance Reminder: ${vendorName}`;
          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0f172a;">Scheduled Maintenance Reminder</h2>
              <p><strong>${vendorName}</strong> has scheduled maintenance starting in approximately <strong>${timeStr}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Title</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${maintenance.title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Scheduled Start</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${scheduledStart.toUTCString()}</td>
                </tr>
                ${maintenance.scheduledEndAt ? `<tr>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Scheduled End</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${new Date(maintenance.scheduledEndAt).toUTCString()}</td>
                </tr>` : ''}
                ${maintenance.affectedComponents ? `<tr>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Affected Components</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${maintenance.affectedComponents}</td>
                </tr>` : ''}
                ${maintenance.impact ? `<tr>
                  <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">Impact</td>
                  <td style="padding: 8px; border: 1px solid #e2e8f0;">${maintenance.impact}</td>
                </tr>` : ''}
              </table>
              ${maintenance.description ? `<p style="color: #6b7280;">${maintenance.description}</p>` : ''}
              ${maintenance.url ? `<p><a href="${maintenance.url}" style="color: #10b981;">View Details</a></p>` : ''}
            </div>`;

          const textBody = `Maintenance Reminder: ${vendorName} has scheduled maintenance starting in ${timeStr}. ${maintenance.title}. ${maintenance.url || ''}`;

          let reminderSent = false;
          const targetEmail = user.notificationEmail || user.email;
          if (user.notifyEmail && targetEmail) {
            const emailResult = await sendEmail(targetEmail, subject, htmlBody, textBody);
            if (emailResult) reminderSent = true;
          }

          if (user.notifySms && user.phone) {
            const smsMsg = `🔧 ${vendorName} maintenance in ${timeStr}: ${maintenance.title}`;
            const smsResult = await sendSMS(user.phone, smsMsg);
            if (smsResult) reminderSent = true;
          }

          if (reminderSent) {
            await storage.recordMaintenanceReminderSent(sub.userId, maintenance.maintenanceId, maintenance.vendorKey);
            sent++;
            console.log(`[reminder] Sent maintenance reminder to ${user.email} for ${vendorName}: ${maintenance.title}`);
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Reminder error for user ${sub.userId}: ${errMsg}`);
          console.error(`[reminder] Error sending maintenance reminder:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[reminder] Error in maintenance reminder check:', error);
    errors.push(`Global error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  if (sent > 0) {
    console.log(`[reminder] Sent ${sent} maintenance reminders`);
  }

  return { sent, errors };
}
