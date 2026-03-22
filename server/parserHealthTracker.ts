import { db } from './db';
import { parserHealth, vendors } from '@shared/schema';
import { eq } from 'drizzle-orm';

const CONSECUTIVE_FAILURE_THRESHOLD = 10;

interface ParseResult {
  success: boolean;
  httpStatus?: number;
  errorMessage?: string;
  incidentsParsed?: number;
  isTimeout?: boolean;
}

export async function recordParseResult(vendorKey: string, result: ParseResult): Promise<void> {
  // Verify the vendor exists before creating/updating parser_health
  const vendorExists = await db.select({ key: vendors.key })
    .from(vendors)
    .where(eq(vendors.key, vendorKey))
    .limit(1);
  
  if (vendorExists.length === 0) {
    // Vendor doesn't exist, skip recording and clean up any orphaned entry
    await db.delete(parserHealth).where(eq(parserHealth.vendorKey, vendorKey));
    return;
  }

  const existing = await db.select()
    .from(parserHealth)
    .where(eq(parserHealth.vendorKey, vendorKey))
    .limit(1);

  const now = new Date();

  const isTimeout = result.isTimeout || false;
  // HTTP 404 means the vendor has no status page at that URL — treat like a
  // timeout (don't count against parser health, it's a config issue not a bug)
  const isNotFound = !result.success && result.httpStatus === 404;
  const skipFailureCount = isTimeout || isNotFound;

  if (existing.length === 0) {
    await db.insert(parserHealth).values({
      vendorKey,
      lastSuccessAt: result.success ? now : null,
      lastFailureAt: result.success ? null : (skipFailureCount ? null : now),
      consecutiveFailures: result.success ? 0 : (skipFailureCount ? 0 : 1),
      totalSuccesses: result.success ? 1 : 0,
      totalFailures: result.success ? 0 : (skipFailureCount ? 0 : 1),
      lastHttpStatus: result.httpStatus || null,
      lastErrorMessage: result.errorMessage || null,
      incidentsParsed: result.incidentsParsed || 0,
      isHealthy: true,
    });
  } else {
    const record = existing[0];
    const newConsecutiveFailures = result.success ? 0 : (skipFailureCount ? record.consecutiveFailures : record.consecutiveFailures + 1);
    const isHealthy = newConsecutiveFailures < CONSECUTIVE_FAILURE_THRESHOLD;

    await db.update(parserHealth)
      .set({
        lastSuccessAt: result.success ? now : record.lastSuccessAt,
        lastFailureAt: result.success ? record.lastFailureAt : (skipFailureCount ? record.lastFailureAt : now),
        consecutiveFailures: newConsecutiveFailures,
        totalSuccesses: result.success ? record.totalSuccesses + 1 : record.totalSuccesses,
        totalFailures: result.success ? record.totalFailures : (skipFailureCount ? record.totalFailures : record.totalFailures + 1),
        lastHttpStatus: result.httpStatus || record.lastHttpStatus,
        lastErrorMessage: skipFailureCount ? record.lastErrorMessage : (result.errorMessage || (result.success ? null : record.lastErrorMessage)),
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
