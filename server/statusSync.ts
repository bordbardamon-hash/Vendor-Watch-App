import { storage } from "./storage";
import { dispatchLifecycleNotification, sendParserHealthAlert } from "./notificationDispatcher";
import { fetchWithRetry } from "./retryUtil";
import { mapStatuspageImpact, mapStatuspageStatus, determineLifecycleEvent, shouldAlertForEvent } from "./statusNormalizer";
import { recordParseResult, shouldSendParserHealthAlert, markAlertSent, getParserHealthStatus } from "./parserHealthTracker";
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
