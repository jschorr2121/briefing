'use client';

import { useState } from 'react';
import type { Briefing } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BriefingCardProps {
  briefing: Briefing;
  index: number;
}

export function BriefingCard({ briefing, index }: BriefingCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(briefing.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert markdown-style bold to HTML
  const formatSummary = (text: string) => {
    return text.split('\n\n').map((paragraph, i) => (
      <p key={i} className="mb-3 last:mb-0">
        {paragraph.split(/\*\*(.*?)\*\*/g).map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} className="text-[var(--foreground)]">{part}</strong>
          ) : (
            part
          )
        )}
      </p>
    ));
  };

  return (
    <div
      className={cn(
        'bg-[var(--card)] rounded-xl border border-[var(--border)]',
        'transition-all duration-300 hover:border-[var(--accent)]/50'
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-6 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{briefing.emoji}</span>
          <h3 className="text-xl font-semibold">{briefing.topic}</h3>
        </div>
        <svg
          className={cn(
            'w-5 h-5 text-[var(--muted)] transition-transform',
            expanded && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-6 pb-6">
          {/* Summary */}
          <div className="text-[var(--muted)] leading-relaxed mb-4">
            {formatSummary(briefing.summary)}
          </div>

          {/* Sources */}
          {briefing.articles.length > 0 && (
            <div className="border-t border-[var(--border)] pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Sources
              </h4>
              <div className="flex flex-wrap gap-2">
                {briefing.articles.map((article, i) => (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-xs rounded-full bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                  >
                    {article.source}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
