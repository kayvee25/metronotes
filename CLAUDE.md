# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Start development server (Next.js with webpack, port 3000)
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- No test framework is configured

## Architecture

MetroNotes is a mobile-first PWA for musicians to manage songs, setlists, and a metronome. Built with Next.js 16, React 19, Tailwind CSS 4, and TypeScript.

### Single-page app structure

The app uses Next.js but operates as a client-side SPA. `app/page.tsx` renders `app/components/App.tsx`, which manages all navigation via a tab state (`new` | `songs` | `setlists`) and a bottom nav bar.

### Key layers

- **Types** (`app/types/index.ts`): `Song`, `Setlist`, and their input/update variants
- **Storage** (`app/lib/storage.ts`): `StorageAdapter` interface with a `LocalStorageAdapter` implementation using `localStorage`. Exported as a singleton `storage`. Keys: `metronotes_songs`, `metronotes_setlists`. Designed for future swap to cloud backend.
- **Hooks** (`app/hooks/`): `useSongs` and `useSetlists` wrap the storage adapter with React state. `useMetronomeAudio` handles Web Audio API metronome with precise scheduling via `requestAnimationFrame`.
- **Components** (`app/components/`): `App.tsx` is the root. `SongView` is the performance/edit view. `SongLibrary` and `SetlistLibrary` are list views. `SetlistDetail` shows songs within a setlist. UI primitives live in `components/ui/`.
- **Constants** (`app/lib/constants.ts`): BPM limits (30-400), time signature options, audio frequencies, animation durations.

### Data flow

Songs are independent entities stored in a global library. Setlists reference songs by ID (`songIds: string[]`). Deleting a song cascades removal from all setlists. The `App` component tracks `selectedSong`, `activeSetlist`, `setlistIndex`, and `navigationSource` to manage navigation context.

### PWA

Configured via `next-pwa` in `next.config.ts`. Service worker is disabled in development. Manifest at `public/manifest.json`.

### Drag and drop

Song reordering in setlists uses `@dnd-kit/core` and `@dnd-kit/sortable`.

### Styling

Tailwind CSS 4 with PostCSS. Dark mode via class toggling on `<html>`. All components are client-side (`'use client'`).
