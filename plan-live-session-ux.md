# Live Session UX Improvements — Implementation Plan

## Overview

5-phase plan implementing live session UX improvements per `spec-live-session-ux.md`. Streamlines host start flow, adds inline song picker, builds member performance view (reusing existing `LivePerformanceView`/`SongView`/`TransportControls`), adds auto-reconnect, and adds session persistence. Each phase is independently verifiable. Accounts for React 19 patterns, WebRTC reconnection, and existing component reuse.

### Context

This plan builds on the Release 1 live session infrastructure (Phases 1-4 shipped). The existing codebase has:
- `LiveTab` with idle/settings/hosting/joining/joined states
- `HostDashboard` with queue management, member list, room code
- `MemberView` with queue list and beat indicator (no performance view yet)
- `LivePerformanceView` wrapping `SongView` with `LiveHeader` and `TransportControls`
- `SongPicker` component (used in setlists, multi-select with search)
- `session-storage.ts` for IndexedDB asset storage on member side
- WebRTC data channels with binary asset transfer

---

## Invariants Check

- **Dirty state:** No new editable Song fields. Host editing during session already tracked. Members read-only. ✓
- **Error handling:** Session errors → toast. Connection loss → banner. Asset loading → spinner. ✓
- **Offline:** Session assets in `metronotes-session` IndexedDB. Cleaned on session end. ✓
- **Guest mode:** Guests join (existing). Guests cannot host (existing). No new limits. ✓
- **Storage limits:** No new uploadable content. ✓
- **Confirmation dialogs:** Leave/End use `useConfirm`. No new destructive actions. ✓
- **Navigation:** Member performance view hides bottom nav. Host back → dashboard. ✓
- **Firestore:** No new Firestore fields. `sessionStorage` is browser API. ✓
- **Platform:** No new env vars. `sessionStorage` needs `typeof window` guard. ✓

---

## Phase 1: Streamlined Host Start Flow & Inline Song Picker

**Goal:** Replace the multi-field settings screen with a single name input. Add inline SongPicker to HostDashboard so host never needs to leave the Live tab.

### Step 1.1: Simplify host start in LiveTab

**File:** `app/components/LiveTab.tsx`

- Replace the `showSettings` state and full settings screen with a streamlined start flow:
  - When user taps "Start Session", show a single input for session name
  - Pre-fill with `"<display name>'s Live Session"` (use `user?.displayName ?? 'My'`)
  - "Start" button below the input
  - Remove the ToggleRow settings (metronome, wait-for-sync, allow-late-join) from the start flow
  - Pass the session name through `sessionSettings` with other fields using defaults
- Keep `handleStartSession`, `handleEndSession`, `handleJoinSession`, `handleLeaveSession` as-is

### Step 1.2: Add inline SongPicker to HostDashboard

**File:** `app/components/live/HostDashboard.tsx`

- Add `songs: Song[]` prop to `HostDashboardProps` (needed for SongPicker)
- Add local state `showSongPicker: boolean`
- Change `onAddSongs` behavior: instead of switching to Library tab, set `showSongPicker = true`
- When `showSongPicker` is true, render `SongPicker` as a full-screen overlay on top of the dashboard
- SongPicker props:
  - `songs`: all user songs
  - `existingSongIds`: `session.queue.map(q => q.songId)`
  - `onSelect`: call a new prop `onAddSongsById: (songIds: string[]) => void`, then close picker
  - `onCancel`: close picker
- Import `SongPicker` from `../SongPicker`

### Step 1.3: Wire up song addition by ID

**File:** `app/components/LiveTab.tsx`

- Add `songs: Song[]` prop to `LiveTabProps`
- Pass `songs` to `HostDashboard`
- Add new `handleAddSongsById` function that:
  - Takes `songIds: string[]`
  - Maps IDs to full `Song` objects from the `songs` prop
  - Calls existing `onAddSongsToSession` (or similar) — but this needs to be a prop from App.tsx
- Add `onAddSongsToSession: (songs: Song[]) => void` prop to `LiveTabProps`

### Step 1.4: Update App.tsx wiring

**File:** `app/components/App.tsx`

