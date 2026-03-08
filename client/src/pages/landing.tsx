import { useState, useEffect } from "react";
import { APP_NAME } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, Bell, Zap, CheckCircle2, Cloud, Globe, Shield, Bot,
  Timer, BellRing, Mail, Phone, ArrowRight, Webhook, BarChart3, Eye, Layers,
  MessageSquare, TrendingUp, MonitorCheck, Code, Users, Lock, Check, X,
  Boxes, Radio, Layout, UserPlus, Settings,
  Gauge, Brain, Sparkles
} from "lucide-react";
import { Link } from "wouter";
import { VendorWatchLogo } from "@/components/ui/vendor-watch-logo";

const FEATURE_PILLS = [
  { label: "Cloud Monitoring", icon: Cloud, href: "#features" },
  { label: "Multi-Channel Alerts", icon: Bell, href: "#alerts" },
  { label: "Unified Status Page", icon: Layout, href: "#features" },
  { label: "Blockchain Tracking", icon: Boxes, href: "#features" },
  { label: "AI-Powered Insights", icon: Brain, href: "#enterprise" },
];

const LIVE_FEED_ITEMS = [
  { vendor: "Salesforce", icon: "SF", title: "API Performance Degradation in NA regions", time: "12 min ago", status: "investigating", color: "text-orange-500", bg: "bg-orange-500" },
  { vendor: "AWS", icon: "AWS", title: "Elevated error rates for S3 in us-east-1", time: "47 min ago", status: "identified", color: "text-red-500", bg: "bg-red-500" },
  { vendor: "Datadog", icon: "DD", title: "Delayed log ingestion and metric processing", time: "1h ago", status: "monitoring", color: "text-yellow-500", bg: "bg-yellow-500" },
  { vendor: "GitHub", icon: "GH", title: "Actions workflow delays resolved", time: "2h ago", status: "resolved", color: "text-emerald-500", bg: "bg-emerald-500" },
  { vendor: "Cloudflare", icon: "CF", title: "DNS resolution issues in Europe resolved", time: "3h ago", status: "resolved", color: "text-emerald-500", bg: "bg-emerald-500" },
  { vendor: "Stripe", icon: "ST", title: "Intermittent webhook delivery delays", time: "4h ago", status: "resolved", color: "text-emerald-500", bg: "bg-emerald-500" },
];

const TESTIMONIALS = [
  {
    quote: "We used to manually check a dozen status pages every morning. Vendor Watch consolidated all of that into a single dashboard with real-time alerts. Our response time to vendor outages dropped from hours to minutes.",
    name: "Sarah Chen",
    role: "VP of Infrastructure",
    company: "CloudScale Systems",
  },
  {
    quote: "As an MSP managing 40+ clients, knowing about vendor outages before our clients call us is a game changer. The Slack integration and client portals have saved us countless hours.",
    name: "Marcus Rivera",
    role: "Director of Operations",
    company: "TechBridge MSP",
  },
  {
    quote: "The component-level monitoring is incredibly detailed. When AWS has an issue, we instantly know if it's EC2, S3, or Lambda that's affected. That specificity is invaluable for triage.",
    name: "James Park",
    role: "Lead SRE",
    company: "FinServ Digital",
  },
];

const TRUSTED_LOGOS = [
  "AWS", "Azure", "Google Cloud", "Cloudflare", "Stripe", "OpenAI",
  "GitHub", "Slack", "Salesforce", "Datadog", "MongoDB", "Twilio",
  "Shopify", "HubSpot", "PagerDuty", "Zoom",
];

