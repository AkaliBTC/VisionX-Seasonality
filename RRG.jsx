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

const fetchYahoo = async (symbol, range, interval) => {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&events=div%2Csplit`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const json = await res.json();
      const r = json?.chart?.result?.[0];
      const ts = r?.timestamp;
      const closes = r?.indicators?.quote?.[0]?.close;
      if (!ts || !closes) continue;
      const out = [];
      for (let i = 0; i < ts.length; i++) {
        if (closes[i] != null) out.push([ts[i] * 1000, +closes[i].toFixed(6)]);
      }
      if (out.length > 30) return out;
    } catch { /* nächster Host / Fallback */ }
  }
  return null;
};

const fetchTwelveData = async (symbol, interval) => {
  if (!TD_KEY) return null;
  try {
    const tdInterval = interval === "1wk" ? "1week" : "1day";
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${tdInterval}&outputsize=600&apikey=${TD_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === "error" || !json.values) return null;
    return json.values
      .map(v => [new Date(v.datetime + "T00:00:00Z").getTime(), parseFloat(v.close)])
      .filter(([, c]) => Number.isFinite(c))
      .reverse();
  } catch { return null; }
};

export default async function handler(req, res) {
  const symbols = String(req.query.symbols || "")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 30);
  const interval = req.query.interval === "1wk" ? "1wk" : "1d";
  const range = /^\d+(y|mo)$/.test(req.query.range || "") ? req.query.range : "2y";

  if (!symbols.length) return res.status(400).json({ error: "symbols required" });

  const data = {};
  const failed = [];

  // Batches à 6 parallel — schnell genug, ohne Yahoo zu triggern
  for (let i = 0; i < symbols.length; i += 6) {
    await Promise.all(symbols.slice(i, i + 6).map(async sym => {
      let series = await fetchYahoo(sym, range, interval);
      if (!series) series = await fetchTwelveData(sym, interval);
      if (series) data[sym] = series; else failed.push(sym);
    }));
  }

  res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ interval, range, asOf: Date.now(), failed, data });
}
