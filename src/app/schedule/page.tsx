'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Clock, Mail, Trash2, Edit2, Check, Loader2, Info } from 'lucide-react';
import Link from 'next/link';

interface ScheduledBrief {
  id: string;
  email: string;
  topics: string[];
  frequency: 'daily';
  time: string;
  timezone: string;
  enabled: boolean;
  lastSentAt?: string;
  createdAt: string;
}

const SUGGESTED_TOPICS = [
  'AI & Tech', 'Finance', 'World News', 'Sports', 'Science', 
  'Startups', 'Crypto', 'Climate', 'Politics', 'Entertainment'
];

export default function SchedulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [schedules, setSchedules] = useState<ScheduledBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email);
      fetchSchedules();
    }
  }, [session]);

  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = (topic: string) => {
    const trimmed = topic.trim();
    if (trimmed && !topics.includes(trimmed) && topics.length < 4) {
      setTopics([...topics, trimmed]);
    }
    setTopicInput('');
  };

  const handleRemoveTopic = (topic: string) => {
    setTopics(topics.filter(t => t !== topic));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || topics.length === 0) return;

    setSaving(true);
    try {
      const body = {
        id: editingId,
        email,
        topics,
        frequency: 'daily',
        time: '08:00',
        timezone: 'America/New_York',
      };

      const res = await fetch('/api/schedules', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchSchedules();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (schedule: ScheduledBrief) => {
    setEditingId(schedule.id);
    setEmail(schedule.email);
    setTopics(schedule.topics);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scheduled brief?')) return;

    try {
      const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSchedules(schedules.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const toggleEnabled = async (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return;

    try {
      const res = await fetch('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !schedule.enabled }),
      });

      if (res.ok) {
        setSchedules(schedules.map(s => 
          s.id === id ? { ...s, enabled: !s.enabled } : s
        ));
      }
    } catch (error) {
      console.error('Error toggling schedule:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTopics([]);
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const availableSuggestions = SUGGESTED_TOPICS.filter(s => !topics.includes(s));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold text-lg">Scheduled Briefs</h1>
            <p className="text-sm text-[var(--muted)]">Get automated briefings in your inbox</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Daily briefings at 8:00 AM ET</p>
            <p className="text-blue-600 mt-0.5">All scheduled briefings are sent every morning. Choose your topics below.</p>
          </div>
        </div>

        {/* Add New Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full mb-6 p-4 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--card)] transition-all flex items-center justify-center gap-2 text-[var(--muted)] hover:text-[var(--accent)]"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Create Daily Brief</span>
          </button>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-6 bg-[var(--card)] border border-[var(--border)] rounded-xl">
            <h2 className="font-semibold mb-1">{editingId ? 'Edit' : 'New'} Daily Brief</h2>
            <p className="text-sm text-[var(--muted)] mb-4">You'll receive this briefing every day at 8:00 AM ET</p>
            
            {/* Email */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Topics */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Topics <span className="text-[var(--muted)] font-normal">({topics.length}/4 max)</span></label>
              <div className="relative mb-2">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTopic(topicInput);
                    }
                  }}
                  placeholder="Type a topic and press Enter..."
                  className="input pr-12"
                />
                <button
                  type="button"
                  onClick={() => handleAddTopic(topicInput)}
                  disabled={!topicInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-[var(--accent)] text-white disabled:opacity-30"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {/* Selected topics */}
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {topics.map(topic => (
                    <span key={topic} className="flex items-center gap-1 px-2.5 py-1 bg-[var(--accent)] text-white rounded-full text-sm">
                      {topic}
                      <button type="button" onClick={() => handleRemoveTopic(topic)} className="hover:bg-white/20 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {availableSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {availableSuggestions.slice(0, 6).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAddTopic(s)}
                      className="text-xs px-2 py-1 rounded-full border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
              <button type="button" onClick={resetForm} className="btn-secondary flex-1">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={!email || topics.length === 0 || saving}
                className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Save Changes' : 'Create Daily Brief'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Schedules */}
        {schedules.length > 0 ? (
          <div className="space-y-4">
            <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">Your Daily Briefs</h2>
            {schedules.map(schedule => (
              <div 
                key={schedule.id} 
                className={`p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl ${!schedule.enabled ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="w-4 h-4 text-[var(--muted)]" />
                      <span className="font-medium">{schedule.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Every day at 8:00 AM ET</span>
                    </div>
                    {schedule.lastSentAt && (
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Last sent: {new Date(schedule.lastSentAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleEnabled(schedule.id)}
                      className={`p-2 rounded-lg transition-colors ${schedule.enabled ? 'bg-[var(--success)] text-white' : 'bg-[var(--card-hover)] text-[var(--muted)]'}`}
                      title={schedule.enabled ? 'Enabled' : 'Disabled'}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(schedule)}
                      className="p-2 rounded-lg hover:bg-[var(--card-hover)] text-[var(--muted)] hover:text-[var(--accent)]"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-[var(--muted)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {schedule.topics.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded text-xs font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !showForm && (
          <div className="text-center py-12 text-[var(--muted)]">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No daily briefs yet</p>
            <p className="text-sm">Create one to get briefings in your inbox every morning at 8 AM ET</p>
          </div>
        )}
      </main>
    </div>
  );
}
