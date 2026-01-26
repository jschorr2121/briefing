'use client';

import type { Topic } from '@/lib/types';
import { cn } from '@/lib/utils';

// Default topic IDs that can't be removed
const DEFAULT_TOPIC_IDS = ['ai', 'finance', 'world', 'sports', 'science', 'startups'];

interface TopicSelectorProps {
  topics: Topic[];
  onToggle: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function TopicSelector({ topics, onToggle, onRemove }: TopicSelectorProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {topics.map((topic) => {
        const isCustom = !DEFAULT_TOPIC_IDS.includes(topic.id);

        return (
          <div key={topic.id} className="relative group">
            <button
              onClick={() => onToggle(topic.id)}
              aria-pressed={topic.enabled}
              aria-label={`${topic.name} ${topic.enabled ? '(selected)' : '(not selected)'}`}
              className={cn(
                'px-4 py-2.5 rounded-full border transition-all duration-200',
                'flex items-center gap-2 text-sm font-medium',
                'active:scale-95',
                topic.enabled
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 border-transparent text-white shadow-md shadow-indigo-500/20 scale-[1.02]'
                  : 'bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]/50 hover:bg-[var(--card-hover)] hover:scale-[1.02]'
              )}
            >
              <span>{topic.emoji}</span>
              <span>{topic.name}</span>
              {topic.enabled && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            {/* Remove button for custom topics */}
            {isCustom && onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(topic.id);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                title="Remove topic"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
