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
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Vendor } from "@shared/schema";

const EMAIL_CONSENT_TEXT = "I agree to receive vendor incident alerts and system notifications via email. I understand I can unsubscribe at any time by disabling email notifications in my settings.";
const SMS_CONSENT_TEXT = "I agree to receive vendor incident alerts via SMS text messages. Message and data rates may apply. I understand I can opt out at any time by disabling SMS notifications in my settings or replying STOP.";

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
  
  // Fetch email config
  const { data: emailConfig, refetch: refetchEmailConfig } = useQuery({
    queryKey: ["/api/email/config"],
    queryFn: async () => {
      const res = await fetch("/api/email/config");
      if (!res.ok) throw new Error("Failed to fetch email config");
      return res.json();
    },
  });
  
  // Fetch all vendors for subscription selection
  const { data: allVendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
  });
  
  // Fetch user's vendor subscriptions
  const { data: vendorSubscriptions, refetch: refetchSubscriptions } = useQuery<{ vendorKeys: string[]; hasSetSubscriptions: boolean }>({
    queryKey: ["/api/vendor-subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/vendor-subscriptions");
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },
  });
  
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [vendorsInitialized, setVendorsInitialized] = useState(false);
  
  // Sync vendor subscriptions from API - wait for both vendors and subscriptions to load
  useEffect(() => {
    if (vendorSubscriptions && allVendors.length > 0 && !vendorsInitialized) {
      if (vendorSubscriptions.hasSetSubscriptions) {
        setSelectedVendors(vendorSubscriptions.vendorKeys);
      } else {
        setSelectedVendors(allVendors.map(v => v.key));
      }
      setVendorsInitialized(true);
    }
  }, [vendorSubscriptions, vendorsInitialized, allVendors]);
  
  const saveVendorSubscriptions = useMutation({
    mutationFn: async (vendorKeys: string[]) => {
      const res = await fetch("/api/vendor-subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorKeys }),
      });
      if (!res.ok) throw new Error("Failed to save subscriptions");
      return res.json();
    },
    onSuccess: () => {
      refetchSubscriptions();
      queryClient.invalidateQueries({ queryKey: ["/api/my-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-incidents"] });
      toast({
        title: "Vendor Subscriptions Saved",
        description: "Your vendor monitoring preferences have been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Could not save vendor subscriptions.",
        variant: "destructive"
      });
    },
  });

  const resetSubscriptions = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/vendor-subscriptions", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to reset subscriptions");
      return res.json();
    },
    onSuccess: () => {
      refetchSubscriptions();
      setVendorsInitialized(false);
      queryClient.invalidateQueries({ queryKey: ["/api/my-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-incidents"] });
      toast({
        title: "Reset to Monitor All",
        description: "You will now receive notifications for all vendors, including new ones.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Reset Failed",
        description: "Could not reset vendor subscriptions.",
        variant: "destructive"
      });
    },
  });
  
  // State for configuration
  const [config, setConfig] = useState({
    monitorInterval: "10",
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

  const [emailConsentChecked, setEmailConsentChecked] = useState(false);
  const [smsConsentChecked, setSmsConsentChecked] = useState(false);
  const [originalEmailEnabled, setOriginalEmailEnabled] = useState<boolean | null>(null);
  const [originalSmsEnabled, setOriginalSmsEnabled] = useState<boolean | null>(null);
  const [fromEmail, setFromEmail] = useState("");
  
  // Sync email config from API
  useEffect(() => {
    if (emailConfig?.fromEmail) {
      setFromEmail(emailConfig.fromEmail);
    }
  }, [emailConfig]);

  // Sync notification prefs from API
  useEffect(() => {
    if (notifPrefs) {
      setConfig(prev => ({
        ...prev,
        smsPhone: notifPrefs.phone || "",
        enableEmail: notifPrefs.notifyEmail ?? true,
        enableSms: notifPrefs.notifySms ?? false,
      }));
      if (originalEmailEnabled === null) {
        setOriginalEmailEnabled(notifPrefs.notifyEmail ?? true);
      }
      if (originalSmsEnabled === null) {
        setOriginalSmsEnabled(notifPrefs.notifySms ?? false);
      }
    }
  }, [notifPrefs, originalEmailEnabled, originalSmsEnabled]);

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

  const recordConsent = async (channel: 'email' | 'sms', destination: string, consentText: string) => {
    try {
      await fetch('/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          destination,
          consentText,
          consentMethod: 'checkbox',
          sourceContext: 'Settings - Notification Preferences'
        })
      });
    } catch (error) {
      console.error('Failed to record consent:', error);
    }
  };

  const isEnablingEmail = config.enableEmail && !originalEmailEnabled;
  const isEnablingSms = config.enableSms && !originalSmsEnabled;

  const handleSave = async () => {
    if (isEnablingEmail && !emailConsentChecked) {
      toast({
        title: "Consent Required",
        description: "Please check the consent box to enable email notifications.",
        variant: "destructive"
      });
      return;
    }
    if (isEnablingSms && !smsConsentChecked) {
      toast({
        title: "Consent Required",
        description: "Please check the consent box to enable SMS notifications.",
        variant: "destructive"
      });
      return;
    }
    if (isEnablingSms && !config.smsPhone) {
      toast({
        title: "Phone Required",
        description: "Please enter your phone number to enable SMS notifications.",
        variant: "destructive"
      });
      return;
    }

    if (isEnablingEmail) {
      await recordConsent('email', config.alertTo, EMAIL_CONSENT_TEXT);
    }
    if (isEnablingSms) {
      await recordConsent('sms', config.smsPhone, SMS_CONSENT_TEXT);
    }

    saveNotificationPrefs.mutate({
      phone: config.smsPhone,
      notifyEmail: config.enableEmail,
      notifySms: config.enableSms,
    });

    setOriginalEmailEnabled(config.enableEmail);
    setOriginalSmsEnabled(config.enableSms);
    setEmailConsentChecked(false);
    setSmsConsentChecked(false);
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
    monitor_interval_minutes: int
    long_running_hours: int
    email: EmailConfig

CONFIG = AppConfig(
    db_path=os.getenv("DB_PATH", "${config.dbPath}"),
    monitor_interval_minutes=int(os.getenv("MONITOR_INTERVAL_MINUTES", "${config.monitorInterval}")),
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

        <TabsContent value="general" className="space-y-6 animate-fade-in">
          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm hover-lift">
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
                <Label htmlFor="interval">Global Monitor Interval (Minutes)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="interval" 
                    value={config.monitorInterval}
                    onChange={(e) => updateConfig('monitorInterval', e.target.value)}
                    className="max-w-[150px] bg-background" 
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
                <p className="text-[0.8rem] text-muted-foreground">
                  Base interval for checking job queues (MONITOR_INTERVAL_MINUTES).
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

        <TabsContent value="notifications" className="space-y-6 animate-fade-in">
          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm hover-lift">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <CardTitle>Email Configuration (Resend)</CardTitle>
              </div>
              <CardDescription>
                Configure email notifications using Resend. API key is managed securely via environment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                {emailConfig?.configured ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> API Key Configured
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                    API Key Not Set
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="from-email">Sender Email Address</Label>
                <Input 
                  id="from-email" 
                  placeholder="notifications@yourdomain.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="bg-background max-w-[400px]" 
                  data-testid="input-from-email"
                />
                <p className="text-[0.8rem] text-muted-foreground">
                  The "From" address for all email notifications. Must be verified in your Resend account.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={async () => {
                  if (!fromEmail) {
                    toast({
                      title: "Email Required",
                      description: "Please enter a sender email address first.",
                      variant: "destructive"
                    });
                    return;
                  }
                  try {
                    const res = await fetch('/api/email/config', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fromEmail })
                    });
                    if (res.ok) {
                      refetchEmailConfig();
                      toast({
                        title: "Email Settings Saved",
                        description: `Sender address updated to ${fromEmail}`,
                        className: "bg-emerald-500 border-emerald-500 text-white"
                      });
                    } else {
                      throw new Error("Failed to save");
                    }
                  } catch {
                    toast({
                      title: "Save Failed",
                      description: "Could not save email settings.",
                      variant: "destructive"
                    });
                  }
                }} data-testid="button-save-email-config">
                  <Save className="w-4 h-4 mr-2" /> Save Email Settings
                </Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  toast({
                    title: "Sending Test Email...",
                    description: "Sending to your account email...",
                  });
                  try {
                    const res = await fetch('/api/email/test', { method: 'POST' });
                    if (res.ok) {
                      toast({
                        title: "Test Email Sent",
                        description: "Check your inbox for the test message.",
                        className: "bg-emerald-500 border-emerald-500 text-white"
                      });
                    } else {
                      const error = await res.json();
                      toast({
                        title: "Test Failed",
                        description: error.error || "Could not send test email.",
                        variant: "destructive"
                      });
                    }
                  } catch {
                    toast({
                      title: "Test Failed",
                      description: "Could not send test email.",
                      variant: "destructive"
                    });
                  }
                }} data-testid="button-test-email">
                  Test Email
                </Button>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-4 border-t border-sidebar-border">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="email-enabled" className="font-medium">Enable Email Alerts</Label>
                  <span className="text-xs text-muted-foreground">Receive incident notifications via email.</span>
                </div>
                <Switch 
                  id="email-enabled" 
                  checked={config.enableEmail}
                  onCheckedChange={(c) => updateConfig('enableEmail', c)}
                />
              </div>

              {isEnablingEmail && (
                <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="email-consent"
                      checked={emailConsentChecked}
                      onCheckedChange={(c) => setEmailConsentChecked(!!c)}
                      data-testid="checkbox-email-consent"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="email-consent" className="text-sm font-medium cursor-pointer">
                        Email Notification Consent
                      </Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {EMAIL_CONSENT_TEXT}
                      </p>
                    </div>
                  </div>
                </div>
              )}
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

              {isEnablingSms && (
                <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <Checkbox 
                      id="sms-consent"
                      checked={smsConsentChecked}
                      onCheckedChange={(c) => setSmsConsentChecked(!!c)}
                      data-testid="checkbox-sms-consent"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="sms-consent" className="text-sm font-medium cursor-pointer">
                        SMS Notification Consent
                      </Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {SMS_CONSENT_TEXT}
                      </p>
                    </div>
                  </div>
                </div>
              )}
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

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm hover-lift">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Vendor Subscriptions</CardTitle>
              </div>
              <CardDescription>
                Choose which vendors you want to monitor and receive notifications for.
                {!vendorSubscriptions?.hasSetSubscriptions && (
                  <span className="block mt-1 text-primary">You haven't set preferences yet - monitoring all vendors by default.</span>
                )}
                {vendorSubscriptions?.hasSetSubscriptions && selectedVendors.length === 0 && (
                  <span className="block mt-1 text-amber-500">No vendors selected - you won't receive any notifications.</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allVendors.map((vendor) => (
                  <div 
                    key={vendor.key}
                    className="flex items-center gap-3 p-3 rounded-lg border border-sidebar-border bg-background/50 hover:bg-background/80 transition-colors"
                  >
                    <Checkbox 
                      id={`vendor-${vendor.key}`}
                      checked={selectedVendors.includes(vendor.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedVendors(prev => [...prev, vendor.key]);
                        } else {
                          setSelectedVendors(prev => prev.filter(k => k !== vendor.key));
                        }
                      }}
                      data-testid={`checkbox-vendor-${vendor.key}`}
                    />
                    <div className="flex flex-col">
                      <Label htmlFor={`vendor-${vendor.key}`} className="text-sm font-medium cursor-pointer">
                        {vendor.name}
                      </Label>
                      <span className="text-xs text-muted-foreground capitalize">
                        {vendor.status === 'operational' ? '✓ Operational' : vendor.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-col gap-4 pt-4 border-t border-sidebar-border">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {!vendorSubscriptions?.hasSetSubscriptions 
                      ? "Monitoring all vendors (default)" 
                      : selectedVendors.length === 0 
                      ? "No vendors selected" 
                      : `${selectedVendors.length} of ${allVendors.length} vendors selected`}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedVendors(allVendors.map(v => v.key))}
                      data-testid="button-select-all-vendors"
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedVendors([])}
                      data-testid="button-clear-vendors"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground max-w-md">
                    {vendorSubscriptions?.hasSetSubscriptions 
                      ? "You have customized your vendor list. New vendors won't be added automatically."
                      : "Monitoring all vendors includes any new vendors added in the future."}
                  </p>
                  <div className="flex gap-2">
                    {vendorSubscriptions?.hasSetSubscriptions && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => resetSubscriptions.mutate()}
                        disabled={resetSubscriptions.isPending}
                        data-testid="button-reset-vendors"
                      >
                        Reset to Monitor All
                      </Button>
                    )}
                    <Button 
                      size="sm"
                      onClick={() => saveVendorSubscriptions.mutate(selectedVendors)}
                      disabled={saveVendorSubscriptions.isPending}
                      data-testid="button-save-vendors"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Custom Selection
                    </Button>
                  </div>
                </div>
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
