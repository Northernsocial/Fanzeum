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
} from 'firebase/firestore';
import type { CategorySlug } from '../config/categories';
import type { CommunityPoll, CommunityReplyRecord, CommunityThreadRecord, UserProfile } from '../types/domain';
import { db, handleFirestoreError, OperationType } from './firebase';
import { makeSafeId } from './firestoreRepo';

const LOCAL_COMMUNITY_THREADS_KEY = 'fanzeum_local_community_threads_v1';
const LOCAL_COMMUNITY_REPLIES_KEY = 'fanzeum_local_community_replies_v1';
const LOCAL_COMMUNITY_MEMBERSHIPS_KEY = 'fanzeum_local_community_memberships_v1';

function getLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocalJson<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore quota issues
  }
}

export async function fetchCommunityThreads(category?: CategorySlug): Promise<CommunityThreadRecord[]> {
  const local = getLocalJson<CommunityThreadRecord[]>(LOCAL_COMMUNITY_THREADS_KEY, []);
  let live: CommunityThreadRecord[] = [];

  try {
    const q = category
      ? query(collection(db, 'communityThreads'), where('category', '==', category), limit(100))
      : query(collection(db, 'communityThreads'), limit(100));
    const snap = await getDocs(q);
    live = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CommunityThreadRecord, 'id'>),
    }));
  } catch {
    // Fallback to local
  }

  const seen = new Set(live.map((t) => t.id));
  const filteredLocal = category ? local.filter((t) => t.category === category) : local;
  for (const t of filteredLocal) {
    if (!seen.has(t.id)) live.push(t);
  }

  live.sort((a, b) => {
    const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds || new Date(String(a.createdAt || '')).getTime() || 0;
    const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds || new Date(String(b.createdAt || '')).getTime() || 0;
    return bSec - aSec;
  });

  return live;
}

export async function fetchThreadById(threadId: string): Promise<CommunityThreadRecord | null> {
  const local = getLocalJson<CommunityThreadRecord[]>(LOCAL_COMMUNITY_THREADS_KEY, []);
  const foundLocal = local.find((t) => t.id === threadId);

  try {
    const snap = await getDoc(doc(db, 'communityThreads', threadId));
    if (snap.exists()) {
      return {
        id: snap.id,
        ...(snap.data() as Omit<CommunityThreadRecord, 'id'>),
      };
    }
  } catch {
    // Fallback to local
  }

  return foundLocal || null;
}

