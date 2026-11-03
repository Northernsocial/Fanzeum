import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type { CategorySlug } from '../config/categories';
import type { FollowRecord, FollowTargetType } from '../types/domain';
import { db, handleFirestoreError, OperationType } from './firebase';

const LOCAL_FOLLOWS_KEY = 'fanzeum_local_follows_v1';

// Pre-seeded realistic follower & following base counts for demo collectors
export const DEMO_COLLECTOR_BASE_COUNTS: Record<string, { followers: number; following: number }> = {
  demo_dez_panini: { followers: 148, following: 29 },
  demo_helen_sg1: { followers: 312, following: 44 },
  demo_marcus_denarii: { followers: 205, following: 38 },
  demo_priya_longbox: { followers: 176, following: 51 },
  demo_terry_wigansoul: { followers: 194, following: 62 },
  demo_gav_cardback: { followers: 163, following: 33 },
};

export function makeFollowId(followerId: string, targetType: FollowTargetType, targetId: string): string {
  return `${followerId}_${targetType}_${targetId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface LocalFollowMap {
  [followId: string]: {
    followerId: string;
    targetType: FollowTargetType;
    targetId: string;
    createdAt: string;
  };
}

function getLocalFollows(): LocalFollowMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_FOLLOWS_KEY);
    return raw ? (JSON.parse(raw) as LocalFollowMap) : {};
  } catch {
    return {};
  }
}

function saveLocalFollows(map: LocalFollowMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_FOLLOWS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

export function isLocallyFollowing(
  followerId: string,
  targetType: FollowTargetType,
  targetId: string,
): boolean {
  const followId = makeFollowId(followerId, targetType, targetId);
  const local = getLocalFollows();
  return Boolean(local[followId]);
}

/**
 * Follow a target (category or collector).
 * Writes to Firestore /follows/{followId} if logged in and email verified.
 * Always mirrors in local storage for instant responsiveness and offline/demo support.
 */
export async function followTarget(params: {
  followerId: string;
  targetType: FollowTargetType;
  targetId: string;
  isVerifiedUser?: boolean;
}): Promise<void> {
  const { followerId, targetType, targetId, isVerifiedUser } = params;
  const followId = makeFollowId(followerId, targetType, targetId);

  // Mirror locally first
  const local = getLocalFollows();
  local[followId] = {
    followerId,
    targetType,
    targetId,
    createdAt: new Date().toISOString(),
  };
  saveLocalFollows(local);

  if (isVerifiedUser && !followerId.startsWith('guest_')) {
    const path = `follows/${followId}`;
    try {
      const followData = {
        followerId,
        targetType,
        targetId,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'follows', followId), followData);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }
}

/**
 * Unfollow a target (category or collector).
 */
export async function unfollowTarget(params: {
  followerId: string;
  targetType: FollowTargetType;
  targetId: string;
  isVerifiedUser?: boolean;
}): Promise<void> {
  const { followerId, targetType, targetId, isVerifiedUser } = params;
  const followId = makeFollowId(followerId, targetType, targetId);

  const local = getLocalFollows();
  delete local[followId];
  saveLocalFollows(local);

  if (isVerifiedUser && !followerId.startsWith('guest_')) {
    const path = `follows/${followId}`;
    try {
      await deleteDoc(doc(db, 'follows', followId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
}

/**
 * Check if a user is following a target (live check with local fallback).
 */
export async function checkIsFollowing(
  followerId: string,
  targetType: FollowTargetType,
  targetId: string,
): Promise<boolean> {
  if (!followerId) return false;
  const followId = makeFollowId(followerId, targetType, targetId);

  // Check local first for instant cache hit
  const local = getLocalFollows();
  if (local[followId]) return true;

  if (followerId.startsWith('guest_')) return false;

  try {
    const snap = await getDoc(doc(db, 'follows', followId));
    if (snap.exists()) {
      // Backfill local cache
      local[followId] = {
        followerId,
        targetType,
        targetId,
        createdAt: new Date().toISOString(),
      };
      saveLocalFollows(local);
      return true;
    }
  } catch {
    // Return local state on network error
  }
  return false;
}

/**
 * Fetch all categories followed by a user.
 */
export async function fetchFollowedCategories(uid?: string | null): Promise<CategorySlug[]> {
  const local = getLocalFollows();
  const localCats = new Set<CategorySlug>();

  for (const f of Object.values(local)) {
    if ((!uid || f.followerId === uid) && f.targetType === 'category') {
      localCats.add(f.targetId as CategorySlug);
    }
  }

  if (!uid || uid.startsWith('guest_')) {
    return Array.from(localCats);
  }

  try {
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', uid),
      where('targetType', '==', 'category'),
      limit(50),
    );
    const snap = await getDocs(q);
    const liveCats = new Set<CategorySlug>(localCats);
    for (const d of snap.docs) {
      const data = d.data() as FollowRecord;
      if (data.targetId) liveCats.add(data.targetId as CategorySlug);
    }
    return Array.from(liveCats);
  } catch {
    return Array.from(localCats);
  }
}

/**
 * Fetch all collectors followed by a user.
 */
export async function fetchFollowedCollectors(uid?: string | null): Promise<string[]> {
  const local = getLocalFollows();
  const localUsers = new Set<string>();

  for (const f of Object.values(local)) {
    if ((!uid || f.followerId === uid) && f.targetType === 'user') {
      localUsers.add(f.targetId);
    }
  }

  if (!uid || uid.startsWith('guest_')) {
    return Array.from(localUsers);
  }

  try {
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', uid),
      where('targetType', '==', 'user'),
      limit(100),
    );
    const snap = await getDocs(q);
    const liveUsers = new Set<string>(localUsers);
    for (const d of snap.docs) {
      const data = d.data() as FollowRecord;
      if (data.targetId) liveUsers.add(data.targetId);
    }
    return Array.from(liveUsers);
  } catch {
    return Array.from(localUsers);
  }
}

/**
 * Fetch follower count for a collector.
 * Combines demo baseline, live Firestore count, and local adjustment.
 */
export async function fetchFollowerCount(collectorUid: string, currentViewerUid?: string | null): Promise<number> {
  const base = DEMO_COLLECTOR_BASE_COUNTS[collectorUid]?.followers || 0;

  let firestoreCount = 0;
  try {
    const q = query(
      collection(db, 'follows'),
      where('targetType', '==', 'user'),
      where('targetId', '==', collectorUid),
      limit(1000),
    );
    const snap = await getDocs(q);
    firestoreCount = snap.size;
  } catch {
    // Fall back to base
  }

  // Check if current viewer is following locally
  const viewerId = currentViewerUid || 'guest_user';
  const followId = makeFollowId(viewerId, 'user', collectorUid);
  const local = getLocalFollows();
  const isFollowingLocally = Boolean(local[followId]);

  if (base > 0) {
    return base + (isFollowingLocally ? 1 : 0) + firestoreCount;
  }
  return Math.max(firestoreCount, isFollowingLocally ? 1 : 0);
}

/**
 * Fetch following count for a collector.
 */
export async function fetchFollowingCount(collectorUid: string): Promise<number> {
  const base = DEMO_COLLECTOR_BASE_COUNTS[collectorUid]?.following || 0;

  try {
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', collectorUid),
      where('targetType', '==', 'user'),
      limit(500),
    );
    const snap = await getDocs(q);
    if (snap.size > 0) return Math.max(base, snap.size);
  } catch {
    // Fall back to base
  }

  const local = getLocalFollows();
  let localFollowingCount = 0;
  for (const f of Object.values(local)) {
    if (f.followerId === collectorUid && f.targetType === 'user') {
      localFollowingCount += 1;
    }
  }

  return base + localFollowingCount;
}
