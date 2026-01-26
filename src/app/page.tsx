'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TopicSelector } from '@/components/TopicSelector';
import { BriefingCard } from '@/components/BriefingCard';
import { GenerateButton } from '@/components/GenerateButton';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/SettingsModal';
import { AddTopicModal } from '@/components/AddTopicModal';
import { HistoryPanel } from '@/components/HistoryPanel';
import { KeyboardHints } from '@/components/KeyboardHints';
import { BriefingStats } from '@/components/BriefingStats';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { Topic, Briefing, Settings, BriefingHistory } from '@/lib/types';
import { generateId, getTotalReadingTime } from '@/lib/utils';

const DEFAULT_TOPICS: Topic[] = [
  { id: 'ai', name: 'AI & Tech', emoji: '🤖', enabled: true },
  { id: 'finance', name: 'Finance', emoji: '📈', enabled: true },
  { id: 'world', name: 'World News', emoji: '🌍', enabled: true },
  { id: 'sports', name: 'Sports', emoji: '🏀', enabled: false },
  { id: 'science', name: 'Science', emoji: '🔬', enabled: false },
  { id: 'startups', name: 'Startups', emoji: '🚀', enabled: true },
  { id: 'jets', name: 'NY Jets', emoji: '🏈', enabled: false },
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [history, setHistory] = useState<BriefingHistory[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load saved state from localStorage
  useEffect(() => {
    const savedTopics = localStorage.getItem('briefing-topics');
    const savedSettings = localStorage.getItem('briefing-settings');
    const savedBriefings = localStorage.getItem('briefing-cache');
    const savedTime = localStorage.getItem('briefing-time');
    const savedHistory = localStorage.getItem('briefing-history');

    if (savedTopics) setTopics(JSON.parse(savedTopics));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedBriefings) setBriefings(JSON.parse(savedBriefings));
    if (savedTime) setLastGenerated(new Date(savedTime));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('briefing-topics', JSON.stringify(topics));
  }, [topics]);

  useEffect(() => {
    localStorage.setItem('briefing-settings', JSON.stringify(settings));
  }, [settings]);

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('briefing-history', JSON.stringify(history));
    }
  }, [history]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onGenerate: () => {
      if (!isLoading && topics.some(t => t.enabled)) {
        generateBriefing();
      }
    },
    onSettings: () => setShowSettings(true),
    onExport: () => {
      if (briefings.length > 0) {
        exportBriefing();
      }
    },
    onEscape: () => {
      setShowSettings(false);
      setShowAddTopic(false);
    },
  });

  // History functions
  const addToHistory = useCallback((newBriefings: Briefing[]) => {
    const entry: BriefingHistory = {
      id: generateId(),
      briefings: newBriefings,
      generatedAt: new Date().toISOString(),
      topicNames: newBriefings.map(b => b.topic),
    };
    setHistory(prev => [entry, ...prev].slice(0, 10)); // Keep last 10
  }, []);

  const loadFromHistory = useCallback((entry: BriefingHistory) => {
    setBriefings(entry.briefings);
    setLastGenerated(new Date(entry.generatedAt));
    setAudioUrl(null);
    setEmailSent(false);
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('briefing-history');
  }, []);

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
    setAudioUrl(null);
    setEmailSent(false);

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
      addToHistory(data.briefings);
    } catch (err) {
      console.error('Error generating briefing:', err);
      setError('Failed to generate briefing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateAudio = async () => {
    if (briefings.length === 0 || isGeneratingAudio) return;

    setIsGeneratingAudio(true);
    try {
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefings }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate audio');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err) {
      console.error('Audio generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const sendEmail = async () => {
    if (briefings.length === 0 || !settings.email || isSendingEmail) return;

    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefings, email: settings.email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send email');
      }

      setEmailSent(true);
    } catch (err) {
      console.error('Email error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSendingEmail(false);
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
        <div className="flex justify-center gap-4 mb-12 flex-wrap">
          <GenerateButton
            onClick={generateBriefing}
            isLoading={isLoading}
            disabled={!topics.some(t => t.enabled)}
          />
          {briefings.length > 0 && (
            <>
              <button
                onClick={generateAudio}
                disabled={isGeneratingAudio}
                className="px-6 py-4 rounded-xl font-semibold text-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingAudio ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    Listen
                  </>
                )}
              </button>
              {settings.email && (
                <button
                  onClick={sendEmail}
                  disabled={isSendingEmail || emailSent}
                  className="px-6 py-4 rounded-xl font-semibold text-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {emailSent ? (
                    <>
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Sent!
                    </>
                  ) : isSendingEmail ? (
                    <>
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </>
                  )}
                </button>
              )}
              <button
                onClick={exportBriefing}
                className="px-6 py-4 rounded-xl font-semibold text-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </>
          )}
        </div>

        {/* Briefing Stats */}
        {briefings.length > 0 && (
          <BriefingStats briefings={briefings} lastGenerated={lastGenerated} />
        )}

        {/* Audio Player */}
        {audioUrl && (
          <div className="mb-8 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <div className="flex items-center gap-4">
              <span className="text-2xl">🎧</span>
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                className="flex-1 h-10"
                style={{ colorScheme: 'dark' }}
              />
              <a
                href={audioUrl}
                download={`briefing-${new Date().toISOString().split('T')[0]}.mp3`}
                className="px-3 py-1.5 rounded-lg bg-[var(--card-hover)] text-sm hover:text-[var(--accent)] transition-colors"
              >
                Download
              </a>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-fadeIn">
            <div className="flex items-center justify-center gap-3 text-red-400">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
              <button
                onClick={() => {
                  setError(null);
                  generateBriefing();
                }}
                className="ml-2 px-3 py-1 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Briefings */}
        {briefings.length > 0 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span>📰</span> Your Briefing
                <span className="text-sm font-normal text-[var(--muted)] ml-2">
                  ~{getTotalReadingTime(briefings)} min total
                </span>
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[var(--muted)]">
                  {briefings.length} topic{briefings.length !== 1 ? 's' : ''}
                </span>
                <HistoryPanel
                  history={history}
                  onLoad={loadFromHistory}
                  onDelete={deleteFromHistory}
                  onClear={clearHistory}
                />
              </div>
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

      {/* Keyboard Shortcuts */}
      <KeyboardHints />
    </main>
  );
}
