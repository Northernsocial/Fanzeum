import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEMO_COLLECTIONS, DEMO_FRESH_FINDS, DEMO_ITEMS, DEMO_SETS, DEMO_USERS } from '../data/demoCatalog';
import { db, handleFirestoreError, OperationType } from './firebase';
import { setBuiltinDemoHidden } from './firestoreRepo';

/**
 * Idempotent admin seeder: writes the 6 demo collectors, 16 collections, 192 pieces, and demo Fresh Finds
 * into Firestore with `isDemo: true` using deterministic IDs so re-running never creates duplicates.
 */
export async function seedDemoDataToFirestore(
  onProgress?: (message: string) => void,
): Promise<{ users: number; collections: number; items: number; freshFinds: number; sets: number }> {
  setBuiltinDemoHidden(false);

  onProgress?.('Writing 6 demo collector profiles…');
  try {
    const userBatch = writeBatch(db);
    for (const u of DEMO_USERS) {
      userBatch.set(doc(db, 'users', u.uid), {
        uid: u.uid,
        handle: u.handle,
        displayName: u.displayName,
        bio: u.bio,
        avatarUrl: u.avatarUrl,
        location: u.location,
        specialties: u.specialties,
        goal: u.goal,
        role: u.role,
        plan: u.plan,
        isVerifiedExpert: u.isVerifiedExpert,
        isPublicProfile: true,
        hideValues: false,
        hideLocation: false,
        onboardingCompleted: true,
        collectionsCount: u.collectionsCount,
        piecesCount: u.piecesCount,
        joinedLabel: u.joinedLabel || '2025',
        isDemo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await userBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users');
  }

  onProgress?.('Writing 16 demo collections…');
  try {
    const colBatch = writeBatch(db);
    for (const c of DEMO_COLLECTIONS) {
      colBatch.set(doc(db, 'collections', c.id), {
        ownerId: c.ownerId,
        ownerName: c.ownerName,
        ownerHandle: c.ownerHandle,
        title: c.title,
        story: c.story,
        coverImageUrl: c.coverImageUrl,
        category: c.category,
        visibility: 'public',
        itemCount: c.itemCount,
        setTargetCount: c.setTargetCount,
        estimatedTotalMinGbp: c.estimatedTotalMinGbp,
        estimatedTotalMaxGbp: c.estimatedTotalMaxGbp,
        featured: c.featured,
        isDemo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await colBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'collections');
  }

  onProgress?.(`Writing ${DEMO_ITEMS.length} demo pieces…`);
  const chunkSize = 90;
  for (let i = 0; i < DEMO_ITEMS.length; i += chunkSize) {
    const slice = DEMO_ITEMS.slice(i, i + chunkSize);
    try {
      const itemBatch = writeBatch(db);
      for (const item of slice) {
        const payload: Record<string, unknown> = {
          collectionId: item.collectionId,
          ownerId: item.ownerId,
          ownerHandle: item.ownerHandle,
          category: item.category,
          visibility: 'public',
          title: item.title,
          titleLower: item.titleLower,
          story: item.story,
          imageUrl: item.imageUrl,
          thumbUrl: item.thumbUrl,
          photos: item.photos,
          attributes: item.attributes,
          fieldConfidences: item.fieldConfidences,
          year: item.year,
          maker: item.maker,
          setNumber: item.setNumber,
          condition: item.condition,
          valueMinGbp: item.valueMinGbp,
          valueMaxGbp: item.valueMaxGbp,
          valuationReason: item.valuationReason,
          aiConfidence: item.aiConfidence,
          grail: item.grail,
          tags: item.tags,
          customOrder: item.customOrder,
          forSale: false,
          isDemo: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (item.mediaCredit) {
          payload.mediaCredit = item.mediaCredit;
        }
        if (item.panelStatus) {
          payload.panelStatus = item.panelStatus;
        }
        if (item.panelConfirmedAt) {
          payload.panelConfirmedAt = item.panelConfirmedAt;
        }
        itemBatch.set(doc(db, 'items', item.id), payload);
      }
      await itemBatch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'items');
    }
  }

  // 4. Demo Fresh Finds
  onProgress?.(`Writing ${DEMO_FRESH_FINDS.length} demo Fresh Finds…`);
  try {
    const findBatch = writeBatch(db);
    for (const find of DEMO_FRESH_FINDS) {
      const payload: Record<string, unknown> = {
        itemId: find.itemId,
        ownerId: find.ownerId,
        ownerHandle: find.ownerHandle,
        category: find.category,
        title: find.title,
        thumbUrl: find.thumbUrl,
        isDemo: true,
        createdAt: serverTimestamp(),
      };
      if (find.valueRange) payload.valueRange = find.valueRange;
      if (find.panelStatus) payload.panelStatus = find.panelStatus;
      findBatch.set(doc(db, 'freshFinds', find.id), payload);
    }
    await findBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'freshFinds');
  }

  // 5. Demo Sets
  onProgress?.(`Writing ${DEMO_SETS.length} demo sets…`);
  try {
    const setBatch = writeBatch(db);
    for (const set of DEMO_SETS) {
      const payload: Record<string, unknown> = {
        title: set.title,
        category: set.category,
        description: set.description,
        totalItems: set.totalItems,
        items: set.items,
        isDemo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      setBatch.set(doc(db, 'sets', set.id), payload);
    }
    await setBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'sets');
  }

  onProgress?.('Demo data loaded.');
  return {
    users: DEMO_USERS.length,
    collections: DEMO_COLLECTIONS.length,
    items: DEMO_ITEMS.length,
    freshFinds: DEMO_FRESH_FINDS.length,
    sets: DEMO_SETS.length,
  };
}

/**
 * Removes all `isDemo == true` documents from Firestore and hides built-in fallback demo items.
 */
export async function removeDemoDataFromFirestore(
  onProgress?: (message: string) => void,
): Promise<{ deletedCount: number }> {
  let deletedCount = 0;

  for (const colName of ['sets', 'freshFinds', 'items', 'collections', 'users'] as const) {
    onProgress?.(`Removing demo records from ${colName}…`);
    try {
      const q =
        colName === 'users'
          ? query(
              collection(db, 'users'),
              where('isPublicProfile', '==', true),
              where('isDemo', '==', true),
              limit(300),
            )
          : query(
              collection(db, colName),
              where('visibility', '==', 'public'),
              where('isDemo', '==', true),
              limit(300),
            );
      const snap = await getDocs(q);
      for (let i = 0; i < snap.docs.length; i += 100) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 100).forEach((d) => {
          batch.delete(doc(db, colName, d.id));
          deletedCount += 1;
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colName);
    }
  }

  setBuiltinDemoHidden(true);
  onProgress?.('All demo data removed.');
  return { deletedCount };
}

/**
 * Seeds demo sets into Firestore (idempotent, uses deterministic IDs).
 */
export async function seedDemoSetsToFirestore(
  onProgress?: (message: string) => void,
): Promise<{ sets: number }> {
  onProgress?.(`Writing ${DEMO_SETS.length} demo sets…`);
  try {
    const setBatch = writeBatch(db);
    for (const set of DEMO_SETS) {
      const payload: Record<string, unknown> = {
        title: set.title,
        category: set.category,
        description: set.description,
        totalItems: set.totalItems,
        items: set.items,
        isDemo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      setBatch.set(doc(db, 'sets', set.id), payload);
    }
    await setBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'sets');
  }
  onProgress?.('Demo sets loaded.');
  return { sets: DEMO_SETS.length };
}
