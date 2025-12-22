import { storage } from "./storage";
import { dispatchLifecycleNotification, sendParserHealthAlert } from "./notificationDispatcher";
import { fetchWithRetry } from "./retryUtil";
import { mapStatuspageImpact, mapStatuspageStatus, determineLifecycleEvent, shouldAlertForEvent } from "./statusNormalizer";
import { recordParseResult, shouldSendParserHealthAlert, markAlertSent, getParserHealthStatus } from "./parserHealthTracker";
import { scrapeVendorStatus } from "./htmlScraper";
import type { CanonicalSeverity, CanonicalStatus, LifecycleEvent } from "@shared/schema";

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
    incident_updates?: Array<{
      id: string;
      status: string;
      body: string;
      created_at: string;
      updated_at: string;
    }>;
    components?: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  }>;
}

const STATUSPAGE_API_URLS: Record<string, string> = {
  cloudflare: "https://www.cloudflarestatus.com",
  zoom: "https://status.zoom.us",
  atlassian: "https://status.atlassian.com",
  sentinelone: "https://status.sentinelone.com",
  hubspot: "https://status.hubspot.com",
  akamai: "https://www.akamaistatus.com",
  pingidentity: "https://status.pingidentity.com",
  veeam_datacloud: "https://vdcstatus.veeam.com",
  fireblocks: "https://status.fireblocks.com",
  quickbooks: "https://status.quickbooks.intuit.com",
  netsuite: "https://status.netsuite.com",
  kaseya: "https://status.kaseya.com",
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

async function fetchStatuspageJson(vendor: { key: string; statusUrl: string }): Promise<{ 
  status: string; 
  incidents: any[]; 
  success: boolean; 
  httpStatus?: number; 
  errorMessage?: string 
}> {
  const apiBase = STATUSPAGE_API_URLS[vendor.key] || vendor.statusUrl.replace(/\/$/, '');
  
  try {
    const statusUrl = `${apiBase}/api/v2/status.json`;
    const response = await fetchWithRetry(statusUrl, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'VendorWatch/1.0'
      },
    });
    
    if (!response.ok) {
      console.log(`[${vendor.key}] Status page returned ${response.status}`);
      await recordParseResult(vendor.key, { 
        success: false, 
        httpStatus: response.status, 
        errorMessage: `HTTP ${response.status}` 
      });
      return { status: 'unknown', incidents: [], success: false, httpStatus: response.status };
    }
    
    const data: StatusPageResponse = await response.json();
    const status = mapStatusIndicator(data.status?.indicator);
    
    let incidents: any[] = [];
    try {
      const incidentsUrl = `${apiBase}/api/v2/incidents/unresolved.json`;
      const incidentsRes = await fetchWithRetry(incidentsUrl, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'VendorWatch/1.0'
        },
      });
      if (incidentsRes.ok) {
        const incidentsData: IncidentsResponse = await incidentsRes.json();
        incidents = incidentsData.incidents || [];
      }
    } catch (e) {
      console.log(`[${vendor.key}] Could not fetch incidents`);
    }
    
    await recordParseResult(vendor.key, { 
      success: true, 
      httpStatus: 200, 
      incidentsParsed: incidents.length 
    });
    
    return { status, incidents, success: true, httpStatus: 200 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[${vendor.key}] Failed to fetch status:`, errorMessage);
    await recordParseResult(vendor.key, { 
      success: false, 
      errorMessage 
    });
    return { status: 'unknown', incidents: [], success: false, errorMessage };
  }
}

// AWS uses a different JSON format at status.aws.amazon.com/data.json
async function fetchAwsStatus(vendor: { key: string; statusUrl: string }): Promise<{ 
  status: string; 
  incidents: any[]; 
  success: boolean; 
  httpStatus?: number; 
  errorMessage?: string 
}> {
  try {
    const response = await fetchWithRetry("https://status.aws.amazon.com/data.json", {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'VendorWatch/1.0'
      },
    });
    
    if (!response.ok) {
      console.log(`[aws] Status page returned ${response.status}`);
      await recordParseResult(vendor.key, { 
        success: false, 
        httpStatus: response.status, 
        errorMessage: `HTTP ${response.status}` 
      });
      return { status: 'unknown', incidents: [], success: false, httpStatus: response.status };
    }
    
    // Read as text first to handle potential encoding issues
    const text = await response.text();
    
    // Handle empty response - AWS returns [] when there are no issues
    if (!text || text.trim() === '' || text.trim() === '[]') {
      await recordParseResult(vendor.key, { 
        success: true, 
        httpStatus: 200, 
        incidentsParsed: 0 
      });
      return { status: 'operational', incidents: [], success: true, httpStatus: 200 };
    }
    
    // Parse the JSON text
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.log(`[aws] JSON parse error, text starts with:`, text.substring(0, 50));
      await recordParseResult(vendor.key, { 
        success: false, 
        errorMessage: 'JSON parse error' 
      });
      return { status: 'unknown', incidents: [], success: false, errorMessage: 'JSON parse error' };
    }
    
    // AWS data.json returns an array of service entries or events
    // The format is: { archive: [...events] } or just an array
    let incidents: any[] = [];
    let overallStatus = 'operational';
    
    if (Array.isArray(data)) {
      // If any current issues, mark as degraded
      if (data.length > 0) {
        overallStatus = 'degraded';
        incidents = data.slice(0, 10).map((item: any, idx: number) => ({
          id: item.id || `aws-${Date.now()}-${idx}`,
          name: item.summary || item.description || 'AWS Service Event',
          status: 'investigating',
          impact: 'minor',
          shortlink: vendor.statusUrl,
          created_at: item.date || new Date().toISOString(),
          updated_at: item.date || new Date().toISOString(),
        }));
      }
    } else if (data.current) {
      // Some AWS endpoints have { current: [...events] }
      incidents = (data.current || []).map((item: any, idx: number) => ({
        id: item.id || `aws-${Date.now()}-${idx}`,
        name: item.summary || item.service_name || 'AWS Service Event',
        status: 'investigating',
        impact: item.severity || 'minor',
        shortlink: vendor.statusUrl,
        created_at: item.date || new Date().toISOString(),
        updated_at: item.date || new Date().toISOString(),
      }));
      if (incidents.length > 0) overallStatus = 'degraded';
    }
    
    await recordParseResult(vendor.key, { 
      success: true, 
      httpStatus: 200, 
      incidentsParsed: incidents.length 
    });
    
    return { status: overallStatus, incidents, success: true, httpStatus: 200 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[aws] Failed to fetch status:`, errorMessage);
    await recordParseResult(vendor.key, { 
      success: false, 
      errorMessage 
    });
    return { status: 'unknown', incidents: [], success: false, errorMessage };
  }
}

