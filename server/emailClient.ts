import { storage } from './storage';
import { sendSMS } from './twilioClient';
import { isCircuitOpen, recordSuccess, recordFailure, configureCircuitBreaker } from './circuitBreaker';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_CIRCUIT = 'resend_email';
configureCircuitBreaker(EMAIL_CIRCUIT, { failureThreshold: 5, resetTimeoutMs: 2 * 60 * 1000 });
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PHONE = process.env.OWNER_PHONE;

async function getFromEmail(): Promise<string> {
  const fromConfig = await storage.getConfig('email_from');
  const configuredEmail = fromConfig?.value || 'notification@vendorwatch.app';
  // Always use verified domain - never use resend.dev test domain
  if (configuredEmail.includes('resend.dev')) {
    console.log('[email] Overriding resend.dev test domain with verified domain');
    return 'notification@vendorwatch.app';
  }
  return configuredEmail;
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[email] Resend not configured. Would send to ${to}: ${subject}`);
    return false;
  }

  if (isCircuitOpen(EMAIL_CIRCUIT)) {
    console.warn(`[email] Circuit breaker OPEN for Resend - skipping email to ${to}`);
    return false;
  }

  try {
    const fromEmail = await getFromEmail();
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Vendor Watch <${fromEmail}>`,
        to: [to],
        subject,
        html: htmlBody,
        text: textBody || htmlBody.replace(/<[^>]*>/g, ''),
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[email] Resend error:', error);
      recordFailure(EMAIL_CIRCUIT);
      return false;
    }

    const result = await response.json();
    console.log(`[email] Email sent via Resend to ${to}: ${subject} (id: ${result.id})`);
    recordSuccess(EMAIL_CIRCUIT);
    return true;
  } catch (error) {
    console.error('[email] Failed to send email:', error);
    recordFailure(EMAIL_CIRCUIT);
    return false;
  }
}

export async function isEmailConfigured(): Promise<boolean> {
  return !!RESEND_API_KEY;
}

export async function sendWelcomeEmail(
  to: string,
  firstName: string | null,
  options?: {
    isPromo?: boolean;
    trialDays?: number;
    trialEndsAt?: Date;
    tier?: string;
    passwordSetupUrl?: string;
  }
): Promise<boolean> {
  console.log(`[email] sendWelcomeEmail called for: ${to}, isPromo: ${options?.isPromo}`);
  const name = firstName || 'there';
  const appUrl = process.env.APP_URL
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : null)
    || 'https://vendorwatch.app';
  
  const isPromo = options?.isPromo || false;
  const trialDays = options?.trialDays || 14;
  const trialEndsAt = options?.trialEndsAt;
  const tier = options?.tier || 'Essential';
  const passwordSetupUrl = options?.passwordSetupUrl;
  
  const trialEndDate = trialEndsAt 
    ? trialEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  
  const subject = isPromo 
    ? `Welcome to Vendor Watch - Your ${tier} trial is ready!`
    : 'Welcome to Vendor Watch - Get Started Now!';
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #0a0a0a;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border-radius: 12px; padding: 40px; border: 1px solid #2a2a2a;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://vendorwatch.app/icon-512.png" alt="Vendor Watch" width="64" height="64" style="margin-bottom: 12px; border-radius: 12px;" />
        <h1 style="color: #047857; margin: 0; font-size: 28px;">Vendor Watch</h1>
        <p style="color: #888; margin-top: 8px;">Proactive Vendor Status Monitoring</p>
      </div>
      
      <h2 style="color: #fff; margin-bottom: 20px;">Welcome, ${name}!</h2>
      
      ${isPromo ? `
      <p style="color: #d4d4d4; line-height: 1.6;">
        Great news! You've been granted <strong style="color: #047857;">${trialDays}-day access</strong> to Vendor Watch 
        with full <strong style="color: #fbbf24;">${tier}</strong> features.
      </p>
      <p style="color: #d4d4d4; line-height: 1.6;">
        Your trial is active until <strong style="color: #fff;">${trialEndDate}</strong>.
      </p>
      ${passwordSetupUrl ? `
      <div style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <h3 style="color: #fff; margin: 0 0 12px 0; font-size: 18px;">🔐 Set Up Your Password</h3>
        <p style="color: rgba(255,255,255,0.9); margin: 0 0 16px 0; font-size: 14px;">
          Click the button below to create your account password. This link expires in 7 days.
        </p>
        <a href="${passwordSetupUrl}" 
           style="display: inline-block; background: #fff; color: #047857; text-decoration: none; 
                  padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px;">
          Create Password
        </a>
      </div>
      ` : ''}
      ` : `
      <p style="color: #d4d4d4; line-height: 1.6;">
        Thanks for signing up for Vendor Watch! We're excited to help you stay ahead of vendor outages 
        and keep your clients informed.
      </p>
      `}
      
      <div style="background: #1f1f1f; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #047857; margin: 0 0 12px 0; font-size: 16px;">🚀 Quick Start:</h3>
        <ul style="color: #d4d4d4; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li>Add the vendors your clients rely on</li>
          <li>Set up email or SMS alerts for incidents</li>
          <li>Monitor status from a single dashboard</li>
          <li>Get AI-powered outage predictions</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${appUrl}" 
           style="display: inline-block; background: #047857; color: #fff; text-decoration: none; 
                  padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Access Your Dashboard →
        </a>
      </div>
      
      <p style="color: #888; font-size: 14px; text-align: center; margin-top: 30px;">
        Questions? Just reply to this email - we're here to help!
      </p>
      
    </div>
    
    <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
      © ${new Date().getFullYear()} Vendor Watch. Proactive vendor status monitoring.
    </p>
  </div>
