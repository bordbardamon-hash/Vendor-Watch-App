import { APP_NAME } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Activity, Bell, Zap, CheckCircle2, AlertTriangle, XCircle, Cloud, Database, Globe, Server } from "lucide-react";
import { Link } from "wouter";

function DashboardPreview() {
  const vendors = [
    { name: "AWS", status: "operational", icon: Cloud },
    { name: "Microsoft 365", status: "operational", icon: Server },
    { name: "Cloudflare", status: "operational", icon: Globe },
    { name: "Salesforce", status: "degraded", icon: Database },
    { name: "Okta", status: "operational", icon: Shield },
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
            <div className="text-2xl font-bold text-green-500">24</div>
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
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/signup">
              <Button variant="outline" data-testid="button-signup">
                Sign Up
              </Button>
            </Link>
            <Button asChild data-testid="button-login">
              <a href="/api/login">Sign In</a>
            </Button>
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
            <Button size="lg" variant="outline" asChild data-testid="button-signin-hero">
              <a href="/api/login" className="text-lg px-8 py-6">
                Sign In
              </a>
            </Button>
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
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
      </footer>
    </div>
  );
}
