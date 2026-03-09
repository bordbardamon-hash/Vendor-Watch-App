import twilio from 'twilio';
import { isCircuitOpen, recordSuccess, recordFailure, configureCircuitBreaker } from './circuitBreaker';

const SMS_CIRCUIT = 'twilio_sms';
configureCircuitBreaker(SMS_CIRCUIT, { failureThreshold: 5, resetTimeoutMs: 2 * 60 * 1000 });

let cachedCredentials: {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
} | null = null;

async function getCredentials() {
  if (cachedCredentials) return cachedCredentials;

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY && process.env.TWILIO_API_KEY_SECRET) {
    cachedCredentials = {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      apiKey: process.env.TWILIO_API_KEY,
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
    };
    return cachedCredentials;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_KEY_SECRET, and TWILIO_PHONE_NUMBER environment variables.');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }

  cachedCredentials = {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
  return cachedCredentials;
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) {
    return '+' + digits;
  }
  if (digits.length === 10) {
    return '+1' + digits;
  }
  if (phone.startsWith('+')) {
    return phone;
  }
  return '+' + digits;
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (isCircuitOpen(SMS_CIRCUIT)) {
    console.warn(`[twilio] Circuit breaker OPEN for Twilio - skipping SMS to ${to}`);
    return false;
  }

  const formattedTo = formatPhoneE164(to);
  console.log(`[twilio] Attempting SMS to ${formattedTo} (original: ${to})`);

  try {
    const client = await getTwilioClient();
    const fromNumber = await getTwilioFromPhoneNumber();
    
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedTo
    });
    
    console.log(`[twilio] SMS sent successfully to ${formattedTo}`);
    recordSuccess(SMS_CIRCUIT);
    return true;
  } catch (error: any) {
    const errorMsg = error?.message || error?.code || String(error);
    console.error(`[twilio] Failed to send SMS to ${formattedTo}:`, errorMsg);
    recordFailure(SMS_CIRCUIT);
    return false;
  }
}
