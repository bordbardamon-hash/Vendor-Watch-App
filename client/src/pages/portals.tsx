import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Plus, ExternalLink, Copy, Settings, Users, Eye, Trash2, Server, Link2, CheckCircle, Upload, X, ImageIcon, Code, Monitor, Image, Lock, ShieldOff, Shield } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface ClientPortal {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isPublic: boolean;
  logoUrl: string | null;
  primaryColor: string;
  accessToken: string | null;
  accessType: 'public' | 'password' | 'private';
  viewCount: number;
  createdAt: string;
}

interface Vendor {
  id: number;
  key: string;
  name: string;
  status: string;
  category: string;
}

interface BlockchainChain {
  id: number;
  key: string;
  name: string;
  status: string;
  category: string;
  tier: string;
}

interface PortalAssignment {
  id?: string;
  vendorKey: string | null;
  chainKey: string | null;
  resourceType: 'vendor' | 'blockchain';
  displayName: string | null;
  showOnPortal: boolean;
}

export default function Portals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPortal, setEditingPortal] = useState<ClientPortal | null>(null);
  const [embedPortal, setEmbedPortal] = useState<ClientPortal | null>(null);
  const [accessControlPortal, setAccessControlPortal] = useState<ClientPortal | null>(null);
  const [accessType, setAccessType] = useState<'public' | 'password' | 'private'>('public');
  const [accessPassword, setAccessPassword] = useState("");
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [selectedChains, setSelectedChains] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    isPublic: true,
    logoUrl: "",
    primaryColor: "#3b82f6",
    secondaryColor: "#1e293b",
    backgroundColor: "#0f172a",
    headerText: "Service Status",
    footerText: "",
    showIncidentHistory: true,
    showUptimeStats: true,
    showSubscribeOption: true,
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Logo must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData({ ...formData, logoUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const { data: portals = [], isLoading } = useQuery<ClientPortal[]>({
    queryKey: ["/api/portals"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: chains = [] } = useQuery<BlockchainChain[]>({
    queryKey: ["/api/blockchain/chains"],
  });

  const { data: portalDetail } = useQuery<{ portal: ClientPortal; assignments: PortalAssignment[] }>({
    queryKey: ["/api/portals", editingPortal?.id],
    enabled: !!editingPortal,
  });

  useEffect(() => {
    if (portalDetail?.assignments) {
      const vendorKeys = new Set(
        portalDetail.assignments
          .filter(a => a.resourceType === 'vendor' && a.vendorKey)
          .map(a => a.vendorKey!)
      );
      const chainKeys = new Set(
        portalDetail.assignments
          .filter(a => a.resourceType === 'blockchain' && a.chainKey)
          .map(a => a.chainKey!)
      );
      setSelectedVendors(vendorKeys);
      setSelectedChains(chainKeys);
    }
  }, [portalDetail]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create portal");
      }
      return res.json();
    },
    onSuccess: async (portal) => {
      await saveAssignments(portal.id);
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Portal created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAssignmentsMutation = useMutation({
    mutationFn: async ({ portalId, assignments }: { portalId: string; assignments: any[] }) => {
      const res = await fetch(`/api/portals/${portalId}/vendors`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) throw new Error("Failed to update vendors");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      toast({ title: "Vendors updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/portals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete portal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      toast({ title: "Portal deleted" });
    },
  });

  const accessControlMutation = useMutation({
    mutationFn: async ({ slug, accessType, password }: { slug: string; accessType: string; password?: string }) => {
      const res = await fetch(`/api/portals/${slug}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessType, password }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update access settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portals"] });
      setAccessControlPortal(null);
      setAccessPassword("");
      toast({ title: "Access settings updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveAssignments = async (portalId: string) => {
    const assignments: any[] = [];
    selectedVendors.forEach(key => {
      assignments.push({
        vendorKey: key,
        chainKey: null,
        resourceType: 'vendor',
        showOnPortal: true,
      });
    });
    selectedChains.forEach(key => {
      assignments.push({
        vendorKey: null,
        chainKey: key,
        resourceType: 'blockchain',
        showOnPortal: true,
      });
    });
    if (assignments.length > 0) {
      await updateAssignmentsMutation.mutateAsync({ portalId, assignments });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      isPublic: true,
      logoUrl: "",
      primaryColor: "#3b82f6",
      secondaryColor: "#1e293b",
      backgroundColor: "#0f172a",
      headerText: "Service Status",
      footerText: "",
      showIncidentHistory: true,
      showUptimeStats: true,
      showSubscribeOption: true,
    });
    setSelectedVendors(new Set());
    setSelectedChains(new Set());
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const copyPortalUrl = (slug: string) => {
    const url = `${window.location.origin}/status/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "URL copied to clipboard" });
  };

  const toggleVendor = (key: string) => {
    const newSet = new Set(selectedVendors);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedVendors(newSet);
  };

  const toggleChain = (key: string) => {
    const newSet = new Set(selectedChains);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedChains(newSet);
  };

  const vendorsByCategory = vendors.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {} as Record<string, Vendor[]>);

  const chainsByCategory = chains.reduce((acc, c) => {
    const cat = c.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {} as Record<string, BlockchainChain[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const VendorSelectionContent = () => (
    <Tabs defaultValue="vendors" className="mt-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="vendors">Vendors ({selectedVendors.size})</TabsTrigger>
        <TabsTrigger value="blockchain">Blockchain ({selectedChains.size})</TabsTrigger>
      </TabsList>
      <TabsContent value="vendors" className="mt-4">
        <ScrollArea className="h-[300px] pr-4">
          {Object.entries(vendorsByCategory).map(([category, categoryVendors]) => (
            <div key={category} className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{category}</h4>
              <div className="grid grid-cols-2 gap-2">
                {categoryVendors.map((vendor) => (
                  <div
                    key={vendor.key}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      selectedVendors.has(vendor.key)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => toggleVendor(vendor.key)}
                    data-testid={`vendor-select-${vendor.key}`}
                  >
                    <Checkbox
                      checked={selectedVendors.has(vendor.key)}
                      className="pointer-events-none"
                    />
                    <span className="text-sm truncate">{vendor.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
      </TabsContent>
      <TabsContent value="blockchain" className="mt-4">
        <ScrollArea className="h-[300px] pr-4">
          {Object.entries(chainsByCategory).map(([category, categoryChains]) => (
            <div key={category} className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{category}</h4>
              <div className="grid grid-cols-2 gap-2">
                {categoryChains.map((chain) => (
                  <div
                    key={chain.key}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      selectedChains.has(chain.key)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => toggleChain(chain.key)}
                    data-testid={`chain-select-${chain.key}`}
                  >
                    <Checkbox
                      checked={selectedChains.has(chain.key)}
                      className="pointer-events-none"
                    />
                    <span className="text-sm truncate">{chain.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="container py-6 max-w-6xl" data-testid="portals-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Portals</h1>
          <p className="text-muted-foreground">Create white-labeled status pages for your clients</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-portal-btn">
              <Plus className="h-4 w-4 mr-2" />
              Create Portal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Client Portal</DialogTitle>
              <DialogDescription>Set up a branded status page for your client</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="basic" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="vendors">Vendors</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Portal Name</Label>
                  <Input
                    id="name"
                    data-testid="portal-name-input"
                    placeholder="Acme Corp Status"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">/status/</span>
                    <Input
                      id="slug"
                      data-testid="portal-slug-input"
                      placeholder="acme-corp"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Public Access</Label>
                    <p className="text-sm text-muted-foreground">Anyone with the link can view</p>
                  </div>
                  <Switch
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                    data-testid="portal-public-switch"
                  />
                </div>
              </TabsContent>
              <TabsContent value="branding" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    {formData.logoUrl ? (
                      <div className="relative">
                        <img 
                          src={formData.logoUrl} 
                          alt="Portal logo" 
                          className="w-16 h-16 object-contain rounded-lg border border-sidebar-border bg-sidebar/50"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, logoUrl: "" })}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-sidebar-border bg-sidebar/50 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          data-testid="logo-upload-input"
                        />
                        <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-sidebar-border bg-sidebar hover:bg-sidebar/80 transition-colors text-sm">
                          <Upload className="w-4 h-4" />
                          {formData.logoUrl ? "Change Logo" : "Upload Logo"}
                        </div>
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG or SVG. Max 2MB.</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="primaryColor"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backgroundColor">Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="backgroundColor"
                        value={formData.backgroundColor}
                        onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.backgroundColor}
                        onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headerText">Header Text</Label>
                  <Input
                    id="headerText"
                    placeholder="Service Status"
                    value={formData.headerText}
                    onChange={(e) => setFormData({ ...formData, headerText: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footerText">Footer Text (optional)</Label>
                  <Input
                    id="footerText"
                    placeholder="Powered by YourCompany"
                    value={formData.footerText}
                    onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                  />
                </div>
              </TabsContent>
              <TabsContent value="vendors" className="mt-4">
                <div className="mb-4">
                  <h4 className="font-medium mb-1">Select Vendors & Chains</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose which vendors and blockchain networks to display on this portal.
                  </p>
                </div>
                <VendorSelectionContent />
              </TabsContent>
              <TabsContent value="features" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Incident History</Label>
                    <p className="text-sm text-muted-foreground">Display past incidents on the portal</p>
                  </div>
                  <Switch
                    checked={formData.showIncidentHistory}
                    onCheckedChange={(checked) => setFormData({ ...formData, showIncidentHistory: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Uptime Stats</Label>
                    <p className="text-sm text-muted-foreground">Display uptime percentages</p>
                  </div>
                  <Switch
                    checked={formData.showUptimeStats}
                    onCheckedChange={(checked) => setFormData({ ...formData, showUptimeStats: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Subscriptions</Label>
                    <p className="text-sm text-muted-foreground">Let visitors subscribe to email updates</p>
                  </div>
                  <Switch
                    checked={formData.showSubscribeOption}
                    onCheckedChange={(checked) => setFormData({ ...formData, showSubscribeOption: checked })}
                  />
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={!formData.name || !formData.slug || createMutation.isPending}
                data-testid="create-portal-submit"
              >
                {createMutation.isPending ? "Creating..." : "Create Portal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {portals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Client Portals Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Create branded status pages for your clients with their own URLs, colors, and vendor selection.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Portal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {portals.map((portal) => (
            <Card key={portal.id} className="relative" data-testid={`portal-card-${portal.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: portal.primaryColor || "#3b82f6" }}
                    >
                      {portal.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-base">{portal.name}</CardTitle>
                      <CardDescription className="text-xs">/status/{portal.slug}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={portal.isActive ? "default" : "secondary"}>
                    {portal.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{portal.viewCount || 0} views</span>
                  </div>
                  <div className="flex items-center gap-1" data-testid={`access-type-${portal.id}`}>
                    {(portal.accessType || 'public') === 'public' ? (
                      <>
                        <Globe className="h-4 w-4 text-green-500" />
                        <span>Public</span>
                      </>
                    ) : (portal.accessType) === 'password' ? (
                      <>
                        <Lock className="h-4 w-4 text-yellow-500" />
                        <span>Password</span>
                      </>
                    ) : (
                      <>
                        <ShieldOff className="h-4 w-4 text-red-500" />
                        <span>Private</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyPortalUrl(portal.slug)}
                    data-testid={`copy-url-${portal.id}`}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy URL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={`/status/${portal.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEmbedPortal(portal)}
                    data-testid={`embed-portal-${portal.id}`}
                    title="Get embed code"
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAccessControlPortal(portal);
                      setAccessType((portal.accessType as any) || 'public');
                      setAccessPassword("");
                    }}
                    data-testid={`access-control-${portal.id}`}
                    title="Access Control"
                  >
                    <Shield className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPortal(portal)}
                    data-testid={`edit-portal-${portal.id}`}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this portal?")) {
                        deleteMutation.mutate(portal.id);
                      }
                    }}
                    data-testid={`delete-portal-${portal.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingPortal && (
        <Dialog open={!!editingPortal} onOpenChange={() => setEditingPortal(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Portal - {editingPortal.name}</DialogTitle>
              <DialogDescription>Configure vendors and settings for this portal</DialogDescription>
            </DialogHeader>
            <div className="mb-4">
              <h4 className="font-medium mb-1">Select Vendors & Chains</h4>
              <p className="text-sm text-muted-foreground">
                Choose which vendors and blockchain networks to display on this portal.
              </p>
            </div>
            <VendorSelectionContent />
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setEditingPortal(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  saveAssignments(editingPortal.id);
                  setEditingPortal(null);
                }}
                disabled={updateAssignmentsMutation.isPending}
                data-testid="save-vendors-btn"
              >
                {updateAssignmentsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {embedPortal && (
        <Dialog open={!!embedPortal} onOpenChange={() => setEmbedPortal(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Embed & Share - {embedPortal.name}</DialogTitle>
              <DialogDescription>Get embed codes, badges, and sharing links for this portal</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="iframe" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="iframe">
                  <Monitor className="h-4 w-4 mr-1" />
                  Widget
                </TabsTrigger>
                <TabsTrigger value="badge">
                  <Image className="h-4 w-4 mr-1" />
                  Badge
                </TabsTrigger>
                <TabsTrigger value="api">
                  <Code className="h-4 w-4 mr-1" />
                  API
                </TabsTrigger>
                <TabsTrigger value="tv">
                  <Monitor className="h-4 w-4 mr-1" />
                  TV Mode
                </TabsTrigger>
              </TabsList>

              <TabsContent value="iframe" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Embeddable Status Widget</Label>
                  <p className="text-sm text-muted-foreground">Add this iframe to any webpage to show live status</p>
                  <Textarea
                    readOnly
                    rows={3}
                    value={`<iframe src="${window.location.origin}/embed/${embedPortal.slug}" style="width:100%;height:400px;border:none;border-radius:8px;" title="${embedPortal.name} Status"></iframe>`}
                    className="font-mono text-xs"
                    data-testid="embed-iframe-code"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`<iframe src="${window.location.origin}/embed/${embedPortal.slug}" style="width:100%;height:400px;border:none;border-radius:8px;" title="${embedPortal.name} Status"></iframe>`);
                      toast({ title: "Copied!", description: "Iframe code copied to clipboard" });
                    }}
                    data-testid="copy-iframe-btn"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Code
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="badge" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Status Badge (SVG)</Label>
                  <p className="text-sm text-muted-foreground">Embed a status badge on your website or README</p>
                  <div className="p-4 bg-muted rounded-lg flex items-center justify-center">
                    <img
                      src={`/status/${embedPortal.slug}/badge.svg`}
                      alt={`${embedPortal.name} Status`}
                      className="h-5"
                    />
                  </div>
                  <Textarea
                    readOnly
                    rows={2}
                    value={`<a href="${window.location.origin}/embed/${embedPortal.slug}"><img src="${window.location.origin}/status/${embedPortal.slug}/badge.svg" alt="${embedPortal.name} Status" /></a>`}
                    className="font-mono text-xs"
                    data-testid="embed-badge-code"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`<a href="${window.location.origin}/embed/${embedPortal.slug}"><img src="${window.location.origin}/status/${embedPortal.slug}/badge.svg" alt="${embedPortal.name} Status" /></a>`);
                        toast({ title: "Copied!", description: "Badge HTML copied to clipboard" });
                      }}
                      data-testid="copy-badge-html-btn"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      HTML
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`[![${embedPortal.name} Status](${window.location.origin}/status/${embedPortal.slug}/badge.svg)](${window.location.origin}/embed/${embedPortal.slug})`);
                        toast({ title: "Copied!", description: "Badge Markdown copied to clipboard" });
                      }}
                      data-testid="copy-badge-md-btn"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Markdown
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="api" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Status API Endpoint</Label>
                  <p className="text-sm text-muted-foreground">Fetch live status data as JSON from this endpoint</p>
                  <Textarea
                    readOnly
                    rows={1}
                    value={`${window.location.origin}/status/${embedPortal.slug}/api`}
                    className="font-mono text-xs"
                    data-testid="embed-api-url"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/status/${embedPortal.slug}/api`);
                      toast({ title: "Copied!", description: "API URL copied to clipboard" });
                    }}
                    data-testid="copy-api-url-btn"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy URL
                  </Button>
                  <div className="mt-3 p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground font-mono">
                      {`curl ${window.location.origin}/status/${embedPortal.slug}/api`}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tv" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>TV Display Mode</Label>
                  <p className="text-sm text-muted-foreground">Full-screen status display optimized for TV dashboards and wall monitors. Auto-refreshes every 60 seconds.</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={`/embed/${embedPortal.slug}?tv=true`} target="_blank" rel="noopener noreferrer" data-testid="open-tv-mode-btn">
                        <Monitor className="h-4 w-4 mr-1" />
                        Open TV Mode
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/embed/${embedPortal.slug}?tv=true`);
                        toast({ title: "Copied!", description: "TV mode URL copied to clipboard" });
                      }}
                      data-testid="copy-tv-url-btn"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy URL
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {accessControlPortal && (
        <Dialog open={!!accessControlPortal} onOpenChange={() => setAccessControlPortal(null)}>
          <DialogContent className="max-w-md" data-testid="access-control-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Access Control - {accessControlPortal.name}
              </DialogTitle>
              <DialogDescription>Configure who can access this status portal</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div className="space-y-3">
                <Label>Access Type</Label>
                <Select value={accessType} onValueChange={(v: any) => setAccessType(v)} data-testid="access-type-select">
                  <SelectTrigger data-testid="access-type-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public" data-testid="access-type-public">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-green-500" />
                        <span>Public — Anyone with the link can view</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="password" data-testid="access-type-password">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-yellow-500" />
                        <span>Password Protected — Requires a password</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="private" data-testid="access-type-private">
                      <div className="flex items-center gap-2">
                        <ShieldOff className="h-4 w-4 text-red-500" />
                        <span>Private — Not publicly accessible</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {accessType === 'password' && (
                <div className="space-y-2">
                  <Label htmlFor="access-password">Portal Password</Label>
                  <Input
                    id="access-password"
                    type="password"
                    placeholder="Enter a password for this portal"
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    data-testid="access-password-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Visitors will need to enter this password to view the status portal.
                    {accessControlPortal.accessType === 'password' && !accessPassword && (
                      <span className="text-yellow-500 ml-1">Leave blank to keep the existing password.</span>
                    )}
                  </p>
                </div>
              )}

              {accessType === 'private' && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    This portal will not be accessible to anyone. The status page URL will show a "not accessible" message.
                  </p>
                </div>
              )}

              {accessType === 'public' && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-green-400">
                    Anyone with the link can view this status portal without authentication.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setAccessControlPortal(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  accessControlMutation.mutate({
                    slug: accessControlPortal.slug,
                    accessType,
                    password: accessType === 'password' ? accessPassword : undefined,
                  });
                }}
                disabled={accessControlMutation.isPending || (accessType === 'password' && !accessPassword && accessControlPortal.accessType !== 'password')}
                data-testid="save-access-btn"
              >
                {accessControlMutation.isPending ? "Saving..." : "Save Access Settings"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
