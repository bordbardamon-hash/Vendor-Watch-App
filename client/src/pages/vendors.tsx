import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Search, 
  Activity,
  Server,
  Code,
  Hash,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Vendor {
  id: string;
  key: string;
  name: string;
  statusUrl: string;
  parser: string;
  status: string;
  lastChecked?: string;
  createdAt: string;
}

interface Incident {
  id: string;
  vendorKey: string;
  incidentId: string;
  title: string;
  status: string;
  severity: string;
  impact: string;
  url: string;
  startedAt: string;
  updatedAt: string;
  rawHash?: string;
  createdAt: string;
}

export default function Vendors() {
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch vendors
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
  });

  // Fetch all incidents
  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const res = await fetch("/api/incidents");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      return res.json();
    },
  });

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getVendorIncidents = (vendorKey: string) => {
    return incidents.filter(i => i.vendorKey === vendorKey);
  };

  const getSeverityColor = (severity: string) => {
    switch(severity.toLowerCase()) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'major': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'minor': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  if (vendorsLoading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Status</h1>
          <p className="text-muted-foreground mt-1">Monitor third-party service incidents and health</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search vendors..." 
              className="pl-8 bg-sidebar border-sidebar-border" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-vendors"
            />
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="button-add-vendor">
            + Add Vendor
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Vendor List */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {filteredVendors.map((vendor) => (
                <Card 
                  key={vendor.key}
                  className={`cursor-pointer transition-all hover:bg-sidebar/50 border-sidebar-border ${selectedVendor?.key === vendor.key ? 'bg-sidebar border-primary/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-sidebar/20'}`}
                  onClick={() => setSelectedVendor(vendor)}
                  data-testid={`card-vendor-${vendor.key}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold" data-testid={`text-vendor-name-${vendor.key}`}>{vendor.name}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`bg-transparent border ${vendor.status === 'operational' ? 'border-emerald-500/30 text-emerald-500' : vendor.status === 'degraded' ? 'border-orange-500/30 text-orange-500' : 'border-red-500/30 text-red-500'}`}
                        data-testid={`badge-status-${vendor.key}`}
                      >
                        {vendor.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono mt-3">
                      <div className="flex items-center gap-1.5" title="Parser Module">
                        <Code className="w-3 h-3" />
                        <span className="truncate">{vendor.parser}</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end" title="Status Page URL">
                        <Activity className="w-3 h-3" />
                        <a href={vendor.statusUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate max-w-[120px]">
                          {new URL(vendor.statusUrl).hostname}
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Detail View */}
        <div className="col-span-12 lg:col-span-7 h-full">
          {selectedVendor ? (
            <Card className="h-full border-sidebar-border bg-sidebar/10 flex flex-col">
              <CardHeader className="border-b border-sidebar-border bg-sidebar/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      {selectedVendor.name}
                      <a href={selectedVendor.statusUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                      </a>
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      KEY: <span className="text-primary">{selectedVendor.key}</span>
                    </CardDescription>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${selectedVendor.status === 'operational' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${selectedVendor.status === 'operational' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                    {selectedVendor.status.toUpperCase()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-sidebar-border">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Active & Recent Incidents
                  </h3>
                  
                  {getVendorIncidents(selectedVendor.key).length > 0 ? (
                    <div className="space-y-4">
                      {getVendorIncidents(selectedVendor.key).map((incident) => (
                        <div key={incident.id} className="border border-sidebar-border rounded-lg bg-background/50 p-4 transition-all hover:border-primary/30" data-testid={`card-incident-${incident.incidentId}`}>
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-lg">{incident.title}</h4>
                            <Badge className={getSeverityColor(incident.severity)}>
                              {incident.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{incident.impact}</p>
                          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground/70 bg-sidebar/50 p-2 rounded">
                            <span className="flex items-center gap-2">
                              <span>ID: {incident.incidentId}</span>
                              {incident.rawHash && (
                                <span className="text-[10px] text-muted-foreground/50 border-l border-white/10 pl-2 flex items-center gap-1" title="Stable Hash">
                                  <Hash className="w-3 h-3" />
                                  {incident.rawHash.substring(0, 8)}...
                                </span>
                              )}
                            </span>
                            <span>{incident.startedAt}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">Status: {incident.status}</Badge>
                            <a href={incident.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                              View Update <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500/20" />
                      <p>No incidents reported recently.</p>
                      <p className="text-sm opacity-50">System appears to be fully operational.</p>
                    </div>
                  )}
                </div>
                
                <div className="p-6 bg-sidebar/30 flex-1">
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Configuration</h4>
                  <div className="bg-black/50 p-4 rounded-md border border-sidebar-border font-mono text-xs text-muted-foreground overflow-x-auto">
                    <div className="grid grid-cols-[100px_1fr] gap-2">
                      <span className="text-primary">parser_cls:</span>
                      <span>{selectedVendor.parser}</span>
                      <span className="text-primary">endpoint:</span>
                      <span>{selectedVendor.statusUrl}</span>
                      <span className="text-primary">last_sync:</span>
                      <span>{selectedVendor.lastChecked || 'Never'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-sidebar-border rounded-lg bg-sidebar/10">
              <Server className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a Vendor</p>
              <p className="text-sm opacity-50">View incidents and detailed status metrics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
