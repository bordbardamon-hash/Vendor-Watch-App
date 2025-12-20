import { APP_NAME } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Activity, Bell, Zap, Smartphone, Mail } from "lucide-react";
import { Link } from "wouter";

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
