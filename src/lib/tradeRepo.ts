import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import type { TradeRecord, TradeItem, TradeRating } from '../types/domain';
import { makeSafeId } from './firestoreRepo';

export async function createTrade(params: {
  initiatorId: string;
  initiatorHandle: string;
  recipientId: string;
  recipientHandle: string;
  initiatorItems: TradeItem[];
  recipientItems: TradeItem[];
  gbpTopUpNote: string;
}): Promise<string> {
  const tradeId = makeSafeId('trade');
  const record: TradeRecord = {
    tradeId,
    initiatorId: params.initiatorId,
    initiatorHandle: params.initiatorHandle,
    recipientId: params.recipientId,
    recipientHandle: params.recipientHandle,
    initiatorItems: params.initiatorItems,
    recipientItems: params.recipientItems,
    gbpTopUpNote: params.gbpTopUpNote,
    state: 'pending',
    initiatorConfirmedSent: false,
    recipientConfirmedSent: false,
    initiatorConfirmedReceived: false,
    recipientConfirmedReceived: false,
    ratings: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'trades', tradeId), record);
  return tradeId;
}

export async function updateTradeState(params: {
  tradeId: string;
  state: TradeRecord['state'];
  initiatorConfirmedSent?: boolean;
  recipientConfirmedSent?: boolean;
  initiatorConfirmedReceived?: boolean;
  recipientConfirmedReceived?: boolean;
}): Promise<void> {
  const tradeRef = doc(db, 'trades', params.tradeId);
  const updates: Record<string, unknown> = {
    state: params.state,
    updatedAt: serverTimestamp(),
  };
  if (params.initiatorConfirmedSent !== undefined) updates.initiatorConfirmedSent = params.initiatorConfirmedSent;
  if (params.recipientConfirmedSent !== undefined) updates.recipientConfirmedSent = params.recipientConfirmedSent;
  if (params.initiatorConfirmedReceived !== undefined) updates.initiatorConfirmedReceived = params.initiatorConfirmedReceived;
  if (params.recipientConfirmedReceived !== undefined) updates.recipientConfirmedReceived = params.recipientConfirmedReceived;
  await updateDoc(tradeRef, updates);
}

export async function getTrade(tradeId: string): Promise<TradeRecord | null> {
  const snap = await getDoc(doc(db, 'trades', tradeId));
  if (!snap.exists()) return null;
  return { tradeId: snap.id, ...snap.data() } as TradeRecord;
}

export async function getUserTrades(userId: string): Promise<TradeRecord[]> {
  const q = query(
    collection(db, 'trades'),
    where('initiatorId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const initiatorTrades = snap.docs.map((doc) => ({ tradeId: doc.id, ...doc.data() } as TradeRecord));

  const q2 = query(
    collection(db, 'trades'),
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap2 = await getDocs(q2);
  const recipientTrades = snap2.docs.map((doc) => ({ tradeId: doc.id, ...doc.data() } as TradeRecord));

  // Deduplicate by tradeId
  const tradeMap = new Map<string, TradeRecord>();
  for (const trade of [...initiatorTrades, ...recipientTrades]) {
    if (!tradeMap.has(trade.tradeId)) {
      tradeMap.set(trade.tradeId, trade);
    }
  }
  const allTrades = Array.from(tradeMap.values());
  allTrades.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt as string | number | Date).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt as string | number | Date).getTime() : 0;
    return bTime - aTime;
  });
  return allTrades;
}

