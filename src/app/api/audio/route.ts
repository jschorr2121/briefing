import { NextRequest, NextResponse } from 'next/server';

interface StoryCard {
  headline: string;
  bullets: string[];
  source?: string;
}

interface Briefing {
  topic: string;
  emoji: string;
  summary: string;
  stories?: StoryCard[];
}

type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export async function POST(request: NextRequest) {
  try {
    const { briefings, voice: requestedVoice } = await request.json() as { 
      briefings: Briefing[]; 
      voice?: VoiceOption;
    };

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

    // Combine briefings into a single script with full content
    const script = briefings.map(b => {
      // Remove markdown formatting for speech
      const cleanSummary = b.summary
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\n\n/g, '. ')
        .replace(/\n/g, ' ');
      
      // Build the full script for this topic
      let topicScript = `${b.topic}. ${cleanSummary}`;
      
      // Add each story with its bullets
      if (b.stories && b.stories.length > 0) {
        topicScript += '\n\nHere are the top stories:\n\n';
        
        b.stories.forEach((story, index) => {
          const cleanHeadline = story.headline
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\n/g, ' ');
          
          topicScript += `Story ${index + 1}: ${cleanHeadline}.\n`;
          
          if (story.bullets && story.bullets.length > 0) {
            story.bullets.forEach(bullet => {
              const cleanBullet = bullet
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\n/g, ' ');
              topicScript += `${cleanBullet}.\n`;
            });
          }
          
          topicScript += '\n';
        });
      }
      
      return topicScript;
    }).join('\n\n---\n\n');

    // OpenAI TTS - voice options: alloy, echo, fable, onyx, nova, shimmer
    const voice = requestedVoice || (process.env.OPENAI_TTS_VOICE as VoiceOption) || 'nova';

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
