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
import { db, handleFirestoreError, OperationType } from './firebase';
import { sanitizeHandle } from './entitlements';
import type {
  AIConfidence,
  CategorySlug,
  CollectibleItemRecord,
  CollectionRecord,
  CollectorGoal,
  UserPrivateAccount,
  UserProfile,
  VisibilityLevel,
} from '../types/domain';
import { DEMO_COLLECTIONS, DEMO_ITEMS } from '../data/demoExhibitions';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

// 1. User Profile & Isolated Private GDPR Account
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchUserPrivateAccount(uid: string): Promise<UserPrivateAccount | null> {
  const path = `users/${uid}/private/account`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'account'));
    if (!snap.exists()) return null;
    return snap.data() as UserPrivateAccount;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function bootstrapVerifiedUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  analyticsConsent?: boolean;
}): Promise<{ profile: UserProfile; privateAccount: UserPrivateAccount }> {
  const path = `users/${params.uid}`;
  const cleanName = (params.displayName || params.email.split('@')[0] || 'Collector')
    .trim()
    .slice(0, 80);
  const cleanHandle = sanitizeHandle(cleanName);
  const safeAvatar = (params.avatarUrl || '').slice(0, 2048);
  const safeEmail = (params.email || 'collector@example.co.uk').trim().slice(0, 254);

  const profilePayload = {
    uid: params.uid,
    handle: cleanHandle,
    displayName: cleanName || 'Collector',
    bio: '',
    avatarUrl: safeAvatar,
    location: 'United Kingdom',
    specialties: [] as CategorySlug[],
    goal: 'exhibit' as CollectorGoal,
    role: 'collector' as const,
    plan: 'free' as const,
    isVerifiedExpert: false,
    isPublicProfile: true,
    onboardingCompleted: false,
    collectionsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const privatePayload = {
    uid: params.uid,
    email: safeEmail,
    analyticsConsent: Boolean(params.analyticsConsent),
    marketingConsent: false,
    aiTrainingOptOut: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', params.uid), profilePayload);
    batch.set(doc(db, 'users', params.uid, 'private', 'account'), privatePayload);
    await batch.commit();

    return {
      profile: { ...profilePayload },
      privateAccount: { ...privatePayload },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserPublicProfile(
  uid: string,
  updates: Partial<{
    handle: string;
    displayName: string;
    bio: string;
    avatarUrl: string;
    location: string;
    specialties: CategorySlug[];
    goal: CollectorGoal;
    isPublicProfile: boolean;
    onboardingCompleted: boolean;
    collectionsCount: number;
  }>,
): Promise<void> {
  const path = `users/${uid}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.handle !== undefined) payload.handle = sanitizeHandle(updates.handle);
  if (updates.displayName !== undefined) {
    payload.displayName = updates.displayName.trim().slice(0, 80) || 'Collector';
  }
  if (updates.bio !== undefined) payload.bio = updates.bio.slice(0, 600);
  if (updates.avatarUrl !== undefined) payload.avatarUrl = updates.avatarUrl.slice(0, 2048);
  if (updates.location !== undefined) payload.location = updates.location.slice(0, 80);
  if (updates.specialties !== undefined) payload.specialties = updates.specialties.slice(0, 10);
  if (updates.goal !== undefined) payload.goal = updates.goal;
  if (updates.isPublicProfile !== undefined) payload.isPublicProfile = updates.isPublicProfile;
  if (updates.onboardingCompleted !== undefined) {
    payload.onboardingCompleted = updates.onboardingCompleted;
  }
  if (updates.collectionsCount !== undefined) {
    payload.collectionsCount = Math.max(0, Math.min(10000, Math.round(updates.collectionsCount)));
  }

  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPrivacySettings(
  uid: string,
  updates: Partial<{
    analyticsConsent: boolean;
    marketingConsent: boolean;
    aiTrainingOptOut: boolean;
  }>,
): Promise<void> {
  const path = `users/${uid}/private/account`;
  try {
    await updateDoc(doc(db, 'users', uid, 'private', 'account'), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function listPublicCurators(maxResults = 24): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const q = query(
      collection(db, 'users'),
      where('isPublicProfile', '==', true),
      limit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// 2. Collections & Exhibitions
export async function listPublicCollections(maxResults = 24): Promise<CollectionRecord[]> {
  const path = 'collections';
  try {
    const q = query(
      collection(db, 'collections'),
      where('visibility', '==', 'public'),
      limit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CollectionRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listOwnerCollections(
  ownerId: string,
  maxResults = 50,
): Promise<CollectionRecord[]> {
  const path = 'collections';
  try {
    const q = query(
      collection(db, 'collections'),
      where('ownerId', '==', ownerId),
      limit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CollectionRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchCollectionById(collectionId: string): Promise<CollectionRecord | null> {
  const demoMatch = DEMO_COLLECTIONS.find((c) => c.id === collectionId);
  if (demoMatch) return demoMatch;

  const path = `collections/${collectionId}`;
  try {
    const snap = await getDoc(doc(db, 'collections', collectionId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<CollectionRecord, 'id'>),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createCollectionRecord(params: {
  profile: UserProfile;
  title: string;
  story: string;
  category: CategorySlug;
  visibility: VisibilityLevel;
  setTargetCount?: number;
  coverImageUrl?: string;
}): Promise<CollectionRecord> {
  const collectionId = makeSafeId('col');
  const path = `collections/${collectionId}`;

  const cleanTitle = params.title.trim().slice(0, 120);
  const safeTitle = cleanTitle.length >= 2 ? cleanTitle : 'Curated Archive';

  const recordData = {
    ownerId: params.profile.uid,
    ownerName: params.profile.displayName.slice(0, 80) || 'Collector',
    ownerHandle: sanitizeHandle(params.profile.handle),
    title: safeTitle,
    story: params.story.trim().slice(0, 2500),
    coverImageUrl: (params.coverImageUrl || '').slice(0, 180000),
    category: params.category,
    visibility: params.visibility,
    itemCount: 0,
    setTargetCount: Math.max(0, Math.min(50000, Math.round(params.setTargetCount || 0))),
    estimatedTotalMinGbp: 0,
    estimatedTotalMaxGbp: 0,
    featured: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'collections', collectionId), recordData);
    await updateUserPublicProfile(params.profile.uid, {
      collectionsCount: (params.profile.collectionsCount || 0) + 1,
    });
    return {
      id: collectionId,
      ...recordData,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCollectionDetails(
  collectionId: string,
  updates: Partial<{
    title: string;
    story: string;
    coverImageUrl: string;
    category: CategorySlug;
    visibility: VisibilityLevel;
    setTargetCount: number;
    itemCount: number;
    estimatedTotalMinGbp: number;
    estimatedTotalMaxGbp: number;
  }>,
): Promise<void> {
  const path = `collections/${collectionId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.title !== undefined) {
    const t = updates.title.trim().slice(0, 120);
    payload.title = t.length >= 2 ? t : 'Curated Archive';
  }
  if (updates.story !== undefined) payload.story = updates.story.slice(0, 2500);
  if (updates.coverImageUrl !== undefined) {
    payload.coverImageUrl = updates.coverImageUrl.slice(0, 180000);
  }
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.visibility !== undefined) payload.visibility = updates.visibility;
  if (updates.setTargetCount !== undefined) {
    payload.setTargetCount = Math.max(0, Math.min(50000, Math.round(updates.setTargetCount)));
  }
  if (updates.itemCount !== undefined) {
    payload.itemCount = Math.max(0, Math.min(50000, Math.round(updates.itemCount)));
  }
  if (updates.estimatedTotalMinGbp !== undefined) {
    payload.estimatedTotalMinGbp = Math.max(0, Number(updates.estimatedTotalMinGbp) || 0);
  }
  if (updates.estimatedTotalMaxGbp !== undefined) {
    payload.estimatedTotalMaxGbp = Math.max(0, Number(updates.estimatedTotalMaxGbp) || 0);
  }

  try {
    await updateDoc(doc(db, 'collections', collectionId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// 3. Collectible Items & Aggregate Sync
export async function listCollectionItems(
  collectionRecord: CollectionRecord,
  currentUid?: string | null,
  maxResults = 100,
): Promise<CollectibleItemRecord[]> {
  if (collectionRecord.isDemo) {
    return DEMO_ITEMS.filter((i) => i.collectionId === collectionRecord.id);
  }

  const path = 'items';
  const isOwner = Boolean(currentUid && currentUid === collectionRecord.ownerId);

  try {
    const q = isOwner
      ? query(
          collection(db, 'items'),
          where('collectionId', '==', collectionRecord.id),
          where('ownerId', '==', currentUid),
          limit(maxResults),
        )
      : query(
          collection(db, 'items'),
          where('collectionId', '==', collectionRecord.id),
          where('visibility', '==', 'public'),
          limit(maxResults),
        );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CollectibleItemRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function recomputeAndSyncCollectionStats(
  collectionRecord: CollectionRecord,
  ownerId: string,
): Promise<void> {
  const items = await listCollectionItems(collectionRecord, ownerId, 200);
  const itemCount = items.length;
  const minSum = items.reduce((acc, item) => acc + (Number(item.valueMinGbp) || 0), 0);
  const maxSum = items.reduce(
    (acc, item) => acc + Math.max(Number(item.valueMinGbp) || 0, Number(item.valueMaxGbp) || 0),
    0,
  );
  const nextCover = collectionRecord.coverImageUrl || items[0]?.imageUrl || '';

  await updateCollectionDetails(collectionRecord.id, {
    itemCount,
    estimatedTotalMinGbp: minSum,
    estimatedTotalMaxGbp: Math.max(minSum, maxSum),
    coverImageUrl: nextCover,
  });
}

export async function addCollectibleItemRecord(params: {
  collectionRecord: CollectionRecord;
  ownerId: string;
  name: string;
  category: CategorySlug;
  year: string;
  maker: string;
  series: string;
  setNumber: string;
  condition: string;
  valueMinGbp: number;
  valueMaxGbp: number;
  aiConfidence: AIConfidence;
  curatorialNote: string;
  imageUrl: string;
  customItemId?: string;
}): Promise<CollectibleItemRecord> {
  const itemId = params.customItemId || makeSafeId('itm');
  const path = `items/${itemId}`;

  const minGbp = Math.max(0, Number(params.valueMinGbp) || 0);
  const maxGbp = Math.max(minGbp, Number(params.valueMaxGbp) || minGbp);

  const itemData = {
    collectionId: params.collectionRecord.id,
    ownerId: params.ownerId,
    category: params.category,
    visibility: params.collectionRecord.visibility,
    name: (params.name.trim() || 'Untitled Artefact').slice(0, 140),
    year: params.year.trim().slice(0, 32),
    maker: params.maker.trim().slice(0, 100),
    series: params.series.trim().slice(0, 100),
    setNumber: params.setNumber.trim().slice(0, 60),
    condition: (params.condition.trim() || 'Good').slice(0, 80),
    valueMinGbp: minGbp,
    valueMaxGbp: maxGbp,
    aiConfidence: params.aiConfidence,
    curatorialNote: params.curatorialNote.trim().slice(0, 1200),
    imageUrl: params.imageUrl.slice(0, 180000),
    forSale: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'items', itemId), itemData);
    await recomputeAndSyncCollectionStats(params.collectionRecord, params.ownerId);
    return {
      id: itemId,
      ...itemData,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCollectibleItemRecord(
  item: CollectibleItemRecord,
  collectionRecord: CollectionRecord,
): Promise<void> {
  const path = `items/${item.id}`;
  try {
    await deleteDoc(doc(db, 'items', item.id));
    await recomputeAndSyncCollectionStats(collectionRecord, item.ownerId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteEntireCollection(
  collectionRecord: CollectionRecord,
  profile: UserProfile,
): Promise<void> {
  const items = await listCollectionItems(collectionRecord, profile.uid, 200);
  for (const item of items) {
    const itemPath = `items/${item.id}`;
    try {
      await deleteDoc(doc(db, 'items', item.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, itemPath);
    }
  }

  const colPath = `collections/${collectionRecord.id}`;
  try {
    await deleteDoc(doc(db, 'collections', collectionRecord.id));
    await updateUserPublicProfile(profile.uid, {
      collectionsCount: Math.max(0, (profile.collectionsCount || 1) - 1),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, colPath);
  }
}

// 4. Seed Sample UK Collection into Tester's Firestore Account
export async function seedSampleCabinetForUser(profile: UserProfile): Promise<CollectionRecord> {
  const sampleCol = await createCollectionRecord({
    profile,
    title: 'Selected British Cabinet Study (Starter Archive)',
    story:
      'A personal starter cabinet seeded to explore Fanzeum’s gallery lighting, accession records, and GBP valuation tracking. Add your own photographs or edit any entry at your leisure.',
    category: 'stamps',
    visibility: 'public',
    setTargetCount: 10,
    coverImageUrl: DEMO_ITEMS[0].imageUrl,
  });

  await addCollectibleItemRecord({
    collectionRecord: sampleCol,
    ownerId: profile.uid,
    name: DEMO_ITEMS[0].name,
    category: 'stamps',
    year: DEMO_ITEMS[0].year,
    maker: DEMO_ITEMS[0].maker,
    series: DEMO_ITEMS[0].series,
    setNumber: DEMO_ITEMS[0].setNumber,
    condition: DEMO_ITEMS[0].condition,
    valueMinGbp: DEMO_ITEMS[0].valueMinGbp,
    valueMaxGbp: DEMO_ITEMS[0].valueMaxGbp,
    aiConfidence: 'high',
    curatorialNote: DEMO_ITEMS[0].curatorialNote,
    imageUrl: DEMO_ITEMS[0].imageUrl,
  });

  await addCollectibleItemRecord({
    collectionRecord: sampleCol,
    ownerId: profile.uid,
    name: DEMO_ITEMS[2].name,
    category: 'coins',
    year: DEMO_ITEMS[2].year,
    maker: DEMO_ITEMS[2].maker,
    series: DEMO_ITEMS[2].series,
    setNumber: DEMO_ITEMS[2].setNumber,
    condition: DEMO_ITEMS[2].condition,
    valueMinGbp: DEMO_ITEMS[2].valueMinGbp,
    valueMaxGbp: DEMO_ITEMS[2].valueMaxGbp,
    aiConfidence: 'high',
    curatorialNote: DEMO_ITEMS[2].curatorialNote,
    imageUrl: DEMO_ITEMS[2].imageUrl,
  });

  return sampleCol;
}

// 5. UK GDPR Data Export & Full Account Data Erasure
export async function exportAllUserData(uid: string) {
  const [profile, privateAccount, collections] = await Promise.all([
    fetchUserProfile(uid),
    fetchUserPrivateAccount(uid),
    listOwnerCollections(uid, 100),
  ]);

  const itemsQuery = query(collection(db, 'items'), where('ownerId', '==', uid), limit(500));
  let items: CollectibleItemRecord[] = [];
  try {
    const snap = await getDocs(itemsQuery);
    items = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CollectibleItemRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'items');
  }

  return {
    exportedAt: new Date().toISOString(),
    jurisdiction: 'UK GDPR (Data Protection Act 2018)',
    platform: 'Fanzeum',
    profile,
    privateAccount,
    collections,
    items,
  };
}

export async function eraseAllUserFirestoreData(uid: string): Promise<void> {
  const itemsQuery = query(collection(db, 'items'), where('ownerId', '==', uid), limit(500));
  try {
    const itemSnap = await getDocs(itemsQuery);
    for (const d of itemSnap.docs) {
      await deleteDoc(doc(db, 'items', d.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'items');
  }

  const cols = await listOwnerCollections(uid, 100);
  for (const col of cols) {
    try {
      await deleteDoc(doc(db, 'collections', col.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `collections/${col.id}`);
    }
  }

  try {
    const privSnap = await getDoc(doc(db, 'users', uid, 'private', 'account'));
    if (privSnap.exists()) {
      await deleteDoc(doc(db, 'users', uid, 'private', 'account'));
    }
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      await deleteDoc(doc(db, 'users', uid));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}
