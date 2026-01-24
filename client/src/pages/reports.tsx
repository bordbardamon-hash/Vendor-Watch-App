import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FileText, 
  Download, 
  Trash2, 
  Lock, 
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";

interface UptimeReport {
  id: string;
  userId: string;
  organizationId?: string;
  reportType: string;
  name: string;
  vendorKeys?: string[];
  chainKeys?: string[];
  startDate: string;
  endDate: string;
  status: string;
  fileUrl?: string;
  fileSize?: number;
  generatedAt?: string;
  createdAt: string;
}

interface ReportSchedule {
  id: string;
  userId: string;
  name: string;
  frequency: string;
  vendorKeys?: string[];
  chainKeys?: string[];
  recipients?: string[];
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

interface Vendor {
  key: string;
  name: string;
}

interface BlockchainChain {
  key: string;
  name: string;
}

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [createReportOpen, setCreateReportOpen] = useState(false);
  const [createScheduleOpen, setCreateScheduleOpen] = useState(false);
  
  const [reportForm, setReportForm] = useState({
    name: "",
    reportType: "monthly",
    startDate: "",
    endDate: "",
    vendorKeys: [] as string[],
    chainKeys: [] as string[],
  });
  
  const [scheduleForm, setScheduleForm] = useState({
    name: "",
    frequency: "monthly",
    vendorKeys: [] as string[],
    chainKeys: [] as string[],
    recipients: "",
  });

  const tier = user?.subscriptionTier;
  const hasAccess = tier === 'growth' || tier === 'enterprise' || tier === 'platinum';

  const { data: reports = [], isLoading: loadingReports } = useQuery<UptimeReport[]>({
    queryKey: ["/api/reports"],
    enabled: hasAccess,
  });

  const { data: schedules = [], isLoading: loadingSchedules } = useQuery<ReportSchedule[]>({
    queryKey: ["/api/report-schedules"],
    enabled: hasAccess,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: hasAccess,
  });

