import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wrench, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  RefreshCw, 
  ExternalLink,
  AlertTriangle,
  Loader2,
  Server,
  Boxes,
  BellOff,
  Bell,
  Wallet,
  Coins,
  Download
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, parseISO, isAfter, isBefore } from "date-fns";

interface VendorMaintenance {
  id: string;
  vendorKey: string;
  maintenanceId: string;
  title: string;
  description?: string;
  status: string;
  impact: string;
  url?: string;
  scheduledStartAt: string;
  scheduledEndAt?: string;
  actualStartAt?: string;
  actualEndAt?: string;
  affectedComponents?: string;
  createdAt: string;
  updatedAt: string;
}

interface BlockchainMaintenance {
  id: string;
  chainKey: string;
  maintenanceId: string;
  title: string;
  description?: string;
  status: string;
  impact: string;
  url?: string;
  scheduledStartAt: string;
  scheduledEndAt?: string;
  actualStartAt?: string;
  actualEndAt?: string;
  affectedServices?: string;
  createdAt: string;
  updatedAt: string;
}

interface MaintenanceStats {
  vendorActive: number;
  vendorUpcoming: number;
  blockchainActive: number;
  blockchainUpcoming: number;
  total: number;
}

interface MaintenanceAcknowledgement {
  id: number;
  userId: string;
  maintenanceId: string;
  maintenanceType: 'vendor' | 'blockchain';
  acknowledgedAt: string;
}

