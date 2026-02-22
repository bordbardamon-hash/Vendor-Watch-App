import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoAvatar } from "@/components/ui/logo-avatar";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Search, 
  Activity,
  Server,
  Code,
  Hash,
  Loader2,
  RefreshCw,
  Plus,
  Crown,
  Star,
  BellOff,
  Bell,
  Archive,
  Clock,
  Calendar,
  Filter,
  X,
  Users,
  User,
  Bot,
  Sparkles,
  Copy,
  ChevronDown,
  ArrowLeft
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatShortDateInTimezone } from "@/lib/utils";

interface VendorLimit {
  tier: string | null;
  allowed: boolean;
  current: number;
  limit: number | null;
  requestCount: number;
  requestLimit: number;
  canRequestVendors: boolean;
  canAddVendorsDirectly: boolean;
}

interface CustomVendorRequest {
  id: string;
  vendorName: string;
  statusPageUrl: string;
  integrationNotes: string | null;
  status: string;
  createdAt: string;
}

interface Vendor {
  id: string;
  key: string;
  name: string;
  logoUrl?: string | null;
  statusUrl: string;
  parser: string;
  status: string;
  lastChecked?: string;
  createdAt: string;
}

interface Incident {
  id: string;
  vendorKey: string;
  incidentId: string;
  title: string;
  status: string;
  severity: string;
  impact: string;
  url: string;
  startedAt: string;
  updatedAt: string;
  rawHash?: string;
  createdAt: string;
}

interface Acknowledgement {
  id: string;
  userId: string;
  incidentId: string;
  incidentType: string;
  acknowledgedAt: string;
}

interface ArchivedIncident {
  id: string;
  incidentId: string;
  vendorKey: string;
  title: string;
  status: string;
  severity: string;
  impact: string;
  url: string;
  startedAt: string;
  resolvedAt: string;
  archivedAt: string;
}

interface VendorComponent {
  id: string;
  vendorKey: string;
  componentId: string;
  name: string;
  description: string | null;
  groupName: string | null;
  status: string;
  position: number;
  updatedAt: string;
}

function getComponentStatusColor(status: string) {
  switch (status) {
    case 'operational': return 'text-emerald-500';
    case 'degraded_performance': return 'text-yellow-500';
    case 'partial_outage': return 'text-orange-500';
    case 'major_outage': return 'text-red-500';
    case 'under_maintenance': return 'text-blue-500';
    default: return 'text-muted-foreground';
  }
}

function getComponentStatusDot(status: string) {
  switch (status) {
    case 'operational': return 'bg-emerald-500';
    case 'degraded_performance': return 'bg-yellow-500';
    case 'partial_outage': return 'bg-orange-500';
    case 'major_outage': return 'bg-red-500';
    case 'under_maintenance': return 'bg-blue-500';
    default: return 'bg-muted-foreground';
  }
}

function formatComponentStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function VendorComponentsSection({ vendorKey }: { vendorKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: components = [], isLoading } = useQuery<VendorComponent[]>({
    queryKey: [`/api/vendors/${vendorKey}/components`],
    queryFn: async () => {
      const res = await fetch(`/api/vendors/${vendorKey}/components`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  if (!isLoading && components.length === 0) return null;

  const grouped = components.reduce((acc, comp) => {
    const group = comp.groupName || 'Services';
    if (!acc[group]) acc[group] = [];
    acc[group].push(comp);
    return acc;
  }, {} as Record<string, VendorComponent[]>);

  const nonOperational = components.filter(c => c.status !== 'operational').length;

  return (
    <div className="p-6 border-b border-sidebar-border" data-testid="vendor-components-section">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
        data-testid="button-toggle-components"
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          Service Components
          {nonOperational > 0 && (
            <Badge variant="destructive" className="text-xs">{nonOperational} degraded</Badge>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{components.length}</Badge>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isLoading && (
        <div className="flex items-center gap-2 mt-4 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading components...
        </div>
      )}
      {expanded && !isLoading && (
        <div className="space-y-4 mt-4">
          {Object.entries(grouped).map(([group, comps]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</h4>
              <div className="space-y-1">
                {comps.sort((a, b) => a.position - b.position).map(comp => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-sidebar/50 transition-colors"
                    data-testid={`component-${comp.componentId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${getComponentStatusDot(comp.status)}`} />
                      <span className="text-sm truncate">{comp.name}</span>
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${getComponentStatusColor(comp.status)}`}>
                      {formatComponentStatus(comp.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Vendors() {
  const { user } = useAuth();
  const timezone = user?.timezone || 'UTC';
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAllIncidents, setShowAllIncidents] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [archiveVendorFilter, setArchiveVendorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [archiveDateRange, setArchiveDateRange] = useState<string>("all");
  const [requestForm, setRequestForm] = useState({ vendorName: "", statusPageUrl: "", integrationNotes: "" });
  const [directAddForm, setDirectAddForm] = useState({ key: "", name: "", statusUrl: "", parser: "statuspage_json" });
  const { toast } = useToast();
  const detailPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedVendor && detailPanelRef.current) {
      detailPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedVendor]);
  const queryClient = useQueryClient();

  // Fetch archived incidents when dialog is open
  const { data: archivedIncidents = [], isLoading: archiveLoading } = useQuery<ArchivedIncident[]>({
    queryKey: ["archived-incidents", archiveSearchQuery, archiveVendorFilter, archiveDateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (archiveSearchQuery) params.set("query", archiveSearchQuery);
      if (archiveVendorFilter && archiveVendorFilter !== "all") params.set("vendorKey", archiveVendorFilter);
      if (archiveDateRange && archiveDateRange !== "all") params.set("dateRange", archiveDateRange);
      params.set("limit", "100");
      const res = await fetch(`/api/incidents/archive?${params}`);
      if (!res.ok) throw new Error("Failed to fetch archived incidents");
      return res.json();
    },
    enabled: showArchiveDialog,
  });

  const { data: archiveCount } = useQuery<{ count: number }>({
    queryKey: ["archived-incidents-count"],
    queryFn: async () => {
      const res = await fetch("/api/incidents/archive/count");
      if (!res.ok) throw new Error("Failed to fetch count");
      return res.json();
    },
  });

  // Fetch vendor limit info
  const { data: vendorLimit } = useQuery<VendorLimit>({
    queryKey: ["vendor-limit"],
    queryFn: async () => {
      const res = await fetch("/api/vendor-limit");
      if (!res.ok) throw new Error("Failed to fetch vendor limit");
      return res.json();
    },
  });

  // Fetch user's vendor requests
  const { data: vendorRequests = [] } = useQuery<CustomVendorRequest[]>({
    queryKey: ["vendor-requests"],
    queryFn: async () => {
      const res = await fetch("/api/vendor-requests");
      if (!res.ok) throw new Error("Failed to fetch vendor requests");
      return res.json();
    },
  });

  // Create vendor request mutation (for Growth users)
  const createRequestMutation = useMutation({
    mutationFn: async (data: { vendorName: string; statusPageUrl: string; integrationNotes?: string }) => {
      const res = await fetch("/api/vendor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-requests"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-limit"] });
      setShowAddDialog(false);
      setRequestForm({ vendorName: "", statusPageUrl: "", integrationNotes: "" });
      toast({ title: "Request Submitted", description: "Your vendor request has been submitted for review." });
    },
    onError: (error: Error) => {
      toast({ title: "Request Failed", description: error.message, variant: "destructive" });
    },
  });

  // Direct vendor add mutation (for Enterprise users)
  const directAddMutation = useMutation({
    mutationFn: async (data: { key: string; name: string; statusUrl: string; parser: string }) => {
      const res = await fetch("/api/vendors/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add vendor");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-limit"] });
      setShowAddDialog(false);
      setDirectAddForm({ key: "", name: "", statusUrl: "", parser: "statuspage_json" });
      toast({ title: "Vendor Added", description: "New vendor has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Add Failed", description: error.message, variant: "destructive" });
    },
  });

  // Fetch user's subscribed vendors
  const { data: subscriptionData } = useQuery<{
    subscribedVendors: string[];
    hasSetSubscriptions: boolean;
    allowed: boolean;
    current: number;
    limit: number | null;
    tier: string | null;
  }>({
    queryKey: ["subscriptions-vendors"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/vendors");
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },
  });

  // Toggle vendor subscription mutation
  const toggleVendorMutation = useMutation({
    mutationFn: async (vendorKey: string) => {
      const res = await fetch(`/api/vendors/${vendorKey}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to toggle vendor");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-limit"] });
      queryClient.invalidateQueries({ queryKey: ["my-vendors"] });
      toast({
        title: data.subscribed ? "Vendor Added" : "Vendor Removed",
        description: data.subscribed 
          ? `Added to monitoring (${data.current}/${data.limit === null ? '∞' : data.limit})`
          : "Removed from monitoring",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/vendors/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      if (data.background) {
        toast({
          title: "Sync Started",
          description: "Refreshing vendor statuses in background...",
        });
        // Refetch after a delay to get updated data
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["vendors"] });
          queryClient.invalidateQueries({ queryKey: ["incidents"] });
        }, 5000);
      } else {
        toast({
          title: "Status Synced",
          description: data.skipped > 0 
            ? `Updated ${data.synced} vendor(s). ${data.skipped} vendor(s) have no API.`
            : `Updated ${data.synced} vendor(s) with latest status`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Could not refresh vendor statuses",
        variant: "destructive",
      });
    },
  });

  // Helper to check if vendor is being monitored
  const isMonitored = (vendorKey: string) => {
    if (!subscriptionData?.hasSetSubscriptions) return false; // Default: none monitored until user selects
    return subscriptionData.subscribedVendors.includes(vendorKey);
  };

  // Helper to check if user can add more vendors
  const canAddMore = () => {
    if (!subscriptionData) return false;
    if (subscriptionData.limit === null) return true; // Enterprise
    return subscriptionData.current < subscriptionData.limit;
  };

  // Fetch vendors
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
  });

  // Fetch all incidents
  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const res = await fetch("/api/incidents");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      return res.json();
    },
  });

  // Fetch user's acknowledged incidents
  const { data: acknowledgements = [] } = useQuery<Acknowledgement[]>({
    queryKey: ["acknowledgements"],
    queryFn: async () => {
      const res = await fetch("/api/incidents/acknowledgements");
      if (!res.ok) throw new Error("Failed to fetch acknowledgements");
      return res.json();
    },
  });

  // Acknowledge incident mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (incidentId: string) => {
      const res = await fetch(`/api/incidents/${incidentId}/acknowledge`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to acknowledge incident");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acknowledgements"] });
      toast({
        title: "Incident Acknowledged",
        description: "You won't receive further notifications for this incident.",
      });
    },
  });

  // Unacknowledge incident mutation
  const unacknowledgeMutation = useMutation({
    mutationFn: async (incidentId: string) => {
      const res = await fetch(`/api/incidents/${incidentId}/acknowledge`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unacknowledge incident");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acknowledgements"] });
      toast({
        title: "Acknowledgement Removed",
        description: "You will receive notifications for this incident again.",
      });
    },
  });

  // AI Copilot state
  const [showAiCopilotDialog, setShowAiCopilotDialog] = useState(false);
  const [selectedIncidentForAi, setSelectedIncidentForAi] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<{ subject: string; body: string; summary: string } | null>(null);
  const [aiAudience, setAiAudience] = useState<'client' | 'executive' | 'technical'>('client');

  // AI Copilot mutation
  const generateAiDraftMutation = useMutation({
    mutationFn: async ({ incidentId, audience }: { incidentId: string; audience: string }) => {
      const res = await fetch("/api/ai-copilot/incident-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId, audience, tone: 'formal', includeNextSteps: true }),
      });
      if (!res.ok) throw new Error("Failed to generate AI draft");
      return res.json();
    },
    onSuccess: (data) => {
      setAiDraft(data);
    },
    onError: () => {
      toast({
        title: "AI Draft Failed",
        description: "Could not generate incident update. Please try again.",
        variant: "destructive",
      });
    },
  });

  const openAiCopilot = (incidentId: string) => {
    setSelectedIncidentForAi(incidentId);
    setAiDraft(null);
    setShowAiCopilotDialog(true);
  };

  const handleGenerateAiDraft = () => {
    if (selectedIncidentForAi) {
      generateAiDraftMutation.mutate({ incidentId: selectedIncidentForAi, audience: aiAudience });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  // Helper to check if an incident is acknowledged
  const isAcknowledged = (incidentId: string) => {
    return acknowledgements.some(a => a.incidentId === incidentId);
  };

  const filteredVendors = vendors.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (v as any).normalizedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getVendorIncidents = (vendorKey: string) => {
    return incidents
      .filter(i => i.vendorKey === vendorKey)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  };

  const getAllIncidentsSorted = () => {
    return [...incidents].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  };

  const getVendorName = (vendorKey: string) => {
    const vendor = vendors.find(v => v.key === vendorKey);
    return vendor?.name || vendorKey;
  };

  const getSeverityColor = (severity: string) => {
    switch(severity.toLowerCase()) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'major': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'minor': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  if (vendorsLoading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Vendor Status</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Monitor third-party service incidents and health</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync-vendors"
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncMutation.isPending ? 'Syncing...' : 'Refresh Status'}</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-vendor">
                <Plus className="w-4 h-4 mr-2" />
                {vendorLimit?.canAddVendorsDirectly ? 'Add Vendor' : 'Request Vendor'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              {vendorLimit?.canAddVendorsDirectly ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-500" />
                      Add New Vendor
                    </DialogTitle>
                    <DialogDescription>
                      As an Enterprise member, you can add vendors directly to the system.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vendor-key">Vendor Key</Label>
                      <Input
                        id="vendor-key"
                        placeholder="e.g., cloudflare, datadog"
                        value={directAddForm.key}
                        onChange={(e) => setDirectAddForm(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }))}
                        data-testid="input-vendor-key"
                      />
                      <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens only</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor-name">Vendor Name</Label>
                      <Input
                        id="vendor-name"
                        placeholder="e.g., Cloudflare, Datadog"
                        value={directAddForm.name}
                        onChange={(e) => setDirectAddForm(prev => ({ ...prev, name: e.target.value }))}
                        data-testid="input-vendor-name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="status-url">Status Page URL</Label>
                      <Input
                        id="status-url"
                        placeholder="https://status.example.com"
                        value={directAddForm.statusUrl}
                        onChange={(e) => setDirectAddForm(prev => ({ ...prev, statusUrl: e.target.value }))}
                        data-testid="input-status-url"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="parser">Parser Type</Label>
                      <Select value={directAddForm.parser} onValueChange={(value) => setDirectAddForm(prev => ({ ...prev, parser: value }))}>
                        <SelectTrigger data-testid="select-parser">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="statuspage_json">Statuspage.io (JSON API)</SelectItem>
                          <SelectItem value="generic_html">Generic HTML Parser</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Statuspage.io sites provide real-time API sync</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => directAddMutation.mutate(directAddForm)}
                      disabled={directAddMutation.isPending || !directAddForm.key || !directAddForm.name || !directAddForm.statusUrl}
                      data-testid="button-submit-vendor"
                    >
                      {directAddMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Add Vendor
                    </Button>
                  </DialogFooter>
                </>
              ) : vendorLimit?.canRequestVendors ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500" />
                      Request Custom Vendor
                    </DialogTitle>
                    <DialogDescription>
                      Submit a request for a new vendor to be added. Our team will review and integrate it.
                      <span className="block mt-1 text-xs">
                        Requests used: {vendorLimit.requestCount} / {vendorLimit.requestLimit}
                      </span>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="req-vendor-name">Vendor Name</Label>
                      <Input
                        id="req-vendor-name"
                        placeholder="e.g., Cloudflare, Datadog"
                        value={requestForm.vendorName}
                        onChange={(e) => setRequestForm(prev => ({ ...prev, vendorName: e.target.value }))}
                        data-testid="input-request-vendor-name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="req-status-url">Status Page URL</Label>
                      <Input
                        id="req-status-url"
                        placeholder="https://status.example.com"
                        value={requestForm.statusPageUrl}
                        onChange={(e) => setRequestForm(prev => ({ ...prev, statusPageUrl: e.target.value }))}
                        data-testid="input-request-status-url"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="req-notes">Integration Notes (Optional)</Label>
                      <Textarea
                        id="req-notes"
                        placeholder="Any specific requirements or notes about this vendor..."
                        value={requestForm.integrationNotes}
                        onChange={(e) => setRequestForm(prev => ({ ...prev, integrationNotes: e.target.value }))}
                        data-testid="input-request-notes"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                    <Button 
                      onClick={() => createRequestMutation.mutate(requestForm)}
                      disabled={createRequestMutation.isPending || !requestForm.vendorName || !requestForm.statusPageUrl}
                      data-testid="button-submit-request"
                    >
                      {createRequestMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Submit Request
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Upgrade Required</DialogTitle>
                    <DialogDescription>
                      {vendorLimit?.tier === 'essential' 
                        ? "Essential plan does not include custom vendor requests. Upgrade to Growth for 3 custom requests or Enterprise for unlimited additions."
                        : "Please upgrade your subscription to add custom vendors."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-6 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-sidebar rounded-lg border border-sidebar-border">
                      <span className="text-sm text-muted-foreground">Current tier:</span>
                      <Badge variant="outline">{vendorLimit?.tier || 'None'}</Badge>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>Close</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Pending Vendor Requests */}
      {vendorRequests.length > 0 && (
        <div className="bg-sidebar/20 border border-sidebar-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Your Vendor Requests
          </h3>
          <div className="flex flex-wrap gap-2">
            {vendorRequests.map(req => (
              <div key={req.id} className="flex items-center gap-2 bg-background/50 border border-sidebar-border rounded px-3 py-1.5 text-sm">
                <span>{req.vendorName}</span>
                <Badge 
                  variant="outline" 
                  className={req.status === 'pending' ? 'text-yellow-500 border-yellow-500/30' : req.status === 'approved' ? 'text-emerald-500 border-emerald-500/30' : req.status === 'integrated' ? 'text-primary border-primary/30' : 'text-red-500 border-red-500/30'}
                >
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Alert Summary - visible only on small screens */}
      <div className="md:hidden bg-sidebar/30 border border-sidebar-border rounded-lg p-4" data-testid="mobile-alert-summary">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Quick Status
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-background/50 rounded-lg p-2">
            <div className="text-lg font-bold text-emerald-500">{vendors.filter(v => v.status === 'operational').length}</div>
            <div className="text-[10px] text-muted-foreground">Healthy</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2">
            <div className="text-lg font-bold text-orange-500">{incidents.length}</div>
            <div className="text-[10px] text-muted-foreground">Incidents</div>
          </div>
          <div className="bg-background/50 rounded-lg p-2">
            <div className="text-lg font-bold text-blue-500">{acknowledgements.length}</div>
            <div className="text-[10px] text-muted-foreground">Ack'd</div>
          </div>
        </div>
        {incidents.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Recent Alerts:</div>
            {incidents.slice(0, 3).map(incident => (
              <div key={incident.id} className="flex items-center justify-between bg-background/30 rounded p-2 text-xs">
                <div className="flex items-center gap-2 truncate flex-1">
                  <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" />
                  <span className="truncate">{incident.title}</span>
                </div>
                {isAcknowledged(incident.id) && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-500 flex-shrink-0 ml-2">
                    <BellOff className="w-2 h-2 mr-0.5" />
                    Ack
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center" data-testid="status-filter-bar">
        <span className="text-xs text-muted-foreground font-medium mr-1">Filter:</span>
        {[
          { key: 'all', label: 'All', color: 'text-foreground' },
          { key: 'up', label: 'Up', color: 'text-emerald-500' },
          { key: 'warn', label: 'Warn', color: 'text-yellow-500' },
          { key: 'down', label: 'Down', color: 'text-red-500' },
          { key: 'maintenance', label: 'Maintenance', color: 'text-blue-500' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${statusFilter === f.key ? 'bg-primary/10 border-primary/50 text-primary' : 'border-sidebar-border hover:border-primary/30 ' + f.color}`}
            data-testid={`filter-status-${f.key}`}
          >
            {f.key !== 'all' && <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${f.key === 'up' ? 'bg-emerald-500' : f.key === 'warn' ? 'bg-yellow-500' : f.key === 'down' ? 'bg-red-500' : 'bg-blue-500'}`} />}
            {f.label}
            {f.key !== 'all' && <span className="ml-1 opacity-60">({vendors.filter(v => (v as any).normalizedStatus === f.key).length})</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 flex-1">
        {/* Vendor List - hidden on mobile when vendor is selected */}
        <div className={`lg:col-span-5 flex flex-col gap-4 ${selectedVendor || showAllIncidents ? 'hidden lg:flex' : ''}`}>
          {/* Subscription Limit Indicator */}
          {subscriptionData && (
            <div className="bg-sidebar/30 border border-sidebar-border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Monitoring</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {subscriptionData.current} / {subscriptionData.limit === null ? '∞' : subscriptionData.limit} vendors
                </span>
                <Badge variant="outline" className="text-xs capitalize">{subscriptionData.tier || 'Free'}</Badge>
              </div>
            </div>
          )}
          <div className="flex gap-2 mb-4">
            <Button
              variant={showAllIncidents ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setShowAllIncidents(!showAllIncidents);
                if (!showAllIncidents) setSelectedVendor(null);
              }}
              data-testid="button-view-all-incidents"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {showAllIncidents ? 'Back' : `Active (${incidents.length})`}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowArchiveDialog(true)}
              data-testid="button-search-archive"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive {archiveCount?.count ? `(${archiveCount.count})` : ''}
            </Button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search vendors by name..." 
              className="pl-9 bg-sidebar/30 border-sidebar-border h-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-vendors-inline"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchTerm && (
            <div className="text-xs text-muted-foreground mb-2" data-testid="text-search-results-count">
              {filteredVendors.length} result{filteredVendors.length !== 1 ? 's' : ''} for "{searchTerm}"
            </div>
          )}
          <div className="pr-4">
            <div className="space-y-4">
              {filteredVendors.length === 0 && searchTerm ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No vendors found</p>
                  <p className="text-sm opacity-50 mt-1">Try a different search term</p>
                </div>
              ) : null}
              {filteredVendors.map((vendor, index) => (
                <Card 
                  key={vendor.key}
                  className={`cursor-pointer transition-all duration-200 hover:bg-sidebar/50 hover:-translate-y-0.5 border-sidebar-border animate-fade-in-up opacity-0 ${selectedVendor?.key === vendor.key ? 'bg-sidebar border-primary/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-sidebar/20'} ${isMonitored(vendor.key) ? 'ring-1 ring-primary/30' : ''}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => setSelectedVendor(vendor)}
                  data-testid={`card-vendor-${vendor.key}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <LogoAvatar src={vendor.logoUrl} name={vendor.name} size="sm" />
                        <span className="font-semibold" data-testid={`text-vendor-name-${vendor.key}`}>{vendor.name}</span>
                        {isMonitored(vendor.key) && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30">
                            Monitored
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`bg-transparent border ${vendor.status === 'operational' ? 'border-emerald-500/30 text-emerald-500' : vendor.status === 'degraded' ? 'border-orange-500/30 text-orange-500' : 'border-red-500/30 text-red-500'}`}
                          data-testid={`badge-status-${vendor.key}`}
                        >
                          {vendor.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 w-7 p-0 ${isMonitored(vendor.key) ? 'text-primary hover:text-red-500 hover:bg-red-500/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isMonitored(vendor.key) && !canAddMore()) {
                              toast({ 
                                title: "Vendor Limit Reached", 
                                description: `Your ${subscriptionData?.tier} plan allows up to ${subscriptionData?.limit} vendors. Upgrade to monitor more.`,
                                variant: "destructive"
                              });
                              return;
                            }
                            toggleVendorMutation.mutate(vendor.key);
                          }}
                          disabled={toggleVendorMutation.isPending}
                          title={isMonitored(vendor.key) ? "Remove from monitoring" : "Add to monitoring"}
                          data-testid={`button-toggle-vendor-${vendor.key}`}
                        >
                          {isMonitored(vendor.key) ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono mt-3">
                      <div className="flex items-center gap-1.5" title={vendor.parser === 'statuspage_json' ? "Real-time API sync enabled" : "Manual check only"}>
                        <Code className="w-3 h-3" />
                        <span className={`truncate ${vendor.parser === 'statuspage_json' ? 'text-primary' : ''}`}>
                          {vendor.parser === 'statuspage_json' ? 'Live API' : 'Static'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end" title="Status Page URL">
                        <Activity className="w-3 h-3" />
                        <a href={vendor.statusUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate max-w-[120px]">
                          {new URL(vendor.statusUrl).hostname}
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Detail View - shown on mobile only when vendor selected */}
        <div className={`lg:col-span-7 lg:sticky lg:top-4 lg:self-start ${!selectedVendor && !showAllIncidents ? 'hidden lg:block' : ''}`} style={{ maxHeight: 'calc(100vh - 2rem)' }}>
          {showAllIncidents ? (
            <Card className="border-sidebar-border bg-sidebar/10 flex flex-col animate-fade-in-scale" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
              <CardHeader className="border-b border-sidebar-border bg-sidebar/20 shrink-0">
                <button
                  onClick={() => setShowAllIncidents(false)}
                  className="lg:hidden flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 -mt-1"
                  data-testid="button-back-from-incidents"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to vendors
                </button>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      <AlertTriangle className="w-6 h-6 text-amber-500" />
                      All Incidents
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      Showing <span className="text-primary">{incidents.length}</span> incidents across all vendors (newest first)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-0 overflow-y-auto">
                  <div className="p-3 sm:p-6 space-y-4">
                    {getAllIncidentsSorted().length > 0 ? (
                      getAllIncidentsSorted().map((incident) => (
                        <div key={incident.id} className="border border-sidebar-border rounded-lg bg-background/50 p-3 sm:p-4 transition-all hover:border-primary/30 overflow-hidden" data-testid={`card-incident-all-${incident.incidentId}`}>
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded inline-block mb-1">
                                {getVendorName(incident.vendorKey)}
                              </span>
                              <h4 className="font-semibold text-base sm:text-lg break-words">{incident.title}</h4>
                            </div>
                            <Badge className={`${getSeverityColor(incident.severity)} shrink-0`}>
                              {incident.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 break-words">{incident.impact}</p>
                          <div className="text-xs font-mono text-muted-foreground/70 bg-sidebar/50 p-2 rounded mb-3">
                            <div className="truncate">ID: {incident.incidentId}</div>
                            <div className="text-[10px] mt-1">{formatShortDateInTimezone(incident.startedAt, timezone)}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge variant="outline" className="text-xs">Status: {incident.status}</Badge>
                            {isAcknowledged(incident.id) && (
                              <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-500">
                                <BellOff className="w-3 h-3 mr-1" />
                                Ack'd
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant={isAcknowledged(incident.id) ? "secondary" : "outline"}
                              size="sm"
                              className="text-xs h-8 flex-1"
                              onClick={() => isAcknowledged(incident.id) 
                                ? unacknowledgeMutation.mutate(incident.id)
                                : acknowledgeMutation.mutate(incident.id)
                              }
                              disabled={acknowledgeMutation.isPending || unacknowledgeMutation.isPending}
                              data-testid={`button-acknowledge-${incident.id}`}
                            >
                              {isAcknowledged(incident.id) ? (
                                <>
                                  <Bell className="w-3 h-3 mr-1" />
                                  Resume
                                </>
                              ) : (
                                <>
                                  <BellOff className="w-3 h-3 mr-1" />
                                  Acknowledge
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 text-cyan-500 border-cyan-500/30 hover:bg-cyan-500/10"
                              onClick={() => openAiCopilot(incident.id)}
                              data-testid={`button-ai-draft-${incident.id}`}
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Draft
                            </Button>
                            <a href={incident.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 px-2 py-1.5 border border-primary/30 rounded shrink-0">
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500/20" />
                        <p>No incidents reported.</p>
                        <p className="text-sm opacity-50">All systems appear to be operational.</p>
                      </div>
                    )}
                  </div>
              </CardContent>
            </Card>
          ) : selectedVendor ? (
            <Card className="border-sidebar-border bg-sidebar/10 flex flex-col overflow-hidden animate-fade-in-scale" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
              <CardHeader className="border-b border-sidebar-border bg-sidebar/20 shrink-0">
                <button
                  onClick={() => setSelectedVendor(null)}
                  className="lg:hidden flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 -mt-1"
                  data-testid="button-back-to-list"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to vendors
                </button>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      {selectedVendor.name}
                      <a href={selectedVendor.statusUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                      </a>
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      KEY: <span className="text-primary">{selectedVendor.key}</span>
                    </CardDescription>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${selectedVendor.status === 'operational' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${selectedVendor.status === 'operational' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                    {selectedVendor.status.toUpperCase()}
                  </div>
                </div>
              </CardHeader>
              <CardContent ref={detailPanelRef} className="flex-1 min-h-0 p-0 overflow-y-auto" data-testid="vendor-detail-content">
                <div className="p-6 border-b border-sidebar-border">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Active & Recent Incidents
                  </h3>
                  
                  {getVendorIncidents(selectedVendor.key).length > 0 ? (
                    <div className="space-y-4">
                      {getVendorIncidents(selectedVendor.key).map((incident) => (
                        <div key={incident.id} className="border border-sidebar-border rounded-lg bg-background/50 p-3 sm:p-4 transition-all hover:border-primary/30 overflow-hidden" data-testid={`card-incident-${incident.incidentId}`}>
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                            <h4 className="font-semibold text-base sm:text-lg break-words min-w-0 flex-1">{incident.title}</h4>
                            <Badge className={`${getSeverityColor(incident.severity)} shrink-0`}>
                              {incident.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 break-words">{incident.impact}</p>
                          <div className="text-xs font-mono text-muted-foreground/70 bg-sidebar/50 p-2 rounded mb-3">
                            <div className="truncate">ID: {incident.incidentId}</div>
                            <div className="text-[10px] mt-1">{formatShortDateInTimezone(incident.startedAt, timezone)}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge variant="outline" className="text-xs">Status: {incident.status}</Badge>
                            {isAcknowledged(incident.id) && (
                              <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-500">
                                <BellOff className="w-3 h-3 mr-1" />
                                Ack'd
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant={isAcknowledged(incident.id) ? "secondary" : "outline"}
                              size="sm"
                              className="text-xs h-8 flex-1"
                              onClick={() => isAcknowledged(incident.id) 
                                ? unacknowledgeMutation.mutate(incident.id)
                                : acknowledgeMutation.mutate(incident.id)
                              }
                              disabled={acknowledgeMutation.isPending || unacknowledgeMutation.isPending}
                              data-testid={`button-acknowledge-vendor-${incident.id}`}
                            >
                              {isAcknowledged(incident.id) ? (
                                <>
                                  <Bell className="w-3 h-3 mr-1" />
                                  Resume
                                </>
                              ) : (
                                <>
                                  <BellOff className="w-3 h-3 mr-1" />
                                  Acknowledge
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8 text-cyan-500 border-cyan-500/30 hover:bg-cyan-500/10"
                              onClick={() => openAiCopilot(incident.id)}
                              data-testid={`button-ai-draft-vendor-${incident.id}`}
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Draft
                            </Button>
                            <a href={incident.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 px-2 py-1.5 border border-primary/30 rounded shrink-0">
                              View <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500/20" />
                      <p>No incidents reported recently.</p>
                      <p className="text-sm opacity-50">System appears to be fully operational.</p>
                    </div>
                  )}
                </div>
                
                <VendorComponentsSection vendorKey={selectedVendor.key} />

                <div className="p-6 bg-sidebar/30">
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Configuration</h4>
                  <div className="bg-black/50 p-4 rounded-md border border-sidebar-border font-mono text-xs text-muted-foreground overflow-x-auto">
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                      <span className="text-primary">parser_cls:</span>
                      <span>{selectedVendor.parser}</span>
                      <span className="text-primary">endpoint:</span>
                      <span>{selectedVendor.statusUrl}</span>
                      <span className="text-primary">last_sync:</span>
                      <span>{selectedVendor.lastChecked || 'Never'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-sidebar-border rounded-lg bg-sidebar/10" style={{ minHeight: '400px' }}>
              <Server className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a Vendor</p>
              <p className="text-sm opacity-50">View incidents and detailed status metrics</p>
            </div>
          )}
        </div>
      </div>

      {/* Archive Search Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Incident Archive
            </DialogTitle>
            <DialogDescription>
              Search past incidents resolved more than 3 days ago. Archives are kept for 1 year.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or description..."
                value={archiveSearchQuery}
                onChange={(e) => setArchiveSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-archive-search"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Select value={archiveVendorFilter} onValueChange={setArchiveVendorFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-archive-vendor">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.key} value={v.key}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={archiveDateRange} onValueChange={setArchiveDateRange}>
                <SelectTrigger className="w-[160px]" data-testid="select-archive-date">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="6m">Last 6 Months</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                </SelectContent>
              </Select>
              
              {(archiveSearchQuery || archiveVendorFilter !== "all" || archiveDateRange !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setArchiveSearchQuery("");
                    setArchiveVendorFilter("all");
                    setArchiveDateRange("all");
                  }}
                  className="text-muted-foreground"
                  data-testid="button-clear-archive-filters"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch" style={{ maxHeight: '50vh', WebkitOverflowScrolling: 'touch' }}>
            {archiveLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : archivedIncidents.length > 0 ? (
              <div className="space-y-3 pr-2">
                {archivedIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="border border-sidebar-border rounded-lg bg-background/50 p-3"
                    data-testid={`card-archive-${incident.incidentId}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded inline-block mb-1">
                          {incident.vendorKey}
                        </span>
                        <h4 className="font-semibold text-sm break-words">{incident.title}</h4>
                      </div>
                      <Badge className={getSeverityColor(incident.severity)} variant="secondary">
                        {incident.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 break-words line-clamp-2">{incident.impact}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground/70 font-mono">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatShortDateInTimezone(incident.startedAt, timezone)}
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Resolved: {formatShortDateInTimezone(incident.resolvedAt, timezone)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <a
                        href={incident.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
                      >
                        View details <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Archive className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No archived incidents found.</p>
                <p className="text-sm opacity-50">
                  {archiveSearchQuery 
                    ? "Try a different search term." 
                    : "Resolved incidents older than 3 days appear here."}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Copilot Dialog */}
      <Dialog open={showAiCopilotDialog} onOpenChange={setShowAiCopilotDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              AI Communication Copilot
            </DialogTitle>
            <DialogDescription>
              Generate professional incident updates for your clients
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="audience" className="w-24">Audience:</Label>
              <Select value={aiAudience} onValueChange={(v) => setAiAudience(v as 'client' | 'executive' | 'technical')}>
                <SelectTrigger className="w-48" data-testid="select-ai-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client (Non-technical)</SelectItem>
                  <SelectItem value="executive">Executive Summary</SelectItem>
                  <SelectItem value="technical">Technical Team</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleGenerateAiDraft}
                disabled={generateAiDraftMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="button-generate-ai-draft"
              >
                {generateAiDraftMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Draft
                  </>
                )}
              </Button>
            </div>
            
            {aiDraft && (
              <div className="space-y-4 border border-sidebar-border rounded-lg p-4 bg-background/50">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">Subject Line</Label>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(aiDraft.subject)} className="h-6 px-2" data-testid="button-copy-subject">
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <div className="bg-sidebar/50 p-2 rounded text-sm font-medium">{aiDraft.subject}</div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">Message Body</Label>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(aiDraft.body)} className="h-6 px-2" data-testid="button-copy-body">
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="bg-sidebar/50 p-3 rounded text-sm whitespace-pre-wrap">{aiDraft.body}</div>
                  </ScrollArea>
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-sidebar-border">
                  <Bot className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs text-muted-foreground">Quick Summary: {aiDraft.summary}</span>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiCopilotDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
