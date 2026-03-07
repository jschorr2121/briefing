'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Newspaper, Clock, ExternalLink, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface StoryCard {
  headline: string;
  bullets: string[];
  source?: string;
  url?: string;
  date?: string;
}

interface Article {
  title: string;
  source: string;
  url: string;
  snippet?: string;
}

interface SharedBriefing {
  topic: string;
  emoji: string;
  summary: string;
  stories: StoryCard[];
  articles: Article[];
  generatedAt: string;
}

interface SharedData {
  id: string;
  briefings: SharedBriefing[];
  topicNames: string[];
  generatedAt: string;
  sharedAt: string;
}

export default function SharedBriefingPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/share?id=${id}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'This briefing has expired or doesn\'t exist.' : 'Failed to load briefing.');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading briefing...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Newspaper className="w-12 h-12 text-[var(--muted)] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Briefing Not Found</h1>
          <p className="text-[var(--muted)] mb-6">{error || 'This briefing may have expired or the link is invalid.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Create Your Own Briefing
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const generatedTime = new Date(data.generatedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Newspaper className="w-5 h-5 text-[var(--accent)]" />
            <span className="font-bold text-[var(--foreground)]">Briefing</span>
          </Link>
          <Link
            href="/"
            className="text-sm bg-[var(--accent)] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get Your Own
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Meta */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
            <Clock className="w-4 h-4" />
            <span>{generatedDate} at {generatedTime}</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
            {data.topicNames.join(' · ')}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Shared briefing · {data.briefings.reduce((acc, b) => acc + (b.stories?.length || 0), 0)} stories
          </p>
        </div>

        {/* Briefing sections */}
        <div className="space-y-8">
          {data.briefings.map((briefing, bi) => (
            <section key={bi} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
              <h2 className="text-lg font-bold text-[var(--foreground)] mb-2 flex items-center gap-2">
                {briefing.emoji && <span>{briefing.emoji}</span>}
                {briefing.topic}
              </h2>
              <p className="text-sm text-[var(--muted)] mb-5 leading-relaxed">{briefing.summary}</p>

              <div className="space-y-4">
                {(briefing.stories || []).map((story, si) => (
                  <div
                    key={si}
                    className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-[var(--foreground)] text-[15px] leading-tight">
                        {story.headline}
                      </h3>
                      <span className="text-xs font-bold text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded shrink-0">
                        #{si + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-3 text-xs text-[var(--muted)]">
                      {story.source && <span>{story.source}</span>}
                      {story.date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {story.date}
                        </span>
                      )}
                    </div>

                    <ul className="space-y-2 mb-3">
                      {story.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--muted)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>

                    {story.url && (
                      <a
                        href={story.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                      >
                        Read full article <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Source articles */}
              {briefing.articles && briefing.articles.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--muted)] mb-2">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {briefing.articles.map((article, ai) => (
                      <a
                        key={ai}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--muted)] hover:text-[var(--accent)] bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors"
                      >
                        {article.source}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center bg-[var(--card)] rounded-xl border border-[var(--border)] p-8">
          <Newspaper className="w-8 h-8 text-[var(--accent)] mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-2">
            Want your own personalized news briefing?
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4 max-w-md mx-auto">
            Choose your topics, get AI-generated briefings with the latest news, listen on the go, and get daily email digests.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Try Briefing Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-12 py-6 text-center text-xs text-[var(--muted)]">
        <p>Powered by <Link href="/" className="text-[var(--accent)] hover:underline">Briefing</Link> — AI-powered news, personalized for you.</p>
      </footer>
    </div>
  );
}
