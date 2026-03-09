import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Webhook, 
  Plus, 
  Trash2, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Clock, 
  ExternalLink, 
  Pencil,
  FileText,
  Send,
  AlertTriangle,
  Lock
} from "lucide-react";
import { Link } from "wouter";

interface WebhookConfig {
  id: string;
  userId: string;
  name: string;
  url: string;
  secretKey: string | null;
  eventTypes: string[];
  vendorFilters: string[];
  customHeaders: string | null;
  isActive: boolean;
  successCount: number;
  failureCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  webhookId: string;
  eventType: string;
  statusCode: number | null;
  success: boolean;
  durationMs: number | null;
  payload: string;
  responseBody: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface Vendor {
  id: number;
  key: string;
  name: string;
}

const EVENT_TYPES = [
  { value: 'all', label: 'All Events' },
  { value: 'new_incident', label: 'New Incident' },
  { value: 'incident_update', label: 'Incident Update' },
  { value: 'incident_resolved', label: 'Incident Resolved' },
];

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

function isValidJson(str: string): boolean {
  if (!str.trim()) return true;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export default function Webhooks() {
  const { user, isLoading: isLoadingUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedWebhookForLogs, setSelectedWebhookForLogs] = useState<WebhookConfig | null>(null);
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secretKey: '',
    eventTypes: ['all'] as string[],
    vendorFilters: [] as string[],
    customHeaders: '',
  });

  const tier = user?.subscriptionTier;
  const hasAccess = tier === 'essential' || tier === 'growth' || tier === 'enterprise';

  const { data: webhooks = [], isLoading } = useQuery<WebhookConfig[]>({
    queryKey: ["/api/webhooks"],
    queryFn: async () => {
      const res = await fetch("/api/webhooks", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch webhooks");
      }
      return res.json();
    },
    enabled: hasAccess,
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: hasAccess,
  });

