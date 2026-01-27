'use client';

import type { Briefing } from '@/lib/types';
import { getTotalReadingTime } from '@/lib/utils';

interface BriefingStatsProps {
  briefings: Briefing[];
  lastGenerated: Date | null;
}

export function BriefingStats({ briefings, lastGenerated }: BriefingStatsProps) {
  if (briefings.length === 0) return null;

  const totalReadingTime = getTotalReadingTime(briefings);
  const totalStories = briefings.reduce((acc, b) => acc + (b.stories?.length || 0), 0);

  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium">{totalReadingTime} min</div>
          <div className="text-xs text-[var(--muted)]">Read time</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium">{briefings.length}</div>
          <div className="text-xs text-[var(--muted)]">Topics</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium">{totalStories}</div>
          <div className="text-xs text-[var(--muted)]">Stories</div>
        </div>
      </div>

      {lastGenerated && (
        <div className="flex items-center gap-2 ml-auto">
          <div className="text-xs text-[var(--muted)]">
            Generated {lastGenerated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
