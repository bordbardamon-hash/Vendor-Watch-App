// Twilio Integration - SMS alerts for vendor incidents
import twilio from 'twilio';
import { isCircuitOpen, recordSuccess, recordFailure, configureCircuitBreaker } from './circuitBreaker';

const SMS_CIRCUIT = 'twilio_sms';
configureCircuitBreaker(SMS_CIRCUIT, { failureThreshold: 5, resetTimeoutMs: 2 * 60 * 1000 });

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
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
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
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
