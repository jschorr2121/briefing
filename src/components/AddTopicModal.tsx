'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (topic: { id: string; name: string; emoji: string }) => void;
}

const EMOJI_OPTIONS = ['📱', '💼', '🎮', '🎬', '🍔', '✈️', '🏠', '⚽', '🎵', '📚', '💡', '🔒'];

export function AddTopicModal({ isOpen, onClose, onAdd }: AddTopicModalProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📱');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name.trim(),
      emoji,
    });

    setName('');
    setEmoji('📱');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--card)] rounded-2xl border border-[var(--border)] w-full max-w-md p-6 animate-fadeIn">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span>➕</span> Add Custom Topic
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Topic Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Crypto, Gaming, Food"
              className="w-full px-4 py-3 rounded-lg bg-[var(--card-hover)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Choose Emoji</label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'w-10 h-10 rounded-lg text-xl transition-all',
                    emoji === e
                      ? 'bg-[var(--accent)] scale-110'
                      : 'bg-[var(--card-hover)] hover:bg-[var(--border)]'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-lg bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className={cn(
                'flex-1 py-3 px-4 rounded-lg font-medium transition-colors',
                name.trim()
                  ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                  : 'bg-[var(--card-hover)] text-[var(--muted)] cursor-not-allowed'
              )}
            >
              Add Topic
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
