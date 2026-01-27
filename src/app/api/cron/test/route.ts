import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://briefing-five.vercel.app';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: { step: string; status: string; data?: unknown; error?: string }[] = [];

    // Step 1: Generate briefings
    console.log('Step 1: Generating briefings...');
    try {
      const generateRes = await fetch(`${BASE_URL}/api/cron/generate-briefs`, {
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
      });
      const generateData = await generateRes.json();
      results.push({ step: 'generate', status: generateRes.ok ? 'success' : 'error', data: generateData });
      console.log('Generate result:', generateData);
    } catch (error) {
      results.push({ step: 'generate', status: 'error', error: error instanceof Error ? error.message : 'Unknown' });
    }

    // Step 2: Send briefings
    console.log('Step 2: Sending briefings...');
    try {
      const sendRes = await fetch(`${BASE_URL}/api/cron/send-briefs`, {
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
      });
      const sendData = await sendRes.json();
      results.push({ step: 'send', status: sendRes.ok ? 'success' : 'error', data: sendData });
      console.log('Send result:', sendData);
    } catch (error) {
      results.push({ step: 'send', status: 'error', error: error instanceof Error ? error.message : 'Unknown' });
    }

    return NextResponse.json({ 
      message: 'Test complete - generated and sent briefings',
      results 
    });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}
