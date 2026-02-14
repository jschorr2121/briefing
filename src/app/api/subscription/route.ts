import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getUserSubscription, getUsageStatus } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sub = await getUserSubscription(user.email);
    const usage = await getUsageStatus(user.email);

    return NextResponse.json({
      tier: sub.tier,
      subscriptionStatus: sub.subscriptionStatus || null,
      currentPeriodEnd: sub.currentPeriodEnd || null,
      hasStripeCustomer: !!sub.stripeCustomerId,
      usage: {
        used: usage.used,
        limit: usage.limit === Infinity ? null : usage.limit,
        allowed: usage.allowed,
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  }
}
