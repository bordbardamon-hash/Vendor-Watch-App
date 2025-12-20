import { storage } from "./storage";

interface StatusPageResponse {
  status: {
    indicator: string;
    description: string;
  };
}

interface IncidentsResponse {
  incidents: Array<{
    id: string;
    name: string;
    status: string;
    impact: string;
    shortlink: string;
    created_at: string;
    updated_at: string;
  }>;
}

const STATUSPAGE_API_URLS: Record<string, string> = {
  cloudflare: "https://www.cloudflarestatus.com",
  okta: "https://status.okta.com",
  zoom: "https://status.zoom.us",
  atlassian: "https://status.atlassian.com",
  connectwise: "https://status.connectwise.com",
  sentinelone: "https://status.sentinelone.com",
  auth0: "https://status.auth0.com",
  slack: "https://status.slack.com",
  hubspot: "https://status.hubspot.com",
  fastly: "https://status.fastly.com",
  akamai: "https://www.akamaistatus.com",
  pingidentity: "https://status.pingidentity.com",
};

function mapStatusIndicator(indicator: string): string {
  switch (indicator?.toLowerCase()) {
    case 'none':
    case 'operational':
      return 'operational';
    case 'minor':
      return 'degraded';
    case 'major':
    case 'critical':
      return 'outage';
    default:
      return 'operational';
  }
}

function mapImpactToSeverity(impact: string): string {
  switch (impact?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'major':
      return 'major';
    case 'minor':
      return 'minor';
    case 'none':
      return 'minor';
    default:
      return 'minor';
  }
}

async function fetchStatuspageJson(vendor: { key: string; statusUrl: string }): Promise<{ status: string; incidents: any[]; success: boolean }> {
  const apiBase = STATUSPAGE_API_URLS[vendor.key] || vendor.statusUrl.replace(/\/$/, '');
  
  try {
    const statusUrl = `${apiBase}/api/v2/status.json`;
    const response = await fetch(statusUrl, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'VendorWatch/1.0'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.log(`[${vendor.key}] Status page returned ${response.status}`);
      return { status: 'unknown', incidents: [], success: false };
    }
    
    const data: StatusPageResponse = await response.json();
    const status = mapStatusIndicator(data.status?.indicator);
    
    let incidents: any[] = [];
    try {
      const incidentsUrl = `${apiBase}/api/v2/incidents/unresolved.json`;
      const incidentsRes = await fetch(incidentsUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'VendorWatch/1.0'
        },
        signal: AbortSignal.timeout(10000)
      });
      if (incidentsRes.ok) {
        const incidentsData: IncidentsResponse = await incidentsRes.json();
        incidents = incidentsData.incidents || [];
      }
    } catch (e) {
      console.log(`[${vendor.key}] Could not fetch incidents`);
    }
    
    return { status, incidents, success: true };
  } catch (error) {
    console.log(`[${vendor.key}] Failed to fetch status:`, error instanceof Error ? error.message : 'Unknown error');
    return { status: 'unknown', incidents: [], success: false };
  }
}

export async function syncVendorStatus(vendorKey?: string): Promise<{ synced: number; errors: string[]; skipped: number }> {
  const vendors = vendorKey 
    ? [await storage.getVendor(vendorKey)].filter(Boolean)
    : await storage.getVendors();
  
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];
  
  for (const vendor of vendors) {
    if (!vendor) continue;
    
    if (vendor.parser !== 'statuspage_json') {
      console.log(`⊘ ${vendor.name}: skipped (no API parser configured)`);
      skipped++;
      continue;
    }
    
    try {
      const result = await fetchStatuspageJson(vendor);
      
      if (result.success) {
        const existingIncidents = await storage.getIncidentsByVendor(vendor.key);
        const activeIncidentIds = new Set(result.incidents.map((i: any) => i.id));
        
        for (const existing of existingIncidents) {
          if (!activeIncidentIds.has(existing.incidentId) && existing.status !== 'resolved') {
            await storage.updateIncident(existing.id, { status: 'resolved' });
            console.log(`  → Resolved incident: ${existing.title}`);
          }
        }
        
        for (const incident of result.incidents) {
          const exists = existingIncidents.find(i => i.incidentId === incident.id);
          
          if (!exists) {
            await storage.createIncident({
              vendorKey: vendor.key,
              incidentId: incident.id,
              title: incident.name,
              status: incident.status,
              severity: mapImpactToSeverity(incident.impact),
              impact: incident.impact || '',
              url: incident.shortlink || vendor.statusUrl,
              startedAt: incident.created_at,
              updatedAt: incident.updated_at,
              rawHash: null
            });
            console.log(`  → New incident: ${incident.name}`);
          } else if (exists.status !== incident.status) {
            await storage.updateIncident(exists.id, { status: incident.status });
          }
        }
        
        let finalStatus = result.status;
        if (result.incidents.length === 0) {
          finalStatus = 'operational';
        }
        
        await storage.updateVendor(vendor.key, {
          status: finalStatus,
          lastChecked: new Date()
        });
        
        synced++;
        console.log(`✓ Synced ${vendor.name}: ${finalStatus}`);
      } else {
        await storage.updateVendor(vendor.key, {
          lastChecked: new Date()
        });
        console.log(`⚠ ${vendor.name}: could not fetch status (keeping previous)`);
      }
    } catch (error) {
      const msg = `Failed to sync ${vendor.name}: ${error instanceof Error ? error.message : 'Unknown'}`;
      errors.push(msg);
      console.error(`✗ ${msg}`);
    }
  }
  
  return { synced, errors, skipped };
}

export async function getVendorStatuses(): Promise<Array<{ key: string; name: string; status: string; lastChecked: Date | null }>> {
  const vendors = await storage.getVendors();
  return vendors.map(v => ({
    key: v.key,
    name: v.name,
    status: v.status,
    lastChecked: v.lastChecked
  }));
}
