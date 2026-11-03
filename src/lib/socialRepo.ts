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
  writeBatch,
} from 'firebase/firestore';
import type {
  CollectibleItemRecord,
  ItemCommentRecord,
  ReportRecord,
  UserProfile,
} from '../types/domain';
import { db, handleFirestoreError, OperationType } from './firebase';
import { fetchItemById, makeSafeId } from './firestoreRepo';

const LOCAL_LIKES_KEY = 'fanzeum_local_likes_v1';
const LOCAL_SAVES_KEY = 'fanzeum_local_saves_v1';
const LOCAL_COMMENTS_KEY = 'fanzeum_local_comments_v1';

// Seeded base counts for demo items so they show realistic community activity
export const DEMO_ITEM_BASE_STATS: Record<string, { likes: number; saves: number; commentsCount: number }> = {
  demo_item_1: { likes: 38, saves: 14, commentsCount: 3 },
  demo_item_2: { likes: 52, saves: 23, commentsCount: 5 },
  demo_item_3: { likes: 19, saves: 7, commentsCount: 1 },
  demo_item_4: { likes: 45, saves: 18, commentsCount: 2 },
  demo_item_5: { likes: 27, saves: 9, commentsCount: 2 },
  demo_item_6: { likes: 64, saves: 31, commentsCount: 6 },
};

function getLocalMap(key: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function setLocalMap(key: string, map: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Ignore quota issues
  }
}

function getLocalComments(): Record<string, ItemCommentRecord[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_COMMENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ItemCommentRecord[]>) : {};
  } catch {
    return {};
  }
}

function setLocalComments(comments: Record<string, ItemCommentRecord[]>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
  } catch {
    // Ignore quota issues
  }
}

/* =========================================================================
   1. LIKES (One like per user per item, doc id = uid)
   ========================================================================= */

export async function fetchItemLikeState(
  itemId: string,
  uid?: string | null,
): Promise<{ liked: boolean; count: number }> {
  const baseCount = DEMO_ITEM_BASE_STATS[itemId]?.likes || 0;
  const viewerUid = uid || 'guest_user';
  const localKey = `${itemId}_${viewerUid}`;
  const localLikes = getLocalMap(LOCAL_LIKES_KEY);
  const localLiked = Boolean(localLikes[localKey]);

  let firestoreCount = 0;
  let firestoreLiked = false;

  if (itemId && !itemId.startsWith('demo_')) {
    try {
      const likesColl = collection(db, 'items', itemId, 'likes');
      const snap = await getDocs(query(likesColl, limit(200)));
      firestoreCount = snap.size;
      if (uid && !uid.startsWith('guest_')) {
        firestoreLiked = snap.docs.some((d) => d.id === uid);
      }
    } catch {
      // Return local state on network error
    }
  }

  const isLiked = firestoreLiked || localLiked;
  const count = Math.max(0, baseCount + firestoreCount + (localLiked && !firestoreLiked ? 1 : 0));

  return { liked: isLiked, count };
}

