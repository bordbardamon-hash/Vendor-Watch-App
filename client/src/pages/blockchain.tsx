import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoAvatar } from "@/components/ui/logo-avatar";
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
  Network,
  Plus,
  Shield,
  Lock,
  BellOff,
  Bell,
  Wallet,
  Coins
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatShortDateInTimezone, getBrowserTimezone } from "@/lib/utils";

interface BlockchainChain {
  key: string;
  name: string;
  symbol?: string;
  logoUrl?: string | null;
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
  url?: string;
  createdAt: string;
  resolvedAt?: string;
  startedAt: string;
}

interface Acknowledgement {
  id: string;
  userId: string;
  incidentId: string;
  incidentType: string;
  acknowledgedAt: string;
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
  wallet: "Wallet",
  staking: "Staking",
};

export default function Blockchain() {
  const { user } = useAuth();
  const timezone = user?.timezone || getBrowserTimezone();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch blockchain subscriptions
  const { data: subscriptionData } = useQuery<{
    subscribedChains: string[];
    hasSetSubscriptions: boolean;
    allowed: boolean;
    current: number;
    limit: number | null;
    tier: string | null;
  }>({
    queryKey: ["subscriptions-blockchain"],
    queryFn: async () => {
      const res = await fetch("/api/subscriptions/blockchain");
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },
  });

  // Toggle blockchain subscription mutation
  const toggleChainMutation = useMutation({
    mutationFn: async (chainKey: string) => {
      const res = await fetch(`/api/blockchain/${chainKey}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to toggle chain");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions-blockchain"] });
      toast({
        title: data.subscribed ? "Chain Added" : "Chain Removed",
        description: data.subscribed 
          ? `Added to monitoring (${data.current}/${data.limit === null ? '∞' : data.limit})`
          : "Removed from monitoring",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  // Helper to check if chain is being monitored
  const isMonitored = (chainKey: string) => {
    if (!subscriptionData?.hasSetSubscriptions) return false;
    return subscriptionData.subscribedChains.includes(chainKey);
  };

  // Helper to check if user can add more chains
  const canAddMore = () => {
    if (!subscriptionData) return false;
    if (subscriptionData.limit === null) return true; // Enterprise
    return subscriptionData.current < subscriptionData.limit;
  };

  // Check if user has blockchain access (Growth and Enterprise tiers only)
  const hasBlockchainAccess = () => {
    return subscriptionData?.tier === 'growth' || subscriptionData?.tier === 'enterprise';
  };

  const { data: chains = [], isLoading: chainsLoading, refetch, isFetching } = useQuery<BlockchainChain[]>({
    queryKey: ["blockchain-chains"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/chains");
      if (!res.ok) throw new Error("Failed to fetch blockchain chains");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // Manual refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/blockchain/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh blockchain data");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blockchain-chains"] });
      queryClient.invalidateQueries({ queryKey: ["blockchain-stats"] });
      queryClient.invalidateQueries({ queryKey: ["blockchain-incidents-active"] });
      toast({ title: "Refreshed", description: "Blockchain data updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Refresh Failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: stats } = useQuery<BlockchainStats>({
    queryKey: ["blockchain-stats"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: activeIncidents = [] } = useQuery<BlockchainIncident[]>({
    queryKey: ["blockchain-incidents-active"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/incidents/active");
      if (!res.ok) throw new Error("Failed to fetch incidents");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // Fetch user's acknowledged incidents
  const { data: acknowledgements = [] } = useQuery<Acknowledgement[]>({
    queryKey: ["acknowledgements"],
    queryFn: async () => {
      const res = await fetch("/api/incidents/acknowledgements");
      if (!res.ok) throw new Error("Failed to fetch acknowledgements");
      return res.json();
    },
  });

  // Acknowledge blockchain incident mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (incidentId: string) => {
      const res = await fetch(`/api/blockchain/incidents/${incidentId}/acknowledge`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to acknowledge incident");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acknowledgements"] });
      toast({
        title: "Incident Acknowledged",
        description: "You won't receive further notifications for this incident.",
      });
    },
  });

  // Unacknowledge blockchain incident mutation
  const unacknowledgeMutation = useMutation({
    mutationFn: async (incidentId: string) => {
      const res = await fetch(`/api/blockchain/incidents/${incidentId}/acknowledge`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unacknowledge incident");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acknowledgements"] });
      toast({
        title: "Acknowledgement Removed",
        description: "You will receive notifications for this incident again.",
      });
    },
  });

  // Helper to check if an incident is acknowledged
  const isAcknowledged = (incidentId: string) => {
    return acknowledgements.some(a => a.incidentId === incidentId);
  };

  const filteredChains = chains.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.symbol && c.symbol.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    if (statusFilter === 'operational') return c.status === 'operational';
    if (statusFilter === 'degraded') return c.status === 'degraded' || c.status === 'partial_outage';
    if (statusFilter === 'outage') return c.status === 'major_outage';
    if (statusFilter === 'l2') return c.category === 'l2';
    if (statusFilter === 'incidents') return activeIncidents.some(i => i.chainKey === c.key);
    
    return true;
  });

  const getChainsByTier = (tier: string) => {
    return filteredChains.filter(c => c.tier === tier && c.category !== 'wallet' && c.category !== 'staking');
  };

  const getChainsByCategory = (category: string) => {
    return filteredChains.filter(c => c.category === category);
  };

  const wallets = getChainsByCategory('wallet');
  const stakingPlatforms = getChainsByCategory('staking');

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
    <Card key={chain.key} className={`bg-sidebar border-sidebar-border hover:border-primary/30 transition-colors ${isMonitored(chain.key) ? 'ring-1 ring-primary/30' : ''}`} data-testid={`card-chain-${chain.key}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <LogoAvatar src={chain.logoUrl} name={chain.name} size="md" />
            <div>
              <div className="flex items-center gap-2">
                {getStatusIcon(chain.status)}
                <h3 className="font-semibold">{chain.name}</h3>
                {chain.symbol && (
                  <span className="text-xs text-muted-foreground font-mono">{chain.symbol}</span>
                )}
                {isMonitored(chain.key) && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30">
                    Monitored
                  </Badge>
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
          <div className="flex items-center gap-2">
            {getStatusBadge(chain.status)}
            {hasBlockchainAccess() && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 w-7 p-0 ${isMonitored(chain.key) ? 'text-primary hover:text-red-500 hover:bg-red-500/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isMonitored(chain.key) && !canAddMore()) {
                    toast({ 
                      title: "Chain Limit Reached", 
                      description: `Your ${subscriptionData?.tier} plan allows up to ${subscriptionData?.limit} chains. Upgrade to monitor more.`,
                      variant: "destructive"
                    });
                    return;
                  }
                  toggleChainMutation.mutate(chain.key);
                }}
                disabled={toggleChainMutation.isPending}
                title={isMonitored(chain.key) ? "Remove from monitoring" : "Add to monitoring"}
                data-testid={`button-toggle-chain-${chain.key}`}
              >
                {isMonitored(chain.key) ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </Button>
            )}
          </div>
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
            Last checked: {formatShortDateInTimezone(chain.lastChecked, timezone)}
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
      <div className="p-4 md:p-8 space-y-4 md:space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Blockchain Infrastructure</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">Monitor chain liveness, finality, and RPC availability</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chains..."
                className="pl-8 bg-sidebar border-sidebar-border"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-chains"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => refreshMutation.mutate()} 
              disabled={refreshMutation.isPending || isFetching}
              data-testid="button-refresh-chains" 
              className="flex-1 sm:flex-none"
            >
              {refreshMutation.isPending || isFetching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {refreshMutation.isPending ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Subscription Status */}
        {subscriptionData && (
          <div className={`border rounded-lg p-3 md:p-4 ${hasBlockchainAccess() ? 'bg-sidebar/30 border-sidebar-border' : 'bg-amber-950/20 border-amber-500/30'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {hasBlockchainAccess() ? (
                  <Shield className="w-5 h-5 text-primary" />
                ) : (
                  <Lock className="w-5 h-5 text-amber-500" />
                )}
                <div>
                  <h3 className="font-medium">
                    {hasBlockchainAccess() 
                      ? "Blockchain Monitoring" 
                      : "Blockchain Monitoring Requires Upgrade"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {hasBlockchainAccess() 
                      ? `Select up to ${subscriptionData.limit === null ? 'unlimited' : subscriptionData.limit} blockchain networks to monitor`
                      : "Upgrade to Growth (10 chains) or Enterprise (unlimited) to monitor blockchain networks"}
                  </p>
                </div>
              </div>
              {hasBlockchainAccess() && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {subscriptionData.current} / {subscriptionData.limit === null ? '∞' : subscriptionData.limit} chains
                  </span>
                  <Badge variant="outline" className="text-xs capitalize">{subscriptionData.tier}</Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {stats && (
          <div className="space-y-3">
            {statusFilter && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filtering by:</span>
                <Badge variant="outline" className="capitalize">{statusFilter === 'l2' ? 'Layer 2s' : statusFilter}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter(null)} className="h-6 px-2 text-xs">
                  Clear filter
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card 
                className={`bg-sidebar border-sidebar-border cursor-pointer transition-all hover:border-primary/50 ${statusFilter === null ? 'ring-1 ring-primary/30' : ''}`}
                onClick={() => setStatusFilter(null)}
                data-testid="stat-total"
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.totalChains}</div>
                  <div className="text-sm text-muted-foreground">Total Chains</div>
                </CardContent>
              </Card>
              <Card 
                className={`bg-sidebar border-sidebar-border cursor-pointer transition-all hover:border-green-500/50 ${statusFilter === 'operational' ? 'ring-1 ring-green-500/50' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'operational' ? null : 'operational')}
                data-testid="stat-operational"
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-500">{stats.operationalChains}</div>
                  <div className="text-sm text-muted-foreground">Operational</div>
                </CardContent>
              </Card>
              <Card 
                className={`bg-sidebar border-sidebar-border cursor-pointer transition-all hover:border-yellow-500/50 ${statusFilter === 'degraded' ? 'ring-1 ring-yellow-500/50' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'degraded' ? null : 'degraded')}
                data-testid="stat-degraded"
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-500">{stats.degradedChains}</div>
                  <div className="text-sm text-muted-foreground">Degraded</div>
                </CardContent>
              </Card>
              <Card 
                className={`bg-sidebar border-sidebar-border cursor-pointer transition-all hover:border-red-500/50 ${statusFilter === 'outage' ? 'ring-1 ring-red-500/50' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'outage' ? null : 'outage')}
                data-testid="stat-outages"
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-500">{stats.outageChains}</div>
                  <div className="text-sm text-muted-foreground">Outages</div>
                </CardContent>
              </Card>
              <Card 
                className={`bg-sidebar border-sidebar-border cursor-pointer transition-all hover:border-orange-500/50 ${statusFilter === 'incidents' ? 'ring-1 ring-orange-500/50' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'incidents' ? null : 'incidents')}
                data-testid="stat-incidents"
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-500">{stats.activeIncidents}</div>
                  <div className="text-sm text-muted-foreground">Active Incidents</div>
                </CardContent>
              </Card>
              <Card 
                className={`bg-sidebar border-sidebar-border cursor-pointer transition-all hover:border-primary/50 ${statusFilter === 'l2' ? 'ring-1 ring-primary/50' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'l2' ? null : 'l2')}
                data-testid="stat-l2"
              >
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{stats.chainsByCategory.l2}</div>
                  <div className="text-sm text-muted-foreground">Layer 2s</div>
                </CardContent>
              </Card>
            </div>
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
                {activeIncidents.map((incident) => {
                  const chain = chains.find(c => c.key === incident.chainKey);
                  const statusUrl = incident.url || chain?.statusUrl;
                  return (
                    <div key={incident.id} className="p-3 bg-sidebar rounded-lg border border-sidebar-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {incident.title}
                            {statusUrl && (
                              <a 
                                href={statusUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`link-incident-${incident.id}`}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {chain?.name || incident.chainKey} - {incident.incidentType.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
                          {incident.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isAcknowledged(incident.id) && (
                            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-500">
                              <BellOff className="w-3 h-3 mr-1" />
                              Acknowledged
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant={isAcknowledged(incident.id) ? "secondary" : "outline"}
                          size="sm"
                          className="text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            isAcknowledged(incident.id) 
                              ? unacknowledgeMutation.mutate(incident.id)
                              : acknowledgeMutation.mutate(incident.id);
                          }}
                          disabled={acknowledgeMutation.isPending || unacknowledgeMutation.isPending}
                          data-testid={`button-acknowledge-blockchain-${incident.id}`}
                        >
                          {isAcknowledged(incident.id) ? (
                            <>
                              <Bell className="w-3 h-3 mr-1" />
                              Resume Alerts
                            </>
                          ) : (
                            <>
                              <BellOff className="w-3 h-3 mr-1" />
                              Acknowledge
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-sidebar border-sidebar-border flex-wrap">
            <TabsTrigger value="all" data-testid="tab-all">All Chains</TabsTrigger>
            <TabsTrigger value="tier1" data-testid="tab-tier1">Tier 1</TabsTrigger>
            <TabsTrigger value="tier2" data-testid="tab-tier2">Tier 2</TabsTrigger>
            <TabsTrigger value="tier3" data-testid="tab-tier3">Tier 3</TabsTrigger>
            <TabsTrigger value="tier4" data-testid="tab-tier4">Dependencies</TabsTrigger>
            <TabsTrigger value="wallets" data-testid="tab-wallets">
              <Wallet className="w-4 h-4 mr-1.5" />
              WalletConnect
            </TabsTrigger>
            <TabsTrigger value="staking" data-testid="tab-staking">
              <Coins className="w-4 h-4 mr-1.5" />
              Staking
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-8 mt-6">
            {["tier1", "tier2", "tier3", "tier4"].map(renderTierSection)}
            
            {wallets.length > 0 && (
              <div className="space-y-4" data-testid="section-wallets">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-purple-400" />
                  <div>
                    <h2 className="text-lg font-semibold">WalletConnect: Popular Compatible Wallets</h2>
                    <p className="text-sm text-muted-foreground">User-facing wallets for asset management and DeFi</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {wallets.map(renderChainCard)}
                </div>
              </div>
            )}
            
            {stakingPlatforms.length > 0 && (
              <div className="space-y-4" data-testid="section-staking">
                <div className="flex items-center gap-3">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-lg font-semibold">Staking Platforms</h2>
                    <p className="text-sm text-muted-foreground">CEXs, liquid staking protocols, and institutional staking providers</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stakingPlatforms.map(renderChainCard)}
                </div>
              </div>
            )}
          </TabsContent>

          {["tier1", "tier2", "tier3", "tier4"].map((tier) => (
            <TabsContent key={tier} value={tier} className="mt-6">
              {renderTierSection(tier)}
            </TabsContent>
          ))}

          <TabsContent value="wallets" className="mt-6">
            <div className="space-y-4" data-testid="section-wallets-tab">
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="text-lg font-semibold">WalletConnect: Popular Compatible Wallets</h2>
                  <p className="text-sm text-muted-foreground">User-facing wallets for asset management and DeFi</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wallets.map(renderChainCard)}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="staking" className="mt-6">
            <div className="space-y-4" data-testid="section-staking-tab">
              <div className="flex items-center gap-3">
                <Coins className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-lg font-semibold">Staking Platforms</h2>
                  <p className="text-sm text-muted-foreground">CEXs, liquid staking protocols, and institutional staking providers</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stakingPlatforms.map(renderChainCard)}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
