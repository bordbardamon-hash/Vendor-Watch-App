import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Brain, AlertTriangle, Calendar, TrendingUp, Clock, CheckCircle, X, ThumbsUp, ThumbsDown, Sparkles, Activity } from "lucide-react";

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

export default function Predictions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");

  const { data: predictions = [], isLoading, error } = useQuery<Prediction[]>({
    queryKey: ["/api/predictions"],
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

  const highRiskPredictions = predictions.filter(p => p.severity === 'critical' || p.severity === 'high');
  const upcomingToday = predictions.filter(p => {
    const date = new Date(p.predictedStartAt);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container py-6 max-w-6xl" data-testid="predictions-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Predictive Analytics
          </h1>
          <p className="text-muted-foreground">AI-powered outage forecasting based on historical patterns</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{predictions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{highRiskPredictions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingToday.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {predictions.length > 0
                ? Math.round(predictions.reduce((acc, p) => acc + parseFloat(p.confidence), 0) / predictions.length * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Predictions</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {predictions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Predictions</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  The AI hasn't detected any upcoming outage patterns. This is good news!
                  Predictions will appear here when patterns are detected.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {predictions.map((prediction) => (
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
                          <h3 className="font-medium">{prediction.title}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(prediction.predictedStartAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatTime(prediction.predictedStartAt)}
                            </span>
                            <Badge variant="outline" className="capitalize">
                              {prediction.resourceType}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-sm font-medium ${SEVERITY_TEXT[prediction.severity] || 'text-gray-600'}`}>
                            {prediction.severity.charAt(0).toUpperCase() + prediction.severity.slice(1)} Risk
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            {Math.round(parseFloat(prediction.confidence) * 100)}% confidence
                          </div>
                        </div>
                        {prediction.acknowledgedAt && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${SEVERITY_COLORS[selectedPrediction.severity]}`} />
                {selectedPrediction.title}
              </DialogTitle>
              <DialogDescription>
                Predicted for {formatDate(selectedPrediction.predictedStartAt)} at {formatTime(selectedPrediction.predictedStartAt)}
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
                <span className="text-sm text-muted-foreground">Resource Type</span>
                <Badge variant="outline" className="capitalize">{selectedPrediction.resourceType}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Resource</span>
                <span className="font-medium">{selectedPrediction.vendorKey || selectedPrediction.chainKey}</span>
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
                  />
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {!selectedPrediction.acknowledgedAt && (
                <Button
                  variant="outline"
                  onClick={() => acknowledgeMutation.mutate(selectedPrediction.id)}
                  disabled={acknowledgeMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Acknowledge
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => dismissMutation.mutate(selectedPrediction.id)}
                disabled={dismissMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
              {!selectedPrediction.feedbackScore && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => feedbackMutation.mutate({
                      id: selectedPrediction.id,
                      score: 1,
                      notes: feedbackNotes,
                    })}
                    className="text-green-600"
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    Helpful
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => feedbackMutation.mutate({
                      id: selectedPrediction.id,
                      score: -1,
                      notes: feedbackNotes,
                    })}
                    className="text-red-600"
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
    </div>
  );
}

const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>
    {children}
  </label>
);
