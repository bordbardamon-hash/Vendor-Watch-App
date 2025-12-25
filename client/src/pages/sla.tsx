import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Activity,
  Loader2,
  Info
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface VendorSLA {
  vendorKey: string;
  vendorName: string;
  uptimePercent: number;
  downtimeMinutes: number;
  incidentCount: number;
  avgResolutionMinutes: number | null;
  slaTarget: number;
  meetsTarget: boolean;
  trend: 'up' | 'down' | 'stable';
}

interface SLAData {
  vendors: VendorSLA[];
  overallUptime: number;
  totalIncidents: number;
  avgResolution: number;
  vendorsBelowTarget: number;
}

export default function SLA() {
  const [timeRange, setTimeRange] = useState("30");
  const [slaTarget, setSlaTarget] = useState("99.9");

  const { data: slaData, isLoading } = useQuery<SLAData>({
    queryKey: ["sla-metrics", timeRange, slaTarget],
    queryFn: async () => {
      const res = await fetch(`/api/sla/metrics?days=${timeRange}&target=${slaTarget}`);
      if (!res.ok) throw new Error("Failed to fetch SLA metrics");
      return res.json();
    },
  });

  const getUptimeColor = (uptime: number, target: number) => {
    if (uptime >= target) return 'text-emerald-500';
    if (uptime >= target - 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getUptimeBg = (uptime: number, target: number) => {
    if (uptime >= target) return 'bg-emerald-500';
    if (uptime >= target - 0.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (isLoading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const targetNum = parseFloat(slaTarget);

  return (
    <div className="p-4 md:p-8 space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-7 h-7 text-primary" />
            SLA Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Track vendor uptime against your SLA targets</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]" data-testid="select-sla-timerange">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={slaTarget} onValueChange={setSlaTarget}>
            <SelectTrigger className="w-[140px]" data-testid="select-sla-target">
              <SelectValue placeholder="SLA Target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="99">99.0%</SelectItem>
              <SelectItem value="99.5">99.5%</SelectItem>
              <SelectItem value="99.9">99.9%</SelectItem>
              <SelectItem value="99.95">99.95%</SelectItem>
              <SelectItem value="99.99">99.99%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Overall Uptime</span>
            </div>
            <div className={`text-2xl font-bold ${getUptimeColor(slaData?.overallUptime || 0, targetNum)}`}>
              {slaData?.overallUptime?.toFixed(2) || 0}%
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Total Incidents</span>
            </div>
            <div className="text-2xl font-bold">{slaData?.totalIncidents || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Avg Resolution</span>
            </div>
            <div className="text-2xl font-bold">{formatMinutes(slaData?.avgResolution || null)}</div>
          </CardContent>
        </Card>

        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Below Target</span>
            </div>
            <div className="text-2xl font-bold text-red-500">{slaData?.vendorsBelowTarget || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor SLA Table */}
      <Card className="flex-1 bg-sidebar border-sidebar-border overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Vendor SLA Status</CardTitle>
          <CardDescription>Uptime performance against {slaTarget}% target</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[calc(100vh-400px)]">
          <div className="space-y-3">
            {slaData?.vendors?.map((vendor) => (
              <div 
                key={vendor.vendorKey}
                className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-background/50 rounded-lg border border-sidebar-border"
                data-testid={`sla-row-${vendor.vendorKey}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{vendor.vendorName}</span>
                    {vendor.meetsTarget ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                    {vendor.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    {vendor.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={vendor.uptimePercent} 
                      className="h-2 flex-1"
                    />
                    <span className={`text-sm font-mono ${getUptimeColor(vendor.uptimePercent, targetNum)}`}>
                      {vendor.uptimePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 md:gap-4 text-sm">
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{vendor.incidentCount}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{vendor.incidentCount} incidents</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatMinutes(vendor.downtimeMinutes)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total downtime: {formatMinutes(vendor.downtimeMinutes)}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Activity className="w-3 h-3" />
                        <span>{formatMinutes(vendor.avgResolutionMinutes)}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Avg resolution: {formatMinutes(vendor.avgResolutionMinutes)}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Badge 
                    variant="outline" 
                    className={vendor.meetsTarget ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}
                  >
                    {vendor.meetsTarget ? 'Meeting SLA' : 'Below SLA'}
                  </Badge>
                </div>
              </div>
            ))}
            
            {(!slaData?.vendors || slaData.vendors.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="w-8 h-8 mx-auto mb-2" />
                <p>No SLA data available. Metrics are calculated from vendor activity.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
