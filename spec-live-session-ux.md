# Live Session UX Improvements

## Problem Statement

The current live session flow has too much friction for both hosts and members. Hosts must tab-switch between Library and Live to add songs. Members see only a queue list with no song content. Session persistence, reconnection, and navigation between dashboard and performance views need polish.

## Users & Personas

- **Host:** Band leader running rehearsal. Needs to start a session quickly, add songs, control the metronome, and navigate the queue — all without leaving the Live tab.
- **Member:** Band member joining rehearsal. Needs to see the current song's notes/attachments in a read-only performance view, hear the synced metronome, and follow along as the host navigates.

## Core Requirements

### Must Have

1. **Streamlined host start flow** — One input (session name, defaulting to `"<user name>'s Live Session"`), then Start. Other settings configurable from the dashboard after session starts.
2. **Inline song picker** — Host taps "+ Add songs" on the dashboard → full-screen `SongPicker` overlay (reuse existing component) → multi-select → Add → returns to dashboard with songs queued.
3. **"Play" button on dashboard** — Prominent button that opens the current (or first) song in performance view. Appears once at least one song is in the queue.
4. **Member performance view** — Reuse `LivePerformanceView` / `SongView` in read-only mode. Song content loaded from session IndexedDB. Auto-follows host song changes.
5. **Member transport bar** — Reuse `TransportControls` in read-only config: beat indicator (synced), read-only BPM, local volume/mute. No play/stop, no BPM +/-, no source picker.
6. **Block until assets ready** — Member performance view shows a loading spinner until all assets for the current song are downloaded. Then renders the full view.
7. **Host back → dashboard** — Back button from performance view returns to the HostDashboard (stays on Live tab). Next/prev follows session queue order.
8. **Host nav in performance view** — Queue dropdown in LiveHeader shows session queue (not library). Tapping a song navigates within the session queue.
9. **Auto-reconnect for members** — On network drop: show "Connection lost" banner immediately → auto-attempt reconnect → "Reconnecting..." → success clears banner. After ~15s failure: "Disconnected — Tap to rejoin".
10. **Hide nav in performance view** — Bottom nav bar hidden while in song performance view (both host and member). Already the case for host; needs implementation for member.

### Nice to Have

11. **Host session restore on reload** — Store session state (queue, room code, settings) in sessionStorage. On reload, show warning banner "Session interrupted — restoring..." and re-create the host connection manager. Re-listen for peers (existing members reconnect via auto-rejoin).
12. **Member rejoin prompt on reload** — Store room code + display name in sessionStorage. On reload, show "Rejoin session ABC 123?" prompt. Member chooses to rejoin or dismiss.
13. **Asset cleanup on queue removal** — When host removes a song from the queue, delete that song's assets from member IndexedDB immediately (don't wait for session end).
14. **Dashboard settings gear** — Gear icon on dashboard that opens session settings (metronome enabled, wait-for-sync, allow-late-join, prefetch window). Changes apply immediately and broadcast to members.

### Out of Scope

- QR code / shareable link for joining (code-only is sufficient for same-room rehearsal)
- Member editing songs (read-only only)
- Member-initiated song navigation (auto-follow host always)
- Swipe gestures for next/prev song
- Backing track sync across members (metronome sync only)

## Technical Design

### Host Start Flow

1. User taps "Start Session" on Live tab idle screen
2. Single input: session name (pre-filled with `"<display name>'s Live Session"`)
3. Tap "Start" → creates signaling room, generates room code
4. Immediately shows HostDashboard with empty queue

### Song Picker Integration

- Reuse `SongPicker` component (already used for setlist building)
- Props: `songs`, `onSelect: (songs: Song[]) => void`, `selectedIds` (songs already in queue)
- On select: call `addSongsToQueue` which loads attachments and assets, sends to connected members
- Full-screen overlay, dismiss returns to dashboard

### Member Performance View

**Reuse existing components** — no new performance view component needed.

