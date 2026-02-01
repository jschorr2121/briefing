import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
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
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // No webhook secret configured — parse raw (dev mode)
      event = JSON.parse(body) as Stripe.Event;
      console.warn('⚠️ Stripe webhook secret not configured, skipping signature verification');
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.customer) {
          const customerId = typeof session.customer === 'string'
            ? session.customer
            : session.customer.id;
          const email =
            session.metadata?.email ||
            session.customer_email ||
            (await getEmailByCustomerId(customerId));

          if (email) {
            const sub = await getUserSubscription(email);
            sub.tier = 'pro';
            sub.stripeCustomerId = customerId;
            sub.stripeSubscriptionId =
              typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id;
            sub.subscriptionStatus = 'active';
            await saveUserSubscription(sub);
            console.log(`✅ Activated pro for ${email}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
        const email = await getEmailByCustomerId(customerId);

        if (email) {
          const sub = await getUserSubscription(email);
          sub.stripeSubscriptionId = subscription.id;
          sub.subscriptionStatus = subscription.status as 'active' | 'past_due' | 'canceled' | 'trialing';
          sub.currentPeriodEnd = new Date((subscription as any).current_period_end * 1000).toISOString();

          // Downgrade if canceled or past due
          if (['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status)) {
            sub.tier = 'free';
          } else {
            sub.tier = 'pro';
          }

          await saveUserSubscription(sub);
          console.log(`📝 Updated subscription for ${email}: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
        const email = await getEmailByCustomerId(customerId);

        if (email) {
          const sub = await getUserSubscription(email);
          sub.tier = 'free';
          sub.subscriptionStatus = 'canceled';
          sub.stripeSubscriptionId = undefined;
          await saveUserSubscription(sub);
          console.log(`❌ Canceled subscription for ${email}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id;

        if (customerId) {
          const email = await getEmailByCustomerId(customerId);
          if (email) {
            const sub = await getUserSubscription(email);
            sub.subscriptionStatus = 'past_due';
            await saveUserSubscription(sub);
            console.log(`⚠️ Payment failed for ${email}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
