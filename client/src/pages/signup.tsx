import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Check, CreditCard, ArrowRight, Crown, Star, Zap, Shield } from "lucide-react";
import vendorWatchLogo from "@assets/generated_images/radar_eye_logo_dark_background.png";
import { APP_NAME } from "@/lib/labels";
import { cn } from "@/lib/utils";

type SubscriptionTier = 'essential' | 'growth' | 'enterprise';

const TIERS = {
  essential: {
    name: "Essential",
    price: "$89",
    icon: Shield,
    color: "text-blue-500",
    borderColor: "border-blue-500/50",
    bgColor: "bg-blue-500/10",
    features: [
      "Monitor up to 10 vendors",
      "Real-time incident detection",
      "Email alerts only",
      "Detailed incident tracking",
      "7-day free trial",
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
      "Monitor up to 25 vendors",
      "Real-time incident detection",
      "Email & SMS alerts",
      "Up to 10 blockchain networks",
      "Basic automation rules",
      "3 custom vendor requests",
      "7-day free trial",
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
      "7-day free trial",
    ],
  },
};

export default function Signup() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('growth');
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
    email: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/signup/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, tier: selectedTier }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

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

  const currentTier = TIERS[selectedTier];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src={vendorWatchLogo} alt="Vendor Watch" className="h-12 w-12" />
            <h1 className="text-4xl font-bold">{APP_NAME}</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Choose the plan that's right for your business
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {(['essential', 'growth', 'enterprise'] as SubscriptionTier[]).map((tier) => {
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
              Fill in your details to start your 7-day free trial
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

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
                data-testid="button-start-trial"
              >
                {loading ? (
                  "Processing..."
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Start 7-Day Free Trial - {currentTier.price}/mo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By signing up, you agree to our Terms of Service and Privacy Policy.
                You will be redirected to Stripe to enter your payment details.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          Cancel anytime during your trial. No charge until the trial ends.
        </p>
      </div>
    </div>
  );
}
