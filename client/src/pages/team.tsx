import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, Eye, UserPlus, Trash2, Mail, Clock, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('member_ro');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState('');

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

  const isMasterAdmin = orgData?.userRole === 'master_admin';
  const domain = user?.email?.split('@')[1] || '';

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
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Team Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization's team members and their access levels.
        </p>
      </div>

      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {organization.name}
              </CardTitle>
              <CardDescription>
                Domain: @{organization.primaryDomain}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {organization.subscriptionTier ? organization.subscriptionTier.charAt(0).toUpperCase() + organization.subscriptionTier.slice(1) : 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input
                  type="email"
                  placeholder={`colleague@${organization.primaryDomain}`}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
              </div>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                <SelectTrigger className="w-[160px]" data-testid="select-invite-role">
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
                data-testid="button-send-invite"
              >
                <Mail className="h-4 w-4 mr-2" />
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
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
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                  data-testid={`member-row-${member.userId}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {roleIcons[member.role]}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {member.user.firstName} {member.user.lastName}
                        {member.userId === user?.id && (
                          <span className="text-muted-foreground text-sm ml-2">(You)</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{member.user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isMasterAdmin && member.userId !== user?.id ? (
                      <>
                        <Select 
                          value={member.role} 
                          onValueChange={(v) => updateRoleMutation.mutate({ memberId: member.userId, role: v as MemberRole })}
                        >
                          <SelectTrigger className="w-[140px]" data-testid={`select-role-${member.userId}`}>
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
                              className="text-destructive hover:text-destructive"
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
                      <Badge variant="outline" className={roleBadgeColors[member.role]}>
                        {roleLabels[member.role]}
                      </Badge>
                    )}
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
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-dashed border-border"
                  data-testid={`invitation-row-${invitation.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{invitation.email}</div>
                      <div className="text-sm text-muted-foreground">
                        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={roleBadgeColors[invitation.role]}>
                      {roleLabels[invitation.role]}
                    </Badge>
                    {isMasterAdmin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                        data-testid={`button-cancel-invite-${invitation.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 text-sm text-muted-foreground">
        <h3 className="font-semibold mb-2">Role Permissions</h3>
        <ul className="space-y-1">
          <li className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <strong>Master Admin:</strong> Full access - can invite/remove members, change roles, and manage all settings
          </li>
          <li className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <strong>Read/Write:</strong> Can modify settings, acknowledge incidents, and manage vendor subscriptions
          </li>
          <li className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-500" />
            <strong>Read-Only:</strong> Can view dashboards, incidents, and reports but cannot make changes
          </li>
        </ul>
      </div>
    </div>
  );
}
