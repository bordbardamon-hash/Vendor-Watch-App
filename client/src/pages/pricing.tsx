import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Crown, Star, Shield, Zap, ArrowRight, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import { VendorWatchLogo } from "@/components/ui/vendor-watch-logo";
import { APP_NAME } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FeatureCategory = {
  name: string;
  features: {
    name: string;
    tooltip?: string;
    essential: string | boolean;
    growth: string | boolean;
    enterprise: string | boolean;
  }[];
};

const featureCategories: FeatureCategory[] = [
  {
    name: "Vendor Monitoring",
    features: [
      { name: "Vendors monitored", tooltip: "Choose from our catalog of 600+ pre-configured services", essential: "Up to 25", growth: "Up to 100", enterprise: "Unlimited" },
      { name: "Service catalog", tooltip: "600+ services across 44 categories including cloud, SaaS, security, payments, AI, and more", essential: "600+ services", growth: "600+ services", enterprise: "600+ services" },
      { name: "Real-time status updates", essential: true, growth: true, enterprise: true },
      { name: "Component-level monitoring", tooltip: "Track individual service components like AWS EC2, S3, Lambda", essential: true, growth: true, enterprise: true },
      { name: "Incident tracking", essential: true, growth: true, enterprise: true },
      { name: "Maintenance alerts", essential: true, growth: true, enterprise: true },
      { name: "Custom vendor requests", tooltip: "Request new vendors to be added to monitoring", essential: false, growth: "5/month", enterprise: "Unlimited" },
      { name: "Add vendors directly", tooltip: "Add your own vendor status pages without waiting", essential: false, growth: false, enterprise: true },
    ],
  },
  {
    name: "Blockchain & Crypto",
    features: [
      { name: "Blockchain networks", tooltip: "Monitor 110+ blockchain networks including L1, L2, DeFi, and RPC providers", essential: false, growth: "Up to 25", enterprise: "Unlimited" },
      { name: "Wallet status monitoring", essential: false, growth: true, enterprise: true },
      { name: "Staking platform monitoring", essential: false, growth: false, enterprise: true },
      { name: "DeFi protocol tracking", essential: false, growth: false, enterprise: true },
    ],
  },
  {
    name: "Alerts & Notifications",
    features: [
      { name: "Email alerts", essential: true, growth: true, enterprise: true },
      { name: "SMS alerts", tooltip: "TCPA-compliant text message notifications", essential: false, growth: true, enterprise: true },
      { name: "Slack & Teams", tooltip: "Send formatted incident alerts to Slack or Microsoft Teams channels", essential: false, growth: true, enterprise: true },
      { name: "PagerDuty", tooltip: "Auto-trigger and resolve PagerDuty incidents synced to vendor events", essential: false, growth: true, enterprise: true },
      { name: "Outbound webhooks", tooltip: "HMAC-SHA256 signed payloads to any endpoint", essential: false, growth: true, enterprise: true },
      { name: "Alert assignments", tooltip: "Route alerts to specific team members per vendor", essential: false, growth: true, enterprise: true },
      { name: "Alert customization", essential: "Basic", growth: "Advanced", enterprise: "Full" },
      { name: "Timezone support", essential: true, growth: true, enterprise: true },
    ],
  },
  {
    name: "MSP Features",
    features: [
      { name: "Client labels", tooltip: "Organize vendors by client with priority levels", essential: false, growth: true, enterprise: true },
      { name: "Customer impact tagging", tooltip: "Tag vendors with high/medium/low customer impact", essential: false, growth: true, enterprise: true },
      { name: "Incident playbooks", tooltip: "Step-by-step response guides for incidents", essential: false, growth: true, enterprise: true },
      { name: "Weekly digest emails", essential: true, growth: true, enterprise: true },
      { name: "Vendor reliability stats", essential: true, growth: true, enterprise: true },
      { name: "Mobile status view", tooltip: "Quick status dashboard optimized for mobile", essential: false, growth: true, enterprise: true },
    ],
  },
  {
    name: "Enterprise Capabilities",
    features: [
      { name: "Automation rules", tooltip: "Trigger actions automatically on incidents", essential: false, growth: "Basic", enterprise: "Full" },
      { name: "SLA breach tracking", tooltip: "Track uptime against your SLA targets", essential: false, growth: false, enterprise: true },
      { name: "Synthetic monitoring", tooltip: "Probe vendor endpoints for proactive detection", essential: false, growth: false, enterprise: true },
      { name: "AI Communication Copilot", tooltip: "Generate professional incident updates with AI", essential: false, growth: false, enterprise: true },
      { name: "Early warning signals", tooltip: "Crowdsourced incident reports with dynamic confidence scoring", essential: false, growth: false, enterprise: true },
      { name: "Embeddable status widgets", tooltip: "Public status pages, SVG badges, and JSON APIs for clients", essential: false, growth: true, enterprise: true },
      { name: "Predictive outage detection", tooltip: "AI-powered analysis to predict potential outages", essential: false, growth: false, enterprise: true },
      { name: "Historical reports & CSV export", tooltip: "Uptime reports with MTTR, incident counts, and vendor breakdowns", essential: false, growth: "Basic", enterprise: "Full" },
      { name: "Analytics dashboard", essential: "Basic", growth: "Advanced", enterprise: "Full" },
    ],
  },
  {
    name: "Team & Organization",
    features: [
      { name: "Included team seats", tooltip: "Number of users included in base price", essential: "1 user", growth: "3 users", enterprise: "5 users" },
      { name: "Additional seats", tooltip: "Price per additional team member", essential: false, growth: "$20/seat", enterprise: "$25/seat" },
      { name: "Role-based access", tooltip: "Master Admin, Read/Write, and Read-Only roles", essential: false, growth: true, enterprise: true },
      { name: "Organization management", essential: false, growth: true, enterprise: true },
    ],
  },
  {
    name: "Support & Security",
    features: [
      { name: "Two-factor authentication", essential: true, growth: true, enterprise: true },
      { name: "Email support", essential: true, growth: true, enterprise: true },
      { name: "Priority support", essential: false, growth: false, enterprise: true },
      { name: "Onboarding assistance", essential: false, growth: false, enterprise: true },
    ],
  },
];

