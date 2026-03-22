import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus, Trash2, Play, Pencil, Zap, Clock, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, Loader2, Info, Bell, FlaskConical,
} from "lucide-react";

// ── Static data for condition/action dropdowns ────────────────────────

const VENDOR_OPTIONS = [
  { key: "aws", label: "AWS" }, { key: "gcp", label: "Google Cloud" }, { key: "azure", label: "Azure" },
  { key: "cloudflare", label: "Cloudflare" }, { key: "github", label: "GitHub" }, { key: "slack", label: "Slack" },
  { key: "stripe", label: "Stripe" }, { key: "datadog", label: "Datadog" }, { key: "pagerduty", label: "PagerDuty" },
  { key: "vercel", label: "Vercel" }, { key: "netlify", label: "Netlify" }, { key: "openai", label: "OpenAI" },
  { key: "shopify", label: "Shopify" }, { key: "twilio", label: "Twilio" }, { key: "hubspot", label: "HubSpot" },
];

const CHAIN_OPTIONS = [
  { key: "ethereum", label: "Ethereum" }, { key: "bitcoin", label: "Bitcoin" }, { key: "solana", label: "Solana" },
  { key: "polygon", label: "Polygon" }, { key: "arbitrum", label: "Arbitrum" }, { key: "optimism", label: "Optimism" },
  { key: "base", label: "Base" }, { key: "bsc", label: "BNB Chain" },
];

const CONDITION_TYPES = [
  { value: "vendor_status", label: "Vendor status is…" },
  { value: "vendor_incident_severity", label: "Vendor has active incident with severity…" },
  { value: "vendor_incident_count", label: "Vendor had N+ incidents in last N days" },
  { value: "multi_vendor_and_degraded", label: "Two vendors are both degraded simultaneously" },
  { value: "watchlist_outage", label: "Any vendor has an active critical/major incident" },
  { value: "chain_block_time_exceeds", label: "Chain block time exceeds N seconds" },
  { value: "chain_no_new_blocks", label: "Chain has had no new blocks for N minutes" },
  { value: "incident_active_duration", label: "Incident has been active for more than N minutes" },
  { value: "business_hours", label: "Current time is business hours (9am–6pm)" },
  { value: "day_of_week", label: "Day of week is…" },
  { value: "reliability_score_below", label: "Vendor reliability score drops below N" },
];

const ACTION_TYPES = [
  { value: "email", label: "Send email", tier: "essential" },
  { value: "sms", label: "Send SMS (Twilio)", tier: "growth" },
  { value: "slack", label: "Send Slack message", tier: "growth" },
  { value: "webhook", label: "Send webhook POST", tier: "growth" },
  { value: "log", label: "Log only (no notification)", tier: "free" },
];

// ── Plain-English rule preview ────────────────────────────────────────

function conditionToEnglish(c: any): string {
  const p = c.params || {};
  const vLabel = (key: string) => VENDOR_OPTIONS.find(v => v.key === key)?.label || key;
  const cLabel = (key: string) => CHAIN_OPTIONS.find(c => c.key === key)?.label || key;
  switch (c.conditionType) {
    case "vendor_status":
      return `${vLabel(p.vendorKey)} is ${p.status || "degraded"}`;
    case "vendor_incident_severity":
      return `${vLabel(p.vendorKey)} has an active ${p.severity || "critical"} incident`;
    case "vendor_incident_count":
      return `${vLabel(p.vendorKey)} has had ${p.count || 3}+ incidents in the last ${p.days || 30} days`;
    case "multi_vendor_and_degraded":
      return `${(p.vendorKeys || []).map(vLabel).join(" AND ")} are both degraded simultaneously`;
    case "watchlist_outage":
      return "any vendor has an active critical or major incident";
    case "chain_block_time_exceeds":
      return `${cLabel(p.chainKey)} block time exceeds ${p.seconds || 30} seconds`;
    case "chain_no_new_blocks":
      return `${cLabel(p.chainKey)} has had no new blocks for ${p.minutes || 5} minutes`;
    case "incident_active_duration":
      return `an incident${p.vendorKey ? ` on ${vLabel(p.vendorKey)}` : ""} has been active for more than ${p.minutes || 60} minutes`;
    case "business_hours":
      return `current time is business hours (9am–6pm ${p.timezone || "UTC"})`;
    case "day_of_week":
      return `today is a ${p.days === "weekends" ? "weekend" : p.days === "weekdays" ? "weekday" : "any day"}`;
    case "reliability_score_below":
      return `${vLabel(p.vendorKey)} reliability score drops below ${p.score || 80}`;
    default:
      return c.conditionType;
  }
}

