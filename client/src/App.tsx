import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
import Signup from "@/pages/signup";
import SignupSuccess from "@/pages/signup-success";
import { Loader2 } from "lucide-react";

function AuthenticatedRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/vendors" component={Vendors} />
        <Route path="/blockchain" component={Blockchain} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/logs" component={Logs} />
        <Route path="/settings" component={Settings} />
        <Route path="/consents" component={Consents} />
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
