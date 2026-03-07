'use client';

import { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, ChevronLeft, Check, Plus, X, Loader2, Newspaper } from 'lucide-react';
import type { Topic } from '@/lib/types';

interface CategoryTopics {
  [category: string]: { id: string; displayName: string; type: string }[];
}

interface OnboardingFlowProps {
  onComplete: (topics: Topic[]) => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<CategoryTopics>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customInput, setCustomInput] = useState('');
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleTopic = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustom = () => {
    const t = customInput.trim();
    if (!t || customTopics.includes(t)) return;
    setCustomTopics(prev => [...prev, t]);
    setCustomInput('');
  };

  const removeCustom = (t: string) => {
    setCustomTopics(prev => prev.filter(x => x !== t));
  };

  const totalSelected = selectedIds.size + customTopics.length;

  const finish = () => {
    const topics: Topic[] = [];

    // Add curated selections
    for (const [, items] of Object.entries(categories)) {
      for (const item of items) {
        if (selectedIds.has(item.id)) {
          topics.push({
            id: item.id,
            name: item.displayName,
            emoji: '',
            enabled: true,
          });
        }
      }
    }

    // Add custom topics
    for (const name of customTopics) {
      topics.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        emoji: '',
        enabled: true,
      });
    }

    setStep(2);
    setTimeout(() => onComplete(topics), 1800);
  };

  const CATEGORY_ICONS: Record<string, string> = {
    'Technology': '💻',
    'Business & Finance': '📈',
    'Sports': '⚽',
    'Science': '🔬',
    'Politics & World': '🌍',
    'Lifestyle': '🌿',
    'Entertainment': '🎬',
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-[var(--accent)]' : i < step ? 'w-4 bg-[var(--accent)]/50' : 'w-4 bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center animate-fadeIn">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-[var(--accent)]" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              What news matters to you?
            </h1>
            <p className="text-[var(--muted)] text-lg max-w-md mx-auto mb-10">
              Pick the topics you care about and we&apos;ll create a personalized news briefing just for you.
            </p>
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--accent)] text-white font-semibold text-lg hover:opacity-90 transition-opacity"
            >
              Get Started
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 1: Topic Browser */}
        {step === 1 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Choose your topics</h2>
              <p className="text-[var(--muted)]">
                Select at least one topic to get started
                {totalSelected > 0 && (
                  <span className="ml-2 text-[var(--accent)] font-medium">
                    · {totalSelected} selected
                  </span>
                )}
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--muted)]" />
              </div>
            ) : (
              <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-1 pb-2">
                {Object.entries(categories).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>{CATEGORY_ICONS[category] || '📰'}</span>
                      {category}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {items.map(item => {
                        const selected = selectedIds.has(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => toggleTopic(item.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${
                              selected
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-md shadow-[var(--accent)]/20'
                                : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--card-hover)]'
                            }`}
                          >
                            {selected && <Check className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                            {item.displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Custom topics */}
                <div>
                  <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>✨</span> Custom Topics
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {customTopics.map(t => (
                      <span
                        key={t}
                        className="px-4 py-2 rounded-full text-sm font-medium bg-[var(--accent)] text-white border border-[var(--accent)] flex items-center gap-1.5"
                      >
                        {t}
                        <button onClick={() => removeCustom(t)} className="hover:opacity-70">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustom()}
                      placeholder="Add a custom topic..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none text-sm"
                    />
                    <button
                      onClick={addCustom}
                      disabled={!customInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/50 disabled:opacity-30 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-[var(--border)]">
              <button
                onClick={() => setStep(0)}
                className="flex items-center gap-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={finish}
                disabled={totalSelected === 0}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 2 && (
          <div className="text-center animate-fadeIn">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold mb-3">You&apos;re all set!</h2>
            <p className="text-[var(--muted)] text-lg mb-8">
              Generating your first briefing...
            </p>
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
