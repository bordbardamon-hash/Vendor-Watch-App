# Vendor Watch - Vendor Status Monitoring Dashboard

## Overview
Vendor Watch is a full-stack web application designed to proactively monitor third-party vendor status pages and detect service incidents. It offers a centralized dashboard for managing web scraping jobs, tracking vendor health, and monitoring system logs. The application is built to provide proactive incident detection and management for businesses, with advanced features tailored for Managed Service Providers (MSPs) and enterprises, including advanced analytics, multi-user organizations, and AI-powered insights.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS v4 with custom theming
- **Design**: Cyber-industrial dark theme.

### Backend
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful JSON API
- **Database ORM**: Drizzle ORM with PostgreSQL

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Features**: Two-Factor Authentication (TOTP), Email-based password reset, Mandatory Onboarding for new users.

### Data Model
Key entities include Users, Sessions, Vendors, Incidents, Jobs, Configurations, and comprehensive support for organizations, subscriptions, alerts, and detailed reliability statistics.

### Feature Specifications
- **Vendor Monitoring**: Automated monitoring of diverse vendor status pages (Statuspage.io, custom JSON, HTML scraping) every 5 minutes.
- **Blockchain Monitoring**: Dedicated section for various blockchain networks and RPC providers.
- **Notification System**: Multi-channel alerts (email via Resend, SMS via Twilio) for incidents, with user-configurable preferences.
- **Subscription Management**: Tiered subscription plans (Essential, Growth, Enterprise) with per-seat pricing and features like advanced analytics, AI Copilot, and increased resource limits.
- **User Management**: Multi-user organizations with Role-Based Access Control (Master Admin, Read/Write, Read-Only), domain restriction, and invitation system.
- **MSP-Focused Features**: Customer-ready alert summaries, vendor reliability tracking, client tagging, weekly digest emails, client labels, incident playbooks, and mobile status views.
- **Enterprise Features**: Autonomous response orchestrator, SLA breach tracker, synthetic monitoring, AI Communication Copilot, predictive outage detection, white-labeled client portals, PSA/ticketing integrations, custom webhooks, Slack/Teams integration, API access, audit logs, uptime reports, and SSO/SAML.
- **Data Retention**: Configurable data retention policies for telemetry, predictions, and activity events.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.

### Third-Party Services Monitored
- **Statuspage.io JSON API**: For numerous cloud providers, SaaS platforms, and blockchain services.
- **Puppeteer Headless Browser**: For JavaScript-rendered pages.
- **Custom JSON APIs**: For specific services like Slack, Salesforce, AWS.
- **HTML Scraping**: For major services like Azure, Microsoft 365, Google Workspace.
- **Blockchain APIs**: For various L1/L2 chains, RPC providers, wallets, and staking platforms.

### Notification Providers
- **Resend**: For email notifications.
- **Twilio**: For SMS notifications.

### Payment Gateway
- **Stripe**: For subscription management and billing.

## Recent Changes (January 2026)

### Parser Health Improvements
- Fixed broken vendor status URLs and improved parser health to 100% (75/75 vendors healthy)
- Removed 25 vendors without working public status APIs: algolia, auth0, braintree, crowdstrike, freshworks, gitlab, heroku, jira, loom, mailchimp, okta, pagerduty, pipedrive, postmark, servicenow, sophos, splunk, webex, automattic, workday, zendesk, zoho, fastly, nable, syncro
- All remaining 75 vendors use Statuspage.io JSON API or dedicated HTML scrapers (AWS, Azure, Microsoft 365, Google Workspace, Salesforce)

### Vendor/Blockchain Coverage
- 75 vendors monitored across cloud, SaaS, security, and enterprise categories (all with working automatic monitoring)
- 110 blockchain networks monitored including L1/L2 chains, DeFi, NFT marketplaces, exchanges, and RPC providers

## Recent Changes (February 2026)

### Alert Assignment System
- New `org_alert_assignments` table for delegating vendor/blockchain monitoring to specific team members
- Master admins can assign vendors and blockchains to individual team members via Team Management page
- Notification dispatchers (vendor, lifecycle, blockchain) now check for alert assignments and route notifications only to assigned members
- When no assignments exist for a target, default behavior is preserved (all subscribed users get notified)
- Bulk assignment API (`/api/org/alert-assignments/bulk`) replaces all assignments for a member at once
- UI includes searchable vendor/blockchain picker dialog with Select All/Clear All controls

