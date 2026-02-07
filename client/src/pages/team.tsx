import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, Eye, UserPlus, Trash2, Mail, Clock, Building2, Pencil, Settings, Plus, Minus, Armchair, Bell, Search, X, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { normalizeTierDisplay } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type MemberRole = 'master_admin' | 'member_rw' | 'member_ro';

interface Member {
  id: string;
  userId: string;
  role: MemberRole;
  invitedAt: string;
  acceptedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: MemberRole;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
  primaryDomain: string;
  subscriptionTier: string;
  maxMasterAdmins: number;
}

interface OrgData {
  organization: Organization | null;
  userRole: MemberRole | null;
  masterAdminCount: number;
  maxMasterAdmins: number;
}

interface SeatData {
  includedSeats: number;
  additionalSeats: number;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
  seatPrice: number;
  supportsSeats: boolean;
  subscriptionTier: string | null;
}

interface AlertAssignment {
  id: string;
  organizationId: string;
  memberUserId: string;
  targetType: 'vendor' | 'blockchain';
  targetKey: string;
  assignedBy: string;
  createdAt: string;
}

interface VendorItem {
  key: string;
  name: string;
  status: string;
}

interface BlockchainItem {
  key: string;
  name: string;
  status: string;
}

interface MembersData {
  members: Member[];
  invitations: Invitation[];
  userRole: MemberRole;
}

const roleLabels: Record<MemberRole, string> = {
  master_admin: 'Master Admin',
  member_rw: 'Read/Write',
  member_ro: 'Read-Only',
};

const roleIcons: Record<MemberRole, React.ReactNode> = {
  master_admin: <Crown className="h-4 w-4 text-amber-500" />,
  member_rw: <Shield className="h-4 w-4 text-blue-500" />,
  member_ro: <Eye className="h-4 w-4 text-slate-500" />,
};

