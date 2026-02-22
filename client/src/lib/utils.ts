import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normalize legacy tier names for display (platinum -> Enterprise)
export function normalizeTierDisplay(tier: string | null | undefined): string {
  if (!tier) return 'Free';
  if (tier.toLowerCase() === 'platinum') return 'Enterprise';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export function formatDateInTimezone(date: Date | string, timezone: string = getBrowserTimezone()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return d.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return d.toLocaleString();
  }
}

export function formatShortDateInTimezone(date: Date | string, timezone: string = getBrowserTimezone()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return d.toLocaleString('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return d.toLocaleString();
  }
}
