'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Loader2, Zap, TrendingUp, AlertCircle } from 'lucide-react';
import type { HubStory, TasteProfile } from '@/lib/hub-types';
import { loadTasteProfile, rankStories } from '@/lib/taste-profile';
import { StoryCard } from './StoryCard';
import { FeedSkeleton, FeedRefreshIndicator } from './FeedSkeleton';
import { TopicFilter } from './TopicFilter';
import { cn } from '@/lib/utils';

export function HubFeed() {
  const [stories, setStories] = useState<HubStory[]>([]);
  const [filteredStories, setFilteredStories] = useState<HubStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);

  // Load taste profile
  useEffect(() => {
    const profile = loadTasteProfile();
    setTasteProfile(profile);
  }, []);

  // Fetch stories
  const fetchStories = useCallback(async (append = false) => {
    if (!append) setIsLoading(true);
    else setIsLoadingMore(true);
    setError(null);

    try {
      const profile = loadTasteProfile();
      setTasteProfile(profile);

      const response = await fetch('/api/hub/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasteProfile: profile,
          count: 12,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch feed');

      const data = await response.json();
      const newStories: HubStory[] = data.stories || [];
      
      // Rank stories based on taste profile
      const ranked = rankStories(newStories, profile);

      if (append) {
        setStories(prev => {
          // Deduplicate by headline
          const existing = new Set(prev.map(s => s.headline));
          const unique = ranked.filter(s => !existing.has(s.headline));
          return [...prev, ...unique];
        });
      } else {
        setStories(ranked);
      }

      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Feed fetch error:', err);
      setError('Failed to load stories. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Apply topic filter
  useEffect(() => {
    if (activeFilter) {
      setFilteredStories(stories.filter(s => 
        s.topic === activeFilter || s.crossTopics?.includes(activeFilter)
      ));
    } else {
      setFilteredStories(stories);
    }
  }, [stories, activeFilter]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || isLoading || isLoadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMore && hasMore && stories.length > 0) {
          fetchStories(true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [isLoading, isLoadingMore, hasMore, stories.length, fetchStories]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setStories([]);
    fetchStories(false);
  }, [fetchStories]);

  const handleFilter = useCallback((topic: string | null) => {
    setActiveFilter(topic);
  }, []);

  const displayStories = filteredStories;

  return (
    <div ref={feedContainerRef} className="max-w-2xl mx-auto px-4 py-6">
      {/* Feed Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Zap className="w-7 h-7 text-[var(--accent)]" />
              News Hub
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Your personalized feed — the more you read, the smarter it gets
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className={cn(
              'p-2.5 rounded-xl border border-[var(--border)] transition-all duration-200',
              'hover:border-[var(--accent)] hover:bg-[var(--accent-light)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Refresh feed"
          >
            <RefreshCw className={cn(
              'w-5 h-5 text-[var(--muted)]',
              (isRefreshing || isLoading) && 'animate-spin text-[var(--accent)]'
            )} />
          </button>
        </div>

        {/* Topic filters */}
        {tasteProfile && (
          <TopicFilter
            activeFilter={activeFilter}
            onFilter={handleFilter}
            profile={tasteProfile}
          />
        )}
      </div>

      {/* Taste Profile Summary */}
      {tasteProfile && tasteProfile.totalInteractions > 5 && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[var(--accent-light)] to-purple-50 border border-[var(--accent)]/10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide">Your Interests</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(tasteProfile.topicAffinities)
              .sort(([, a], [, b]) => b.score - a.score)
              .slice(0, 6)
              .map(([topic, aff]) => (
                <span
                  key={topic}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `rgba(37, 99, 235, ${aff.score * 0.2})`,
                    color: aff.score > 0.5 ? 'var(--accent)' : 'var(--muted)',
                    border: `1px solid rgba(37, 99, 235, ${aff.score * 0.3})`,
                  }}
                >
                  {topic} {aff.score >= 0.7 ? '🔥' : aff.score >= 0.5 ? '📈' : ''}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Refreshing indicator */}
      {isRefreshing && <FeedRefreshIndicator />}

      {/* Error state */}
      {error && !isLoading && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 animate-fadeIn">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-600">{error}</span>
            <button
              onClick={() => fetchStories(false)}
              className="ml-auto px-3 py-1 text-sm rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !isRefreshing && <FeedSkeleton count={5} />}

      {/* Stories feed */}
      {!isLoading && displayStories.length > 0 && (
        <div className="space-y-4">
          {displayStories.map((story, index) => (
            <StoryCard
              key={story.id}
              story={story}
              index={index}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && displayStories.length === 0 && stories.length > 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--card)] flex items-center justify-center">
            <span className="text-3xl">🔍</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">No stories for this topic</h3>
          <p className="text-sm text-[var(--muted)]">
            Try selecting a different topic filter or refresh the feed.
          </p>
          <button
            onClick={() => setActiveFilter(null)}
            className="mt-4 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium"
          >
            Show All Stories
          </button>
        </div>
      )}

      {/* Empty state - no stories at all */}
      {!isLoading && !error && stories.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--card)] flex items-center justify-center">
            <Zap className="w-10 h-10 text-[var(--muted)]" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No stories yet</h3>
          <p className="text-sm text-[var(--muted)] max-w-md mx-auto mb-4">
            We couldn&apos;t load stories right now. Try refreshing.
          </p>
          <button
            onClick={() => fetchStories(false)}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Load Stories
          </button>
        </div>
      )}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-8">
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading more stories...
          </div>
        )}
      </div>
    </div>
  );
}
