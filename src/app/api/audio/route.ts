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

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'Audio generation not configured - missing OPENAI_API_KEY' },
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

    // OpenAI TTS - voice options: alloy, echo, fable, onyx, nova, shimmer
    const voice = process.env.OPENAI_TTS_VOICE || 'nova';

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: script,
        voice: voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI TTS error:', error);
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
