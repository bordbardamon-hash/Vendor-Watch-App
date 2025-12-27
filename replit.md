# Vendor Watch - Vendor Status Monitoring Dashboard

## Overview
Vendor Watch is a full-stack web application designed to monitor third-party vendor status pages and detect service incidents. It provides a centralized dashboard for managing web scraping jobs, viewing vendor health, tracking incidents, and monitoring system logs. The application functions as a control center for Python-based scraping tasks that identify outages across major cloud providers, SaaS platforms, and blockchain infrastructure. Its primary purpose is to offer proactive incident detection and management for businesses relying on external services, with advanced features tailored for Managed Service Providers (MSPs).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS v4 with custom theming
- **Build Tool**: Vite
- **Design**: Cyber-industrial dark theme with custom fonts.

### Backend
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful JSON API (`/api/*`)
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod with drizzle-zod

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL-backed sessions
- **Access Control**: `isAuthenticated` middleware for all API endpoints.
- **Two-Factor Authentication (2FA)**: TOTP-based 2FA with recovery codes.

### Data Model
Key entities include Users, Sessions, Vendors, Incidents, Jobs, and Configuration. Dedicated tables for Blockchain Chains, Incidents, and User Subscriptions, as well as Notification Consents, Incident Alerts, Vendor Reliability Stats, Custom Vendor Requests, and User Vendor Orders.

### Development & Production
- **Development**: Vite dev server with HMR proxied through Express.
- **Production**: Client built to `dist/public`, server bundled with esbuild.

### Feature Specifications
- **Vendor Monitoring**: Automated monitoring of 45+ vendor status pages every 5 minutes, supporting Statuspage.io JSON API, custom JSON APIs, and HTML scraping.
- **Blockchain Monitoring**: Dedicated `/blockchain` page for monitoring various blockchain networks across different tiers and categories, integrating with Statuspage.io APIs.
- **Notification System**: Dispatches alerts for incident creation, updates, and resolution via email (Resend) and SMS (Twilio), with consent tracking and deduplication.
- **Subscription Management**: Supports Essential ($89/mo), Growth ($129/mo), and Enterprise ($189/mo) tiers with tiered feature access:
  - **Essential**: 10 vendors, email alerts only, no blockchain/automation/SMS
  - **Growth**: 25 vendors, email + SMS alerts, 10 blockchain networks, basic automation, 3 custom vendor requests
  - **Enterprise**: Unlimited vendors/blockchain/staking, full automation, AI Copilot, direct vendor addition
- **User Preferences**: Allows users to manage notification preferences (email, SMS toggles, timezone), subscribe to specific vendors, and reorder vendor display. Timezone setting affects all date displays in emails, SMS alerts, and dashboard views.
- **Admin Features**: `isAdmin` flag controls access to administrative pages and API routes (e.g., Jobs, Logs, Consents management).
- **MSP-Focused Features**:
    - **Customer-Ready Alert Summaries**: Generates neutral incident summaries for client communication.
    - **Vendor Reliability Tracking**: Monitors and rates vendor performance based on incident history.
    - **Customer Impact Tagging**: Allows users to tag vendors with high/medium/low customer impact.
    - **Weekly Digest Emails**: Sends periodic summaries of incidents to users.
    - **Client Labels** (Growth+): Organize vendors by client with priority levels (critical/high/medium/low). Available at `/clients` page.
    - **Incident Playbooks** (Growth+): Create step-by-step response guides for different incident types and severities. Available at `/playbooks` page.
    - **Mobile Status View** (Growth+): Mobile-friendly quick status dashboard showing vendor and blockchain health at a glance. Available at `/mobile-status` page.