- Pass `songs` prop to `LiveTab`
- Pass `onAddSongsToSession={handleAddSongsToSession}` to `LiveTab` (already exists as `handleAddSongsToSession`)
- Remove `onSwitchToLibrary` from `LiveTab` (no longer needed — songs are added inline)
- Clean up the now-unused `handleSwitchToLibrary` if it's only used here

### Step 1.5: Add "Play" button to HostDashboard

**File:** `app/components/live/HostDashboard.tsx`

- Add a prominent "Play" button that appears when `session.queue.length > 0`
- Position it between the session info section and the members section
- On tap: call `onNavigateToSong(session.currentIndex ?? 0)` — opens the current (or first) song in performance view
- Style: full-width, accent background, with a play icon and "Play" text
- This leverages the existing `handleHostNavigateToSong` flow in App.tsx

### Verification Checklist

- [ ] Tapping "Start Session" shows a single name input pre-filled with "<display name>'s Live Session"
- [ ] Tapping "Start" creates the session and shows HostDashboard
- [ ] Settings toggles (metronome, wait-for-sync, allow-late-join) are NOT shown before session start
- [ ] Tapping "+ Add songs" on HostDashboard opens full-screen SongPicker overlay
- [ ] SongPicker shows all user songs, with songs already in queue grayed out
- [ ] Selecting songs and tapping "Add" closes picker, songs appear in queue
- [ ] "Play" button appears once at least one song is in the queue
- [ ] Tapping "Play" opens performance view for the current/first song
- [ ] Host never needs to leave the Live tab to add songs

---

## Phase 2: Member Performance View

**Goal:** Members see the current song's content in a read-only performance view, reusing existing `LivePerformanceView` / `SongView` / `TransportControls` components.

### Step 2.1: Build song data from session queue for member

**File:** `app/components/App.tsx`

- When the member's session has a `currentIndex` set (host activated a song), construct a `Song` object from the session queue item's song metadata
- Add state: `memberActiveSong: Song | null` derived from `joinSession.session?.queue[joinSession.session.currentIndex]`
- When `joinSession.session?.currentIndex` changes, update `memberActiveSong`
- The `Song` object is constructed from `QueueItem.song` (which has name, artist, bpm, timeSignature, key, audioMode, countInBars)
- Attachments come from the session queue item's `attachments` array, with binary data loaded from session IndexedDB via `getSessionAssetUrl()`

### Step 2.2: Create member performance view entry point

**File:** `app/components/App.tsx`

