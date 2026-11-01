# Fanzeum Phase 1 — Security Specification (Payload-First Security TDD)

## 1. Data Invariants & Master Source of Truth

1. **Global Zero-Trust Catch-All**: Every path defaults to `allow read, write: if false;`. Only explicitly matched collections (`/admins/{adminId}`, `/users/{userId}`, `/users/{userId}/private/{docId}`, `/collections/{collectionId}`, `/items/{itemId}`) grant strictly scoped access.
2. **Verified Identity Gate**: Every write operation across the entire database requires `request.auth != null && request.auth.token.email_verified == true`. Unverified emails (including spoofed admin emails) are unconditionally rejected.
3. **Role & Privilege Escalation Lock**: Self-registered `UserProfile` documents must start with `role == 'collector'`, `plan == 'free'`, and `isVerifiedExpert == false`. Only an `isAdmin()` principal (bootstrapped verified `fifestreet@gmail.com` or existing `/admins/{uid}` document) may modify `role`, `plan`, `isVerifiedExpert`, or `Collection.featured`.
4. **PII Split-Collection Isolation**: Public `/users/{userId}` documents never contain `email`, phone numbers, or addresses. User email and UK GDPR consent flags live exclusively in `/users/{userId}/private/{docId}`, where `get` is restricted to `request.auth.uid == userId || isAdmin()`, `list` is forbidden (`false`), and Master Gate checks verify parent `/users/{userId}` existence (`exists` or atomic `existsAfter`).
5. **Relational Ownership Sync (Master Gate)**:
   - A `Collection` cannot be created unless `/users/$(request.auth.uid)` exists and `ownerId == request.auth.uid`.
   - A `CollectibleItem` cannot be created or updated unless `/collections/$(collectionId)` exists and `get(/databases/$(database)/documents/collections/$(collectionId)).data.ownerId == request.auth.uid`.
6. **Secure List Queries (Zero Client Delegation & Zero O(n) Reads)**:
   - `/collections` `list` strictly checks `resource.data.visibility == 'public' || (isSignedIn() && resource.data.ownerId == request.auth.uid) || isAdmin()`.
   - `/items` `list` strictly checks `resource.data.visibility == 'public' || (isSignedIn() && resource.data.ownerId == request.auth.uid) || isAdmin()`.
   - `/users` `list` strictly checks `resource.data.isPublicProfile == true || (isSignedIn() && resource.data.uid == request.auth.uid) || isAdmin()`.
   - Zero `get()` or `exists()` calls appear inside any `allow list` rule.
7. **Temporal & Immutable Integrity**: `createdAt` must equal `request.time` on creation and remain immutable on updates. `updatedAt` must equal `request.time` on every creation and update. `uid`, `ownerId`, and `collectionId` are immutable after creation.

---

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below MUST return `PERMISSION_DENIED`:

1. **Payload 1 — Privilege Escalation on Registration (`users/user_alice`)**:
   ```json
   {
     "uid": "user_alice",
     "handle": "alice_stamps",
     "displayName": "Alice",
     "bio": "Philatelist",
     "avatarUrl": "",
     "location": "London, UK",
     "specialties": ["stamps"],
     "goal": "exhibit",
     "role": "admin",
     "plan": "premium",
     "isVerifiedExpert": true,
     "isPublicProfile": true,
     "onboardingCompleted": true,
     "collectionsCount": 0,
     "createdAt": "SERVER_TIMESTAMP",
     "updatedAt": "SERVER_TIMESTAMP"
   }
   ```
2. **Payload 2 — Shadow Field Injection on Profile Update (`users/user_alice`)**:
   Adding undeclared `"isSuperAdmin": true` alongside valid `bio` update.
3. **Payload 3 — Unverified Admin Email Spoof (`collections/col_1`)**:
   Authenticated token with `email: "fifestreet@gmail.com"` and `email_verified: false` attempting to set `"featured": true`.
4. **Payload 4 — Cross-User PII Read (`users/user_alice/private/account`)**:
   Authenticated verified user `user_bob` attempting `getDoc` on Alice's private GDPR/email document.
5. **Payload 5 — Orphaned Private Subdocument Write (`users/user_ghost/private/account`)**:
   User `user_ghost` attempting to create `/users/user_ghost/private/account` when neither existing nor batched `/users/user_ghost` parent document exists.
6. **Payload 6 — Identity Spoofing on Collection Creation (`collections/col_spoof`)**:
   User `user_bob` creating a collection with `"ownerId": "user_alice"`.
7. **Payload 7 — Forged Client Timestamp (`collections/col_backdated`)**:
   User `user_alice` passing a past timestamp (`2020-01-01T00:00:00Z`) for `createdAt` instead of `request.time`.
8. **Payload 8 — Unbounded Array Exhaustion (`users/user_alice`)**:
   Setting `specialties` to an array of 25 strings (exceeding `size() <= 10`).
9. **Payload 9 — Path Variable ID Poisoning (`collections/bad..id$slash`)**:
   Attempting to create a document with non-alphanumeric ID characters violating `^[a-zA-Z0-9_\-]+$`.
10. **Payload 10 — Cross-Collection Item Injection (`items/item_hijack`)**:
    User `user_bob` attempting to insert an item with `"ownerId": "user_bob"` into `"collectionId": "col_alice"` owned by `user_alice`.
11. **Payload 11 — Immutable Field Mutation on Item Update (`items/item_1`)**:
    Owner `user_alice` attempting to mutate `collectionId` or `createdAt` during an item update.
12. **Payload 12 — Unauthorized Blanket Scraping of Private Collections (`collections`)**:
    Authenticated user `user_bob` running an unfiltered `getDocs(collection(db, 'collections'))` where private documents owned by `user_alice` exist.

---

## 3. Verification Runner

Implemented in `/firestore.rules.test.ts` using `@firebase/rules-unit-testing` and `vitest`, asserting `assertFails` (`PERMISSION_DENIED`) for all 12 adversarial payloads and `assertSucceeds` for legitimate verified collector workflows.
