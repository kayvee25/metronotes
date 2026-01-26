# MetroNotes - Metronome & Setlist App

## Project Overview

A mobile-first web application for musicians to manage setlists with integrated metronome and chart notes. Built to solve the problem of juggling separate metronome apps and note-taking apps during live performances.

## Core Problem Statement

When playing music on stage, musicians need to:

1. See their chart/notes for each song
2. Get the correct tempo to count off the song
3. Switch between songs quickly in a setlist
4. Have everything in one place, not multiple apps

## Development Philosophy

This app follows an incremental, validation-driven approach:

**Phase 1 (Current): Personal Tool**

- Build for single user (myself)
- localStorage persistence
- Focus: Core functionality works reliably
- Goal: Learn architecture/deployment, create portfolio piece
- Timeline: 2 weeks

**Phase 2: Validation**

- Share with 5-10 musicians
- Collect real-world feedback
- Identify actual pain points vs assumed ones
- Goal: Understand if there's product-market fit

**Phase 3+: Expand based on validation**

- Only build features that solve real, validated problems
- Avoid feature creep
- Maintain simplicity and reliability
- Goal: Build what users actually need, not what I think they need

**Architecture Decisions:**

- Build with localStorage first (simple, fast, no costs)
- Use abstraction layer for data access (easy to migrate to cloud later)
- Keep features minimal until validation happens
- Prioritize reliability over features

## Target Users

**Primary (Phase 1):** Myself - drummer who needs charts and tempo for gigs

**Future (Phase 2+):** Gigging musicians at small venues

- Solo performers (singer + guitar)
- Small bands (2-4 people: vocalist, guitarist, keyboardist, drummer)
- Musicians who use chord charts, lead sheets, or simple notation
- Those who currently use multiple apps for setlists, charts, and metronome

**Competitive Context:**

- OnSong exists but is iOS-only and expensive
- Opportunity: Cross-platform, affordable, focused feature set
- Differentiation (future): Better collaboration, web-based, modern UX

## Technical Stack

**Frontend/Full Stack:**

- Next.js (React-based)
- Progressive Web App (PWA) for installable mobile experience
- Tailwind CSS for styling

**State Management:**

- React hooks (useState, useEffect)
- localStorage for data persistence (MVP)
- Option to migrate to Supabase for cloud sync in Phase 3+

**Audio:**

- Web Audio API or Tone.js for metronome functionality
- Needs to be precise and reliable

**Hosting:**

- Vercel (automatic deployment from GitHub)

**Design Priorities:**

- Mobile-first (will be used on phone on stage)
- Large, readable text and buttons
- Dark mode default (easier in stage lighting)
- Offline-capable
- Fast, no loading delays

## Data Model

### Song and Setlist Relationship

**Songs are independent entities:**

- Stored in a global song library
- Can be reused across multiple setlists
- Edit once, updates everywhere it's referenced

**Setlists reference songs:**

- Contain ordered array of song IDs
- Multiple setlists can include the same song
- Deleting a song removes it from all setlists that reference it

**Example:**

- Song: "Wonderwall" (120 BPM, 4/4, Key of G)
- Setlist A: [Wonderwall, Hey Jude, ...]
- Setlist B: [Sweet Child, Wonderwall, ...]
- Update "Wonderwall" to 125 BPM → changes in both setlists

**User Experience:**

1. Create songs in library (or create inline when building setlist)
2. Build setlists by selecting from library
3. Reorder songs within setlist without affecting library
4. Edit song details from library or from within setlist view

### Data Structure

```typescript
interface Song {
  id: string;
  name: string;
  artist?: string; // Optional, for identifying covers
  key?: string; // Musical key (e.g., "G", "Am", "Eb")
  bpm: number;
  timeSignature: string; // e.g., "4/4", "3/4", "6/8"
  notes: string; // Free-form text for chart/notes
  createdAt: number;
  updatedAt: number;
}

interface Setlist {
  id: string;
  name: string;
  songIds: string[]; // Ordered array of song IDs
  createdAt: number;
  updatedAt: number;
}

interface AppState {
  songs: Song[];
  setlists: Setlist[];
  activeSetlistId: string | null;
  activeSongId: string | null;
}
```

