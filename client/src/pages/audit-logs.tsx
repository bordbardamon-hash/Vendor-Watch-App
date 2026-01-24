import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { 
  Shield, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  XCircle,
  Loader2,
  Lock,
  User,
  Activity
} from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'invite', label: 'Invite' },
  { value: 'export', label: 'Export' },
  { value: 'enable', label: 'Enable' },
  { value: 'disable', label: 'Disable' },
];

const RESOURCE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Resources' },
  { value: 'user', label: 'User' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'portal', label: 'Portal' },
  { value: 'organization', label: 'Organization' },
  { value: 'incident', label: 'Incident' },
  { value: 'settings', label: 'Settings' },
  { value: 'api_key', label: 'API Key' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'client', label: 'Client' },
  { value: 'vendor', label: 'Vendor' },
];

const actionColors: Record<string, string> = {
  login: 'bg-green-500/20 text-green-400 border-green-500/30',
  logout: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  create: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  update: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  invite: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  export: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  enable: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  disable: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return format(date, 'MMM d, yyyy h:mm:ss a');
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [userFilter, setUserFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const pageSize = 50;

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: user?.isAdmin === true,
  });

  const queryParams = new URLSearchParams();
  if (userFilter !== 'all') queryParams.set('userId', userFilter);
  if (actionFilter !== 'all') queryParams.set('action', actionFilter);
  if (resourceTypeFilter !== 'all') queryParams.set('resourceType', resourceTypeFilter);
  queryParams.set('limit', pageSize.toString());
  queryParams.set('offset', (page * pageSize).toString());

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", userFilter, actionFilter, resourceTypeFilter, page],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
    enabled: user?.isAdmin === true,
  });

  const countParams = new URLSearchParams();
  if (userFilter !== 'all') countParams.set('userId', userFilter);
  if (actionFilter !== 'all') countParams.set('action', actionFilter);
  if (resourceTypeFilter !== 'all') countParams.set('resourceType', resourceTypeFilter);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/audit-logs/count", userFilter, actionFilter, resourceTypeFilter],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs/count?${countParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch count");
      return res.json();
    },
    enabled: user?.isAdmin === true,
  });

  const totalCount = countData?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (!user?.isAdmin) {
    return (
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-400 mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to view audit logs. This feature is only available to administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Track all user actions for security and compliance
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Filter and search through user activity records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={userFilter} onValueChange={(value) => { setUserFilter(value); setPage(0); }}>
                <SelectTrigger data-testid="select-user-filter">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email} {u.firstName && u.lastName ? `(${u.firstName} ${u.lastName})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={actionFilter} onValueChange={(value) => { setActionFilter(value); setPage(0); }}>
                <SelectTrigger data-testid="select-action-filter">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={resourceTypeFilter} onValueChange={(value) => { setResourceTypeFilter(value); setPage(0); }}>
                <SelectTrigger data-testid="select-resource-filter">
                  <SelectValue placeholder="Filter by resource" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found matching your filters.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource Type</TableHead>
                      <TableHead>Resource Name</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow 
                        key={log.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLog(log)}
                        data-testid={`row-audit-log-${log.id}`}
                      >
                        <TableCell className="whitespace-nowrap">
                          {formatTimestamp(log.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.userEmail || 'System'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={actionColors[log.action] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {log.resourceType.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.resourceName || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.ipAddress || '-'}
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                              <XCircle className="w-3 h-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this activity record
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm">{formatTimestamp(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User</p>
                  <p className="text-sm">{selectedLog.userEmail || 'System'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  <Badge 
                    variant="outline" 
                    className={actionColors[selectedLog.action] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
                  >
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resource Type</p>
                  <p className="text-sm capitalize">{selectedLog.resourceType.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resource ID</p>
                  <p className="text-sm font-mono">{selectedLog.resourceId || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resource Name</p>
                  <p className="text-sm">{selectedLog.resourceName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                  <p className="text-sm font-mono">{selectedLog.ipAddress || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  {selectedLog.success ? (
                    <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Success
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                      <XCircle className="w-3 h-3 mr-1" />
                      Failed
                    </Badge>
                  )}
                </div>
              </div>
              
              {selectedLog.userAgent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User Agent</p>
                  <p className="text-sm font-mono text-xs break-all bg-muted p-2 rounded">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}
              
              {selectedLog.details && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Details</p>
                  <pre className="text-sm font-mono text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedLog.details), null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedLog.errorMessage && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Error Message</p>
                  <p className="text-sm text-red-400 bg-red-500/10 p-2 rounded">
                    {selectedLog.errorMessage}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
