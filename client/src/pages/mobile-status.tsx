import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  Server,
  Link2,
  Clock,
  Wrench,
  Loader2,
  ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

interface StatusSummary {
  vendors: {
    total: number;
    operational: number;
    degraded: number;
    outage: number;
  };
  blockchain: {
    total: number;
    operational: number;
    degraded: number;
    outage: number;
  };
  incidents: {
    active: number;
    critical: number;
    blockchainActive: number;
  };
  maintenance: {
    vendorActive: number;
    vendorUpcoming: number;
    blockchainActive: number;
    blockchainUpcoming: number;
    total: number;
  };
  lastUpdated: string;
}

interface SlaTimer {
  contractId: string;
  contractName: string;
  vendorKey: string;
  resourceType: string;
  incidentId: string;
  incidentTitle: string;
  incidentStartedAt: string;
  responseTimeMinutes: number | null;
  resolutionTimeMinutes: number | null;
  responseDeadline: string | null;
  resolutionDeadline: string | null;
  isResponseBreached: boolean;
  isResolutionBreached: boolean;
}

export default function MobileStatus() {
  const { user } = useAuth();
  const tier = user?.subscriptionTier;
  const hasAdvancedAccess = tier === 'growth' || tier === 'enterprise';

  const { data: summary, isLoading, refetch, isFetching } = useQuery<StatusSummary>({
    queryKey: ["/api/status/summary"],
    refetchInterval: 60000
  });

  const { data: slaTimers = [] } = useQuery<SlaTimer[]>({
    queryKey: ["/api/sla/timers"],
    enabled: hasAdvancedAccess,
    refetchInterval: 30000
  });

  const formatTimeRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate.getTime() - now.getTime();
    
    if (diff <= 0) return "BREACHED";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getOverallStatus = () => {
    if (!summary) return { status: 'loading', label: 'Loading...', color: 'text-muted-foreground' };
    
    const totalOutages = summary.vendors.outage + summary.blockchain.outage;
    const totalDegraded = summary.vendors.degraded + summary.blockchain.degraded;
    const criticalIncidents = summary.incidents.critical;
    
    if (totalOutages > 0 || criticalIncidents > 0) {
      return { status: 'critical', label: 'Critical Issues', color: 'text-destructive' };
    }
    if (totalDegraded > 0 || summary.incidents.active > 0) {
      return { status: 'degraded', label: 'Some Issues', color: 'text-amber-500' };
    }
    return { status: 'operational', label: 'All Systems Operational', color: 'text-green-500' };
  };

  const overallStatus = getOverallStatus();

  const breachedTimers = slaTimers.filter(t => t.isResponseBreached || t.isResolutionBreached);
  const urgentTimers = slaTimers.filter(t => {
    if (t.isResponseBreached || t.isResolutionBreached) return false;
    const responseRemaining = t.responseDeadline ? formatTimeRemaining(t.responseDeadline) : null;
    const resolutionRemaining = t.resolutionDeadline ? formatTimeRemaining(t.resolutionDeadline) : null;
    return responseRemaining?.includes('m') || resolutionRemaining?.includes('m');
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20 max-w-lg mx-auto" data-testid="page-mobile-status">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">System Status</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-status"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className={`mb-6 border-2 ${
        overallStatus.status === 'critical' ? 'border-destructive bg-destructive/5' :
        overallStatus.status === 'degraded' ? 'border-amber-500 bg-amber-500/5' :
        'border-green-500 bg-green-500/5'
      }`}>
        <CardContent className="p-6 text-center">
          {overallStatus.status === 'critical' && <XCircle className="w-12 h-12 mx-auto mb-2 text-destructive" />}
          {overallStatus.status === 'degraded' && <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-amber-500" />}
          {overallStatus.status === 'operational' && <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />}
          <h2 className={`text-lg font-semibold ${overallStatus.color}`} data-testid="text-overall-status">
            {overallStatus.label}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: {summary?.lastUpdated ? new Date(summary.lastUpdated).toLocaleTimeString() : 'N/A'}
          </p>
        </CardContent>
      </Card>

      {breachedTimers.length > 0 && (
        <Card className="mb-4 border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-destructive" />
              <span className="font-semibold text-destructive">SLA Breached ({breachedTimers.length})</span>
            </div>
            {breachedTimers.map(timer => (
              <div key={timer.incidentId} className="text-sm py-2 border-t" data-testid={`timer-breached-${timer.incidentId}`}>
                <div className="font-medium">{timer.contractName}</div>
                <div className="text-muted-foreground text-xs">{timer.incidentTitle}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {urgentTimers.length > 0 && (
        <Card className="mb-4 border-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-500">SLA Urgent ({urgentTimers.length})</span>
            </div>
            {urgentTimers.map(timer => (
              <div key={timer.incidentId} className="text-sm py-2 border-t flex justify-between items-center" data-testid={`timer-urgent-${timer.incidentId}`}>
                <div>
                  <div className="font-medium">{timer.contractName}</div>
                  <div className="text-muted-foreground text-xs">{timer.incidentTitle}</div>
                </div>
                <Badge variant="secondary" className="text-amber-600">
                  {formatTimeRemaining(timer.resolutionDeadline || timer.responseDeadline)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/vendors">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" data-testid="card-vendors-summary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Server className="w-5 h-5 text-muted-foreground" />
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold" data-testid="text-vendors-total">
                {summary?.vendors.total || 0}
              </div>
              <div className="text-xs text-muted-foreground">Vendors</div>
              <div className="flex gap-2 mt-2">
                {(summary?.vendors.outage || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs" data-testid="badge-vendors-outage">
                    {summary?.vendors.outage} down
                  </Badge>
                )}
                {(summary?.vendors.degraded || 0) > 0 && (
                  <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600" data-testid="badge-vendors-degraded">
                    {summary?.vendors.degraded} degraded
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/blockchain">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" data-testid="card-blockchain-summary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Link2 className="w-5 h-5 text-muted-foreground" />
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold" data-testid="text-blockchain-total">
                {summary?.blockchain.total || 0}
              </div>
              <div className="text-xs text-muted-foreground">Blockchain</div>
              <div className="flex gap-2 mt-2">
                {(summary?.blockchain.outage || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs" data-testid="badge-blockchain-outage">
                    {summary?.blockchain.outage} down
                  </Badge>
                )}
                {(summary?.blockchain.degraded || 0) > 0 && (
                  <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600" data-testid="badge-blockchain-degraded">
                    {summary?.blockchain.degraded} degraded
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card data-testid="card-incidents-summary">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold" data-testid="text-incidents-active">
              {(summary?.incidents.active || 0) + (summary?.incidents.blockchainActive || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Active Incidents</div>
            {(summary?.incidents.critical || 0) > 0 && (
              <Badge variant="destructive" className="text-xs mt-2" data-testid="badge-incidents-critical">
                {summary?.incidents.critical} critical
              </Badge>
            )}
          </CardContent>
        </Card>

        <Link href="/maintenance">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" data-testid="card-maintenance-summary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Wrench className="w-5 h-5 text-muted-foreground" />
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold" data-testid="text-maintenance-total">
                {summary?.maintenance.total || 0}
              </div>
              <div className="text-xs text-muted-foreground">Maintenance</div>
              <div className="flex gap-2 mt-2">
                {((summary?.maintenance.vendorActive || 0) + (summary?.maintenance.blockchainActive || 0)) > 0 && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-maintenance-active">
                    {(summary?.maintenance.vendorActive || 0) + (summary?.maintenance.blockchainActive || 0)} active
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="space-y-2">
        <Link href="/dashboard">
          <Button variant="outline" className="w-full justify-between" data-testid="button-goto-dashboard">
            Full Dashboard
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
        {hasAdvancedAccess && (
          <>
            <Link href="/sla">
              <Button variant="outline" className="w-full justify-between" data-testid="button-goto-sla">
                SLA Management
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/clients">
              <Button variant="outline" className="w-full justify-between" data-testid="button-goto-clients">
                Client Management
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/playbooks">
              <Button variant="outline" className="w-full justify-between" data-testid="button-goto-playbooks">
                Incident Playbooks
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
