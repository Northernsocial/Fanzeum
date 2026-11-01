import type { PlanTier, UserProfile } from '../types/domain';

export interface PlanEntitlements {
  maxCollections: number;
  maxMonthlyAiIdentifications: number;
  canBulkUpload: boolean;
  commissionRatePercent: number;
  label: string;
}

const PLAN_LIMITS: Record<PlanTier, PlanEntitlements> = {
  free: {
    maxCollections: 5,
    maxMonthlyAiIdentifications: 25,
    canBulkUpload: true,
    commissionRatePercent: 8.5,
    label: 'Collector (Free)',
  },
  premium: {
    maxCollections: 9999,
    maxMonthlyAiIdentifications: 9999,
    canBulkUpload: true,
    commissionRatePercent: 4.5,
    label: 'Patron (Premium)',
  },
  store: {
    maxCollections: 9999,
    maxMonthlyAiIdentifications: 9999,
    canBulkUpload: true,
    commissionRatePercent: 3.5,
    label: 'Gallery & Store',
  },
};

export function getEntitlements(profile: UserProfile | null | undefined): PlanEntitlements {
  const tier: PlanTier = profile?.plan ?? 'free';
  return PLAN_LIMITS[tier];
}

export function canCreateCollection(
  profile: UserProfile | null | undefined,
  currentCount: number,
): { allowed: boolean; reason?: string } {
  if (!profile) {
    return { allowed: false, reason: 'Sign in to create a collection.' };
  }
  const entitlements = getEntitlements(profile);
  if (currentCount >= entitlements.maxCollections) {
    return {
      allowed: false,
      reason: `Free collector accounts include up to ${entitlements.maxCollections} collections. Upgrade in Phase 6 for unlimited galleries.`,
    };
  }
  return { allowed: true };
}

export function formatGbp(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);
}

export function formatGbpRange(min: number, max: number): string {
  if (min <= 0 && max <= 0) return 'Unvalued';
  if (min === max) return formatGbp(min);
  return `${formatGbp(min)} – ${formatGbp(max)}`;
}

export function sanitizeHandle(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
  return cleaned.length >= 2 ? cleaned : `curator_${Math.floor(100 + Math.random() * 900)}`;
}
