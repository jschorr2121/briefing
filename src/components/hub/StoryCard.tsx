'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, Clock, ChevronDown, ChevronUp, Tag, Sparkles } from 'lucide-react';
import type { HubStory, UserReaction } from '@/lib/hub-types';
import { 
  recordInteraction, 
  recordReaction, 
  getReaction, 
  applyReactionToProfile 
} from '@/lib/taste-profile';
import { cn, formatDistanceToNow } from '@/lib/utils';

interface StoryCardProps {
  story: HubStory;
  index: number;
  onVisible?: () => void;
}

type ReactionType = 'fire' | 'boring' | 'mindblown';

const REACTION_CONFIG: { type: ReactionType; emoji: string; label: string; activeClass: string }[] = [
  { type: 'fire', emoji: '🔥', label: 'Important', activeClass: 'bg-orange-500/20 border-orange-500/40 shadow-orange-500/10' },
  { type: 'boring', emoji: '💤', label: 'Boring', activeClass: 'bg-blue-500/20 border-blue-500/40 shadow-blue-500/10' },
  { type: 'mindblown', emoji: '🤯', label: 'Surprising', activeClass: 'bg-purple-500/20 border-purple-500/40 shadow-purple-500/10' },
];

export function StoryCard({ story, index, onVisible }: StoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [expandStartTime, setExpandStartTime] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const visibilityTimeRef = useRef<number | null>(null);

  // Load existing reaction
  useEffect(() => {
    const existing = getReaction(story.id);
    if (existing) {
      setUserReaction(existing.reaction);
    }
  }, [story.id]);

  // Intersection observer for visibility tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && !hasBeenVisible) {
          setHasBeenVisible(true);
          visibilityTimeRef.current = Date.now();
          onVisible?.();
        }
      },
      { threshold: 0.5 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [hasBeenVisible, onVisible]);

  // Track skips (visible for < 1.5s then scrolled past)
  useEffect(() => {
    if (!isVisible && visibilityTimeRef.current && !expanded) {
      const timeVisible = Date.now() - visibilityTimeRef.current;
      if (timeVisible < 1500 && timeVisible > 300) {
        recordInteraction({
          storyId: story.id,
          topic: story.topic,
          source: story.source,
          action: 'skip',
          timestamp: Date.now(),
        });
      }
      visibilityTimeRef.current = null;
    }
  }, [isVisible, expanded, story.id, story.topic, story.source]);

  const handleExpand = useCallback(() => {
    if (!expanded) {
      setExpanded(true);
      setExpandStartTime(Date.now());
      recordInteraction({
        storyId: story.id,
        topic: story.topic,
        source: story.source,
        action: 'expand',
        timestamp: Date.now(),
      });
    } else {
      const timeSpent = expandStartTime ? Date.now() - expandStartTime : 0;
      recordInteraction({
        storyId: story.id,
        topic: story.topic,
        source: story.source,
        action: 'collapse',
        timeSpentMs: timeSpent,
        timestamp: Date.now(),
      });
      setExpanded(false);
      setExpandStartTime(null);
    }
  }, [expanded, expandStartTime, story.id, story.topic, story.source]);

  const handleReaction = useCallback((type: ReactionType) => {
    const newReaction = userReaction === type ? null : type;
    setUserReaction(newReaction);
    
    if (newReaction) {
      recordReaction({
        storyId: story.id,
        reaction: newReaction,
        timestamp: Date.now(),
      });
      applyReactionToProfile(story.topic, story.source, newReaction);
    }
  }, [userReaction, story.id, story.topic, story.source]);

  const timestamp = new Date(story.timestamp);
  const timeAgo = formatDistanceToNow(timestamp);
  const isCrossTopic = story.crossTopics && story.crossTopics.length > 1;

  return (
    <div
      ref={cardRef}
      className={cn(
        'hub-story-card group relative',
        'bg-[var(--card)] rounded-2xl border border-[var(--border)]',
        'transition-all duration-300 ease-out',
        'hover:border-[var(--accent)]/40 hover:shadow-lg hover:shadow-[var(--accent)]/5',
        expanded && 'border-[var(--accent)]/30 shadow-lg shadow-[var(--accent)]/5',
        hasBeenVisible ? 'animate-fadeIn' : 'opacity-0'
      )}
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
    >
      {/* Cross-topic discovery badge */}
      {isCrossTopic && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] font-semibold shadow-lg">
            <Sparkles className="w-3 h-3" />
            Discovery
          </div>
        </div>
      )}

      {/* Main content - clickable to expand */}
      <button
        onClick={handleExpand}
        className="w-full text-left p-5 pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-t-2xl"
      >
        {/* Topic & Meta */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--accent-light)] text-[var(--accent)]">
              {story.topicEmoji} {story.topic}
            </span>
            {isCrossTopic && story.crossTopics!.filter(t => t !== story.topic).map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--card-hover)] text-[var(--muted)]">
                {t}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </div>
        </div>

        {/* Headline */}
        <h3 className="text-lg font-bold text-[var(--foreground)] leading-snug mb-2 group-hover:text-[var(--accent)] transition-colors">
          {story.headline}
        </h3>

        {/* Summary */}
        <p className="text-sm text-[var(--muted)] leading-relaxed mb-3">
          {story.summary}
        </p>

        {/* Source */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted)] px-2 py-0.5 rounded bg-[var(--card-hover)]">
            {story.source}
          </span>
          <div className={cn(
            'flex items-center gap-1 text-xs text-[var(--accent)] transition-transform duration-200',
            expanded && 'rotate-180'
          )}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <div className={cn(
        'overflow-hidden transition-all duration-300 ease-in-out',
        expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="px-5 pb-5 border-t border-[var(--border)] pt-4 mt-1">
          {/* Full summary */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Full Analysis</h4>
            <p className="text-sm text-[var(--foreground)] leading-relaxed">
              {story.fullSummary}
            </p>
          </div>

          {/* Read original article */}
          <a
            href={story.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              recordInteraction({
                storyId: story.id,
                topic: story.topic,
                source: story.source,
                action: 'click',
                timestamp: Date.now(),
              });
            }}
          >
            Read Full Article
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Reactions bar */}
      <div className="flex items-center gap-2 px-5 pb-4 pt-1">
        {REACTION_CONFIG.map(({ type, emoji, label, activeClass }) => (
          <button
            key={type}
            onClick={(e) => {
              e.stopPropagation();
              handleReaction(type);
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
              'border transition-all duration-200',
              'hover:scale-105 active:scale-95',
              userReaction === type
                ? activeClass + ' shadow-sm'
                : 'border-[var(--border)] bg-[var(--card-hover)] text-[var(--muted)] hover:border-[var(--accent)]/30'
            )}
            title={label}
          >
            <span className={cn(
              'transition-transform duration-200',
              userReaction === type && 'scale-110'
            )}>
              {emoji}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
