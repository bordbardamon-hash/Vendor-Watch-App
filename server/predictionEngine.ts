import { storage } from "./storage";

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Configuration for improved prediction quality
const PREDICTION_CONFIG = {
  MIN_INCIDENTS_REQUIRED: 5,           // Require at least 5 historical incidents (was 3)
  MIN_FREQUENCY_THRESHOLD: 0.5,        // Minimum avg frequency to consider (was 0.3)
  MIN_CONFIDENCE_TO_CREATE: 0.60,      // Only create predictions with 60%+ confidence
  MAX_PREDICTION_HOURS_AHEAD: 48,      // Only predict up to 48 hours ahead (was 7 days)
  RECENCY_WEIGHT_DAYS: 30,             // Incidents in last 30 days count 3x more
  RECENCY_MULTIPLIER: 3,               // Weight multiplier for recent incidents
  VALIDATION_WINDOW_HOURS: 4,          // Hours before/after prediction to check for incidents
};

interface EnhancedIncidentPattern {
  resourceKey: string;
  resourceType: 'vendor' | 'blockchain';
  dayOfWeek: number;
  hourOfDay: number;
  totalIncidents: number;
  recentIncidents: number;        // Incidents in last 30 days
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  avgSeverityScore: number;       // 1-3 scale (minor=1, major=2, critical=3)
  weightedScore: number;          // Combined score with recency weighting
}

interface PredictionAccuracy {
  validated: number;
  invalidated: number;
  accuracyRate: number;
}

// Track historical accuracy to adjust future confidence
let cachedAccuracy: PredictionAccuracy | null = null;
let accuracyCacheTime = 0;

async function getPredictionAccuracy(): Promise<PredictionAccuracy> {
  const now = Date.now();
  // Cache accuracy for 1 hour
  if (cachedAccuracy && (now - accuracyCacheTime) < 60 * 60 * 1000) {
    return cachedAccuracy;
  }

  const allPredictions = await storage.getAllOutagePredictions();
  const validated = allPredictions.filter(p => p.status === 'validated').length;
  const invalidated = allPredictions.filter(p => p.status === 'invalidated').length;
  const total = validated + invalidated;
  
  cachedAccuracy = {
    validated,
    invalidated,
    accuracyRate: total > 0 ? validated / total : 0.5, // Default 50% if no history
  };
  accuracyCacheTime = now;
  
  return cachedAccuracy;
}

export async function generatePredictions(): Promise<void> {
  console.log('[PredictionEngine] Starting improved prediction generation...');
  
  try {
    const vendors = await storage.getVendors();
    const chains = await storage.getBlockchainChains();
    
    // Get historical accuracy to factor into confidence
    const accuracy = await getPredictionAccuracy();
    console.log(`[PredictionEngine] Historical accuracy: ${(accuracy.accuracyRate * 100).toFixed(1)}% (${accuracy.validated}/${accuracy.validated + accuracy.invalidated})`);
    
    const vendorPatterns = await analyzeEnhancedPatterns('vendor', vendors.map(v => v.key));
    const blockchainPatterns = await analyzeEnhancedPatterns('blockchain', chains.map(c => c.key));
    
    const allPatterns = [...vendorPatterns, ...blockchainPatterns];
    let created = 0;
    let skippedLowConfidence = 0;
    let skippedTooFarAhead = 0;
    
    for (const pattern of allPatterns) {
      // Higher threshold: require 5+ incidents
      if (pattern.totalIncidents < PREDICTION_CONFIG.MIN_INCIDENTS_REQUIRED) {
        continue;
      }
      
      const result = await createEnhancedPrediction(pattern, accuracy);
      if (result === 'created') created++;
      else if (result === 'low_confidence') skippedLowConfidence++;
      else if (result === 'too_far_ahead') skippedTooFarAhead++;
    }
    
    console.log(`[PredictionEngine] Created ${created} predictions, skipped ${skippedLowConfidence} (low confidence), ${skippedTooFarAhead} (too far ahead)`);
  } catch (error) {
    console.error('[PredictionEngine] Error generating predictions:', error);
  }
}

