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