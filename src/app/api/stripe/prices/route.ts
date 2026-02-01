import { NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/stripe';

export async function GET() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    monthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || null,
    annualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || null,
  });
}