function ruleToEnglish(conditions: any[]): string {
  if (!conditions || conditions.length === 0) return "No conditions set yet.";
  const parts = conditions.map(conditionToEnglish);
  if (parts.length === 1) return `This rule fires when ${parts[0]}.`;
  return `This rule fires when ${parts.slice(0, -1).join(", AND ")} AND ${parts[parts.length - 1]}.`;
}

// ── Default params for each condition type ────────────────────────────

function defaultParams(type: string): Record<string, any> {
  switch (type) {
    case "vendor_status": return { vendorKey: "aws", status: "degraded" };
    case "vendor_incident_severity": return { vendorKey: "aws", severity: "critical" };
    case "vendor_incident_count": return { vendorKey: "aws", count: 3, days: 30 };
    case "multi_vendor_and_degraded": return { vendorKeys: ["aws", "cloudflare"] };
    case "watchlist_outage": return {};
    case "chain_block_time_exceeds": return { chainKey: "ethereum", seconds: 30 };
    case "chain_no_new_blocks": return { chainKey: "ethereum", minutes: 5 };
    case "incident_active_duration": return { minutes: 60 };
    case "business_hours": return { timezone: "America/New_York" };
    case "day_of_week": return { days: "weekdays" };
    case "reliability_score_below": return { vendorKey: "aws", score: 80 };
    default: return {};
  }
}

function defaultActionParams(type: string): Record<string, any> {
  switch (type) {
    case "email": return { address: "" };
    case "sms": return { phone: "" };
    case "slack": return { webhookUrl: "" };
    case "webhook": return { url: "", payload: '{"rule":"{{rule_name}}","conditions":"{{conditions}}","fired_at":"{{fired_at}}"}' };
    case "log": return {};
    default: return {};
  }
}

// ── Condition param editor ────────────────────────────────────────────

