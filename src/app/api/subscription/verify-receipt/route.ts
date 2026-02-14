import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getUserSubscription, saveUserSubscription } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transactionJWS, productId } = await request.json();

    if (!transactionJWS || !productId) {
      return NextResponse.json(
        { error: 'transactionJWS and productId required' },
        { status: 400 }
      );
    }

    // Decode JWS payload (middle segment) to extract transaction info
    // In production, verify the JWS signature with Apple's public key
    const parts = transactionJWS.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid JWS format' }, { status: 400 });
    }

    let transactionPayload;
    try {
      const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
      transactionPayload = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ error: 'Failed to decode transaction' }, { status: 400 });
    }

    // Verify the product is one of ours
    const validProducts = ['com.briefing.pro.monthly', 'com.briefing.pro.annual'];
    if (!validProducts.includes(transactionPayload.productId || productId)) {
      return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
    }

    // Update user subscription to pro
    const sub = await getUserSubscription(user.email);
    sub.tier = 'pro';
    sub.subscriptionStatus = 'active';
    sub.currentPeriodEnd = transactionPayload.expiresDate
      ? new Date(transactionPayload.expiresDate).toISOString()
      : undefined;
    await saveUserSubscription(sub);

    return NextResponse.json({
      tier: 'pro',
      subscriptionStatus: 'active',
    });
  } catch (error) {
    console.error('Receipt verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify receipt' },
      { status: 500 }
    );
  }
}