async function analyzeEnhancedPatterns(
  resourceType: 'vendor' | 'blockchain',
  resourceKeys: string[]
): Promise<EnhancedIncidentPattern[]> {
  const patterns: EnhancedIncidentPattern[] = [];
  
  const aggregated = await storage.aggregateTelemetryForPredictions(resourceType);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Get recent telemetry for recency weighting
  const recentAggregated = await storage.aggregateTelemetryForPredictions(resourceType, thirtyDaysAgo);
  const recentMap = new Map(recentAggregated.map(a => [`${a.resourceKey}-${a.dayOfWeek}-${a.hourOfDay}`, a]));
  
  for (const agg of aggregated) {
    // Higher frequency threshold
    if (agg.avgIncidentCount < PREDICTION_CONFIG.MIN_FREQUENCY_THRESHOLD) {
      continue;
    }
    
    const key = `${agg.resourceKey}-${agg.dayOfWeek}-${agg.hourOfDay}`;
    const recentData = recentMap.get(key);
    const recentIncidents = recentData?.totalIncidents || 0;
    
    // Calculate severity score (1-3 scale)
    const criticalCount = agg.criticalCount || 0;
    const majorCount = agg.majorCount || 0;
    const minorCount = agg.minorCount || 0;
    const totalSeverityPoints = (criticalCount * 3) + (majorCount * 2) + (minorCount * 1);
    const avgSeverityScore = agg.totalIncidents > 0 ? totalSeverityPoints / agg.totalIncidents : 1;
    
    // Calculate weighted score with recency multiplier
    const baseScore = agg.totalIncidents;
    const recencyBonus = recentIncidents * (PREDICTION_CONFIG.RECENCY_MULTIPLIER - 1);
    const weightedScore = baseScore + recencyBonus;
    
    patterns.push({
      resourceKey: agg.resourceKey,
      resourceType,
      dayOfWeek: agg.dayOfWeek,
      hourOfDay: agg.hourOfDay,
      totalIncidents: agg.totalIncidents,
      recentIncidents,
      criticalCount,
      majorCount,
      minorCount,
      avgSeverityScore,
      weightedScore,
    });
  }
  
  // Sort by weighted score (highest first) to prioritize most impactful predictions
  patterns.sort((a, b) => b.weightedScore - a.weightedScore);
  
  return patterns;
}

function calculateEnhancedConfidence(pattern: EnhancedIncidentPattern, accuracy: PredictionAccuracy): number {
  // Base confidence from logarithmic scaling of incident count
  // This makes it much harder to reach high confidence
  // log2(5) = 2.32, log2(10) = 3.32, log2(20) = 4.32, log2(50) = 5.64
  const logIncidents = Math.log2(pattern.totalIncidents + 1);
  const incidentConfidence = Math.min(0.4, logIncidents * 0.08); // Max 0.4 from incidents
  
  // Recency bonus: recent incidents boost confidence
  const recencyRatio = pattern.recentIncidents / Math.max(1, pattern.totalIncidents);
  const recencyConfidence = recencyRatio * 0.2; // Max 0.2 from recency
  
  // Severity bonus: more severe incidents increase confidence
  const severityConfidence = (pattern.avgSeverityScore - 1) * 0.1; // Max 0.2 from severity
  
  // Historical accuracy adjustment
  // If our predictions have been accurate, boost confidence slightly
  // If inaccurate, reduce confidence
  const accuracyAdjustment = (accuracy.accuracyRate - 0.5) * 0.15; // -0.075 to +0.075
  
  // Combine all factors
  let confidence = 0.35 + incidentConfidence + recencyConfidence + severityConfidence + accuracyAdjustment;
  
  // Clamp between 0.35 and 0.92 (never show 100% confidence)
  return Math.min(0.92, Math.max(0.35, confidence));
}

