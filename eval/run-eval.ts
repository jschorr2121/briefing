/**
 * Briefing Product LLM-as-Judge Evaluation
 * Generates real briefings across topic categories and evaluates with GPT-4o
 */

import { generateBriefing } from '../src/lib/briefing-generator';

// ─── Topic test matrix ───────────────────────────────────────────────

const EVAL_TOPICS: { category: string; topics: { name: string; emoji?: string }[] }[] = [
  {
    category: 'Broad/Popular',
    topics: [
      { name: 'Artificial Intelligence', emoji: '🤖' },
      { name: 'US Politics', emoji: '🏛️' },
      { name: 'Stock Market', emoji: '📈' },
      { name: 'NFL', emoji: '🏈' },
      { name: 'World News', emoji: '🌍' },
    ],
  },
  {
    category: 'Niche/Specific',
    topics: [
      { name: 'Semiconductors', emoji: '🔬' },
      { name: 'Mergers & Acquisitions', emoji: '🤝' },
      { name: 'Formula 1', emoji: '🏎️' },
      { name: 'Supreme Court', emoji: '⚖️' },
    ],
  },
  {
    category: 'Custom/Unusual',
    topics: [
      { name: 'quantum computing startups', emoji: '💫' },
      { name: 'NYC restaurant openings', emoji: '🍽️' },
      { name: 'indie game development', emoji: '🎮' },
      { name: 'space tourism', emoji: '🚀' },
      { name: 'labor unions', emoji: '✊' },
    ],
  },
  {
    category: 'Edge Cases',
    topics: [
      { name: 'Morgan Stanley wealth management', emoji: '💰' },
      { name: 'news', emoji: '📰' },
      { name: 'memes', emoji: '😂' },
    ],
  },
];

// ─── Judge prompt ────────────────────────────────────────────────────

const JUDGE_SYSTEM = `You are an expert evaluator of AI-generated news briefings. You will receive a briefing (topic, summary, stories with headlines/bullets/sources/URLs/dates) and evaluate it on multiple dimensions.

For each dimension, provide a score from 1-10 and a brief justification (1-2 sentences).

Dimensions:
1. Relevance (1-10): Are stories actually about the stated topic?
2. Recency (1-10): Are stories from the last 1-3 days? (Today is ${new Date().toISOString().split('T')[0]})
3. Summary Quality (1-10): Are bullets informative, concise, well-written?
4. Source Quality (1-10): Are sources reputable news outlets?
5. Story Diversity (1-10): Are stories distinct or repetitive?
6. Headline Quality (1-10): Punchy, accurate, right length?
7. Factual Consistency (1-10): Do bullets match the headline/topic?
8. Coverage Completeness (1-10): Are major stories for this topic present?
9. Readability (1-10): Is the tone appropriate and text scannable?
10. URL Quality (1-10): Do URLs appear to be real specific article URLs (not homepages)?

Output ONLY valid JSON:
{
  "scores": {
    "relevance": { "score": 8, "reason": "..." },
    "recency": { "score": 7, "reason": "..." },
    "summary_quality": { "score": 8, "reason": "..." },
    "source_quality": { "score": 9, "reason": "..." },
    "story_diversity": { "score": 7, "reason": "..." },
    "headline_quality": { "score": 8, "reason": "..." },
    "factual_consistency": { "score": 8, "reason": "..." },
    "coverage_completeness": { "score": 7, "reason": "..." },
    "readability": { "score": 8, "reason": "..." },
    "url_quality": { "score": 8, "reason": "..." }
  },
  "overall_notes": "Brief overall assessment"
}`;

interface ScoreEntry {
  score: number;
  reason: string;
}

interface JudgeResult {
  scores: Record<string, ScoreEntry>;
  overall_notes: string;
}

interface TopicEvalResult {
  topic: string;
  category: string;
  storyCount: number;
  articleCount: number;
  generatedAt: string;
  briefingRaw: any;
  judge: JudgeResult;
  error?: string;
}

// ─── OpenAI judge call ───────────────────────────────────────────────

