const fs = require('fs');

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Sample text for 30 second audio (~75 words)
const sampleText = `AI and Tech Update. OpenAI announced a new AI hardware device in collaboration with Jony Ive, scheduled for release in late 2026. NVIDIA unveiled its Rubin AI supercomputer platform, delivering 10 times lower inference costs. Microsoft rolled out second generation Maia 200 AI chips, expanding its custom hardware capabilities. These developments signal a major shift in AI infrastructure.`;

async function generateOpenAITTS() {
  console.log('Generating OpenAI TTS-1 sample...');
  
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: sampleText,
      voice: 'nova',
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    console.error('OpenAI TTS error:', await response.text());
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync('/home/ubuntu/clawd/briefing/sample-openai-tts1.mp3', buffer);
  console.log('Saved: sample-openai-tts1.mp3');
}

async function main() {
  await generateOpenAITTS();
  console.log('\nNote: Google Cloud TTS requires service account setup. Skipping for now.');
}

main().catch(console.error);
