import { storage } from "./storage";

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface IncidentPattern {
  resourceKey: string;
  resourceType: 'vendor' | 'blockchain';
  dayOfWeek: number;
  hourOfDay: number;
  incidentCount: number;
  avgSeverity: string;
}

export async function generatePredictions(): Promise<void> {
  console.log('[PredictionEngine] Starting prediction generation...');
  
  try {
    const vendors = await storage.getVendors();
    const chains = await storage.getBlockchainChains();
    
    const vendorPatterns = await analyzeHistoricalPatterns('vendor', vendors.map(v => v.key));
    const blockchainPatterns = await analyzeHistoricalPatterns('blockchain', chains.map(c => c.key));
    
    const allPatterns = [...vendorPatterns, ...blockchainPatterns];
    
    for (const pattern of allPatterns) {
      if (pattern.incidentCount >= 3) {
        await createPredictionFromPattern(pattern);
      }
    }
    
    console.log(`[PredictionEngine] Generated predictions from ${allPatterns.length} patterns`);
  } catch (error) {
    console.error('[PredictionEngine] Error generating predictions:', error);
  }
}

async function analyzeHistoricalPatterns(
  resourceType: 'vendor' | 'blockchain',
  resourceKeys: string[]
): Promise<IncidentPattern[]> {
  const patterns: IncidentPattern[] = [];
  
  const aggregated = await storage.aggregateTelemetryForPredictions(resourceType);
  
  for (const agg of aggregated) {
    if (agg.avgIncidentCount >= 0.3) {
      patterns.push({
        resourceKey: agg.resourceKey,
        resourceType,
        dayOfWeek: agg.dayOfWeek,
        hourOfDay: agg.hourOfDay,
        incidentCount: agg.totalIncidents,
        avgSeverity: agg.avgIncidentCount >= 0.7 ? 'major' : 'minor',
      });
    }
  }
  
  return patterns;
}

async function createPredictionFromPattern(pattern: IncidentPattern): Promise<void> {
  const now = new Date();
  const predictedDate = getNextOccurrence(pattern.dayOfWeek, pattern.hourOfDay);
  
  if (predictedDate <= now) {
    return;
  }
  
  const confidence = Math.min(0.95, 0.5 + (pattern.incidentCount * 0.05));
  const severity = pattern.avgSeverity === 'major' ? 'high' : 'medium';
  
  const resourceName = pattern.resourceKey;
  const dayName = DAYS_OF_WEEK[pattern.dayOfWeek];
  const hourStr = pattern.hourOfDay.toString().padStart(2, '0') + ':00';
  
  try {
    await storage.createOutagePrediction({
      vendorKey: pattern.resourceType === 'vendor' ? pattern.resourceKey : null,
      chainKey: pattern.resourceType === 'blockchain' ? pattern.resourceKey : null,
      resourceType: pattern.resourceType,
      predictionType: 'pattern_detected',
      severity,
      confidence: confidence.toFixed(2),
      title: `Potential issue detected for ${resourceName}`,
      description: `Based on historical analysis, ${resourceName} has experienced incidents ${pattern.incidentCount} times around ${dayName}s at ${hourStr}. Consider preparing incident response procedures.`,
      predictedStartAt: predictedDate,
      predictedEndAt: new Date(predictedDate.getTime() + 2 * 60 * 60 * 1000),
      patternBasis: JSON.stringify({
        dayOfWeek: pattern.dayOfWeek,
        hourOfDay: pattern.hourOfDay,
        historicalCount: pattern.incidentCount,
      }),
      status: 'active',
      expiresAt: new Date(predictedDate.getTime() + 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    console.log(`[PredictionEngine] Pattern for ${pattern.resourceKey} may already exist`);
  }
}

function getNextOccurrence(dayOfWeek: number, hourOfDay: number): Date {
  const now = new Date();
  const result = new Date(now);
  
  result.setHours(hourOfDay, 0, 0, 0);
  
  const currentDay = now.getDay();
  let daysToAdd = dayOfWeek - currentDay;
  
  if (daysToAdd < 0) {
    daysToAdd += 7;
  } else if (daysToAdd === 0 && now.getHours() >= hourOfDay) {
    daysToAdd = 7;
  }
  
  result.setDate(result.getDate() + daysToAdd);
  
  return result;
}

export async function collectTelemetryMetrics(): Promise<void> {
  console.log('[PredictionEngine] Collecting telemetry metrics...');
  
  try {
    const now = new Date();
    const vendors = await storage.getVendors();
    const chains = await storage.getBlockchainChains();
    
    const vendorIncidents = await storage.getIncidents();
    const blockchainIncidents = await storage.getBlockchainIncidents();
    
    for (const vendor of vendors) {
      const incidents = vendorIncidents.filter(i => i.vendorKey === vendor.key);
      const activeIncidents = incidents.filter(i => i.status !== 'resolved');
      
      await storage.createVendorTelemetryMetric({
        vendorKey: vendor.key,
        chainKey: null,
        resourceType: 'vendor',
        metricDate: now,
        dayOfWeek: now.getDay(),
        hourOfDay: now.getHours(),
        incidentCount: activeIncidents.length,
        criticalCount: activeIncidents.filter(i => i.severity === 'critical').length,
        majorCount: activeIncidents.filter(i => i.severity === 'major').length,
        minorCount: activeIncidents.filter(i => i.severity === 'minor').length,
        maintenanceCount: 0,
        totalDowntimeMinutes: 0,
        uptimePercent: activeIncidents.length === 0 ? '100' : '99',
      });
    }
    
    for (const chain of chains) {
      const incidents = blockchainIncidents.filter(i => i.chainKey === chain.key);
      const activeIncidents = incidents.filter(i => i.status !== 'resolved');
      
      await storage.createVendorTelemetryMetric({
        vendorKey: null,
        chainKey: chain.key,
        resourceType: 'blockchain',
        metricDate: now,
        dayOfWeek: now.getDay(),
        hourOfDay: now.getHours(),
        incidentCount: activeIncidents.length,
        criticalCount: activeIncidents.filter(i => i.severity === 'critical').length,
        majorCount: activeIncidents.filter(i => i.severity === 'major').length,
        minorCount: activeIncidents.filter(i => i.severity === 'minor').length,
        maintenanceCount: 0,
        totalDowntimeMinutes: 0,
        uptimePercent: activeIncidents.length === 0 ? '100' : '99',
      });
    }
    
    console.log(`[PredictionEngine] Collected metrics for ${vendors.length} vendors and ${chains.length} chains`);
  } catch (error) {
    console.error('[PredictionEngine] Error collecting telemetry:', error);
  }
}
