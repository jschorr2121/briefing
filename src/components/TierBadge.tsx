'use client';

import { Crown } from 'lucide-react';
import Link from 'next/link';

interface TierBadgeProps {
  tier: 'free' | 'pro';
  compact?: boolean;
}

export function TierBadge({ tier, compact = false }: TierBadgeProps) {
  if (tier === 'pro') {
    return (
      <Link
        href="/account"
        className={`inline-flex items-center gap-1 rounded-full font-bold transition-all hover:opacity-80 ${
          compact
            ? 'px-2 py-0.5 text-[10px]'
            : 'px-2.5 py-1 text-xs'
        } bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30`}
      >
        <Crown className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        PRO
      </Link>
    );
  }

  return (
    <Link
      href="/pricing"
      className={`inline-flex items-center gap-1 rounded-full font-bold transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] ${
        compact
          ? 'px-2 py-0.5 text-[10px]'
          : 'px-2.5 py-1 text-xs'
      } bg-[var(--card-hover)] text-[var(--muted)] border border-[var(--border)]`}
    >
      FREE
    </Link>
  );
}
