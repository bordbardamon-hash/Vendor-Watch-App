import { db } from './db';
import { slaContracts, slaBreaches, vendorDailyMetrics, blockchainIncidents, type SlaContract } from '@shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { storage } from './storage';
import { sendEmail } from './emailClient';

interface CreditTier {
  threshold: number;
  creditPercent: number;
}

export async function calculateSlaMetrics(
  vendorKey: string,
  startDate: string,
  endDate: string
): Promise<{ uptimePercent: number; downtimeMinutes: number; incidentCount: number }> {
  const metrics = await db.select().from(vendorDailyMetrics)
    .where(and(
      eq(vendorDailyMetrics.vendorKey, vendorKey),
      gte(vendorDailyMetrics.date, startDate),
      lte(vendorDailyMetrics.date, endDate)
    ))
    .orderBy(desc(vendorDailyMetrics.date));
  
  if (metrics.length === 0) {
    return { uptimePercent: 100, downtimeMinutes: 0, incidentCount: 0 };
  }
  
  let totalUptime = 0;
  let totalDowntime = 0;
  let totalIncidents = 0;
  
  for (const metric of metrics) {
    totalUptime += metric.uptimeMinutes;
    totalDowntime += metric.downtimeMinutes;
    totalIncidents += metric.incidentCount;
  }
  
  const totalMinutes = totalUptime + totalDowntime;
  const uptimePercent = totalMinutes > 0 ? (totalUptime / totalMinutes) * 100 : 100;
  
  return {
    uptimePercent: Math.round(uptimePercent * 1000) / 1000,
    downtimeMinutes: totalDowntime,
    incidentCount: totalIncidents,
  };
}

export async function calculateBlockchainSlaMetrics(
  chainKey: string,
  startDate: string,
  endDate: string
): Promise<{ uptimePercent: number; downtimeMinutes: number; incidentCount: number }> {
  const startDateTime = new Date(startDate);
  const endDateTime = new Date(endDate);
  
  const incidents = await db.select().from(blockchainIncidents)
    .where(and(
      eq(blockchainIncidents.chainKey, chainKey),
      gte(blockchainIncidents.createdAt, startDateTime)
    ));
  
  if (incidents.length === 0) {
    return { uptimePercent: 100, downtimeMinutes: 0, incidentCount: 0 };
  }
  
  let totalDowntimeMinutes = 0;
  
  for (const incident of incidents) {
    const incidentStart = new Date(incident.startedAt);
    const incidentEnd = incident.resolvedAt || new Date();
    
    const effectiveStart = incidentStart < startDateTime ? startDateTime : incidentStart;
    const effectiveEnd = incidentEnd > endDateTime ? endDateTime : incidentEnd;
    
    if (effectiveEnd > effectiveStart) {
      totalDowntimeMinutes += (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);
    }
  }
  
  const totalMinutes = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60);
  const uptimePercent = totalMinutes > 0 ? ((totalMinutes - totalDowntimeMinutes) / totalMinutes) * 100 : 100;
  
  return {
    uptimePercent: Math.max(0, Math.round(uptimePercent * 1000) / 1000),
    downtimeMinutes: Math.round(totalDowntimeMinutes),
    incidentCount: incidents.length,
  };
}

export async function checkAllSlaBreaches(): Promise<number> {
  const contracts = await db.select().from(slaContracts).where(eq(slaContracts.isActive, true));
  let breachCount = 0;
  
  for (const contract of contracts) {
    const hasBreach = await checkContractForBreach(contract);
    if (hasBreach) breachCount++;
  }
  
  console.log(`[sla] Checked ${contracts.length} contracts, found ${breachCount} breaches`);
  return breachCount;
}

