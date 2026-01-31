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
      key: "akamai", 
      name: "Akamai", 
      statusUrl: "https://www.akamaistatus.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "fastly", 
      name: "Fastly", 
      statusUrl: "https://www.fastlystatus.com", 
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
    { 
      key: "slack", 
      name: "Slack", 
      statusUrl: "https://status.slack.com", 
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
      parser: "generic_html",
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
    { 
      key: "auth0", 
      name: "Auth0", 
      statusUrl: "https://status.auth0.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "pingidentity", 
      name: "Ping Identity", 
      statusUrl: "https://status.pingidentity.com", 
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
    // Backup & DR
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
      key: "hubspot", 
      name: "HubSpot", 
      statusUrl: "https://status.hubspot.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "netsuite", 
      name: "Oracle NetSuite", 
      statusUrl: "https://status.netsuite.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "sentinelone", 
      name: "SentinelOne", 
      statusUrl: "https://status.sentinelone.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "fireblocks", 
      name: "Fireblocks", 
      statusUrl: "https://status.fireblocks.com", 
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
    // MSP Tools
    { 
      key: "kaseya", 
      name: "Kaseya", 
      statusUrl: "https://status.kaseya.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "connectwise", 
      name: "ConnectWise", 
      statusUrl: "https://status.connectwise.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "nable", 
      name: "N-able", 
      statusUrl: "https://status.n-able.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    { 
      key: "syncro", 
      name: "Syncro", 
      statusUrl: "https://status.syncromsp.com", 
      parser: "statuspage_json",
      status: 'operational'
    },
    // Communication & Collaboration
    { key: "intercom", name: "Intercom", statusUrl: "https://status.intercom.com", parser: "statuspage_json", status: 'operational' },
    { key: "discord", name: "Discord", statusUrl: "https://discordstatus.com", parser: "statuspage_json", status: 'operational' },
    { key: "miro", name: "Miro", statusUrl: "https://status.miro.com", parser: "statuspage_json", status: 'operational' },
    { key: "calendly", name: "Calendly", statusUrl: "https://status.calendly.com", parser: "statuspage_json", status: 'operational' },
    { key: "loom", name: "Loom", statusUrl: "https://status.loom.com", parser: "statuspage_json", status: 'operational' },
    // E-Commerce & Payments
    { key: "square", name: "Square", statusUrl: "https://status.squareup.com", parser: "statuspage_json", status: 'operational' },
    { key: "bigcommerce", name: "BigCommerce", statusUrl: "https://status.bigcommerce.com", parser: "statuspage_json", status: 'operational' },
    { key: "automattic", name: "WooCommerce/Automattic", statusUrl: "https://automatticstatus.com", parser: "statuspage_json", status: 'operational' },
    { key: "braintree", name: "Braintree", statusUrl: "https://status.braintreepayments.com", parser: "statuspage_json", status: 'operational' },
    // Customer Support & CRM
    { key: "zendesk", name: "Zendesk", statusUrl: "https://status.zendesk.com", parser: "statuspage_json", status: 'operational' },
    { key: "freshworks", name: "Freshworks", statusUrl: "https://status.freshworks.com", parser: "statuspage_json", status: 'operational' },
    { key: "pipedrive", name: "Pipedrive", statusUrl: "https://status.pipedrive.com", parser: "statuspage_json", status: 'operational' },
    { key: "monday", name: "Monday.com", statusUrl: "https://status.monday.com", parser: "statuspage_json", status: 'operational' },
    { key: "zoho", name: "Zoho", statusUrl: "https://status.zoho.com", parser: "statuspage_json", status: 'operational' },
    // Developer Tools & Infrastructure
    { key: "heroku", name: "Heroku", statusUrl: "https://status.heroku.com", parser: "statuspage_json", status: 'operational' },
    { key: "redis", name: "Redis Cloud", statusUrl: "https://status.redis.io", parser: "statuspage_json", status: 'operational' },
    { key: "gitlab", name: "GitLab", statusUrl: "https://status.gitlab.com", parser: "statuspage_json", status: 'operational' },
    { key: "bitbucket", name: "Bitbucket", statusUrl: "https://bitbucket.status.atlassian.com", parser: "statuspage_json", status: 'operational' },
    { key: "npm", name: "npm", statusUrl: "https://status.npmjs.org", parser: "statuspage_json", status: 'operational' },
    { key: "pagerduty", name: "PagerDuty", statusUrl: "https://status.pagerduty.com", parser: "statuspage_json", status: 'operational' },
    { key: "jira", name: "Jira", statusUrl: "https://jira.status.atlassian.com", parser: "statuspage_json", status: 'operational' },
    { key: "confluence", name: "Confluence", statusUrl: "https://confluence.status.atlassian.com", parser: "statuspage_json", status: 'operational' },
    // Email & Marketing
    { key: "mailchimp", name: "Mailchimp", statusUrl: "https://status.mailchimp.com", parser: "statuspage_json", status: 'operational' },
    { key: "postmark", name: "Postmark", statusUrl: "https://status.postmarkapp.com", parser: "statuspage_json", status: 'operational' },
    { key: "klaviyo", name: "Klaviyo", statusUrl: "https://status.klaviyo.com", parser: "statuspage_json", status: 'operational' },
    { key: "activecampaign", name: "ActiveCampaign", statusUrl: "https://status.activecampaign.com", parser: "statuspage_json", status: 'operational' },
    { key: "constantcontact", name: "Constant Contact", statusUrl: "https://status.constantcontact.com", parser: "statuspage_json", status: 'operational' },
    // Security
    { key: "crowdstrike", name: "CrowdStrike", statusUrl: "https://status.crowdstrike.com", parser: "statuspage_json", status: 'operational' },
    { key: "sophos", name: "Sophos", statusUrl: "https://status.sophos.com", parser: "statuspage_json", status: 'operational' },
    { key: "webroot", name: "Webroot", statusUrl: "https://status.webroot.com", parser: "statuspage_json", status: 'operational' },
    { key: "bitdefender", name: "Bitdefender", statusUrl: "https://status.bitdefender.com", parser: "statuspage_json", status: 'operational' },
    // Social Media & Content
    { key: "reddit", name: "Reddit", statusUrl: "https://www.redditstatus.com", parser: "statuspage_json", status: 'operational' },
    { key: "canva", name: "Canva", statusUrl: "https://status.canva.com", parser: "statuspage_json", status: 'operational' },
    { key: "figma", name: "Figma", statusUrl: "https://status.figma.com", parser: "statuspage_json", status: 'operational' },
    // Analytics & Data
    { key: "plaid", name: "Plaid", statusUrl: "https://status.plaid.com", parser: "statuspage_json", status: 'operational' },
    { key: "segment", name: "Segment", statusUrl: "https://status.segment.com", parser: "statuspage_json", status: 'operational' },
    { key: "mixpanel", name: "Mixpanel", statusUrl: "https://status.mixpanel.com", parser: "statuspage_json", status: 'operational' },
    { key: "amplitude", name: "Amplitude", statusUrl: "https://status.amplitude.com", parser: "statuspage_json", status: 'operational' },
    { key: "snowflake", name: "Snowflake", statusUrl: "https://status.snowflake.com", parser: "statuspage_json", status: 'operational' },
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
