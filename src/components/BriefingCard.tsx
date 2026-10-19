'use client';

import { useState } from 'react';
import { Clock, Newspaper, Copy } from 'lucide-react';
import type { Briefing, StoryCard } from '@/lib/types';
import { cn, getBriefingReadingTime, shareContent } from '@/lib/utils';

interface BriefingCardProps {
  briefing: Briefing;
  index: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function StoryCardComponent({ story, index }: { story: StoryCard; index: number }) {
  return (
    <div className="px-6 py-5 border-t border-[var(--border)] first:border-t-0">
      <div className="flex items-start justify-between gap-3 mb-2">
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
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-hover)] text-[var(--muted)] font-medium truncate max-w-[140px]">
            {story.source}
          </span>
        )}
      </div>

      <h4 className="font-semibold text-[var(--foreground)] leading-tight text-[15px] mb-3">
        {story.headline}
      </h4>

      <ul className="space-y-2.5 mb-2">
        {story.bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between">
        {story.url ? (
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-[44px] sm:min-h-0 sm:py-1 text-sm sm:text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors font-medium"
          >
            Read more ↗
          </a>
        ) : <span />}
        <button
          onClick={async () => {
            const text = `${story.headline}\n\n${story.bullets.map(b => `• ${b}`).join('\n')}${story.url ? `\n\n${story.url}` : ''}`;
            await navigator.clipboard.writeText(text);
          }}
          className="p-2.5 sm:p-1.5 min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-md hover:bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          title="Copy story"
          aria-label="Copy story"
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

  const readingTime = getBriefingReadingTime(briefing);
  const hasStories = briefing.stories && briefing.stories.length > 0;

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

  if (briefing.empty) {
    return (
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 opacity-80">
        <h3 className="text-xl font-semibold text-[var(--muted)]">{briefing.topic}</h3>
        <p className="text-sm text-[var(--muted)] mt-2">{briefing.summary}</p>
        {briefing.articles?.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Sources</h4>
            <ul className="space-y-1 text-sm">
              {briefing.articles.map((a, i) => (
                <li key={i}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                    {a.title || a.source || a.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

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
          {/* Highlights (TL;DR) */}
          <div className="px-6 mb-5 text-[var(--muted)] leading-relaxed text-sm">
            {formatSummary(briefing.summary)}
          </div>

          {/* Stories */}
          {hasStories && (
            <div className="border-t border-[var(--border)]">
              {briefing.stories!.map((story, i) => (
                <StoryCardComponent key={i} story={story} index={i} />
              ))}
            </div>
          )}

          {/* Legacy Summary Display (fallback if no stories) */}
          {!hasStories && briefing.articles?.length > 0 && (
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
              className="px-3 py-1.5 min-h-[36px] text-sm rounded-lg bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
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
              className="px-3 py-1.5 min-h-[36px] text-sm rounded-lg bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
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