export async function createCommunityThread(params: {
  profile: UserProfile;
  category: CategorySlug;
  title: string;
  body: string;
  photoUrl?: string;
  linkedItemId?: string;
  poll?: { question: string; options: string[] };
  isVerifiedUser: boolean;
}): Promise<CommunityThreadRecord> {
  const threadId = makeSafeId('thr');
  const now = new Date().toISOString();
  const cleanTitle = params.title.trim().slice(0, 140);
  const cleanBody = params.body.trim().slice(0, 3000);

  let pollRecord: CommunityPoll | undefined;
  if (params.poll && params.poll.question && params.poll.options.length >= 2) {
    const votes: Record<string, number> = {};
    params.poll.options.forEach((_, idx) => {
      votes[String(idx)] = 0;
    });
    pollRecord = {
      question: params.poll.question.trim().slice(0, 160),
      options: params.poll.options.map((o) => o.trim().slice(0, 80)).slice(0, 4),
      votes,
      userVotes: {},
    };
  }

  const record: CommunityThreadRecord = {
    id: threadId,
    category: params.category,
    authorId: params.profile.uid,
    authorName: params.profile.displayName.slice(0, 80) || 'Collector',
    authorHandle: params.profile.handle.slice(0, 32),
    authorAvatarUrl: (params.profile.avatarUrl || '').slice(0, 2048),
    title: cleanTitle,
    body: cleanBody,
    ...(params.photoUrl ? { photoUrl: params.photoUrl.slice(0, 2048) } : {}),
    ...(params.linkedItemId ? { linkedItemId: params.linkedItemId } : {}),
    ...(pollRecord ? { poll: pollRecord } : {}),
    replyCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const local = getLocalJson<CommunityThreadRecord[]>(LOCAL_COMMUNITY_THREADS_KEY, []);
  setLocalJson(LOCAL_COMMUNITY_THREADS_KEY, [record, ...local]);

  const path = `communityThreads/${threadId}`;
  try {
    await setDoc(doc(db, 'communityThreads', threadId), {
      id: threadId,
      category: record.category,
      authorId: record.authorId,
      authorName: record.authorName,
      authorHandle: record.authorHandle,
      authorAvatarUrl: record.authorAvatarUrl,
      title: record.title,
      body: record.body,
      ...(record.photoUrl ? { photoUrl: record.photoUrl } : {}),
      ...(record.linkedItemId ? { linkedItemId: record.linkedItemId } : {}),
      ...(record.poll ? { poll: record.poll } : {}),
      replyCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function voteCommunityPoll(params: {
  threadId: string;
  optionIndex: number;
  userId: string;
  isVerifiedUser: boolean;
}): Promise<CommunityThreadRecord | null> {
  const thread = await fetchThreadById(params.threadId);
  if (!thread || !thread.poll) return null;

  const poll = thread.poll;
  const previousVote = poll.userVotes[params.userId];
  if (previousVote !== undefined) {
    // Already voted
    return thread;
  }

  poll.userVotes[params.userId] = params.optionIndex;
  poll.votes[String(params.optionIndex)] = (poll.votes[String(params.optionIndex)] || 0) + 1;

  // Update local
  const local = getLocalJson<CommunityThreadRecord[]>(LOCAL_COMMUNITY_THREADS_KEY, []);
  setLocalJson(
    LOCAL_COMMUNITY_THREADS_KEY,
    local.map((t) => (t.id === params.threadId ? { ...t, poll } : t)),
  );

  try {
    await updateDoc(doc(db, 'communityThreads', params.threadId), {
      poll,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to save poll vote:', err);
  }

  return { ...thread, poll };
}

export async function fetchThreadReplies(threadId: string): Promise<CommunityReplyRecord[]> {
  const allReplies = getLocalJson<Record<string, CommunityReplyRecord[]>>(LOCAL_COMMUNITY_REPLIES_KEY, {});
  const local = allReplies[threadId] || [];
  let live: CommunityReplyRecord[] = [];

  try {
    const snap = await getDocs(query(collection(db, 'communityThreads', threadId, 'replies'), limit(150)));
    live = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        threadId,
        authorId: String(data.authorId || ''),
        authorName: String(data.authorName || 'Collector'),
        authorHandle: String(data.authorHandle || 'collector'),
        authorAvatarUrl: String(data.authorAvatarUrl || ''),
        text: String(data.text || ''),
        photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
        linkedItemId: data.linkedItemId ? String(data.linkedItemId) : undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
  } catch {
    // Fallback
  }

  const seen = new Set(live.map((r) => r.id));
  for (const r of local) {
    if (!seen.has(r.id)) live.push(r);
  }

  live.sort((a, b) => {
    const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds || new Date(String(a.createdAt || '')).getTime() || 0;
    const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds || new Date(String(b.createdAt || '')).getTime() || 0;
    return aSec - bSec;
  });

  return live;
}

export async function createThreadReply(params: {
  threadId: string;
  author: UserProfile;
  text: string;
  photoUrl?: string;
  linkedItemId?: string;
  isVerifiedUser: boolean;
}): Promise<CommunityReplyRecord> {
  const replyId = makeSafeId('rpl');
  const now = new Date().toISOString();
  const cleanText = params.text.trim().slice(0, 1500);

  const record: CommunityReplyRecord = {
    id: replyId,
    threadId: params.threadId,
    authorId: params.author.uid,
    authorName: params.author.displayName.slice(0, 80) || 'Collector',
    authorHandle: params.author.handle.slice(0, 32),
    authorAvatarUrl: (params.author.avatarUrl || '').slice(0, 2048),
    text: cleanText,
    ...(params.photoUrl ? { photoUrl: params.photoUrl.slice(0, 2048) } : {}),
    ...(params.linkedItemId ? { linkedItemId: params.linkedItemId } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const allReplies = getLocalJson<Record<string, CommunityReplyRecord[]>>(LOCAL_COMMUNITY_REPLIES_KEY, {});
  const threadReplies = allReplies[params.threadId] || [];
  allReplies[params.threadId] = [...threadReplies, record];
  setLocalJson(LOCAL_COMMUNITY_REPLIES_KEY, allReplies);

  const path = `communityThreads/${params.threadId}/replies/${replyId}`;
  try {
    await setDoc(doc(db, 'communityThreads', params.threadId, 'replies', replyId), {
      id: replyId,
      threadId: params.threadId,
      authorId: record.authorId,
      authorName: record.authorName,
      authorHandle: record.authorHandle,
      authorAvatarUrl: record.authorAvatarUrl,
      text: record.text,
      ...(record.photoUrl ? { photoUrl: record.photoUrl } : {}),
      ...(record.linkedItemId ? { linkedItemId: record.linkedItemId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const threadRef = doc(db, 'communityThreads', params.threadId);
    const threadSnap = await getDoc(threadRef);
    if (threadSnap.exists()) {
      const currentCount = Number(threadSnap.data().replyCount) || 0;
      await updateDoc(threadRef, { replyCount: currentCount + 1 });
    }

    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function fetchJoinedCommunities(uid?: string | null): CategorySlug[] {
  if (!uid) return ['football_cards', 'coins', 'stamps', 'trading_cards', 'comics', 'vinyl', 'toys', 'memorabilia'];
  const all = getLocalJson<Record<string, CategorySlug[]>>(LOCAL_COMMUNITY_MEMBERSHIPS_KEY, {});
  return all[uid] || ['football_cards', 'coins', 'stamps', 'trading_cards', 'comics', 'vinyl', 'toys', 'memorabilia'];
}

export function toggleCommunityMembership(uid: string, category: CategorySlug): CategorySlug[] {
  const all = getLocalJson<Record<string, CategorySlug[]>>(LOCAL_COMMUNITY_MEMBERSHIPS_KEY, {});
  const userComms = new Set<CategorySlug>(all[uid] || ['football_cards', 'coins', 'stamps', 'trading_cards', 'comics', 'vinyl', 'toys', 'memorabilia']);
  if (userComms.has(category)) {
    userComms.delete(category);
  } else {
    userComms.add(category);
  }
  const nextList = Array.from(userComms);
  all[uid] = nextList;
  setLocalJson(LOCAL_COMMUNITY_MEMBERSHIPS_KEY, all);
  return nextList;
}
