import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  serverTimestamp,
  where,
  limit,
} from 'firebase/firestore';
import type {
  CollectibleItemRecord,
  SwapRecord,
  TradePartnerSuggestion,
  UserProfile,
  WantItemRecord,
} from '../types/domain';
import { db } from './firebase';
import {
  fetchUserProfile,
  listOwnerItems,
  explorePublicItems,
} from './firestoreRepo';
import { fetchUserWants } from './interactionRepo';

export async function counterSwapProposal(params: {
  swapId: string;
  recipientId: string;
  recipientItemIds: string[];
  cashTopUpGbp?: number;
  cashPayer?: 'none' | 'proposer' | 'recipient';
  note?: string;
  isVerifiedUser: boolean;
}): Promise<void> {
  const { swapId, recipientId, recipientItemIds, cashTopUpGbp, cashPayer, note, isVerifiedUser } = params;
  if (!isVerifiedUser) {
    throw new Error('You must verify your email to counter a trade.');
  }
  const swapRef = doc(db, 'swaps', swapId);
  const snap = await getDoc(swapRef);
  if (!snap.exists()) {
    throw new Error('Trade proposal not found.');
  }
  const existing = snap.data() as SwapRecord;
  if (existing.status !== 'proposed') {
    throw new Error('This trade is no longer open for countering.');
  }
  if (existing.recipientId !== recipientId) {
    throw new Error('Only the recipient can counter this proposal.');
  }
  await updateDoc(swapRef, {
    status: 'countered',
    recipientItemIds,
    cashTopUpGbp: cashTopUpGbp || 0,
    cashPayer: cashPayer || 'none',
    note: note ? note.slice(0, 1000) : '',
    updatedAt: serverTimestamp(),
  });
}

export async function submitTradeRating(params: {
  swapId: string;
  userId: string;
  rating: number;
  note?: string;
  isVerifiedUser: boolean;
}): Promise<void> {
  const { swapId, userId, rating, note, isVerifiedUser } = params;
  if (!isVerifiedUser) {
    throw new Error('You must verify your email to rate a trade.');
  }
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }
  const swapRef = doc(db, 'swaps', swapId);
  const snap = await getDoc(swapRef);
  if (!snap.exists()) {
    throw new Error('Trade not found.');
  }
  const existing = snap.data() as SwapRecord;
  if (existing.status !== 'completed') {
    throw new Error('You can only rate completed trades.');
  }
  const isProposer = existing.proposerId === userId;
  const isRecipient = existing.recipientId === userId;
  if (!isProposer && !isRecipient) {
    throw new Error('You are not part of this trade.');
  }
  if (isProposer && existing.proposerRating !== undefined) {
    throw new Error('You have already rated this trade.');
  }
  if (isRecipient && existing.recipientRating !== undefined) {
    throw new Error('You have already rated this trade.');
  }
  const update: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (isProposer) {
    update.proposerRating = rating;
    if (note) update.proposerRatingNote = note.slice(0, 500);
  } else {
    update.recipientRating = rating;
    if (note) update.recipientRatingNote = note.slice(0, 500);
  }
  const bothRated = (isProposer ? existing.recipientRating : existing.proposerRating) !== undefined;
  if (bothRated) {
    update.ratingCompletedAt = serverTimestamp();
  }
  await updateDoc(swapRef, update);
}

export async function fetchTradePartnersForUser(params: {
  userId: string;
  maxResults?: number;
}): Promise<TradePartnerSuggestion[]> {
  const { userId, maxResults = 10 } = params;
  const userWants = await fetchUserWants(userId);
  const userItems = await listOwnerItems(userId, 200);
  const suggestionsMap = new Map<string, TradePartnerSuggestion>();

  async function getSuggestionForUser(user: UserProfile): Promise<TradePartnerSuggestion | null> {
    if (!user.handle) return null;
    if (suggestionsMap.has(user.handle)) {
      return suggestionsMap.get(user.handle)!;
    }
    const sug: TradePartnerSuggestion = {
      user,
      score: 0,
      reason: '',
      offeredItems: [],
      wantedItems: [],
    };
    suggestionsMap.set(user.handle, sug);
    return sug;
  }

  for (const want of userWants) {
    const { items } = await explorePublicItems({ category: want.category, pageSize: 100 });
    for (const item of items) {
      if (item.ownerId === userId) continue;
      const titleMatch = item.titleLower.includes(want.title.toLowerCase()) || want.title.toLowerCase().includes(item.titleLower);
      let keyFieldMatch = false;
      if (want.keyFields && Object.keys(want.keyFields).length > 0) {
        let matchCount = 0;
        let checkedCount = 0;
        for (const [k, v] of Object.entries(want.keyFields)) {
          if (!v) continue;
          checkedCount++;
          const targetStr = String(v).toLowerCase();
          const itemVal = item.attributes?.[k] || (item as unknown as Record<string, unknown>)[k];
          if (itemVal && String(itemVal).toLowerCase().includes(targetStr)) {
            matchCount++;
          }
        }
        if (checkedCount > 0 && matchCount >= Math.ceil(checkedCount / 2)) {
          keyFieldMatch = true;
        }
      }
      if (titleMatch || keyFieldMatch) {
        const owner = await fetchUserProfile(item.ownerId);
        if (!owner) continue;
        const sug = await getSuggestionForUser(owner);
        if (sug) {
          sug.offeredItems.push(item);
          sug.score += 1;
        }
      }
    }
  }

  for (const item of userItems) {
    if (item.visibility !== 'public') continue;
    const wantsQuery = query(
      collection(db, 'wants'),
      where('category', '==', item.category),
      limit(100),
    );
    const wantsSnap = await getDocs(wantsQuery);
    for (const wantDoc of wantsSnap.docs) {
      const want = { id: wantDoc.id, ...(wantDoc.data() as Omit<WantItemRecord, 'id'>) };
      if (want.userId === userId) continue;
      const titleMatch = item.titleLower.includes(want.title.toLowerCase()) || want.title.toLowerCase().includes(item.titleLower);
      let keyFieldMatch = false;
      if (want.keyFields && Object.keys(want.keyFields).length > 0) {
        let matchCount = 0;
        let checkedCount = 0;
        for (const [k, v] of Object.entries(want.keyFields)) {
          if (!v) continue;
          checkedCount++;
          const targetStr = String(v).toLowerCase();
          const itemVal = item.attributes?.[k] || (item as unknown as Record<string, unknown>)[k];
          if (itemVal && String(itemVal).toLowerCase().includes(targetStr)) {
            matchCount++;
          }
        }
        if (checkedCount > 0 && matchCount >= Math.ceil(checkedCount / 2)) {
          keyFieldMatch = true;
        }
      }
      if (titleMatch || keyFieldMatch) {
        const owner = await fetchUserProfile(want.userId);
        if (!owner) continue;
        const sug = await getSuggestionForUser(owner);
        if (sug) {
          sug.wantedItems.push(item);
          sug.score += 1;
        }
      }
    }
  }

  const suggestions: TradePartnerSuggestion[] = [];
  for (const sug of suggestionsMap.values()) {
    const parts: string[] = [];
    if (sug.offeredItems.length > 0) {
      parts.push(`Has ${sug.offeredItems.length} piece(s) you want`);
    }
    if (sug.wantedItems.length > 0) {
      parts.push(`Wants ${sug.wantedItems.length} of your piece(s)`);
    }
    sug.reason = parts.join('; ') || 'Potential trade partner';
    suggestions.push(sug);
  }
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, maxResults);
}
