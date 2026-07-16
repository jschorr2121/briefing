var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/diagnostic-compare/index.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// scripts/diagnostic-compare/topics.ts
var TOPICS = [
  {
    label: "artificial intelligence",
    perigon: { category: "Tech", topic: "AI" },
    newsdataCategory: "technology",
    braveFreshness: "pw"
  },
  {
    label: "Morgan Stanley wealth management",
    perigon: { companyName: "Morgan Stanley" },
    newsdataCategory: "business",
    braveFreshness: "pw"
  },
  {
    label: "Politics",
    perigon: { category: "Politics" },
    newsdataCategory: "politics",
    braveFreshness: "pw"
  },
  {
    label: "AI & Tech",
    perigon: { category: "Tech", topic: "AI" },
    newsdataCategory: "technology",
    braveFreshness: "pw"
  }
];

// scripts/diagnostic-compare/cli.ts
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    skipAgent: false,
    variants: null,
    agentModel: "claude",
    dryRun: false,
    yes: false
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--skip-agent") {
      opts.skipAgent = true;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--yes" || arg === "-y") {
      opts.yes = true;
    } else if (arg === "--variants" && args[i + 1]) {
      opts.variants = args[++i].split(",").map((v) => v.trim());
    } else if (arg === "--agent-model" && args[i + 1]) {
      const model = args[++i];
      if (model === "claude" || model === "gpt") opts.agentModel = model;
    }
  }
  return opts;
}

// scripts/diagnostic-compare/cost-preview.ts
var readline = __toESM(require("readline"));
var VARIANT_COSTS = [
  { name: "perigon-raw-articles", calls: 4, estCost: "$0.008", subtotal: "$0.03" },
  { name: "perigon-raw-stories", calls: 4, estCost: "$0.008", subtotal: "$0.03" },
  { name: "perigon-raw-vector", calls: 4, estCost: "$0.008", subtotal: "$0.03" },
  { name: "perigon-flow-news-rebuild", calls: 4, estCost: "1\u20134 API calls each", subtotal: "$0.10" },
  { name: "perigon-flow-master", calls: 4, estCost: "1\u20134 API calls each", subtotal: "$0.10" },
  { name: "perigon-agent", calls: 4, estCost: "tokens + $0.024", subtotal: "$0.15" },
  { name: "newsdata-direct", calls: 4, estCost: "$0.010", subtotal: "$0.04" },
  { name: "newsdata-agent", calls: 4, estCost: "tokens + $0.020", subtotal: "$0.08" },
  { name: "brave-direct", calls: 4, estCost: "$0.005", subtotal: "$0.02" },
  { name: "brave-agent", calls: 4, estCost: "tokens + $0.010", subtotal: "$0.07" },
  { name: "tavily-direct", calls: 4, estCost: "$0.008", subtotal: "$0.03" },
  { name: "tavily-agent", calls: 4, estCost: "tokens + $0.016", subtotal: "$0.08" },
  { name: "exa-direct", calls: 4, estCost: "actual", subtotal: "~$0.03" },
  { name: "exa-agent", calls: 4, estCost: "tokens + actual", subtotal: "$0.08" },
  { name: "claude-sonnet-4-6-websearch", calls: 4, estCost: "~3 searches + tokens", subtotal: "$0.20" },
  { name: "gpt-4o-websearch", calls: 4, estCost: "tokens", subtotal: "$0.06" },
  { name: "gpt-5.4-mini polish", calls: 20, estCost: "~$0.0003 each", subtotal: "$0.01" }
];
function printCostPreview(activeVariants) {
  const active = VARIANT_COSTS.filter(
    (v) => activeVariants.length === 0 || activeVariants.some((a) => v.name.startsWith(a))
  );
  console.log("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("\u2502                    COST PREVIEW (estimated)                      \u2502");
  console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  console.log("\u2502 Variant                        \u2502 Calls  \u2502 Est. cost/call \u2502 Total  \u2502");
  console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  for (const v of active) {
    const name = v.name.padEnd(30).slice(0, 30);
    const calls = String(v.calls).padEnd(6);
    const cost = v.estCost.padEnd(14).slice(0, 14);
    console.log(`\u2502 ${name} \u2502 ${calls} \u2502 ${cost} \u2502 ${v.subtotal.padEnd(6)} \u2502`);
  }
  console.log("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
  console.log("\u2502 Grand total per run: ~$1.25                                       \u2502");
  console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
}
async function waitForConfirmation() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Press Enter to proceed, or Ctrl+C to abort... ", () => {
      rl.close();
      resolve(true);
    });
  });
}

// scripts/diagnostic-compare/render.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var OUTPUT_DIR = path.join(process.cwd(), "scripts/diagnostic-compare/output");
function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
function cardToMarkdown(card) {
  const bullets = card.bullets.map((b) => `- ${b}`).join("\n");
  return `### ${card.headline}
${bullets}
**Source**: ${card.source} \xB7 **Date**: ${card.date} \xB7 [link](${card.url})`;
}
function briefingToMarkdown(result) {
  const lines = [`## ${result.topic}`];
  if (result.briefing.executiveSummary) {
    lines.push("", `**Executive summary**: ${result.briefing.executiveSummary}`);
  }
  lines.push("");
  if (result.briefing.cards.length === 0) {
    lines.push("*No results returned.*");
  } else {
    for (const card of result.briefing.cards) {
      lines.push(cardToMarkdown(card), "");
    }
  }
  const m = result.metrics;
  lines.push(
    "---",
    `**Metrics**: latency=${m.latency_ms}ms \xB7 cost=${m.cost_estimate_usd.toFixed(4)} USD \xB7 results=${m.results_count} \xB7 domains=${m.unique_domains}`,
    ""
  );
  return lines.join("\n");
}
function writeVariantFile(variant, results) {
  const lines = [`# ${variant}
`];
  for (const r of results) {
    lines.push(briefingToMarkdown(r));
  }
  const filePath = path.join(OUTPUT_DIR, `${variant}.md`);
  fs.writeFileSync(filePath, lines.join("\n"));
  console.log(`  wrote ${path.relative(process.cwd(), filePath)}`);
}
function writeComparisonFile(allResults) {
  const byTopic = /* @__PURE__ */ new Map();
  for (const r of allResults) {
    const arr = byTopic.get(r.topic) || [];
    arr.push(r);
    byTopic.set(r.topic, arr);
  }
  const lines = ["# Side-by-Side Comparison\n"];
  for (const [topic, results] of byTopic) {
    lines.push(`## Topic: ${topic}
`);
    lines.push("| Variant | Latency | Cost | Results | Domains |");
    lines.push("|---|---|---|---|---|");
    for (const r of results) {
      const m = r.metrics;
      lines.push(
        `| ${r.variant} | ${m.latency_ms}ms | $${m.cost_estimate_usd.toFixed(4)} | ${m.results_count} | ${m.unique_domains} |`
      );
    }
    lines.push("");
    for (const r of results) {
      lines.push(briefingToMarkdown(r));
    }
  }
  const filePath = path.join(OUTPUT_DIR, "comparison.md");
  fs.writeFileSync(filePath, lines.join("\n"));
  console.log(`  wrote ${path.relative(process.cwd(), filePath)}`);
}
function writeMetricsFile(allResults) {
  const runId = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const topics = [...new Set(allResults.map((r) => r.topic))];
  const variantMap = {};
  for (const r of allResults) {
    if (!variantMap[r.variant]) {
      variantMap[r.variant] = { by_topic: {}, total_cost_usd: 0, total_latency_ms: 0 };
    }
    variantMap[r.variant].by_topic[r.topic] = r.metrics;
    variantMap[r.variant].total_cost_usd += r.metrics.cost_estimate_usd;
    variantMap[r.variant].total_latency_ms += r.metrics.latency_ms;
  }
  const grand_total = Object.values(variantMap).reduce((sum, v) => sum + v.total_cost_usd, 0);
  const output = {
    run_id: runId,
    topics,
    variants: variantMap,
    grand_total_cost_usd: grand_total
  };
  const filePath = path.join(OUTPUT_DIR, "metrics.json");
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  console.log(`  wrote ${path.relative(process.cwd(), filePath)}`);
}

// scripts/diagnostic-compare/polish.ts
function normalizeRaw(raw) {
  const title = raw.title || "Untitled";
  const snippet = raw.summary || raw.description || raw.snippet || raw.content?.slice(0, 300) || "";
  const source = raw.source || raw.meta_url?.netloc || raw.source_domain || (raw.url ? new URL(raw.url).hostname.replace(/^www\./, "") : "Unknown");
  const date = raw.date || raw.pubDate || raw.age || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const url = raw.url || "";
  return { title, snippet, source, date, url };
}
async function polishToCards(rawResults, topic, dryRun = false) {
  const normalized = rawResults.map(normalizeRaw).slice(0, 20);
  if (dryRun) {
    return {
      cards: normalized.slice(0, 5).map((r) => ({
        headline: r.title,
        bullets: [r.snippet.slice(0, 100) || "No snippet available"],
        source: r.source,
        date: r.date,
        url: r.url
      })),
      cost_usd: 0
    };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      cards: normalized.slice(0, 5).map((r) => ({
        headline: r.title,
        bullets: [r.snippet.slice(0, 150)].filter(Boolean),
        source: r.source,
        date: r.date,
        url: r.url
      })),
      cost_usd: 0
    };
  }
  const inputText = JSON.stringify(normalized);
  const prompt = `You are polishing raw news search results into exactly 5 story cards for a briefing on "${topic}".

Raw results (title, snippet, source, date, url):
${inputText}

Output exactly this JSON array (5 elements, no prose, no markdown):
[
  { "headline": "\u226415 words, specific", "bullets": ["concrete fact", "concrete fact"], "source": "Publication Name", "date": "YYYY-MM-DD", "url": "https://..." }
]

Pick the 5 most relevant and recent results. Use concrete facts in bullets. Prefer recent sources.`;
  const start = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    })
  });
  if (!res.ok) {
    return {
      cards: normalized.slice(0, 5).map((r) => ({
        headline: r.title,
        bullets: [r.snippet.slice(0, 150)].filter(Boolean),
        source: r.source,
        date: r.date,
        url: r.url
      })),
      cost_usd: 0
    };
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "[]";
  const usage = data.usage || {};
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const cost = inputTokens * 0.15 / 1e6 + outputTokens * 0.6 / 1e6;
  let cards = [];
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : parsed.stories || parsed.cards || Object.values(parsed)[0] || [];
    cards = arr.slice(0, 5).map((c) => ({
      headline: c.headline || "Untitled",
      bullets: c.bullets || [],
      source: c.source || "Unknown",
      date: c.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      url: c.url || ""
    }));
  } catch {
    cards = normalized.slice(0, 5).map((r) => ({
      headline: r.title,
      bullets: [r.snippet.slice(0, 150)].filter(Boolean),
      source: r.source,
      date: r.date,
      url: r.url
    }));
  }
  return { cards, cost_usd: cost };
}

