import { storage } from "./storage";
import { fetchWithRetry } from "./retryUtil";

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
  success: boolean;
  errorMessage?: string;
}> {
  const apiBase = BLOCKCHAIN_STATUSPAGE_URLS[chain.key] || chain.statusUrl?.replace(/\/$/, '');
  
  if (!apiBase) {
    return { status: 'unknown', incidents: [], success: false, errorMessage: 'No status URL configured' };
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
      return { status: 'unknown', incidents: [], success: false, errorMessage: `HTTP ${response.status}` };
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
    
    return { status, incidents, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[blockchain:${chain.key}] Failed to fetch status:`, errorMessage);
    return { status: 'unknown', incidents: [], success: false, errorMessage };
  }
}

async function syncBlockchainChain(chain: { key: string; name: string; sourceType: string; statusUrl?: string | null }): Promise<void> {
  console.log(`[blockchain:${chain.key}] Syncing status...`);
  
  let result: { status: string; incidents: BlockchainIncidentData[]; success: boolean; errorMessage?: string };
  
  if (chain.sourceType === 'statuspage') {
    result = await fetchStatuspageStatus(chain);
  } else {
    console.log(`[blockchain:${chain.key}] Skipping - sourceType '${chain.sourceType}' not yet supported`);
    return;
  }
  
  if (!result.success) {
    console.log(`[blockchain:${chain.key}] Sync failed: ${result.errorMessage}`);
    return;
  }
  
  await storage.updateBlockchainChain(chain.key, {
    status: result.status,
    lastChecked: new Date(),
  });
  
  console.log(`[blockchain:${chain.key}] Status updated to: ${result.status}`);
  
  for (const incident of result.incidents) {
    const existingIncidents = await storage.getBlockchainIncidentsByChain(chain.key);
    const existing = existingIncidents.find(i => i.incidentId === incident.id);
    
    if (existing) {
      if (existing.status !== incident.status) {
        await storage.updateBlockchainIncident(existing.id, {
          status: incident.status,
          updatedAt: incident.updated_at,
        });
        console.log(`[blockchain:${chain.key}] Updated incident: ${incident.name}`);
      }
    } else {
      await storage.createBlockchainIncident({
        chainKey: chain.key,
        incidentId: incident.id,
        incidentType: mapIncidentType(incident.impact),
        title: incident.name,
        status: incident.status,
        severity: mapSeverity(incident.impact),
        url: incident.shortlink,
        startedAt: incident.created_at,
        updatedAt: incident.updated_at,
      });
      console.log(`[blockchain:${chain.key}] Created incident: ${incident.name}`);
    }
  }
}

export async function syncAllBlockchainChains(): Promise<void> {
  console.log('[blockchain] Starting blockchain status sync...');
  
  const chains = await storage.getBlockchainChains();
  const statuspageChains = chains.filter(c => c.sourceType === 'statuspage');
  
  console.log(`[blockchain] Found ${statuspageChains.length} chains with statuspage integration`);
  
  for (const chain of statuspageChains) {
    try {
      await syncBlockchainChain(chain);
    } catch (error) {
      console.error(`[blockchain:${chain.key}] Sync error:`, error);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
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
