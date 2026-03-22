# Vendor Watch - Vendor Status Monitoring Dashboard

## Overview
Vendor Watch is a full-stack web application designed for proactive monitoring of third-party vendor status pages to detect and manage service incidents. It provides a centralized dashboard for web scraping, vendor health tracking, and system log monitoring. The application targets businesses, Managed Service Providers (MSPs), and enterprises with features like advanced analytics, multi-user organizations, and AI-powered insights for incident detection and management.

## User Preferences
Preferred communication style: Simple, everyday language.

## Deployment Architecture
- **Production**: Hosted on Railway. Full sync — all 411 vendors + 58 blockchains every 3.5 minutes in parallel, batch size 30, 300ms inter-batch delay.
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
- **Provider**: Email/password + Google OAuth + GitHub OAuth (session-based)
- **Features**: Two-Factor Authentication (TOTP), Email-based password reset, Mandatory Onboarding, Mobile bearer tokens, Social login (Google, GitHub).
- **OAuth**: Google and GitHub strategies in `server/emailAuth.ts`. Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` env vars. Callback URLs: `{APP_URL}/api/auth/google/callback` and `{APP_URL}/api/auth/github/callback`. Users table has `authProvider` and `authProviderId` columns. OAuth accounts auto-link if email matches existing account. New OAuth users get free tier with profile auto-completed.

### Data Model
Key entities include Users, Sessions, Vendors, Incidents, Jobs, Configurations, Organizations, Subscriptions, Alerts, and Reliability Statistics.

### Feature Specifications
- **Custom Alert Rules (IFTTT)**: If-This-Then-That rule builder at `/settings/alert-rules`. Users define conditions (vendor status, incident severity, incident count, multi-vendor AND logic, chain block time, reliability score, business hours, etc.) and actions (email, SMS, Slack, webhook, log). Rules are evaluated every 2 minutes by `server/alertRuleService.ts`. Cooldown is configurable per rule (default 30 min). Plan limits: Essential=3 rules/email only, Growth=10 rules/all channels, Enterprise=unlimited. DB tables: `alert_rules`, `alert_conditions`, `alert_actions`, `alert_rule_logs`.
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

- **Vendor Reliability Score System (March 2026)**: 0–100 weighted score per vendor calculated from 90-day monitoring data. Formula: uptime% → 40pts, MTTR → 30pts, incident frequency (30d) → 20pts, severity distribution → 10pts. Badges: "Highly Reliable" (90+), "Moderate Risk" (70–89), "Frequent Incidents" (<70). Month-over-month trend (improving/stable/declining). Tables: `vendor_scores` (current scores + breakdown), `vendor_score_history` (monthly snapshots). Calculator module: `server/vendorScoreCalculator.ts`. Runs nightly (24h interval) starting 2 minutes after startup. Public leaderboard page at `/vendor-reliability` (no auth required, embeddable via iframe). Score gauge in vendor detail panel with SVG circle, score bars, sparkline trend. API routes: GET /api/vendors/leaderboard (public), GET /api/vendors/:key/score (auth), GET /api/vendors/:key/score/history (auth), POST /api/vendors/scores/recalculate (admin).

- **Incident War Room (March 2026)**: Real-time collaborative space auto-triggered for P1/P2 (critical/major) incidents. Auto-created in `server/statusSync.ts` on incident creation; closed 1h after resolution (grace period). WebSocket server at `/ws/war-room?warRoomId=X&userId=Y` (`server/warRoomWebSocket.ts`) broadcasts `new_post`, `upvote_update`, `participant_joined`, `war_room_closed` events. Tables: `warRooms` (incidentId unique, vendorKey, vendorName, status, closedAt), `warRoomPosts` (content 280 chars, detail, isSystemUpdate, upvotes), `warRoomParticipants`, `warRoomUpvotes`. Service logic: `server/warRoom.ts` (autoCreateWarRoom, handleIncidentResolved, notifyWarRoomCreated, restoreOpenWarRoomTimers). Frontend: `/war-room/:incidentId` (public read, auth required to post/upvote/join). Features: real-time feed sorted by upvotes, collapsible post detail, participant list, "Copy Client Summary" template, markdown export. API routes: GET /api/war-room/:incidentId (public), GET posts (public), POST posts/upvote/join (auth), GET participants/export (auth). War Room button on incident cards (incidents page) and dashboard for critical/major incidents.

- **Vendor Outage Blog (March 2026)**: AI-generated incident reports auto-triggered when critical/major incidents resolve (skips incidents < 15 min). GPT-4o writes 450–600 word markdown reports using prompt v2 (9-section MSP-focused structure: Summary, Timeline, Affected Services, Impact Assessment, What MSPs Should Do, Vendor Response Summary, Closing CTA). AI receives structured JSON incident payload and returns `{headline, meta_description, body}`. `prompt_version` column tracks which version generated each post. Posts saved as drafts; owner reviews/edits/publishes via `/blog-admin`. Public paginated list at `/outages` (search, vendor filter, RSS link). Individual post pages at `/outages/:slug` with SEO JSON-LD structured data and social share buttons. RSS feed at `/outages/feed.xml`. Service: `server/blogService.ts` (generateBlogPost, listBlogPosts, getBlogPostBySlug, updateBlogPost, getDraftQueue, getRelatedPosts). Auto-trigger in `server/statusSync.ts` on incident resolution for critical/major incidents. Frontend pages: `client/src/pages/outages.tsx`, `client/src/pages/outage-post.tsx`, `client/src/pages/blog-admin.tsx`. Nav: "Outage Reports" in Intelligence section (all users), "Outage Blog" in Admin section (owner-only). API routes: POST /api/blog/generate/:incidentId (auth), GET /api/blog/posts (public), GET /api/blog/queue (auth), GET /api/blog/posts/:slug (public), PATCH /api/blog/posts/:id (auth).

## Key Features

### Is Web3 Healthy? Dashboard (`/web3-health`)
- **SEO-optimised public page** targeting "Is web3 down?" — meta title, description, and canonical tag set; H1 contains the exact phrase
- **Hero verdict** — full-viewport-width colored banner (green/yellow/orange/red) calculated from live incident data: "All Systems Healthy" | "Minor Disruptions" | "Degraded Performance" | "Major Outage" — logic: any critical→red, any major→orange, ≥4 minor→orange, 1–3 minor→yellow, 0→green
- **Blockchain health grid** — card per chain with name/logo, status dot, avg block time, active incident count. Filter tabs: All | L1 Chains | L2 Networks. Sort: tier1 first (ETH/BTC/SOL/BNB), then tier2 L2s
- **Web3 infrastructure strip** — horizontal pill row for rpc_provider, oracle, indexer, nft, staking, defi category blockchain entries (Infura, Alchemy, QuickNode, OpenSea, Aave, etc.)
- **Live incident feed** — combined vendor + blockchain incidents, severity sorted, last 20 active. Links to `/outages`
- **30-day trend chart** (Recharts AreaChart) — stacked chain incidents (purple) + vendor incidents (blue), reference lines at 2/day (green) and 5/day (yellow)
- **Embeddable widget** — `/web3-health/widget` renders compact 400×300 view (verdict + top-5 incidents + footer link). Embed dialog generates `<iframe>` snippet
- **Share button** — native share API with clipboard fallback
- **Auto-refresh** — polls every 60s with countdown timer
- **API** — GET `/api/web3-health/summary` (30s cache), GET `/api/web3-health/trend` (60s cache)
- **Service** — `server/web3HealthService.ts` with 30s in-memory cache to handle traffic spikes

### Cross-Chain/Cross-Vendor Dependency Map (`/dependency-map`)
- **Cytoscape.js** interactive graph with cose-bilkent layout
- 34 hardcoded seed relationships between vendors (AWS, GCP, Azure, Cloudflare, GitHub, etc.) and blockchain entities (Ethereum, Infura, Alchemy, MetaMask, Aave, OpenSea, Arbitrum, etc.)
- **Blast radius analysis**: Click any node → "Run Analysis" → BFS traversal finds all downstream dependents; severity rated Low/Medium/High
- **Auto-blast via URL**: `/dependency-map?blast=aws` pre-loads analysis for any node
- **Shareable link**: "Share This Analysis" copies a pre-loaded URL to clipboard
- **Embeddable widget**: `/dependency-map?embed=1` strips nav for iFrame embedding; copy snippet dialog
- **Community suggestions**: Any user can suggest new dependency edges (POST `/api/dependency-map/suggestions`); owner can approve/reject in admin
- Node size = downstream dependency count; border color = live status; dashed edges = community-submitted
- Filter by node type (vendor/blockchain) and edge relationship type
- DB tables: `dependency_edges`, `dependency_suggestions`
- Seeding: `server/dependencyMapSeed.ts` (idempotent, runs on startup)
- Service: `server/dependencyMapService.ts`

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