# Vendor Watch - Vendor Status Monitoring Dashboard

## Overview
Vendor Watch is a full-stack web application designed for proactive monitoring of third-party vendor status pages to detect and manage service incidents. It provides a centralized dashboard for web scraping, vendor health tracking, and system log monitoring. The application targets businesses, Managed Service Providers (MSPs), and enterprises with features like advanced analytics, multi-user organizations, and AI-powered insights for incident detection and management.

## User Preferences
Preferred communication style: Simple, everyday language.

## Deployment Architecture
- **Production**: Hosted on Railway. Full sync — all 409 vendors + 110 blockchains every 2 minutes in parallel, batch size 30, 300ms inter-batch delay.
- **Development**: Runs on Replit with same sync settings. Notifications are disabled in dev (only sent when `NODE_ENV=production` or `ENABLE_NOTIFICATIONS=true`). Both environments share the same PostgreSQL database (hosted on Replit).
- Domain: vendorwatch.app (DNS via Cloudflare, pointed at Railway)

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
- **Provider**: Email/password authentication (session-based)
- **Features**: Two-Factor Authentication (TOTP), Email-based password reset, Mandatory Onboarding, Mobile bearer tokens.
- **Note**: Replit OAuth was removed after migrating to Railway. All users authenticate via email/password.

### Data Model
Key entities include Users, Sessions, Vendors, Incidents, Jobs, Configurations, Organizations, Subscriptions, Alerts, and Reliability Statistics.

### Feature Specifications
- **Vendor Monitoring**: Automated monitoring of diverse vendor status pages (Statuspage.io, custom JSON, HTML scraping) every 60 seconds. Supports various blockchain networks and RPC providers.
- **Notification System**: Multi-channel alerts (email, SMS, Discord, Slack/Teams, PagerDuty) for incidents, with user-configurable preferences, including component-level filtering, incident lifecycle toggles (New, Updates, Resolved), and maintenance reminders. Notifications are strictly opt-in.
- **Subscription Management**: Tiered plans (Free, Essential, Growth, Enterprise) with per-seat pricing (paid tiers). Free tier: 2 vendors, 1 blockchain, email-only. Essential: 25 vendors, email + Slack + webhooks. Growth: 100 vendors, 25 blockchains, all channels. Enterprise: unlimited. 14-day free trial on paid tiers. Free tier bypasses Stripe checkout.
- **User Management**: Multi-user organizations with Role-Based Access Control (Master Admin, Read/Write, Read-Only), domain restriction, and invitation system.
- **MSP-Focused Features**: Customer-ready alert summaries, vendor reliability tracking, client tagging, weekly digest emails, client labels, incident playbooks, and mobile status views.
- **Enterprise Features**: Autonomous response orchestrator, SLA breach tracker, synthetic monitoring, AI Communication Copilot, predictive outage detection, white-labeled client portals with password protection, PSA/ticketing integrations, custom webhooks with HMAC signing, API access, audit logs, uptime reports, and SSO/SAML.
- **Embeddable Status Widgets**: Provides public endpoints for self-contained HTML widgets (with TV mode), SVG badges, and JSON APIs with CORS.
- **Normalized Status States**: Maps diverse vendor statuses to 4 simple states (up/warn/down/maintenance).
- **Early Warning Signals**: Crowdsourced report submission with dynamic confidence scoring.
- **Historical Data & Reporting**: Generation of reports including uptime%, MTTR, and incident counts.
- **Incident Archival**: Resolved incidents are automatically archived after 1 day (by createdAt or startedAt). Archival runs on startup and hourly. Sync checks the archive before re-creating incidents to prevent re-ingestion of already-archived incidents. Archives are purged after 1 year.

- **Landing Page Redesign (March 2026)**: Complete overhaul inspired by incidenthub.cloud and statusgator.com. Enhanced nav with anchor links (Features, How It Works, Pricing). Feature pills below hero. Live incident feed mockup. Alternating left-right feature sections with visual mockups. Social proof with testimonials. Consolidated Enterprise+MSP features. Better visual hierarchy.

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
- **Discord**: For rich embed notifications.
- **Slack/Teams**: For incident notifications.
- **PagerDuty**: For incident management.

### Payment Gateway
- **Stripe**: For subscription management and billing.