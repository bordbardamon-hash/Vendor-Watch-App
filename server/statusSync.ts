import { storage } from "./storage";
import { dispatchLifecycleNotification, sendParserHealthAlert } from "./notificationDispatcher";
import { fetchWithRetry } from "./retryUtil";
import { mapStatuspageImpact, mapStatuspageStatus, determineLifecycleEvent, shouldAlertForEvent } from "./statusNormalizer";
import { recordParseResult, shouldSendParserHealthAlert, markAlertSent, getParserHealthStatus } from "./parserHealthTracker";
import { scrapeVendorStatus } from "./htmlScraper";
import { scrapeJsVendorStatus } from "./puppeteerScraper";
import { confirmVendorIncident, cleanupStalePendingIncidents } from "./incidentConfirmation";
import type { CanonicalSeverity, CanonicalStatus, LifecycleEvent } from "@shared/schema";
import { NEW_STATUSPAGE_URLS } from "./newVendors";
import { gunzipSync } from "zlib";

function isTimeoutError(msg: string): boolean {
  return msg.includes('timed out') || msg.includes('aborted due to timeout') || msg.includes('timeout');
}

function isValidIncident(incident: { name: string; id: string }): boolean {
  const title = incident.name || '';
  if (title.startsWith('_system') || title.startsWith('_metadata')) return false;
  if (title.includes('_system_metadata')) return false;
  if (/^eyJ[a-zA-Z0-9+/=]+/.test(title)) return false;
  if (title.length < 5 || title.length > 500) return false;
  return true;
}

