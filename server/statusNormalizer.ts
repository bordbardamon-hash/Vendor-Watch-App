import { CanonicalStatus, CanonicalSeverity, LifecycleEvent } from '@shared/schema';

const STATUS_MAPPINGS: Record<string, CanonicalStatus> = {
  'investigating': 'investigating',
  'identified': 'identified',
  'monitoring': 'monitoring',
  'resolved': 'resolved',
  'postmortem': 'resolved',
  'completed': 'resolved',
  'in_progress': 'identified',
  'scheduled': 'monitoring',
  'verifying': 'monitoring',
  'update': 'identified',
  'ongoing': 'investigating',
  'open': 'investigating',
  'active': 'investigating',
};

const SEVERITY_MAPPINGS: Record<string, CanonicalSeverity> = {
  'critical': 'critical',
  'major': 'major',
  'minor': 'minor',
  'info': 'info',
  'none': 'info',
  'maintenance': 'info',
  'partial_outage': 'major',
  'full_outage': 'critical',
  'degraded_performance': 'minor',
  'operational': 'info',
};

export function normalizeStatus(rawStatus: string): CanonicalStatus {
  const normalized = rawStatus?.toLowerCase().trim().replace(/[\s_-]+/g, '_');
  return STATUS_MAPPINGS[normalized] || 'investigating';
}

export function normalizeSeverity(rawSeverity: string): CanonicalSeverity {
  const normalized = rawSeverity?.toLowerCase().trim().replace(/[\s_-]+/g, '_');
  return SEVERITY_MAPPINGS[normalized] || 'minor';
}

export function mapStatuspageImpact(impact: string): CanonicalSeverity {
  switch (impact?.toLowerCase()) {
    case 'critical': return 'critical';
    case 'major': return 'major';
    case 'minor': return 'minor';
    case 'none': return 'info';
    default: return 'minor';
  }
}

export function mapStatuspageStatus(status: string): CanonicalStatus {
  switch (status?.toLowerCase()) {
    case 'investigating': return 'investigating';
    case 'identified': return 'identified';
    case 'monitoring': return 'monitoring';
    case 'resolved': return 'resolved';
    case 'postmortem': return 'resolved';
    case 'scheduled': return 'monitoring';
    case 'in_progress': return 'identified';
    case 'verifying': return 'monitoring';
    default: return 'investigating';
  }
}

export function determineLifecycleEvent(
  previousStatus: string | null,
  previousSeverity: string | null,
  currentStatus: CanonicalStatus,
  currentSeverity: CanonicalSeverity,
  isNew: boolean
): LifecycleEvent {
  // A brand-new incident that is already resolved is historical — don't notify
  if (isNew && currentStatus === 'resolved') return 'update';
  if (currentStatus === 'resolved') return 'resolved';
  if (isNew) return 'new';
  
  const severityOrder: Record<CanonicalSeverity, number> = {
    'info': 0,
    'minor': 1,
    'major': 2,
    'critical': 3,
  };
  
  const prevSeverityNormalized = normalizeSeverity(previousSeverity || 'info');
  if (severityOrder[currentSeverity] > severityOrder[prevSeverityNormalized]) {
    return 'escalation';
  }
  
  return 'update';
}

export function shouldAlertForEvent(
  event: LifecycleEvent,
  alertConfig?: { alertOnNew?: boolean; alertOnEscalation?: boolean; alertOnResolved?: boolean; alertOnUpdate?: boolean }
): boolean {
  const config = {
    alertOnNew: true,
    alertOnEscalation: true,
    alertOnResolved: true,
    alertOnUpdate: false,
    ...alertConfig,
  };

  switch (event) {
    case 'new': return config.alertOnNew;
    case 'escalation': return config.alertOnEscalation;
    case 'resolved': return config.alertOnResolved;
    case 'update': return config.alertOnUpdate;
    case 'long_running': return true;
    default: return false;
  }
}

export type SimpleStatus = 'up' | 'warn' | 'down' | 'maintenance';

export function normalizeToSimpleStatus(vendorStatus: string): SimpleStatus {
  const s = vendorStatus?.toLowerCase().trim();
  switch (s) {
    case 'operational':
      return 'up';
    case 'degraded':
    case 'degraded_performance':
    case 'partial_outage':
      return 'warn';
    case 'outage':
    case 'major_outage':
    case 'down':
    case 'critical':
      return 'down';
    case 'maintenance':
    case 'under_maintenance':
    case 'scheduled':
      return 'maintenance';
    default:
      return 'up';
  }
}

export function getSimpleStatusLabel(status: SimpleStatus): string {
  switch (status) {
    case 'up': return 'Up';
    case 'warn': return 'Warn';
    case 'down': return 'Down';
    case 'maintenance': return 'Maintenance';
  }
}

export function formatSeverityDisplay(severity: CanonicalSeverity): string {
  switch (severity) {
    case 'critical': return 'CRITICAL';
    case 'major': return 'MAJOR';
    case 'minor': return 'MINOR';
    case 'info': return 'INFO';
  }
}

export function formatStatusDisplay(status: CanonicalStatus): string {
  switch (status) {
    case 'investigating': return 'Investigating';
    case 'identified': return 'Identified';
    case 'monitoring': return 'Monitoring';
    case 'resolved': return 'Resolved';
  }
}
