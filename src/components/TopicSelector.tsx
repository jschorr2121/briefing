'use client';

import { useState } from 'react';
import { Plus, X, Check, Cpu, TrendingUp, Globe, Dumbbell, FlaskConical, Rocket, Tag } from 'lucide-react';
import type { Topic } from '@/lib/types';
import { cn } from '@/lib/utils';

// Default suggested topics with icons
const SUGGESTED_TOPICS: { id: string; name: string; icon: React.ReactNode }[] = [
  { id: 'ai', name: 'AI & Tech', icon: <Cpu className="w-4 h-4" /> },
  { id: 'finance', name: 'Finance', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'world', name: 'World News', icon: <Globe className="w-4 h-4" /> },
  { id: 'sports', name: 'Sports', icon: <Dumbbell className="w-4 h-4" /> },
  { id: 'science', name: 'Science', icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'startups', name: 'Startups', icon: <Rocket className="w-4 h-4" /> },
];

interface TopicSelectorProps {
  topics: Topic[];
  onToggle: (id: string) => void;
  onAdd: (topic: Topic) => void;
  onRemove?: (id: string) => void;
}

export function TopicSelector({ topics, onToggle, onAdd, onRemove }: TopicSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleAddTopic = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    
    // Check if topic already exists
    const exists = topics.some(t => t.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setInputValue('');
      setShowInput(false);
      return;
    }

    const newTopic: Topic = {
      id: trimmed.toLowerCase().replace(/\s+/g, '-'),
      name: trimmed,
      emoji: '📌', // We'll use icons, but keep for compatibility
      enabled: true,
    };
    
    onAdd(newTopic);
    setInputValue('');
    setShowInput(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTopic();
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setInputValue('');
    }
  };

  const getIconForTopic = (topic: Topic) => {
    const suggested = SUGGESTED_TOPICS.find(s => s.id === topic.id);
    return suggested?.icon || <Tag className="w-4 h-4" />;
  };

  const isCustomTopic = (id: string) => !SUGGESTED_TOPICS.some(s => s.id === id);

  return (
    <div className="space-y-4">
      {/* Topic Pills */}
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <div key={topic.id} className="relative group">
            <button
              onClick={() => onToggle(topic.id)}
              className={cn(
                'topic-pill',
                topic.enabled && 'selected'
              )}
            >
              {getIconForTopic(topic)}
              <span>{topic.name}</span>
              {topic.enabled && <Check className="w-3.5 h-3.5" />}
            </button>

            {/* Remove button for custom topics */}
            {isCustomTopic(topic.id) && onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(topic.id);
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--danger)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove topic"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {/* Add Topic Button / Input */}
        {showInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!inputValue.trim()) {
                  setShowInput(false);
                }
              }}
              placeholder="Type topic + Enter"
              className="input w-40 text-sm py-2"
              autoFocus
            />
            <button
              onClick={handleAddTopic}
              disabled={!inputValue.trim()}
              className="p-2 rounded-lg bg-[var(--accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="topic-pill border-dashed"
          >
            <Plus className="w-4 h-4" />
            <span>Add Topic</span>
          </button>
        )}
      </div>

      {/* Suggested Topics (if not all added) */}
      {SUGGESTED_TOPICS.filter(s => !topics.some(t => t.id === s.id)).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--muted)]">Suggestions:</span>
          {SUGGESTED_TOPICS.filter(s => !topics.some(t => t.id === s.id)).map(suggested => (
            <button
              key={suggested.id}
              onClick={() => onAdd({
                id: suggested.id,
                name: suggested.name,
                emoji: '',
                enabled: true,
              })}
              className="text-xs px-2 py-1 rounded-md bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors flex items-center gap-1"
            >
              {suggested.icon}
              {suggested.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
