import {
  IDENTIFY_HOURLY_LIMIT,
  IDENTIFY_WINDOW_MS,
  PANEL_DAILY_LIMIT,
  PANEL_DAILY_WINDOW_MS,
  PREGRADE_FREE_MONTHLY_LIMIT,
  PREGRADE_MONTHLY_WINDOW_MS,
} from './constants.ts';

const buckets = new Map<string, number[]>();
const panelDailyBuckets = new Map<string, number[]>();
const preGradeBuckets = new Map<string, number[]>();

function pruneBucket(key: string, now: number): number[] {
  const existing = buckets.get(key) || [];
  const active = existing.filter((ts) => now - ts < IDENTIFY_WINDOW_MS);
  if (active.length === 0) {
    buckets.delete(key);
  } else {
    buckets.set(key, active);
  }
  return active;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkIdentifyRateLimit(params: {
  ip?: string | null;
  userId?: string | null;
}): RateLimitResult {
  const now = Date.now();
  const keys: string[] = [];

  const cleanIp = (params.ip || 'anon-ip').trim().slice(0, 96);
  keys.push(`ip:${cleanIp}`);

  if (params.userId && params.userId.trim()) {
    keys.push(`uid:${params.userId.trim().slice(0, 128)}`);
  }

  let minRemaining = IDENTIFY_HOURLY_LIMIT;

  for (const key of keys) {
    const timestamps = pruneBucket(key, now);
    if (timestamps.length >= IDENTIFY_HOURLY_LIMIT) {
      const oldest = timestamps[0] || now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((IDENTIFY_WINDOW_MS - (now - oldest)) / 1000),
      );
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }
    minRemaining = Math.min(minRemaining, IDENTIFY_HOURLY_LIMIT - timestamps.length - 1);
  }

  for (const key of keys) {
    const timestamps = buckets.get(key) || [];
    timestamps.push(now);
    buckets.set(key, timestamps);
  }

  return {
    allowed: true,
    remaining: Math.max(0, minRemaining),
    retryAfterSeconds: 0,
  };
}

export function checkPreGradeMonthlyRateLimit(params: {
  userId: string;
  isPremium?: boolean;
}): RateLimitResult {
  if (params.isPremium) {
    return {
      allowed: true,
      remaining: 9999,
      retryAfterSeconds: 0,
    };
  }

  const now = Date.now();
  const key = `pregrade:${params.userId.trim()}`;
  const existing = preGradeBuckets.get(key) || [];
  const active = existing.filter((ts) => now - ts < PREGRADE_MONTHLY_WINDOW_MS);

  if (active.length >= PREGRADE_FREE_MONTHLY_LIMIT) {
    const oldest = active[0] || now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((PREGRADE_MONTHLY_WINDOW_MS - (now - oldest)) / 1000),
    );
    preGradeBuckets.set(key, active);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  active.push(now);
  preGradeBuckets.set(key, active);

  return {
    allowed: true,
    remaining: Math.max(0, PREGRADE_FREE_MONTHLY_LIMIT - active.length),
    retryAfterSeconds: 0,
  };
}

export function checkPanelDailyRateLimit(params: {
  ip?: string | null;
  userId?: string | null;
}): RateLimitResult {
  const now = Date.now();
  const keys: string[] = [];

  const cleanIp = (params.ip || 'anon-ip').trim().slice(0, 96);
  keys.push(`panel_ip:${cleanIp}`);

  if (params.userId && params.userId.trim()) {
    keys.push(`panel_uid:${params.userId.trim().slice(0, 128)}`);
  }

  let minRemaining = PANEL_DAILY_LIMIT;

  for (const key of keys) {
    const existing = panelDailyBuckets.get(key) || [];
    const active = existing.filter((ts) => now - ts < PANEL_DAILY_WINDOW_MS);
    if (active.length === 0) {
      panelDailyBuckets.delete(key);
    } else {
      panelDailyBuckets.set(key, active);
    }

    if (active.length >= PANEL_DAILY_LIMIT) {
      const oldest = active[0] || now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((PANEL_DAILY_WINDOW_MS - (now - oldest)) / 1000),
      );
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }
    minRemaining = Math.min(minRemaining, PANEL_DAILY_LIMIT - active.length - 1);
  }

  for (const key of keys) {
    const timestamps = panelDailyBuckets.get(key) || [];
    timestamps.push(now);
    panelDailyBuckets.set(key, timestamps);
  }

  return {
    allowed: true,
    remaining: Math.max(0, minRemaining),
    retryAfterSeconds: 0,
  };
}
