import { db } from './db';
import { vendors, incidents, incidentArchive, vendorDailyMetrics, vendorScores, vendorScoreHistory } from '@shared/schema';
import { eq, gte, and, sql, desc, lte } from 'drizzle-orm';

export interface VendorScoreBreakdown {
  vendorKey: string;
  vendorName: string;
  category: string;
  score: number;
  uptimeScore: number;
  mttrScore: number;
  frequencyScore: number;
  severityScore: number;
  uptimePercent: number;
  mttrHours: number | null;
  incidentFrequency30d: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  infoCount: number;
  badge: string;
  trend: string;
  calculatedAt: Date;
}

function computeScoreComponents(
  uptimePct: number,
  mttrHours: number | null,
  freq30d: number,
  criticalCt: number,
  majorCt: number,
  minorCt: number,
  infoCt: number,
): { uptimeScore: number; mttrScore: number; frequencyScore: number; severityScore: number; total: number } {
  // Uptime (40 points): 100% uptime = 40, 99% = 36, <95% approaches 0
  const uptimeScore = Math.max(0, Math.round(Math.pow(uptimePct / 100, 4) * 40));

  // MTTR (30 points): null = 30, 0-2h = 28-30, 6h = 22, 12h = 14, 24h = 0
  let mttrScore = 30;
  if (mttrHours !== null) {
    mttrScore = Math.max(0, Math.round(30 * Math.exp(-mttrHours / 12)));
  }

  // Frequency (20 points): 0 incidents = 20, 1 = 16, 3 = 9, 5 = 4, 8+ ≈ 0
  const frequencyScore = Math.max(0, Math.round(20 * Math.exp(-freq30d * 0.35)));

  // Severity (10 points): weighted penalty per incident type
  const totalIncidents = criticalCt + majorCt + minorCt + infoCt;
  let severityScore = 10;
  if (totalIncidents > 0) {
    const weightedPenalty = (criticalCt * 5 + majorCt * 3 + minorCt * 1.5 + infoCt * 0.5) / totalIncidents;
    severityScore = Math.max(0, Math.round(10 - weightedPenalty * 2));
  }

  const total = uptimeScore + mttrScore + frequencyScore + severityScore;
  return { uptimeScore, mttrScore, frequencyScore, severityScore, total };
}

function getBadge(score: number): string {
  if (score >= 90) return 'Highly Reliable';
  if (score >= 70) return 'Moderate Risk';
  return 'Frequent Incidents';
}

async function getUptimePercent(vendorKey: string, days: number): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await db.select({
    uptimeMinutes: sql<number>`sum(${vendorDailyMetrics.uptimeMinutes})`,
    downtimeMinutes: sql<number>`sum(${vendorDailyMetrics.downtimeMinutes})`,
  })
    .from(vendorDailyMetrics)
    .where(and(
      eq(vendorDailyMetrics.vendorKey, vendorKey),
      gte(vendorDailyMetrics.date, sinceStr),
    ));

  const uptime = Number(rows[0]?.uptimeMinutes || 0);
  const downtime = Number(rows[0]?.downtimeMinutes || 0);
  const total = uptime + downtime;
  if (total === 0) return 100;
  return Math.round((uptime / total) * 100);
}

async function getMttrHours(vendorKey: string, days: number): Promise<number | null> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db.select({
    avg: sql<number>`avg(extract(epoch from (${incidentArchive.resolvedAt} - to_timestamp(${incidentArchive.startedAt}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) / 3600)`,
  })
    .from(incidentArchive)
    .where(and(
      eq(incidentArchive.vendorKey, vendorKey),
      gte(incidentArchive.resolvedAt, since),
    ));

  const avg = Number(rows[0]?.avg);
  if (!avg || isNaN(avg)) return null;
  return Math.max(0, Math.round(avg));
}

