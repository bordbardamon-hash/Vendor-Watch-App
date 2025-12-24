import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Shield, 
  CheckCircle2, 
  Bell, 
  AlertCircle,
  Phone,
  FileText,
  XCircle
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function SmsConsent() {
  const [phone, setPhone] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (consentChecked && phone) {
      setSubmitted(true);
    }
  };

  return (
    <ScrollArea className="h-screen">
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                <MessageSquare className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-sms-consent">
              SMS Alert Subscription
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Vendor Watch - Real-time vendor status alerts via SMS
            </p>
          </div>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>What You'll Receive</CardTitle>
              </div>
              <CardDescription>
                Subscribe to receive important vendor status notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Incident Alerts</p>
                    <p className="text-sm text-muted-foreground">Immediate notification when monitored vendors experience outages or degraded performance</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Maintenance Notices</p>
                    <p className="text-sm text-muted-foreground">Scheduled maintenance windows that may affect your services</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Resolution Updates</p>
                    <p className="text-sm text-muted-foreground">Notifications when incidents are resolved and services return to normal</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!submitted ? (
            <Card className="border-primary/30 bg-primary/5 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  <CardTitle>Subscribe to SMS Alerts</CardTitle>
                </div>
                <CardDescription>
                  Enter your phone number and consent to receive SMS notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-background max-w-[300px]"
                      required
                      data-testid="input-consent-phone"
                    />
                    <p className="text-xs text-muted-foreground">
                      Include your country code (e.g., +1 for United States)
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border border-primary/30 bg-background/50 space-y-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="sms-consent-checkbox"
                        checked={consentChecked}
                        onCheckedChange={(c) => setConsentChecked(!!c)}
                        className="mt-1"
                        data-testid="checkbox-consent-agree"
                      />
                      <div className="space-y-2">
                        <Label htmlFor="sms-consent-checkbox" className="text-sm font-medium cursor-pointer">
                          I agree to receive SMS text messages from Vendor Watch
                        </Label>
                        <div className="text-xs text-muted-foreground space-y-2">
                          <p>
                            By checking this box and submitting, I expressly consent to receive automated SMS text messages 
                            from Vendor Watch regarding vendor incident alerts, maintenance notifications, and status updates 
                            at the phone number provided above.
                          </p>
                          <p className="font-medium">
                            Message frequency varies based on vendor status events. Message and data rates may apply.
                          </p>
                          <p>
                            You can opt out at any time by replying <span className="font-mono bg-muted px-1 rounded">STOP</span> to 
                            any message, or by disabling SMS notifications in your account settings. Reply <span className="font-mono bg-muted px-1 rounded">HELP</span> for 
                            assistance.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button 
                      type="submit" 
                      disabled={!consentChecked || !phone}
                      className="w-full sm:w-auto"
                      data-testid="button-submit-consent"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Subscribe to SMS Alerts
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      By subscribing, you agree to our{" "}
                      <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
                      <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-500/30 bg-green-500/5 backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Successfully Subscribed!</h2>
                <p className="text-muted-foreground mb-6">
                  You will now receive SMS alerts for vendor status updates at {phone}
                </p>
                <Link href="/settings">
                  <Button variant="outline">
                    Go to Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Your Privacy & Rights</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    We will never sell, share, or distribute your phone number to third parties
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Messages are sent only for vendor status alerts related to your subscriptions
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    You can unsubscribe at any time by texting STOP or updating your settings
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-sidebar-border">
                <h4 className="font-medium mb-2">How to Opt-Out</h4>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Reply <span className="font-mono bg-muted px-1 rounded">STOP</span> to any SMS message</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Disable SMS in your <Link href="/settings" className="text-primary hover:underline">account settings</Link></span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-sidebar-border">
                <h4 className="font-medium mb-2">Need Help?</h4>
                <p className="text-sm text-muted-foreground">
                  Reply <span className="font-mono bg-muted px-1 rounded">HELP</span> to any message for assistance, 
                  or contact us at support@vendorwatch.app
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle>Legal Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Service Provider:</strong> The Turbo Haul LLC dba Vendor Watch
              </p>
              <p>
                <strong>Message Types:</strong> Vendor incident alerts, scheduled maintenance notifications, 
                resolution updates, and service status changes
              </p>
              <p>
                <strong>Message Frequency:</strong> Varies based on vendor status events (typically 0-10 messages per week)
              </p>
              <p>
                <strong>Carrier Disclaimer:</strong> Message and data rates may apply. Carriers are not liable 
                for delayed or undelivered messages.
              </p>
              <div className="pt-4 flex gap-4">
                <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground pb-8">
            <p>© {new Date().getFullYear()} The Turbo Haul LLC. All rights reserved.</p>
            <p className="mt-1">Vendor Watch - Enterprise Vendor Status Monitoring</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
