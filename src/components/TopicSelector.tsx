'use client';

import { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import type { Topic } from '@/lib/types';

const SUGGESTIONS = [
  'AI & Tech',
  'Finance',
  'World News',
  'Sports',
  'Science',
  'Startups',
  'Crypto',
  'Climate',
  'Politics',
  'Entertainment',
];

interface TopicSelectorProps {
  topics: Topic[];
  onToggle: (id: string) => void;
  onAdd: (topic: Topic) => void;
  onRemove?: (id: string) => void;
}

export function TopicSelector({ topics, onAdd, onRemove }: TopicSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddTopic = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    // Check if topic already exists
    const exists = topics.some(t => t.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setInputValue('');
      return;
    }

    const newTopic: Topic = {
      id: trimmed.toLowerCase().replace(/\s+/g, '-'),
      name: trimmed,
      emoji: '',
      enabled: true,
    };
    
    onAdd(newTopic);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTopic(inputValue);
    }
  };

  // Filter suggestions to exclude already added topics
  const availableSuggestions = SUGGESTIONS.filter(
    s => !topics.some(t => t.name.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add any topics you'd like in your briefing (Be as specific or vague as you'd like)..."
          className="input w-full pr-12"
        />
        <button
          onClick={() => handleAddTopic(inputValue)}
          disabled={!inputValue.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-[var(--accent)] text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Selected Topics */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-full text-sm font-medium"
            >
              <span>{topic.name}</span>
              {onRemove && (
                <button
                  onClick={() => onRemove(topic.id)}
                  className="p-0.5 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {availableSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--muted)]">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleAddTopic(suggestion)}
                className="px-3 py-1.5 text-sm rounded-full border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-all"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
