import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getUserSubscription, getUsageStatus } from '@/lib/subscription';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sub = await getUserSubscription(session.user.email);
    const usage = await getUsageStatus(session.user.email);

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