async function judgeBriefing(briefing: any): Promise<JudgeResult> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const briefingText = JSON.stringify(briefing, null, 2);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: JUDGE_SYSTEM },
        { role: 'user', content: `Evaluate this briefing:\n\n${briefingText}` },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Judge API error: ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  return JSON.parse(cleaned.substring(jsonStart, jsonEnd + 1));
}

// ─── Main evaluation ─────────────────────────────────────────────────

async function runEval() {
  const results: TopicEvalResult[] = [];
  const startTime = Date.now();

  for (const group of EVAL_TOPICS) {
    console.log(`\n━━━ ${group.category} ━━━`);

    // Generate briefings for all topics in this category at once
    for (const topic of group.topics) {
      console.log(`  📝 Generating: ${topic.name}...`);
      try {
        const result = await generateBriefing(
          [{ id: topic.name, name: topic.name, emoji: topic.emoji }],
          { briefingLength: 'medium', tone: 'professional', includeLinks: true }
        );

        const briefing = result.briefings[0];
        if (!briefing) {
          results.push({
            topic: topic.name, category: group.category,
            storyCount: 0, articleCount: 0, generatedAt: new Date().toISOString(),
            briefingRaw: null, judge: { scores: {}, overall_notes: 'No briefing generated' },
            error: 'No briefing returned',
          });
          continue;
        }

        console.log(`  ✅ ${briefing.stories.length} stories, ${briefing.articles.length} articles`);

        // Judge it
        console.log(`  🧑‍⚖️ Judging...`);
        const judge = await judgeBriefing(briefing);
        const avgScore = Object.values(judge.scores).reduce((s, v) => s + v.score, 0) / Object.values(judge.scores).length;
        console.log(`  📊 Avg score: ${avgScore.toFixed(1)}/10`);

        results.push({
          topic: topic.name, category: group.category,
          storyCount: briefing.stories.length, articleCount: briefing.articles.length,
          generatedAt: briefing.generatedAt, briefingRaw: briefing, judge,
        });
      } catch (err: any) {
        console.error(`  ❌ Error: ${err.message}`);
        results.push({
          topic: topic.name, category: group.category,
          storyCount: 0, articleCount: 0, generatedAt: new Date().toISOString(),
          briefingRaw: null,
          judge: { scores: {}, overall_notes: `Error: ${err.message}` },
          error: err.message,
        });
      }

      // Small delay between topics to be nice to APIs
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n✅ Evaluation complete in ${elapsed}s. ${results.length} topics evaluated.`);

  // Write raw results
  const fs = await import('fs');
  fs.writeFileSync('/home/ubuntu/clawd/briefing/eval/results.json', JSON.stringify(results, null, 2));
  console.log('📁 Raw results saved to eval/results.json');

  // Generate HTML report
  generateHTMLReport(results, elapsed);
}

// ─── HTML Report Generation ──────────────────────────────────────────

function generateHTMLReport(results: TopicEvalResult[], elapsed: string) {
  const dimensions = ['relevance', 'recency', 'summary_quality', 'source_quality', 'story_diversity',
    'headline_quality', 'factual_consistency', 'coverage_completeness', 'readability', 'url_quality'];
  const dimLabels: Record<string, string> = {
    relevance: 'Relevance', recency: 'Recency', summary_quality: 'Summary Quality',
    source_quality: 'Source Quality', story_diversity: 'Story Diversity',
    headline_quality: 'Headline Quality', factual_consistency: 'Factual Consistency',
    coverage_completeness: 'Coverage', readability: 'Readability', url_quality: 'URL Quality',
  };

  // Compute aggregates
  const categoryAggs: Record<string, { scores: Record<string, number[]>; count: number }> = {};
  const globalScores: Record<string, number[]> = {};
  dimensions.forEach(d => globalScores[d] = []);

  for (const r of results) {
    if (!categoryAggs[r.category]) {
      categoryAggs[r.category] = { scores: {}, count: 0 };
      dimensions.forEach(d => categoryAggs[r.category].scores[d] = []);
    }
    categoryAggs[r.category].count++;
    for (const d of dimensions) {
      const s = r.judge.scores[d]?.score;
      if (s !== undefined) {
        categoryAggs[r.category].scores[d].push(s);
        globalScores[d].push(s);
      }
    }
  }

  const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A';
  const scoreColor = (s: number) => s >= 8 ? '#2d8a4e' : s >= 6 ? '#b8860b' : '#c0392b';

  const successCount = results.filter(r => !r.error).length;
  const failCount = results.filter(r => r.error).length;
  const globalAvg = Object.values(globalScores).flatMap(x => x);
  const overallAvg = globalAvg.length ? (globalAvg.reduce((a, b) => a + b, 0) / globalAvg.length) : 0;

  // Find best/worst
  const topicAvgs = results.filter(r => !r.error).map(r => {
    const scores = Object.values(r.judge.scores).map(s => s.score);
    return { topic: r.topic, category: r.category, avg: scores.reduce((a, b) => a + b, 0) / scores.length };
  }).sort((a, b) => b.avg - a.avg);

  const bestTopics = topicAvgs.slice(0, 3);
  const worstTopics = topicAvgs.slice(-3).reverse();

  // Dimension averages for radar-style display
  const dimAvgs = dimensions.map(d => ({
    dim: dimLabels[d], avg: parseFloat(avg(globalScores[d])),
  })).sort((a, b) => b.avg - a.avg);

  let html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Briefing Evaluation Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 1100px; margin: 0 auto; line-height: 1.5; }
  h1 { font-size: 28px; margin-bottom: 8px; }
  h2 { font-size: 22px; margin: 32px 0 12px; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; }
  h3 { font-size: 17px; margin: 20px 0 8px; }
  .meta { color: #666; margin-bottom: 24px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0; }
  .summary-card { background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
  .summary-card .big { font-size: 32px; font-weight: 700; }
  .summary-card .label { font-size: 13px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e0e0e0; }
  th { background: #f0f0f0; font-weight: 600; }
  .score { font-weight: 700; font-size: 15px; }
  .topic-detail { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 12px 0; }
  .topic-detail h4 { margin-bottom: 8px; }
  .pills { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; }
  .strengths { color: #2d8a4e; }
  .weaknesses { color: #c0392b; }
  .rec-list li { margin: 4px 0; }
  .pagebreak { page-break-before: always; }
</style></head><body>

<h1>📊 Briefing Product Evaluation Report</h1>
<p class="meta">Generated: ${new Date().toISOString().split('T')[0]} | ${results.length} topics evaluated | ${elapsed}s runtime</p>

<div class="summary-grid">
  <div class="summary-card"><div class="big" style="color:${scoreColor(overallAvg)}">${overallAvg.toFixed(1)}</div><div class="label">Overall Score /10</div></div>
  <div class="summary-card"><div class="big">${successCount}</div><div class="label">Successful</div></div>
  <div class="summary-card"><div class="big" style="color:${failCount ? '#c0392b' : '#2d8a4e'}">${failCount}</div><div class="label">Failed</div></div>
  <div class="summary-card"><div class="big">${results.filter(r => !r.error).reduce((s, r) => s + r.storyCount, 0)}</div><div class="label">Total Stories</div></div>
</div>

<h2>Dimension Scores (Global Average)</h2>
<table>
<tr><th>Dimension</th><th>Avg Score</th><th>Bar</th></tr>
${dimAvgs.map(d => `<tr><td>${d.dim}</td><td class="score" style="color:${scoreColor(d.avg)}">${d.avg.toFixed(1)}</td><td><div style="background:${scoreColor(d.avg)};height:14px;width:${d.avg * 10}%;border-radius:4px;"></div></td></tr>`).join('\n')}
</table>

<h2>Category Performance</h2>
<table>
<tr><th>Category</th><th>Topics</th>${dimensions.map(d => `<th>${dimLabels[d].split(' ')[0]}</th>`).join('')}<th>Avg</th></tr>
${Object.entries(categoryAggs).map(([cat, agg]) => {
    const catScores = dimensions.map(d => parseFloat(avg(agg.scores[d])));
    const catAvg = catScores.filter(s => !isNaN(s)).reduce((a, b) => a + b, 0) / catScores.filter(s => !isNaN(s)).length;
    return `<tr><td><b>${cat}</b></td><td>${agg.count}</td>${catScores.map(s => `<td class="score" style="color:${scoreColor(s)}">${isNaN(s) ? '-' : s.toFixed(1)}</td>`).join('')}<td class="score" style="color:${scoreColor(catAvg)}">${catAvg.toFixed(1)}</td></tr>`;
  }).join('\n')}
</table>

<h2>🏆 Best & Worst Performing Topics</h2>
<h3 class="strengths">Top 3</h3>
<table><tr><th>Topic</th><th>Category</th><th>Avg Score</th></tr>
${bestTopics.map(t => `<tr><td>${t.topic}</td><td>${t.category}</td><td class="score" style="color:${scoreColor(t.avg)}">${t.avg.toFixed(1)}</td></tr>`).join('\n')}
</table>
<h3 class="weaknesses">Bottom 3</h3>
<table><tr><th>Topic</th><th>Category</th><th>Avg Score</th></tr>
${worstTopics.map(t => `<tr><td>${t.topic}</td><td>${t.category}</td><td class="score" style="color:${scoreColor(t.avg)}">${t.avg.toFixed(1)}</td></tr>`).join('\n')}
</table>

<h2 class="pagebreak">Individual Topic Results</h2>
${results.map(r => {
    if (r.error) {
      return `<div class="topic-detail"><h4>❌ ${r.topic} <span style="color:#999">(${r.category})</span></h4><p style="color:#c0392b">Error: ${r.error}</p></div>`;
    }
    const scores = Object.entries(r.judge.scores);
    const topicAvg = scores.reduce((s, [, v]) => s + v.score, 0) / scores.length;
    return `<div class="topic-detail">
      <h4>${r.topic} <span style="color:#999">(${r.category})</span> — <span class="score" style="color:${scoreColor(topicAvg)}">${topicAvg.toFixed(1)}/10</span></h4>
      <p><b>Stories:</b> ${r.storyCount} | <b>Articles:</b> ${r.articleCount}</p>
      <p><b>Summary:</b> ${r.briefingRaw?.summary || 'N/A'}</p>
      <table><tr><th>Dimension</th><th>Score</th><th>Reason</th></tr>
      ${scores.map(([dim, v]) => `<tr><td>${dimLabels[dim] || dim}</td><td class="score" style="color:${scoreColor(v.score)}">${v.score}</td><td>${v.reason}</td></tr>`).join('\n')}
      </table>
      <p><i>${r.judge.overall_notes}</i></p>
      ${r.briefingRaw?.stories?.length ? `<details><summary>Story headlines</summary><ul>${r.briefingRaw.stories.map((s: any) => `<li><b>${s.headline}</b> (${s.source || 'unknown'}, ${s.date || 'no date'})</li>`).join('')}</ul></details>` : ''}
    </div>`;
  }).join('\n')}

<h2 class="pagebreak">Pipeline Analysis</h2>

<h3>Query Planner</h3>
<ul>
<li><b>Architecture:</b> Curated topics (${Array.from(new Set(results.filter(r => !r.error).map(r => r.category))).length} categories, 40+ configs) skip LLM planning entirely — efficient and consistent.</li>
<li><b>Custom topics:</b> LLM planner generates search queries with type selection (articles/vector/both). Plans cached 24h in Redis.</li>
<li><b>Splitting logic:</b> Compound topics like "AI and Tech" are split into separate queries — good for coverage breadth.</li>
<li><b>Strength:</b> Three-tier search type system (articles → vector → both) is well-designed for varying topic specificity.</li>
</ul>

<h3>Perigon Search Quality</h3>
<ul>
<li><b>Cascade fallback:</b> top100 sources (3d) → any source (7d) → vector search. This is excellent for balancing quality vs coverage.</li>
<li><b>Source filtering:</b> Excludes Non-news, Opinion, Paid News labels. Reprints filtered. English-only, Article medium.</li>
<li><b>Interleaving:</b> Multi-query results are round-robin interleaved then deduped — ensures balanced coverage.</li>
</ul>

<h3>Caching</h3>
<ul>
<li><b>TTL:</b> 6 hours for article results, 24 hours for query plans. Section-level caching available.</li>
<li><b>Recommendation:</b> 6h TTL is reasonable for news. Consider 3-4h for breaking-news-heavy topics (politics, markets).</li>
</ul>

<h3>Error Handling</h3>
<ul>
<li><b>LLM retry:</b> Single retry on parse failure — good basic resilience.</li>
<li><b>Cascade fallback:</b> 3-step article search degradation prevents empty results.</li>
<li><b>Graceful degradation:</b> Failed topics return stub briefing rather than crashing entire request.</li>
</ul>

<h3>Cost Efficiency</h3>
<ul>
<li><b>Model:</b> GPT-5-nano at $0.15/$0.60 per 1M tokens — very cost-effective.</li>
<li><b>Per briefing:</b> ~1 query planner call + 1 assembly call per topic. Cached queries avoid redundant Perigon API hits.</li>
<li><b>Estimated cost:</b> ~$0.001-0.003 per topic section (nano pricing). Full 5-topic briefing ≈ $0.01-0.02.</li>
</ul>

<h2>Key Findings</h2>

<h3 class="strengths">✅ What Works Well</h3>
<ul class="rec-list">
<li><b>Source quality filtering</b> — top100 sourceGroup + label exclusion produces reliable, reputable sources</li>
<li><b>Curated topic configs</b> — pre-optimized queries for 40+ topics bypass LLM planning, improving speed and consistency</li>
<li><b>Cascade fallback</b> — 3-step degradation ensures coverage even for niche topics</li>
<li><b>Cost efficiency</b> — GPT-5-nano keeps per-briefing costs under $0.02</li>
<li><b>Deduplication</b> — URL-based dedup + reprint filtering prevents repetitive content</li>
<li><b>Parallel execution</b> — all topics fetched and assembled concurrently</li>
</ul>

<h3 class="weaknesses">❌ What Needs Improvement</h3>
<ul class="rec-list">
<li><b>Date filtering too permissive:</b> 2-month window allows stale content. Consider 7-14 day max for mainstream topics.</li>
<li><b>No URL validation:</b> LLM could hallucinate or mangle URLs. Add runtime URL validation (check HTTP status).</li>
<li><b>Vector search quality:</b> No source quality filtering on vector endpoint — can return low-quality content. Post-filter vector results by known source lists.</li>
<li><b>Missing topic coverage detection:</b> No mechanism to detect if major breaking stories are missing. Consider a "coverage check" step.</li>
<li><b>Section caching unused in main flow:</b> getCachedSection is checked but setCachedSection is never called in briefing-generator.ts. Wire it up to cache assembled sections.</li>
<li><b>No token usage tracking:</b> Usage is logged but not stored. Track in Redis for cost monitoring dashboards.</li>
<li><b>Edge case topics:</b> Very broad ("news") or very niche ("Morgan Stanley wealth management") may produce poor results. Consider pre-validation or user guidance.</li>
</ul>

<h3>Actionable Recommendations</h3>
<ol class="rec-list">
<li><b>Tighten date filter:</b> Reduce max age to 14 days for broad topics, 30 days for niche. Add per-category TTL config.</li>
<li><b>Cache assembled sections:</b> Call setCachedSection after successful assembly to avoid redundant LLM calls for the same topic within 6h.</li>
<li><b>URL health check:</b> Spot-check 1-2 URLs per briefing with HEAD requests. Flag or replace dead links.</li>
<li><b>Vector post-filtering:</b> Apply source reputation scoring to vector search results before feeding to LLM.</li>
<li><b>Usage dashboard:</b> Store token counts + Perigon API call counts in Redis. Build a /admin/usage page.</li>
<li><b>Adaptive cache TTL:</b> 3h for politics/markets, 6h for tech/sports, 12h for niche/lifestyle.</li>
</ol>

</body></html>`;

  const fs = require('fs');
  const dir = '/home/ubuntu/clawd/briefing/docs';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/eval-report-2026-03-07.html`, html);
  console.log('📄 HTML report saved');
}

// ─── Run ─────────────────────────────────────────────────────────────
runEval().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
