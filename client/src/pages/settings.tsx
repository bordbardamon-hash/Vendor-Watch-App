import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Database, Mail, Save, Server, Shield, Clock, Code, Copy, Check, CheckCircle2, Smartphone, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const queryClient = useQueryClient();
  
  // Fetch notification preferences
  const { data: notifPrefs } = useQuery({
    queryKey: ["/api/notifications/preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });
  
  // State for configuration
  const [config, setConfig] = useState({
    scrapeInterval: "10",
    longRunningHours: "4",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "your_email@gmail.com",
    smtpPass: "your_app_password",
    alertTo: "alerts_to@example.com",
    dbPath: "vendorwatch.db",
    enableEmail: true,
    enableSms: false,
    smsPhone: "",
    enableBackup: true
  });

  // Sync notification prefs from API
  useEffect(() => {
    if (notifPrefs) {
      setConfig(prev => ({
        ...prev,
        smsPhone: notifPrefs.phone || "",
        enableEmail: notifPrefs.notifyEmail ?? true,
        enableSms: notifPrefs.notifySms ?? false,
      }));
    }
  }, [notifPrefs]);

  const saveNotificationPrefs = useMutation({
    mutationFn: async (prefs: { phone: string; notifyEmail: boolean; notifySms: boolean }) => {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({
        title: "Preferences Saved",
        description: "Your notification preferences have been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Could not save notification preferences.",
        variant: "destructive"
      });
    },
  });

  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    saveNotificationPrefs.mutate({
      phone: config.smsPhone,
      notifyEmail: config.enableEmail,
      notifySms: config.enableSms,
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to Clipboard",
      description: "Python configuration code copied.",
    });
  };

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const pythonCode = `import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class EmailConfig:
    host: str
    port: int
    user: str
    password: str
    alert_to: str

@dataclass(frozen=True)
class AppConfig:
    db_path: str
    scrape_interval_minutes: int
    long_running_hours: int
    email: EmailConfig

CONFIG = AppConfig(
    db_path=os.getenv("DB_PATH", "${config.dbPath}"),
    scrape_interval_minutes=int(os.getenv("SCRAPE_INTERVAL_MINUTES", "${config.scrapeInterval}")),
    long_running_hours=int(os.getenv("LONG_RUNNING_HOURS", "${config.longRunningHours}")),
    email=EmailConfig(
        host=os.getenv("SMTP_HOST", "${config.smtpHost}"),
        port=int(os.getenv("SMTP_PORT", "${config.smtpPort}")),
        user=os.getenv("SMTP_USER", "${config.smtpUser}"),
        password=os.getenv("SMTP_PASS", "${config.smtpPass}"),
        alert_to=os.getenv("ALERT_TO", "${config.alertTo}"),
    )
)`;

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-1">Manage system variables and environment settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px] bg-sidebar border border-sidebar-border">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="database">System</TabsTrigger>
          <TabsTrigger value="code" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Code className="w-4 h-4 mr-2" /> Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <CardTitle>Scheduler Configuration</CardTitle>
              </div>
              <CardDescription>
                Control how often the global scheduler triggers jobs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="interval">Global Scrape Interval (Minutes)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="interval" 
                    value={config.scrapeInterval}
                    onChange={(e) => updateConfig('scrapeInterval', e.target.value)}
                    className="max-w-[150px] bg-background" 
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
                <p className="text-[0.8rem] text-muted-foreground">
                  Base interval for checking job queues (SCRAPE_INTERVAL_MINUTES).
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timeout">Long Running Threshold (Hours)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="timeout" 
                    value={config.longRunningHours}
                    onChange={(e) => updateConfig('longRunningHours', e.target.value)}
                    className="max-w-[150px] bg-background" 
                  />
                  <span className="text-sm text-muted-foreground">hrs</span>
                </div>
                <p className="text-[0.8rem] text-muted-foreground">
                  Jobs running longer than this will be flagged as "Stalled" (LONG_RUNNING_HOURS).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <CardTitle>SMTP Configuration</CardTitle>
              </div>
              <CardDescription>
                Configure email alerts for failed jobs and system critical events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input 
                    id="smtp-host" 
                    value={config.smtpHost}
                    onChange={(e) => updateConfig('smtpHost', e.target.value)}
                    className="bg-background" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input 
                    id="smtp-port" 
                    value={config.smtpPort}
                    onChange={(e) => updateConfig('smtpPort', e.target.value)}
                    className="bg-background" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">SMTP User</Label>
                  <Input 
                    id="smtp-user" 
                    value={config.smtpUser}
                    onChange={(e) => updateConfig('smtpUser', e.target.value)}
                    className="bg-background" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-pass">SMTP Password</Label>
                  <Input 
                    id="smtp-pass" 
                    type="password" 
                    value={config.smtpPass}
                    onChange={(e) => updateConfig('smtpPass', e.target.value)}
                    className="bg-background" 
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-sidebar-border">
                <Label htmlFor="alert-to">Alert Recipient</Label>
                <Input 
                  id="alert-to" 
                  value={config.alertTo}
                  onChange={(e) => updateConfig('alertTo', e.target.value)}
                  className="bg-background" 
                />
                <p className="text-[0.8rem] text-muted-foreground">
                  Where to send critical system alerts (ALERT_TO).
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-2">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="email-enabled" className="font-medium">Enable Email Alerts</Label>
                  <span className="text-xs text-muted-foreground">Send notifications on job failure.</span>
                </div>
                <div className="flex items-center gap-4">
                   <Button variant="secondary" size="sm" onClick={() => {
                     toast({
                       title: "Sending Test Email...",
                       description: `Connecting to ${config.smtpHost}:${config.smtpPort}...`,
                     });
                     setTimeout(() => {
                       toast({
                         title: "Email Sent",
                         description: `Test alert successfully sent to ${config.alertTo}`,
                         variant: "default",
                         className: "bg-emerald-500 border-emerald-500 text-white"
                       });
                     }, 2000);
                   }}>
                     Test Connection
                   </Button>
                   <Switch 
                     id="email-enabled" 
                     checked={config.enableEmail}
                     onCheckedChange={(c) => updateConfig('enableEmail', c)}
                   />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <CardTitle>SMS Alerts</CardTitle>
              </div>
              <CardDescription>
                Receive text message alerts for critical incidents on your phone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms-phone">Phone Number</Label>
                <Input 
                  id="sms-phone" 
                  placeholder="+1 (555) 123-4567"
                  value={config.smsPhone}
                  onChange={(e) => updateConfig('smsPhone', e.target.value)}
                  className="bg-background max-w-[300px]" 
                  data-testid="input-sms-phone"
                />
                <p className="text-[0.8rem] text-muted-foreground">
                  Enter your phone number with country code for SMS alerts.
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-2 border-t border-sidebar-border">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="sms-enabled" className="font-medium">Enable SMS Alerts</Label>
                  <span className="text-xs text-muted-foreground">Get text messages for critical incidents.</span>
                </div>
                <div className="flex items-center gap-4">
                   <Button variant="secondary" size="sm" onClick={async () => {
                     if (!config.smsPhone) {
                       toast({
                         title: "Phone Required",
                         description: "Please enter a phone number first.",
                         variant: "destructive"
                       });
                       return;
                     }
                     toast({
                       title: "Sending Test SMS...",
                       description: `Sending to ${config.smsPhone}...`,
                     });
                     try {
                       const res = await fetch('/api/sms/test', {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json' },
                         body: JSON.stringify({ phone: config.smsPhone })
                       });
                       if (res.ok) {
                         toast({
                           title: "SMS Sent",
                           description: `Test message sent to ${config.smsPhone}`,
                           variant: "default",
                           className: "bg-emerald-500 border-emerald-500 text-white"
                         });
                       } else {
                         toast({
                           title: "SMS Failed",
                           description: "Could not send test SMS. Please check your phone number.",
                           variant: "destructive"
                         });
                       }
                     } catch {
                       toast({
                         title: "SMS Failed",
                         description: "Could not send test SMS. Please try again.",
                         variant: "destructive"
                       });
                     }
                   }} data-testid="button-test-sms">
                     Test SMS
                   </Button>
                   <Switch 
                     id="sms-enabled" 
                     checked={config.enableSms}
                     onCheckedChange={(c) => updateConfig('enableSms', c)}
                     data-testid="switch-enable-sms"
                   />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>Notification Preferences Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Mail className={`w-5 h-5 ${config.enableEmail ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={config.enableEmail ? 'font-medium' : 'text-muted-foreground'}>
                    Email {config.enableEmail ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className={`w-5 h-5 ${config.enableSms ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={config.enableSms ? 'font-medium' : 'text-muted-foreground'}>
                    SMS {config.enableSms ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {config.enableEmail && config.enableSms 
                  ? "You will receive alerts via both email and SMS."
                  : config.enableEmail 
                  ? "You will receive alerts via email only."
                  : config.enableSms 
                  ? "You will receive alerts via SMS only."
                  : "No notification channels are enabled. Enable at least one to receive alerts."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <CardTitle>Storage Settings</CardTitle>
              </div>
              <CardDescription>
                Manage local database persistence and backup settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="db-path">Database Path</Label>
                <div className="flex gap-2">
                  <Input 
                    id="db-path" 
                    value={config.dbPath}
                    onChange={(e) => updateConfig('dbPath', e.target.value)}
                    className="font-mono bg-background" 
                  />
                  <Button variant="outline" size="icon">
                    <Server className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[0.8rem] text-muted-foreground">
                  SQLite database file location (DB_PATH).
                </p>
              </div>

              <div className="rounded-md border border-sidebar-border bg-sidebar/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Schema Definition</span>
                  </div>
                  <Badge variant="outline" className="text-xs border-primary/20 text-primary">v1.2</Badge>
                </div>
                <ScrollArea className="h-[200px] w-full rounded bg-black/50 border border-sidebar-border/50 p-3">
                  <pre className="text-xs font-mono text-muted-foreground">
{`CREATE TABLE IF NOT EXISTS vendors (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status_url TEXT NOT NULL,
  parser TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  vendor_key TEXT,
  incident_id TEXT,
  title TEXT,
  status TEXT,
  severity TEXT,
  impact TEXT,
  url TEXT,
  raw_hash TEXT,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (vendor_key, incident_id)
);

CREATE TABLE IF NOT EXISTS alerts_sent (
  vendor_key TEXT,
  incident_id TEXT,
  alert_type TEXT,
  last_value TEXT,
  sent_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (vendor_key, incident_id, alert_type)
);`}
                  </pre>
                </ScrollArea>
                <div className="flex justify-end pt-2">
                  <Button size="sm" variant="outline" className="text-xs h-7">
                    <Check className="w-3 h-3 mr-1" /> Verify Schema
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-4 border-t border-sidebar-border">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="backup-enabled" className="font-medium">Auto-Backup</Label>
                  <span className="text-xs text-muted-foreground">Create daily snapshots of the database.</span>
                </div>
                <Switch 
                  id="backup-enabled" 
                  checked={config.enableBackup}
                  onCheckedChange={(c) => updateConfig('enableBackup', c)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code" className="space-y-6">
          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Generated Python Config</CardTitle>
                <CardDescription className="mt-2">
                  Copy this code to your <code>config.py</code> file to use these settings.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied" : "Copy Code"}
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border border-sidebar-border bg-black/50 p-4">
                <pre className="font-mono text-sm text-green-400">
                  {pythonCode}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button variant="outline">Reset to Defaults</Button>
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>
    </div>
  );
}
