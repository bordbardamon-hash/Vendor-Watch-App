import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, CreditCard, ArrowRight, Crown, Star, Zap, Shield, Gift } from "lucide-react";
import { VendorWatchLogo } from "@/components/ui/vendor-watch-logo";
import { APP_NAME } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type SubscriptionTier = 'free' | 'essential' | 'growth' | 'enterprise';

const TIERS = {
  free: {
    name: "Free",
    price: "$0",
    icon: Gift,
    color: "text-green-500",
    borderColor: "border-green-500/50",
    bgColor: "bg-green-500/10",
    features: [
      "Monitor up to 2 vendors",
      "1 blockchain network",
      "Email alerts only",
      "Real-time incident detection",
      "No credit card required",
    ],
  },
  essential: {
    name: "Essential",
    price: "$89",
    icon: Shield,
    color: "text-blue-500",
    borderColor: "border-blue-500/50",
    bgColor: "bg-blue-500/10",
    features: [
      "Monitor up to 25 vendors",
      "Real-time incident detection",
      "Email, Slack & webhook alerts",
      "Detailed incident tracking",
      "14-day free trial",
    ],
  },
  growth: {
    name: "Growth",
    price: "$129",
    icon: Star,
    color: "text-yellow-500",
    borderColor: "border-yellow-500/50",
    bgColor: "bg-yellow-500/10",
    popular: true,
    features: [
      "Monitor up to 100 vendors",
      "Real-time incident detection",
      "Email & SMS alerts",
      "Up to 25 blockchain networks",
      "Basic automation rules",
      "5 custom vendor requests",
      "14-day free trial",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: "$189",
    icon: Crown,
    color: "text-purple-500",
    borderColor: "border-purple-500/50",
    bgColor: "bg-purple-500/10",
    features: [
      "Unlimited vendor monitoring",
      "Email & SMS alerts",
      "Unlimited blockchain & staking",
      "Full automation + AI Copilot",
      "Add vendors directly",
      "Priority support",
      "14-day free trial",
    ],
  },
};

export default function Signup() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('essential');
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedTier === 'free' && formData.password.length < 8) {
      toast({
        title: "Password Required",
        description: "Please enter a password with at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/signup/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          password: selectedTier === 'free' ? formData.password : undefined,
          tier: selectedTier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.free && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.url) {
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

  const currentTier = TIERS[selectedTier];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <VendorWatchLogo size={48} />
            <h1 className="text-4xl font-bold">{APP_NAME}</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Choose the plan that's right for your business
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {(['free', 'essential', 'growth', 'enterprise'] as SubscriptionTier[]).map((tier) => {
            const config = TIERS[tier];
            const Icon = config.icon;
            const isSelected = selectedTier === tier;
            const isPopular = tier === 'growth';
            return (
              <Card
                key={tier}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:scale-[1.02] relative",
                  isSelected 
                    ? `${config.borderColor} border-2 ${config.bgColor}` 
                    : "border-sidebar-border bg-sidebar/30 hover:bg-sidebar/50"
                )}
                onClick={() => setSelectedTier(tier)}
                data-testid={`card-tier-${tier}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className={cn("mx-auto p-3 rounded-full mb-2", config.bgColor)}>
                    <Icon className={cn("h-6 w-6", config.color)} />
                  </div>
                  <CardTitle className="text-xl">{config.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{config.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {config.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Check className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.color)} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-sidebar-border max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <currentTier.icon className={cn("h-5 w-5", currentTier.color)} />
              Create your {currentTier.name} account
            </CardTitle>
            <CardDescription>
              {selectedTier === 'free' 
                ? "Fill in your details to start your free plan" 
                : "Fill in your details to start your 14-day free trial"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Acme Inc."
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  data-testid="input-company-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  data-testid="input-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@acme.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  data-testid="input-email"
                />
              </div>

              {selectedTier === 'free' && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    data-testid="input-password"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
                data-testid="button-start-trial"
              >
                {loading ? (
                  "Processing..."
                ) : selectedTier === 'free' ? (
                  <>
                    <Gift className="mr-2 h-4 w-4" />
                    Start Free Plan
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Start 14-Day Free Trial - {currentTier.price}/mo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {selectedTier === 'free' 
                  ? "By signing up, you agree to our Terms of Service and Privacy Policy. No credit card required."
                  : "By signing up, you agree to our Terms of Service and Privacy Policy. You will be redirected to Stripe to enter your payment details."}
              </p>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or sign up with</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = '/api/auth/google'; }}
                data-testid="button-google-signup"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { window.location.href = '/api/auth/github'; }}
                data-testid="button-github-signup"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-2">
              Already have an account?{" "}
              <a href="/login" className="text-primary hover:underline">Sign in</a>
            </p>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          {selectedTier === 'free' 
            ? "Free forever. Upgrade anytime to unlock more features."
            : "Cancel anytime during your trial. No charge until the trial ends."}
        </p>
      </div>
    </div>
  );
}