### Song Variants / Different Versions

**Current approach (Phase 1):**

- If you need the same song in different styles (acoustic vs full band, different key), create separate songs
- Use descriptive names: "Wonderwall (Acoustic, Key of D)", "Wonderwall (Full Band, Key of G)"
- Simple, no additional complexity

**Future consideration:**

- Song variants (linked but independent versions)
- Setlist-level overrides for BPM/key/notes
- Will build if users request it during validation phase

## MVP Feature Set

### 1. Song Library Management

- View all songs (list view)
- Create new song (name, artist, key, BPM, time signature, notes)
- Edit song details
- Delete song (removes from all setlists)
- Search/filter songs (once library grows)

### 2. Setlist Management

- View all setlists (list view)
- Create new setlist
- Edit setlist name
- Delete setlist
- Select active setlist

### 3. Song-Setlist Association

- View songs in a setlist (ordered list)
- Add existing song from library to setlist
- Create new song while building setlist
- Remove song from setlist (doesn't delete from library)
- Reorder songs in setlist (drag-and-drop or up/down buttons)

### 4. Song Detail / Performance View

When a song is selected, display:

- Song name (large, prominent)
- Artist name (if provided)
- Key (if provided)
- Chart/notes (large, readable text area)
- Current BPM display (very large, easy to see)
- Time signature display
- Metronome controls (large buttons)

### 5. Metronome Functionality

**Core Requirements:**

- Start/Stop button (large, easy to tap)
- Visual beat indicator (flashing circle or bar that pulses on each beat)
- Audio click (clear, audible, adjustable volume)
- Tempo adjustment (tap to edit BPM, or +/- buttons)
- Accurate timing (critical - use Web Audio API for precision)

**Behavior:**

- Click sound on each beat
- Visual accent on beat 1 (different color/brightness)
- Volume control (0-100%)
- Keeps playing when screen locks (if possible with PWA)

### 6. Navigation

- Bottom navigation bar or hamburger menu
- Quick access to:
  - Song Library
  - Setlists
  - Current/active song
  - Settings
- Easy to navigate with one hand while holding phone

### 7. Settings

- Dark mode toggle (default: on)
- Metronome volume
- Click sound selection (if multiple options)
- Clear all data option

## UI/UX Priorities

### Stage-Ready Design

- **Large touch targets:** Minimum 44x44px, ideally 60x60px for primary actions
- **High contrast:** White text on dark background, critical info in bright colors
- **Minimal scrolling:** Most important info above the fold
- **No accidental taps:** Confirmation for destructive actions
- **Quick access:** ≤2 taps to start metronome from any screen

### Key Views Layout

**Song Library:**

```
┌─────────────────────────┐
│  All Songs         [+]  │
├─────────────────────────┤
│ → Wonderwall            │
│   G major • 120 BPM     │
│                         │
│ → Hey Jude              │
│   F major • 150 BPM     │
│                         │
│ → Sweet Child O' Mine   │
│   Eb major • 125 BPM    │
└─────────────────────────┘
```

**Setlist View:**

```
┌─────────────────────────┐
│  Friday Night Gig  [+]  │
├─────────────────────────┤
│ 1. Wonderwall      [⋮]  │
│ 2. Hey Jude        [⋮]  │
│ 3. Sweet Child     [⋮]  │
│                         │
│ [+ Add Song]            │
└─────────────────────────┘
```

**Add Song to Setlist (Song Picker):**

```
┌─────────────────────────┐
│  Add to Setlist    [×]  │
├─────────────────────────┤
│ ☐ Wonderwall            │
│ ☑ Hey Jude              │
│ ☐ Sweet Child           │
│                         │
│ [Create New Song]       │
│ [Add Selected]          │
└─────────────────────────┘
```

**Performance View:**

```
┌─────────────────────────┐
│ Wonderwall              │  ← Large, bold
│ Oasis • G major         │
├─────────────────────────┤
│                         │
│  [Chart/Notes]          │  ← Readable, scrollable
│  Intro: G D Em C        │
│  Verse: G D Em C...     │
│                         │
├─────────────────────────┤
│    ●  180 BPM  4/4     │  ← Visual beat, tempo, time sig
├─────────────────────────┤
│   [  START  ]           │  ← Large button
│   [ ← ] [ → ]           │  ← Prev/Next song in setlist
└─────────────────────────┘
```

## Development Phases

### Phase 1: Core Metronome (Weekend 1)

**Goal:** Working metronome that can be deployed and tested on phone

**Tasks:**

- Set up Next.js project
- Implement metronome logic (Web Audio API)
- Basic UI: BPM input, start/stop button, visual indicator
- Deploy to Vercel
- Test accuracy on mobile device

**Success Criteria:** Can set a tempo and get accurate, reliable clicks on phone

### Phase 2: Data Layer (Week 2)

**Goal:** Save and manage songs and setlists

**Tasks:**

- Implement localStorage persistence with abstraction layer
- Create Song library CRUD operations
- Create Setlist CRUD operations
- Build song library view
- Build setlist list view
- Build song picker for adding to setlist
- Add/edit/delete functionality

**Success Criteria:** Can create songs, create setlists, add songs to setlists, and data persists on page reload

### Phase 3: Polish & Performance View (Weekend 2)

**Goal:** Stage-ready app

**Tasks:**

- Build full-screen performance view for active song
- Integrate metronome with song details
- Implement dark mode
- Make responsive and mobile-optimized
- Add PWA manifest for install capability
- Navigation between views
- Settings page

**Success Criteria:** Can use app during actual practice/rehearsal

### Phase 4: Testing & Refinement

**Goal:** Production-ready

**Tasks:**

- Test on actual phone in stage-like conditions
- Fix any UX issues discovered
- Optimize performance
- Handle edge cases (empty states, validation)
- Add loading states if needed

**Success Criteria:** Confident enough to use during live performance

## Storage Architecture

### localStorage Implementation (Phase 1)

**Storage structure:**

```javascript
// In localStorage
{
  "songs": [
    {
      "id": "song-1",
      "name": "Wonderwall",
      "artist": "Oasis",
      "key": "G",
      "bpm": 120,
      "timeSignature": "4/4",
      "notes": "Intro: G D Em C...",
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ],
  "setlists": [
    {
      "id": "setlist-1",
      "name": "Friday Night Gig",
      "songIds": ["song-1", "song-2"],
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ],
  "activeSetlistId": "setlist-1",
  "activeSongId": "song-1"
}
```

### Storage Abstraction Layer

Create an abstraction to make cloud migration easy later:

```typescript
// data/storage.ts - Abstract interface
interface StorageAdapter {
  getSongs(): Promise<Song[]>;
  saveSong(song: Song): Promise<void>;
  updateSong(id: string, updates: Partial<Song>): Promise<void>;
  deleteSong(id: string): Promise<void>;
  getSetlists(): Promise<Setlist[]>;
  saveSetlist(setlist: Setlist): Promise<void>;
  updateSetlist(id: string, updates: Partial<Setlist>): Promise<void>;
  deleteSetlist(id: string): Promise<void>;
  getActiveState(): Promise<{ activeSetlistId: string | null; activeSongId: string | null }>;
  setActiveState(state: { activeSetlistId?: string; activeSongId?: string }): Promise<void>;
}

// data/localStorageAdapter.ts - Current implementation
class LocalStorageAdapter implements StorageAdapter {
  async getSongs(): Promise<Song[]> {
    const data = localStorage.getItem('songs');
    return data ? JSON.parse(data) : [];
  }

  async saveSong(song: Song): Promise<void> {
    const songs = await this.getSongs();
    songs.push(song);
    localStorage.setItem('songs', JSON.stringify(songs));
  }

  // ... other methods
}

// data/supabaseAdapter.ts - Future implementation
class SupabaseAdapter implements StorageAdapter {
  async getSongs(): Promise<Song[]> {
    const { data } = await supabase.from('songs').select('*');
    return data || [];
  }

  // ... other methods
}
```

**Usage in app:**

```typescript
// Choose adapter based on config
const storage = new LocalStorageAdapter(); // Switch to SupabaseAdapter later
```

### Key Operations

```typescript
// Get songs for a setlist
function getSongsInSetlist(setlistId: string): Song[] {
  const setlist = setlists.find((s) => s.id === setlistId);
  if (!setlist) return [];

  return setlist.songIds
    .map((songId) => songs.find((s) => s.id === songId))
    .filter((song) => song !== undefined);
}

// Add song to setlist
function addSongToSetlist(setlistId: string, songId: string) {
  const setlist = setlists.find((s) => s.id === setlistId);
  if (setlist && !setlist.songIds.includes(songId)) {
    setlist.songIds.push(songId);
  }
}

// Update song (affects all setlists that reference it)
function updateSong(songId: string, updates: Partial<Song>) {
  const song = songs.find((s) => s.id === songId);
  if (song) {
    Object.assign(song, updates, { updatedAt: Date.now() });
  }
}

// Delete song (remove from library and all setlists)
function deleteSong(songId: string) {
  // Remove from songs array
  songs = songs.filter((s) => s.id !== songId);

  // Remove from all setlists
  setlists.forEach((setlist) => {
    setlist.songIds = setlist.songIds.filter((id) => id !== songId);
  });
}
```

## Edge Cases to Handle

**Deleted songs:**

- When displaying setlist, filter out any song IDs that don't have corresponding songs
- Show placeholder or skip missing songs gracefully

**Empty states:**

- No songs in library → Show "Add your first song" message
- No setlists → Show "Create your first setlist" message
- Empty setlist → Show "Add songs to this setlist" message

**Missing song references:**

```typescript
// When displaying a setlist, handle songs that don't exist
const validSongs = setlist.songIds.map((id) => songs.find((s) => s.id === id)).filter(Boolean); // Remove undefined entries
```

**Duplicate prevention:**

- Prevent adding same song to setlist twice (or show warning and allow)
- Prevent creating setlist with empty name

## Future Features (Post-MVP)

### Phase 2+ Features (Build only if validated)

**Collaboration (Key Differentiator):**

- User authentication
- Share setlists via link
- Granular permissions (read/edit at setlist level)
- Real-time updates when bandmates edit
- See who's viewing/editing

**Enhanced Chart Support:**

- ChordPro format import/parsing
- Transpose on the fly
- Auto-formatting
- PDF upload and display
- Annotation tools

**Backing Tracks:**

- Audio file upload/playback
- Sync with chart display
- Volume controls

**Advanced Metronome:**

- Subdivisions (8th notes, triplets, etc.)
- Accent patterns
- Count-in bars before song starts
- Tap tempo
- Multiple click sounds
- Key note/chord playback: Play a note or chord matching the song's key when starting the metronome (will need volume adjustment for balancing click vs note/chord levels)

**Sheet Music:**

- PDF viewer with page turning
- Foot pedal support
- Zoom and pan

**MIDI Integration:**

- Program changes
- Syncing with keyboards/pedals

**Export/Import:**

- Export setlists to PDF
- Import from common formats
- Backup and restore

## Technical Requirements

### Browser Compatibility

- Modern mobile browsers (Chrome, Safari on iOS/Android)
- PWA support for installation
- Offline functionality via service worker

### Performance

- Metronome must maintain accurate timing (±5ms tolerance)
- UI should be responsive (<100ms for interactions)
- App should work offline

### Accessibility

- High contrast for stage visibility
- Large touch targets for gloved hands / stage conditions
- Clear visual feedback for all actions

## AI-Assisted Development Strategy

When prompting AI to help build this:

**Good prompts for AI:**

- "Create a metronome component using Web Audio API with adjustable BPM and visual beat indicator"
- "Build a localStorage hook for persisting and retrieving songs and setlists using the storage abstraction pattern"
- "Design a mobile-first song library view with large touch targets and search functionality"
- "Implement drag-and-drop reordering for songs in a setlist"
- "Create a responsive performance view layout for displaying song charts and metronome controls"

**Areas requiring manual attention:**

- Overall architecture decisions (outlined in this document)
- Testing on actual device in realistic conditions
- UX refinement based on real usage
- Performance optimization for metronome accuracy
- Edge case handling and error states

## Success Metrics

### For Phase 1 (MVP):

**Technical:**

- [ ] App loads on mobile phone
- [ ] Can create songs in library
- [ ] Can create setlists and add songs from library
- [ ] Metronome is accurate and reliable
- [ ] Data persists after closing browser
- [ ] Works offline
- [ ] Deployed at a live URL

**Personal:**

- [ ] Actually use it at practice (at least 3 times)
- [ ] Faster than current solution (Notes app + separate metronome)
- [ ] Would be annoyed if it disappeared

**Portfolio:**

- [ ] Code is clean and well-structured
- [ ] Has proper README and documentation
- [ ] Demonstrates full-stack skills
- [ ] Can explain architectural decisions

### For Phase 2 (Validation):

- [ ] 5-10 musicians have tried it
- [ ] Collected specific feedback on pain points
- [ ] Identified most-requested feature
- [ ] At least 3 would use it regularly
- [ ] Clear understanding of product-market fit

### For Phase 3+ (Product):

- [ ] 50+ active users
- [ ] Usage at real gigs without issues
- [ ] Positive testimonials
- [ ] Clear path to monetization (if pursuing)

## Getting Started

1. Clone repository
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`
4. Open browser to `http://localhost:3000`
5. Deploy to Vercel: `vercel deploy`

## User Research Questions (Phase 2)

When sharing with musicians, ask:

**Usage:**

1. Did you actually use it? (If no, why not?)
2. What was frustrating or confusing?
3. What's the ONE thing that would make you use this instead of [current solution]?

**Value:** 4. Would you recommend it to another musician? 5. What's missing that would make it essential for you?

**Specific features:** 6. If I added [collaboration/better charts/backing tracks], would that matter? 7. How do you currently manage setlists and charts?

**Don't ask:**

- "What features should I add?" (too open-ended)
- "Do you like it?" (too vague)
- "Would you pay for this?" (too early)

## Notes for Future Development

- Keep localStorage schema versioned for future migrations
- Design state management to make Supabase integration easier later
- Keep bundle size small for fast loading on mobile networks
- Consider Web MIDI API if expanding to electronic instrument support
- Monitor Web Audio API timing accuracy across different devices
- Plan for offline-first architecture if adding cloud sync

## Timeline Estimate

**Phase 1 (Personal MVP): 22-32 hours over 2 weeks**

- Weekend 1: Core metronome (8-10 hours)
- Week 2: Data layer and song/setlist management (10-14 hours)
- Weekend 2: Polish and performance view (4-8 hours)

**Phase 2 (Validation): 2-3 weeks**

- Using app personally
- Gathering feedback from 5-10 musicians
- No additional development unless critical bugs

**Phase 3+ (Product development): TBD**

- Based on validation results
- Prioritize features based on user feedback
- Estimate after Phase 2 complete
