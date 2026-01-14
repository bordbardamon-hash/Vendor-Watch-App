import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Rocket, Clock, CheckCircle } from "lucide-react";
import vendorWatchLogo from "@assets/generated_images/radar_eye_logo_dark_background.png";
import { APP_NAME } from "@/lib/labels";

export default function Onboarding() {
  const { toast } = useToast();
  const { user, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
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
    }
  }, [user]);

  useEffect(() => {
    if (user?.profileCompleted) {
      setLocation("/");
    }
  }, [user?.profileCompleted, setLocation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

      toast({
        title: "Welcome to Vendor Watch!",
        description: "Your account is ready. Enjoy your 7-day free trial!",
      });

      await refetch();
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const trialEndDate = user?.trialEndsAt 
    ? new Date(user.trialEndsAt).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src={vendorWatchLogo} alt="Vendor Watch" className="h-12 w-12" />
            <h1 className="text-3xl font-bold">{APP_NAME}</h1>
          </div>
          <p className="text-muted-foreground">
            Complete your profile to get started
          </p>
        </div>

        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Rocket className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">7-Day Free Trial</h3>
                <p className="text-sm text-muted-foreground">
                  Full access to all features - no credit card required
                </p>
              </div>
            </div>
            {trialEndDate && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Your trial expires on {trialEndDate}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tell us about yourself</CardTitle>
            <CardDescription>
              We need a few details to personalize your experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="pt-4 space-y-3">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                  <span>Monitor vendor status pages in real-time</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                  <span>Get instant alerts when incidents occur</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                  <span>Track blockchain network health</span>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full mt-6" 
                size="lg"
                disabled={loading}
                data-testid="button-complete-setup"
              >
                {loading ? "Setting up..." : "Start Your Free Trial"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