// scripts/diagnostic-compare/variants/perigon-raw.ts
var PERIGON_BASE = "https://api.perigon.io/v1";
function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
}
function countUniqueDomains(urls) {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );
  return domains.size;
}
function dryRunResult(variant, topic) {
  return {
    variant,
    topic,
    briefing: {
      cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: "dry run",
      results_count: 1,
      unique_domains: 0
    }
  };
}
function errorResult(variant, topic, error) {
  return {
    variant,
    topic,
    briefing: { cards: [] },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 8e-3,
      cost_basis: "estimate: $0.008/request on Basic plan",
      results_count: 0,
      unique_domains: 0,
      error: error instanceof Error ? error.message : String(error)
    }
  };
}
async function runArticles(topic, config, dryRun) {
  const variant = "perigon-raw-articles";
  if (dryRun) return dryRunResult(variant, topic);
  const apiKey = process.env.PERIGON_API_KEY;
  if (!apiKey) return errorResult(variant, topic, "Missing PERIGON_API_KEY env var");
  const t0 = Date.now();
  try {
    const params = new URLSearchParams({
      q: config.label,
      size: "10",
      sourceGroup: "top100",
      excludeLabel: "Opinion,Press Release",
      from: sevenDaysAgo(),
      sortBy: "relevance",
      apiKey
    });
    const res = await fetch(`${PERIGON_BASE}/articles/all?${params}`);
    if (!res.ok) throw new Error(`Perigon articles HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const latency_ms = Date.now() - t0;
    const articles = data.articles ?? [];
    const rawForPolish = articles.map((a) => ({
      title: a.title ?? "",
      url: a.url ?? "",
      source: a.source?.domain ?? "",
      date: a.pubDate ?? "",
      snippet: a.description ?? ""
    }));
    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = articles.map((a) => a.url ?? "").filter(Boolean);
    return {
      variant,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 8e-3,
        cost_basis: "estimate: $0.008/request on Basic plan",
        results_count: articles.length,
        unique_domains: countUniqueDomains(urls)
      }
    };
  } catch (e) {
    return { ...errorResult(variant, topic, e), metrics: { ...errorResult(variant, topic, e).metrics, latency_ms: Date.now() - t0 } };
  }
}
async function runStories(topic, config, dryRun) {
  const variant = "perigon-raw-stories";
  if (dryRun) return dryRunResult(variant, topic);
  const apiKey = process.env.PERIGON_API_KEY;
  if (!apiKey) return errorResult(variant, topic, "Missing PERIGON_API_KEY env var");
  const t0 = Date.now();
  try {
    const params = new URLSearchParams({
      q: config.label,
      size: "5",
      minUniqueSources: "3",
      sortBy: "updatedAt",
      apiKey
    });
    const res = await fetch(`${PERIGON_BASE}/stories/all?${params}`);
    if (!res.ok) throw new Error(`Perigon stories HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const latency_ms = Date.now() - t0;
    const stories = data.results ?? data.stories ?? [];
    const rawForPolish = stories.map((s) => {
      const firstArticle = s.articles?.[0];
      return {
        title: s.name ?? "",
        url: firstArticle?.url ?? "",
        source: firstArticle?.source?.domain ?? "",
        date: s.updatedAt ?? "",
        snippet: s.summary ?? ""
      };
    });
    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = stories.flatMap((s) => s.articles?.map((a) => a.url ?? "") ?? []).filter(Boolean);
    return {
      variant,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 8e-3,
        cost_basis: "estimate: $0.008/request on Basic plan",
        results_count: stories.length,
        unique_domains: countUniqueDomains(urls)
      }
    };
  } catch (e) {
    return { ...errorResult(variant, topic, e), metrics: { ...errorResult(variant, topic, e).metrics, latency_ms: Date.now() - t0 } };
  }
}
async function runVector(topic, config, dryRun) {
  const variant = "perigon-raw-vector";
  if (dryRun) return dryRunResult(variant, topic);
  const apiKey = process.env.PERIGON_API_KEY;
  if (!apiKey) return errorResult(variant, topic, "Missing PERIGON_API_KEY env var");
  const t0 = Date.now();
  try {
    const res = await fetch(`${PERIGON_BASE}/vector/news/all?apiKey=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: config.label, size: 10 })
    });
    if (!res.ok) throw new Error(`Perigon vector HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const latency_ms = Date.now() - t0;
    const articles = data.articles ?? data.results ?? [];
    const rawForPolish = articles.map((a) => ({
      title: a.title ?? "",
      url: a.url ?? "",
      source: a.source?.domain ?? "",
      date: a.pubDate ?? "",
      snippet: a.description ?? ""
    }));
    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = articles.map((a) => a.url ?? "").filter(Boolean);
    return {
      variant,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 8e-3,
        cost_basis: "estimate: $0.008/request on Basic plan",
        results_count: articles.length,
        unique_domains: countUniqueDomains(urls)
      }
    };
  } catch (e) {
    return { ...errorResult(variant, topic, e), metrics: { ...errorResult(variant, topic, e).metrics, latency_ms: Date.now() - t0 } };
  }
}

// scripts/diagnostic-compare/perigon-flows/news-rebuild/stub-cache.ts
var store = /* @__PURE__ */ new Map();
async function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}
async function setCached(key, value, ttlSeconds) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1e3 });
}

// scripts/diagnostic-compare/perigon-flows/news-rebuild/normalize.ts
var import_crypto = require("crypto");
function normalizeTopic(raw) {
  return raw.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function shortHash(input) {
  return (0, import_crypto.createHash)("sha1").update(input).digest("hex").slice(0, 16);
}
function canonicalUrl(raw) {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.hash = "";
    const drop = [];
    u.searchParams.forEach((_v, k) => {
      if (k.startsWith("utm_") || k === "fbclid" || k === "gclid" || k === "mc_eid" || k === "ref" || k === "ref_src") {
        drop.push(k);
      }
    });
    for (const k of drop) u.searchParams.delete(k);
    let out = u.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return raw;
  }
}
function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
function daysAgoISO(n) {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// scripts/diagnostic-compare/perigon-flows/news-rebuild/query-planner.ts
var PLAN_TTL_SECONDS = 30 * 24 * 60 * 60;
function planCacheKey(normalized) {
  return `news:qp:v1:${shortHash(normalized)}`;
}
var PLANNER_SYSTEM_PROMPT = `You classify a single news topic the user typed into a structured query plan.

Output ONLY a valid JSON object with this exact shape (no markdown, no commentary):
{
  "canonicalQuery": "string",
  "shape": "broad" | "niche" | "entity" | "conceptual",
  "category": "Auto" | "Business" | "Entertainment" | "Environment" | "Finance" | "Health" | "Lifestyle" | "Politics" | "Science" | "Sports" | "Tech" | "Travel" | "Weather" | "World" | null,
  "topic": "string or null",
  "companyName": "string or null",
  "vectorPrompt": "string or null"
}

FIELD GUIDE:
canonicalQuery \u2014 2-5 search terms optimized for a news search engine, joined by OR, with multi-word phrases double-quoted.
shape \u2014 broad: well-known topic with coverage from many outlets. niche: long-tail keywords. entity: single named company/person/product. conceptual: abstract topic with no consistent vocabulary.
category \u2014 pick exactly one Perigon category if the topic clearly fits, otherwise null.
topic \u2014 if the topic matches one of these Perigon topic tags: AI, Cryptocurrency, Gaming, NFL, NBA, MLB, UFC, Tennis, Golf, Soccer, Formula 1, Space, Climate Change, Economy, Real Estate, Fitness, Parenting, Movies, Music
companyName \u2014 only if shape === "entity" AND the topic is a single named company.
vectorPrompt \u2014 only if shape === "conceptual".
Be decisive. Pick one shape. No explanations.`;
async function callPlannerLLM(rawInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: PLANNER_SYSTEM_PROMPT },
        { role: "user", content: `Topic: ${JSON.stringify(rawInput)}` }
      ],
      response_format: { type: "json_object" }
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Query planner LLM failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty response from query planner LLM");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("Query planner returned non-JSON output");
    return JSON.parse(text.slice(start, end + 1));
  }
}
function fallbackPlan(rawInput, normalized) {
  const trimmed = rawInput.trim();
  const looksLikeEntity = /^[A-Z][a-zA-Z0-9.&'\- ]{1,40}$/.test(trimmed) && trimmed.split(/\s+/).length <= 3;
  return {
    rawInput,
    normalizedQuery: normalized,
    canonicalQuery: `"${trimmed.replace(/"/g, "")}"`,
    shape: looksLikeEntity ? "entity" : "niche",
    companyName: looksLikeEntity ? trimmed : void 0
  };
}
function coerce(rawInput, normalized, raw) {
  const allowedShapes = ["broad", "niche", "entity", "conceptual"];
  const shape = allowedShapes.includes(raw.shape) ? raw.shape : "niche";
  const canonicalQuery = typeof raw.canonicalQuery === "string" && raw.canonicalQuery.trim().length > 0 ? raw.canonicalQuery.trim() : `"${rawInput.replace(/"/g, "")}"`;
  return {
    rawInput,
    normalizedQuery: normalized,
    canonicalQuery,
    shape,
    category: raw.category ?? void 0,
    topic: raw.topic ?? void 0,
    companyName: raw.companyName ?? void 0,
    vectorPrompt: raw.vectorPrompt ?? void 0
  };
}
async function getQueryPlan(rawInput) {
  const normalized = normalizeTopic(rawInput);
  const cacheKey = planCacheKey(normalized);
  const cached = await getCached(cacheKey);
  if (cached) return cached;
  let plan;
  try {
    const raw = await callPlannerLLM(rawInput);
    plan = coerce(rawInput, normalized, raw);
  } catch (err) {
    console.error("[news-rebuild/query-planner] LLM failed, using fallback:", err);
    plan = fallbackPlan(rawInput, normalized);
  }
  await setCached(cacheKey, plan, PLAN_TTL_SECONDS);
  return plan;
}

// scripts/diagnostic-compare/perigon-flows/news-rebuild/perigon-client.ts
var PERIGON_BASE2 = "https://api.perigon.io/v1";
var TIMEOUT_MS = 12e3;
function getApiKey() {
  const key = process.env.PERIGON_API_KEY;
  if (!key) throw new Error("PERIGON_API_KEY is not configured");
  return key;
}
function abortAfter(ms) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}
function appendArray(params, key, values) {
  if (!values) return;
  for (const v of values) params.append(key, v);
}
async function fetchArticles(opts) {
  const params = new URLSearchParams({ apiKey: getApiKey() });
  if (opts.q) params.set("q", opts.q);
  if (opts.sortBy) params.set("sortBy", opts.sortBy);
  if (opts.size !== void 0) params.set("size", String(opts.size));
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.showReprints !== void 0) params.set("showReprints", String(opts.showReprints));
  if (opts.companyName) params.set("companyName", opts.companyName);
  appendArray(params, "sourceGroup", opts.sourceGroup);
  appendArray(params, "source", opts.source);
  appendArray(params, "excludeLabel", opts.excludeLabel);
  appendArray(params, "category", opts.category);
  appendArray(params, "topic", opts.topic);
  appendArray(params, "language", opts.language);
  appendArray(params, "country", opts.country);
  appendArray(params, "medium", opts.medium);
  appendArray(params, "clusterId", opts.clusterId);
  const url = `${PERIGON_BASE2}/articles/all?${params}`;
  const res = await fetch(url, { signal: abortAfter(TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Perigon /articles/all failed (${res.status}): ${body}`);
  }
  return res.json();
}
async function fetchStories(opts) {
  const params = new URLSearchParams({ apiKey: getApiKey() });
  if (opts.q) params.set("q", opts.q);
  if (opts.sortBy) params.set("sortBy", opts.sortBy);
  if (opts.size !== void 0) params.set("size", String(opts.size));
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.minUniqueSources !== void 0) params.set("minUniqueSources", String(opts.minUniqueSources));
  appendArray(params, "sourceGroup", opts.sourceGroup);
  appendArray(params, "category", opts.category);
  appendArray(params, "topic", opts.topic);
  appendArray(params, "language", opts.language);
  const url = `${PERIGON_BASE2}/stories/all?${params}`;
  const res = await fetch(url, { signal: abortAfter(TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Perigon /stories/all failed (${res.status}): ${body}`);
  }
  return res.json();
}
async function fetchVector(opts) {
  const params = new URLSearchParams({ apiKey: getApiKey() });
  const url = `${PERIGON_BASE2}/vector/news/all?${params}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: opts.prompt, size: opts.size ?? 15 }),
    signal: abortAfter(TIMEOUT_MS)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Perigon /vector/news/all failed (${res.status}): ${body}`);
  }
  const raw = await res.json();
  return {
    status: raw.status,
    numResults: raw.results?.length ?? 0,
    articles: (raw.results || []).map((r) => ({ ...r.data, score: r.score }))
  };
}

