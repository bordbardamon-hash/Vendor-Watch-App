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

const CONSECUTIVE_DOWN_THRESHOLD = 5;
const CONSECUTIVE_RECOVERY_THRESHOLD = 5;
const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const DEGRADED_LATENCY_THRESHOLD_MS = 15000;
const PROBE_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

interface ProbeAlertState {
  consecutiveDown: number;
  consecutiveHealthy: number;
  alerted: boolean;
  lastAlertTime: number;
  initialized: boolean;
}

const probeAlertStates = new Map<string, ProbeAlertState>();

function getAlertState(probeId: string): ProbeAlertState {
  let state = probeAlertStates.get(probeId);
  if (!state) {
    state = {
      consecutiveDown: 0,
      consecutiveHealthy: 0,
      alerted: false,
      lastAlertTime: 0,
      initialized: false,
    };
    probeAlertStates.set(probeId, state);
  }
  return state;
}

async function initAlertStateFromHistory(probeId: string): Promise<ProbeAlertState> {
  const state = getAlertState(probeId);
  if (state.initialized) {
    return state;
  }
  state.initialized = true;

  try {
    const recentResults = await db.select().from(syntheticProbeResults)
      .where(eq(syntheticProbeResults.probeId, probeId))
      .orderBy(desc(syntheticProbeResults.createdAt))
      .limit(CONSECUTIVE_DOWN_THRESHOLD + 1);

    if (recentResults.length === 0) return state;

    let consecutiveDown = 0;
    for (const r of recentResults) {
      if (r.status === 'down') {
        consecutiveDown++;
      } else {
        break;
      }
    }

    if (consecutiveDown >= CONSECUTIVE_DOWN_THRESHOLD) {
      state.consecutiveDown = consecutiveDown;
      state.alerted = true;
      state.lastAlertTime = Date.now();
      console.log(`[probe-alert] Probe ${probeId} was already down (${consecutiveDown} recent failures), suppressing re-alert`);
    }
  } catch (err) {
    console.error(`[probe-alert] Error initializing alert state for probe ${probeId}:`, err);
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function httpProbe(targetUrl: string, timeoutMs: number): Promise<{ statusCode: number | null; latencyMs: number; errorMessage: string | null }> {
  const startTime = Date.now();
  try {
    const response = await fetch(targetUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'VendorWatch-SyntheticMonitor/1.0',
      },
      redirect: 'follow',
    });

    let latencyMs = Date.now() - startTime;

    if (response.status === 405) {
      const getStart = Date.now();
      const getResponse = await fetch(targetUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'VendorWatch-SyntheticMonitor/1.0',
        },
        redirect: 'follow',
      });
      latencyMs = Date.now() - getStart;
      return { statusCode: getResponse.status, latencyMs, errorMessage: null };
    }

    return { statusCode: response.status, latencyMs, errorMessage: null };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    let errorMessage = error.message || 'Unknown error';
    if (error.name === 'AbortError' || error.name === 'TimeoutError' || errorMessage.includes('timeout')) {
      errorMessage = `Request timeout after ${timeoutMs}ms`;
    }
    return { statusCode: null, latencyMs, errorMessage };
  }
}

export async function runSyntheticProbe(probeId: string): Promise<ProbeResult> {
  const probe = await storage.getSyntheticProbe(probeId);
  if (!probe) {
    throw new Error('Probe not found');
  }

  const targetUrl = normalizeUrl(probe.targetUrl);
  const timeoutMs = Math.min(probe.timeoutMs, PROBE_TIMEOUT_MS);

  let bestResult: { statusCode: number | null; latencyMs: number; errorMessage: string | null } | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(RETRY_DELAY_MS);
    }

    const result = await httpProbe(targetUrl, timeoutMs);

    if (result.statusCode !== null && result.statusCode === probe.expectedStatus && result.latencyMs < DEGRADED_LATENCY_THRESHOLD_MS) {
      bestResult = result;
      break;
    }

    if (!bestResult || (result.statusCode !== null && bestResult.statusCode === null)) {
      bestResult = result;
    } else if (result.statusCode !== null && bestResult.statusCode !== null) {
      if (result.latencyMs < bestResult.latencyMs) {
        bestResult = result;
      }
    }
  }

  const { statusCode, latencyMs, errorMessage } = bestResult!;

  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (statusCode === null) {
    status = 'down';
  } else if (statusCode === probe.expectedStatus) {
    if (latencyMs > DEGRADED_LATENCY_THRESHOLD_MS) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
  } else if (statusCode >= 500) {
    status = 'down';
  } else if (statusCode >= 400) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  let correlatedIncidentId: string | null = null;
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
  const state = await initAlertStateFromHistory(probe.id);
  const now = Date.now();

  if (status === 'down') {
    state.consecutiveDown++;
    state.consecutiveHealthy = 0;
  } else {
    state.consecutiveHealthy++;
    state.consecutiveDown = 0;

    if (state.alerted && state.consecutiveHealthy >= CONSECUTIVE_RECOVERY_THRESHOLD) {
      const timeSinceLastAlert = now - state.lastAlertTime;
      if (timeSinceLastAlert >= ALERT_COOLDOWN_MS) {
        console.log(`[probe-alert] Probe "${probe.name}" recovered (${state.consecutiveHealthy} consecutive healthy checks)`);
        state.lastAlertTime = now;
        dispatchProbeAlert({
          probe,
          alertType: 'recovery',
          currentStatus: 'healthy',
          previousStatus: 'down',
          latencyMs,
          statusCode,
          errorMessage: null,
          consecutiveFailures: 0,
        }).catch(err => console.error('[probe-alert] Recovery dispatch error:', err));
      }
      state.alerted = false;
    }
    return;
  }

  if (state.consecutiveDown >= CONSECUTIVE_DOWN_THRESHOLD && !state.alerted) {
    const timeSinceLastAlert = now - state.lastAlertTime;
    if (timeSinceLastAlert >= ALERT_COOLDOWN_MS) {
      console.log(`[probe-alert] Probe "${probe.name}" DOWN for ${state.consecutiveDown} consecutive checks`);
      state.alerted = true;
      state.lastAlertTime = now;
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
    } else {
      state.alerted = true;
    }
  }
}

let syncRunning = false;

export function setSyncRunning(running: boolean): void {
  syncRunning = running;
}

export async function runAllActiveProbes(): Promise<{ total: number; healthy: number; degraded: number; down: number }> {
  if (syncRunning) {
    console.log('[probes] Skipping probe cycle — vendor/blockchain sync in progress');
    return { total: 0, healthy: 0, degraded: 0, down: 0 };
  }

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