async function getIncidentCounts(vendorKey: string, days30: number, days90: number): Promise<{
  freq30d: number;
  criticalCt: number;
  majorCt: number;
  minorCt: number;
  infoCt: number;
}> {
  const since30 = new Date();
  since30.setDate(since30.getDate() - days30);
  const since90 = new Date();
  since90.setDate(since90.getDate() - days90);

  // Count active incidents (recent) in last 30d
  const active30 = await db.select({ count: sql<number>`count(*)` })
    .from(incidents)
    .where(and(
      eq(incidents.vendorKey, vendorKey),
      gte(incidents.createdAt, since30),
    ));

  // Count archived incidents in last 30d
  const archived30 = await db.select({ count: sql<number>`count(*)` })
    .from(incidentArchive)
    .where(and(
      eq(incidentArchive.vendorKey, vendorKey),
      gte(incidentArchive.resolvedAt, since30),
    ));

  const freq30d = Number(active30[0]?.count || 0) + Number(archived30[0]?.count || 0);

  // Severity breakdown over 90 days
  const activeSev = await db.select({ severity: incidents.severity, count: sql<number>`count(*)` })
    .from(incidents)
    .where(and(eq(incidents.vendorKey, vendorKey), gte(incidents.createdAt, since90)))
    .groupBy(incidents.severity);

  const archivedSev = await db.select({ severity: incidentArchive.severity, count: sql<number>`count(*)` })
    .from(incidentArchive)
    .where(and(eq(incidentArchive.vendorKey, vendorKey), gte(incidentArchive.resolvedAt, since90)))
    .groupBy(incidentArchive.severity);

  const sevMap: Record<string, number> = {};
  [...activeSev, ...archivedSev].forEach(r => {
    sevMap[r.severity] = (sevMap[r.severity] || 0) + Number(r.count);
  });

  return {
    freq30d,
    criticalCt: sevMap['critical'] || 0,
    majorCt: sevMap['major'] || 0,
    minorCt: sevMap['minor'] || 0,
    infoCt: sevMap['info'] || 0,
  };
}

export async function calculateVendorScore(vendorKey: string): Promise<VendorScoreBreakdown | null> {
  const [vendor] = await db.select().from(vendors).where(eq(vendors.key, vendorKey)).limit(1);
  if (!vendor) return null;

  const [uptimePct, mttrHours, counts] = await Promise.all([
    getUptimePercent(vendorKey, 90),
    getMttrHours(vendorKey, 90),
    getIncidentCounts(vendorKey, 30, 90),
  ]);

  const { uptimeScore, mttrScore, frequencyScore, severityScore, total } = computeScoreComponents(
    uptimePct, mttrHours, counts.freq30d,
    counts.criticalCt, counts.majorCt, counts.minorCt, counts.infoCt,
  );

  const badge = getBadge(total);

  // Calculate trend by comparing to previous month's stored score
  const prevMonth = new Date();
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

  const [prevHistory] = await db.select()
    .from(vendorScoreHistory)
    .where(and(eq(vendorScoreHistory.vendorKey, vendorKey), eq(vendorScoreHistory.month, prevMonthStr)))
    .limit(1);

  let trend = 'stable';
  if (prevHistory) {
    const diff = total - prevHistory.score;
    if (diff >= 3) trend = 'improving';
    else if (diff <= -3) trend = 'declining';
  }

  return {
    vendorKey,
    vendorName: vendor.name,
    category: vendor.category || 'Other',
    score: total,
    uptimeScore,
    mttrScore,
    frequencyScore,
    severityScore,
    uptimePercent: uptimePct,
    mttrHours,
    incidentFrequency30d: counts.freq30d,
    criticalCount: counts.criticalCt,
    majorCount: counts.majorCt,
    minorCount: counts.minorCt,
    infoCount: counts.infoCt,
    badge,
    trend,
    calculatedAt: new Date(),
  };
}

async function upsertScore(data: VendorScoreBreakdown): Promise<void> {
  await db.insert(vendorScores).values({
    vendorKey: data.vendorKey,
    score: data.score,
    uptimeScore: data.uptimeScore,
    mttrScore: data.mttrScore,
    frequencyScore: data.frequencyScore,
    severityScore: data.severityScore,
    uptimePercent: data.uptimePercent,
    mttrHours: data.mttrHours,
    incidentFrequency30d: data.incidentFrequency30d,
    criticalCount: data.criticalCount,
    majorCount: data.majorCount,
    minorCount: data.minorCount,
    infoCount: data.infoCount,
    badge: data.badge,
    trend: data.trend,
  }).onConflictDoUpdate({
    target: vendorScores.vendorKey,
    set: {
      score: data.score,
      uptimeScore: data.uptimeScore,
      mttrScore: data.mttrScore,
      frequencyScore: data.frequencyScore,
      severityScore: data.severityScore,
      uptimePercent: data.uptimePercent,
      mttrHours: data.mttrHours,
      incidentFrequency30d: data.incidentFrequency30d,
      criticalCount: data.criticalCount,
      majorCount: data.majorCount,
      minorCount: data.minorCount,
      infoCount: data.infoCount,
      badge: data.badge,
      trend: data.trend,
      calculatedAt: new Date(),
    },
  });

  // Upsert into history for the current month
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [existing] = await db.select()
    .from(vendorScoreHistory)
    .where(and(eq(vendorScoreHistory.vendorKey, data.vendorKey), eq(vendorScoreHistory.month, month)))
    .limit(1);

  if (existing) {
    await db.update(vendorScoreHistory)
      .set({ score: data.score, calculatedAt: new Date() })
      .where(eq(vendorScoreHistory.id, existing.id));
  } else {
    await db.insert(vendorScoreHistory).values({
      vendorKey: data.vendorKey,
      score: data.score,
      month,
    });
  }
}

