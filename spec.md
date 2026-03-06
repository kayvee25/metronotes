# MetroNotes Cloud Sync

## Problem Statement

MetroNotes currently stores all data in localStorage, which means:

- Data is trapped on a single device/browser
- Clearing browser data permanently deletes songs and setlists
- No way to use the app across phone and laptop

Cloud sync solves both the durability and multi-device problems.

## Users & Personas

- **Solo musician**: Uses MetroNotes on their phone at rehearsal and laptop at home. Wants songs to be available on both without manual effort.
- **Guest user**: Doesn't want to create an account yet. Uses the app locally and can upgrade to cloud sync later.

## Core Requirements

### Must Have

- Firebase Authentication with Google OAuth and email/password sign-in
- Email verification required for email/password sign-up (block until verified, with resend option)
- Password reset ("Forgot password?") flow via Firebase Auth
- Full-screen auth page on first launch with "Sign in with Google", "Sign in with Email", and "Continue as Guest"
- Firestore storage for songs and setlists, scoped per user
- Guest mode using existing localStorage adapter
- Automatic merge of localStorage data into Firestore on first sign-in (upload all local songs/setlists, no deduplication — keep both if name+artist collide)
- After sign-in, Firestore becomes sole source of truth (localStorage data cleared, Firestore's built-in offline cache used for read-offline capability)
- Writes require an active internet connection (read offline, write online)
- Last-write-wins conflict resolution (no field-level merge)
- Data fetched on app load + pull-to-refresh (no persistent real-time listeners)
- Settings page as 3rd tab in bottom nav (for both guest and signed-in users)
- Settings page includes: sign-in/sign-out, dark mode toggle (moved from bottom nav), sync status (last sync time, current state)
- Sign-out returns user to the full-screen auth page

### Nice to Have

- Sync status animation/feedback on the settings page during active sync

### Out of Scope

- Setlist/song sharing between users (future feature — data model accommodates it)
- Account deletion from within the app
- Real-time listeners / live cross-device updates
- Full offline write support with sync queue
- Feature flags / gradual rollout

## Technical Design

### Firebase Project Setup

1. Create a Firebase project at https://console.fire
   base.google.com
2. Enable **Authentication** with these providers:
   - Google (configure OAuth consent screen)
   - Email/Password (enable email verification)
3. Create a **Firestore Database** in production mode
4. Deploy Firestore security rules (see below)
5. Register a **Web App** in Firebase console to get config values
6. Copy config values to `.env.local` for local dev and Vercel environment variables for production

### Firebase Config

Store config as `NEXT_PUBLIC_` environment variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Create `app/lib/firebase.ts` that reads these env vars and initializes the Firebase app, Auth, and Firestore instances. Include a fallback config object for development convenience (values from env vars take precedence).

### Data Model (Firestore)

```
users/{userId}/
  songs/{songId}
    name: string
    artist?: string
    bpm: number
    timeSignature: string
    key?: string
    notes?: string
    createdAt: string (ISO 8601)
    updatedAt: string (ISO 8601)

  setlists/{setlistId}
    name: string
    songIds: string[]
    createdAt: string (ISO 8601)
    updatedAt: string (ISO 8601)
```

Document fields mirror the existing TypeScript `Song` and `Setlist` types. The `id` field is not stored in the document body — it's the Firestore document ID. Existing localStorage UUIDs are preserved as document IDs during migration.

This structure supports future sharing: a shared setlist could reference songs across users, or be copied to a shared collection.

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Only authenticated users can read/write their own data. No cross-user access.

### Storage Adapter Architecture

The existing `StorageAdapter` interface is kept. A single unified adapter handles both modes internally:

```typescript
class SyncStorageAdapter implements StorageAdapter {
  // Checks Firebase Auth state internally
  // If signed in → reads/writes Firestore
  // If guest → reads/writes localStorage (existing LocalStorageAdapter logic)
}
```

The adapter exposes the same `getSongs()`, `createSong()`, etc. methods. Hooks (`useSongs`, `useSetlists`) remain unchanged.

The adapter also exposes:

- `isOnline(): boolean` — whether the user has an active connection
- `syncStatus(): 'synced' | 'syncing' | 'error' | 'offline' | 'guest'` — for the settings page
- `lastSyncTime(): Date | null` — timestamp of last successful Firestore fetch

### Auth Flow

```
App Launch
  |
  v
Check Firebase Auth state
  |
  +--> Signed in + email verified → Load Firestore data → App
  |
  +--> Signed in + email NOT verified → "Check your email" screen (resend button)
  |
  +--> Not signed in → Full-screen auth page
         |
         +--> "Sign in with Google" → Firebase Google OAuth → App
         |
         +--> "Sign in with Email" → Email/password form
         |      +--> Existing account → Sign in → App
         |      +--> New account → Create → "Check your email" screen
         |
         +--> "Continue as Guest" → App (localStorage mode)
         |
         +--> "Forgot Password?" → Email input → Firebase sends reset email → Back to sign-in
```

### Migration Flow (Guest → Signed-in)

When a guest user signs in for the first time:

1. Read all songs and setlists from localStorage
2. Write each to Firestore under `users/{userId}/songs/{songId}` and `users/{userId}/setlists/{setlistId}`, preserving existing IDs
3. Clear localStorage (`metronotes_songs`, `metronotes_setlists`)
4. Switch adapter to Firestore mode
5. Reload data from Firestore

No deduplication — if the user somehow has songs in both localStorage and Firestore (e.g., signed in on another device first), both copies are kept.

### Data Fetching Strategy

- **On app load**: Fetch all songs and setlists from Firestore once
- **Pull-to-refresh**: On the Songs and Setlists library pages, support pull-to-refresh to re-fetch from Firestore
- **After writes**: After creating/updating/deleting a song or setlist, the local state updates immediately (optimistic) and the Firestore write happens. If the write fails, show an error.
- **No real-time listeners**: No `onSnapshot` subscriptions. Data only refreshes on load or manual refresh.

## User Experience

### Auth Screen

Full-screen page shown on first launch and after sign-out. Contains:

- App logo/name at top
- "Sign in with Google" button (branded per Google guidelines)
- "Sign in with Email" button → expands to email/password form with sign-up/sign-in toggle
- "Forgot Password?" link on the sign-in form
- "Continue as Guest" button (less prominent, below sign-in options)

### Email Verification Screen

Shown after email/password sign-up:

- Message: "Check your email for a verification link"
- "Resend verification email" button
- "Back to sign in" link
- Auto-detect verification: poll or listen for auth state change, redirect to app when verified

### Settings Page (3rd tab)

**Guest mode:**

- "Sign in to sync your data across devices" CTA with sign-in button
- Dark mode toggle
- App version

**Signed-in mode:**

- User info (email, display name if available)
- Sync status: "Last synced: 2 minutes ago" / "Syncing..." / "Sync error — tap to retry"
- Dark mode toggle
- "Sign Out" button
- App version

### Edge Cases & Error States

- **Write fails (no connection)**: Show a toast/banner: "Can't save — check your internet connection." Do not save to localStorage as fallback.
- **Firestore fetch fails on load**: Show cached data from Firestore's built-in offline cache if available. If no cache, show empty state with "Could not load data. Pull to refresh."
- **Google sign-in popup blocked**: Show message explaining popup was blocked and how to allow it.
- **Email already in use**: Firebase Auth handles this — show the error message from Firebase.

### Bottom Nav Changes

Current: Songs | Setlists | [dark mode toggle]
New: Songs | Setlists | Settings

Dark mode toggle moves into the Settings page.

## Security & Privacy

- Firestore security rules ensure users can only access their own data
- Firebase Auth handles credential storage, session tokens, password hashing
- No sensitive data stored in localStorage after sign-in (Firestore cache is managed by Firebase SDK)
- Firebase API keys are safe to expose client-side — security rules protect data, not API keys
- Email verification prevents account creation with unowned email addresses

## Deployment Strategy

- Ship directly — no feature flags
- Firebase config stored as Vercel environment variables (`NEXT_PUBLIC_*`)
- Local development uses `.env.local` with the same variables
- Firestore security rules deployed via Firebase CLI (`firebase deploy --only firestore:rules`)
- No database migration needed — Firestore is schemaless, documents are created on first use

## Tradeoffs & Decisions

| Decision                               | Rationale                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase over Supabase                 | Better free tier (no inactivity pausing), built-in offline cache, simpler real-time sync if needed later                                    |
| Single adapter over swapped adapters   | User preference — one adapter checks auth state and routes internally                                                                       |
| Last-write-wins over field-level merge | App is single-user focused, concurrent edits across devices are rare. Simplicity wins.                                                      |
| Fetch-on-load over real-time listeners | Reduces Firestore read costs, simpler implementation. Pull-to-refresh covers manual sync.                                                   |
| Block until email verified             | Prevents fake account creation. Slight friction but builds trust.                                                                           |
| No account deletion in v1              | Can be handled manually or added later. Reduces scope.                                                                                      |
| Keep both on merge (no dedup)          | Simpler migration logic. Users can manually delete duplicates if any arise.                                                                 |
| Firestore sole source after sign-in    | Avoids dual-write complexity. Firestore's offline cache provides read-offline.                                                              |
| Settings as 3rd tab                    | Simple and discoverable. Bottom nav currently has 2 tabs (Songs, Setlists) + dark mode toggle; Settings replaces the toggle as the 3rd tab. |

## Acceptance Criteria / Testing Checklist

### Auth Flow

- [ ] First launch shows full-screen auth page (no bottom nav visible)
- [ ] "Sign in with Google" opens Google OAuth popup and signs in successfully
- [ ] "Sign in with Email" expands to email/password form
- [ ] New email/password sign-up sends verification email and shows "Check your email" screen
- [ ] "Resend verification email" button works on the verification screen
- [ ] Verification screen auto-detects when email is verified and redirects to app
- [ ] Signing in with an unverified email shows the verification screen (not the app)
- [ ] "Forgot Password?" sends a reset email and shows confirmation
- [ ] "Continue as Guest" enters the app in localStorage mode
- [ ] Sign-out from Settings returns to the full-screen auth page
- [ ] Invalid credentials show an appropriate Firebase error message
- [ ] "Email already in use" error shown when signing up with an existing email

### Guest Mode

- [ ] Guest mode works identically to the current app (localStorage read/write)
- [ ] All existing song/setlist CRUD operations work in guest mode
- [ ] No Firebase calls are made in guest mode
- [ ] Settings page shows "Sign in to sync your data across devices" CTA

### Signed-in Mode (Firestore)

- [ ] Songs and setlists are stored in Firestore under `users/{userId}/`
- [ ] Create song → appears in Firestore immediately
- [ ] Update song → Firestore document updated
- [ ] Delete song → Firestore document deleted, removed from all setlists
- [ ] Create setlist → appears in Firestore
- [ ] Update setlist (rename, reorder songs, add/remove songs) → Firestore updated
- [ ] Delete setlist → Firestore document deleted
- [ ] Data loads on app launch from Firestore
- [ ] Pull-to-refresh on Songs page re-fetches from Firestore
- [ ] Pull-to-refresh on Setlists page re-fetches from Firestore
- [ ] No localStorage keys (`metronotes_songs`, `metronotes_setlists`) are used after sign-in

### Migration (Guest → Signed-in)

- [ ] Guest creates songs and setlists in localStorage
- [ ] Guest signs in → all localStorage songs/setlists appear in Firestore
- [ ] Existing localStorage IDs are preserved as Firestore document IDs
- [ ] Setlist `songIds` references still work after migration
- [ ] localStorage keys (`metronotes_songs`, `metronotes_setlists`) are cleared after migration
- [ ] If Firestore already has data (signed in on another device), both local and remote data are kept (no dedup)

### Multi-device Sync

- [ ] Sign in on Device A, create a song → sign in on Device B → song appears
- [ ] Edit a song on Device A → pull-to-refresh on Device B → changes appear
- [ ] Delete a song on Device A → pull-to-refresh on Device B → song is gone

### Settings Page

- [ ] Settings is the 3rd tab in bottom nav (Songs | Setlists | Settings)
- [ ] Dark mode toggle works (moved from bottom nav)
- [ ] Guest mode: shows sign-in CTA button and app version
- [ ] Signed-in mode: shows user email/display name
- [ ] Signed-in mode: shows sync status ("Last synced: X ago" / "Syncing..." / "Sync error")
- [ ] Signed-in mode: "Sign Out" button works
- [ ] App version is displayed

### Bottom Nav

- [ ] Three tabs: Songs, Setlists, Settings
- [ ] Dark mode toggle no longer in bottom nav (moved to Settings)
- [ ] Active tab is visually highlighted
- [ ] Navigation between tabs works correctly

### Error Handling

- [ ] Write with no internet → toast/banner: "Can't save — check your internet connection"
- [ ] No localStorage fallback for writes when signed in
- [ ] Firestore fetch fails on load → shows Firestore offline cache data if available
- [ ] Firestore fetch fails with no cache → empty state with "Could not load data. Pull to refresh."
- [ ] Google sign-in popup blocked → helpful message shown

### Existing Features (Regression)

- [ ] Metronome plays correctly (beat indicator, audio, BPM changes)
- [ ] Song edit mode: BPM, time signature, key, notes, artist all save correctly
- [ ] Song performance mode: notes scroll, header stays fixed, beat indicator works
- [ ] Setlist detail: song order, drag-to-reorder, play from setlist
- [ ] Setlist navigation: prev/next song within a setlist
- [ ] Quick-add song modal works
- [ ] Song/setlist sorting persists across sessions (localStorage sort preferences)
- [ ] Unsaved changes dialog works when navigating away from dirty song
- [ ] FAB buttons work on Songs and Setlists pages
- [ ] Search songs works
- [ ] PWA install and offline access still work

### Build & Lint

- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes with no errors
- [ ] No TypeScript errors

## Open Questions

- None — all tracks covered during interview.
