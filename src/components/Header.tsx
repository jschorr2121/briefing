'use client';

import { Newspaper, Settings } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';

interface HeaderProps {
  onSettingsClick: () => void;
  lastGenerated: Date | null;
}

export function Header({ onSettingsClick, lastGenerated }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Briefing</h1>
            {lastGenerated && (
              <p className="text-xs text-[var(--muted)]">
                Updated {formatDistanceToNow(lastGenerated)}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onSettingsClick}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--card)] transition-all"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-[var(--muted)]" />
          <span className="text-sm text-[var(--muted)]">Settings</span>
        </button>
      </div>
    </header>
  );
}
