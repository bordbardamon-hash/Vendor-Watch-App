import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Key, Shield, Plus, Trash2, Pencil, Play, ExternalLink, AlertCircle, Lock, Crown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type SsoProvider = 'saml' | 'oidc' | 'okta' | 'azure_ad';

interface SsoConfiguration {
  id: string;
  organizationId: string;
  provider: SsoProvider;
  displayName: string;
  entityId: string | null;
  ssoUrl: string | null;
  certificate: string | null;
  clientId: string | null;
  clientSecret: string | null;
  issuerUrl: string | null;
  emailDomain: string | null;
  autoProvision: boolean;
  defaultRole: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  success: boolean;
  errors?: string[];
  warnings?: string[];
  message?: string;
}

const providerLabels: Record<SsoProvider, string> = {
  saml: 'SAML 2.0',
  oidc: 'OpenID Connect',
  okta: 'Okta',
  azure_ad: 'Azure AD',
};

const providerDescriptions: Record<SsoProvider, string> = {
  saml: 'Standard SAML 2.0 identity provider',
  oidc: 'OpenID Connect identity provider',
  okta: 'Okta SSO with pre-configured SAML settings',
  azure_ad: 'Microsoft Azure Active Directory',
};

const roleLabels: Record<string, string> = {
  master_admin: 'Master Admin',
  member_rw: 'Read/Write',
  member_ro: 'Read-Only',
};

