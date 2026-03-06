# Rich Notes — Implementation Plan

This plan covers V1 (rich text + images). Each phase is a shippable increment — earlier phases work without later ones. Each phase includes a verification checklist — all items must pass before moving to the next phase.

## Phase 1: Data Model & Migration Foundation

Set up the attachment data layer without changing any UI. After this phase, existing songs continue to work exactly as before.

### Tasks

1. **Define Attachment types** (`app/types/index.ts`)
   - Add `Attachment`, `AttachmentInput`, `AttachmentUpdate` types
   - Add `type`, `order`, `isDefault`, `content`, `storageUrl`, `storagePath`, `fileName`, `fileSize`, `width`, `height`, `createdAt`, `updatedAt` fields
   - Reserve `userId` field (optional, unpopulated in V1)

2. **Firestore CRUD for attachments** (`app/lib/firestore.ts`)
   - `getAttachments(userId, songId)` — fetch ordered by `order`
   - `createAttachment(userId, songId, data)` — create with auto-ID
   - `updateAttachment(userId, songId, attachmentId, data)` — partial update
   - `deleteAttachment(userId, songId, attachmentId)` — delete document
   - `deleteAllAttachments(userId, songId)` — batch delete (for cascade)
   - `reorderAttachments(userId, songId, orderedIds)` — batch update `order` fields

3. **LocalStorage adapter for guest attachments** (`app/lib/storage.ts`)
   - Extend `LocalStorageAdapter` with attachment CRUD
   - Store as `metronotes_attachments_{songId}` keys
   - Rich text content stored as Tiptap JSON

4. **`useAttachments` hook** (`app/hooks/useAttachments.ts`)
   - Dual-mode: localStorage for guest, Firestore for authenticated
   - Optimistic updates with error rollback (same pattern as `useSongs`)
   - Exposes: `attachments`, `isLoading`, `error`, `addRichText`, `addImage`, `updateAttachment`, `deleteAttachment`, `reorderAttachments`, `setDefault`

5. **Migration utility** (`app/lib/migration.ts`)
   - `migrateNotesToAttachment(song)` — converts plain-text `notes` to a single rich text attachment
   - Converts text to Tiptap JSON (split by newlines into paragraph nodes)
   - Sets `isDefault: true`, `order: 0`
   - Removes `notes` field from song document
   - Works for both Firestore and localStorage

6. **Update song deletion** (`app/hooks/useSongs.ts`)
   - When deleting a song, also call `deleteAllAttachments` and delete Storage files

### Verification

- [ ] `Attachment` type compiles with all required fields
- [ ] `createAttachment` creates a document in `users/{userId}/songs/{songId}/attachments/`
- [ ] `getAttachments` returns attachments ordered by `order` field
- [ ] `updateAttachment` partially updates an attachment document
- [ ] `deleteAttachment` removes the document from Firestore
- [ ] `deleteAllAttachments` removes all attachments for a song
- [ ] `reorderAttachments` updates `order` fields in a batch
- [ ] LocalStorage adapter: create, read, update, delete attachments for a song
- [ ] LocalStorage adapter: attachments stored under `metronotes_attachments_{songId}` key
- [ ] `useAttachments` returns attachments for authenticated user (Firestore mode)
- [ ] `useAttachments` returns attachments for guest user (localStorage mode)
- [ ] `useAttachments` optimistic update works — UI updates before server confirms
- [ ] `useAttachments` rolls back on Firestore error
- [ ] Migration converts plain-text `notes` to a single rich text attachment with correct Tiptap JSON
- [ ] Migration sets `isDefault: true` and `order: 0` on the migrated attachment
- [ ] Migration removes `notes` field from the song document
- [ ] Migration works for Firestore songs
- [ ] Migration works for localStorage songs
- [ ] Deleting a song also deletes all its attachments from Firestore
- [ ] Deleting the default attachment promotes the first remaining attachment to default
- [ ] Existing app functionality is unchanged — no UI regressions

