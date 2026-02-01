import { Redis } from '@upstash/redis';

// ─── Types ────────────────────────────────────────────────────────────
export interface UserSubscription {
  email: string;
  tier: 'free' | 'pro';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriodEnd?: string;
  briefingsToday: number;
  briefingsResetAt: string; // ISO date string (YYYY-MM-DD)
}

export const FREE_DAILY_LIMIT = 3;
export const FREE_TOPIC_LIMIT = 2;

// ─── Redis helpers ────────────────────────────────────────────────────
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function subKey(email: string) {
  return `subscription:${email.toLowerCase()}`;
}

function customerKey(customerId: string) {
  return `stripe_customer:${customerId}`;
}

// ─── Today string (UTC) ──────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Get subscription (returns default free if not found) ─────────────
export async function getUserSubscription(email: string): Promise<UserSubscription> {
  const redis = getRedis();
  const defaultSub: UserSubscription = {
    email: email.toLowerCase(),
    tier: 'free',
    briefingsToday: 0,
    briefingsResetAt: todayStr(),
  };

  if (!redis) return defaultSub;

  try {
    const data = await redis.get<UserSubscription>(subKey(email));
    if (!data) return defaultSub;

    // Reset daily counter if it's a new day
    if (data.briefingsResetAt !== todayStr()) {
      data.briefingsToday = 0;
      data.briefingsResetAt = todayStr();
      await redis.set(subKey(email), data);
    }

    return data;
  } catch (err) {
    console.error('Error fetching subscription:', err);
    return defaultSub;
  }
}

// ─── Save subscription ───────────────────────────────────────────────
export async function saveUserSubscription(sub: UserSubscription): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(subKey(sub.email), sub);
    // Also store reverse lookup for Stripe webhooks
    if (sub.stripeCustomerId) {
      await redis.set(customerKey(sub.stripeCustomerId), sub.email.toLowerCase());
    }
  } catch (err) {
    console.error('Error saving subscription:', err);
  }
}

// ─── Get email by Stripe customer ID ─────────────────────────────────
export async function getEmailByCustomerId(customerId: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get<string>(customerKey(customerId));
  } catch (err) {
    console.error('Error looking up customer:', err);
    return null;
  }
}

// ─── Increment usage & check limit ──────────────────────────────────
export interface UsageCheck {
  allowed: boolean;
  used: number;
  limit: number;
  tier: 'free' | 'pro';
}

export async function checkAndIncrementUsage(email: string): Promise<UsageCheck> {
  const sub = await getUserSubscription(email);

  // Pro users: unlimited
  if (sub.tier === 'pro' && sub.subscriptionStatus === 'active') {
    sub.briefingsToday += 1;
    await saveUserSubscription(sub);
    return { allowed: true, used: sub.briefingsToday, limit: Infinity, tier: 'pro' };
  }

  // Free users: check limit
  if (sub.briefingsToday >= FREE_DAILY_LIMIT) {
    return { allowed: false, used: sub.briefingsToday, limit: FREE_DAILY_LIMIT, tier: 'free' };
  }

  sub.briefingsToday += 1;
  await saveUserSubscription(sub);
  return { allowed: true, used: sub.briefingsToday, limit: FREE_DAILY_LIMIT, tier: 'free' };
}

// ─── Check usage without incrementing ────────────────────────────────
export async function getUsageStatus(email: string): Promise<UsageCheck> {
  const sub = await getUserSubscription(email);

  if (sub.tier === 'pro' && sub.subscriptionStatus === 'active') {
    return { allowed: true, used: sub.briefingsToday, limit: Infinity, tier: 'pro' };
  }

  return {
    allowed: sub.briefingsToday < FREE_DAILY_LIMIT,
    used: sub.briefingsToday,
    limit: FREE_DAILY_LIMIT,
    tier: 'free',
  };
}
