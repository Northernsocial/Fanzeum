# Fanzeum Phase 1 — Security Specification & Dirty Dozen Payloads

## 1. Data Invariants
1. **Default-Deny Catch-All**: `match /{document=**} { allow read, write: if false; }` is the first block.
2. **Verified Identity**: Every write requires `request.auth != null && request.auth.token.email_verified == true`.
3. **No Base64 Blobs in Firestore**: `avatarUrl`, `coverImageUrl`, `imageUrl`, and `thumbUrl` are capped at `<= 2048` characters (Storage / HTTPS URLs or compact `<2KB` SVG data URIs only).
4. **PII & Private Price Isolation**:
   - `/users/{userId}` contains zero email/phone/address PII.
   - `/users/{userId}/private/{docId}` isolates email and UK GDPR consent to owner/admin.
   - `/users/{userId}/itemPrivate/{itemId}` isolates `acquiredPriceGbp`, `acquiredDate`, and `privateNotes` strictly to owner/admin.
5. **Relational Master Gate**:
   - Creating or moving an item in `/items/{itemId}` requires `exists(/collections/{collectionId})` AND `get(/collections/{collectionId}).data.ownerId == request.auth.uid`.
6. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` and `createdAt == existing().createdAt` on update.
7. **Admin Demo Seeding**: Only `isAdmin()` (verified `fifestreet@gmail.com` or `/admins/{uid}`) can create/delete `isDemo == true` showcase documents.

## 2. The Dirty Dozen Payloads (All Must Return PERMISSION_DENIED)
1. **Privilege Escalation on Registration**: User creates `/users/{uid}` with `role: 'admin'`, `plan: 'premium'`, or `isVerifiedExpert: true`.
2. **Shadow Field Injection on Update**: User updates `/users/{uid}` adding `{ isSuperAdmin: true }`.
3. **Unverified Admin Email Spoof**: Token has `email: 'fifestreet@gmail.com'` with `email_verified: false`.
4. **Cross-User PII Read**: `user_bob` reads `/users/user_alice/private/account`.
5. **Cross-User Private Price Read**: `user_bob` reads `/users/user_alice/itemPrivate/item_1`.
6. **Orphaned Subdocument Write**: Writing `/users/{uid}/private/account` without parent `/users/{uid}` existing.
7. **Collection Identity Spoofing**: `user_bob` creates `/collections/col_1` with `ownerId: 'user_alice'`.
8. **Forged Client Timestamp**: Creating a collection with a backdated `Timestamp` instead of `serverTimestamp()`.
9. **Unbounded Array Exhaustion**: Creating a user profile with 25 `specialties` (`> 10` limit) or an item with 20 `tags` (`> 12` limit).
10. **ID Poisoning**: Document ID containing `$` or exceeding 128 characters.
11. **Cross-Collection Hijack / Unowned Move**: Moving or creating an item into another user's or nonexistent `collectionId`.
12. **Unfiltered Private List Scraping & Base64 Bloating**: Listing `/collections` without `visibility == 'public'` filter, or writing a 10KB base64 string into `imageUrl` (`> 2048` limit).
