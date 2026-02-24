import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle, RefreshCw, RotateCcw, Clock, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface ParserHealth {
  id: number;
  vendorKey: string;
  vendorName: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  lastHttpStatus: number | null;
  lastErrorMessage: string | null;
  incidentsParsed: number;
  isHealthy: boolean;
  alertSentAt: string | null;
  updatedAt: string;
}

interface ParserHealthResponse {
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  parsers: ParserHealth[];
}

export default function ParserHealthPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<ParserHealthResponse>({
    queryKey: ["/api/parser-health"],
    queryFn: async () => {
      const res = await fetch("/api/parser-health");
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Owner access required");
        }
        throw new Error("Failed to fetch parser health");
      }
      return res.json();
    },
    refetchInterval: 30000,
  });

  const resetMutation = useMutation({
    mutationFn: async (vendorKey: string) => {
      const res = await fetch(`/api/parser-health/${vendorKey}/reset`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: (_, vendorKey) => {
      toast({
        title: "Parser Reset",
        description: `Parser health for ${vendorKey} has been reset.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/parser-health"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset parser health.",
        variant: "destructive",
      });
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/parser-health/reset-all-unhealthy", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "All Unhealthy Parsers Reset",
        description: `Successfully reset ${data.resetCount} unhealthy parsers.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/parser-health"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset unhealthy parsers.",
        variant: "destructive",
      });
    },
  });

  if (error) {
    return (
      <div className="flex flex-col h-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="w-6 h-6 text-primary" />
            Parser Health
          </h1>
        </div>
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const successRate = (parser: ParserHealth) => {
    const total = parser.totalSuccesses + parser.totalFailures;
    if (total === 0) return 100;
    return Math.round((parser.totalSuccesses / total) * 100);
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6 text-primary" />
          Parser Health Monitor
        </h1>
        <div className="flex items-center gap-2">
          {data && data.summary.unhealthy > 0 && (
            <Button
              variant="destructive"
              onClick={() => resetAllMutation.mutate()}
              disabled={resetAllMutation.isPending}
              data-testid="button-reset-all-unhealthy"
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${resetAllMutation.isPending ? "animate-spin" : ""}`} />
              Reset All Unhealthy ({data.summary.unhealthy})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await refetch();
              toast({ title: "Refreshed", description: "Parser health data updated" });
            }}
            disabled={isLoading}
            data-testid="button-refresh-parser-health"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card data-testid="card-total-parsers">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.summary.total}</p>
                  <p className="text-sm text-muted-foreground">Total Parsers</p>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-healthy-parsers">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{data.summary.healthy}</p>
                  <p className="text-sm text-muted-foreground">Healthy</p>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-unhealthy-parsers">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-red-500/10">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{data.summary.unhealthy}</p>
                  <p className="text-sm text-muted-foreground">Unhealthy</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Parser Status</CardTitle>
              <CardDescription>
                Real-time health status of all vendor status page parsers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.parsers.map((parser) => (
                  <div
                    key={parser.vendorKey}
                    className={`p-4 rounded-lg border ${
                      parser.isHealthy
                        ? "border-border bg-card"
                        : "border-red-500/50 bg-red-500/5"
                    }`}
                    data-testid={`parser-row-${parser.vendorKey}`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            parser.isHealthy ? "bg-green-500" : "bg-red-500 animate-pulse"
                          }`}
                        />
                        <div>
                          <p className="font-medium">{parser.vendorName}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {parser.vendorKey}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant={parser.isHealthy ? "secondary" : "destructive"}>
                          {parser.isHealthy ? "Healthy" : "Unhealthy"}
                        </Badge>
                        <Badge variant="outline" className="font-mono">
                          {successRate(parser)}% success
                        </Badge>
                        {parser.lastHttpStatus && (
                          <Badge
                            variant="outline"
                            className={
                              parser.lastHttpStatus >= 200 && parser.lastHttpStatus < 300
                                ? "text-green-500 border-green-500/50"
                                : parser.lastHttpStatus >= 400
                                ? "text-red-500 border-red-500/50"
                                : "text-yellow-500 border-yellow-500/50"
                            }
                          >
                            HTTP {parser.lastHttpStatus}
                          </Badge>
                        )}
                        {!parser.isHealthy && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resetMutation.mutate(parser.vendorKey)}
                            disabled={resetMutation.isPending}
                            data-testid={`button-reset-${parser.vendorKey}`}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Consecutive Failures</p>
                        <p className={`font-mono ${parser.consecutiveFailures > 0 ? "text-red-500" : ""}`}>
                          {parser.consecutiveFailures}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Success/Fail</p>
                        <p className="font-mono">
                          <span className="text-green-500">{parser.totalSuccesses}</span>
                          {" / "}
                          <span className="text-red-500">{parser.totalFailures}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Success</p>
                        <p className="font-mono text-xs">
                          {parser.lastSuccessAt
                            ? formatDistanceToNow(new Date(parser.lastSuccessAt), { addSuffix: true })
                            : "Never"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last Failure</p>
                        <p className="font-mono text-xs">
                          {parser.lastFailureAt
                            ? formatDistanceToNow(new Date(parser.lastFailureAt), { addSuffix: true })
                            : "Never"}
                        </p>
                      </div>
                    </div>
                    {parser.lastErrorMessage && (
                      <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-muted-foreground">Last Error:</p>
                        <p className="text-sm text-red-400 font-mono break-all">
                          {parser.lastErrorMessage}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
