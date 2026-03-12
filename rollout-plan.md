# Integration & Rollout Plan (Releases 0–2)

## How These Features Relate

These features serve the same user journey but at different timescales:

- **Collaboration** = async prep (days/weeks before the gig: share charts, contribute parts, build the setlist)
- **Live Session** = real-time performance (at the gig: synchronized playback, metronome, same page)

The natural flow is: band leader creates a shared setlist → bandmates contribute their charts → at the gig, leader starts a live session from that setlist → everyone's charts are synced live.

## Shared Infrastructure

| Concern | Collaboration | Live Session | Overlap |
|---|---|---|---|
| **Multi-user song access** | Cross-user Firestore reads via `sharedWith` field | P2P transfer via WebRTC | Different mechanisms, same need |
| **Song ownership tracking** | `{songId, ownerId}` pairs in setlists | Bandleader owns all session content | Collab's model is a superset |
| **Navigation structure** | Keeps existing 3 tabs (Songs, Setlists, Settings) | Merges to Library (Songs+Setlists) \| Live \| Settings | **Conflict — must resolve** |
| **Firestore security rules** | `sharing.memberIds` for cross-user reads | `sessions/{roomCode}` for signaling | Independent rule sets |
| **Asset model** | Assets as independent units, linked to songs | Transfers full song bundles (metadata + attachments) | Collab's asset model is foundational |
| **Timestamps** | `createdAt`/`updatedAt` on all entities | `createdAt` on sessions | Collab's is broader |
| **Stale detection** | `sharing.updatedAt` + onSnapshot | Real-time via WebRTC (no staleness concept) | Independent |

## DB Sync Strategy Decision

Collaboration requires denormalized state for Firestore security rules: `memberIds[]` on setlists and `sharedWith[]` on songs. These must stay in sync with the source-of-truth `members` subcollection.

**Decision: Batch writes, no Cloud Functions (v1).**

- Every membership mutation (join, leave, role change) goes through `syncSharedWithForSetlist()` which updates all affected documents in a single atomic batch write.
- `sharing.updatedAt` is best-effort — if missed, the only impact is a member not seeing a stale banner.
- The alternative (Cloud Function read proxy for cross-user songs) eliminates the `sharedWith` sync point entirely but adds an operational dependency. Deferred to when Cloud Functions are needed for other reasons (notifications, cleanup jobs).
- At current scale (small-medium user base, max 50 members per setlist, ~20-30 songs per setlist), batch writes stay well within Firestore's 500-operation limit per batch.

See `ROADMAP.md` deferred items for the Cloud Function migration path.

## Conflicts to Resolve

### 1. Navigation Structure

- **Collaboration** doesn't change nav — keeps Songs \| Setlists \| Settings.
- **Live Session** merges Songs+Setlists into Library, adds Live tab → Library \| Live \| Settings.

**Resolution:** Go with Live Session's nav (Library \| Live \| Settings). It's the better end state regardless — merging Songs and Setlists into sub-tabs under Library makes room for Live and is a cleaner IA. Do the nav restructure **once**, early, so both features build on top of it.

### 2. Starting a Live Session from a Shared Setlist

The specs were written independently. In the integrated version:
- A bandleader should be able to start a live session from a **shared** setlist.
- That shared setlist may contain songs from multiple owners (editors added songs from their libraries).
- Contributor attachments (in the shared setlist context) should also be available in the session.

**Resolution:** When starting a live session from a shared setlist, the bandleader's device must:
1. Fetch all songs (from multiple owners, using the `{songId, ownerId}` pairs).
2. Fetch all shared attachments (owner's + contributors') for each song in the setlist context.
3. Transfer everything to session members via WebRTC.

This means live session asset transfer needs to handle assets from users other than the bandleader. The binary transfer protocol doesn't change (it's just bytes), but the bandleader's "session preparation" step must fetch from Firestore/Storage paths of other users — which requires the cross-user read access that collaboration already sets up via `sharedWith`.

### 3. Live Session Members Who Are Also Setlist Collaborators

If a band member joins a live session AND is a contributor on the shared setlist, they might have their own local copy of some assets (since they uploaded them).

**Resolution for v1:** Ignore this optimization. The live session transfers everything fresh via WebRTC regardless. Session data is ephemeral and stored in the `metronotes-session` IndexedDB store, separate from the user's own data. In v2, the session join flow could check the member's local cache and skip already-cached assets.

### 4. Guest Behavior

- **Collaboration:** Guests can open share links but must sign in to join.
- **Live Session:** Guests can join sessions without signing in (no auth needed for WebRTC peers).

**No conflict.** These are intentionally different: collaboration persists data (needs an account), live sessions are ephemeral (no account needed).

## Dependency Graph

