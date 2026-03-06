# MetroNotes

A mobile-first PWA for musicians to manage songs, setlists, and a metronome — all in one place. Built for use on stage, at rehearsals, and during practice.

## Features

- **Song Library** — Create and manage songs with BPM, time signature, key, and rich notes
- **Rich Notes** — Attach multiple text pages and images to each song with inline editing, reordering, and naming
- **Setlists** — Build ordered setlists from your song library with drag-and-drop reordering
- **Metronome** — Precise Web Audio API metronome with visual beat indicator, accent on beat 1, and volume control
- **Performance Mode** — Full-screen teleprompter view with swipeable note pages, floating metronome pill, and prev/next song navigation within setlists
- **Edit Mode** — Compact controls grid for BPM, time signature, and key with integrated rich text editor
- **Cloud Sync** — Sign in with Google or email to sync songs and setlists across devices via Firebase
- **Guest Mode** — Use without an account with localStorage persistence; migrate data to the cloud when you sign in later
- **Warm Theme** — Warm dark theme by default for stage visibility, with light mode toggle
- **Wake Lock** — Screen stays on during performance mode
- **PWA** — Installable on mobile devices, works offline

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Backend:** Firebase Auth + Firestore + Cloud Storage
- **Audio:** Web Audio API
- **Drag & Drop:** @dnd-kit
- **Hosting:** Vercel
- **PWA:** next-pwa with service worker

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env.local` with your Firebase config:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
4. Start the dev server: `npm run dev`
5. Open `http://localhost:3000`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |

## Architecture

The app is a client-side SPA built on Next.js. `App.tsx` is the root component that manages auth gating, tab navigation (Songs, Setlists, Settings), and song/setlist state.

- **Auth:** Google OAuth, email/password with verification, and guest mode
- **Data:** Firestore for authenticated users (`users/{userId}/songs/{songId}`), localStorage for guests. Attachments stored as subcollections with images in Cloud Storage.
- **Sync:** Optimistic writes with error rollback; manual refresh; last-write-wins conflict resolution
- **Navigation:** Bottom nav bar with 3 tabs; song view opens on top with back navigation; Android back button supported
- **Migration:** Plain-text notes auto-migrate to rich attachments on first load; guest data migrates to Firestore on sign-in

See [CLAUDE.md](./CLAUDE.md) for detailed architectural documentation.
