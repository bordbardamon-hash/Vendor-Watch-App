import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import vendorWatchLogo from "@assets/generated_images/radar_eye_logo_dark_background.png";
import { APP_NAME } from "@/lib/labels";

export default function BillingSuccess() {
  const { refetch } = useAuth();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    tier: string;
    trialEndsAt: string | null;
  } | null>(null);

  useEffect(() => {
    const confirmBilling = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");

      if (!sessionId) {
        setStatus("error");
        setErrorMessage("No session ID found. Please try again.");
        return;
      }

      try {
        const response = await fetch("/api/onboarding/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to confirm billing");
        }

        setSubscriptionInfo({
          tier: data.subscriptionTier,
          trialEndsAt: data.trialEndsAt,
        });
        setStatus("success");
        await refetch();
      } catch (error: any) {
        setStatus("error");
        setErrorMessage(error.message || "Something went wrong");
      }
    };

    confirmBilling();
  }, [refetch]);

  const handleContinue = () => {
    setLocation("/");
  };

  const trialEndDate = subscriptionInfo?.trialEndsAt
    ? new Date(subscriptionInfo.trialEndsAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src={vendorWatchLogo} alt="Vendor Watch" className="h-12 w-12" />
            <h1 className="text-3xl font-bold">{APP_NAME}</h1>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            {status === "loading" && (
              <>
                <div className="mx-auto p-4 bg-primary/10 rounded-full w-fit mb-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <CardTitle>Setting up your account...</CardTitle>
                <CardDescription>
                  Please wait while we confirm your subscription
                </CardDescription>
              </>
            )}
            {status === "success" && (
              <>
                <div className="mx-auto p-4 bg-green-500/10 rounded-full w-fit mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle>Welcome to {APP_NAME}!</CardTitle>
                <CardDescription>
                  Your account is all set up and ready to go
                </CardDescription>
              </>
            )}
            {status === "error" && (
              <>
                <div className="mx-auto p-4 bg-red-500/10 rounded-full w-fit mb-4">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <CardTitle>Something went wrong</CardTitle>
                <CardDescription>{errorMessage}</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {status === "success" && (
              <>
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm text-muted-foreground">Your plan</p>
                  <p className="font-semibold text-lg capitalize">
                    {subscriptionInfo?.tier || "Essential"}
                  </p>
                  {trialEndDate && (
                    <p className="text-sm text-muted-foreground">
                      Free trial until {trialEndDate}
                    </p>
                  )}
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleContinue}
                  data-testid="button-go-to-dashboard"
                >
                  Go to Dashboard
                </Button>
              </>
            )}
            {status === "error" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/onboarding")}
                data-testid="button-try-again"
              >
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
