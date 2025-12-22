import { db } from './db';
import { parserHealth } from '@shared/schema';
import { eq } from 'drizzle-orm';

const CONSECUTIVE_FAILURE_THRESHOLD = 5;

interface ParseResult {
  success: boolean;
  httpStatus?: number;
  errorMessage?: string;
  incidentsParsed?: number;
}

export async function recordParseResult(vendorKey: string, result: ParseResult): Promise<void> {
  const existing = await db.select()
    .from(parserHealth)
    .where(eq(parserHealth.vendorKey, vendorKey))
    .limit(1);

  const now = new Date();

  if (existing.length === 0) {
    await db.insert(parserHealth).values({
      vendorKey,
      lastSuccessAt: result.success ? now : null,
      lastFailureAt: result.success ? null : now,
      consecutiveFailures: result.success ? 0 : 1,
      totalSuccesses: result.success ? 1 : 0,
      totalFailures: result.success ? 0 : 1,
      lastHttpStatus: result.httpStatus || null,
      lastErrorMessage: result.errorMessage || null,
      incidentsParsed: result.incidentsParsed || 0,
      isHealthy: result.success,
    });
  } else {
    const record = existing[0];
    const newConsecutiveFailures = result.success ? 0 : record.consecutiveFailures + 1;
    const isHealthy = newConsecutiveFailures < CONSECUTIVE_FAILURE_THRESHOLD;

    await db.update(parserHealth)
      .set({
        lastSuccessAt: result.success ? now : record.lastSuccessAt,
        lastFailureAt: result.success ? record.lastFailureAt : now,
        consecutiveFailures: newConsecutiveFailures,
        totalSuccesses: result.success ? record.totalSuccesses + 1 : record.totalSuccesses,
        totalFailures: result.success ? record.totalFailures : record.totalFailures + 1,
        lastHttpStatus: result.httpStatus || record.lastHttpStatus,
        lastErrorMessage: result.errorMessage || (result.success ? null : record.lastErrorMessage),
        incidentsParsed: result.incidentsParsed ?? record.incidentsParsed,
        isHealthy,
        updatedAt: now,
      })
      .where(eq(parserHealth.vendorKey, vendorKey));
  }
}

export async function getParserHealth(vendorKey: string): Promise<typeof parserHealth.$inferSelect | null> {
  const result = await db.select()
    .from(parserHealth)
    .where(eq(parserHealth.vendorKey, vendorKey))
    .limit(1);
  return result[0] || null;
}

export async function getAllParserHealth(): Promise<Array<typeof parserHealth.$inferSelect>> {
  return await db.select().from(parserHealth);
}

export async function getUnhealthyParsers(): Promise<Array<typeof parserHealth.$inferSelect>> {
  return await db.select()
    .from(parserHealth)
    .where(eq(parserHealth.isHealthy, false));
}

export async function markAlertSent(vendorKey: string): Promise<void> {
  await db.update(parserHealth)
    .set({ alertSentAt: new Date() })
    .where(eq(parserHealth.vendorKey, vendorKey));
}

export async function shouldSendParserHealthAlert(vendorKey: string): Promise<boolean> {
  const health = await getParserHealth(vendorKey);
  if (!health) return false;
  if (health.isHealthy) return false;
  if (health.consecutiveFailures < CONSECUTIVE_FAILURE_THRESHOLD) return false;
  if (health.alertSentAt) {
    const hoursSinceAlert = (Date.now() - health.alertSentAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceAlert < 4) return false;
  }
  return true;
}

export function getHealthSummary(health: typeof parserHealth.$inferSelect): string {
  const successRate = health.totalSuccesses + health.totalFailures > 0
    ? Math.round((health.totalSuccesses / (health.totalSuccesses + health.totalFailures)) * 100)
    : 100;
  
  return `${health.isHealthy ? 'Healthy' : 'UNHEALTHY'} (${successRate}% success, ${health.consecutiveFailures} consecutive failures)`;
}

export async function getParserHealthStatus(vendorKey: string): Promise<{ consecutiveFailures: number; lastError?: string } | null> {
  const health = await getParserHealth(vendorKey);
  if (!health) return null;
  return {
    consecutiveFailures: health.consecutiveFailures,
    lastError: health.lastErrorMessage || undefined,
  };
}