export async function getTradeSuggestions(params: {
  userId: string;
  haveItemIds: string[];
  wantItemIds: string[];
}): Promise<{ suggestion: TradeRecord; matchScore: number }[]> {
  const suggestions: { suggestion: TradeRecord; matchScore: number }[] = [];

  // Find users who have items we want
  const wantQ = query(
    collection(db, 'items'),
    where('ownerId', '!=', params.userId),
    where('id', 'in', params.wantItemIds.slice(0, 10)), // Firestore 'in' limit is 10
    limit(50)
  );
  const wantSnap = await getDocs(wantQ);
  const wantedItems = wantSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as import('../types/domain').CollectibleItemRecord));

  // Group by owner
  const ownerItems = new Map<string, import('../types/domain').CollectibleItemRecord[]>();
  for (const item of wantedItems) {
    if (!ownerItems.has(item.ownerId)) ownerItems.set(item.ownerId, []);
    ownerItems.get(item.ownerId)!.push(item);
  }

  // For each potential trade partner, check if they want something we have
  for (const [ownerId, items] of ownerItems) {
    // Check if this owner has wantlist items matching our items
    const theirWantsQ = query(
      collection(db, 'wants'),
      where('userId', '==', ownerId),
      limit(50)
    );
    const theirWantsSnap = await getDocs(theirWantsQ);
    const theirWants = theirWantsSnap.docs.map(doc => doc.data() as import('../types/domain').WantItemRecord);

    // Simple matching: do they want any of our items?
    let matchScore = 0;
    for (const want of theirWants) {
      // Check if we have an item matching their want (by category/title)
      const haveMatch = params.haveItemIds.some(haveId => {
        const haveItem = items.find(i => i.id === haveId);
        return haveItem && haveItem.category === want.category;
      });
      if (haveMatch) matchScore++;
    }

    if (matchScore > 0) {
      // Create a suggested trade record
      const suggestion: TradeRecord = {
        tradeId: `suggestion_${ownerId}`,
        initiatorId: params.userId,
        initiatorHandle: '', // Will be filled by UI
        recipientId: ownerId,
        recipientHandle: '', // Will be filled by UI
        initiatorItems: items.slice(0, 5).map(item => ({
          itemId: item.id,
          title: item.title,
          imageUrl: item.imageUrl,
          valueMinGbp: item.valueMinGbp,
          valueMaxGbp: item.valueMaxGbp,
        })),
        recipientItems: [], // Will be filled by UI based on user selection
        gbpTopUpNote: '',
        state: 'pending',
        initiatorConfirmedSent: false,
        recipientConfirmedSent: false,
        initiatorConfirmedReceived: false,
        recipientConfirmedReceived: false,
        ratings: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      suggestions.push({ suggestion, matchScore });
    }
  }

  return suggestions.sort((a, b) => b.matchScore - a.matchScore);
}

export async function confirmSent(tradeId: string, userId: string): Promise<void> {
  const trade = await getTrade(tradeId);
  if (!trade) throw new Error('Trade not found');

  if (trade.initiatorId === userId) {
    await updateTradeState({
      tradeId,
      state: 'confirmed_sent',
      initiatorConfirmedSent: true,
    });
  } else if (trade.recipientId === userId) {
    await updateTradeState({
      tradeId,
      state: 'confirmed_sent',
      recipientConfirmedSent: true,
    });
  } else {
    throw new Error('User not part of this trade');
  }
}

export async function confirmReceived(tradeId: string, userId: string): Promise<void> {
  const trade = await getTrade(tradeId);
  if (!trade) throw new Error('Trade not found');

  if (trade.initiatorId === userId) {
    await updateTradeState({
      tradeId,
      state: 'completed',
      initiatorConfirmedReceived: true,
    });
  } else if (trade.recipientId === userId) {
    await updateTradeState({
      tradeId,
      state: 'completed',
      recipientConfirmedReceived: true,
    });
  } else {
    throw new Error('User not part of this trade');
  }
}

export async function addRating(params: {
  tradeId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
}): Promise<void> {
  const trade = await getTrade(params.tradeId);
  if (!trade) throw new Error('Trade not found');

  const rating: TradeRating = {
    rating: params.rating,
    reviewerId: params.reviewerId,
    reviewedId: params.reviewedId,
    tradeId: params.tradeId,
    createdAt: new Date().toISOString(),
  };

  const updateField =
    trade.initiatorId === params.reviewerId ? 'ratings.recipient' : 'ratings.initiator';

  await updateDoc(doc(db, 'trades', params.tradeId), {
    [updateField]: rating,
    updatedAt: serverTimestamp(),
  });
}
