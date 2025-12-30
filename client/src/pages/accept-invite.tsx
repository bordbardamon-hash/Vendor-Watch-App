import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Check, X, Crown, Shield, Eye, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";

type MemberRole = 'master_admin' | 'member_rw' | 'member_ro';

interface InvitationData {
  invitation: {
    email: string;
    role: MemberRole;
    organizationName: string;
  };
}

const roleLabels: Record<MemberRole, string> = {
  master_admin: 'Master Admin',
  member_rw: 'Read/Write Member',
  member_ro: 'Read-Only Member',
};

const roleIcons: Record<MemberRole, React.ReactNode> = {
  master_admin: <Crown className="h-5 w-5 text-amber-500" />,
  member_rw: <Shield className="h-5 w-5 text-blue-500" />,
  member_ro: <Eye className="h-5 w-5 text-slate-500" />,
};

const roleDescriptions: Record<MemberRole, string> = {
  master_admin: 'Full access to manage the organization, invite members, and configure all settings.',
  member_rw: 'Can modify settings, acknowledge incidents, and manage subscriptions.',
  member_ro: 'Can view dashboards and reports but cannot make changes.',
};

export default function AcceptInvite() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/accept-invite/:token");
  const token = params?.token;

  const { data, isLoading, error } = useQuery<InvitationData>({
    queryKey: ["/api/org/invitations/accept", token],
    queryFn: async () => {
      const res = await fetch(`/api/org/invitations/accept/${token}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch invitation");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/org/invitations/accept/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to accept invitation");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome to the Team!",
        description: "You've successfully joined the organization.",
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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Invalid invitation link
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <X className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Invitation Invalid</CardTitle>
            <CardDescription>
              {(error as Error)?.message || "This invitation is no longer valid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setLocation("/login")}
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invitation = data.invitation;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Join {invitation.organizationName}</CardTitle>
            <CardDescription>
              You've been invited to join as a {roleLabels[invitation.role]}.
              Please sign in with your {invitation.email} account to accept.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full"
              onClick={() => setLocation(`/login?redirect=/accept-invite/${token}`)}
              data-testid="button-sign-in-to-accept"
            >
              Sign In to Accept
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <a 
                href={`/register?email=${encodeURIComponent(invitation.email)}`}
                className="text-primary hover:underline"
              >
                Create one
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Join {invitation.organizationName}</CardTitle>
          <CardDescription>
            You've been invited to join this organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center gap-3 mb-2">
              {roleIcons[invitation.role]}
              <span className="font-semibold">{roleLabels[invitation.role]}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {roleDescriptions[invitation.role]}
            </p>
          </div>

          <div className="text-sm text-muted-foreground text-center">
            Signed in as <strong>{user.email}</strong>
            {user.email?.toLowerCase() !== invitation.email.toLowerCase() && (
              <p className="text-destructive mt-1">
                This invitation was sent to {invitation.email}. Please sign in with that email.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-decline-invite"
            >
              Decline
            </Button>
            <Button 
              className="flex-1"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending || user.email?.toLowerCase() !== invitation.email.toLowerCase()}
              data-testid="button-accept-invite"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Accept Invitation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
