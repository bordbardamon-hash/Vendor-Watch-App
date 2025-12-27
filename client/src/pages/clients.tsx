import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Plus, 
  Search,
  Edit,
  Trash2,
  Building2,
  Mail,
  Phone,
  Tag,
  AlertTriangle,
  Crown,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Client {
  id: string;
  userId: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  impactLevel: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Vendor {
  id: string;
  key: string;
  name: string;
  status: string;
}

interface ClientVendorLink {
  id: string;
  userId: string;
  clientId: string;
  vendorKey: string;
  priority: string;
  createdAt: string;
}

export default function Clients() {
  const { user, isLoading: isLoadingUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactEmail: "",
    contactPhone: "",
    impactLevel: "medium",
    notes: ""
  });

  const tier = user?.subscriptionTier;
  const hasAccess = tier === 'growth' || tier === 'enterprise';

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: hasAccess
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: hasAccess
  });

  const { data: clientVendorLinks = [] } = useQuery<ClientVendorLink[]>({
    queryKey: ["/api/clients/vendors"],
    enabled: hasAccess
  });

  const createClient = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to create client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowAddDialog(false);
      setFormData({ name: "", contactEmail: "", contactPhone: "", impactLevel: "medium", notes: "" });
      toast({ title: "Client created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create client", variant: "destructive" });
    }
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to update client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowEditDialog(false);
      setSelectedClient(null);
      toast({ title: "Client updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update client", variant: "destructive" });
    }
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete client");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete client", variant: "destructive" });
    }
  });

  const linkVendor = useMutation({
    mutationFn: async ({ clientId, vendorKey, priority }: { clientId: string; vendorKey: string; priority: string }) => {
      const res = await fetch(`/api/clients/${clientId}/vendors/${vendorKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to link vendor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/vendors"] });
      toast({ title: "Vendor linked to client" });
    }
  });

  const unlinkVendor = useMutation({
    mutationFn: async ({ clientId, vendorKey }: { clientId: string; vendorKey: string }) => {
      const res = await fetch(`/api/clients/${clientId}/vendors/${vendorKey}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to unlink vendor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/vendors"] });
      toast({ title: "Vendor unlinked from client" });
    }
  });

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getClientVendors = (clientId: string) => {
    return clientVendorLinks.filter(l => l.clientId === clientId);
  };

  const getImpactBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge variant="destructive" data-testid={`badge-impact-${level}`}><AlertTriangle className="w-3 h-3 mr-1" />High Impact</Badge>;
      case 'medium':
        return <Badge variant="secondary" data-testid={`badge-impact-${level}`}><Tag className="w-3 h-3 mr-1" />Medium Impact</Badge>;
      case 'low':
        return <Badge variant="outline" data-testid={`badge-impact-${level}`}>Low Impact</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-impact-${level}`}>{level}</Badge>;
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-8 text-center">
            <Crown className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-semibold mb-2">Growth Plan Required</h2>
            <p className="text-muted-foreground mb-4">
              Client management is available on Growth and Enterprise plans.
              Upgrade to organize vendors by customer and track impact levels.
            </p>
            <Button variant="default" data-testid="button-upgrade-clients">
              Upgrade to Growth
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title-clients">
            <Users className="w-6 h-6" />
            Client Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize vendors by customer and track impact levels
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-client">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search-clients"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No clients yet</h3>
            <p className="text-muted-foreground mb-4">
              Create clients to organize vendors by customer impact
            </p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline" data-testid="button-add-first-client">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => {
            const linkedVendors = getClientVendors(client.id);
            return (
              <Card key={client.id} className="hover:border-primary/30 transition-colors" data-testid={`card-client-${client.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2" data-testid={`text-client-name-${client.id}`}>
                        <Building2 className="w-4 h-4" />
                        {client.name}
                      </CardTitle>
                      {getImpactBadge(client.impactLevel)}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedClient(client);
                          setFormData({
                            name: client.name,
                            contactEmail: client.contactEmail || "",
                            contactPhone: client.contactPhone || "",
                            impactLevel: client.impactLevel,
                            notes: client.notes || ""
                          });
                          setShowEditDialog(true);
                        }}
                        data-testid={`button-edit-client-${client.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteClient.mutate(client.id)}
                        data-testid={`button-delete-client-${client.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {client.contactEmail && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      <span data-testid={`text-client-email-${client.id}`}>{client.contactEmail}</span>
                    </div>
                  )}
                  {client.contactPhone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span data-testid={`text-client-phone-${client.id}`}>{client.contactPhone}</span>
                    </div>
                  )}
                  {client.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-client-notes-${client.id}`}>
                      {client.notes}
                    </p>
                  )}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Linked Vendors ({linkedVendors.length})</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedClient(client);
                          setShowVendorDialog(true);
                        }}
                        data-testid={`button-manage-vendors-${client.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Link
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {linkedVendors.slice(0, 5).map((link) => {
                        const vendor = vendors.find(v => v.key === link.vendorKey);
                        return (
                          <Badge 
                            key={link.vendorKey} 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-destructive/10"
                            onClick={() => unlinkVendor.mutate({ clientId: client.id, vendorKey: link.vendorKey })}
                            data-testid={`badge-vendor-${client.id}-${link.vendorKey}`}
                          >
                            {vendor?.name || link.vendorKey} ×
                          </Badge>
                        );
                      })}
                      {linkedVendors.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{linkedVendors.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a client to organize vendors by customer impact
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Client Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Acme Corporation"
                data-testid="input-client-name"
              />
            </div>
            <div>
              <Label htmlFor="email">Contact Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="contact@acme.com"
                data-testid="input-client-email"
              />
            </div>
            <div>
              <Label htmlFor="phone">Contact Phone</Label>
              <Input
                id="phone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                placeholder="+1 555-1234"
                data-testid="input-client-phone"
              />
            </div>
            <div>
              <Label htmlFor="impact">Impact Level</Label>
              <Select
                value={formData.impactLevel}
                onValueChange={(v) => setFormData({ ...formData, impactLevel: v })}
              >
                <SelectTrigger data-testid="select-client-impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High - Critical customer</SelectItem>
                  <SelectItem value="medium">Medium - Standard customer</SelectItem>
                  <SelectItem value="low">Low - Non-critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes about this client..."
                data-testid="input-client-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createClient.mutate(formData)}
              disabled={!formData.name || createClient.isPending}
              data-testid="button-save-client"
            >
              {createClient.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Client Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-client-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Contact Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                data-testid="input-edit-client-email"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Contact Phone</Label>
              <Input
                id="edit-phone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                data-testid="input-edit-client-phone"
              />
            </div>
            <div>
              <Label htmlFor="edit-impact">Impact Level</Label>
              <Select
                value={formData.impactLevel}
                onValueChange={(v) => setFormData({ ...formData, impactLevel: v })}
              >
                <SelectTrigger data-testid="select-edit-client-impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High - Critical customer</SelectItem>
                  <SelectItem value="medium">Medium - Standard customer</SelectItem>
                  <SelectItem value="low">Low - Non-critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                data-testid="input-edit-client-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button
              onClick={() => selectedClient && updateClient.mutate({ id: selectedClient.id, data: formData })}
              disabled={!formData.name || updateClient.isPending}
              data-testid="button-update-client"
            >
              {updateClient.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Vendors to {selectedClient?.name}</DialogTitle>
            <DialogDescription>
              Select vendors that this client depends on
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {vendors.map((vendor) => {
              const isLinked = clientVendorLinks.some(
                l => l.clientId === selectedClient?.id && l.vendorKey === vendor.key
              );
              return (
                <div
                  key={vendor.key}
                  className={`flex items-center justify-between p-2 rounded border ${
                    isLinked ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                  data-testid={`vendor-option-${vendor.key}`}
                >
                  <span className="font-medium">{vendor.name}</span>
                  <Button
                    variant={isLinked ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (isLinked) {
                        unlinkVendor.mutate({ clientId: selectedClient!.id, vendorKey: vendor.key });
                      } else {
                        linkVendor.mutate({ clientId: selectedClient!.id, vendorKey: vendor.key, priority: 'medium' });
                      }
                    }}
                    data-testid={`button-toggle-vendor-${vendor.key}`}
                  >
                    {isLinked ? 'Unlink' : 'Link'}
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowVendorDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