export async function toggleItemLike(params: {
  itemId: string;
  uid: string;
  isVerifiedUser?: boolean;
}): Promise<boolean> {
  const { itemId, uid, isVerifiedUser } = params;
  const localKey = `${itemId}_${uid}`;
  const localLikes = getLocalMap(LOCAL_LIKES_KEY);
  const willLike = !localLikes[localKey];

  if (willLike) {
    localLikes[localKey] = true;
  } else {
    delete localLikes[localKey];
  }
  setLocalMap(LOCAL_LIKES_KEY, localLikes);

  if (isVerifiedUser && !uid.startsWith('guest_') && !itemId.startsWith('demo_')) {
    const likeDocRef = doc(db, 'items', itemId, 'likes', uid);
    try {
      if (willLike) {
        await setDoc(likeDocRef, {
          uid,
          itemId,
          createdAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(likeDocRef);
      }
    } catch (err) {
      handleFirestoreError(err, willLike ? OperationType.CREATE : OperationType.DELETE, `items/${itemId}/likes/${uid}`);
    }
  }

  return willLike;
}

/* =========================================================================
   2. SAVES (One bookmark per user per item, doc id = uid)
   ========================================================================= */

export async function fetchItemSaveState(
  itemId: string,
  uid?: string | null,
): Promise<{ saved: boolean; count: number }> {
  const baseCount = DEMO_ITEM_BASE_STATS[itemId]?.saves || 0;
  const viewerUid = uid || 'guest_user';
  const localKey = `${itemId}_${viewerUid}`;
  const localSaves = getLocalMap(LOCAL_SAVES_KEY);
  const localSaved = Boolean(localSaves[localKey]);

  let firestoreCount = 0;
  let firestoreSaved = false;

  if (itemId && !itemId.startsWith('demo_')) {
    try {
      const savesColl = collection(db, 'items', itemId, 'saves');
      const snap = await getDocs(query(savesColl, limit(200)));
      firestoreCount = snap.size;
      if (uid && !uid.startsWith('guest_')) {
        firestoreSaved = snap.docs.some((d) => d.id === uid);
      }
    } catch {
      // Fallback
    }
  }

  const isSaved = firestoreSaved || localSaved;
  const count = Math.max(0, baseCount + firestoreCount + (localSaved && !firestoreSaved ? 1 : 0));

  return { saved: isSaved, count };
}

export async function toggleItemSave(params: {
  itemId: string;
  uid: string;
  isVerifiedUser?: boolean;
}): Promise<boolean> {
  const { itemId, uid, isVerifiedUser } = params;
  const localKey = `${itemId}_${uid}`;
  const localSaves = getLocalMap(LOCAL_SAVES_KEY);
  const willSave = !localSaves[localKey];

  if (willSave) {
    localSaves[localKey] = true;
  } else {
    delete localSaves[localKey];
  }
  setLocalMap(LOCAL_SAVES_KEY, localSaves);

  if (isVerifiedUser && !uid.startsWith('guest_') && !itemId.startsWith('demo_')) {
    const itemSaveRef = doc(db, 'items', itemId, 'saves', uid);
    const userSaveRef = doc(db, 'users', uid, 'saves', itemId);
    try {
      const batch = writeBatch(db);
      if (willSave) {
        const payload = {
          uid,
          itemId,
          createdAt: serverTimestamp(),
        };
        batch.set(itemSaveRef, payload);
        batch.set(userSaveRef, payload);
      } else {
        batch.delete(itemSaveRef);
        batch.delete(userSaveRef);
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(
        err,
        willSave ? OperationType.CREATE : OperationType.DELETE,
        `items/${itemId}/saves/${uid}`,
      );
    }
  }

  return willSave;
}

export async function fetchUserSavedItems(uid: string): Promise<CollectibleItemRecord[]> {
  const itemIds = new Set<string>();

  // Check local saved items for this user
  const localSaves = getLocalMap(LOCAL_SAVES_KEY);
  for (const key of Object.keys(localSaves)) {
    if (key.endsWith(`_${uid}`) && localSaves[key]) {
      const itmId = key.slice(0, key.lastIndexOf(`_${uid}`));
      if (itmId) itemIds.add(itmId);
    }
  }

  // Check Firestore user index if signed in
  if (uid && !uid.startsWith('guest_')) {
    try {
      const q = query(collection(db, 'users', uid, 'saves'), limit(100));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        itemIds.add(d.id);
      }
    } catch {
      // Continue with local items
    }
  }

  const items: CollectibleItemRecord[] = [];
  const fetches = Array.from(itemIds).map(async (id) => {
    try {
      const itm = await fetchItemById(id);
      if (itm) items.push(itm);
    } catch {
      // Ignore missing or deleted items
    }
  });

  await Promise.all(fetches);
  return items;
}

/* =========================================================================
   3. COMMENTS (Plain text up to 1,000 characters; author edit/delete, item owner delete)
   ========================================================================= */

export async function fetchItemComments(itemId: string): Promise<ItemCommentRecord[]> {
  const localComments = getLocalComments();
  const cached = localComments[itemId] || [];

  if (itemId.startsWith('demo_')) {
    return cached;
  }

  try {
    const q = query(collection(db, 'items', itemId, 'comments'), limit(100));
    const snap = await getDocs(q);
    const live: ItemCommentRecord[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        itemId,
        authorId: String(data.authorId || ''),
        authorName: String(data.authorName || 'Collector'),
        authorHandle: String(data.authorHandle || 'collector'),
        authorAvatarUrl: String(data.authorAvatarUrl || ''),
        text: String(data.text || ''),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    // Merge with any local comments not yet synced
    const seen = new Set(live.map((c) => c.id));
    for (const c of cached) {
      if (!seen.has(c.id)) {
        live.push(c);
      }
    }
    return live;
  } catch {
    return cached;
  }
}

export async function createItemComment(params: {
  itemId: string;
  author: UserProfile;
  text: string;
  isVerifiedUser?: boolean;
}): Promise<ItemCommentRecord> {
  const cleanText = params.text.trim().slice(0, 1000);
  if (!cleanText) {
    throw new Error('Comment cannot be blank.');
  }

  const commentId = makeSafeId('cmt');
  const commentRecord: ItemCommentRecord = {
    id: commentId,
    itemId: params.itemId,
    authorId: params.author.uid,
    authorName: params.author.displayName.slice(0, 80) || 'Collector',
    authorHandle: params.author.handle.slice(0, 32),
    authorAvatarUrl: (params.author.avatarUrl || '').slice(0, 2048),
    text: cleanText,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Cache locally
  const allComments = getLocalComments();
  const forItem = allComments[params.itemId] || [];
  allComments[params.itemId] = [commentRecord, ...forItem];
  setLocalComments(allComments);

  // Sync to Firestore if verified user on non-demo item
  if (params.isVerifiedUser && !params.itemId.startsWith('demo_')) {
    const docRef = doc(db, 'items', params.itemId, 'comments', commentId);
    try {
      await setDoc(docRef, {
        id: commentId,
        itemId: params.itemId,
        authorId: params.author.uid,
        authorName: commentRecord.authorName,
        authorHandle: commentRecord.authorHandle,
        authorAvatarUrl: commentRecord.authorAvatarUrl,
        text: cleanText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `items/${params.itemId}/comments/${commentId}`);
    }
  }

  return commentRecord;
}

export async function updateItemComment(params: {
  itemId: string;
  commentId: string;
  text: string;
  isVerifiedUser?: boolean;
}): Promise<void> {
  const cleanText = params.text.trim().slice(0, 1000);
  if (!cleanText) {
    throw new Error('Comment cannot be blank.');
  }

  // Update local
  const allComments = getLocalComments();
  const forItem = allComments[params.itemId] || [];
  const idx = forItem.findIndex((c) => c.id === params.commentId);
  if (idx !== -1) {
    forItem[idx] = { ...forItem[idx], text: cleanText, updatedAt: new Date().toISOString() };
    allComments[params.itemId] = forItem;
    setLocalComments(allComments);
  }

  if (params.isVerifiedUser && !params.itemId.startsWith('demo_')) {
    const docRef = doc(db, 'items', params.itemId, 'comments', params.commentId);
    try {
      await updateDoc(docRef, {
        text: cleanText,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `items/${params.itemId}/comments/${params.commentId}`);
    }
  }
}

export async function deleteItemComment(params: {
  itemId: string;
  commentId: string;
  isVerifiedUser?: boolean;
}): Promise<void> {
  // Delete local
  const allComments = getLocalComments();
  const forItem = allComments[params.itemId] || [];
  allComments[params.itemId] = forItem.filter((c) => c.id !== params.commentId);
  setLocalComments(allComments);

  if (params.isVerifiedUser && !params.itemId.startsWith('demo_')) {
    const docRef = doc(db, 'items', params.itemId, 'comments', params.commentId);
    try {
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `items/${params.itemId}/comments/${params.commentId}`);
    }
  }
}

/* =========================================================================
   4. REPORTS (Verified user write, strictly admin read only)
   ========================================================================= */

export async function submitContentReport(params: {
  reporterId: string;
  targetType: 'comment' | 'item';
  targetId: string;
  itemId: string;
  reason: string;
  isVerifiedUser?: boolean;
}): Promise<void> {
  const cleanReason = params.reason.trim().slice(0, 500);
  if (!cleanReason) {
    throw new Error('Please provide a reason for the report.');
  }

  const reportId = makeSafeId('rep');
  const path = `reports/${reportId}`;

  if (params.isVerifiedUser) {
    try {
      await setDoc(doc(db, 'reports', reportId), {
        reporterId: params.reporterId,
        targetType: params.targetType,
        targetId: params.targetId,
        itemId: params.itemId,
        reason: cleanReason,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }
}
