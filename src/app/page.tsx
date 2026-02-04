'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Headphones, Mail, Download, Check, Loader2, Newspaper, Calendar, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { TopicSelector } from '@/components/TopicSelector';
import { BriefingCard } from '@/components/BriefingCard';
import { GenerateButton } from '@/components/GenerateButton';
import { Header } from '@/components/Header';
import { SettingsModal } from '@/components/SettingsModal';
import { AddTopicModal } from '@/components/AddTopicModal';
import { HistoryPanel } from '@/components/HistoryPanel';
import { KeyboardHints } from '@/components/KeyboardHints';
import { BriefingStats } from '@/components/BriefingStats';
import { UpgradeModal } from '@/components/UpgradeModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSubscription } from '@/hooks/useSubscription';
import type { Topic, Briefing, Settings, BriefingHistory } from '@/lib/types';
import { generateId, getTotalReadingTime } from '@/lib/utils';

const DEFAULT_TOPICS: Topic[] = [
  { id: 'ai-tech', name: 'AI & Tech', emoji: '', enabled: true },
  { id: 'world-news', name: 'World News', emoji: '', enabled: true },
  { id: 'finance', name: 'Finance', emoji: '', enabled: true },
];

const DEFAULT_SETTINGS: Settings = {
  briefingLength: 'medium',
  includeLinks: true,
  tone: 'professional',
  voice: 'nova',
};

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>(DEFAULT_TOPICS);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [error, setError] = useState<{ message: string; type: 'briefing' | 'audio' | 'email' } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [history, setHistory] = useState<BriefingHistory[]>([]);
  const [refreshingTopic, setRefreshingTopic] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const voicePickerRef = useRef<HTMLDivElement>(null);

  // Subscription hook
  const { isPro, isFree, canGenerate, usageCount, usageLimit, refresh: refreshSub } = useSubscription();
  const tier = isPro ? 'pro' as const : 'free' as const;

  // Load saved state from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('briefing-settings');
    const savedBriefings = localStorage.getItem('briefing-cache');
    const savedTime = localStorage.getItem('briefing-time');
    const savedHistory = localStorage.getItem('briefing-history');
    const savedTopics = localStorage.getItem('briefing-topics');

    if (savedSettings) setSettings(JSON.parse(savedSettings));
    if (savedBriefings) setBriefings(JSON.parse(savedBriefings));
    if (savedTime) setLastGenerated(new Date(savedTime));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedTopics) setTopics(JSON.parse(savedTopics));
  }, []);

  useEffect(() => {
    localStorage.setItem('briefing-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('briefing-topics', JSON.stringify(topics));
  }, [topics]);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('briefing-history', JSON.stringify(history));
    }
  }, [history]);

  // Close voice picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (voicePickerRef.current && !voicePickerRef.current.contains(e.target as Node)) {
        setShowVoicePicker(false);
      }
    }
    if (showVoicePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showVoicePicker]);

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
      setShowUpgradeModal(false);
    },
  });

  const addToHistory = useCallback((newBriefings: Briefing[]) => {
    const entry: BriefingHistory = {
      id: generateId(),
      briefings: newBriefings,
      generatedAt: new Date().toISOString(),
      topicNames: newBriefings.map(b => b.topic),
    };
    setHistory(prev => [entry, ...prev].slice(0, 10));
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

      if (response.status === 429) {
        const data = await response.json();
        if (data.code === 'LIMIT_REACHED') {
          setShowUpgradeModal(true);
          setIsLoading(false);
          return;
        }
      }

      if (!response.ok) {
        throw new Error('Failed to generate briefing');
      }

      const data = await response.json();
      setBriefings(data.briefings);
      setLastGenerated(new Date());
      localStorage.setItem('briefing-cache', JSON.stringify(data.briefings));
      localStorage.setItem('briefing-time', new Date().toISOString());
      addToHistory(data.briefings);
      refreshSub();
    } catch (err) {
      console.error('Error generating briefing:', err);
      setError({ message: 'Failed to generate briefing. Please try again.', type: 'briefing' });
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
        body: JSON.stringify({ briefings, voice: settings.voice }),
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
      setError({ message: err instanceof Error ? err.message : 'Failed to generate audio', type: 'audio' });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const sendEmail = async (email: string) => {
    if (briefings.length === 0 || !email || isSendingEmail) return;

    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefings, email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send email');
      }

      setEmailSent(true);
      setShowEmailModal(false);
      setEmailInput('');
    } catch (err) {
      console.error('Email error:', err);
      setError({ message: err instanceof Error ? err.message : 'Failed to send email', type: 'email' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const exportBriefing = () => {
    if (briefings.length === 0) return;

    let markdown = '# Daily Briefing\n\n';
    markdown += `*Generated: ${lastGenerated?.toLocaleString()}*\n\n---\n\n`;

    for (const briefing of briefings) {
      markdown += `## ${briefing.topic}\n\n`;
      markdown += `${briefing.summary}\n\n`;

      if (briefing.articles.length > 0) {
        markdown += '### Sources\n\n';
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
    <AuthGuard>
      <main className="min-h-screen pb-20">
        <Header
          onSettingsClick={() => setShowSettings(true)}
          lastGenerated={lastGenerated}
          tier={tier}
        />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Your Daily News Brief
          </h1>
          <p className="text-[var(--muted)] max-w-xl mx-auto">
            Select topics, generate a personalized briefing, stay informed.
          </p>
        </div>

        {/* Free tier usage hint */}
        {isFree && usageCount > 0 && (
          <div className="text-center mb-4">
            <p className="text-xs text-[var(--muted)]">
              {usageCount}/{usageLimit} free briefings used today
              {!canGenerate && (
                <> &middot; <Link href="/pricing" className="text-[var(--accent)] hover:underline">Upgrade for unlimited</Link></>
              )}
            </p>
          </div>
        )}

        {/* Topic Selection */}
        <section className="mb-8">
          <TopicSelector
            topics={topics}
            onToggle={toggleTopic}
            onAdd={addCustomTopic}
            onRemove={removeTopic}
          />
        </section>

        {/* Actions */}
        <div className="flex justify-center gap-3 mb-6 flex-wrap">
          <GenerateButton
            onClick={generateBriefing}
            isLoading={isLoading}
            disabled={!topics.some(t => t.enabled)}
          />
          <Link
            href="/schedule"
            className="btn-secondary px-5 py-3 rounded-xl font-medium flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Schedule
          </Link>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-secondary px-5 py-3 rounded-xl font-medium flex items-center gap-2"
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Secondary Actions */}
        <div className="flex justify-center gap-3 mb-12 flex-wrap">
          {briefings.length > 0 && (
            <>
              <div className="relative" ref={voicePickerRef}>
                <button
                  onClick={() => {
                    if (isGeneratingAudio) return;
                    setShowVoicePicker(!showVoicePicker);
                  }}
                  disabled={isGeneratingAudio}
                  className="btn-secondary px-5 py-3 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingAudio ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Headphones className="w-4 h-4" />
                      Listen
                    </>
                  )}
                </button>

                {/* Voice Picker Popup */}
                {showVoicePicker && (
                  <div className="absolute top-full right-0 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto mt-2 z-50 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-[var(--border)]">
                      <p className="text-xs font-medium text-[var(--muted)]">Choose a voice</p>
                    </div>
                    <div className="py-1 max-h-72 overflow-y-auto">
                      {[
                        { id: 'alloy', name: 'Alloy', desc: 'Neutral & balanced' },
                        { id: 'ash', name: 'Ash', desc: 'Clear & direct' },
                        { id: 'ballad', name: 'Ballad', desc: 'Warm & melodic' },
                        { id: 'coral', name: 'Coral', desc: 'Warm & engaging' },
                        { id: 'echo', name: 'Echo', desc: 'Smooth & calm' },
                        { id: 'fable', name: 'Fable', desc: 'Expressive & British' },
                        { id: 'juniper', name: 'Juniper', desc: 'Lively & conversational' },
                        { id: 'nova', name: 'Nova', desc: 'Friendly & upbeat' },
                        { id: 'onyx', name: 'Onyx', desc: 'Deep & authoritative' },
                        { id: 'sage', name: 'Sage', desc: 'Soft & thoughtful' },
                        { id: 'shimmer', name: 'Shimmer', desc: 'Bright & cheerful' },
                        { id: 'verse', name: 'Verse', desc: 'Confident & polished' },
                      ].map((voice) => (
                        <button
                          key={voice.id}
                          onClick={() => {
                            const newSettings = { ...settings, voice: voice.id as Settings['voice'] };
                            setSettings(newSettings);
                            localStorage.setItem('briefing-settings', JSON.stringify(newSettings));
                            setShowVoicePicker(false);
                            generateAudio();
                          }}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--card-hover)] transition-colors ${
                            settings.voice === voice.id ? 'text-[var(--accent)] font-medium' : 'text-[var(--foreground)]'
                          }`}
                        >
                          <span className="block">{voice.name}</span>
                          <span className="text-[10px] text-[var(--muted)]">{voice.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={emailSent}
                className="btn-secondary px-5 py-3 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {emailSent ? (
                  <>
                    <Check className="w-4 h-4 text-[var(--success)]" />
                    Sent!
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Email
                  </>
                )}
              </button>
              <button
                onClick={exportBriefing}
                className="btn-secondary px-5 py-3 rounded-xl font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
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
            <div className="flex items-center gap-4 flex-wrap">
              <Headphones className="w-6 h-6 text-[var(--accent)]" />
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                className="flex-1 min-w-[200px] h-10"
                style={{ colorScheme: 'light' }}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--muted)] mr-1">Speed:</span>
                {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.playbackRate = speed;
                        setPlaybackSpeed(speed);
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      playbackSpeed === speed 
                        ? 'bg-[var(--accent)] text-white' 
                        : 'bg-[var(--card-hover)] hover:bg-[var(--accent)]/50'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
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
              <span>{error.message}</span>
              <button
                onClick={() => {
                  const errorType = error.type;
                  setError(null);
                  if (errorType === 'audio') {
                    generateAudio();
                  } else if (errorType === 'email') {
                    setShowEmailModal(true);
                  } else {
                    generateBriefing();
                  }
                }}
                className="ml-2 px-3 py-1 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => setError(null)}
                className="p-1 rounded hover:bg-red-500/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Briefings */}
        {briefings.length > 0 && (
          <section className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2 whitespace-nowrap">
                <Newspaper className="w-5 h-5 text-[var(--accent)]" />
                Your News Briefing
              </h2>
              <HistoryPanel
                history={history}
                onLoad={loadFromHistory}
                onDelete={deleteFromHistory}
                onClear={clearHistory}
              />
            </div>
            {briefings.map((briefing, index) => (
              <BriefingCard key={briefing.topic} briefing={briefing} index={index} />
            ))}
          </section>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Newspaper className="w-5 h-5" /> Generating Your Briefing
              </h2>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
            <p className="text-sm text-[var(--muted)] mb-4">Searching the web and analyzing the latest news...</p>
            {topics.filter(t => t.enabled).map((topic, index) => (
              <div
                key={topic.id}
                className="bg-[var(--card)] rounded-2xl p-6 border border-[var(--border)] overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[var(--card-hover)] flex items-center justify-center">
                    <Newspaper className="w-5 h-5 text-[var(--muted)]" />
                  </div>
                  <div>
                    <div className="h-6 w-32 bg-[var(--border)] rounded animate-shimmer mb-2" />
                    <div className="h-3 w-24 bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: '100ms' }} />
                  </div>
                </div>
                <div className="space-y-2 mb-6">
                  <div className="h-4 w-full bg-[var(--border)] rounded animate-shimmer" />
                  <div className="h-4 w-5/6 bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: '50ms' }} />
                  <div className="h-4 w-4/6 bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: '100ms' }} />
                </div>
                <div className="flex gap-4 overflow-hidden">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="min-w-[320px] flex-shrink-0 bg-gradient-to-br from-[var(--card)] to-[var(--card-hover)] rounded-xl border border-[var(--border)] p-5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="h-5 w-8 bg-[var(--border)] rounded animate-shimmer" />
                        <div className="h-5 w-24 bg-[var(--border)] rounded animate-shimmer" />
                      </div>
                      <div className="h-5 w-full bg-[var(--border)] rounded animate-shimmer mb-4" />
                      <div className="space-y-2.5">
                        {[0, 1, 2].map((j) => (
                          <div key={j} className="flex items-start gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--border)] mt-1.5" />
                            <div className="h-4 flex-1 bg-[var(--border)] rounded animate-shimmer" style={{ animationDelay: `${j * 50}ms` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && briefings.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--card)] flex items-center justify-center">
              <Newspaper className="w-10 h-10 text-[var(--muted)]" />
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

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        usageCount={usageCount}
        usageLimit={usageLimit}
      />

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] rounded-2xl p-6 w-full max-w-md border border-[var(--border)]">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5" /> Email Briefing
            </h2>
            <p className="text-[var(--muted)] text-sm mb-4">
              Enter your email to receive this briefing in your inbox.
            </p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailInput.includes('@')) {
                  sendEmail(emailInput);
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailInput('');
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--card-hover)] hover:bg-[var(--border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => sendEmail(emailInput)}
                disabled={!emailInput.includes('@') || isSendingEmail}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--accent)] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Keyboard Shortcuts */}
        <KeyboardHints />
      </main>
    </AuthGuard>
  );
}
