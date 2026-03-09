import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Database, Mail, Save, Server, Shield, Clock, Code, Copy, Check, CheckCircle2, Smartphone, MessageSquare, GripVertical, AlertTriangle, AlertCircle, Info, Users, Crown, ShieldCheck, Link2, Lock } from "lucide-react";
import { getBrowserTimezone } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Vendor } from "@shared/schema";
import { SUBSCRIPTION_TIERS } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const EMAIL_CONSENT_TEXT = "I agree to receive vendor incident alerts and system notifications via email. I understand I can unsubscribe at any time by disabling email notifications in my settings.";
const SMS_CONSENT_TEXT = "I expressly consent to receive automated SMS text messages from Vendor Watch for vendor incident alerts, maintenance notifications, and status updates. Message frequency varies based on vendor status events. Message and data rates may apply. I can opt out at any time by replying STOP to any message or disabling SMS in my settings. Reply HELP for assistance.";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
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
  const [orderedVendors, setOrderedVendors] = useState<Vendor[]>([]);
  const [vendorImpacts, setVendorImpacts] = useState<Record<string, string>>({});
  
  // Toggle between vendors and blockchain
  const [subscriptionMode, setSubscriptionMode] = useState<'vendors' | 'blockchain'>('vendors');
  
  // Fetch all blockchain chains for subscription selection
  const { data: allChains = [] } = useQuery<any[]>({
    queryKey: ["/api/blockchain/chains"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/chains");
      if (!res.ok) throw new Error("Failed to fetch chains");
      return res.json();
    },
  });
  
  // Fetch user's blockchain subscriptions
  const { data: blockchainSubscriptions, refetch: refetchBlockchainSubs } = useQuery<{ chainKeys: string[]; hasSetSubscriptions: boolean }>({
    queryKey: ["/api/blockchain-subscriptions"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain-subscriptions");
      if (!res.ok) throw new Error("Failed to fetch blockchain subscriptions");
      return res.json();
    },
  });
  
  const [selectedChains, setSelectedChains] = useState<string[]>([]);
  const [chainsInitialized, setChainsInitialized] = useState(false);
  
  // Fetch vendor order
  const { data: vendorOrder } = useQuery<{ vendorKeys: string[] }>({
    queryKey: ["/api/vendor-order"],
    queryFn: async () => {
      const res = await fetch("/api/vendor-order");
      if (!res.ok) throw new Error("Failed to fetch vendor order");
      return res.json();
    },
  });
  
  // Save vendor order mutation
  const saveVendorOrder = useMutation({
    mutationFn: async (vendorKeys: string[]) => {
      const res = await fetch("/api/vendor-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorKeys }),
      });
      if (!res.ok) throw new Error("Failed to save vendor order");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-vendors"] });
      toast({
        title: "Vendor Order Saved",
        description: "Your vendor display order has been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Could not save vendor order.",
        variant: "destructive"
      });
    },
  });

  // Fetch vendor impacts
  const { data: vendorImpactData } = useQuery<Array<{ vendorKey: string; customerImpact: string }>>({
    queryKey: ["/api/vendor-impact"],
    queryFn: async () => {
      const res = await fetch("/api/vendor-impact");
      if (!res.ok) throw new Error("Failed to fetch vendor impacts");
      return res.json();
    },
  });

  // Sync vendor impacts from API
  useEffect(() => {
    if (vendorImpactData) {
      const impacts: Record<string, string> = {};
      vendorImpactData.forEach(item => {
        impacts[item.vendorKey] = item.customerImpact;
      });
      setVendorImpacts(impacts);
    }
  }, [vendorImpactData]);

  // Update vendor impact mutation
  const updateVendorImpact = useMutation({
    mutationFn: async ({ vendorKey, customerImpact }: { vendorKey: string; customerImpact: string }) => {
      const res = await fetch(`/api/vendor-impact/${vendorKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerImpact }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update vendor impact");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-impact"] });
      toast({
        title: "Impact Updated",
        description: `Customer impact level updated for this vendor.`,
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-impact"] });
      toast({
        title: "Update Failed",
        description: error.message || "Could not update customer impact level.",
        variant: "destructive"
      });
    },
  });
  
  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  
  // Sync vendor subscriptions from API - wait for both vendors and subscriptions to load
  useEffect(() => {
    if (vendorSubscriptions && allVendors.length > 0 && !vendorsInitialized) {
      // Always use actual subscriptions - users start with none selected
      setSelectedVendors(vendorSubscriptions.vendorKeys || []);
      setVendorsInitialized(true);
    }
  }, [vendorSubscriptions, vendorsInitialized, allVendors]);
  
  // Sync vendor order from API - recompute whenever vendors or order changes
  useEffect(() => {
    if (allVendors.length > 0) {
      const orderKeys = vendorOrder?.vendorKeys || [];
      if (orderKeys.length > 0) {
        const orderMap = new Map(orderKeys.map((key, i) => [key, i]));
        const sorted = [...allVendors].sort((a, b) => {
          const orderA = orderMap.get(a.key) ?? 999;
          const orderB = orderMap.get(b.key) ?? 999;
          return orderA - orderB;
        });
        setOrderedVendors(sorted);
      } else {
        setOrderedVendors(allVendors);
      }
    }
  }, [allVendors, vendorOrder]);
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setOrderedVendors((items) => {
        const oldIndex = items.findIndex(v => v.key === active.id);
        const newIndex = items.findIndex(v => v.key === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        saveVendorOrder.mutate(newItems.map(v => v.key));
        return newItems;
      });
    }
  };
  
  const userTier = user?.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS | null;
  const tierConfig = userTier && SUBSCRIPTION_TIERS[userTier] ? SUBSCRIPTION_TIERS[userTier] : null;
  const vendorLimit = tierConfig?.vendorLimit ?? null;
  const blockchainLimit = tierConfig?.blockchainLimit ?? null;

  const saveVendorSubscriptions = useMutation({
    mutationFn: async (vendorKeys: string[]) => {
      const res = await fetch("/api/vendor-subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorKeys }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save subscriptions");
      }
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
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Could not save vendor subscriptions.",
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

  // Sync blockchain subscriptions from API
  useEffect(() => {
    if (blockchainSubscriptions && allChains.length > 0 && !chainsInitialized) {
      // Always use actual subscriptions - users start with none selected
      setSelectedChains(blockchainSubscriptions.chainKeys || []);
      setChainsInitialized(true);
    }
  }, [blockchainSubscriptions, chainsInitialized, allChains]);

  const saveBlockchainSubscriptions = useMutation({
    mutationFn: async (chainKeys: string[]) => {
      const res = await fetch("/api/blockchain-subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainKeys }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save blockchain subscriptions");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchBlockchainSubs();
      queryClient.invalidateQueries({ queryKey: ["/api/blockchain/chains"] });
      toast({
        title: "Blockchain Subscriptions Saved",
        description: "Your blockchain monitoring preferences have been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Could not save blockchain subscriptions.",
        variant: "destructive"
      });
    },
  });

  const resetBlockchainSubscriptions = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/blockchain-subscriptions", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to reset blockchain subscriptions");
      return res.json();
    },
    onSuccess: () => {
      refetchBlockchainSubs();
      setChainsInitialized(false);
      queryClient.invalidateQueries({ queryKey: ["/api/blockchain/chains"] });
      toast({
        title: "Reset to Monitor All",
        description: "You will now receive notifications for all blockchain networks, including new ones.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Reset Failed",
        description: "Could not reset blockchain subscriptions.",
        variant: "destructive"
      });
    },
  });
  
  // Common timezone list
  const TIMEZONES = [
    { value: "UTC", label: "UTC (Coordinated Universal Time)" },
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Anchorage", label: "Alaska Time (AKT)" },
    { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
    { value: "Europe/London", label: "London (GMT/BST)" },
    { value: "Europe/Paris", label: "Paris (CET/CEST)" },
    { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
    { value: "Asia/Tokyo", label: "Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "Shanghai (CST)" },
    { value: "Asia/Singapore", label: "Singapore (SGT)" },
    { value: "Asia/Dubai", label: "Dubai (GST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
    { value: "Australia/Perth", label: "Perth (AWST)" },
  ];

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
    enableEmail: false,
    enableSms: false,
    notificationEmail: "",
    smsPhone: "",
    enableBackup: true,
    timezone: getBrowserTimezone()
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
        notificationEmail: notifPrefs.notificationEmail || "",
        smsPhone: notifPrefs.phone || "",
        enableEmail: notifPrefs.notifyEmail ?? false,
        enableSms: notifPrefs.notifySms ?? false,
        timezone: notifPrefs.timezone || getBrowserTimezone(),
      }));
      if (originalEmailEnabled === null) {
        setOriginalEmailEnabled(notifPrefs.notifyEmail ?? false);
      }
      if (originalSmsEnabled === null) {
        setOriginalSmsEnabled(notifPrefs.notifySms ?? false);
      }
    }
  }, [notifPrefs, originalEmailEnabled, originalSmsEnabled]);

  const saveNotificationPrefs = useMutation({
    mutationFn: async (prefs: { notificationEmail: string; phone: string; notifyEmail: boolean; notifySms: boolean; timezone: string }) => {
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
    if (!destination) {
      console.error(`Cannot record ${channel} consent: destination is empty`);
      return;
    }
    try {
      const response = await fetch('/api/consents', {
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
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`Failed to record ${channel} consent:`, response.status, error);
      }
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
      await recordConsent('email', config.notificationEmail, EMAIL_CONSENT_TEXT);
    }
    if (isEnablingSms) {
      await recordConsent('sms', config.smsPhone, SMS_CONSENT_TEXT);
    }

    const smsTierAllowed = !!(userTier && SUBSCRIPTION_TIERS[userTier]?.smsEnabled);

    saveNotificationPrefs.mutate({
      notificationEmail: config.notificationEmail,
      phone: config.smsPhone,
      notifyEmail: config.enableEmail,
      notifySms: smsTierAllowed ? config.enableSms : false,
      timezone: config.timezone,
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
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">Manage system variables and environment settings</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className={`flex w-max md:grid md:w-full ${user?.isAdmin ? 'md:grid-cols-5 lg:w-[600px]' : 'md:grid-cols-2 lg:w-[300px]'} bg-sidebar border border-sidebar-border`}>
            <TabsTrigger value="general" className="whitespace-nowrap">General</TabsTrigger>
            <TabsTrigger value="notifications" className="whitespace-nowrap">Notifications</TabsTrigger>
            {user?.isAdmin && (
              <TabsTrigger value="database" className="whitespace-nowrap">System</TabsTrigger>
            )}
            {user?.isAdmin && (
              <TabsTrigger value="code" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary whitespace-nowrap">
                <Code className="w-4 h-4 mr-1 md:mr-2" /> Code
              </TabsTrigger>
            )}
            {user?.isAdmin && (
              <TabsTrigger value="users" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500 whitespace-nowrap">
                <Users className="w-4 h-4 mr-1 md:mr-2" /> Users
              </TabsTrigger>
            )}
          </TabsList>
        </div>

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
                <CardTitle>Email Notifications</CardTitle>
              </div>
              <CardDescription>
                Manage your email address and notification preferences. Update your email or unsubscribe anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notification-email">Your Notification Email</Label>
                <Input 
                  id="notification-email" 
                  type="email"
                  placeholder="your@email.com"
                  value={config.notificationEmail}
                  onChange={(e) => updateConfig('notificationEmail', e.target.value)}
                  className="bg-background max-w-[400px]" 
                  data-testid="input-notification-email"
                />
                <p className="text-[0.8rem] text-muted-foreground">
                  This is where we'll send incident alerts. Update it anytime if your email changes.
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-4 border-t border-sidebar-border">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="email-enabled" className="font-medium">
                    {config.enableEmail ? "Email Alerts Enabled" : "Email Alerts Disabled (Unsubscribed)"}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {config.enableEmail 
                      ? "You will receive incident alerts via email. Toggle off to unsubscribe." 
                      : "You won't receive email alerts. Toggle on to subscribe."}
                  </span>
                </div>
                <Switch 
                  id="email-enabled" 
                  checked={config.enableEmail}
                  onCheckedChange={(c) => updateConfig('enableEmail', c)}
                  data-testid="switch-enable-email"
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

              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!config.notificationEmail) {
                    toast({
                      title: "Email Required",
                      description: "Please enter your email address first.",
                      variant: "destructive"
                    });
                    return;
                  }
                  toast({
                    title: "Sending Test Email...",
                    description: `Sending to ${config.notificationEmail}...`,
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
                  Send Test Email
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <CardTitle>SMS Notifications</CardTitle>
              </div>
              <CardDescription>
                Manage your phone number and SMS preferences. Update your number or unsubscribe anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userTier && SUBSCRIPTION_TIERS[userTier]?.smsEnabled ? (
                <>
              <div className="space-y-2">
                <Label htmlFor="sms-phone">Your Phone Number</Label>
                <Input 
                  id="sms-phone" 
                  placeholder="+1 (555) 123-4567"
                  value={config.smsPhone}
                  onChange={(e) => updateConfig('smsPhone', e.target.value)}
                  className="bg-background max-w-[300px]" 
                  data-testid="input-sms-phone"
                />
                <p className="text-[0.8rem] text-muted-foreground">
                  This is where we'll send SMS alerts. Include country code (e.g., +1 for US). Update it anytime if your number changes.
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-4 border-t border-sidebar-border">
                <div className="flex flex-col space-y-1">
                  <Label htmlFor="sms-enabled" className="font-medium">
                    {config.enableSms ? "SMS Alerts Enabled" : "SMS Alerts Disabled (Unsubscribed)"}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {config.enableSms 
                      ? "You will receive incident alerts via SMS. Toggle off to unsubscribe." 
                      : "You won't receive SMS alerts. Toggle on to subscribe."}
                  </span>
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
                </>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <Lock className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">SMS notifications require Growth or Enterprise plan</p>
                    <p className="text-xs text-muted-foreground mt-1">Upgrade your plan to receive incident alerts via SMS.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm hover-lift">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <CardTitle>Timezone</CardTitle>
              </div>
              <CardDescription>
                Set your preferred timezone for alerts and dashboard time displays.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone-select">Your Timezone</Label>
                <Select
                  value={config.timezone}
                  onValueChange={(value) => updateConfig('timezone', value)}
                >
                  <SelectTrigger className="w-full max-w-[350px]" data-testid="select-timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[0.8rem] text-muted-foreground">
                  All incident timestamps in emails, SMS alerts, and the dashboard will display in this timezone.
                </p>
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
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 text-primary`} />
                  <span className="font-medium">
                    {TIMEZONES.find(tz => tz.value === config.timezone)?.label || config.timezone}
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
                <Server className="w-5 h-5 text-primary" />
                <CardTitle>Subscription Management</CardTitle>
              </div>
              <CardDescription>
                Manage your plan, update payment methods, view billing history, or cancel your subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/subscription/portal', { method: 'POST' });
                    if (res.ok) {
                      const data = await res.json();
                      window.location.href = data.url;
                    } else {
                      const error = await res.json();
                      toast({
                        title: "Unable to Open Portal",
                        description: error.error || "Could not access subscription management.",
                        variant: "destructive"
                      });
                    }
                  } catch {
                    toast({
                      title: "Error",
                      description: "Could not connect to subscription management.",
                      variant: "destructive"
                    });
                  }
                }}
                data-testid="button-manage-subscription"
              >
                Manage My Subscription
              </Button>
              <p className="text-xs text-muted-foreground">
                Opens Stripe's secure portal where you can update your payment method, view invoices, change your plan, or cancel your subscription.
              </p>
            </CardContent>
          </Card>

          <TwoFactorSecurityCard />

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <CardTitle>Subscriptions</CardTitle>
                </div>
                <div className="flex rounded-lg bg-sidebar border border-sidebar-border p-1">
                  <button
                    onClick={() => setSubscriptionMode('vendors')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      subscriptionMode === 'vendors' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid="toggle-vendors"
                  >
                    <Server className="w-4 h-4 inline mr-1.5" />
                    Vendors
                  </button>
                  <button
                    onClick={() => setSubscriptionMode('blockchain')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      subscriptionMode === 'blockchain' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid="toggle-blockchain"
                  >
                    <Link2 className="w-4 h-4 inline mr-1.5" />
                    Blockchain
                  </button>
                </div>
              </div>
              <CardDescription>
                {subscriptionMode === 'vendors' ? (
                  <>
                    Choose which vendors you want to monitor and receive notifications for.
                    {selectedVendors.length === 0 && (
                      <span className="block mt-1 text-amber-500">No vendors selected - select vendors to start monitoring.</span>
                    )}
                  </>
                ) : (
                  <>
                    Choose which blockchain networks you want to monitor and receive notifications for.
                    {selectedChains.length === 0 && (
                      <span className="block mt-1 text-amber-500">No blockchains selected - select networks to start monitoring.</span>
                    )}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionMode === 'vendors' ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <GripVertical className="w-3 h-3" /> Drag to reorder vendors. Order is saved automatically.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {selectedVendors.length} of {allVendors.length} selected
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedVendors(allVendors.map(v => v.key))}
                        data-testid="button-select-all-vendors-top"
                      >
                        Select All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedVendors([])}
                        data-testid="button-clear-vendors-top"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={orderedVendors.map(v => v.key)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[...orderedVendors].sort((a, b) => a.name.localeCompare(b.name)).map((vendor) => (
                          <SortableVendorItem
                            key={vendor.key}
                            vendor={vendor}
                            isSelected={selectedVendors.includes(vendor.key)}
                            onToggle={(checked) => {
                              if (checked) {
                                if (vendorLimit !== null && selectedVendors.length >= vendorLimit) {
                                  toast({
                                    title: "Vendor Limit Reached",
                                    description: `Your ${tierConfig?.name || ''} plan allows up to ${vendorLimit} vendors. Upgrade to monitor more.`,
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                setSelectedVendors(prev => [...prev, vendor.key]);
                              } else {
                                setSelectedVendors(prev => prev.filter(k => k !== vendor.key));
                              }
                            }}
                            customerImpact={vendorImpacts[vendor.key] || 'medium'}
                            onImpactChange={(impact) => updateVendorImpact.mutate({ vendorKey: vendor.key, customerImpact: impact })}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  
                  <div className="flex flex-col gap-4 pt-4 border-t border-sidebar-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-sm text-muted-foreground">
                        {!vendorSubscriptions?.hasSetSubscriptions 
                          ? "Monitoring all vendors (default)" 
                          : selectedVendors.length === 0 
                          ? "No vendors selected" 
                          : vendorLimit !== null
                          ? `${selectedVendors.length} / ${vendorLimit} vendors selected`
                          : `${selectedVendors.length} of ${allVendors.length} vendors selected`}
                        {vendorLimit !== null && selectedVendors.length > vendorLimit && (
                          <span className="text-red-400 ml-2">
                            (over limit by {selectedVendors.length - vendorLimit})
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            if (vendorLimit !== null) {
                              setSelectedVendors(allVendors.slice(0, vendorLimit).map(v => v.key));
                            } else {
                              setSelectedVendors(allVendors.map(v => v.key));
                            }
                          }}
                          data-testid="button-select-all-vendors"
                        >
                          {vendorLimit !== null ? `Select Up to ${vendorLimit}` : 'Select All'}
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground sm:max-w-md">
                        {vendorSubscriptions?.hasSetSubscriptions 
                          ? "You have customized your vendor list. New vendors won't be added automatically."
                          : "Monitoring all vendors includes any new vendors added in the future."}
                      </p>
                      <div className="flex flex-wrap gap-2">
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
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Select blockchain networks to monitor for incidents and status changes.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {blockchainLimit !== null 
                          ? `${selectedChains.length} / ${blockchainLimit} selected`
                          : `${selectedChains.length} of ${allChains.length} selected`}
                        {blockchainLimit !== null && selectedChains.length > blockchainLimit && (
                          <span className="text-red-400 ml-1">(over limit)</span>
                        )}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (blockchainLimit !== null) {
                            setSelectedChains(allChains.slice(0, blockchainLimit).map((c: any) => c.key));
                          } else {
                            setSelectedChains(allChains.map((c: any) => c.key));
                          }
                        }}
                        data-testid="button-select-all-chains-top"
                      >
                        {blockchainLimit !== null ? `Select Up to ${blockchainLimit}` : 'Select All'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedChains([])}
                        data-testid="button-clear-chains-top"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[...allChains].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((chain: any) => (
                      <div
                        key={chain.key}
                        className="flex items-center gap-3 p-3 rounded-lg border border-sidebar-border bg-sidebar/50 hover:bg-sidebar/80 transition-colors"
                      >
                        <Checkbox
                          id={`chain-${chain.key}`}
                          checked={selectedChains.includes(chain.key)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if (blockchainLimit !== null && selectedChains.length >= blockchainLimit) {
                                toast({
                                  title: "Blockchain Limit Reached",
                                  description: `Your ${tierConfig?.name || ''} plan allows up to ${blockchainLimit} blockchain networks. Upgrade to monitor more.`,
                                  variant: "destructive"
                                });
                                return;
                              }
                              setSelectedChains(prev => [...prev, chain.key]);
                            } else {
                              setSelectedChains(prev => prev.filter(k => k !== chain.key));
                            }
                          }}
                          data-testid={`checkbox-chain-${chain.key}`}
                        />
                        <div className="flex-1 min-w-0">
                          <label 
                            htmlFor={`chain-${chain.key}`}
                            className="font-medium text-sm cursor-pointer block truncate"
                          >
                            {chain.name}
                          </label>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={`inline-flex items-center gap-1 ${
                              chain.status === 'operational' ? 'text-emerald-500' : 
                              chain.status === 'degraded' ? 'text-amber-500' : 'text-red-500'
                            }`}>
                              <CheckCircle2 className="w-3 h-3" />
                              {chain.status || 'Unknown'}
                            </span>
                            <span className="text-muted-foreground/60">•</span>
                            <span className="capitalize">{chain.category}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex flex-col gap-4 pt-4 border-t border-sidebar-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-sm text-muted-foreground">
                        {!blockchainSubscriptions?.hasSetSubscriptions 
                          ? "Monitoring all chains (default)" 
                          : selectedChains.length === 0 
                          ? "No chains selected" 
                          : blockchainLimit !== null
                          ? `${selectedChains.length} / ${blockchainLimit} chains selected`
                          : `${selectedChains.length} of ${allChains.length} chains selected`}
                        {blockchainLimit !== null && selectedChains.length > blockchainLimit && (
                          <span className="text-red-400 ml-2">(over limit)</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            if (blockchainLimit !== null) {
                              setSelectedChains(allChains.slice(0, blockchainLimit).map((c: any) => c.key));
                            } else {
                              setSelectedChains(allChains.map((c: any) => c.key));
                            }
                          }}
                          data-testid="button-select-all-chains"
                        >
                          {blockchainLimit !== null ? `Select Up to ${blockchainLimit}` : 'Select All'}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedChains([])}
                          data-testid="button-clear-chains"
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground sm:max-w-md">
                        {blockchainSubscriptions?.hasSetSubscriptions 
                          ? "You have customized your chain list. New chains won't be added automatically."
                          : "Monitoring all chains includes any new chains added in the future."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {blockchainSubscriptions?.hasSetSubscriptions && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => resetBlockchainSubscriptions.mutate()}
                            disabled={resetBlockchainSubscriptions.isPending}
                            data-testid="button-reset-chains"
                          >
                            Reset to Monitor All
                          </Button>
                        )}
                        <Button 
                          size="sm"
                          onClick={() => saveBlockchainSubscriptions.mutate(selectedChains)}
                          disabled={saveBlockchainSubscriptions.isPending}
                          data-testid="button-save-chains"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Custom Selection
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {user?.isAdmin && (
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
        )}

        {user?.isAdmin && (
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
        )}

        {user?.isAdmin && (
          <TabsContent value="users" className="space-y-6">
            <UsersManagementTab />
          </TabsContent>
        )}
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button variant="outline">Reset to Defaults</Button>
        <Button onClick={handleSave} className="gap-2" data-testid="button-save-notification-prefs">
          <Save className="w-4 h-4" /> Save Changes
        </Button>
      </div>
    </div>
  );
}

function TwoFactorSecurityCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [setupStep, setSetupStep] = useState<'idle' | 'scanning' | 'verifying'>('idle');
  const [setupData, setSetupData] = useState<{ qrCodeDataUrl: string; secret: string; recoveryCodes: string[] } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  const { data: twoFAStatus, isLoading } = useQuery<{ enabled: boolean; hasSecret: boolean }>({
    queryKey: ["/api/2fa/status"],
    queryFn: async () => {
      const res = await fetch("/api/2fa/status");
      if (!res.ok) throw new Error("Failed to fetch 2FA status");
      return res.json();
    },
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/2fa/setup", { method: "POST" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to setup 2FA");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSetupData(data);
      setSetupStep('scanning');
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const verifySetupMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/2fa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to verify");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/2fa/status"] });
      setSetupStep('idle');
      setShowRecoveryCodes(true);
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication is now active on your account.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to disable 2FA");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/2fa/status"] });
      setShowDisableDialog(false);
      setDisableCode('');
      setSetupData(null);
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled.",
        className: "bg-amber-500 border-amber-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disable Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const cancelSetup = () => {
    setSetupStep('idle');
    setSetupData(null);
    setVerificationCode('');
  };

  if (isLoading) {
    return (
      <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading security settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm hover-lift">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app like Google Authenticator or Authy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFAStatus?.enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">2FA is enabled</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is protected with two-factor authentication. You'll need to enter a code from your authenticator app when logging in.
              </p>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowDisableDialog(true)}
                data-testid="button-disable-2fa"
              >
                Disable 2FA
              </Button>
            </div>
          ) : setupStep === 'idle' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-amber-500 font-medium">2FA is not enabled</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Protect your account from unauthorized access. Once enabled, you'll need both your password and your phone to sign in.
              </p>
              <Button 
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                data-testid="button-enable-2fa"
              >
                {setupMutation.isPending ? "Setting up..." : "Enable 2FA"}
              </Button>
            </div>
          ) : setupStep === 'scanning' && setupData ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-sidebar-border bg-background/50">
                <h4 className="font-medium mb-2">Step 1: Scan QR Code</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img 
                    src={setupData.qrCodeDataUrl} 
                    alt="2FA QR Code" 
                    className="w-48 h-48"
                    data-testid="img-2fa-qr"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Can't scan? Enter this code manually: <code className="bg-background/80 px-2 py-1 rounded">{setupData.secret}</code>
                </p>
              </div>

              <div className="p-4 rounded-lg border border-sidebar-border bg-background/50">
                <h4 className="font-medium mb-2">Step 2: Enter Verification Code</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Enter the 6-digit code from your authenticator app to verify setup.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="max-w-[150px] text-center text-lg tracking-widest"
                    data-testid="input-2fa-verify-code"
                  />
                  <Button
                    onClick={() => verifySetupMutation.mutate(verificationCode)}
                    disabled={verificationCode.length !== 6 || verifySetupMutation.isPending}
                    data-testid="button-verify-2fa"
                  >
                    {verifySetupMutation.isPending ? "Verifying..." : "Verify & Enable"}
                  </Button>
                  <Button variant="outline" onClick={cancelSetup}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showRecoveryCodes && setupData && (
        <Card className="border-amber-500/50 bg-amber-500/5 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-amber-500">Save Your Recovery Codes</CardTitle>
            </div>
            <CardDescription>
              These codes can be used to access your account if you lose your authenticator device. Each code can only be used once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-4 bg-background/50 rounded-lg font-mono text-sm">
              {setupData.recoveryCodes.map((code, idx) => (
                <div key={idx} className="p-2 bg-background rounded border border-sidebar-border">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(setupData.recoveryCodes.join('\n'));
                  toast({
                    title: "Copied!",
                    description: "Recovery codes copied to clipboard.",
                    className: "bg-emerald-500 border-emerald-500 text-white"
                  });
                }}
                data-testid="button-copy-recovery-codes"
              >
                <Copy className="w-4 h-4 mr-2" /> Copy Codes
              </Button>
              <Button onClick={() => setShowRecoveryCodes(false)} data-testid="button-dismiss-recovery-codes">
                I've Saved These Codes
              </Button>
            </div>
            <p className="text-xs text-amber-500">
              Store these codes in a safe place. You won't be able to see them again!
            </p>
          </CardContent>
        </Card>
      )}

      {showDisableDialog && (
        <Card className="border-red-500/50 bg-red-500/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-red-500">Disable Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter a code from your authenticator app or a recovery code to confirm disabling 2FA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="max-w-[200px]"
                data-testid="input-disable-2fa-code"
              />
              <Button
                variant="destructive"
                onClick={() => disableMutation.mutate(disableCode)}
                disabled={!disableCode || disableMutation.isPending}
                data-testid="button-confirm-disable-2fa"
              >
                {disableMutation.isPending ? "Disabling..." : "Confirm Disable"}
              </Button>
              <Button variant="outline" onClick={() => { setShowDisableDialog(false); setDisableCode(''); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function UsersManagementTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: allUsers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const res = await fetch(`/api/admin/users/${userId}/admin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin }),
      });
      if (!res.ok) throw new Error("Failed to update admin status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Updated",
        description: "Admin status has been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Could not update admin status.",
        variant: "destructive"
      });
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string | null }) => {
      const res = await fetch(`/api/admin/users/${userId}/tier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error("Failed to update tier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Updated",
        description: "Subscription tier has been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Could not update subscription tier.",
        variant: "destructive"
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading users...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-500" />
          User Management
        </CardTitle>
        <CardDescription>
          Manage user admin privileges and subscription tiers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {allUsers.map((u: any) => (
              <div
                key={u.id}
                className="flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 rounded-lg border border-sidebar-border bg-background/50 hover:bg-background/80 transition-colors gap-3"
                data-testid={`user-row-${u.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium flex flex-wrap items-center gap-2 text-sm md:text-base">
                      <span className="truncate">{u.email || u.firstName || "Unknown User"}</span>
                      {u.isAdmin && (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-xs shrink-0">
                          Admin
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      ID: {u.id.substring(0, 20)}...
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 md:gap-4 pl-0 md:pl-0">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground hidden md:inline">Tier:</Label>
                    <Select
                      value={u.subscriptionTier || "none"}
                      onValueChange={(tier) => updateTierMutation.mutate({ 
                        userId: u.id, 
                        tier: tier === "none" ? null : tier 
                      })}
                    >
                      <SelectTrigger className="w-[100px] md:w-[120px] h-8" data-testid={`tier-select-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Tier</SelectItem>
                        <SelectItem value="essential">Essential</SelectItem>
                        <SelectItem value="growth">
                          <div className="flex items-center gap-1">
                            <Crown className="w-3 h-3 text-yellow-500" /> Growth
                          </div>
                        </SelectItem>
                        <SelectItem value="enterprise">
                          <div className="flex items-center gap-1">
                            <Crown className="w-3 h-3 text-purple-500" /> Enterprise
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground hidden md:inline">Admin:</Label>
                    <Switch
                      checked={u.isAdmin || false}
                      onCheckedChange={(checked) => updateAdminMutation.mutate({ 
                        userId: u.id, 
                        isAdmin: checked 
                      })}
                      data-testid={`admin-switch-${u.id}`}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {allUsers.length === 0 && (
              <div className="text-center p-8 text-muted-foreground">
                No users found
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface SortableVendorItemProps {
  vendor: Vendor;
  isSelected: boolean;
  onToggle: (checked: boolean) => void;
  customerImpact: string;
  onImpactChange: (impact: string) => void;
}

function SortableVendorItem({ vendor, isSelected, onToggle, customerImpact, onImpactChange }: SortableVendorItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: vendor.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const impactStyles: Record<string, string> = {
    high: 'border-l-4 border-l-red-500',
    medium: 'border-l-4 border-l-yellow-500',
    low: 'border-l-4 border-l-blue-500',
  };

  const impactIcons: Record<string, React.ReactNode> = {
    high: <AlertTriangle className="w-3 h-3 text-red-500" />,
    medium: <AlertCircle className="w-3 h-3 text-yellow-500" />,
    low: <Info className="w-3 h-3 text-blue-500" />,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border border-sidebar-border bg-background/50 hover:bg-background/80 transition-colors ${isDragging ? 'shadow-lg' : ''} ${impactStyles[customerImpact] || ''}`}
      data-testid={`sortable-vendor-${vendor.key}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        data-testid={`drag-handle-${vendor.key}`}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <Checkbox
        id={`vendor-${vendor.key}`}
        checked={isSelected}
        onCheckedChange={onToggle}
        data-testid={`checkbox-vendor-${vendor.key}`}
      />
      <div className="flex flex-col flex-1">
        <Label htmlFor={`vendor-${vendor.key}`} className="text-sm font-medium cursor-pointer">
          {vendor.name}
        </Label>
        <span className="text-xs text-muted-foreground capitalize">
          {vendor.status === 'operational' ? '✓ Operational' : vendor.status}
        </span>
      </div>
      <Select value={customerImpact} onValueChange={onImpactChange}>
        <SelectTrigger className="w-[110px] h-8 text-xs" data-testid={`impact-select-${vendor.key}`}>
          <div className="flex items-center gap-1">
            {impactIcons[customerImpact]}
            <SelectValue placeholder="Impact" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="high">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span>High</span>
            </div>
          </SelectItem>
          <SelectItem value="medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-yellow-500" />
              <span>Medium</span>
            </div>
          </SelectItem>
          <SelectItem value="low">
            <div className="flex items-center gap-2">
              <Info className="w-3 h-3 text-blue-500" />
              <span>Low</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
