'use client';

import { useState, useEffect } from 'react';
import { TopicSelector } from '@/components/TopicSelector';
import { BriefingCard } from '@/components/BriefingCard';
import { GenerateButton } from '@/components/GenerateButton';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/SettingsModal';
import { AddTopicModal } from '@/components/AddTopicModal';
import type { Topic, Briefing, Settings } from '@/lib/types';

const DEFAULT_TOPICS: Topic[] = [
  { id: 'ai', name: 'AI & Tech', emoji: '🤖', enabled: true },
  { id: 'finance', name: 'Finance', emoji: '📈', enabled: true },
  { id: 'world', name: 'World News', emoji: '🌍', enabled: true },
  { id: 'sports', name: 'Sports', emoji: '🏀', enabled: false },
  { id: 'science', name: 'Science', emoji: '🔬', enabled: false },
  { id: 'startups', name: 'Startups', emoji: '🚀', enabled: true },
];

const DEFAULT_SETTINGS: Settings = {
  briefingLength: 'medium',
  includeLinks: true,
  tone: 'professional',
};

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>(DEFAULT_TOPICS);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved state from localStorage
  useEffect(() => {
    const savedTopics = localStorage.getItem('briefing-topics');
    const savedSettings = localStorage.getItem('briefing-settings');
    const savedBriefings = localStorage.getItem('briefing-cache');
    const savedTime = localStorage.getItem('briefing-time');

    if (savedTopics) setTopics(JSON.parse(savedTopics));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedBriefings) setBriefings(JSON.parse(savedBriefings));
    if (savedTime) setLastGenerated(new Date(savedTime));
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('briefing-topics', JSON.stringify(topics));
  }, [topics]);

  useEffect(() => {
    localStorage.setItem('briefing-settings', JSON.stringify(settings));
  }, [settings]);

  const toggleTopic = (id: string) => {
    setTopics(prev =>
      prev.map(t => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const addCustomTopic = (newTopic: { id: string; name: string; emoji: string }) => {
    setTopics(prev => [...prev, { ...newTopic, enabled: true }]);
  };

  const removeTopic = (id: string) => {
    setTopics(prev => prev.filter(t => t.id !== id));
  };

  const generateBriefing = async () => {
    const enabledTopics = topics.filter(t => t.enabled);
    if (enabledTopics.length === 0) return;

    setIsLoading(true);
    setError(null);
    setBriefings([]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: enabledTopics, settings }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate briefing');
      }

      const data = await response.json();
      setBriefings(data.briefings);
      setLastGenerated(new Date());
      localStorage.setItem('briefing-cache', JSON.stringify(data.briefings));
      localStorage.setItem('briefing-time', new Date().toISOString());
    } catch (err) {
      console.error('Error generating briefing:', err);
      setError('Failed to generate briefing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportBriefing = () => {
    if (briefings.length === 0) return;

    let markdown = `# Daily Briefing\n\n`;
    markdown += `*Generated: ${lastGenerated?.toLocaleString()}*\n\n---\n\n`;

    for (const briefing of briefings) {
      markdown += `## ${briefing.emoji} ${briefing.topic}\n\n`;
      markdown += `${briefing.summary}\n\n`;

      if (briefing.articles.length > 0) {
        markdown += `### Sources\n\n`;
        for (const article of briefing.articles) {
          markdown += `- [${article.title}](${article.url}) - ${article.source}\n`;
        }
        markdown += '\n';
      }
      markdown += '---\n\n';
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `briefing-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen pb-20">
      <Header
        onSettingsClick={() => setShowSettings(true)}
        lastGenerated={lastGenerated}
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Your <span className="gradient-text">Personal</span> News Intelligence
          </h1>
          <p className="text-[var(--muted)] text-lg max-w-2xl mx-auto">
            Select your topics, generate an AI-powered briefing, and stay informed
            with what matters most to you.
          </p>
        </div>

        {/* Topic Selection */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>📋</span> Select Topics
            </h2>
            <button
              onClick={() => setShowAddTopic(true)}
              className="text-sm px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors flex items-center gap-1"
            >
              <span>+</span> Add Custom
            </button>
          </div>
          <TopicSelector
            topics={topics}
            onToggle={toggleTopic}
            onRemove={removeTopic}
          />
        </section>

        {/* Generate Button */}
        <div className="flex justify-center gap-4 mb-12">
          <GenerateButton
            onClick={generateBriefing}
            isLoading={isLoading}
            disabled={!topics.some(t => t.enabled)}
          />
          {briefings.length > 0 && (
            <button
              onClick={exportBriefing}
              className="px-6 py-4 rounded-xl font-semibold text-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Briefings */}
        {briefings.length > 0 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span>📰</span> Your Briefing
              </h2>
              <span className="text-sm text-[var(--muted)]">
                {briefings.length} topic{briefings.length !== 1 ? 's' : ''}
              </span>
            </div>
            {briefings.map((briefing, index) => (
              <BriefingCard key={briefing.topic} briefing={briefing} index={index} />
            ))}
          </section>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>📰</span> Generating Your Briefing...
            </h2>
            {topics.filter(t => t.enabled).map((topic) => (
              <div
                key={topic.id}
                className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{topic.emoji}</span>
                  <div className="h-6 w-32 bg-[var(--border)] rounded animate-pulse" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-[var(--border)] rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-[var(--border)] rounded animate-pulse" />
                  <div className="h-4 w-4/6 bg-[var(--border)] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && briefings.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--card)] flex items-center justify-center">
              <span className="text-4xl">📰</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Ready to get informed?</h3>
            <p className="text-[var(--muted)] max-w-md mx-auto">
              Select your topics above and click &quot;Generate Briefing&quot; to get your personalized news summary.
            </p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={setSettings}
      />

      {/* Add Topic Modal */}
      <AddTopicModal
        isOpen={showAddTopic}
        onClose={() => setShowAddTopic(false)}
        onAdd={addCustomTopic}
      />
    </main>
  );
}
