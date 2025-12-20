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
      statusUrl: "https://status.aws.amazon.com", 
      parser: "generic_html",
      status: 'degraded'
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

  // Add sample incidents
  const incidentsData = [
    {
      vendorKey: "aws",
      incidentId: "inc-12345",
      title: "Increased Error Rates for EC2 Instances",
      status: "Investigating",
      severity: "major",
      impact: "EC2 API calls may fail in us-east-1 region",
      url: "https://health.aws.amazon.com/issue/123",
      startedAt: "2024-03-21 10:30:00 UTC",
      updatedAt: "2024-03-21 11:15:00 UTC",
      rawHash: "abc123def456"
    },
  ];

  for (const incident of incidentsData) {
    try {
      await storage.createIncident(incident);
      console.log(`✓ Created incident: ${incident.title}`);
    } catch (error) {
      console.error(`✗ Failed to create incident:`, error);
    }
  }

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
