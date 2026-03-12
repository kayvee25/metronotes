# MetroNotes Roadmap

## Completed

### Rich Notes V1
- Rich text editor (Tiptap) with formatting toolbar
- Image attachments with compression and Firebase Storage
- Attachment list with drag-and-drop reordering
- Default attachment (star toggle) for performance mode
- Paged performance view with dot navigation
- Auto-migration from plain-text notes
- Custom confirmation modals (replaced all browser dialogs)
- Dirty state tracking for rich text editor

**Spec:** `spec-rich-notes.md` | **Plan:** `plan-rich-notes.md`

### Rich Notes V2
- PDF attachments with lazy page-by-page rendering (PDF.js)
- Freehand drawing canvas (perfect-freehand) with pen, eraser, 6 colors, undo
- Image annotations (transparent drawing overlay)
- PDF annotations (per-page annotation layers)
- Zoom & pan across all attachment types (pinch-to-zoom, Ctrl+scroll, double-tap)
- Offline cache infrastructure (idb-keyval + IndexedDB)
- Offline download UI for setlists with progress tracking
- Offline banner and cache management in Settings
- Toast notification system

**Spec:** `spec-rich-notes-v2.md` | **Plan:** `plan-rich-notes-v2.md`

### UI Redesign
- Warm amber/cream theme with CSS custom properties
- Floating metronome pill (shared across edit and performance mode)
- Full-screen teleprompter performance mode
- Compact controls grid in edit mode
- Wake lock during performance

**Spec:** `spec-redesign.md`

### Cloud Sync
- Firebase Auth (Google OAuth, email/password, guest mode)
- Firestore CRUD with optimistic updates and error rollback
- Guest-to-authenticated data migration

### Backing Tracks
- MP3 backing tracks with integrated playback and count-in
- Per-song audio mode (metronome / backing track / off)
- Transport controls (seek bar, volume) in edit and performance mode
- PlayFAB unified audio control surface
- Guest mode overhaul: 3-song limit, IndexedDB blob storage, migration with progress

**Spec:** `spec-backing-tracks.md` | **Plan:** `plan-backing-tracks.md`

### Google Drive Integration
- Cloud file import for attachments and backing tracks
- Google Drive picker with OAuth
- Offline caching for cloud-linked files
- Camera capture for image attachments

**Spec:** `spec-drive-integration.md`

---

## Up Next

### Release 0: Foundation & Redesign
Full UX redesign + asset foundation layer. Restructures navigation to Library (Songs | Setlists | Files) | Live | Settings. Replaces SongView overlay with a dedicated Live tab for performance + editing. Removes PlayFAB in favor of header-integrated transport controls with multi-audio-track selection. Extracts attachments into independent assets. Queue system with dropdown. Slide-up edit panel. Multiple rich text and audio files per song.

**Status:** In progress (branch: `release-0-foundation-redesign`, Phases 1-6 complete + PR review fixes)

**Spec:** `spec-collaboration.md` (asset model sections) | **Plan:** `plan-release-0-foundation.md` (6 phases)

### Release 1: Live Session
WebRTC-based real-time session sync. Bandleader starts a session from their own songs/setlists, members join via room code. Songs sync in real-time, assets transfer P2P. Firestore signaling for connection establishment. Session assets stored in separate IndexedDB store, cleaned up on session end. Guests can join sessions (no auth needed for WebRTC peers) but cannot host.

**Status:** Not started. Depends on Release 0.

**Spec:** `spec-live-session.md` | **Plan:** `plan-release-1-live-session.md` (5 phases)

### Release 2: Collaboration
Shared setlists with join-code invitations, cross-user song access, contributor attachments, and role-based permissions (owner, editor, contributor, viewer). Live session integration — bandleader can start a session from a shared setlist with songs from multiple owners. Stale detection via `onSnapshot` + `sharing.updatedAt`. Soft-delete on shared attachments for revocation recovery.

**DB sync strategy (v1):** Denormalized `memberIds` array on setlists and `sharedWith` array on songs for Firestore security rules, kept in sync via batch writes — no Cloud Functions. Every membership mutation goes through `syncSharedWithForSetlist()` which updates all affected documents atomically. Acceptable at current scale.

**Status:** Not started. Depends on Release 0 and Release 1.

**Spec:** `spec-collaboration.md` | **Plan:** `plan-release-2-collaboration.md` (5 phases)

---

## Deferred Items

Specified but not yet implemented. Tracked here to prevent silent accumulation.

### From Rich Notes V1
- Thumbnail generation (200px wide, JPEG 0.6 quality) for image attachments
- `hasAttachments` boolean flag on Song for faster list rendering

### From Cloud Sync
- Sync status display in Settings ("Last synced: X ago" / "Syncing..." / "Sync error")

### From Rich Notes V2
- Per-song offline download icon in song library view
- Aggregate download progress display across setlist songs

### From Drive Integration
- "Open in Drive" link on cloud-linked attachment cards
- Re-import action for broken/moved cloud links
- `isAvailable()` method on CloudProvider interface

### From UI Redesign
- Two-column grid for songs on wide screens (>1024px)
- Swipe-only delete in SetlistDetail (currently still shows X button)

### From Release 0: Foundation
- Asset search/filter in Files tab
- Link existing assets to songs from Files tab ("Add to song...")
- Volume control in transport bar (currently in FAB — needs a new home)
- Count-in bars config (currently in FAB — move to edit panel or transport settings)
- Lazy-load asset linkage in `useAssetLinkage` — currently fetches all attachments for all songs on mount, causing a burst of Firestore reads even if user never visits Files tab. Paginate or defer until Files tab is opened.

### From Release 1: Live Session
- Peer-assisted transfer (BitTorrent-like) for scaling beyond 8 members
- Cascading/tree topology for 15+ members
- TURN server fallback for restrictive networks
- Session persistence across app restart
- Member management (kick, approve/deny joins)
- Smart prefetch prioritization

### From Release 2: Collaboration
- Migrate cross-user song reads from client-side `sharedWith` + security rules to a Cloud Function read proxy — eliminates the `sharedWith` sync point entirely. Do this when Cloud Functions are introduced for other reasons (notifications, scheduled cleanup, etc.)
- Fork/copy of shared songs (3 tiers per spec)
- Band/group concept (syntactic sugar over individual sharing)
- Owner attachment visibility toggle per song
- Ownership transfer for setlists
- Notification center (users see updates on refresh for v1)
- Per-member Firestore `lastSeenAt` for cross-device stale badges
- Optimized session transfer for setlist contributors (skip already-cached assets)
- `collectionGroup` index for shared setlist queries (may need Firestore composite index at deployment)

### UI Font Upgrade
- Current: Geist Sans (Next.js default) — feels generic
- Candidates to try: **Plus Jakarta Sans** (warm, premium), **Instrument Sans** (music-themed, narrow), **DM Sans** (geometric, friendly), **Outfit** (modern, playful), **Inter** (polished, tabular numbers)
- Note: swapping via `next/font/google` in `layout.tsx` didn't hot-reload; may need full restart or build. Investigate.

### Known Violations
*(none — all previously tracked violations have been resolved)*
