import { storage } from "./storage";

interface StatusPageResponse {
  status: {
    indicator: string;
    description: string;
  };
  incidents?: Array<{
    id: string;
    name: string;
    status: string;
    impact: string;
    shortlink: string;
    created_at: string;
    updated_at: string;
  }>;
}

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

async function fetchStatuspageJson(vendor: { key: string; statusUrl: string }): Promise<{ status: string; incidents: any[] }> {
  try {
    const apiUrl = vendor.statusUrl.replace(/\/$/, '') + '/api/v2/status.json';
    const response = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.log(`[${vendor.key}] Status page returned ${response.status}`);
      return { status: 'operational', incidents: [] };
    }
    
    const data: StatusPageResponse = await response.json();
    const status = mapStatusIndicator(data.status?.indicator);
    
    let incidents: any[] = [];
    if (data.status?.indicator !== 'none') {
      try {
        const incidentsUrl = vendor.statusUrl.replace(/\/$/, '') + '/api/v2/incidents/unresolved.json';
        const incidentsRes = await fetch(incidentsUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });
        if (incidentsRes.ok) {
          const incidentsData = await incidentsRes.json();
          incidents = incidentsData.incidents || [];
        }
      } catch (e) {
        console.log(`[${vendor.key}] Could not fetch incidents`);
      }
    }
    
    return { status, incidents };
  } catch (error) {
    console.log(`[${vendor.key}] Failed to fetch status:`, error instanceof Error ? error.message : 'Unknown error');
    return { status: 'operational', incidents: [] };
  }
}

async function fetchAwsHealth(vendor: { key: string; statusUrl: string }): Promise<{ status: string; incidents: any[] }> {
  try {
    const response = await fetch('https://health.aws.amazon.com/public/currentevents', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      return { status: 'operational', incidents: [] };
    }
    
    const data = await response.json();
    const events = data.archive || [];
    
    const activeEvents = events.filter((e: any) => 
      e.status !== 'resolved' && e.status !== 'closed'
    );
    
    const status = activeEvents.length > 0 ? 'degraded' : 'operational';
    
    const incidents = activeEvents.slice(0, 5).map((event: any) => ({
      id: event.event_arn || event.id || `aws-${Date.now()}`,
      name: event.summary || event.service || 'AWS Service Event',
      status: event.status || 'investigating',
      impact: event.description || '',
      shortlink: 'https://health.aws.amazon.com/health/status',
      created_at: event.start_time || new Date().toISOString(),
      updated_at: event.last_update_time || new Date().toISOString()
    }));
    
    return { status, incidents };
  } catch (error) {
    console.log(`[aws] Failed to fetch AWS health:`, error instanceof Error ? error.message : 'Unknown error');
    return { status: 'operational', incidents: [] };
  }
}

async function fetchGenericStatus(vendor: { key: string; statusUrl: string }): Promise<{ status: string; incidents: any[] }> {
  return { status: 'operational', incidents: [] };
}

export async function syncVendorStatus(vendorKey?: string): Promise<{ synced: number; errors: string[] }> {
  const vendors = vendorKey 
    ? [await storage.getVendor(vendorKey)].filter(Boolean)
    : await storage.getVendors();
  
  let synced = 0;
  const errors: string[] = [];
  
  for (const vendor of vendors) {
    if (!vendor) continue;
    
    try {
      let result: { status: string; incidents: any[] };
      
      switch (vendor.parser) {
        case 'statuspage_json':
          result = await fetchStatuspageJson(vendor);
          break;
        case 'aws_health':
          result = await fetchAwsHealth(vendor);
          break;
        default:
          result = await fetchGenericStatus(vendor);
      }
      
      await storage.updateVendor(vendor.key, {
        status: result.status,
        lastChecked: new Date()
      });
      
      for (const incident of result.incidents) {
        const existingIncidents = await storage.getIncidentsByVendor(vendor.key);
        const exists = existingIncidents.some(i => i.incidentId === incident.id);
        
        if (!exists) {
          await storage.createIncident({
            vendorKey: vendor.key,
            incidentId: incident.id,
            title: incident.name,
            status: incident.status,
            severity: incident.impact || 'minor',
            impact: incident.impact || '',
            url: incident.shortlink || vendor.statusUrl,
            startedAt: incident.created_at,
            updatedAt: incident.updated_at,
            rawHash: null
          });
        }
      }
      
      synced++;
      console.log(`✓ Synced ${vendor.name}: ${result.status}`);
    } catch (error) {
      const msg = `Failed to sync ${vendor.name}: ${error instanceof Error ? error.message : 'Unknown'}`;
      errors.push(msg);
      console.error(`✗ ${msg}`);
    }
  }
  
  return { synced, errors };
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
