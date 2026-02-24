import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Globe, Plus, Play, Trash2, Loader2, Activity, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, Clock
} from "lucide-react";
import { useState } from "react";

interface Probe {
  id: string;
  name: string;
  vendorKey: string;
  probeType: string;
  targetUrl: string;
  expectedStatus: number;
  timeoutMs: number;
  intervalMinutes: number;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastLatencyMs: number | null;
  createdAt: string;
}

interface ProbeResult {
  id: string;
  probeId: string;
  status: string;
  latencyMs: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  createdAt: string;
}

const statusConfig: Record<string, { dot: string; badge: string; label: string }> = {
  healthy: { dot: "bg-emerald-500", badge: "border-emerald-500/30 text-emerald-500", label: "Healthy" },
  degraded: { dot: "bg-yellow-500", badge: "border-yellow-500/30 text-yellow-500", label: "Degraded" },
  down: { dot: "bg-red-500", badge: "border-red-500/30 text-red-500", label: "Down" },
};

function ProbeDetail({ probe }: { probe: Probe }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: results = [] } = useQuery<ProbeResult[]>({
    queryKey: ["probe-results", probe.id],
    queryFn: async () => {
      const res = await fetch(`/api/synthetic/probes/${probe.id}/results?limit=50`);
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: expanded,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/synthetic/probes/${probe.id}/run`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to run probe");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["synthetic-probes"] });
      queryClient.invalidateQueries({ queryKey: ["probe-results", probe.id] });
      toast({ title: "Probe Executed", description: `Status: ${data.status}, Latency: ${data.latencyMs}ms` });
    },
    onError: () => toast({ title: "Run Failed", description: "Could not execute probe", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/synthetic/probes/${probe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !probe.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update probe");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synthetic-probes"] });
      toast({ title: probe.isActive ? "Probe Disabled" : "Probe Enabled" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/synthetic/probes/${probe.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete probe");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synthetic-probes"] });
      toast({ title: "Probe Deleted" });
    },
    onError: () => toast({ title: "Delete Failed", variant: "destructive" }),
  });

  const cfg = statusConfig[probe.lastStatus || ""] || { dot: "bg-muted-foreground", badge: "border-muted text-muted-foreground", label: "Unknown" };

  const chartData = [...results]
    .reverse()
    .map((r) => ({
      time: new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      latency: r.latencyMs ?? 0,
      status: r.status,
    }));

  return (
    <div
      className="p-4 bg-background/50 rounded-lg border border-sidebar-border"
      data-testid={`probe-card-${probe.id}`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-3 text-left cursor-pointer"
          data-testid={`button-expand-probe-${probe.id}`}
        >
          <div className={`w-3 h-3 rounded-full shrink-0 ${cfg.dot} ${probe.isActive ? "animate-pulse" : "opacity-40"}`} />
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate" data-testid={`text-probe-name-${probe.id}`}>{probe.name}</div>
            <div className="text-xs text-muted-foreground truncate" data-testid={`text-probe-url-${probe.id}`}>{probe.targetUrl}</div>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {probe.lastLatencyMs !== null && (
            <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-latency-${probe.id}`}>
              <Clock className="w-3 h-3" />
              {probe.lastLatencyMs}ms
            </span>
          )}
          <Badge variant="outline" className={cfg.badge} data-testid={`badge-status-${probe.id}`}>
            {cfg.label}
          </Badge>
          <span className="text-xs text-muted-foreground" data-testid={`text-interval-${probe.id}`}>
            Every {probe.intervalMinutes}m
          </span>
          <Switch
            checked={probe.isActive}
            onCheckedChange={() => toggleMutation.mutate()}
            data-testid={`switch-active-${probe.id}`}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            data-testid={`button-run-probe-${probe.id}`}
          >
            {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid={`button-delete-probe-${probe.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {chartData.length > 0 ? (
            <div data-testid={`chart-latency-${probe.id}`}>
              <h4 className="text-sm font-medium mb-2">Response Time (ms)</h4>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`grad-${probe.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#525252" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#525252" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "8px" }}
                    labelStyle={{ color: "#a3a3a3" }}
                  />
                  <Area type="monotone" dataKey="latency" stroke="#10b981" fill={`url(#grad-${probe.id})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No results yet. Run the probe to see data.</p>
          )}

          {results.length > 0 && (
            <div data-testid={`results-list-${probe.id}`}>
              <h4 className="text-sm font-medium mb-2">Recent Checks</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {results.slice(0, 10).map((r) => {
                  const rc = statusConfig[r.status] || statusConfig.down;
                  return (
                    <div key={r.id} className="flex items-center gap-2 text-xs py-1" data-testid={`result-row-${r.id}`}>
                      <div className={`w-2 h-2 rounded-full ${rc.dot}`} />
                      <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                      <span>{r.statusCode ?? "—"}</span>
                      <span className="text-muted-foreground">{r.latencyMs !== null ? `${r.latencyMs}ms` : "—"}</span>
                      {r.errorMessage && <span className="text-red-400 truncate">{r.errorMessage}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Monitoring() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    targetUrl: "",
    expectedStatus: "200",
    timeoutMs: "30000",
    intervalMinutes: "5",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: probes = [], isLoading } = useQuery<Probe[]>({
    queryKey: ["synthetic-probes"],
    queryFn: async () => {
      const res = await fetch("/api/synthetic/probes");
      if (!res.ok) throw new Error("Failed to fetch probes");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/synthetic/probes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          vendorKey: "custom",
          probeType: "http",
          targetUrl: data.targetUrl,
          expectedStatus: parseInt(data.expectedStatus),
          timeoutMs: parseInt(data.timeoutMs),
          intervalMinutes: parseInt(data.intervalMinutes),
        }),
      });
      if (!res.ok) throw new Error("Failed to create probe");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synthetic-probes"] });
      setShowAddDialog(false);
      setForm({ name: "", targetUrl: "", expectedStatus: "200", timeoutMs: "30000", intervalMinutes: "5" });
      toast({ title: "Probe Created", description: "Your monitoring probe has been added." });
    },
    onError: () => toast({ title: "Create Failed", description: "Could not create probe", variant: "destructive" }),
  });

  const activeProbes = probes.filter((p) => p.isActive);
  const healthy = activeProbes.filter((p) => p.lastStatus === "healthy").length;
  const degraded = activeProbes.filter((p) => p.lastStatus === "degraded").length;
  const down = activeProbes.filter((p) => p.lastStatus === "down").length;

  if (isLoading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Globe className="w-7 h-7 text-primary" />
            Website Monitoring
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-subtitle">
            Synthetic probes to monitor your websites and APIs
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-probe">
              <Plus className="w-4 h-4 mr-2" />
              Add Probe
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Add Monitoring Probe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="probe-name">Name</Label>
                <Input
                  id="probe-name"
                  placeholder="My Website"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-probe-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="probe-url">Target URL</Label>
                <Input
                  id="probe-url"
                  placeholder="https://example.com"
                  value={form.targetUrl}
                  onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                  data-testid="input-probe-url"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="probe-status">Expected Status</Label>
                  <Input
                    id="probe-status"
                    type="number"
                    value={form.expectedStatus}
                    onChange={(e) => setForm({ ...form, expectedStatus: e.target.value })}
                    data-testid="input-probe-expected-status"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="probe-timeout">Timeout (ms)</Label>
                  <Input
                    id="probe-timeout"
                    type="number"
                    value={form.timeoutMs}
                    onChange={(e) => setForm({ ...form, timeoutMs: e.target.value })}
                    data-testid="input-probe-timeout"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="probe-interval">Interval (min)</Label>
                  <Input
                    id="probe-interval"
                    type="number"
                    value={form.intervalMinutes}
                    onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })}
                    data-testid="input-probe-interval"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || !form.targetUrl || createMutation.isPending}
                data-testid="button-submit-probe"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Probe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Probes</span>
            </div>
            <div className="text-2xl font-bold" data-testid="stat-total-probes">{probes.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Healthy</span>
            </div>
            <div className="text-2xl font-bold text-emerald-500" data-testid="stat-healthy">{healthy}</div>
          </CardContent>
        </Card>
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Degraded</span>
            </div>
            <div className="text-2xl font-bold text-yellow-500" data-testid="stat-degraded">{degraded}</div>
          </CardContent>
        </Card>
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Down</span>
            </div>
            <div className="text-2xl font-bold text-red-500" data-testid="stat-down">{down}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 bg-sidebar border-sidebar-border overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Probes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[calc(100vh-400px)]">
          <div className="space-y-3" data-testid="probe-list">
            {probes.map((probe) => (
              <ProbeDetail key={probe.id} probe={probe} />
            ))}
            {probes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-probes">
                <Globe className="w-8 h-8 mx-auto mb-2" />
                <p>No probes configured. Add a probe to start monitoring.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
