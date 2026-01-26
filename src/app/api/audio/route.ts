import { NextRequest, NextResponse } from 'next/server';
import { getTTSProvider } from '@/lib/models';

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

function buildScript(briefings: Briefing[]): string {
  return briefings.map(b => {
    const cleanSummary = b.summary
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\n\n/g, '. ')
      .replace(/\n/g, ' ');
    
    let topicScript = `${b.topic}. ${cleanSummary}`;
    
    if (b.stories && b.stories.length > 0) {
      topicScript += '\n\nHere are the top stories:\n\n';
      
      b.stories.forEach((story, index) => {
        const cleanHeadline = story.headline
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\n/g, ' ');
        
        topicScript += `Story ${index + 1}: ${cleanHeadline}.\n`;
        
        if (story.bullets && story.bullets.length > 0) {
          story.bullets.forEach(bullet => {
            const cleanBullet = bullet.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n/g, ' ');
            topicScript += `${cleanBullet}.\n`;
          });
        }
        topicScript += '\n';
      });
    }
    
    return topicScript;
  }).join('\n\n---\n\n');
}

async function generateOpenAITTS(script: string, voice: VoiceOption): Promise<ArrayBuffer> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OpenAI API key not configured');

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
    throw new Error('Failed to generate audio with OpenAI');
  }

  return response.arrayBuffer();
}

async function generateGoogleTTS(script: string): Promise<ArrayBuffer> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('Google TTS API key not configured');

  // Google Cloud Text-to-Speech API
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: script },
        voice: {
          languageCode: 'en-US',
          name: 'en-US-Standard-J', // Male voice (cheaper)
          ssmlGender: 'MALE'
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0,
          pitch: 0
        }
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Google TTS error:', error);
    throw new Error('Failed to generate audio with Google TTS');
  }

  const data = await response.json();
  
  // Google returns base64-encoded audio
  const audioContent = data.audioContent;
  const binaryString = atob(audioContent);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}

export async function POST(request: NextRequest) {
  try {
    const { briefings, voice: requestedVoice } = await request.json() as { 
      briefings: Briefing[]; 
      voice?: VoiceOption;
    };

    if (!briefings || briefings.length === 0) {
      return NextResponse.json({ error: 'No briefings provided' }, { status: 400 });
    }

    const script = buildScript(briefings);
    const provider = getTTSProvider();
    const voice = requestedVoice || (process.env.OPENAI_TTS_VOICE as VoiceOption) || 'nova';

    console.log(`Generating TTS with ${provider}, script length: ${script.length} chars`);

    let audioBuffer: ArrayBuffer;

    if (provider === 'google') {
      audioBuffer = await generateGoogleTTS(script);
    } else {
      audioBuffer = await generateOpenAITTS(script, voice);
    }
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Content-Disposition': `attachment; filename="briefing-${new Date().toISOString().split('T')[0]}.mp3"`,
        'X-TTS-Provider': provider,
      },
    });
  } catch (error) {
    console.error('Audio generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio' },
      { status: 500 }
    );
  }
}
