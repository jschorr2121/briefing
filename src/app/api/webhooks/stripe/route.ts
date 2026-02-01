import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import {
  getUserSubscription,
  saveUserSubscription,
  getEmailByCustomerId,
} from '@/lib/subscription';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const email = session.customer_details?.email || session.metadata?.email;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (email) {
          const sub = await getUserSubscription(email);
          sub.tier = 'pro';
          sub.stripeCustomerId = customerId;
          sub.stripeSubscriptionId = subscriptionId;
          sub.subscriptionStatus = 'active';
          await saveUserSubscription(sub);
          console.log(`✅ Pro subscription activated for ${email}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const email = await getEmailByCustomerId(customerId);

        if (email) {
          const sub = await getUserSubscription(email);
          sub.subscriptionStatus = subscription.status;
          sub.currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          if (subscription.status === 'active') {
            sub.tier = 'pro';
          } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            sub.tier = 'free';
          }

          await saveUserSubscription(sub);
          console.log(`📝 Subscription updated for ${email}: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const email = await getEmailByCustomerId(customerId);

        if (email) {
          const sub = await getUserSubscription(email);
          sub.tier = 'free';
          sub.subscriptionStatus = 'canceled';
          sub.stripeSubscriptionId = undefined;
          await saveUserSubscription(sub);
          console.log(`❌ Subscription canceled for ${email}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        const email = await getEmailByCustomerId(customerId);

        if (email) {
          const sub = await getUserSubscription(email);
          sub.subscriptionStatus = 'past_due';
          await saveUserSubscription(sub);
          console.log(`⚠️ Payment failed for ${email}`);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
