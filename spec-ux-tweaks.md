# MetroNotes UX Tweaks

> **Note:** After implementing these changes, update `spec.md` (Cloud Sync) to reflect that the bottom nav has 3 tabs (Songs, Setlists, Settings) instead of 4, and that the Play tab no longer exists.

## Changes

### 1. Remove Play Tab, Songs Tab as Default

**Current:** Bottom nav has 3 tabs (Play, Songs, Setlists) + dark mode toggle. Default tab is Play, which opens SongView for a new song.

**New:** Bottom nav has 2 tabs (Songs, Setlists) + dark mode toggle. Default tab is Songs. The Play tab is removed entirely.

- Remove the `'new'` tab from the `Tab` type — rename to just `'songs' | 'setlists'`
- Default `activeTab` to `'songs'`
- SongView is no longer a tab — it's a full-screen view entered by tapping a song or creating a new one
- Navigation back from SongView returns to whichever tab launched it (Songs or Setlists)

### 2. FAB for Creating Songs and Setlists

**Songs page:** Add a floating action button (FAB) in the bottom-right corner (above the bottom nav). Tapping it opens a quick-add modal.

**Setlists page:** Replace the current '+' button in the header with the same FAB pattern for consistency.

**FAB styling:**
- Circular, accent-blue background, white '+' icon
- Positioned bottom-right, above the bottom nav bar (roughly `bottom: 80px, right: 16px`)
- Subtle shadow for elevation

### 3. Quick-Add Song Modal

When the user taps the FAB on the Songs page:

1. Show a modal with these fields:
   - **Name** (text input, required)
   - **BPM** (number input, default 120)
   - **Time Signature** (selector, default 4/4)
2. "Create" button (disabled if name is empty)
3. On create: save the song, close the modal, and immediately open SongView in edit mode for that song (so they can add artist, key, notes, etc.)

### 4. Sorting in Songs Library

**Sort control:** A sort icon button in the Songs page header (next to the page title). Tapping it opens a dropdown/popover.

**Sort options:**
- Name A-Z (default)
- Name Z-A
- BPM (Low to High)
- BPM (High to Low)
- Recently Added
- Recently Updated

**Persistence:** Sort preference saved to localStorage (key: `metronotes_songs_sort`). Restored on app load.

**Interaction with search:** Sorting applies to search results too — filtered songs are sorted by the active sort option.

### 5. Sorting in Setlists Library

**Same pattern as Songs:**
- Sort icon button in the Setlists page header
- Dropdown/popover with options

**Sort options:**
- Name A-Z (default)
- Name Z-A
- Recently Created
- Recently Updated

**Persistence:** Saved to localStorage (key: `metronotes_setlists_sort`). Restored on app load.

### 6. Save Button — Only Enabled When Dirty

**Current:** Save button in EditMode header is always active and clickable.

**New:** Save button is visually disabled (grayed out, non-interactive) when no changes have been made. Enabled when any field differs from the saved state.

**Dirty tracking — all fields:**
- `name`
- `artist`
- `bpm`
- `timeSignature`
- `key`
- `notes`

**Implementation:** Compare current form state + metronome state against the original song values. For a new (unsaved) song with quick-add, compare against the values set during creation. If any field differs, the song is dirty.

**Disabled style:** Same button shape, but `opacity-50` and `pointer-events-none`. No colour change — just dimmed.

**Unsaved changes warning:** If the user tries to navigate away (tap a bottom nav tab, or tap Back) while the song is dirty, show a confirmation dialog: "You have unsaved changes. Discard?" with two buttons:
- **Discard** — navigate away, lose changes
- **Save** — save changes, then navigate away

### 7. Metronome Colour Changes

**Current colours:**
- Beat 1 (accent): `--accent-blue` (blue)
- Other beats: `--accent-green` (green)
- Play button: green when stopped, red when playing
- Inactive beats: `--card`

**New colours:**
- Beat 1 (accent): **red** (`red-500` or similar)
- Other beats: **green** (`--accent-green`, unchanged)
- Play button: **green** when stopped, **red** when playing (unchanged)
- Inactive beats: `--card` (unchanged)

Only the BeatIndicator component changes — replace `bg-[var(--accent-blue)]` with `bg-red-500` for beat 1.

## Components Affected

| Change | Files |
|--------|-------|
| Remove Play tab | `App.tsx`, `BottomNav.tsx` |
| FAB | `SongLibrary.tsx`, `SetlistLibrary.tsx` (new shared FAB component optional) |
| Quick-add modal | New component (or extend `SaveSongModal`) |
| Song sorting | `SongLibrary.tsx` |
| Setlist sorting | `SetlistLibrary.tsx` |
| Dirty state / Save | `SongView.tsx`, `EditMode.tsx` |
| Unsaved changes warning | `SongView.tsx` or `App.tsx` (intercept navigation) |
| Metronome colours | `BeatIndicator.tsx` |