  const { data: webhookLogs = [] } = useQuery<WebhookLog[]>({
    queryKey: ["/api/webhooks", selectedWebhookForLogs?.id, "logs"],
    queryFn: async () => {
      if (!selectedWebhookForLogs) return [];
      const res = await fetch(`/api/webhooks/${selectedWebhookForLogs.id}/logs`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch webhook logs");
      }
      return res.json();
    },
    enabled: !!selectedWebhookForLogs && logsDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create webhook");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Webhook created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update webhook");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setEditingWebhook(null);
      resetForm();
      toast({ title: "Webhook updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete webhook");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: "Webhook deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete webhook", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update webhook");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to test webhook");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      if (data.success) {
        toast({ 
          title: "Test successful", 
          description: `Status code: ${data.statusCode}`,
        });
      } else {
        toast({ 
          title: "Test failed", 
          description: data.error || `Status code: ${data.statusCode}`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      secretKey: '',
      eventTypes: ['all'],
      vendorFilters: [],
      customHeaders: '',
    });
  };

  const openEditDialog = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secretKey: webhook.secretKey || '',
      eventTypes: webhook.eventTypes.length > 0 ? webhook.eventTypes : ['all'],
      vendorFilters: webhook.vendorFilters || [],
      customHeaders: webhook.customHeaders || '',
    });
  };

  const openLogsDialog = (webhook: WebhookConfig) => {
    setSelectedWebhookForLogs(webhook);
    setLogsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!isValidUrl(formData.url)) {
      toast({ title: "Please enter a valid URL", variant: "destructive" });
      return;
    }
    if (!isValidJson(formData.customHeaders)) {
      toast({ title: "Custom headers must be valid JSON", variant: "destructive" });
      return;
    }

    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleEventType = (value: string) => {
    if (value === 'all') {
      setFormData({ ...formData, eventTypes: ['all'] });
    } else {
      let newTypes = formData.eventTypes.filter(t => t !== 'all');
      if (newTypes.includes(value)) {
        newTypes = newTypes.filter(t => t !== value);
      } else {
        newTypes.push(value);
      }
      if (newTypes.length === 0) {
        newTypes = ['all'];
      }
      setFormData({ ...formData, eventTypes: newTypes });
    }
  };

  const toggleVendorFilter = (vendorKey: string) => {
    const newFilters = formData.vendorFilters.includes(vendorKey)
      ? formData.vendorFilters.filter(v => v !== vendorKey)
      : [...formData.vendorFilters, vendorKey];
    setFormData({ ...formData, vendorFilters: newFilters });
  };

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Webhook className="h-8 w-8 text-cyan-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Webhooks</h1>
            <p className="text-gray-400 text-sm">Configure custom HTTP webhooks for incident alerts</p>
          </div>
        </div>
        
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h3 className="font-semibold mb-2 text-white text-lg">Essential Plan Required</h3>
            <p className="text-gray-400 mb-4">
              Upgrade to Essential or higher to configure custom webhooks for automated incident notifications.
            </p>
            <Link href="/pricing">
              <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="btn-upgrade">
                Upgrade Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const WebhookFormContent = () => (
    <div className="space-y-4 mt-4">
      <div>
        <Label>Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My Webhook"
          className="bg-gray-800 border-gray-600 mt-1"
          data-testid="input-webhook-name"
        />
      </div>
      
      <div>
        <Label>URL *</Label>
        <Input
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="https://your-service.com/webhook"
          className="bg-gray-800 border-gray-600 mt-1"
          data-testid="input-webhook-url"
        />
      </div>
      
      <div>
        <Label>Secret Key (optional)</Label>
        <Input
          value={formData.secretKey}
          onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
          placeholder="For HMAC signature verification"
          type="password"
          className="bg-gray-800 border-gray-600 mt-1"
          data-testid="input-webhook-secret"
        />
        <p className="text-xs text-gray-500 mt-1">Used to sign webhook payloads with HMAC-SHA256</p>
      </div>
      
      <div>
        <Label className="mb-2 block">Event Types</Label>
        <div className="space-y-2">
          {EVENT_TYPES.map((type) => (
            <div key={type.value} className="flex items-center gap-2">
              <Checkbox
                id={`event-${type.value}`}
                checked={formData.eventTypes.includes(type.value)}
                onCheckedChange={() => toggleEventType(type.value)}
                data-testid={`checkbox-event-${type.value}`}
              />
              <label htmlFor={`event-${type.value}`} className="text-sm text-gray-300 cursor-pointer">
                {type.label}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <Label className="mb-2 block">Vendor Filter (optional)</Label>
        <p className="text-xs text-gray-500 mb-2">Leave empty to receive alerts for all vendors</p>
        <ScrollArea className="h-[120px] border border-gray-700 rounded p-2">
          {vendors.map((vendor) => (
            <div key={vendor.key} className="flex items-center gap-2 py-1">
              <Checkbox
                id={`vendor-${vendor.key}`}
                checked={formData.vendorFilters.includes(vendor.key)}
                onCheckedChange={() => toggleVendorFilter(vendor.key)}
                data-testid={`checkbox-vendor-${vendor.key}`}
              />
              <label htmlFor={`vendor-${vendor.key}`} className="text-sm text-gray-300 cursor-pointer">
                {vendor.name}
              </label>
            </div>
          ))}
        </ScrollArea>
      </div>
      
      <div>
        <Label>Custom Headers (JSON)</Label>
        <Textarea
          value={formData.customHeaders}
          onChange={(e) => setFormData({ ...formData, customHeaders: e.target.value })}
          placeholder='{"Authorization": "Bearer token"}'
          className="bg-gray-800 border-gray-600 mt-1 font-mono text-sm"
          rows={3}
          data-testid="input-webhook-headers"
        />
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Webhook className="h-8 w-8 text-cyan-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Webhooks</h1>
            <p className="text-gray-400 text-sm">Configure custom HTTP webhooks for incident alerts</p>
          </div>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-cyan-600 hover:bg-cyan-700" 
              onClick={() => resetForm()}
              data-testid="btn-add-webhook"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-cyan-400">Add Webhook</DialogTitle>
              <DialogDescription className="text-gray-400">
                Configure a new webhook endpoint to receive incident notifications.
              </DialogDescription>
            </DialogHeader>
            <WebhookFormContent />
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="btn-cancel-create">
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={createMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="btn-save-webhook"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-8 text-center">
            <Webhook className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h3 className="font-semibold mb-2 text-white">No webhooks configured</h3>
            <p className="text-gray-400 mb-4">
              Create your first webhook to receive incident notifications via HTTP.
            </p>
            <Button 
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={() => setCreateDialogOpen(true)}
              data-testid="btn-add-first-webhook"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {webhooks.map((webhook) => (
            <Card 
              key={webhook.id} 
              className="bg-gray-900 border-gray-700"
              data-testid={`card-webhook-${webhook.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-lg truncate">{webhook.name}</CardTitle>
                    <CardDescription className="text-gray-400 truncate mt-1" title={webhook.url}>
                      {truncateUrl(webhook.url)}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={webhook.isActive}
                    onCheckedChange={(isActive) => toggleActiveMutation.mutate({ id: webhook.id, isActive })}
                    data-testid={`switch-active-${webhook.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {webhook.eventTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {EVENT_TYPES.find(t => t.value === type)?.label || type}
                    </Badge>
                  ))}
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-400" data-testid={`count-success-${webhook.id}`}>
                      {webhook.successCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-red-400" data-testid={`count-failure-${webhook.id}`}>
                      {webhook.failureCount}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>Last triggered: {formatTimestamp(webhook.lastTriggeredAt)}</span>
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(webhook)}
                    data-testid={`btn-edit-${webhook.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testMutation.mutate(webhook.id)}
                    disabled={testMutation.isPending}
                    data-testid={`btn-test-${webhook.id}`}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openLogsDialog(webhook)}
                    data-testid={`btn-logs-${webhook.id}`}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(webhook.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    data-testid={`btn-delete-${webhook.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingWebhook} onOpenChange={(open) => !open && setEditingWebhook(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Edit Webhook</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update your webhook configuration.
            </DialogDescription>
          </DialogHeader>
          <WebhookFormContent />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditingWebhook(null)} data-testid="btn-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={updateMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-700"
              data-testid="btn-update-webhook"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Webhook Logs</DialogTitle>
            <DialogDescription className="text-gray-400">
              Recent delivery attempts for {selectedWebhookForLogs?.name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] mt-4">
            {webhookLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No delivery attempts yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {webhookLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-3 bg-gray-800 rounded-lg flex items-center justify-between"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {log.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {EVENT_TYPES.find(t => t.value === log.eventType)?.label || log.eventType}
                          </Badge>
                          {log.statusCode && (
                            <Badge 
                              className={`text-xs ${log.success ? 'bg-green-600' : 'bg-red-600'}`}
                            >
                              {log.statusCode}
                            </Badge>
                          )}
                          {log.durationMs && (
                            <span className="text-xs text-gray-500">{log.durationMs}ms</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(log.createdAt)}
                        </p>
                        {log.errorMessage && (
                          <p className="text-xs text-red-400 mt-1">{log.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPayload(log.payload);
                        setPayloadDialogOpen(true);
                      }}
                      data-testid={`btn-view-payload-${log.id}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={payloadDialogOpen} onOpenChange={setPayloadDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Payload</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] mt-4">
            <pre className="text-xs font-mono bg-gray-950 p-4 rounded overflow-x-auto whitespace-pre-wrap">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(selectedPayload), null, 2);
                } catch {
                  return selectedPayload;
                }
              })()}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
