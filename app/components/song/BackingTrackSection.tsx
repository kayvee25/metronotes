'use client';

import { useState } from 'react';
import { Attachment } from '../../types';
import BackingTrackCard from './BackingTrackCard';
import Modal from '../ui/Modal';
import type { CloudProviderId } from '../../lib/cloud-providers/types';
import { getAvailableProviders } from '../../lib/cloud-providers';

interface BackingTrackSectionProps {
  audioAttachments: Attachment[];
  onUpload: () => void;
  onAddFromCloud?: (providerId: CloudProviderId) => void;
  onDelete: (attachmentId: string) => void;
  isUploading: boolean;
  // Playback pass-through (for the active/first audio)
  btIsPlaying?: boolean;
  btCurrentTime?: number;
  btDuration?: number;
  btBuffered?: number;
  onBtPlay?: () => void;
  onBtPause?: () => void;
  onBtSeek?: (time: number) => void;
}

export default function BackingTrackSection({
  audioAttachments,
  onUpload,
  onAddFromCloud,
  onDelete,
  isUploading,
  btIsPlaying,
  btCurrentTime,
  btDuration,
  btBuffered,
  onBtPlay,
  onBtPause,
  onBtSeek,
}: BackingTrackSectionProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addMenuModal = (
    <Modal isOpen={showAddMenu} onClose={() => setShowAddMenu(false)} title="Add Audio">
      <div className="space-y-2 -mt-2">
        <button
          onClick={() => { onUpload(); setShowAddMenu(false); }}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] active:scale-95 transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[var(--foreground)]">Upload from device</span>
        </button>
        {onAddFromCloud && getAvailableProviders().map((provider) => (
          <button
            key={provider.id}
            onClick={() => { onAddFromCloud(provider.id); setShowAddMenu(false); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[#4285F4] active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.5c0 1.55.4 3.1 1.2 4.5l3.9 9.35z" fill="#0066DA"/>
                <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.5 48.2c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8L53 65.3l-9.35 11.5h16.25c3.8 0 7.3-1.3 10.15-3.5z" fill="#EA4335"/>
                <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.85 0H34.44c-1.65 0-3.2.4-4.55 1.2L43.65 25z" fill="#00832D"/>
                <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.55 1.2h36.65c1.65 0 3.2-.4 4.55-1.2L59.8 53z" fill="#2684FC"/>
                <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
              </svg>
            </div>
            <span className="text-sm font-medium text-[var(--foreground)]">From {provider.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );

  return (
    <div className="px-4 py-3 border-t border-[var(--border)]">
      <label data-testid="section-audio" className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider block mb-3">
        Audio
      </label>

      {isUploading && (
        <div className="flex items-center justify-center gap-2 py-6">
          <svg className="w-5 h-5 text-[var(--muted)] animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} opacity={0.25} />
            <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </svg>
          <span className="text-sm text-[var(--muted)]">Uploading...</span>
        </div>
      )}

      {/* Audio file cards */}
      {audioAttachments.length > 0 && (
        <div className="space-y-2">
          {audioAttachments.map((att, i) => {
            const isActiveTrack = i === 0;
            return (
              <BackingTrackCard
                key={att.id}
                attachment={att}
                onDelete={() => onDelete(att.id)}
                isPlaying={isActiveTrack ? btIsPlaying : undefined}
                currentTime={isActiveTrack ? btCurrentTime : undefined}
                duration={isActiveTrack ? btDuration : undefined}
                buffered={isActiveTrack ? btBuffered : undefined}
                onPlay={isActiveTrack ? onBtPlay : undefined}
                onPause={isActiveTrack ? onBtPause : undefined}
                onSeek={isActiveTrack ? onBtSeek : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Add audio button — always visible */}
      {!isUploading && (
        <button
          data-testid="btn-add-audio"
          onClick={() => setShowAddMenu(true)}
          className={`w-full py-3 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--muted)] font-medium text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2 ${audioAttachments.length > 0 ? 'mt-2' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          + Add Audio
        </button>
      )}

      {addMenuModal}
    </div>
  );
}
