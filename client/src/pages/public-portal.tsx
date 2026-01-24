import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, XCircle, Bell, Mail, Clock, History } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PortalResource {
  type: string;
  key: string;
  name: string;
  status: string;
  hasActiveIncidents: boolean;
  activeIncidents: Array<{
    title: string;
    status: string;
    severity: string;
    startedAt: string;
  }>;
  customSlaTarget: string | null;
}

interface RecentIncident {
  id: string;
  type: string;
  resourceName: string;
  title: string;
  status: string;
  severity: string;
  impact: string;
  startedAt: string;
  updatedAt: string;
}

interface PortalData {
  portal: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    accentColor: string;
    fontFamily: string;
    headerText: string;
    footerText: string;
    showIncidentHistory: boolean;
    showUptimeStats: boolean;
    showSubscribeOption: boolean;
  };
  overallStatus: 'operational' | 'partial_outage' | 'major_outage';
  resources: PortalResource[];
  recentIncidents: RecentIncident[];
}

const STATUS_CONFIG = {
  operational: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", text: "All Systems Operational" },
  partial_outage: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10", text: "Partial System Outage" },
  major_outage: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", text: "Major System Outage" },
};

const RESOURCE_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  operational: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500" },
  degraded: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500" },
  partial_outage: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500" },
  major_outage: { icon: XCircle, color: "text-red-500", bg: "bg-red-500" },
};

export default function PublicPortal() {
  const [, params] = useRoute("/status/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const { data, isLoading, error } = useQuery<PortalData>({
    queryKey: [`/api/status/${slug}`],
    enabled: !!slug,
  });

  const handleSubscribe = async () => {
    if (!email) return;
    setSubscribing(true);
    try {
      const res = await fetch(`/api/status/${slug}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        toast({ title: "Subscribed!", description: "Check your email to confirm." });
        setEmail("");
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to subscribe", variant: "destructive" });
    }
    setSubscribing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Portal Not Found</h1>
        <p className="text-muted-foreground">This status page doesn't exist or is not accessible.</p>
      </div>
    );
  }

  const { portal, overallStatus, resources, recentIncidents = [] } = data;
  const statusConfig = STATUS_CONFIG[overallStatus];
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'major': return 'bg-orange-500 text-white';
      case 'minor': return 'bg-yellow-500 text-black';
      default: return 'bg-blue-500 text-white';
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: portal.backgroundColor || "#0f172a",
        fontFamily: portal.fontFamily || "Inter, sans-serif",
      }}
      data-testid="public-portal"
    >
      <div className="max-w-4xl mx-auto p-6">
        <header className="text-center py-8">
          {portal.logoUrl && (
            <img
              src={portal.logoUrl}
              alt={portal.name}
              className="h-12 mx-auto mb-4"
            />
          )}
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: portal.primaryColor || "#fff" }}
          >
            {portal.headerText || portal.name}
          </h1>
        </header>

        <Card
          className="mb-8 border-0"
          style={{ backgroundColor: portal.secondaryColor || "#1e293b" }}
        >
          <CardContent className={`p-6 flex items-center gap-4 rounded-lg ${statusConfig.bg}`}>
            <StatusIcon className={`h-10 w-10 ${statusConfig.color}`} />
            <div>
              <h2 className="text-xl font-semibold text-white">{statusConfig.text}</h2>
              <p className="text-sm text-gray-400">
                Last updated: {new Date().toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 mb-8">
          {resources.map((resource) => {
            const resStatus = RESOURCE_STATUS_CONFIG[resource.status] || RESOURCE_STATUS_CONFIG.operational;
            const ResIcon = resStatus.icon;
            
            return (
              <Card
                key={`${resource.type}-${resource.key}`}
                className="border-0"
                style={{ backgroundColor: portal.secondaryColor || "#1e293b" }}
                data-testid={`resource-${resource.key}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${resStatus.bg}`} />
                      <div>
                        <span className="font-medium text-white">{resource.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs capitalize">
                          {resource.type}
                        </Badge>
                      </div>
                    </div>
                    <ResIcon className={`h-5 w-5 ${resStatus.color}`} />
                  </div>
                  {resource.hasActiveIncidents && resource.activeIncidents.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      {resource.activeIncidents.map((incident, idx) => (
                        <div key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                          <div>
                            <span className="font-medium text-gray-300">{incident.title}</span>
                            <span className="ml-2 text-xs">({incident.status})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {portal.showIncidentHistory && recentIncidents.length > 0 && (
          <Card
            className="mb-8 border-0"
            style={{ backgroundColor: portal.secondaryColor || "#1e293b" }}
            data-testid="recent-incidents-section"
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <History className="h-5 w-5" style={{ color: portal.primaryColor || "#3b82f6" }} />
                <h3 className="font-semibold text-white">Recent Incidents (Last 7 Days)</h3>
              </div>
              <div className="space-y-3">
                {recentIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-3 rounded-lg bg-gray-800/50 border border-gray-700"
                    data-testid={`incident-${incident.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getSeverityColor(incident.severity)} variant="secondary">
                            {incident.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {incident.status}
                          </Badge>
                        </div>
                        <p className="text-white font-medium">{incident.title}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {incident.resourceName} • {incident.type}
                        </p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(incident.startedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {portal.showSubscribeOption && (
          <Card
            className="mb-8 border-0"
            style={{ backgroundColor: portal.secondaryColor || "#1e293b" }}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="h-5 w-5" style={{ color: portal.primaryColor || "#3b82f6" }} />
                <h3 className="font-semibold text-white">Subscribe to Updates</h3>
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-gray-800 border-gray-700 text-white"
                  data-testid="subscribe-email"
                />
                <Button
                  onClick={handleSubscribe}
                  disabled={subscribing || !email}
                  style={{ backgroundColor: portal.primaryColor || "#3b82f6" }}
                  data-testid="subscribe-btn"
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Subscribe
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {portal.footerText && (
          <footer className="text-center py-6 text-gray-500 text-sm">
            {portal.footerText}
          </footer>
        )}
      </div>
    </div>
  );
}
