import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Siren, ShieldAlert, Users, MessageSquare, Clock, CheckCircle2, Loader2, Archive } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow, intervalToDuration, formatDuration } from "date-fns";
import { useState } from "react";

interface WarRoom {
  id: string;
  incidentId: string;
  vendorKey: string;
  vendorName: string;
  status: string;
  createdAt: string;
  closedAt?: string;
  participantCount: number;
  postCount: number;
  incident: {
    id: string;
    title: string;
    severity: string;
    status: string;
    impact: string;
    vendorKey: string;
    startedAt: string;
  } | null;
}

const getSeverityColor = (severity: string) => {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'major': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'minor': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  }
};

function formatIncidentDuration(createdAt: string, closedAt?: string): string {
  if (!closedAt) return '';
  try {
    const dur = intervalToDuration({ start: new Date(createdAt), end: new Date(closedAt) });
    return formatDuration(dur, { format: ['hours', 'minutes'] }) || 'less than a minute';
  } catch {
    return '';
  }
}

export default function WarRooms() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const { data: activeRooms = [], isLoading: activeLoading, error: activeError } = useQuery<WarRoom[]>({
    queryKey: ["war-rooms", "open"],
    queryFn: async () => {
      const res = await fetch("/api/war-rooms");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to fetch war rooms (${res.status})`);
      }
      return res.json();
    },
    refetchInterval: 30000,
    retry: 2,
  });

  const { data: archivedRooms = [], isLoading: archiveLoading } = useQuery<WarRoom[]>({
    queryKey: ["war-rooms", "closed"],
    queryFn: async () => {
      const res = await fetch("/api/war-rooms?status=closed");
      if (!res.ok) throw new Error("Failed to fetch archived war rooms");
      return res.json();
    },
    enabled: tab === 'archived',
  });

  const isLoading = tab === 'active' ? activeLoading : archiveLoading;
  const rooms = tab === 'active' ? activeRooms : archivedRooms;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-war-rooms-title">
            <Siren className="w-7 h-7 text-red-500" />
            Incident War Rooms
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base" data-testid="text-war-rooms-subtitle">
            {tab === 'active'
              ? 'Real-time collaboration spaces for active incidents'
              : 'Archived sessions with AI-generated post-incident summaries'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border border-sidebar-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'active'
              ? 'bg-red-500/10 text-red-500'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-active-war-rooms"
        >
          <div className={`w-2 h-2 rounded-full ${tab === 'active' ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'}`} />
          Active
          {activeRooms.length > 0 && (
            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] px-1.5 py-0 h-4">
              {activeRooms.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === 'archived'
              ? 'bg-sidebar text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="tab-archived-war-rooms"
        >
          <Archive className="w-3.5 h-3.5" />
          Archive
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : activeError && tab === 'active' ? (
        <Card className="border-red-500/20 bg-red-950/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShieldAlert className="w-16 h-16 mb-4 text-red-500/40" />
            <p className="text-lg font-medium text-red-400">Failed to load war rooms</p>
            <p className="text-sm opacity-50 mt-1">{(activeError as Error).message}</p>
          </CardContent>
        </Card>
      ) : rooms.length === 0 ? (
        <Card className="border-sidebar-border bg-sidebar/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            {tab === 'active' ? (
              <>
                <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-500/20" />
                <p className="text-lg font-medium">No Active War Rooms</p>
                <p className="text-sm opacity-50 mt-1">War rooms are created automatically when critical incidents occur, or can be started manually from any active incident.</p>
              </>
            ) : (
              <>
                <Archive className="w-16 h-16 mb-4 text-muted-foreground/20" />
                <p className="text-lg font-medium">No Archived War Rooms</p>
                <p className="text-sm opacity-50 mt-1">Closed war rooms will appear here with their AI-generated summaries.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => (
            <Card
              key={room.id}
              className={`transition-all cursor-pointer ${
                tab === 'active'
                  ? 'border-red-500/20 bg-red-950/10 hover:border-red-500/40'
                  : 'border-sidebar-border bg-sidebar/10 hover:border-sidebar-border/80'
              }`}
              onClick={() => setLocation(`/war-room/${room.incidentId}`)}
              data-testid={`card-war-room-${room.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {tab === 'active' ? (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      <span className={`text-xs font-medium uppercase tracking-wider ${tab === 'active' ? 'text-primary' : 'text-muted-foreground'}`}>
                        {room.vendorName || room.vendorKey}
                      </span>
                    </div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShieldAlert className={`w-5 h-5 shrink-0 ${tab === 'active' ? 'text-red-500' : 'text-muted-foreground'}`} />
                      {room.incident?.title || `Incident War Room`}
                    </CardTitle>
                    {room.incident?.impact && (
                      <CardDescription className="text-sm">{room.incident.impact}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {room.incident?.severity && (
                      <Badge className={getSeverityColor(room.incident.severity)}>
                        {room.incident.severity.toUpperCase()}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`capitalize text-xs ${tab === 'archived' ? 'border-emerald-500/30 text-emerald-500' : ''}`}>
                      {tab === 'archived' ? 'Resolved' : room.incident?.status || 'active'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span data-testid={`text-participants-${room.id}`}>{room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    <span data-testid={`text-posts-${room.id}`}>{room.postCount} update{room.postCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {tab === 'active' ? (
                      <span>Opened {formatDistanceToNow(new Date(room.createdAt), { addSuffix: true })}</span>
                    ) : (
                      <span>
                        {room.closedAt
                          ? `Resolved ${formatDistanceToNow(new Date(room.closedAt), { addSuffix: true })}`
                          : `Opened ${formatDistanceToNow(new Date(room.createdAt), { addSuffix: true })}`}
                      </span>
                    )}
                  </div>
                  {tab === 'archived' && room.closedAt && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground/60">
                        Duration: {formatIncidentDuration(room.createdAt, room.closedAt)}
                      </span>
                    </div>
                  )}
                  {tab === 'active' && room.incident?.startedAt && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground/60">
                        Incident started {formatDistanceToNow(new Date(room.incident.startedAt), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    className={`text-xs border ${
                      tab === 'active'
                        ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20'
                        : 'bg-sidebar text-muted-foreground border-sidebar-border hover:text-foreground'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/war-room/${room.incidentId}`);
                    }}
                    data-testid={`button-enter-war-room-${room.id}`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                    {tab === 'active' ? 'Enter War Room' : 'View Archive'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
