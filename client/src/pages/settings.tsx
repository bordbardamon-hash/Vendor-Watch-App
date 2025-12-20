import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Database, Mail, Save, Server, Shield, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Configuration Saved",
      description: "System settings have been updated successfully.",
    });
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-1">Manage system variables and environment settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px] bg-sidebar border border-sidebar-border">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="database">System</TabsTrigger>
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
                  <Input id="interval" defaultValue="10" className="max-w-[150px] bg-background" />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
                <p className="text-[0.8rem] text-muted-foreground">
                  Base interval for checking job queues (SCRAPE_INTERVAL_MINUTES).
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="timeout">Long Running Threshold (Hours)</Label>
                <div className="flex items-center gap-2">
                  <Input id="timeout" defaultValue="4" className="max-w-[150px] bg-background" />
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
                  <Input id="smtp-host" defaultValue="smtp.gmail.com" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input id="smtp-port" defaultValue="587" className="bg-background" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-user">SMTP User</Label>
                  <Input id="smtp-user" defaultValue="your_email@gmail.com" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-pass">SMTP Password</Label>
                  <Input id="smtp-pass" type="password" defaultValue="your_app_password" className="bg-background" />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-sidebar-border">
                <Label htmlFor="alert-to">Alert Recipient</Label>
                <Input id="alert-to" defaultValue="alerts_to@example.com" className="bg-background" />
                <p className="text-[0.8rem] text-muted-foreground">
                  Where to send critical system alerts (ALERT_TO).
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-2">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="email-enabled" className="font-medium">Enable Email Alerts</Label>
                  <span className="text-xs text-muted-foreground">Send notifications on job failure.</span>
                </div>
                <Switch id="email-enabled" defaultChecked />
              </div>
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
                  <Input id="db-path" defaultValue="vendorwatch.db" className="font-mono bg-background" />
                  <Button variant="outline" size="icon">
                    <Server className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[0.8rem] text-muted-foreground">
                  SQLite database file location (DB_PATH).
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-4 border-t border-sidebar-border">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="backup-enabled" className="font-medium">Auto-Backup</Label>
                  <span className="text-xs text-muted-foreground">Create daily snapshots of the database.</span>
                </div>
                <Switch id="backup-enabled" defaultChecked />
              </div>
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
