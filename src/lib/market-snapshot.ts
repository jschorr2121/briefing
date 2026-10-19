// One deterministic line of market levels for finance-flavored topics.
// The finance persona's blocking complaint across all seven eval rounds was
// "no index closes, no 10-year, no crude" — numbers articles rarely carry in
// their first paragraphs. So they come from quotes, not prose.
//
// ponytail: Yahoo's chart endpoint is unofficial and keyless; CoinGecko's
// simple-price is free-tier. If either breaks, swap in a paid quotes API here
// — the rest of the app only sees the formatted string.

import { getCached, setCached } from './news/cache';

const CACHE_KEY = 'market:snapshot';
const CACHE_TTL_SECONDS = 10 * 60;
const TIMEOUT_MS = 4000;

interface Quote {
  label: string;
  last: number;
  changePct: number | null;
  format: 'index' | 'pct' | 'usd' | 'plain';
}

const YAHOO: { symbol: string; label: string; format: Quote['format'] }[] = [
  { symbol: '^GSPC', label: 'S&P 500', format: 'index' },
  { symbol: '^IXIC', label: 'Nasdaq', format: 'index' },
  { symbol: '^DJI', label: 'Dow', format: 'index' },
  { symbol: '^TNX', label: '10-yr', format: 'pct' },
  { symbol: 'CL=F', label: 'WTI', format: 'usd' },
  { symbol: '^VIX', label: 'VIX', format: 'plain' },
];

async function yahoo(symbol: string, label: string, format: Quote['format']): Promise<Quote | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BriefingBot/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((c): c is number => typeof c === 'number');
    const last: number | undefined = r?.meta?.regularMarketPrice ?? valid[valid.length - 1];
    const prev: number | undefined = r?.meta?.chartPreviousClose ?? valid[valid.length - 2];
    if (typeof last !== 'number') return null;
    return { label, last, changePct: typeof prev === 'number' && prev !== 0 ? ((last - prev) / prev) * 100 : null, format };
  } catch {
    return null;
  }
}

async function crypto(): Promise<Quote[]> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true', {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const d = await res.json();
    const q = (id: string, label: string): Quote | null =>
      typeof d?.[id]?.usd === 'number' ? { label, last: d[id].usd, changePct: d[id].usd_24h_change ?? null, format: 'usd' } : null;
    return [q('bitcoin', 'BTC'), q('ethereum', 'ETH')].filter((x): x is Quote => !!x);
  } catch {
    return [];
  }
}

export function formatQuote(q: Quote): string {
  const n = (v: number, digits: number) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const value =
    q.format === 'index' ? n(q.last, 0)
    : q.format === 'pct' ? `${n(q.last, 2)}%`
    : q.format === 'usd' ? `$${n(q.last, q.last >= 1000 ? 0 : 2)}`
    : n(q.last, 1);
  const chg = q.changePct === null || q.format === 'pct' ? '' : ` (${q.changePct >= 0 ? '+' : '−'}${Math.abs(q.changePct).toFixed(1)}%)`;
  return `${q.label} ${value}${chg}`;
}

/** US equity session: 9:30–16:00 ET, Mon–Fri. Good enough to label live vs close. */
function usMarketOpen(now = new Date()): boolean {
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  return day >= 1 && day <= 5 && mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/**
 * "As of 1:35 PM ET (live): S&P 500 7,691 (−1.5%) · … · BTC $82,020 (+0.5%)", or null.
 * The % moves are versus the prior close, so during the session they are the
 * intraday move — the finance review caught that disagreeing with articles
 * about the previous close, hence the explicit live/close label.
 */
export async function getMarketSnapshot(): Promise<string | null> {
  const cached = await getCached<string>(CACHE_KEY);
  if (cached) return cached;
  const [yahooQuotes, cryptoQuotes] = await Promise.all([
    Promise.all(YAHOO.map(y => yahoo(y.symbol, y.label, y.format))),
    crypto(),
  ]);
  const quotes = [...yahooQuotes.filter((q): q is Quote => !!q), ...cryptoQuotes];
  if (quotes.length === 0) return null;
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  const label = usMarketOpen(now) ? `As of ${time} ET (live, vs prior close)` : `As of ${time} ET (last close; crypto live)`;
  const line = `${label}: ${quotes.map(formatQuote).join(' · ')}`;
  await setCached(CACHE_KEY, line, CACHE_TTL_SECONDS);
  return line;
}
