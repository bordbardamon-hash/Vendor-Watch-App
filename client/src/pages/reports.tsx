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
  Loader2,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Activity,
  Shield,
} from "lucide-react";

interface ReportData {
  uptimePercent: number;
  mttrMinutes: number | null;
  incidentCount: number;
  totalVendors: number;
  mostAffectedVendors: Array<{ vendorKey: string; incidentCount: number; uptimePercent: number; mttrMinutes: number | null }>;
  vendorBreakdown?: Array<{ vendorKey: string; incidentCount: number; uptimePercent: number; mttrMinutes: number | null }>;
  periodDays: number;
}

interface UptimeReport {
  id: string;
  userId: string;
  organizationId?: string;
  reportType: string;
  name: string;
  period?: string;
  vendorKeys?: string[];
  chainKeys?: string[];
  startDate: string;
  endDate: string;
  data?: string;
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
  const [generateReportOpen, setGenerateReportOpen] = useState(false);
  const [createScheduleOpen, setCreateScheduleOpen] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  
  const [reportForm, setReportForm] = useState({
    name: "",
    reportType: "monthly",
    startDate: "",
    endDate: "",
    vendorKeys: [] as string[],
    chainKeys: [] as string[],
  });

  const [generateForm, setGenerateForm] = useState({
    vendorKey: "",
    period: "30d" as '7d' | '30d' | '90d',
    reportType: "summary" as 'summary' | 'detailed',
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
      toast({ title: "Report created", description: "Your report has been created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create report", variant: "destructive" });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: typeof generateForm) => {
      const res = await apiRequest("POST", "/api/reports/generate", {
        vendorKey: data.vendorKey || undefined,
        period: data.period,
        reportType: data.reportType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setGenerateReportOpen(false);
      setGenerateForm({ vendorKey: "", period: "30d", reportType: "summary" });
      toast({ title: "Report generated", description: "Your uptime report has been generated with live incident data" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
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

  const toggleExpanded = (id: string) => {
    setExpandedReports(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parseReportData = (report: UptimeReport): ReportData | null => {
    if (!report.data) return null;
    try {
      return JSON.parse(report.data);
    } catch {
      return null;
    }
  };

  const formatMttr = (minutes: number | null): string => {
    if (minutes === null) return "N/A";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const downloadCsv = (report: UptimeReport) => {
    const data = parseReportData(report);
    if (!data) {
      toast({ title: "No data", description: "This report has no data to export", variant: "destructive" });
      return;
    }

    const rows: string[][] = [];
    rows.push(["Report Name", report.name]);
    rows.push(["Period", report.period || "custom"]);
    rows.push(["Start Date", new Date(report.startDate).toLocaleDateString()]);
    rows.push(["End Date", new Date(report.endDate).toLocaleDateString()]);
    rows.push(["Report Type", report.reportType]);
    rows.push([]);
    rows.push(["Overall Statistics"]);
    rows.push(["Uptime %", String(data.uptimePercent)]);
    rows.push(["MTTR (minutes)", data.mttrMinutes !== null ? String(data.mttrMinutes) : "N/A"]);
    rows.push(["Incident Count", String(data.incidentCount)]);
    rows.push(["Total Vendors", String(data.totalVendors)]);
    rows.push([]);

    if (data.mostAffectedVendors && data.mostAffectedVendors.length > 0) {
      rows.push(["Most Affected Vendors"]);
      rows.push(["Vendor Key", "Incidents", "Uptime %", "MTTR (min)"]);
      for (const v of data.mostAffectedVendors) {
        rows.push([v.vendorKey, String(v.incidentCount), String(v.uptimePercent), v.mttrMinutes !== null ? String(v.mttrMinutes) : "N/A"]);
      }
      rows.push([]);
    }

    if (data.vendorBreakdown && data.vendorBreakdown.length > 0) {
      rows.push(["Full Vendor Breakdown"]);
      rows.push(["Vendor Key", "Incidents", "Uptime %", "MTTR (min)"]);
      for (const v of data.vendorBreakdown) {
        rows.push([v.vendorKey, String(v.incidentCount), String(v.uptimePercent), v.mttrMinutes !== null ? String(v.mttrMinutes) : "N/A"]);
      }
    }

    const csvContent = rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "generating":
        return <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/30"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const reportsWithData = reports.filter(r => r.data).map(r => {
    const d = parseReportData(r);
    return { report: r, data: d };
  }).filter(r => r.data);

  const avgUptime = reportsWithData.length > 0
    ? (reportsWithData.reduce((sum, r) => sum + (r.data?.uptimePercent || 0), 0) / reportsWithData.length).toFixed(2)
    : "N/A";

  const avgMttr = (() => {
    const withMttr = reportsWithData.filter(r => r.data?.mttrMinutes !== null && r.data?.mttrMinutes !== undefined);
    if (withMttr.length === 0) return null;
    return Math.round(withMttr.reduce((sum, r) => sum + (r.data!.mttrMinutes || 0), 0) / withMttr.length);
  })();

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Uptime Reports</h1>
          <p className="text-muted-foreground">Generate and schedule uptime reports</p>
        </div>
        
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lock className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Growth/Enterprise Feature</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Uptime reports are available on the Growth and Enterprise plans.
              Upgrade to generate and schedule reports for your vendors and blockchain infrastructure.
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
          <p className="text-muted-foreground">Generate and schedule uptime reports with live incident data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <FileText className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="text-total-reports-label">Total Reports</p>
                <p className="text-2xl font-bold text-emerald-400" data-testid="text-total-reports-value">{reports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Shield className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="text-avg-uptime-label">Avg Uptime %</p>
                <p className="text-2xl font-bold text-cyan-400" data-testid="text-avg-uptime-value">
                  {avgUptime !== "N/A" ? `${avgUptime}%` : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Activity className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground" data-testid="text-avg-mttr-label">Avg MTTR</p>
                <p className="text-2xl font-bold text-violet-400" data-testid="text-avg-mttr-value">
                  {formatMttr(avgMttr)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList>
          <TabsTrigger value="reports" data-testid="tab-reports">Generated Reports</TabsTrigger>
          <TabsTrigger value="schedules" data-testid="tab-schedules">Scheduled Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Dialog open={generateReportOpen} onOpenChange={setGenerateReportOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-generate-report" className="bg-emerald-600 hover:bg-emerald-700">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Generate Uptime Report</DialogTitle>
                  <DialogDescription>
                    Generate a report with live uptime statistics calculated from actual incident data.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Time Period</Label>
                    <Select value={generateForm.period} onValueChange={(v) => setGenerateForm({ ...generateForm, period: v as any })}>
                      <SelectTrigger data-testid="select-generate-period">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="90d">Last 90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Vendor (optional)</Label>
                    <Select value={generateForm.vendorKey || "all"} onValueChange={(v) => setGenerateForm({ ...generateForm, vendorKey: v === "all" ? "" : v })}>
                      <SelectTrigger data-testid="select-generate-vendor">
                        <SelectValue placeholder="All vendors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        {vendors.map((v) => (
                          <SelectItem key={v.key} value={v.key}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select value={generateForm.reportType} onValueChange={(v) => setGenerateForm({ ...generateForm, reportType: v as any })}>
                      <SelectTrigger data-testid="select-generate-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="summary">Summary</SelectItem>
                        <SelectItem value="detailed">Detailed (with vendor breakdown)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGenerateReportOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => generateReportMutation.mutate(generateForm)}
                    disabled={generateReportMutation.isPending}
                    data-testid="button-submit-generate"
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {generateReportMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      "Generate Report"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={createReportOpen} onOpenChange={setCreateReportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-custom-report">
                  <Plus className="h-4 w-4 mr-2" />
                  Custom Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Custom Report</DialogTitle>
                  <DialogDescription>
                    Create a custom date range report.
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
                    <Select value={reportForm.reportType} onValueChange={(v) => {
                      const now = new Date();
                      let start: Date;
                      if (v === "weekly") {
                        start = new Date(now); start.setDate(start.getDate() - 7);
                      } else {
                        start = new Date(now); start.setMonth(start.getMonth() - 1);
                      }
                      setReportForm({
                        ...reportForm,
                        reportType: v,
                        startDate: start.toISOString().split("T")[0],
                        endDate: now.toISOString().split("T")[0],
                      });
                    }}>
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
                    <Label>Vendors (optional)</Label>
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
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                    ) : (
                      "Create Report"
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
            <Card className="border-dashed border-emerald-500/30">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate your first uptime report to get started with historical data analysis.
                </p>
                <Button onClick={() => setGenerateReportOpen(true)} data-testid="button-create-first-report" className="bg-emerald-600 hover:bg-emerald-700">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const reportData = parseReportData(report);
                const isExpanded = expandedReports.has(report.id);

                return (
                  <Card key={report.id} data-testid={`report-card-${report.id}`} className="border-emerald-500/10 hover:border-emerald-500/20 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {reportData ? (
                            <button
                              onClick={() => toggleExpanded(report.id)}
                              className="p-1 hover:bg-muted rounded"
                              data-testid={`button-expand-${report.id}`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground ml-1 mr-1" />
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium truncate">{report.name}</h4>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                              </span>
                              {report.period && (
                                <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                                  {report.period}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {report.reportType}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {reportData && (
                            <div className="hidden md:flex items-center gap-4 text-sm">
                              <div className="text-center">
                                <p className="text-muted-foreground text-xs">Uptime</p>
                                <p className={`font-semibold ${reportData.uptimePercent >= 99.5 ? 'text-emerald-400' : reportData.uptimePercent >= 99 ? 'text-yellow-400' : 'text-red-400'}`} data-testid={`text-uptime-${report.id}`}>
                                  {reportData.uptimePercent}%
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground text-xs">Incidents</p>
                                <p className="font-semibold" data-testid={`text-incidents-${report.id}`}>{reportData.incidentCount}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground text-xs">MTTR</p>
                                <p className="font-semibold" data-testid={`text-mttr-${report.id}`}>{formatMttr(reportData.mttrMinutes)}</p>
                              </div>
                            </div>
                          )}

                          {getStatusBadge(report.status)}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadCsv(report)}
                            disabled={!reportData}
                            data-testid={`button-download-csv-${report.id}`}
                            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            CSV
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteReportMutation.mutate(report.id)}
                            data-testid={`button-delete-${report.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && reportData && (
                        <div className="mt-4 pt-4 border-t border-emerald-500/10">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                              <p className="text-xs text-muted-foreground">Uptime</p>
                              <p className={`text-lg font-bold ${reportData.uptimePercent >= 99.5 ? 'text-emerald-400' : reportData.uptimePercent >= 99 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {reportData.uptimePercent}%
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                              <p className="text-xs text-muted-foreground">MTTR</p>
                              <p className="text-lg font-bold text-cyan-400">{formatMttr(reportData.mttrMinutes)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/10">
                              <p className="text-xs text-muted-foreground">Incidents</p>
                              <p className="text-lg font-bold text-violet-400">{reportData.incidentCount}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                              <p className="text-xs text-muted-foreground">Vendors</p>
                              <p className="text-lg font-bold text-blue-400">{reportData.totalVendors}</p>
                            </div>
                          </div>

                          {reportData.mostAffectedVendors && reportData.mostAffectedVendors.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium mb-2 text-emerald-400">Most Affected Vendors</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm" data-testid={`table-affected-${report.id}`}>
                                  <thead>
                                    <tr className="border-b border-muted">
                                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vendor</th>
                                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Incidents</th>
                                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Uptime %</th>
                                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">MTTR</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {reportData.mostAffectedVendors.map((v, i) => (
                                      <tr key={i} className="border-b border-muted/50">
                                        <td className="py-2 px-3 font-medium">{vendors.find(vd => vd.key === v.vendorKey)?.name || v.vendorKey}</td>
                                        <td className="py-2 px-3 text-right">{v.incidentCount}</td>
                                        <td className={`py-2 px-3 text-right ${v.uptimePercent >= 99.5 ? 'text-emerald-400' : v.uptimePercent >= 99 ? 'text-yellow-400' : 'text-red-400'}`}>
                                          {v.uptimePercent}%
                                        </td>
                                        <td className="py-2 px-3 text-right">{formatMttr(v.mttrMinutes)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {reportData.vendorBreakdown && reportData.vendorBreakdown.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium mb-2 text-cyan-400">Full Vendor Breakdown</h5>
                              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                <table className="w-full text-sm" data-testid={`table-breakdown-${report.id}`}>
                                  <thead className="sticky top-0 bg-background">
                                    <tr className="border-b border-muted">
                                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vendor</th>
                                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Incidents</th>
                                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">Uptime %</th>
                                      <th className="text-right py-2 px-3 text-muted-foreground font-medium">MTTR</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {reportData.vendorBreakdown.map((v, i) => (
                                      <tr key={i} className="border-b border-muted/50">
                                        <td className="py-2 px-3 font-medium">{vendors.find(vd => vd.key === v.vendorKey)?.name || v.vendorKey}</td>
                                        <td className="py-2 px-3 text-right">{v.incidentCount}</td>
                                        <td className={`py-2 px-3 text-right ${v.uptimePercent >= 99.5 ? 'text-emerald-400' : v.uptimePercent >= 99 ? 'text-yellow-400' : 'text-red-400'}`}>
                                          {v.uptimePercent}%
                                        </td>
                                        <td className="py-2 px-3 text-right">{formatMttr(v.mttrMinutes)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {report.generatedAt && (
                            <p className="text-xs text-muted-foreground mt-3">
                              Generated: {new Date(report.generatedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
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
            <Card className="border-dashed">
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