// Slack uses a custom API format at status.slack.com/api/v2.0.0/current
async function fetchSlackStatus(vendor: { key: string; statusUrl: string }): Promise<{ 
  status: string; 
  incidents: any[]; 
  success: boolean; 
  httpStatus?: number; 
  errorMessage?: string 
}> {
  try {
    const response = await fetchWithRetry("https://status.slack.com/api/v2.0.0/current", {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'VendorWatch/1.0'
      },
    });
    
    if (!response.ok) {
      console.log(`[slack] Status page returned ${response.status}`);
      await recordParseResult(vendor.key, { 
        success: false, 
        httpStatus: response.status, 
        errorMessage: `HTTP ${response.status}` 
      });
      return { status: 'unknown', incidents: [], success: false, httpStatus: response.status };
    }
    
    const data = await response.json();
    // Slack format: { status: "ok"|"active", active_incidents: [...] }
    const overallStatus = data.status === 'ok' ? 'operational' : 'degraded';
    const incidents = (data.active_incidents || []).map((inc: any) => ({
      id: inc.id || `slack-${Date.now()}`,
      name: inc.title || 'Slack Service Issue',
      status: 'investigating',
      impact: 'minor',
      shortlink: 'https://status.slack.com',
      created_at: inc.date_created || new Date().toISOString(),
      updated_at: inc.date_updated || new Date().toISOString(),
    }));
    
    await recordParseResult(vendor.key, { 
      success: true, 
      httpStatus: 200, 
      incidentsParsed: incidents.length 
    });
    
    return { status: overallStatus, incidents, success: true, httpStatus: 200 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[slack] Failed to fetch status:`, errorMessage);
    await recordParseResult(vendor.key, { 
      success: false, 
      errorMessage 
    });
    return { status: 'unknown', incidents: [], success: false, errorMessage };
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
    
    const validParsers = ['statuspage_json', 'aws_json', 'slack_json', 'manual', 'generic_html', 'html_scrape'];
    if (!validParsers.includes(vendor.parser)) {
      console.log(`⊘ ${vendor.name}: skipped (unknown parser: ${vendor.parser})`);
      skipped++;
      continue;
    }
    
    try {
      // Use appropriate parser based on vendor configuration
      let result;
      if (vendor.parser === 'aws_json') {
        result = await fetchAwsStatus(vendor);
      } else if (vendor.parser === 'slack_json') {
        result = await fetchSlackStatus(vendor);
      } else if (vendor.parser === 'manual' || vendor.parser === 'generic_html' || vendor.parser === 'html_scrape') {
        // Use HTML scraping for vendors without public APIs
        result = await scrapeVendorStatus(vendor);
      } else {
        result = await fetchStatuspageJson(vendor);
      }
      
      if (await shouldSendParserHealthAlert(vendor.key)) {
        console.log(`[parser-health] ALERT: Parser unhealthy for ${vendor.name}`);
        const healthStatus = await getParserHealthStatus(vendor.key);
        if (healthStatus) {
          await sendParserHealthAlert(vendor.key, healthStatus.consecutiveFailures, healthStatus.lastError);
        }
        await markAlertSent(vendor.key);
      }
      
      if (result.success) {
        const existingIncidents = await storage.getIncidentsByVendor(vendor.key);
        const activeIncidentIds = new Set(result.incidents.map((i: any) => i.id));
        
        for (const existing of existingIncidents) {
          if (!activeIncidentIds.has(existing.incidentId) && existing.status !== 'resolved') {
            const previousStatus = existing.status;
            const previousSeverity = existing.severity;
            await storage.updateIncident(existing.id, { status: 'resolved' });
            console.log(`  → Resolved incident: ${existing.title}`);
            
            const lifecycleEvent = determineLifecycleEvent(
              previousStatus,
              previousSeverity,
              'resolved' as CanonicalStatus,
              existing.severity as CanonicalSeverity,
              false
            );
            
            if (shouldAlertForEvent(lifecycleEvent)) {
              dispatchLifecycleNotification({
                incident: { ...existing, status: 'resolved' },
                vendor,
                lifecycleEvent,
                previousStatus,
                previousSeverity,
              }).catch(err => console.error('[notify] Failed to send resolution notification:', err));
            }
          }
        }
        
        for (const incident of result.incidents) {
          const exists = existingIncidents.find(i => i.incidentId === incident.id);
          const normalizedStatus = mapStatuspageStatus(incident.status);
          const normalizedSeverity = mapStatuspageImpact(incident.impact);
          const affectedComponents = incident.components?.map((c: { id: string; name: string; status: string }) => c.name).join(', ') || '';
          
          if (!exists) {
            const newIncident = await storage.createIncident({
              vendorKey: vendor.key,
              incidentId: incident.id,
              title: incident.name,
              status: normalizedStatus,
              severity: normalizedSeverity,
              impact: affectedComponents || incident.impact || '',
              url: incident.shortlink || vendor.statusUrl,
              startedAt: incident.created_at,
              updatedAt: incident.updated_at,
              rawHash: null
            });
            console.log(`  → New incident: ${incident.name} [${normalizedSeverity}/${normalizedStatus}]`);
            
            const lifecycleEvent = determineLifecycleEvent(null, null, normalizedStatus, normalizedSeverity, true);
            
            if (shouldAlertForEvent(lifecycleEvent)) {
              dispatchLifecycleNotification({
                incident: newIncident,
                vendor,
                lifecycleEvent,
                affectedServices: affectedComponents,
              }).catch(err => console.error('[notify] Failed to send new incident notification:', err));
            }
          } else {
            const statusChanged = exists.status !== normalizedStatus;
            const severityChanged = exists.severity !== normalizedSeverity;
            const updatedAtChanged = exists.updatedAt !== incident.updated_at;
            
            if (statusChanged || severityChanged || updatedAtChanged) {
              const previousStatus = exists.status;
              const previousSeverity = exists.severity;
              
              await storage.updateIncident(exists.id, { 
                status: normalizedStatus,
                severity: normalizedSeverity,
                updatedAt: incident.updated_at,
                impact: affectedComponents || incident.impact || exists.impact,
              });
              
              const lifecycleEvent = determineLifecycleEvent(
                previousStatus,
                previousSeverity,
                normalizedStatus,
                normalizedSeverity,
                false
              );
              
              console.log(`  → ${lifecycleEvent.toUpperCase()}: ${incident.name} [${previousSeverity}→${normalizedSeverity}, ${previousStatus}→${normalizedStatus}]`);
              
              if (shouldAlertForEvent(lifecycleEvent)) {
                dispatchLifecycleNotification({
                  incident: { ...exists, status: normalizedStatus, severity: normalizedSeverity },
                  vendor,
                  lifecycleEvent,
                  previousStatus,
                  previousSeverity,
                  affectedServices: affectedComponents,
                }).catch(err => console.error('[notify] Failed to send update notification:', err));
              }
            }
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
