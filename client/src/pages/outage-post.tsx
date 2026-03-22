import { useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoAvatar } from "@/components/ui/logo-avatar";
import {
  Calendar, Clock, AlertTriangle, ExternalLink, Twitter,
  Linkedin, Link2, ChevronRight, ChevronLeft, Rss, TrendingDown
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
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h} hour${h !== 1 ? "s" : ""}`;
}

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export default function OutagePostPage() {
  const [, params] = useRoute("/outages/:slug");
  const [, setLocation] = useLocation();
  const slug = params?.slug || "";

  const { data, isLoading, error } = useQuery<{ post: BlogPost; related: BlogPost[] }>({
    queryKey: [`/api/blog/posts/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/blog/posts/${slug}`);
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Post not found");
      }
      return res.json();
    },
  });

  // Inject structured data (Article schema)
  useEffect(() => {
    if (!data?.post) return;
    const { post } = data;
    const existing = document.getElementById("ld-json-article");
    if (existing) existing.remove();

    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.metaDescription,
      datePublished: post.publishedAt || post.createdAt,
      dateModified: post.updatedAt,
      author: { "@type": "Organization", name: "VendorWatch" },
      publisher: {
        "@type": "Organization",
        name: "VendorWatch",
        logo: { "@type": "ImageObject", url: "https://vendorwatch.app/logo.png" },
      },
    };

    const script = document.createElement("script");
    script.id = "ld-json-article";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    // Update page title + meta
    document.title = `${post.title} | VendorWatch`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", post.metaDescription);

    return () => {
      const el = document.getElementById("ld-json-article");
      if (el) el.remove();
    };
  }, [data?.post?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h2 className="text-xl font-bold mb-2">Report Not Found</h2>
          <p className="text-muted-foreground mb-4">This outage report doesn't exist or hasn't been published.</p>
          <Button variant="outline" onClick={() => setLocation("/outages")}>View All Reports</Button>
        </div>
      </div>
    );
  }

  const { post, related } = data;
  const shareUrl = window.location.href;
  const shareText = `${post.title} — Full incident report on VendorWatch`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky back nav */}
      <div className="sticky top-0 z-50 border-b border-sidebar-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/outages">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-outages">
              <ChevronLeft className="w-4 h-4" />
              Outage Reports
            </button>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-foreground font-medium truncate">{post.vendorName}</span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="border-b border-sidebar-border bg-sidebar/20">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/outages" className="hover:text-foreground">Outages</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href={`/outages?vendor=${post.vendorKey}`} className="hover:text-foreground">{post.vendorName}</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground truncate max-w-[200px]">{post.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
          {/* Main content */}
          <main>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <LogoAvatar name={post.vendorName} size="md" />
                <div>
                  <Link href={`/outages?vendor=${post.vendorKey}`} className="text-sm font-medium text-primary hover:underline">
                    {post.vendorName}
                  </Link>
                  <p className="text-xs text-muted-foreground">Vendor Incident Report</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className={SEVERITY_COLOR[post.severity] || SEVERITY_COLOR.info}>
                  {post.severity.toUpperCase()}
                </Badge>
                {post.durationMinutes && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(post.durationMinutes)}
                  </Badge>
                )}
                {post.affectedComponents && (
                  <Badge variant="outline" className="text-xs">
                    {post.affectedComponents.split(",").slice(0, 2).join(", ")}
                    {post.affectedComponents.split(",").length > 2 ? " +more" : ""}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Published {formatDate(post.publishedAt || post.createdAt)}
                </span>
                <span>By VendorWatch</span>
              </div>
            </div>

            {/* Markdown body */}
            <article
              className="prose prose-sm prose-invert max-w-none 
                prose-headings:font-bold prose-headings:text-foreground
                prose-h1:text-2xl prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
                prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
                prose-li:text-muted-foreground prose-li:marker:text-muted-foreground
                prose-strong:text-foreground
                prose-ul:space-y-1 prose-ol:space-y-1"
              data-testid="outage-post-body"
            >
              <ReactMarkdown>{post.body}</ReactMarkdown>
            </article>

            {/* Social share */}
            <div className="mt-10 pt-6 border-t border-sidebar-border">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Share this report</p>
              <div className="flex gap-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs border border-sidebar-border rounded-lg px-3 py-2 hover:bg-sidebar transition-colors"
                  data-testid="button-share-twitter"
                >
                  <Twitter className="w-3.5 h-3.5" />
                  Twitter / X
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs border border-sidebar-border rounded-lg px-3 py-2 hover:bg-sidebar transition-colors"
                  data-testid="button-share-linkedin"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  LinkedIn
                </a>
                <button
                  onClick={() => copyToClipboard(shareUrl)}
                  className="flex items-center gap-2 text-xs border border-sidebar-border rounded-lg px-3 py-2 hover:bg-sidebar transition-colors"
                  data-testid="button-copy-link"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Copy link
                </button>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10 rounded-xl border border-primary/20 bg-primary/5 p-6">
              <h3 className="font-bold mb-1">
                Monitor {post.vendorName} and 400+ others with VendorWatch
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get instant alerts when your vendors experience issues. Never be the last to know about an outage affecting your clients.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setLocation("/register")} data-testid="button-cta-post-register">
                  Start Free Trial
                </Button>
                <Button variant="outline" onClick={() => setLocation("/pricing")}>
                  View Pricing
                </Button>
              </div>
            </div>
          </main>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Incident summary */}
            <div className="border border-sidebar-border rounded-xl p-4 bg-sidebar/20">
              <h3 className="text-sm font-semibold mb-3">Incident Summary</h3>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Vendor</dt>
                  <dd className="font-medium">{post.vendorName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Severity</dt>
                  <dd>
                    <Badge className={`text-[10px] ${SEVERITY_COLOR[post.severity] || SEVERITY_COLOR.info}`}>
                      {post.severity.toUpperCase()}
                    </Badge>
                  </dd>
                </div>
                {post.durationMinutes && (
                  <div>
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="font-medium">{formatDuration(post.durationMinutes)}</dd>
                  </div>
                )}
                {post.affectedComponents && (
                  <div>
                    <dt className="text-muted-foreground">Affected Components</dt>
                    <dd className="font-medium">{post.affectedComponents}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Report Date</dt>
                  <dd className="font-medium">{formatDate(post.publishedAt || post.createdAt)}</dd>
                </div>
              </dl>
            </div>

            {/* Related posts */}
            {related.length > 0 && (
              <div className="border border-sidebar-border rounded-xl p-4 bg-sidebar/20">
                <h3 className="text-sm font-semibold mb-3">Related {post.vendorName} Reports</h3>
                <div className="space-y-3">
                  {related.map(r => (
                    <Link key={r.id} href={`/outages/${r.slug}`}>
                      <div className="hover:bg-sidebar rounded-lg p-2 -mx-2 cursor-pointer transition-colors" data-testid={`related-post-${r.id}`}>
                        <p className="text-xs font-medium line-clamp-2 hover:text-primary">{r.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDate(r.publishedAt || r.createdAt)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* RSS */}
            <a
              href="/outages/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-orange-500 border border-orange-500/30 rounded-xl px-4 py-3 hover:bg-orange-500/10 transition-colors"
              data-testid="link-sidebar-rss"
            >
              <Rss className="w-4 h-4" />
              Subscribe to RSS Feed
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}
