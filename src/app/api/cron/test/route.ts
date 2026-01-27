import { NextRequest, NextResponse } from 'next/server';

// Simple test endpoint to verify cron is working
// GET /api/cron/test?email=your@email.com&topic=AI
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');
  const topic = searchParams.get('topic') || 'AI News';

  if (!email) {
    return NextResponse.json({ 
      error: 'Missing email parameter',
      usage: '/api/cron/test?email=your@email.com&topic=AI%20News'
    }, { status: 400 });
  }

  try {
    // Call the generate endpoint
    const baseUrl = process.env.NEXTAUTH_URL || 'https://briefing-eight.vercel.app';
    
    const generateRes = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: [topic] }),
    });

    if (!generateRes.ok) {
      const error = await generateRes.text();
      return NextResponse.json({ error: 'Failed to generate', details: error }, { status: 500 });
    }

    const briefings = await generateRes.json();

    // Send email
    const emailRes = await fetch(`${baseUrl}/api/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefings, email }),
    });

    if (!emailRes.ok) {
      const error = await emailRes.text();
      return NextResponse.json({ error: 'Failed to send email', details: error }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Test briefing sent to ${email}`,
      topic,
      briefingCount: briefings.length
    });
  } catch (error) {
    console.error('Test cron error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
