import { storage } from "./storage";
import { fetchWithRetry } from "./retryUtil";
import { notifyNewBlockchainIncident, notifyBlockchainIncidentUpdate, notifyBlockchainIncidentResolved } from "./notificationDispatcher";
import type { BlockchainChain } from "@shared/schema";

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
  solana: "https://status.solana.com",
  avalanche: "https://status.avax.network",
  arbitrum: "https://status.arbitrum.io",
  optimism: "https://status.optimism.io",
  base: "https://status.base.org",
  stellar: "https://status.stellar.org",
  infura: "https://status.infura.io",
  alchemy: "https://status.alchemy.com",
  quicknode: "https://status.quicknode.com",
  thegraph: "https://status.thegraph.com",
  metamask: "https://status.infura.io",
  ledger: "https://status.ledger.com",
  coinbasewallet: "https://status.coinbase.com",
  argent: "https://argentxwallet.statuspage.io",
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
      const incidentsUrl = `${apiBase}/api/v2/incidents/unresolved.json`;
      const incidentsRes = await fetchWithRetry(incidentsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VendorWatch/1.0'
        },
      });
      if (incidentsRes.ok) {
        const incidentsData = await incidentsRes.json();
        incidents = incidentsData.incidents || [];
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
  
  if (chainData.sourceType === 'statuspage') {
    result = await fetchStatuspageStatus(chainData);
  } else if (chainData.sourceType === 'manual' || chainData.sourceType === 'api') {
    await storage.updateBlockchainChain(chainData.key, {
      lastChecked: new Date(),
    });
    console.log(`[blockchain:${chainData.key}] Manual check completed (status preserved)`);
    return;
  } else {
    console.log(`[blockchain:${chainData.key}] Skipping - sourceType '${chainData.sourceType}' not yet supported`);
    return;
  }
  
  if (!result.success) {
    console.log(`[blockchain:${chainData.key}] Sync failed: ${result.errorMessage}`);
    return;
  }
  
  await storage.updateBlockchainChain(chainData.key, {
    status: result.status,
    lastChecked: new Date(),
  });
  
  console.log(`[blockchain:${chainData.key}] Status updated to: ${result.status}`);
  
  const fullChain = await storage.getBlockchainChain(chainData.key);
  if (!fullChain) {
    console.log(`[blockchain:${chainData.key}] Chain not found in database`);
    return;
  }
  
  // Get existing active incidents for this chain
  const existingIncidents = await storage.getBlockchainIncidentsByChain(chainData.key);
  const activeExistingIncidents = existingIncidents.filter(i => i.status !== 'resolved');
  const unresolvedIncidentIds = new Set(result.incidents.map(i => i.id));
  
  // Process current unresolved incidents
  for (const incident of result.incidents) {
    const existing = existingIncidents.find(i => i.incidentId === incident.id);
    
    if (existing) {
      if (existing.status !== incident.status) {
        const previousStatus = existing.status;
        const updated = await storage.updateBlockchainIncident(existing.id, {
          status: incident.status,
          updatedAt: incident.updated_at,
        });
        console.log(`[blockchain:${chainData.key}] Updated incident: ${incident.name}`);
        
        if (updated) {
          if (incident.status === 'resolved') {
            await notifyBlockchainIncidentResolved(updated, fullChain);
          } else {
            await notifyBlockchainIncidentUpdate(updated, fullChain, previousStatus);
          }
        }
      }
    } else {
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

export async function syncAllBlockchainChains(): Promise<void> {
  console.log('[blockchain] Starting blockchain status sync...');
  
  const chains = await storage.getBlockchainChains();
  const supportedChains = chains.filter(c => 
    c.sourceType === 'statuspage' || c.sourceType === 'manual' || c.sourceType === 'api'
  );
  
  console.log(`[blockchain] Found ${supportedChains.length} chains to sync`);
  
  for (const chain of supportedChains) {
    try {
      await syncBlockchainChain(chain);
    } catch (error) {
      console.error(`[blockchain:${chain.key}] Sync error:`, error);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
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