function LiveStatusFeed() {
  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const timer = setTimeout(() => setVisibleCount(6), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-2" data-testid="live-status-feed">
      {LIVE_FEED_ITEMS.slice(0, visibleCount).map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/40 hover:bg-card/60 transition-all"
          style={{ animationDelay: `${i * 100}ms` }}
          data-testid={`feed-item-${i}`}
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${item.bg} ${item.status !== 'resolved' ? 'animate-pulse' : ''}`} />
          <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground">{item.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold">{item.vendor}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                item.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' :
                item.status === 'investigating' ? 'bg-orange-500/10 text-orange-500' :
                item.status === 'identified' ? 'bg-red-500/10 text-red-500' :
                'bg-yellow-500/10 text-yellow-500'
              }`}>{item.status}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{item.title}</p>
          </div>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 hidden sm:block">{item.time}</span>
        </div>
      ))}
    </div>
  );
}

function FeatureSection({
  badge,
  badgeColor,
  badgeIcon: BadgeIcon,
  title,
  description,
  bullets,
  visual,
  reversed = false,
  id,
}: {
  badge: string;
  badgeColor: string;
  badgeIcon: any;
  title: string;
  description: string;
  bullets: { icon: any; text: string }[];
  visual: React.ReactNode;
  reversed?: boolean;
  id?: string;
}) {
  return (
    <section className={`container mx-auto px-4 py-20 ${id ? 'scroll-mt-20' : ''}`} id={id}>
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className={reversed ? 'lg:order-2' : ''}>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4 ${badgeColor}`}>
            <BadgeIcon className="h-4 w-4" />
            {badge}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">{title}</h2>
          <p className="text-lg text-muted-foreground mb-8">{description}</p>
          <div className="space-y-4">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <b.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={reversed ? 'lg:order-1' : ''}>
          {visual}
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  const vendors = [
    { name: "AWS", status: "operational" },
    { name: "Microsoft 365", status: "operational" },
    { name: "Cloudflare", status: "operational" },
    { name: "Salesforce", status: "degraded" },
    { name: "GitHub", status: "operational" },
    { name: "Stripe", status: "operational" },
    { name: "Datadog", status: "operational" },
    { name: "Slack", status: "operational" },
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
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-background/50 rounded-lg p-3 border">
            <div className="text-xl font-bold text-green-500">400+</div>
            <div className="text-[10px] text-muted-foreground">Services</div>
          </div>
          <div className="bg-background/50 rounded-lg p-3 border">
            <div className="text-xl font-bold text-yellow-500">2</div>
            <div className="text-[10px] text-muted-foreground">Active Incidents</div>
          </div>
          <div className="bg-background/50 rounded-lg p-3 border">
            <div className="text-xl font-bold text-primary">99.9%</div>
            <div className="text-[10px] text-muted-foreground">Avg Uptime</div>
          </div>
        </div>
        <div className="bg-background/50 rounded-lg border p-3">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-primary" />
            Service Status
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {vendors.map((v) => (
              <div key={v.name} className="flex items-center justify-between py-1 px-2 rounded bg-muted/20 text-xs">
                <span className="truncate">{v.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 ${v.status === 'operational' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertsMockup() {
  return (
    <div className="relative rounded-xl border bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
      <div className="border-b bg-muted/30 px-4 py-2">
        <span className="text-xs text-muted-foreground">Alert Channels</span>
      </div>
      <div className="p-4 space-y-3">
        {[
          { name: "Slack - #ops-alerts", icon: MessageSquare, status: "Connected", color: "text-purple-400" },
          { name: "Email - team@company.com", icon: Mail, status: "Active", color: "text-blue-400" },
          { name: "SMS - +1 (555) 012-3456", icon: Phone, status: "Active", color: "text-cyan-400" },
          { name: "PagerDuty - Critical Team", icon: Bell, status: "Connected", color: "text-green-400" },
          { name: "Discord - #status-updates", icon: MessageSquare, status: "Connected", color: "text-indigo-400" },
          { name: "Webhook - api.internal/hooks", icon: Webhook, status: "Active", color: "text-orange-400" },
        ].map((ch, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50 border">
            <div className={`h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center ${ch.color}`}>
              <ch.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{ch.name}</p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">{ch.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComponentsMockup() {
  const components = [
    { name: "EC2 - Compute", status: "operational" },
    { name: "S3 - Storage", status: "degraded_performance" },
    { name: "Lambda - Functions", status: "operational" },
    { name: "RDS - Database", status: "operational" },
    { name: "CloudFront - CDN", status: "operational" },
    { name: "Route 53 - DNS", status: "partial_outage" },
    { name: "SQS - Messaging", status: "operational" },
    { name: "EKS - Kubernetes", status: "operational" },
  ];

  return (
    <div className="relative rounded-xl border bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
      <div className="border-b bg-muted/30 px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">AWS Service Components</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500">2 degraded</span>
      </div>
      <div className="p-4 space-y-1.5">
        {components.map((c, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-background/30">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                c.status === 'operational' ? 'bg-emerald-500' :
                c.status === 'degraded_performance' ? 'bg-yellow-500' :
                'bg-orange-500'
              }`} />
              <span className="text-xs">{c.name}</span>
            </div>
            <span className={`text-[10px] font-medium ${
              c.status === 'operational' ? 'text-emerald-500' :
              c.status === 'degraded_performance' ? 'text-yellow-500' :
              'text-orange-500'
            }`}>
              {c.status === 'operational' ? 'Operational' :
               c.status === 'degraded_performance' ? 'Degraded' : 'Partial Outage'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <VendorWatchLogo size={32} />
            <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition" data-testid="link-nav-features">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition" data-testid="link-nav-how-it-works">How It Works</a>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition" data-testid="link-nav-pricing">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3">
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
        <section className="container mx-auto px-4 pt-20 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20" data-testid="badge-service-count">
            <MonitorCheck className="h-4 w-4" />
            Now monitoring 400+ services across 30+ categories
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]" data-testid="text-hero-title">
            Monitor Every Vendor.<br />
            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">Detect Outages First.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10" data-testid="text-hero-description">
            {APP_NAME} monitors 400+ cloud services, SaaS platforms, and blockchain networks in real-time.
            Get instant alerts via email, SMS, Slack, Teams, PagerDuty, and webhooks before your customers notice.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-12">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-6 shadow-lg shadow-primary/20" data-testid="button-get-started">
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

          <div className="flex flex-wrap justify-center gap-2 mb-16" data-testid="feature-pills">
            {FEATURE_PILLS.map((pill) => (
              <a
                key={pill.label}
                href={pill.href}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-card/40 hover:bg-card/80 hover:border-primary/30 transition-all text-sm text-muted-foreground hover:text-foreground"
                data-testid={`pill-${pill.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <pill.icon className="h-4 w-4 text-primary" />
                {pill.label}
              </a>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 pb-8">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-4">Monitoring status for</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 max-w-4xl mx-auto">
            {TRUSTED_LOGOS.map((name) => (
              <span key={name} className="text-sm text-muted-foreground/60 font-medium">{name}</span>
            ))}
            <span className="text-sm text-primary font-medium">+380 more</span>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <div className="text-center lg:text-left mb-6">
                <h2 className="text-2xl md:text-3xl font-bold mb-3">See Your Vendors at a Glance</h2>
                <p className="text-muted-foreground">A unified dashboard that keeps your team informed 24/7</p>
              </div>
              <DashboardMockup />
            </div>
            <div>
              <div className="text-center lg:text-left mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-sm font-medium mb-2">
                  <Activity className="h-3 w-3 animate-pulse" />
                  Live Incident Feed
                </div>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Real-Time Outage Detection</h2>
                <p className="text-muted-foreground">Incidents detected across all monitored services, as they happen</p>
              </div>
              <LiveStatusFeed />
            </div>
          </div>
        </section>

        <section className="border-y bg-card/30 py-14">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div data-testid="stat-services">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">400+</div>
                <div className="text-sm text-muted-foreground">Services Monitored</div>
              </div>
              <div data-testid="stat-categories">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">30+</div>
                <div className="text-sm text-muted-foreground">Service Categories</div>
              </div>
              <div data-testid="stat-blockchains">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">110+</div>
                <div className="text-sm text-muted-foreground">Blockchain Networks</div>
              </div>
              <div data-testid="stat-uptime">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">1min</div>
                <div className="text-sm text-muted-foreground">Polling Interval</div>
              </div>
            </div>
          </div>
        </section>

        <div id="features" className="scroll-mt-20">
          <FeatureSection
            badge="Real-Time Monitoring"
            badgeColor="bg-blue-500/10 text-blue-400"
            badgeIcon={Activity}
            title="Track All Services You Depend On"
            description="Outage alerts and maintenance reminders — all together in one place. Monitor the status of every cloud provider, SaaS platform, and API your business relies on."
            bullets={[
              { icon: CheckCircle2, text: "Continuously monitor 400+ vendor status pages every 60 seconds with automatic status normalization across different page formats." },
              { icon: Layers, text: "View active incidents at a glance across your entire vendor ecosystem. See which dependencies have outages on a single, unified status page." },
              { icon: Eye, text: "Easily drill down into the details of an incident for debugging. Know exactly which service components are affected (EC2, S3, Lambda, etc)." },
              { icon: Boxes, text: "Track 110+ blockchain networks including L1/L2 chains, DeFi protocols, exchanges, RPC providers, and staking platforms." },
            ]}
            visual={<ComponentsMockup />}
          />

          <div className="border-t" />

          <FeatureSection
            id="alerts"
            badge="Multi-Channel Alerts"
            badgeColor="bg-green-500/10 text-green-400"
            badgeIcon={Bell}
            title="Get Alerts in Tools You Already Use"
            description="Alerts go directly into your team's workflow. Get notified only when it really matters — fine-tune notifications for each service."
            bullets={[
              { icon: MessageSquare, text: "Integrate with Email, SMS, Slack, Microsoft Teams, Discord, PagerDuty, and custom webhooks. Route alerts to the right team members." },
              { icon: Layers, text: "Choose which components to monitor for each service. Turn off maintenance alerts, outage alerts, or both on a per-vendor basis." },
              { icon: BellRing, text: "Get only incident start/end alerts for low-criticality services and all updates for high-criticality ones. Reduce noise and alert fatigue." },
              { icon: Webhook, text: "Connect to any system with HMAC-SHA256 signed webhook payloads for custom automation workflows." },
            ]}
            visual={<AlertsMockup />}
            reversed
          />

          <div className="border-t" />

          <FeatureSection
            badge="Unified Status Page"
            badgeColor="bg-purple-500/10 text-purple-400"
            badgeIcon={Layout}
            title="Get a Unified Status Page for Your Team"
            description="Get an overall health summary of all your third-party services on a dedicated page. Share it with your team, clients, or stakeholders."
            bullets={[
              { icon: Globe, text: "Auto-generated branded status page showing real-time health of all your monitored services. Customize with your logo and branding." },
              { icon: Shield, text: "Password protect your status page or keep it public. Embed it in your website with iframes, SVG badges, or JSON API." },
              { icon: BarChart3, text: "Historical availability trends and incident timeline so your team can track vendor reliability over time." },
              { icon: Code, text: "TV display mode for NOC/SOC environments with 60-second auto-refresh. Perfect for operations centers." },
            ]}
            visual={
              <div className="relative rounded-xl border bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
                <div className="border-b bg-muted/30 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Public Status Page</span>
                  <span className="text-[10px] text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> All Systems Operational</span>
                </div>
                <div className="p-4 space-y-2">
                  {["AWS Cloud Services", "Microsoft 365", "Cloudflare CDN", "GitHub", "Datadog", "Stripe Payments", "Twilio", "MongoDB Atlas"].map((name, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-background/30 border border-border/30">
                      <span className="text-xs font-medium">{name}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 30 }, (_, j) => (
                            <div key={j} className={`w-1 h-3 rounded-sm ${
                              i === 3 && j === 27 ? 'bg-yellow-500' :
                              i === 0 && j === 25 ? 'bg-orange-500' :
                              'bg-emerald-500/60'
                            }`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-emerald-500 ml-1">99.9%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }
          />
        </div>

        <section className="border-t scroll-mt-20" id="enterprise">
          <div className="container mx-auto px-4 py-20">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium mb-4">
                <Zap className="h-4 w-4" />
                Enterprise & MSP Features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Powerful Automation & Intelligence</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Go beyond basic monitoring with AI-powered tools designed for MSPs and enterprise teams
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                { icon: Bot, title: "AI Communication Copilot", desc: "Generate professional incident updates, customer-ready summaries, and root cause analysis reports powered by AI.", cardClass: "from-card/80 to-purple-500/5 border-purple-500/20 hover:border-purple-500/40", iconBg: "bg-purple-500/10", iconColor: "text-purple-400" },
                { icon: Timer, title: "SLA Breach Tracker", desc: "Define uptime SLAs for each vendor and get automatic alerts when they're at risk. Track historical performance.", cardClass: "from-card/80 to-orange-500/5 border-orange-500/20 hover:border-orange-500/40", iconBg: "bg-orange-500/10", iconColor: "text-orange-400" },
                { icon: Gauge, title: "Autonomous Response Orchestrator", desc: "Create automation rules that trigger on specific incidents. Notify teams, execute webhooks, or escalate.", cardClass: "from-card/80 to-cyan-500/5 border-cyan-500/20 hover:border-cyan-500/40", iconBg: "bg-cyan-500/10", iconColor: "text-cyan-400" },
                { icon: Radio, title: "Synthetic Monitoring", desc: "Go beyond status pages with active endpoint probes. Monitor API response times and detect issues early.", cardClass: "from-card/80 to-green-500/5 border-green-500/20 hover:border-green-500/40", iconBg: "bg-green-500/10", iconColor: "text-green-400" },
                { icon: TrendingUp, title: "Early Warning Signals", desc: "Crowdsourced incident reports with dynamic confidence scoring. Detect issues before official updates.", cardClass: "from-card/80 to-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40", iconBg: "bg-yellow-500/10", iconColor: "text-yellow-400" },
                { icon: Layout, title: "Branded Client Portals", desc: "White-labeled status pages with password protection, TV display mode, and embeddable widgets for clients.", cardClass: "from-card/80 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40", iconBg: "bg-blue-500/10", iconColor: "text-blue-400" },
                { icon: Users, title: "Team Alert Assignments", desc: "Delegate vendor monitoring to specific team members. Role-based access with master admin controls.", cardClass: "from-card/80 to-pink-500/5 border-pink-500/20 hover:border-pink-500/40", iconBg: "bg-pink-500/10", iconColor: "text-pink-400" },
                { icon: BarChart3, title: "Historical Reports & Analytics", desc: "Generate uptime reports with MTTR calculations, incident counts, and vendor breakdowns. Export to CSV.", cardClass: "from-card/80 to-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40", iconBg: "bg-indigo-500/10", iconColor: "text-indigo-400" },
                { icon: Shield, title: "Incident Playbooks", desc: "Step-by-step response guides for different incident types and vendors. Ensure consistent response quality.", cardClass: "from-card/80 to-red-500/5 border-red-500/20 hover:border-red-500/40", iconBg: "bg-red-500/10", iconColor: "text-red-400" },
              ].map((f, i) => (
                <Card key={i} className={`bg-gradient-to-br ${f.cardClass} transition-colors`} data-testid={`card-feature-${f.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <CardHeader>
                    <div className={`h-11 w-11 rounded-lg ${f.iconBg} flex items-center justify-center mb-3`}>
                      <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-card/20 scroll-mt-20" id="how-it-works">
          <div className="container mx-auto px-4 py-20">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Start Monitoring in Under 2 Minutes</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                We focus on simplicity. Sign up, add services, and you're done.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center relative">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 border-2 border-primary/50 relative">
                  <UserPlus className="h-7 w-7 text-primary" />
                  <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
                </div>
                <div className="absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/40 to-transparent hidden md:block" />
                <h3 className="font-semibold text-lg mb-2">Sign Up & Subscribe</h3>
                <p className="text-sm text-muted-foreground">
                  Create your account and choose a plan that fits your needs. Start with a 7-day free trial.
                </p>
              </div>

              <div className="text-center relative">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 border-2 border-primary/50 relative">
                  <Settings className="h-7 w-7 text-primary" />
                  <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</div>
                </div>
                <div className="absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/40 to-transparent hidden md:block" />
                <h3 className="font-semibold text-lg mb-2">Select Your Vendors</h3>
                <p className="text-sm text-muted-foreground">
                  Choose from 400+ pre-configured vendors and 110+ blockchain networks, or request custom additions.
                </p>
              </div>

              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 border-2 border-primary/50 relative">
                  <BellRing className="h-7 w-7 text-primary" />
                  <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</div>
                </div>
                <h3 className="font-semibold text-lg mb-2">Get Instant Alerts</h3>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email, SMS, Slack, Teams, or PagerDuty within minutes of any incident.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="container mx-auto px-4 py-20">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4" />
                What Our Users Say
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Real Stories, Real Results</h2>
              <p className="text-lg text-muted-foreground">
                Teams trust {APP_NAME} to stay ahead of vendor outages
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {TESTIMONIALS.map((t, i) => (
                <Card key={i} className="bg-card/40 border-border/50" data-testid={`testimonial-${i}`}>
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: 5 }, (_, j) => (
                        <svg key={j} className="h-4 w-4 text-yellow-500 fill-yellow-500" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <blockquote className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      "{t.quote}"
                    </blockquote>
                    <div className="border-t pt-4">
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}, {t.company}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="container mx-auto px-4 py-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Choose Your Plan</h2>
              <p className="text-lg text-muted-foreground">Simple pricing for businesses of all sizes</p>
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
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Up to 25 vendors</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Email alerts</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Weekly digest emails</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Component-level monitoring</li>
                    <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4 text-red-500 shrink-0" /> No SMS alerts</li>
                    <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4 text-red-500 shrink-0" /> No blockchain monitoring</li>
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
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Up to 100 vendors</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Email, SMS & Slack alerts</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> 3 team seats included</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Up to 25 blockchain networks</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Client portals & playbooks</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Webhooks & PagerDuty</li>
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
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Unlimited vendors</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> All alert channels</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Unlimited blockchain & staking</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Full automation + AI Copilot</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Predictive outage detection</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500 shrink-0" /> Branded portals & embeds</li>
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
          </div>
        </section>

        <section className="border-t">
          <div className="container mx-auto px-4 py-20">
            <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary/5 via-purple-500/5 to-cyan-500/5 rounded-2xl p-12 md:p-16 border border-primary/20">
              <Lock className="h-10 w-10 text-primary mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Ready to Never Be Caught Off Guard Again?</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Join MSPs and IT teams who trust {APP_NAME} to monitor their critical vendor infrastructure.
                Start your 7-day free trial today.
              </p>
              <Link href="/signup">
                <Button size="lg" className="text-lg px-10 py-6 shadow-lg shadow-primary/20" data-testid="button-final-cta">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
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
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition">Features</a></li>
                <li><Link href="/pricing" className="hover:text-foreground transition">Pricing</Link></li>
                <li><Link href="/signup" className="hover:text-foreground transition">Free Trial</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3 text-sm">Capabilities</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="cursor-default">Vendor Monitoring</span></li>
                <li><span className="cursor-default">Blockchain Tracking</span></li>
                <li><span className="cursor-default">AI Copilot</span></li>
                <li><span className="cursor-default">Synthetic Monitoring</span></li>
                <li><span className="cursor-default">Status Pages</span></li>
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
