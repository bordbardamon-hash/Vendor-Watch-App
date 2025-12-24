import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Privacy() {
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
                <Shield className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-privacy">
              Privacy Policy
            </h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The Turbo Haul LLC ("Company", "we", "us", or "our") operates Vendor Watch (the "Service"). 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
                when you use our Service.
              </p>
              <p>
                By using the Service, you consent to the data practices described in this policy. If you do 
                not agree with the terms of this Privacy Policy, please do not access the Service.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p><strong>Personal Information:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Name and email address (during registration)</li>
                <li>Phone number (for SMS notifications, if enabled)</li>
                <li>Account credentials and authentication data</li>
                <li>Billing information (processed securely through Stripe)</li>
              </ul>
              
              <p className="mt-4"><strong>Usage Information:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Vendor subscription preferences</li>
                <li>Notification preferences and consent records</li>
                <li>Login activity and session data</li>
                <li>Incident acknowledgement history</li>
                <li>Browser type, IP address, and device information</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>3. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, operate, and maintain the Service</li>
                <li>Send vendor incident alerts and maintenance notifications via email and SMS</li>
                <li>Process your subscription and payments</li>
                <li>Communicate with you about your account and the Service</li>
                <li>Improve and personalize your experience</li>
                <li>Analyze usage patterns to enhance the Service</li>
                <li>Ensure security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>4. SMS and Email Communications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                If you opt in to receive SMS notifications, we will use your phone number solely for 
                sending vendor status alerts. We will never:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Sell your phone number to third parties</li>
                <li>Share your phone number for marketing purposes</li>
                <li>Send unsolicited promotional messages</li>
              </ul>
              <p className="mt-4">
                <strong>Message Frequency:</strong> Varies based on vendor status events (typically 0-10 messages per week).
              </p>
              <p>
                <strong>Opt-Out:</strong> Reply STOP to any SMS message or disable SMS in your account settings. 
                Reply HELP for assistance.
              </p>
              <p>
                <strong>Carrier Liability:</strong> Message and data rates may apply. Carriers are not liable 
                for delayed or undelivered messages.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>5. Data Sharing and Disclosure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>We may share your information with:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Service Providers:</strong> Third-party vendors who assist in operating our Service 
                  (e.g., Stripe for payments, Twilio for SMS, Resend for email)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              </ul>
              <p className="mt-4">
                We do not sell, rent, or trade your personal information to third parties for their 
                marketing purposes.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>6. Data Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We implement industry-standard security measures to protect your information, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Secure password hashing</li>
                <li>Two-Factor Authentication (2FA) option</li>
                <li>Regular security audits and monitoring</li>
                <li>Access controls and authentication</li>
              </ul>
              <p className="mt-4">
                However, no method of transmission over the Internet is 100% secure. While we strive to 
                protect your information, we cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>7. Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We retain your personal information for as long as your account is active or as needed to 
                provide you with the Service. We may retain certain information as necessary to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Comply with legal obligations</li>
                <li>Resolve disputes</li>
                <li>Enforce our agreements</li>
                <li>Maintain records for legitimate business purposes</li>
              </ul>
              <p className="mt-4">
                You may request deletion of your account and associated data by contacting us at 
                support@vendorwatch.app.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>8. Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
                <li><strong>Opt-Out:</strong> Opt out of certain data processing activities</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent for SMS or email communications</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, contact us at support@vendorwatch.app.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>9. Cookies and Tracking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We use cookies and similar tracking technologies to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintain your session and authentication state</li>
                <li>Remember your preferences</li>
                <li>Analyze usage patterns to improve the Service</li>
              </ul>
              <p className="mt-4">
                You can control cookies through your browser settings. However, disabling cookies may 
                affect the functionality of the Service.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>10. Third-Party Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The Service may contain links to third-party websites or services. We are not responsible 
                for the privacy practices of these third parties. We encourage you to review the privacy 
                policies of any third-party sites you visit.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>11. Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                The Service is not intended for individuals under the age of 18. We do not knowingly collect 
                personal information from children. If we become aware that we have collected personal 
                information from a child, we will take steps to delete that information.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>12. Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by 
                posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
              <p>
                Your continued use of the Service after any changes constitutes acceptance of the updated 
                Privacy Policy.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sidebar-border bg-sidebar/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>13. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                If you have any questions about this Privacy Policy, please contact us:
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
              <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
              <Link href="/sms-consent" className="text-primary hover:underline">SMS Consent</Link>
            </div>
            <p className="mt-4">© {new Date().getFullYear()} The Turbo Haul LLC. All rights reserved.</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
