import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import cytoscape, { Core, NodeSingular } from "cytoscape";
// @ts-ignore
import coseBilkent from "cytoscape-cose-bilkent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Activity, Share2, Code2, ZoomIn, ZoomOut, Maximize2, RefreshCw, ChevronRight, X, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

cytoscape.use(coseBilkent);

interface GraphNode {
  id: string;
  label: string;
  type: "vendor" | "blockchain";
  category: string;
  status: string;
  logoUrl: string | null;
  downstreamCount: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  confidence: number;
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface BlastRadiusResult {
  upstreamNode: GraphNode | null;
  affected: GraphNode[];
  severity: "Low" | "Medium" | "High";
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  hosted_on: "Hosted on",
  uses_rpc: "Uses RPC",
  uses_auth: "Uses Auth",
  uses_cdn: "Uses CDN",
  uses_api: "Uses API",
};

const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Confirmed",
  2: "Inferred",
  3: "Community",
};

const STATUS_COLORS: Record<string, string> = {
  operational: "#22c55e",
  degraded_performance: "#f59e0b",
  partial_outage: "#f97316",
  major_outage: "#ef4444",
  unknown: "#94a3b8",
};

const NODE_COLORS: Record<string, string> = {
  vendor: "#3b82f6",
  blockchain: "#8b5cf6",
  chain: "#8b5cf6",
  rpc_provider: "#a855f7",
  wallet: "#ec4899",
  defi: "#6366f1",
  nft: "#14b8a6",
  l2: "#7c3aed",
};

function getNodeColor(node: GraphNode): string {
  if (node.category && NODE_COLORS[node.category]) return NODE_COLORS[node.category];
  return node.type === "vendor" ? NODE_COLORS.vendor : NODE_COLORS.blockchain;
}

function getSeverityColor(severity: string) {
  if (severity === "High") return "text-red-500 bg-red-50 border-red-200";
  if (severity === "Medium") return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-green-600 bg-green-50 border-green-200";
}

