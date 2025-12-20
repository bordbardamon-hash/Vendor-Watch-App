import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Shield, Mail, Smartphone, XCircle, CheckCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NotificationConsent {
  id: string;
  userId: string;
  userEmail: string | null;
  channel: string;
  destination: string;
  consentText: string;
  consentMethod: string;
  sourceContext: string;
  ipAddress: string | null;
  userAgent: string | null;
  consentedAt: string;
  revokedAt: string | null;
}

export default function Consents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/consents", channelFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (channelFilter !== "all") params.set("channel", channelFilter);
      params.set("limit", limit.toString());
      params.set("offset", (page * limit).toString());
      const res = await fetch(`/api/consents?${params}`);
      if (!res.ok) throw new Error("Failed to fetch consents");
      return res.json() as Promise<{ consents: NotificationConsent[]; total: number; limit: number; offset: number }>;
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consents/${id}/revoke`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to revoke consent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consents"] });
      toast({
        title: "Consent Revoked",
        description: "The notification consent has been revoked.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Revoke Failed",
        description: "Could not revoke consent. Please try again.",
        variant: "destructive"
      });
    },
  });

  const consents = data?.consents || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Notification Consent Records
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage user opt-in records for compliance with SMS/Email regulations
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by channel:</span>
          <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[150px]" data-testid="select-channel-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="text-sm">
          {total} total records
        </Badge>
      </div>

      <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Consent Log</CardTitle>
          <CardDescription>
            Each record represents explicit user consent for receiving notifications. 
            This data can be shared with Twilio via the compliance endpoint for regulatory verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : consents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No consent records found. Records are created when users enable notifications.
            </div>
          ) : (
            <div className="space-y-4">
              {consents.map((consent) => (
                <div
                  key={consent.id}
                  className={`p-4 rounded-lg border ${consent.revokedAt ? 'border-destructive/30 bg-destructive/5' : 'border-sidebar-border bg-sidebar/20'} animate-fade-in`}
                  data-testid={`consent-record-${consent.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        {consent.channel === 'email' ? (
                          <Mail className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Smartphone className="w-5 h-5 text-green-400" />
                        )}
                        <Badge variant={consent.channel === 'email' ? 'default' : 'secondary'}>
                          {consent.channel.toUpperCase()}
                        </Badge>
                        {consent.revokedAt ? (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="w-3 h-3" />
                            Revoked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-400 border-green-400/30 gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Destination:</span>
                          <p className="font-mono text-xs">{consent.destination}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">User:</span>
                          <p className="font-mono text-xs">{consent.userEmail || consent.userId}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Method:</span>
                          <p className="capitalize">{consent.consentMethod}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Source:</span>
                          <p>{consent.sourceContext}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Consented At:</span>
                          <p>{format(new Date(consent.consentedAt), "MMM d, yyyy 'at' h:mm a")}</p>
                        </div>
                        {consent.revokedAt && (
                          <div>
                            <span className="text-muted-foreground">Revoked At:</span>
                            <p>{format(new Date(consent.revokedAt), "MMM d, yyyy 'at' h:mm a")}</p>
                          </div>
                        )}
                        {consent.ipAddress && (
                          <div>
                            <span className="text-muted-foreground">IP Address:</span>
                            <p className="font-mono text-xs">{consent.ipAddress}</p>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-sidebar-border/50">
                        <span className="text-muted-foreground text-xs">Consent Text:</span>
                        <p className="text-xs text-muted-foreground/80 italic mt-1">"{consent.consentText}"</p>
                      </div>
                    </div>

                    {!consent.revokedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => revokeMutation.mutate(consent.id)}
                        data-testid={`button-revoke-${consent.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-sidebar-border mt-6">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">Compliance Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            For Twilio compliance verification, consent records are available via a secure URL:
          </p>
          <code className="block p-3 rounded bg-black/30 text-xs font-mono text-green-400">
            /compliance/consents?token=YOUR_COMPLIANCE_ACCESS_TOKEN
          </code>
          <p className="text-xs text-muted-foreground">
            The token is set in your environment as <code>COMPLIANCE_ACCESS_TOKEN</code>. 
            Share this URL with Twilio only when required for regulatory verification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
