'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Crown,
  CreditCard,
  Loader2,
  Zap,
  BarChart3,
  Calendar,
  ExternalLink,
  Check,
  Newspaper,
} from 'lucide-react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { useSubscription } from '@/hooks/useSubscription';

function AccountContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const {
    subscription,
    loading,
    isPro,
    isFree,
    usageCount,
    usageLimit,
    refresh,
  } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Show success banner if redirected from checkout
  useEffect(() => {
    if (success === 'true') {
      setShowSuccess(true);
      refresh(); // Refresh subscription data
      const timer = setTimeout(() => setShowSuccess(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [success, refresh]);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/create-portal', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No portal URL:', data);
      }
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setPortalLoading(false);
    }
  };

  const usagePercent = usageLimit ? Math.min((usageCount / usageLimit) * 100, 100) : 0;

  return (
    <AuthGuard>
      <main className="min-h-screen pb-20">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-[var(--accent)]" />
              <h1 className="font-semibold text-lg">Account</h1>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          {/* Success Banner */}
          {showSuccess && (
            <div className="bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
              <div className="w-8 h-8 rounded-full bg-[var(--success)]/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-[var(--success)]" />
              </div>
              <div>
                <p className="font-medium text-[var(--success)]">Welcome to Pro! 🎉</p>
                <p className="text-sm text-[var(--muted)]">
                  Your subscription is now active. Enjoy unlimited briefings!
                </p>
              </div>
            </div>
          )}

          {/* Profile Card */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
            <div className="flex items-center gap-4">
              {session?.user?.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-14 h-14 rounded-full"
                />
              )}
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{session?.user?.name}</h2>
                <p className="text-sm text-[var(--muted)]">{session?.user?.email}</p>
              </div>
              <div
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  isPro
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30'
                    : 'bg-[var(--card-hover)] text-[var(--muted)] border border-[var(--border)]'
                }`}
              >
                {isPro ? (
                  <span className="flex items-center gap-1">
                    <Crown className="w-3 h-3" /> PRO
                  </span>
                ) : (
                  'FREE'
                )}
              </div>
            </div>
          </div>

          {/* Usage Card */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-semibold">Today&apos;s Usage</h3>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold">{usageCount}</span>
                  <span className="text-[var(--muted)]">
                    briefings generated today
                  </span>
                </div>

                <p className="text-sm text-[var(--muted)]">
                  Unlimited briefings — generate as many as you need.
                </p>
              </>
            )}
          </div>

          {/* Plan Card */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-semibold">Subscription</h3>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : isPro ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Briefing Pro</p>
                    <p className="text-sm text-[var(--muted)]">
                      Status: <span className="text-[var(--success)]">Active</span>
                    </p>
                  </div>
                  <Crown className="w-6 h-6 text-[var(--accent)]" />
                </div>

                {subscription?.currentPeriodEnd && (
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Renews{' '}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}

                {subscription?.hasStripeCustomer && (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="w-full py-3 rounded-xl bg-[var(--card-hover)] hover:bg-[var(--border)] transition-all font-medium text-sm flex items-center justify-center gap-2"
                  >
                    {portalLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Opening portal...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        Manage Billing
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[var(--muted)] text-sm">
                  You&apos;re on the free plan. Upgrade to unlock unlimited briefings, audio
                  playback, and more.
                </p>
                <Link
                  href="/pricing"
                  className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Upgrade to Pro
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}