### Competitive Parity Features (February 2026)
- **Component-Level Monitoring**: `vendor_components` table tracks individual service components (e.g., AWS EC2, S3). Components parsed from Statuspage.io /summary.json API and synced on every vendor status update. Frontend shows collapsible "Service Components" section in vendor detail panel with grouped, color-coded statuses. API: GET /api/vendors/:key/components, GET /api/components
- **Outbound Webhooks with HMAC Signing**: `webhookDispatcher.ts` fires HMAC-SHA256 signed payloads on new/update/resolved incidents. Integrated into notificationDispatcher lifecycle. 10-second timeout, delivery logging via `webhookLogs` table. Full CRUD UI in webhooks.tsx
- **Embeddable Status Widgets**: `embedRoutes.ts` provides public endpoints - /embed/:slug (self-contained HTML widget with TV mode and 60s auto-refresh), /status/:slug/badge.svg (shields.io-style SVG badge), /status/:slug/api (JSON with CORS). Embed code generator dialog on portals page with tabs for iframe, badge, API, and TV display
- **Slack/Teams Integration**: `slack-teams.ts` formats and dispatches incident notifications to Slack/Teams channels via incoming webhooks. Full integration management UI on /integrations page with add/test/delete
- **Public Branded Status Pages**: Portal system with embed functionality, TV mode for NOC displays, and branded status page generation
- **Normalized Status States**: `statusNormalizer.ts` maps diverse vendor statuses to 4 simple states (up/warn/down/maintenance). Enriched in /api/vendors responses as `normalizedStatus`. Filter badges on vendors page with color-coded status counts.
- **Website & Ping Monitoring**: Synthetic probe scheduler runs every 60s checking HTTP endpoints. CRUD API for probes (syntheticProbes table), results tracked in syntheticProbeResults. Monitoring page (/monitoring) with probe management, stats cards, latency charts, on-demand testing.
- **PagerDuty Integration**: `server/notifications/pagerduty.ts` notifier using Events API v2. Auto-trigger/acknowledge/resolve PagerDuty incidents on vendor/blockchain lifecycle events. Integrated into notificationDispatcher.ts. Full CRUD + test on integrations page.
- **Early Warning Signals**: Crowdsourced report submission (POST /api/predictions/report) with dynamic confidence scoring. Enhanced predictions page with summary cards, confidence badges (red >80%, yellow >50%, blue <50%), source filter (AI/Crowdsourced).
- **Historical Data & Reporting**: Report generation pipeline (POST /api/reports/generate) calculating uptime%, MTTR, incident counts from real incident data. Enhanced reports page with generate dialog, expandable results, vendor breakdown, CSV download.
- **Portal Password Protection**: `accessType` (public/password/private) and bcrypt-hashed `accessPassword` columns on clientPortals. Server-side enforcement on public portal endpoints. Access control dialog on portals page, password gate on public portal view.
- **Expanded Service Directory**: 400 vendors monitored (up from 108), adding 302 services with working Statuspage.io JSON API endpoints across 30+ categories including cloud infrastructure, CDN/DNS, CI/CD, databases, communication, CRM, security, payments, e-commerce, AI/ML, observability, and more. New vendors stored in `server/newVendors.ts` with deduplication in `server/storage.ts`. 207 vendors without working public status APIs were removed to maintain 100% parser health.
- **Discord Notifications**: `server/notifications/discord.ts` sends rich embed notifications to Discord channels via incoming webhooks. Integrated into notificationDispatcher.ts for all vendor and blockchain lifecycle events (new/update/resolved). Full CRUD + test on integrations page.
- **1-Minute Sync Interval**: Vendor status checks now run every 60 seconds (changed from 5 minutes) for faster incident detection, matching StatusGator's monitoring frequency.
- **Notification Opt-In Policy**: Notifications are strictly opt-in. Users only receive notifications if they: 1) explicitly subscribe to specific vendors/blockchains, AND 2) enable email or SMS notification channels. Users with no subscriptions or no enabled channels receive zero notifications. Enforced in dispatchIncidentNotification, dispatchLifecycleNotification, and blockchain notification paths.
- **Dashboard Monitored Filter**: Clicking "Monitored Vendors" or "Blockchains" tiles on the dashboard navigates to filtered views showing only subscribed items (?filter=monitored). Both Vendors and Blockchain pages have a "Monitored" filter button/card.
- **Admin Password Management**: Owner-only feature on Users page. Two actions per user: 1) Send password reset email (POST /api/admin/users/:userId/send-reset-email) generates a 24-hour reset token and emails the user a reset link. 2) Set new password directly (POST /api/admin/users/:userId/reset-password) hashes and stores a new password immediately. Both endpoints require isOwner middleware. UI includes Send icon button, KeyRound icon button, and a dialog for entering new passwords with 8-char minimum validation.