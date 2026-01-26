'use client';

import { useState } from 'react';
import type { BriefingHistory } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';

interface HistoryPanelProps {
  history: BriefingHistory[];
  onLoad: (entry: BriefingHistory) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onLoad, onDelete, onClear }: HistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
          'bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]',
          isOpen && 'border-[var(--accent)]'
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        History
        <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--accent)] text-white">
          {history.length}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-auto z-50 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl animate-fadeIn">
            <div className="p-3 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--card)]">
              <h3 className="font-semibold text-sm">Recent Briefings</h3>
              <button
                onClick={onClear}
                className="text-xs text-[var(--muted)] hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="p-2">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="group p-3 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => {
                        onLoad(entry);
                        setIsOpen(false);
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm font-medium mb-1">
                        {entry.topicNames.slice(0, 3).join(', ')}
                        {entry.topicNames.length > 3 && ` +${entry.topicNames.length - 3}`}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatDate(entry.generatedAt)}
                      </div>
                    </button>
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {entry.briefings.slice(0, 4).map((b, i) => (
                      <span key={i} className="text-sm" title={b.topic}>
                        {b.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
