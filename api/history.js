import { guard, useQuota, quotaLeft } from "./_guard.js";

// ── VISIONX ANALYTICS · HISTORY PROXY ────────────────────────────────────────
// GET /api/history?symbols=XLK,XLF,SPY&interval=1d&range=2y
//
// Quelle 1: Yahoo Finance chart API (server-side → kein CORS, kein Key)
// Krypto (-USD): Binance-Spot → USDT-Paar bei Gate/KuCoin/MEXC/OKX/Bitget/Bybit → Yahoo
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
const fetchBinance = async (symbol, interval, ohlc = false, full = false) => {
  try {
    const base = symbol.replace(/-USD$/, "");
    const iv = interval === "1wk" ? "1w" : "1d";
    const host = "https://data-api.binance.vision/api/v3/klines";
    let rows = [];

    if (!full) {
      const res = await fetch(`${host}?symbol=${base}USDT&interval=${iv}&limit=1000`);
      if (!res.ok) return null;
      rows = await res.json();
    } else {
      // Volle Historie: Binance gibt max. 1000 Kerzen pro Request, also
      // vorwärts blättern. BTCUSDT beginnt im August 2017, daily sind das
      // rund vier Runden — der Edge-Cache trägt das danach 12 Stunden.
      let startTime = Date.UTC(2017, 0, 1);
      for (let round = 0; round < 14; round++) {
        const res = await fetch(`${host}?symbol=${base}USDT&interval=${iv}&startTime=${startTime}&limit=1000`);
        if (!res.ok) break;
        const batch = await res.json();
        if (!Array.isArray(batch) || !batch.length) break;
        rows = rows.concat(batch);
        if (batch.length < 1000) break;
        startTime = batch[batch.length - 1][0] + 1;
      }
    }

    if (!Array.isArray(rows) || rows.length < 30) return null;
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      if (seen.has(r[0])) continue;
      seen.add(r[0]);
      const row = ohlc
        ? [r[0], parseFloat(r[1]), parseFloat(r[2]), parseFloat(r[3]), parseFloat(r[4]), parseFloat(r[5]) || 0]
        : [r[0], parseFloat(r[4])];
      if (row.slice(1, ohlc ? 5 : 2).every(Number.isFinite)) out.push(row);
    }
    return out.length > 30 ? out.sort((a, b) => a[0] - b[0]) : null;
  } catch { return null; }
};

// ── USDT-FALLBACK: weitere Börsen ────────────────────────────────────────────
// Viele Coins (HYPE, PI, SPX, MELANIA, …) haben kein Binance-Spot-Paar und
// bei Yahoo einen anderen Ticker. Dann wird das ‹BASE›/USDT-Paar der Reihe
// nach bei Gate, KuCoin, MEXC, OKX, Bitget und Bybit gesucht — zuerst die
// Börsen, deren API auch aus US-Regionen (Vercel iad1) antwortet.
// Alle liefern Tageskerzen; Wochenkerzen werden daraus zusammengesetzt.
const DAY = 86400000;
const FALLBACK_DAYS = 1500;                       // ~4 Jahre reichen für RRG/Bottom

const getJson = async (url, ms = 6000) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(timer); }
};