## Phase 2: Edit Mode — Attachment List UI

Replace the textarea with the attachment list. Tiptap editor is NOT built yet — text attachments show a preview snippet with an "Edit" placeholder.

### Tasks

1. **Attachment card component** (`app/components/song/AttachmentCard.tsx`)
   - Props: attachment, onEdit, onDelete, onToggleDefault, dragHandleProps
   - Shows: drag handle, type icon, preview (text snippet or image thumbnail), default star toggle, edit button, delete button
   - Styled with `var(--card)`, `var(--border)`, consistent with redesign

2. **Attachment list component** (`app/components/song/AttachmentList.tsx`)
   - Renders ordered `AttachmentCard` components
   - Drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable` (already a dependency)
   - Empty state: illustration + "Add notes, images, or charts" + Add button
   - "+ Add" button at bottom of list with options dropdown (Text, Image)
   - "Attachments" label above the list

3. **Update EditMode** (`app/components/song/EditMode.tsx`)
   - Remove textarea and "Lyrics / Notes" label
   - Add `AttachmentList` in the content area
   - Remove fixed bottom bar (beat indicator + play button)

4. **Add floating metronome pill to EditMode**
   - Extract metronome pill from `PerformanceMode.tsx` into a shared component (`app/components/ui/MetronomePill.tsx`)
   - Use `MetronomePill` in both `EditMode` and `PerformanceMode`

5. **Wire up migration on song open** (`app/components/SongView.tsx`)
   - On mount, check if song has `notes` string but no attachments
   - Run migration, then load attachments
   - Show loading state during migration

6. **Update SongView props/state**
   - Pass `useAttachments` data down to EditMode
   - Include attachment changes in dirty state tracking

### Verification

- [ ] Edit mode shows "Attachments" label where "Lyrics / Notes" used to be
- [ ] Empty state shown when song has no attachments: illustration + prompt + Add button
- [ ] "+ Add" button at bottom of attachment list shows options (Text, Image)
- [ ] Adding a text attachment creates a card in the list (editor not functional yet — placeholder OK)
- [ ] Attachment cards show: drag handle, type icon, preview, default star, edit button, delete button
- [ ] Drag-and-drop reordering works — cards animate, new order persists on save
- [ ] Default star toggle works — tapping star on one card clears star from others
- [ ] Delete button removes attachment (with confirmation prompt)
- [ ] Old textarea is fully removed from edit mode
- [ ] Old fixed bottom bar (beat indicator + play button) is removed
- [ ] Floating metronome pill appears at bottom-right in edit mode
- [ ] Metronome pill expands to show: beat circle, play/stop, mute toggle, BPM stepper
- [ ] Metronome pill is identical in edit and performance mode (shared component)
- [ ] Metronome pill in performance mode still works after refactor (no regression)
- [ ] Opening a song with plain-text `notes` triggers migration — attachment appears in list
- [ ] Migration shows loading state, not a flash of empty state
- [ ] Save button saves attachment changes (order, default)
- [ ] Dirty state tracking includes attachment changes
- [ ] Attachment list scrolls independently, not clipped by metronome pill
- [ ] Layout correct on mobile (390px), tablet (768px+), desktop

## Phase 3: Tiptap Rich Text Editor

Build the full-screen Tiptap overlay for editing rich text attachments.

### Tasks

1. **Add Tiptap dependencies**
   - `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-code-block`
   - Add to `package.json`

2. **Tiptap editor overlay** (`app/components/song/RichTextEditor.tsx`)
   - Full-screen overlay (fixed inset-0, z-50)
   - Header: Cancel (left), Done (right)
   - Editor area: fills remaining height
   - Cancel discards, Done calls `onSave(content)` with Tiptap JSON
   - Initialize editor with existing attachment content or empty doc

3. **Scrollable toolbar** (`app/components/song/EditorToolbar.tsx`)
   - Horizontally scrollable row
   - Buttons: bold, italic, H1, H2, bullet list, numbered list, code/monospace, text color
   - Each button highlights when active (current selection has that format)
   - Text color button opens a small color palette popover
   - Positioned at bottom of screen, above keyboard on mobile

4. **Mobile keyboard handling**
   - Use `visualViewport` API to detect keyboard height
   - Position toolbar above keyboard
   - Test on iOS Safari and Android Chrome

5. **Wire into AttachmentCard**
   - Tapping "Edit" on a text attachment opens `RichTextEditor` with that attachment's content
   - On Done, update attachment via `useAttachments.updateAttachment`

6. **Wire into "+ Add Text"**
   - Creates a new rich text attachment, then immediately opens `RichTextEditor`
   - If user cancels without typing, delete the empty attachment

### Verification

- [ ] Tiptap dependencies install without conflicts
- [ ] Tapping "Edit" on a text attachment opens the full-screen Tiptap overlay
- [ ] Overlay covers entire screen with Cancel and Done in the header
- [ ] Editor area fills remaining height below header
- [ ] Toolbar shows: bold, italic, H1, H2, bullet list, numbered list, code/monospace, text color
- [ ] Toolbar is horizontally scrollable (test with narrow viewport)
- [ ] Each toolbar button highlights when the current selection has that format
- [ ] Bold, italic, headings, lists, code blocks all apply correctly
- [ ] Text color button opens a palette; selecting a color applies it
- [ ] Monospace/code blocks render with monospace font
- [ ] Done saves content — reopening the attachment shows saved content (no data loss)
- [ ] Cancel discards changes — content reverts to last saved state
- [ ] "+ Add Text" creates a new attachment and opens the editor immediately
- [ ] Cancelling a new empty attachment deletes it (no orphaned empty attachments)
- [ ] Toolbar positions above keyboard on mobile (iOS Safari)
- [ ] Toolbar positions above keyboard on mobile (Android Chrome)
- [ ] Editor content is scrollable for long documents
- [ ] Content round-trips correctly: save, close, reopen — formatting preserved
- [ ] Rich text works for guest users (Tiptap JSON stored in localStorage)
- [ ] No regressions in edit mode layout or attachment list

## Phase 4: Image Attachments

Add image upload, compression, storage, and display.

### Tasks

1. **Firebase Storage setup** (`app/lib/storage-firebase.ts`)
   - `uploadAttachmentFile(userId, songId, attachmentId, file)` — upload to Storage path
   - `deleteAttachmentFile(userId, songId, attachmentId)` — delete from Storage
   - `getAttachmentDownloadUrl(storagePath)` — get download URL
   - Storage rules: authenticated users can read/write their own path only

2. **Image compression utility** (`app/lib/image-processing.ts`)
   - `compressImage(file, maxDimension, quality)` — returns compressed Blob
   - `generateThumbnail(file, width, quality)` — returns thumbnail Blob
   - Uses `createImageBitmap` + `OffscreenCanvas` (or fallback canvas)
   - Max dimension: 2048px, quality: 0.8
   - Thumbnail: 200px wide, quality: 0.6

3. **Storage limit validation** (`app/lib/storage-limits.ts`)
   - `validateFileSize(fileSize)` — check < 3MB
   - `validateSongStorage(songId, newFileSize)` — check song total < 15MB
   - `validateUserStorage(userId, newFileSize)` — check user total < 100MB
   - Returns specific error message for each limit type

4. **Image upload flow in AttachmentList**
   - "+ Add Image" triggers file input (`accept="image/*"` with capture option)
   - Show upload progress indicator on the new attachment card
   - On success: create attachment document with `storageUrl`, `storagePath`, dimensions
   - On failure: show error toast with retry

5. **Image preview in AttachmentCard**
   - Show thumbnail for image attachments
   - Tapping "Edit" opens full-screen image preview (simple overlay with close button)

6. **Cascade delete for images**
   - When deleting an image attachment, also delete from Firebase Storage
   - When deleting a song, delete all image files from Storage

7. **Guest mode: block image uploads**
   - When guest taps "+ Add Image", show sign-in prompt modal
   - "Sign in to add images" with sign-in button

### Verification

- [ ] "+ Add Image" opens camera/photo picker on mobile
- [ ] "+ Add Image" opens file picker on desktop
- [ ] Selected image is compressed (verify output is <= 2048px max dimension)
- [ ] Thumbnail is generated (200px wide)
- [ ] Compressed image uploads to correct Firebase Storage path (`users/{userId}/songs/{songId}/{attachmentId}`)
- [ ] Upload progress indicator shows on the attachment card during upload
- [ ] On upload success: attachment card shows thumbnail, storageUrl is set
- [ ] On upload failure: error toast with retry button appears
- [ ] Retry button re-attempts the upload successfully
- [ ] File > 3MB (after compression) shows "File too large (max 3MB)" error
- [ ] Song total > 15MB shows "Song storage limit reached (15MB)" error
- [ ] User total > 100MB shows "Account storage limit reached (100MB)" error
- [ ] Tapping "Edit" on an image attachment opens full-screen preview
- [ ] Full-screen preview has a close button that returns to attachment list
- [ ] Deleting an image attachment removes the file from Firebase Storage
- [ ] Deleting a song removes all image files from Firebase Storage
- [ ] Guest tapping "+ Add Image" sees sign-in prompt (not file picker)
- [ ] Sign-in prompt has a working sign-in button
- [ ] Image attachments display correctly in attachment cards alongside text attachments
- [ ] Reordering works with mixed text + image attachments

## Phase 5: Performance Mode — Paged View

Replace the single-scroll teleprompter with a paged attachment viewer.

### Tasks

1. **Attachment page renderer** (`app/components/song/AttachmentPage.tsx`)
   - Renders a single attachment full-height:
     - Rich text: formatted HTML via Tiptap's `generateHTML`, styled with user's font size/family
     - Image: full-width `<img>`, scrollable if taller than viewport
   - Read-only (no editing)

2. **Paged view container** (`app/components/song/PagedView.tsx`)
   - Manages current page index
   - Renders single `AttachmentPage` at a time
   - Crossfade transition (150-200ms opacity) on page change
   - Opens to the default attachment (star-marked)

3. **Dot indicators** (`app/components/ui/PageDots.tsx`)
   - Horizontally scrollable row of dots
   - Filled dot = current page
   - Tap to navigate
   - Active dot auto-scrolls into view
   - Single attachment: show one filled dot (or hide dots entirely)

4. **Edge navigation arrows**
   - Subtle left/right arrow buttons at screen edges
   - Hidden when at first/last page
   - Semi-transparent, don't obscure content

5. **Update PerformanceMode** (`app/components/song/PerformanceMode.tsx`)
   - Replace the `<pre>` notes block and empty state with `PagedView`
   - Add `PageDots` below metadata line
   - Receive attachments as prop from SongView

6. **Setlist integration**
   - On prev/next song navigation, reset to default attachment
   - Crossfade transition on song change (already exists for content)

### Verification

- [ ] Performance mode opens to the default (star-marked) attachment
- [ ] Rich text attachment renders as formatted HTML (bold, italic, headings, lists, code, colors)
- [ ] Rich text respects user's font size and font family settings
- [ ] Image attachment renders full-width
- [ ] Tall image is scrollable within the page
- [ ] Metronome pill overlays images (no special padding/gap)
- [ ] Dot indicators appear below the metadata line (time sig · BPM · key)
- [ ] Filled dot indicates the current page
- [ ] Tapping a dot jumps to that attachment
- [ ] 150-200ms crossfade transition plays on page change
- [ ] Song with 1 attachment: dots hidden or single filled dot, no edge arrows
- [ ] Song with 2+ attachments: dots and edge arrows shown
- [ ] Song with 8+ attachments: dots scroll horizontally, active dot auto-scrolls into view
- [ ] Left edge arrow hidden on first page
- [ ] Right edge arrow hidden on last page
- [ ] Edge arrows navigate correctly
- [ ] Navigating to next/prev song in setlist resets to that song's default attachment
- [ ] Crossfade transition plays on setlist song change
- [ ] Back button from setlist song returns to setlist detail (existing behavior preserved)
- [ ] Edit button (standalone songs) switches to edit mode — does NOT open attachment editor
- [ ] Song with no attachments shows "No notes for this song" empty state
- [ ] Rapidly tapping between dots doesn't break transitions or show stale content
- [ ] Adding attachment while metronome is playing doesn't interrupt audio
- [ ] BPM change in performance mode does not trigger unsaved changes dialog
- [ ] Layout correct on mobile (390px), tablet (768px+), desktop

## Phase 6: Polish & Edge Cases

### Tasks

1. **Offline support**
   - `downloadForOffline(attachmentId)` — cache image in IndexedDB/Cache API
   - Show download button on image attachment cards
   - In performance mode, fall back to cached version when offline
   - Non-downloaded images show placeholder with "Download for offline" prompt

2. **Guest-to-authenticated migration**
   - Extend `migrateLocalToFirestore` to include attachments
   - Upload any rich text attachments from localStorage to Firestore subcollection

3. **Error handling polish**
   - Upload progress indicator with cancel option
   - Retry button on failed uploads
   - Error banner for attachment load failures
   - Graceful fallback when a single attachment fails to load (show others)

4. **Performance testing**
   - Test with 10+ attachments per song
   - Test rapid dot navigation (no flicker, no stale content)
   - Test large images (2048px) on low-end mobile
   - Test Tiptap editor with long documents (1000+ lines)

5. **Accessibility**
   - Aria labels on dot indicators, edge arrows, attachment cards
   - Keyboard navigation for dot indicators (arrow keys)
   - Screen reader announcements for page changes

6. **Clean up migration code**
   - Remove `notes` field from Song type (breaking change — ensure all songs migrated)
   - Remove old textarea code from EditMode
   - Remove plain-text rendering from PerformanceMode

### Verification

- [ ] Offline: download button appears on image attachment cards in edit mode
- [ ] Offline: downloading caches the image locally
- [ ] Offline: cached images render in performance mode when network is unavailable
- [ ] Offline: non-cached images show placeholder with "Download for offline" prompt
- [ ] Guest-to-auth migration: rich text attachments in localStorage are uploaded to Firestore
- [ ] Guest-to-auth migration: attachment order and default star are preserved
- [ ] Upload progress indicator shows during image upload with cancel option
- [ ] Cancelling an in-progress upload cleans up partial state
- [ ] Failed attachment load shows error banner with retry — other attachments still render
- [ ] 10+ attachments per song: no performance degradation in edit or performance mode
- [ ] Rapid dot navigation (10+ taps/second): no flicker, stale content, or crashes
- [ ] Large images (2048px): render without lag on mobile
- [ ] Tiptap editor with 1000+ lines: scrollable, no input lag
- [ ] Aria labels present on: dot indicators, edge arrows, attachment cards, star toggle, toolbar buttons
- [ ] Keyboard arrow keys navigate between dot indicators
- [ ] Screen reader announces page changes ("Page 2 of 5")
- [ ] `notes` field removed from Song type — no references remain in codebase
- [ ] Old textarea code removed from EditMode
- [ ] Old plain-text `<pre>` rendering removed from PerformanceMode
- [ ] Full app regression test: creating, editing, deleting songs and setlists still works
- [ ] Full app regression test: metronome, settings, auth flows unaffected