- In the `activeTab === 'live'` branch, add a new condition:
  - If `joinSession.connectionStatus` is 'connected' AND `memberActiveSong` is not null, render `LivePerformanceView` in read-only mode
  - Pass `memberActiveSong` as the `song` prop
  - Pass an empty `songs` array (member doesn't have the host's full library)
  - Pass `onBack` that clears `memberActiveSong` (but member can't actually navigate back — auto-follow only)
  - Pass `onSave` as no-op (read-only)
  - Set `sessionQueue` from the join session queue
  - Set `sessionQueueIndex` from the join session currentIndex
- The key insight: `LivePerformanceView` → `SongView` → attachment rendering uses `useAttachments` which loads from Firestore/localStorage. For member, we need a different data path.

### Step 2.3: Create useSessionAttachments hook for member

**File:** `app/hooks/useSessionAttachments.ts` (NEW)

- A lightweight hook that provides attachment data from session IndexedDB instead of Firestore/localStorage
- Input: `songId: string`, `attachments: Attachment[]` (metadata from session queue)
- Output: `{ attachments: Attachment[], getAssetUrl: (songId: string, assetId: string, mimeType: string) => Promise<string> }`
- The `getAssetUrl` function calls `getSessionAssetUrl()` from `session-storage.ts`
- This hook makes session attachments compatible with `SongView`'s existing attachment rendering

### Step 2.4: Add read-only mode to LivePerformanceView

**File:** `app/components/live/LivePerformanceView.tsx`

- Add `readOnly?: boolean` prop
- When `readOnly` is true:
  - Hide the edit toggle button in LiveHeader
  - Pass `readOnly` to TransportControls (new prop)
  - Disable `onSave`, `onDirtyChange` (no-op)
  - Hide edit-mode-related UI (MetadataRow editable fields)
- When `readOnly` is true, the queue dropdown shows session queue in read-only mode (no song selection — auto-follow only)

### Step 2.5: Add read-only mode to TransportControls

**File:** `app/components/live/TransportControls.tsx`

- Add `readOnly?: boolean` prop
- When `readOnly` is true:
  - Hide play/stop button (host controls playback)
  - Hide BPM +/- buttons (just show BPM value)
  - Hide audio source picker (member doesn't choose mode)
  - Keep: beat indicator (driven by synced metronome via `transport.currentBeat`/`transport.isBeating`), BPM display, volume/mute controls (local only)
- The beat indicator already exists as `BeatButton` — it just needs to render without the play/stop toggle

### Step 2.6: Integrate member beat state with TransportControls

**File:** `app/components/App.tsx`

- Pass member's synced metronome state to LivePerformanceView when in member mode:
  - `currentBeat` from `joinSession.currentBeat`
  - `isBeating` from `joinSession.isBeating`
- In LivePerformanceView, when in read-only mode, override transport state's beat fields with the synced values

### Step 2.7: Block until assets ready

**File:** `app/components/App.tsx` (or a new wrapper component)

- Before rendering member's LivePerformanceView, check if all assets for the current song are available in session IndexedDB
- Use `hasSessionAsset()` for each attachment in the current queue item
- If any are missing, show a loading spinner: "Loading song..." with the song name
- Once all assets are available, render the performance view
- When `currentIndex` changes (host navigated), reset loading state and check new song's assets

### Verification Checklist

- [ ] When host activates a song, member sees a loading spinner "Loading song..."
- [ ] Once assets are downloaded, member sees the full performance view with song content
- [ ] Member sees read-only transport bar: beat indicator (synced), BPM display, volume/mute
- [ ] Member does NOT see play/stop, BPM +/-, or audio source picker
- [ ] Member's beat indicator is synced with host's metronome
- [ ] When host navigates to a different song, member auto-switches (brief loading if new assets needed)
- [ ] Member cannot edit anything — no edit toggle visible
- [ ] Queue dropdown in header shows session queue (read-only, no song selection)
- [ ] Bottom nav bar is hidden during member performance view

---

## Phase 3: Host Dashboard Polish & Navigation

**Goal:** Polish host-side navigation between dashboard and performance view. Ensure back button, queue navigation, and session state are consistent.

### Step 3.1: Host back → dashboard (polish)

**File:** `app/components/App.tsx`

- Verify that `handleClearSong` correctly returns to HostDashboard when in a live session:
  - Currently checks `activeTab === 'live' && hostSession.isActive` → clears `activeSong` → shows LiveTab → shows HostDashboard ✓
  - Ensure `activeSetlist` and `setlistIndex` are also cleared
- Ensure Android back button (popstate) triggers the same flow

### Step 3.2: Host queue navigation from performance view

**File:** `app/components/App.tsx`

- When host taps a song in the queue dropdown (from LivePerformanceView), it should:
  - Call `hostSession.navigateToSong(index)` to update session state
  - Update `activeSong` to the new song
  - This is already handled by `handleHostNavigateToSong` — verify it works with `onSelectSongFromQueue`
- Ensure prev/next in performance view follows session queue order (not setlist/library)

### Step 3.3: Hide bottom nav for member performance view

**File:** `app/components/App.tsx`

- The bottom nav hide condition is currently: `activeTab === 'live' && currentSong`
- For members, `currentSong` is the library song — members won't have this
- Add a new condition: also hide when member is in performance view (`memberActiveSong != null`)
- Update the condition: `!(activeTab === 'live' && (currentSong || memberActiveSong))`

### Verification Checklist

- [ ] Host tapping back from performance view returns to HostDashboard (not Library)
- [ ] Host tapping a song in queue dropdown navigates to that song in performance view
- [ ] Host can go: dashboard → performance → dashboard → performance without issues
- [ ] Android back button works correctly in host performance view
- [ ] Bottom nav hidden during both host and member performance views
- [ ] Member cannot see bottom nav while viewing a song

---

## Phase 4: Auto-Reconnect for Members

**Goal:** When a member's WebRTC connection drops, automatically attempt reconnection with clear UI feedback.

### Step 4.1: Add reconnection logic to useJoinSession

**File:** `app/hooks/useJoinSession.ts`

- Add `reconnecting` status to `JoinStatus` type (already exists in the type)
- On `PeerConnectionManager.onStatusChange('disconnected')`:
  - Set status to `'reconnecting'`
  - Start reconnect timer: attempt ICE restart every 3s, up to 5 attempts (~15s)
  - ICE restart: call `pc.restartIce()` on the RTCPeerConnection, then create new offer with `iceRestart: true`
  - If ICE restart fails, try full re-signaling (re-read signaling docs, create new offer/answer)
  - On success: set status back to `'connected'`, re-sync state (host sends `session-state` on reconnection)
  - On failure after all attempts: set status to `'disconnected'`
- Add `reconnect()` method to return interface for manual reconnection

### Step 4.2: Add reconnection banner to MemberView

**File:** `app/components/live/MemberView.tsx`

- When `connectionStatus === 'reconnecting'`:
  - Show a persistent banner at the top: "Connection lost — Reconnecting..." with a subtle spinner
  - Banner style: amber background, fixed to top of view
  - Rest of the view remains visible (queue, beat indicator) but potentially stale
- When `connectionStatus === 'disconnected'` (reconnect failed):
  - Show a banner: "Disconnected — Tap to rejoin" with a button
  - Tapping the button calls `joinSession.reconnect()`
- When status returns to `'connected'`: clear banner immediately

### Step 4.3: Add reconnection banner to member performance view

**File:** `app/components/App.tsx` or member performance view wrapper

- Same reconnection banner as MemberView, but overlaid on the performance view
- Position: fixed banner at top of screen, performance view content below
- When disconnected with no reconnect success: show "Disconnected" overlay with rejoin button

### Verification Checklist

- [ ] Toggling airplane mode on member device shows "Connection lost — Reconnecting..." banner within 3s
- [ ] Banner shows over both queue view and performance view
- [ ] If connection recovers within 15s, banner clears and member re-syncs
- [ ] If connection doesn't recover after ~15s, banner changes to "Disconnected — Tap to rejoin"
- [ ] Tapping "Tap to rejoin" attempts to rejoin the session
- [ ] Song content remains visible (though possibly stale) during reconnection

---

## Phase 5: Session Persistence (Nice-to-Have)

**Goal:** Host session survives page reload. Members get a rejoin prompt on reload. Asset cleanup on queue removal.

### Step 5.1: Host session restore — save state

**File:** `app/hooks/useHostSession.ts`

- On session start: save `{ roomCode, queue, currentIndex, settings, metronome }` to `sessionStorage`
- Update `sessionStorage` on every queue/index/settings/metronome change
- On cleanup (session end or component unmount with active session): clear `sessionStorage`
- Key: `metronotes_host_session`
- Guard with `typeof window !== 'undefined'` for SSR safety

### Step 5.2: Host session restore — restore on load

**File:** `app/hooks/useHostSession.ts`

- On hook initialization: check `sessionStorage` for stored session
- If found: expose `pendingRestore: { roomCode, sessionName } | null` on the return interface
- In LiveTab: if `pendingRestore` exists, show a banner: "Session interrupted — Restore session?"
  - "Restore" button: calls `hostSession.restoreSession()` which re-creates the signaling room with the same room code, re-inits the HostConnectionManager, and re-listens for peers
  - "Dismiss" button: calls `hostSession.clearPendingRestore()` which clears sessionStorage
- Show warning banner: "Session restored — members may need to rejoin"

### Step 5.3: Member rejoin prompt

**File:** `app/hooks/useJoinSession.ts`

- On join: save `{ roomCode, displayName }` to `sessionStorage`
- On leave/session-end: clear `sessionStorage`
- On hook initialization: check `sessionStorage` for stored join info
- If found: expose `pendingRejoin: { roomCode, displayName } | null`
- Key: `metronotes_member_session`

**File:** `app/components/LiveTab.tsx`

- If `joinSession.pendingRejoin` exists, show a prompt: "Rejoin session ABC 123?"
  - "Rejoin" button: calls `joinSession.join(roomCode, displayName)`
  - "Dismiss" button: calls `joinSession.clearPendingRejoin()`

### Step 5.4: Asset cleanup on queue removal

**File:** `app/hooks/useJoinSession.ts`

- When receiving a `queue-update` message, diff the new queue against the previous queue
- For each removed song: call `deleteSessionAssets(songId)` to clean up IndexedDB

**File:** `app/lib/live-session/session-storage.ts`

- Add `deleteSessionAssetsForSong(songId: string)` function:
  - Open the IndexedDB store
  - Delete all keys matching `{songId}:*`
  - Revoke any blob URLs for those assets from the URL cache

### Step 5.5: Dashboard settings gear (nice-to-have)

**File:** `app/components/live/HostDashboard.tsx`

- Add a gear icon button next to the session name
- On tap: open a small settings sheet (modal or bottom sheet) with toggle rows:
  - Metronome enabled (toggle)
  - Wait for sync (toggle)
  - Allow late join (toggle)
- Changes apply immediately and broadcast to members via `updateSessionSettings`

**File:** `app/hooks/useHostSession.ts`

- Add `updateSessionSettings(settings: Partial<SessionSettings>)` method
- Updates local session settings and broadcasts to all connected peers

### Verification Checklist

- [ ] Host reloads page during active session → sees "Session interrupted — Restore session?" prompt
- [ ] Tapping "Restore" re-creates the session with same room code
- [ ] Members can rejoin the restored session
- [ ] Member reloads page during active session → sees "Rejoin session ABC 123?" prompt
- [ ] Tapping "Rejoin" reconnects to the session
- [ ] Tapping "Dismiss" clears the prompt and shows idle state
- [ ] When host removes a song from queue, member's IndexedDB is cleaned up for that song
- [ ] Gear icon on dashboard opens settings sheet with working toggles
- [ ] Closing the tab clears sessionStorage (no stale prompts on next visit)

---

## Deployment Checklist

- [ ] **Firebase rules:** No changes needed — existing `sessions/{roomCode}` rules cover this
- [ ] **Environment variables:** None required
- [ ] **Firebase Console:** No changes needed
- [ ] **Third-party services:** No changes needed (existing STUN servers)
- [ ] **Production build:** Verify `npm run build` passes. sessionStorage API is available in all modern browsers.

## Deferred Items

- **QR code / shareable link for joining:** Code-only is sufficient for same-room rehearsal. Avoids URL routing complexity.
- **Member-initiated song navigation:** Auto-follow host always. Keeps everyone in sync.
- **Swipe gestures for next/prev song:** Not needed for V1.
- **Backing track sync across members:** Metronome sync only for now — backing track sync is complex.
- **Max session size / queue limits:** No limit enforced. Revisit if sessions grow beyond expected rehearsal size.
- **Multiple simultaneous sessions:** Not supported. One session per user at a time.

## New Files Summary

| File | Phase | Purpose |
|------|-------|---------|
| `app/hooks/useSessionAttachments.ts` | 2 | Loads attachment data from session IndexedDB for member performance view |

## Heavily Modified Files

| File | Phases | Changes |
|------|--------|---------|
| `app/components/LiveTab.tsx` | 1, 5 | Simplified start flow, inline song picker wiring, rejoin prompt |
| `app/components/live/HostDashboard.tsx` | 1, 5 | SongPicker overlay, Play button, settings gear |
| `app/components/App.tsx` | 1, 2, 3 | Song picker wiring, member performance view routing, nav polish |
| `app/components/live/LivePerformanceView.tsx` | 2 | Read-only mode prop |
| `app/components/live/TransportControls.tsx` | 2 | Read-only mode (hide play/BPM controls, keep beat/volume) |
| `app/components/live/MemberView.tsx` | 4 | Reconnection banners |
| `app/hooks/useJoinSession.ts` | 4, 5 | Auto-reconnect, asset cleanup, rejoin persistence |
| `app/hooks/useHostSession.ts` | 5 | Session persistence, settings broadcast |
| `app/lib/live-session/session-storage.ts` | 5 | Per-song asset deletion |
