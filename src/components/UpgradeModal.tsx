'use client';

import { X, Zap, Crown, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  usageCount: number;
  usageLimit: number;
}

export function UpgradeModal({ isOpen, onClose, usageCount, usageLimit }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] rounded-2xl p-8 w-full max-w-md border border-[var(--border)] animate-fadeIn relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
        >
          <X className="w-4 h-4 text-[var(--muted)]" />
        </button>

        <div className="text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Crown className="w-8 h-8 text-[var(--accent)]" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold mb-2">Daily Limit Reached</h2>
          <p className="text-[var(--muted)] text-sm mb-6">
            You&apos;ve used all {usageLimit} of your free briefings today. Upgrade to Pro
            for unlimited access.
          </p>

          {/* Usage indicator */}
          <div className="bg-[var(--background)] rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--muted)]">Today&apos;s usage</span>
              <span className="text-sm font-medium">
                {usageCount}/{usageLimit}
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--card-hover)] rounded-full overflow-hidden">
              <div className="h-full w-full bg-[var(--danger)] rounded-full" />
            </div>
            <p className="text-xs text-[var(--muted)] mt-2">
              Resets at midnight UTC
            </p>
          </div>

          {/* Benefits */}
          <div className="text-left space-y-2 mb-6">
            {[
              'Unlimited briefings',
              'Unlimited topics',
              'Audio TTS playback',
              'Priority support',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-sm">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Link
              href="/pricing"
              className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              View Plans — From $4.17/mo
            </Link>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm text-[var(--muted)] hover:bg-[var(--card-hover)] transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