function ConditionParams({ cond, onChange }: { cond: any; onChange: (params: any) => void }) {
  const p = cond.params || {};
  const set = (key: string, val: any) => onChange({ ...p, [key]: val });

  switch (cond.conditionType) {
    case "vendor_status":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Vendor</Label>
            <Select value={p.vendorKey || "aws"} onValueChange={v => set("vendorKey", v)}>
              <SelectTrigger data-testid="cond-vendor-key"><SelectValue /></SelectTrigger>
              <SelectContent>{VENDOR_OPTIONS.map(v => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Status</Label>
            <Select value={p.status || "degraded"} onValueChange={v => set("status", v)}>
              <SelectTrigger data-testid="cond-vendor-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="outage">Outage</SelectItem>
                <SelectItem value="operational">Operational</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "vendor_incident_severity":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Vendor</Label>
            <Select value={p.vendorKey || "aws"} onValueChange={v => set("vendorKey", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VENDOR_OPTIONS.map(v => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Minimum severity</Label>
            <Select value={p.severity || "critical"} onValueChange={v => set("severity", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "vendor_incident_count":
      return (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Vendor</Label>
            <Select value={p.vendorKey || "aws"} onValueChange={v => set("vendorKey", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VENDOR_OPTIONS.map(v => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Min incidents</Label>
            <Input type="number" min={1} value={p.count || 3} onChange={e => set("count", parseInt(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Time window (days)</Label>
            <Select value={String(p.days || 30)} onValueChange={v => set("days", parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "multi_vendor_and_degraded":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Vendor 1</Label>
            <Select value={(p.vendorKeys || [])[0] || "aws"} onValueChange={v => set("vendorKeys", [v, (p.vendorKeys || [])[1] || "cloudflare"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VENDOR_OPTIONS.map(v => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Vendor 2</Label>
            <Select value={(p.vendorKeys || [])[1] || "cloudflare"} onValueChange={v => set("vendorKeys", [(p.vendorKeys || [])[0] || "aws", v])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VENDOR_OPTIONS.map(v => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      );

    case "watchlist_outage":
      return <p className="text-xs text-gray-400">Fires when any vendor has an active critical or major incident.</p>;

    case "chain_block_time_exceeds":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Chain</Label>
            <Select value={p.chainKey || "ethereum"} onValueChange={v => set("chainKey", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHAIN_OPTIONS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Block time threshold (seconds)</Label>
            <Input type="number" min={1} value={p.seconds || 30} onChange={e => set("seconds", parseInt(e.target.value))} />
          </div>
        </div>
      );

    case "chain_no_new_blocks":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Chain</Label>
            <Select value={p.chainKey || "ethereum"} onValueChange={v => set("chainKey", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHAIN_OPTIONS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Silence threshold (minutes)</Label>
            <Input type="number" min={1} value={p.minutes || 5} onChange={e => set("minutes", parseInt(e.target.value))} />
          </div>
        </div>
      );

    case "incident_active_duration":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Duration threshold (minutes)</Label>
            <Input type="number" min={1} value={p.minutes || 60} onChange={e => set("minutes", parseInt(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Vendor (optional)</Label>
            <Select value={p.vendorKey || "__any__"} onValueChange={v => set("vendorKey", v === "__any__" ? undefined : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any vendor</SelectItem>
                {VENDOR_OPTIONS.map(v => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "business_hours":
      return (
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Timezone</Label>
          <Select value={p.timezone || "America/New_York"} onValueChange={v => set("timezone", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
              <SelectItem value="America/Chicago">Central (CT)</SelectItem>
              <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
              <SelectItem value="Europe/London">London (GMT)</SelectItem>
              <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
              <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "day_of_week":
      return (
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Day group</Label>
          <Select value={p.days || "weekdays"} onValueChange={v => set("days", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekdays">Weekdays (Mon–Fri)</SelectItem>
              <SelectItem value="weekends">Weekends (Sat–Sun)</SelectItem>
              <SelectItem value="all">Any day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "reliability_score_below":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Vendor</Label>
            <Select value={p.vendorKey || "aws"} onValueChange={v => set("vendorKey", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VENDOR_OPTIONS.map(v => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Score threshold (0–100)</Label>
            <Input type="number" min={0} max={100} value={p.score || 80} onChange={e => set("score", parseInt(e.target.value))} />
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ── Action param editor ───────────────────────────────────────────────

function ActionParams({ action, onChange }: { action: any; onChange: (params: any) => void }) {
  const p = action.params || {};
  const set = (key: string, val: any) => onChange({ ...p, [key]: val });

  switch (action.actionType) {
    case "email":
      return (
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Email address</Label>
          <Input data-testid="action-email" type="email" placeholder="you@company.com" value={p.address || ""} onChange={e => set("address", e.target.value)} />
        </div>
      );
    case "sms":
      return (
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Phone number (E.164 format)</Label>
          <Input data-testid="action-sms" placeholder="+12125551234" value={p.phone || ""} onChange={e => set("phone", e.target.value)} />
        </div>
      );
    case "slack":
      return (
        <div>
          <Label className="text-xs text-gray-400 mb-1 block">Slack webhook URL</Label>
          <Input data-testid="action-slack" placeholder="https://hooks.slack.com/services/…" value={p.webhookUrl || ""} onChange={e => set("webhookUrl", e.target.value)} />
        </div>
      );
    case "webhook":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Webhook URL</Label>
            <Input data-testid="action-webhook-url" placeholder="https://your-server.com/webhook" value={p.url || ""} onChange={e => set("url", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-gray-400 mb-1 block">Payload template (JSON, use {"{{rule_name}}"}, {"{{conditions}}"}, {"{{fired_at}}"})</Label>
            <Textarea className="font-mono text-xs" rows={3} value={p.payload || '{"rule":"{{rule_name}}","conditions":"{{conditions}}","fired_at":"{{fired_at}}"}'} onChange={e => set("payload", e.target.value)} />
          </div>
        </div>
      );
    case "log":
      return <p className="text-xs text-gray-400">Logs the rule firing to the evaluation history. Useful for testing without sending notifications.</p>;
    default:
      return null;
  }
}

// ── Main page ─────────────────────────────────────────────────────────

interface RuleCondition { conditionType: string; params: Record<string, any> }
interface RuleAction { actionType: string; params: Record<string, any> }
interface RuleDraft {
  name: string;
  description: string;
  cooldownMinutes: number;
  status: "active" | "paused";
  conditions: RuleCondition[];
  actions: RuleAction[];
}

const emptyDraft = (): RuleDraft => ({
  name: "",
  description: "",
  cooldownMinutes: 30,
  status: "active",
  conditions: [],
  actions: [],
});

export default function AlertRulesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft());
  const [logsDialogId, setLogsDialogId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const { data: rules = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/alert-rules"],
    queryFn: () => apiRequest("GET", "/api/alert-rules").then(r => r.json()),
  });

  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["/api/alert-rules", logsDialogId, "logs"],
    queryFn: () => apiRequest("GET", `/api/alert-rules/${logsDialogId}/logs`).then(r => r.json()),
    enabled: !!logsDialogId,
  });

  const createMutation = useMutation({
    mutationFn: (data: RuleDraft) => apiRequest("POST", "/api/alert-rules", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] }); closeBuilder(); toast({ title: "Rule created", description: "Your alert rule is now active." }); },
    onError: (e: any) => toast({ title: "Failed to create rule", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: RuleDraft & { id: string }) => apiRequest("PUT", `/api/alert-rules/${data.id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] }); closeBuilder(); toast({ title: "Rule updated" }); },
    onError: (e: any) => toast({ title: "Failed to update rule", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/alert-rules/${id}`).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] }); toast({ title: "Rule deleted" }); },
    onError: (e: any) => toast({ title: "Failed to delete rule", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/alert-rules/${id}/toggle`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/alert-rules/${id}/test`).then(r => r.json()),
    onSuccess: (data) => { setTestResult(data); toast({ title: data.success ? "Test fired successfully!" : "Test fire completed with errors", description: data.success ? "All actions were sent." : "Some actions failed — check results below.", variant: data.success ? "default" : "destructive" }); },
    onError: (e: any) => toast({ title: "Test fire failed", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setStep(1);
    setTestResult(null);
    setBuilderOpen(true);
  }

  function openEdit(rule: any) {
    setEditingId(rule.id);
    setDraft({
      name: rule.name,
      description: rule.description || "",
      cooldownMinutes: rule.cooldownMinutes,
      status: rule.status,
      conditions: (rule.conditions || []).map((c: any) => ({ conditionType: c.conditionType, params: JSON.parse(c.params || "{}") })),
      actions: (rule.actions || []).map((a: any) => ({ actionType: a.actionType, params: JSON.parse(a.params || "{}") })),
    });
    setStep(1);
    setTestResult(null);
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setEditingId(null);
    setDraft(emptyDraft());
    setStep(1);
    setTestResult(null);
  }

  function saveRule() {
    if (editingId) {
      updateMutation.mutate({ ...draft, id: editingId });
    } else {
      createMutation.mutate(draft);
    }
  }

  const addCondition = () => {
    const type = "vendor_status";
    setDraft(d => ({ ...d, conditions: [...d.conditions, { conditionType: type, params: defaultParams(type) }] }));
  };

  const addAction = () => {
    const type = "email";
    setDraft(d => ({ ...d, actions: [...d.actions, { actionType: type, params: defaultActionParams(type) }] }));
  };

  const tier = (user as any)?.subscriptionTier || "free";
  const ruleLimitMap: Record<string, number | null> = { free: 0, essential: 3, growth: 10, enterprise: null };
  const ruleLimit = ruleLimitMap[tier];
  const canCreate = ruleLimit === null || (rules as any[]).length < ruleLimit;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Alert Rules
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Create If-This-Then-That rules. Evaluated every 2 minutes.
            {ruleLimit !== null && <span className="ml-2 text-gray-500">({(rules as any[]).length}/{ruleLimit} rules used)</span>}
          </p>
        </div>
        <Button onClick={openCreate} disabled={!canCreate} data-testid="button-create-rule">
          <Plus className="h-4 w-4 mr-2" /> Create Rule
        </Button>
      </div>

      {!canCreate && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-200">
              {tier === "free" ? "Alert rules require an Essential plan or higher." : `You've reached the ${ruleLimit}-rule limit on your plan. Upgrade to Growth or Enterprise for more.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      ) : (rules as any[]).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4 text-center">
            <Zap className="h-10 w-10 text-gray-600" />
            <div>
              <p className="font-medium text-gray-300">No alert rules yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first rule to get notified when vendor conditions are met.</p>
            </div>
            {canCreate && <Button variant="outline" onClick={openCreate} data-testid="button-create-first-rule"><Plus className="h-4 w-4 mr-2" /> Create your first rule</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(rules as any[]).map((rule: any) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`} className="transition-colors hover:border-gray-600">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</span>
                      <Badge variant={rule.status === "active" ? "default" : "secondary"} className={rule.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}>
                        {rule.status === "active" ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    {rule.description && <p className="text-sm text-gray-400 mt-0.5 truncate">{rule.description}</p>}
                    <p className="text-xs text-gray-500 mt-2 italic">{ruleToEnglish(
                      (rule.conditions || []).map((c: any) => ({ conditionType: c.conditionType, params: JSON.parse(c.params || "{}") }))
                    )}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{(rule.conditions || []).length} condition{(rule.conditions || []).length !== 1 ? "s" : ""}</span>
                      <span>{(rule.actions || []).length} action{(rule.actions || []).length !== 1 ? "s" : ""}</span>
                      <span>Cooldown: {rule.cooldownMinutes}m</span>
                      {rule.lastFiredAt && <span>Last fired: {new Date(rule.lastFiredAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.status === "active"}
                      onCheckedChange={() => toggleMutation.mutate(rule.id)}
                      data-testid={`switch-rule-${rule.id}`}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setLogsDialogId(rule.id)} data-testid={`button-logs-${rule.id}`}>
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => testMutation.mutate(rule.id)} disabled={testMutation.isPending} data-testid={`button-test-${rule.id}`}>
                      <FlaskConical className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(rule)} data-testid={`button-edit-${rule.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => deleteMutation.mutate(rule.id)} data-testid={`button-delete-${rule.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rule Builder Sheet */}
      <Sheet open={builderOpen} onOpenChange={v => { if (!v) closeBuilder(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
            <SheetTitle>{editingId ? "Edit Rule" : "Create Alert Rule"}</SheetTitle>
            <SheetDescription>Step {step} of 4 — {["Name your rule", "Set conditions", "Set actions", "Review & save"][step - 1]}</SheetDescription>
            <div className="flex gap-1 mt-3">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-gray-700"}`} />
              ))}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {/* Step 1: Name */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rule-name" className="mb-1.5 block">Rule name <span className="text-red-400">*</span></Label>
                  <Input
                    id="rule-name"
                    data-testid="input-rule-name"
                    placeholder="e.g., AWS + Cloudflare both down"
                    value={draft.name}
                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="rule-description" className="mb-1.5 block text-gray-300">Description (optional)</Label>
                  <Textarea
                    id="rule-description"
                    data-testid="input-rule-description"
                    placeholder="What this rule monitors and why it matters…"
                    rows={3}
                    value={draft.description}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Conditions */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-300">{ruleToEnglish(draft.conditions)}</p>
                </div>

                {draft.conditions.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">No conditions yet. Add at least one condition below.</div>
                )}

                {draft.conditions.map((cond, i) => (
                  <Card key={i} className="border-gray-700 bg-gray-800/40">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-center gap-2">
                        {i > 0 && <Badge variant="outline" className="text-xs shrink-0">AND</Badge>}
                        <Select
                          value={cond.conditionType}
                          onValueChange={v => setDraft(d => {
                            const updated = [...d.conditions];
                            updated[i] = { conditionType: v, params: defaultParams(v) };
                            return { ...d, conditions: updated };
                          })}
                        >
                          <SelectTrigger data-testid={`select-cond-type-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONDITION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="shrink-0 text-red-400" onClick={() => setDraft(d => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <ConditionParams
                        cond={cond}
                        onChange={params => setDraft(d => {
                          const updated = [...d.conditions];
                          updated[i] = { ...updated[i], params };
                          return { ...d, conditions: updated };
                        })}
                      />
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" onClick={addCondition} className="w-full" data-testid="button-add-condition">
                  <Plus className="h-4 w-4 mr-2" /> Add condition
                </Button>
              </div>
            )}

            {/* Step 3: Actions */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">When all conditions are met, VendorWatch will execute these actions. Multiple actions are allowed.</p>

                {draft.actions.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">No actions yet. Add at least one action below.</div>
                )}

                {draft.actions.map((action, i) => (
                  <Card key={i} className="border-gray-700 bg-gray-800/40">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={action.actionType}
                          onValueChange={v => setDraft(d => {
                            const updated = [...d.actions];
                            updated[i] = { actionType: v, params: defaultActionParams(v) };
                            return { ...d, actions: updated };
                          })}
                        >
                          <SelectTrigger data-testid={`select-action-type-${i}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="shrink-0 text-red-400" onClick={() => setDraft(d => ({ ...d, actions: d.actions.filter((_, j) => j !== i) }))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <ActionParams
                        action={action}
                        onChange={params => setDraft(d => {
                          const updated = [...d.actions];
                          updated[i] = { ...updated[i], params };
                          return { ...d, actions: updated };
                        })}
                      />
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" onClick={addAction} className="w-full" data-testid="button-add-action">
                  <Plus className="h-4 w-4 mr-2" /> Add action
                </Button>
              </div>
            )}

            {/* Step 4: Review & Save */}
            {step === 4 && (
              <div className="space-y-5">
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base">Plain-English Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-sm text-gray-200 italic">{ruleToEnglish(draft.conditions)}</p>
                    {draft.actions.length > 0 && (
                      <div className="mt-3 text-xs text-gray-400">
                        <span className="font-medium text-gray-300">Then: </span>
                        {draft.actions.map((a, i) => {
                          const label = ACTION_TYPES.find(t => t.value === a.actionType)?.label || a.actionType;
                          const detail = a.params.address || a.params.phone || a.params.webhookUrl || a.params.url || "";
                          return <span key={i}>{i > 0 ? " + " : ""}{label}{detail ? ` (${detail})` : ""}</span>;
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block text-gray-300">Cooldown period</Label>
                    <Select value={String(draft.cooldownMinutes)} onValueChange={v => setDraft(d => ({ ...d, cooldownMinutes: parseInt(v) }))}>
                      <SelectTrigger data-testid="select-cooldown"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                        <SelectItem value="1440">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">Minimum time between fires to prevent spam.</p>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-gray-300">Initial status</Label>
                    <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v as "active" | "paused" }))}>
                      <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused (save but don't fire)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Test fire (only for edit mode — rule must exist first) */}
                {editingId && (
                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
                    <p className="text-sm font-medium text-yellow-300">Test fire</p>
                    <p className="text-xs text-gray-400">Manually triggers all actions right now — bypasses conditions and cooldown. Use this to verify your setup before going live.</p>
                    <Button variant="outline" size="sm" className="border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10" onClick={() => testMutation.mutate(editingId!)} disabled={testMutation.isPending} data-testid="button-test-fire">
                      {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
                      Send test now
                    </Button>
                    {testResult && (
                      <div className="space-y-1">
                        {testResult.results?.map((r: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {r.success ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <XCircle className="h-3 w-3 text-red-400" />}
                            <span className="text-gray-300">{r.type}</span>
                            {r.error && <span className="text-red-400">— {r.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer navigation */}
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
            <Button variant="ghost" onClick={() => step > 1 ? setStep(s => s - 1) : closeBuilder()} disabled={isSaving}>
              <ChevronLeft className="h-4 w-4 mr-1" /> {step === 1 ? "Cancel" : "Back"}
            </Button>
            <div className="flex items-center gap-2">
              {step < 4 ? (
                <Button
                  onClick={() => setStep(s => s + 1)}
                  disabled={(step === 1 && !draft.name.trim()) || (step === 2 && draft.conditions.length === 0) || (step === 3 && draft.actions.length === 0)}
                  data-testid={`button-step-next-${step}`}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={saveRule} disabled={isSaving} data-testid="button-save-rule">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingId ? "Save changes" : "Create rule"}
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Logs dialog */}
      <Dialog open={!!logsDialogId} onOpenChange={v => { if (!v) setLogsDialogId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Evaluation History</DialogTitle>
            <DialogDescription>Last 100 evaluation runs for this rule.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            {(logs as any[]).length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No evaluations yet. Rules are checked every 2 minutes.</p>
            ) : (
              <div className="space-y-2">
                {(logs as any[]).map((log: any) => {
                  const condResults = JSON.parse(log.conditionsResult || "[]");
                  return (
                    <div key={log.id} data-testid={`log-entry-${log.id}`} className={`rounded-lg border p-3 text-xs ${log.fired ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-800/40"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.fired ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <XCircle className="h-3.5 w-3.5 text-gray-500" />}
                          <span className={log.fired ? "text-green-300 font-medium" : "text-gray-400"}>
                            {log.fired ? "Fired" : "Not fired"}
                          </span>
                        </div>
                        <span className="text-gray-500">{new Date(log.evaluatedAt).toLocaleString()}</span>
                      </div>
                      {condResults.length > 0 && (
                        <div className="space-y-0.5">
                          {condResults.map((r: any, i: number) => (
                            <div key={i} className="flex items-center gap-1.5 text-gray-400">
                              {r.passed ? <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" /> : <XCircle className="h-3 w-3 text-red-400 shrink-0" />}
                              <span>{r.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {log.error && <p className="text-red-400 mt-1">Error: {log.error}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
