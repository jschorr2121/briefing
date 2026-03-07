import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getStripe } from '@/lib/stripe';
import { getUserSubscription, saveUserSubscription } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const { priceId } = await request.json();
    if (!priceId) {
      return NextResponse.json({ error: 'Price ID required' }, { status: 400 });
    }

    const email = user.email;
    const sub = await getUserSubscription(email);

    // Reuse existing Stripe customer or create new one
    let customerId = sub.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: user.name || undefined,
        metadata: { source: 'briefing-app' },
      });
      customerId = customer.id;
      sub.stripeCustomerId = customerId;
      await saveUserSubscription(sub);
    }

    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || 'https://briefing-app.vercel.app';

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      subscription_data: {
        metadata: { email },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
