# Fanzeum — Phase 1 Collector Cabinet

Fanzeum is a mobile-first, installable Progressive Web App (PWA) for collectors of football cards, trading cards, coins, stamps, comics, vinyl, vintage toys, and sporting memorabilia.

## Stack & Architecture

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 (`@theme` tokens in `src/index.css`, "After Hours" dark gallery default + Daylight toggle).
- **Portable AI Module (`src/server/ai/*`):** Single Gemini model constant (`GEMINI_FLASH_MODEL` in `src/server/ai/constants.ts`), Zod request/response validation, 8 MB payload limit, 20 identifications/hour per user/IP rate limit.
  - **Node / AI Studio / Cloud Run:** Mounted in `server.ts` at `/api/ai/:route`.
  - **Cloudflare Pages / Workers:** Mounted in `functions/api/ai/[route].ts` using the exact same handlers.
- **Firebase:**
  - **Authentication:** Google Sign-In + Email/Password (with email verification required before cloud writes).
  - **Firestore (`firestore.rules`):** Strict schema & field-length validation; PII (`email`, consent flags) isolated in `/users/{uid}/private/account` and private purchase prices isolated in `/users/{uid}/itemPrivate/{itemId}`.
  - **Cloud Storage (`storage.rules`):** Client-side `<canvas>` strips EXIF/GPS metadata and uploads 2000px WebP masters + 480px WebP thumbnails to `users/{uid}/items/{itemId}/...`.

---

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   ```
   *(Optional `VITE_FIREBASE_*` overrides are supported if pointing at another Firebase project; otherwise `firebase-applet-config.json` is used automatically.)*
3. Start the Express + Vite server on port `3000`:
   ```bash
   npm run dev
   ```
4. Typecheck & test Firestore rules:
   ```bash
   npm run lint
   npx eslint firestore.rules
   npm run test:rules
   ```

---

## Deploying Security Rules to Firebase

Project ID: `animated-wallaby-f01dl`

1. **Firestore Rules** (`firestore.rules`):
   ```bash
   firebase deploy --only firestore:rules --project animated-wallaby-f01dl
   ```
2. **Cloud Storage Rules** (`storage.rules`):
   - In **Firebase Console → Storage**, ensure Cloud Storage is initialised on the project (`animated-wallaby-f01dl.firebasestorage.app`), then deploy:
   ```bash
   firebase deploy --only storage --project animated-wallaby-f01dl
   ```

---

## Firebase Console Checklist (Required for External Domains)

1. **Authorised Domains (Google & Email Auth):**
   Go to **Firebase Console → Authentication → Settings → Authorised domains** and add:
   - `fanzeum.bruce-787.workers.dev`
   - Any custom production domain (e.g. `fanzeum.com` / `fanzeum.co.uk`)
2. **Sign-in Providers:**
   Under **Authentication → Sign-in method**, ensure both **Google** and **Email/Password** are enabled.
3. **Storage CORS (if uploading from a custom domain):**
   Firebase Storage download URLs work cross-origin out of the box via `uploadBytes` + `getDownloadURL`.

---

## Deploying to Cloudflare Pages / Workers

1. Build the static bundle:
   ```bash
   npm run build
   ```
   Output directory: `dist` (Cloudflare Pages automatically picks up `functions/api/ai/[route].ts` for `/api/ai/*`).
2. Configure the server-side Gemini secret in Cloudflare (never prefix with `VITE_`):
   ```bash
   npx wrangler pages secret put GEMINI_API_KEY
   ```
   *(Or for a standalone Worker at `fanzeum.bruce-787.workers.dev`: `npx wrangler secret put GEMINI_API_KEY`.)*
3. Optional `VITE_FIREBASE_*` environment variables if overriding `firebase-applet-config.json`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_FIRESTORE_DATABASE_ID`

---

## Seeding & Removing Demo Data

- Out of the box, the 6 UK demo collectors, 16 collections, and 192 pieces render immediately for visitors.
- When signed in as the admin account (`fifestreet@gmail.com`), open **Settings** (`/settings`) → **Admin Demo Controls**:
  - **Load demo data (192 pieces):** Writes all `isDemo: true` profiles, collections, and pieces into Firestore idempotently.
  - **Remove demo data:** Deletes all `isDemo: true` documents from Firestore and hides the built-in demo fallback.
