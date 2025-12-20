# Vendor Watch - Vendor Status Monitoring Dashboard

## Overview

Vendor Watch is a full-stack web application for monitoring third-party vendor status pages and detecting service incidents. It provides a dashboard for managing web scraping jobs, viewing vendor health status, tracking incidents, and monitoring system logs. The application is designed as a control center for Python-based scraping tasks that detect outages across major cloud providers and SaaS platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom CSS variables for theming
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a page-based architecture with shared layout components. Pages include Dashboard, Vendors, Jobs, Logs, and Settings. The UI uses a cyber-industrial dark theme with custom fonts (Inter and JetBrains Mono).

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful JSON API under `/api/*` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod with drizzle-zod integration for type-safe API validation

The server handles CRUD operations for vendors, incidents, jobs, and configuration. Routes are registered in `server/routes.ts` and storage operations are abstracted in `server/storage.ts`.

### Authentication
- **Provider**: Replit Auth via OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **Auth Routes**: `/api/login`, `/api/logout`, `/api/callback`, `/api/auth/user`
- **Protected Routes**: All API endpoints require authentication via `isAuthenticated` middleware
- **Client Integration**: `useAuth` hook provides user state, loading status, and logout
- **Landing Page**: Unauthenticated users see a marketing landing page with login button

### Data Model
Six main entities:
1. **Users**: Authenticated users from Replit Auth (stored in `users` table)
2. **Sessions**: User sessions for authentication persistence (stored in `sessions` table)
3. **Vendors**: Third-party services being monitored (Microsoft 365, AWS, Azure, etc.)
4. **Incidents**: Detected outages and issues with severity/impact tracking
5. **Jobs**: Scraping task definitions with schedules and status
6. **Config**: Key-value configuration storage

### Development vs Production
- Development uses Vite dev server with HMR proxied through Express
- Production builds client to `dist/public` and bundles server with esbuild
- Static files served directly in production mode

## External Dependencies

