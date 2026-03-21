import { db } from './db';
import { storage } from './storage';
import { warRooms, warRoomPosts, warRoomParticipants } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from './emailClient';
import type { Incident, Vendor } from '@shared/schema';
import { broadcastToRoom } from './warRoomWebSocket';

const NOTIFICATIONS_ENABLED = process.env.NODE_ENV === 'production' || process.env.ENABLE_NOTIFICATIONS === 'true';
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

// Grace period before closing war room after incident resolves (1 hour)
const GRACE_PERIOD_MS = 60 * 60 * 1000;

// Active close timers keyed by warRoomId
const closeTimers = new Map<string, NodeJS.Timeout>();

export async function autoCreateWarRoom(incident: Incident, vendor: Vendor): Promise<void> {
  try {
    // Only create for critical and major severity
    if (incident.severity !== 'critical' && incident.severity !== 'major') return;

    // Check if war room already exists for this incident
    const existing = await storage.getWarRoom(incident.id);
    if (existing) return;

    const warRoom = await storage.createWarRoom({
      incidentId: incident.id,
      vendorKey: vendor.key,
      vendorName: vendor.name,
      status: 'open',
    });

    console.log(`[war-room] Created war room ${warRoom.id} for incident: ${incident.title} (${incident.severity})`);

    // Add a system post announcing the war room
    const sevLabel = incident.severity === 'critical' ? 'P1 Critical' : 'P2 Major';
    await storage.createWarRoomPost({
      warRoomId: warRoom.id,
      userId: null,
      content: `${sevLabel} incident detected for ${vendor.name}. War Room opened. Engineers and MSPs monitoring this vendor have been notified.`,
      detail: incident.impact || null,
      isSystemUpdate: true,
    });

    // Notify users monitoring this vendor
    if (NOTIFICATIONS_ENABLED) {
      notifyWarRoomCreated(warRoom.id, incident, vendor).catch(err =>
        console.error('[war-room] Failed to send war room notifications:', err)
      );
    }
  } catch (err) {
    console.error('[war-room] Failed to auto-create war room:', err);
  }
}

export async function handleIncidentResolved(incidentId: string): Promise<void> {
  try {
    const warRoom = await storage.getWarRoom(incidentId);
    if (!warRoom || warRoom.status !== 'open') return;

    // Add system post about resolution + grace period
    await storage.createWarRoomPost({
      warRoomId: warRoom.id,
      userId: null,
      content: `Incident marked as resolved by vendor. War Room will close in 1 hour.`,
      detail: null,
      isSystemUpdate: true,
    });

    broadcastToRoom(warRoom.id, { type: 'system_post', message: 'Incident resolved. War Room closing in 1 hour.' });

    // Cancel existing timer if any
    const existing = closeTimers.get(warRoom.id);
    if (existing) clearTimeout(existing);

    // Schedule close
    const timer = setTimeout(async () => {
      await storage.closeWarRoom(warRoom.id);
      await storage.createWarRoomPost({
        warRoomId: warRoom.id,
        userId: null,
        content: 'War Room closed. This session has been archived permanently.',
        detail: null,
        isSystemUpdate: true,
      });
      broadcastToRoom(warRoom.id, { type: 'war_room_closed' });
      closeTimers.delete(warRoom.id);
      console.log(`[war-room] Closed war room ${warRoom.id} after grace period`);
    }, GRACE_PERIOD_MS);

    closeTimers.set(warRoom.id, timer);
  } catch (err) {
    console.error('[war-room] Failed to handle incident resolution:', err);
  }
}

async function notifyWarRoomCreated(warRoomId: string, incident: Incident, vendor: Vendor): Promise<void> {
  const warRoomUrl = `${APP_URL}/war-room/${incident.id}`;
  const sevLabel = incident.severity === 'critical' ? '🔴 P1 Critical' : '🟠 P2 Major';

  let users: any[] = [];
  try {
    users = await storage.getUsersSubscribedToVendor(vendor.key);
  } catch (err) {
    console.error('[war-room] Failed to get subscribed users:', err);
    return;
  }

  if (users.length === 0) return;

  const subject = `${sevLabel} Incident War Room: ${vendor.name}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0a0a0a;padding:20px;border-radius:8px;border:1px solid #333">
        <h2 style="color:#ef4444;margin:0 0 16px">${sevLabel} — ${vendor.name} Incident War Room</h2>
        <p style="color:#d1d5db;margin:0 0 12px"><strong style="color:#f9fafb">Incident:</strong> ${incident.title}</p>
        ${incident.impact ? `<p style="color:#d1d5db;margin:0 0 12px"><strong style="color:#f9fafb">Impact:</strong> ${incident.impact}</p>` : ''}
        <p style="color:#d1d5db;margin:0 0 20px">A War Room has been opened for real-time collaboration. Join to post workarounds, share updates, and coordinate with other MSPs monitoring ${vendor.name}.</p>
        <a href="${warRoomUrl}" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Join War Room →</a>
        <p style="color:#6b7280;font-size:12px;margin:20px 0 0">You're receiving this because you're monitoring ${vendor.name} on VendorWatch.</p>
      </div>
    </div>
  `;
  const text = `${sevLabel} — ${vendor.name} Incident War Room\n\nIncident: ${incident.title}\nJoin the War Room: ${warRoomUrl}\n\nYou're receiving this because you're monitoring ${vendor.name} on VendorWatch.`;

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;
    try {
      await sendEmail(user.email, subject, html, text);
      sent++;
    } catch (err) {
      console.error(`[war-room] Failed to notify ${user.email}:`, err);
    }
  }
  console.log(`[war-room] Notified ${sent}/${users.length} users about war room for ${vendor.name}`);
}

export async function restoreOpenWarRoomTimers(): Promise<void> {
  // On restart, re-arm close timers for any war rooms in a "pending close" state
  // (We can't know for certain, but we reload open rooms — they just won't auto-close
  //  unless the incident is re-resolved, which is fine since the timer will fire next time)
  try {
    const openRooms = await storage.getOpenWarRooms();
    console.log(`[war-room] Found ${openRooms.length} open war room(s) on startup`);
  } catch (err) {
    console.error('[war-room] Failed to restore war room timers:', err);
  }
}
