import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

async function isFirestoreEmulatorRunning(): Promise<boolean> {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 450);
    const res = await fetch(`http://${host}/`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    return text === 'Ok';
  } catch {
    return false;
  }
}

const rulesSource = readFileSync('firestore.rules', 'utf8');
const storageRulesSource = readFileSync('storage.rules', 'utf8');
const blueprintJson = JSON.parse(readFileSync('firebase-blueprint.json', 'utf8'));

describe('Fanzeum Security Rules — Dirty Dozen Invariant Verification', () => {
  it('1. Enforces global default-deny catch-all and rules_version 2', () => {
    expect(rulesSource).toContain("rules_version = '2';");
    expect(rulesSource).toMatch(/match\s+\/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  });

  it('2. Synchronizes every collection path declared in firebase-blueprint.json', () => {
    const paths = Object.keys(blueprintJson.firestore || {});
    expect(paths).toEqual(
      expect.arrayContaining([
        '/admins/{adminId}',
        '/users/{userId}',
        '/users/{userId}/private/{docId}',
        '/users/{userId}/itemPrivate/{itemId}',
        '/collections/{collectionId}',
        '/items/{itemId}',
      ]),
    );
    expect(rulesSource).toContain('match /admins/{adminId}');
    expect(rulesSource).toContain('match /users/{userId}');
    expect(rulesSource).toContain('match /private/{docId}');
    expect(rulesSource).toContain('match /itemPrivate/{itemId}');
    expect(rulesSource).toContain('match /collections/{collectionId}');
    expect(rulesSource).toContain('match /items/{itemId}');
  });

  it('3. Blocks privilege escalation on registration (locks role=collector, plan=free, isVerifiedExpert=false)', () => {
    expect(rulesSource).toContain("incoming().role == 'collector'");
    expect(rulesSource).toContain("incoming().plan == 'free'");
    expect(rulesSource).toContain('incoming().isVerifiedExpert == false');
  });

  it('4. Blocks shadow field injection via hasAll/hasOnly and affectedKeys().hasOnly() on every entity', () => {
    expect(rulesSource).toContain('isValidUserProfile(incoming())');
    expect(rulesSource).toContain('isValidCollection(incoming())');
    expect(rulesSource).toContain('isValidCollectibleItem(incoming())');
    expect(rulesSource).toContain('incoming().diff(existing()).affectedKeys().hasOnly(');
  });

  it('5. Prevents unverified admin email spoofing (requires email_verified == true)', () => {
    expect(rulesSource).toContain('request.auth.token.email_verified == true');
    expect(rulesSource).toMatch(/function isAdmin\(\)\s*\{\s*return isVerifiedUser\(\) &&/);
  });

  it('6. Isolates PII (/private) and private acquisition prices (/itemPrivate) to owner or admin with parent Master Gate', () => {
    expect(rulesSource).toContain('exists(/databases/$(database)/documents/users/$(userId))');
    expect(rulesSource).toContain('isValidUserPrivateAccount(incoming())');
    expect(rulesSource).toContain('isValidItemPrivateRecord(incoming())');
  });

  it('7. Blocks base64 image bloat by capping image/avatar/cover URLs at 2048 chars', () => {
    expect(rulesSource).not.toContain('180000');
    expect(rulesSource).toContain('data.imageUrl.size() <= 2048');
    expect(rulesSource).toContain('data.thumbUrl.size() <= 2048');
    expect(rulesSource).toContain('data.coverImageUrl.size() <= 2048');
    expect(rulesSource).toContain('data.avatarUrl.size() <= 2048');
  });

  it('8. Enforces server timestamps (request.time) and immutable createdAt on updates', () => {
    expect(rulesSource).toContain('incoming().createdAt == request.time');
    expect(rulesSource).toContain('incoming().updatedAt == request.time');
    expect(rulesSource).toContain('incoming().createdAt == existing().createdAt');
  });

  it('9. Guards path IDs against poisoning (<= 128 chars, alphanumeric/hyphen/underscore regex)', () => {
    expect(rulesSource).toContain("id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$')");
  });

  it('10. Caps all arrays (specialties <= 10, photos <= 6, tags <= 12) against resource exhaustion', () => {
    expect(rulesSource).toContain('data.specialties.size() <= 10');
    expect(rulesSource).toContain('data.photos.size() <= 6');
    expect(rulesSource).toContain('data.tags.size() <= 12');
  });

  it('11. Verifies collection ownership when creating or moving pieces across collections', () => {
    expect(rulesSource).toContain(
      'get(/databases/$(database)/documents/collections/$(incoming().collectionId)).data.ownerId == request.auth.uid',
    );
  });

  it('12. Enforces Storage owner-only image/* uploads under 10MB', () => {
    expect(storageRulesSource).toContain('request.auth.uid == uid');
    expect(storageRulesSource).toContain("request.resource.contentType.matches('image/.*')");
    expect(storageRulesSource).toContain('10 * 1024 * 1024');
  });
});

const emulatorReady = await isFirestoreEmulatorRunning();

if (emulatorReady) {
  describe('Fanzeum Live Firestore Emulator — Dirty Dozen Runtime Suite', () => {
    let testEnv: RulesTestEnvironment;

    beforeAll(async () => {
      testEnv = await initializeTestEnvironment({
        projectId: 'fanzeum-rules-test',
        firestore: {
          host: '127.0.0.1',
          port: 8080,
          rules: rulesSource,
        },
      });
    });

    afterAll(async () => {
      if (testEnv) await testEnv.cleanup();
    });

    beforeEach(async () => {
      await testEnv.clearFirestore();
    });

    function verifiedCtx(uid: string, email = `${uid}@example.co.uk`) {
      return testEnv.authenticatedContext(uid, { email, email_verified: true });
    }

    function validUserPayload(uid: string, overrides: Record<string, unknown> = {}) {
      return {
        uid,
        handle: `${uid}_uk`,
        displayName: 'Alice Collector',
        bio: 'British stamps & sovereigns',
        avatarUrl: 'https://example.com/a.webp',
        location: 'York',
        specialties: ['stamps'],
        goal: 'exhibit',
        role: 'collector',
        plan: 'free',
        isVerifiedExpert: false,
        isPublicProfile: true,
        hideValues: false,
        hideLocation: false,
        onboardingCompleted: true,
        collectionsCount: 0,
        piecesCount: 0,
        joinedLabel: 'March 2025',
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...overrides,
      };
    }

    it('Rejects privilege escalation, shadow fields, unverified spoof, PII leak, forged timestamps, and unfiltered list', async () => {
      const aliceDb = verifiedCtx('user_alice').firestore();
      const bobDb = verifiedCtx('user_bob').firestore();
      await assertFails(
        setDoc(doc(aliceDb, 'users', 'user_alice'), validUserPayload('user_alice', { role: 'admin' })),
      );
      await assertSucceeds(setDoc(doc(aliceDb, 'users', 'user_alice'), validUserPayload('user_alice')));
      await assertFails(
        updateDoc(doc(aliceDb, 'users', 'user_alice'), {
          bio: 'Updated',
          isSuperAdmin: true,
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
      await assertFails(
        setDoc(doc(aliceDb, 'collections', 'col_forged'), {
          ownerId: 'user_alice',
          ownerName: 'Alice',
          ownerHandle: 'user_alice_uk',
          title: 'Forged Dates',
          story: '',
          coverImageUrl: '',
          category: 'stamps',
          visibility: 'public',
          itemCount: 0,
          setTargetCount: 10,
          estimatedTotalMinGbp: 0,
          estimatedTotalMaxGbp: 0,
          featured: false,
          isDemo: false,
          createdAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
          updatedAt: serverTimestamp(),
        }),
      );
      await assertFails(getDocs(collection(bobDb, 'collections')));
    });
  });
}
