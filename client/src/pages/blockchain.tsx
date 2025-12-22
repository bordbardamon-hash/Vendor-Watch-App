import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Search,
  Activity,
  Loader2,
  RefreshCw,
  ExternalLink,
  Boxes,
  Layers,
  Cpu,
  Network
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface BlockchainChain {
  key: string;
  name: string;
  symbol?: string;
  tier: string;
  category: string;
  status: string;
  sourceType: string;
  statusUrl?: string;
  explorerUrl?: string;
  avgBlockTime?: number;
  lastBlockHeight?: string;
  lastChecked?: string;
}

interface BlockchainStats {
  totalChains: number;
  operationalChains: number;
  degradedChains: number;
  outageChains: number;
  activeIncidents: number;
  chainsByTier: {
    tier1: number;
    tier2: number;
    tier3: number;
    tier4: number;
  };
  chainsByCategory: {
    chain: number;
    l2: number;
    rpc_provider: number;
    indexer: number;
  };
}

interface BlockchainIncident {
  id: string;
  chainKey: string;
  incidentType: string;
  title: string;
  description?: string;
  status: string;
  severity: string;
  createdAt: string;
  resolvedAt?: string;
}

const TIER_INFO = {
  tier1: { 
    label: "Tier 1: Core Networks", 
    description: "High business impact chains - Bitcoin, Ethereum, major L1s",
    icon: Boxes,
    color: "text-red-400"
  },
  tier2: { 
    label: "Tier 2: Infrastructure-Critical", 
    description: "Layer 2s and essential scaling solutions",
    icon: Layers,
    color: "text-orange-400"
  },
  tier3: { 
    label: "Tier 3: Enterprise/Custody", 
    description: "Enterprise-focused and custody-relevant chains",
    icon: Cpu,
    color: "text-yellow-400"
  },
  tier4: { 
    label: "Tier 4: Dependencies", 
    description: "RPC providers, indexers, and ecosystem infrastructure",
    icon: Network,
    color: "text-blue-400"
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  chain: "L1 Chain",
  l2: "Layer 2",
  rpc_provider: "RPC Provider",
  indexer: "Indexer",
};

export default function Blockchain() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: chains = [], isLoading: chainsLoading, refetch } = useQuery<BlockchainChain[]>({
    queryKey: ["blockchain-chains"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/chains");
      if (!res.ok) throw new Error("Failed to fetch blockchain chains");
      return res.json();
    },
  });

  const { data: stats } = useQuery<BlockchainStats>({
    queryKey: ["blockchain-stats"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: activeIncidents = [] } = useQuery<BlockchainIncident[]>({
    queryKey: ["blockchain-incidents-active"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/incidents/active");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      return res.json();
    },
  });

  const filteredChains = chains.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.symbol && c.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getChainsByTier = (tier: string) => {
    return filteredChains.filter(c => c.tier === tier);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "degraded":
      case "partial_outage":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "major_outage":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Operational</Badge>;
      case "degraded":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Degraded</Badge>;
      case "partial_outage":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Partial Outage</Badge>;
      case "major_outage":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Major Outage</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">Unknown</Badge>;
    }
  };

  const renderChainCard = (chain: BlockchainChain) => (
    <Card key={chain.key} className="bg-sidebar border-sidebar-border hover:border-primary/30 transition-colors" data-testid={`card-chain-${chain.key}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(chain.status)}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{chain.name}</h3>
                {chain.symbol && (
                  <span className="text-xs text-muted-foreground font-mono">{chain.symbol}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[chain.category] || chain.category}</Badge>
                {chain.avgBlockTime && (
                  <span className="text-xs text-muted-foreground">~{chain.avgBlockTime}s blocks</span>
                )}
              </div>
            </div>
          </div>
          {getStatusBadge(chain.status)}
        </div>
        
        <div className="mt-3 flex items-center gap-2">
          {chain.explorerUrl && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <a href={chain.explorerUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-explorer-${chain.key}`}>
                <ExternalLink className="w-3 h-3 mr-1" />
                Explorer
              </a>
            </Button>
          )}
          {chain.statusUrl && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <a href={chain.statusUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-status-${chain.key}`}>
                <Activity className="w-3 h-3 mr-1" />
                Status
              </a>
            </Button>
          )}
        </div>

        {chain.lastChecked && (
          <div className="mt-2 text-xs text-muted-foreground">
            Last checked: {new Date(chain.lastChecked).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderTierSection = (tier: string) => {
    const tierInfo = TIER_INFO[tier as keyof typeof TIER_INFO];
    const tierChains = getChainsByTier(tier);
    const Icon = tierInfo.icon;

    if (tierChains.length === 0 && searchTerm) return null;

    return (
      <div key={tier} className="space-y-4" data-testid={`section-${tier}`}>
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${tierInfo.color}`} />
          <div>
            <h2 className="text-lg font-semibold">{tierInfo.label}</h2>
            <p className="text-sm text-muted-foreground">{tierInfo.description}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tierChains.map(renderChainCard)}
        </div>
      </div>
    );
  };

  if (chainsLoading) {
    return (
      <div className="p-8 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Blockchain Infrastructure</h1>
            <p className="text-muted-foreground mt-1">Monitor chain liveness, finality, and RPC availability</p>
          </div>
          <div className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chains..."
                className="pl-8 bg-sidebar border-sidebar-border"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-chains"
              />
            </div>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-chains">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.totalChains}</div>
                <div className="text-sm text-muted-foreground">Total Chains</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">{stats.operationalChains}</div>
                <div className="text-sm text-muted-foreground">Operational</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-500">{stats.degradedChains}</div>
                <div className="text-sm text-muted-foreground">Degraded</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-500">{stats.outageChains}</div>
                <div className="text-sm text-muted-foreground">Outages</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-500">{stats.activeIncidents}</div>
                <div className="text-sm text-muted-foreground">Active Incidents</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.chainsByCategory.l2}</div>
                <div className="text-sm text-muted-foreground">Layer 2s</div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeIncidents.length > 0 && (
          <Card className="bg-red-950/20 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Active Incidents ({activeIncidents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeIncidents.slice(0, 5).map((incident) => (
                  <div key={incident.id} className="flex items-start justify-between p-3 bg-sidebar rounded-lg border border-sidebar-border">
                    <div>
                      <div className="font-medium">{incident.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {chains.find(c => c.key === incident.chainKey)?.name || incident.chainKey} - {incident.incidentType.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
                      {incident.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-sidebar border-sidebar-border">
            <TabsTrigger value="all" data-testid="tab-all">All Chains</TabsTrigger>
            <TabsTrigger value="tier1" data-testid="tab-tier1">Tier 1</TabsTrigger>
            <TabsTrigger value="tier2" data-testid="tab-tier2">Tier 2</TabsTrigger>
            <TabsTrigger value="tier3" data-testid="tab-tier3">Tier 3</TabsTrigger>
            <TabsTrigger value="tier4" data-testid="tab-tier4">Dependencies</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-8 mt-6">
            {["tier1", "tier2", "tier3", "tier4"].map(renderTierSection)}
          </TabsContent>

          {["tier1", "tier2", "tier3", "tier4"].map((tier) => (
            <TabsContent key={tier} value={tier} className="mt-6">
              {renderTierSection(tier)}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </ScrollArea>
  );
}
