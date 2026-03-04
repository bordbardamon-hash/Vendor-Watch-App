import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Users, RefreshCw, Trash2, UserPlus, Crown, Shield, Mail, Phone, Building, Clock, KeyRound, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeTierDisplay } from "@/lib/utils";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phone: string | null;
  subscriptionTier: 'essential' | 'growth' | 'enterprise' | null;
  isAdmin: boolean;
  isOwner: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string | null;
  trialEndsAt: string | null;
  billingStatus: string | null;
}

const TIER_COLORS: Record<string, string> = {
  essential: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  growth: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  enterprise: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const TIER_PRICES: Record<string, string> = {
  essential: "$89/mo",
  growth: "$129/mo",
  enterprise: "$189/mo",
};

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordUserEmail, setResetPasswordUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [extendTier, setExtendTier] = useState<string>("");
  const [promoUser, setPromoUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    companyName: "",
    tier: "essential" as 'essential' | 'growth' | 'enterprise',
    trialDays: 30,
  });
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
    subscriptionTier: "essential" as 'essential' | 'growth' | 'enterprise',
    isAdmin: false,
  });

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<User[]>;
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, subscriptionTier }: { userId: string; subscriptionTier: string | null }) => {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionTier }),
      });
      if (!res.ok) throw new Error("Failed to update subscription");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Subscription Updated",
        description: data.warning || "User subscription tier has been updated.",
        className: data.warning ? "bg-amber-500 border-amber-500 text-white" : "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Could not update subscription. Please try again.",
        variant: "destructive"
      });
    },
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const res = await fetch(`/api/admin/users/${userId}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update admin status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Admin Status Updated",
        description: "User admin status has been updated.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update admin status.",
        variant: "destructive"
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Created",
        description: "New user has been added successfully.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
      setIsAddDialogOpen(false);
      setNewUser({
        email: "",
        firstName: "",
        lastName: "",
        companyName: "",
        phone: "",
        subscriptionTier: "essential",
        isAdmin: false,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Could not create user.",
        variant: "destructive"
      });
    },
  });

  const extendTrialMutation = useMutation({
    mutationFn: async ({ userId, days, tier }: { userId: string; days: number; tier?: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/trial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, tier }),
      });
      if (!res.ok) throw new Error("Failed to extend trial");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Trial Extended", description: data.message });
      setIsExtendDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not extend trial", variant: "destructive" });
    },
  });

  const createPromoMutation = useMutation({
    mutationFn: async (data: typeof promoUser) => {
      const res = await fetch("/api/admin/users/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create promo account");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      const emailStatus = data.emailSent 
        ? " Welcome email sent!" 
        : data.emailError 
          ? ` Email failed: ${data.emailError}` 
          : " Email not sent.";
      toast({ title: "Promo Account Created", description: data.message + emailStatus });
      setIsPromoDialogOpen(false);
      setPromoUser({
        email: "",
        firstName: "",
        lastName: "",
        companyName: "",
        tier: "essential",
        trialDays: 30,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Deleted",
        description: "User has been removed from the system.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Could not delete user.",
        variant: "destructive"
      });
    },
  });

  const sendResetEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}/send-reset-email`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send reset email");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reset Email Sent",
        description: data.message || "Password reset email has been sent.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Email",
        description: error.message || "Could not send password reset email.",
        variant: "destructive"
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset password");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIsResetPasswordDialogOpen(false);
      setNewPassword("");
      toast({
        title: "Password Reset",
        description: data.message || "Password has been reset successfully.",
        className: "bg-emerald-500 border-emerald-500 text-white"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Could not reset password.",
        variant: "destructive"
      });
    },
  });

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchQuery === "" || 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.companyName && user.companyName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTier = tierFilter === "all" || 
      (tierFilter === "none" && !user.subscriptionTier) ||
      user.subscriptionTier === tierFilter;
    
    return matchesSearch && matchesTier;
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage users, subscriptions, and admin access
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <Dialog open={isPromoDialogOpen} onOpenChange={setIsPromoDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-create-promo">
                <Clock className="w-4 h-4" />
                Create Promo Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Promo Account</DialogTitle>
                <DialogDescription>
                  Create a promotional trial account with a limited-time subscription.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="promo-email">Email *</Label>
                  <Input
                    id="promo-email"
                    type="email"
                    value={promoUser.email}
                    onChange={(e) => setPromoUser({ ...promoUser, email: e.target.value })}
                    data-testid="input-promo-email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="promo-firstName">First Name</Label>
                    <Input
                      id="promo-firstName"
                      value={promoUser.firstName}
                      onChange={(e) => setPromoUser({ ...promoUser, firstName: e.target.value })}
                      data-testid="input-promo-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-lastName">Last Name</Label>
                    <Input
                      id="promo-lastName"
                      value={promoUser.lastName}
                      onChange={(e) => setPromoUser({ ...promoUser, lastName: e.target.value })}
                      data-testid="input-promo-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promo-companyName">Company Name</Label>
                  <Input
                    id="promo-companyName"
                    value={promoUser.companyName}
                    onChange={(e) => setPromoUser({ ...promoUser, companyName: e.target.value })}
                    data-testid="input-promo-company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subscription Tier</Label>
                  <Select
                    value={promoUser.tier}
                    onValueChange={(v) => setPromoUser({ ...promoUser, tier: v as 'essential' | 'growth' | 'enterprise' })}
                  >
                    <SelectTrigger data-testid="select-promo-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      <SelectItem value="essential">Essential</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promo-trialDays">Trial Days (1-365)</Label>
                  <Input
                    id="promo-trialDays"
                    type="number"
                    min={1}
                    max={365}
                    value={promoUser.trialDays}
                    onChange={(e) => setPromoUser({ ...promoUser, trialDays: Math.min(365, Math.max(1, parseInt(e.target.value) || 30)) })}
                    data-testid="input-promo-trial-days"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPromoDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createPromoMutation.mutate(promoUser)}
                  disabled={!promoUser.email || createPromoMutation.isPending}
                  data-testid="button-create-promo-submit"
                >
                  {createPromoMutation.isPending ? "Creating..." : "Create Promo Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-user">
                <UserPlus className="w-4 h-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account manually. The user will need to set their password via email verification.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={newUser.companyName}
                    onChange={(e) => setNewUser({ ...newUser, companyName: e.target.value })}
                    data-testid="input-company"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subscription Tier</Label>
                  <Select
                    value={newUser.subscriptionTier}
                    onValueChange={(v) => setNewUser({ ...newUser, subscriptionTier: v as 'essential' | 'growth' | 'enterprise' })}
                  >
                    <SelectTrigger data-testid="select-new-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      <SelectItem value="essential">Essential ($89/mo)</SelectItem>
                      <SelectItem value="growth">Growth ($129/mo)</SelectItem>
                      <SelectItem value="enterprise">Enterprise ($189/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createUserMutation.mutate(newUser)}
                  disabled={!newUser.email || !newUser.firstName || !newUser.lastName || createUserMutation.isPending}
                  data-testid="button-create-user"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => refetch()} className="gap-2" data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 sm:flex-wrap">
        <Input
          placeholder="Search by name, email, or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:max-w-sm"
          data-testid="input-search"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by tier:</span>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-tier-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="essential">Essential</SelectItem>
              <SelectItem value="growth">Growth</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
              <SelectItem value="none">No Subscription</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="text-sm self-start sm:self-auto">
          {filteredUsers.length} of {users.length} users
        </Badge>
      </div>

      <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage user accounts, subscriptions, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No users found matching your search.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-3 sm:p-4 rounded-lg border border-sidebar-border bg-sidebar/20 animate-fade-in"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-base sm:text-lg truncate max-w-[200px] sm:max-w-none">
                          {user.firstName} {user.lastName}
                        </span>
                        {user.isOwner && (
                          <Badge className="gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                            <Crown className="w-3 h-3" />
                            Owner
                          </Badge>
                        )}
                        {user.isAdmin && !user.isOwner && (
                          <Badge className="gap-1 bg-purple-500/20 text-purple-400 border-purple-500/30">
                            <Shield className="w-3 h-3" />
                            Admin
                          </Badge>
                        )}
                        {user.subscriptionTier ? (
                          <Badge className={TIER_COLORS[user.subscriptionTier] || TIER_COLORS['enterprise']}>
                            {normalizeTierDisplay(user.subscriptionTier)} {TIER_PRICES[user.subscriptionTier] || TIER_PRICES['enterprise']}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No Subscription
                          </Badge>
                        )}
                        {user.trialEndsAt && (
                          <Badge 
                            className={
                              new Date(user.trialEndsAt) > new Date() 
                                ? "gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30" 
                                : "gap-1 bg-red-500/20 text-red-400 border-red-500/30"
                            }
                            data-testid={`badge-trial-${user.id}`}
                          >
                            <Clock className="w-3 h-3" />
                            {new Date(user.trialEndsAt) > new Date() 
                              ? `Trial until ${format(new Date(user.trialEndsAt), "MMM d")}`
                              : "Trial expired"
                            }
                          </Badge>
                        )}
                        {user.billingStatus && (
                          <Badge 
                            className={
                              user.billingStatus === "active" 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : user.billingStatus === "trialing"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                            }
                            data-testid={`badge-billing-${user.id}`}
                          >
                            {user.billingStatus}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-mono text-xs truncate">{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-mono text-xs">{user.phone}</span>
                          </div>
                        )}
                        {user.companyName && (
                          <div className="flex items-center gap-2 min-w-0">
                            <Building className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{user.companyName}</span>
                          </div>
                        )}
                        <div className="text-muted-foreground text-xs">
                          Joined {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "Unknown"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                      <Select
                        value={user.subscriptionTier || "none"}
                        onValueChange={(value) => {
                          const tier = value === "none" ? null : value;
                          updateSubscriptionMutation.mutate({ userId: user.id, subscriptionTier: tier });
                        }}
                        disabled={updateSubscriptionMutation.isPending}
                      >
                        <SelectTrigger className="w-full sm:w-[140px]" data-testid={`select-tier-${user.id}`}>
                          <SelectValue placeholder="Set tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Subscription</SelectItem>
                          <SelectItem value="essential">Essential</SelectItem>
                          <SelectItem value="growth">Growth</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>

                      {!user.isOwner && (
                        <Button
                          variant={user.isAdmin ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateAdminMutation.mutate({ userId: user.id, isAdmin: !user.isAdmin })}
                          disabled={updateAdminMutation.isPending}
                          data-testid={`button-toggle-admin-${user.id}`}
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setExtendDays(30);
                          setExtendTier("");
                          setIsExtendDialogOpen(true);
                        }}
                        data-testid={`button-extend-trial-${user.id}`}
                        title="Extend trial"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendResetEmailMutation.mutate(user.id)}
                        disabled={sendResetEmailMutation.isPending}
                        data-testid={`button-send-reset-email-${user.id}`}
                        title="Send password reset email"
                      >
                        <Send className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setResetPasswordUserId(user.id);
                          setResetPasswordUserEmail(user.email);
                          setNewPassword("");
                          setIsResetPasswordDialogOpen(true);
                        }}
                        data-testid={`button-reset-password-${user.id}`}
                        title="Set new password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>

                      {!user.isOwner && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              data-testid={`button-delete-${user.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {user.firstName} {user.lastName} ({user.email})?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteUserMutation.mutate(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isExtendDialogOpen} onOpenChange={setIsExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Trial</DialogTitle>
            <DialogDescription>
              Extend the trial period for this user by a specified number of days.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extend-days">Days to Extend</Label>
              <Input
                id="extend-days"
                type="number"
                min={1}
                max={365}
                value={extendDays}
                onChange={(e) => setExtendDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 30)))}
                data-testid="input-extend-days"
              />
            </div>
            <div className="space-y-2">
              <Label>Set Tier (Optional)</Label>
              <Select
                value={extendTier}
                onValueChange={setExtendTier}
              >
                <SelectTrigger data-testid="select-extend-tier">
                  <SelectValue placeholder="Keep current tier" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="keep">Keep current tier</SelectItem>
                  <SelectItem value="essential">Essential</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedUserId) {
                  extendTrialMutation.mutate({
                    userId: selectedUserId,
                    days: extendDays,
                    tier: extendTier && extendTier !== "keep" ? extendTier : undefined,
                  });
                }
              }}
              disabled={extendTrialMutation.isPending}
              data-testid="button-extend-submit"
            >
              {extendTrialMutation.isPending ? "Extending..." : "Extend Trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set New Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordUserEmail}. The user will be able to log in with this password immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (resetPasswordUserId && newPassword.length >= 8) {
                  resetPasswordMutation.mutate({ userId: resetPasswordUserId, newPassword });
                }
              }}
              disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
              data-testid="button-reset-password-submit"
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
