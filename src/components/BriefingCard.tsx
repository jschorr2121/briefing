'use client';

import { useState, useRef } from 'react';
import type { Briefing, StoryCard } from '@/lib/types';
import { cn, calculateReadingTime, shareContent } from '@/lib/utils';

interface BriefingCardProps {
  briefing: Briefing;
  index: number;
}

function StoryCardComponent({ story, index }: { story: StoryCard; index: number }) {
  return (
    <div 
      className={cn(
        "min-w-[320px] max-w-[380px] flex-shrink-0 snap-center",
        "bg-gradient-to-br from-[var(--card)] to-[var(--card-hover)]",
        "rounded-xl border border-[var(--border)] p-5",
        "hover:border-[var(--accent)]/60 hover:shadow-lg hover:shadow-[var(--accent)]/5",
        "transition-all duration-300"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Story Header */}
      <div className="mb-4">
        <h4 className="font-semibold text-[var(--foreground)] leading-tight text-[15px]">
          {story.headline}
        </h4>
        {story.source && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-medium">
              {story.source}
            </span>
          </div>
        )}
      </div>

      {/* Bullet Points */}
      <ul className="space-y-2.5">
        {story.bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      {/* Read More Link */}
      {story.url && (
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors font-medium"
        >
          Read full story
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

export function BriefingCard({ briefing, index }: BriefingCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const readingTime = calculateReadingTime(briefing.summary);
  const hasStories = briefing.stories && briefing.stories.length > 0;

  const copyToClipboard = async () => {
    let textToCopy = `${briefing.emoji} ${briefing.topic}\n\n${briefing.summary}`;
    if (hasStories) {
      textToCopy += '\n\n';
      briefing.stories!.forEach((story, i) => {
        textToCopy += `📌 ${story.headline}\n`;
        story.bullets.forEach(bullet => {
          textToCopy += `  • ${bullet}\n`;
        });
        textToCopy += '\n';
      });
    }
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    let shareText = `${briefing.emoji} ${briefing.topic}\n\n${briefing.summary}`;
    const success = await shareContent(
      `Briefing: ${briefing.topic}`,
      shareText
    );
    if (success) {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  const scrollCards = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Convert markdown-style bold to HTML
  const formatSummary = (text: string) => {
    return text.split('\n\n').map((paragraph, i) => (
      <p key={i} className="mb-2 last:mb-0">
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
        'bg-[var(--card)] rounded-2xl border border-[var(--border)]',
        'transition-all duration-300 hover:border-[var(--accent)]/30',
        'overflow-hidden'
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-6 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 flex items-center justify-center">
            <span className="text-2xl">{briefing.emoji}</span>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{briefing.topic}</h3>
            <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {readingTime} min read
              </span>
              {hasStories && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  {briefing.stories!.length} stories
                </span>
              )}
              {briefing.searchProvider && (
                <span className="px-1.5 py-0.5 rounded bg-[var(--card-hover)] text-[10px] uppercase tracking-wide">
                  via {briefing.searchProvider}
                </span>
              )}
            </div>
          </div>
        </div>
        <svg
          className={cn(
            'w-5 h-5 text-[var(--muted)] transition-transform duration-200',
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
        <div className="pb-6">
          {/* Summary */}
          <div className="px-6 mb-6">
            <div className="text-[var(--muted)] leading-relaxed text-sm">
              {formatSummary(briefing.summary)}
            </div>
          </div>

          {/* Story Cards - Horizontal Scroll */}
          {hasStories && (
            <div className="relative group">
              {/* Scroll Buttons */}
              <button
                onClick={() => scrollCards('left')}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[var(--background)]/90 border border-[var(--border)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:border-[var(--accent)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => scrollCards('right')}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-[var(--background)]/90 border border-[var(--border)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:border-[var(--accent)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Cards Container */}
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto px-6 py-2 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent"
                style={{ 
                  scrollbarWidth: 'thin',
                  msOverflowStyle: 'none',
                }}
              >
                {briefing.stories!.map((story, i) => (
                  <StoryCardComponent key={i} story={story} index={i} />
                ))}
              </div>

              {/* Scroll Indicator */}
              <div className="flex justify-center gap-1.5 mt-4">
                {briefing.stories!.map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[var(--border)]"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Legacy Summary Display (fallback if no stories) */}
          {!hasStories && briefing.articles.length > 0 && (
            <div className="px-6">
              <div className="border-t border-[var(--border)] pt-4">
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
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-6 px-6">
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <button
              onClick={handleShare}
              className="px-3 py-1.5 text-sm rounded-lg bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
            >
              {shared ? (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Shared!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
