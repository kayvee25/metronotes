# MetroNotes Cross-Cutting Invariants

System-wide behaviors that span multiple features. Every new spec MUST be checked against this document before finalizing. Updated as new features ship.

---

## Dirty State Tracking

**Tracked fields** (SongView.tsx `OriginalValues`):
- `name`, `artist`, `bpm`, `timeSignature`, `musicalKey`, `audioMode`, `countInBars`

**Rules:**
- Any change to a tracked field enables the Save button and blocks navigation
- Navigation attempts when dirty → unsaved changes dialog (Discard / Save)
- Uploads in progress suppress dirty state (`!isUploading` guard)
- Rich text editor has its own internal dirty tracking (content comparison on exit)
- BPM/timeSignature changes in **performance mode** DO trigger dirty state (they're user-initiated edits)

**When adding new Song fields:** If the field is editable in SongView, add it to `OriginalValues` and the `isDirty` computation. If you don't, changes to that field will silently discard on navigation.

---

## Error Handling

**Surface mechanism:** Toast notifications (`useToast`), 4s auto-dismiss, max 5 on screen.

**Classification:**
| Category | When | Message pattern |
|----------|------|----------------|
| Network | Firestore/Storage write fails | "Can't save — check your internet connection." |
| Validation | File too large, wrong type | Specific: "File too large (max 3MB)" |
| Guest limit | Create song beyond MAX_SONGS | "Guest mode is limited to 3 songs..." |
| Storage quota | IndexedDB full | "Storage full — try clearing the offline cache in Settings" |
| Cloud auth | Drive token expired during download | "Some Drive files need re-authentication..." |
| Load failure | Firestore fetch fails on app load | "Could not load data. Tap refresh to retry." |

**Pattern:** `onError` callback on hooks, stabilized via `useRef`. Optimistic updates revert state on error + show toast.

**When adding new write operations:** Use the optimistic update + rollback pattern. Catch errors, revert state, call `onErrorRef.current?.(message)`. Never show raw error objects to users.

---

## Offline Behavior

**Works offline:** Read operations on loaded data, metronome, drawings/annotations, settings, performance mode.

**Requires connection:** All CRUD (Firestore), file uploads (Storage), cloud imports (Drive), auth.

**Cache:** IndexedDB store `metronotes-offline`, key format `attachment:{attachmentId}`. Binary media only (images, PDFs, audio). Rich text is Firestore JSON, not cached separately.

**When adding new binary attachment types:** Integrate with `downloadAndCache()` in `offline-cache.ts`. Ensure `areAttachmentsCached()` and `countUncached()` include the new type.

---

## Guest Mode

**Limits:** 3 songs max (`GUEST.MAX_SONGS` in constants.ts). All features available within that limit.

**Storage:** Songs/setlists in localStorage. Binary blobs in IndexedDB (`metronotes-guest` store, key `guest:{songId}:{attachmentId}`).

**Migration:** On sign-in, `migrateLocalToFirestore()` uploads everything to Firestore/Storage with progress UI. Blobs uploaded to Firebase Storage, references updated.

**When adding new data types:** Ensure they work in both localStorage (guest) and Firestore (authenticated) modes. Add migration logic for the new type. If it has binary data, add IndexedDB guest storage support.

---

## Storage Limits

| Resource | Limit | Constant |
|----------|-------|----------|
| Image file | 3 MB | `MAX_IMAGE_SIZE` |
| PDF file | 5 MB | `MAX_PDF_SIZE` |
| Audio file | 10 MB | `MAX_AUDIO_SIZE` |
| Per-song total | 30 MB | `MAX_SONG_SIZE` |
| Per-user total | 100 MB | (not enforced in code yet) |

**Validation flow:** Check file type → check file size → check song total → compress if image → upload.

**When changing limits:** Update both the constant AND any user-facing error messages that reference the limit.

---

## Confirmation Dialogs

**Rule:** NEVER use browser `confirm()` or `alert()`. Always use `useConfirm()` from `ConfirmModal.tsx`.

**Pattern:** `const confirmed = await confirm({ title, message, confirmLabel, variant })`. Returns `boolean`.

**Variant:** Use `'danger'` for destructive actions (delete), `'default'` for non-destructive.

---

## Navigation

**Song view** opens on top of tab content, managed via `showSongView` state in App.tsx. Back navigation checks dirty state.

**Android back button:** `history.pushState` + `popstate` listener. Must be maintained for any new overlay/modal that should intercept back.

**Setlist flow:** `navigationSource`, `activeSetlist`, `setlistIndex` track context. Prev/next navigation within setlist.

**When adding new full-screen views:** Wire up dirty state checks if the view has editable content. Support Android back button if it's a stacked view.

---

## Firestore Constraints

- **No `undefined` values.** Firestore rejects `undefined` in `setDoc`/`updateDoc`. Sanitize inputs: use `?? null` or `deleteField()` for optional fields.
- **1 MB document limit.** Attachment metadata is per-document. Binary data goes to Firebase Storage, not Firestore.
- **Subcollection paths:** `users/{userId}/songs/{songId}`, `users/{userId}/songs/{songId}/attachments/{attachmentId}`, `users/{userId}/setlists/{setlistId}`.

---

## Platform Considerations

- **Next.js prerendering:** All components are `'use client'` but Next.js still prerenders. Environment variables accessed at module scope must use `|| ''` fallback, not `!` assertion.
- **React 19 / React Compiler:** No `useCallback` with optional chaining deps. Use conditional setState during render for derived state resets. `useRef` for one-time flags.
- **Service worker:** Disabled in development (`next-pwa` config). Test PWA behavior in production builds only.
