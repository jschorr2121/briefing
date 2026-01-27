'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, Newspaper, ExternalLink, Copy, Share2, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Check, Link } from 'lucide-react';
import type { Briefing, StoryCard } from '@/lib/types';
import { cn, calculateReadingTime, shareContent } from '@/lib/utils';

interface BriefingCardProps {
  briefing: Briefing;
  index: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function StoryCardComponent({ story, index, isActive }: { story: StoryCard; index: number; isActive?: boolean }) {
  return (
    <div 
      className={cn(
        "min-w-[280px] sm:min-w-[320px] max-w-[340px] sm:max-w-[380px] flex-shrink-0 snap-center",
        "bg-gradient-to-br from-[var(--card)] to-[var(--card-hover)]",
        "rounded-xl border p-4 sm:p-5",
        "transition-all duration-300",
        isActive 
          ? "border-[var(--accent)]/50 shadow-lg shadow-[var(--accent)]/10 scale-[1.01]" 
          : "border-[var(--border)] hover:border-[var(--accent)]/40"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Story Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded">
            #{index + 1}
          </span>
          {story.date && (
            <span className="text-xs text-[var(--muted)] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {story.date}
            </span>
          )}
        </div>
        {story.source && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card)] text-[var(--muted)] font-medium truncate max-w-[140px]">
            {story.source}
          </span>
        )}
      </div>

      {/* Story Header */}
      <div className="mb-4">
        <h4 className="font-semibold text-[var(--foreground)] leading-tight text-[15px]">
          {story.headline}
        </h4>
      </div>

      {/* Bullet Points */}
      <ul className="space-y-2.5 mb-4">
        {story.bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      {/* Actions Row */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
        {story.url && (
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors font-medium group"
          >
            Read more
            <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
        <button
          onClick={async () => {
            const text = `${story.headline}\n\n${story.bullets.map(b => `• ${b}`).join('\n')}${story.url ? `\n\n${story.url}` : ''}`;
            await navigator.clipboard.writeText(text);
          }}
          className="p-1.5 rounded-md hover:bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          title="Copy story"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function BriefingCard({ briefing, index, onRefresh, isRefreshing }: BriefingCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const readingTime = calculateReadingTime(briefing.summary);
  const hasStories = briefing.stories && briefing.stories.length > 0;
  const totalStories = briefing.stories?.length || 0;

  // Track scroll position to update active story indicator
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !hasStories) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = 340; // min-w-[320px] + gap
    const newIndex = Math.round(scrollLeft / cardWidth);
    setActiveStoryIndex(Math.min(Math.max(0, newIndex), totalStories - 1));
    if (scrollLeft > 20 && !hasScrolled) {
      setHasScrolled(true);
    }
  }, [hasStories, totalStories, hasScrolled]);

  // Set up scroll listener
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!hasStories) return;
    if (e.key === 'ArrowLeft') {
      scrollCards('left');
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      scrollCards('right');
      e.preventDefault();
    }
  }, [hasStories]);

  const copyToClipboard = async () => {
    let textToCopy = `${briefing.topic}\n\n${briefing.summary}`;
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
    let shareText = `${briefing.topic}\n\n${briefing.summary}`;
    const success = await shareContent(
      `Briefing: ${briefing.topic}`,
      shareText
    );
    if (success) {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  const scrollCards = useCallback((direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  }, []);

  const scrollToStory = useCallback((storyIndex: number) => {
    if (scrollRef.current) {
      const scrollAmount = 340 * storyIndex;
      scrollRef.current.scrollTo({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  }, []);

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
      <div className="p-6 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-4 text-left flex-1"
        >
          <div className="w-10 h-10 rounded-lg bg-[var(--card-hover)] flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-[var(--muted)]" />
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
        </button>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={isRefreshing}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isRefreshing 
                  ? "text-[var(--accent)] cursor-not-allowed" 
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)]"
              )}
              title="Refresh this topic"
            >
              <svg 
                className={cn("w-4 h-4", isRefreshing && "animate-spin")} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <svg
              className={cn(
                'w-5 h-5 transition-transform duration-200',
                expanded && 'rotate-180'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="pb-6">
          {/* Highlights */}
          <div className="px-6 mb-6">
            <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
              Highlights
            </h4>
            <div className="text-[var(--muted)] leading-relaxed text-sm">
              {formatSummary(briefing.summary)}
            </div>
          </div>

          {/* Story Cards - Horizontal Scroll */}
          {hasStories && (
            <div className="relative group" onKeyDown={handleKeyDown} tabIndex={0}>
              {/* Story Counter */}
              <div className="flex items-center justify-between px-6 mb-3">
                <span className="text-xs text-[var(--muted)] font-medium">
                  Story {activeStoryIndex + 1} of {totalStories}
                </span>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <span className="hidden sm:inline">Use</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-hover)] border border-[var(--border)] text-[10px] font-mono">←</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--card-hover)] border border-[var(--border)] text-[10px] font-mono">→</kbd>
                  <span className="hidden sm:inline">to navigate</span>
                </div>
              </div>

              {/* Scroll Buttons */}
              <button
                onClick={() => scrollCards('left')}
                disabled={activeStoryIndex === 0}
                className={cn(
                  "absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full",
                  "bg-[var(--background)]/95 border border-[var(--border)]",
                  "flex items-center justify-center transition-all duration-200",
                  activeStoryIndex === 0 
                    ? "opacity-30 cursor-not-allowed" 
                    : "opacity-0 group-hover:opacity-100 hover:border-[var(--accent)] hover:bg-[var(--card)]"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => scrollCards('right')}
                disabled={activeStoryIndex === totalStories - 1}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full",
                  "bg-[var(--background)]/95 border border-[var(--border)]",
                  "flex items-center justify-center transition-all duration-200",
                  activeStoryIndex === totalStories - 1
                    ? "opacity-30 cursor-not-allowed"
                    : "opacity-0 group-hover:opacity-100 hover:border-[var(--accent)] hover:bg-[var(--card)]"
                )}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Cards Container */}
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto px-6 py-2 scroll-smooth snap-x snap-mandatory scrollbar-thin focus:outline-none"
                style={{ 
                  scrollbarWidth: 'thin',
                  msOverflowStyle: 'none',
                }}
              >
                {briefing.stories!.map((story, i) => (
                  <StoryCardComponent key={i} story={story} index={i} isActive={i === activeStoryIndex} />
                ))}
              </div>

              {/* Interactive Scroll Indicator */}
              <div className="flex flex-col items-center gap-2 mt-4">
                <div className="flex items-center gap-2">
                  {briefing.stories!.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToStory(i)}
                      className={cn(
                        "transition-all duration-300 rounded-full",
                        i === activeStoryIndex 
                          ? "w-6 h-2 bg-[var(--accent)]" 
                          : "w-2 h-2 bg-[var(--border)] hover:bg-[var(--muted)]"
                      )}
                      aria-label={`Go to story ${i + 1}`}
                    />
                  ))}
                </div>
                {/* Mobile swipe hint - shows only on mobile and only if not scrolled */}
                {!hasScrolled && totalStories > 1 && (
                  <div className="sm:hidden flex items-center gap-1 text-[10px] text-[var(--muted)] animate-pulse">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    Swipe for more stories
                  </div>
                )}
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