async function checkContractForBreach(contract: SlaContract): Promise<boolean> {
  const period = getPeriodDates(contract.measurementPeriod);
  if (!period) return false;
  
  const existingBreaches = await db.select().from(slaBreaches)
    .where(and(
      eq(slaBreaches.contractId, contract.id),
      eq(slaBreaches.periodStart, period.start),
      eq(slaBreaches.periodEnd, period.end)
    ));
  
  if (existingBreaches.length > 0) {
    return existingBreaches[0].actualUptime < contract.uptimeTarget;
  }
  
  const isBlockchain = contract.resourceType === 'blockchain';
  const metrics = isBlockchain 
    ? await calculateBlockchainSlaMetrics(contract.vendorKey, period.start, period.end)
    : await calculateSlaMetrics(contract.vendorKey, period.start, period.end);
  const targetUptime = parseFloat(contract.uptimeTarget);
  
  if (metrics.uptimePercent < targetUptime) {
    const creditTiers: CreditTier[] = JSON.parse(contract.serviceCreditTiers);
    let creditPercent = '0';
    
    for (const tier of creditTiers.sort((a, b) => b.threshold - a.threshold)) {
      if (metrics.uptimePercent < tier.threshold) {
        creditPercent = tier.creditPercent.toString();
      }
    }
    
    await storage.createSlaBreach({
      contractId: contract.id,
      vendorKey: contract.vendorKey,
      resourceType: contract.resourceType || 'vendor',
      periodStart: period.start,
      periodEnd: period.end,
      targetUptime: contract.uptimeTarget,
      actualUptime: metrics.uptimePercent.toString(),
      downtimeMinutes: metrics.downtimeMinutes,
      creditPercent,
      claimStatus: 'detected',
    });
    
    if (contract.notificationEmail) {
      await sendBreachNotification(contract, metrics.uptimePercent, creditPercent);
    }
    
    return true;
  }
  
  return false;
}

function getPeriodDates(period: string): { start: string; end: string } | null {
  const now = new Date();
  let start: Date;
  let end: Date;
  
  switch (period) {
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'quarterly':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
      end = new Date(now.getFullYear(), currentQuarter * 3, 0);
      break;
    case 'annual':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
      break;
    default:
      return null;
  }
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

async function sendBreachNotification(
  contract: SlaContract,
  actualUptime: number,
  creditPercent: string
): Promise<void> {
  if (!contract.notificationEmail) return;
  
  const subject = `SLA Breach Detected: ${contract.name}`;
  const html = `
    <h2>SLA Breach Alert</h2>
    <p>We've detected that the SLA for <strong>${contract.name}</strong> has been breached.</p>
    
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>${contract.resourceType === 'blockchain' ? 'Chain' : 'Vendor'}:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${contract.vendorKey}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Target Uptime:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${contract.uptimeTarget}%</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Actual Uptime:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${actualUptime.toFixed(3)}%</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Eligible Credit:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${creditPercent}%</td>
      </tr>
    </table>
    
    <p>Please review this breach in your Vendor Watch dashboard to generate a service credit claim.</p>
  `;
  
  await sendEmail(contract.notificationEmail, subject, html);
}

export async function generateServiceCreditClaim(breachId: string): Promise<{
  subject: string;
  body: string;
}> {
  const [breach] = await db.select().from(slaBreaches).where(eq(slaBreaches.id, breachId));
  if (!breach) throw new Error('Breach not found');
  
  const [contract] = await db.select().from(slaContracts).where(eq(slaContracts.id, breach.contractId));
  if (!contract) throw new Error('Contract not found');
  
  const vendors = await storage.getVendors();
  const vendor = vendors.find(v => v.key === breach.vendorKey);
  const vendorName = vendor?.name || breach.vendorKey;
  
  const subject = `Service Credit Claim - SLA Breach for ${vendorName} (${breach.periodStart} to ${breach.periodEnd})`;
  
  const body = `Dear ${vendorName} Support Team,

We are writing to formally request a service credit under our Service Level Agreement.

ACCOUNT DETAILS:
Contract Name: ${contract.name}
Measurement Period: ${breach.periodStart} to ${breach.periodEnd}

SLA PERFORMANCE:
Guaranteed Uptime: ${breach.targetUptime}%
Actual Uptime: ${breach.actualUptime}%
Total Downtime: ${breach.downtimeMinutes} minutes

Based on the service credit tiers defined in our agreement, we believe we are entitled to a ${breach.creditPercent}% credit on our monthly service fees for this period.

We have attached relevant incident documentation and monitoring logs to support this claim.

Please process this service credit request at your earliest convenience. We look forward to your prompt response.

Best regards,
[Your Name]
[Company Name]
[Account Number]

---
This claim was generated by Vendor Watch SLA Tracking.
Reference ID: ${breach.id}`;

  await storage.updateSlaBreach(breachId, {
    claimStatus: 'drafted',
    claimDraftedAt: new Date(),
  });

  return { subject, body };
}
