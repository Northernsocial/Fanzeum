import type { PlanTier, UserProfile } from '../types/domain';

export type GatedFeature = 'identify' | 'create_collection' | 'bulk_upload' | 'pre_grade';

export interface PlanEntitlements {
  maxCollections: number;
  hourlyAiIdentifications: number;
  monthlyPreGrades: number;
  canBulkUpload: boolean;
  commissionRatePercent: number;
  label: string;
}

const PLAN_LIMITS: Record<PlanTier, PlanEntitlements> = {
  free: {
    maxCollections: 1,
    hourlyAiIdentifications: 20,
    monthlyPreGrades: 3,
    canBulkUpload: false,
    commissionRatePercent: 8.5,
    label: 'Collector (Free)',
  },
  premium: {
    maxCollections: 9999,
    hourlyAiIdentifications: 100,
    monthlyPreGrades: 9999,
    canBulkUpload: true,
    commissionRatePercent: 4.5,
    label: 'Collector Plus',
  },
  store: {
    maxCollections: 9999,
    hourlyAiIdentifications: 500,
    monthlyPreGrades: 9999,
    canBulkUpload: true,
    commissionRatePercent: 3.5,
    label: 'Dealer & Store',
  },
};

export function isPremium(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.plan === 'premium' || profile.plan === 'store' || profile.role === 'admin';
}

export function getEntitlements(profile: UserProfile | null | undefined): PlanEntitlements {
  const tier: PlanTier = isPremium(profile) ? (profile?.plan === 'store' ? 'store' : 'premium') : 'free';
  return PLAN_LIMITS[tier];
}

export function canPreGrade(
  user: UserProfile | null | undefined,
  monthlyCountUsed = 0,
): { allowed: boolean; remaining: number; reason?: string } {
  if (!user) {
    return { allowed: false, remaining: 0, reason: 'Sign in to run an AI pre-grade on your piece.' };
  }
  const limits = getEntitlements(user);
  if (isPremium(user)) {
    return { allowed: true, remaining: 9999 };
  }
  const remaining = Math.max(0, limits.monthlyPreGrades - monthlyCountUsed);
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      reason: `You have reached your limit of ${limits.monthlyPreGrades} pre-grades this month. Upgrade to Collector Plus for unlimited AI pre-grades.`,
    };
  }
  return { allowed: true, remaining };
}

export function canUse(
  feature: GatedFeature,
  user: UserProfile | null | undefined,
  context?: { currentCollectionsCount?: number; preGradesThisMonth?: number },
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'Sign in first to use this feature.' };
  }

  const limits = getEntitlements(user);

  if (feature === 'create_collection') {
    const count = context?.currentCollectionsCount ?? user.collectionsCount ?? 0;
    if (count >= limits.maxCollections) {
      return {
        allowed: false,
        reason: `Free collectors get ${limits.maxCollections} collection of up to 20 items. Go Premium for unlimited.`,
      };
    }
    return { allowed: true };
  }

  if (feature === 'identify') {
    return { allowed: true };
  }

  if (feature === 'bulk_upload') {
    if (!limits.canBulkUpload) {
      return {
        allowed: false,
        reason: 'Bulk spreadsheet and multi-tray upload arrives with Collector Plus and Dealer plans.',
      };
    }
    return { allowed: true };
  }

  if (feature === 'pre_grade') {
    const check = canPreGrade(user, context?.preGradesThisMonth ?? 0);
    return { allowed: check.allowed, reason: check.reason };
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
  if (min <= 0 && max <= 0) return 'No estimate';
  if (min === max) return formatGbp(min);
  return `${formatGbp(min)}–${formatGbp(max)}`;
}

export function sanitizeHandle(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
  return cleaned.length >= 2 ? cleaned : `collector_${Math.floor(100 + Math.random() * 900)}`;
}
