import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  CollectorJourneyRecord,
  CollectorLevel,
  MentorshipRequestRecord,
  SetChecklistRecord,
  WeeklyChallengeRecord,
} from '../types/domain';
import type { CategorySlug } from '../config/categories';

export const LEVEL_THRESHOLDS: { level: CollectorLevel; minXp: number }[] = [
  { level: 'Rookie', minXp: 0 },
  { level: 'Enthusiast', minXp: 250 },
  { level: 'Connoisseur', minXp: 1000 },
  { level: 'Master', minXp: 3000 },
  { level: 'Legend', minXp: 7500 },
];

export function calculateLevel(xp: number): CollectorLevel {
  let current: CollectorLevel = 'Rookie';
  for (const t of LEVEL_THRESHOLDS) {
    if (xp >= t.minXp) current = t.level;
  }
  return current;
}

export async function fetchCollectorJourney(uid: string): Promise<CollectorJourneyRecord> {
  const path = `collectorJourneys/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'collectorJourneys', uid));
    if (!snap.exists()) {
      const defaultJourney: CollectorJourneyRecord = {
        uid,
        level: 'Rookie',
        xp: 10,
        itemsAddedCount: 0,
        setsCompletedCount: 0,
        helpfulCorrectionsCount: 0,
        positiveTradesCount: 0,
        communityAnswersCount: 0,
        badges: ['Founding Collector'],
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'collectorJourneys', uid), defaultJourney);
      return defaultJourney;
    }
    return snap.data() as CollectorJourneyRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function awardXp(uid: string, xpDelta: number, reasonBadge?: string): Promise<CollectorJourneyRecord> {
  const current = await fetchCollectorJourney(uid);
  const nextXp = Math.max(0, current.xp + xpDelta);
  const nextLevel = calculateLevel(nextXp);
  const nextBadges = [...current.badges];
  if (reasonBadge && !nextBadges.includes(reasonBadge)) {
    nextBadges.push(reasonBadge);
  }

  const payload = {
    ...current,
    xp: nextXp,
    level: nextLevel,
    badges: nextBadges,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'collectorJourneys', uid), payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `collectorJourneys/${uid}`);
  }
}

export async function fetchSetChecklist(collectionId: string): Promise<SetChecklistRecord | null> {
  const path = `setChecklists/${collectionId}`;
  try {
    const snap = await getDoc(doc(db, 'setChecklists', collectionId));
    if (!snap.exists()) return null;
    return snap.data() as SetChecklistRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveSetChecklist(params: {
  id: string;
  uid: string;
  collectionId: string;
  category: CategorySlug;
  setTitle: string;
  ownedIds: string[];
  totalTargetCount: number;
}): Promise<void> {
  const path = `setChecklists/${params.id}`;
  try {
    await setDoc(doc(db, 'setChecklists', params.id), {
      ...params,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchWeeklyChallenges(): Promise<WeeklyChallengeRecord[]> {
  try {
    const q = query(collection(db, 'weeklyChallenges'), limit(10));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as WeeklyChallengeRecord);
    }
  } catch {
    // Return built-in default challenges if offline or unseeded
  }

  return [
    {
      id: 'challenge_stamps_1',
      category: 'stamps',
      weekLabel: 'This Week in GB',
      title: 'Line-Engraved Hunt',
      description: 'Add 2 Victorian line-engraved GB stamps or imperf covers to your showcase.',
      targetCount: 2,
      rewardXp: 150,
      createdAt: new Date(),
    },
    {
      id: 'challenge_cards_1',
      category: 'football_cards',
      weekLabel: 'Premier League Rush',
      title: 'Refractor or Foil Chase',
      description: 'Log 3 foil, refractor or parallel cards in any football set.',
      targetCount: 3,
      rewardXp: 150,
      createdAt: new Date(),
    },
    {
      id: 'challenge_coins_1',
      category: 'coins',
      weekLabel: 'Numismatic Vault',
      title: 'Silver Hammered or Proof',
      description: 'Catalogue 1 silver hammered or Victorian sovereign piece.',
      targetCount: 1,
      rewardXp: 200,
      createdAt: new Date(),
    },
  ];
}

export async function requestMentorship(params: {
  menteeId: string;
  menteeHandle: string;
  category: CategorySlug;
  message: string;
}): Promise<string> {
  const requestId = `mentorship_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `mentorshipRequests/${requestId}`;
  try {
    await setDoc(doc(db, 'mentorshipRequests', requestId), {
      id: requestId,
      menteeId: params.menteeId,
      menteeHandle: params.menteeHandle,
      category: params.category,
      message: params.message.trim().slice(0, 1000),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return requestId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchMentorshipRequests(uid: string): Promise<MentorshipRequestRecord[]> {
  const path = 'mentorshipRequests';
  try {
    const q = query(collection(db, 'mentorshipRequests'), where('menteeId', '==', uid), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as MentorshipRequestRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