function calculateRiskLevel(pattern: EnhancedIncidentPattern, confidence: number): 'low' | 'medium' | 'high' {
  // Risk is determined by multiple factors, not just frequency
  let riskScore = 0;
  
  // Factor 1: Confidence level (0-3 points)
  if (confidence >= 0.80) riskScore += 3;
  else if (confidence >= 0.65) riskScore += 2;
  else if (confidence >= 0.50) riskScore += 1;
  
  // Factor 2: Recent activity (0-3 points)
  if (pattern.recentIncidents >= 3) riskScore += 3;
  else if (pattern.recentIncidents >= 2) riskScore += 2;
  else if (pattern.recentIncidents >= 1) riskScore += 1;
  
  // Factor 3: Severity history (0-3 points)
  if (pattern.criticalCount >= 2) riskScore += 3;
  else if (pattern.criticalCount >= 1 || pattern.majorCount >= 3) riskScore += 2;
  else if (pattern.majorCount >= 1) riskScore += 1;
  
  // Total: 0-9 points
  if (riskScore >= 7) return 'high';
  if (riskScore >= 4) return 'medium';
  return 'low';
}

async function createEnhancedPrediction(
  pattern: EnhancedIncidentPattern, 
  accuracy: PredictionAccuracy
): Promise<'created' | 'duplicate' | 'low_confidence' | 'too_far_ahead'> {
  const now = new Date();
  const predictedDate = getNextOccurrence(pattern.dayOfWeek, pattern.hourOfDay);
  
  if (predictedDate <= now) {
    return 'too_far_ahead';
  }
  
  // Only predict up to 48 hours ahead
  const hoursAhead = (predictedDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursAhead > PREDICTION_CONFIG.MAX_PREDICTION_HOURS_AHEAD) {
    return 'too_far_ahead';
  }
  
  // Calculate confidence with enhanced algorithm
  const confidence = calculateEnhancedConfidence(pattern, accuracy);
  
  // Filter out low-confidence predictions
  if (confidence < PREDICTION_CONFIG.MIN_CONFIDENCE_TO_CREATE) {
    return 'low_confidence';
  }
  
  // Check for duplicates
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
    return 'duplicate';
  }
  
  // Calculate risk level with multi-factor approach
  const severity = calculateRiskLevel(pattern, confidence);
  
  const resourceName = pattern.resourceKey;
  const dayName = DAYS_OF_WEEK[pattern.dayOfWeek];
  const hourStr = pattern.hourOfDay.toString().padStart(2, '0') + ':00';
  
  // Build detailed description
  const recentText = pattern.recentIncidents > 0 
    ? ` (${pattern.recentIncidents} in the last 30 days)` 
    : '';
  const severityText = pattern.criticalCount > 0 
    ? `, including ${pattern.criticalCount} critical incident${pattern.criticalCount > 1 ? 's' : ''}` 
    : '';
  
  try {
    await storage.createOutagePrediction({
      vendorKey: pattern.resourceType === 'vendor' ? pattern.resourceKey : null,
      chainKey: pattern.resourceType === 'blockchain' ? pattern.resourceKey : null,
      resourceType: pattern.resourceType,
      predictionType: 'pattern_detected',
      severity,
      confidence: confidence.toFixed(2),
      title: `${severity === 'high' ? '⚠️ ' : ''}Potential issue for ${resourceName}`,
      description: `Based on ${pattern.totalIncidents} historical incidents${recentText}${severityText}, ${resourceName} may experience issues around ${dayName}s at ${hourStr}. Confidence based on pattern strength and historical accuracy.`,
      predictedStartAt: predictedDate,
      predictedEndAt: new Date(predictedDate.getTime() + 2 * 60 * 60 * 1000),
      patternBasis: JSON.stringify({
        dayOfWeek: pattern.dayOfWeek,
        hourOfDay: pattern.hourOfDay,
        historicalCount: pattern.totalIncidents,
        recentCount: pattern.recentIncidents,
        criticalCount: pattern.criticalCount,
        majorCount: pattern.majorCount,
        avgSeverityScore: pattern.avgSeverityScore,
        weightedScore: pattern.weightedScore,
        historicalAccuracy: accuracy.accuracyRate,
      }),
      status: 'active',
      expiresAt: new Date(predictedDate.getTime() + 12 * 60 * 60 * 1000), // 12 hours after prediction time
    });
    return 'created';
  } catch (error) {
    console.log(`[PredictionEngine] Pattern for ${pattern.resourceKey} may already exist`);
    return 'duplicate';
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
        await storage.updateOutagePrediction(prediction.id, { status: 'expired' });
        expired++;
        continue;
      }
      
      const predictedDate = new Date(prediction.predictedStartAt);
      const expiryDate = prediction.expiresAt ? new Date(prediction.expiresAt) : null;
      const validationHours = PREDICTION_CONFIG.VALIDATION_WINDOW_HOURS;
      const windowEnd = new Date(predictedDate.getTime() + validationHours * 60 * 60 * 1000);
      
      // Apply fallback expiry: if no expiresAt is set and prediction is > 3 days old, expire it
      const fallbackExpiryDate = new Date(predictedDate.getTime() + 3 * 24 * 60 * 60 * 1000);
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
      if (now > windowEnd) {
        const windowStart = new Date(predictedDate.getTime() - validationHours * 60 * 60 * 1000);
        
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
          await storage.updateOutagePrediction(prediction.id, { 
            status: 'validated',
            actualIncidentId 
          });
          validated++;
          // Invalidate accuracy cache so next predictions use updated data
          cachedAccuracy = null;
        } else {
          await storage.updateOutagePrediction(prediction.id, { 
            status: 'invalidated' 
          });
          invalidated++;
          cachedAccuracy = null;
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

// Update confidence levels for existing predictions
export async function updatePredictionConfidence(): Promise<number> {
  console.log('[PredictionEngine] Updating prediction confidence levels...');
  
  let updated = 0;
  
  try {
    const allPredictions = await storage.getAllOutagePredictions();
    const predictions = allPredictions.filter(p => p.status === 'active');
    const accuracy = await getPredictionAccuracy();
    
    const vendorAggregated = await storage.aggregateTelemetryForPredictions('vendor');
    const blockchainAggregated = await storage.aggregateTelemetryForPredictions('blockchain');
    
    const vendorMap = new Map(vendorAggregated.map(a => [a.resourceKey, a]));
    const blockchainMap = new Map(blockchainAggregated.map(a => [a.resourceKey, a]));
    
    for (const prediction of predictions) {
      const resourceKey = prediction.vendorKey || prediction.chainKey;
      const resourceType = prediction.resourceType;
      
      if (!resourceKey) continue;
      
      const aggregateMap = resourceType === 'vendor' ? vendorMap : blockchainMap;
      const resourceData = aggregateMap.get(resourceKey);
      
      if (!resourceData) continue;
      
      // Use logarithmic confidence calculation
      const logIncidents = Math.log2(resourceData.totalIncidents + 1);
      const incidentConfidence = Math.min(0.4, logIncidents * 0.08);
      const frequencyConfidence = Math.min(0.2, resourceData.avgIncidentCount * 0.2);
      const accuracyAdjustment = (accuracy.accuracyRate - 0.5) * 0.15;
      
      const newConfidence = Math.min(0.92, Math.max(0.35, 0.35 + incidentConfidence + frequencyConfidence + accuracyAdjustment));
      const currentConfidence = parseFloat(prediction.confidence);
      
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

// Clear all low-quality predictions and regenerate with improved algorithm
export async function regeneratePredictions(): Promise<{ cleared: number; created: number }> {
  console.log('[PredictionEngine] Regenerating all predictions with improved algorithm...');
  
  try {
    // Clear all active predictions (validated/invalidated ones are kept for accuracy tracking)
    const allPredictions = await storage.getAllOutagePredictions();
    let cleared = 0;
    
    for (const prediction of allPredictions) {
      if (prediction.status === 'active') {
        await storage.deletePrediction(prediction.id);
        cleared++;
      }
    }
    
    console.log(`[PredictionEngine] Cleared ${cleared} active predictions`);
    
    // Regenerate with improved algorithm
    await generatePredictions();
    
    // Count new predictions
    const newPredictions = await storage.getActivePredictions();
    
    console.log(`[PredictionEngine] Regeneration complete: cleared ${cleared}, created ${newPredictions.length}`);
    return { cleared, created: newPredictions.length };
  } catch (error) {
    console.error('[PredictionEngine] Error regenerating predictions:', error);
    return { cleared: 0, created: 0 };
  }
}
