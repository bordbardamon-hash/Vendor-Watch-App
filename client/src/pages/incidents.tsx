import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, ExternalLink, Search, Loader2, BellOff, Bell, Archive, Clock, Calendar, Filter, X, Bot, Sparkles, Copy } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatShortDateInTimezone, getBrowserTimezone } from "@/lib/utils";

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

const getSeverityColor = (severity: string) => {
  switch(severity.toLowerCase()) {
    case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'major': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'minor': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  }
};

export default function Incidents() {
  const { user } = useAuth();
  const timezone = user?.timezone || getBrowserTimezone();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [archiveVendorFilter, setArchiveVendorFilter] = useState<string>("all");
  const [archiveDateRange, setArchiveDateRange] = useState<string>("all");

  const [showAiCopilotDialog, setShowAiCopilotDialog] = useState(false);
  const [selectedIncidentForAi, setSelectedIncidentForAi] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<{ subject: string; body: string; summary: string } | null>(null);
  const [aiAudience, setAiAudience] = useState<'client' | 'executive' | 'technical'>('client');

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const res = await fetch("/api/incidents");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: acknowledgements = [] } = useQuery<Acknowledgement[]>({
    queryKey: ["acknowledgements"],
    queryFn: async () => {
      const res = await fetch("/api/incidents/acknowledgements");
      if (!res.ok) throw new Error("Failed to fetch acknowledgements");
      return res.json();
    },
  });

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

  const isAcknowledged = (incidentId: string) => {
    return acknowledgements.some(a => a.incidentId === incidentId);
  };

  const getVendorName = (vendorKey: string) => {
    const vendor = vendors.find(v => v.key === vendorKey);
    return vendor?.name || vendorKey;
  };

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

  const filteredIncidents = [...incidents]
    .filter(i => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return i.title.toLowerCase().includes(term) || getVendorName(i.vendorKey).toLowerCase().includes(term);
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  if (incidentsLoading) {
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-incidents-title">Incidents</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base" data-testid="text-incidents-subtitle">Active incidents across all monitored vendors</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowArchiveDialog(true)}
            data-testid="button-view-archive"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archive
            {archiveCount?.count ? (
              <Badge variant="secondary" className="ml-2 text-xs">{archiveCount.count}</Badge>
            ) : null}
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search incidents by title or vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-incident-search"
        />
      </div>

      <Card className="border-sidebar-border bg-sidebar/10">
        <CardHeader className="border-b border-sidebar-border bg-sidebar/20">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              All Incidents
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Showing <span className="text-primary">{filteredIncidents.length}</span> incidents across all vendors (newest first)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="space-y-4">
            {filteredIncidents.length > 0 ? (
              filteredIncidents.map((incident) => (
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