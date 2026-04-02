import { storage } from "./storage";
import { fetchWithRetry } from "./retryUtil";
import { notifyNewBlockchainIncident, notifyBlockchainIncidentUpdate, notifyBlockchainIncidentResolved } from "./notificationDispatcher";
import { OrchestratorEngine } from "./orchestrator";
import { confirmBlockchainIncident, cleanupStalePendingIncidents } from "./incidentConfirmation";
import { autoCreateBlockchainWarRoom, handleIncidentResolved } from "./warRoom";
import type { BlockchainChain } from "@shared/schema";

const orchestrator = new OrchestratorEngine();

interface StatusPageResponse {
  status: {
    indicator: string;
    description: string;
  };
}

interface BlockchainIncidentData {
  id: string;
  name: string;
  status: string;
  impact: string;
  shortlink?: string;
  created_at: string;
  updated_at: string;
}

interface BlockchainMaintenanceData {
  id: string;
  name: string;
  status: string;
  impact: string;
  shortlink?: string;
  scheduled_for: string;
  scheduled_until?: string;
  started_at?: string;
  completed_at?: string;
}

const BLOCKCHAIN_STATUSPAGE_URLS: Record<string, string> = {
  // Chains
  solana: "https://status.solana.com",
  avalanche: "https://status.avax.network",
  polygon: "https://status.polygon.technology",
  stellar: "https://status.stellar.org",
  near: "https://status.nearprotocol.com",
  sui: "https://status.sui.io",
  aptos: "https://status.aptoslabs.com",
  celo: "https://status.celo.org",
  // L2s
  arbitrum: "https://arbitrum.statuspage.io",
  optimism: "https://status.optimism.io",
  base: "https://status.base.org",
  zksync: "https://status.zksync.io",
  scroll: "https://status.scroll.io",
  linea: "https://status.linea.build",
  mode: "https://status.mode.network",
  mantle: "https://status.mantle.xyz",
  // RPC Providers
  infura: "https://status.infura.io",
  alchemy: "https://status.alchemy.com",
  quicknode: "https://status.quicknode.com",
  thegraph: "https://status.thegraph.com",
  // Wallets
  metamask: "https://status.infura.io",
  ledger: "https://status.ledger.com",
  coinbasewallet: "https://status.coinbase.com",
  argent: "https://argentxwallet.statuspage.io",
  gnosissafe: "https://safe.statuspage.io",
  bybitwallet: "https://bybit.statuspage.io",
  phantom: "https://status.phantom.app",
  trezor: "https://status.trezor.io",
  okxwallet: "https://status.okx.com",
  exodus: "https://status.exodus.com",
  uniswap: "https://status.uniswap.org",
  // Staking - CEXs
  coinbase: "https://status.coinbase.com",
  kraken: "https://status.kraken.com",
  gemini: "https://status.gemini.com",
  cryptocom: "https://status.crypto.com",
  bybit: "https://bybit.statuspage.io",
  // Staking - Infrastructure
  figment: "https://status.figment.io",
  ankr: "https://status.ankr.com",
  kiln: "https://status.kiln.fi",
  allnodes: "https://status.allnodes.com",
  blockdaemon: "https://status.blockdaemon.com",
  everstake: "https://status.everstake.one",
  chorusone: "https://status.chorus.one",
  p2p: "https://status.p2p.org",
  stakefish: "https://status.stake.fish",
};

function mapStatusIndicator(indicator: string): string {
  switch (indicator?.toLowerCase()) {
    case 'none':
    case 'operational':
      return 'operational';
    case 'minor':
      return 'degraded';
    case 'major':
      return 'partial_outage';
    case 'critical':
      return 'major_outage';
    default:
      return 'operational';
  }
}

function mapIncidentType(impact: string): string {
  switch (impact?.toLowerCase()) {
    case 'critical':
      return 'block_halt';
    case 'major':
      return 'rpc_unavailable';
    case 'minor':
      return 'congestion';
    default:
      return 'dependency_failure';
  }
}