## Acceptance Criteria / Test Cases

These can be verified manually via Chrome DevTools or by interacting with the app.

### 1. Play Tab Removed

- [ ] Bottom nav shows only 2 tabs: Songs, Setlists
- [ ] App launches on the Songs tab by default
- [ ] No "Play" label or play icon in the bottom nav
- [ ] Tapping a song from the Songs list opens SongView full-screen
- [ ] Tapping Back from SongView returns to the Songs tab
- [ ] Tapping a song from a setlist opens SongView, Back returns to Setlists

### 2. FAB (Floating Action Button)

- [ ] Songs page: FAB visible in bottom-right corner, above the bottom nav
- [ ] Setlists page: FAB visible in bottom-right corner, above the bottom nav
- [ ] Setlists page: no '+' button in the header (moved to FAB)
- [ ] FAB has circular shape, accent-blue background, white '+' icon
- [ ] FAB does not overlap or obscure the bottom nav
- [ ] FAB does not scroll with content — stays fixed

### 3. Quick-Add Song Modal

- [ ] Tapping FAB on Songs page opens a modal with Name, BPM (default 120), Time Signature (default 4/4)
- [ ] "Create" button is disabled when Name is empty
- [ ] Typing a name enables the "Create" button
- [ ] Tapping "Create" saves the song, closes the modal, and opens SongView in edit mode
- [ ] The newly created song appears in the Songs list if you navigate back
- [ ] Tapping outside the modal or a cancel/close button dismisses it without creating

### 4. Song Sorting

- [ ] Sort icon visible in the Songs page header
- [ ] Tapping the sort icon opens a dropdown/popover with 6 options: Name A-Z, Name Z-A, BPM Low-High, BPM High-Low, Recently Added, Recently Updated
- [ ] Default sort is Name A-Z
- [ ] Selecting "Name Z-A" reverses alphabetical order
- [ ] Selecting "BPM Low-High" sorts songs by BPM ascending
- [ ] Selecting "BPM High-Low" sorts songs by BPM descending
- [ ] Selecting "Recently Added" sorts by `createdAt` descending
- [ ] Selecting "Recently Updated" sorts by `updatedAt` descending
- [ ] Sort preference persists after page refresh (check localStorage key `metronotes_songs_sort`)
- [ ] Sorting applies to search-filtered results too

### 5. Setlist Sorting

- [ ] Sort icon visible in the Setlists page header
- [ ] Dropdown shows 4 options: Name A-Z, Name Z-A, Recently Created, Recently Updated
- [ ] Default sort is Name A-Z
- [ ] Sort preference persists after page refresh (check localStorage key `metronotes_setlists_sort`)

### 6. Save Button — Dirty State

- [ ] Open an existing song in edit mode — Save button is grayed out (disabled)
- [ ] Change the song name — Save button becomes active (blue)
- [ ] Undo the name change (restore original) — Save button returns to disabled
- [ ] Change BPM via +/- buttons — Save button becomes active
- [ ] Change time signature — Save button becomes active
- [ ] Change key — Save button becomes active
- [ ] Change artist — Save button becomes active
- [ ] Change notes — Save button becomes active
- [ ] Tapping disabled Save button does nothing (no save triggered)
- [ ] After saving, Save button returns to disabled state
- [ ] For a newly created song (via quick-add), changing any field from its creation values enables Save

### 7. Unsaved Changes Warning

- [ ] With dirty changes, tapping a bottom nav tab shows "You have unsaved changes. Discard?" dialog
- [ ] Dialog has "Discard" and "Save" buttons
- [ ] Tapping "Discard" navigates away, changes are lost
- [ ] Tapping "Save" saves changes, then navigates to the target tab
- [ ] With dirty changes, tapping Back button shows the same warning
- [ ] With no dirty changes, navigation happens immediately (no dialog)

### 8. Metronome Colours

- [ ] Start the metronome — beat 1 indicator lights up **red** (not blue)
- [ ] Other beats light up **green** (unchanged)
- [ ] Inactive beat indicators remain card-coloured (unchanged)
- [ ] Play button is green when stopped, red when playing (unchanged)
- [ ] Colours are correct in both light and dark mode

## Out of Scope

- Help / onboarding (app is self-explanatory)
- Settings page (part of cloud sync spec)
- Any cloud sync work
