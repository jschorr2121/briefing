'use client';

export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 overflow-hidden"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          {/* Topic & meta skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-24 bg-[var(--border)] rounded-full animate-shimmer" />
            <div className="h-4 w-16 bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: '100ms' }} />
          </div>

          {/* Headline skeleton */}
          <div className="space-y-2 mb-3">
            <div className="h-5 w-full bg-[var(--border)] rounded animate-shimmer" />
            <div className="h-5 w-3/4 bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: '50ms' }} />
          </div>

          {/* Summary skeleton */}
          <div className="space-y-2 mb-4">
            <div className="h-4 w-full bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: '100ms' }} />
            <div className="h-4 w-5/6 bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: '150ms' }} />
            <div className="h-4 w-2/3 bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: '200ms' }} />
          </div>

          {/* Source skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-20 bg-[var(--border)] rounded animate-shimmer" />
            <div className="h-4 w-4 bg-[var(--border)] rounded animate-shimmer" />
          </div>

          {/* Reactions skeleton */}
          <div className="flex items-center gap-2 pt-2">
            <div className="h-7 w-24 bg-[var(--border)] rounded-full animate-shimmer" />
            <div className="h-7 w-20 bg-[var(--border)] rounded-full animate-shimmer" style={{ animationDelay: '50ms' }} />
            <div className="h-7 w-24 bg-[var(--border)] rounded-full animate-shimmer" style={{ animationDelay: '100ms' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedRefreshIndicator() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-sm font-medium">
        <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        Finding fresh stories...
      </div>
    </div>
  );
}