interface StatusPageResponse {
  status: {
    indicator: string;
    description: string;
  };
  components?: Array<{
    id: string;
    name: string;
    description?: string;
    group_id?: string;
    status: string;
    position?: number;
    group?: boolean;
  }>;
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

// Only include vendors with verified working Statuspage.io API endpoints
const STATUSPAGE_API_URLS: Record<string, string> = {
  // Verified working - tested Jan 2026
  cloudflare: "https://www.cloudflarestatus.com",
  zoom: "https://status.zoom.us",
  atlassian: "https://status.atlassian.com",
  sentinelone: "https://status.sentinelone.com",
  hubspot: "https://status.hubspot.com",
  akamai: "https://www.akamaistatus.com",
  pingidentity: "https://status.pingidentity.com",
  fireblocks: "https://status.fireblocks.com",
  quickbooks: "https://status.quickbooks.intuit.com",
  netsuite: "https://status.netsuite.com",
  kaseya: "https://status.kaseya.com",
  slack: "https://status.slack.com",
  duo: "https://status.duo.com",
  dropbox: "https://status.dropbox.com",
  box: "https://status.box.com",
  datadog: "https://status.datadoghq.com",
  newrelic: "https://status.newrelic.com",
  github: "https://www.githubstatus.com",
  digitalocean: "https://status.digitalocean.com",
  linode: "https://status.linode.com",
  teamviewer: "https://status.teamviewer.com",
  datto: "https://status.kaseya.com", // Datto now redirects to Kaseya
  carbonite: "https://status.opentext.com", // Carbonite now redirects to OpenText
  // Developer Tools & Platforms
  twilio: "https://status.twilio.com",
  openai: "https://status.openai.com",
  vercel: "https://www.vercel-status.com",
  mongodb: "https://status.cloud.mongodb.com",
  sentry: "https://status.sentry.io",
  circleci: "https://status.circleci.com",
  linear: "https://linearstatus.com",
  render: "https://status.render.com",
  supabase: "https://status.supabase.com",
  cloudinary: "https://status.cloudinary.com",
  mailgun: "https://status.mailgun.com",
  sendgrid: "https://status.sendgrid.com",
  // E-commerce
  shopify: "https://status.shopify.com",
  // Collaboration
  notion: "https://status.notion.so",
  asana: "https://status.asana.com",
  // Password Management
  "1password": "https://status.1password.com",
  lastpass: "https://status.lastpass.com",
  // Analytics & Data - verified Jan 2026
  mixpanel: "https://www.mixpanelstatus.com",
  segment: "https://status.segment.com",
  snowflake: "https://status.snowflake.com",
  plaid: "https://status.plaid.com",
  // Communication & Support - verified Jan 2026
  intercom: "https://www.intercomstatus.com",
  klaviyo: "https://status.klaviyo.com",
  // Developer Tools - verified Jan 2026
  npm: "https://status.npmjs.org",
  // Social - verified Jan 2026
  reddit: "https://www.redditstatus.com",
  // Database - verified Jan 2026
  redis: "https://status.redis.io",
  // E-commerce - verified Jan 2026  
  square: "https://issquareup.com",
  // Security - verified Jan 2026
  bitdefender: "https://status.gravityzone.bitdefender.com",
  ...NEW_STATUSPAGE_URLS,
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

interface MaintenanceData {
  id: string;
  name: string;
  status: string;
  impact: string;
  shortlink?: string;
  scheduled_for: string;
  scheduled_until?: string;
  started_at?: string;
  completed_at?: string;
  components?: Array<{ id: string; name: string; status: string }>;
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

async function fetchStatuspageJson(vendor: { key: string; statusUrl: string }): Promise<{ 
  status: string; 
  incidents: any[]; 
  maintenances: MaintenanceData[];
  components?: StatusPageResponse['components'];
  success: boolean; 
  httpStatus?: number; 
  errorMessage?: string 
}> {
  const apiBase = STATUSPAGE_API_URLS[vendor.key] || vendor.statusUrl.replace(/\/$/, '');
  
  try {
    const headers = { 'Accept': 'application/json', 'User-Agent': 'VendorWatch/1.0' };
    const fetchOpts = { maxRetries: 0 };
    
    const statusUrl = `${apiBase}/api/v2/summary.json`;
    const response = await fetchWithRetry(statusUrl, { headers }, fetchOpts);
    
    if (!response.ok) {
      console.log(`[${vendor.key}] Status page returned ${response.status}`);
      await recordParseResult(vendor.key, { success: false, httpStatus: response.status, errorMessage: `HTTP ${response.status}` });
      return { status: 'unknown', incidents: [], maintenances: [], success: false, httpStatus: response.status };
    }
    
    const data: StatusPageResponse = await response.json();
    const status = mapStatusIndicator(data.status?.indicator);
    
    let incidents: any[] = [];
    let maintenances: MaintenanceData[] = [];
    
    try {
      const incidentsRes = await fetchWithRetry(`${apiBase}/api/v2/incidents.json`, { headers }, fetchOpts);
      if (incidentsRes.ok) {
        const incidentsData: IncidentsResponse = await incidentsRes.json();
        const allIncidents = incidentsData.incidents || [];
        const now = Date.now();
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        incidents = allIncidents.filter(inc => {
          if (inc.status !== 'resolved' && inc.status !== 'postmortem') return true;
          const resolvedAt = new Date(inc.updated_at).getTime();
          return (now - resolvedAt) < TWO_HOURS_MS;
        });
      }
    } catch (e) {
      console.log(`[${vendor.key}] Could not fetch incidents`);
    }
    
    try {
      const maintenancesRes = await fetchWithRetry(`${apiBase}/api/v2/scheduled_maintenances.json`, { headers }, fetchOpts);
      if (maintenancesRes.ok) {
        const maintenancesData = await maintenancesRes.json();
        maintenances = maintenancesData.scheduled_maintenances || [];
      }
    } catch (e) {
      console.log(`[${vendor.key}] Could not fetch maintenances`);
    }
    
    await recordParseResult(vendor.key, { 
      success: true, 
      httpStatus: 200, 
      incidentsParsed: incidents.length 
    });
    
    return { status, incidents, maintenances, components: data.components, success: true, httpStatus: 200 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[${vendor.key}] Failed to fetch status:`, errorMessage);
    await recordParseResult(vendor.key, { 
      success: false, 
      errorMessage,
      isTimeout: isTimeoutError(errorMessage),
    });
    return { status: 'unknown', incidents: [], maintenances: [], success: false, errorMessage };
  }
}

async function syncVendorComponents(vendorKey: string, components: Array<{ id: string; name: string; description?: string; group_id?: string | null; status: string; position?: number; group?: boolean }>) {
  if (!components || components.length === 0) return;
  
  const groups = components.filter(c => c.group === true);
  const groupMap = new Map(groups.map(g => [g.id, g.name]));
  
  const serviceComponents = components.filter(c => c.group !== true);
  
  for (const comp of serviceComponents) {
    try {
      await storage.upsertVendorComponent({
        vendorKey,
        componentId: comp.id,
        name: comp.name,
        description: comp.description || null,
        groupName: comp.group_id ? (groupMap.get(comp.group_id) || null) : null,
        status: comp.status || 'operational',
        position: comp.position || 0,
      });
    } catch (err) {
    }
  }
}

async function syncAwsComponents(vendorKey: string, incidents: any[]) {
  const awsServices = [
    { id: 'aws-ec2', name: 'Amazon EC2', group: 'Compute', position: 1 },
    { id: 'aws-lambda', name: 'AWS Lambda', group: 'Compute', position: 2 },
    { id: 'aws-ecs', name: 'Amazon ECS', group: 'Compute', position: 3 },
    { id: 'aws-eks', name: 'Amazon EKS', group: 'Compute', position: 4 },
    { id: 'aws-fargate', name: 'AWS Fargate', group: 'Compute', position: 5 },
    { id: 'aws-s3', name: 'Amazon S3', group: 'Storage', position: 6 },
    { id: 'aws-ebs', name: 'Amazon EBS', group: 'Storage', position: 7 },
    { id: 'aws-efs', name: 'Amazon EFS', group: 'Storage', position: 8 },
    { id: 'aws-glacier', name: 'Amazon S3 Glacier', group: 'Storage', position: 9 },
    { id: 'aws-rds', name: 'Amazon RDS', group: 'Database', position: 10 },
    { id: 'aws-dynamodb', name: 'Amazon DynamoDB', group: 'Database', position: 11 },
    { id: 'aws-aurora', name: 'Amazon Aurora', group: 'Database', position: 12 },
    { id: 'aws-redshift', name: 'Amazon Redshift', group: 'Database', position: 13 },
    { id: 'aws-elasticache', name: 'Amazon ElastiCache', group: 'Database', position: 14 },
    { id: 'aws-vpc', name: 'Amazon VPC', group: 'Networking', position: 15 },
    { id: 'aws-cloudfront', name: 'Amazon CloudFront', group: 'Networking', position: 16 },
    { id: 'aws-route53', name: 'Amazon Route 53', group: 'Networking', position: 17 },
    { id: 'aws-elb', name: 'Elastic Load Balancing', group: 'Networking', position: 18 },
    { id: 'aws-apigateway', name: 'Amazon API Gateway', group: 'Networking', position: 19 },
    { id: 'aws-iam', name: 'AWS IAM', group: 'Security & Identity', position: 20 },
    { id: 'aws-cognito', name: 'Amazon Cognito', group: 'Security & Identity', position: 21 },
    { id: 'aws-kms', name: 'AWS KMS', group: 'Security & Identity', position: 22 },
    { id: 'aws-cloudwatch', name: 'Amazon CloudWatch', group: 'Management', position: 23 },
    { id: 'aws-cloudformation', name: 'AWS CloudFormation', group: 'Management', position: 24 },
    { id: 'aws-sns', name: 'Amazon SNS', group: 'Application Integration', position: 25 },
    { id: 'aws-sqs', name: 'Amazon SQS', group: 'Application Integration', position: 26 },
    { id: 'aws-ses', name: 'Amazon SES', group: 'Application Integration', position: 27 },
    { id: 'aws-eventbridge', name: 'Amazon EventBridge', group: 'Application Integration', position: 28 },
    { id: 'aws-sagemaker', name: 'Amazon SageMaker', group: 'AI & ML', position: 29 },
    { id: 'aws-bedrock', name: 'Amazon Bedrock', group: 'AI & ML', position: 30 },
  ];

  const affectedServiceNames: string[] = incidents.map((i: any) => (i.name || '').toLowerCase());

  for (const svc of awsServices) {
    const isAffected = affectedServiceNames.some(name =>
      name.includes(svc.name.toLowerCase()) || name.includes(svc.id.replace('aws-', ''))
    );
    try {
      await storage.upsertVendorComponent({
        vendorKey,
        componentId: svc.id,
        name: svc.name,
        description: null,
        groupName: svc.group,
        status: isAffected ? 'degraded_performance' : 'operational',
        position: svc.position,
      });
    } catch (err) {}
  }
}

// AWS uses a different JSON format at status.aws.amazon.com/data.json
async function fetchAwsStatus(vendor: { key: string; statusUrl: string }): Promise<{ 
  status: string; 
  incidents: any[]; 
  maintenances: MaintenanceData[];
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
    }, { maxRetries: 0 });
    
    if (!response.ok) {
      console.log(`[aws] Status page returned ${response.status}`);
      await recordParseResult(vendor.key, { 
        success: false, 
        httpStatus: response.status, 
        errorMessage: `HTTP ${response.status}` 
      });
      return { status: 'unknown', incidents: [], maintenances: [], success: false, httpStatus: response.status };
    }
    
    // AWS returns UTF-16 BE encoded JSON (BOM: 0xFE 0xFF)
    let text: string;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      const swapped = Buffer.from(buffer);
      swapped.swap16();
      text = swapped.toString('utf16le').replace(/^\uFEFF/, '');
    } else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      text = buffer.toString('utf16le').replace(/^\uFEFF/, '');
    } else if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      text = gunzipSync(buffer).toString('utf-8');
    } else {
      text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    }
    
    // Handle empty response - AWS returns [] when there are no issues
    if (!text || text.trim() === '' || text.trim() === '[]') {
      console.log(`[aws] Empty response, syncing ${vendor.key} components...`);
      await syncAwsComponents(vendor.key, []);
      await recordParseResult(vendor.key, { 
        success: true, 
        httpStatus: 200, 
        incidentsParsed: 0 
      });
      return { status: 'operational', incidents: [], maintenances: [], success: true, httpStatus: 200 };
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
      return { status: 'unknown', incidents: [], maintenances: [], success: false, errorMessage: 'JSON parse error' };
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
    
    await syncAwsComponents(vendor.key, incidents);

    await recordParseResult(vendor.key, { 
      success: true, 
      httpStatus: 200, 
      incidentsParsed: incidents.length 
    });
    
    return { status: overallStatus, incidents, maintenances: [], success: true, httpStatus: 200 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[aws] Failed to fetch status:`, errorMessage);
    await recordParseResult(vendor.key, { 
      success: false, 
      errorMessage,
      isTimeout: isTimeoutError(errorMessage),
    });
    return { status: 'unknown', incidents: [], maintenances: [], success: false, errorMessage };
  }
}

// Slack uses a custom API format at status.slack.com/api/v2.0.0/current
async function fetchSlackStatus(vendor: { key: string; statusUrl: string }): Promise<{ 
  status: string; 
  incidents: any[]; 
  maintenances: MaintenanceData[];
  success: boolean; 
  httpStatus?: number; 
  errorMessage?: string 
}> {
  try {
    const response = await fetchWithRetry("https://status.slack.com/api/v2.0.0/current", {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; VendorWatch/1.0)'
      },
    }, { maxRetries: 0 });
    
    if (!response.ok) {
      console.log(`[slack] Status page returned ${response.status}`);
      await recordParseResult(vendor.key, { 
        success: false, 
        httpStatus: response.status, 
        errorMessage: `HTTP ${response.status}` 
      });
      return { status: 'unknown', incidents: [], maintenances: [], success: false, httpStatus: response.status };
    }
    
    const data = await response.json();
    // Slack format: { status: "ok"|"active", active_incidents: [...] }
    const overallStatus = data.status === 'ok' ? 'operational' : 'degraded';
    const incidents = (data.active_incidents || []).map((inc: any) => ({
      id: String(inc.id || `slack-${Date.now()}`),
      name: inc.title || 'Slack Service Issue',
      status: inc.status || 'investigating',
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
    
    return { status: overallStatus, incidents, maintenances: [], success: true, httpStatus: 200 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[slack] Failed to fetch status:`, errorMessage);
    await recordParseResult(vendor.key, { 
      success: false, 
      errorMessage,
      isTimeout: isTimeoutError(errorMessage),
    });
    return { status: 'unknown', incidents: [], maintenances: [], success: false, errorMessage };
  }
}

const SYNC_BATCH_SIZE = 8;
const PER_VENDOR_TIMEOUT_MS = 12000;

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

async function processBatch<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<number> {
  let processed = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(item => withTimeout(fn(item), PER_VENDOR_TIMEOUT_MS, 'vendor-sync')));
    processed += batch.length;
  }
  return processed;
}

export async function syncVendorStatus(vendorKey?: string): Promise<{ synced: number; errors: string[]; skipped: number }> {
  const vendors = vendorKey 
    ? [await storage.getVendor(vendorKey)].filter(Boolean)
    : await storage.getVendors();
  
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];
  
  const validParsers = ['statuspage_json', 'aws_json', 'slack_json', 'manual', 'generic_html', 'html_scrape', 'puppeteer_js'];
  const filteredVendors = vendors.filter(v => {
    if (!v) return false;
    if (!validParsers.includes(v.parser)) {
      skipped++;
      return false;
    }
    return true;
  });
  const syncableVendors = vendorKey ? filteredVendors : filteredVendors.sort((a, b) => {
    const aTime = a?.lastChecked ? new Date(a.lastChecked).getTime() : 0;
    const bTime = b?.lastChecked ? new Date(b.lastChecked).getTime() : 0;
    return aTime - bTime;
  });

  async function syncSingleVendor(vendor: typeof vendors[0]) {
    if (!vendor) return;
    try {
      let result;
      if (vendor.parser === 'aws_json' || vendor.key === 'aws' || vendor.key === 'aws-govcloud') {
        result = await fetchAwsStatus(vendor);
      } else if (vendor.parser === 'slack_json') {
        result = await fetchSlackStatus(vendor);
      } else if (vendor.parser === 'puppeteer_js') {
        result = await scrapeJsVendorStatus(vendor);
      } else if (vendor.parser === 'manual' || vendor.parser === 'generic_html' || vendor.parser === 'html_scrape') {
        result = await scrapeVendorStatus(vendor);
      } else {
        result = await fetchStatuspageJson(vendor);
      }
      
      // Parser health alerts disabled - viewable on owner dashboard instead
      if (await shouldSendParserHealthAlert(vendor.key)) {
        console.log(`[parser-health] Parser unhealthy for ${vendor.name} - check /parser-health dashboard`);
        await markAlertSent(vendor.key);
      }
      
      if (result.success) {
        const existingIncidents = await storage.getIncidentsByVendor(vendor.key);
        const activeIncidentIds = new Set(result.incidents.map((i: any) => String(i.id)));
        
        for (const existing of existingIncidents) {
          if (!activeIncidentIds.has(String(existing.incidentId)) && existing.status !== 'resolved') {
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
          if (!isValidIncident(incident)) {
            console.log(`  ⊘ Skipping invalid incident: ${incident.name?.substring(0, 50)}...`);
            continue;
          }
          
          const exists = existingIncidents.find(i => String(i.incidentId) === String(incident.id));
          const normalizedStatus = mapStatuspageStatus(incident.status);
          const normalizedSeverity = mapStatuspageImpact(incident.impact);
          const affectedComponents = incident.components?.map((c: { id: string; name: string; status: string }) => c.name).join(', ') || '';
          
          if (!exists) {
            const alreadyArchived = await storage.isIncidentArchived(vendor.key, incident.id);
            if (alreadyArchived) {
              continue;
            }

            const isAuthoritativeSource = vendor.parser === 'statuspage_json' || vendor.parser === 'aws_json' || vendor.parser === 'slack_json';
            if (!isAuthoritativeSource) {
              const isConfirmed = confirmVendorIncident(vendor.key, incident.id, incident);
              if (!isConfirmed) {
                console.log(`  ⏳ Pending confirmation: ${incident.name} [${normalizedSeverity}/${normalizedStatus}]`);
                continue;
              }
            }

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
            
            // Check if this incident was manually resolved - if so, only update if external source is newer
            if (exists.manuallyResolvedAt && normalizedStatus !== 'resolved') {
              const externalUpdatedAt = new Date(incident.updated_at);
              if (externalUpdatedAt <= exists.manuallyResolvedAt) {
                console.log(`  ⊘ Skipping ${incident.name}: manually resolved, external update not newer`);
                continue;
              }
              // External has a newer update - clear the manual flag and allow update
              console.log(`  → Reopening ${incident.name}: external source has newer update`);
            }
            
            if (statusChanged || severityChanged || updatedAtChanged) {
              const previousStatus = exists.status;
              const previousSeverity = exists.severity;
              
              await storage.updateIncident(exists.id, { 
                status: normalizedStatus,
                severity: normalizedSeverity,
                updatedAt: incident.updated_at,
                impact: affectedComponents || incident.impact || exists.impact,
                // Clear manuallyResolvedAt if we're updating from external source
                manuallyResolvedAt: null,
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
        
        // Process scheduled maintenances
        if (result.maintenances && result.maintenances.length > 0) {
          for (const maint of result.maintenances) {
            // Map Statuspage maintenance status to our status
            let maintenanceStatus = 'scheduled';
            if (maint.status === 'in_progress') maintenanceStatus = 'in_progress';
            else if (maint.status === 'verifying') maintenanceStatus = 'verifying';
            else if (maint.status === 'completed') maintenanceStatus = 'completed';
            
            const affectedComponents = (maint as MaintenanceData).components?.map((c: { name: string }) => c.name).join(', ') || '';
            
            await storage.upsertVendorMaintenance({
              vendorKey: vendor.key,
              maintenanceId: maint.id,
              title: maint.name,
              description: undefined,
              status: maintenanceStatus,
              impact: maint.impact || 'maintenance',
              url: maint.shortlink || vendor.statusUrl,
              scheduledStartAt: maint.scheduled_for,
              scheduledEndAt: maint.scheduled_until || undefined,
              actualStartAt: maint.started_at || undefined,
              actualEndAt: maint.completed_at || undefined,
              affectedComponents: affectedComponents || undefined,
              rawHash: undefined,
            });
            console.log(`  → Maintenance: ${maint.name} [${maintenanceStatus}]`);
          }
        }
        
        if (result.components) {
          try {
            await syncVendorComponents(vendor.key, result.components);
          } catch (e) {
            console.log(`[${vendor.key}] Could not sync components`);
          }
        }
        
        let finalStatus = result.status;
        if (result.incidents.length === 0 && finalStatus !== 'degraded' && finalStatus !== 'partial_outage' && finalStatus !== 'major_outage') {
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
      try { await storage.updateVendor(vendor.key, { lastChecked: new Date() }); } catch {}
    }
  }

  const processed = await processBatch(syncableVendors, SYNC_BATCH_SIZE, syncSingleVendor);
  const totalVendors = syncableVendors.length;
  const coverage = totalVendors > 0 ? Math.round((processed / totalVendors) * 100) : 100;
  
  cleanupStalePendingIncidents();
  
  try {
    await storage.upsertHealthState('vendor_sync', {
      status: errors.length === 0 ? 'healthy' : 'degraded',
      lastRunAt: new Date(),
      lastSuccessAt: errors.length === 0 ? new Date() : undefined,
      lastErrorAt: errors.length > 0 ? new Date() : undefined,
      lastErrorMessage: errors.length > 0 ? errors.slice(0, 3).join('; ') : undefined,
      consecutiveFailures: errors.length,
      metadata: JSON.stringify({ synced, skipped, errorCount: errors.length, processed, totalVendors, coverage }),
    });
  } catch (e) {
    console.error('[health] Failed to update vendor_sync health state:', e);
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

export async function resolveStaleIncidents(staleDays: number = 7): Promise<{ resolved: number }> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - staleDays);
  const now = new Date();
  
  let resolved = 0;
  
  const vendors = await storage.getVendors();
  for (const vendor of vendors) {
    const incidents = await storage.getIncidentsByVendor(vendor.key);
    for (const incident of incidents) {
      if (incident.status !== 'resolved') {
        const updatedAt = new Date(incident.updatedAt);
        if (updatedAt < staleThreshold) {
          // Set manuallyResolvedAt to prevent sync from reopening
          await storage.updateIncident(incident.id, { 
            status: 'resolved',
            manuallyResolvedAt: now
          });
          console.log(`[stale-cleanup] Auto-resolved: ${incident.title} (last updated ${updatedAt.toISOString()})`);
          resolved++;
        }
      }
    }
  }
  
  return { resolved };
}
