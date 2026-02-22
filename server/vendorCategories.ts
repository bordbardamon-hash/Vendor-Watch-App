export const VENDOR_CATEGORIES: Record<string, string> = {
  // === From seed.ts ===

  // Cloud Infrastructure
  microsoft365: "Cloud Infrastructure",
  azure: "Cloud Infrastructure",
  aws: "Cloud Infrastructure",
  googlews: "Cloud Infrastructure",
  dropbox: "Cloud Infrastructure",
  box: "Cloud Infrastructure",
  gcp: "Cloud Infrastructure",
  digitalocean: "Cloud Infrastructure",
  linode: "Cloud Infrastructure",
  heroku: "Cloud Infrastructure",
  vercel: "Cloud Infrastructure",
  netlify: "Cloud Infrastructure",
  render: "Cloud Infrastructure",
  flyio: "Cloud Infrastructure",

  // CDN & DNS
  cloudflare: "CDN & DNS",
  akamai: "CDN & DNS",
  fastly: "CDN & DNS",

  // Identity & Access
  okta: "Identity & Access",
  duo: "Identity & Access",
  auth0: "Identity & Access",
  pingidentity: "Identity & Access",

  // Communication
  zoom: "Communication",
  slack: "Communication",
  discord: "Communication",
  loom: "Communication",
  reddit: "Communication",
  twilio: "Communication",
  sendgrid: "Communication",

  // Developer Tools
  atlassian: "Developer Tools",
  github: "Developer Tools",
  gitlab: "Developer Tools",
  bitbucket: "Developer Tools",
  npm: "Developer Tools",
  jira: "Developer Tools",
  confluence: "Developer Tools",
  postman: "Developer Tools",
  circleci: "Developer Tools",
  travisci: "Developer Tools",
  sentry: "Developer Tools",
  snyk: "Developer Tools",
  sonarcloud: "Developer Tools",
  linear: "Developer Tools",
  launchdarkly: "Developer Tools",
  hashicorp: "Developer Tools",
  cloudinary: "Developer Tools",
  mapbox: "Developer Tools",
  retool: "Developer Tools",
  expo: "Developer Tools",

  // Payments & Fintech
  stripe: "Payments & Fintech",
  paypal: "Payments & Fintech",
  quickbooks: "Payments & Fintech",
  fireblocks: "Payments & Fintech",
  square: "Payments & Fintech",
  coinbase: "Payments & Fintech",

  // CRM & Sales
  salesforce: "CRM & Sales",
  hubspot: "CRM & Sales",
  pipedrive: "CRM & Sales",

  // MSP & IT Management
  teamviewer: "MSP & IT Management",
  datto: "MSP & IT Management",
  carbonite: "MSP & IT Management",
  kaseya: "MSP & IT Management",
  connectwise: "MSP & IT Management",
  nable: "MSP & IT Management",
  syncro: "MSP & IT Management",

  // Business Software
  netsuite: "Business Software",
  zoho: "Business Software",
  contentful: "Business Software",
  sanity: "Business Software",
  webflow: "Business Software",
  docusign: "Business Software",

  // Security
  sentinelone: "Security",
  crowdstrike: "Security",
  sophos: "Security",
  webroot: "Security",
  bitdefender: "Security",
  "1password": "Security",
  onepassword: "Security",
  lastpass: "Security",

  // Observability
  datadog: "Observability",
  newrelic: "Observability",
  pagerduty: "Observability",
  grafana: "Observability",

  // Customer Support
  intercom: "Customer Support",
  zendesk: "Customer Support",
  freshworks: "Customer Support",

  // E-Commerce
  bigcommerce: "E-Commerce",
  automattic: "E-Commerce",
  braintree: "E-Commerce",
  shopify: "E-Commerce",

  // Collaboration
  miro: "Collaboration",
  calendly: "Collaboration",
  monday: "Collaboration",
  canva: "Collaboration",
  figma: "Collaboration",
  notion: "Collaboration",
  airtable: "Collaboration",
  asana: "Collaboration",
  trello: "Collaboration",

  // Analytics & Data
  plaid: "Analytics & Data",
  segment: "Analytics & Data",
  mixpanel: "Analytics & Data",
  amplitude: "Analytics & Data",

  // Databases
  redis: "Databases",
  snowflake: "Databases",
  supabase: "Databases",
  prisma: "Databases",
  mongodb: "Databases",
  elastic: "Databases",
  confluent: "Databases",
  cockroachdb: "Databases",
  planetscale: "Databases",
  upstash: "Databases",

  // Marketing
  mailchimp: "Marketing",
  postmark: "Marketing",
  klaviyo: "Marketing",
  activecampaign: "Marketing",
  constantcontact: "Marketing",

  // AI & ML
  openai: "AI & ML",
  anthropic: "AI & ML",

  // === From newVendors.ts ===

  // Cloud Infrastructure & Hosting
  scaleway: "Cloud Infrastructure",
  upcloud: "Cloud Infrastructure",
  hetzner: "Cloud Infrastructure",
  ovhcloud: "Cloud Infrastructure",
  rackspace: "Cloud Infrastructure",
  ibmcloud: "Cloud Infrastructure",
  "oracle-cloud": "Cloud Infrastructure",
  liquidweb: "Cloud Infrastructure",

  // CDN & DNS & Edge
  bunnynet: "CDN & DNS",
  section: "CDN & DNS",

  // Developer Tools & CI/CD
  buildkite: "Developer Tools",
  semaphore: "Developer Tools",
  codecov: "Developer Tools",
  bitrise: "Developer Tools",
  codeclimate: "Developer Tools",
  harness: "Developer Tools",
  depot: "Developer Tools",
  gitpod: "Developer Tools",
  saucelabs: "Developer Tools",
  browserstack: "Developer Tools",
  lambdatest: "Developer Tools",

  // Package Registries
  pypi: "Developer Tools",
  rubygems: "Developer Tools",
  "crates-io": "Developer Tools",

  // Databases & Data Platforms
  influxdata: "Databases",
  aiven: "Databases",
  couchbase: "Databases",
  convex: "Databases",
  neo4j: "Databases",

  // Communication & Messaging
  vonage: "Communication",
  bandwidth: "Communication",
  plivo: "Communication",
  telnyx: "Communication",
  messagebird: "Communication",
  dialpad: "Communication",
  genesys: "Communication",
  pubnub: "Communication",
  pusher: "Communication",
  ably: "Communication",
  getstream: "Communication",
  sinch: "Communication",
  infobip: "Communication",
  twitch: "Communication",

  // CRM & Sales
  close: "CRM & Sales",
  copper: "CRM & Sales",
  salesloft: "CRM & Sales",
  gong: "CRM & Sales",
  clearbit: "CRM & Sales",
  zoominfo: "CRM & Sales",
  highspot: "CRM & Sales",

  // Email Marketing & Marketing Tools
  brevo: "Marketing",
  convertkit: "Marketing",
  customerio: "Marketing",
  iterable: "Marketing",
  mailjet: "Marketing",
  sparkpost: "Marketing",
  drip: "Marketing",
  omnisend: "Marketing",
  hotjar: "Marketing",
  fullstory: "Marketing",
  optimizely: "Marketing",
  unbounce: "Marketing",
  instapage: "Marketing",
  rudderstack: "Marketing",
  appsflyer: "Marketing",
  adjust: "Marketing",
  branch: "Marketing",
  braze: "Marketing",
  "segment-cdp": "Marketing",

  // Security
  fortinet: "Security",
  knowbe4: "Security",
  rapid7: "Security",
  tenable: "Security",
  qualys: "Security",
  imperva: "Security",
  zscaler: "Security",
  "1passwordbiz": "Security",
  keeper: "Security",
  nordpass: "Security",
  norton: "Security",
  wiz: "Security",

  // Email Security & Phishing Defense
  barracuda: "Security",
  "abnormal-security": "Security",
  ironscales: "Security",
  checkpoint: "Security",
  valimail: "Security",
  mailgun: "Security",
  "perception-point": "Security",
  greynoise: "Security",
  hoxhunt: "Security",

  // Identity & Access Management
  jumpcloud: "Identity & Access",
  cyberark: "Identity & Access",
  sailpoint: "Identity & Access",
  clerk: "Identity & Access",
  stytch: "Identity & Access",
  workos: "Identity & Access",
  fusionauth: "Identity & Access",

  // Payments & Fintech
  mollie: "Payments & Fintech",
  chargebee: "Payments & Fintech",
  dwolla: "Payments & Fintech",
  marqeta: "Payments & Fintech",
  wise: "Payments & Fintech",
  "circle-pay": "Payments & Fintech",
  alchemy: "Payments & Fintech",
  infura: "Payments & Fintech",
  quicknode: "Payments & Fintech",
  affirm: "Payments & Fintech",
  klarna: "Payments & Fintech",
  flutterwave: "Payments & Fintech",
  paystack: "Payments & Fintech",

  // E-Commerce & Shipping
  squarespace: "E-Commerce",
  shippo: "E-Commerce",
  shipstation: "E-Commerce",
  easypost: "E-Commerce",
  yotpo: "E-Commerce",
  recharge: "E-Commerce",
  gorgias: "E-Commerce",
  "klaviyo-ecom": "E-Commerce",
  stamped: "E-Commerce",
  "bolt-checkout": "E-Commerce",

  // Education & LMS
  instructure: "Education",
  turnitin: "Education",
  schoology: "Education",
  blackboard: "Education",
  kahoot: "Education",
  thinkific: "Education",
  teachable: "Education",
  kajabi: "Education",

  // HR & Recruiting & Payroll
  gusto: "HR & Workforce",
  rippling: "HR & Workforce",
  greenhouse: "HR & Workforce",
  lever: "HR & Workforce",
  lattice: "HR & Workforce",
  namely: "HR & Workforce",
  workday: "HR & Workforce",
  justworks: "HR & Workforce",
  ashby: "HR & Workforce",

  // Design & Creative Tools
  sketch: "Collaboration",
  vimeo: "Collaboration",
  imgix: "Collaboration",
  lucidchart: "Collaboration",
  mural: "Collaboration",

  // Project Management & Collaboration
  clickup: "Collaboration",
  smartsheet: "Collaboration",
  shortcut: "Collaboration",
  hive: "Collaboration",
  productboard: "Collaboration",

  // Customer Support & Helpdesk
  helpscout: "Customer Support",
  livechat: "Customer Support",
  kustomer: "Customer Support",
  kayako: "Customer Support",
  talkdesk: "Customer Support",
  aircall: "Customer Support",

  // AI & ML Platforms
  cohere: "AI & ML",
  replicate: "AI & ML",
  stabilityai: "AI & ML",
  scale: "AI & ML",
  pinecone: "AI & ML",
  assemblyai: "AI & ML",
  elevenlabs: "AI & ML",
  clarifai: "AI & ML",

  // Observability & Monitoring
  honeycomb: "Observability",
  loggly: "Observability",
  logdna: "Observability",
  opsgenie: "Observability",
  xmatters: "Observability",
  statuspage: "Observability",
  betteruptime: "Observability",
  "logz-io": "Observability",
  lightstep: "Observability",
  coralogix: "Observability",
  kentik: "Observability",

  // Automation & iPaaS
  zapier: "Business Software",
  make: "Business Software",
  workato: "Business Software",
  pipedream: "Business Software",
  "tray-io": "Business Software",
  celigo: "Business Software",
  boomi: "Business Software",
  ifttt: "Business Software",

  // Video & Streaming
  mux: "Communication",
  wistia: "Communication",
  jwplayer: "Communication",
  daily: "Communication",
  vidyard: "Communication",
  "cloudflare-stream": "Communication",
  livestorm: "Communication",
  "100ms": "Communication",

  // Storage & Backup
  wasabi: "Cloud Infrastructure",
  crashplan: "Cloud Infrastructure",
  tresorit: "Cloud Infrastructure",
  egnyte: "Cloud Infrastructure",
  filestack: "Cloud Infrastructure",
  uploadcare: "Cloud Infrastructure",

  // Productivity & Office
  coda: "Collaboration",
  toggl: "Collaboration",
  harvest: "Collaboration",
  xero: "Collaboration",
  "1password-teams": "Collaboration",
  grammarly: "Collaboration",
  typeform: "Analytics & Data",
  surveymonkey: "Analytics & Data",
  "calendly-biz": "Collaboration",
  pandadoc: "Collaboration",
  hellosign: "Collaboration",

  // Gaming & Game Services
  epicgames: "Business Software",
  unrealengine: "Business Software",
  playfab: "Business Software",

  // Networking & VPN
  tailscale: "CDN & DNS",
  meraki: "CDN & DNS",
  ubiquiti: "CDN & DNS",
  netbird: "CDN & DNS",

  // Legal & Compliance
  ironclad: "Business Software",
  clio: "Business Software",
  vanta: "Business Software",
  secureframe: "Business Software",

  // Healthcare & Health IT
  veradigm: "Business Software",
  doxy: "Business Software",
  healthie: "Business Software",
  simplepractice: "Business Software",

  // IoT & Hardware Platforms
  particle: "Business Software",
  "arduino-cloud": "Business Software",
  losant: "Business Software",
  hologram: "Business Software",
  balena: "Business Software",

  // Social Media & Management
  hootsuite: "Marketing",
  buffer: "Marketing",
  sproutsocial: "Marketing",
  later: "Marketing",
  sprinklr: "Marketing",

  // CMS & Headless CMS
  contentstack: "Business Software",
  hygraph: "Business Software",
  "builder-io": "Business Software",
  prismic: "Business Software",
  "agility-cms": "Business Software",
  kentico: "Business Software",
  "butter-cms": "Business Software",

  // Feature Flags & Experimentation
  split: "Developer Tools",
  flagsmith: "Developer Tools",

  // Product Analytics & User Engagement
  pendo: "Analytics & Data",
  appcues: "Analytics & Data",
  logrocket: "Analytics & Data",
  rollbar: "Analytics & Data",
  bugsnag: "Analytics & Data",
  airbrake: "Analytics & Data",
  gainsight: "Analytics & Data",
  uservoice: "Analytics & Data",
  chameleon: "Analytics & Data",

  // Developer APIs & Services
  nylas: "Developer Tools",
  lob: "Developer Tools",
  veriff: "Developer Tools",
  onfido: "Developer Tools",
  persona: "Developer Tools",
  "twilio-verify": "Developer Tools",
  radar: "Developer Tools",

  // Serverless & Edge Computing
  firebase: "Cloud Infrastructure",
  "azure-devops": "Cloud Infrastructure",

  // Telecom & CPaaS
  kaleyra: "Communication",
  nexmo: "Communication",
  telesign: "Communication",

  // Government & Public Cloud
  "aws-govcloud": "Cloud Infrastructure",
  "login-gov": "Cloud Infrastructure",

  // Enterprise Software
  "box-shield": "Business Software",

  // Search Platforms
  bonsai: "Developer Tools",

  // Collaboration & Communication (More)
  webex: "Collaboration",
  gotomeeting: "Collaboration",
  matrix: "Collaboration",
  element: "Collaboration",

  // Additional DevOps & Infrastructure
  "terraform-cloud": "Developer Tools",
  pulumi: "Developer Tools",
  env0: "Developer Tools",
  teleport: "Developer Tools",
  "octopus-deploy": "Developer Tools",
  codefresh: "Developer Tools",

  // Email Services
  resend: "Communication",
  smtp2go: "Communication",

  // Low-Code / No-Code
  bubble: "Business Software",
  outsystems: "Business Software",
  mendix: "Business Software",

  // Additional Misc Services
  datarobot: "AI & ML",
  fivetran: "Analytics & Data",
  airbyte: "Analytics & Data",
  stitch: "Analytics & Data",
  "dbt-cloud": "Analytics & Data",
  census: "Analytics & Data",
  hex: "Analytics & Data",
  "retool-db": "Developer Tools",
  metabase: "Analytics & Data",
  looker: "Analytics & Data",
  sisense: "Analytics & Data",
  preset: "Analytics & Data",
  "power-bi": "Analytics & Data",

  // Web Analytics & Testing
  launchnotes: "Developer Tools",

  // Additional SaaS & Tools
  "webflow-ecom": "E-Commerce",
  "intercom-msgs": "Customer Support",
  "snyk-container": "Developer Tools",
  sonatype: "Developer Tools",
  nexus: "Developer Tools",
  "github-copilot": "AI & ML",
  codeium: "AI & ML",
  tabnine: "AI & ML",
  gitguardian: "Security",
  torq: "Security",
  "elastic-siem": "Security",
  mend: "Developer Tools",
  fossa: "Developer Tools",
  semgrep: "Developer Tools",
  doppler: "Developer Tools",
  "1password-events": "Security",
  infisical: "Developer Tools",
  "hashicorp-vault": "Developer Tools",
};

export default VENDOR_CATEGORIES;
