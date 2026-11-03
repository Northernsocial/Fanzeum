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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { CategorySlug } from '../config/categories';
import type {
  CollectibleItemRecord,
  CollectionRecord,
  IdCorrectionRecord,
  IdCorrectionStatus,
  ItemSignalRecord,
  ItemSignalType,
  NotificationRecord,
  NotificationType,
  WantItemRecord,
} from '../types/domain';
import { db, handleFirestoreError, OperationType } from './firebase';
import { makeSafeId, updateCollectibleItemRecord } from './firestoreRepo';

// Local storage fallbacks for guest/demo interaction simulation
const LOCAL_SIGNALS_KEY = 'fanzeum_local_item_signals';
const LOCAL_WANTS_KEY = 'fanzeum_local_wants';
const LOCAL_CORRECTIONS_KEY = 'fanzeum_local_id_corrections';
const LOCAL_NOTIFS_KEY = 'fanzeum_local_notifications';

function getLocalJson<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalJson<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore storage quota
  }
}

// -----------------------------------------------------------------------------
// 1. ID Corrections
// -----------------------------------------------------------------------------

export async function suggestIdCorrection(params: {
  itemId: string;
  itemOwnerId: string;
  suggesterId: string;
  suggesterHandle: string;
  suggesterName: string;
  suggestedCorrection: string;
  note?: string;
  isVerifiedUser: boolean;
}): Promise<IdCorrectionRecord> {
  const correctionId = makeSafeId('idc');
  const now = new Date().toISOString();
  const record: IdCorrectionRecord = {
    id: correctionId,
    itemId: params.itemId,
    itemOwnerId: params.itemOwnerId,
    suggesterId: params.suggesterId,
    suggesterHandle: params.suggesterHandle.replace(/^@+/, ''),
    suggesterName: params.suggesterName.slice(0, 80),
    suggestedCorrection: params.suggestedCorrection.trim().slice(0, 200),
    note: params.note ? params.note.trim().slice(0, 1000) : '',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  if (!params.isVerifiedUser) {
    const list = getLocalJson<IdCorrectionRecord[]>(LOCAL_CORRECTIONS_KEY, []);
    setLocalJson(LOCAL_CORRECTIONS_KEY, [record, ...list]);
    return record;
  }

  const path = `idCorrections/${correctionId}`;
  try {
    await setDoc(doc(db, 'idCorrections', correctionId), {
      itemId: record.itemId,
      itemOwnerId: record.itemOwnerId,
      suggesterId: record.suggesterId,
      suggesterHandle: record.suggesterHandle,
      suggesterName: record.suggesterName,
      suggestedCorrection: record.suggestedCorrection,
      ...(record.note ? { note: record.note } : {}),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Notify item owner about suggested ID correction
    void createInAppNotification({
      userId: record.itemOwnerId,
      type: 'id_correction_received',
      title: 'Suggested ID correction',
      message: `@${record.suggesterHandle} suggested: "${record.suggestedCorrection}"`,
      itemId: record.itemId,
      itemTitle: 'Item',
      itemCategory: 'memorabilia',
      isVerifiedUser: params.isVerifiedUser,
    });

    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listIdCorrectionsForItem(
  itemId: string,
  isVerifiedUser: boolean,
): Promise<IdCorrectionRecord[]> {
  const localList = getLocalJson<IdCorrectionRecord[]>(LOCAL_CORRECTIONS_KEY, []).filter(
    (c) => c.itemId === itemId,
  );

  if (!isVerifiedUser) {
    return localList;
  }

  const path = 'idCorrections';
  try {
    const q = query(
      collection(db, 'idCorrections'),
      where('itemId', '==', itemId),
      limit(50),
    );
    const snap = await getDocs(q);
    const live = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<IdCorrectionRecord, 'id'>),
    }));
    // Merge live with local fallback
    const seen = new Set(live.map((l) => l.id));
    return [...live, ...localList.filter((l) => !seen.has(l.id))];
  } catch {
    return localList;
  }
}

export async function acceptIdCorrection(params: {
  correction: IdCorrectionRecord;
  item: CollectibleItemRecord;
  collectionRecord: CollectionRecord;
  isVerifiedUser: boolean;
}): Promise<void> {
  const helperAttribution = `@${params.correction.suggesterHandle}`;

  if (!params.isVerifiedUser) {
    const list = getLocalJson<IdCorrectionRecord[]>(LOCAL_CORRECTIONS_KEY, []);
    setLocalJson(
      LOCAL_CORRECTIONS_KEY,
      list.map((c) => (c.id === params.correction.id ? { ...c, status: 'accepted' as IdCorrectionStatus } : c)),
    );
    return;
  }

  // 1. Update ID correction status in Firestore
  const path = `idCorrections/${params.correction.id}`;
  try {
    await updateDoc(doc(db, 'idCorrections', params.correction.id), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  // 2. Update item identification & helpedBy attribution
  const itemPath = `items/${params.item.id}`;
  try {
    await updateDoc(doc(db, 'items', params.item.id), {
      title: params.correction.suggestedCorrection.slice(0, 140),
      titleLower: params.correction.suggestedCorrection.slice(0, 140).toLowerCase(),
      helpedBy: helperAttribution.slice(0, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, itemPath);
  }

  // 3. Notify suggester that their ID correction was accepted
  void createInAppNotification({
    userId: params.correction.suggesterId,
    type: 'id_correction_accepted',
    title: 'ID correction accepted!',
    message: `@${params.item.ownerHandle} accepted your correction: "${params.correction.suggestedCorrection}"`,
    itemId: params.item.id,
    itemTitle: params.item.title,
    itemCategory: params.item.category,
    isVerifiedUser: params.isVerifiedUser,
  });
}

export async function dismissIdCorrection(params: {
  correctionId: string;
  isVerifiedUser: boolean;
}): Promise<void> {
  if (!params.isVerifiedUser) {
    const list = getLocalJson<IdCorrectionRecord[]>(LOCAL_CORRECTIONS_KEY, []);
    setLocalJson(
      LOCAL_CORRECTIONS_KEY,
      list.map((c) => (c.id === params.correctionId ? { ...c, status: 'dismissed' as IdCorrectionStatus } : c)),
    );
    return;
  }

  const path = `idCorrections/${params.correctionId}`;
  try {
    await updateDoc(doc(db, 'idCorrections', params.correctionId), {
      status: 'dismissed',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// -----------------------------------------------------------------------------
// 2. Got One / Want One Signals
// -----------------------------------------------------------------------------

export interface ItemSignalCounts {
  gotCount: number;
  wantCount: number;
}

export async function fetchItemSignalCounts(itemId: string): Promise<ItemSignalCounts> {
  const localList = getLocalJson<ItemSignalRecord[]>(LOCAL_SIGNALS_KEY, []).filter(
    (s) => s.itemId === itemId,
  );
  let gotCount = localList.filter((s) => s.signalType === 'got').length;
  let wantCount = localList.filter((s) => s.signalType === 'want').length;

  try {
    const q = query(collection(db, 'itemSignals'), where('itemId', '==', itemId), limit(200));
    const snap = await getDocs(q);
    if (!snap.empty) {
      let liveGot = 0;
      let liveWant = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.signalType === 'got') liveGot++;
        if (data.signalType === 'want') liveWant++;
      });
      gotCount = Math.max(gotCount, liveGot);
      wantCount = Math.max(wantCount, liveWant);
    }
  } catch {
    // Return fallback counts
  }

  return { gotCount, wantCount };
}

export async function fetchUserItemSignals(
  userId: string,
  itemIds: string[],
): Promise<Record<string, { hasGot: boolean; hasWant: boolean }>> {
  const result: Record<string, { hasGot: boolean; hasWant: boolean }> = {};
  itemIds.forEach((id) => {
    result[id] = { hasGot: false, hasWant: false };
  });

  const localList = getLocalJson<ItemSignalRecord[]>(LOCAL_SIGNALS_KEY, []).filter(
    (s) => s.userId === userId,
  );
  localList.forEach((s) => {
    if (result[s.itemId]) {
      if (s.signalType === 'got') result[s.itemId].hasGot = true;
      if (s.signalType === 'want') result[s.itemId].hasWant = true;
    }
  });

  if (!userId || userId === 'guest_user') return result;

  try {
    const q = query(collection(db, 'itemSignals'), where('userId', '==', userId), limit(250));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data();
      const iId = String(data.itemId);
      if (result[iId]) {
        if (data.signalType === 'got') result[iId].hasGot = true;
        if (data.signalType === 'want') result[iId].hasWant = true;
      }
    });
  } catch {
    // Continue with local
  }

  return result;
}

export async function toggleItemSignal(params: {
  itemId: string;
  userId: string;
  signalType: ItemSignalType;
  isVerifiedUser: boolean;
}): Promise<{ active: boolean }> {
  const signalDocId = `${params.userId}_${params.itemId}_${params.signalType}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const localList = getLocalJson<ItemSignalRecord[]>(LOCAL_SIGNALS_KEY, []);
  const existingIdx = localList.findIndex(
    (s) => s.itemId === params.itemId && s.userId === params.userId && s.signalType === params.signalType,
  );

  let willBeActive = true;
  if (existingIdx >= 0) {
    localList.splice(existingIdx, 1);
    setLocalJson(LOCAL_SIGNALS_KEY, localList);
    willBeActive = false;
  } else {
    localList.push({
      id: signalDocId,
      itemId: params.itemId,
      userId: params.userId,
      signalType: params.signalType,
      createdAt: new Date().toISOString(),
    });
    setLocalJson(LOCAL_SIGNALS_KEY, localList);
  }

  if (!params.isVerifiedUser) {
    return { active: willBeActive };
  }

  const docRef = doc(db, 'itemSignals', signalDocId);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await deleteDoc(docRef);
      return { active: false };
    } else {
      await setDoc(docRef, {
        itemId: params.itemId,
        userId: params.userId,
        signalType: params.signalType,
        createdAt: serverTimestamp(),
      });
      return { active: true };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `itemSignals/${signalDocId}`);
    return { active: willBeActive };
  }
}

// -----------------------------------------------------------------------------
// 3. Wantlist Management
// -----------------------------------------------------------------------------

export async function fetchUserWants(userId: string): Promise<WantItemRecord[]> {
  const localList = getLocalJson<WantItemRecord[]>(LOCAL_WANTS_KEY, []).filter(
    (w) => w.userId === userId,
  );

  if (!userId || userId === 'guest_user') return localList;

  const path = 'wants';
  try {
    const q = query(collection(db, 'wants'), where('userId', '==', userId), limit(150));
    const snap = await getDocs(q);
    const live = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WantItemRecord, 'id'>),
    }));
    const seen = new Set(live.map((l) => l.id));
    return [...live, ...localList.filter((l) => !seen.has(l.id))];
  } catch {
    return localList;
  }
}

export async function addWant(params: {
  userId: string;
  category: CategorySlug;
  title: string;
  keyFields: Record<string, string | boolean>;
  notes: string;
  maxPriceGbp?: number;
  isVerifiedUser: boolean;
}): Promise<WantItemRecord> {
  const wantId = makeSafeId('wnt');
  const now = new Date().toISOString();
  const cleanTitle = (params.title.trim() || 'Wanted Piece').slice(0, 140);
  const cleanNotes = (params.notes || '').slice(0, 1000);
  const maxPrice = params.maxPriceGbp !== undefined ? Math.max(0, Number(params.maxPriceGbp)) : undefined;

  const record: WantItemRecord = {
    id: wantId,
    userId: params.userId,
    category: params.category,
    title: cleanTitle,
    keyFields: params.keyFields,
    notes: cleanNotes,
    ...(maxPrice !== undefined ? { maxPriceGbp: maxPrice } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const localList = getLocalJson<WantItemRecord[]>(LOCAL_WANTS_KEY, []);
  setLocalJson(LOCAL_WANTS_KEY, [record, ...localList]);

  if (!params.isVerifiedUser) {
    return record;
  }

  const path = `wants/${wantId}`;
  try {
    await setDoc(doc(db, 'wants', wantId), {
      userId: record.userId,
      category: record.category,
      title: record.title,
      keyFields: record.keyFields,
      notes: record.notes,
      ...(maxPrice !== undefined ? { maxPriceGbp: maxPrice } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWant(params: {
  wantId: string;
  category: CategorySlug;
  title: string;
  keyFields: Record<string, string | boolean>;
  notes: string;
  maxPriceGbp?: number;
  isVerifiedUser: boolean;
}): Promise<void> {
  const cleanTitle = (params.title.trim() || 'Wanted Piece').slice(0, 140);
  const cleanNotes = (params.notes || '').slice(0, 1000);
  const maxPrice = params.maxPriceGbp !== undefined ? Math.max(0, Number(params.maxPriceGbp)) : undefined;

  const localList = getLocalJson<WantItemRecord[]>(LOCAL_WANTS_KEY, []);
  setLocalJson(
    LOCAL_WANTS_KEY,
    localList.map((w) =>
      w.id === params.wantId
        ? {
            ...w,
            category: params.category,
            title: cleanTitle,
            keyFields: params.keyFields,
            notes: cleanNotes,
            maxPriceGbp: maxPrice,
            updatedAt: new Date().toISOString(),
          }
        : w,
    ),
  );

  if (!params.isVerifiedUser) return;

  const path = `wants/${params.wantId}`;
  try {
    const payload: Record<string, unknown> = {
      category: params.category,
      title: cleanTitle,
      keyFields: params.keyFields,
      notes: cleanNotes,
      updatedAt: serverTimestamp(),
    };
    if (maxPrice !== undefined) {
      payload.maxPriceGbp = maxPrice;
    }
    await updateDoc(doc(db, 'wants', params.wantId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWant(params: {
  wantId: string;
  isVerifiedUser: boolean;
}): Promise<void> {
  const localList = getLocalJson<WantItemRecord[]>(LOCAL_WANTS_KEY, []);
  setLocalJson(
    LOCAL_WANTS_KEY,
    localList.filter((w) => w.id !== params.wantId),
  );

  if (!params.isVerifiedUser) return;

  const path = `wants/${params.wantId}`;
  try {
    await deleteDoc(doc(db, 'wants', params.wantId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addPieceToWantlist(params: {
  item: CollectibleItemRecord;
  userId: string;
  isVerifiedUser: boolean;
}): Promise<WantItemRecord> {
  const keyFields: Record<string, string | boolean> = {};
  if (params.item.year) keyFields.year = params.item.year;
  if (params.item.maker) keyFields.maker = params.item.maker;
  if (params.item.setNumber) keyFields.setNumber = params.item.setNumber;
  if (params.item.attributes) {
    Object.entries(params.item.attributes).forEach(([k, v]) => {
      if (typeof v === 'string' || typeof v === 'boolean') {
        keyFields[k] = v;
      }
    });
  }

  return addWant({
    userId: params.userId,
    category: params.item.category,
    title: params.item.title,
    keyFields,
    notes: `Added from @${params.item.ownerHandle}'s piece`,
    maxPriceGbp: params.item.valueMaxGbp || undefined,
    isVerifiedUser: params.isVerifiedUser,
  });
}

// -----------------------------------------------------------------------------
// 4. In-App Notifications & Matching Alerts
// -----------------------------------------------------------------------------

export async function fetchUserNotifications(
  userId: string,
  isVerifiedUser: boolean,
): Promise<NotificationRecord[]> {
  const localList = getLocalJson<NotificationRecord[]>(LOCAL_NOTIFS_KEY, []).filter(
    (n) => n.userId === userId,
  );

  if (!isVerifiedUser || !userId) return localList;

  const path = 'notifications';
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      limit(50),
    );
    const snap = await getDocs(q);
    const live = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<NotificationRecord, 'id'>),
    }));
    const seen = new Set(live.map((l) => l.id));
    return [...live, ...localList.filter((l) => !seen.has(l.id))];
  } catch {
    return localList;
  }
}