  const { data: chains = [] } = useQuery<BlockchainChain[]>({
    queryKey: ["/api/blockchain/chains"],
    enabled: hasAccess,
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: typeof reportForm) => {
      return apiRequest("POST", "/api/reports", {
        name: data.name,
        reportType: data.reportType,
        startDate: data.startDate,
        endDate: data.endDate,
        vendorKeys: data.vendorKeys.length > 0 ? data.vendorKeys : null,
        chainKeys: data.chainKeys.length > 0 ? data.chainKeys : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setCreateReportOpen(false);
      setReportForm({ name: "", reportType: "monthly", startDate: "", endDate: "", vendorKeys: [], chainKeys: [] });
      toast({ title: "Report created", description: "Your report is being generated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create report", variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Report deleted" });
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: typeof scheduleForm) => {
      return apiRequest("POST", "/api/report-schedules", {
        name: data.name,
        frequency: data.frequency,
        vendorKeys: data.vendorKeys.length > 0 ? data.vendorKeys : null,
        chainKeys: data.chainKeys.length > 0 ? data.chainKeys : null,
        recipients: data.recipients ? data.recipients.split(",").map(e => e.trim()) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
      setCreateScheduleOpen(false);
      setScheduleForm({ name: "", frequency: "monthly", vendorKeys: [], chainKeys: [], recipients: "" });
      toast({ title: "Schedule created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create schedule", variant: "destructive" });
    },
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PUT", `/api/report-schedules/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/report-schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules"] });
      toast({ title: "Schedule deleted" });
    },
  });

  const setDatePreset = (type: string) => {
    const now = new Date();
    let start: Date;
    let end = new Date(now);
    
    if (type === "weekly") {
      start = new Date(now);
      start.setDate(start.getDate() - 7);
    } else if (type === "monthly") {
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
    } else {
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
    }
    
    setReportForm({
      ...reportForm,
      reportType: type,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "generating":
        return <Badge className="bg-blue-500/10 text-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Uptime Reports</h1>
          <p className="text-muted-foreground">Generate and schedule PDF uptime reports</p>
        </div>
        
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lock className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Growth/Enterprise Feature</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Uptime reports are available on the Growth and Enterprise plans.
              Upgrade to generate and schedule PDF reports for your vendors and blockchain infrastructure.
            </p>
            <Link href="/pricing">
              <Button data-testid="button-upgrade">Upgrade Plan</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Uptime Reports</h1>
          <p className="text-muted-foreground">Generate and schedule PDF uptime reports</p>
        </div>
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList>
          <TabsTrigger value="reports" data-testid="tab-reports">Generated Reports</TabsTrigger>
          <TabsTrigger value="schedules" data-testid="tab-schedules">Scheduled Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={createReportOpen} onOpenChange={setCreateReportOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-generate-report">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Generate Uptime Report</DialogTitle>
                  <DialogDescription>
                    Create a PDF report of uptime statistics for your monitored vendors and chains.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-name">Report Name</Label>
                    <Input
                      id="report-name"
                      placeholder="e.g., January 2026 Uptime Report"
                      value={reportForm.name}
                      onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                      data-testid="input-report-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select value={reportForm.reportType} onValueChange={(v) => setDatePreset(v)}>
                      <SelectTrigger data-testid="select-report-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly (Last 7 days)</SelectItem>
                        <SelectItem value="monthly">Monthly (Last 30 days)</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={reportForm.startDate}
                        onChange={(e) => setReportForm({ ...reportForm, startDate: e.target.value })}
                        data-testid="input-start-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={reportForm.endDate}
                        onChange={(e) => setReportForm({ ...reportForm, endDate: e.target.value })}
                        data-testid="input-end-date"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Vendors (optional, leave empty for all)</Label>
                    <Select
                      value={reportForm.vendorKeys[0] || ""}
                      onValueChange={(v) => setReportForm({ ...reportForm, vendorKeys: v ? [v] : [] })}
                    >
                      <SelectTrigger data-testid="select-vendors">
                        <SelectValue placeholder="All vendors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All vendors</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.key} value={v.key}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateReportOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createReportMutation.mutate(reportForm)}
                    disabled={!reportForm.name || !reportForm.startDate || !reportForm.endDate || createReportMutation.isPending}
                    data-testid="button-submit-report"
                  >
                    {createReportMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      "Generate Report"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loadingReports ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports</h3>
                <p className="text-muted-foreground mb-4">
                  Generate your first uptime report to get started.
                </p>
                <Button onClick={() => setCreateReportOpen(true)} data-testid="button-create-first-report">
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id} data-testid={`report-card-${report.id}`}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium">{report.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(report.status)}
                      {report.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/reports/${report.id}/download`, "_blank")}
                          data-testid={`button-download-${report.id}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteReportMutation.mutate(report.id)}
                        data-testid={`button-delete-${report.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={createScheduleOpen} onOpenChange={setCreateScheduleOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-schedule">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Report Schedule</DialogTitle>
                  <DialogDescription>
                    Automatically generate reports on a recurring schedule.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-name">Schedule Name</Label>
                    <Input
                      id="schedule-name"
                      placeholder="e.g., Monthly Uptime Summary"
                      value={scheduleForm.name}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                      data-testid="input-schedule-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={scheduleForm.frequency} onValueChange={(v) => setScheduleForm({ ...scheduleForm, frequency: v })}>
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="recipients">Email Recipients (comma-separated)</Label>
                    <Input
                      id="recipients"
                      placeholder="e.g., team@example.com, manager@example.com"
                      value={scheduleForm.recipients}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, recipients: e.target.value })}
                      data-testid="input-recipients"
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateScheduleOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => createScheduleMutation.mutate(scheduleForm)}
                    disabled={!scheduleForm.name || createScheduleMutation.isPending}
                    data-testid="button-submit-schedule"
                  >
                    {createScheduleMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                    ) : (
                      "Create Schedule"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loadingSchedules ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Schedules</h3>
                <p className="text-muted-foreground mb-4">
                  Create a schedule to automatically generate reports.
                </p>
                <Button onClick={() => setCreateScheduleOpen(true)} data-testid="button-create-first-schedule">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <Card key={schedule.id} data-testid={`schedule-card-${schedule.id}`}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium">{schedule.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} report
                          {schedule.lastRunAt && (
                            <> · Last run: {new Date(schedule.lastRunAt).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <Switch
                          checked={schedule.isActive}
                          onCheckedChange={(checked) => toggleScheduleMutation.mutate({ id: schedule.id, isActive: checked })}
                          data-testid={`switch-active-${schedule.id}`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                        data-testid={`button-delete-schedule-${schedule.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}