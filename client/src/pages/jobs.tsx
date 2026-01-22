import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Trash2, Clock, Globe, AlertCircle, RotateCw, FlaskConical, CheckCircle2, History, Loader2, Eraser } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { stableHash } from "@/lib/hash";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Job {
  id: string;
  name: string;
  target: string;
  schedule: string;
  status: string;
  lastRun?: string | null;
  nextRun?: string | null;
  success: boolean;
  createdAt: string;
}

export default function Jobs() {
  const [schedulerActive, setSchedulerActive] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch jobs
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const res = await fetch("/api/jobs");
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
  });

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Job> }) => {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update job");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete job");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({
        title: "Job Deleted",
        description: "Successfully deleted job",
      });
    },
  });

  // Cleanup stale incidents mutation
  const cleanupStaleMutation = useMutation({
    mutationFn: async (staleDays: number = 7) => {
      const res = await fetch("/api/admin/cleanup-stale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staleDays }),
      });
      if (!res.ok) throw new Error("Failed to cleanup stale incidents");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Stale Incidents Cleaned",
        description: `Resolved ${data.resolved.total} stale incidents (${data.resolved.vendor} vendor, ${data.resolved.blockchain} blockchain)`,
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Cleanup Failed",
        description: "Failed to cleanup stale incidents",
        variant: "destructive"
      });
    },
  });

  const toggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "running" ? "idle" : "running";
    updateJobMutation.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({
            title: `Job ${newStatus === "running" ? "Started" : "Stopped"}`,
            description: `Successfully ${newStatus === "running" ? "started" : "stopped"} job`,
          });
        },
      }
    );
  };

  const formatTime = (date: string | null | undefined) => {
    if (!date) return "--:--:--";
    const diff = new Date(date).getTime() - Date.now();
    if (diff <= 0) return "Ready";
    
    const seconds = Math.floor(diff / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatLastRun = (date: string | null | undefined) => {
    if (!date) return "Never";
    const diff = Date.now() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  if (isLoading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Scheduler</h1>
            <p className="text-muted-foreground mt-1">Manage and monitor your Python monitoring tasks</p>
          </div>
          <div className="h-8 w-px bg-border mx-2" />
          <div className="flex items-center gap-2 bg-sidebar/50 px-3 py-1.5 rounded-full border border-sidebar-border">
            <div className={`w-2 h-2 rounded-full ${schedulerActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-mono text-muted-foreground">
              SCHEDULER: {schedulerActive ? 'ONLINE' : 'HALTED'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
            <Button 
                variant="outline" 
                size="sm"
                onClick={() => cleanupStaleMutation.mutate(7)}
                disabled={cleanupStaleMutation.isPending}
                className="bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20"
                data-testid="button-cleanup-stale"
            >
                {cleanupStaleMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eraser className="w-4 h-4 mr-2" />
                )}
                Cleanup Stale
            </Button>
            <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSchedulerActive(!schedulerActive)}
                className={!schedulerActive ? "bg-red-500/10 text-red-500 border-red-500/20" : ""}
                data-testid="button-toggle-scheduler"
            >
                {schedulerActive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {schedulerActive ? "Pause System" : "Resume System"}
            </Button>
            <NewJobDialog />
        </div>
      </div>

      <div className="grid gap-4">
        {jobs.map((job, index) => (
          <Card 
            key={job.id} 
            className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm transition-all duration-200 hover:bg-sidebar/50 hover:-translate-y-0.5 animate-fade-in-up opacity-0" 
            style={{ animationDelay: `${index * 60}ms` }}
            data-testid={`card-job-${job.id}`}
          >
            <CardContent className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 md:gap-6 min-w-0">
                <div className={`p-2 md:p-3 rounded-full shrink-0 ${job.status === 'running' ? 'bg-primary/20 text-primary animate-pulse' : 'bg-secondary text-muted-foreground'}`}>
                  <RotateCw size={20} className={job.status === 'running' ? 'animate-spin' : ''} />
                </div>
                
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-base md:text-lg truncate" data-testid={`text-job-name-${job.id}`}>{job.name}</h3>
                    <Badge variant={job.status === 'running' ? 'default' : 'secondary'} className={job.status === 'running' ? 'bg-primary/20 text-primary border-primary/20 hover:bg-primary/30' : ''} data-testid={`badge-status-${job.id}`}>
                      {job.status}
                    </Badge>
                    {!job.success && (
                      <Badge variant="destructive" className="bg-red-500/20 text-red-500 border-red-500/20 hover:bg-red-500/30">
                        Failed
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground font-mono">
                    <span className="flex items-center gap-1 truncate"><Globe size={12} /> <span className="truncate max-w-[120px] md:max-w-none">{job.target}</span></span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {job.schedule}</span>
                    <span className="text-xs opacity-50 hidden md:inline">Last: {formatLastRun(job.lastRun)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 pl-9 md:pl-0">
                <div className="text-left md:text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Next Run In</p>
                    <p className={`font-mono text-lg md:text-xl font-bold ${job.status === 'running' ? 'text-primary' : 'text-muted-foreground opacity-50'}`}>
                        {job.status === 'running' ? formatTime(job.nextRun) : 'Ready'}
                    </p>
                </div>
                <div className="h-10 w-px bg-sidebar-border mx-2 hidden md:block" />
                <div className="flex items-center gap-2 md:gap-3">
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => toggleStatus(job.id, job.status)}
                      className="rounded-full hover:bg-primary/20 hover:text-primary border-sidebar-border h-9 w-9"
                      data-testid={`button-toggle-${job.id}`}
                    >
                      {job.status === 'running' ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full h-9 w-9"
                      onClick={() => deleteJobMutation.mutate(job.id)}
                      data-testid={`button-delete-${job.id}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewJobDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("configure");
  const [testUrl, setTestUrl] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [simulateChange, setSimulateChange] = useState(false);
  const [changeStatus, setChangeStatus] = useState<string | null>(null);
  const [alertPreview, setAlertPreview] = useState<{subject: string, body: string} | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    target: "",
    schedule: "Every 1h",
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          status: "idle",
          success: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create job");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({
        title: "Job Created",
        description: "New monitoring job has been added to the queue.",
      });
      setFormData({ name: "", target: "", schedule: "Every 1h" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createJobMutation.mutate(formData);
  };

  const handleTestMonitor = async () => {
    if (!testUrl) return;
    
    if (testResult) {
      setLastResult(testResult);
    }
    
    setIsTesting(true);
    
    setTimeout(async () => {
      let mockText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Status Update: System is fully operational as of today.";
      
      if (simulateChange) {
        mockText += " [UPDATED: Service degradation detected in eu-west-1]";
      }

      const incidentId = await stableHash(testUrl);
      const rawHash = await stableHash(mockText);
      
      const result = {
        "vendor_key": "custom_vendor",
        "incident_id": incidentId.substring(0, 16),
        "title": simulateChange ? "Status Update: Degradation" : "Status Update: Operational",
        "status": "page_change",
        "severity": simulateChange ? "MAJOR" : "UNKNOWN",
        "impact": simulateChange ? "Service degradation" : "",
        "url": testUrl,
        "raw_hash": rawHash
      };

      setTestResult([result]);
      
      if (lastResult && lastResult[0]) {
        const oldHash = lastResult[0].raw_hash;
        if (oldHash !== rawHash) {
          setChangeStatus("CHANGED");
          toast({
             title: "Change Detected",
             description: "Content hash mismatch found. New incident generated.",
             variant: "default", 
             className: "border-primary text-primary-foreground bg-primary"
          });
          setAlertPreview({
            subject: `🚨 custom_vendor status update`,
            body: `${result.title}\n${result.url}`
          });
        } else {
          setChangeStatus("NO_CHANGE");
          setAlertPreview(null);
        }
      } else {
        setChangeStatus("NEW_INCIDENT");
        setAlertPreview({
          subject: `🚨 custom_vendor status update`,
          body: `${result.title}\n${result.url}`
        });
      }

      setIsTesting(false);
    }, 1000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-new-job">
          + New Monitor Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] bg-sidebar border-sidebar-border">
        <DialogHeader>
          <DialogTitle>Job Configuration</DialogTitle>
          <DialogDescription>
            Configure a monitoring task or test the parser logic.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-black/20">
            <TabsTrigger value="configure">Configure Job</TabsTrigger>
            <TabsTrigger value="test">Test Monitor</TabsTrigger>
          </TabsList>
          
          <TabsContent value="configure" className="py-4">
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Job Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Price Monitor" 
                  className="bg-background" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-job-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">Target URL</Label>
                <Input 
                  id="url" 
                  placeholder="https://..." 
                  className="bg-background" 
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  data-testid="input-job-target"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="schedule">Schedule</Label>
                  <Select 
                    value={formData.schedule}
                    onValueChange={(value) => setFormData({ ...formData, schedule: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Every 5m">Every 5m</SelectItem>
                      <SelectItem value="Every 10m">Every 10m</SelectItem>
                      <SelectItem value="Every 1h">Hourly</SelectItem>
                      <SelectItem value="Every 6h">Every 6h</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="mt-4 w-full" data-testid="button-submit-job">Create Job</Button>
            </form>
          </TabsContent>

          <TabsContent value="test" className="py-4 space-y-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="test-url">Test URL</Label>
                <div className="flex gap-2">
                  <Input 
                    id="test-url" 
                    placeholder="https://example.com/status" 
                    className="bg-background font-mono text-sm"
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    data-testid="input-test-url"
                  />
                  <Button onClick={handleTestMonitor} disabled={isTesting || !testUrl} data-testid="button-run-test">
                    {isTesting ? <RotateCw className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                    <span className="ml-2">Run Test</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between bg-black/20 p-3 rounded-md border border-sidebar-border">
                <div className="flex items-center gap-2">
                   <Switch 
                     id="simulate-change" 
                     checked={simulateChange}
                     onCheckedChange={setSimulateChange}
                   />
                   <Label htmlFor="simulate-change" className="text-xs font-normal cursor-pointer">Simulate Content Update</Label>
                </div>
                
                {changeStatus && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground uppercase">Result:</span>
                    <Badge variant="outline" className={`
                      ${changeStatus === 'CHANGED' ? 'border-primary text-primary bg-primary/10' : 
                        changeStatus === 'NEW_INCIDENT' ? 'border-blue-500 text-blue-500 bg-blue-500/10' : 
                        'border-muted text-muted-foreground'}
                    `}>
                      {changeStatus === 'CHANGED' ? 'CHANGE DETECTED' : 
                       changeStatus === 'NEW_INCIDENT' ? 'NEW INCIDENT' : 'NO CHANGE'}
                    </Badge>
                  </div>
                )}
              </div>

              {testResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lastResult && (
                    <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <History className="w-3 h-3" /> Previous State
                      </div>
                      <div className="rounded-md border border-sidebar-border bg-black/40 overflow-hidden">
                        <ScrollArea className="h-[200px] w-full p-4">
                          <pre className="text-xs font-mono text-muted-foreground">
                            {JSON.stringify(lastResult, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  )}

                  <div className={`space-y-2 ${!lastResult ? 'col-span-2' : ''}`}>
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <CheckCircle2 className="w-3 h-3" /> Current State
                    </div>
                    <div className="rounded-md border border-primary/30 bg-black/40 overflow-hidden shadow-[0_0_15px_-5px_hsl(var(--primary))]">
                      <ScrollArea className="h-[200px] w-full p-4">
                        <pre className="text-xs font-mono text-primary/80">
                          {JSON.stringify(testResult, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              )}

              {alertPreview && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-500 font-medium text-xs uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4" />
                    Alert Triggered
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[60px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">Subject:</span>
                      <span className="font-medium text-foreground">{alertPreview.subject}</span>
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">Body:</span>
                      <pre className="font-sans whitespace-pre-wrap text-muted-foreground/80">{alertPreview.body}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
