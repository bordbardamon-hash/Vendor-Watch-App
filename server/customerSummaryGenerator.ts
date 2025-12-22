import type { Incident, Vendor, LifecycleEvent, CanonicalStatus, CanonicalSeverity } from '@shared/schema';

interface CustomerSummaryContext {
  incident: Incident;
  vendor: Vendor;
  lifecycleEvent: LifecycleEvent;
  affectedServices?: string;
}

export function generateCustomerSummary(context: CustomerSummaryContext): string {
  const { incident, vendor, lifecycleEvent, affectedServices } = context;
  const vendorName = vendor.name;
  const status = incident.status as CanonicalStatus;
  const severity = incident.severity as CanonicalSeverity;
  
  switch (lifecycleEvent) {
    case 'new':
      return generateNewIncidentSummary(vendorName, severity, affectedServices);
    case 'escalation':
      return generateEscalationSummary(vendorName, severity, affectedServices);
    case 'update':
      return generateUpdateSummary(vendorName, status, affectedServices);
    case 'resolved':
      return generateResolvedSummary(vendorName, affectedServices);
    case 'long_running':
      return generateLongRunningSummary(vendorName, affectedServices);
    default:
      return generateGenericSummary(vendorName, status);
  }
}

function generateNewIncidentSummary(vendorName: string, severity: CanonicalSeverity, affectedServices?: string): string {
  const impactPhrase = getImpactPhrase(severity);
  const servicesPhrase = affectedServices ? ` affecting ${affectedServices}` : '';
  
  return `We are aware of ${impactPhrase}${servicesPhrase}. ` +
    `The issue is being actively investigated by ${vendorName}. ` +
    `We will provide updates as more information becomes available.`;
}

function generateEscalationSummary(vendorName: string, severity: CanonicalSeverity, affectedServices?: string): string {
  const impactPhrase = severity === 'critical' 
    ? 'a significant service disruption' 
    : 'an increased service impact';
  const servicesPhrase = affectedServices ? ` Services affected include ${affectedServices}.` : '';
  
  return `${vendorName} has reported ${impactPhrase}.${servicesPhrase} ` +
    `Our team is actively monitoring the situation and we will provide updates as they become available.`;
}

function generateUpdateSummary(vendorName: string, status: CanonicalStatus, affectedServices?: string): string {
  const statusPhrase = getStatusPhrase(status);
  const servicesPhrase = affectedServices ? ` affecting ${affectedServices}` : '';
  
  return `Update: ${vendorName} ${statusPhrase}${servicesPhrase}. ` +
    `We continue to monitor the situation and will keep you informed of any changes.`;
}

function generateResolvedSummary(vendorName: string, affectedServices?: string): string {
  const servicesPhrase = affectedServices ? ` that affected ${affectedServices}` : '';
  
  return `The previously reported issue with ${vendorName}${servicesPhrase} has been resolved. ` +
    `All services should now be operating normally. We apologize for any inconvenience this may have caused.`;
}

function generateLongRunningSummary(vendorName: string, affectedServices?: string): string {
  const servicesPhrase = affectedServices ? ` affecting ${affectedServices}` : '';
  
  return `The ongoing issue with ${vendorName}${servicesPhrase} continues to be addressed. ` +
    `${vendorName} is working to resolve this matter. We will notify you when the issue is resolved.`;
}

function generateGenericSummary(vendorName: string, status: CanonicalStatus): string {
  const statusPhrase = getStatusPhrase(status);
  
  return `${vendorName} ${statusPhrase}. ` +
    `We are monitoring the situation and will provide updates as more information becomes available.`;
}

function getImpactPhrase(severity: CanonicalSeverity): string {
  switch (severity) {
    case 'critical':
      return 'a major service outage';
    case 'major':
      return 'a significant service disruption';
    case 'minor':
      return 'a minor service issue';
    case 'info':
      return 'a service notification';
    default:
      return 'a service issue';
  }
}

function getStatusPhrase(status: CanonicalStatus): string {
  switch (status) {
    case 'investigating':
      return 'is investigating a reported issue';
    case 'identified':
      return 'has identified the root cause and is working on a fix';
    case 'monitoring':
      return 'has implemented a fix and is monitoring the situation';
    case 'resolved':
      return 'has resolved the issue';
    default:
      return 'is addressing a service issue';
  }
}

export function generateCustomerSummarySms(context: CustomerSummaryContext): string {
  const { vendor, lifecycleEvent, affectedServices } = context;
  const vendorName = vendor.name;
  
  const affectedText = affectedServices ? ` (${affectedServices})` : '';
  
  switch (lifecycleEvent) {
    case 'new':
      return `${vendorName}${affectedText} issue detected. Under investigation. Updates to follow.`;
    case 'escalation':
      return `${vendorName}${affectedText} issue escalated. Actively monitored. Updates to follow.`;
    case 'resolved':
      return `${vendorName}${affectedText} issue resolved. Normal operations resumed.`;
    case 'long_running':
      return `${vendorName}${affectedText} issue ongoing. Still under investigation.`;
    default:
      return `${vendorName}${affectedText} status update. Monitoring continues.`;
  }
}
