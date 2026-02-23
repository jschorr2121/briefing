'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface SubscriptionData {
  tier: 'free' | 'pro';
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  topicLimit: number | null; // null = unlimited
  usage: {
    used: number;
    limit: number | null; // null = unlimited
    allowed: boolean;
  };
}

export function useSubscription() {
  const { data: session, status } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/subscription');
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isPro = subscription?.tier === 'pro' && subscription?.subscriptionStatus === 'active';
  const isFree = !isPro;
  const canGenerate = subscription?.usage?.allowed ?? true;
  const usageCount = subscription?.usage?.used ?? 0;
  const usageLimit = subscription?.usage?.limit ?? 3;
  // topicLimit: null = unlimited (admin), number = limit, default 4 before subscription loads
  const topicLimit = subscription ? subscription.topicLimit : 4;

  return {
    subscription,
    loading,
    isPro,
    isFree,
    canGenerate,
    usageCount,
    usageLimit,
    topicLimit,
    refresh,
  };
}
