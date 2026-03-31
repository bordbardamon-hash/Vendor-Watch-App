import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LogoAvatar } from "@/components/ui/logo-avatar";
import {
  AlertTriangle, Shield, Copy, Check, Download, Users, ArrowUp,
  Send, Wifi, WifiOff, Clock, ExternalLink, Lock, ChevronDown,
  ChevronUp, Zap, Bot, XCircle, Sparkles, RefreshCw, Lightbulb, Timer, CheckCircle2
} from "lucide-react";

interface WarRoom {
  id: string;
  incidentId: string;
  vendorKey: string;
  vendorName: string;
  status: "open" | "closed";
  closedAt: string | null;
  createdAt: string;
}

interface WarRoomPost {
  id: string;
  warRoomId: string;
  userId: string | null;
  content: string;
  detail: string | null;
  isSystemUpdate: boolean;
  upvotes: number;
  createdAt: string;
}

interface Participant {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  joinedAt: string;
  lastActiveAt: string;
}

interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  impact: string;
  startedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  url: string;
}

interface WarRoomData {
  warRoom: WarRoom;
  incident: Incident | null;
  posts: WarRoomPost[];
  participants: Participant[];
  participantCount: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  major: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  minor: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

function timeAgo(date: string): string {
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleString();
}

function PostCard({
  post,
  onUpvote,
  isAuthenticated,
  userUpvoted,
}: {
  post: WarRoomPost;
  onUpvote: (postId: string) => void;
  isAuthenticated: boolean;
  userUpvoted: boolean;
}) {
  const [showDetail, setShowDetail] = useState(false);

  if (post.isSystemUpdate) {
    return (
      <div
        className="flex items-start gap-3 py-3 px-4 bg-blue-500/5 border border-blue-500/10 rounded-lg"
        data-testid={`post-system-${post.id}`}
      >
        <Bot className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-blue-300">{post.content}</p>
          {post.detail && <p className="text-xs text-muted-foreground mt-1">{post.detail}</p>}
          <span className="text-[10px] text-muted-foreground/60">{timeAgo(post.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 py-4 px-4 border border-sidebar-border rounded-lg bg-sidebar/20 hover:bg-sidebar/30 transition-colors"
      data-testid={`post-user-${post.id}`}
    >
      <button
        className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors shrink-0 ${
          userUpvoted
            ? "bg-emerald-500/10 text-emerald-500"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar"
        } ${!isAuthenticated ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        onClick={() => isAuthenticated && onUpvote(post.id)}
        disabled={!isAuthenticated}
        data-testid={`button-upvote-${post.id}`}
        title={isAuthenticated ? "Toggle upvote" : "Sign in to upvote"}
      >
        <ArrowUp className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold leading-none">{post.upvotes}</span>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-relaxed">{post.content}</p>
        {post.detail && (
          <div className="mt-2">
            <button
              className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
              onClick={() => setShowDetail(!showDetail)}
            >
              {showDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetail ? "Hide" : "Show"} detail
            </button>
            {showDetail && (
              <p className="text-xs text-muted-foreground mt-2 p-2 bg-sidebar rounded border border-sidebar-border">
                {post.detail}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground/60">{timeAgo(post.createdAt)}</span>
          {post.userId && (
            <span className="text-[10px] text-muted-foreground/40">· MSP</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WarRoomPage() {
  const [, params] = useRoute("/war-room/:incidentId");
  const [, setLocation] = useLocation();
  const incidentId = params?.incidentId || "";
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [detail, setDetail] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [generatingClientSummary, setGeneratingClientSummary] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [userUpvotes, setUserUpvotes] = useState<Set<string>>(new Set());
  const [digest, setDigest] = useState<{ situation: string; workaround: string | null } | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestGeneratedAt, setDigestGeneratedAt] = useState<Date | null>(null);
  const [closureSecondsLeft, setClosureSecondsLeft] = useState<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data, isLoading, error } = useQuery<WarRoomData>({
    queryKey: [`/api/war-room/${incidentId}`],
    queryFn: async () => {
      const res = await fetch(`/api/war-room/${incidentId}`);
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to load war room");
      }
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Auto-scroll to bottom when posts come in
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [data?.posts?.length]);

  // WebSocket connection
  useEffect(() => {
    if (!data?.warRoom?.id) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${proto}//${host}/ws/war-room?warRoomId=${data.warRoom.id}${user ? `&userId=${user.id}` : ""}`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
      ws.onerror = () => setWsConnected(false);

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "new_post" || msg.type === "upvote_update" || msg.type === "participant_joined") {
            queryClient.invalidateQueries({ queryKey: [`/api/war-room/${incidentId}`] });
          }
          if (msg.type === "war_room_closed") {
            queryClient.invalidateQueries({ queryKey: [`/api/war-room/${incidentId}`] });
            toast({ title: "War Room Closed", description: "This incident has been resolved and the War Room has closed." });
          }
        } catch {}
      };
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [data?.warRoom?.id, user?.id]);

  // Join war room on load if authenticated
  useEffect(() => {
    if (!data?.warRoom || !user) return;
    fetch(`/api/war-room/${incidentId}/join`, { method: "POST" }).catch(() => {});
  }, [data?.warRoom?.id, user?.id]);

  // Countdown to war room closure
  useEffect(() => {
    if (!data?.posts) return;
    const GRACE_MS = 60 * 60 * 1000; // 1 hour — must match server constant
    const resolvePost = data.posts.find(p =>
      p.isSystemUpdate && p.content.includes("War Room will close in 1 hour")
    );
    if (!resolvePost) { setClosureSecondsLeft(null); return; }

    const closeAt = new Date(resolvePost.createdAt).getTime() + GRACE_MS;

    const tick = () => {
      const left = Math.max(0, Math.floor((closeAt - Date.now()) / 1000));
      setClosureSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.posts]);

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/war-room/${incidentId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), detail: detail.trim() || undefined }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to post");
      }
      return res.json();
    },
    onSuccess: () => {
      setContent("");
      setDetail("");
      setShowDetail(false);
      queryClient.invalidateQueries({ queryKey: [`/api/war-room/${incidentId}`] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const upvoteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/war-room/${incidentId}/posts/${postId}/upvote`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to upvote");
      return { postId, ...(await res.json()) };
    },
    onSuccess: ({ postId, alreadyVoted }) => {
      setUserUpvotes((prev) => {
        const next = new Set(prev);
        if (alreadyVoted) next.add(postId);
        else next.delete(postId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: [`/api/war-room/${incidentId}`] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/war-room/${incidentId}/close`, { method: "POST" });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to close war room");
      }
      return res.json();
    },
    onSuccess: () => {
      setConfirmClose(false);
      queryClient.invalidateQueries({ queryKey: [`/api/war-room/${incidentId}`] });
      toast({ title: "War Room Closed", description: "The incident has been resolved and the war room is now archived." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyClientSummary = useCallback(async () => {
    if (!data || !user) return;
    setGeneratingClientSummary(true);
    try {
      const res = await fetch(`/api/war-room/${incidentId}/ai-client-summary`, { method: 'POST' });
      const json = await res.json();
      const text = res.ok && json.summary
        ? json.summary
        : `We are aware of an ongoing issue with ${data.warRoom.vendorName}. Current status: ${data.incident?.status || "investigating"}. We are monitoring and will update you as more information becomes available.`;
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      const { warRoom, incident } = data;
      const fallback = `We are aware of an ongoing issue with ${warRoom.vendorName}. Current status: ${incident?.status || "investigating"}. We are monitoring and will update you as more information becomes available.`;
      navigator.clipboard.writeText(fallback).then(() => {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2500);
      });
    } finally {
      setGeneratingClientSummary(false);
    }
  }, [data, incidentId, user]);

  const generateDigest = useCallback(async () => {
    if (!user) return;
    setDigestLoading(true);
    try {
      const res = await fetch(`/api/war-room/${incidentId}/ai-digest`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      setDigest(result);
      setDigestGeneratedAt(new Date());
    } catch {
      toast({ title: "Digest unavailable", description: "Could not generate AI digest right now.", variant: "destructive" });
    } finally {
      setDigestLoading(false);
    }
  }, [incidentId, user, toast]);

  const exportLog = useCallback(() => {
    window.open(`/api/war-room/${incidentId}/export`, "_blank");
  }, [incidentId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading War Room…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">War Room Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "This war room doesn't exist or hasn't been created yet."}
          </p>
          <Button variant="outline" onClick={() => setLocation("/incidents")}>
            View Incidents
          </Button>
        </div>
      </div>
    );
  }

  const { warRoom, incident, posts, participants } = data;
  const sortedPosts = [...posts].sort((a, b) => {
    // System updates stay in chronological order; user posts sorted by upvotes then time
    if (a.isSystemUpdate && !b.isSystemUpdate) return -1;
    if (!a.isSystemUpdate && b.isSystemUpdate) return 1;
    if (!a.isSystemUpdate && !b.isSystemUpdate && b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const isClosed = warRoom.status === "closed";
  const charCount = content.length;
  const overLimit = charCount > 280;

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className={`border-b border-sidebar-border px-3 sm:px-4 py-2 sm:py-3 ${isClosed ? "bg-muted/30" : "bg-red-500/5"}`}>
        {/* Row 1: title + connection status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isClosed ? "bg-muted-foreground" : "bg-red-500 animate-pulse"}`} />
            <span className="font-bold text-xs sm:text-sm uppercase tracking-wider text-red-500 truncate">
              {isClosed ? "War Room (Closed)" : "Incident War Room — LIVE"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            {wsConnected ? (
              <><Wifi className="w-3 h-3 text-emerald-500" /><span className="hidden sm:inline ml-1">Connected</span></>
            ) : (
              <><WifiOff className="w-3 h-3 text-red-500" /><span className="hidden sm:inline ml-1">Reconnecting…</span></>
            )}
          </div>
        </div>
        {/* Row 2: action buttons */}
        <div className="flex items-center gap-1.5 mt-2">
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={copyClientSummary} disabled={generatingClientSummary} data-testid="button-copy-summary">
            {generatingClientSummary ? (
              <><RefreshCw className="w-3 h-3 animate-spin" /><span className="hidden sm:inline">Generating…</span></>
            ) : copiedSummary ? (
              <><Check className="w-3 h-3" /><span className="hidden sm:inline">Copied!</span></>
            ) : (
              <><Sparkles className="w-3 h-3" /><span className="hidden sm:inline">Copy Client Summary</span></>
            )}
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={exportLog} data-testid="button-export-log">
            <Download className="w-3 h-3" /><span className="hidden sm:inline">Export Log</span>
          </Button>
          {!isClosed && (user?.isOwner || user?.isAdmin) && (
            confirmClose ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground hidden sm:inline">Close war room?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1 text-xs"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  data-testid="button-confirm-close-war-room"
                >
                  {closeMutation.isPending ? "Closing…" : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setConfirmClose(false)}
                  data-testid="button-cancel-close-war-room"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                onClick={() => setConfirmClose(true)}
                data-testid="button-close-war-room"
              >
                <XCircle className="w-3 h-3" /><span className="hidden sm:inline">Close War Room</span>
              </Button>
            )
          )}
        </div>
      </div>

      {/* Closure countdown banner */}
      {closureSecondsLeft !== null && closureSecondsLeft > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-center gap-3" data-testid="war-room-countdown-banner">
          <Timer className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">
            War Room closing in{" "}
            <span className="font-mono font-bold text-amber-200" data-testid="text-countdown">
              {formatCountdown(closureSecondsLeft)}
            </span>
            {" "}— add your final notes now
          </span>
        </div>
      )}
      {closureSecondsLeft === 0 && (
        <div className="bg-muted/30 border-b border-sidebar-border px-4 py-2 flex items-center justify-center gap-2">
          <Timer className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">War Room is closing…</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Incident header */}
          <Card className="border-sidebar-border bg-sidebar/20" data-testid="war-room-incident-header">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <LogoAvatar name={warRoom.vendorName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-lg font-bold" data-testid="text-war-room-vendor">{warRoom.vendorName}</h1>
                    {incident && (
                      <Badge className={`text-[10px] ${SEVERITY_COLOR[incident.severity] || SEVERITY_COLOR.info}`}>
                        {incident.severity.toUpperCase()}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${isClosed || closureSecondsLeft !== null ? "text-emerald-500 border-emerald-500/30" : "text-red-500 border-red-500/30"}`}>
                      {isClosed || closureSecondsLeft !== null ? "RESOLVED" : incident?.status?.toUpperCase() || "INVESTIGATING"}
                    </Badge>
                  </div>
                  {incident && (
                    <p className="text-base font-semibold text-foreground mb-1">{incident.title}</p>
                  )}
                  {incident?.impact && (
                    <p className="text-sm text-muted-foreground mb-2">{incident.impact}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {incident?.startedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Started {timeAgo(incident.startedAt)}
                      </span>
                    )}
                    {incident?.resolvedAt && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Resolved {timeAgo(incident.resolvedAt)}
                      </span>
                    )}
                    {!incident?.resolvedAt && incident?.updatedAt && (
                      <span>Last update: {timeAgo(incident.updatedAt)}</span>
                    )}
                    {incident?.url && (
                      <a href={incident.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="w-3 h-3" />
                        Vendor Status Page
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Live Digest */}
          {!isClosed && user && (
            <Card className="border-violet-500/20 bg-violet-500/5" data-testid="war-room-ai-digest">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-semibold text-violet-400">AI Live Digest</span>
                    {digestGeneratedAt && (
                      <span className="text-[10px] text-muted-foreground">
                        Updated {digestGeneratedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 gap-1"
                    onClick={generateDigest}
                    disabled={digestLoading}
                    data-testid="button-generate-digest"
                  >
                    <RefreshCw className={`w-3 h-3 ${digestLoading ? "animate-spin" : ""}`} />
                    {digest ? "Refresh" : "Generate"}
                  </Button>
                </div>
                {digest ? (
                  <div className="space-y-2">
                    <p className="text-sm text-foreground leading-relaxed">{digest.situation}</p>
                    {digest.workaround && (
                      <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2 mt-2">
                        <Lightbulb className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-emerald-300">{digest.workaround}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {digestLoading
                      ? "Analyzing feed and generating digest…"
                      : "Generate a real-time AI summary of the current situation and any known workarounds."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity feed */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Activity Feed
              <span className="text-xs font-normal">({posts.length} updates)</span>
            </h2>

            <div ref={feedRef} className="space-y-2 max-h-[500px] overflow-y-auto pr-1" data-testid="war-room-feed">
              {sortedPosts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-sidebar-border rounded-lg border-dashed">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No updates yet.</p>
                  <p className="text-xs opacity-50 mt-1">Be the first to share a workaround or update.</p>
                </div>
              ) : (
                sortedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onUpvote={(id) => upvoteMutation.mutate(id)}
                    isAuthenticated={!!user}
                    userUpvoted={userUpvotes.has(post.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Post input */}
          {!isClosed && (
            <div className="border border-sidebar-border rounded-lg p-4 bg-sidebar/20">
              {user ? (
                <>
                  <Textarea
                    placeholder="Share a workaround, update, or question… (280 chars)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className={`resize-none mb-2 ${overLimit ? "border-red-500" : ""}`}
                    rows={3}
                    maxLength={300}
                    data-testid="input-war-room-post"
                  />
                  <div className="flex items-center justify-between mb-2">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      onClick={() => setShowDetail(!showDetail)}
                    >
                      {showDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showDetail ? "Hide" : "Add"} detailed description (optional)
                    </button>
                    <span className={`text-xs ${overLimit ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                      {charCount}/280
                    </span>
                  </div>
                  {showDetail && (
                    <Textarea
                      placeholder="Add more context, steps to reproduce, or full workaround details…"
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                      className="resize-none mb-2 text-sm"
                      rows={4}
                      data-testid="input-war-room-detail"
                    />
                  )}
                  <Button
                    className="w-full gap-2"
                    onClick={() => postMutation.mutate()}
                    disabled={!content.trim() || overLimit || postMutation.isPending}
                    data-testid="button-post-war-room"
                  >
                    <Send className="w-4 h-4" />
                    {postMutation.isPending ? "Posting…" : "Post Update"}
                  </Button>
                </>
              ) : (
                <div className="text-center py-6">
                  <Lock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">Sign in to post updates and upvote workarounds</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={() => setLocation("/login")}>Sign In</Button>
                    <Button size="sm" onClick={() => setLocation("/register")}>Create Account</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isClosed && (
            <div className="border border-sidebar-border rounded-lg p-4 bg-muted/20 text-center">
              <Shield className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">This War Room is closed. The session has been archived.</p>
              {warRoom.closedAt && (
                <p className="text-xs text-muted-foreground/60 mt-1">Closed {timeAgo(warRoom.closedAt)}</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Participants */}
          <Card className="border-sidebar-border bg-sidebar/20">
            <CardHeader className="px-4 py-3 border-b border-sidebar-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Active Participants
                <span className="ml-auto text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                  {participants.length}
                </span>
              </h3>
            </CardHeader>
            <CardContent className="p-3">
              {participants.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No participants yet</p>
              ) : (
                <div className="space-y-2" data-testid="war-room-participants">
                  {participants.slice(0, 10).map((p) => (
                    <div key={p.userId} className="flex items-center gap-2" data-testid={`participant-${p.userId}`}>
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {(p.userName || p.userEmail || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{p.userName || p.userEmail?.split("@")[0] || "MSP"}</p>
                        <p className="text-[10px] text-muted-foreground">Active {timeAgo(p.lastActiveAt)}</p>
                      </div>
                    </div>
                  ))}
                  {participants.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center">+{participants.length - 10} more</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* War room info */}
          <Card className="border-sidebar-border bg-sidebar/20">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">War Room ID</p>
                <p className="text-xs font-mono text-muted-foreground truncate">{warRoom.id.slice(0, 8)}…</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Opened</p>
                <p className="text-xs">{new Date(warRoom.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Updates</p>
                <p className="text-xs font-semibold">{posts.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Top Workaround</p>
                {posts.filter(p => !p.isSystemUpdate && p.upvotes > 0).length > 0 ? (
                  (() => {
                    const top = posts.filter(p => !p.isSystemUpdate && p.upvotes > 0).sort((a, b) => b.upvotes - a.upvotes)[0];
                    return (
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        <ArrowUp className="w-3 h-3 inline text-emerald-500 mr-1" />
                        {top.upvotes} — "{top.content.slice(0, 80)}{top.content.length > 80 ? "…" : ""}"
                      </p>
                    );
                  })()
                ) : (
                  <p className="text-xs text-muted-foreground">None yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Share */}
          <Card className="border-sidebar-border bg-sidebar/20">
            <CardContent className="p-4">
              <p className="text-xs font-semibold mb-2">Share this War Room</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={window.location.href}
                  className="flex-1 text-xs bg-sidebar border border-sidebar-border rounded px-2 py-1.5 font-mono text-muted-foreground"
                  data-testid="input-war-room-share-url"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0"
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Anyone with this link can read the feed. Posting requires a VendorWatch account.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
