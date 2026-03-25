import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Globe, 
  AlertTriangle,
  CheckCircle2,
  Bell,
  Mail,
  MessageSquare,
  Boxes,
  Wrench,
  ExternalLink,
  Settings,
  Shield,
  AlertCircle,
  Loader2,
  ShieldAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UI_LABELS } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { LogoAvatar } from "@/components/ui/logo-avatar";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<any[]>({
    queryKey: ["/api/my-vendors"],
    queryFn: async () => {
      const res = await fetch("/api/my-vendors");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: incidents = [] } = useQuery<any[]>({
    queryKey: ["/api/my-incidents"],
    queryFn: async () => {
      const res = await fetch("/api/my-incidents");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: notifPrefs } = useQuery({
    queryKey: ["/api/notifications/preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: blockchainStats } = useQuery({
    queryKey: ["/api/blockchain/stats"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/stats");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: maintenanceStats } = useQuery({
    queryKey: ["/api/maintenance/stats"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance/stats");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const vendorCount = vendors.length;
  const activeIncidents = incidents.filter((i: any) => i.status !== 'resolved');
  const incidentCount = activeIncidents.length;
  const blockchainCount = blockchainStats?.totalChains || 0;
  const blockchainIncidentCount = blockchainStats?.activeIncidents || 0;

  const degradedVendors = vendors.filter((v: any) => v.status !== 'operational');
  const operationalVendors = vendors.filter((v: any) => v.status === 'operational');

  const hasNotificationsSetup = notifPrefs?.notifyEmail || notifPrefs?.notifySms;

  return (
    <div className="p-4 md:p-8 space-y-6" data-testid="dashboard-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Your monitored services at a glance</p>
        </div>
      </div>

      {!hasNotificationsSetup && vendorCount > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3" data-testid="banner-setup-notifications">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-full bg-amber-500/10">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Set up notifications</p>
              <p className="text-xs text-muted-foreground">Get alerted via email or SMS when your monitored services have incidents.</p>
            </div>
          </div>
          <Link href="/settings">
            <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10" data-testid="button-setup-notifications">
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Configure
            </Button>
          </Link>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Link href="/vendors?filter=monitored" data-testid="link-vendors-metric">
          <StatCard 
            title={UI_LABELS.cards.monitoredVendors}
            value={vendorCount.toString()} 
            icon={Globe}
            subtitle={degradedVendors.length > 0 ? `${degradedVendors.length} degraded` : "All healthy"}
            subtitleColor={degradedVendors.length > 0 ? "text-amber-500" : "text-emerald-500"}
          />
        </Link>
        <Link href="/incidents" data-testid="link-incidents-metric">
          <StatCard 
            title={UI_LABELS.cards.activeIncidents}
            value={incidentCount.toString()} 
            icon={AlertTriangle}
            highlight={incidentCount > 0}
            subtitle={incidentCount > 0 ? "Needs attention" : "No incidents"}
            subtitleColor={incidentCount > 0 ? "text-red-500" : "text-emerald-500"}
          />
        </Link>
        <Link href="/blockchain?filter=monitored" data-testid="link-blockchain-metric">
          <StatCard 
            title="Blockchains"
            value={blockchainCount.toString()} 
            icon={Boxes}
            subtitle={blockchainIncidentCount > 0 ? `${blockchainIncidentCount} incidents` : "All healthy"}
            subtitleColor={blockchainIncidentCount > 0 ? "text-amber-500" : "text-emerald-500"}
          />
        </Link>
        <Link href="/maintenance" data-testid="link-maintenance-metric">
          <StatCard 
            title="Maintenance"
            value={(maintenanceStats?.total ?? 0).toString()} 
            icon={Wrench}
            subtitle={((maintenanceStats?.vendorActive ?? 0) + (maintenanceStats?.blockchainActive ?? 0)) > 0 
              ? `${(maintenanceStats?.vendorActive ?? 0) + (maintenanceStats?.blockchainActive ?? 0)} active` 
              : "None scheduled"}
            subtitleColor="text-muted-foreground"
          />
        </Link>
      </div>

      {degradedVendors.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5" data-testid="card-services-attention">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Services Needing Attention
              <Badge variant="destructive" className="text-xs ml-auto">{degradedVendors.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {degradedVendors.map((vendor: any) => {
                const vendorIncidents = incidents.filter((i: any) => i.vendorKey === vendor.key && i.status !== 'resolved');
                return (
                  <Link key={vendor.key} href={`/vendors?vendor=${vendor.key}`} onClick={() => {}}>
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-red-500/10 bg-background/50 hover:border-red-500/30 transition-colors cursor-pointer" data-testid={`degraded-vendor-${vendor.key}`}>
                      <LogoAvatar src={vendor.logoUrl} name={vendor.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{vendor.name}</p>
                        <p className="text-xs text-red-500 capitalize">{vendor.status}</p>
                      </div>
                      {vendorIncidents.length > 0 && (
                        <Badge variant="outline" className="text-xs border-red-500/30 text-red-500 shrink-0">
                          {vendorIncidents.length} incident{vendorIncidents.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeIncidents.length > 0 && (
        <Card className="border-sidebar-border bg-sidebar/10" data-testid="card-active-incidents">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Active Incidents
              </CardTitle>
              <Link href="/incidents">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" data-testid="link-view-all-incidents">
                  View all
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeIncidents.slice(0, 5).map((incident: any) => {
                const vendor = vendors.find((v: any) => v.key === incident.vendorKey);
                return (
                  <div key={incident.id} className="flex items-center gap-3 p-3 rounded-lg border border-sidebar-border bg-background/50" data-testid={`incident-row-${incident.id}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      incident.severity === 'critical' ? 'bg-red-500' : 
                      incident.severity === 'major' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{incident.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {vendor?.name || incident.vendorKey} &middot; {incident.severity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(incident.severity === 'critical' || incident.severity === 'major') && (
                        <Link href={`/war-room/${incident.id}`}>
                          <span className="flex items-center gap-1 text-[10px] text-red-500 border border-red-500/30 rounded px-1.5 py-0.5 hover:bg-red-500/10 transition-colors" data-testid={`link-war-room-dashboard-${incident.id}`}>
                            <ShieldAlert className="w-3 h-3" />
                            War Room
                          </span>
                        </Link>
                      )}
                      <Badge variant="outline" className="text-[10px] capitalize">{incident.status}</Badge>
                    </div>
                  </div>
                );
              })}
              {activeIncidents.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{activeIncidents.length - 5} more incidents
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {vendorCount > 0 && degradedVendors.length === 0 && activeIncidents.length === 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5" data-testid="card-all-clear">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-500/40" />
            <p className="text-lg font-medium text-emerald-600">All Systems Operational</p>
            <p className="text-sm text-muted-foreground mt-1">
              All {vendorCount} monitored service{vendorCount !== 1 ? 's are' : ' is'} running normally.
            </p>
          </CardContent>
        </Card>
      )}

      {vendorCount > 0 && (
        <Card className="border-sidebar-border bg-sidebar/10" data-testid="card-monitored-services">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Monitored Services
              </CardTitle>
              <Link href="/vendors?filter=monitored">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" data-testid="link-view-all-vendors">
                  View all
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {vendors.slice(0, 12).map((vendor: any) => (
                <Link key={vendor.key} href={`/vendors/${vendor.slug || vendor.key}`}>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-sidebar-border bg-background/50 hover:border-primary/30 transition-colors cursor-pointer" data-testid={`monitored-vendor-${vendor.key}`}>
                    <LogoAvatar src={vendor.logoUrl} name={vendor.name} size="sm" />
                    <span className="text-sm font-medium truncate flex-1">{vendor.name}</span>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      vendor.status === 'operational' ? 'bg-emerald-500' : 
                      vendor.status === 'degraded' ? 'bg-orange-500' : 'bg-red-500'
                    }`} />
                  </div>
                </Link>
              ))}
            </div>
            {vendors.length > 12 && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                +{vendors.length - 12} more services
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {vendorCount === 0 && !vendorsLoading && (
        <Card className="border-sidebar-border bg-sidebar/10" data-testid="card-empty-state">
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-lg font-medium">No services monitored yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Start by adding vendors and blockchains you want to track.
            </p>
            <Link href="/vendors">
              <Button data-testid="button-go-to-vendors">
                <Globe className="w-4 h-4 mr-2" />
                Browse Vendors
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {vendorsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {hasNotificationsSetup && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1" data-testid="notification-status">
          <span className="flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Notifications:
          </span>
          {notifPrefs?.notifyEmail && (
            <span className="flex items-center gap-1 text-emerald-500">
              <Mail className="w-3 h-3" />
              Email active
            </span>
          )}
          {notifPrefs?.notifySms && (
            <span className="flex items-center gap-1 text-emerald-500">
              <MessageSquare className="w-3 h-3" />
              SMS active
            </span>
          )}
          <Link href="/settings" className="ml-auto text-primary hover:underline" data-testid="link-notification-settings">
            Manage
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, highlight, subtitle, subtitleColor }: {
  title: string;
  value: string;
  icon: any;
  highlight?: boolean;
  subtitle?: string;
  subtitleColor?: string;
}) {
  return (
    <Card className={`${
      highlight 
        ? 'border-red-500/30 bg-red-500/5' 
        : 'border-sidebar-border bg-sidebar/50'
    } cursor-pointer hover:border-primary/40 transition-all`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Icon className={`h-4 w-4 ${highlight ? 'text-red-500' : 'text-primary'}`} />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className={`text-xs mt-1 ${subtitleColor || 'text-muted-foreground'}`}>{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