// Jede Quelle liefert [t(ms), o, h, l, c, vol] — Reihenfolge egal, wird sortiert
const USDT_SOURCES = [
  {
    name: "gate",
    load: async (b) => {
      const j = await getJson(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${b}_USDT&interval=1d&limit=1000`);
      // [t(s), quoteVol, close, high, low, open, baseVol, closed]
      return Array.isArray(j) ? j.map(r => [r[0] * 1000, +r[5], +r[3], +r[4], +r[2], +r[6] || 0]) : null;
    },
  },
  {
    name: "kucoin",
    load: async (b) => {
      const end = Math.floor(Date.now() / 1000), start = end - FALLBACK_DAYS * 86400;
      const j = await getJson(`https://api.kucoin.com/api/v1/market/candles?type=1day&symbol=${b}-USDT&startAt=${start}&endAt=${end}`);
      // [t(s), open, close, high, low, volume, turnover]
      return Array.isArray(j?.data) ? j.data.map(r => [r[0] * 1000, +r[1], +r[3], +r[4], +r[2], +r[5] || 0]) : null;
    },
  },
  {
    name: "mexc",
    load: async (b) => {
      const j = await getJson(`https://api.mexc.com/api/v3/klines?symbol=${b}USDT&interval=1d&limit=1000`);
      // Binance-Format
      return Array.isArray(j) ? j.map(r => [r[0], +r[1], +r[2], +r[3], +r[4], +r[5] || 0]) : null;
    },
  },
  {
    name: "okx",
    load: async (b) => {
      // 100 Kerzen je Seite, rückwärts blättern
      let rows = [], after = "";
      for (let page = 0; page < 10; page++) {
        const j = await getJson(`https://www.okx.com/api/v5/market/history-candles?instId=${b}-USDT&bar=1Dutc&limit=100${after}`);
        const d = j?.data;
        if (!Array.isArray(d) || !d.length) break;
        rows = rows.concat(d.map(r => [+r[0], +r[1], +r[2], +r[3], +r[4], +r[5] || 0]));
        if (d.length < 100) break;
        after = `&after=${d[d.length - 1][0]}`;
      }
      return rows.length ? rows : null;
    },
  },
  {
    name: "bitget",
    load: async (b) => {
      const j = await getJson(`https://api.bitget.com/api/v2/spot/market/candles?symbol=${b}USDT&granularity=1day&limit=1000`);
      // [t(ms), open, high, low, close, baseVol, usdtVol, quoteVol]
      return Array.isArray(j?.data) ? j.data.map(r => [+r[0], +r[1], +r[2], +r[3], +r[4], +r[5] || 0]) : null;
    },
  },
  {
    name: "bybit",
    load: async (b) => {
      const j = await getJson(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${b}USDT&interval=D&limit=1000`);
      // [start(ms), open, high, low, close, volume, turnover]
      const l = j?.result?.list;
      return Array.isArray(l) ? l.map(r => [+r[0], +r[1], +r[2], +r[3], +r[4], +r[5] || 0]) : null;
    },
  },
];

// Tageskerzen → Wochenkerzen (Woche ab Montag, UTC)
const toWeeklyOhlc = (rows) => {
  const out = [];
  let key = null;
  for (const r of rows) {
    const d = new Date(r[0]);
    const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    if (monday !== key) { out.push([monday, r[1], r[2], r[3], r[4], r[5]]); key = monday; }
    else {
      const w = out[out.length - 1];
      w[2] = Math.max(w[2], r[2]); w[3] = Math.min(w[3], r[3]); w[4] = r[4]; w[5] += r[5];
    }
  }
  return out;
};

const fetchUsdtFallback = async (symbol, interval, ohlc = false) => {
  if (!/-USD$/.test(symbol)) return null;
  const base = symbol.replace(/-USD$/, "");
  if (!/^[A-Z0-9]{1,15}$/.test(base)) return null;
  const t0 = Date.now();
  for (const src of USDT_SOURCES) {
    if (Date.now() - t0 > 14000) break;           // Zeitbudget je Symbol
    const raw = await src.load(base).catch(() => null);
    if (!raw) continue;
    const seen = new Set();
    let rows = raw
      .filter(r => r.slice(0, 5).every(Number.isFinite) && r[4] > 0)
      .sort((a, b) => a[0] - b[0])
      .filter(r => (seen.has(r[0]) ? false : seen.add(r[0])));
    // Nur aktive Paare: letzte Kerze höchstens 5 Tage alt
    if (rows.length < 30 || Date.now() - rows[rows.length - 1][0] > 5 * DAY) continue;
    if (interval === "1wk") rows = toWeeklyOhlc(rows);
    const out = rows.map(r => (ohlc ? r : [r[0], r[4]]));
    out.source = `${src.name}:${base}USDT`;
    return out;
  }
  return null;
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
  const full = req.query.range === "max";
  const range = full ? "max" : (/^\d+(y|mo)$/.test(req.query.range || "") ? req.query.range : "2y");
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
  const sources = {};                         // Symbol → Börse/Paar beim USDT-Fallback

  // Batches à 6 parallel — schnell genug, ohne Yahoo zu triggern
  for (let i = 0; i < symbols.length; i += 6) {
    await Promise.all(symbols.slice(i, i + 6).map(async sym => {
      let series = null;
      if (/-USD$/.test(sym)) series = await fetchBinance(sym, interval, ohlc, full);
      if (!series && /-USD$/.test(sym)) series = await fetchUsdtFallback(sym, interval, ohlc);
      if (!series) series = await fetchYahoo(sym, range, interval, ohlc);
      if (!series) series = await fetchTwelveData(sym, interval, ohlc);
      if (!series) series = await fetchCmc(sym, ohlc);
      if (series) {
        if (series.name) names[sym] = series.name;
        if (series.source) sources[sym] = series.source;
        data[sym] = Array.from(series);          // Namens-Property nicht mitserialisieren
      } else failed.push(sym);
    }));
  }

  res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ interval, range, ohlc, asOf: Date.now(), failed, names, sources, data,
    quota: { td: quotaLeft("td"), cmc: quotaLeft("cmc") } });
}
