import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface Vendor {
  key: string;
  name: string;
}

export default function PlaybookCreate() {
  const { user, isLoading: isLoadingUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    vendorKey: "",
    severityFilter: "",
    isDefault: false,
    isActive: true
  });

  const tier = user?.subscriptionTier;
  const hasAccess = tier === 'growth' || tier === 'enterprise';

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: hasAccess
  });

  const createPlaybook = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to create playbook");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playbooks"] });
      toast({ title: "Playbook created successfully" });
      navigate("/playbooks");
    },
    onError: () => {
      toast({ title: "Failed to create playbook", variant: "destructive" });
    }
  });

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="bg-card">
          <CardContent className="p-8 text-center">
            <h3 className="font-semibold mb-2 text-foreground">Growth Plan Required</h3>
            <p className="text-muted-foreground">
              Upgrade to Growth or Enterprise to access Incident Playbooks.
            </p>
            <Button className="mt-4" onClick={() => navigate("/playbooks")} data-testid="button-back-upgrade">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Playbooks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-auto">
      <div className="sticky top-0 z-10 bg-card border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/playbooks")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Create Playbook</h1>
      </div>
      
      <div className="p-4 pb-8 space-y-6">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Playbook Details</CardTitle>
            <CardDescription>
              Define a response playbook for incident handling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Playbook Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Critical Incident Response"
                className="mt-1"
                data-testid="input-playbook-name"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe when this playbook should be used..."
                className="mt-1"
                data-testid="input-playbook-description"
              />
            </div>
            
            <div>
              <Label htmlFor="vendor">Vendor Filter (Optional)</Label>
              <Select
                value={formData.vendorKey || "__any__"}
                onValueChange={(v) => setFormData({ ...formData, vendorKey: v === "__any__" ? "" : v })}
              >
                <SelectTrigger className="mt-1" data-testid="select-playbook-vendor">
                  <SelectValue placeholder="Any vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any vendor</SelectItem>
                  {vendors.map(v => (
                    <SelectItem key={v.key} value={v.key}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="severity">Severity Filter (Optional)</Label>
              <Select
                value={formData.severityFilter || "__any__"}
                onValueChange={(v) => setFormData({ ...formData, severityFilter: v === "__any__" ? "" : v })}
              >
                <SelectTrigger className="mt-1" data-testid="select-playbook-severity">
                  <SelectValue placeholder="Any severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Label htmlFor="default">Default Playbook</Label>
                <p className="text-xs text-muted-foreground">Used when no specific match</p>
              </div>
              <Switch
                id="default"
                checked={formData.isDefault}
                onCheckedChange={(c) => setFormData({ ...formData, isDefault: c })}
              />
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-3">
          <Button
            onClick={() => createPlaybook.mutate(formData)}
            disabled={!formData.name || createPlaybook.isPending}
            className="w-full"
            size="lg"
            data-testid="button-save-playbook"
          >
            {createPlaybook.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Playbook
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/playbooks")}
            className="w-full"
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