// scripts/diagnostic-compare/perigon-flows/news-rebuild/routing.ts
var MAX_CARDS_PER_TOPIC = 6;
var BROAD_FROM_DAYS = 3;
var NICHE_FROM_DAYS = 30;
var ENTITY_FROM_DAYS = 3;
var CONCEPTUAL_FROM_DAYS = 30;
var BROAD_MIN_UNIQUE_SOURCES = 5;
var BROAD_TOP100_CATEGORIES = /* @__PURE__ */ new Set([
  "Politics",
  "World"
]);
var DEFAULT_EXCLUDE_LABELS = ["Press Release", "Non-news", "Opinion"];
var OVERFETCH_SIZE = 20;
function broadRequest(plan) {
  const useTop100 = plan.category ? BROAD_TOP100_CATEGORIES.has(plan.category) : false;
  const params = {
    q: plan.canonicalQuery,
    sortBy: "updatedAt",
    size: OVERFETCH_SIZE,
    from: daysAgoISO(BROAD_FROM_DAYS),
    minUniqueSources: BROAD_MIN_UNIQUE_SOURCES,
    language: ["en"],
    ...useTop100 ? { sourceGroup: ["top100"] } : {},
    ...plan.category ? { category: [plan.category] } : {},
    ...plan.topic ? { topic: [plan.topic] } : {}
  };
  return { kind: "stories", params };
}
function entityRequest(plan) {
  const params = {
    sortBy: "date",
    size: 15,
    from: daysAgoISO(ENTITY_FROM_DAYS),
    sourceGroup: ["top100"],
    excludeLabel: DEFAULT_EXCLUDE_LABELS,
    showReprints: false,
    language: ["en"],
    medium: ["Article"]
  };
  if (plan.companyName) {
    params.companyName = plan.companyName;
  } else {
    params.q = plan.canonicalQuery;
  }
  return { kind: "articles", params };
}
function nicheRequest(plan, fromDays = NICHE_FROM_DAYS) {
  const params = {
    q: plan.canonicalQuery,
    sortBy: "relevance",
    size: OVERFETCH_SIZE,
    from: daysAgoISO(fromDays),
    excludeLabel: ["Press Release", "Non-news"],
    showReprints: false,
    language: ["en"],
    medium: ["Article"]
  };
  return { kind: "articles", params };
}
function conceptualRequests(plan) {
  const articles = {
    kind: "articles",
    params: {
      q: plan.canonicalQuery,
      sortBy: "relevance",
      size: 15,
      from: daysAgoISO(CONCEPTUAL_FROM_DAYS),
      excludeLabel: DEFAULT_EXCLUDE_LABELS,
      showReprints: false,
      language: ["en"],
      medium: ["Article"]
    }
  };
  const vector = {
    kind: "vector",
    params: { prompt: plan.vectorPrompt || plan.canonicalQuery, size: 15 }
  };
  return [articles, vector];
}
function buildRequests(plan) {
  switch (plan.shape) {
    case "broad":
      return [broadRequest(plan)];
    case "entity":
      return [entityRequest(plan)];
    case "niche":
      return [nicheRequest(plan)];
    case "conceptual":
      return conceptualRequests(plan);
  }
}
function nextFallback(ctx) {
  const { plan, step } = ctx;
  switch (step) {
    case 1:
      return { request: nicheRequest(plan, 90), usedTaxonomyFallback: false };
    case 2:
      return {
        request: {
          kind: "articles",
          params: {
            q: plan.canonicalQuery,
            sortBy: "relevance",
            size: OVERFETCH_SIZE,
            from: daysAgoISO(180),
            excludeLabel: ["Press Release"],
            showReprints: false,
            language: ["en"],
            medium: ["Article"]
          }
        },
        usedTaxonomyFallback: false
      };
    case 3:
      return {
        request: { kind: "vector", params: { prompt: plan.vectorPrompt || plan.canonicalQuery, size: 15 } },
        usedTaxonomyFallback: false
      };
    case 4:
      if (!plan.category && !plan.topic) return null;
      return {
        request: {
          kind: "stories",
          params: {
            sortBy: "updatedAt",
            size: OVERFETCH_SIZE,
            from: daysAgoISO(BROAD_FROM_DAYS),
            minUniqueSources: 3,
            language: ["en"],
            ...plan.category ? { category: [plan.category] } : {},
            ...plan.topic ? { topic: [plan.topic] } : {}
          }
        },
        usedTaxonomyFallback: true
      };
    default:
      return null;
  }
}