export default function DependencyMap() {
  const cyRef = useRef<Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blastResultsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [blastRadius, setBlastRadius] = useState<BlastRadiusResult | null>(null);
  const [blastLoading, setBlastLoading] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "vendor" | "blockchain">("all");
  const [filterRelationship, setFilterRelationship] = useState<string>("all");
  const [showSuggestDialog, setShowSuggestDialog] = useState(false);
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  // Suggestion form state
  const [suggUpstream, setSuggUpstream] = useState("");
  const [suggUpstreamType, setSuggUpstreamType] = useState<"vendor" | "blockchain">("vendor");
  const [suggDownstream, setSuggDownstream] = useState("");
  const [suggDownstreamType, setSuggDownstreamType] = useState<"vendor" | "blockchain">("vendor");
  const [suggRel, setSuggRel] = useState("hosted_on");
  const [suggNotes, setSuggNotes] = useState("");

  const { data: graph, isLoading } = useQuery<GraphResponse>({
    queryKey: ["/api/dependency-map"],
    staleTime: 60_000,
  });

  const submitSuggestion = useMutation({
    mutationFn: async (body: object) => apiRequest("POST", "/api/dependency-map/suggestions", body),
    onSuccess: () => {
      toast({ title: "Suggestion submitted", description: "We'll review it soon." });
      setShowSuggestDialog(false);
      setSuggUpstream(""); setSuggDownstream(""); setSuggNotes("");
    },
    onError: () => toast({ title: "Error", description: "Could not submit suggestion.", variant: "destructive" }),
  });

  const fetchBlastRadius = useCallback(async (nodeId: string) => {
    setBlastLoading(true);
    try {
      const res = await fetch(`/api/dependency-map/blast-radius/${nodeId}`);
      const data: BlastRadiusResult = await res.json();
      setBlastRadius(data);
    } catch {
      toast({ title: "Error", description: "Could not fetch blast radius.", variant: "destructive" });
    } finally {
      setBlastLoading(false);
    }
  }, [toast]);

  // Build Cytoscape graph
  useEffect(() => {
    if (!graph || !containerRef.current) return;

    const filteredNodes = graph.nodes.filter(n =>
      filterType === "all" ? true : n.type === filterType
    );
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = graph.edges.filter(e =>
      nodeIds.has(e.source) && nodeIds.has(e.target) &&
      (filterRelationship === "all" ? true : e.relationship === filterRelationship)
    );

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...filteredNodes.map(n => ({
          data: {
            id: n.id,
            label: n.label,
            nodeType: n.type,
            category: n.category,
            status: n.status,
            downstreamCount: n.downstreamCount,
            color: getNodeColor(n),
            statusColor: STATUS_COLORS[n.status] || STATUS_COLORS.unknown,
          },
        })),
        ...filteredEdges.map(e => ({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            relationship: e.relationship,
            confidence: e.confidence,
            label: RELATIONSHIP_LABELS[e.relationship] || e.relationship,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)" as any,
            "border-color": "data(statusColor)" as any,
            "border-width": 3,
            label: "data(label)",
            "text-valign": "bottom",
            "text-halign": "center",
            "font-size": 10,
            "font-weight": "600",
            color: "#1e293b",
            "text-margin-y": 5,
            "text-max-width": "80px" as any,
            "text-wrap": "ellipsis" as any,
            width: (ele: NodeSingular) => {
              const count = ele.data("downstreamCount") as number;
              return Math.max(32, Math.min(56, 24 + count * 5));
            },
            height: (ele: NodeSingular) => {
              const count = ele.data("downstreamCount") as number;
              return Math.max(32, Math.min(56, 24 + count * 5));
            },
            shape: "ellipse",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#f59e0b" as any,
            "border-width": 4,
            "background-color": "data(color)" as any,
          },
        },
        {
          selector: "edge",
          style: {
            width: (ele: any) => (ele.data("confidence") === 1 ? 2 : 1.5),
            "line-color": (ele: any) => (ele.data("confidence") === 1 ? "#475569" : "#94a3b8"),
            "line-style": (ele: any) => (ele.data("confidence") === 3 ? "dashed" : "solid"),
            "target-arrow-color": (ele: any) => (ele.data("confidence") === 1 ? "#475569" : "#94a3b8"),
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 9,
            color: "#64748b",
            "text-rotation": "autorotate",
            "text-margin-y": -8,
            opacity: 0.8,
          },
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#f59e0b" as any,
            "target-arrow-color": "#f59e0b" as any,
            width: 3,
            opacity: 1,
          },
        },
        {
          selector: ".highlighted",
          style: {
            "border-color": "#ef4444" as any,
            "border-width": 4,
            "background-color": "#fef2f2" as any,
          },
        },
        {
          selector: ".blast-edge",
          style: {
            "line-color": "#ef4444" as any,
            "target-arrow-color": "#ef4444" as any,
            width: 2.5,
            opacity: 1,
          },
        },
      ],
      layout: {
        name: "cose-bilkent",
        animate: true,
        animationDuration: 800,
        nodeRepulsion: 18000,
        idealEdgeLength: 180,
        edgeElasticity: 0.25,
        nestingFactor: 0.1,
        gravity: 0.20,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 40,
        tilingPaddingHorizontal: 40,
        gravityRangeCompound: 1.5,
        gravityCompound: 1.0,
        gravityRange: 2.0,
        initialEnergyOnIncremental: 0.3,
      } as any,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom: 0.2,
      maxZoom: 3,
    });

    cy.on("tap", "node", (evt) => {
      const nodeId = evt.target.id();
      const node = graph.nodes.find(n => n.id === nodeId) || null;
      setSelectedNode(node);
      setBlastRadius(null);
      // Clear highlights
      cy.elements().removeClass("highlighted blast-edge");
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        setBlastRadius(null);
        cy.elements().removeClass("highlighted blast-edge");
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph, filterType, filterRelationship]);

  // Scroll blast results into view when they appear
  useEffect(() => {
    if (blastRadius && blastResultsRef.current) {
      blastResultsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [blastRadius]);

  // Highlight blast radius on the graph when blastRadius changes
  useEffect(() => {
    if (!cyRef.current || !blastRadius) return;
    const cy = cyRef.current;
    cy.elements().removeClass("highlighted blast-edge");
    blastRadius.affected.forEach(n => {
      cy.getElementById(n.id).addClass("highlighted");
    });
    if (blastRadius.upstreamNode) {
      cy.getElementById(blastRadius.upstreamNode.id).addClass("highlighted");
    }
    cy.edges().forEach(e => {
      if (
        blastRadius.upstreamNode?.id === e.data("source") ||
        blastRadius.affected.some(n => n.id === e.data("source"))
      ) {
        e.addClass("blast-edge");
      }
    });
  }, [blastRadius]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
  const handleFit = () => cyRef.current?.fit(undefined, 40);

  const handleAnalyzeBlastRadius = () => {
    if (selectedNode) fetchBlastRadius(selectedNode.id);
  };

  const handleCopyEmbed = () => {
    const snippet = `<iframe src="${window.location.origin}/dependency-map?embed=1" width="100%" height="600" frameborder="0" style="border-radius:12px;border:1px solid #e2e8f0;" title="Cross-Chain / Cross-Vendor Dependency Map by VendorWatch"></iframe>`;
    navigator.clipboard.writeText(snippet);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  };

  const handleShareBlast = () => {
    if (!blastRadius?.upstreamNode) return;
    const url = `${window.location.origin}/dependency-map?blast=${blastRadius.upstreamNode.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: "Blast radius link copied to clipboard." });
  };

  // Auto-run blast radius if ?blast= param is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const blastId = params.get("blast");
    if (blastId && graph) {
      const node = graph.nodes.find(n => n.id === blastId);
      if (node) {
        setSelectedNode(node);
        fetchBlastRadius(blastId);
      }
    }
  }, [graph, fetchBlastRadius]);

  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1";

  return (
    <div className={`flex flex-col ${isEmbed ? "h-screen" : "min-h-screen"} bg-slate-50`}>
      {!isEmbed && (
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-violet-600" />
                Cross-Chain / Cross-Vendor Dependency Map
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Visualize how vendors and blockchains depend on each other — click any node to analyze blast radius.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Dialog open={showSuggestDialog} onOpenChange={setShowSuggestDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-suggest-dependency">
                    <Info className="w-3.5 h-3.5 mr-1.5" /> Suggest Dependency
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Suggest a Dependency</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Upstream (provider)</label>
                        <Input
                          value={suggUpstream}
                          onChange={e => setSuggUpstream(e.target.value)}
                          placeholder="e.g. aws"
                          data-testid="input-upstream-id"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Type</label>
                        <select
                          value={suggUpstreamType}
                          onChange={e => setSuggUpstreamType(e.target.value as any)}
                          data-testid="select-upstream-type"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="vendor">Vendor</option>
                          <option value="blockchain">Blockchain</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Downstream (dependent)</label>
                        <Input
                          value={suggDownstream}
                          onChange={e => setSuggDownstream(e.target.value)}
                          placeholder="e.g. netlify"
                          data-testid="input-downstream-id"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Type</label>
                        <select
                          value={suggDownstreamType}
                          onChange={e => setSuggDownstreamType(e.target.value as any)}
                          data-testid="select-downstream-type"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="vendor">Vendor</option>
                          <option value="blockchain">Blockchain</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Relationship</label>
                      <select
                        value={suggRel}
                        onChange={e => setSuggRel(e.target.value)}
                        data-testid="select-relationship"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Notes (optional)</label>
                      <Textarea
                        value={suggNotes}
                        onChange={e => setSuggNotes(e.target.value)}
                        placeholder="Source or reasoning…"
                        rows={2}
                        data-testid="textarea-suggestion-notes"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => submitSuggestion.mutate({
                        upstreamId: suggUpstream.trim(),
                        upstreamType: suggUpstreamType,
                        downstreamId: suggDownstream.trim(),
                        downstreamType: suggDownstreamType,
                        relationship: suggRel,
                        notes: suggNotes.trim() || undefined,
                      })}
                      disabled={!suggUpstream || !suggDownstream || submitSuggestion.isPending}
                      data-testid="button-submit-suggestion"
                    >
                      {submitSuggestion.isPending ? "Submitting…" : "Submit Suggestion"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showEmbedDialog} onOpenChange={setShowEmbedDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-embed-map">
                    <Code2 className="w-3.5 h-3.5 mr-1.5" /> Embed
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Embed This Map</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-slate-600 mb-2">
                    Add this interactive dependency map to your own site or docs:
                  </p>
                  <pre className="bg-slate-100 rounded-lg p-3 text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-all">
{`<iframe src="${window.location.origin}/dependency-map?embed=1" width="100%" height="600" frameborder="0" style="border-radius:12px;border:1px solid #e2e8f0;" title="Cross-Chain / Cross-Vendor Dependency Map by VendorWatch"></iframe>`}
                  </pre>
                  <Button onClick={handleCopyEmbed} className="mt-2" data-testid="button-copy-embed">
                    {embedCopied ? "Copied!" : "Copy Snippet"}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Graph area */}
        <div className="flex-1 flex flex-col relative">
          {/* Toolbar */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white rounded-lg shadow border border-slate-200 px-2 py-1.5">
            <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
              <SelectTrigger className="h-7 text-xs w-32 border-0 shadow-none focus:ring-0" data-testid="select-filter-type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All nodes</SelectItem>
                <SelectItem value="vendor">Vendors only</SelectItem>
                <SelectItem value="blockchain">Blockchain only</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-px h-5 bg-slate-200" />
            <Select value={filterRelationship} onValueChange={setFilterRelationship}>
              <SelectTrigger className="h-7 text-xs w-36 border-0 shadow-none focus:ring-0" data-testid="select-filter-relationship">
                <SelectValue placeholder="All edges" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All edges</SelectItem>
                {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn} data-testid="button-zoom-in">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut} data-testid="button-zoom-out">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleFit} data-testid="button-fit-graph">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-20 bg-white rounded-lg shadow border border-slate-200 p-2.5 text-xs space-y-1.5">
            <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide">Legend</p>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: NODE_COLORS.vendor }} />
              <span className="text-slate-600">Vendor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: NODE_COLORS.blockchain }} />
              <span className="text-slate-600">Blockchain/RPC</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] inline-block bg-slate-500" />
              <span className="text-slate-600">Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-[2px] inline-block bg-slate-400" style={{ borderTop: "2px dashed #94a3b8" }} />
              <span className="text-slate-600">Community</span>
            </div>
            <div className="border-t border-slate-100 pt-1 text-[10px] text-slate-500">
              Border = live status | Size = dependents
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-50/80">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-2" />
                <p className="text-sm text-slate-600">Building dependency graph…</p>
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className="flex-1 w-full"
            data-testid="cytoscape-container"
            style={{ minHeight: 400 }}
          />
        </div>

        {/* Side panel */}
        {selectedNode && (
          <div className="w-80 border-l border-slate-200 bg-white flex flex-col overflow-y-auto" data-testid="panel-node-details">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="font-semibold text-slate-900 text-sm">{selectedNode.label}</span>
              <button
                onClick={() => { setSelectedNode(null); setBlastRadius(null); }}
                className="text-slate-400 hover:text-slate-700"
                data-testid="button-close-panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Node meta */}
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="capitalize" data-testid="badge-node-type">
                  {selectedNode.type}
                </Badge>
                <Badge variant="outline" className="capitalize" data-testid="badge-node-category">
                  {selectedNode.category}
                </Badge>
                <Badge
                  className="capitalize"
                  style={{
                    background: STATUS_COLORS[selectedNode.status] + "22",
                    color: STATUS_COLORS[selectedNode.status],
                    borderColor: STATUS_COLORS[selectedNode.status] + "55",
                  }}
                  data-testid="badge-node-status"
                >
                  {selectedNode.status.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">{selectedNode.downstreamCount}</span>{" "}
                {selectedNode.downstreamCount === 1 ? "service depends" : "services depend"} on this node.
              </div>

              {/* Blast Radius CTA */}
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Blast Radius Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-amber-700">
                    If <strong>{selectedNode.label}</strong> goes down, what breaks?
                  </p>
                  <Button
                    size="sm"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleAnalyzeBlastRadius}
                    disabled={blastLoading}
                    data-testid="button-analyze-blast-radius"
                  >
                    {blastLoading ? (
                      <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analyzing…</>
                    ) : (
                      <><Activity className="w-3.5 h-3.5 mr-1.5" /> Run Analysis</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Blast Radius Results */}
              {blastRadius && (
                <div ref={blastResultsRef} className="space-y-3" data-testid="blast-radius-results">
                  <div className={`rounded-lg border px-3 py-2 flex items-center justify-between ${getSeverityColor(blastRadius.severity)}`}>
                    <span className="text-sm font-semibold">Severity: {blastRadius.severity}</span>
                    <span className="text-lg font-bold">{blastRadius.affected.length}</span>
                  </div>

                  {blastRadius.affected.length === 0 ? (
                    <p className="text-sm text-slate-500">No downstream dependents found in the map.</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Affected Services</p>
                      {blastRadius.affected.map(n => (
                        <div
                          key={n.id}
                          className="flex items-center gap-2 p-2 rounded-md bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                          onClick={() => {
                            setSelectedNode(n);
                            setBlastRadius(null);
                          }}
                          data-testid={`blast-affected-${n.id}`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: STATUS_COLORS[n.status] || STATUS_COLORS.unknown }}
                          />
                          <span className="text-sm text-slate-700 font-medium flex-1">{n.label}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleShareBlast}
                    data-testid="button-share-blast-radius"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share This Analysis
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
