import { db } from './db';
import { vendorReliabilityStats, incidents, vendors } from '@shared/schema';
import { eq, gte, and, sql } from 'drizzle-orm';

type ReliabilityRating = 'good' | 'fair' | 'poor';

interface ReliabilityMetrics {
  incidents30Days: number;
  incidents90Days: number;
  avgResolutionMinutes: number | null;
  escalationPercent: number;
  longRunningCount: number;
  reliabilityRating: ReliabilityRating;
}

function calculateReliabilityRating(metrics: Omit<ReliabilityMetrics, 'reliabilityRating'>): ReliabilityRating {
  let score = 100;
  
  if (metrics.incidents30Days > 5) score -= 30;
  else if (metrics.incidents30Days > 2) score -= 15;
  else if (metrics.incidents30Days > 0) score -= 5;
  
  if (metrics.avgResolutionMinutes !== null) {
    if (metrics.avgResolutionMinutes > 240) score -= 25;
    else if (metrics.avgResolutionMinutes > 120) score -= 15;
    else if (metrics.avgResolutionMinutes > 60) score -= 10;
  }
  
  if (metrics.escalationPercent > 30) score -= 20;
  else if (metrics.escalationPercent > 15) score -= 10;
  
  if (metrics.longRunningCount > 2) score -= 15;
  else if (metrics.longRunningCount > 0) score -= 5;
  
  if (score >= 70) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export async function calculateVendorReliability(vendorKey: string): Promise<ReliabilityMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  const allIncidents = await db.select()
    .from(incidents)
    .where(eq(incidents.vendorKey, vendorKey));
  
  const incidents30 = allIncidents.filter(i => {
    const startDate = new Date(i.startedAt);
    return startDate >= thirtyDaysAgo;
  });
  
  const incidents90 = allIncidents.filter(i => {
    const startDate = new Date(i.startedAt);
    return startDate >= ninetyDaysAgo;
  });
  
  let totalResolutionMinutes = 0;
  let resolvedCount = 0;
  let escalatedCount = 0;
  let longRunningCount = 0;
  
  for (const incident of incidents90) {
    if (incident.status === 'resolved') {
      const start = new Date(incident.startedAt).getTime();
      const end = new Date(incident.updatedAt).getTime();
      const durationMinutes = Math.round((end - start) / (1000 * 60));
      totalResolutionMinutes += durationMinutes;
      resolvedCount++;
      
      if (durationMinutes > 240) {
        longRunningCount++;
      }
    }
    
    if (incident.severity === 'critical' || incident.severity === 'major') {
      escalatedCount++;
    }
  }
  
  const avgResolutionMinutes = resolvedCount > 0 
    ? Math.round(totalResolutionMinutes / resolvedCount) 
    : null;
  
  const escalationPercent = incidents90.length > 0 
    ? Math.round((escalatedCount / incidents90.length) * 100) 
    : 0;
  
  const metrics: Omit<ReliabilityMetrics, 'reliabilityRating'> = {
    incidents30Days: incidents30.length,
    incidents90Days: incidents90.length,
    avgResolutionMinutes,
    escalationPercent,
    longRunningCount,
  };
  
  return {
    ...metrics,
    reliabilityRating: calculateReliabilityRating(metrics),
  };
}

export async function updateVendorReliabilityStats(vendorKey: string): Promise<void> {
  const metrics = await calculateVendorReliability(vendorKey);
  const now = new Date();
  
  const existing = await db.select()
    .from(vendorReliabilityStats)
    .where(eq(vendorReliabilityStats.vendorKey, vendorKey))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(vendorReliabilityStats).values({
      vendorKey,
      ...metrics,
      lastCalculatedAt: now,
    });
  } else {
    await db.update(vendorReliabilityStats)
      .set({
        ...metrics,
        lastCalculatedAt: now,
        updatedAt: now,
      })
      .where(eq(vendorReliabilityStats.vendorKey, vendorKey));
  }
}

export async function updateAllVendorReliabilityStats(): Promise<void> {
  const allVendors = await db.select().from(vendors);
  
  for (const vendor of allVendors) {
    try {
      await updateVendorReliabilityStats(vendor.key);
    } catch (error) {
      console.error(`[reliability] Failed to update stats for ${vendor.key}:`, error);
    }
  }
  
  console.log(`[reliability] Updated stats for ${allVendors.length} vendors`);
}

export async function getVendorReliability(vendorKey: string): Promise<ReliabilityMetrics | null> {
  const stats = await db.select()
    .from(vendorReliabilityStats)
    .where(eq(vendorReliabilityStats.vendorKey, vendorKey))
    .limit(1);
  
  if (stats.length === 0) {
    return null;
  }
  
  const s = stats[0];
  return {
    incidents30Days: s.incidents30Days,
    incidents90Days: s.incidents90Days,
    avgResolutionMinutes: s.avgResolutionMinutes,
    escalationPercent: s.escalationPercent,
    longRunningCount: s.longRunningCount,
    reliabilityRating: s.reliabilityRating as ReliabilityRating,
  };
}

export async function getAllVendorReliability(): Promise<Array<{ vendorKey: string; metrics: ReliabilityMetrics }>> {
  const allStats = await db.select().from(vendorReliabilityStats);
  
  return allStats.map(s => ({
    vendorKey: s.vendorKey,
    metrics: {
      incidents30Days: s.incidents30Days,
      incidents90Days: s.incidents90Days,
      avgResolutionMinutes: s.avgResolutionMinutes,
      escalationPercent: s.escalationPercent,
      longRunningCount: s.longRunningCount,
      reliabilityRating: s.reliabilityRating as ReliabilityRating,
    }
  }));
}

export function formatReliabilityDisplay(metrics: ReliabilityMetrics): string {
  const rating = metrics.reliabilityRating.charAt(0).toUpperCase() + metrics.reliabilityRating.slice(1);
  const resolution = metrics.avgResolutionMinutes !== null 
    ? `Avg resolution: ${metrics.avgResolutionMinutes} min` 
    : 'No resolved incidents';
  
  return `${rating} (${metrics.incidents90Days} incidents in 90 days, ${resolution})`;
}
