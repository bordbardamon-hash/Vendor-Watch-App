import { Switch, Route, useLocation } from "wouter";
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
import Blockchain from "@/pages/blockchain";
import Consents from "@/pages/consents";
import FeedbackAdmin from "@/pages/feedback";
import Maintenance from "@/pages/maintenance";
import Analytics from "@/pages/analytics";
import SLA from "@/pages/sla";
import Automation from "@/pages/automation";
import Signup from "@/pages/signup";
import SignupSuccess from "@/pages/signup-success";
import Verify2FA from "@/pages/verify-2fa";
import Login from "@/pages/login";
import Register from "@/pages/register";
import SetPassword from "@/pages/set-password";
import SmsConsent from "@/pages/sms-consent";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

function AuthenticatedRouter() {
  const [location, setLocation] = useLocation();
  
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

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/vendors" component={Vendors} />
        <Route path="/blockchain" component={Blockchain} />
        <Route path="/maintenance" component={Maintenance} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/sla" component={SLA} />
        <Route path="/automation" component={Automation} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/logs" component={Logs} />
        <Route path="/settings" component={Settings} />
        <Route path="/consents" component={Consents} />
        <Route path="/feedback" component={FeedbackAdmin} />
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

  return (
    <Switch>
      <Route path="/signup" component={Signup} />
      <Route path="/signup/success" component={SignupSuccess} />
      <Route path="/verify-2fa" component={Verify2FA} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/set-password" component={SetPassword} />
      <Route path="/sms-consent" component={SmsConsent} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route>
        {user ? <AuthenticatedRouter /> : <Landing />}
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