const roleBadgeColors: Record<MemberRole, string> = {
  master_admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  member_rw: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  member_ro: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export default function Team() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('member_ro');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [editOrgName, setEditOrgName] = useState('');
  const [showSeatConfirmation, setShowSeatConfirmation] = useState(false);

  const { data: orgData, isLoading: orgLoading } = useQuery<OrgData>({
    queryKey: ["/api/org"],
    queryFn: async () => {
      const res = await fetch("/api/org");
      if (!res.ok) throw new Error("Failed to fetch organization");
      return res.json();
    },
  });

  const { data: membersData, isLoading: membersLoading } = useQuery<MembersData>({
    queryKey: ["/api/org/members"],
    queryFn: async () => {
      const res = await fetch("/api/org/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!orgData?.organization,
  });

  const { data: seatData } = useQuery<SeatData>({
    queryKey: ["/api/org/seats"],
    queryFn: async () => {
      const res = await fetch("/api/org/seats");
      if (!res.ok) throw new Error("Failed to fetch seats");
      return res.json();
    },
    enabled: !!orgData?.organization,
  });

  const [pendingSeats, setPendingSeats] = useState<number | null>(null);
  
  const updateSeatsMutation = useMutation({
    mutationFn: async (additionalSeats: number) => {
      const res = await fetch("/api/org/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalSeats }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update seats");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/seats"] });
      setPendingSeats(null);
      toast({
        title: "Seats Updated",
        description: "Your seat count has been updated successfully.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create organization");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org"] });
      toast({
        title: "Organization Created",
        description: "Your organization has been set up successfully.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
      setIsCreatingOrg(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: MemberRole }) => {
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({
        title: "Invitation Sent",
        description: "The team member has been invited via email.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
      setInviteEmail('');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: MemberRole }) => {
      const res = await fetch(`/api/org/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({
        title: "Role Updated",
        description: "Team member's role has been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/org/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({
        title: "Member Removed",
        description: "Team member has been removed from the organization.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(`/api/org/invitations/${invitationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update organization");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org"] });
      toast({
        title: "Organization Updated",
        description: "Organization name has been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
      setIsEditingOrg(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/org", {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete organization");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
      toast({
        title: "Organization Deleted",
        description: "Your organization has been deleted.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const isMasterAdmin = orgData?.userRole === 'master_admin';
  const domain = user?.email?.split('@')[1] || '';

  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedMemberForAssignment, setSelectedMemberForAssignment] = useState<Member | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentTab, setAssignmentTab] = useState<'vendor' | 'blockchain'>('vendor');

  const { data: alertAssignments = [] } = useQuery<AlertAssignment[]>({
    queryKey: ["/api/org/alert-assignments"],
    queryFn: async () => {
      const res = await fetch("/api/org/alert-assignments");
      if (!res.ok) throw new Error("Failed to fetch alert assignments");
      const data = await res.json();
      return data.assignments;
    },
    enabled: !!orgData?.organization && isMasterAdmin,
  });

  const { data: vendors = [] } = useQuery<VendorItem[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const res = await fetch("/api/vendors");
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
    enabled: !!orgData?.organization && isMasterAdmin,
  });

  const { data: blockchains = [] } = useQuery<BlockchainItem[]>({
    queryKey: ["blockchain-chains-team"],
    queryFn: async () => {
      const res = await fetch("/api/blockchain/chains");
      if (!res.ok) throw new Error("Failed to fetch chains");
      return res.json();
    },
    enabled: !!orgData?.organization && isMasterAdmin,
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ memberUserId, assignments }: { memberUserId: string; assignments: { targetType: 'vendor' | 'blockchain'; targetKey: string }[] }) => {
      const res = await fetch("/api/org/alert-assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId, assignments }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save assignments");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/alert-assignments"] });
      toast({ title: "Alert Assignments Saved", description: "Vendor alert routing has been updated.", className: "bg-emerald-500 border-emerald-500 text-white" });
      setAssignmentDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/org/alert-assignments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove assignment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org/alert-assignments"] });
    },
  });

  const getMemberAssignments = (userId: string) => alertAssignments.filter(a => a.memberUserId === userId);
  const getTargetName = (targetType: string, targetKey: string) => {
    if (targetType === 'vendor') {
      return vendors.find(v => v.key === targetKey)?.name || targetKey;
    }
    return blockchains.find(b => b.key === targetKey)?.name || targetKey;
  };

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!orgData?.organization) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        <Card className="bg-card border-border">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Set Up Your Organization</CardTitle>
            <CardDescription>
              Create an organization to invite team members and manage access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isCreatingOrg ? (
              <Button 
                onClick={() => setIsCreatingOrg(true)} 
                className="w-full"
                data-testid="button-create-org"
              >
                <Users className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    placeholder={user?.companyName || "Your Company Name"}
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    data-testid="input-org-name"
                  />
                  <p className="text-sm text-muted-foreground">
                    Only users with @{domain} emails can join this organization.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreatingOrg(false)}
                    data-testid="button-cancel-create-org"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createOrgMutation.mutate(orgName || user?.companyName || '')}
                    disabled={createOrgMutation.isPending}
                    data-testid="button-confirm-create-org"
                  >
                    {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const organization = orgData.organization;

  return (
    <div className="container mx-auto py-6 md:py-8 px-3 md:px-4 max-w-4xl">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
          <Users className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          Team Management
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Manage your organization's team members and their access levels.
        </p>
      </div>

      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Building2 className="h-5 w-5 shrink-0" />
                <span className="truncate">{organization.name}</span>
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Domain: @{organization.primaryDomain}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs md:text-sm">
                {normalizeTierDisplay(organization.subscriptionTier)}
              </Badge>
              {isMasterAdmin && (
                <div className="flex items-center gap-1">
                  <Dialog open={isEditingOrg} onOpenChange={setIsEditingOrg}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setEditOrgName(organization.name)}
                        data-testid="button-edit-org"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Organization</DialogTitle>
                        <DialogDescription>
                          Update your organization's name.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-org-name">Organization Name</Label>
                          <Input
                            id="edit-org-name"
                            value={editOrgName}
                            onChange={(e) => setEditOrgName(e.target.value)}
                            placeholder="Enter organization name"
                            data-testid="input-edit-org-name"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingOrg(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => updateOrgMutation.mutate(editOrgName)}
                          disabled={!editOrgName.trim() || updateOrgMutation.isPending}
                          data-testid="button-save-org"
                        >
                          {updateOrgMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        data-testid="button-delete-org"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the organization 
                          "{organization.name}" and remove all team members' access. 
                          All pending invitations will also be cancelled.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => deleteOrgMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirm-delete-org"
                        >
                          {deleteOrgMutation.isPending ? "Deleting..." : "Delete Organization"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <span>{orgData.masterAdminCount} / {orgData.maxMasterAdmins} Master Admins</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{membersData?.members?.length || 0} Team Members</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {seatData?.supportsSeats && isMasterAdmin && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Armchair className="h-5 w-5" />
              Seat Management
            </CardTitle>
            <CardDescription>
              Your {normalizeTierDisplay(seatData.subscriptionTier)} plan includes {seatData.includedSeats} seat{seatData.includedSeats > 1 ? 's' : ''}. 
              Additional seats are ${seatData.seatPrice}/month each.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <div className="text-2xl font-bold text-foreground">{seatData.includedSeats}</div>
                  <div className="text-xs text-muted-foreground">Included</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <div className="text-2xl font-bold text-primary">{seatData.additionalSeats}</div>
                  <div className="text-xs text-muted-foreground">Additional</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <div className="text-2xl font-bold text-foreground">{seatData.totalSeats}</div>
                  <div className="text-xs text-muted-foreground">Total Seats</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <div className="text-2xl font-bold text-emerald-500">{seatData.usedSeats}</div>
                  <div className="text-xs text-muted-foreground">In Use</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
                <div>
                  <div className="font-medium">Additional Seats</div>
                  <div className="text-sm text-muted-foreground">
                    {seatData.additionalSeats > 0 ? 
                      `$${seatData.additionalSeats * seatData.seatPrice}/month` : 
                      'No additional seats'
                    }
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={
                      updateSeatsMutation.isPending || 
                      (pendingSeats ?? seatData.additionalSeats) <= 0 ||
                      (seatData.includedSeats + (pendingSeats ?? seatData.additionalSeats) - 1) < seatData.usedSeats
                    }
                    onClick={() => setPendingSeats(prev => Math.max(0, (prev ?? seatData.additionalSeats) - 1))}
                    data-testid="button-decrease-seats"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-bold w-12 text-center" data-testid="text-additional-seats">
                    {pendingSeats ?? seatData.additionalSeats}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={updateSeatsMutation.isPending}
                    onClick={() => setPendingSeats(prev => (prev ?? seatData.additionalSeats) + 1)}
                    data-testid="button-increase-seats"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {pendingSeats !== null && pendingSeats !== seatData.additionalSeats && (
                    <AlertDialog open={showSeatConfirmation} onOpenChange={setShowSeatConfirmation}>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={updateSeatsMutation.isPending}
                          className="ml-2"
                          data-testid="button-save-seats"
                        >
                          {updateSeatsMutation.isPending ? "Updating..." : "Review Changes"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <Armchair className="h-5 w-5" />
                            Confirm Seat Change
                          </AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-4 pt-2">
                              <div className="font-medium text-foreground text-base">
                                {pendingSeats > seatData.additionalSeats ? (
                                  <span>You are adding {pendingSeats - seatData.additionalSeats} additional seat{pendingSeats - seatData.additionalSeats > 1 ? 's' : ''}</span>
                                ) : (
                                  <span>You are removing {seatData.additionalSeats - pendingSeats} seat{seatData.additionalSeats - pendingSeats > 1 ? 's' : ''}</span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                                  <div className="text-muted-foreground text-xs mb-1">Current</div>
                                  <div className="font-bold text-lg">{seatData.additionalSeats} seats</div>
                                  <div className="text-sm text-muted-foreground">${seatData.additionalSeats * seatData.seatPrice}/month</div>
                                </div>
                                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                                  <div className="text-muted-foreground text-xs mb-1">New</div>
                                  <div className="font-bold text-lg">{pendingSeats} seats</div>
                                  <div className="text-sm text-muted-foreground">${pendingSeats * seatData.seatPrice}/month</div>
                                </div>
                              </div>
                              
                              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                {pendingSeats > seatData.additionalSeats ? (
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span>Monthly increase:</span>
                                      <span className="font-semibold text-emerald-400">+${(pendingSeats - seatData.additionalSeats) * seatData.seatPrice}/month</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Your card on file will be charged a prorated amount immediately for the remaining days in this billing period.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span>Monthly savings:</span>
                                      <span className="font-semibold text-amber-400">-${(seatData.additionalSeats - pendingSeats) * seatData.seatPrice}/month</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      You will receive a prorated credit for unused time on the removed seats.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4">
                          <AlertDialogCancel data-testid="button-cancel-seats">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              updateSeatsMutation.mutate(pendingSeats);
                              setShowSeatConfirmation(false);
                            }}
                            disabled={updateSeatsMutation.isPending}
                            className="bg-primary hover:bg-primary/90"
                            data-testid="button-confirm-seats"
                          >
                            {updateSeatsMutation.isPending ? "Processing..." : pendingSeats > seatData.additionalSeats ? "Confirm & Pay" : "Confirm Change"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>

              {pendingSeats !== null && pendingSeats !== seatData.additionalSeats && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 space-y-3">
                  <div className="font-medium text-foreground">
                    {pendingSeats > seatData.additionalSeats ? (
                      <span className="text-emerald-400">Adding {pendingSeats - seatData.additionalSeats} seat{pendingSeats - seatData.additionalSeats > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-amber-400">Removing {seatData.additionalSeats - pendingSeats} seat{seatData.additionalSeats - pendingSeats > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 rounded bg-muted/50">
                      <div className="text-muted-foreground text-xs">Current Seats Cost</div>
                      <div className="font-semibold">${seatData.additionalSeats * seatData.seatPrice}/month</div>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <div className="text-muted-foreground text-xs">New Seats Cost</div>
                      <div className="font-semibold">${pendingSeats * seatData.seatPrice}/month</div>
                    </div>
                  </div>
                  
                  <div className="text-sm space-y-1 pt-2 border-t border-border/50">
                    {pendingSeats > seatData.additionalSeats ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly increase:</span>
                          <span className="text-emerald-400 font-medium">+${(pendingSeats - seatData.additionalSeats) * seatData.seatPrice}/month</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Today's prorated charge:</span>
                          <span className="text-foreground">~Calculated by Stripe</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          You'll be charged a prorated amount for the remaining days in this billing period, 
                          then the full amount starting next month.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly savings:</span>
                          <span className="text-amber-400 font-medium">-${(seatData.additionalSeats - pendingSeats) * seatData.seatPrice}/month</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          You'll receive a prorated credit for unused time on the removed seats.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isMasterAdmin && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </CardTitle>
            <CardDescription>
              Invite colleagues with @{organization.primaryDomain} email addresses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-0 md:flex md:gap-3 md:flex-wrap">
              <div className="flex-1 min-w-0 md:min-w-[200px]">
                <Input
                  type="email"
                  placeholder={`colleague@${organization.primaryDomain}`}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
              </div>
              <div className="flex gap-2">
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                  <SelectTrigger className="w-[130px] md:w-[160px]" data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member_ro">Read-Only</SelectItem>
                    <SelectItem value="member_rw">Read/Write</SelectItem>
                    <SelectItem 
                      value="master_admin" 
                      disabled={orgData.masterAdminCount >= orgData.maxMasterAdmins}
                    >
                      Master Admin
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
                  disabled={!inviteEmail || inviteMutation.isPending}
                  className="flex-1 md:flex-initial"
                  data-testid="button-send-invite"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {inviteMutation.isPending ? "Sending..." : "Invite"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-muted-foreground">Loading members...</div>
          ) : (
            <div className="space-y-3">
              {membersData?.members?.map((member) => (
                <div 
                  key={member.id} 
                  className="p-3 rounded-lg bg-muted/50 border border-border"
                  data-testid={`member-row-${member.userId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {roleIcons[member.role]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-sm md:text-base truncate">
                          {member.user.firstName} {member.user.lastName}
                          {member.userId === user?.id && (
                            <span className="text-muted-foreground text-xs md:text-sm ml-1">(You)</span>
                          )}
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground truncate">{member.user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isMasterAdmin && member.userId !== user?.id ? (
                        <>
                          <Select 
                            value={member.role} 
                            onValueChange={(v) => updateRoleMutation.mutate({ memberId: member.userId, role: v as MemberRole })}
                          >
                            <SelectTrigger className="w-[110px] md:w-[140px] text-xs md:text-sm" data-testid={`select-role-${member.userId}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member_ro">Read-Only</SelectItem>
                              <SelectItem value="member_rw">Read/Write</SelectItem>
                              <SelectItem 
                                value="master_admin"
                                disabled={member.role !== 'master_admin' && orgData.masterAdminCount >= orgData.maxMasterAdmins}
                              >
                                Master Admin
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive h-8 w-8"
                                data-testid={`button-remove-${member.userId}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {member.user.firstName} {member.user.lastName} from the organization. 
                                  They will lose access to all shared resources.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => removeMemberMutation.mutate(member.userId)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <Badge variant="outline" className={`text-xs ${roleBadgeColors[member.role]}`}>
                          {roleLabels[member.role]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {membersData?.invitations && membersData.invitations.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {membersData.invitations.map((invitation) => (
                <div 
                  key={invitation.id} 
                  className="p-3 rounded-lg bg-muted/30 border border-dashed border-border"
                  data-testid={`invitation-row-${invitation.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-sm md:text-base truncate">{invitation.email}</div>
                        <div className="text-xs md:text-sm text-muted-foreground">
                          Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${roleBadgeColors[invitation.role]}`}>
                        {roleLabels[invitation.role]}
                      </Badge>
                      {isMasterAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                          onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                          data-testid={`button-cancel-invite-${invitation.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isMasterAdmin && orgData?.organization && (
        <Card className="bg-card border-border" data-testid="card-alert-assignments">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" />
              Alert Assignments
            </CardTitle>
            <CardDescription>
              Assign specific vendors or blockchains to team members. When assigned, only those members receive alerts for the assigned services - perfect for delegation and vacation coverage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membersData?.members && membersData.members.length > 0 ? (
              <div className="space-y-3">
                {membersData.members.map((member) => {
                  const memberAssigns = getMemberAssignments(member.userId);
                  return (
                    <div 
                      key={member.userId} 
                      className="p-3 md:p-4 rounded-lg bg-muted/30 border border-border"
                      data-testid={`assignment-member-${member.userId}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs md:text-sm font-bold shrink-0">
                            {member.user.firstName?.[0]}{member.user.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground text-sm md:text-base truncate">
                              {member.user.firstName} {member.user.lastName}
                            </div>
                            <div className="text-muted-foreground text-xs truncate">{member.user.email}</div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs md:text-sm h-8"
                          onClick={() => {
                            setSelectedMemberForAssignment(member);
                            setAssignmentSearch('');
                            setAssignmentTab('vendor');
                            setAssignmentDialogOpen(true);
                          }}
                          data-testid={`button-manage-assignments-${member.userId}`}
                        >
                          <Settings className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
                          Manage
                        </Button>
                      </div>
                      {memberAssigns.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {memberAssigns.map(a => (
                            <Badge 
                              key={a.id} 
                              variant="outline" 
                              className={a.targetType === 'vendor' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-purple-500/10 text-purple-400 border-purple-500/30'}
                              data-testid={`badge-assignment-${a.id}`}
                            >
                              {getTargetName(a.targetType, a.targetKey)}
                              <button
                                onClick={() => deleteAssignmentMutation.mutate(a.id)}
                                className="ml-1 hover:text-destructive"
                                data-testid={`button-remove-assignment-${a.id}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">No assignments - receives alerts for all subscribed services</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Add team members first to manage alert assignments.</p>
            )}
          </CardContent>
        </Card>
      )}

      <AlertAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        member={selectedMemberForAssignment}
        alertAssignments={alertAssignments}
        vendors={vendors}
        blockchains={blockchains}
        assignmentTab={assignmentTab}
        onTabChange={setAssignmentTab}
        search={assignmentSearch}
        onSearchChange={setAssignmentSearch}
        onSave={(assignments) => {
          if (selectedMemberForAssignment) {
            bulkAssignMutation.mutate({ memberUserId: selectedMemberForAssignment.userId, assignments });
          }
        }}
        isSaving={bulkAssignMutation.isPending}
      />

      <div className="mt-6 md:mt-8 mb-6 text-xs md:text-sm text-muted-foreground">
        <h3 className="font-semibold mb-2">Role Permissions</h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <Crown className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div><strong>Master Admin:</strong> Full access - can invite/remove members, change roles, and manage all settings</div>
          </li>
          <li className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div><strong>Read/Write:</strong> Can modify settings, acknowledge incidents, and manage vendor subscriptions</div>
          </li>
          <li className="flex items-start gap-2">
            <Eye className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div><strong>Read-Only:</strong> Can view dashboards, incidents, and reports but cannot make changes</div>
          </li>
        </ul>
      </div>
    </div>
  );
}

function AlertAssignmentDialog({
  open,
  onOpenChange,
  member,
  alertAssignments,
  vendors,
  blockchains,
  assignmentTab,
  onTabChange,
  search,
  onSearchChange,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  alertAssignments: AlertAssignment[];
  vendors: VendorItem[];
  blockchains: BlockchainItem[];
  assignmentTab: 'vendor' | 'blockchain';
  onTabChange: (tab: 'vendor' | 'blockchain') => void;
  search: string;
  onSearchChange: (s: string) => void;
  onSave: (assignments: { targetType: 'vendor' | 'blockchain'; targetKey: string }[]) => void;
  isSaving: boolean;
}) {
  const existingAssignments = member ? alertAssignments.filter(a => a.memberUserId === member.userId) : [];
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const initializeSelections = () => {
    const keys = new Set<string>();
    existingAssignments.forEach(a => keys.add(`${a.targetType}:${a.targetKey}`));
    setSelectedKeys(keys);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) initializeSelections();
    onOpenChange(isOpen);
  };

  const toggleKey = (type: 'vendor' | 'blockchain', key: string) => {
    const compositeKey = `${type}:${key}`;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(compositeKey)) {
        next.delete(compositeKey);
      } else {
        next.add(compositeKey);
      }
      return next;
    });
  };

  const handleSave = () => {
    const assignments = Array.from(selectedKeys).map(ck => {
      const [targetType, targetKey] = ck.split(':') as ['vendor' | 'blockchain', string];
      return { targetType, targetKey };
    });
    onSave(assignments);
  };

  const items = assignmentTab === 'vendor' ? vendors : blockchains;
  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.key.toLowerCase().includes(search.toLowerCase())
  );

  const vendorCount = Array.from(selectedKeys).filter(k => k.startsWith('vendor:')).length;
  const blockchainCount = Array.from(selectedKeys).filter(k => k.startsWith('blockchain:')).length;

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[80vh] flex flex-col" data-testid="dialog-alert-assignments">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            Alert Assignments for {member.user.firstName} {member.user.lastName}
          </DialogTitle>
          <DialogDescription>
            Select which vendors and blockchains this member should receive alerts for. 
            If no assignments are set, they receive alerts for all their subscriptions.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-2 mb-3">
          <Button
            variant={assignmentTab === 'vendor' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onTabChange('vendor')}
            data-testid="tab-vendors"
          >
            Vendors {vendorCount > 0 && <Badge className="ml-1 bg-blue-500/20 text-blue-400">{vendorCount}</Badge>}
          </Button>
          <Button
            variant={assignmentTab === 'blockchain' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onTabChange('blockchain')}
            data-testid="tab-blockchains"
          >
            Blockchains {blockchainCount > 0 && <Badge className="ml-1 bg-purple-500/20 text-purple-400">{blockchainCount}</Badge>}
          </Button>
        </div>
        
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${assignmentTab === 'vendor' ? 'vendors' : 'blockchains'}...`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search-assignments"
          />
        </div>

        <div className="flex gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={() => {
            const allKeys = new Set(selectedKeys);
            filtered.forEach(item => allKeys.add(`${assignmentTab}:${item.key}`));
            setSelectedKeys(allKeys);
          }} data-testid="button-select-all-assignments">Select All</Button>
          <Button variant="ghost" size="sm" onClick={() => {
            const newKeys = new Set(selectedKeys);
            filtered.forEach(item => newKeys.delete(`${assignmentTab}:${item.key}`));
            setSelectedKeys(newKeys);
          }} data-testid="button-clear-all-assignments">Clear All</Button>
        </div>
        
        <div className="overflow-y-auto flex-1 max-h-[300px] border rounded-lg divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">No results found</div>
          ) : (
            filtered.map(item => {
              const isSelected = selectedKeys.has(`${assignmentTab}:${item.key}`);
              return (
                <button
                  key={item.key}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                  onClick={() => toggleKey(assignmentTab, item.key)}
                  data-testid={`assignment-item-${item.key}`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm font-medium flex-1">{item.name}</span>
                </button>
              );
            })
          )}
        </div>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-assignments">Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-assignments">
            {isSaving ? 'Saving...' : `Save (${vendorCount + blockchainCount} assigned)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
