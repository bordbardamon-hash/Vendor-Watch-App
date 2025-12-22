import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';

const APP_NAME = 'Vendor Watch';

export interface TwoFactorSetup {
  secret: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}

export function generateSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
    codes.push(formatted);
  }
  return codes;
}

export async function setupTwoFactor(userEmail: string): Promise<TwoFactorSetup> {
  const secret = generateSecret();
  const recoveryCodes = generateRecoveryCodes(10);
  
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: userEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });
  
  const uri = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(uri, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
  
  return {
    secret,
    qrCodeDataUrl,
    recoveryCodes,
  };
}

export function verifyTOTP(token: string, secret: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: secret,
  });
  
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export function verifyRecoveryCode(
  inputCode: string, 
  storedCodes: string[]
): { valid: boolean; remainingCodes: string[] } {
  const normalizedInput = inputCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  
  const matchIndex = storedCodes.findIndex(code => {
    const normalizedStored = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return normalizedStored === normalizedInput;
  });
  
  if (matchIndex === -1) {
    return { valid: false, remainingCodes: storedCodes };
  }
  
  const remainingCodes = [...storedCodes];
  remainingCodes.splice(matchIndex, 1);
  
  return { valid: true, remainingCodes };
}
