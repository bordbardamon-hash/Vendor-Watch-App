import { db } from './db';
import { alertCooldowns } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { CanonicalSeverity, CanonicalStatus } from '@shared/schema';

const DEFAULT_COOLDOWN_MINUTES = 30;
const ESCALATION_BYPASS_COOLDOWN = true;

interface CooldownConfig {
  cooldownMinutes?: number;
  bypassOnEscalation?: boolean;
}

export async function shouldSendAlert(
  incidentId: string,
  userId: string,
  currentSeverity: CanonicalSeverity,
  currentStatus: CanonicalStatus,
  config?: CooldownConfig
): Promise<boolean> {
  const { cooldownMinutes = DEFAULT_COOLDOWN_MINUTES, bypassOnEscalation = ESCALATION_BYPASS_COOLDOWN } = config || {};

  const existing = await db.select()
    .from(alertCooldowns)
    .where(and(
      eq(alertCooldowns.incidentId, incidentId),
      eq(alertCooldowns.userId, userId)
    ))
    .limit(1);

  if (existing.length === 0) {
    return true;
  }

  const record = existing[0];
  const minutesSinceLastAlert = (Date.now() - record.lastAlertAt.getTime()) / (1000 * 60);

  if (minutesSinceLastAlert >= cooldownMinutes) {
    return true;
  }

  if (bypassOnEscalation) {
    const severityOrder: Record<CanonicalSeverity, number> = {
      'info': 0,
      'minor': 1,
      'major': 2,
      'critical': 3,
    };
    
    const lastSeverityValue = severityOrder[record.lastSeverity as CanonicalSeverity] ?? 0;
    const currentSeverityValue = severityOrder[currentSeverity];
    
    if (currentSeverityValue > lastSeverityValue) {
      return true;
    }
  }

  if (currentStatus === 'resolved' && record.lastStatus !== 'resolved') {
    return true;
  }

  return false;
}

export async function recordAlertSent(
  incidentId: string,
  userId: string,
  severity: CanonicalSeverity,
  status: CanonicalStatus
): Promise<void> {
  const existing = await db.select()
    .from(alertCooldowns)
    .where(and(
      eq(alertCooldowns.incidentId, incidentId),
      eq(alertCooldowns.userId, userId)
    ))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(alertCooldowns).values({
      incidentId,
      userId,
      lastSeverity: severity,
      lastStatus: status,
      alertCount: 1,
    });
  } else {
    await db.update(alertCooldowns)
      .set({
        lastAlertAt: new Date(),
        alertCount: existing[0].alertCount + 1,
        lastSeverity: severity,
        lastStatus: status,
      })
      .where(and(
        eq(alertCooldowns.incidentId, incidentId),
        eq(alertCooldowns.userId, userId)
      ));
  }
}

export async function getCooldownStatus(incidentId: string, userId: string): Promise<{
  hasCooldown: boolean;
  minutesRemaining: number;
  alertCount: number;
} | null> {
  const existing = await db.select()
    .from(alertCooldowns)
    .where(and(
      eq(alertCooldowns.incidentId, incidentId),
      eq(alertCooldowns.userId, userId)
    ))
    .limit(1);

  if (existing.length === 0) {
    return null;
  }

  const record = existing[0];
  const minutesSinceLastAlert = (Date.now() - record.lastAlertAt.getTime()) / (1000 * 60);
  const minutesRemaining = Math.max(0, DEFAULT_COOLDOWN_MINUTES - minutesSinceLastAlert);

  return {
    hasCooldown: minutesRemaining > 0,
    minutesRemaining: Math.ceil(minutesRemaining),
    alertCount: record.alertCount,
  };
}
