'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Clock, Mail, Trash2, Edit2, Check } from 'lucide-react';
import Link from 'next/link';

interface ScheduledBrief {
  id: string;
  email: string;
  topics: string[];
  frequency: 'daily' | 'weekdays' | 'weekly';
  time: string;
  timezone: string;
  enabled: boolean;
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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekly'>('daily');
  const [time, setTime] = useState('08:00');
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('briefing-schedules');
    if (saved) {
      setSchedules(JSON.parse(saved));
    }
    // Pre-fill email from session
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [session]);

  const saveSchedules = (newSchedules: ScheduledBrief[]) => {
    setSchedules(newSchedules);
    localStorage.setItem('briefing-schedules', JSON.stringify(newSchedules));
  };

  const handleAddTopic = (topic: string) => {
    const trimmed = topic.trim();
    if (trimmed && !topics.includes(trimmed)) {
      setTopics([...topics, trimmed]);
    }
    setTopicInput('');
  };

  const handleRemoveTopic = (topic: string) => {
    setTopics(topics.filter(t => t !== topic));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || topics.length === 0) return;

    const schedule: ScheduledBrief = {
      id: editingId || `schedule-${Date.now()}`,
      email,
      topics,
      frequency,
      time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      enabled: true,
      createdAt: editingId ? schedules.find(s => s.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    let newSchedules: ScheduledBrief[];
    if (editingId) {
      newSchedules = schedules.map(s => s.id === editingId ? schedule : s);
    } else {
      newSchedules = [...schedules, schedule];
    }
    
    saveSchedules(newSchedules);
    resetForm();
  };

  const handleEdit = (schedule: ScheduledBrief) => {
    setEditingId(schedule.id);
    setEmail(schedule.email);
    setTopics(schedule.topics);
    setFrequency(schedule.frequency);
    setTime(schedule.time);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this scheduled brief?')) {
      saveSchedules(schedules.filter(s => s.id !== id));
    }
  };

  const toggleEnabled = (id: string) => {
    saveSchedules(schedules.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTopics([]);
    setFrequency('daily');
    setTime('08:00');
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
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
            <p className="text-sm text-[var(--muted)]">Manage your automated email briefings</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Add New Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full mb-6 p-4 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--card)] transition-all flex items-center justify-center gap-2 text-[var(--muted)] hover:text-[var(--accent)]"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Create Scheduled Brief</span>
          </button>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-6 bg-[var(--card)] border border-[var(--border)] rounded-xl">
            <h2 className="font-semibold mb-4">{editingId ? 'Edit' : 'New'} Scheduled Brief</h2>
            
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
              <label className="block text-sm font-medium mb-1.5">Topics</label>
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

            {/* Frequency & Time */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="input"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly (Monday)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
              <button type="button" onClick={resetForm} className="btn-secondary flex-1">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={!email || topics.length === 0}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {editingId ? 'Save Changes' : 'Create Schedule'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Schedules */}
        {schedules.length > 0 ? (
          <div className="space-y-4">
            <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wide">Your Schedules</h2>
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
                      <span>
                        {schedule.frequency === 'daily' ? 'Every day' : 
                         schedule.frequency === 'weekdays' ? 'Weekdays' : 'Weekly'} at {schedule.time}
                      </span>
                    </div>
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
            <p>No scheduled briefs yet</p>
            <p className="text-sm">Create one to get automated briefings in your inbox</p>
          </div>
        )}
      </main>
    </div>
  );
}
