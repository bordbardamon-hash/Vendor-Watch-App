import { useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LogoAvatar } from "@/components/ui/logo-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, Activity,
  Users, ArrowLeft, ExternalLink, Bell, TrendingUp, TrendingDown, Minus,
  Shield, Zap, CalendarDays,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const HOST = "https://vendorwatch.app";

interface VendorProfile {
  vendor: {
    key: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    category?: string | null;
    status: string;
    lastChecked?: string | null;
  };
  score: {
    score: number;
    badge: string;
    trend: string;
    uptimeScore: number;
    mttrHours: number | null;
    criticalCount: number;
    majorCount: number;
    incidentFrequency30d: number;
  } | null;
  uptime: { uptime30: number; uptime90: number; uptime365: number };
  monitorCount: number;
  incidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    startedAt: string;
    resolvedAt: string | null;
    duration: number | null;
    ongoing: boolean;
  }>;
  uptimeGrid: Array<{ date: string; status: string; titles: string[] }>;
}

interface RelatedVendor {
  key: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  category?: string | null;
  status: string;
  score?: number | null;
}

function statusColor(status: string) {
  if (status === "operational") return "text-emerald-400";
  if (status === "degraded" || status === "incident") return "text-amber-400";
  return "text-red-400";
}

function statusLabel(status: string) {
  if (status === "operational") return "Operational";
  if (status === "degraded") return "Degraded";
  if (status === "incident") return "Incident";
  return "Outage";
}

