import { db } from './db';
import { syntheticProbes, syntheticProbeResults, incidents, type SyntheticProbe } from '@shared/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { storage } from './storage';
import { dispatchProbeAlert } from './notificationDispatcher';

interface ProbeResult {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  correlatedIncidentId: string | null;
}

const CONSECUTIVE_FAILURES_THRESHOLD = 3;

interface ProbeAlertState {
  consecutiveDown: number;
  consecutiveDegraded: number;
  alerted: boolean;
  alertedStatus: 'down' | 'degraded' | null;
}

const probeAlertStates = new Map<string, ProbeAlertState>();

function getAlertState(probeId: string): ProbeAlertState {
  let state = probeAlertStates.get(probeId);
  if (!state) {
    state = { consecutiveDown: 0, consecutiveDegraded: 0, alerted: false, alertedStatus: null };
    probeAlertStates.set(probeId, state);
  }
  return state;
}

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

export async function runSyntheticProbe(probeId: string): Promise<ProbeResult> {
  const probe = await storage.getSyntheticProbe(probeId);
  if (!probe) {
    throw new Error('Probe not found');
  }
  
  const startTime = Date.now();
  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  let latencyMs: number | null = null;
  let statusCode: number | null = null;
  let errorMessage: string | null = null;
  let correlatedIncidentId: string | null = null;
  
  const targetUrl = normalizeUrl(probe.targetUrl);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), probe.timeoutMs);
    
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'VendorWatch-SyntheticMonitor/1.0',
      },
    });
    
    clearTimeout(timeout);
    latencyMs = Date.now() - startTime;
    statusCode = response.status;
    
    if (response.status === probe.expectedStatus) {
      if (latencyMs > 5000) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
    } else if (response.status >= 500) {
      status = 'down';
    } else if (response.status >= 400) {
      status = 'degraded';
    }
  } catch (error: any) {
    latencyMs = Date.now() - startTime;
    status = 'down';
    errorMessage = error.message || 'Unknown error';
    
    if (error.name === 'AbortError') {
      errorMessage = `Request timeout after ${probe.timeoutMs}ms`;
    }
  }
  
  const activeIncidents = await db.select().from(incidents)
    .where(and(
      eq(incidents.vendorKey, probe.vendorKey),
      eq(incidents.status, 'investigating')
    ));
  
  if (activeIncidents.length > 0) {
    correlatedIncidentId = activeIncidents[0].id;
  }
  
  await storage.createSyntheticProbeResult({
    probeId,
    status,
    latencyMs,
    statusCode,
    errorMessage,
    correlatedIncidentId,
  });
  
  await db.update(syntheticProbes)
    .set({
      lastCheckedAt: new Date(),
      lastStatus: status,
      lastLatencyMs: latencyMs,
    })
    .where(eq(syntheticProbes.id, probeId));
  
  await evaluateProbeAlerts(probe, status, latencyMs, statusCode, errorMessage);
  
  return { status, latencyMs, statusCode, errorMessage, correlatedIncidentId };
}