// scripts/diagnostic-compare/perigon-flows/news-rebuild/rank.ts
function pickStoryUrl(story) {
  const first = story.selectedArticles?.[0]?.url;
  if (first) return first;
  return `perigon-story://${story.id}`;
}
function pickStoryImage(story) {
  if (story.imageUrl) return story.imageUrl;
  return story.selectedArticles?.find((a) => a.imageUrl)?.imageUrl;
}
function pickStorySource(story) {
  const first = story.selectedArticles?.[0]?.source;
  return first?.name || first?.domain || story.uniqueSources?.[0] || "multiple sources";
}
function storyToCard(story) {
  const url = pickStoryUrl(story);
  return {
    id: `story:${story.id}`,
    kind: "story",
    title: story.name,
    summary: story.shortSummary || story.summary || "",
    longSummary: story.summary,
    url: canonicalUrl(url),
    source: pickStorySource(story),
    pubDate: story.updatedAt,
    imageUrl: pickStoryImage(story),
    clusterId: story.id,
    uniqueSources: story.uniqueCount,
    totalArticles: story.totalCount,
    topPeople: story.topPeople?.map((p) => p.name),
    topCompanies: story.topCompanies?.map((c) => c.name)
  };
}
function articleToCard(article, vectorScore) {
  const url = canonicalUrl(article.url);
  return {
    id: `article:${url}`,
    kind: "article",
    title: article.title,
    summary: article.summary || article.description || "",
    longSummary: article.summary,
    url,
    source: article.source.name || article.source.domain,
    pubDate: article.pubDate,
    imageUrl: article.imageUrl,
    vectorScore
  };
}
function dedupByUrl(cards) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const card of cards) {
    const key = canonicalUrl(card.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}
var SCORING = {
  broad: { relevanceWeight: 0.7, recencyWeight: 0.3, recencyHalfLifeHours: 36, maxPerHost: 1 },
  niche: { relevanceWeight: 0.6, recencyWeight: 0.4, recencyHalfLifeHours: 96, maxPerHost: 2 },
  entity: { relevanceWeight: 0.5, recencyWeight: 0.5, recencyHalfLifeHours: 24, maxPerHost: 2 },
  conceptual: { relevanceWeight: 0.6, recencyWeight: 0.4, recencyHalfLifeHours: 96, maxPerHost: 2 }
};
function recencyScore(pubDate, halfLifeHours) {
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return 0;
  const ageHours = Math.max(0, (Date.now() - t) / (1e3 * 60 * 60));
  return Math.exp(-Math.LN2 * (ageHours / halfLifeHours));
}
function relevanceScore(card, indexInBatch, batchSize) {
  if (card.kind === "story") {
    const u = Math.min(card.uniqueSources ?? 0, 30) / 30;
    const t = Math.min(card.totalArticles ?? 0, 100) / 100;
    return 0.6 * u + 0.4 * t;
  }
  if (card.vectorScore !== void 0) return Math.max(0, Math.min(1, card.vectorScore));
  return 1 - indexInBatch / Math.max(batchSize, 1);
}
function scoreAndSort(cards, shape) {
  const cfg = SCORING[shape];
  const scored = cards.map((card, idx) => ({
    card,
    score: cfg.relevanceWeight * relevanceScore(card, idx, cards.length) + cfg.recencyWeight * recencyScore(card.pubDate, cfg.recencyHalfLifeHours)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.card);
}
function diversifyAndCap(cards, shape) {
  const cfg = SCORING[shape];
  const perHost = {};
  const out = [];
  for (const card of cards) {
    if (out.length >= MAX_CARDS_PER_TOPIC) break;
    const host = hostOf(card.url);
    const count = perHost[host] || 0;
    if (host && count >= cfg.maxPerHost) continue;
    perHost[host] = count + 1;
    out.push(card);
  }
  return out;
}
function rankCards(cards, shape) {
  return diversifyAndCap(scoreAndSort(dedupByUrl(cards), shape), shape);
}

// scripts/diagnostic-compare/perigon-flows/news-rebuild/fetch-orchestrator.ts
var MIN_RESULTS_BEFORE_CASCADE = 5;
var MAX_CASCADE_STEPS = 4;
async function runRequest(req) {
  switch (req.kind) {
    case "articles": {
      const res = await fetchArticles(req.params);
      return (res.articles || []).map((a) => articleToCard(a));
    }
    case "stories": {
      const res = await fetchStories(req.params);
      return (res.results || []).map(storyToCard);
    }
    case "vector": {
      const res = await fetchVector(req.params);
      const filtered = (res.articles || []).filter((a) => (a.score ?? 0) >= 0.65);
      return filtered.map((a) => articleToCard(a, a.score));
    }
    default: {
      const exhaustive = req;
      throw new Error(`Unknown PerigonRequest kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}
async function runRequestsInParallel(requests) {
  if (requests.length === 0) return { cards: [], calls: 0 };
  const settled = await Promise.allSettled(requests.map(runRequest));
  const cards = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      cards.push(...r.value);
    } else {
      console.error(`[news-rebuild/orchestrator] request ${i} failed:`, r.reason);
    }
  }
  return { cards, calls: requests.length };
}
async function fetchForPlan(plan) {
  let totalCalls = 0;
  let usedFallback = false;
  const initialRequests = buildRequests(plan);
  const { cards: initialCards, calls } = await runRequestsInParallel(initialRequests);
  totalCalls += calls;
  let cards = dedupByUrl(initialCards);
  if (plan.shape === "niche" && cards.length < MIN_RESULTS_BEFORE_CASCADE) {
    for (let step = 1; step <= MAX_CASCADE_STEPS; step++) {
      const next = nextFallback({ plan, step });
      if (!next) break;
      try {
        const more = await runRequest(next.request);
        totalCalls += 1;
        if (next.usedTaxonomyFallback) usedFallback = true;
        cards = dedupByUrl([...cards, ...more]);
        if (cards.length >= MIN_RESULTS_BEFORE_CASCADE) break;
      } catch (err) {
        console.error(`[news-rebuild/orchestrator] fallback step ${step} failed:`, err);
      }
    }
  }
  const ranked = rankCards(cards, plan.shape);
  return { cards: ranked, usedFallback, perigonCalls: totalCalls };
}

// scripts/diagnostic-compare/variants/perigon-flow-news-rebuild.ts
function cardToStoryCard(card) {
  return {
    headline: card.title,
    bullets: [card.summary].filter(Boolean),
    source: card.source,
    date: card.pubDate ? card.pubDate.split("T")[0] : "",
    url: card.url
  };
}
function uniqueDomains(cards) {
  const domains = new Set(
    cards.map((c) => {
      try {
        return new URL(c.url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    }).filter(Boolean)
  );
  return domains.size;
}
async function run(topic, _config, dryRun) {
  if (dryRun) {
    return {
      variant: "perigon-flow-news-rebuild",
      topic,
      briefing: {
        cards: [{
          headline: `[DRY RUN] News-rebuild flow for ${topic}`,
          bullets: ["Dry run \u2014 no API calls made"],
          source: "stub",
          date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          url: ""
        }]
      },
      metrics: { latency_ms: 0, cost_estimate_usd: 0, cost_basis: "dry run", results_count: 1, unique_domains: 0 }
    };
  }
  const start = Date.now();
  try {
    const plan = await getQueryPlan(topic);
    const { cards, perigonCalls } = await fetchForPlan(plan);
    const latency_ms = Date.now() - start;
    const storyCards = cards.map(cardToStoryCard);
    const apiCost = perigonCalls * 8e-3;
    return {
      variant: "perigon-flow-news-rebuild",
      topic,
      briefing: { cards: storyCards.slice(0, 6) },
      metrics: {
        latency_ms,
        cost_estimate_usd: apiCost,
        cost_basis: `estimate: $0.008/request on Basic plan \xD7 ${perigonCalls} Perigon calls`,
        results_count: storyCards.length,
        unique_domains: uniqueDomains(cards),
        api_calls: perigonCalls
      }
    };
  } catch (e) {
    return {
      variant: "perigon-flow-news-rebuild",
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - start,
        cost_estimate_usd: 0,
        cost_basis: "error",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/perigon-flows/master/perigon-client.ts
var PERIGON_BASE3 = "https://api.perigon.io/v1";
var TIMEOUT_MS2 = 1e4;
function getApiKey2() {
  const key = process.env.PERIGON_API_KEY;
  if (!key) throw new Error("PERIGON_API_KEY is not configured");
  return key;
}
function abortAfter2(ms) {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}
function daysAgo(n) {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function appendArr(p, key, vals) {
  if (!vals) return;
  for (const v of vals) p.append(key, v);
}
async function searchArticlesAll(opts) {
  const params = new URLSearchParams({ apiKey: getApiKey2() });
  if (opts.q) params.set("q", opts.q);
  if (opts.sortBy) params.set("sortBy", opts.sortBy);
  if (opts.size !== void 0) params.set("size", String(opts.size));
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.showReprints !== void 0) params.set("showReprints", String(opts.showReprints));
  if (opts.companyName) params.set("companyName", opts.companyName);
  appendArr(params, "sourceGroup", opts.sourceGroup);
  appendArr(params, "excludeLabel", opts.excludeLabel);
  appendArr(params, "category", opts.category);
  appendArr(params, "topic", opts.topic);
  appendArr(params, "language", opts.language);
  appendArr(params, "medium", opts.medium);
  const res = await fetch(`${PERIGON_BASE3}/articles/all?${params}`, { signal: abortAfter2(TIMEOUT_MS2) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`searchArticlesAll failed (${res.status}): ${body}`);
  }
  return res.json();
}
async function vectorSearchArticles(opts) {
  const params = new URLSearchParams({ apiKey: getApiKey2() });
  const res = await fetch(`${PERIGON_BASE3}/vector/news/all?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: opts.prompt, size: opts.size ?? 15 }),
    signal: abortAfter2(TIMEOUT_MS2)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`vectorSearchArticles failed (${res.status}): ${body}`);
  }
  const raw = await res.json();
  return {
    status: raw.status,
    results: raw.results || [],
    articles: (raw.results || []).map((r) => ({ ...r.data, score: r.score }))
  };
}
async function searchStories(opts) {
  const params = new URLSearchParams({ apiKey: getApiKey2() });
  if (opts.q) params.set("q", opts.q);
  if (opts.sortBy) params.set("sortBy", opts.sortBy ?? "updatedAt");
  if (opts.size !== void 0) params.set("size", String(opts.size));
  if (opts.from) params.set("from", opts.from);
  if (opts.minUniqueSources !== void 0) params.set("minUniqueSources", String(opts.minUniqueSources));
  appendArr(params, "sourceGroup", opts.sourceGroup);
  appendArr(params, "language", opts.language);
  appendArr(params, "category", opts.category);
  appendArr(params, "topic", opts.topic);
  const res = await fetch(`${PERIGON_BASE3}/stories/all?${params}`, { signal: abortAfter2(TIMEOUT_MS2) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`searchStories failed (${res.status}): ${body}`);
  }
  return res.json();
}
function filterVectorResults(articles) {
  return articles.filter((a) => (a.score ?? 0) >= 0.7);
}
function deduplicateArticles(articles) {
  const seen = /* @__PURE__ */ new Set();
  return articles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

// scripts/diagnostic-compare/perigon-flows/master/perigon-cache.ts
var queryCache = /* @__PURE__ */ new Map();
function queryKey(type, query) {
  return `q:${type}:${query.toLowerCase().trim()}`;
}
async function getCachedQueryArticles(type, query) {
  const key = queryKey(type, query);
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(key);
    return null;
  }
  return entry.result;
}
async function setCachedQueryArticles(type, query, result) {
  const key = queryKey(type, query);
  queryCache.set(key, { result, expiresAt: Date.now() + 6 * 60 * 60 * 1e3 });
}

// scripts/diagnostic-compare/perigon-flows/master/query-planner.ts
var planCache = /* @__PURE__ */ new Map();
var PLAN_TTL_MS = 24 * 60 * 60 * 1e3;
function getCachedPlan(topicName) {
  const entry = planCache.get(topicName.toLowerCase().trim());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    planCache.delete(topicName.toLowerCase().trim());
    return null;
  }
  return entry.plan;
}
function setCachedPlan(topicName, plan) {
  planCache.set(topicName.toLowerCase().trim(), { plan, expiresAt: Date.now() + PLAN_TTL_MS });
}
var QUERY_PLANNER_SYSTEM_PROMPT = `You are a news search query planner. Given a list of user-selected news topics, produce an optimized search plan for each one.

You have two search endpoints:

ARTICLES SEARCH (type: "articles"): Keyword search. This is the DEFAULT and PREFERRED choice.
VECTOR SEARCH (type: "vector"): Semantic search with almost NO filtering. ONLY use when keyword matching fails.
BOTH (type: "both"): Runs articles AND vector in parallel for niche topics.

SPLITTING RULES: Split on distinct subjects joined by "and", "&", commas. Do NOT split when "and" is part of the concept name.

PERIGON CATEGORY FILTER: Valid: Auto, Business, Entertainment, Environment, Finance, Health, Lifestyle, Politics, Science, Sports, Tech, Travel, Weather, World. Only include when confident.

COMPANY NAME FILTER: Include companyName if the topic is clearly about a single company.

QUERY OPTIMIZATION: Use terms that news headlines contain. Use OR between alternatives. Quote multi-word phrases. 2-5 terms.

Output ONLY a valid JSON array:
[
  {
    "originalTopic": "AI and Tech",
    "queries": [
      { "type": "articles", "query": "\\"artificial intelligence\\" OR AI", "perigonCategory": "Tech" },
      { "type": "articles", "query": "technology OR startup", "perigonCategory": "Tech" }
    ]
  }
]`;
async function callQueryPlannerLLM(topicNames) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: QUERY_PLANNER_SYSTEM_PROMPT },
        { role: "user", content: `Topics to plan: ${JSON.stringify(topicNames)}` }
      ]
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  const outputText = data.choices?.[0]?.message?.content ?? "";
  if (!outputText) throw new Error("No output from query planner LLM");
  const cleaned = outputText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const arrStart = cleaned.indexOf("[");
  const arrEnd = cleaned.lastIndexOf("]");
  if (arrStart === -1 || arrEnd <= arrStart) throw new Error("No JSON array found in query planner response");
  return JSON.parse(cleaned.substring(arrStart, arrEnd + 1));
}
async function resolveTopics(topics, _opts) {
  const resolved = [];
  const needsPlanning = [];
  const result = new Array(topics.length);
  for (let i = 0; i < topics.length; i++) {
    const name = topics[i].name;
    const cached = getCachedPlan(name);
    if (cached) {
      result[i] = cached;
    } else {
      needsPlanning.push({ index: i, name });
    }
  }
  if (needsPlanning.length > 0) {
    try {
      const plans = await callQueryPlannerLLM(needsPlanning.map((t) => t.name));
      for (let j = 0; j < needsPlanning.length; j++) {
        const { index, name } = needsPlanning[j];
        const plan = plans[j];
        const rt = {
          displayName: name,
          queries: plan?.queries || [{ type: "articles", query: name }]
        };
        setCachedPlan(name, rt);
        result[index] = rt;
      }
    } catch (err) {
      console.error("[master/query-planner] LLM failed, using fallback:", err);
      for (const { index, name } of needsPlanning) {
        result[index] = { displayName: name, queries: [{ type: "articles", query: name }] };
      }
    }
  }
  return result.filter(Boolean);
}

