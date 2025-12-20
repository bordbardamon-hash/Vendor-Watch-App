import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  Globe, 
  Database, 
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PlayCircle,
  Terminal,
  Server,
  Bell,
  Mail
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UI_LABELS } from "@/lib/labels";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const data = [
  { time: "00:00", requests: 120, errors: 2 },
  { time: "04:00", requests: 450, errors: 5 },
  { time: "08:00", requests: 1200, errors: 12 },
  { time: "12:00", requests: 980, errors: 8 },
  { time: "16:00", requests: 1500, errors: 24 },
  { time: "20:00", requests: 850, errors: 4 },
  { time: "23:59", requests: 320, errors: 1 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState(user?.email || "");
  const [notifyOnIncidents, setNotifyOnIncidents] = useState(true);
  const [notifyOnResolutions, setNotifyOnResolutions] = useState(true);

  const handleSaveEmail = () => {
    if (!emailAddress.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Preferences Saved",
      description: `Alert notifications will be sent to ${emailAddress}`,
    });
    setEmailDialogOpen(false);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
          <p className="text-muted-foreground mt-1">Main control loop monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm bg-sidebar/50 px-4 py-2 rounded-full border border-sidebar-border">
            <Bell size={14} className="text-primary" />
            <span className="text-muted-foreground">{UI_LABELS.alerts.label}:</span>
            <button 
              onClick={() => setEmailDialogOpen(true)}
              className="flex items-center gap-1 text-foreground hover:text-primary transition-colors cursor-pointer font-semibold"
              data-testid="button-email-alerts"
            >
              <Mail size={14} />
              {UI_LABELS.alerts.email}
            </button>
            <span className="text-muted-foreground/60">• {UI_LABELS.alerts.slackComingSoon}</span>
          </div>
        </div>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" data-testid="dialog-email-subscription">
          <DialogHeader>
            <DialogTitle>Email Alert Subscription</DialogTitle>
            <DialogDescription>
              Configure your email notification preferences for vendor incidents.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-3">
              <Label>Notification Preferences</Label>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="notify-incidents" 
                  checked={notifyOnIncidents}
                  onCheckedChange={(checked) => setNotifyOnIncidents(!!checked)}
                  data-testid="checkbox-notify-incidents"
                />
                <Label htmlFor="notify-incidents" className="text-sm font-normal cursor-pointer">
                  Notify me when incidents are detected
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="notify-resolutions" 
                  checked={notifyOnResolutions}
                  onCheckedChange={(checked) => setNotifyOnResolutions(!!checked)}
                  data-testid="checkbox-notify-resolutions"
                />
                <Label htmlFor="notify-resolutions" className="text-sm font-normal cursor-pointer">
                  Notify me when incidents are resolved
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} data-testid="button-cancel-email">
              Cancel
            </Button>
            <Button onClick={handleSaveEmail} data-testid="button-save-email">
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title={UI_LABELS.cards.monitoredVendors}
          value="7" 
          change="+2" 
          icon={Globe}
          trend="up"
        />
        <MetricCard 
          title={UI_LABELS.cards.activeIncidents}
          value="3" 
          change="+1" 
          icon={AlertTriangle}
          trend="up"
          primary
        />
        <MetricCard 
          title={UI_LABELS.cards.dbSize}
          value="12.4 MB" 
          change="+0.2 MB" 
          icon={Database}
          trend="up"
        />
        <MetricCard 
          title={UI_LABELS.cards.uptime}
          value="4d 12h" 
          change="" 
          icon={Clock}
          trend="neutral" 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{UI_LABELS.cards.requestVolume24h}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRequests)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-3 space-y-4">
          {/* Main Loop Status */}
          <Card className="border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Main Process Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm">Database Initialized</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">DONE</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-emerald-500 animate-pulse" />
                    <span className="text-sm">Scheduler Loop</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">RUNNING</Badge>
                </div>
                
                <div className="mt-4 pt-4 border-t border-sidebar-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Next Scheduled Batch:</p>
                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-sidebar-border font-mono text-xs text-primary">
                    <span className="animate-pulse">▶</span>
                    <span>job(vendors=7)</span>
                    <span className="ml-auto text-muted-foreground">in 04:12</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { type: "success", msg: "Scraped atlassian", time: "2m ago" },
                  { type: "success", msg: "Scraped cloudflare", time: "2m ago" },
                  { type: "pending", msg: "Analysis complete: 0 alerts", time: "2m ago" },
                  { type: "success", msg: "DB Snapshot saved", time: "1h ago" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className={`mt-1 h-2 w-2 rounded-full ${
                      item.type === 'success' ? 'bg-emerald-500' : 
                      item.type === 'error' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none text-foreground">{item.msg}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, change, icon: Icon, trend, alert, primary }: any) {
  return (
    <Card className={`backdrop-blur-sm ${
      primary 
        ? 'border-primary/35 bg-primary/5 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]' 
        : 'border-sidebar-border bg-sidebar/50'
    }`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`text-sm font-medium ${primary ? 'text-foreground/85' : 'text-muted-foreground'}`}>
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-amber-500' : 'text-primary'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          {trend === 'up' && <span className="text-emerald-500 flex items-center"><ArrowUpRight className="h-3 w-3 mr-1"/>{change}</span>}
          {trend === 'down' && <span className="text-emerald-500 flex items-center"><ArrowUpRight className="h-3 w-3 mr-1 rotate-180"/>{change}</span>}
          {trend === 'neutral' && <span className="text-muted-foreground flex items-center">{change}</span>}
        </p>
      </CardContent>
    </Card>
  );
}
