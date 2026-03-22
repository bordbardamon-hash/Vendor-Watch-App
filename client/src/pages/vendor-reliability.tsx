import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LogoAvatar } from "@/components/ui/logo-avatar";
import { Loader2, TrendingUp, TrendingDown, Minus, Search, Trophy, Shield, AlertTriangle, Copy, Check } from "lucide-react";

interface LeaderboardEntry {
  vendorKey: string;
  vendorName: string;
  category: string;
  logoUrl: string | null;
  score: number;
  uptimeScore: number;
  mttrScore: number;
  frequencyScore: number;
  severityScore: number;
  uptimePercent: number;
  mttrHours: number | null;
  incidentFrequency30d: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  infoCount: number;
  badge: string;
  trend: string;
}

interface LeaderboardResponse {
  vendors: LeaderboardEntry[];
  total: number;
  page: number;
  pages: number;
}

function ScoreGaugeMini({ score }: { score: number }) {
  const radius = 24;
  const circ = 2 * Math.PI * radius;
  const arc = (score / 100) * circ;
  const color = score >= 90 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-sidebar-border" />
      <circle
        cx="30" cy="30" r={radius}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${arc} ${circ - arc}`}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
      />
      <text x="30" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (trend === "declining") return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

function BadgePill({ badge }: { badge: string }) {
  const cls =
    badge === "Highly Reliable"
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      : badge === "Moderate Risk"
      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
      : "bg-red-500/10 text-red-500 border-red-500/20";
  const icon =
    badge === "Highly Reliable" ? <Trophy className="w-3 h-3" /> :
    badge === "Moderate Risk" ? <Shield className="w-3 h-3" /> :
    <AlertTriangle className="w-3 h-3" />;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {icon}{badge}
    </span>
  );
}

const CATEGORIES = [
  "All Categories",
  "AI/ML",
  "Communication",
  "Cloud",
  "Database",
  "DevOps",
  "E-Commerce",
  "Finance",
  "Healthcare",
  "Identity",
  "IoT",
  "Monitoring",
  "Networking",
  "Payment",
  "Security",
  "Storage",
  "Other",
];

function CopySnippet() {
  const [copied, setCopied] = useState(false);
  const snippet = `<!-- VendorWatch Reliability Leaderboard -->
<iframe src="https://vendorwatch.app/vendor-reliability?embed=1"
  width="100%" height="500" frameborder="0"
  style="border-radius:12px;border:1px solid #333">
</iframe>`;
  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Embed this leaderboard</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={copy} data-testid="button-copy-embed">
          {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
        </Button>
      </div>
      <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{snippet}</pre>
    </div>
  );
}

export default function VendorReliability() {
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [page, setPage] = useState(1);

  // SEO: set page title and inject JSON-LD structured data
  useEffect(() => {
    const prev = document.title;
    document.title = "Vendor Reliability Scores — Real-Time Uptime & Incident Leaderboard | VendorWatch";

    // Add meta description
    let metaEl = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prevDesc = metaEl?.content ?? "";
    if (!metaEl) {
      metaEl = document.createElement("meta");
      metaEl.name = "description";
      document.head.appendChild(metaEl);
    }
    metaEl.content =
      "Real-time reliability scores for 400+ cloud, SaaS, and AI vendors. Ranked by uptime, MTTR, incident frequency, and severity. Updated nightly by VendorWatch.";

    return () => {
      document.title = prev;
      if (metaEl) metaEl.content = prevDesc;
    };
  }, []);

  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["/api/vendors/leaderboard", page, category],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (category !== "All Categories") params.set("category", category);
      const res = await fetch(`/api/vendors/leaderboard?${params}`);
      if (!res.ok) throw new Error("Failed to load leaderboard");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Inject JSON-LD ItemList structured data for SEO when data loads
  useEffect(() => {
    if (!data?.vendors?.length) return;
    const existingScript = document.getElementById("leaderboard-jsonld");
    if (existingScript) existingScript.remove();
    const script = document.createElement("script");
    script.id = "leaderboard-jsonld";
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Vendor Reliability Leaderboard — VendorWatch",
      "description": "Real-time reliability scores for 400+ cloud, SaaS, and AI vendors ranked by uptime, MTTR, incident frequency, and severity.",
      "url": "https://vendorwatch.app/vendor-reliability",
      "numberOfItems": data.total,
      "itemListElement": data.vendors.slice(0, 20).map((v, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": `${v.vendorName} Reliability Score`,
        "description": `${v.vendorName} has a reliability score of ${v.score}/100. Uptime: ${v.uptimePercent.toFixed(2)}%. Badge: ${v.badge}.`,
        "url": `https://vendorwatch.app/vendor-reliability`,
      })),
    });
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [data]);

  const filtered = (data?.vendors || []).filter(v =>
    search === "" || v.vendorName.toLowerCase().includes(search.toLowerCase())
  );

  if (isEmbed) {
    return (
      <div className="bg-background text-foreground min-h-0 p-4 font-sans">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="font-bold text-lg">Vendor Reliability Leaderboard</span>
          <span className="text-xs text-muted-foreground ml-auto">vendorwatch.app</span>
        </div>
        <EmbedTable vendors={filtered.slice(0, 20)} isLoading={isLoading} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
            <Trophy className="w-4 h-4" />
            Reliability Leaderboard
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Vendor Reliability Scores</h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-base">
            Real-time reliability scores for 400+ AI, cloud, and developer vendors. Powered by VendorWatch's 90-day weighted formula.
          </p>
        </div>

        {/* Score formula callout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Uptime", pct: "40%", color: "text-emerald-500", icon: "⬆" },
            { label: "MTTR", pct: "30%", color: "text-blue-500", icon: "⚡" },
            { label: "Frequency", pct: "20%", color: "text-amber-500", icon: "📊" },
            { label: "Severity", pct: "10%", color: "text-red-500", icon: "🔴" },
          ].map(c => (
            <div key={c.label} className="rounded-lg border border-sidebar-border bg-sidebar/20 px-4 py-3 text-center">
              <div className="text-xl mb-1">{c.icon}</div>
              <div className={`text-lg font-bold ${c.color}`}>{c.pct}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-leaderboard-search"
            />
          </div>
          <Select value={category} onValueChange={v => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-52" data-testid="select-leaderboard-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No scores calculated yet.</p>
            <p className="text-sm opacity-50 mt-1">Scores are generated nightly from live monitoring data.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-sidebar-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-sidebar/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold w-12">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Vendor</th>
                  <th className="px-4 py-3 text-center font-semibold">Score</th>
                  <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Badge</th>
                  <th className="px-4 py-3 text-right font-semibold hidden sm:table-cell">Uptime</th>
                  <th className="px-4 py-3 text-right font-semibold hidden lg:table-cell">MTTR</th>
                  <th className="px-4 py-3 text-right font-semibold hidden lg:table-cell">Incidents 30d</th>
                  <th className="px-4 py-3 text-center font-semibold hidden sm:table-cell">Trend</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => {
                  const rank = (page - 1) * 50 + i + 1;
                  return (
                    <tr
                      key={v.vendorKey}
                      className="border-t border-sidebar-border hover:bg-sidebar/30 transition-colors"
                      data-testid={`row-leaderboard-${v.vendorKey}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <LogoAvatar logoUrl={v.logoUrl} name={v.vendorName} size="sm" />
                          <div>
                            <div className="font-medium leading-tight" data-testid={`text-vendor-name-${v.vendorKey}`}>{v.vendorName}</div>
                            <div className="text-[10px] text-muted-foreground">{v.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ScoreGaugeMini score={v.score} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <BadgePill badge={v.badge} />
                      </td>
                      <td className="px-4 py-3 text-right text-xs hidden sm:table-cell" data-testid={`text-uptime-${v.vendorKey}`}>
                        {v.uptimePercent}%
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                        {v.mttrHours != null ? `${v.mttrHours}h` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden lg:table-cell">
                        {v.incidentFrequency30d}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <TrendIcon trend={v.trend} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} data-testid="button-leaderboard-prev">
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {data.page} of {data.pages}</span>
            <Button variant="outline" size="sm" disabled={page === data.pages} onClick={() => setPage(p => p + 1)} data-testid="button-leaderboard-next">
              Next
            </Button>
          </div>
        )}

        {/* Embed snippet */}
        <div className="mt-10">
          <CopySnippet />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Scores calculated from 90-day monitoring data · Updated nightly · <a href="https://vendorwatch.app" className="underline hover:text-foreground">VendorWatch</a>
        </p>
      </div>
    </div>
  );
}

function EmbedTable({ vendors, isLoading }: { vendors: LeaderboardEntry[]; isLoading: boolean }) {
  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="rounded-lg border border-sidebar-border overflow-hidden text-xs">
      <table className="w-full">
        <thead className="bg-sidebar/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Vendor</th>
            <th className="px-3 py-2 text-center">Score</th>
            <th className="px-3 py-2 text-left">Badge</th>
            <th className="px-3 py-2 text-right">Uptime</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v, i) => (
            <tr key={v.vendorKey} className="border-t border-sidebar-border">
              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{v.vendorName}</td>
              <td className="px-3 py-2 text-center font-bold">{v.score}</td>
              <td className="px-3 py-2"><BadgePill badge={v.badge} /></td>
              <td className="px-3 py-2 text-right">{v.uptimePercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