### Database
- **PostgreSQL**: Primary database accessed via `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations stored in `/migrations` directory
- Schema push available via `npm run db:push`

### Third-Party Services Monitored
The application monitors status pages for:
- Microsoft 365, Azure (generic HTML parser)
- AWS, Google Workspace, Salesforce (generic HTML parser)
- Cloudflare, Okta, Zoom, Atlassian (Statuspage.io JSON parser)

### Key npm Dependencies
- `@tanstack/react-query`: Data fetching and caching
- `drizzle-orm` / `drizzle-zod`: Database ORM and validation
- `express`: HTTP server framework
- `recharts`: Dashboard charting
- Full shadcn/ui component set via Radix UI primitives

### Replit Integration
- Custom Vite plugins for dev banner and cartographer
- Meta images plugin for OpenGraph tags
- Runtime error overlay for development

### Email Notifications (Resend)
- **Provider**: Resend API (not using Replit integration - user preference)
- **API Key**: Stored in `RESEND_API_KEY` environment secret
- **From Email**: Configurable via Settings page, stored in database config (`email_from` key)
- **Routes**: `/api/email/config` (GET/PUT), `/api/email/test` (POST)
- **Client**: `server/emailClient.ts` - uses Resend API directly

### SMS Notifications (Twilio)
- **Provider**: Twilio via Replit integration
- **Routes**: `/api/sms/test` for testing

### Notification System
- **Dispatcher**: `server/notificationDispatcher.ts` - sends alerts on incident create/update/resolve
- **Alert Tracking**: `incident_alerts` table prevents duplicate notifications
- **Consent**: TCPA-compliant consent tracking in `notification_consents` table
- **Compliance Endpoint**: `/compliance/consents?token=COMPLIANCE_ACCESS_TOKEN`

### Vendor Subscriptions
- **Table**: `user_vendor_subscriptions` tracks which vendors each user monitors
- **Logic**: 
  - No preferences set = monitor all vendors (including future vendors)
  - Custom selection saved = monitor only selected vendors
  - Empty selection = monitor no vendors (no notifications)
- **Routes**: `/api/vendor-subscriptions` (GET/PUT/DELETE), `/api/my-vendors`, `/api/my-incidents`
- **Config Flag**: `vendor_subscriptions_set:{userId}` tracks if user has customized preferences
- **Reset**: DELETE `/api/vendor-subscriptions` clears custom preferences to restore default (all vendors)
- **UI**: Settings > Notifications tab includes vendor selection checkboxes with Select All, Clear All, Reset to Monitor All, and Save Custom Selection buttons

### Vendor Display Order
- **Table**: `user_vendor_order` stores per-user vendor display order (userId, vendorKey, displayOrder)
- **Routes**: `/api/vendor-order` (GET/PUT) - get and save vendor order
- **Logic**: `/api/my-vendors` returns vendors sorted by user's saved order (unordered vendors appear at end)
- **UI**: Settings > Notifications tab has drag-and-drop reordering with @dnd-kit/sortable
- **Key Files**: `client/src/pages/settings.tsx` (SortableVendorItem component), `server/storage.ts` (getOrderedVendorsForUser)

### Subscription Tiers
- **Tiers**: Standard ($89.99, 10 vendors), Gold ($99.99, 25 vendors + 5 custom requests), Platinum ($129.99, unlimited)
- **Table**: `users.subscriptionTier` stores current tier (standard/gold/platinum)
- **Custom Requests Table**: `custom_vendor_requests` for Gold users to request new vendor integrations
- **Routes**:
  - `/api/vendor-limit` - Get current user's tier info and limits
  - `/api/vendor-requests` (GET/POST/DELETE) - Custom vendor request management
  - `/api/vendors/direct` (POST) - Direct vendor add for Platinum users
- **Tier Enforcement**:
  - Standard: Can monitor up to 10 vendors, no custom vendor requests
  - Gold: Can monitor up to 25 vendors, submit up to 5 custom vendor requests
  - Platinum: Unlimited vendors, can add vendors directly to system
- **Security**: POST `/api/vendors` and `/api/vendors/direct` both require Platinum tier
- **UI**: Vendors page shows tier-appropriate dialog (request form for Gold, direct add for Platinum, upgrade prompt for Standard)
- **Stripe Integration**: Price IDs configured via `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_GOLD`, `STRIPE_PRICE_PLATINUM` env vars
- **Key Files**: `shared/schema.ts` (SUBSCRIPTION_TIERS constant), `server/routes.ts` (tier validation)

### User Notification Preferences
- **Fields**: `users.notificationEmail` (separate from auth email), `users.phone`, `users.notifyEmail`, `users.notifySms`
- **Routes**: `/api/notifications/preferences` (GET/PUT) - manage notification email, phone, and toggles
- **Logic**: 
  - `notificationEmail` is separate from auth email - user can change it without affecting login
  - Falls back to auth email if `notificationEmail` is null
  - Toggles allow users to unsubscribe from email/SMS without deleting contact info
- **UI**: Settings > Notifications tab shows editable email and phone fields with clear subscribe/unsubscribe toggles
- **Consent**: TCPA consent is recorded when user enables notifications

### Subscription Management (Stripe Customer Portal)
- **Route**: `/api/subscription/portal` (POST) - creates Stripe Billing Portal session
- **Requirements**: User must have `stripeCustomerId` set (i.e., have an active subscription)
- **Features**: Update payment method, view invoices, change plan, cancel subscription
- **UI**: Settings > Notifications tab has "Manage My Subscription" button that opens Stripe portal

### Admin-Only Features
- **Field**: `users.isAdmin` boolean field (default false)
- **Middleware**: `isAdmin` middleware in `server/routes.ts` checks user's admin status
- **Admin-Only Pages**: Jobs, Logs, Consents tabs are hidden from sidebar for non-admins
- **Admin-Only Routes**: 
  - All `/api/jobs/*` endpoints require admin
  - GET `/api/consents` (view all consents) requires admin
- **User Access**: Users can still POST consents, view their own consents via `/api/consents/user`, and revoke their own
- **UI**: `client/src/components/layout.tsx` filters navItems based on `user?.isAdmin`