```
                    ┌─────────────────────┐
                    │  Nav Restructure    │
                    │  Library | Live |   │
                    │  Settings           │
                    └─────────┬───────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
    ┌────────────▼──────────┐  ┌───────────▼───────────┐
    │  COLLABORATION TRACK  │  │  LIVE SESSION TRACK   │
    │                       │  │                       │
    │  C1: Asset extraction │  │  L1: WebRTC infra     │
    │      + timestamps     │  │      + signaling      │
    │           │           │  │           │           │
    │  C2: Shared setlists  │  │  L2: Session core     │
    │      + join flow      │  │      + song sync      │
    │           │           │  │           │           │
    │  C3: Contributor      │  │  L3: Queue mgmt       │
    │      attachments      │  │      + metronome sync │
    │           │           │  │           │           │
    │  C4: Polish           │  │  L4: Polish           │
    └───────────────────────┘  └───────────────────────┘
                 │                         │
                 └────────────┬────────────┘
                              │
                 ┌────────────▼────────────┐
                 │  INTEGRATION            │
                 │  Live session from      │
                 │  shared setlist         │
                 └─────────────────────────┘
```

**Key dependency:** Live sessions CAN be built without collaboration (bandleader uses their own songs). But starting a live session from a **shared** setlist requires both C2 (shared setlists exist) and L2 (session core works). The integration step connects them.

**Asset extraction (C1) is independent** and benefits both tracks — it's the foundation for contributor attachments (C3) and a cleaner model overall.

## Recommended Rollout: Interleaved Tracks

The fastest path ships useful increments from both features in parallel, rather than completing one before starting the other.

### Release 0: Foundation & Redesign
**What:** Full UX redesign + asset extraction.
**Ships:** Library tab with Songs/Setlists/Files sub-tabs. Live tab as a music-player-style performance view (replaces SongView overlay). Header-integrated transport controls with multi-audio-track selection (replaces FAB). Queue system with dropdown. Slide-up edit panel. Assets as independent units. Multiple rich text and audio files per song.
**User value:** Modern music-player UX. The Live tab works like a familiar player interface — queue, transport controls, attachments. Users can manage their files independently.
**Why first:** Every subsequent release builds on this. The Live tab's queue and transport controls become the foundation for live session sync (Release 1) — the multiplayer version is just sharing what's already a working player.
**Plan:** `plan-release-0-foundation.md` (6 phases)

### Release 1: Live Session
**What:** WebRTC infra, Firestore signaling, session creation/join, song sync, asset transfer.
**Ships:** Bandleader can start a session from their own songs/setlists. Members join via room code. Songs sync in real-time. Assets transfer P2P.
**User value:** The "wow" feature. Bands can use it at rehearsal immediately, even without collaboration.
**Why before collab:** Higher user-facing impact. Self-contained — doesn't need collaboration. Generates excitement and validates the multi-user direction.
**Plan:** `plan-release-1-live-session.md` (5 phases)

### Release 2: Collaboration
**What:** Shared setlists (`sharing` field, `joinCodes` collection, join flow, member management, stale detection, viewer/contributor/editor roles), contributor attachments (shared attachment links, cross-user song access, role-based UI), and live session integration (start session from shared setlist with songs from multiple owners).
**Ships:** Users share setlists via link, members contribute their own charts, bandleader starts a live session from the shared setlist — the end-to-end band workflow.
**DB strategy:** Denormalized state (`memberIds`, `sharedWith`) kept in sync via Firestore batch writes. No Cloud Functions for v1.
**User value:** The full collaboration loop and the complete story — async prep before the gig, real-time sync at the gig.
**Plan:** `plan-release-2-collaboration.md` (5 phases)

## Timeline Visualization

```
Release 0 ████████ Foundation & Redesign (6 phases)
Release 1         ████████ Live Session (5 phases)
Release 2                 ████████████ Collaboration (5 phases, includes integration + polish)
```

Releases are sequential — each depends on the previous. Release 2 absorbs what was previously separate "integration" and "polish" phases into its own 5-phase plan.

## Spec Cross-References

### `spec-collaboration.md`
- Navigation assumes the Library | Live | Settings structure from Release 0.
- Shared setlists can be used as a source for live sessions (Release 2, Phase 4).
- `sharedWith` on songs uses batch writes for sync (no Cloud Functions).

### `spec-live-session.md`
- Builds on Release 0's Live tab, queue system, and transport controls.
- Session from shared setlist (Release 2 integration): queue includes songs from multiple owners, asset transfer includes contributor attachments from `sharedAttachments` subcollection.
- Cross-user asset fetching handled by collaboration's `sharedWith` field + Firestore security rules.

### Shared Data Model
- `songs` array in setlists uses `{songId, ownerId}` pairs (defined in Release 0, used by both Release 1 and 2).
- `joinCodes` (collaboration) and `sessions` (live session) are independent top-level collections.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nav restructure breaks existing flows | Low | High | Purely cosmetic change — Songs and Setlists just move under Library tab with sub-tabs. All existing functionality preserved. |
| Asset extraction migration fails for some users | Medium | Medium | Lazy migration (on first access) with fallback to old model. Monitor error rates. |
| WebRTC doesn't work on some networks | Medium | Medium | Use Google's free STUN servers. Accept that some corporate/restrictive networks won't work in v1. TURN server in v2. |
| Shared setlist + live session integration is complex | Low | Medium | The integration is thin — it's just a different data source for session queue building. The hard parts (WebRTC transfer, cross-user access) are already solved in their respective phases. |
| Building both features in parallel stretches focus | Medium | Medium | Each phase is independently shippable. If one track stalls, the other still delivers value. |
