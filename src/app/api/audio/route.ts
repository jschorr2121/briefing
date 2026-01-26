import { NextRequest, NextResponse } from 'next/server';

interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
}

export async function POST(request: NextRequest) {
  try {
    const { briefings } = await request.json() as { briefings: Briefing[] };

    if (!briefings || briefings.length === 0) {
      return NextResponse.json({ error: 'No briefings provided' }, { status: 400 });
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      return NextResponse.json(
        { error: 'Audio generation not configured' },
        { status: 501 }
      );
    }

    // Combine briefings into a single script
    const script = briefings.map(b => {
      // Remove markdown formatting for speech
      const cleanSummary = b.summary
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\n\n/g, '. ')
        .replace(/\n/g, ' ');
      return `${b.topic}. ${cleanSummary}`;
    }).join('\n\n');

    // Voice ID for a professional news voice (Rachel)
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey,
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs error:', error);
      return NextResponse.json(
        { error: 'Failed to generate audio' },
        { status: 500 }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="briefing-${new Date().toISOString().split('T')[0]}.mp3"`,
      },
    });
  } catch (error) {
    console.error('Audio generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}
