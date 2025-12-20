import { storage } from './storage';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function getFromEmail(): Promise<string> {
  const fromConfig = await storage.getConfig('email_from');
  return fromConfig?.value || 'notifications@resend.dev';
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
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[email] Resend error:', error);
      return false;
    }

    const result = await response.json();
    console.log(`[email] Email sent via Resend to ${to}: ${subject} (id: ${result.id})`);
    return true;
  } catch (error) {
    console.error('[email] Failed to send email:', error);
    return false;
  }
}

export async function isEmailConfigured(): Promise<boolean> {
  return !!RESEND_API_KEY;
}

export async function getEmailConfig(): Promise<{ configured: boolean; fromEmail: string }> {
  const fromEmail = await getFromEmail();
  return {
    configured: !!RESEND_API_KEY,
    fromEmail,
  };
}
