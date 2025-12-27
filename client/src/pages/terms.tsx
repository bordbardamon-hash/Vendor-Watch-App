import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Terms() {
  return (
    <ScrollArea className="h-screen">
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>

          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                <FileText className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-terms">
              Terms of Service
            </h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                By accessing or using Vendor Watch ("Service"), operated by The Turbo Haul LLC ("Company", "we", "us", or "our"), 
                you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, 
                do not use the Service.
              </p>
              <p>
                We reserve the right to modify these Terms at any time. Your continued use of the Service after 
                any changes constitutes acceptance of the new Terms.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>2. Description of Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Vendor Watch is a vendor status monitoring platform that provides:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Real-time monitoring of third-party vendor status pages</li>
                <li>Incident detection and alerting via email and SMS</li>
                <li>Blockchain and staking platform status tracking</li>
                <li>Scheduled maintenance notifications</li>
                <li>Analytics and reporting on vendor reliability</li>
              </ul>
              <p>
                The Service is designed for Managed Service Providers (MSPs) and businesses that rely on 
                external vendor services.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>3. Subscription Plans and Billing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Vendor Watch offers the following subscription tiers:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Essential Plan ($89/month):</strong> Monitor up to 10 vendors with email alerts</li>
                <li><strong>Growth Plan ($129/month):</strong> Monitor up to 25 vendors with email & SMS alerts, 10 blockchain networks, basic automation</li>
                <li><strong>Enterprise Plan ($189/month):</strong> Unlimited vendor and blockchain monitoring with AI Copilot and full automation</li>
              </ul>
              <p>
                Subscriptions are billed monthly through Stripe. You may cancel your subscription at any time 
                through your account settings. Refunds are not provided for partial months.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>4. User Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                To use the Service, you must create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
                <li>Providing accurate and complete registration information</li>
              </ul>
              <p>
                We recommend enabling Two-Factor Authentication (2FA) for enhanced account security.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>5. SMS and Email Communications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                By enabling SMS or email notifications, you consent to receive automated messages regarding:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Vendor incident alerts and status updates</li>
                <li>Scheduled maintenance notifications</li>
                <li>Service resolution updates</li>
                <li>Account-related communications</li>
              </ul>
              <p>
                Message frequency varies based on vendor status events. Standard message and data rates may apply 
                for SMS. You may opt out at any time by replying STOP to any SMS message or adjusting your 
                notification preferences in your account settings.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>6. Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                You agree not to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use the Service for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Resell or redistribute the Service without authorization</li>
                <li>Use automated means to access the Service beyond intended functionality</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>7. Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The Service and its original content, features, and functionality are owned by The Turbo Haul LLC 
                and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p>
                You retain ownership of any data you submit to the Service. By using the Service, you grant us 
                a limited license to process your data as necessary to provide the Service.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>8. Disclaimer of Warranties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. 
                WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
              </p>
              <p>
                We do not warrant the accuracy, reliability, or completeness of vendor status information obtained 
                from third-party sources. Vendor status data is provided for informational purposes only.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>9. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE TURBO HAUL LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF 
                PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p>
                Our total liability for any claims arising from the Service shall not exceed the amount you paid 
                us in the twelve (12) months preceding the claim.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>10. Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We may terminate or suspend your account and access to the Service immediately, without prior 
                notice or liability, for any reason, including breach of these Terms.
              </p>
              <p>
                Upon termination, your right to use the Service will cease immediately. All provisions of these 
                Terms that should survive termination shall survive, including ownership provisions, warranty 
                disclaimers, and limitations of liability.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>11. Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of 
                Delaware, United States, without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising from these Terms or the Service shall be resolved in the courts located 
                in Delaware.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>12. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                If you have any questions about these Terms, please contact us:
              </p>
              <p>
                <strong>The Turbo Haul LLC</strong><br />
                Email: support@vendorwatch.app<br />
                Website: https://vendorwatch.app
              </p>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground pb-8 space-y-2">
            <div className="flex justify-center gap-4">
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              <Link href="/sms-consent" className="text-primary hover:underline">SMS Consent</Link>
            </div>
            <p className="mt-4">© {new Date().getFullYear()} The Turbo Haul LLC. All rights reserved.</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
