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
import { getItemPlacardParts, type CategorySlug } from '../config/categories';
import { DEMO_COLLECTIONS, DEMO_ITEMS, DEMO_USERS } from '../data/demoCatalog';
import type {
  AIConfidence,
  CollectibleItemRecord,
  CollectionRecord,
  CollectorGoal,
  ConfidenceLevel,
  FreshFindRecord,
  ItemPhoto,
  ItemPrivateRecord,
  MediaCredit,
  PanelCard,
  PanelChatMessage,
  PanelChatRecord,
  UserPrivateAccount,
  UserProfile,
  VisibilityLevel,
} from '../types/domain';
import { canUse, sanitizeHandle } from './entitlements';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  deleteAllUserStorageFiles,
  deleteItemStoragePhotos,
  uploadProcessedItemPhoto,
} from './imageUtils';
import { buildCollectorArtDataUrl } from './placeholderArt';

const HIDE_DEMO_STORAGE_KEY = 'fanzeum_hide_demo_catalog';

export function isBuiltinDemoHidden(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(HIDE_DEMO_STORAGE_KEY) === 'true';
}

export function setBuiltinDemoHidden(hidden: boolean): void {
  if (typeof window === 'undefined') return;
  if (hidden) {
    window.localStorage.setItem(HIDE_DEMO_STORAGE_KEY, 'true');
  } else {
    window.localStorage.removeItem(HIDE_DEMO_STORAGE_KEY);
  }
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function clampUrl(url: string | undefined, fallbackCategory: CategorySlug, fallbackTitle: string): string {
  const trimmed = (url || '').trim();
  if (trimmed && trimmed.length <= 2048) return trimmed;
  return buildCollectorArtDataUrl({
    category: fallbackCategory,
    title: fallbackTitle || 'Piece',
  }).slice(0, 2048);
}

function currentMonthYearLabel(): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date());
}