function mapSeverity(impact: string): string {
  switch (impact?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'major':
      return 'major';
    case 'minor':
      return 'minor';
    default:
      return 'minor';
  }
}

async function fetchStatuspageStatus(chain: { key: string; statusUrl?: string | null }): Promise<{
  status: string;
  incidents: BlockchainIncidentData[];
  maintenances: BlockchainMaintenanceData[];
  success: boolean;
  errorMessage?: string;
}> {
  const apiBase = BLOCKCHAIN_STATUSPAGE_URLS[chain.key] || chain.statusUrl?.replace(/\/$/, '');
  
  if (!apiBase) {
    return { status: 'unknown', incidents: [], maintenances: [], success: false, errorMessage: 'No status URL configured' };
  }
  
  try {
    const statusUrl = `${apiBase}/api/v2/status.json`;
    const response = await fetchWithRetry(statusUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VendorWatch/1.0'
      },
    });
    
    if (!response.ok) {
      console.log(`[blockchain:${chain.key}] Status page returned ${response.status}`);
      return { status: 'unknown', incidents: [], maintenances: [], success: false, errorMessage: `HTTP ${response.status}` };
    }
    
    const data: StatusPageResponse = await response.json();
    const status = mapStatusIndicator(data.status?.indicator);
    
    let incidents: BlockchainIncidentData[] = [];
    try {
      const incidentsUrl = `${apiBase}/api/v2/incidents.json`;
      const incidentsRes = await fetchWithRetry(incidentsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VendorWatch/1.0'
        },
      });
      if (incidentsRes.ok) {
        const incidentsData = await incidentsRes.json();
        const allIncidents: BlockchainIncidentData[] = incidentsData.incidents || [];
        const now = Date.now();
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        incidents = allIncidents.filter(inc => {
          if (inc.status !== 'resolved' && inc.status !== 'postmortem') return true;
          const resolvedAt = new Date(inc.updated_at).getTime();
          return (now - resolvedAt) < TWO_HOURS_MS;
        });
      }
    } catch (e) {
      console.log(`[blockchain:${chain.key}] Could not fetch incidents`);
    }
    
    let maintenances: BlockchainMaintenanceData[] = [];
    try {
      const maintenancesUrl = `${apiBase}/api/v2/scheduled_maintenances.json`;
      const maintenancesRes = await fetchWithRetry(maintenancesUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VendorWatch/1.0'
        },
      });
      if (maintenancesRes.ok) {
        const maintenancesData = await maintenancesRes.json();
        maintenances = maintenancesData.scheduled_maintenances || [];
      }
    } catch (e) {
      console.log(`[blockchain:${chain.key}] Could not fetch scheduled maintenances`);
    }
    
    return { status, incidents, maintenances, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[blockchain:${chain.key}] Failed to fetch status:`, errorMessage);
    return { status: 'unknown', incidents: [], maintenances: [], success: false, errorMessage };
  }
}

async function syncBlockchainChain(chainData: { key: string; name: string; sourceType: string; statusUrl?: string | null }): Promise<void> {
  console.log(`[blockchain:${chainData.key}] Syncing status...`);
  
  let result: { status: string; incidents: BlockchainIncidentData[]; maintenances: BlockchainMaintenanceData[]; success: boolean; errorMessage?: string };
  
  const hasStatuspageUrl = BLOCKCHAIN_STATUSPAGE_URLS[chainData.key] !== undefined;
  
  if (chainData.sourceType === 'statuspage' || chainData.sourceType === 'statuspage_json' || hasStatuspageUrl) {
    result = await fetchStatuspageStatus(chainData);
    
    if (!result.success && hasStatuspageUrl && chainData.sourceType !== 'statuspage') {
      console.log(`[blockchain:${chainData.key}] Statuspage API failed, updating timestamp only`);
      await storage.updateBlockchainChain(chainData.key, {
        lastChecked: new Date(),
      });
      return;
    }
  } else if (chainData.sourceType === 'manual' || chainData.sourceType === 'api') {
    await storage.updateBlockchainChain(chainData.key, {
      lastChecked: new Date(),
    });
    console.log(`[blockchain:${chainData.key}] No statuspage URL configured, timestamp updated`);
    return;
  } else {
    console.log(`[blockchain:${chainData.key}] Skipping - sourceType '${chainData.sourceType}' not yet supported`);
    return;
  }
  
  if (!result.success) {
    console.log(`[blockchain:${chainData.key}] Sync failed: ${result.errorMessage}`);
    await storage.updateBlockchainChain(chainData.key, { lastChecked: new Date() });
    return;
  }
  
  const fullChain = await storage.getBlockchainChain(chainData.key);
  if (!fullChain) {
    console.log(`[blockchain:${chainData.key}] Chain not found in database`);
    return;
  }
  
  // Get existing active incidents for this chain
  const existingIncidents = await storage.getBlockchainIncidentsByChain(chainData.key);
  const activeExistingIncidents = existingIncidents.filter(i => i.status !== 'resolved');
  
  // Filter out old incidents (older than 1 year) to avoid stale data from status pages
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentIncidents = result.incidents.filter(incident => {
    const createdDate = new Date(incident.created_at);
    if (createdDate < oneYearAgo) {
      console.log(`[blockchain:${chainData.key}] Ignoring old incident from ${createdDate.toISOString()}: ${incident.name}`);
      return false;
    }
    return true;
  });
  
  // Determine final status: if no recent incidents, treat as operational
  // This prevents false positives from status pages that show internal component degradation
  let finalStatus = result.status;
  if (recentIncidents.length === 0 && result.status !== 'operational') {
    console.log(`[blockchain:${chainData.key}] No recent incidents found, overriding status from '${result.status}' to 'operational'`);
    finalStatus = 'operational';
  }
  
  await storage.updateBlockchainChain(chainData.key, {
    status: finalStatus,
    lastChecked: new Date(),
  });
  
  console.log(`[blockchain:${chainData.key}] Status updated to: ${finalStatus}`);
  
  const unresolvedIncidentIds = new Set(recentIncidents.map(i => i.id));
  
  // Process current unresolved incidents
  for (const incident of recentIncidents) {
    const existing = existingIncidents.find(i => i.incidentId === incident.id);
    
    if (existing) {
      // Check if this incident was manually resolved - if so, only update if external source is newer
      if (existing.manuallyResolvedAt && incident.status !== 'resolved') {
        const externalUpdatedAt = new Date(incident.updated_at);
        if (externalUpdatedAt <= existing.manuallyResolvedAt) {
          console.log(`[blockchain:${chainData.key}] Skipping ${incident.name}: manually resolved, external update not newer`);
          continue;
        }
        console.log(`[blockchain:${chainData.key}] Reopening ${incident.name}: external source has newer update`);
      }
      
      if (existing.status !== incident.status) {
        const previousStatus = existing.status;
        const transitioningToResolved =
          (incident.status === 'resolved' || incident.status === 'postmortem') &&
          previousStatus !== 'resolved' && previousStatus !== 'postmortem';

        const updated = await storage.updateBlockchainIncident(existing.id, {
          status: incident.status,
          updatedAt: incident.updated_at,
          // Set resolvedAt when first transitioning to resolved/postmortem
          ...(transitioningToResolved ? { resolvedAt: new Date() } : {}),
          // Clear manuallyResolvedAt if we're updating from external source
          manuallyResolvedAt: null,
        });
        console.log(`[blockchain:${chainData.key}] Updated incident: ${incident.name}`);
        
        if (updated) {
          if (incident.status === 'resolved' || incident.status === 'postmortem') {
            await notifyBlockchainIncidentResolved(updated, fullChain);
            await orchestrator.processBlockchainIncident(updated, 'blockchainIncidentResolved');

            // Start War Room grace-period close when transitioning to resolved
            if (transitioningToResolved) {
              handleIncidentResolved(existing.id).catch(err =>
                console.error('[war-room] Failed to handle blockchain resolution (status-change):', err)
              );
            }
          } else {
            await notifyBlockchainIncidentUpdate(updated, fullChain, previousStatus);
            await orchestrator.processBlockchainIncident(updated, 'blockchainIncidentUpdate');
          }
        }
      }
    } else {
      const alreadyArchived = await storage.isBlockchainIncidentArchived(chainData.key, incident.id);
      if (alreadyArchived) {
        continue;
      }

      const hasStatuspageUrl = chainData.statuspageUrl && chainData.statuspageUrl.length > 0;
      if (!hasStatuspageUrl) {
        const isConfirmed = confirmBlockchainIncident(chainData.key, incident.id, incident);
        if (!isConfirmed) {
          console.log(`[blockchain:${chainData.key}] Pending confirmation: ${incident.name}`);
          continue;
        }
      }

      const newIncident = await storage.createBlockchainIncident({
        chainKey: chainData.key,
        incidentId: incident.id,
        incidentType: mapIncidentType(incident.impact),
        title: incident.name,
        status: incident.status,
        severity: mapSeverity(incident.impact),
        url: incident.shortlink,
        startedAt: incident.created_at,
        updatedAt: incident.updated_at,
      });
      console.log(`[blockchain:${chainData.key}] Created incident: ${incident.name}`);
      
      await notifyNewBlockchainIncident(newIncident, fullChain);
      await orchestrator.processBlockchainIncident(newIncident, 'newBlockchainIncident');

      // Auto-create War Room for P1/P2 blockchain incidents.
      // If already resolved when first detected, chain handleIncidentResolved immediately.
      if (incident.status === 'resolved' || incident.status === 'postmortem') {
        autoCreateBlockchainWarRoom(newIncident, fullChain)
          .then(() => handleIncidentResolved(newIncident.id))
          .catch(err => console.error('[war-room] Pre-resolved blockchain war room setup failed:', err));
      } else {
        autoCreateBlockchainWarRoom(newIncident, fullChain).catch(err =>
          console.error('[war-room] Failed to auto-create blockchain war room:', err)
        );
      }
    }
  }
  
  // Resolve incidents that are no longer in the unresolved list
  for (const existing of activeExistingIncidents) {
    if (!unresolvedIncidentIds.has(existing.incidentId)) {
      const updated = await storage.updateBlockchainIncident(existing.id, {
        status: 'resolved',
        resolvedAt: new Date(),
      });
      console.log(`[blockchain:${chainData.key}] Auto-resolved incident: ${existing.title}`);
      
      if (updated) {
        await notifyBlockchainIncidentResolved(updated, fullChain);
        await orchestrator.processBlockchainIncident(updated, 'blockchainIncidentResolved');

        // Trigger War Room grace-period close if one was open
        handleIncidentResolved(existing.id).catch(err =>
          console.error('[war-room] Failed to handle blockchain incident resolution:', err)
        );

        // Auto-generate blog post for significant blockchain incidents
        if (existing.severity === 'critical' || existing.severity === 'major') {
          import('./blogService').then(({ generateBlogPostForBlockchain }) => {
            generateBlogPostForBlockchain(existing.id).then(post => {
              console.log(`[blog] Auto-generated draft for blockchain incident: ${existing.title} → slug: ${post.slug}`);
            }).catch(err => {
              console.log(`[blog] Skipped blockchain auto-generation for ${existing.title}: ${err.message}`);
            });
          }).catch(() => {});
        }
      }
    }
  }
  
  // Process scheduled maintenances
  if (result.maintenances && result.maintenances.length > 0) {
    for (const maint of result.maintenances) {
      let maintenanceStatus = 'scheduled';
      if (maint.status === 'in_progress') maintenanceStatus = 'in_progress';
      else if (maint.status === 'verifying') maintenanceStatus = 'verifying';
      else if (maint.status === 'completed') maintenanceStatus = 'completed';
      
      await storage.upsertBlockchainMaintenance({
        chainKey: chainData.key,
        maintenanceId: maint.id,
        title: maint.name,
        description: undefined,
        status: maintenanceStatus,
        impact: maint.impact || 'maintenance',
        url: maint.shortlink || chainData.statusUrl || undefined,
        scheduledStartAt: maint.scheduled_for,
        scheduledEndAt: maint.scheduled_until || undefined,
        actualStartAt: maint.started_at || undefined,
        actualEndAt: maint.completed_at || undefined,
        affectedServices: undefined,
        rawHash: undefined,
      });
      console.log(`[blockchain:${chainData.key}] Maintenance: ${maint.name} [${maintenanceStatus}]`);
    }
  }
}

const BLOCKCHAIN_BATCH_SIZE = 30;
const PER_CHAIN_TIMEOUT_MS = 12000;

function withChainTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

export async function syncAllBlockchainChains(limit?: number): Promise<void> {
  console.log('[blockchain] Starting blockchain status sync...');
  
  const chains = await storage.getBlockchainChains();
  const filteredChains = chains.filter(c => 
    c.sourceType === 'statuspage' || c.sourceType === 'statuspage_json' || c.sourceType === 'manual' || c.sourceType === 'api'
  );
  
  const sortedChains = filteredChains.sort((a, b) => {
    const aTime = a.lastChecked ? new Date(a.lastChecked).getTime() : 0;
    const bTime = b.lastChecked ? new Date(b.lastChecked).getTime() : 0;
    return aTime - bTime;
  });
  
  const supportedChains = limit ? sortedChains.slice(0, limit) : sortedChains;
  
  console.log(`[blockchain] Syncing ${supportedChains.length}/${filteredChains.length} chains${limit ? ' (staggered)' : ''}`);
  
  const INTER_BATCH_DELAY_MS = 300;
  for (let i = 0; i < supportedChains.length; i += BLOCKCHAIN_BATCH_SIZE) {
    const batch = supportedChains.slice(i, i + BLOCKCHAIN_BATCH_SIZE);
    await Promise.allSettled(batch.map(async (chain) => {
      try {
        await withChainTimeout(syncBlockchainChain(chain), PER_CHAIN_TIMEOUT_MS, `blockchain:${chain.key}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[blockchain:${chain.key}] Sync error: ${msg}`);
      }
    }));
    if (i + BLOCKCHAIN_BATCH_SIZE < supportedChains.length) {
      await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY_MS));
    }
  }
  
  cleanupStalePendingIncidents();
  
  try {
    await storage.upsertHealthState('blockchain_sync', {
      status: 'healthy',
      lastRunAt: new Date(),
      lastSuccessAt: new Date(),
      consecutiveFailures: 0,
    });
  } catch (e) {
    console.error('[health] Failed to update blockchain_sync health state:', e);
  }
  
  console.log('[blockchain] Blockchain status sync complete');
}

export async function syncSingleBlockchainChain(chainKey: string): Promise<{ success: boolean; message: string }> {
  const chain = await storage.getBlockchainChain(chainKey);
  if (!chain) {
    return { success: false, message: 'Chain not found' };
  }
  
  try {
    await syncBlockchainChain(chain);
    return { success: true, message: `Synced ${chain.name}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

export async function resolveStaleBlockchainIncidents(staleDays: number = 7): Promise<{ resolved: number }> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - staleDays);
  const now = new Date();
  
  let resolved = 0;
  
  const chains = await storage.getBlockchainChains();
  for (const chain of chains) {
    const incidents = await storage.getBlockchainIncidentsByChain(chain.key);
    for (const incident of incidents) {
      if (incident.status !== 'resolved') {
        const updatedAt = new Date(incident.updatedAt);
        if (updatedAt < staleThreshold) {
          // Set manuallyResolvedAt to prevent sync from reopening
          await storage.updateBlockchainIncident(incident.id, { 
            status: 'resolved',
            manuallyResolvedAt: now
          });
          console.log(`[stale-cleanup] Auto-resolved blockchain: ${incident.title} (last updated ${updatedAt.toISOString()})`);
          resolved++;
        }
      }
    }
  }
  
  return { resolved };
}
