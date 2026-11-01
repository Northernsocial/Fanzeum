import { IDENTIFY_HOURLY_LIMIT, IDENTIFY_WINDOW_MS } from './constants.ts';

const buckets = new Map<string, number[]>();

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
