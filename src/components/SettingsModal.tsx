'use client';

import { useState, useEffect } from 'react';
import type { Settings } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--card)] rounded-2xl border border-[var(--border)] w-full max-w-md p-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        </h2>

        {/* Briefing Length */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">Briefing Length</label>
          <div className="flex gap-2">
            {(['short', 'medium', 'long'] as const).map((length) => (
              <button
                key={length}
                onClick={() => setLocalSettings({ ...localSettings, briefingLength: length })}
                className={cn(
                  'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                  localSettings.briefingLength === length
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)]'
                )}
              >
                {length.charAt(0).toUpperCase() + length.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tone */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">Tone</label>
          <div className="flex gap-2">
            {(['casual', 'professional', 'technical'] as const).map((tone) => (
              <button
                key={tone}
                onClick={() => setLocalSettings({ ...localSettings, tone })}
                className={cn(
                  'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                  localSettings.tone === tone
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)]'
                )}
              >
                {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Include Links Toggle */}
        <div className="mb-6">
          <button
            onClick={() => setLocalSettings({ ...localSettings, includeLinks: !localSettings.includeLinks })}
            className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-[var(--card-hover)]"
          >
            <span className="text-sm font-medium">Include Source Links</span>
            <div
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative',
                localSettings.includeLinks ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  localSettings.includeLinks ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 px-4 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
