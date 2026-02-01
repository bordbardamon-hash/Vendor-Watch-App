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
- Fixed broken vendor status URLs and improved parser health to 100% (78/78 vendors healthy)
- Removed 22 vendors without working public status APIs: algolia, auth0, braintree, crowdstrike, freshworks, gitlab, heroku, jira, loom, mailchimp, okta, pagerduty, pipedrive, postmark, servicenow, sophos, splunk, webex, automattic, workday, zendesk, zoho
- All remaining 78 vendors use Statuspage.io JSON API or dedicated HTML scrapers (AWS, Azure, Microsoft 365, Google Workspace, Salesforce, Fastly)

### Vendor/Blockchain Coverage
- 78 vendors monitored across cloud, SaaS, security, and enterprise categories (all with working automatic monitoring)
- 110 blockchain networks monitored including L1/L2 chains, DeFi, NFT marketplaces, exchanges, and RPC providers