- Reuse `LivePerformanceView` → `SongView` in read-only performance mode
- Song data comes from `session.queue[currentIndex]` (song metadata + attachments)
- Attachment binary content loaded from session IndexedDB via `getSessionAssetUrl()`
- Transport bar: same `TransportControls` component, but in a read-only configuration:
  - Metronome mode: BPM display (no +/- buttons), beat indicator (driven by synced metronome), volume/mute controls work locally
  - Play/stop button hidden or replaced with beat indicator (host controls playback)
  - Source picker hidden (member doesn't choose audio mode)
- Queue dropdown in `LiveHeader`: shows session queue (read-only, no reorder)
- When `currentIndex` changes (host navigated): auto-switch to new song
- Loading state: spinner with "Loading song..." until all assets for the current song are available in IndexedDB

### Host Dashboard Updates

- Remove the full settings screen before start (replace with single name input)
- Add "Play" button: appears when queue has songs, opens current/first song in performance view
- Add gear icon: opens settings sheet (metronome toggle, wait-for-sync, allow-late-join)
- Keep: room code, session name, members list, queue with drag reorder, end session button

### Session Persistence (Nice to Have)

**Host restore:**
- On session start: save `{ roomCode, queue, currentIndex, settings, metronome }` to `sessionStorage`
- Update sessionStorage on every queue/index/settings change
- On app load: check for stored session → show "Session interrupted — Restore session?" prompt
- If yes: re-create signaling room with same code, re-init HostConnectionManager, re-listen for peers
- If no: clean up signaling room, clear sessionStorage

**Member rejoin:**
- On join: save `{ roomCode, displayName }` to `sessionStorage`
- On app load: check for stored session → show "Rejoin session ABC 123?" prompt
- If yes: call `join(roomCode, displayName)`
- If no: clear sessionStorage

### Reconnection

**Member auto-reconnect (WebRTC ICE restart):**
- `PeerConnectionManager.onStatusChange('disconnected')` triggers reconnect timer
- Show "Connection lost" banner in MemberView/MemberPerformanceView
- Attempt ICE restart or full re-signaling every 3s, up to 5 attempts (~15s)
- On success: clear banner, re-sync state (host sends `session-state`)
- On failure: show "Disconnected — Tap to rejoin" with button

### Asset Cleanup

- When host calls `removeSongFromQueue(index)`:
  - Broadcast `queue-update` to members (already done)
  - Members receive updated queue, diff against previous queue
  - For removed songs: call `deleteSessionAssets(songId)` on IndexedDB
  - Revoke any blob URLs for those assets

## User Experience

### Host Flow (Revised)

1. Tap Live tab → idle screen with "Start Session" / "Join Session"
2. Tap "Start Session" → session name input (pre-filled) → "Start"
3. Dashboard appears: room code prominent, empty queue
4. Tap "+ Add songs" → full-screen song picker → select songs → "Add"
5. Songs appear in queue. "Play" button appears.
6. Tap "Play" or tap a song → performance view with transport controls
7. Back button → dashboard. Can add more songs, check members, etc.
8. Tap "End Session" → confirm → session destroyed

### Member Flow (Revised)

1. Tap Live tab → "Join Session" → enter code + name → "Join"
2. Connecting spinner → connected → queue view + metronome indicator
3. When host activates a song → loading spinner ("Loading song...") → performance view
4. Read-only performance view with slim transport bar (beat indicator, BPM, volume)
5. Host changes song → auto-switch with brief loading if new assets needed
6. Host ends session → "Session Ended" screen → "Back to Live"

### Edge Cases & Error States

| Scenario | UX |
|----------|-----|
| Member joins before host adds songs | Queue shows "Waiting for host to add songs..." |
| Asset transfer fails for a song | Member stays on loading spinner. Could add timeout: "Having trouble loading — ask host to re-add the song" |
| Host removes current song from queue | Navigate to next song (or previous if last). If queue empty, return to dashboard. |
| Member's phone locks (screen off) | WebRTC may disconnect. On unlock: auto-reconnect banner flow. |
| Host in performance view, member joins | Silent join. Member receives full session state, starts downloading assets. |
| All members disconnect | Host sees all members as "disconnected". Session continues. Members can rejoin. |

## Platform Considerations

- **IndexedDB:** Session assets stored in `metronotes-session` store. Cleared on session end/leave. Blob URLs cached and revoked on cleanup.
- **WebRTC:** ICE restart for reconnection. Falls back to full re-signaling if ICE restart fails.
- **sessionStorage:** Used for persistence across reload (not localStorage — sessionStorage clears on tab close, which is appropriate for transient session state).
- **React 19:** Refs for connection objects, functional state updates, useEffect for ref writes.
- **Wake lock:** Already active during sessions.

## Tradeoffs & Decisions

| Decision | Rationale |
|----------|-----------|
| Code-only join (no QR/link) | Band members are in the same room. Code is fast enough. Avoids URL routing complexity. |
| Auto-follow always (no manual follow) | Keeps everyone in sync. Risk of member falling behind outweighs benefit of independent browsing. |
| Block until assets ready | Simpler than progressive rendering. Songs are small (few attachments). Loading time is brief on LAN WebRTC. |
| No join notifications for host | Distracting during performance. Host sees member count when returning to dashboard. |
| Full edit available during session | Quick corrections mid-rehearsal are valuable. Changes broadcast automatically. |
| sessionStorage not localStorage | Session state is transient. Closing the tab should forget it. localStorage would leave stale sessions across tabs. |
| Immediate asset cleanup on queue removal | Frees member storage proactively. Small IDB overhead vs. accumulating unused blobs. |

## Open Questions

1. **Timeout for asset loading** — How long should the member wait before showing "Having trouble loading"? 30s? 60s?
2. **Max session size** — Should we limit the queue length or total asset size per session? (Current: no limit)
3. **Multiple sessions** — Can a user be in multiple sessions simultaneously (e.g., hosting one, joined to another)? Currently not supported.
