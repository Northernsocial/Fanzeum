import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'fanzeum-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function verifiedCtx(uid: string, email = `${uid}@example.co.uk`) {
  return testEnv.authenticatedContext(uid, {
    email,
    email_verified: true,
  });
}

describe('Fanzeum Hardened Firestore Security Rules — Dirty Dozen TDD', () => {
  it('1. Rejects privilege escalation on user profile creation (role=admin, plan=premium)', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'users', 'user_alice'), {
        uid: 'user_alice',
        handle: 'alice_stamps',
        displayName: 'Alice',
        bio: 'Philatelist',
        avatarUrl: '',
        location: 'London, UK',
        specialties: ['stamps'],
        goal: 'exhibit',
        role: 'admin',
        plan: 'premium',
        isVerifiedExpert: true,
        isPublicProfile: true,
        onboardingCompleted: true,
        collectionsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('2. Rejects shadow field injection on profile update', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'users', 'user_alice'), {
        uid: 'user_alice',
        handle: 'alice_stamps',
        displayName: 'Alice',
        bio: 'Philatelist',
        avatarUrl: '',
        location: 'London, UK',
        specialties: ['stamps'],
        goal: 'exhibit',
        role: 'collector',
        plan: 'free',
        isVerifiedExpert: false,
        isPublicProfile: true,
        onboardingCompleted: true,
        collectionsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      updateDoc(doc(aliceDb, 'users', 'user_alice'), {
        bio: 'Updated bio',
        isSuperAdmin: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('3. Rejects unverified admin email spoof attack', async () => {
    const spoofAdminDb = testEnv
      .authenticatedContext('spoof_uid', {
        email: 'fifestreet@gmail.com',
        email_verified: false,
      })
      .firestore();

    await assertFails(
      setDoc(doc(spoofAdminDb, 'users', 'spoof_uid'), {
        uid: 'spoof_uid',
        handle: 'spoof_admin',
        displayName: 'Spoof',
        bio: '',
        avatarUrl: '',
        location: 'London',
        specialties: [],
        goal: 'exhibit',
        role: 'collector',
        plan: 'free',
        isVerifiedExpert: false,
        isPublicProfile: true,
        onboardingCompleted: false,
        collectionsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('4. Rejects cross-user PII read on /users/{uid}/private/account', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();
    const bobDb = verifiedCtx('user_bob').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users', 'user_alice'), {
        uid: 'user_alice',
        handle: 'alice_stamps',
        displayName: 'Alice',
        bio: '',
        avatarUrl: '',
        location: 'London',
        specialties: [],
        goal: 'exhibit',
        role: 'collector',
        plan: 'free',
        isVerifiedExpert: false,
        isPublicProfile: true,
        onboardingCompleted: true,
        collectionsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users', 'user_alice', 'private', 'account'), {
        uid: 'user_alice',
        email: 'alice@example.co.uk',
        analyticsConsent: true,
        marketingConsent: false,
        aiTrainingOptOut: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(getDoc(doc(bobDb, 'users', 'user_alice', 'private', 'account')));
  });

  it('5. Rejects orphaned private subdocument write when parent user profile does not exist', async () => {
    const ghostDb = verifiedCtx('user_ghost').firestore();
    await assertFails(
      setDoc(doc(ghostDb, 'users', 'user_ghost', 'private', 'account'), {
        uid: 'user_ghost',
        email: 'ghost@example.co.uk',
        analyticsConsent: false,
        marketingConsent: false,
        aiTrainingOptOut: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('6. Rejects identity spoofing on collection creation (ownerId != auth.uid)', async () => {
    const bobDb = verifiedCtx('user_bob').firestore();
    await assertFails(
      setDoc(doc(bobDb, 'collections', 'col_spoof'), {
        ownerId: 'user_alice',
        ownerName: 'Alice',
        ownerHandle: 'alice_stamps',
        title: 'Spoofed Collection',
        story: '',
        coverImageUrl: '',
        category: 'stamps',
        visibility: 'public',
        itemCount: 0,
        setTargetCount: 0,
        estimatedTotalMinGbp: 0,
        estimatedTotalMaxGbp: 0,
        featured: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('7. Rejects forged client timestamp on collection creation', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, 'users', 'user_alice'), {
        uid: 'user_alice',
        handle: 'alice_stamps',
        displayName: 'Alice',
        bio: '',
        avatarUrl: '',
        location: 'London',
        specialties: [],
        goal: 'exhibit',
        role: 'collector',
        plan: 'free',
        isVerifiedExpert: false,
        isPublicProfile: true,
        onboardingCompleted: true,
        collectionsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      setDoc(doc(aliceDb, 'collections', 'col_backdated'), {
        ownerId: 'user_alice',
        ownerName: 'Alice',
        ownerHandle: 'alice_stamps',
        title: 'Backdated Archive',
        story: '',
        coverImageUrl: '',
        category: 'stamps',
        visibility: 'public',
        itemCount: 0,
        setTargetCount: 0,
        estimatedTotalMinGbp: 0,
        estimatedTotalMaxGbp: 0,
        featured: false,
        createdAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('8. Rejects unbounded array exhaustion on specialties (> 10 items)', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'users', 'user_alice'), {
        uid: 'user_alice',
        handle: 'alice_stamps',
        displayName: 'Alice',
        bio: '',
        avatarUrl: '',
        location: 'London',
        specialties: Array.from({ length: 25 }, (_, i) => `cat_${i}`),
        goal: 'exhibit',
        role: 'collector',
        plan: 'free',
        isVerifiedExpert: false,
        isPublicProfile: true,
        onboardingCompleted: true,
        collectionsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('9. Rejects path variable ID poisoning with invalid characters', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();
    await assertFails(
      setDoc(doc(aliceDb, 'collections', 'invalid$id!chars'), {
        ownerId: 'user_alice',
        ownerName: 'Alice',
        ownerHandle: 'alice_stamps',
        title: 'Poisoned ID',
        story: '',
        coverImageUrl: '',
        category: 'stamps',
        visibility: 'public',
        itemCount: 0,
        setTargetCount: 0,
        estimatedTotalMinGbp: 0,
        estimatedTotalMaxGbp: 0,
        featured: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('10. Rejects cross-collection item injection into another collector collection', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();
    const bobDb = verifiedCtx('user_bob').firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, 'users', 'user_alice'), {
        uid: 'user_alice',
        handle: 'alice_stamps',
        displayName: 'Alice',
        bio: '',
        avatarUrl: '',
        location: 'London',
        specialties: [],
        goal: 'exhibit',
        role: 'collector',
        plan: 'free',
        isVerifiedExpert: false,
        isPublicProfile: true,
        onboardingCompleted: true,
        collectionsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertSucceeds(
      setDoc(doc(aliceDb, 'collections', 'col_alice'), {
        ownerId: 'user_alice',
        ownerName: 'Alice',
        ownerHandle: 'alice_stamps',
        title: 'Alice Stamps',
        story: '',
        coverImageUrl: '',
        category: 'stamps',
        visibility: 'public',
        itemCount: 0,
        setTargetCount: 0,
        estimatedTotalMinGbp: 0,
        estimatedTotalMaxGbp: 0,
        featured: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    await assertFails(
      setDoc(doc(bobDb, 'items', 'item_hijack'), {
        collectionId: 'col_alice',
        ownerId: 'user_bob',
        category: 'stamps',
        visibility: 'public',
        name: 'Penny Black',
        year: '1840',
        maker: 'Royal Mail',
        series: 'Line Engraved',
        setNumber: 'SG 2',
        condition: 'Fine Used',
        valueMinGbp: 120,
        valueMaxGbp: 200,
        aiConfidence: 'high',
        curatorialNote: '',
        imageUrl: 'https://example.com/stamp.jpg',
        forSale: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('11. Rejects mutating immutable collectionId on item update', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();

    await setDoc(doc(aliceDb, 'users', 'user_alice'), {
      uid: 'user_alice',
      handle: 'alice_stamps',
      displayName: 'Alice',
      bio: '',
      avatarUrl: '',
      location: 'London',
      specialties: [],
      goal: 'exhibit',
      role: 'collector',
      plan: 'free',
      isVerifiedExpert: false,
      isPublicProfile: true,
      onboardingCompleted: true,
      collectionsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(aliceDb, 'collections', 'col_1'), {
      ownerId: 'user_alice',
      ownerName: 'Alice',
      ownerHandle: 'alice_stamps',
      title: 'Archive 1',
      story: '',
      coverImageUrl: '',
      category: 'stamps',
      visibility: 'public',
      itemCount: 0,
      setTargetCount: 0,
      estimatedTotalMinGbp: 0,
      estimatedTotalMaxGbp: 0,
      featured: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(aliceDb, 'items', 'item_1'), {
      collectionId: 'col_1',
      ownerId: 'user_alice',
      category: 'stamps',
      visibility: 'public',
      name: 'Penny Black',
      year: '1840',
      maker: 'Royal Mail',
      series: 'Line Engraved',
      setNumber: 'SG 2',
      condition: 'Fine Used',
      valueMinGbp: 150,
      valueMaxGbp: 220,
      aiConfidence: 'high',
      curatorialNote: '',
      imageUrl: 'https://example.com/stamp.jpg',
      forSale: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await assertFails(
      updateDoc(doc(aliceDb, 'items', 'item_1'), {
        collectionId: 'col_2',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('12. Rejects unfiltered list scraping of private collections by non-owners', async () => {
    const aliceDb = verifiedCtx('user_alice').firestore();
    const bobDb = verifiedCtx('user_bob').firestore();

    await setDoc(doc(aliceDb, 'users', 'user_alice'), {
      uid: 'user_alice',
      handle: 'alice_stamps',
      displayName: 'Alice',
      bio: '',
      avatarUrl: '',
      location: 'London',
      specialties: [],
      goal: 'exhibit',
      role: 'collector',
      plan: 'free',
      isVerifiedExpert: false,
      isPublicProfile: true,
      onboardingCompleted: true,
      collectionsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(aliceDb, 'collections', 'col_private'), {
      ownerId: 'user_alice',
      ownerName: 'Alice',
      ownerHandle: 'alice_stamps',
      title: 'Private Vault',
      story: '',
      coverImageUrl: '',
      category: 'coins',
      visibility: 'private',
      itemCount: 0,
      setTargetCount: 0,
      estimatedTotalMinGbp: 0,
      estimatedTotalMaxGbp: 0,
      featured: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await assertFails(getDocs(collection(bobDb, 'collections')));
  });
});