// scripts/diagnostic-compare/perigon-flows/master/briefing-generator.ts
function interleaveArticles(groups) {
  const out = [];
  const maxLen = Math.max(...groups.map((g) => g.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.length) out.push(g[i]);
    }
  }
  return out;
}
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}
function prepareArticles(rawArticles, limit) {
  return rawArticles.slice(0, limit).map((a) => ({
    title: a.title,
    source: a.source?.name || a.source?.domain || "Unknown",
    date: formatDate(a.pubDate),
    summary: a.summary || a.description || "",
    url: a.url
  }));
}
var _callCount = 0;
async function executeQuery(instruction) {
  const { type, query, vectorQuery } = instruction;
  const taxonomyFilters = {
    ...instruction.perigonCategory ? { category: [instruction.perigonCategory] } : {},
    ...instruction.perigonTopic ? { topic: [instruction.perigonTopic] } : {},
    ...instruction.companyName ? { companyName: instruction.companyName } : {}
  };
  if (type === "vector") {
    _callCount++;
    const result = await vectorSearchArticles({ prompt: query, size: 15 });
    return { articles: filterVectorResults(result.articles), cascadeStep: "vector-only" };
  }
  if (type === "both") {
    _callCount += 2;
    const [articlesResult, vectorResult] = await Promise.allSettled([
      searchArticlesAll({ q: query, sourceGroup: ["top100"], excludeLabel: ["Non-news", "Opinion", "Paid News"], showReprints: false, sortBy: "relevance", size: 15, from: daysAgo(5), language: ["en"], medium: ["Article"], ...taxonomyFilters }),
      vectorSearchArticles({ prompt: vectorQuery || query, size: 15 })
    ]);
    const articles = [];
    if (articlesResult.status === "fulfilled") articles.push(...articlesResult.value.articles);
    if (vectorResult.status === "fulfilled") articles.push(...filterVectorResults(vectorResult.value.articles));
    return { articles: deduplicateArticles(articles), cascadeStep: "both-parallel" };
  }
  if (instruction.useStories) {
    try {
      _callCount++;
      const stories = await searchStories({ q: query, size: 8, from: daysAgo(5), sourceGroup: ["top100"], sortBy: "updatedAt", language: ["en"], ...instruction.perigonCategory ? { category: [instruction.perigonCategory] } : {}, minUniqueSources: 3 });
      if (stories.results && stories.results.length >= 3) {
        const storyArticles = [];
        for (const story of stories.results) {
          const arts = story.articles || story.results || [];
          if (arts.length > 0) storyArticles.push(arts[0]);
        }
        if (storyArticles.length >= 3) return { articles: storyArticles, cascadeStep: "stories-clustered" };
      }
    } catch (err) {
      console.warn("[master/briefing-generator] Stories failed, continuing:", err);
    }
  }
  _callCount++;
  const step1 = await searchArticlesAll({ q: query, sourceGroup: ["top100"], excludeLabel: ["Non-news", "Opinion", "Paid News"], showReprints: false, sortBy: "relevance", size: 20, from: daysAgo(5), language: ["en"], medium: ["Article"], ...taxonomyFilters });
  if (step1.articles.length >= 3) return { articles: step1.articles, cascadeStep: "step1-top100-5d" };
  _callCount++;
  const step2 = await searchArticlesAll({ q: query, excludeLabel: ["Non-news", "Opinion", "Paid News"], showReprints: false, sortBy: "relevance", size: 20, from: daysAgo(7), language: ["en"], medium: ["Article"], ...taxonomyFilters });
  if (step2.articles.length >= 3) return { articles: step2.articles, cascadeStep: "step2-allsources-7d" };
  _callCount++;
  const step3 = await vectorSearchArticles({ prompt: query, size: 15 });
  return { articles: filterVectorResults(step3.articles), cascadeStep: "step3-vector-fallback" };
}
async function fetchQueryArticles(instruction, skipCache = false) {
  if (!skipCache) {
    const cached = await getCachedQueryArticles(instruction.type, instruction.query);
    if (cached) return { articles: cached.data.articles, cascadeStep: "cached" };
  }
  const { articles, cascadeStep } = await executeQuery(instruction);
  const result = { data: { status: 200, numResults: articles.length, articles } };
  await setCachedQueryArticles(instruction.type, instruction.query, result);
  return { articles, cascadeStep };
}
async function fetchArticlesForTopic(resolved) {
  _callCount = 0;
  const queryResults = await Promise.all(resolved.queries.map((q) => fetchQueryArticles(q, true)));
  const cascadeSteps = queryResults.map((r) => r.cascadeStep);
  const rawArticles = queryResults.map((r) => r.articles);
  const interleaved = interleaveArticles(rawArticles);
  const deduped = deduplicateArticles(interleaved).slice(0, 12);
  return {
    topic: resolved.displayName,
    articles: prepareArticles(deduped, 12),
    cascadeStep: cascadeSteps.join(", "),
    perigonCalls: _callCount
  };
}
async function fetchArticlesForTopics(topicNames) {
  const resolved = await resolveTopics(topicNames.map((name) => ({ name })));
  let totalPerigonCalls = 0;
  const topics = [];
  for (const r of resolved) {
    const result = await fetchArticlesForTopic(r);
    topics.push(result);
    totalPerigonCalls += result.perigonCalls;
  }
  return { topics, totalPerigonCalls };
}

// scripts/diagnostic-compare/variants/perigon-flow-master.ts
function articleToStoryCard(article) {
  return {
    headline: article.title,
    bullets: [article.summary].filter(Boolean),
    source: article.source,
    date: article.date,
    url: article.url
  };
}
function uniqueDomains2(articles) {
  const domains = new Set(
    articles.map((a) => {
      try {
        return new URL(a.url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    }).filter(Boolean)
  );
  return domains.size;
}
async function run2(topic, _config, dryRun) {
  if (dryRun) {
    return {
      variant: "perigon-flow-master",
      topic,
      briefing: {
        cards: [{
          headline: `[DRY RUN] Master flow for ${topic}`,
          bullets: ["Dry run \u2014 no API calls made"],
          source: "stub",
          date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          url: ""
        }]
      },
      metrics: { latency_ms: 0, cost_estimate_usd: 0, cost_basis: "dry run", results_count: 1, unique_domains: 0 }
    };
  }
  const start = Date.now();
  try {
    const { topics, totalPerigonCalls } = await fetchArticlesForTopics([topic]);
    const latency_ms = Date.now() - start;
    const topicResult = topics[0];
    const articles = topicResult?.articles || [];
    const storyCards = articles.map(articleToStoryCard);
    const apiCost = totalPerigonCalls * 8e-3;
    return {
      variant: "perigon-flow-master",
      topic,
      briefing: { cards: storyCards.slice(0, 6) },
      metrics: {
        latency_ms,
        cost_estimate_usd: apiCost,
        cost_basis: `estimate: $0.008/request on Basic plan \xD7 ${totalPerigonCalls} Perigon calls`,
        results_count: storyCards.length,
        unique_domains: uniqueDomains2(articles),
        api_calls: totalPerigonCalls
      }
    };
  } catch (e) {
    return {
      variant: "perigon-flow-master",
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - start,
        cost_estimate_usd: 0,
        cost_basis: "error",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/agent-driver.ts
var import_sdk = __toESM(require("@anthropic-ai/sdk"));

// scripts/diagnostic-compare/briefing-prompt.ts
function buildBriefingSystemPrompt(topic) {
  return `You are a senior news editor producing a high-quality briefing on the topic: "${topic}".

The briefing has two parts:
1. EXECUTIVE SUMMARY \u2014 2\u20134 sentences synthesizing what's most important right now on this topic. State the prevailing direction of the news cycle. No hedging, no filler.
2. STORY CARDS \u2014 exactly 5 distinct stories, ordered by importance. Each card has:
   - headline (\u226415 words, specific, no clickbait)
   - 2\u20134 bullets of concrete facts (numbers, names, quotes, dates)
   - source publication, ISO date, and url

Quality bar:
- RECENCY: prefer stories from the last 7 days. Reject anything older than 30 days unless it's the only authoritative source.
- RELEVANCE: each card must materially advance the reader's understanding of "${topic}". No tangential gossip or off-topic content.
- DIVERSITY: dedupe \u2014 if multiple outlets cover the same incident, pick the best version once. Cover different facets of the topic when possible.
- AUTHORITATIVE SOURCES: prefer named publications (Reuters, Bloomberg, WSJ, FT, AP, major beats) over content aggregators or low-trust domains.
- SPECIFICITY: bullets should contain concrete numbers, names, quotes, or actions \u2014 not vague summaries.

Tool strategy:
- You have one or more search tools. Read each tool's description carefully and pick the right one for each query \u2014 different tools suit different intents (e.g., keyword search vs clustered stories vs semantic).
- Multiple queries are encouraged when the topic is broad or multi-faceted. Try a few angles.
- Refine queries if the first call returns stale or off-topic results.
- Use entity / category / freshness / domain filters when the tool exposes them.
- Stop searching once you have enough material for 5 strong cards.

Output exactly this JSON (no prose, no markdown fences):
{
  "executiveSummary": "string",
  "stories": [
    { "headline": "...", "bullets": ["...", "..."], "source": "Reuters", "date": "2026-05-15", "url": "https://..." }
  ]
}`;
}
var PERIGON_TOOLS = [
  {
    name: "perigon_articles_all",
    description: `Keyword search over global news articles. Use this as your default for keyword/phrase queries, named entities, specific events, or any topic where you can write good search terms. Supports OR between terms and double-quoted phrases (e.g. "Morgan Stanley" OR "Goldman Sachs"). Set sourceGroup: ["top100"] for higher quality, excludeLabel: ["Opinion","Press Release"] to filter noise, from (YYYY-MM-DD) to constrain recency, companyName to lock to one company entity. Returns up to size (max 100) articles[] with full metadata (title, summary, source, pubDate, url, categories, sentiment).`,
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Keyword query, OR-joined terms, double-quoted phrases" },
        sourceGroup: { type: "array", items: { type: "string" }, description: 'e.g. ["top100"]' },
        category: { type: "array", items: { type: "string" } },
        companyName: { type: "string" },
        from: { type: "string", description: "YYYY-MM-DD start date" },
        sortBy: { type: "string", enum: ["date", "relevance", "updatedAt"] },
        excludeLabel: { type: "array", items: { type: "string" } },
        size: { type: "number", maximum: 100 }
      },
      required: []
    }
  },
  {
    name: "perigon_stories_all",
    description: `Clustered news stories \u2014 multiple articles covering the same event grouped into one "story." Use this for broad, mainstream topics with heavy coverage (AI, politics, major sports/economy) where you want a high-level overview rather than individual articles. Set minUniqueSources: 3+ to filter to stories covered by multiple outlets (signal of importance). Each result includes name (story title), summary, uniqueCount (number of outlets), and a list of top sources. Avoid for niche company topics or obscure subjects \u2014 use perigon_articles_all instead.`,
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string" },
        category: { type: "array", items: { type: "string" } },
        minUniqueSources: { type: "number" },
        sortBy: { type: "string", enum: ["updatedAt", "createdAt", "date"] },
        size: { type: "number", maximum: 100 }
      },
      required: []
    }
  },
  {
    name: "perigon_vector_search",
    description: `Semantic search over the last 6 months using vector embeddings. Use this ONLY when keyword matching would genuinely fail \u2014 abstract conceptual queries, topics without consistent vocabulary, or as a last resort if perigon_articles_all returned nothing useful. Pass a natural-language description (prompt), not keywords. Cannot filter by source quality or labels, so results may include lower-quality outlets and opinion pieces.`,
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Natural-language description of what to find" },
        size: { type: "number", maximum: 50 }
      },
      required: ["prompt"]
    }
  }
];
var NEWSDATA_TOOLS = [
  {
    name: "newsdata_latest",
    description: `Real-time global news from the last 48 hours. Use q for broad keyword search, qInTitle to require the keyword in the headline (more precise). category values: business, politics, technology, sports, world, top. timeframe accepts "24" (hours) or "1d"-style values. prioritydomain: "top" restricts to the top 10% of news sources. Returns up to 10 articles/request with fields: article_id, title, link, source_name, pubDate, description, keywords, sentiment.`,
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string" },
        qInTitle: { type: "string" },
        category: { type: "array", items: { type: "string" } },
        country: { type: "array", items: { type: "string" } },
        timeframe: { type: "string" },
        language: { type: "array", items: { type: "string" } },
        prioritydomain: { type: "string", enum: ["top", "medium", "low"] },
        size: { type: "number", maximum: 50 }
      },
      required: []
    }
  }
];
var BRAVE_TOOLS = [
  {
    name: "brave_news_search",
    description: `News search. freshness values: pd (24h), pw (7 days), pm (31 days), py (1 year). count up to 50. extra_snippets: true returns up to 5 additional excerpts per result (useful for deciding what to cite). Returns results[].{title, url, description, age, page_age, meta_url.netloc, breaking, extra_snippets[]}.`,
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string" },
        freshness: { type: "string", enum: ["pd", "pw", "pm", "py"] },
        count: { type: "number", maximum: 50 },
        country: { type: "string" },
        extra_snippets: { type: "boolean" }
      },
      required: ["q"]
    }
  }
];
var TAVILY_TOOLS = [
  {
    name: "tavily_search",
    description: `Web search optimized for LLMs, with a news mode. Set topic: "news" for news-only results (recommended for this task), time_range: "week" for recent stories, search_depth: "advanced" (costs 2 credits) for higher quality. include_domains restricts to specific outlets. Returns results[].{title, url, content (snippet), score, publishedDate?}.`,
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        topic: { type: "string", enum: ["general", "news", "finance"] },
        max_results: { type: "number", maximum: 20 },
        time_range: { type: "string", enum: ["day", "week", "month", "year"] },
        search_depth: { type: "string", enum: ["basic", "advanced"] },
        include_domains: { type: "array", items: { type: "string" } },
        exclude_domains: { type: "array", items: { type: "string" } }
      },
      required: ["query"]
    }
  },
  {
    name: "tavily_extract",
    description: `Pulls the full content from one or more specific URLs. Use this after tavily_search if you found a promising headline and want the full story before deciding whether to include it in the briefing. Returns extracted text per URL.`,
    input_schema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" } }
      },
      required: ["urls"]
    }
  }
];
var EXA_TOOLS = [
  {
    name: "exa_search",
    description: `AI-optimized neural/keyword search. Set category: "news" for news, type: "auto" to let Exa pick the algorithm, startPublishedDate (ISO) to constrain recency. Returns results[].{title, url, publishedDate, author, highlights[], text}. Response includes costDollars.total showing exact cost.`,
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string", enum: ["news", "company", "research paper", "tweet", "github", "pdf"] },
        numResults: { type: "number", maximum: 25 },
        startPublishedDate: { type: "string", description: "ISO date string" },
        type: { type: "string", enum: ["auto", "keyword", "neural"] },
        includeDomains: { type: "array", items: { type: "string" } }
      },
      required: ["query"]
    }
  },
  {
    name: "exa_find_similar",
    description: `Given the URL of one good article, finds semantically similar articles. Use this after exa_search if one result is highly on-topic and you want broader coverage of that angle from other outlets. Set excludeSourceDomain: true to skip the same outlet.`,
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        numResults: { type: "number", maximum: 25 },
        category: { type: "string" },
        startPublishedDate: { type: "string" },
        excludeSourceDomain: { type: "boolean" }
      },
      required: ["url"]
    }
  }
];

