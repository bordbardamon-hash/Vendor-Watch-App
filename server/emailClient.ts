import nodemailer from 'nodemailer';
import { storage } from './storage';

let transporter: nodemailer.Transporter | null = null;

async function getSmtpConfig(): Promise<{
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
} | null> {
  try {
    const hostConfig = await storage.getConfig('smtp_host');
    const portConfig = await storage.getConfig('smtp_port');
    const userConfig = await storage.getConfig('smtp_user');
    const passConfig = await storage.getConfig('smtp_pass');
    const fromConfig = await storage.getConfig('smtp_from');
    
    if (!hostConfig || !userConfig || !passConfig) {
      return null;
    }
    
    return {
      host: hostConfig.value,
      port: parseInt(portConfig?.value || '587'),
      user: userConfig.value,
      pass: passConfig.value,
      from: fromConfig?.value || userConfig.value,
    };
  } catch (error) {
    console.error('[email] Failed to get SMTP config:', error);
    return null;
  }
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (transporter) return transporter;
  
  const config = await getSmtpConfig();
  if (!config) {
    console.warn('[email] SMTP not configured. Email notifications disabled.');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
  
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<boolean> {
  try {
    const transport = await getTransporter();
    if (!transport) {
      console.log(`[email] SMTP not configured. Would send to ${to}: ${subject}`);
      return false;
    }
    
    const config = await getSmtpConfig();
    if (!config) return false;
    
    await transport.sendMail({
      from: `"Vendor Watch" <${config.from}>`,
      to,
      subject,
      text: textBody || htmlBody.replace(/<[^>]*>/g, ''),
      html: htmlBody,
    });
    
    console.log(`[email] Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('[email] Failed to send email:', error);
    return false;
  }
}

export function isEmailConfigured(): Promise<boolean> {
  return getSmtpConfig().then(config => !!config);
}
