import { guard, useQuota, quotaLeft } from "./_guard.js";

// ── VISIONX ANALYTICS · HISTORY PROXY ────────────────────────────────────────
// GET /api/history?symbols=XLK,XLF,SPY&interval=1d&range=2y
//
// Quelle 1: Yahoo Finance chart API (server-side → kein CORS, kein Key)
// Quelle 2: Twelve Data Fallback (Key aus Vercel Env: TD_KEY — NICHT hardcoden!)
//
// Cache-Strategie: Vercel CDN cached jede Symbol-Kombination 12h
// (s-maxage) + 24h stale-while-revalidate. D.h. der erste Besucher des
// Tages triggert die Fetches, alle weiteren lesen den Edge-Cache —
// egal wie viele User, die APIs sehen ~1 Request pro Symbol-Set pro Tag.

const TD_KEY = process.env.TD_KEY || ""; // Vercel → Settings → Environment Variables

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

const fetchYahoo = async (symbol, range, interval, ohlc = false) => {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&events=div%2Csplit`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const json = await res.json();
      const r = json?.chart?.result?.[0];
      const ts = r?.timestamp;
      const q = r?.indicators?.quote?.[0];
      if (!ts || !q?.close) continue;
      const nm = r?.meta?.longName || r?.meta?.shortName || null;
      const out = [];
      for (let i = 0; i < ts.length; i++) {
        if (q.close[i] == null) continue;
        if (ohlc) {
          if (q.open[i] == null || q.high[i] == null || q.low[i] == null) continue;
          out.push([ts[i] * 1000, +q.open[i].toFixed(4), +q.high[i].toFixed(4), +q.low[i].toFixed(4), +q.close[i].toFixed(4), q.volume?.[i] ?? 0]);
        } else {
          out.push([ts[i] * 1000, +q.close[i].toFixed(6)]);
        }
      }
      if (out.length > 30) { out.name = nm; return out; }
    } catch { /* nächster Host / Fallback */ }
  }
  return null;
};

// Krypto: Binance Public Data Mirror (data-api.binance.vision — kein Geo-Block
// auf US-Vercel-Regionen). "-USD"-Symbole werden als ‹BASE›USDT geladen.
const fetchBinance = async (symbol, interval, ohlc = false) => {
  try {
    const base = symbol.replace(/-USD$/, "");
    const iv = interval === "1wk" ? "1w" : "1d";
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${base}USDT&interval=${iv}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length < 30) return null;
    return ohlc
      ? rows.map(r => [r[0], parseFloat(r[1]), parseFloat(r[2]), parseFloat(r[3]), parseFloat(r[4]), parseFloat(r[5]) || 0]).filter(r => r.slice(0,5).every(Number.isFinite))
      : rows.map(r => [r[0], parseFloat(r[4])]).filter(([, c]) => Number.isFinite(c));
  } catch { return null; }
};

// Letzter Fallback für Krypto ohne Binance-Paar: CoinMarketCap (nur mit bezahltem Plan)
const fetchCmc = async (symbol, ohlc) => {
  const key = process.env.CMC_KEY;
  if (!key || !/-USD$/.test(symbol)) return null;
  if (!useQuota("cmc")) return null;         // Tageslimit erreicht
  try {
    const base = symbol.replace(/-USD$/, "");
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/historical`
      + `?symbol=${encodeURIComponent(base)}&count=500&interval=daily&convert=USD`;
    const res = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.data?.quotes || json?.data?.[base]?.[0]?.quotes || [];
    const out = raw.map(q => {
      const t = new Date(q.time_open).getTime();
      const u = q.quote?.USD || {};
      return ohlc ? [t, u.open, u.high, u.low, u.close, u.volume ?? 0] : [t, u.close];
    }).filter(r => r.slice(1).every(Number.isFinite));
    return out.length > 30 ? out : null;
  } catch { return null; }
};

const fetchTwelveData = async (symbol, interval, ohlc = false) => {
  if (!TD_KEY) return null;
  if (!useQuota("td")) return null;          // Tageslimit erreicht
  try {
    const tdInterval = interval === "1wk" ? "1week" : "1day";
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${tdInterval}&outputsize=600&apikey=${TD_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === "error" || !json.values) return null;
    return json.values
      .map(v => ohlc
        ? [new Date(v.datetime + "T00:00:00Z").getTime(), parseFloat(v.open), parseFloat(v.high), parseFloat(v.low), parseFloat(v.close)]
        : [new Date(v.datetime + "T00:00:00Z").getTime(), parseFloat(v.close)])
      .filter(r => r.slice(1).every(Number.isFinite))
      .reverse();
  } catch { return null; }
};

export default async function handler(req, res) {
  const symbols = String(req.query.symbols || "")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 30);
  const interval = req.query.interval === "1wk" ? "1wk" : "1d";
  const range = /^\d+(y|mo)$/.test(req.query.range || "") ? req.query.range : "2y";
  const ohlc = req.query.ohlc === "1";

  if (!symbols.length) return res.status(400).json({ error: "symbols required" });

  // Zugang + Rate-Limit; Kosten skalieren mit der Symbolanzahl
  // Kosten 1 pro Request statt ceil(n/5): das Batching schont die Provider
  // ohnehin (6 parallel, Edge-Cache 12h). Die alte Formel hat genau das
  // Verhalten bestraft, das man haben will, und 100er-Packs unmöglich gemacht.
  if (!guard(req, res, 1)) return;

  const data = {};
  const names = {};
  const failed = [];

  // Batches à 6 parallel — schnell genug, ohne Yahoo zu triggern
  for (let i = 0; i < symbols.length; i += 6) {
    await Promise.all(symbols.slice(i, i + 6).map(async sym => {
      let series = null;
      if (/-USD$/.test(sym)) series = await fetchBinance(sym, interval, ohlc);
      if (!series) series = await fetchYahoo(sym, range, interval, ohlc);
      if (!series) series = await fetchTwelveData(sym, interval, ohlc);
      if (!series) series = await fetchCmc(sym, ohlc);
      if (series) {
        if (series.name) names[sym] = series.name;
        data[sym] = Array.from(series);          // Namens-Property nicht mitserialisieren
      } else failed.push(sym);
    }));
  }

  res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ interval, range, ohlc, asOf: Date.now(), failed, names, data,
    quota: { td: quotaLeft("td"), cmc: quotaLeft("cmc") } });
}
