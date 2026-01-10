import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, Settings, Trash2, CheckCircle, XCircle, RefreshCw, Zap } from "lucide-react";

interface PsaIntegration {
  id: string;
  name: string;
  psaType: string;
  isActive: boolean;
  apiUrl: string | null;
  companyId: string | null;
  lastSyncAt: string | null;
  lastSyncSuccess: boolean | null;
  lastSyncError: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasOAuth: boolean;
  createdAt: string;
}

interface TicketRule {
  id: string;
  name: string;
  triggerType: string;
  severityFilter: string | null;
  vendorFilter: string | null;
  isActive: boolean;
}

const PSA_TYPES = [
  { value: "connectwise", label: "ConnectWise Manage" },
  { value: "autotask", label: "Datto Autotask" },
  { value: "kaseya", label: "Kaseya BMS" },
  { value: "syncro", label: "Syncro" },
  { value: "halo", label: "HaloPSA" },
];

export default function PsaIntegrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<PsaIntegration | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    psaType: "",
    apiUrl: "",
    apiKey: "",
    apiSecret: "",
    companyId: "",
    defaultBoardId: "",
    defaultPriorityId: "",
  });

  const { data: integrations = [], isLoading } = useQuery<PsaIntegration[]>({
    queryKey: ["/api/psa-integrations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/psa-integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create integration");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/psa-integrations"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Integration created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/psa-integrations/${id}/test`, { method: "POST" });
      if (!res.ok) throw new Error("Connection test failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/psa-integrations"] });
      toast({ title: "Connection successful" });
    },
    onError: () => {
      toast({ title: "Connection failed", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/psa-integrations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete integration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/psa-integrations"] });
      setSelectedIntegration(null);
      toast({ title: "Integration deleted" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      psaType: "",
      apiUrl: "",
      apiKey: "",
      apiSecret: "",
      companyId: "",
      defaultBoardId: "",
      defaultPriorityId: "",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-6xl" data-testid="psa-integrations-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PSA Integrations</h1>
          <p className="text-muted-foreground">Connect to your ticketing system for automatic ticket creation</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-integration-btn">
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect PSA System</DialogTitle>
              <DialogDescription>Configure your ticketing system credentials</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Integration Name</Label>
                <Input
                  id="name"
                  data-testid="integration-name-input"
                  placeholder="Main ConnectWise"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="psaType">PSA System</Label>
                <Select
                  value={formData.psaType}
                  onValueChange={(value) => setFormData({ ...formData, psaType: value })}
                >
                  <SelectTrigger data-testid="psa-type-select">
                    <SelectValue placeholder="Select PSA system" />
                  </SelectTrigger>
                  <SelectContent>
                    {PSA_TYPES.map((psa) => (
                      <SelectItem key={psa.value} value={psa.value}>{psa.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiUrl">API URL</Label>
                <Input
                  id="apiUrl"
                  placeholder="https://api.connectwise.com"
                  value={formData.apiUrl}
                  onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key / Public Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="••••••••"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiSecret">API Secret / Private Key</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    placeholder="••••••••"
                    value={formData.apiSecret}
                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyId">Company ID</Label>
                <Input
                  id="companyId"
                  placeholder="your_company"
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || !formData.psaType || createMutation.isPending}
                data-testid="create-integration-submit"
              >
                {createMutation.isPending ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {integrations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No PSA Integrations</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Connect your PSA/ticketing system to automatically create tickets when incidents occur.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Integration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {integrations.map((integration) => (
            <Card key={integration.id} data-testid={`integration-card-${integration.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Ticket className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <CardDescription>
                        {PSA_TYPES.find(p => p.value === integration.psaType)?.label || integration.psaType}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={integration.isActive ? "default" : "secondary"}>
                    {integration.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  {integration.lastSyncSuccess !== null && (
                    <div className="flex items-center gap-1">
                      {integration.lastSyncSuccess ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={integration.lastSyncSuccess ? "text-green-600" : "text-red-600"}>
                        {integration.lastSyncSuccess ? "Connected" : "Error"}
                      </span>
                    </div>
                  )}
                  {integration.lastSyncAt && (
                    <span className="text-muted-foreground">
                      Last sync: {new Date(integration.lastSyncAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => testMutation.mutate(integration.id)}
                    disabled={testMutation.isPending}
                    data-testid={`test-connection-${integration.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${testMutation.isPending ? "animate-spin" : ""}`} />
                    Test Connection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIntegration(integration)}
                    data-testid={`configure-${integration.id}`}
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Rules
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this integration?")) {
                        deleteMutation.mutate(integration.id);
                      }
                    }}
                    data-testid={`delete-${integration.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedIntegration && (
        <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ticket Rules - {selectedIntegration.name}</DialogTitle>
              <DialogDescription>Configure when tickets should be automatically created</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Zap className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-center">
                    Ticket rules let you automatically create tickets based on incident severity and vendor.
                  </p>
                  <Button className="mt-4" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Rule
                  </Button>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedIntegration(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