export async function calculateAllVendorScores(): Promise<{ calculated: number; errors: number }> {
  const allVendors = await db.select({ key: vendors.key, name: vendors.name }).from(vendors);
  let calculated = 0;
  let errors = 0;

  const BATCH = 20;
  for (let i = 0; i < allVendors.length; i += BATCH) {
    const batch = allVendors.slice(i, i + BATCH);
    await Promise.all(batch.map(async (v) => {
      try {
        const score = await calculateVendorScore(v.key);
        if (score) {
          await upsertScore(score);
          calculated++;
        }
      } catch (err) {
        console.error(`[scores] Failed to calculate score for ${v.key}:`, err);
        errors++;
      }
    }));
    if (i + BATCH < allVendors.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log(`[scores] Calculated ${calculated} vendor scores, ${errors} errors`);
  return { calculated, errors };
}

export async function getLeaderboard(opts: {
  page?: number;
  limit?: number;
  category?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}): Promise<{ vendors: Array<VendorScoreBreakdown & { logoUrl: string | null }>; total: number; page: number; pages: number }> {
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(100, Math.max(10, opts.limit || 50));
  const offset = (page - 1) * limit;

  const rows = await db.select({
    vendorKey: vendorScores.vendorKey,
    score: vendorScores.score,
    uptimeScore: vendorScores.uptimeScore,
    mttrScore: vendorScores.mttrScore,
    frequencyScore: vendorScores.frequencyScore,
    severityScore: vendorScores.severityScore,
    uptimePercent: vendorScores.uptimePercent,
    mttrHours: vendorScores.mttrHours,
    incidentFrequency30d: vendorScores.incidentFrequency30d,
    criticalCount: vendorScores.criticalCount,
    majorCount: vendorScores.majorCount,
    minorCount: vendorScores.minorCount,
    infoCount: vendorScores.infoCount,
    badge: vendorScores.badge,
    trend: vendorScores.trend,
    calculatedAt: vendorScores.calculatedAt,
    vendorName: vendors.name,
    category: vendors.category,
    logoUrl: vendors.logoUrl,
  })
    .from(vendorScores)
    .innerJoin(vendors, eq(vendors.key, vendorScores.vendorKey))
    .where(opts.category ? eq(vendors.category, opts.category) : undefined)
    .orderBy(desc(vendorScores.score))
    .limit(limit + 1)
    .offset(offset);

  const totalRows = await db.select({ count: sql<number>`count(*)` })
    .from(vendorScores)
    .innerJoin(vendors, eq(vendors.key, vendorScores.vendorKey))
    .where(opts.category ? eq(vendors.category, opts.category) : undefined);

  const total = Number(totalRows[0]?.count || 0);
  const pages = Math.ceil(total / limit);

  return {
    vendors: rows.slice(0, limit).map(r => ({
      ...r,
      category: r.category || 'Other',
    })) as any,
    total,
    page,
    pages,
  };
}

export async function getScoreHistory(vendorKey: string): Promise<Array<{ month: string; score: number }>> {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const sinceStr = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}`;

  const rows = await db.select({ month: vendorScoreHistory.month, score: vendorScoreHistory.score })
    .from(vendorScoreHistory)
    .where(and(
      eq(vendorScoreHistory.vendorKey, vendorKey),
      gte(vendorScoreHistory.month, sinceStr),
    ))
    .orderBy(vendorScoreHistory.month);

  return rows;
}
