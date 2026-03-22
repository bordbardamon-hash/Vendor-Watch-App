import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Activity, RefreshCw, Share2, Code2, ExternalLink, Clock, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────
interface SummaryIncident {
  id: string; source: "chain" | "vendor"; key: string; name: string;
  title: string; severity: string; status: string; startedAt: string;
}
interface ChainStatus {
  key: string; name: string; symbol: string | null; logoUrl: string | null;
  tier: string; category: string; status: string; avgBlockTime: number | null;
  lastBlockTime: string | null; activeIncidents: number; lastChecked: string | null;
}
interface InfraVendor { key: string; name: string; logoUrl: string | null; status: string; category: string; }
interface Web3Summary {
  verdict: string; verdictColor: "green" | "yellow" | "orange" | "red";
  chainsMonitored: number; vendorsMonitored: number;
  activeIncidents: number; criticalCount: number; majorCount: number; minorCount: number;
  lastUpdated: string; incidents: SummaryIncident[]; chains: ChainStatus[]; infraVendors: InfraVendor[];
}
interface TrendDay { date: string; chainCount: number; vendorCount: number; total: number; }

// ── Constants ─────────────────────────────────────────────────────────
const VERDICT_STYLES = {
  green:  { bg: "bg-green-500",  border: "border-green-400",  text: "text-white", glow: "shadow-green-400/40" },
  yellow: { bg: "bg-amber-400",  border: "border-amber-300",  text: "text-amber-950", glow: "shadow-amber-400/40" },
  orange: { bg: "bg-orange-500", border: "border-orange-400", text: "text-white", glow: "shadow-orange-400/40" },
  red:    { bg: "bg-red-600",    border: "border-red-500",     text: "text-white", glow: "shadow-red-500/50" },
};

const STATUS_DOT: Record<string, string> = {
  operational: "bg-green-500",
  degraded: "bg-amber-400",
  degraded_performance: "bg-amber-400",
  partial_outage: "bg-orange-500",
  major_outage: "bg-red-600",
  outage: "bg-red-600",
  unknown: "bg-slate-400",
};

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  major:    "bg-orange-100 text-orange-700 border-orange-200",
  minor:    "bg-amber-100 text-amber-700 border-amber-200",
  info:     "bg-slate-100 text-slate-600 border-slate-200",
};

type ChainFilter = "all" | "chain" | "l2" | "infra";

