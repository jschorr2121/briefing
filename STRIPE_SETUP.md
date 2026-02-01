# Stripe Setup Guide for Briefing Pro

## 1. Create a Stripe Account

1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete identity verification
3. Switch between **Test mode** and **Live mode** using the toggle in the dashboard

> 💡 Use Test mode first to verify everything works before going live.

## 2. Create Products & Prices

### In the Stripe Dashboard:

1. Go to **Products** → **+ Add product**
2. Create a product called **"Briefing Pro"**
3. Add two prices:

| Plan | Amount | Billing | Suggested Price ID label |
|------|--------|---------|--------------------------|
| Monthly | $6.99/month | Recurring, Monthly | `pro-monthly` |
| Annual | $49.99/year | Recurring, Yearly | `pro-annual` |

4. After creating, copy the **Price IDs** (they look like `price_1Abc123...`)

## 3. Get API Keys

1. Go to **Developers** → **API keys**
2. Copy:
   - **Publishable key** (starts with `pk_test_` or `pk_live_`)
   - **Secret key** (starts with `sk_test_` or `sk_live_`)

## 4. Set Up Webhook

1. Go to **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Set the URL to: `https://YOUR_DOMAIN/api/webhooks/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

## 5. Configure Customer Portal

1. Go to **Settings** → **Billing** → **Customer portal**
2. Enable:
   - ✅ Customers can update payment methods
   - ✅ Customers can switch plans
   - ✅ Customers can cancel subscriptions
3. Under "Cancellations":
   - Set cancellation to cancel at end of billing period
4. Save changes

## 6. Add Environment Variables to Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add:

| Variable | Value | Example |
|----------|-------|---------|
| `STRIPE_SECRET_KEY` | Your Stripe secret key | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Your Stripe publishable key | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_...` |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Monthly price ID | `price_1Abc...` |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Annual price ID | `price_1Def...` |

> ⚠️ Make sure to add these for the **Production** environment (and optionally Preview/Development).

## 7. Redeploy

After adding env vars, trigger a redeploy:
```bash
curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_dDB96HruN79Qm1VQzc1aulyhz0Vz/vIAVZAlqNx"
```

Or redeploy from the Vercel dashboard.

## 8. Test the Flow

1. Go to `/pricing` on your live site
2. Click "Upgrade to Pro"
3. Use Stripe test card: `4242 4242 4242 4242` (any future date, any CVC)
4. Verify redirect to `/account?success=true`
5. Check that the tier badge updates to "PRO"
6. Try the Customer Portal from `/account` → "Manage Billing"

## How It Works

- **Free tier**: 3 briefing generations per day, 2 topics max
- **Pro tier**: Unlimited briefings, unlimited topics
- **Without Stripe keys**: App degrades gracefully — everyone gets the free tier
- **Usage tracking**: Stored in Upstash Redis, resets daily at midnight UTC
- **Subscription status**: Synced via Stripe webhooks in real-time

## Troubleshooting

- **"Stripe not configured"**: Make sure all env vars are set in Vercel
- **Webhook not working**: Check the webhook URL matches your domain exactly
- **Customer portal error**: Make sure you've configured the portal in Stripe settings
- **Usage not resetting**: Counts reset at midnight UTC automatically via Redis