- **Enterprise Features (Vendors and Blockchain)**:
    - **Autonomous Response Orchestrator**: Automation rules trigger on both vendor and blockchain incidents. Rules defined for vendor events (newIncident, incidentUpdate, incidentResolved) also fire for corresponding blockchain events.
    - **SLA Breach Tracker**: Tracks SLA contracts with uptime targets for both vendors and blockchain chains. Uses `resourceType` field to distinguish between resource types. Calculates blockchain uptime from incident duration data.
    - **Synthetic Monitoring**: Probes can monitor both vendor and blockchain API endpoints using the `resourceType` field to specify the target resource type.
    - **AI Communication Copilot**: Generates professional incident updates and root cause analysis for both vendor and blockchain incidents. Separate API routes for blockchain incidents with subscription-based authorization.
- **Owner-Only Parser Alerts**: Health alerts for scraping failures are sent exclusively to the designated owner user.
- **Analytics Dashboard**: In-app analytics page (`/analytics`) showing user activity patterns (logins, page views, acknowledgements) and vendor performance trends (uptime %, incident frequency). Activity logging tracks logins, incident/maintenance acknowledgements. Uses `userActivityEvents` and `vendorDailyMetrics` tables for storage.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle Kit**: For database migrations.

### Third-Party Services Monitored
- **Statuspage.io JSON API**: For 35+ vendors including:
  - Cloud/CDN: Cloudflare, Akamai, DigitalOcean, Linode
  - Collaboration: Atlassian, Zoom, Slack
  - Authentication: Okta, Auth0, Duo Security
  - Payments: Stripe, PayPal, QuickBooks
  - File Storage: Dropbox, Box
  - Remote Access: TeamViewer, LogMeIn
  - Backup/DR: Veeam, Acronis, Datto, Carbonite
  - Business Apps: Zendesk, ServiceNow, Freshworks, HubSpot
  - DevOps: GitHub, Datadog, PagerDuty, New Relic
  - MSP Tools: Kaseya, ConnectWise, N-able, Syncro
- **Puppeteer Headless Browser**: For JavaScript-rendered vendor pages requiring browser rendering.
- **Custom JSON APIs**: Slack (slack-status.com API), Salesforce, AWS (status.aws.amazon.com).
- **HTML Scraping**: For vendors without APIs (Azure, Microsoft 365, Google Workspace, Google Cloud Platform).
- **Blockchain APIs**: Statuspage.io APIs for 16 chains/wallets (Solana, Avalanche, Arbitrum, Base, Stellar, Infura, Alchemy, QuickNode, The Graph, MetaMask, Ledger, Coinbase Wallet, Argent, Polygon, Gnosis Safe, Bybit Wallet).
- **WalletConnect Wallets**: 8 popular wallet vendors monitored (MetaMask, Trust Wallet, Ledger, Coinbase Wallet, Rainbow, Argent, Gnosis Safe, Bybit). Wallets with Statuspage APIs sync automatically; others track timestamps only.
- **Decentralized Chains**: Bitcoin, Ethereum, BSC, Cosmos, TRON, Ripple tracked with timestamp updates (no centralized status pages exist for fully decentralized networks).
- **Staking Platforms**: 15 staking platforms across three categories:
  - CEXs: Binance, Coinbase, Kraken, Gemini (4 platforms; Coinbase, Kraken, Gemini sync via Statuspage)
  - Liquid Staking/DeFi: Lido Finance, Rocket Pool, StakeWise, Stake DAO, Marinade Finance (5 platforms)
  - Institutional Providers: RockX, Figment, Ankr, Crypto.com, Kiln, Bybit (6 platforms; Crypto.com, Bybit sync via Statuspage)

### Notification Providers
- **Resend**: For email notifications (`RESEND_API_KEY`).
- **Twilio**: For SMS notifications (via Replit integration).

### Payment Gateway
- **Stripe**: For subscription management and customer portal integration, configured via `STRIPE_PRICE_*` environment variables.

### Key npm Libraries
- `@tanstack/react-query`
- `drizzle-orm`, `drizzle-zod`
- `express`
- `recharts`
- `shadcn/ui`, `radix-ui`
- `wouter`
- `otpauth` (for 2FA)
- `@dnd-kit/sortable` (for UI reordering)