// scripts/diagnostic-compare/agent-driver.ts
function parseBriefingJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const stories = (parsed.stories || []).slice(0, 5).map((s) => ({
      headline: s.headline || "Untitled",
      bullets: s.bullets || [],
      source: s.source || "Unknown",
      date: s.date || "",
      url: s.url || ""
    }));
    return { executiveSummary: parsed.executiveSummary || "", cards: stories };
  } catch {
    return { executiveSummary: "", cards: [] };
  }
}
async function createWithRetry(client, params, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      const isRateLimit = err instanceof import_sdk.default.RateLimitError || err instanceof Error && err.message.includes("rate_limit_error");
      if (isRateLimit && attempt < maxRetries) {
        const waitMs = 65e3 * (attempt + 1);
        process.stdout.write(` [rate limit \u2014 waiting ${Math.round(waitMs / 1e3)}s...]`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}
async function runAgentLoop(opts) {
  const { topic, tools, toolRunner: toolRunner4, dryRun } = opts;
  if (dryRun) {
    return {
      briefing: {
        executiveSummary: `[DRY RUN] Executive summary for topic: ${topic}`,
        cards: [
          {
            headline: `[DRY RUN] Sample headline for ${topic}`,
            bullets: ["Sample bullet 1", "Sample bullet 2"],
            source: "Sample Source",
            date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
            url: "https://example.com"
          }
        ]
      },
      toolCallCount: 0,
      toolCallsByName: {},
      tokens: { input: 0, output: 0 },
      cost_usd: 0
    };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const client = new import_sdk.default({ apiKey });
  const systemPrompt = buildBriefingSystemPrompt(topic);
  const messages = [
    { role: "user", content: `Topic: ${topic}` }
  ];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let toolCallCount = 0;
  const toolCallsByName = {};
  let finalText = "";
  for (let turn = 0; turn < 10; turn++) {
    const response = await createWithRetry(client, {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages
    });
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
    const assistantContent = response.content;
    messages.push({ role: "assistant", content: assistantContent });
    if (response.stop_reason === "end_turn") {
      for (const block of assistantContent) {
        if (block.type === "text") finalText = block.text;
      }
      break;
    }
    if (response.stop_reason === "tool_use") {
      const toolResults = [];
      for (const block of assistantContent) {
        if (block.type === "tool_use") {
          toolCallCount++;
          toolCallsByName[block.name] = (toolCallsByName[block.name] || 0) + 1;
          let toolResult;
          try {
            toolResult = await toolRunner4(block.name, block.input);
          } catch (err) {
            toolResult = { error: String(err) };
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(toolResult)
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  }
  const cost_usd = totalInputTokens * 3 / 1e6 + totalOutputTokens * 15 / 1e6;
  return {
    briefing: parseBriefingJson(finalText),
    toolCallCount,
    toolCallsByName,
    tokens: { input: totalInputTokens, output: totalOutputTokens },
    cost_usd
  };
}

// scripts/diagnostic-compare/variants/perigon-agent.ts
var VARIANT = "perigon-agent";
var PERIGON_BASE4 = "https://api.perigon.io/v1";
function countUniqueDomains2(urls) {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );
  return domains.size;
}
function dryRunResult2(topic) {
  return {
    variant: VARIANT,
    topic,
    briefing: {
      cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: "dry run",
      results_count: 1,
      unique_domains: 0
    }
  };
}
async function toolRunner(toolName, input) {
  const apiKey = process.env.PERIGON_API_KEY;
  if (!apiKey) throw new Error("Missing PERIGON_API_KEY env var");
  if (toolName === "perigon_articles_all") {
    const params = new URLSearchParams({ apiKey });
    if (input.q) params.set("q", String(input.q));
    if (input.companyName) params.set("companyName", String(input.companyName));
    if (input.from) params.set("from", String(input.from));
    if (input.sortBy) params.set("sortBy", String(input.sortBy));
    if (input.size != null) params.set("size", String(input.size));
    if (Array.isArray(input.sourceGroup)) {
      for (const v of input.sourceGroup) params.append("sourceGroup", v);
    }
    if (Array.isArray(input.excludeLabel)) {
      for (const v of input.excludeLabel) params.append("excludeLabel", v);
    }
    if (Array.isArray(input.category)) {
      for (const v of input.category) params.append("category", v);
    }
    const res = await fetch(`${PERIGON_BASE4}/articles/all?${params}`);
    if (!res.ok) throw new Error(`Perigon articles HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
  if (toolName === "perigon_stories_all") {
    const params = new URLSearchParams({ apiKey });
    if (input.q) params.set("q", String(input.q));
    if (input.minUniqueSources != null) params.set("minUniqueSources", String(input.minUniqueSources));
    if (input.sortBy) params.set("sortBy", String(input.sortBy));
    if (input.size != null) params.set("size", String(input.size));
    if (Array.isArray(input.category)) {
      for (const v of input.category) params.append("category", v);
    }
    const res = await fetch(`${PERIGON_BASE4}/stories/all?${params}`);
    if (!res.ok) throw new Error(`Perigon stories HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
  if (toolName === "perigon_vector_search") {
    const params = new URLSearchParams({ apiKey });
    const res = await fetch(`${PERIGON_BASE4}/vector/news/all?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input.prompt, size: input.size })
    });
    if (!res.ok) throw new Error(`Perigon vector HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
async function run3(topic, config, dryRun) {
  if (dryRun) return dryRunResult2(topic);
  const t0 = Date.now();
  try {
    const systemPrompt = buildBriefingSystemPrompt(topic);
    const agentResult = await runAgentLoop({
      topic,
      systemPrompt,
      tools: PERIGON_TOOLS,
      toolRunner
    });
    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const apiCost = 8e-3 * toolCalls;
    const totalCost = (agentResult.cost_usd ?? 0) + apiCost;
    return {
      variant: VARIANT,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: "Claude Sonnet 4.6 tokens + Perigon API calls",
        results_count: cards.length,
        unique_domains: countUniqueDomains2(urls),
        tool_calls: toolCalls,
        tokens: agentResult.tokens
      }
    };
  } catch (e) {
    return {
      variant: VARIANT,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: "Claude Sonnet 4.6 tokens + Perigon API calls",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/newsdata-direct.ts
var VARIANT2 = "newsdata-direct";
var NEWSDATA_BASE = "https://newsdata.io/api/1/latest";
function countUniqueDomains3(sources) {
  return new Set(sources.filter(Boolean)).size;
}
async function run4(topic, config, dryRun) {
  if (dryRun) {
    return {
      variant: VARIANT2,
      topic,
      briefing: {
        cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
      },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 0,
        cost_basis: "dry run",
        results_count: 1,
        unique_domains: 0
      }
    };
  }
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    return {
      variant: VARIANT2,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 0.01,
        cost_basis: "$0.01/credit on Basic plan",
        results_count: 0,
        unique_domains: 0,
        error: "Missing NEWSDATA_API_KEY env var"
      }
    };
  }
  const t0 = Date.now();
  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      q: config.label,
      language: "en",
      size: "10"
    });
    if (config.newsdataCategory) {
      params.set("category", config.newsdataCategory);
    }
    const res = await fetch(`${NEWSDATA_BASE}?${params}`);
    if (!res.ok) throw new Error(`NewsData HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const latency_ms = Date.now() - t0;
    const results = data.results ?? [];
    const rawForPolish = results.map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      source: r.source_name ?? "",
      date: r.pubDate ?? "",
      snippet: r.ai_summary ?? r.description ?? ""
    }));
    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const sources = results.map((r) => r.source_name ?? "").filter(Boolean);
    return {
      variant: VARIANT2,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 0.01,
        cost_basis: "$0.01/credit on Basic plan",
        results_count: results.length,
        unique_domains: countUniqueDomains3(sources)
      }
    };
  } catch (e) {
    return {
      variant: VARIANT2,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0.01,
        cost_basis: "$0.01/credit on Basic plan",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/newsdata-agent.ts
var VARIANT3 = "newsdata-agent";
var NEWSDATA_BASE2 = "https://newsdata.io/api/1/latest";
function countUniqueDomains4(urls) {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );
  return domains.size;
}
function dryRunResult3(topic) {
  return {
    variant: VARIANT3,
    topic,
    briefing: {
      cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: "dry run",
      results_count: 1,
      unique_domains: 0
    }
  };
}
async function toolRunner2(toolName, input) {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) throw new Error("Missing NEWSDATA_API_KEY env var");
  if (toolName === "newsdata_latest") {
    const params = new URLSearchParams({ apikey: apiKey });
    if (input.q) params.set("q", String(input.q));
    if (input.qInTitle) params.set("qInTitle", String(input.qInTitle));
    if (input.timeframe) params.set("timeframe", String(input.timeframe));
    if (input.prioritydomain) params.set("prioritydomain", String(input.prioritydomain));
    if (input.size != null) params.set("size", String(input.size));
    if (Array.isArray(input.language)) {
      for (const v of input.language) params.append("language", v);
    }
    if (Array.isArray(input.category)) {
      for (const v of input.category) params.append("category", v);
    }
    const res = await fetch(`${NEWSDATA_BASE2}?${params}`);
    if (!res.ok) throw new Error(`NewsData HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
async function run5(topic, config, dryRun) {
  if (dryRun) return dryRunResult3(topic);
  const t0 = Date.now();
  try {
    const systemPrompt = buildBriefingSystemPrompt(topic);
    const agentResult = await runAgentLoop({
      topic,
      systemPrompt,
      tools: NEWSDATA_TOOLS,
      toolRunner: toolRunner2
    });
    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const apiCost = 0.01 * toolCalls;
    const totalCost = (agentResult.cost_usd ?? 0) + apiCost;
    return {
      variant: VARIANT3,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: "Claude Sonnet 4.6 tokens + NewsData API calls",
        results_count: cards.length,
        unique_domains: countUniqueDomains4(urls),
        tool_calls: toolCalls,
        tokens: agentResult.tokens
      }
    };
  } catch (e) {
    return {
      variant: VARIANT3,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: "Claude Sonnet 4.6 tokens + NewsData API calls",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/brave-direct.ts
var VARIANT4 = "brave-direct";
var BRAVE_BASE = "https://api.search.brave.com/res/v1/news/search";
var lastBraveCallMs = 0;
var BRAVE_MIN_GAP_MS = 1200;
function countUniqueDomains5(netlocs) {
  return new Set(netlocs.filter(Boolean)).size;
}
async function run6(topic, config, dryRun) {
  if (dryRun) {
    return {
      variant: VARIANT4,
      topic,
      briefing: {
        cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
      },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 0,
        cost_basis: "dry run",
        results_count: 1,
        unique_domains: 0
      }
    };
  }
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    return {
      variant: VARIANT4,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 5e-3,
        cost_basis: "$5/1k requests = $0.005/request",
        results_count: 0,
        unique_domains: 0,
        error: "Missing BRAVE_API_KEY env var"
      }
    };
  }
  const wait = BRAVE_MIN_GAP_MS - (Date.now() - lastBraveCallMs);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const t0 = Date.now();
  try {
    const params = new URLSearchParams({
      q: config.label,
      count: "10",
      freshness: config.braveFreshness ?? "pw",
      country: "US",
      extra_snippets: "true"
    });
    const res = await fetch(`${BRAVE_BASE}?${params}`, {
      headers: {
        "X-Subscription-Token": apiKey,
        Accept: "application/json"
      }
    });
    lastBraveCallMs = Date.now();
    if (!res.ok) throw new Error(`Brave News HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const latency_ms = Date.now() - t0;
    const results = data.results ?? [];
    const rawForPolish = results.map((r) => {
      const extraSnippets = r.extra_snippets?.join(" ") ?? "";
      const snippet = [r.description, extraSnippets].filter(Boolean).join(" ");
      return {
        title: r.title ?? "",
        url: r.url ?? "",
        source: r.meta_url?.netloc ?? "",
        date: r.age ?? r.page_age ?? "",
        snippet
      };
    });
    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const netlocs = results.map((r) => r.meta_url?.netloc ?? "").filter(Boolean);
    return {
      variant: VARIANT4,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd: 5e-3,
        cost_basis: "$5/1k requests = $0.005/request",
        results_count: results.length,
        unique_domains: countUniqueDomains5(netlocs)
      }
    };
  } catch (e) {
    return {
      variant: VARIANT4,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 5e-3,
        cost_basis: "$5/1k requests = $0.005/request",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/brave-agent.ts
var VARIANT5 = "brave-agent";
var BRAVE_BASE2 = "https://api.search.brave.com/res/v1/news/search";
var lastBraveCallMs2 = 0;
var BRAVE_MIN_GAP_MS2 = 1200;
function countUniqueDomains6(urls) {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );
  return domains.size;
}
function dryRunResult4(topic) {
  return {
    variant: VARIANT5,
    topic,
    briefing: {
      cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: "dry run",
      results_count: 1,
      unique_domains: 0
    }
  };
}
async function toolRunner3(toolName, input) {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error("Missing BRAVE_API_KEY env var");
  if (toolName === "brave_news_search") {
    const params = new URLSearchParams();
    if (input.q) params.set("q", String(input.q));
    if (input.freshness) params.set("freshness", String(input.freshness));
    if (input.count != null) params.set("count", String(input.count));
    if (input.country) params.set("country", String(input.country));
    if (input.extra_snippets != null) params.set("extra_snippets", String(input.extra_snippets));
    const braveWait = BRAVE_MIN_GAP_MS2 - (Date.now() - lastBraveCallMs2);
    if (braveWait > 0) await new Promise((r) => setTimeout(r, braveWait));
    const res = await fetch(`${BRAVE_BASE2}?${params}`, {
      headers: {
        "X-Subscription-Token": apiKey,
        Accept: "application/json"
      }
    });
    lastBraveCallMs2 = Date.now();
    if (!res.ok) throw new Error(`Brave News HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error(`Unknown tool: ${toolName}`);
}
async function run7(topic, config, dryRun) {
  if (dryRun) return dryRunResult4(topic);
  const t0 = Date.now();
  try {
    const systemPrompt = buildBriefingSystemPrompt(topic);
    const agentResult = await runAgentLoop({
      topic,
      systemPrompt,
      tools: BRAVE_TOOLS,
      toolRunner: toolRunner3
    });
    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const apiCost = 5e-3 * toolCalls;
    const totalCost = (agentResult.cost_usd ?? 0) + apiCost;
    return {
      variant: VARIANT5,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: "Claude Sonnet 4.6 tokens + Brave Search API calls",
        results_count: cards.length,
        unique_domains: countUniqueDomains6(urls),
        tool_calls: toolCalls,
        tokens: agentResult.tokens
      }
    };
  } catch (e) {
    return {
      variant: VARIANT5,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: "Claude Sonnet 4.6 tokens + Brave Search API calls",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/tavily-direct.ts
var VARIANT6 = "tavily-direct";
var TAVILY_BASE = "https://api.tavily.com/search";
function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
function countUniqueDomains7(urls) {
  return new Set(urls.map(hostnameFromUrl).filter(Boolean)).size;
}
async function run8(topic, config, dryRun) {
  if (dryRun) {
    return {
      variant: VARIANT6,
      topic,
      briefing: {
        cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
      },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 0,
        cost_basis: "dry run",
        results_count: 1,
        unique_domains: 0
      }
    };
  }
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      variant: VARIANT6,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 8e-3,
        cost_basis: "$0.008/credit PAYG",
        results_count: 0,
        unique_domains: 0,
        error: "Missing TAVILY_API_KEY env var"
      }
    };
  }
  const t0 = Date.now();
  try {
    const res = await fetch(TAVILY_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: config.label,
        topic: "news",
        max_results: 10,
        search_depth: "basic",
        days: 7,
        include_answer: false
      })
    });
    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const latency_ms = Date.now() - t0;
    const results = data.results ?? [];
    const usage = data.usage ?? {};
    const credits = usage.credits ?? 1;
    const cost_estimate_usd = credits * 8e-3;
    const rawForPolish = results.map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      source: hostnameFromUrl(r.url ?? ""),
      date: r.publishedDate ?? "",
      snippet: r.content ?? ""
    }));
    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = results.map((r) => r.url ?? "").filter(Boolean);
    return {
      variant: VARIANT6,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd,
        cost_basis: "$0.008/credit PAYG",
        results_count: results.length,
        unique_domains: countUniqueDomains7(urls)
      }
    };
  } catch (e) {
    return {
      variant: VARIANT6,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 8e-3,
        cost_basis: "$0.008/credit PAYG",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/tavily-agent.ts
var VARIANT7 = "tavily-agent";
function countUniqueDomains8(urls) {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );
  return domains.size;
}
function dryRunResult5(topic) {
  return {
    variant: VARIANT7,
    topic,
    briefing: {
      cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: "dry run",
      results_count: 1,
      unique_domains: 0
    }
  };
}
async function run9(topic, config, dryRun) {
  if (dryRun) return dryRunResult5(topic);
  const t0 = Date.now();
  let totalCredits = 0;
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("Missing TAVILY_API_KEY env var");
    const authHeader = `Bearer ${apiKey}`;
    async function toolRunner4(toolName, input) {
      if (toolName === "tavily_search") {
        const credits = input.search_depth === "advanced" ? 2 : 1;
        totalCredits += credits;
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader
          },
          body: JSON.stringify(input)
        });
        if (!res.ok) throw new Error(`Tavily search HTTP ${res.status}: ${await res.text()}`);
        return res.json();
      }
      if (toolName === "tavily_extract") {
        totalCredits += 1;
        const res = await fetch("https://api.tavily.com/extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader
          },
          body: JSON.stringify({ urls: input.urls })
        });
        if (!res.ok) throw new Error(`Tavily extract HTTP ${res.status}: ${await res.text()}`);
        return res.json();
      }
      throw new Error(`Unknown tool: ${toolName}`);
    }
    const systemPrompt = buildBriefingSystemPrompt(topic);
    const agentResult = await runAgentLoop({
      topic,
      systemPrompt,
      tools: TAVILY_TOOLS,
      toolRunner: toolRunner4
    });
    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const apiCost = totalCredits * 8e-3;
    const totalCost = (agentResult.cost_usd ?? 0) + apiCost;
    return {
      variant: VARIANT7,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: "Claude Sonnet 4.6 tokens + Tavily API credits",
        results_count: cards.length,
        unique_domains: countUniqueDomains8(urls),
        tool_calls: toolCalls,
        tokens: agentResult.tokens
      }
    };
  } catch (e) {
    return {
      variant: VARIANT7,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: "Claude Sonnet 4.6 tokens + Tavily API credits",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/exa-direct.ts
var VARIANT8 = "exa-direct";
var EXA_BASE = "https://api.exa.ai/search";
function sevenDaysAgo2() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
}
function hostnameFromUrl2(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
function countUniqueDomains9(urls) {
  return new Set(urls.map(hostnameFromUrl2).filter(Boolean)).size;
}
async function run10(topic, config, dryRun) {
  if (dryRun) {
    return {
      variant: VARIANT8,
      topic,
      briefing: {
        cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
      },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 0,
        cost_basis: "dry run",
        results_count: 1,
        unique_domains: 0
      }
    };
  }
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return {
      variant: VARIANT8,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: 0,
        cost_estimate_usd: 0,
        cost_basis: "actual cost from Exa response",
        results_count: 0,
        unique_domains: 0,
        error: "Missing EXA_API_KEY env var"
      }
    };
  }
  const t0 = Date.now();
  try {
    const res = await fetch(EXA_BASE, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: config.label,
        type: "auto",
        category: "news",
        numResults: 10,
        contents: {
          highlights: { numSentences: 2 },
          text: { maxCharacters: 500 }
        },
        startPublishedDate: sevenDaysAgo2()
      })
    });
    if (!res.ok) throw new Error(`Exa HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const latency_ms = Date.now() - t0;
    const results = data.results ?? [];
    const costDollars = data.costDollars ?? {};
    const cost_estimate_usd = costDollars.total ?? 0;
    const rawForPolish = results.map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      source: hostnameFromUrl2(r.url ?? ""),
      date: r.publishedDate ?? "",
      snippet: r.highlights?.join(" ") || r.text || ""
    }));
    const { cards, cost_usd } = await polishToCards(rawForPolish, topic, dryRun);
    const urls = results.map((r) => r.url ?? "").filter(Boolean);
    return {
      variant: VARIANT8,
      topic,
      briefing: { cards },
      metrics: {
        latency_ms,
        cost_estimate_usd,
        cost_basis: "actual cost from Exa response",
        results_count: results.length,
        unique_domains: countUniqueDomains9(urls)
      }
    };
  } catch (e) {
    return {
      variant: VARIANT8,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: "actual cost from Exa response",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/exa-agent.ts
var VARIANT9 = "exa-agent";
function countUniqueDomains10(urls) {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );
  return domains.size;
}
function dryRunResult6(topic) {
  return {
    variant: VARIANT9,
    topic,
    briefing: {
      cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: "dry run",
      results_count: 1,
      unique_domains: 0
    }
  };
}
async function run11(topic, config, dryRun) {
  if (dryRun) return dryRunResult6(topic);
  const t0 = Date.now();
  let accumulatedExaCost = 0;
  try {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) throw new Error("Missing EXA_API_KEY env var");
    async function toolRunner4(toolName, input) {
      if (toolName === "exa_search") {
        const body = {
          query: input.query,
          type: input.type ?? "auto",
          category: input.category ?? "news",
          numResults: input.numResults ?? 10,
          contents: {
            highlights: { numSentences: 2 },
            text: { maxCharacters: 500 }
          }
        };
        if (input.startPublishedDate) body.startPublishedDate = input.startPublishedDate;
        if (input.includeDomains) body.includeDomains = input.includeDomains;
        const res = await fetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`Exa search HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        if (data?.costDollars?.total) {
          accumulatedExaCost += data.costDollars.total;
        }
        return data;
      }
      if (toolName === "exa_find_similar") {
        const body = {
          url: input.url,
          numResults: input.numResults ?? 10,
          contents: {
            highlights: { numSentences: 2 }
          }
        };
        if (input.category) body.category = input.category;
        if (input.startPublishedDate) body.startPublishedDate = input.startPublishedDate;
        if (input.excludeSourceDomain != null) body.excludeSourceDomain = input.excludeSourceDomain;
        const res = await fetch("https://api.exa.ai/findSimilar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`Exa findSimilar HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        if (data?.costDollars?.total) {
          accumulatedExaCost += data.costDollars.total;
        }
        return data;
      }
      throw new Error(`Unknown tool: ${toolName}`);
    }
    const systemPrompt = buildBriefingSystemPrompt(topic);
    const agentResult = await runAgentLoop({
      topic,
      systemPrompt,
      tools: EXA_TOOLS,
      toolRunner: toolRunner4
    });
    const latency_ms = Date.now() - t0;
    const cards = agentResult.briefing.cards ?? [];
    const urls = cards.map((c) => c.url).filter(Boolean);
    const toolCalls = agentResult.toolCallCount ?? 0;
    const totalCost = (agentResult.cost_usd ?? 0) + accumulatedExaCost;
    return {
      variant: VARIANT9,
      topic,
      briefing: agentResult.briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: "Claude Sonnet 4.6 tokens + Exa actual cost",
        results_count: cards.length,
        unique_domains: countUniqueDomains10(urls),
        tool_calls: toolCalls,
        tokens: agentResult.tokens
      }
    };
  } catch (e) {
    return {
      variant: VARIANT9,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: "Claude Sonnet 4.6 tokens + Exa actual cost",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/claude-websearch.ts
var import_sdk2 = __toESM(require("@anthropic-ai/sdk"));
var VARIANT10 = "claude-sonnet-4-6-websearch";
function countUniqueDomains11(urls) {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );
  return domains.size;
}
function parseBriefingJson2(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      executiveSummary: parsed.executiveSummary || "",
      cards: (parsed.stories || []).slice(0, 5).map((s) => ({
        headline: s.headline || "Untitled",
        bullets: s.bullets || [],
        source: s.source || "Unknown",
        date: s.date || "",
        url: s.url || ""
      }))
    };
  } catch {
    return { executiveSummary: "", cards: [] };
  }
}
function dryRunResult7(topic) {
  return {
    variant: VARIANT10,
    topic,
    briefing: {
      cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: "dry run",
      results_count: 1,
      unique_domains: 0
    }
  };
}
async function run12(topic, config, dryRun) {
  if (dryRun) return dryRunResult7(topic);
  const t0 = Date.now();
  try {
    const client = new import_sdk2.default();
    const systemPrompt = buildBriefingSystemPrompt(topic);
    const messages = [{ role: "user", content: `Topic: ${topic}` }];
    let webSearches = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let finalText = "";
    for (let turn = 0; turn < 8; turn++) {
      const resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        tool_choice: { type: "auto" },
        messages
      });
      totalInput += resp.usage.input_tokens;
      totalOutput += resp.usage.output_tokens;
      messages.push({ role: "assistant", content: resp.content });
      if (resp.stop_reason === "end_turn") {
        for (const block of resp.content) {
          if (block.type === "text") finalText = block.text;
        }
        break;
      }
      const toolUses = resp.content.filter(
        (b) => b.type === "tool_use" && b.name === "web_search"
      );
      webSearches += toolUses.length;
      if (resp.stop_reason === "tool_use") {
        for (const block of resp.content) {
          if (block.type === "text") finalText = block.text;
        }
        break;
      }
    }
    const latency_ms = Date.now() - t0;
    const briefing = parseBriefingJson2(finalText);
    const urls = briefing.cards.map((c) => c.url).filter(Boolean);
    const tokenCost = totalInput * 3 / 1e6 + totalOutput * 15 / 1e6;
    const searchCost = webSearches * (10 / 1e3);
    const totalCost = tokenCost + searchCost;
    return {
      variant: VARIANT10,
      topic,
      briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: "Claude Sonnet 4.6 tokens + web search requests ($10/1k)",
        results_count: briefing.cards.length,
        unique_domains: countUniqueDomains11(urls),
        web_searches: webSearches,
        tokens: { input: totalInput, output: totalOutput }
      }
    };
  } catch (e) {
    return {
      variant: VARIANT10,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: "Claude Sonnet 4.6 tokens + web search requests ($10/1k)",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/variants/gpt-websearch.ts
var VARIANT11 = "gpt-4o-websearch";
function countUniqueDomains12(urls) {
  const domains = new Set(
    urls.map((u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return u;
      }
    })
  );
  return domains.size;
}
function parseBriefingJson3(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      executiveSummary: parsed.executiveSummary || "",
      cards: (parsed.stories || []).slice(0, 5).map((s) => ({
        headline: s.headline || "Untitled",
        bullets: s.bullets || [],
        source: s.source || "Unknown",
        date: s.date || "",
        url: s.url || ""
      }))
    };
  } catch {
    return { executiveSummary: "", cards: [] };
  }
}
function dryRunResult8(topic) {
  return {
    variant: VARIANT11,
    topic,
    briefing: {
      cards: [{ headline: "[DRY RUN]", bullets: [], source: "stub", date: "2026-01-01", url: "" }]
    },
    metrics: {
      latency_ms: 0,
      cost_estimate_usd: 0,
      cost_basis: "dry run",
      results_count: 1,
      unique_domains: 0
    }
  };
}
function extractOutputText(data) {
  if (data.output_text) return data.output_text;
  if (Array.isArray(data.output)) {
    for (let i = data.output.length - 1; i >= 0; i--) {
      const item = data.output[i];
      if (item.type === "message" && item.role === "assistant" && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === "output_text" && block.text) return block.text;
        }
      }
    }
  }
  return "";
}
async function run13(topic, config, dryRun) {
  if (dryRun) return dryRunResult8(topic);
  const t0 = Date.now();
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY env var");
    const systemPrompt = buildBriefingSystemPrompt(topic);
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        instructions: systemPrompt,
        input: `Topic: ${topic}`,
        tools: [{ type: "web_search_preview", search_context_size: "medium" }]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI Responses API HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const latency_ms = Date.now() - t0;
    if (data.error?.message) {
      throw new Error(`OpenAI API error: ${data.error.message}`);
    }
    const outputText = extractOutputText(data);
    const briefing = parseBriefingJson3(outputText);
    const urls = briefing.cards.map((c) => c.url).filter(Boolean);
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const totalCost = inputTokens * 2.5 / 1e6 + outputTokens * 10 / 1e6;
    return {
      variant: VARIANT11,
      topic,
      briefing,
      metrics: {
        latency_ms,
        cost_estimate_usd: totalCost,
        cost_basis: "gpt-4o tokens ($2.50/1M input, $10/1M output)",
        results_count: briefing.cards.length,
        unique_domains: countUniqueDomains12(urls),
        tokens: { input: inputTokens, output: outputTokens }
      }
    };
  } catch (e) {
    return {
      variant: VARIANT11,
      topic,
      briefing: { cards: [] },
      metrics: {
        latency_ms: Date.now() - t0,
        cost_estimate_usd: 0,
        cost_basis: "gpt-4o tokens ($2.50/1M input, $10/1M output)",
        results_count: 0,
        unique_domains: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    };
  }
}

