import { storage } from "./storage";

async function seed() {
  console.log("Seeding database...");

  // Add vendors
  const vendorsData = [
    { 
      key: "microsoft365", 
      name: "Microsoft 365", 
      statusUrl: "https://status.office.com", 
      parser: "generic_html",
      status: 'operational'
    },
    { 
      key: "azure", 
      name: "Azure", 
      statusUrl: "https://status.azure.com", 
      parser: "generic_html",
      status: 'operational'
    },
    { 
      key: "aws", 
      name: "AWS", 
      statusUrl: "https://health.aws.amazon.com/health/status", 
      parser: "generic_html",
      status: 'operational'
    },
    { 
      key: "googlews", 
      name: "Google Workspace", 
      statusUrl: "https://www.google.com/appsstatus/dashboard/", 
      parser: "generic_html",
      status: 'operational'
    },
    { 
      key: "salesforce", 
      name: "Salesforce", 
      statusUrl: "https://status.salesforce.com", 
      parser: "generic_html",
      status: 'operational'
    },
    { 
      key: "cloudflare", 
      name: "Cloudflare", 
      statusUrl: "https://www.cloudflarestatus.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "okta", 
      name: "Okta", 
      statusUrl: "https://status.okta.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "zoom", 
      name: "Zoom", 
      statusUrl: "https://status.zoom.us", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "atlassian", 
      name: "Atlassian", 
      statusUrl: "https://status.atlassian.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // Payment & Revenue Critical
    { 
      key: "stripe", 
      name: "Stripe", 
      statusUrl: "https://status.stripe.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "paypal", 
      name: "PayPal", 
      statusUrl: "https://www.paypal-status.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "quickbooks", 
      name: "QuickBooks Online", 
      statusUrl: "https://status.quickbooks.intuit.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // Authentication & Identity
    { 
      key: "duo", 
      name: "Duo Security", 
      statusUrl: "https://status.duo.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // File Storage
    { 
      key: "dropbox", 
      name: "Dropbox", 
      statusUrl: "https://status.dropbox.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "box", 
      name: "Box", 
      statusUrl: "https://status.box.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // Remote Access & Support
    { 
      key: "teamviewer", 
      name: "TeamViewer", 
      statusUrl: "https://status.teamviewer.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "logmein", 
      name: "LogMeIn", 
      statusUrl: "https://status.logmeininc.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // Backup & DR
    { 
      key: "veeam", 
      name: "Veeam", 
      statusUrl: "https://status.veeam.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "acronis", 
      name: "Acronis", 
      statusUrl: "https://status.acronis.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "datto", 
      name: "Datto", 
      statusUrl: "https://status.datto.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "carbonite", 
      name: "Carbonite", 
      statusUrl: "https://status.carbonite.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // Business Applications
    { 
      key: "zendesk", 
      name: "Zendesk", 
      statusUrl: "https://status.zendesk.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "servicenow", 
      name: "ServiceNow", 
      statusUrl: "https://status.servicenow.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "freshworks", 
      name: "Freshworks", 
      statusUrl: "https://status.freshworks.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // DevOps & Monitoring
    { 
      key: "datadog", 
      name: "Datadog", 
      statusUrl: "https://status.datadoghq.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "pagerduty", 
      name: "PagerDuty", 
      statusUrl: "https://status.pagerduty.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "newrelic", 
      name: "New Relic", 
      statusUrl: "https://status.newrelic.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "github", 
      name: "GitHub", 
      statusUrl: "https://www.githubstatus.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // Cloud Infrastructure
    { 
      key: "gcp", 
      name: "Google Cloud Platform", 
      statusUrl: "https://status.cloud.google.com", 
      parser: "generic_html",
      status: 'operational'
    },
    { 
      key: "digitalocean", 
      name: "DigitalOcean", 
      statusUrl: "https://status.digitalocean.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "linode", 
      name: "Linode", 
      statusUrl: "https://status.linode.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
  ];

  for (const vendor of vendorsData) {
    try {
      const existing = await storage.getVendor(vendor.key);
      if (!existing) {
        await storage.createVendor(vendor);
        console.log(`✓ Created vendor: ${vendor.name}`);
      } else {
        console.log(`- Vendor already exists: ${vendor.name}`);
      }
    } catch (error) {
      console.error(`✗ Failed to create vendor ${vendor.name}:`, error);
    }
  }

  // No sample incidents - real incidents will be detected by the status sync service
  console.log("Note: Incidents will be populated by real-time status monitoring");

  // Add sample jobs
  const jobsData = [
    { 
      name: "AWS Status Monitor", 
      target: "status.aws.amazon.com", 
      schedule: "Every 5m", 
      status: "running",
      lastRun: new Date(Date.now() - 300000),
      nextRun: new Date(Date.now() + 300000),
      success: true
    },
    { 
      name: "Microsoft 365 Checker", 
      target: "status.office.com", 
      schedule: "Every 10m", 
      status: "idle",
      lastRun: new Date(Date.now() - 600000),
      nextRun: new Date(Date.now() + 600000),
      success: true
    },
  ];

  for (const job of jobsData) {
    try {
      await storage.createJob(job);
      console.log(`✓ Created job: ${job.name}`);
    } catch (error) {
      console.error(`✗ Failed to create job:`, error);
    }
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