function normalizeItemDoc(id: string, raw: Record<string, unknown>): CollectibleItemRecord {
  const category = (raw.category as CategorySlug) || 'memorabilia';
  const title = String(raw.title || raw.name || 'Untitled Piece');
  const imageUrl = String(raw.imageUrl || '');
  const thumbUrl = String(raw.thumbUrl || imageUrl);
  const rawPhotos = Array.isArray(raw.photos) ? (raw.photos as ItemPhoto[]) : [];
  const photos: ItemPhoto[] =
    rawPhotos.length > 0
      ? rawPhotos
      : [
          {
            url: imageUrl,
            thumbUrl,
            width: 800,
            height: 1000,
            label: 'Front',
          },
        ];

  return {
    id,
    collectionId: String(raw.collectionId || ''),
    ownerId: String(raw.ownerId || ''),
    ownerHandle: String(raw.ownerHandle || 'collector'),
    category,
    visibility: (raw.visibility as VisibilityLevel) || 'public',
    title,
    titleLower: String(raw.titleLower || title.toLowerCase()),
    story: String(raw.story ?? ''),
    imageUrl,
    thumbUrl,
    photos,
    attributes:
      raw.attributes && typeof raw.attributes === 'object'
        ? (raw.attributes as Record<string, string | boolean>)
        : {},
    fieldConfidences:
      raw.fieldConfidences && typeof raw.fieldConfidences === 'object'
        ? (raw.fieldConfidences as Record<string, ConfidenceLevel>)
        : {},
    year: String(raw.year || ''),
    maker: String(raw.maker || ''),
    setNumber: String(raw.setNumber || ''),
    condition: String(raw.condition || 'Good'),
    valueMinGbp: Number(raw.valueMinGbp) || 0,
    valueMaxGbp: Number(raw.valueMaxGbp) || 0,
    valuationReason: String(raw.valuationReason || ''),
    aiConfidence: (raw.aiConfidence as AIConfidence) || 'manual',
    grail: Boolean(raw.grail),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    customOrder: Number(raw.customOrder) || 0,
    forSale: Boolean(raw.forSale),
    mediaCredit: raw.mediaCredit as MediaCredit | undefined,
    panelStatus: raw.panelStatus as 'none' | 'confirmed' | 'disputed' | undefined,
    panelConfirmedAt: raw.panelConfirmedAt ? String(raw.panelConfirmedAt) : undefined,
    isDemo: Boolean(raw.isDemo),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeFreshFindDoc(id: string, raw: Record<string, unknown>): FreshFindRecord {
  return {
    id,
    itemId: String(raw.itemId || ''),
    ownerId: String(raw.ownerId || ''),
    ownerHandle: String(raw.ownerHandle || 'collector'),
    category: (raw.category as CategorySlug) || 'memorabilia',
    title: String(raw.title || 'Untitled Piece'),
    thumbUrl: String(raw.thumbUrl || ''),
    valueRange: raw.valueRange ? String(raw.valueRange) : undefined,
    panelStatus: raw.panelStatus as 'none' | 'confirmed' | 'disputed' | undefined,
    isDemo: Boolean(raw.isDemo),
    createdAt: raw.createdAt,
  };
}

function normalizeUserDoc(raw: Record<string, unknown>): UserProfile {
  return {
    uid: String(raw.uid || ''),
    handle: String(raw.handle || 'collector'),
    displayName: String(raw.displayName || 'Collector'),
    bio: String(raw.bio || ''),
    avatarUrl: String(raw.avatarUrl || ''),
    location: String(raw.location || ''),
    specialties: Array.isArray(raw.specialties) ? (raw.specialties as CategorySlug[]) : [],
    goal: (raw.goal as CollectorGoal) || 'exhibit',
    role: (raw.role as UserProfile['role']) || 'collector',
    plan: (raw.plan as UserProfile['plan']) || 'free',
    isVerifiedExpert: Boolean(raw.isVerifiedExpert),
    isPublicProfile: raw.isPublicProfile !== false,
    hideValues: Boolean(raw.hideValues),
    hideLocation: Boolean(raw.hideLocation),
    onboardingCompleted: Boolean(raw.onboardingCompleted),
    collectionsCount: Number(raw.collectionsCount) || 0,
    piecesCount: Number(raw.piecesCount) || 0,
    joinedLabel: String(raw.joinedLabel || '2025'),
    isDemo: Boolean(raw.isDemo),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

// 1. User Profiles & Handles
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  if (!isBuiltinDemoHidden()) {
    const demo = DEMO_USERS.find((u) => u.uid === uid);
    if (demo) return demo;
  }

  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return normalizeUserDoc(snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchUserByHandle(
  rawHandle: string,
  viewerProfile?: UserProfile | null,
): Promise<UserProfile | null> {
  const clean = rawHandle.replace(/^@+/, '').toLowerCase().trim();
  if (!clean) return null;

  if (viewerProfile && viewerProfile.handle.toLowerCase() === clean) {
    return viewerProfile;
  }

  const path = 'users';
  try {
    const q = query(
      collection(db, 'users'),
      where('handle', '==', clean),
      where('isPublicProfile', '==', true),
      limit(1),
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return normalizeUserDoc(snap.docs[0].data() as Record<string, unknown>);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  if (!isBuiltinDemoHidden()) {
    const demo = DEMO_USERS.find((u) => u.handle.toLowerCase() === clean);
    if (demo) return demo;
  }

  return null;
}

export async function isHandleAvailable(handle: string, excludeUid?: string): Promise<boolean> {
  const clean = sanitizeHandle(handle);
  if (DEMO_USERS.some((u) => u.handle === clean && u.uid !== excludeUid)) {
    return false;
  }
  try {
    const q = query(
      collection(db, 'users'),
      where('handle', '==', clean),
      where('isPublicProfile', '==', true),
      limit(2),
    );
    const snap = await getDocs(q);
    return snap.docs.every((d) => d.id === excludeUid);
  } catch {
    return true;
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
  const baseHandle = sanitizeHandle(cleanName);
  const available = await isHandleAvailable(baseHandle, params.uid);
  const cleanHandle = available
    ? baseHandle
    : sanitizeHandle(`${baseHandle.slice(0, 22)}_${Math.floor(10 + Math.random() * 89)}`);

  const safeAvatar = (params.avatarUrl || '').slice(0, 2048);
  const safeEmail = (params.email || 'collector@example.co.uk').trim().slice(0, 254);
  const joinedLabel = currentMonthYearLabel();

  const profilePayload = {
    uid: params.uid,
    handle: cleanHandle,
    displayName: cleanName || 'Collector',
    bio: '',
    avatarUrl: safeAvatar,
    location: '',
    specialties: [] as CategorySlug[],
    goal: 'exhibit' as CollectorGoal,
    role: 'collector' as const,
    plan: 'free' as const,
    isVerifiedExpert: false,
    isPublicProfile: true,
    hideValues: false,
    hideLocation: false,
    onboardingCompleted: false,
    collectionsCount: 0,
    piecesCount: 0,
    joinedLabel,
    isDemo: false,
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

export async function updateUserPlanServerSide(uid: string, plan: 'free' | 'premium' | 'store'): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      plan,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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
    hideValues: boolean;
    hideLocation: boolean;
    onboardingCompleted: boolean;
    collectionsCount: number;
    piecesCount: number;
    joinedLabel: string;
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
  if (updates.hideValues !== undefined) payload.hideValues = updates.hideValues;
  if (updates.hideLocation !== undefined) payload.hideLocation = updates.hideLocation;
  if (updates.onboardingCompleted !== undefined) {
    payload.onboardingCompleted = updates.onboardingCompleted;
  }
  if (updates.collectionsCount !== undefined) {
    payload.collectionsCount = Math.max(0, Math.min(10000, Math.round(updates.collectionsCount)));
  }
  if (updates.piecesCount !== undefined) {
    payload.piecesCount = Math.max(0, Math.min(100000, Math.round(updates.piecesCount)));
  }
  if (updates.joinedLabel !== undefined) {
    payload.joinedLabel = updates.joinedLabel.slice(0, 40);
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

export async function listPublicCollectors(maxResults = 30): Promise<UserProfile[]> {
  const path = 'users';
  let live: UserProfile[] = [];
  try {
    const q = query(
      collection(db, 'users'),
      where('isPublicProfile', '==', true),
      limit(maxResults),
    );
    const snap = await getDocs(q);
    live = snap.docs.map((d) => normalizeUserDoc(d.data() as Record<string, unknown>));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  if (isBuiltinDemoHidden()) return live;
  const seen = new Set(live.map((u) => u.uid));
  const combined = [...live];
  for (const demo of DEMO_USERS) {
    if (!seen.has(demo.uid)) combined.push(demo);
  }
  return combined.slice(0, maxResults);
}

// 1.5 AI Expert Panel Chats (Owner Only)
export async function fetchPanelChatRecord(itemId: string): Promise<PanelChatRecord | null> {
  const path = `panelChats/${itemId}`;
  try {
    const snap = await getDoc(doc(db, 'panelChats', itemId));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    return {
      itemId: snap.id,
      ownerId: String(d.ownerId || ''),
      personaId: String(d.personaId || 'lead'),
      messages: Array.isArray(d.messages) ? (d.messages as PanelChatMessage[]) : [],
      summary: String(d.summary || ''),
      card: d.card as PanelCard,
      confidence: (d.confidence as ConfidenceLevel) || 'medium',
      status: (d.status as PanelChatRecord['status']) || 'active',
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertPanelChatRecord(params: {
  itemId: string;
  ownerId: string;
  personaId: string;
  messages: PanelChatMessage[];
  summary: string;
  card: PanelCard;
  confidence: ConfidenceLevel;
  status: 'active' | 'saved' | 'closed';
}): Promise<void> {
  const path = `panelChats/${params.itemId}`;
  const docRef = doc(db, 'panelChats', params.itemId);

  const cleanMessages = params.messages.slice(-50).map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text.slice(0, 5000),
    personaId: m.personaId.slice(0, 64),
    createdAt: m.createdAt,
    ...(m.imageUrls && m.imageUrls.length > 0
      ? { imageUrls: m.imageUrls.slice(0, 4) }
      : {}),
  }));

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        personaId: params.personaId.slice(0, 64),
        messages: cleanMessages,
        summary: params.summary.slice(0, 4000),
        card: params.card,
        confidence: params.confidence,
        status: params.status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ownerId: params.ownerId,
        personaId: params.personaId.slice(0, 64),
        messages: cleanMessages,
        summary: params.summary.slice(0, 4000),
        card: params.card,
        confidence: params.confidence,
        status: params.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 2. Collections
export async function listPublicCollections(maxResults = 40): Promise<CollectionRecord[]> {
  const path = 'collections';
  let live: CollectionRecord[] = [];
  try {
    const q = query(
      collection(db, 'collections'),
      where('visibility', '==', 'public'),
      limit(maxResults),
    );
    const snap = await getDocs(q);
    live = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CollectionRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }

  if (isBuiltinDemoHidden()) return live;
  const seen = new Set(live.map((c) => c.id));
  const combined = [...live];
  for (const demo of DEMO_COLLECTIONS) {
    if (!seen.has(demo.id)) combined.push(demo);
  }
  return combined.slice(0, maxResults);
}

export async function listFeaturedCollections(): Promise<CollectionRecord[]> {
  const all = await listPublicCollections(40);
  // Sort collections so that those with real photos (not data:image/svg) appear first
  const sorted = [...all].sort((a, b) => {
    const aReal = a.coverImageUrl && !a.coverImageUrl.startsWith('data:image/svg') ? 1 : 0;
    const bReal = b.coverImageUrl && !b.coverImageUrl.startsWith('data:image/svg') ? 1 : 0;
    if (aReal !== bReal) return bReal - aReal;
    const aFeat = a.featured ? 1 : 0;
    const bFeat = b.featured ? 1 : 0;
    return bFeat - aFeat;
  });
  const featured = sorted.filter((c) => c.featured);
  return featured.length > 0 ? featured : sorted.slice(0, 3);
}

export async function listOwnerCollections(
  ownerId: string,
  viewerUid?: string | null,
  maxResults = 50,
): Promise<CollectionRecord[]> {
  if (!isBuiltinDemoHidden() && ownerId.startsWith('demo_')) {
    return DEMO_COLLECTIONS.filter((c) => c.ownerId === ownerId);
  }

  const path = 'collections';
  const isSelf = Boolean(viewerUid && viewerUid === ownerId);
  try {
    const q = isSelf
      ? query(collection(db, 'collections'), where('ownerId', '==', ownerId), limit(maxResults))
      : query(
          collection(db, 'collections'),
          where('ownerId', '==', ownerId),
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

export async function fetchCollectionById(collectionId: string): Promise<CollectionRecord | null> {
  if (!isBuiltinDemoHidden()) {
    const demoMatch = DEMO_COLLECTIONS.find((c) => c.id === collectionId);
    if (demoMatch) return demoMatch;
  }

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
  const check = canUse('create_collection', params.profile, {
    currentCollectionsCount: params.profile.collectionsCount,
  });
  if (!check.allowed) {
    throw new Error(check.reason || 'Collection limit reached.');
  }

  const collectionId = makeSafeId('col');
  const path = `collections/${collectionId}`;

  const cleanTitle = params.title.trim().slice(0, 120);
  const safeTitle = cleanTitle.length >= 2 ? cleanTitle : 'My Collection';
  const safeCover =
    params.coverImageUrl && params.coverImageUrl.length <= 2048 ? params.coverImageUrl : '';

  const recordData = {
    ownerId: params.profile.uid,
    ownerName: params.profile.displayName.slice(0, 80) || 'Collector',
    ownerHandle: sanitizeHandle(params.profile.handle),
    title: safeTitle,
    story: params.story.trim().slice(0, 2500),
    coverImageUrl: safeCover,
    category: params.category,
    visibility: params.visibility,
    itemCount: 0,
    setTargetCount: Math.max(0, Math.min(50000, Math.round(params.setTargetCount || 0))),
    estimatedTotalMinGbp: 0,
    estimatedTotalMaxGbp: 0,
    featured: false,
    isDemo: false,
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
    ownerName: string;
    ownerHandle: string;
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
  if (updates.ownerName !== undefined) payload.ownerName = updates.ownerName.slice(0, 80);
  if (updates.ownerHandle !== undefined) {
    payload.ownerHandle = sanitizeHandle(updates.ownerHandle);
  }
  if (updates.title !== undefined) {
    const t = updates.title.trim().slice(0, 120);
    payload.title = t.length >= 2 ? t : 'My Collection';
  }
  if (updates.story !== undefined) payload.story = updates.story.slice(0, 2500);
  if (updates.coverImageUrl !== undefined) {
    payload.coverImageUrl = updates.coverImageUrl.length <= 2048 ? updates.coverImageUrl : '';
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

// 3. Collectible Pieces & Private Acquisition Records
export async function fetchItemById(itemId: string): Promise<CollectibleItemRecord | null> {
  if (!isBuiltinDemoHidden()) {
    const demo = DEMO_ITEMS.find((i) => i.id === itemId);
    if (demo) return demo;
  }

  const path = `items/${itemId}`;
  try {
    const snap = await getDoc(doc(db, 'items', itemId));
    if (!snap.exists()) return null;
    return normalizeItemDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchItemPrivateRecord(
  uid: string,
  itemId: string,
): Promise<ItemPrivateRecord | null> {
  const path = `users/${uid}/itemPrivate/${itemId}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'itemPrivate', itemId));
    if (!snap.exists()) return null;
    return snap.data() as ItemPrivateRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertItemPrivateRecord(params: {
  uid: string;
  itemId: string;
  acquiredDate: string;
  acquiredPriceGbp: number;
  privateNotes: string;
}): Promise<void> {
  const path = `users/${params.uid}/itemPrivate/${params.itemId}`;
  const docRef = doc(db, 'users', params.uid, 'itemPrivate', params.itemId);
  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      await updateDoc(docRef, {
        acquiredDate: params.acquiredDate.trim().slice(0, 40),
        acquiredPriceGbp: Math.max(0, Number(params.acquiredPriceGbp) || 0),
        privateNotes: params.privateNotes.slice(0, 1000),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        uid: params.uid,
        itemId: params.itemId,
        acquiredDate: params.acquiredDate.trim().slice(0, 40),
        acquiredPriceGbp: Math.max(0, Number(params.acquiredPriceGbp) || 0),
        privateNotes: params.privateNotes.slice(0, 1000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function listCollectionItems(
  collectionRecord: CollectionRecord,
  currentUid?: string | null,
  maxResults = 150,
): Promise<CollectibleItemRecord[]> {
  if (!isBuiltinDemoHidden() && collectionRecord.id.startsWith('demo_')) {
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
    return snap.docs.map((d) => normalizeItemDoc(d.id, d.data() as Record<string, unknown>));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listOwnerItems(
  ownerId: string,
  maxResults = 120,
): Promise<CollectibleItemRecord[]> {
  if (!isBuiltinDemoHidden() && ownerId.startsWith('demo_')) {
    return DEMO_ITEMS.filter((i) => i.ownerId === ownerId).slice(0, maxResults);
  }

  const path = 'items';
  try {
    const q = query(collection(db, 'items'), where('ownerId', '==', ownerId), limit(maxResults));
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizeItemDoc(d.id, d.data() as Record<string, unknown>));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function explorePublicItems(params: {
  category?: CategorySlug | 'all';
  search?: string;
  sortBy?: 'newest' | 'value_desc';
  pageSize?: number;
  pageIndex?: number;
}): Promise<{
  items: CollectibleItemRecord[];
  totalCount: number;
  hasMore: boolean;
}> {
  const pageSize = params.pageSize || 24;
  const pageIndex = params.pageIndex || 0;
  const searchTerm = (params.search || '').trim().toLowerCase();

  let liveItems: CollectibleItemRecord[] = [];
  try {
    const q =
      params.category && params.category !== 'all'
        ? query(
            collection(db, 'items'),
            where('visibility', '==', 'public'),
            where('category', '==', params.category),
            limit(200),
          )
        : query(collection(db, 'items'), where('visibility', '==', 'public'), limit(200));

    const snap = await getDocs(q);
    liveItems = snap.docs.map((d) => normalizeItemDoc(d.id, d.data() as Record<string, unknown>));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'items');
  }

  const seen = new Set(liveItems.map((i) => i.id));
  const combined = [...liveItems];

  if (!isBuiltinDemoHidden()) {
    for (const demo of DEMO_ITEMS) {
      if (seen.has(demo.id)) continue;
      if (params.category && params.category !== 'all' && demo.category !== params.category) {
        continue;
      }
      combined.push(demo);
    }
  }

  const filtered = searchTerm
    ? combined.filter((item) => {
        if (item.titleLower.includes(searchTerm)) return true;
        if (item.maker.toLowerCase().includes(searchTerm)) return true;
        if (item.setNumber.toLowerCase().includes(searchTerm)) return true;
        if (item.year.toLowerCase().includes(searchTerm)) return true;
        if (item.ownerHandle.toLowerCase().includes(searchTerm)) return true;
        return item.tags.some((t) => t.toLowerCase().includes(searchTerm));
      })
    : combined;

  if (params.sortBy === 'value_desc') {
    filtered.sort((a, b) => b.valueMaxGbp - a.valueMaxGbp);
  } else {
    // Newest first: live non-demo items appear ahead of demo items, sorted by createdAt seconds if available
    filtered.sort((a, b) => {
      const aLive = a.isDemo ? 0 : 1;
      const bLive = b.isDemo ? 0 : 1;
      if (aLive !== bLive) return bLive - aLive;
      const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
      const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
      return bSec - aSec;
    });
  }

  const end = (pageIndex + 1) * pageSize;
  return {
    items: filtered.slice(0, end),
    totalCount: filtered.length,
    hasMore: end < filtered.length,
  };
}

export async function recomputeAndSyncCollectionStats(
  collectionRecord: CollectionRecord,
  ownerId: string,
): Promise<void> {
  const items = await listCollectionItems(collectionRecord, ownerId, 250);
  const itemCount = items.length;
  const minSum = items.reduce((acc, item) => acc + (Number(item.valueMinGbp) || 0), 0);
  const maxSum = items.reduce(
    (acc, item) => acc + Math.max(Number(item.valueMinGbp) || 0, Number(item.valueMaxGbp) || 0),
    0,
  );
  const candidateCover =
    collectionRecord.coverImageUrl && collectionRecord.coverImageUrl.length <= 2048
      ? collectionRecord.coverImageUrl
      : items[0]?.thumbUrl || items[0]?.imageUrl || '';

  await updateCollectionDetails(collectionRecord.id, {
    itemCount,
    estimatedTotalMinGbp: minSum,
    estimatedTotalMaxGbp: Math.max(minSum, maxSum),
    coverImageUrl: candidateCover.length <= 2048 ? candidateCover : '',
  });
}

export async function addCollectibleItemRecord(params: {
  collectionRecord: CollectionRecord;
  profile: UserProfile;
  title: string;
  story: string;
  category: CategorySlug;
  photos: ItemPhoto[];
  attributes: Record<string, string | boolean>;
  fieldConfidences?: Record<string, ConfidenceLevel>;
  valueMinGbp: number;
  valueMaxGbp: number;
  valuationReason: string;
  aiConfidence: AIConfidence;
  grail?: boolean;
  tags?: string[];
  acquiredDate?: string;
  acquiredPriceGbp?: number;
  privateNotes?: string;
  customItemId?: string;
  panelStatus?: 'none' | 'confirmed' | 'disputed';
  panelConfirmedAt?: string;
}): Promise<CollectibleItemRecord> {
  const itemId = params.customItemId || makeSafeId('itm');
  const path = `items/${itemId}`;

  const cleanTitle = (params.title.trim() || 'Untitled Piece').slice(0, 140);
  const placard = getItemPlacardParts(params.category, params.attributes);
  const minGbp = Math.max(0, Math.round(Number(params.valueMinGbp) || 0));
  const maxGbp = Math.max(minGbp, Math.round(Number(params.valueMaxGbp) || minGbp));

  const safePhotos: ItemPhoto[] =
    params.photos.length > 0
      ? params.photos.slice(0, 6).map((p) => ({
          url: clampUrl(p.url, params.category, cleanTitle),
          thumbUrl: clampUrl(p.thumbUrl || p.url, params.category, cleanTitle),
          width: Math.max(1, Math.min(12000, Math.round(p.width || 800))),
          height: Math.max(1, Math.min(12000, Math.round(p.height || 1000))),
          ...(p.label ? { label: p.label.slice(0, 40) } : {}),
          ...(p.blurDataUrl && p.blurDataUrl.length <= 600
            ? { blurDataUrl: p.blurDataUrl }
            : {}),
        }))
      : [
          {
            url: clampUrl('', params.category, cleanTitle),
            thumbUrl: clampUrl('', params.category, cleanTitle),
            width: 800,
            height: 1000,
            label: 'Front',
          },
        ];

  const cleanTags = (params.tags || [])
    .map((t) => t.toLowerCase().trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 12);

  const itemData = {
    collectionId: params.collectionRecord.id,
    ownerId: params.profile.uid,
    ownerHandle: sanitizeHandle(params.profile.handle),
    category: params.category,
    visibility: params.collectionRecord.visibility,
    title: cleanTitle,
    titleLower: cleanTitle.toLowerCase(),
    story: params.story.trim().slice(0, 1500),
    imageUrl: safePhotos[0].url,
    thumbUrl: safePhotos[0].thumbUrl,
    photos: safePhotos,
    attributes: params.attributes,
    fieldConfidences: params.fieldConfidences || {},
    year: placard.year.slice(0, 32),
    maker: placard.maker.slice(0, 120),
    setNumber: placard.catNumber.slice(0, 80),
    condition: (placard.condition || 'Good').slice(0, 80),
    valueMinGbp: minGbp,
    valueMaxGbp: maxGbp,
    valuationReason: params.valuationReason.trim().slice(0, 320),
    aiConfidence: params.aiConfidence,
    grail: Boolean(params.grail),
    tags: cleanTags,
    customOrder: Math.max(0, params.collectionRecord.itemCount || 0),
    forSale: false,
    ...(params.panelStatus ? { panelStatus: params.panelStatus } : {}),
    ...(params.panelConfirmedAt ? { panelConfirmedAt: params.panelConfirmedAt } : {}),
    isDemo: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'items', itemId), itemData);

    const hasPrivate =
      Boolean(params.acquiredDate?.trim()) ||
      (params.acquiredPriceGbp !== undefined && params.acquiredPriceGbp > 0) ||
      Boolean(params.privateNotes?.trim());

    if (hasPrivate) {
      batch.set(doc(db, 'users', params.profile.uid, 'itemPrivate', itemId), {
        uid: params.profile.uid,
        itemId,
        acquiredDate: (params.acquiredDate || '').trim().slice(0, 40),
        acquiredPriceGbp: Math.max(0, Number(params.acquiredPriceGbp) || 0),
        privateNotes: (params.privateNotes || '').slice(0, 1000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await Promise.all([
      recomputeAndSyncCollectionStats(params.collectionRecord, params.profile.uid),
      updateUserPublicProfile(params.profile.uid, {
        piecesCount: (params.profile.piecesCount || 0) + 1,
      }),
    ]);

    return {
      id: itemId,
      ...itemData,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCollectibleItemRecord(params: {
  item: CollectibleItemRecord;
  collectionRecord: CollectionRecord;
  title: string;
  story: string;
  category: CategorySlug;
  attributes: Record<string, string | boolean>;
  valueMinGbp: number;
  valueMaxGbp: number;
  valuationReason: string;
  grail: boolean;
  tags: string[];
  panelStatus?: 'none' | 'confirmed' | 'disputed';
  panelConfirmedAt?: string;
}): Promise<void> {
  const path = `items/${params.item.id}`;
  const cleanTitle = (params.title.trim() || 'Untitled Piece').slice(0, 140);
  const placard = getItemPlacardParts(params.category, params.attributes);
  const minGbp = Math.max(0, Math.round(Number(params.valueMinGbp) || 0));
  const maxGbp = Math.max(minGbp, Math.round(Number(params.valueMaxGbp) || minGbp));

  try {
    await updateDoc(doc(db, 'items', params.item.id), {
      title: cleanTitle,
      titleLower: cleanTitle.toLowerCase(),
      story: params.story.trim().slice(0, 1500),
      category: params.category,
      attributes: params.attributes,
      year: placard.year.slice(0, 32),
      maker: placard.maker.slice(0, 120),
      setNumber: placard.catNumber.slice(0, 80),
      condition: (placard.condition || 'Good').slice(0, 80),
      valueMinGbp: minGbp,
      valueMaxGbp: maxGbp,
      valuationReason: params.valuationReason.trim().slice(0, 320),
      grail: params.grail,
      tags: params.tags
        .map((t) => t.toLowerCase().trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 12),
      ...(params.panelStatus ? { panelStatus: params.panelStatus } : {}),
      ...(params.panelConfirmedAt ? { panelConfirmedAt: params.panelConfirmedAt } : {}),
      updatedAt: serverTimestamp(),
    });
    await recomputeAndSyncCollectionStats(params.collectionRecord, params.item.ownerId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reorderCollectionItems(orderedItems: CollectibleItemRecord[]): Promise<void> {
  if (orderedItems.length === 0) return;
  const batch = writeBatch(db);
  orderedItems.forEach((item, index) => {
    if (!item.isDemo) {
      batch.update(doc(db, 'items', item.id), {
        customOrder: index,
        updatedAt: serverTimestamp(),
      });
    }
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'items');
  }
}

export async function moveItemToCollection(params: {
  item: CollectibleItemRecord;
  sourceCollection: CollectionRecord;
  targetCollection: CollectionRecord;
}): Promise<void> {
  const path = `items/${params.item.id}`;
  try {
    await updateDoc(doc(db, 'items', params.item.id), {
      collectionId: params.targetCollection.id,
      visibility: params.targetCollection.visibility,
      customOrder: params.targetCollection.itemCount || 0,
      updatedAt: serverTimestamp(),
    });
    await Promise.all([
      recomputeAndSyncCollectionStats(params.sourceCollection, params.item.ownerId),
      recomputeAndSyncCollectionStats(params.targetCollection, params.item.ownerId),
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCollectibleItemRecord(
  item: CollectibleItemRecord,
  collectionRecord: CollectionRecord,
  profile?: UserProfile | null,
): Promise<void> {
  const path = `items/${item.id}`;
  try {
    await deleteItemStoragePhotos(item.ownerId, item.id);
    const privRef = doc(db, 'users', item.ownerId, 'itemPrivate', item.id);
    const privSnap = await getDoc(privRef).catch(() => null);
    if (privSnap && privSnap.exists()) {
      await deleteDoc(privRef);
    }
    await deleteDoc(doc(db, 'items', item.id));
    await recomputeAndSyncCollectionStats(collectionRecord, item.ownerId);
    if (profile && profile.uid === item.ownerId) {
      await updateUserPublicProfile(profile.uid, {
        piecesCount: Math.max(0, (profile.piecesCount || 1) - 1),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteEntireCollection(
  collectionRecord: CollectionRecord,
  profile: UserProfile,
): Promise<void> {
  const items = await listCollectionItems(collectionRecord, profile.uid, 250);
  for (const item of items) {
    await deleteItemStoragePhotos(profile.uid, item.id);
    const itemPath = `items/${item.id}`;
    try {
      const privRef = doc(db, 'users', profile.uid, 'itemPrivate', item.id);
      const privSnap = await getDoc(privRef).catch(() => null);
      if (privSnap && privSnap.exists()) {
        await deleteDoc(privRef);
      }
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
      piecesCount: Math.max(0, (profile.piecesCount || items.length) - items.length),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, colPath);
  }
}

// 3.5 Fresh Finds Collection
export async function createFreshFindRecord(params: {
  itemId: string;
  ownerId: string;
  ownerHandle: string;
  category: CategorySlug;
  title: string;
  thumbUrl: string;
  valueRange?: string;
  panelStatus?: 'none' | 'confirmed' | 'disputed';
  isDemo?: boolean;
}): Promise<FreshFindRecord> {
  const findId = makeSafeId('find');
  const path = `freshFinds/${findId}`;

  const cleanTitle = params.title.trim().slice(0, 140) || 'Untitled Piece';
  const cleanHandle = sanitizeHandle(params.ownerHandle);
  const cleanThumb = (params.thumbUrl || '').slice(0, 2048);

  const recordData = {
    itemId: params.itemId,
    ownerId: params.ownerId,
    ownerHandle: cleanHandle,
    category: params.category,
    title: cleanTitle,
    thumbUrl: cleanThumb,
    ...(params.valueRange ? { valueRange: params.valueRange.trim().slice(0, 80) } : {}),
    ...(params.panelStatus ? { panelStatus: params.panelStatus } : {}),
    isDemo: Boolean(params.isDemo),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'freshFinds', findId), recordData);
    return {
      id: findId,
      ...recordData,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteFreshFindRecord(findId: string): Promise<void> {
  const path = `freshFinds/${findId}`;
  try {
    await deleteDoc(doc(db, 'freshFinds', findId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function listFreshFinds(params: {
  category?: CategorySlug | 'all';
  pageSize?: number;
  pageIndex?: number;
}): Promise<{
  items: FreshFindRecord[];
  totalCount: number;
  hasMore: boolean;
}> {
  const pageSize = params.pageSize || 12;
  const pageIndex = params.pageIndex || 0;

  let liveFinds: FreshFindRecord[] = [];
  try {
    const q =
      params.category && params.category !== 'all'
        ? query(
            collection(db, 'freshFinds'),
            where('category', '==', params.category),
            limit(150),
          )
        : query(collection(db, 'freshFinds'), limit(150));

    const snap = await getDocs(q);
    liveFinds = snap.docs.map((d) => normalizeFreshFindDoc(d.id, d.data() as Record<string, unknown>));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'freshFinds');
  }

  const seen = new Set(liveFinds.map((f) => f.id));
  const combined = [...liveFinds];

  if (!isBuiltinDemoHidden()) {
    // Import demo catalog fresh finds dynamically/safely
    const { DEMO_FRESH_FINDS } = await import('../data/demoCatalog');
    for (const demo of DEMO_FRESH_FINDS) {
      if (seen.has(demo.id)) continue;
      if (params.category && params.category !== 'all' && demo.category !== params.category) {
        continue;
      }
      combined.push(demo);
    }
  }

  // Newest first: live non-demo items ahead of demo, sorted by createdAt
  combined.sort((a, b) => {
    const aLive = a.isDemo ? 0 : 1;
    const bLive = b.isDemo ? 0 : 1;
    if (aLive !== bLive) return bLive - aLive;
    const aSec = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
    const bSec = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
    return bSec - aSec;
  });

  const end = (pageIndex + 1) * pageSize;
  return {
    items: combined.slice(0, end),
    totalCount: combined.length,
    hasMore: end < combined.length,
  };
}

// 4. UK GDPR Full Export & Complete Account + Storage Erasure
export async function exportAllUserData(uid: string) {
  const [profile, privateAccount, collections, items] = await Promise.all([
    fetchUserProfile(uid),
    fetchUserPrivateAccount(uid),
    listOwnerCollections(uid, uid, 200),
    listOwnerItems(uid, 500),
  ]);

  let itemPrivateRecords: ItemPrivateRecord[] = [];
  try {
    const privQ = query(
      collection(db, 'users', uid, 'itemPrivate'),
      where('uid', '==', uid),
      limit(500),
    );
    const snap = await getDocs(privQ);
    itemPrivateRecords = snap.docs.map((d) => d.data() as ItemPrivateRecord);
  } catch {
    // Optional subcollection
  }

  return {
    exportedAt: new Date().toISOString(),
    jurisdiction: 'UK GDPR (Data Protection Act 2018)',
    platform: 'Fanzeum',
    profile,
    privateAccount,
    collections,
    items,
    itemPrivateRecords,
  };
}

export async function eraseAllUserFirestoreData(uid: string): Promise<void> {
  await deleteAllUserStorageFiles(uid);

  try {
    const privItemsQ = query(
      collection(db, 'users', uid, 'itemPrivate'),
      where('uid', '==', uid),
      limit(500),
    );
    const privItemsSnap = await getDocs(privItemsQ);
    for (const d of privItemsSnap.docs) {
      await deleteDoc(doc(db, 'users', uid, 'itemPrivate', d.id));
    }
  } catch {
    // Proceed with remaining cleanup
  }

  try {
    const itemsQ = query(collection(db, 'items'), where('ownerId', '==', uid), limit(500));
    const itemSnap = await getDocs(itemsQ);
    for (const d of itemSnap.docs) {
      await deleteDoc(doc(db, 'items', d.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'items');
  }

  const cols = await listOwnerCollections(uid, uid, 200);
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