async function evaluateProbeAlerts(
  probe: SyntheticProbe,
  status: 'healthy' | 'degraded' | 'down',
  latencyMs: number | null,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  const state = getAlertState(probe.id);

  if (status === 'down') {
    state.consecutiveDown++;
    state.consecutiveDegraded = 0;
  } else if (status === 'degraded') {
    state.consecutiveDegraded++;
    state.consecutiveDown = 0;
  } else {
    if (state.alerted) {
      console.log(`[probe-alert] Probe "${probe.name}" recovered to healthy`);
      dispatchProbeAlert({
        probe,
        alertType: 'recovery',
        currentStatus: 'healthy',
        previousStatus: state.alertedStatus || 'down',
        latencyMs,
        statusCode,
        errorMessage: null,
        consecutiveFailures: 0,
      }).catch(err => console.error('[probe-alert] Recovery dispatch error:', err));
    }
    state.consecutiveDown = 0;
    state.consecutiveDegraded = 0;
    state.alerted = false;
    state.alertedStatus = null;
    return;
  }

  if (status === 'down' && state.consecutiveDown >= CONSECUTIVE_FAILURES_THRESHOLD && !state.alerted) {
    console.log(`[probe-alert] Probe "${probe.name}" DOWN for ${state.consecutiveDown} consecutive checks`);
    state.alerted = true;
    state.alertedStatus = 'down';
    dispatchProbeAlert({
      probe,
      alertType: 'down',
      currentStatus: 'down',
      previousStatus: 'healthy',
      latencyMs,
      statusCode,
      errorMessage,
      consecutiveFailures: state.consecutiveDown,
    }).catch(err => console.error('[probe-alert] Down dispatch error:', err));
  }

  if (status === 'degraded' && state.consecutiveDegraded >= CONSECUTIVE_FAILURES_THRESHOLD && !state.alerted) {
    console.log(`[probe-alert] Probe "${probe.name}" DEGRADED for ${state.consecutiveDegraded} consecutive checks`);
    state.alerted = true;
    state.alertedStatus = 'degraded';
    dispatchProbeAlert({
      probe,
      alertType: 'degraded',
      currentStatus: 'degraded',
      previousStatus: 'healthy',
      latencyMs,
      statusCode,
      errorMessage,
      consecutiveFailures: state.consecutiveDegraded,
    }).catch(err => console.error('[probe-alert] Degraded dispatch error:', err));
  }

  if (state.alerted && state.alertedStatus === 'degraded' && status === 'down' && state.consecutiveDown >= CONSECUTIVE_FAILURES_THRESHOLD) {
    console.log(`[probe-alert] Probe "${probe.name}" ESCALATED from degraded to down`);
    state.alertedStatus = 'down';
    dispatchProbeAlert({
      probe,
      alertType: 'down',
      currentStatus: 'down',
      previousStatus: 'degraded',
      latencyMs,
      statusCode,
      errorMessage,
      consecutiveFailures: state.consecutiveDown,
    }).catch(err => console.error('[probe-alert] Escalation dispatch error:', err));
  }
}

export async function runAllActiveProbes(): Promise<{ total: number; healthy: number; degraded: number; down: number }> {
  const allProbes = await db.select().from(syntheticProbes).where(eq(syntheticProbes.isActive, true));
  
  let healthy = 0;
  let degraded = 0;
  let down = 0;
  
  for (const probe of allProbes) {
    try {
      const result = await runSyntheticProbe(probe.id);
      switch (result.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'down':
          down++;
          break;
      }
    } catch (error) {
      console.error(`[synthetic] Error running probe ${probe.id}:`, error);
      down++;
    }
  }
  
  return { total: allProbes.length, healthy, degraded, down };
}

export async function getProbeHealth(probeId: string, hours: number = 24): Promise<{
  uptimePercent: number;
  avgLatencyMs: number | null;
  checksTotal: number;
  checksHealthy: number;
  checksDegraded: number;
  checksDown: number;
}> {
  const since = new Date();
  since.setHours(since.getHours() - hours);
  
  const results = await db.select().from(syntheticProbeResults)
    .where(and(
      eq(syntheticProbeResults.probeId, probeId),
      gte(syntheticProbeResults.createdAt, since)
    ))
    .orderBy(desc(syntheticProbeResults.createdAt));
  
  if (results.length === 0) {
    return {
      uptimePercent: 100,
      avgLatencyMs: null,
      checksTotal: 0,
      checksHealthy: 0,
      checksDegraded: 0,
      checksDown: 0,
    };
  }
  
  let checksHealthy = 0;
  let checksDegraded = 0;
  let checksDown = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  
  for (const result of results) {
    switch (result.status) {
      case 'healthy':
        checksHealthy++;
        break;
      case 'degraded':
        checksDegraded++;
        break;
      case 'down':
        checksDown++;
        break;
    }
    
    if (result.latencyMs !== null) {
      totalLatency += result.latencyMs;
      latencyCount++;
    }
  }
  
  const checksTotal = results.length;
  const uptimePercent = ((checksHealthy + checksDegraded) / checksTotal) * 100;
  const avgLatencyMs = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null;
  
  return {
    uptimePercent: Math.round(uptimePercent * 100) / 100,
    avgLatencyMs,
    checksTotal,
    checksHealthy,
    checksDegraded,
    checksDown,
  };
}
