import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, 
  Users, 
  Phone, 
  Mail, 
  Globe, 
  Ticket,
  Bell,
  Plus,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  Settings2
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Integration {
  id: string;
  userId: string;
  integrationType: string;
  name: string;
  isActive: boolean;
  isDefault: boolean | null;
  lastTestedAt: string | null;
  lastTestSuccess: boolean | null;
  createdAt: string;
  hasWebhook: boolean;
  hasApiKey: boolean;
  hasPhone: boolean;
}

const INTEGRATION_TYPES = [
  { 
    value: 'slack', 
    label: 'Slack', 
    icon: MessageSquare, 
    color: 'text-purple-400',
    description: 'Send incident alerts to Slack channels',
    placeholder: 'https://hooks.slack.com/services/...',
    helpUrl: 'https://api.slack.com/messaging/webhooks'
  },
  { 
    value: 'teams', 
    label: 'Microsoft Teams', 
    icon: Users, 
    color: 'text-blue-400',
    description: 'Send incident alerts to Teams channels',
    placeholder: 'https://outlook.office.com/webhook/...',
    helpUrl: 'https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook'
  },
  { 
    value: 'discord', 
    label: 'Discord', 
    icon: MessageSquare, 
    color: 'text-indigo-400',
    description: 'Send incident alerts to Discord channels',
    placeholder: 'https://discord.com/api/webhooks/...',
    helpUrl: 'https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks'
  },
  { 
    value: 'pagerduty', 
    label: 'PagerDuty', 
    icon: Bell, 
    color: 'text-emerald-400',
    description: 'Auto-create and resolve PagerDuty incidents',
    placeholder: 'Enter your PagerDuty Integration Key (routing key)',
    helpUrl: 'https://support.pagerduty.com/docs/services-and-integrations'
  },
  { 
    value: 'psa', 
    label: 'PSA System', 
    icon: Ticket, 
    color: 'text-orange-400',
    description: 'Create tickets in ConnectWise, Autotask, etc.',
    placeholder: 'https://your-psa.com/api/webhook',
    helpUrl: null
  },
  { 
    value: 'webhook', 
    label: 'Custom Webhook', 
    icon: Globe, 
    color: 'text-green-400',
    description: 'Send data to any HTTP endpoint',
    placeholder: 'https://your-service.com/webhook',
    helpUrl: null
  },
  { 
    value: 'escalation_phone', 
    label: 'Escalation Phone', 
    icon: Phone, 
    color: 'text-red-400',
    description: 'Phone number for escalation calls',
    placeholder: '+1234567890',
    helpUrl: null
  },
];

