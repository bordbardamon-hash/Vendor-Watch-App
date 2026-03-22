import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Twitter, Loader2, CheckCircle2, XCircle, Clock, Zap, Eye,
  Send, AlertTriangle, Info, Trash2, Plus, RefreshCw, ExternalLink,
  Radio,
} from "lucide-react";

const TWEET_TYPE_COLORS: Record<string, string> = {
  detected: "bg-red-500/20 text-red-300 border-red-500/30",
  update: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  resolved: "bg-green-500/20 text-green-300 border-green-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  posted: "bg-green-500/20 text-green-300",
  failed: "bg-red-500/20 text-red-300",
  skipped: "bg-gray-500/20 text-gray-400",
};

const VENDOR_OPTIONS = [
  "aws", "gcp", "azure", "cloudflare", "github", "slack", "stripe",
  "datadog", "pagerduty", "vercel", "netlify", "openai", "shopify", "twilio", "hubspot",
];

function timeAgo(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TwitterBotPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [previewDialogContent, setPreviewDialogContent] = useState<string | null>(null);
  const [newExcludeVendor, setNewExcludeVendor] = useState("");

  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ["/api/admin/twitter-bot/settings"],
    queryFn: () => apiRequest("GET", "/api/admin/twitter-bot/settings").then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery<any[]>({
    queryKey: ["/api/admin/twitter-bot/logs"],
    queryFn: () => apiRequest("GET", "/api/admin/twitter-bot/logs").then(r => r.json()),
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: (patch: any) => apiRequest("PUT", "/api/admin/twitter-bot/settings", patch).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/twitter-bot/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const manualPostMutation = useMutation({
    mutationFn: (incidentId: string) => apiRequest("POST", `/api/admin/twitter-bot/post/${incidentId}`).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/twitter-bot/logs"] });
      if (data.success) {
        toast({ title: settings?.previewMode ? "Preview logged" : "Tweet posted!", description: data.tweetId ? `Tweet ID: ${data.tweetId}` : "Logged in preview mode." });
        if (data.content) setPreviewDialogContent(data.content);
      } else {
        toast({ title: "Post failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  function patchSetting(key: string, value: any) {
    updateMutation.mutate({ [key]: value });
  }

  function addExcludedVendor() {
    if (!newExcludeVendor.trim() || !settings) return;
    const current: string[] = JSON.parse(settings.excludedVendorKeys || "[]");
    if (current.includes(newExcludeVendor)) return;
    patchSetting("excludedVendorKeys", JSON.stringify([...current, newExcludeVendor]));
    setNewExcludeVendor("");
  }

  function removeExcludedVendor(key: string) {
    if (!settings) return;
    const current: string[] = JSON.parse(settings.excludedVendorKeys || "[]");
    patchSetting("excludedVendorKeys", JSON.stringify(current.filter(k => k !== key)));
  }

  const excludedVendors: string[] = settings ? JSON.parse(settings.excludedVendorKeys || "[]") : [];

  // Stats from logs
  const now = Date.now();
  const tweetsToday = (logs as any[]).filter(l => l.status === "posted" && new Date(l.postedAt).getTime() > now - 86400000).length;
  const tweetsThisHour = (logs as any[]).filter(l => l.status === "posted" && new Date(l.postedAt).getTime() > now - 3600000).length;
  const failedTotal = (logs as any[]).filter(l => l.status === "failed").length;

  const credsSet = true; // We can't check env vars from the frontend — show a hint instead

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Twitter className="h-6 w-6 text-sky-400" />
            X (Twitter) Outage Bot
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Automatically tweets when P1/P2 incidents are detected, updated, or resolved.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchLogs()} data-testid="button-refresh-logs">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Credentials banner */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="pt-4 pb-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-sm text-yellow-200 space-y-1">
            <p>Configure these four environment variables to enable live posting:</p>
            <code className="text-xs text-yellow-300 block">TWITTER_API_KEY · TWITTER_API_SECRET · TWITTER_ACCESS_TOKEN · TWITTER_ACCESS_TOKEN_SECRET</code>
            <p className="text-xs text-yellow-400">Apply for X API Elevated access at developer.twitter.com for higher rate limits.</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Status", value: settings?.enabled ? (settings?.previewMode ? "Preview" : "Live") : "Off", color: settings?.enabled ? (settings?.previewMode ? "text-yellow-400" : "text-green-400") : "text-gray-500" },
          { label: "Tweets today", value: tweetsToday, color: "text-sky-400" },
          { label: "This hour", value: `${tweetsThisHour}/${settings?.maxTweetsPerHour || 3}`, color: tweetsThisHour >= (settings?.maxTweetsPerHour || 3) ? "text-red-400" : "text-green-400" },
          { label: "Failed posts", value: failedTotal, color: failedTotal > 0 ? "text-red-400" : "text-gray-500" },
        ].map(stat => (
          <Card key={stat.label} className="border-gray-700">
            <CardContent className="pt-4 pb-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`} data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: bot controls */}
        <div className="space-y-5">
          {/* Circuit breaker */}
          <Card className="border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="h-4 w-4 text-sky-400" /> Bot Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable bot</p>
                  <p className="text-xs text-gray-400">Master on/off switch (circuit breaker)</p>
                </div>
                <Switch
                  checked={settings?.enabled || false}
                  onCheckedChange={v => patchSetting("enabled", v)}
                  data-testid="switch-bot-enabled"
                  disabled={updateMutation.isPending}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-yellow-400" /> Preview mode
                  </p>
                  <p className="text-xs text-gray-400">Composes tweets and logs them — does NOT post to X</p>
                </div>
                <Switch
                  checked={settings?.previewMode || false}
                  onCheckedChange={v => patchSetting("previewMode", v)}
                  data-testid="switch-preview-mode"
                  disabled={updateMutation.isPending}
                />
              </div>
              {settings?.enabled && !settings?.previewMode && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Live mode — tweets will be publicly posted to X.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trigger settings */}
          <Card className="border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Trigger Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-400 mb-1.5 block">Minimum severity</Label>
                  <Select value={settings?.minSeverity || "major"} onValueChange={v => patchSetting("minSeverity", v)}>
                    <SelectTrigger data-testid="select-min-severity"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">P1 only (Critical)</SelectItem>
                      <SelectItem value="major">P1 + P2 (Critical + Major)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-400 mb-1.5 block">Min active before posting (mins)</Label>
                  <Input
                    data-testid="input-min-active-minutes"
                    type="number" min={1} max={60}
                    defaultValue={settings?.minActiveMinutes || 3}
                    onBlur={e => patchSetting("minActiveMinutes", parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 mb-1.5 block">Max tweets/hour (self-limit)</Label>
                  <Input
                    data-testid="input-max-tweets-hour"
                    type="number" min={1} max={20}
                    defaultValue={settings?.maxTweetsPerHour || 3}
                    onBlur={e => patchSetting("maxTweetsPerHour", parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 mb-1.5 block">Update interval (mins)</Label>
                  <Input
                    data-testid="input-update-interval"
                    type="number" min={15} max={240}
                    defaultValue={settings?.updateIntervalMinutes || 30}
                    onBlur={e => patchSetting("updateIntervalMinutes", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-gray-500 mt-1">How often to post "update" tweets for ongoing incidents.</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-400 mb-1.5 block">Min monitor count</Label>
                  <Input
                    data-testid="input-min-monitor-count"
                    type="number" min={0} max={1000}
                    defaultValue={settings?.minMonitorCount || 1}
                    onBlur={e => patchSetting("minMonitorCount", parseInt(e.target.value))}
                  />
                  <p className="text-xs text-gray-500 mt-1">Skip vendors with fewer than this many VendorWatch subscribers (set to 0 to post about all vendors).</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Excluded vendors */}
          <Card className="border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Excluded Vendors</CardTitle>
              <CardDescription>Never post about these vendors, even if they have incidents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  data-testid="input-exclude-vendor"
                  placeholder="vendor key (e.g. shopify)"
                  value={newExcludeVendor}
                  onChange={e => setNewExcludeVendor(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addExcludedVendor()}
                />
                <Button variant="outline" size="sm" onClick={addExcludedVendor} data-testid="button-add-excluded">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {excludedVendors.length === 0 ? (
                <p className="text-xs text-gray-500">No vendors excluded. All qualifying vendors will be tweeted about.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {excludedVendors.map(key => (
                    <Badge key={key} variant="outline" className="gap-1.5 pr-1.5" data-testid={`badge-excluded-${key}`}>
                      {key}
                      <button onClick={() => removeExcludedVendor(key)} className="hover:text-red-400 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: tweet log */}
        <div>
          <Card className="border-gray-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" /> Tweet Log
                <Badge variant="secondary" className="ml-auto">{(logs as any[]).length} entries</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>
                ) : (logs as any[]).length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-500 px-4">
                    <Twitter className="h-8 w-8 text-gray-700 mx-auto mb-3" />
                    <p>No tweets logged yet.</p>
                    <p className="mt-1">Enable the bot (or use preview mode) to see activity here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {(logs as any[]).map((log: any) => (
                      <div key={log.id} data-testid={`log-row-${log.id}`} className="px-4 py-3 hover:bg-gray-800/40 transition-colors">
                        <div className="flex items-start gap-2 mb-1.5">
                          <Badge className={`text-xs shrink-0 ${TWEET_TYPE_COLORS[log.tweetType] || ""}`}>
                            {log.tweetType}
                          </Badge>
                          <Badge className={`text-xs shrink-0 ${STATUS_COLORS[log.status] || ""}`}>
                            {log.status}
                          </Badge>
                          <span className="text-xs text-gray-500 ml-auto shrink-0">{timeAgo(log.postedAt)}</span>
                        </div>
                        <p className="text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap line-clamp-4">{log.content}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-gray-500">{log.vendorKey}</span>
                          {log.tweetId && (
                            <a
                              href={`https://x.com/i/web/status/${log.tweetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                              data-testid={`link-tweet-${log.id}`}
                            >
                              View on X <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {log.errorMessage && (
                            <span className="text-xs text-red-400 truncate max-w-[200px]">{log.errorMessage}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tweet preview dialog */}
      <Dialog open={!!previewDialogContent} onOpenChange={v => { if (!v) setPreviewDialogContent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tweet Preview</DialogTitle>
            <DialogDescription>This is what was composed (or posted) for this incident.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 font-mono text-sm whitespace-pre-wrap text-gray-200">
            {previewDialogContent}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{previewDialogContent?.length || 0} / 280 characters</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