// scripts/diagnostic-compare/index.ts
(function loadEnv() {
  const envPath = path2.join(process.cwd(), ".env.local");
  try {
    const content = fs2.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
  }
})();
var ALL_VARIANTS = [
  { name: "perigon-raw-articles", run: (t, c, d) => runArticles(t, c, d) },
  { name: "perigon-raw-stories", run: (t, c, d) => runStories(t, c, d) },
  { name: "perigon-raw-vector", run: (t, c, d) => runVector(t, c, d) },
  { name: "perigon-flow-news-rebuild", run },
  { name: "perigon-flow-master", run: run2 },
  { name: "perigon-agent", run: run3, isAgent: true },
  { name: "newsdata-direct", run: run4 },
  { name: "newsdata-agent", run: run5, isAgent: true },
  { name: "brave-direct", run: run6 },
  { name: "brave-agent", run: run7, isAgent: true },
  { name: "tavily-direct", run: run8 },
  { name: "tavily-agent", run: run9, isAgent: true },
  { name: "exa-direct", run: run10 },
  { name: "exa-agent", run: run11, isAgent: true },
  { name: "claude-sonnet-4-6-websearch", run: run12, isAgent: true },
  { name: "gpt-4o-websearch", run: run13, isAgent: true }
];
async function main() {
  const opts = parseArgs(process.argv);
  const { dryRun, skipAgent, variants: variantFilter } = opts;
  console.log("\n\u{1F5DE}  Briefing Diagnostic \u2014 Source Comparison Tool");
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"} | Topics: ${TOPICS.length} | Skip agents: ${skipAgent}`);
  ensureOutputDir();
  const allVariants = skipAgent ? ALL_VARIANTS.filter((v) => !v.isAgent) : ALL_VARIANTS;
  const activeVariants = variantFilter ? allVariants.filter((v) => variantFilter.includes(v.name)) : allVariants;
  if (activeVariants.length === 0) {
    console.error("No variants selected. Check --variants flag.");
    process.exit(1);
  }
  console.log(`   Variants: ${activeVariants.map((v) => v.name).join(", ")}
`);
  if (!dryRun) {
    printCostPreview(activeVariants.map((v) => v.name));
    if (!opts.yes) await waitForConfirmation();
  }
  const allResults = [];
  for (const variant of activeVariants) {
    console.log(`
\u25B6 Running variant: ${variant.name}`);
    const variantResults = [];
    for (let ti = 0; ti < TOPICS.length; ti++) {
      const topicConfig = TOPICS[ti];
      const topic = topicConfig.label;
      if (variant.isAgent && ti > 0) {
        process.stdout.write(`  [pacing 70s for rate limit...]
`);
        await new Promise((r) => setTimeout(r, 7e4));
      }
      process.stdout.write(`  ${topic}... `);
      try {
        const result = await variant.run(topic, topicConfig, dryRun);
        variantResults.push(result);
        allResults.push(result);
        const m = result.metrics;
        console.log(`\u2713 ${m.latency_ms}ms \xB7 $${m.cost_estimate_usd.toFixed(4)} \xB7 ${m.results_count} cards \xB7 ${m.unique_domains} domains${m.error ? ` \u26A0 ${m.error}` : ""}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(`\u2717 ERROR: ${errorMsg}`);
        variantResults.push({
          variant: variant.name,
          topic,
          briefing: { cards: [] },
          metrics: {
            latency_ms: 0,
            cost_estimate_usd: 0,
            cost_basis: "error",
            results_count: 0,
            unique_domains: 0,
            error: errorMsg
          }
        });
      }
    }
    writeVariantFile(variant.name, variantResults);
  }
  console.log("\n\u{1F4DD} Writing output files...");
  writeComparisonFile(allResults);
  writeMetricsFile(allResults);
  console.log("\n\u2705 Done! Results in scripts/diagnostic-compare/output/");
  console.log("   Open output/comparison.md for side-by-side view.");
}
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
