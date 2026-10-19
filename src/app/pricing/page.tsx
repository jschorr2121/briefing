'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Check,
  Zap,
  Newspaper,
  Headphones,
  Mail,
  Sparkles,
  ArrowLeft,
  Loader2,
  Crown,
} from 'lucide-react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { useSubscription } from '@/hooks/useSubscription';

interface StripePrices {
  configured: boolean;
  monthlyPriceId?: string;
  annualPriceId?: string;
}

export default function PricingPage() {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [prices, setPrices] = useState<StripePrices | null>(null);
  const { isPro, loading: subLoading } = useSubscription();
  const { data: session } = useSession();
  const router = useRouter();

  // Fetch price IDs from server
  useEffect(() => {
    fetch('/api/stripe/prices')
      .then(res => res.json())
      .then(setPrices)
      .catch(() => setPrices({ configured: false }));
  }, []);

  const handleCheckout = async () => {
    if (!prices?.configured) return;

    const priceId = prices.monthlyPriceId;

    if (!priceId) {
      console.error('No price ID available');
      return;
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No checkout URL returned:', data);
        setCheckoutLoading(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutLoading(false);
    }
  };

  const freeFeatures = [
    '3 briefings per day',
    'Up to 4 topics per briefing',
    'Audio playback (9 voices)',
    'Email delivery & scheduled daily email',
    'Export & share',
    'Briefing history',
  ];

  const proFeatures = [
    'Everything in Free',
    'Unlimited briefings per day',
  ];

  const stripeReady = prices?.configured && (
    prices.monthlyPriceId
  );

  return (
    <AuthGuard>
      <main className="min-h-screen pb-20">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--background)]/90 border-b border-[var(--border)]">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-[var(--accent)]" />
              <h1 className="font-semibold text-lg">Pricing</h1>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-12">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Pro coming soon
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Stay informed, without limits
            </h2>
            <p className="text-[var(--muted)] max-w-xl mx-auto text-lg">
              Pro will remove the daily briefing limit. It isn&apos;t available to purchase yet.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free Tier */}
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-8 flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-1">Free</h3>
                <p className="text-[var(--muted)] text-sm">For casual news readers</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-[var(--muted)]">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-[var(--muted)] mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isPro ? (
                <div className="w-full py-3 rounded-xl bg-[var(--card-hover)] text-center text-sm text-[var(--muted)] font-medium">
                  Previous plan
                </div>
              ) : (
                <div className="w-full py-3 rounded-xl bg-[var(--card-hover)] text-center text-sm text-[var(--muted)] font-medium">
                  Current plan
                </div>
              )}
            </div>

            {/* Pro Tier */}
            <div className="bg-[var(--card)] rounded-2xl border-2 border-[var(--accent)] p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[var(--accent)] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                COMING SOON
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-1 flex items-center gap-2">
                  Pro <Crown className="w-5 h-5 text-[var(--accent)]" />
                </h3>
                <p className="text-[var(--muted)] text-sm">For power users who want it all</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    $6.99
                  </span>
                  <span className="text-[var(--muted)]">/month</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {proFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isPro ? (
                <div className="w-full py-3 rounded-xl bg-[var(--accent)]/20 text-center text-sm text-[var(--accent)] font-semibold">
                  ✓ Current plan
                </div>
              ) : stripeReady ? (
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || subLoading}
                  className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Opening checkout...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Upgrade to Pro
                    </>
                  )}
                </button>
              ) : (
                <div aria-disabled="true" className="w-full py-3 rounded-xl bg-[var(--card-hover)] text-center text-sm text-[var(--muted)] font-medium">
                  Coming soon
                </div>
              )}
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto mt-16">
            <h3 className="text-xl font-semibold text-center mb-8">Frequently Asked Questions</h3>
            <div className="space-y-4">
              {[
                {
                  q: 'When will Pro be available?',
                  a: 'Pro isn\'t purchasable yet. Everything else in Free works today, and the only planned difference is no daily briefing limit.',
                },
                {
                  q: 'What happens when I hit the free limit?',
                  a: 'You\'ll see a prompt explaining the limit, which resets at midnight UTC. Your existing briefings are always accessible — you just can\'t generate new ones until the next day.',
                },
              ].map(({ q, a }) => (
                <div key={q} className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
                  <h4 className="font-medium mb-2">{q}</h4>
                  <p className="text-sm text-[var(--muted)]">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