export default function Integrations() {
  const { user, isLoading: isLoadingUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newIntegration, setNewIntegration] = useState({
    integrationType: 'slack',
    name: '',
    webhookUrl: '',
    phoneNumber: '',
    isDefault: false,
  });

  const tier = user?.subscriptionTier;
  const hasAccess = tier === 'growth' || tier === 'enterprise';

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    enabled: hasAccess
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newIntegration) => {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to create integration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      setShowAddDialog(false);
      setNewIntegration({ integrationType: 'slack', name: '', webhookUrl: '', phoneNumber: '', isDefault: false });
      toast({ title: "Integration created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create integration", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete integration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete integration", variant: "destructive" });
    }
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/integrations/${id}/test`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to test integration");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      if (data.success) {
        toast({ title: "Test successful", description: data.message });
      } else {
        toast({ title: "Test failed", description: data.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Failed to test integration", variant: "destructive" });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/integrations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to update integration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    }
  });

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
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-8 text-center">
            <Settings2 className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h3 className="font-semibold mb-2 text-white text-lg">Growth Plan Required</h3>
            <p className="text-gray-400 mb-4">
              Upgrade to Growth or Enterprise to configure integrations for Slack, Teams, Discord, PSA systems, and webhooks.
            </p>
            <Button className="bg-cyan-600 hover:bg-cyan-700">Upgrade Now</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getTypeConfig = (type: string) => INTEGRATION_TYPES.find(t => t.value === type);

  const handleCreate = () => {
    const typeConfig = getTypeConfig(newIntegration.integrationType);
    const data: any = {
      integrationType: newIntegration.integrationType,
      name: newIntegration.name || typeConfig?.label,
      isDefault: newIntegration.isDefault,
    };
    
    if (newIntegration.integrationType === 'escalation_phone') {
      data.phoneNumber = newIntegration.phoneNumber;
    } else if (newIntegration.integrationType === 'pagerduty') {
      data.apiKey = newIntegration.webhookUrl;
    } else {
      data.webhookUrl = newIntegration.webhookUrl;
    }
    
    createMutation.mutate(data);
  };

  const groupedIntegrations = INTEGRATION_TYPES.map(type => ({
    ...type,
    integrations: integrations.filter(i => i.integrationType === type.value)
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings2 className="h-8 w-8 text-cyan-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Integrations</h1>
            <p className="text-gray-400 text-sm">Connect your tools for automated incident response</p>
          </div>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="btn-add-integration">
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-cyan-400">Add Integration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Integration Type</Label>
                <Select
                  value={newIntegration.integrationType}
                  onValueChange={(v) => setNewIntegration({ ...newIntegration, integrationType: v, webhookUrl: '', phoneNumber: '' })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 mt-1" data-testid="select-integration-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 z-[9999]" position="popper" sideOffset={4}>
                    {INTEGRATION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className={`h-4 w-4 ${type.color}`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {getTypeConfig(newIntegration.integrationType)?.description}
                </p>
              </div>
              
              <div>
                <Label>Display Name</Label>
                <Input
                  value={newIntegration.name}
                  onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                  placeholder={getTypeConfig(newIntegration.integrationType)?.label}
                  className="bg-gray-800 border-gray-600 mt-1"
                  data-testid="input-integration-name"
                />
              </div>
              
              {newIntegration.integrationType === 'escalation_phone' ? (
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    value={newIntegration.phoneNumber}
                    onChange={(e) => setNewIntegration({ ...newIntegration, phoneNumber: e.target.value })}
                    placeholder="+1234567890"
                    className="bg-gray-800 border-gray-600 mt-1"
                    data-testid="input-phone"
                  />
                  <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +1 for US)</p>
                </div>
              ) : (
                <div>
                  <Label>Webhook URL</Label>
                  <Input
                    value={newIntegration.webhookUrl}
                    onChange={(e) => setNewIntegration({ ...newIntegration, webhookUrl: e.target.value })}
                    placeholder={getTypeConfig(newIntegration.integrationType)?.placeholder}
                    className="bg-gray-800 border-gray-600 mt-1"
                    data-testid="input-webhook"
                  />
                  {getTypeConfig(newIntegration.integrationType)?.helpUrl && (
                    <a 
                      href={getTypeConfig(newIntegration.integrationType)?.helpUrl || ''} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:underline mt-1 inline-block"
                    >
                      How to get a webhook URL →
                    </a>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Set as Default</Label>
                  <p className="text-xs text-gray-500">Use for automation rules without specific integration</p>
                </div>
                <Switch
                  checked={newIntegration.isDefault}
                  onCheckedChange={(v) => setNewIntegration({ ...newIntegration, isDefault: v })}
                />
              </div>
              
              <Button 
                onClick={handleCreate}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                disabled={createMutation.isPending || (
                  newIntegration.integrationType === 'escalation_phone' 
                    ? !newIntegration.phoneNumber 
                    : !newIntegration.webhookUrl
                )}
                data-testid="btn-save-integration"
              >
                {createMutation.isPending ? "Creating..." : "Add Integration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6">
          {groupedIntegrations.map(group => (
            <Card key={group.value} className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <group.icon className={`h-6 w-6 ${group.color}`} />
                  <div>
                    <CardTitle className="text-white">{group.label}</CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {group.integrations.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p>No {group.label} integrations configured</p>
                    <Button 
                      variant="link" 
                      className="text-cyan-400"
                      onClick={() => {
                        setNewIntegration({ ...newIntegration, integrationType: group.value, webhookUrl: '', phoneNumber: '' });
                        setShowAddDialog(true);
                      }}
                    >
                      Add your first {group.label} integration
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {group.integrations.map(integration => (
                      <div 
                        key={integration.id} 
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                        data-testid={`integration-${integration.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{integration.name}</span>
                              {integration.isDefault && (
                                <Badge variant="secondary" className="text-xs">Default</Badge>
                              )}
                              {integration.lastTestSuccess === true && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                              {integration.lastTestSuccess === false && (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {integration.hasWebhook && "Webhook configured"}
                              {integration.hasPhone && "Phone configured"}
                              {integration.lastTestedAt && ` • Last tested ${new Date(integration.lastTestedAt).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={integration.isActive}
                            onCheckedChange={(v) => toggleActiveMutation.mutate({ id: integration.id, isActive: v })}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testMutation.mutate(integration.id)}
                            disabled={testMutation.isPending}
                            data-testid={`btn-test-${integration.id}`}
                          >
                            <TestTube className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(integration.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`btn-delete-${integration.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Card className="bg-gray-800/50 border-gray-700 border-dashed">
            <CardContent className="p-6 text-center">
              <Mail className="h-8 w-8 mx-auto mb-3 text-gray-600" />
              <h3 className="font-medium text-white mb-1">Email Alerts</h3>
              <p className="text-sm text-gray-400 mb-3">
                Email notifications are automatically configured using your account settings.
              </p>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/settings'}>
                Manage in Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
