import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";
import Vendors from "@/pages/vendors";
import Incidents from "@/pages/incidents";
import Blockchain from "@/pages/blockchain";
import Consents from "@/pages/consents";
import FeedbackAdmin from "@/pages/feedback";
import Maintenance from "@/pages/maintenance";
import Analytics from "@/pages/analytics";
import SLA from "@/pages/sla";
import Automation from "@/pages/automation";
import ParserHealth from "@/pages/parser-health";
import UsersAdmin from "@/pages/users";
import Clients from "@/pages/clients";
import Playbooks from "@/pages/playbooks";
import PlaybookCreate from "@/pages/playbook-create";
import MobileStatus from "@/pages/mobile-status";
import Integrations from "@/pages/integrations";
import Signup from "@/pages/signup";
import SignupSuccess from "@/pages/signup-success";
import Verify2FA from "@/pages/verify-2fa";
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import SmsConsent from "@/pages/sms-consent";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Pricing from "@/pages/pricing";
import Team from "@/pages/team";
import AcceptInvite from "@/pages/accept-invite";
import Portals from "@/pages/portals";
import PsaIntegrations from "@/pages/psa-integrations";
import Predictions from "@/pages/predictions";
import PublicPortal from "@/pages/public-portal";
import Webhooks from "@/pages/webhooks";
import ApiKeysPage from "@/pages/api-keys";
import AuditLogsPage from "@/pages/audit-logs";
import Reports from "@/pages/reports";
import SsoPage from "@/pages/sso";
import Monitoring from "@/pages/monitoring";
import VendorReliability from "@/pages/vendor-reliability";
import WarRoom from "@/pages/war-room";
import WarRooms from "@/pages/war-rooms";
import OutagesPage from "@/pages/outages";
import OutagePostPage from "@/pages/outage-post";
import BlogAdminPage from "@/pages/blog-admin";
import Onboarding from "@/pages/onboarding";
import BillingSuccess from "@/pages/billing-success";
import DependencyMap from "@/pages/dependency-map";
import Web3Health from "@/pages/web3-health";
import Web3HealthWidget from "@/pages/web3-health-widget";
import AlertRules from "@/pages/alert-rules";
import TwitterBot from "@/pages/twitter-bot";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

function AuthenticatedRouter() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  
  const { data: twoFASession, isLoading: checking2FA } = useQuery<{ requires2FA: boolean; verified: boolean }>({
    queryKey: ["/api/2fa/session-status"],
    queryFn: async () => {
      const res = await fetch("/api/2fa/session-status");
      if (!res.ok) return { requires2FA: false, verified: true };
      return res.json();
    },
  });

  useEffect(() => {
    if (!checking2FA && twoFASession?.requires2FA && !twoFASession?.verified) {
      if (location !== "/verify-2fa") {
        setLocation("/verify-2fa");
      }
    }
  }, [checking2FA, twoFASession, location, setLocation]);

  // Check if user needs onboarding - this is computed by the server
  // Check profileCompleted and billingCompleted directly as backup
  const needsOnboarding = user?.needsOnboarding === true || 
    (user && (user.profileCompleted === false || user.billingCompleted === false));

  useEffect(() => {
    const isOnboardingRoute = location === "/onboarding" || location.startsWith("/onboarding/");
    
    if (needsOnboarding && !isOnboardingRoute) {
      console.log('[routing] Redirecting to onboarding:', { 
        needsOnboarding, 
        profileCompleted: user?.profileCompleted, 
        billingCompleted: user?.billingCompleted 
      });
      setLocation("/onboarding");
    }
  }, [needsOnboarding, location, setLocation, user]);

  if (checking2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (twoFASession?.requires2FA && !twoFASession?.verified) {
    return <Verify2FA />;
  }

  // Server-side guard: redirect to onboarding if profile/billing not complete
  // Check both needsOnboarding flag AND the individual flags for robustness
  if (needsOnboarding) {
    return <Onboarding />;
  }

  // Handle full-screen routes outside Layout (immersive experiences)
  if (location === "/playbooks/create") {
    return <PlaybookCreate />;
  }
  if (location.startsWith("/war-room/")) {
    return <WarRoom />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/vendors" component={Vendors} />
        <Route path="/incidents" component={Incidents} />
        <Route path="/blockchain" component={Blockchain} />
        <Route path="/maintenance" component={Maintenance} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/sla" component={SLA} />
        <Route path="/automation" component={Automation} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/clients" component={Clients} />
        <Route path="/playbooks" component={Playbooks} />
        <Route path="/mobile-status" component={MobileStatus} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/logs" component={Logs} />
        <Route path="/settings" component={Settings} />
        <Route path="/consents" component={Consents} />
        <Route path="/feedback" component={FeedbackAdmin} />
        <Route path="/parser-health" component={ParserHealth} />
        <Route path="/users" component={UsersAdmin} />
        <Route path="/team" component={Team} />
        <Route path="/portals" component={Portals} />
        <Route path="/psa-integrations" component={PsaIntegrations} />
        <Route path="/predictions" component={Predictions} />
        <Route path="/webhooks" component={Webhooks} />
        <Route path="/api-keys" component={ApiKeysPage} />
        <Route path="/audit-logs" component={AuditLogsPage} />
        <Route path="/reports" component={Reports} />
        <Route path="/sso" component={SsoPage} />
        <Route path="/monitoring" component={Monitoring} />
        <Route path="/war-rooms" component={WarRooms} />
        <Route path="/blog-admin" component={BlogAdminPage} />
        <Route path="/admin/twitter-bot" component={TwitterBot} />
        <Route path="/web3-health" component={Web3Health} />
        <Route path="/dependency-map" component={DependencyMap} />
        <Route path="/vendor-reliability" component={VendorReliability} />
        <Route path="/settings/alert-rules" component={AlertRules} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Router-level onboarding guard: check if user needs onboarding BEFORE rendering routes
  // This ensures users can't access dashboard until they complete onboarding
  // Use "!== true" instead of "=== false" to catch undefined values too
  // Owner accounts always bypass onboarding (isOwner flag from server)
  const userNeedsOnboarding = user && !user.isOwner && (
    user.needsOnboarding === true ||
    user.profileCompleted !== true ||
    user.billingCompleted !== true
  );

  return (
    <Switch>
      <Route path="/signup" component={Signup} />
      <Route path="/signup/success" component={SignupSuccess} />
      <Route path="/verify-2fa" component={Verify2FA} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/set-password"><Redirect to="/forgot-password" /></Route>
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/sms-consent" component={SmsConsent} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/accept-invite/:token" component={AcceptInvite} />
      <Route path="/status/:slug" component={PublicPortal} />
      <Route path="/web3-health/widget" component={Web3HealthWidget} />
      <Route path="/outages" component={OutagesPage} />
      <Route path="/outages/:slug" component={OutagePostPage} />
      <Route path="/onboarding">
        {user ? <Onboarding /> : <Landing />}
      </Route>
      <Route path="/onboarding/billing">
        {user ? <Onboarding /> : <Landing />}
      </Route>
      <Route path="/onboarding/billing/success">
        {user ? <BillingSuccess /> : <Landing />}
      </Route>
      <Route>
        {/* Router-level guard: if user needs onboarding, show Onboarding instead of dashboard */}
        {user ? (userNeedsOnboarding ? <Onboarding /> : <AuthenticatedRouter />) : <Landing />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
