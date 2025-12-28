import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, PlayCircle, Pause, Settings, Plus, Trash2, Clock, AlertTriangle,
  CheckCircle, XCircle, BookOpen, Users, Webhook, Mail, MessageSquare,
  Phone, Activity, FileText, Edit
} from "lucide-react";

const TRIGGER_TYPES = [
  { value: 'incident_created', label: 'New Incident Created' },
  { value: 'incident_escalated', label: 'Incident Escalated' },
  { value: 'incident_resolved', label: 'Incident Resolved' },
  { value: 'sla_breach', label: 'SLA Breach Detected' },
  { value: 'long_running', label: 'Long-Running Incident (>1hr)' },
];

const ACTION_TYPES = [
  { value: 'create_ticket', label: 'Create PSA Ticket', icon: FileText },
  { value: 'send_slack', label: 'Send Slack Message', icon: MessageSquare },
  { value: 'send_teams', label: 'Send Teams Message', icon: MessageSquare },
  { value: 'call_escalation', label: 'Trigger Escalation Call', icon: Phone },
  { value: 'send_email', label: 'Send Email Alert', icon: Mail },
  { value: 'webhook', label: 'Call Webhook', icon: Webhook },
];

export default function AutomationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("rules");
  const [showNewRuleDialog, setShowNewRuleDialog] = useState(false);
  const [showEditRuleDialog, setShowEditRuleDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  
  const { data: rules = [], isLoading: rulesLoading } = useQuery<any[]>({
    queryKey: ["/api/orchestrator/rules"],
  });
  
  const { data: runbooks = [] } = useQuery<any[]>({
    queryKey: ["/api/orchestrator/runbooks"],
  });
  
  const { data: policies = [] } = useQuery<any[]>({
    queryKey: ["/api/orchestrator/escalation-policies"],
  });
  
  const { data: approvals = [] } = useQuery<any[]>({
    queryKey: ["/api/orchestrator/approvals"],
  });
  
  const { data: auditLog = [] } = useQuery<any[]>({
    queryKey: ["/api/orchestrator/audit-log"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/orchestrator/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/rules"] });
      toast({ title: "Rule created successfully" });
      setShowNewRuleDialog(false);
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/orchestrator/rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete rule");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/rules"] });
      toast({ title: "Rule deleted" });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/orchestrator/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/rules"] });
      toast({ title: "Rule updated successfully" });
      setShowEditRuleDialog(false);
      setSelectedRule(null);
    },
  });

  const approveAutomationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/orchestrator/approvals/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/approvals"] });
      toast({ title: "Automation approved and executed" });
    },
  });

  const rejectAutomationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/orchestrator/approvals/${id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/approvals"] });
      toast({ title: "Automation rejected" });
    },
  });

  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    triggerType: "incident_created",
    actionType: "send_email",
    conditions: JSON.stringify({ severity: ["critical", "major"] }),
    actionConfig: JSON.stringify({ email: "", webhookUrl: "" }),
    requiresApproval: false,
  });

  const handleCreateRule = () => {
    createRuleMutation.mutate(newRule);
  };

  const getTriggerLabel = (type: string) => TRIGGER_TYPES.find(t => t.value === type)?.label || type;
  const getActionLabel = (type: string) => ACTION_TYPES.find(a => a.value === type)?.label || type;
  const getActionIcon = (type: string) => ACTION_TYPES.find(a => a.value === type)?.icon || Activity;

  return (
    <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-cyan-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Response Orchestrator</h1>
              <p className="text-gray-400 text-sm">Automate incident response with intelligent rules</p>
            </div>
          </div>
          
          <Dialog open={showNewRuleDialog} onOpenChange={setShowNewRuleDialog}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="btn-new-rule">
                <Plus className="h-4 w-4 mr-2" />
                New Automation Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-cyan-400">Create Automation Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Rule Name</Label>
                  <Input
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Critical Incident Alert"
                    className="bg-gray-800 border-gray-600"
                    data-testid="input-rule-name"
                  />
                </div>
                
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="What does this rule do?"
                    className="bg-gray-800 border-gray-600"
                    data-testid="input-rule-description"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Trigger</Label>
                    <Select
                      value={newRule.triggerType}
                      onValueChange={(v) => setNewRule({ ...newRule, triggerType: v })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600" data-testid="select-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600 z-[9999]" position="popper" sideOffset={4}>
                        {TRIGGER_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Action</Label>
                    <Select
                      value={newRule.actionType}
                      onValueChange={(v) => setNewRule({ ...newRule, actionType: v })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600" data-testid="select-action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600 z-[9999]" position="popper" sideOffset={4}>
                        {ACTION_TYPES.map(a => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Approval</Label>
                    <p className="text-xs text-gray-500">Human-in-the-loop before execution</p>
                  </div>
                  <Switch
                    checked={newRule.requiresApproval}
                    onCheckedChange={(v) => setNewRule({ ...newRule, requiresApproval: v })}
                    data-testid="switch-approval"
                  />
                </div>
                
                <Button 
                  onClick={handleCreateRule} 
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                  disabled={!newRule.name || createRuleMutation.isPending}
                  data-testid="btn-create-rule"
                >
                  {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {approvals.length > 0 && (
          <Card className="bg-yellow-900/20 border-yellow-600/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Pending Approvals ({approvals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {approvals.map((approval: any) => (
                  <div key={approval.id} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{getActionLabel(approval.actionType)}</p>
                      <p className="text-gray-400 text-sm">Incident: {approval.incidentId}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => approveAutomationMutation.mutate(approval.id)}
                        data-testid={`btn-approve-${approval.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectAutomationMutation.mutate(approval.id)}
                        data-testid={`btn-reject-${approval.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="rules" className="data-[state=active]:bg-cyan-600" data-testid="tab-rules">
              <Settings className="h-4 w-4 mr-2" />
              Automation Rules
            </TabsTrigger>
            <TabsTrigger value="runbooks" className="data-[state=active]:bg-cyan-600" data-testid="tab-runbooks">
              <BookOpen className="h-4 w-4 mr-2" />
              Runbooks
            </TabsTrigger>
            <TabsTrigger value="escalation" className="data-[state=active]:bg-cyan-600" data-testid="tab-escalation">
              <Users className="h-4 w-4 mr-2" />
              Escalation Policies
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-cyan-600" data-testid="tab-audit">
              <Activity className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-4">
            {rulesLoading ? (
              <div className="text-center py-8 text-gray-400">Loading rules...</div>
            ) : rules.length === 0 ? (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="py-12 text-center">
                  <Bot className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Automation Rules</h3>
                  <p className="text-gray-400 mb-4">Create your first rule to automate incident response</p>
                  <Button onClick={() => setShowNewRuleDialog(true)} className="bg-cyan-600 hover:bg-cyan-700">
                    <Plus className="h-4 w-4 mr-2" /> Create First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {rules.map((rule: any) => {
                  const ActionIcon = getActionIcon(rule.actionType);
                  return (
                    <Card key={rule.id} className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-cyan-600/20' : 'bg-gray-700'}`}>
                              <ActionIcon className={`h-5 w-5 ${rule.isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-white font-medium">{rule.name}</h3>
                                <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                                  {rule.isActive ? "Active" : "Inactive"}
                                </Badge>
                                {rule.requiresApproval && (
                                  <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-400">
                                    Requires Approval
                                  </Badge>
                                )}
                              </div>
                              <p className="text-gray-400 text-sm mt-1">
                                When: {getTriggerLabel(rule.triggerType)} → {getActionLabel(rule.actionType)}
                              </p>
                              {rule.executionCount > 0 && (
                                <p className="text-gray-500 text-xs mt-1">
                                  Executed {rule.executionCount} time{rule.executionCount !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/20"
                              onClick={() => {
                                setSelectedRule(rule);
                                setShowEditRuleDialog(true);
                              }}
                              data-testid={`btn-edit-rule-${rule.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              data-testid={`btn-delete-rule-${rule.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="runbooks" className="mt-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Runbook Templates</h3>
                <p className="text-gray-400 mb-4">Define step-by-step procedures for incident response</p>
                <p className="text-gray-500 text-sm">Coming soon - Create runbooks to standardize your response process</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="escalation" className="mt-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Escalation Policies</h3>
                <p className="text-gray-400 mb-4">Configure call trees and escalation workflows</p>
                <p className="text-gray-500 text-sm">Coming soon - Set up automatic escalation paths for critical incidents</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Automation Audit Log</CardTitle>
                <CardDescription>Recent automation executions</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLog.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No automation executions yet</p>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {auditLog.map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded ${
                              log.result === 'success' ? 'bg-green-600/20' : 
                              log.result === 'pending_approval' ? 'bg-yellow-600/20' : 'bg-red-600/20'
                            }`}>
                              {log.result === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-400" />
                              ) : log.result === 'pending_approval' ? (
                                <Clock className="h-4 w-4 text-yellow-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-white text-sm">{getActionLabel(log.actionType)}</p>
                              <p className="text-gray-500 text-xs">
                                {new Date(log.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={
                            log.result === 'success' ? 'default' :
                            log.result === 'pending_approval' ? 'secondary' : 'destructive'
                          }>
                            {log.result}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Rule Dialog */}
        <Dialog open={showEditRuleDialog} onOpenChange={(open) => {
          setShowEditRuleDialog(open);
          if (!open) setSelectedRule(null);
        }}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-cyan-400">Edit Automation Rule</DialogTitle>
            </DialogHeader>
            {selectedRule && (
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Rule Name</Label>
                  <Input
                    value={selectedRule.name}
                    onChange={(e) => setSelectedRule({ ...selectedRule, name: e.target.value })}
                    placeholder="e.g., Critical Incident Alert"
                    className="bg-gray-800 border-gray-600"
                    data-testid="input-edit-rule-name"
                  />
                </div>
                
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={selectedRule.description || ""}
                    onChange={(e) => setSelectedRule({ ...selectedRule, description: e.target.value })}
                    placeholder="What does this rule do?"
                    className="bg-gray-800 border-gray-600"
                    data-testid="input-edit-rule-description"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Trigger</Label>
                    <Select
                      value={selectedRule.triggerType}
                      onValueChange={(v) => setSelectedRule({ ...selectedRule, triggerType: v })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600" data-testid="select-edit-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600 z-[9999]" position="popper" sideOffset={4}>
                        {TRIGGER_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Action</Label>
                    <Select
                      value={selectedRule.actionType}
                      onValueChange={(v) => setSelectedRule({ ...selectedRule, actionType: v })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-600" data-testid="select-edit-action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600 z-[9999]" position="popper" sideOffset={4}>
                        {ACTION_TYPES.map(a => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active</Label>
                    <p className="text-xs text-gray-500">Enable or disable this rule</p>
                  </div>
                  <Switch
                    checked={selectedRule.isActive}
                    onCheckedChange={(v) => setSelectedRule({ ...selectedRule, isActive: v })}
                    data-testid="switch-edit-active"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Approval</Label>
                    <p className="text-xs text-gray-500">Human-in-the-loop before execution</p>
                  </div>
                  <Switch
                    checked={selectedRule.requiresApproval}
                    onCheckedChange={(v) => setSelectedRule({ ...selectedRule, requiresApproval: v })}
                    data-testid="switch-edit-approval"
                  />
                </div>
                
                <Button 
                  onClick={() => updateRuleMutation.mutate({ 
                    id: selectedRule.id, 
                    data: {
                      name: selectedRule.name,
                      description: selectedRule.description,
                      triggerType: selectedRule.triggerType,
                      actionType: selectedRule.actionType,
                      isActive: selectedRule.isActive,
                      requiresApproval: selectedRule.requiresApproval,
                    }
                  })} 
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                  disabled={!selectedRule.name || updateRuleMutation.isPending}
                  data-testid="btn-update-rule"
                >
                  {updateRuleMutation.isPending ? "Updating..." : "Update Rule"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
