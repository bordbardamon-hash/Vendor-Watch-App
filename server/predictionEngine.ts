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
  
  // Check if a similar prediction already exists to prevent duplicates
  const existingPredictions = await storage.getActivePredictions();
  const isDuplicate = existingPredictions.some(p => {
    const matchesResource = pattern.resourceType === 'vendor' 
      ? p.vendorKey === pattern.resourceKey 
      : p.chainKey === pattern.resourceKey;
    const sameDate = p.predictedStartAt && 
      new Date(p.predictedStartAt).toDateString() === predictedDate.toDateString();
    return matchesResource && sameDate;
  });
  
  if (isDuplicate) {
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

// Clean up and maintain predictions - expires old ones, validates against actual incidents
export async function maintainPredictions(): Promise<{ expired: number; validated: number; invalidated: number }> {
  console.log('[PredictionEngine] Running prediction maintenance...');
  
  const now = new Date();
  let expired = 0;
  let validated = 0;
  let invalidated = 0;
  
  try {
    // Get all predictions (active and non-active for cleanup)
    const allPredictions = await storage.getAllOutagePredictions();
    const vendorIncidents = await storage.getIncidents();
    const blockchainIncidents = await storage.getBlockchainIncidents();
    
    for (const prediction of allPredictions) {
      // Skip already processed predictions
      if (prediction.status !== 'active') {
        // Clean up old non-active predictions (>30 days)
        const createdAt = new Date(prediction.createdAt);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (createdAt < thirtyDaysAgo) {
          await storage.deletePrediction(prediction.id);
        }
        continue;
      }
      
      // Guard against missing or invalid predictedStartAt
      if (!prediction.predictedStartAt || isNaN(new Date(prediction.predictedStartAt).getTime())) {
        // Invalid prediction - mark as expired to clean up
        await storage.updateOutagePrediction(prediction.id, { status: 'expired' });
        expired++;
        continue;
      }
      
      const predictedDate = new Date(prediction.predictedStartAt);
      const expiryDate = prediction.expiresAt ? new Date(prediction.expiresAt) : null;
      const windowEnd = new Date(predictedDate.getTime() + 6 * 60 * 60 * 1000); // 6 hours after
      
      // Apply fallback expiry: if no expiresAt is set and prediction is > 7 days old, expire it
      const fallbackExpiryDate = new Date(predictedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (!expiryDate && now > fallbackExpiryDate) {
        await storage.updateOutagePrediction(prediction.id, { status: 'expired' });
        expired++;
        continue;
      }
      
      // Check if prediction has expired (past its expiry date)
      if (expiryDate && now > expiryDate) {
        await storage.updateOutagePrediction(prediction.id, { status: 'expired' });
        expired++;
        continue;
      }
      
      // Only validate/invalidate AFTER the full validation window has closed
      // This prevents false negatives by waiting for all potential incidents
      if (now > windowEnd) {
        const windowStart = new Date(predictedDate.getTime() - 6 * 60 * 60 * 1000); // 6 hours before
        
        // Look for incidents within the prediction window
        let hadIncident = false;
        let actualIncidentId: string | null = null;
        
        if (prediction.vendorKey) {
          const matchingIncidents = vendorIncidents.filter(i => 
            i.vendorKey === prediction.vendorKey &&
            new Date(i.createdAt) >= windowStart &&
            new Date(i.createdAt) <= windowEnd
          );
          if (matchingIncidents.length > 0) {
            hadIncident = true;
            actualIncidentId = matchingIncidents[0].id;
          }
        } else if (prediction.chainKey) {
          const matchingIncidents = blockchainIncidents.filter(i => 
            i.chainKey === prediction.chainKey &&
            new Date(i.createdAt) >= windowStart &&
            new Date(i.createdAt) <= windowEnd
          );
          if (matchingIncidents.length > 0) {
            hadIncident = true;
            actualIncidentId = matchingIncidents[0].id;
          }
        }
        
        if (hadIncident) {
          // Prediction was validated - there was an incident within the window
          await storage.updateOutagePrediction(prediction.id, { 
            status: 'validated',
            actualIncidentId 
          });
          validated++;
        } else {
          // Prediction was invalidated - no incident occurred in the full window
          await storage.updateOutagePrediction(prediction.id, { 
            status: 'invalidated' 
          });
          invalidated++;
        }
      }
    }
    
    console.log(`[PredictionEngine] Maintenance complete: ${expired} expired, ${validated} validated, ${invalidated} invalidated`);
    return { expired, validated, invalidated };
  } catch (error) {
    console.error('[PredictionEngine] Error during maintenance:', error);
    return { expired, validated, invalidated };
  }
}

// Update confidence levels for existing predictions based on telemetry data (90-day window)
export async function updatePredictionConfidence(): Promise<number> {
  console.log('[PredictionEngine] Updating prediction confidence levels...');
  
  let updated = 0;
  
  try {
    // Get ALL predictions with active status (including those with past predictedStartAt)
    // to ensure we don't miss updating confidence for predictions awaiting validation
    const allPredictions = await storage.getAllOutagePredictions();
    const predictions = allPredictions.filter(p => p.status === 'active');
    
    // Compute aggregates once for all resources (not per-prediction)
    const vendorAggregated = await storage.aggregateTelemetryForPredictions('vendor');
    const blockchainAggregated = await storage.aggregateTelemetryForPredictions('blockchain');
    
    // Create lookup maps for O(1) access
    const vendorMap = new Map(vendorAggregated.map(a => [a.resourceKey, a]));
    const blockchainMap = new Map(blockchainAggregated.map(a => [a.resourceKey, a]));
    
    for (const prediction of predictions) {
      const resourceKey = prediction.vendorKey || prediction.chainKey;
      const resourceType = prediction.resourceType;
      
      if (!resourceKey) continue;
      
      // Use pre-computed aggregates
      const aggregateMap = resourceType === 'vendor' ? vendorMap : blockchainMap;
      const resourceData = aggregateMap.get(resourceKey);
      
      if (!resourceData) continue;
      
      // Calculate confidence based on incident frequency from 90-day telemetry data
      // avgIncidentCount is incidents per time window, so it's already normalized
      const incidentFrequency = resourceData.avgIncidentCount;
      const newConfidence = Math.min(0.95, Math.max(0.3, 0.5 + (incidentFrequency * 0.3)));
      const currentConfidence = parseFloat(prediction.confidence);
      
      // Only update if confidence changed significantly (> 5%)
      if (Math.abs(newConfidence - currentConfidence) > 0.05) {
        await storage.updateOutagePrediction(prediction.id, {
          confidence: newConfidence.toFixed(2)
        });
        updated++;
      }
    }
    
    console.log(`[PredictionEngine] Updated confidence for ${updated} predictions`);
    return updated;
  } catch (error) {
    console.error('[PredictionEngine] Error updating confidence:', error);
    return updated;
  }
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