function statusDot(status: string) {
  return STATUS_DOT[status] || STATUS_DOT.unknown;
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────
export default function Web3Health() {
  const [, setLocation] = useLocation();
  const [chainFilter, setChainFilter] = useState<ChainFilter>("all");
  const [countdown, setCountdown] = useState(60);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [showEmbedDialog, setShowEmbedDialog] = useState(false);

  const { data: summary, isLoading, refetch } = useQuery<Web3Summary>({
    queryKey: ["/api/web3-health/summary"],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: trendData } = useQuery<{ trend: TrendDay[] }>({
    queryKey: ["/api/web3-health/trend"],
    staleTime: 60_000,
  });

  // Countdown timer
  useEffect(() => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { setCountdown(60); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [summary?.lastUpdated]);

  // SEO meta tags
  useEffect(() => {
    document.title = "Is Web3 Down? Blockchain Network Health Dashboard | VendorWatch";
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) { desc = document.createElement("meta"); desc.setAttribute("name", "description"); document.head.appendChild(desc); }
    desc.setAttribute("content", "Real-time health status of Ethereum, Solana, Bitcoin, and 55+ blockchain networks plus Web3 infrastructure. Is web3 down? Find out instantly.");
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.setAttribute("rel", "canonical"); document.head.appendChild(canonical); }
    canonical.setAttribute("href", `${window.location.origin}/web3-health`);
  }, []);

  const vs = summary ? (VERDICT_STYLES[summary.verdictColor] || VERDICT_STYLES.green) : VERDICT_STYLES.green;

  const filteredChains = summary?.chains.filter(c => {
    if (chainFilter === "all") return ["chain", "l2"].includes(c.category);
    if (chainFilter === "chain") return c.category === "chain";
    if (chainFilter === "l2") return c.category === "l2";
    return false;
  }) || [];

  const trend = trendData?.trend || [];

  const handleShare = async () => {
    const url = `${window.location.origin}/web3-health`;
    const text = summary ? `Web3 Status: ${summary.verdict} — ${summary.activeIncidents} active incidents across ${summary.chainsMonitored} chains | VendorWatch` : "Check the live Web3 health dashboard";
    if (navigator.share) {
      await navigator.share({ title: "Is Web3 Down?", text, url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const embedSnippet = `<iframe src="${window.location.origin}/web3-health/widget" width="400" height="300" frameborder="0" style="border-radius:12px;border:1px solid #e2e8f0;" title="Web3 Health Status by VendorWatch"></iframe>`;

  return (
    <div className="text-slate-100">
      <div className="max-w-screen-xl mx-auto px-4 pt-4 pb-2">
        <button
          onClick={() => setLocation("/blockchain")}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4"
          data-testid="button-back-blockchain"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blockchain
        </button>
      </div>

      {/* ── Hero verdict ─────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 pb-4">
        <div className={`rounded-2xl py-8 px-6 ${vs.bg} ${vs.glow} shadow-xl text-center`}>
          {isLoading ? (
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin opacity-60" />
              <span className="text-xl font-bold opacity-60">Checking web3 health…</span>
            </div>
          ) : (
            <>
              <h1 className={`text-3xl md:text-5xl font-black tracking-tight ${vs.text} mb-2`} data-testid="verdict-text">
                {summary?.verdict || "All Systems Healthy"}
              </h1>
              <p className={`text-base md:text-lg font-medium ${vs.text} opacity-80 mb-1`}>
                Is web3 down? Based on{" "}
                <strong>{summary?.chainsMonitored ?? "—"} blockchains</strong> and{" "}
                <strong>{summary?.vendorsMonitored ?? "—"} vendors</strong> monitored by VendorWatch
              </p>
              <div className={`flex items-center justify-center gap-4 mt-3 ${vs.text} opacity-70 text-sm`}>
                <span data-testid="active-incident-count">
                  {summary?.activeIncidents ?? 0} active incident{summary?.activeIncidents !== 1 ? "s" : ""}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Refreshing in {countdown}s
                </span>
                <span>·</span>
                <button onClick={() => refetch()} className="underline underline-offset-2 hover:opacity-100">
                  Refresh now
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-8 space-y-10">
        {/* Share / Embed row */}
        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={handleShare} className="border-slate-700 text-slate-300 hover:text-white" data-testid="button-share">
            <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share Status
          </Button>
          <Dialog open={showEmbedDialog} onOpenChange={setShowEmbedDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white" data-testid="button-embed-widget">
                <Code2 className="w-3.5 h-3.5 mr-1.5" /> Embed Widget
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
              <DialogHeader><DialogTitle>Embed Web3 Health Widget</DialogTitle></DialogHeader>
              <p className="text-sm text-slate-400 mb-2">Add this live status widget to your site or documentation:</p>
              <pre className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                {embedSnippet}
              </pre>
              <Button
                onClick={() => { navigator.clipboard.writeText(embedSnippet); setEmbedCopied(true); setTimeout(() => setEmbedCopied(false), 2000); }}
                className="mt-2"
                data-testid="button-copy-embed"
              >
                {embedCopied ? "Copied!" : "Copy Snippet"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Blockchain health grid ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-bold text-white">Blockchain Health</h2>
            <div className="flex gap-1.5" data-testid="chain-filter-tabs">
              {(["all", "chain", "l2"] as ChainFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setChainFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    chainFilter === f
                      ? "bg-violet-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                  data-testid={`filter-tab-${f}`}
                >
                  {f === "all" ? "All" : f === "chain" ? "L1 Chains" : "L2 Networks"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" data-testid="chain-grid">
            {filteredChains.map(chain => (
              <div
                key={chain.key}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 hover:border-slate-600 transition-colors"
                data-testid={`chain-card-${chain.key}`}
              >
                <div className="flex items-center gap-2">
                  {chain.logoUrl ? (
                    <img src={chain.logoUrl} alt={chain.name} className="w-6 h-6 rounded-full object-contain bg-slate-800" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      {(chain.symbol || chain.name).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="font-semibold text-xs text-slate-200 truncate">{chain.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(chain.status)}`} />
                  <span className="text-[11px] text-slate-400 capitalize truncate">
                    {chain.status.replace(/_/g, " ")}
                  </span>
                </div>

                {chain.avgBlockTime && (
                  <div className="text-[10px] text-slate-500">
                    ~{chain.avgBlockTime}s block time
                  </div>
                )}

                {chain.activeIncidents > 0 && (
                  <div className="text-[11px] font-semibold text-red-400">
                    {chain.activeIncidents} incident{chain.activeIncidents !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            ))}
            {filteredChains.length === 0 && (
              <div className="col-span-full text-slate-500 text-sm py-8 text-center">
                No chains match this filter.
              </div>
            )}
          </div>
        </section>

        {/* ── Web3 Infrastructure Strip ──────────────────────────── */}
        {summary?.infraVendors && summary.infraVendors.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Web3 Infrastructure</h2>
            <div className="flex flex-wrap gap-2" data-testid="infra-strip">
              {summary.infraVendors.map(v => (
                <div
                  key={v.key}
                  className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1.5 hover:border-slate-600 transition-colors"
                  data-testid={`infra-pill-${v.key}`}
                >
                  {v.logoUrl ? (
                    <img src={v.logoUrl} alt={v.name} className="w-4 h-4 rounded-full object-contain" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-slate-400">
                      {v.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="text-xs font-medium text-slate-300">{v.name}</span>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(v.status)}`} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Main content: Trend + Incident feed ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trend chart (2/3 width) */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-white mb-4">30-Day Incident Trend</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4" data-testid="trend-chart">
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="vendorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#1e293b" }}
                      interval={6}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                      labelFormatter={formatDate}
                      formatter={(val: any, name: string) => [val, name === "chainCount" ? "Chain incidents" : "Vendor incidents"]}
                    />
                    {/* Color bands */}
                    <ReferenceLine y={2} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.3} />
                    <ReferenceLine y={5} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.3} />
                    <Area type="monotone" dataKey="chainCount" stackId="1" stroke="#8b5cf6" fill="url(#chainGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="vendorCount" stackId="1" stroke="#3b82f6" fill="url(#vendorGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading trend data…
                </div>
              )}
              <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-500 inline-block" /> Chain incidents</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Vendor incidents</span>
                <span className="flex items-center gap-1 ml-auto"><span className="text-green-500">──</span> Normal ≤2/day</span>
                <span className="flex items-center gap-1"><span className="text-amber-500">──</span> Elevated ≤5/day</span>
              </div>
            </div>
          </div>

          {/* Live incident feed (1/3 width) */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Live Incidents</h2>
              <a href="/outages" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                View all <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" data-testid="incident-feed">
              {isLoading ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" /> Loading…
                </div>
              ) : (summary?.incidents?.length ?? 0) === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-green-900/40 flex items-center justify-center mx-auto mb-2">
                    <Activity className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-green-400 font-semibold text-sm">No active incidents</p>
                  <p className="text-slate-500 text-xs mt-1">All systems nominal</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 max-h-[340px] overflow-y-auto">
                  {summary!.incidents.slice(0, 20).map(inc => (
                    <div key={inc.id} className="p-3 hover:bg-slate-800/50 transition-colors" data-testid={`incident-${inc.id}`}>
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          inc.severity === "critical" ? "bg-red-500" :
                          inc.severity === "major" ? "bg-orange-500" : "bg-amber-400"
                        }`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-200 truncate">{inc.name}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SEV_BADGE[inc.severity] || SEV_BADGE.info}`}>
                              {inc.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{inc.title}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{timeAgo(inc.startedAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SEO footer copy ────────────────────────────────────── */}
        <section className="border-t border-slate-800 pt-8 pb-4">
          <div className="max-w-3xl">
            <h2 className="text-lg font-bold text-white mb-2">About This Dashboard</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              VendorWatch's <strong className="text-slate-300">Is Web3 Down?</strong> dashboard monitors real-time health
              across {summary?.chainsMonitored ?? "55+"} blockchain networks — including Ethereum, Bitcoin, Solana, Polygon,
              Arbitrum, Optimism, Base, and more — plus key Web3 infrastructure providers like Infura, Alchemy,
              and QuickNode. Data refreshes every 60 seconds. When you need to know if web3 is down, this is your
              single source of truth.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