function SsoConfigForm({
  config,
  onSave,
  onCancel,
  isSaving,
}: {
  config?: SsoConfiguration;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [provider, setProvider] = useState<SsoProvider>(config?.provider || 'saml');
  const [displayName, setDisplayName] = useState(config?.displayName || '');
  const [emailDomain, setEmailDomain] = useState(config?.emailDomain || '');
  const [entityId, setEntityId] = useState(config?.entityId || '');
  const [ssoUrl, setSsoUrl] = useState(config?.ssoUrl || '');
  const [certificate, setCertificate] = useState(config?.certificate || '');
  const [clientId, setClientId] = useState(config?.clientId || '');
  const [clientSecret, setClientSecret] = useState(config?.clientSecret || '');
  const [issuerUrl, setIssuerUrl] = useState(config?.issuerUrl || '');
  const [autoProvision, setAutoProvision] = useState(config?.autoProvision ?? true);
  const [defaultRole, setDefaultRole] = useState(config?.defaultRole || 'member_ro');

  const isSamlBased = provider === 'saml' || provider === 'okta' || provider === 'azure_ad';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      provider,
      displayName,
      emailDomain,
      entityId: isSamlBased ? entityId : null,
      ssoUrl: isSamlBased ? ssoUrl : null,
      certificate: isSamlBased ? certificate : null,
      clientId: !isSamlBased ? clientId : null,
      clientSecret: !isSamlBased ? clientSecret : null,
      issuerUrl: !isSamlBased ? issuerUrl : null,
      autoProvision,
      defaultRole,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="provider">Provider Type</Label>
        <Select value={provider} onValueChange={(v) => setProvider(v as SsoProvider)} disabled={!!config}>
          <SelectTrigger id="provider" data-testid="select-provider">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(providerLabels) as SsoProvider[]).map((p) => (
              <SelectItem key={p} value={p}>
                <div className="flex flex-col">
                  <span>{providerLabels[p]}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{providerDescriptions[provider]}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Company SSO"
          required
          data-testid="input-display-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emailDomain">Email Domain</Label>
        <Input
          id="emailDomain"
          value={emailDomain}
          onChange={(e) => setEmailDomain(e.target.value)}
          placeholder="@company.com"
          required
          data-testid="input-email-domain"
        />
        <p className="text-xs text-muted-foreground">Users with this email domain will be prompted to use SSO</p>
      </div>

      {isSamlBased && (
        <>
          <div className="space-y-2">
            <Label htmlFor="entityId">Entity ID (Issuer)</Label>
            <Input
              id="entityId"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="https://idp.company.com/saml/metadata"
              required
              data-testid="input-entity-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssoUrl">SSO URL (Single Sign-On Service URL)</Label>
            <Input
              id="ssoUrl"
              value={ssoUrl}
              onChange={(e) => setSsoUrl(e.target.value)}
              placeholder="https://idp.company.com/saml/sso"
              required
              data-testid="input-sso-url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="certificate">X.509 Certificate</Label>
            <Textarea
              id="certificate"
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              className="font-mono text-xs"
              rows={6}
              required
              data-testid="textarea-certificate"
            />
            <p className="text-xs text-muted-foreground">Paste the full PEM-encoded X.509 certificate from your identity provider</p>
          </div>
        </>
      )}

      {!isSamlBased && (
        <>
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="your-client-id"
              required
              data-testid="input-client-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="your-client-secret"
              required
              data-testid="input-client-secret"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issuerUrl">Issuer URL</Label>
            <Input
              id="issuerUrl"
              value={issuerUrl}
              onChange={(e) => setIssuerUrl(e.target.value)}
              placeholder="https://accounts.google.com"
              required
              data-testid="input-issuer-url"
            />
            <p className="text-xs text-muted-foreground">The base URL for OIDC discovery (/.well-known/openid-configuration)</p>
          </div>
        </>
      )}

      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto-provision users</Label>
            <p className="text-xs text-muted-foreground">Create user accounts automatically on first SSO login</p>
          </div>
          <Switch
            checked={autoProvision}
            onCheckedChange={setAutoProvision}
            data-testid="switch-auto-provision"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultRole">Default Role for New Users</Label>
          <Select value={defaultRole} onValueChange={setDefaultRole}>
            <SelectTrigger id="defaultRole" data-testid="select-default-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member_ro">Read-Only</SelectItem>
              <SelectItem value="member_rw">Read/Write</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} data-testid="button-save-config">
          {isSaving ? 'Saving...' : (config ? 'Update Configuration' : 'Create Configuration')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function SsoPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SsoConfiguration | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; result: TestResult } | null>(null);

  const { data: configs, isLoading, error } = useQuery<SsoConfiguration[]>({
    queryKey: ["/api/sso-configurations"],
    queryFn: async () => {
      const res = await fetch("/api/sso-configurations");
      if (!res.ok) {
        const data = await res.json();
        throw data;
      }
      return res.json();
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sso-configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create configuration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso-configurations"] });
      setIsCreating(false);
      toast({
        title: "Configuration Created",
        description: "SSO configuration has been created. Test it before activating.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/sso-configurations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update configuration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso-configurations"] });
      setEditingConfig(null);
      toast({
        title: "Configuration Updated",
        description: "SSO configuration has been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sso-configurations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete configuration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso-configurations"] });
      toast({
        title: "Configuration Deleted",
        description: "SSO configuration has been deleted.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sso-configurations/${id}/test`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to test configuration");
      }
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (result, id) => {
      setTestResult({ id, result });
      if (result.success) {
        toast({
          title: "Test Passed",
          description: result.message || "SSO configuration is valid",
          className: "bg-emerald-500 border-emerald-500 text-white"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/sso-configurations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update configuration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sso-configurations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Handle access errors
  if (error) {
    const err = error as any;
    
    // Non-Enterprise users
    if (err.requiresEnterprise) {
      return (
        <div className="space-y-6 p-4 md:p-6">
          <div>
            <h1 className="text-2xl font-bold">Single Sign-On</h1>
            <p className="text-muted-foreground">Configure SAML or OIDC authentication for your organization</p>
          </div>
          
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Lock className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Enterprise Feature</CardTitle>
                  <CardDescription>SSO/SAML authentication requires an Enterprise plan</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Single Sign-On (SSO) allows your team members to authenticate using your organization's identity provider, 
                providing centralized access control and enhanced security.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  SAML 2.0 and OpenID Connect support
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Pre-configured templates for Okta, Azure AD, and more
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Automatic user provisioning on first login
                </li>
              </ul>
              <Button onClick={() => setLocation("/settings")} data-testid="button-upgrade">
                Upgrade to Enterprise
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Non-master-admin
    if (err.requiresMasterAdmin) {
      return (
        <div className="space-y-6 p-4 md:p-6">
          <div>
            <h1 className="text-2xl font-bold">Single Sign-On</h1>
            <p className="text-muted-foreground">Configure SAML or OIDC authentication for your organization</p>
          </div>
          
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Crown className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Admin Access Required</CardTitle>
                  <CardDescription>Only organization admins can manage SSO settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please contact your organization's master admin to configure Single Sign-On settings for your team.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Generic error
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">Single Sign-On</h1>
          <p className="text-muted-foreground">Configure SAML or OIDC authentication for your organization</p>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{err.error || "Failed to load SSO configurations"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Single Sign-On</h1>
          <p className="text-muted-foreground">Configure SAML or OIDC authentication for your organization</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-config">
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add SSO Configuration</DialogTitle>
              <DialogDescription>
                Configure a new identity provider for your organization
              </DialogDescription>
            </DialogHeader>
            <SsoConfigForm
              onSave={(data) => createMutation.mutate(data)}
              onCancel={() => setIsCreating(false)}
              isSaving={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-60" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : configs && configs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Key className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No SSO Configurations</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Add your first identity provider to enable Single Sign-On for your organization.
            </p>
            <Button onClick={() => setIsCreating(true)} data-testid="button-add-first-config">
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs?.map((config) => (
            <Card key={config.id} data-testid={`card-sso-${config.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {config.displayName}
                        <Badge variant={config.isActive ? "default" : "secondary"} className={config.isActive ? "bg-emerald-500" : ""}>
                          {config.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>{providerLabels[config.provider]}</span>
                        {config.emailDomain && (
                          <>
                            <span>•</span>
                            <span>{config.emailDomain}</span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.isActive}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: config.id, isActive: checked })}
                      data-testid={`switch-active-${config.id}`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {testResult?.id === config.id && !testResult.result.success && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Test Failed</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {testResult.result.errors?.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                      {testResult.result.warnings && testResult.result.warnings.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium text-amber-500">Warnings:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {testResult.result.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate(config.id)}
                    disabled={testMutation.isPending}
                    data-testid={`button-test-${config.id}`}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    {testMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>

                  <Dialog open={editingConfig?.id === config.id} onOpenChange={(open) => !open && setEditingConfig(null)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingConfig(config)}
                        data-testid={`button-edit-${config.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit SSO Configuration</DialogTitle>
                        <DialogDescription>
                          Update your identity provider settings
                        </DialogDescription>
                      </DialogHeader>
                      {editingConfig && (
                        <SsoConfigForm
                          config={editingConfig}
                          onSave={(data) => updateMutation.mutate({ id: editingConfig.id, data })}
                          onCancel={() => setEditingConfig(null)}
                          isSaving={updateMutation.isPending}
                        />
                      )}
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" data-testid={`button-delete-${config.id}`}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete SSO Configuration?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the "{config.displayName}" SSO configuration. 
                          Users will no longer be able to sign in using this identity provider.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-500 hover:bg-red-600"
                          onClick={() => deleteMutation.mutate(config.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                  <div>
                    <p className="text-muted-foreground">Auto-provision</p>
                    <p className="font-medium">{config.autoProvision ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Default Role</p>
                    <p className="font-medium">{roleLabels[config.defaultRole] || config.defaultRole}</p>
                  </div>
                  {config.lastUsedAt && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Last Used</p>
                      <p className="font-medium">{new Date(config.lastUsedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Guides</CardTitle>
          <CardDescription>Step-by-step instructions for popular identity providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href="https://developer.okta.com/docs/guides/build-sso-integration/saml2/main/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              data-testid="link-okta-guide"
            >
              <Shield className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Okta SAML Setup</span>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </a>
            <a
              href="https://learn.microsoft.com/en-us/azure/active-directory/saas-apps/saml-toolkit-tutorial"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              data-testid="link-azure-guide"
            >
              <Shield className="h-5 w-5 text-sky-500" />
              <span className="font-medium">Azure AD Setup</span>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </a>
            <a
              href="https://support.google.com/a/answer/6087519"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              data-testid="link-google-guide"
            >
              <Shield className="h-5 w-5 text-red-500" />
              <span className="font-medium">Google SAML Setup</span>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </a>
            <a
              href="https://docs.aws.amazon.com/singlesignon/latest/userguide/saml-setup.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              data-testid="link-aws-guide"
            >
              <Shield className="h-5 w-5 text-orange-500" />
              <span className="font-medium">AWS SSO Setup</span>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
