interface PendingIncident {
  vendorKey: string;
  incidentId: string;
  firstSeenAt: number;
  confirmCount: number;
  data: any;
}

const pendingVendorIncidents = new Map<string, PendingIncident>();
const pendingBlockchainIncidents = new Map<string, PendingIncident>();

const CONFIRMATION_THRESHOLD = 2;
const MAX_PENDING_AGE_MS = 30 * 60 * 1000;

function makeKey(vendorKey: string, incidentId: string): string {
  return `${vendorKey}:${incidentId}`;
}

export function confirmVendorIncident(vendorKey: string, incidentId: string, data: any): boolean {
  const key = makeKey(vendorKey, incidentId);
  const existing = pendingVendorIncidents.get(key);

  if (!existing) {
    pendingVendorIncidents.set(key, {
      vendorKey,
      incidentId,
      firstSeenAt: Date.now(),
      confirmCount: 1,
      data,
    });
    console.log(`[confirm] Vendor ${vendorKey} incident ${incidentId} first detection, awaiting confirmation`);
    return false;
  }

  existing.confirmCount++;
  existing.data = data;

  if (existing.confirmCount >= CONFIRMATION_THRESHOLD) {
    pendingVendorIncidents.delete(key);
    console.log(`[confirm] Vendor ${vendorKey} incident ${incidentId} confirmed after ${existing.confirmCount} detections`);
    return true;
  }

  console.log(`[confirm] Vendor ${vendorKey} incident ${incidentId} seen ${existing.confirmCount}/${CONFIRMATION_THRESHOLD} times`);
  return false;
}

export function confirmBlockchainIncident(chainKey: string, incidentId: string, data: any): boolean {
  const key = makeKey(chainKey, incidentId);
  const existing = pendingBlockchainIncidents.get(key);

  if (!existing) {
    pendingBlockchainIncidents.set(key, {
      vendorKey: chainKey,
      incidentId,
      firstSeenAt: Date.now(),
      confirmCount: 1,
      data,
    });
    console.log(`[confirm] Blockchain ${chainKey} incident ${incidentId} first detection, awaiting confirmation`);
    return false;
  }

  existing.confirmCount++;
  existing.data = data;

  if (existing.confirmCount >= CONFIRMATION_THRESHOLD) {
    pendingBlockchainIncidents.delete(key);
    console.log(`[confirm] Blockchain ${chainKey} incident ${incidentId} confirmed after ${existing.confirmCount} detections`);
    return true;
  }

  console.log(`[confirm] Blockchain ${chainKey} incident ${incidentId} seen ${existing.confirmCount}/${CONFIRMATION_THRESHOLD} times`);
  return false;
}

export function clearConfirmedIncident(vendorKey: string, incidentId: string, type: 'vendor' | 'blockchain'): void {
  const key = makeKey(vendorKey, incidentId);
  if (type === 'vendor') {
    pendingVendorIncidents.delete(key);
  } else {
    pendingBlockchainIncidents.delete(key);
  }
}

export function cleanupStalePendingIncidents(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of pendingVendorIncidents.entries()) {
    if (now - entry.firstSeenAt > MAX_PENDING_AGE_MS) {
      pendingVendorIncidents.delete(key);
      cleaned++;
    }
  }

  for (const [key, entry] of pendingBlockchainIncidents.entries()) {
    if (now - entry.firstSeenAt > MAX_PENDING_AGE_MS) {
      pendingBlockchainIncidents.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[confirm] Cleaned up ${cleaned} stale pending incidents`);
  }
}

export function getPendingIncidentStats(): { vendor: number; blockchain: number } {
  return {
    vendor: pendingVendorIncidents.size,
    blockchain: pendingBlockchainIncidents.size,
  };
}