function StatusIcon({ status, size = 5 }: { status: string; size?: number }) {
  const cls = `h-${size} w-${size}`;
  if (status === "operational") return <CheckCircle2 className={`${cls} text-emerald-400`} />;
  if (status === "degraded" || status === "incident") return <AlertTriangle className={`${cls} text-amber-400`} />;
  return <XCircle className={`${cls} text-red-400`} />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-500/20 text-red-300 border-red-500/30",
    major: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    minor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    info: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${map[severity] || map.info}`}>
      {severity}
    </span>
  );
}

function GridCell({ day }: { day: { date: string; status: string; titles: string[] } }) {
  const color =
    day.status === "operational"
      ? "bg-emerald-500/70 hover:bg-emerald-500"
      : day.status === "degraded"
      ? "bg-amber-500/70 hover:bg-amber-500"
      : day.status === "incident"
      ? "bg-amber-400/70 hover:bg-amber-400"
      : "bg-red-500/70 hover:bg-red-500";

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`h-4 w-4 rounded-sm cursor-default transition-colors ${color}`}
            data-testid={`grid-day-${day.date}`}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium text-xs">{format(new Date(day.date), "MMM d, yyyy")}</p>
          {day.titles.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {day.titles.slice(0, 3).map((t, i) => (
                <li key={i} className="text-xs text-slate-400">{t}</li>
              ))}
              {day.titles.length > 3 && (
                <li className="text-xs text-slate-500">+{day.titles.length - 3} more</li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">No incidents</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" data-testid="score-gauge">
      <svg width={72} height={72} className="-rotate-90">
        <circle cx={36} cy={36} r={radius} fill="none" stroke="#1e293b" strokeWidth={6} />
        <circle
          cx={36} cy={36} r={radius} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }} data-testid="score-value">
        {score}
      </span>
    </div>
  );
}

export default function VendorProfile() {
  const [, params] = useRoute("/vendors/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug || "";

  const { data, isLoading, isError } = useQuery<VendorProfile>({
    queryKey: ["/api/public/vendors", slug],
    queryFn: () => apiRequest("GET", `/api/public/vendors/${slug}`).then(r => r.json()),
    enabled: !!slug,
    retry: 1,
  });

  const { data: relatedRaw } = useQuery<{ vendors: RelatedVendor[] }>({
    queryKey: ["/api/public/vendors/related", data?.vendor.category],
    queryFn: () =>
      apiRequest("GET", `/api/public/vendors?category=${encodeURIComponent(data!.vendor.category || "")}&limit=5`).then(r => r.json()),
    enabled: !!data?.vendor.category,
  });

  const related = (relatedRaw?.vendors || [])
    .filter(v => v.key !== data?.vendor.key)
    .slice(0, 4);

  // Meta / SEO — inject into <head>
  const canonicalRef = useRef<HTMLLinkElement | null>(null);
  const descRef = useRef<HTMLMetaElement | null>(null);

  useEffect(() => {
    if (!data) return;
    const v = data.vendor;
    const title = `${v.name} Status, Reliability Score & Incident History | VendorWatch`;
    document.title = title;

    // og:title
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);

    const desc = `Live status and reliability score for ${v.name}. View uptime history, incident reports, and MTTR. Monitored by VendorWatch for MSPs.`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", desc);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", desc);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", desc);

    const canonicalUrl = `${HOST}/vendors/${v.slug}`;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
      canonicalRef.current = link;
    }
    link.href = canonicalUrl;
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonicalUrl);

    return () => {
      document.title = "VendorWatch";
      if (canonicalRef.current) canonicalRef.current.remove();
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Vendor not found</h1>
        <p className="text-slate-400 mb-6">We couldn't find a vendor with that URL.</p>
        <Button variant="outline" onClick={() => navigate("/vendors")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to all vendors
        </Button>
      </div>
    );
  }

  const { vendor, score, uptime, monitorCount, incidents, uptimeGrid } = data;

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${vendor.name} Status & Reliability`,
    "description": `Live status and reliability score for ${vendor.name}. View uptime history, incident reports, and MTTR. Monitored by VendorWatch for MSPs.`,
    "url": `${HOST}/vendors/${vendor.slug}`,
  };

  const mttrDisplay = score?.mttrHours != null
    ? score.mttrHours < 1
      ? `${Math.round(score.mttrHours * 60)}m`
      : `${score.mttrHours}h`
    : "—";

  const incidents90 = (score?.criticalCount ?? 0) + (score?.majorCount ?? 0);

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Back link */}
        <button
          onClick={() => navigate("/vendors")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          data-testid="link-back-vendors"
        >
          <ArrowLeft className="h-4 w-4" /> All vendors
        </button>

        {/* ── Hero ── */}
        <Card className="border-slate-800 bg-sidebar">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {/* Logo */}
              <div className="shrink-0">
                {vendor.logoUrl ? (
                  <img
                    src={vendor.logoUrl}
                    alt={`${vendor.name} logo`}
                    className="h-16 w-16 rounded-xl object-contain bg-slate-900 p-1"
                    data-testid="img-vendor-logo"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <LogoAvatar name={vendor.name} size="lg" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {vendor.category && (
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                      {vendor.category}
                    </Badge>
                  )}
                </div>
                {/* Single H1 with vendor name */}
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2" data-testid="text-vendor-name">
                  {vendor.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className={`flex items-center gap-1.5 font-medium ${statusColor(vendor.status)}`} data-testid="status-current">
                    <StatusIcon status={vendor.status} size={4} />
                    {statusLabel(vendor.status)}
                  </span>
                  {vendor.lastChecked && (
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Updated {formatDistanceToNow(new Date(vendor.lastChecked), { addSuffix: true })}
                    </span>
                  )}
                  <span className="text-slate-500 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {monitorCount.toLocaleString()} monitoring
                  </span>
                </div>
              </div>

              {/* CTA */}
              <div className="shrink-0">
                <Button
                  onClick={() => navigate("/signup")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  data-testid="button-monitor-vendor"
                >
                  <Bell className="h-4 w-4 mr-2" /> Monitor this vendor
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Reliability Snapshot (4 stat cards) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Score */}
          <Card className="border-slate-800 bg-sidebar" data-testid="card-reliability-score">
            <CardContent className="pt-5 pb-5 flex flex-col items-center text-center gap-2">
              <ScoreGauge score={score?.score ?? 0} />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Reliability Score</p>
                <p className="text-xs text-slate-400 mt-0.5">{score?.badge ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Uptime 30d */}
          <Card className="border-slate-800 bg-sidebar" data-testid="card-uptime-30d">
            <CardContent className="pt-5 pb-5 flex flex-col items-center text-center gap-2">
              <p className="text-2xl font-bold text-emerald-400">{uptime.uptime30.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Uptime last 30 days</p>
            </CardContent>
          </Card>

          {/* MTTR */}
          <Card className="border-slate-800 bg-sidebar" data-testid="card-mttr">
            <CardContent className="pt-5 pb-5 flex flex-col items-center text-center gap-2">
              <p className="text-2xl font-bold text-sky-400">{mttrDisplay}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Avg MTTR</p>
            </CardContent>
          </Card>

          {/* Incidents 90d */}
          <Card className="border-slate-800 bg-sidebar" data-testid="card-incidents-90d">
            <CardContent className="pt-5 pb-5 flex flex-col items-center text-center gap-2">
              <p className="text-2xl font-bold text-slate-200">{incidents90}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Incidents last 90 days</p>
            </CardContent>
          </Card>
        </div>

        {/* ── 90-day Uptime Grid ── */}
        <Card className="border-slate-800 bg-sidebar">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              90-Day Uptime History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex flex-wrap gap-1"
              data-testid="uptime-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 1rem)", gap: "3px" }}
            >
              {uptimeGrid.map(day => (
                <GridCell key={day.date} day={day} />
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/70" /> Operational</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-amber-500/70" /> Degraded</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-red-500/70" /> Outage</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Incident History Table ── */}
        <Card className="border-slate-800 bg-sidebar">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-400" />
              Recent Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="text-sm">No recent incidents recorded.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {incidents.map(inc => (
                  <div
                    key={inc.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                    data-testid={`row-incident-${inc.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{inc.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {format(new Date(inc.startedAt), "MMM d, yyyy · HH:mm")}
                        {inc.duration != null && (
                          <span className="ml-2 text-slate-600">· {formatDuration(inc.duration)}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SeverityBadge severity={inc.severity} />
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        inc.ongoing
                          ? "bg-red-500/10 border-red-500/30 text-red-300"
                          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      }`}>
                        {inc.ongoing ? "Ongoing" : "Resolved"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Related Vendors ── */}
        {related.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
              Related vendors in {vendor.category}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {related.map(v => (
                <button
                  key={v.key}
                  onClick={() => navigate(`/vendors/${v.slug || v.key}`)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-800 bg-sidebar hover:border-slate-600 transition-colors text-center"
                  data-testid={`card-related-${v.key}`}
                >
                  {v.logoUrl ? (
                    <img
                      src={v.logoUrl}
                      alt={`${v.name} logo`}
                      className="h-8 w-8 rounded-lg object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <LogoAvatar name={v.name} size="sm" />
                  )}
                  <span className="text-xs font-medium text-slate-300 truncate w-full">{v.name}</span>
                  <span className={`text-xs ${statusColor(v.status)}`}>{statusLabel(v.status)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CTA Banner ── */}
        <Card className="border-indigo-500/30 bg-indigo-950/30">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-slate-100">
                  Get alerted the next time {vendor.name} has an outage
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Join thousands of MSPs monitoring {vendor.name} and 400+ other vendors with VendorWatch.
                </p>
              </div>
              <div className="shrink-0 flex gap-2">
                <Button
                  onClick={() => navigate("/signup")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  data-testid="button-cta-signup"
                >
                  Start Free Trial
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