</body>
</html>
  `;
  
  const passwordSetupText = passwordSetupUrl 
    ? `\n\nSet up your password (expires in 7 days): ${passwordSetupUrl}\n` 
    : '';
  
  const textBody = isPromo
    ? `Welcome to Vendor Watch, ${name}!\n\nYou've been granted ${trialDays}-day access to Vendor Watch with full ${tier} features.\n\nYour trial is active until ${trialEndDate}.${passwordSetupText}\n\nAccess your dashboard: ${appUrl}\n\nQuick Start:\n- Add the vendors your clients rely on\n- Set up email or SMS alerts for incidents\n- Monitor status from a single dashboard\n- Get AI-powered outage predictions\n\nQuestions? Just reply to this email!`
    : `Welcome to Vendor Watch, ${name}!\n\nThanks for signing up! We're excited to help you stay ahead of vendor outages.\n\nAccess your dashboard: ${appUrl}\n\nQuick Start:\n- Add the vendors your clients rely on\n- Set up email or SMS alerts for incidents\n- Monitor status from a single dashboard\n- Get AI-powered outage predictions\n\nQuestions? Just reply to this email!`;
  
  try {
    const result = await sendEmail(to, subject, htmlBody, textBody);
    console.log(`[email] Welcome email result for ${to}: ${result ? 'sent' : 'failed'}`);
    return result;
  } catch (error) {
    console.error(`[email] Welcome email error for ${to}:`, error);
    return false;
  }
}

export async function getEmailConfig(): Promise<{ configured: boolean; fromEmail: string }> {
  const fromEmail = await getFromEmail();
  return {
    configured: !!RESEND_API_KEY,
    fromEmail,
  };
}

export async function notifyOwnerNewSignup(
  userEmail: string,
  firstName: string | null,
  lastName: string | null,
  signupMethod: 'email' | 'replit_oauth' | 'promo_trial' | 'admin_created',
  tier?: string
): Promise<void> {
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  
  const methodLabel = {
    'email': 'Email Registration',
    'replit_oauth': 'Google/GitHub Login',
    'promo_trial': `Promotional Trial (${tier || 'Essential'})`,
    'admin_created': `Admin Created (${tier || 'None'})`
  }[signupMethod];
  
  const smsMessage = `🎉 New Signup!\n${name}\n${userEmail}\nVia: ${methodLabel}\n${timestamp}`;
  
  if (OWNER_PHONE) {
    try {
      await sendSMS(OWNER_PHONE, smsMessage);
      console.log(`[notify] SMS sent to owner about new signup: ${userEmail}`);
    } catch (error) {
      console.error('[notify] Failed to send SMS to owner:', error);
    }
  }
  
  if (OWNER_EMAIL) {
    const subject = `🎉 New Vendor Watch Signup: ${name}`;
    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #047857; margin: 0 0 20px 0;">🎉 New User Signup!</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666; width: 100px;">Name:</td>
        <td style="padding: 8px 0; color: #111; font-weight: 600;">${name}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Email:</td>
        <td style="padding: 8px 0; color: #111;">${userEmail}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Method:</td>
        <td style="padding: 8px 0; color: #111;">${methodLabel}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666;">Time:</td>
        <td style="padding: 8px 0; color: #111;">${timestamp}</td>
      </tr>
    </table>
  </div>
</body>
</html>`;
    
    const sendWithRetry = async (attempts: number) => {
      for (let i = 0; i < attempts; i++) {
        try {
          const result = await sendEmail(OWNER_EMAIL!, subject, htmlBody);
          if (result) {
            console.log(`[notify] Email sent to owner about new signup: ${userEmail} (attempt ${i + 1})`);
            return;
          }
          console.warn(`[notify] Email send returned false for signup: ${userEmail} (attempt ${i + 1})`);
        } catch (error) {
          console.error(`[notify] Failed to send signup email (attempt ${i + 1}):`, error);
        }
        if (i < attempts - 1) {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      console.error(`[notify] All ${attempts} email attempts failed for signup: ${userEmail}`);
    };
    sendWithRetry(3).catch(() => {});
  }
}
