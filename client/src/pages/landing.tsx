import { APP_NAME } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Bell, Zap, CheckCircle2, AlertTriangle, Cloud, Database, Globe, Server, Boxes, Check, X, Shield, Bot, Timer, Gauge, Radio, UserPlus, Settings, BellRing, Mail, Phone, MapPin, Twitter, Linkedin, Github, ArrowRight } from "lucide-react";
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
            <div className="text-2xl font-bold text-green-500">78</div>
            <div className="text-xs text-muted-foreground">Vendors Monitored</div>
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
        <section className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6" data-testid="text-hero-title">
            Monitor Your Vendors.<br />
            <span className="text-primary">Stay Ahead of Outages.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10" data-testid="text-hero-description">
            {APP_NAME} tracks third-party service status pages and alerts you 
            instantly when incidents are detected. Never be caught off guard by vendor downtime again.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8 py-6" data-testid="button-get-started">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6" data-testid="button-signin-hero">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">See Your Vendors at a Glance</h2>
            <p className="text-muted-foreground">A powerful dashboard that keeps you informed 24/7</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <DashboardPreview />
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card/50" data-testid="card-feature-monitoring">
              <CardHeader>
                <Activity className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Real-time Monitoring</CardTitle>
                <CardDescription>
                  Continuously monitor vendor status pages to detect incidents as they happen
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50" data-testid="card-feature-alerts">
              <CardHeader>
                <Bell className="h-10 w-10 text-primary mb-2" />
                <CardTitle>SMS & Email Alerts</CardTitle>
                <CardDescription>
                  Get notified via SMS, email, or both when your critical vendors experience issues
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50" data-testid="card-feature-dashboard">
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Unified Dashboard</CardTitle>
                <CardDescription>
                  Track all your vendors in one place with a clean, cyber-industrial interface
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16 border-t">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Boxes className="h-4 w-4" />
              New Feature
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

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <Card className="bg-gradient-to-br from-card/80 to-purple-500/5 border-purple-500/20" data-testid="card-feature-ai-copilot">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                  <Bot className="h-6 w-6 text-purple-400" />
                </div>
                <CardTitle className="text-lg">AI Communication Copilot</CardTitle>
                <CardDescription>
                  Generate professional incident updates, customer-ready summaries, and root cause analysis reports powered by AI. Save hours on client communication during outages.
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
                  Define uptime SLAs for each vendor and get automatic alerts when they're at risk. Track historical performance and generate compliance reports for stakeholders.
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
                  Create automation rules that trigger on specific incidents. Automatically notify teams, execute webhooks, or escalate issues based on severity and vendor type.
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
                  Go beyond status pages with active endpoint probes. Monitor API response times, verify SSL certificates, and detect issues before they hit status pages.
                </CardDescription>
              </CardHeader>
            </Card>
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
                Create your account and choose a plan that fits your needs. No credit card required for the trial.
              </p>
            </div>

            <div className="text-center relative">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border-2 border-primary">
                <Settings className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent hidden md:block" />
              <h3 className="font-semibold text-lg mb-2">2. Select Your Vendors</h3>
              <p className="text-sm text-muted-foreground">
                Choose from 78 pre-configured vendors and 110 blockchain networks, or request custom additions.
              </p>
            </div>

            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border-2 border-primary">
                <BellRing className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Get Instant Alerts</h3>
              <p className="text-sm text-muted-foreground">
                Receive SMS and email notifications within minutes of any incident detection. Stay informed 24/7.
              </p>
            </div>
          </div>
        </section>

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
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Up to 10 vendors</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Email alerts only</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Weekly digest emails</li>
                  <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4 text-red-500" /> No SMS alerts</li>
                  <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4 text-red-500" /> No blockchain monitoring</li>
                  <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4 text-red-500" /> No team seats</li>
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
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Up to 25 vendors</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Email & SMS alerts</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 3 team seats included</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Up to 10 blockchain networks</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Basic automation rules</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Client portals & PSA integration</li>
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
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 5 team seats included</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Unlimited blockchain & staking</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Full automation + AI Copilot</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Predictive outage detection</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Priority support</li>
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
      </main>

      <footer className="border-t bg-card/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <VendorWatchLogo size={32} />
                <span className="text-lg font-bold">{APP_NAME}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Enterprise-grade vendor status monitoring for MSPs and IT teams.
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

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/signup" className="hover:text-foreground transition-colors">Get Started</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#blockchain" className="hover:text-foreground transition-colors">Blockchain Monitoring</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#about" className="hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="#careers" className="hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#blog" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#contact" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <a href="mailto:support@vendorwatch.app" className="hover:text-foreground transition-colors">support@vendorwatch.app</a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>1-800-VENDOR-1</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span>San Francisco, CA</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <a href="#sla" className="hover:text-foreground transition-colors">SLA</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
