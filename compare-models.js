const fs = require('fs');

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const topics = ['AI & Tech', 'Financial Services'];

const prompt = (topic) => `Search for the latest news about: ${topic}

After searching, create a news briefing with:
1. A brief 2-3 sentence overview summary
2. 3 individual story cards

For each story, provide:
- A clear headline (max 15 words)
- 2-3 bullet points explaining the key details
- The source name

Format your response as JSON:
{
  "summary": "Brief overview...",
  "stories": [
    {
      "headline": "Story headline",
      "bullets": ["Key point 1", "Key point 2"],
      "source": "Source Name"
    }
  ]
}

Only return valid JSON, no markdown code blocks.`;

async function callGPT4o(topic) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'US' } }],
      tool_choice: 'auto',
      input: prompt(topic),
    }),
  });
  const data = await response.json();
  return data.output_text || JSON.stringify(data);
}

async function callGPT4oMini(topic) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'US' } }],
      tool_choice: 'auto',
      input: prompt(topic),
    }),
  });
  const data = await response.json();
  return data.output_text || JSON.stringify(data);
}

async function callPerplexity(topic) {
  // Using OpenAI-compatible endpoint
  const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
  if (!PERPLEXITY_KEY) {
    return "Perplexity API key not configured. Set PERPLEXITY_API_KEY env var.";
  }
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PERPLEXITY_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        { role: 'user', content: prompt(topic) }
      ],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || JSON.stringify(data);
}

async function main() {
  const results = { 'gpt-4o': {}, 'gpt-4o-mini': {}, 'perplexity': {} };
  
  for (const topic of topics) {
    console.log(`\nGenerating for: ${topic}`);
    
    console.log('  Calling GPT-4o...');
    results['gpt-4o'][topic] = await callGPT4o(topic);
    
    console.log('  Calling GPT-4o-mini...');
    results['gpt-4o-mini'][topic] = await callGPT4oMini(topic);
    
    console.log('  Calling Perplexity...');
    results['perplexity'][topic] = await callPerplexity(topic);
  }
  
  fs.writeFileSync('/home/ubuntu/clawd/briefing/comparison-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to comparison-results.json');
}

main().catch(console.error);
