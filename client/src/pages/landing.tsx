import { APP_NAME } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Bell, Zap, CheckCircle2, AlertTriangle, Cloud, Database, Globe, Server, Boxes, Check, X, Shield, Bot, Timer, Gauge, Radio, UserPlus, Settings, BellRing, Mail, Phone, MapPin, Twitter, Linkedin, Github, ArrowRight, Webhook, Layout, BarChart3, Eye, Layers, Brain, MessageSquare, TrendingUp, MonitorCheck, Code, Users, Lock } from "lucide-react";
import { Link } from "wouter";
import { VendorWatchLogo } from "@/components/ui/vendor-watch-logo";

function DashboardPreview() {
  const vendors = [
    { name: "AWS", status: "operational", icon: Cloud },
    { name: "Microsoft 365", status: "operational", icon: Server },
    { name: "Cloudflare", status: "operational", icon: Globe },
    { name: "Salesforce", status: "degraded", icon: Database },
    { name: "Duo Security", status: "operational", icon: Shield },
    { name: "Zoom", status: "operational", icon: Activity },
  ];

  const incidents = [
    { vendor: "Salesforce", title: "API Performance Degradation", severity: "minor", time: "2h ago" },
    { vendor: "AWS", title: "S3 Latency Issues", severity: "resolved", time: "5h ago" },
  ];

  return (
    <div className="relative rounded-xl border bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-muted-foreground ml-2">Vendor Watch Dashboard</span>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-background/50 rounded-lg p-4 border">
            <div className="text-2xl font-bold text-green-500">400+</div>
            <div className="text-xs text-muted-foreground">Services Monitored</div>
          </div>
          <div className="bg-background/50 rounded-lg p-4 border">
            <div className="text-2xl font-bold text-yellow-500">1</div>
            <div className="text-xs text-muted-foreground">Active Incidents</div>
          </div>
          <div className="bg-background/50 rounded-lg p-4 border">
            <div className="text-2xl font-bold text-primary">99.9%</div>
            <div className="text-xs text-muted-foreground">Avg Uptime</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-background/50 rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Vendor Status
            </h3>
            <div className="space-y-2">
              {vendors.map((vendor) => (
                <div key={vendor.name} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <vendor.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{vendor.name}</span>
                  </div>
                  {vendor.status === "operational" ? (
                    <div className="flex items-center gap-1 text-green-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="text-xs">Operational</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-yellow-500">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="text-xs">Degraded</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-background/50 rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Recent Incidents
            </h3>
            <div className="space-y-3">
              {incidents.map((incident, i) => (
                <div key={i} className="p-2 rounded bg-muted/30 border-l-2 border-l-yellow-500">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{incident.vendor}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      incident.severity === "resolved" 
                        ? "bg-green-500/20 text-green-400" 
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {incident.severity}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{incident.title}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{incident.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SERVICE_CATEGORIES = [
  { name: "Cloud & Infrastructure", count: 30, color: "text-blue-400" },
  { name: "Security & Identity", count: 35, color: "text-red-400" },
  { name: "Payments & Fintech", count: 25, color: "text-green-400" },
  { name: "AI & Machine Learning", count: 15, color: "text-purple-400" },
  { name: "DevOps & CI/CD", count: 30, color: "text-orange-400" },
  { name: "Communication", count: 25, color: "text-cyan-400" },
  { name: "Databases & Storage", count: 20, color: "text-yellow-400" },
  { name: "Observability & APM", count: 20, color: "text-pink-400" },
];

const TRUSTED_LOGOS = [
  "AWS", "Azure", "Google Cloud", "Cloudflare", "Stripe", "OpenAI",
  "GitHub", "Slack", "Salesforce", "Datadog", "MongoDB", "Twilio",
  "Shopify", "HubSpot", "PagerDuty", "Zoom",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <VendorWatchLogo size={32} />
            <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition hidden sm:inline">
              Pricing
            </Link>
            <Link href="/signup">
              <Button variant="outline" data-testid="button-signup">
                Sign Up
              </Button>
            </Link>
            <Link href="/login">
              <Button data-testid="button-login">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20" data-testid="badge-service-count">
            <MonitorCheck className="h-4 w-4" />
            Now monitoring 400+ services across 30+ categories
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6" data-testid="text-hero-title">
            Monitor Every Vendor.<br />
            <span className="text-primary">Detect Outages First.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10" data-testid="text-hero-description">
            {APP_NAME} monitors 400+ cloud services, SaaS platforms, and blockchain networks in real-time.
            Get instant alerts via email, SMS, Slack, Teams, PagerDuty, and webhooks before your customers notice.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-6" data-testid="button-get-started">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6" data-testid="button-view-pricing">
                View Pricing
              </Button>
            </Link>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="container mx-auto px-4 py-8">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-4">Monitoring status for</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 max-w-4xl mx-auto">
            {TRUSTED_LOGOS.map((name) => (
              <span key={name} className="text-sm text-muted-foreground/60 font-medium">{name}</span>
            ))}
            <span className="text-sm text-primary font-medium">+380 more</span>
          </div>
        </section>

        {/* Dashboard Preview */}
        <section className="container mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">See Your Vendors at a Glance</h2>
            <p className="text-muted-foreground">A powerful dashboard that keeps you informed 24/7</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <DashboardPreview />
          </div>
        </section>

        {/* Stats Bar */}
        <section className="border-y bg-card/30 py-12">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div data-testid="stat-services">
                <div className="text-4xl font-bold text-primary mb-1">400+</div>
                <div className="text-sm text-muted-foreground">Services Monitored</div>
              </div>
              <div data-testid="stat-categories">
                <div className="text-4xl font-bold text-primary mb-1">30+</div>
                <div className="text-sm text-muted-foreground">Service Categories</div>
              </div>
              <div data-testid="stat-blockchains">
                <div className="text-4xl font-bold text-primary mb-1">110+</div>
                <div className="text-sm text-muted-foreground">Blockchain Networks</div>
              </div>
              <div data-testid="stat-uptime">
                <div className="text-4xl font-bold text-primary mb-1">5min</div>
                <div className="text-sm text-muted-foreground">Polling Interval</div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Features */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Stay Ahead</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">From real-time monitoring to AI-powered insights, {APP_NAME} gives you complete visibility into your vendor ecosystem</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card/50" data-testid="card-feature-monitoring">
              <CardHeader>
                <Activity className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Real-time Monitoring</CardTitle>
                <CardDescription>
                  Continuously monitor 400+ vendor status pages every 1 minute. Detect incidents as they happen with automatic status normalization.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50" data-testid="card-feature-alerts">
              <CardHeader>
                <Bell className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Multi-Channel Alerts</CardTitle>
                <CardDescription>
                  Get notified via email, SMS, Slack, Microsoft Teams, PagerDuty, or custom webhooks. Route alerts to the right team members automatically.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50" data-testid="card-feature-dashboard">
              <CardHeader>
                <Layers className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Component-Level Visibility</CardTitle>
                <CardDescription>
                  Drill down into individual service components like AWS EC2, S3, or Lambda. Know exactly which parts of a vendor are affected.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Service Directory Highlight */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-4">
              <Globe className="h-4 w-4" />
              Massive Service Directory
            </div>
            <h2 className="text-3xl font-bold mb-4">400+ Services Across 30+ Categories</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The most comprehensive vendor monitoring directory available. From cloud infrastructure to AI platforms, 
              we track the services your business depends on.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mb-8">
            {SERVICE_CATEGORIES.map((cat) => (
              <div key={cat.name} className="bg-card/50 rounded-lg p-4 border hover:border-primary/30 transition-colors" data-testid={`category-${cat.name}`}>
                <div className={`text-2xl font-bold ${cat.color}`}>{cat.count}+</div>
                <div className="text-xs text-muted-foreground mt-1">{cat.name}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Plus: CDN/DNS, CRM, E-Commerce, Education, HR, IoT, Gaming, Healthcare, Legal, Media, Automation, and more
          </p>
        </section>

        {/* Integrations & Notifications */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-sm font-medium mb-4">
              <Webhook className="h-4 w-4" />
              Integrations
            </div>
            <h2 className="text-3xl font-bold mb-4">Alert Your Team, Your Way</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Connect with the tools your team already uses. Route incident alerts exactly where they need to go.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <div className="bg-card/50 rounded-lg p-5 border flex items-start gap-4" data-testid="integration-slack">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                <MessageSquare className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Slack & Teams</h3>
                <p className="text-xs text-muted-foreground mt-1">Post formatted incident alerts to your channels with severity badges and status updates</p>
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-5 border flex items-start gap-4" data-testid="integration-pagerduty">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">PagerDuty</h3>
                <p className="text-xs text-muted-foreground mt-1">Auto-trigger and resolve PagerDuty incidents synced to vendor lifecycle events</p>
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-5 border flex items-start gap-4" data-testid="integration-webhooks">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Webhook className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Outbound Webhooks</h3>
                <p className="text-xs text-muted-foreground mt-1">HMAC-SHA256 signed payloads sent to any endpoint for custom automation workflows</p>
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-5 border flex items-start gap-4" data-testid="integration-email">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Email Alerts</h3>
                <p className="text-xs text-muted-foreground mt-1">Instant email notifications with incident details, severity, and resolution updates</p>
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-5 border flex items-start gap-4" data-testid="integration-sms">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">SMS Alerts</h3>
                <p className="text-xs text-muted-foreground mt-1">TCPA-compliant text messages for critical outages that demand immediate attention</p>
              </div>
            </div>
            <div className="bg-card/50 rounded-lg p-5 border flex items-start gap-4" data-testid="integration-widgets">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                <Code className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Embeddable Widgets</h3>
                <p className="text-xs text-muted-foreground mt-1">Public status pages, SVG badges, and JSON APIs to share vendor status with clients</p>
              </div>
            </div>
          </div>
        </section>

        {/* Blockchain Monitoring */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Boxes className="h-4 w-4" />
              Blockchain Coverage
            </div>
            <h2 className="text-3xl font-bold mb-4">Blockchain Infrastructure Monitoring</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Monitor blockchain network health, RPC provider availability, and Layer 2 status in real-time. 
              Track chain liveness, finality, and infrastructure dependencies.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
            <div className="bg-card/50 rounded-lg p-4 border text-center">
              <div className="text-2xl font-bold text-primary">110+</div>
              <div className="text-sm text-muted-foreground">Networks Supported</div>
            </div>
            <div className="bg-card/50 rounded-lg p-4 border text-center">
              <div className="text-2xl font-bold text-green-500">L1 & L2</div>
              <div className="text-sm text-muted-foreground">Chain Coverage</div>
            </div>
            <div className="bg-card/50 rounded-lg p-4 border text-center">
              <div className="text-2xl font-bold text-blue-500">8</div>
              <div className="text-sm text-muted-foreground">RPC Providers</div>
            </div>
          </div>
        </section>

        {/* Enterprise Features Section */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              Enterprise Features
            </div>
            <h2 className="text-3xl font-bold mb-4">Powerful Automation & Intelligence</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Go beyond basic monitoring with AI-powered tools designed for MSPs and enterprise teams
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="bg-gradient-to-br from-card/80 to-purple-500/5 border-purple-500/20" data-testid="card-feature-ai-copilot">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                  <Bot className="h-6 w-6 text-purple-400" />
                </div>
                <CardTitle className="text-lg">AI Communication Copilot</CardTitle>
                <CardDescription>
                  Generate professional incident updates, customer-ready summaries, and root cause analysis reports powered by AI.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-orange-500/5 border-orange-500/20" data-testid="card-feature-sla-tracker">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3">
                  <Timer className="h-6 w-6 text-orange-400" />
                </div>
                <CardTitle className="text-lg">SLA Breach Tracker</CardTitle>
                <CardDescription>
                  Define uptime SLAs for each vendor and get automatic alerts when they're at risk. Track historical performance for compliance.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-cyan-500/5 border-cyan-500/20" data-testid="card-feature-orchestrator">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3">
                  <Gauge className="h-6 w-6 text-cyan-400" />
                </div>
                <CardTitle className="text-lg">Autonomous Response Orchestrator</CardTitle>
                <CardDescription>
                  Create automation rules that trigger on specific incidents. Notify teams, execute webhooks, or escalate based on severity.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-green-500/5 border-green-500/20" data-testid="card-feature-synthetic">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                  <Radio className="h-6 w-6 text-green-400" />
                </div>
                <CardTitle className="text-lg">Synthetic Monitoring</CardTitle>
                <CardDescription>
                  Go beyond status pages with active endpoint probes. Monitor API response times and detect issues before they hit status pages.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-yellow-500/5 border-yellow-500/20" data-testid="card-feature-early-warning">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-3">
                  <TrendingUp className="h-6 w-6 text-yellow-400" />
                </div>
                <CardTitle className="text-lg">Early Warning Signals</CardTitle>
                <CardDescription>
                  Crowdsourced incident reports with dynamic confidence scoring. Detect emerging issues before official status page updates.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-pink-500/5 border-pink-500/20" data-testid="card-feature-reports">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-pink-500/10 flex items-center justify-center mb-3">
                  <BarChart3 className="h-6 w-6 text-pink-400" />
                </div>
                <CardTitle className="text-lg">Historical Reports & Analytics</CardTitle>
                <CardDescription>
                  Generate uptime reports with MTTR calculations, incident counts, and vendor breakdowns. Export to CSV for stakeholder reviews.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* MSP Features */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-4">
              <Users className="h-4 w-4" />
              Built for MSPs
            </div>
            <h2 className="text-3xl font-bold mb-4">Purpose-Built for Managed Service Providers</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Features designed specifically for MSPs managing multiple clients and vendor relationships
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <div className="bg-card/50 rounded-lg p-5 border text-center" data-testid="msp-portals">
              <Layout className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-sm mb-1">Branded Client Portals</h3>
              <p className="text-xs text-muted-foreground">White-labeled status pages with password protection and TV display mode</p>
            </div>
            <div className="bg-card/50 rounded-lg p-5 border text-center" data-testid="msp-assignments">
              <Users className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-sm mb-1">Team Alert Assignments</h3>
              <p className="text-xs text-muted-foreground">Delegate vendor monitoring to specific team members with role-based access</p>
            </div>
            <div className="bg-card/50 rounded-lg p-5 border text-center" data-testid="msp-playbooks">
              <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-sm mb-1">Incident Playbooks</h3>
              <p className="text-xs text-muted-foreground">Step-by-step response guides for different incident types and vendors</p>
            </div>
            <div className="bg-card/50 rounded-lg p-5 border text-center" data-testid="msp-reliability">
              <Eye className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-sm mb-1">Vendor Reliability Stats</h3>
              <p className="text-xs text-muted-foreground">Track historical reliability and generate weekly digest reports for clients</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes and never miss another vendor outage
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center relative">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border-2 border-primary">
                <UserPlus className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent hidden md:block" />
              <h3 className="font-semibold text-lg mb-2">1. Sign Up & Subscribe</h3>
              <p className="text-sm text-muted-foreground">
                Create your account and choose a plan that fits your needs. Start with a 7-day free trial.
              </p>
            </div>

            <div className="text-center relative">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border-2 border-primary">
                <Settings className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent hidden md:block" />
              <h3 className="font-semibold text-lg mb-2">2. Select Your Vendors</h3>
              <p className="text-sm text-muted-foreground">
                Choose from 400+ pre-configured vendors and 110+ blockchain networks, or request custom additions.
              </p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border-2 border-primary">
                <BellRing className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Get Instant Alerts</h3>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email, SMS, Slack, Teams, or PagerDuty within minutes of any incident.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-muted-foreground">Simple pricing for businesses of all sizes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="bg-card/50 border-2" data-testid="card-pricing-essential">
              <CardHeader>
                <CardTitle className="text-xl">Essential</CardTitle>
                <div className="text-3xl font-bold">$89<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <p className="text-xs text-muted-foreground mt-1">1 user included</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Up to 25 vendors</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Email alerts</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Weekly digest emails</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Component-level monitoring</li>
                  <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4 text-red-500" /> No SMS alerts</li>
                  <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4 text-red-500" /> No blockchain monitoring</li>
                </ul>
                <Link href="/signup?tier=essential">
                  <Button className="w-full mt-6" variant="outline" data-testid="button-signup-essential">Get Started</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-2 border-primary relative" data-testid="card-pricing-growth">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                Most Popular
              </div>
              <CardHeader>
                <CardTitle className="text-xl">Growth</CardTitle>
                <div className="text-3xl font-bold">$129<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <p className="text-xs text-muted-foreground mt-1">3 users included, +$20/seat</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Up to 100 vendors</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Email, SMS & Slack alerts</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 3 team seats included</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Up to 25 blockchain networks</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Client portals & playbooks</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Webhooks & PagerDuty</li>
                </ul>
                <Link href="/signup?tier=growth">
                  <Button className="w-full mt-6" data-testid="button-signup-growth">Get Started</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-2" data-testid="card-pricing-enterprise">
              <CardHeader>
                <CardTitle className="text-xl">Enterprise</CardTitle>
                <div className="text-3xl font-bold">$189<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <p className="text-xs text-muted-foreground mt-1">5 users included, +$25/seat</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Unlimited vendors</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> All alert channels</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Unlimited blockchain & staking</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Full automation + AI Copilot</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Predictive outage detection</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Branded portals & embeds</li>
                </ul>
                <Link href="/signup?tier=enterprise">
                  <Button className="w-full mt-6" variant="outline" data-testid="button-signup-enterprise">Get Started</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center mt-8">
            <Link href="/pricing" className="text-primary hover:underline inline-flex items-center gap-1" data-testid="link-full-pricing">
              See full feature comparison <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-4 py-16 border-t">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-2xl p-12 border border-primary/20">
            <Lock className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Ready to Never Be Caught Off Guard Again?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join MSPs and IT teams who trust {APP_NAME} to monitor their critical vendor infrastructure. 
              Start your 7-day free trial today.
            </p>
            <Link href="/signup">
              <Button size="lg" className="text-lg px-10 py-6" data-testid="button-final-cta">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <VendorWatchLogo size={32} />
                <span className="text-lg font-bold">{APP_NAME}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Enterprise-grade vendor status monitoring for MSPs and IT teams. 400+ services, 110+ blockchains.
              </p>
              <div className="flex items-center gap-3">
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors" data-testid="link-twitter">
                  <Twitter className="h-4 w-4" />
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors" data-testid="link-linkedin">
                  <Linkedin className="h-4 w-4" />
                </a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors" data-testid="link-github">
                  <Github className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/pricing" className="hover:text-foreground transition">Pricing</Link></li>
                <li><Link href="/signup" className="hover:text-foreground transition">Free Trial</Link></li>
                <li><span className="hover:text-foreground transition cursor-default">Changelog</span></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm">Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="cursor-default">Vendor Monitoring</span></li>
                <li><span className="cursor-default">Blockchain Tracking</span></li>
                <li><span className="cursor-default">AI Copilot</span></li>
                <li><span className="cursor-default">Synthetic Monitoring</span></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/terms" className="hover:text-foreground transition">Terms of Service</Link></li>
                <li><Link href="/privacy" className="hover:text-foreground transition">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
