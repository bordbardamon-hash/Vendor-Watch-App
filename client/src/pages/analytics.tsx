import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  TrendingUp,
  BarChart3,
  Clock,
  Eye,
  LogIn,
  CheckCircle2,
  AlertTriangle,
  Gauge
} from "lucide-react";
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface UserStats {
  logins: number;
  pageViews: number;
  acknowledgements: number;
  lastActive: string | null;
}

interface VendorPerformance {
  vendorKey: string;
  vendorName: string;
  uptimePercent: number;
  incidentCount: number;
}

interface RecentActivity {
  eventType: string;
  metadata: string | null;
  createdAt: string;
}

const getEventTypeLabel = (eventType: string): string => {
  const labels: Record<string, string> = {
    login: "Login",
    page_view: "Page View",
    incident_ack: "Acknowledged Incident",
    maintenance_ack: "Acknowledged Maintenance",
  };
  return labels[eventType] || eventType;
};

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case "login":
      return <LogIn className="h-4 w-4" />;
    case "page_view":
      return <Eye className="h-4 w-4" />;
    case "incident_ack":
    case "maintenance_ack":
      return <CheckCircle2 className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getUptimeColor = (uptime: number): string => {
  if (uptime >= 99.9) return "#10b981";
  if (uptime >= 99) return "#22c55e";
  if (uptime >= 95) return "#eab308";
  return "#ef4444";
};

export default function Analytics() {
  const { user } = useAuth();
  const [days, setDays] = useState("30");

  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ["/api/analytics/my-stats", days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/my-stats?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: recentActivity = [], isLoading: activityLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/analytics/my-activity"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/my-activity?limit=10");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: vendorStats = [], isLoading: vendorLoading } = useQuery<VendorPerformance[]>({
    queryKey: ["/api/analytics/vendors", days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/vendors?days=${days}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const activityData = [
    { name: "Logins", value: userStats?.logins || 0, color: "#6366f1" },
    { name: "Page Views", value: userStats?.pageViews || 0, color: "#22c55e" },
    { name: "Acknowledgements", value: userStats?.acknowledgements || 0, color: "#f59e0b" },
  ];

  const topVendors = vendorStats.slice(0, 10);
  const incidentFreeVendors = vendorStats.filter(v => v.incidentCount === 0).length;
  const avgUptime = vendorStats.length > 0 
    ? (vendorStats.reduce((sum, v) => sum + v.uptimePercent, 0) / vendorStats.length).toFixed(2)
    : "100.00";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6" data-testid="analytics-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground" data-testid="text-analytics-title">
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your usage patterns and monitor vendor performance
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[180px]" data-testid="select-timerange">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Logins
            </CardTitle>
            <LogIn className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-login-count">
              {statsLoading ? "..." : userStats?.logins || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {days} days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Page Views
            </CardTitle>
            <Eye className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-pageview-count">
              {statsLoading ? "..." : userStats?.pageViews || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {days} days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Acknowledgements
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-ack-count">
              {statsLoading ? "..." : userStats?.acknowledgements || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {days} days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Active
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground" data-testid="text-last-active">
              {statsLoading ? "..." : userStats?.lastActive 
                ? formatDistanceToNow(new Date(userStats.lastActive), { addSuffix: true })
                : "Never"
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Most recent activity
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Your Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="#888888" />
                    <YAxis dataKey="name" type="category" stroke="#888888" width={110} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1a2e', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {activityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No recent activity
              </div>
            ) : (
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {recentActivity.map((activity, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-3 text-sm"
                    data-testid={`activity-item-${index}`}
                  >
                    <div className="flex-shrink-0 text-muted-foreground">
                      {getEventIcon(activity.eventType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground">{getEventTypeLabel(activity.eventType)}</span>
                      {activity.metadata && (
                        <span className="text-muted-foreground ml-2 text-xs truncate">
                          {(() => {
                            try {
                              const meta = JSON.parse(activity.metadata);
                              return meta.page || meta.vendorName || "";
                            } catch {
                              return "";
                            }
                          })()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mt-4">Vendor Performance</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Uptime
            </CardTitle>
            <Gauge className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-avg-uptime">
              {vendorLoading ? "..." : `${avgUptime}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all vendors
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendors with Incidents
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-vendors-with-incidents">
              {vendorLoading ? "..." : vendorStats.filter(v => v.incidentCount > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {days} days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incident-Free Vendors
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-incident-free">
              {vendorLoading ? "..." : incidentFreeVendors}
            </div>
            <p className="text-xs text-muted-foreground">
              Last {days} days
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top 10 Vendors by Incident Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vendorLoading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : topVendors.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No vendor data available
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topVendors} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" stroke="#888888" />
                  <YAxis 
                    dataKey="vendorName" 
                    type="category" 
                    stroke="#888888" 
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1a2e', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'incidentCount') return [value, 'Incidents'];
                      return [value, name];
                    }}
                  />
                  <Bar 
                    dataKey="incidentCount" 
                    fill="#ef4444" 
                    radius={[0, 4, 4, 0]}
                    name="Incidents"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Vendor Uptime Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vendorLoading ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Loading...
            </div>
          ) : vendorStats.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No vendor data available
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {vendorStats.map((vendor) => (
                <div 
                  key={vendor.vendorKey}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30"
                  data-testid={`vendor-uptime-${vendor.vendorKey}`}
                >
                  <span className="text-sm font-medium text-foreground truncate">
                    {vendor.vendorName}
                  </span>
                  <Badge 
                    variant="outline" 
                    style={{ 
                      borderColor: getUptimeColor(vendor.uptimePercent),
                      color: getUptimeColor(vendor.uptimePercent)
                    }}
                  >
                    {vendor.uptimePercent.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