export async function createInAppNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  itemId: string;
  itemTitle: string;
  itemCategory: CategorySlug;
  isVerifiedUser: boolean;
}): Promise<NotificationRecord> {
  const notifId = makeSafeId('notif');
  const now = new Date().toISOString();
  const record: NotificationRecord = {
    id: notifId,
    userId: params.userId,
    type: params.type,
    title: params.title.slice(0, 140),
    message: params.message.slice(0, 500),
    itemId: params.itemId,
    itemTitle: params.itemTitle.slice(0, 140),
    itemCategory: params.itemCategory,
    read: false,
    createdAt: now,
  };

  const localList = getLocalJson<NotificationRecord[]>(LOCAL_NOTIFS_KEY, []);
  setLocalJson(LOCAL_NOTIFS_KEY, [record, ...localList]);

  if (!params.isVerifiedUser) {
    return record;
  }

  const path = `notifications/${notifId}`;
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      userId: record.userId,
      type: record.type,
      title: record.title,
      message: record.message,
      itemId: record.itemId,
      itemTitle: record.itemTitle,
      itemCategory: record.itemCategory,
      read: false,
      createdAt: serverTimestamp(),
    });
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(params: {
  notificationId: string;
  isVerifiedUser: boolean;
}): Promise<void> {
  const localList = getLocalJson<NotificationRecord[]>(LOCAL_NOTIFS_KEY, []);
  setLocalJson(
    LOCAL_NOTIFS_KEY,
    localList.map((n) => (n.id === params.notificationId ? { ...n, read: true } : n)),
  );

  if (!params.isVerifiedUser) return;

  const path = `notifications/${params.notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', params.notificationId), {
      read: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Checks all active wants in the same category and generates in-app notifications
 * for users when a matching piece is published. Runs client-side on piece creation for free.
 */
export async function checkAndTriggerWantAlerts(newItem: CollectibleItemRecord): Promise<void> {
  if (newItem.visibility !== 'public') return;

  try {
    // 1. Query wants with same category
    const q = query(
      collection(db, 'wants'),
      where('category', '==', newItem.category),
      limit(100),
    );
    const snap = await getDocs(q);
    const wants = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WantItemRecord, 'id'>),
    }));

    // 2. Evaluate matches
    const newTitleTokens = newItem.title.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    for (const want of wants) {
      // Don't alert the owner about their own item
      if (want.userId === newItem.ownerId) continue;

      const wantTitleLower = want.title.toLowerCase();
      // Check title match (contains title or key tokens)
      const titleMatch =
        newItem.titleLower.includes(wantTitleLower) ||
        wantTitleLower.includes(newItem.titleLower) ||
        newTitleTokens.some((tok) => wantTitleLower.includes(tok));

      // Check key-fields match (e.g. year, maker, setNumber)
      let keyFieldMatch = false;
      if (want.keyFields && Object.keys(want.keyFields).length > 0) {
        let matchCount = 0;
        let checkedCount = 0;
        for (const [k, v] of Object.entries(want.keyFields)) {
          if (!v) continue;
          checkedCount++;
          const targetStr = String(v).toLowerCase();
          const itemVal = newItem.attributes?.[k] || (newItem as unknown as Record<string, unknown>)[k];
          if (itemVal && String(itemVal).toLowerCase().includes(targetStr)) {
            matchCount++;
          }
        }
        if (checkedCount > 0 && matchCount >= Math.ceil(checkedCount / 2)) {
          keyFieldMatch = true;
        }
      }

      if (titleMatch || keyFieldMatch) {
        // Create in-app notification for the wantlist owner
        await createInAppNotification({
          userId: want.userId,
          type: 'want_match',
          title: 'Want alert: Fresh Find match!',
          message: `A new Fresh Find matches your want "${want.title}": "${newItem.title}" from @${newItem.ownerHandle}`,
          itemId: newItem.id,
          itemTitle: newItem.title,
          itemCategory: newItem.category,
          isVerifiedUser: true,
        });
      }
    }
  } catch (err) {
    console.error('Failed to process want alerts:', err);
  }
}
