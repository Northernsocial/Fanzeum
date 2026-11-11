import { FREE_MAX_COLLECTIONS, FREE_MAX_ITEMS } from '../config/planLimits';
import type { PlanTier, UserProfile } from '../types/domain';

export type GatedFeature = 'identify' | 'create_collection' | 'bulk_upload';

export interface PlanEntitlements {
  maxCollections: number;
  hourlyAiIdentifications: number;
  canBulkUpload: boolean;
  commissionRatePercent: number;
  label: string;
}

const PLAN_LIMITS: Record<PlanTier, PlanEntitlements> = {
  free: {
    maxCollections: 1,
    hourlyAiIdentifications: 20,
    canBulkUpload: false,
    commissionRatePercent: 8.5,
    label: 'Collector (Free)',
  },
  premium: {
    maxCollections: 9999,
    hourlyAiIdentifications: 100,
    canBulkUpload: true,
    commissionRatePercent: 4.5,
    label: 'Collector Plus',
  },
  store: {
    maxCollections: 9999,
    hourlyAiIdentifications: 500,
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

export function canUse(
  feature: GatedFeature,
  user: UserProfile | null | undefined,
  context?: { currentCollectionsCount?: number },
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
        reason: `Free collectors get ${FREE_MAX_COLLECTIONS} showcase with up to ${FREE_MAX_ITEMS} items. Go Premium for unlimited.`,
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

export function canAddItem(
  profile: UserProfile | null | undefined,
  currentItemCount: number,
): boolean {
  if (!profile) return false;
  if (isPremium(profile)) return true;
  return currentItemCount < FREE_MAX_ITEMS;
}

export function getUsageText(
  profile: UserProfile | null | undefined,
  currentItemCount: number,
): string | null {
  if (!profile || isPremium(profile)) return null;
  return `${Math.min(currentItemCount, FREE_MAX_ITEMS)} of ${FREE_MAX_ITEMS} items`;
}

export function getCollectionUsageText(
  profile: UserProfile | null | undefined,
  currentCollectionCount: number,
): string | null {
  if (!profile || isPremium(profile)) return null;
  return `${Math.min(currentCollectionCount, FREE_MAX_COLLECTIONS)} of ${FREE_MAX_COLLECTIONS} showcase`;
}
