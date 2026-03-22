import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoAvatar } from "@/components/ui/logo-avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertTriangle, Calendar, Clock, ChevronLeft, ChevronRight,
  Rss, Search, ShieldAlert, TrendingDown, FileText
} from "lucide-react";
import type { BlogPost } from "@shared/schema";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  major: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  minor: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OutagesPage() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const { user } = useAuth();
  const isOwner = user?.isOwner;

  const { data, isLoading } = useQuery<{
    posts: BlogPost[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: ["/api/blog/posts", page, vendorFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "12",
      });
      if (vendorFilter && vendorFilter !== "all") params.set("vendorKey", vendorFilter);
      const res = await fetch(`/api/blog/posts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
  });

  const { data: draftQueue } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/queue"],
    queryFn: async () => {
      const res = await fetch("/api/blog/queue", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!isOwner,
  });

  const posts = data?.posts || [];
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  const filteredPosts = search.trim()
    ? posts.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.vendorName.toLowerCase().includes(search.toLowerCase())
      )
    : posts;

  const uniqueVendors = [...new Map(posts.map(p => [p.vendorKey, p.vendorName])).entries()];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav bar with back button */}
      <div className="sticky top-0 z-50 border-b border-sidebar-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-home">
              <ChevronLeft className="w-4 h-4" />
              {user ? "Dashboard" : "Home"}
            </button>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-foreground font-medium">Outage Reports</span>
        </div>
      </div>

      {/* Hero header */}
      <div className="border-b border-sidebar-border bg-sidebar/30">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <span className="text-foreground">Outage Reports</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
                <TrendingDown className="w-8 h-8 text-red-500" />
                Vendor Outage Reports
              </h1>
              <p className="text-muted-foreground max-w-xl">
                AI-generated incident analyses for vendor outages detected by VendorWatch. Updated automatically when incidents are resolved.
              </p>
            </div>
            <a
              href="/outages/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-orange-500 border border-orange-500/30 rounded-lg px-3 py-2 hover:bg-orange-500/10 transition-colors"
              data-testid="link-rss-feed"
            >
              <Rss className="w-4 h-4" />
              RSS Feed
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex gap-3 mb-8 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search incidents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-outages"
            />
          </div>
          {uniqueVendors.length > 0 && (
            <Select value={vendorFilter} onValueChange={v => { setVendorFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-vendor-filter">
                <SelectValue placeholder="All vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {uniqueVendors.map(([key, name]) => (
                  <SelectItem key={key} value={key}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Posts grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-sidebar-border rounded-xl p-5 animate-pulse bg-sidebar/20">
                <div className="w-10 h-10 rounded-full bg-muted mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-full mb-1" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-1">No outage reports yet</p>
            <p className="text-sm opacity-60">Reports are auto-generated when monitored vendors have resolved incidents.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map(post => (
              <Link key={post.id} href={`/outages/${post.slug}`}>
                <article
                  className="border border-sidebar-border rounded-xl p-5 bg-background hover:border-primary/40 hover:bg-sidebar/20 transition-all cursor-pointer group h-full flex flex-col"
                  data-testid={`card-outage-${post.id}`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <LogoAvatar name={post.vendorName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary">{post.vendorName}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-[10px] ${SEVERITY_COLOR[post.severity] || SEVERITY_COLOR.info}`}>
                          {post.severity.toUpperCase()}
                        </Badge>
                        {post.durationMinutes && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(post.durationMinutes)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <h2 className="text-sm font-semibold leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
                    {post.metaDescription}
                  </p>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-sidebar-border">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.publishedAt || post.createdAt)}
                    </span>
                    <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Read report →
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !search && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Owner draft banner */}
        {isOwner && draftQueue && draftQueue.length > 0 && (
          <div className="mt-10 border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-yellow-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-200">
                  {draftQueue.length} draft {draftQueue.length === 1 ? "report" : "reports"} waiting to be published
                </p>
                <p className="text-xs text-yellow-400/70 mt-0.5">
                  These were auto-generated from resolved incidents. Review and publish them in the Blog Admin.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 shrink-0"
              onClick={() => setLocation("/blog-admin")}
              data-testid="button-go-to-blog-admin"
            >
              Review Drafts →
            </Button>
          </div>
        )}

        {/* CTA — only shown to non-logged-in users */}
        {!user && (
          <div className="mt-16 border border-primary/20 rounded-xl p-8 bg-primary/5 text-center">
            <ShieldAlert className="w-10 h-10 mx-auto mb-4 text-primary opacity-60" />
            <h3 className="text-xl font-bold mb-2">Monitor 400+ Vendors in Real Time</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get instant alerts when your vendors go down. Never be the last to know about an outage affecting your clients.
            </p>
            <Button onClick={() => setLocation("/register")} data-testid="button-cta-register">
              Start Free Trial
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