const plans = [
  {
    id: "essential",
    name: "Essential",
    price: 89,
    icon: Shield,
    color: "text-blue-500",
    borderColor: "border-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Perfect for individuals getting started with vendor monitoring",
    includedSeats: 1,
    seatPrice: null,
  },
  {
    id: "growth",
    name: "Growth",
    price: 129,
    icon: Star,
    color: "text-yellow-500",
    borderColor: "border-yellow-500",
    bgColor: "bg-yellow-500/10",
    description: "Ideal for growing MSPs managing multiple clients",
    popular: true,
    includedSeats: 3,
    seatPrice: 20,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 189,
    icon: Crown,
    color: "text-purple-500",
    borderColor: "border-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Full power for enterprise MSPs with advanced needs",
    includedSeats: 5,
    seatPrice: 25,
  },
];

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="h-5 w-5 text-green-500 mx-auto" />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />;
  }
  return <span className="text-sm font-medium">{value}</span>;
}

export default function Pricing() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-sidebar">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          <div className="text-center space-y-4 mb-12">
            <Link href="/" className="inline-flex items-center gap-2 hover:opacity-80 transition">
              <VendorWatchLogo size={40} />
              <span className="text-2xl font-bold">{APP_NAME}</span>
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold" data-testid="text-pricing-title">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your needs. All plans include access to our catalog of 600+ services and a 7-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "relative transition-all duration-200 hover:scale-[1.02]",
                    plan.popular ? `${plan.borderColor} border-2` : "border-sidebar-border"
                  )}
                  data-testid={`card-plan-${plan.id}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Most Popular
                      </span>
                    </div>
                  )}
                  <CardHeader className="text-center pb-4">
                    <div className={cn("mx-auto p-3 rounded-full mb-2", plan.bgColor)}>
                      <Icon className={cn("h-8 w-8", plan.color)} />
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
                    <div className="pt-4">
                      <span className="text-5xl font-bold">${plan.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {plan.includedSeats} user{plan.includedSeats > 1 ? 's' : ''} included
                      {plan.seatPrice && `, +$${plan.seatPrice}/seat`}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Link href="/signup">
                      <Button
                        className={cn("w-full", plan.popular && "bg-yellow-500 hover:bg-yellow-600 text-black")}
                        size="lg"
                        data-testid={`button-select-${plan.id}`}
                      >
                        Start Free Trial
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                    <p className="text-xs text-center text-muted-foreground mt-3">
                      7-day free trial, cancel anytime
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-center mb-8" data-testid="text-comparison-title">
              Detailed Feature Comparison
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="table-features">
                <thead>
                  <tr className="border-b border-sidebar-border">
                    <th className="text-left py-4 px-4 font-medium text-muted-foreground">Features</th>
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className={cn(
                          "py-4 px-4 text-center min-w-[140px]",
                          plan.popular && "bg-yellow-500/5"
                        )}
                      >
                        <div className={cn("font-bold text-lg", plan.color)}>{plan.name}</div>
                        <div className="text-sm text-muted-foreground">${plan.price}/mo</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureCategories.map((category, catIndex) => (
                    <React.Fragment key={`cat-${catIndex}`}>
                      <tr className="bg-sidebar/30" data-testid={`row-category-${catIndex}`}>
                        <td
                          colSpan={4}
                          className="py-3 px-4 font-semibold text-sm uppercase tracking-wide"
                        >
                          {category.name}
                        </td>
                      </tr>
                      {category.features.map((feature, featIndex) => (
                        <tr
                          key={`feat-${catIndex}-${featIndex}`}
                          className="border-b border-sidebar-border/50 hover:bg-sidebar/20"
                          data-testid={`row-feature-${catIndex}-${featIndex}`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span>{feature.name}</span>
                              {feature.tooltip && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground/50" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-[200px]">{feature.tooltip}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <FeatureValue value={feature.essential} />
                          </td>
                          <td className={cn("py-3 px-4 text-center", "bg-yellow-500/5")}>
                            <FeatureValue value={feature.growth} />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <FeatureValue value={feature.enterprise} />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-sidebar/30 rounded-xl p-8 text-center border border-sidebar-border">
            <h3 className="text-2xl font-bold mb-3">Ready to get started?</h3>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Join hundreds of MSPs who trust {APP_NAME} to monitor their vendors.
              Start your 7-day free trial today.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:opacity-90" data-testid="button-cta-signup">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-16 text-center">
            <h3 className="text-xl font-bold mb-6">Frequently Asked Questions</h3>
            <div className="grid md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
              <div className="space-y-2">
                <h4 className="font-semibold">Can I change plans later?</h4>
                <p className="text-sm text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">What happens after my trial?</h4>
                <p className="text-sm text-muted-foreground">
                  After 7 days, you'll be charged for your selected plan. Cancel anytime during the trial to avoid charges.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Do you offer refunds?</h4>
                <p className="text-sm text-muted-foreground">
                  We offer a 30-day money-back guarantee. If you're not satisfied, contact support for a full refund.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">How do I add custom vendors?</h4>
                <p className="text-sm text-muted-foreground">
                  Growth plans can request new vendors (we'll add them for you). Enterprise plans can add vendors directly.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-sidebar-border text-center text-sm text-muted-foreground">
            <Link href="/terms" className="hover:underline">Terms of Service</Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
