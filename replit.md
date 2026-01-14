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
- **Password Reset**: Email-based password reset flow via Resend. Users request reset at `/forgot-password`, receive email with secure token link, and set new password at `/reset-password`. Tokens expire after 1 hour.
- **Mandatory Onboarding**: All Replit Auth users must complete onboarding at `/onboarding` before accessing the app:
  - New users get a 7-day free trial (`trialEndsAt` field)
  - Must provide required info: firstName, lastName, companyName, phone
  - `profileCompleted` field tracks completion status
  - Route guards redirect incomplete profiles to onboarding
  - API: `POST /api/onboarding/complete` to save profile, `GET /api/onboarding/status` to check status

### Data Model
Key entities include Users, Sessions, Vendors, Incidents, Jobs, and Configuration. Dedicated tables for Blockchain Chains, Incidents, and User Subscriptions, as well as Notification Consents, Incident Alerts, Vendor Reliability Stats, Custom Vendor Requests, User Vendor Orders, Organizations, Organization Members, and Organization Invitations.

### Development & Production
- **Development**: Vite dev server with HMR proxied through Express.
- **Production**: Client built to `dist/public`, server bundled with esbuild.

### Feature Specifications
- **Vendor Monitoring**: Automated monitoring of 50 vendor status pages every 5 minutes, supporting Statuspage.io JSON API, custom JSON APIs, and HTML scraping.
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
- **Multi-User Organizations**: Team management feature at `/team` allowing organizations to share a subscription across multiple users:
    - **Role-Based Access Control (RBAC)**: Three roles - Master Admin (full access, can manage team), Read/Write Member (can modify settings/acknowledge incidents), Read-Only Member (view only)
    - **Up to 3 Master Admins** per organization with full management capabilities
    - **Domain Restriction**: Only users with matching email domain (@company.com) can be invited to an organization
    - **Invitation System**: Email-based invitations with 7-day expiry, secure tokens, and acceptance flow at `/accept-invite/:token`
    - **Backward Compatible**: Existing users without organizations can continue using their individual subscriptions
- **White-Labeled Client Portals** (Growth+): Custom branded status pages for MSP clients at `/portals`:
    - **Custom Branding**: Logo, primary/secondary/background colors, custom header/footer text
    - **Slug-Based Public URLs**: Public access at `/status/:slug` without authentication
    - **Vendor/Blockchain Selection**: Multi-select categorized checkboxes for choosing which resources to display
    - **Privacy Controls**: Toggle between public and private (token-protected) portals
    - **Email Subscriptions**: Optional subscriber notifications for portal updates
    - **View Tracking**: Monitor portal visit counts
- **PSA/Ticketing Integration** (Growth+): Auto-ticket creation with external PSA tools at `/psa-integrations`:
    - **Supported Platforms**: ConnectWise, Autotask, Kaseya, Syncro, HaloPSA
    - **Secure Credential Storage**: API keys and OAuth tokens stored with sensitive data sanitized in responses
    - **Ticket Rules**: Configure automatic ticket creation based on incident severity and vendor
    - **Connection Testing**: Verify PSA connectivity before enabling auto-ticketing
    - **Ticket Linking**: Track tickets created for each incident
- **Predictive Outage Detection** (Enterprise only): AI-powered forecasting at `/predictions`:
    - **Telemetry Collection**: Track response time, error rate, availability metrics for vendors/chains
    - **Pattern Analysis**: Identify recurring outage patterns (time-of-day, day-of-week correlations)
    - **Confidence Scoring**: Predictions include confidence levels (low/medium/high/critical)
    - **7-Day Forecast Calendar**: Visual calendar showing predicted risk windows
    - **User Feedback**: Acknowledge predictions and provide accuracy feedback

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle Kit**: For database migrations.

### Third-Party Services Monitored
- **Statuspage.io JSON API**: For 50 vendors including:
  - Cloud/CDN: Cloudflare, Akamai, DigitalOcean, Linode, Fastly
  - Collaboration: Atlassian, Zoom, Slack
  - Authentication: Okta, Auth0, Duo Security, Ping Identity
  - Payments: Stripe, PayPal, QuickBooks
  - File Storage: Dropbox, Box
  - Remote Access: TeamViewer
  - Backup/DR: Datto, Carbonite
  - Business Apps: HubSpot, Oracle NetSuite, SentinelOne, Fireblocks
  - DevOps: GitHub, Datadog, New Relic, Sentry, CircleCI
  - MSP Tools: Kaseya, ConnectWise, N-able, Syncro
  - Developer Platforms: Twilio, OpenAI, Vercel, MongoDB, Supabase, Render, Linear
  - Email Services: Mailgun, SendGrid
  - E-commerce: Shopify
  - Media: Cloudinary
- **Puppeteer Headless Browser**: For JavaScript-rendered vendor pages requiring browser rendering.
- **Custom JSON APIs**: Slack (slack-status.com API), Salesforce, AWS (status.aws.amazon.com).
- **HTML Scraping**: For vendors without APIs (Azure, Microsoft 365, Google Workspace, Google Cloud Platform).
- **Blockchain APIs**: Statuspage.io APIs for 30+ chains/wallets including:
  - L1 Chains: Solana, Avalanche, Polygon, Stellar, NEAR, Sui, Aptos, Celo
  - L2 Networks: Arbitrum, Optimism, Base, zkSync Era, Scroll, Linea, Mode, Mantle
  - RPC Providers: Infura, Alchemy, QuickNode, The Graph
  - Wallets: MetaMask, Ledger, Coinbase Wallet, Argent, Gnosis Safe, Phantom, Trezor, OKX Wallet, Exodus, Uniswap Wallet
- **WalletConnect Wallets**: 8 popular wallet vendors monitored (MetaMask, Trust Wallet, Ledger, Coinbase Wallet, Rainbow, Argent, Gnosis Safe, Bybit). Wallets with Statuspage APIs sync automatically; others track timestamps only.
- **Decentralized Chains**: Bitcoin, Ethereum, BSC, Cosmos, TRON, Ripple tracked with timestamp updates (no centralized status pages exist for fully decentralized networks).
- **Staking Platforms**: 21 staking platforms across three categories:
  - CEXs: Binance, Coinbase, Kraken, Gemini (4 platforms; Coinbase, Kraken, Gemini sync via Statuspage)
  - Liquid Staking/DeFi: Lido Finance, Rocket Pool, StakeWise, Stake DAO, Marinade Finance (5 platforms)
  - Institutional Providers: RockX, Figment, Ankr, Crypto.com, Kiln, Bybit, Allnodes, Blockdaemon, Everstake, Chorus One, P2P Validator, Stakefish (12 platforms; most sync via Statuspage)

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