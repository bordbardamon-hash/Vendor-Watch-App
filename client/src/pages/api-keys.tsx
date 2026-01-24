import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Key, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Clock, 
  Pencil,
  AlertTriangle,
  Lock,
  Copy,
  Eye,
  BarChart3,
  Calendar
} from "lucide-react";
import { Link } from "wouter";

interface ApiKeyConfig {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string;
  rateLimit: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  plainKey?: string;
}

interface ApiRequestLog {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const SCOPE_OPTIONS = [
  { value: 'read', label: 'Read Only' },
  { value: 'read_write', label: 'Read/Write' },
  { value: 'full', label: 'Full Access' },
];

const scopeLabels: Record<string, string> = {
  read: 'Read Only',
  read_write: 'Read/Write',
  full: 'Full Access',
};

const scopeBadgeColors: Record<string, string> = {
  read: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  read_write: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  full: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function formatDate(timestamp: string | null): string {
  if (!timestamp) return 'No expiration';
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export default function ApiKeysPage() {
  const { user, isLoading: isLoadingUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyConfig | null>(null);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedKeyForLogs, setSelectedKeyForLogs] = useState<ApiKeyConfig | null>(null);
  const [newKeyDialog, setNewKeyDialog] = useState<{ open: boolean; key: string | null }>({ open: false, key: null });
  
  const [formData, setFormData] = useState({
    name: '',
    scopes: 'read',
    expiresAt: '',
  });

  const tier = user?.subscriptionTier;
  const hasAccess = tier === 'enterprise' || tier === 'platinum';

  const { data: apiKeys = [], isLoading } = useQuery<ApiKeyConfig[]>({
    queryKey: ["/api/api-keys"],
    queryFn: async () => {
      const res = await fetch("/api/api-keys", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch API keys");
      }
      return res.json();
    },
    enabled: hasAccess,
  });

  const { data: keyLogs = [] } = useQuery<ApiRequestLog[]>({
    queryKey: ["/api/api-keys", selectedKeyForLogs?.id, "logs"],
    queryFn: async () => {
      if (!selectedKeyForLogs) return [];
      const res = await fetch(`/api/api-keys/${selectedKeyForLogs.id}/logs`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch API key logs");
      }
      return res.json();
    },
    enabled: !!selectedKeyForLogs && logsDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          scopes: data.scopes,
          expiresAt: data.expiresAt || undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create API key");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setCreateDialogOpen(false);
      resetForm();
      setNewKeyDialog({ open: true, key: data.plainKey });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData & { isActive?: boolean }> }) => {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update API key");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setEditingKey(null);
      resetForm();
      toast({ title: "API key updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete API key");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "API key revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke API key", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update API key");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      scopes: 'read',
      expiresAt: '',
    });
  };

  const openEditDialog = (key: ApiKeyConfig) => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      scopes: key.scopes,
      expiresAt: key.expiresAt || '',
    });
  };

  const openLogsDialog = (key: ApiKeyConfig) => {
    setSelectedKeyForLogs(key);
    setLogsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    if (editingKey) {
      updateMutation.mutate({ id: editingKey.id, data: { name: formData.name, scopes: formData.scopes as 'read' | 'read_write' | 'full' } });
    } else {
      createMutation.mutate(formData);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-spinner">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">API Access</h1>
          <p className="text-muted-foreground">Manage API keys for programmatic access</p>
        </div>
        
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lock className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Enterprise Feature</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              API keys for programmatic access are available on the Enterprise plan.
              Upgrade to automate your workflow with our REST API.
            </p>
            <Link href="/pricing">
              <Button data-testid="button-upgrade">
                Upgrade to Enterprise
              </Button>
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
          <h1 className="text-2xl font-bold" data-testid="text-page-title">API Access</h1>
          <p className="text-muted-foreground">Manage API keys for programmatic access</p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-api-key">
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for programmatic access to VendorWatch.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production API Key"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-key-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="scopes">Permissions</Label>
                <Select
                  value={formData.scopes}
                  onValueChange={(value) => setFormData({ ...formData, scopes: value })}
                >
                  <SelectTrigger data-testid="select-scopes">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  data-testid="input-expires-at"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={createMutation.isPending}
                data-testid="button-save-key"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={newKeyDialog.open} onOpenChange={(open) => setNewKeyDialog({ ...newKeyDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200">
                  This is the only time you will see this key. Please copy it and store it securely.
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={newKeyDialog.key || ''}
                  className="font-mono text-sm"
                  data-testid="input-new-key"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => newKeyDialog.key && copyToClipboard(newKeyDialog.key)}
                  data-testid="button-copy-key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setNewKeyDialog({ open: false, key: null })}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingKey} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
            <DialogDescription>
              Update the name and permissions for this API key.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-key-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-scopes">Permissions</Label>
              <Select
                value={formData.scopes}
                onValueChange={(value) => setFormData({ ...formData, scopes: value })}
              >
                <SelectTrigger data-testid="select-edit-scopes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKey(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={updateMutation.isPending}
              data-testid="button-update-key"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>API Key Usage</DialogTitle>
            <DialogDescription>
              Recent API requests made with "{selectedKeyForLogs?.name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 max-h-[400px] overflow-y-auto">
            {keyLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No API requests recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {keyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={log.statusCode < 400 ? 'text-emerald-400' : 'text-red-400'}>
                        {log.statusCode}
                      </Badge>
                      <span className="font-mono text-xs">
                        {log.method} {log.endpoint}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      {log.durationMs && <span>{log.durationMs}ms</span>}
                      <span>{formatTimestamp(log.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground mb-4">
              Create your first API key to start using the VendorWatch API.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-key">
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <Card key={key.id} data-testid={`api-key-card-${key.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${key.isActive ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                      <Key className={`h-5 w-5 ${key.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" data-testid={`text-key-name-${key.id}`}>{key.name}</h3>
                        <Badge variant="outline" className={scopeBadgeColors[key.scopes] || ''}>
                          {scopeLabels[key.scopes] || key.scopes}
                        </Badge>
                        {!key.isActive && (
                          <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="font-mono" data-testid={`text-key-prefix-${key.id}`}>
                          {key.keyPrefix}****
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last used: {formatTimestamp(key.lastUsedAt)}
                        </span>
                        {key.expiresAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expires: {formatDate(key.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={key.isActive}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: key.id, isActive: checked })}
                      data-testid={`switch-key-active-${key.id}`}
                    />
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openLogsDialog(key)}
                      data-testid={`button-view-logs-${key.id}`}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(key)}
                      data-testid={`button-edit-key-${key.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => {
                        if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
                          deleteMutation.mutate(key.id);
                        }
                      }}
                      data-testid={`button-delete-key-${key.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <p className="text-sm text-muted-foreground text-center">
            {apiKeys.length} of 5 API keys used
          </p>
        </div>
      )}
    </div>
  );
}
