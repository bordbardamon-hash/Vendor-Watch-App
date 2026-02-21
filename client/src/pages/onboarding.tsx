import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Rocket, CheckCircle, CreditCard, Building, Zap, Crown, ArrowRight, Loader2 } from "lucide-react";
import { VendorWatchLogo } from "@/components/ui/vendor-watch-logo";
import { APP_NAME } from "@/lib/labels";

type OnboardingStep = "profile" | "billing";

interface PlanInfo {
  id: "essential" | "growth" | "enterprise";
  name: string;
  price: number;
  features: string[];
  icon: typeof Building;
  recommended?: boolean;
}

const PLANS: PlanInfo[] = [
  {
    id: "essential",
    name: "Essential",
    price: 89,
    icon: Building,
    features: [
      "Up to 25 vendors (400+ catalog)",
      "Email alerts",
      "Component-level monitoring",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 129,
    icon: Zap,
    recommended: true,
    features: [
      "Up to 100 vendors",
      "Email, SMS, Slack & Teams",
      "25 blockchain networks",
      "PagerDuty & webhooks",
      "Client portals & playbooks",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 189,
    icon: Crown,
    features: [
      "Unlimited vendors & blockchain",
      "All alert channels",
      "AI Copilot & predictive AI",
      "Branded portals & embeds",
      "Priority support",
    ],
  },
];

export default function Onboarding() {
  const { toast } = useToast();
  const { user, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<OnboardingStep>("profile");
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"essential" | "growth" | "enterprise">("growth");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
    notificationEmail: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        companyName: user.companyName || "",
        phone: user.phone || "",
        notificationEmail: user.notificationEmail || user.email || "",
      });
      
      // Determine which step to show
      if (user.profileCompleted && !user.billingCompleted) {
        setStep("billing");
      } else if (user.profileCompleted && user.billingCompleted) {
        setLocation("/");
      }
    }
  }, [user, setLocation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete setup");
      }

      await refetch();
      setStep("billing");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBillingSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/onboarding/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedPlan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <VendorWatchLogo size={48} />
            <h1 className="text-3xl font-bold">{APP_NAME}</h1>
          </div>
          <p className="text-muted-foreground">
            {step === "profile" ? "Complete your profile to get started" : "Choose your plan"}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 ${step === "profile" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "profile" ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground"}`}>
              {user?.profileCompleted ? <CheckCircle className="h-5 w-5" /> : "1"}
            </div>
            <span className="text-sm font-medium">Profile</span>
          </div>
          <div className="w-12 h-0.5 bg-border" />
          <div className={`flex items-center gap-2 ${step === "billing" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === "billing" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              2
            </div>
            <span className="text-sm font-medium">Billing</span>
          </div>
        </div>

        {/* Trial info card */}
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Rocket className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">7-Day Free Trial</h3>
                <p className="text-sm text-muted-foreground">
                  Full access to all features - you won't be charged until the trial ends
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {step === "profile" && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about yourself</CardTitle>
              <CardDescription>
                We need a few details to personalize your experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="John"
                      required
                      data-testid="input-firstName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Doe"
                      required
                      data-testid="input-lastName"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    placeholder="Acme Inc."
                    required
                    data-testid="input-companyName"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                    required
                    data-testid="input-phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notificationEmail">Notification Email</Label>
                  <Input
                    id="notificationEmail"
                    name="notificationEmail"
                    type="email"
                    value={formData.notificationEmail}
                    onChange={handleChange}
                    placeholder="alerts@company.com"
                    data-testid="input-notificationEmail"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Where to send alert notifications (defaults to your sign-in email)
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full mt-6" 
                  size="lg"
                  disabled={loading}
                  data-testid="button-continue-to-billing"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue to Billing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "billing" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Choose your plan</CardTitle>
                <CardDescription>
                  Select a plan to start your 7-day free trial. Your card will only be charged after the trial ends.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {PLANS.map((plan) => {
                  const Icon = plan.icon;
                  return (
                    <div
                      key={plan.id}
                      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPlan === plan.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedPlan(plan.id)}
                      data-testid={`plan-${plan.id}`}
                    >
                      {plan.recommended && (
                        <div className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                          Recommended
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${selectedPlan === plan.id ? "bg-primary/20" : "bg-muted"}`}>
                            <Icon className={`h-5 w-5 ${selectedPlan === plan.id ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold">{plan.name}</h3>
                            <ul className="mt-2 space-y-1">
                              {plan.features.map((feature, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">${plan.price}</div>
                          <div className="text-xs text-muted-foreground">/month</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <CreditCard className="h-4 w-4" />
              <span>Secure payment powered by Stripe</span>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={handleBillingSubmit}
              disabled={loading}
              data-testid="button-start-trial"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to Stripe...
                </>
              ) : (
                <>
                  Start 7-Day Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