export default function Maintenance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");

  const { data: stats, isLoading: statsLoading } = useQuery<MaintenanceStats>({
    queryKey: ["maintenance-stats"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance/stats");
      if (!res.ok) throw new Error("Failed to fetch maintenance stats");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: vendorActive = [] } = useQuery<VendorMaintenance[]>({
    queryKey: ["maintenance-vendors-active"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance/vendors/active");
      if (!res.ok) throw new Error("Failed to fetch active vendor maintenances");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: vendorUpcoming = [] } = useQuery<VendorMaintenance[]>({
    queryKey: ["maintenance-vendors-upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance/vendors/upcoming");
      if (!res.ok) throw new Error("Failed to fetch upcoming vendor maintenances");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: blockchainActive = [] } = useQuery<BlockchainMaintenance[]>({
    queryKey: ["maintenance-blockchain-active"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance/blockchain/active");
      if (!res.ok) throw new Error("Failed to fetch active blockchain maintenances");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: blockchainUpcoming = [] } = useQuery<BlockchainMaintenance[]>({
    queryKey: ["maintenance-blockchain-upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance/blockchain/upcoming");
      if (!res.ok) throw new Error("Failed to fetch upcoming blockchain maintenances");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: acknowledgements = [] } = useQuery<MaintenanceAcknowledgement[]>({
    queryKey: ["maintenance-acknowledgements"],
    queryFn: async () => {
      const res = await fetch("/api/maintenance/acknowledgements");
      if (!res.ok) throw new Error("Failed to fetch acknowledgements");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const acknowledgedMaintenanceIds = new Set(acknowledgements.map(a => a.maintenanceId));

  const generateICS = () => {
    const allMaintenances = [...vendorUpcoming, ...blockchainUpcoming, ...vendorActive, ...blockchainActive];
    
    const CRLF = '\r\n';
    
    const escapeIcsText = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
    };
    
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Vendor Watch//Maintenance Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Vendor Watch Maintenance',
    ];

    allMaintenances.forEach((m) => {
      const start = new Date(m.scheduledStartAt);
      const end = m.scheduledEndAt ? new Date(m.scheduledEndAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
      
      const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      const name = 'vendorKey' in m ? m.vendorKey : ('chainKey' in m ? m.chainKey : 'Unknown');
      const uid = `maintenance-${m.id}@vendorwatch`;
      const summary = escapeIcsText(`${name.toUpperCase()} Maintenance: ${m.title}`);
      const description = escapeIcsText((m.description || m.title).substring(0, 500));
      
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${formatDate(new Date())}`);
      lines.push(`DTSTART:${formatDate(start)}`);
      lines.push(`DTEND:${formatDate(end)}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${description}`);
      lines.push(`STATUS:${m.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`);
      lines.push('CATEGORIES:MAINTENANCE');
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    
    const icsContent = lines.join(CRLF) + CRLF;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendor-watch-maintenance.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Calendar Exported",
      description: "Maintenance calendar exported as ICS file. Import it into your calendar app.",
    });
  };

  const walletChainKeys = new Set([
    'metamask', 'trustwallet', 'ledger', 'coinbasewallet', 
    'rainbow', 'argent', 'gnosissafe', 'bybitwallet'
  ]);
  
  const stakingChainKeys = new Set([
    'binance', 'coinbase', 'kraken', 'gemini',
    'lido', 'rocketpool', 'stakewise', 'stakedao', 'marinade',
    'rockx', 'figment', 'ankr', 'cryptocom', 'kiln', 'bybit'
  ]);
  
  const isWalletMaintenance = (chainKey: string) => walletChainKeys.has(chainKey);
  const isStakingMaintenance = (chainKey: string) => stakingChainKeys.has(chainKey);
  
  const walletActive = blockchainActive.filter(m => isWalletMaintenance(m.chainKey));
  const walletUpcoming = blockchainUpcoming.filter(m => isWalletMaintenance(m.chainKey));
  const stakingActive = blockchainActive.filter(m => isStakingMaintenance(m.chainKey));
  const stakingUpcoming = blockchainUpcoming.filter(m => isStakingMaintenance(m.chainKey));
  const chainOnlyActive = blockchainActive.filter(m => !isWalletMaintenance(m.chainKey) && !isStakingMaintenance(m.chainKey));
  const chainOnlyUpcoming = blockchainUpcoming.filter(m => !isWalletMaintenance(m.chainKey) && !isStakingMaintenance(m.chainKey));

  const acknowledgeVendorMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      const res = await fetch(`/api/maintenance/vendors/${maintenanceId}/acknowledge`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to acknowledge maintenance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-acknowledgements"] });
      toast({ title: "Acknowledged", description: "You will no longer receive notifications for this maintenance." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to acknowledge maintenance.", variant: "destructive" });
    },
  });

  const unacknowledgeVendorMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      const res = await fetch(`/api/maintenance/vendors/${maintenanceId}/acknowledge`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unacknowledge maintenance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-acknowledgements"] });
      toast({ title: "Unacknowledged", description: "You will receive notifications for this maintenance again." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unacknowledge maintenance.", variant: "destructive" });
    },
  });

  const acknowledgeBlockchainMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      const res = await fetch(`/api/maintenance/blockchain/${maintenanceId}/acknowledge`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to acknowledge blockchain maintenance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-acknowledgements"] });
      toast({ title: "Acknowledged", description: "You will no longer receive notifications for this maintenance." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to acknowledge maintenance.", variant: "destructive" });
    },
  });

  const unacknowledgeBlockchainMutation = useMutation({
    mutationFn: async (maintenanceId: string) => {
      const res = await fetch(`/api/maintenance/blockchain/${maintenanceId}/acknowledge`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unacknowledge blockchain maintenance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-acknowledgements"] });
      toast({ title: "Unacknowledged", description: "You will receive notifications for this maintenance again." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unacknowledge maintenance.", variant: "destructive" });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const vendorRes = await fetch("/api/vendors/sync", { method: "POST" });
      const blockchainRes = await fetch("/api/blockchain/sync", { method: "POST" });
      
      const vendorOk = vendorRes.ok;
      const blockchainOk = blockchainRes.ok;
      
      if (!vendorOk && !blockchainOk) {
        throw new Error("Both sync requests failed");
      }
      
      return { 
        vendor: vendorOk ? await vendorRes.json() : null, 
        blockchain: blockchainOk ? await blockchainRes.json() : null,
        vendorOk,
        blockchainOk
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-stats"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-vendors-active"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-vendors-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-blockchain-active"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-blockchain-upcoming"] });
      
      if (data.vendorOk && data.blockchainOk) {
        toast({ title: "Refresh Complete", description: "Maintenance data has been updated." });
      } else {
        toast({ 
          title: "Partial Refresh", 
          description: `${!data.vendorOk ? 'Vendor sync unavailable. ' : ''}${!data.blockchainOk ? 'Blockchain sync unavailable.' : ''}`,
          variant: "default"
        });
      }
    },
    onError: () => {
      toast({ 
        title: "Refresh Failed", 
        description: "Could not update maintenance data. Please try again later.",
        variant: "destructive"
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Scheduled</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">In Progress</Badge>;
      case 'verifying':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">Verifying</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">{status}</Badge>;
    }
  };

  const formatScheduleTime = (startAt: string, endAt?: string) => {
    try {
      const start = parseISO(startAt);
      const now = new Date();
      
      if (isBefore(start, now)) {
        if (endAt) {
          const end = parseISO(endAt);
          if (isAfter(end, now)) {
            return `Started ${formatDistanceToNow(start, { addSuffix: true })}`;
          }
        }
        return `Started ${formatDistanceToNow(start, { addSuffix: true })}`;
      }
      
      return `Scheduled ${formatDistanceToNow(start, { addSuffix: true })}`;
    } catch {
      return startAt;
    }
  };

  const renderVendorMaintenanceCard = (maint: VendorMaintenance) => {
    const isAcked = acknowledgedMaintenanceIds.has(maint.id);
    return (
      <Card key={maint.id} className={`bg-sidebar border-sidebar-border ${isAcked ? 'opacity-60' : ''}`} data-testid={`card-vendor-maintenance-${maint.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{maint.vendorKey}</span>
                {getStatusBadge(maint.status)}
                {isAcked && (
                  <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted text-xs">
                    <BellOff className="w-3 h-3 mr-1" />
                    Acknowledged
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold">{maint.title}</h3>
              {maint.description && (
                <p className="text-sm text-muted-foreground mt-1">{maint.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatScheduleTime(maint.scheduledStartAt, maint.scheduledEndAt)}
                </span>
                {maint.affectedComponents && (
                  <span className="text-xs">Affects: {maint.affectedComponents}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => isAcked 
                  ? unacknowledgeVendorMutation.mutate(maint.id)
                  : acknowledgeVendorMutation.mutate(maint.id)
                }
                disabled={acknowledgeVendorMutation.isPending || unacknowledgeVendorMutation.isPending}
                title={isAcked ? "Resume notifications" : "Stop notifications"}
                data-testid={`button-ack-vendor-${maint.id}`}
              >
                {isAcked ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </Button>
              {maint.url && (
                <a 
                  href={maint.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 p-2"
                  data-testid={`link-vendor-maintenance-${maint.id}`}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderBlockchainMaintenanceCard = (maint: BlockchainMaintenance) => {
    const isAcked = acknowledgedMaintenanceIds.has(maint.id);
    const isWallet = isWalletMaintenance(maint.chainKey);
    return (
      <Card key={maint.id} className={`bg-sidebar border-sidebar-border ${isAcked ? 'opacity-60' : ''}`} data-testid={`card-blockchain-maintenance-${maint.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isWallet ? (
                  <Wallet className="w-4 h-4 text-purple-500" />
                ) : (
                  <Boxes className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">{maint.chainKey}</span>
                {getStatusBadge(maint.status)}
                {isAcked && (
                  <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted text-xs">
                    <BellOff className="w-3 h-3 mr-1" />
                    Acknowledged
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold">{maint.title}</h3>
              {maint.description && (
                <p className="text-sm text-muted-foreground mt-1">{maint.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatScheduleTime(maint.scheduledStartAt, maint.scheduledEndAt)}
                </span>
                {maint.affectedServices && (
                  <span className="text-xs">Affects: {maint.affectedServices}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => isAcked 
                  ? unacknowledgeBlockchainMutation.mutate(maint.id)
                  : acknowledgeBlockchainMutation.mutate(maint.id)
                }
                disabled={acknowledgeBlockchainMutation.isPending || unacknowledgeBlockchainMutation.isPending}
                title={isAcked ? "Resume notifications" : "Stop notifications"}
                data-testid={`button-ack-blockchain-${maint.id}`}
              >
                {isAcked ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </Button>
              {maint.url && (
                <a 
                  href={maint.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 p-2"
                  data-testid={`link-blockchain-maintenance-${maint.id}`}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const allActive = [...vendorActive, ...blockchainActive];
  const allUpcoming = [...vendorUpcoming, ...blockchainUpcoming];

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-5 md:w-6 h-5 md:h-6 text-primary" />
              Scheduled Maintenance
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Track planned maintenance windows across vendors and blockchain infrastructure
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={generateICS}
              data-testid="button-export-calendar"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export Calendar</span>
              <span className="sm:hidden">ICS</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="button-refresh-maintenance"
            size="sm"
            className="w-full sm:w-auto"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Active</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-500">{stats.vendorActive + stats.blockchainActive}</div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-500">{stats.vendorUpcoming + stats.blockchainUpcoming}</div>
                <div className="text-sm text-muted-foreground">Upcoming</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.vendorActive + stats.vendorUpcoming}</div>
                <div className="text-sm text-muted-foreground">Vendor</div>
              </CardContent>
            </Card>
            <Card className="bg-sidebar border-sidebar-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.blockchainActive + stats.blockchainUpcoming}</div>
                <div className="text-sm text-muted-foreground">Blockchain</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-sidebar border-sidebar-border flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" data-testid="tab-all" className="text-xs sm:text-sm">All</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active" className="text-xs sm:text-sm">Active</TabsTrigger>
            <TabsTrigger value="upcoming" data-testid="tab-upcoming" className="text-xs sm:text-sm">Upcoming</TabsTrigger>
            <TabsTrigger value="vendors" data-testid="tab-vendors" className="text-xs sm:text-sm">Vendors</TabsTrigger>
            <TabsTrigger value="blockchain" data-testid="tab-blockchain" className="text-xs sm:text-sm">Chain</TabsTrigger>
            <TabsTrigger value="wallets" data-testid="tab-wallets" className="text-xs sm:text-sm">Wallets</TabsTrigger>
            <TabsTrigger value="staking" data-testid="tab-staking" className="text-xs sm:text-sm">Staking</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6 mt-6">
            {allActive.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  In Progress ({allActive.length})
                </h2>
                <div className="space-y-3">
                  {vendorActive.map(renderVendorMaintenanceCard)}
                  {blockchainActive.map(renderBlockchainMaintenanceCard)}
                </div>
              </div>
            )}
            
            {allUpcoming.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Upcoming ({allUpcoming.length})
                </h2>
                <div className="space-y-3">
                  {vendorUpcoming.map(renderVendorMaintenanceCard)}
                  {blockchainUpcoming.map(renderBlockchainMaintenanceCard)}
                </div>
              </div>
            )}

            {allActive.length === 0 && allUpcoming.length === 0 && (
              <Card className="bg-sidebar border-sidebar-border">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Scheduled Maintenance</h3>
                  <p className="text-muted-foreground">
                    All vendors and blockchain infrastructure are operating normally with no planned maintenance windows.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            {allActive.length > 0 ? (
              <div className="space-y-3">
                {vendorActive.map(renderVendorMaintenanceCard)}
                {blockchainActive.map(renderBlockchainMaintenanceCard)}
              </div>
            ) : (
              <Card className="bg-sidebar border-sidebar-border">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Active Maintenance</h3>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-6">
            {allUpcoming.length > 0 ? (
              <div className="space-y-3">
                {vendorUpcoming.map(renderVendorMaintenanceCard)}
                {blockchainUpcoming.map(renderBlockchainMaintenanceCard)}
              </div>
            ) : (
              <Card className="bg-sidebar border-sidebar-border">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Upcoming Maintenance</h3>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="vendors" className="mt-6">
            {vendorActive.length + vendorUpcoming.length > 0 ? (
              <div className="space-y-6">
                {vendorActive.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">IN PROGRESS</h3>
                    <div className="space-y-3">
                      {vendorActive.map(renderVendorMaintenanceCard)}
                    </div>
                  </div>
                )}
                {vendorUpcoming.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">UPCOMING</h3>
                    <div className="space-y-3">
                      {vendorUpcoming.map(renderVendorMaintenanceCard)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card className="bg-sidebar border-sidebar-border">
                <CardContent className="p-8 text-center">
                  <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Vendor Maintenance</h3>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="blockchain" className="mt-6">
            {chainOnlyActive.length + chainOnlyUpcoming.length > 0 ? (
              <div className="space-y-6">
                {chainOnlyActive.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">IN PROGRESS</h3>
                    <div className="space-y-3">
                      {chainOnlyActive.map(renderBlockchainMaintenanceCard)}
                    </div>
                  </div>
                )}
                {chainOnlyUpcoming.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">UPCOMING</h3>
                    <div className="space-y-3">
                      {chainOnlyUpcoming.map(renderBlockchainMaintenanceCard)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card className="bg-sidebar border-sidebar-border">
                <CardContent className="p-8 text-center">
                  <Boxes className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Blockchain Maintenance</h3>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="wallets" className="mt-6">
            {walletActive.length + walletUpcoming.length > 0 ? (
              <div className="space-y-6">
                {walletActive.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">IN PROGRESS</h3>
                    <div className="space-y-3">
                      {walletActive.map(renderBlockchainMaintenanceCard)}
                    </div>
                  </div>
                )}
                {walletUpcoming.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">UPCOMING</h3>
                    <div className="space-y-3">
                      {walletUpcoming.map(renderBlockchainMaintenanceCard)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card className="bg-sidebar border-sidebar-border">
                <CardContent className="p-8 text-center">
                  <Wallet className="w-12 h-12 text-purple-500/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Wallet Maintenance</h3>
                  <p className="text-muted-foreground text-sm mt-2">
                    Monitoring MetaMask, Trust Wallet, Ledger, Coinbase Wallet, Rainbow, Argent, Gnosis Safe, and Bybit
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="staking" className="mt-6">
            {stakingActive.length + stakingUpcoming.length > 0 ? (
              <div className="space-y-6">
                {stakingActive.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">IN PROGRESS</h3>
                    <div className="space-y-3">
                      {stakingActive.map(renderBlockchainMaintenanceCard)}
                    </div>
                  </div>
                )}
                {stakingUpcoming.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">UPCOMING</h3>
                    <div className="space-y-3">
                      {stakingUpcoming.map(renderBlockchainMaintenanceCard)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card className="bg-sidebar border-sidebar-border">
                <CardContent className="p-8 text-center">
                  <Coins className="w-12 h-12 text-amber-500/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No Staking Platform Maintenance</h3>
                  <p className="text-muted-foreground text-sm mt-2">
                    Monitoring Coinbase, Kraken, Gemini, Lido, Rocket Pool, Crypto.com, and more
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
