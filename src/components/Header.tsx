'use client';

import { useSession, signOut } from 'next-auth/react';
import { Newspaper, Settings, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from '@/lib/utils';
import { TierBadge } from '@/components/TierBadge';

interface HeaderProps {
  onSettingsClick: () => void;
  lastGenerated: Date | null;
  tier?: 'free' | 'pro';
}

export function Header({ onSettingsClick, lastGenerated, tier }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg">Briefing</h1>
              {tier && <TierBadge tier={tier} compact />}
            </div>
            {lastGenerated && (
              <p className="text-xs text-[var(--muted)]">
                Updated {formatDistanceToNow(lastGenerated)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session?.user && (
            <div className="flex items-center gap-2">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm text-[var(--muted)] hidden sm:inline">
                {session.user.name?.split(' ')[0]}
              </span>
            </div>
          )}

          <Link
            href="/account"
            className="p-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--card)] transition-all"
            aria-label="Account"
          >
            <User className="w-4 h-4 text-[var(--muted)]" />
          </Link>
          
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--card)] transition-all"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-[var(--muted)]" />
          </button>

          {session && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 rounded-lg border border-[var(--border)] hover:border-[var(--danger)] hover:bg-red-50 transition-all"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 text-[var(--muted)]" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
