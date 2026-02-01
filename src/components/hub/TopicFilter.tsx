'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DISCOVERY_TOPICS } from '@/lib/hub-types';
import type { TasteProfile } from '@/lib/hub-types';

interface TopicFilterProps {
  activeFilter: string | null;
  onFilter: (topic: string | null) => void;
  profile: TasteProfile;
}

export function TopicFilter({ activeFilter, onFilter, profile }: TopicFilterProps) {
  // Sort topics by affinity score
  const sortedTopics = [...DISCOVERY_TOPICS].sort((a, b) => {
    const scoreA = profile.topicAffinities[a.name]?.score || 0;
    const scoreB = profile.topicAffinities[b.name]?.score || 0;
    return scoreB - scoreA;
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onFilter(null)}
        className={cn(
          'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
          'border whitespace-nowrap',
          activeFilter === null
            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
            : 'bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:border-[var(--accent)]/30'
        )}
      >
        ✨ For You
      </button>
      {sortedTopics.map(topic => {
        const affinity = profile.topicAffinities[topic.name];
        const isHigh = affinity && affinity.score >= 0.6;
        return (
          <button
            key={topic.name}
            onClick={() => onFilter(activeFilter === topic.name ? null : topic.name)}
            className={cn(
              'flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200',
              'border whitespace-nowrap',
              activeFilter === topic.name
                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                : isHigh
                  ? 'bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent)]/20 hover:border-[var(--accent)]/40'
                  : 'bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:border-[var(--accent)]/30'
            )}
          >
            {topic.emoji} {topic.name}
          </button>
        );
      })}
    </div>
  );
}
