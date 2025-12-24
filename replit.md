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
- **Vendor Monitoring**: Automated monitoring of 24+ vendor status pages every 5 minutes, supporting Statuspage.io JSON API, custom JSON APIs, and HTML scraping.
- **Blockchain Monitoring**: Dedicated `/blockchain` page for monitoring various blockchain networks across different tiers and categories, integrating with Statuspage.io APIs.
- **Notification System**: Dispatches alerts for incident creation, updates, and resolution via email (Resend) and SMS (Twilio), with consent tracking and deduplication.
- **Subscription Management**: Supports Standard, Gold, and Platinum tiers with varying vendor limits and features (e.g., custom vendor requests for Gold, direct vendor adding for Platinum), integrated with Stripe for billing.
- **User Preferences**: Allows users to manage notification preferences (email, SMS toggles), subscribe to specific vendors, and reorder vendor display.
- **Admin Features**: `isAdmin` flag controls access to administrative pages and API routes (e.g., Jobs, Logs, Consents management).
- **MSP-Focused Features**:
    - **Customer-Ready Alert Summaries**: Generates neutral incident summaries for client communication.
    - **Vendor Reliability Tracking**: Monitors and rates vendor performance based on incident history.
    - **Customer Impact Tagging**: Allows users to tag vendors with high/medium/low customer impact.
    - **Weekly Digest Emails**: Sends periodic summaries of incidents to users.
- **Owner-Only Parser Alerts**: Health alerts for scraping failures are sent exclusively to the designated owner user.
- **Analytics Dashboard**: In-app analytics page (`/analytics`) showing user activity patterns (logins, page views, acknowledgements) and vendor performance trends (uptime %, incident frequency). Activity logging tracks logins, incident/maintenance acknowledgements. Uses `userActivityEvents` and `vendorDailyMetrics` tables for storage.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle Kit**: For database migrations.

### Third-Party Services Monitored
- **Statuspage.io JSON API**: For 13 vendors (e.g., Akamai, Atlassian, Cloudflare, Zoom, HubSpot, Kaseya).
- **Puppeteer Headless Browser**: For 6 JavaScript-rendered vendors (Okta, Auth0, Fastly, ConnectWise, N-able, Syncro).
- **Custom JSON APIs**: Slack (slack-status.com API), Salesforce, AWS (status.aws.amazon.com).
- **HTML Scraping**: For 4 vendors (Azure, Microsoft 365, Google Workspace).
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