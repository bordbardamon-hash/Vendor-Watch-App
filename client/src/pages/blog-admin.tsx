import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { LogoAvatar } from "@/components/ui/logo-avatar";
import {
  CheckCircle2, Clock, Eye, Edit2, Send, AlertTriangle,
  FileText, Calendar, ExternalLink, ChevronDown, ChevronUp, RefreshCw, Star, Trash2, SendHorizonal
} from "lucide-react";
import type { BlogPost } from "@shared/schema";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  major: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  minor: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

function formatDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

interface DraftCardProps {
  post: BlogPost;
  onPublish: (id: string) => void;
  onSave: (id: string, updates: { title: string; body: string; metaDescription: string; confidenceScore?: number }) => void;
  onDelete: (id: string) => void;
  isPublishing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
}

function ConfidenceStars({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Output quality:</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="focus:outline-none"
          title={labels[n]}
          data-testid={`star-${n}`}
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              n <= (hovered || value || 0)
                ? "text-amber-400 fill-amber-400"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
      {(hovered || value) ? (
        <span className="text-xs text-muted-foreground">{labels[hovered || value!]}</span>
      ) : null}
    </div>
  );
}

function DraftCard({ post, onPublish, onSave, onDelete, isPublishing, isSaving, isDeleting }: DraftCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [meta, setMeta] = useState(post.metaDescription);
  const [confidence, setConfidence] = useState<number | null>(post.confidenceScore ?? null);
  const [, setLocation] = useLocation();

  return (
    <Card className="border-sidebar-border bg-sidebar/20" data-testid={`draft-card-${post.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <LogoAvatar name={post.vendorName} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={`text-[10px] ${SEVERITY_COLOR[post.severity] || SEVERITY_COLOR.info}`}>
                {post.severity.toUpperCase()}
              </Badge>
              {post.durationMinutes && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(post.durationMinutes)}
                </span>
              )}
              <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">DRAFT</Badge>
            </div>

            {editing ? (
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="text-sm font-semibold mb-1 h-8"
                data-testid={`input-title-${post.id}`}
              />
            ) : (
              <h3 className="text-sm font-semibold mb-1">{post.title}</h3>
            )}

            <p className="text-xs text-muted-foreground mb-2">
              Generated {formatDate(post.createdAt)} · {post.vendorName}
            </p>

            {editing && (
              <>
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1">Meta description ({meta.length}/155)</p>
                  <Input
                    value={meta}
                    onChange={e => setMeta(e.target.value.slice(0, 155))}
                    className="text-xs h-8"
                    data-testid={`input-meta-${post.id}`}
                  />
                </div>
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={12}
                  className="text-xs font-mono resize-none mb-2"
                  data-testid={`textarea-body-${post.id}`}
                />
              </>
            )}

            {!editing && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? "Collapse preview" : "Preview content"}
              </button>
            )}

            {expanded && !editing && (
              <div className="text-xs text-muted-foreground bg-sidebar rounded-lg p-3 border border-sidebar-border mb-3 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                {post.body.slice(0, 1000)}{post.body.length > 1000 ? "\n\n…(truncated)" : ""}
              </div>
            )}

            <div className="mb-3">
              <ConfidenceStars
                value={confidence}
                onChange={v => {
                  setConfidence(v);
                  onSave(post.id, { title, body, metaDescription: meta, confidenceScore: v });
                }}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {editing ? (
                <>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      onSave(post.id, { title, body, metaDescription: meta, confidenceScore: confidence ?? undefined });
                      setEditing(false);
                    }}
                    disabled={isSaving}
                    data-testid={`button-save-${post.id}`}
                  >
                    {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setTitle(post.title);
                      setBody(post.body);
                      setMeta(post.metaDescription);
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onPublish(post.id)}
                    disabled={isPublishing}
                    data-testid={`button-publish-${post.id}`}
                  >
                    {isPublishing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Publish
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setEditing(true)}
                    data-testid={`button-edit-${post.id}`}
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => setLocation(`/outages/${post.slug}`)}
                    data-testid={`button-preview-${post.id}`}
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </Button>
                  {confirmDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Delete this draft?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs gap-1"
                        onClick={() => onDelete(post.id)}
                        disabled={isDeleting}
                        data-testid={`button-confirm-delete-${post.id}`}
                      >
                        {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setConfirmDelete(false)}
                        data-testid={`button-cancel-delete-${post.id}`}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-red-500"
                      onClick={() => setConfirmDelete(true)}
                      data-testid={`button-delete-${post.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BlogAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [confirmPublishAll, setConfirmPublishAll] = useState(false);
  const [isPublishingAll, setIsPublishingAll] = useState(false);

  const { data: drafts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/queue"],
    queryFn: async () => {
      const res = await fetch("/api/blog/queue");
      if (!res.ok) throw new Error("Failed to fetch queue");
      return res.json();
    },
  });

  const { data: publishedData } = useQuery<{ posts: BlogPost[]; total: number }>({
    queryKey: ["/api/blog/posts-all"],
    queryFn: async () => {
      const res = await fetch("/api/blog/posts?status=published&pageSize=50");
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Post published", description: "The outage report is now live." });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts-all"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/blog/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Changes saved to draft." });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/queue"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog/posts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft deleted", description: "The draft has been permanently removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/queue"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/blog/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (!res.ok) throw new Error("Failed to revert");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reverted to draft" });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts-all"] });
    },
  });

  const handlePublishAll = async () => {
    setConfirmPublishAll(false);
    setIsPublishingAll(true);
    let succeeded = 0;
    let failed = 0;
    for (const post of drafts) {
      try {
        const res = await fetch(`/api/blog/posts/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        if (res.ok) succeeded++; else failed++;
      } catch {
        failed++;
      }
    }
    setIsPublishingAll(false);
    queryClient.invalidateQueries({ queryKey: ["/api/blog/queue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/blog/posts-all"] });
    if (failed === 0) {
      toast({ title: `${succeeded} report${succeeded !== 1 ? "s" : ""} published`, description: "All drafts are now live." });
    } else {
      toast({ title: `${succeeded} published, ${failed} failed`, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <FileText className="w-6 h-6 text-primary" />
          Outage Blog Admin
        </h1>
        <p className="text-muted-foreground text-sm">
          Review and publish AI-generated incident reports. Posts are auto-generated when vendor outages resolve.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-sidebar-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{drafts.length}</p>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card className="border-sidebar-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{publishedData?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Published reports</p>
          </CardContent>
        </Card>
        <Card className="border-sidebar-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Public feed</p>
              <a href="/outages" target="_blank" className="text-xs text-primary hover:underline flex items-center gap-1">
                /outages <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Draft queue */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            Pending Review ({drafts.length})
          </h2>
          {drafts.length > 1 && (
            confirmPublishAll ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Publish all {drafts.length} drafts?</span>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handlePublishAll}
                  disabled={isPublishingAll}
                  data-testid="button-confirm-publish-all"
                >
                  {isPublishingAll ? <RefreshCw className="w-3 h-3 animate-spin" /> : <SendHorizonal className="w-3 h-3" />}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setConfirmPublishAll(false)}
                  data-testid="button-cancel-publish-all"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-emerald-600/40 text-emerald-500 hover:bg-emerald-600/10 hover:border-emerald-500"
                onClick={() => setConfirmPublishAll(true)}
                disabled={isPublishingAll}
                data-testid="button-publish-all"
              >
                {isPublishingAll ? <RefreshCw className="w-3 h-3 animate-spin" /> : <SendHorizonal className="w-3 h-3" />}
                Publish All
              </Button>
            )
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="border border-sidebar-border rounded-xl p-5 animate-pulse bg-sidebar/20 h-32" />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-12 border border-sidebar-border rounded-xl border-dashed text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No drafts waiting for review.</p>
            <p className="text-xs opacity-50 mt-1">New posts are auto-generated when vendor incidents resolve after 15+ minutes.</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="draft-queue">
            {drafts.map(post => (
              <DraftCard
                key={post.id}
                post={post}
                onPublish={(id) => publishMutation.mutate(id)}
                onSave={(id, updates) => saveMutation.mutate({ id, updates })}
                onDelete={(id) => deleteMutation.mutate(id)}
                isPublishing={publishMutation.isPending}
                isSaving={saveMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Published posts list */}
      {(publishedData?.posts?.length || 0) > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Published ({publishedData!.total})
          </h2>
          <div className="space-y-2" data-testid="published-list">
            {publishedData!.posts.map(post => (
              <div
                key={post.id}
                className="flex items-center gap-4 border border-sidebar-border rounded-lg p-3 bg-background hover:bg-sidebar/10"
                data-testid={`published-row-${post.id}`}
              >
                <LogoAvatar name={post.vendorName} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(post.publishedAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`text-[10px] ${SEVERITY_COLOR[post.severity] || SEVERITY_COLOR.info}`}>
                    {post.severity.toUpperCase()}
                  </Badge>
                  <a
                    href={`/outages/${post.slug}`}
                    target="_blank"
                    className="text-xs text-muted-foreground hover:text-primary"
                    data-testid={`link-view-published-${post.id}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    className="text-[10px] text-muted-foreground hover:text-yellow-500 border border-sidebar-border rounded px-1.5 py-0.5 hover:border-yellow-500/30"
                    onClick={() => revertMutation.mutate(post.id)}
                    data-testid={`button-revert-${post.id}`}
                  >
                    Revert to draft
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
