import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Brain, AlertTriangle, Calendar, TrendingUp, Clock, CheckCircle, X, ThumbsUp, ThumbsDown,
  Sparkles, Activity, RefreshCw, Users, Shield, Plus, Send, Filter
} from "lucide-react";

interface Prediction {
  id: string;
  vendorKey: string | null;
  chainKey: string | null;
  resourceType: string;
  predictionType: string;
  severity: string;
  confidence: string;
  title: string;
  description: string | null;
  predictedStartAt: string;
  predictedEndAt: string | null;
  status: string;
  acknowledgedAt: string | null;
  feedbackScore: number | null;
  source: string;
  createdAt: string;
}

interface CalendarData {
  [date: string]: Prediction[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: "text-red-600",
  high: "text-orange-600",
  medium: "text-yellow-600",
  low: "text-blue-600",
};

function getConfidenceBadge(confidence: string) {
  const pct = Math.round(parseFloat(confidence) * 100);
  if (pct > 80) return { color: "bg-red-500/20 text-red-400 border-red-500/30", label: `${pct}%` };
  if (pct > 50) return { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: `${pct}%` };
  return { color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", label: `${pct}%` };
}

export default function Predictions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [filterSource, setFilterSource] = useState<"all" | "ai" | "crowdsourced">("all");
  const [reportForm, setReportForm] = useState({
    vendorKey: "",
    issueType: "" as string,
    description: "",
    severity: "" as string,
  });
  
  const isAdmin = user?.isAdmin || user?.isOwner;

  const { data: predictions = [], isLoading, error } = useQuery<Prediction[]>({
    queryKey: ["/api/predictions"],
  });

  const { data: vendors = [] } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: calendarData } = useQuery<CalendarData>({
    queryKey: ["/api/predictions/calendar"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/predictions/${id}/acknowledge`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to acknowledge");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      toast({ title: "Prediction acknowledged" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/predictions/${id}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to dismiss");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      setSelectedPrediction(null);
      toast({ title: "Prediction dismissed" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ id, score, notes }: { id: string; score: number; notes: string }) => {
      const res = await fetch(`/api/predictions/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, notes }),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      setSelectedPrediction(null);
      toast({ title: "Feedback submitted" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/predictions/regenerate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate predictions");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/calendar"] });
      toast({ 
        title: "Predictions Regenerated", 
        description: data.message 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to regenerate predictions", variant: "destructive" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: typeof reportForm) => {
      const res = await fetch("/api/predictions/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit report");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      setReportOpen(false);
      setReportForm({ vendorKey: "", issueType: "", description: "", severity: "" });
      toast({ title: "Report Submitted", description: "Your crowdsourced report has been recorded." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (error) {
    const errorMessage = (error as any)?.message || "An error occurred";
    if (errorMessage.includes("Enterprise")) {
      return (
        <div className="container py-6 max-w-6xl">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Enterprise Feature</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Predictive analytics uses AI to forecast potential outages based on historical patterns.
                Upgrade to Enterprise to access this feature.
              </p>
              <Button asChild>
                <a href="/pricing">View Plans</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const activePredictions = predictions.filter(p => p.status === 'active');
  const crowdsourcedReports = predictions.filter(p => p.source === 'crowdsourced');
  const resolvedPredictions = predictions.filter(p => p.status === 'dismissed' || p.status === 'occurred' || p.status === 'false_positive');
  
  const filteredPredictions = predictions.filter(p => {
    if (p.status !== 'active') return false;
    if (filterSource === "ai") return p.source === "ai";
    if (filterSource === "crowdsourced") return p.source === "crowdsourced";
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleReportSubmit = () => {
    if (!reportForm.vendorKey || !reportForm.issueType || !reportForm.description || !reportForm.severity) {
      toast({ title: "Missing fields", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    reportMutation.mutate(reportForm);
  };

  return (
    <div className="container py-6 max-w-6xl" data-testid="predictions-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Early Warning Signals
          </h1>
          <p className="text-muted-foreground">AI-powered outage forecasting & crowdsourced reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            onClick={() => setReportOpen(true)}
            data-testid="button-report-issue"
          >
            <Plus className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              data-testid="button-regenerate-predictions"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
              {regenerateMutation.isPending ? 'Regenerating...' : 'Refresh Predictions'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card data-testid="card-active-predictions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Active Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400" data-testid="text-active-count">{activePredictions.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-crowdsourced-reports">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" />
              Crowdsourced Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-400" data-testid="text-crowdsourced-count">{crowdsourcedReports.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-resolved-count">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resolved-count">{resolvedPredictions.length}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-confidence">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-confidence">
              {predictions.length > 0
                ? Math.round(predictions.reduce((acc, p) => acc + parseFloat(p.confidence), 0) / predictions.length * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list" data-testid="tab-predictions-list">Predictions</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-predictions-calendar">Calendar View</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterSource} onValueChange={(v: "all" | "ai" | "crowdsourced") => setFilterSource(v)}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-source">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="filter-option-all">All</SelectItem>
                <SelectItem value="ai" data-testid="filter-option-ai">AI Predictions</SelectItem>
                <SelectItem value="crowdsourced" data-testid="filter-option-crowdsourced">Crowdsourced Reports</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="list" className="space-y-4">
          {filteredPredictions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Predictions Found</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {filterSource !== "all"
                    ? `No ${filterSource === "ai" ? "AI predictions" : "crowdsourced reports"} found. Try changing the filter.`
                    : "The AI hasn't detected any upcoming outage patterns. Submit a report if you notice issues!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3" data-testid="predictions-list">
              {filteredPredictions.map((prediction) => {
                const confidenceBadge = getConfidenceBadge(prediction.confidence);
                return (
                  <Card
                    key={prediction.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedPrediction(prediction)}
                    data-testid={`prediction-card-${prediction.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`mt-1 h-3 w-3 rounded-full ${SEVERITY_COLORS[prediction.severity] || 'bg-gray-400'}`} />
                          <div>
                            <h3 className="font-medium" data-testid={`text-prediction-title-${prediction.id}`}>{prediction.title}</h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1" data-testid={`text-vendor-${prediction.id}`}>
                                {prediction.vendorKey || prediction.chainKey || 'Unknown'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(prediction.createdAt)}
                              </span>
                              <Badge
                                variant="outline"
                                className={prediction.source === 'crowdsourced' ? 'border-cyan-500/50 text-cyan-400' : 'border-emerald-500/50 text-emerald-400'}
                                data-testid={`badge-source-${prediction.id}`}
                              >
                                {prediction.source === 'crowdsourced' ? (
                                  <><Users className="h-3 w-3 mr-1" />Crowdsourced</>
                                ) : (
                                  <><Brain className="h-3 w-3 mr-1" />AI</>
                                )}
                              </Badge>
                              <Badge variant="outline" className="capitalize" data-testid={`badge-status-${prediction.id}`}>
                                {prediction.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className={`text-sm font-medium ${SEVERITY_TEXT[prediction.severity] || 'text-gray-600'}`}>
                              {prediction.severity.charAt(0).toUpperCase() + prediction.severity.slice(1)} Risk
                            </div>
                            <Badge variant="outline" className={`text-xs ${confidenceBadge.color}`} data-testid={`badge-confidence-${prediction.id}`}>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {confidenceBadge.label}
                            </Badge>
                          </div>
                          {prediction.acknowledgedAt && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>7-Day Forecast</CardTitle>
              <CardDescription>Predicted incidents for the upcoming week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  const dateStr = date.toISOString().split('T')[0];
                  const dayPredictions = calendarData?.[dateStr] || [];
                  
                  return (
                    <div key={i} className="p-3 rounded-lg border min-h-[120px]">
                      <div className="text-sm font-medium mb-2">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        <span className="ml-1 text-muted-foreground">{date.getDate()}</span>
                      </div>
                      <div className="space-y-1">
                        {dayPredictions.slice(0, 3).map((p: any) => (
                          <div
                            key={p.id}
                            className={`text-xs p-1 rounded ${SEVERITY_COLORS[p.severity]} text-white truncate`}
                          >
                            {p.vendorKey || p.chainKey}
                          </div>
                        ))}
                        {dayPredictions.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayPredictions.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedPrediction && (
        <Dialog open={!!selectedPrediction} onOpenChange={() => setSelectedPrediction(null)}>
          <DialogContent className="max-w-xl w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${SEVERITY_COLORS[selectedPrediction.severity]}`} />
                {selectedPrediction.title}
              </DialogTitle>
              <DialogDescription>
                {selectedPrediction.source === 'crowdsourced' ? 'Crowdsourced Report' : 'AI Prediction'} • {formatDate(selectedPrediction.predictedStartAt)} at {formatTime(selectedPrediction.predictedStartAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Confidence Level</span>
                <div className="flex items-center gap-2 w-1/2">
                  <Progress value={parseFloat(selectedPrediction.confidence) * 100} />
                  <span className="text-sm font-medium">
                    {Math.round(parseFloat(selectedPrediction.confidence) * 100)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Source</span>
                <Badge
                  variant="outline"
                  className={selectedPrediction.source === 'crowdsourced' ? 'border-cyan-500/50 text-cyan-400' : 'border-emerald-500/50 text-emerald-400'}
                >
                  {selectedPrediction.source === 'crowdsourced' ? 'Crowdsourced' : 'AI'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Resource Type</span>
                <Badge variant="outline" className="capitalize">{selectedPrediction.resourceType}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Resource</span>
                <span className="font-medium">{selectedPrediction.vendorKey || selectedPrediction.chainKey}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline" className="capitalize">{selectedPrediction.status}</Badge>
              </div>
              {selectedPrediction.description && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">{selectedPrediction.description}</p>
                </div>
              )}
              {!selectedPrediction.feedbackScore && (
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium">Was this prediction helpful?</Label>
                  <Textarea
                    placeholder="Optional notes..."
                    className="mt-2"
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    data-testid="input-feedback-notes"
                  />
                </div>
              )}
            </div>
            <DialogFooter className="flex-wrap gap-2">
              {!selectedPrediction.acknowledgedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => acknowledgeMutation.mutate(selectedPrediction.id)}
                  disabled={acknowledgeMutation.isPending}
                  data-testid="button-acknowledge-prediction"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Acknowledge
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => dismissMutation.mutate(selectedPrediction.id)}
                disabled={dismissMutation.isPending}
                data-testid="button-dismiss-prediction"
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
              {!selectedPrediction.feedbackScore && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => feedbackMutation.mutate({
                      id: selectedPrediction.id,
                      score: 1,
                      notes: feedbackNotes,
                    })}
                    className="text-green-600"
                    data-testid="button-feedback-helpful"
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    Helpful
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => feedbackMutation.mutate({
                      id: selectedPrediction.id,
                      score: -1,
                      notes: feedbackNotes,
                    })}
                    className="text-red-600"
                    data-testid="button-feedback-not-helpful"
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    Not Helpful
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full" data-testid="dialog-report-issue">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Report an Issue
            </DialogTitle>
            <DialogDescription>
              Submit a crowdsourced degradation report for a vendor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vendor</Label>
              <Select value={reportForm.vendorKey} onValueChange={(v) => setReportForm(f => ({ ...f, vendorKey: v }))}>
                <SelectTrigger data-testid="select-report-vendor">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v: any) => (
                    <SelectItem key={v.key} value={v.key} data-testid={`vendor-option-${v.key}`}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Issue Type</Label>
              <Select value={reportForm.issueType} onValueChange={(v) => setReportForm(f => ({ ...f, issueType: v }))}>
                <SelectTrigger data-testid="select-report-issue-type">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="degradation" data-testid="issue-type-degradation">Degradation</SelectItem>
                  <SelectItem value="outage" data-testid="issue-type-outage">Outage</SelectItem>
                  <SelectItem value="intermittent" data-testid="issue-type-intermittent">Intermittent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Severity</Label>
              <Select value={reportForm.severity} onValueChange={(v) => setReportForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger data-testid="select-report-severity">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" data-testid="severity-low">Low</SelectItem>
                  <SelectItem value="medium" data-testid="severity-medium">Medium</SelectItem>
                  <SelectItem value="high" data-testid="severity-high">High</SelectItem>
                  <SelectItem value="critical" data-testid="severity-critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                placeholder="Describe the issue you're experiencing..."
                value={reportForm.description}
                onChange={(e) => setReportForm(f => ({ ...f, description: e.target.value }))}
                className="min-h-[80px]"
                data-testid="input-report-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)} data-testid="button-cancel-report">
              Cancel
            </Button>
            <Button
              onClick={handleReportSubmit}
              disabled={reportMutation.isPending}
              data-testid="button-submit-report"
            >
              <Send className="h-4 w-4 mr-2" />
              {reportMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>
    {children}
  </label>
);
