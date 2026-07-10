import { useState, useEffect, useRef, useCallback } from "react";

// ── BINANCE HISTORY ───────────────────────────────────────────────────────────
const fetchBinanceHistory = async (ticker, interval) => {
  const sym = ticker.toUpperCase().trim();
  const symbol = sym.endsWith("USDT") ? sym : sym + "USDT";
  let allCandles = [];
  let endTime = Date.now();
  const limit = 1000;

  // Paginate backwards to get full history
  while (true) {
    let data = null;
    // Try spot first, then futures
    for (const base of [
      `https://api.binance.com/api/v3/klines`,
      `https://fapi.binance.com/fapi/v1/klines`,
    ]) {
      try {
        const url = `${base}?symbol=${symbol}&interval=${interval}&endTime=${endTime}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        data = await res.json();
        if (data && data.length > 0) break;
      } catch { continue; }
    }
    if (!data || data.length === 0) break;
    allCandles = [...data, ...allCandles];
    if (data.length < limit) break;
    endTime = data[0][0] - 1;
    // Safety: stop if we have 10 years worth
    if (allCandles.length > 5200) break;
  }

  return allCandles.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    date: new Date(k[0]),
  }));
};

// ── TWELVE DATA (TradFi) ─────────────────────────────────────────────────────
const TD_KEY = "fad446708d8a4bdeb40779f9f1f01c13";

const fetchTwelveDataHistory = async (ticker, interval) => {
  const sym = ticker.trim().toUpperCase();
  const iv = interval === "1w" ? "1week" : "1day";
  // Paginate to get full history — Twelve Data returns max 5000 per call
  let allCandles = [];
  let endDate = null;
  const maxPages = 6;

  for (let page = 0; page < maxPages; page++) {
    let url = `https://api.twelvedata.com/time_series?symbol=${sym}&interval=${iv}&outputsize=5000&order=ASC&apikey=${TD_KEY}`;
    if (endDate) url += `&end_date=${endDate}`;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      if (data.status === "error" || !data.values?.length) break;
      const candles = data.values.map(v => {
        const t = new Date(v.datetime).getTime();
        return { t, o: parseFloat(v.open), h: parseFloat(v.high), l: parseFloat(v.low), c: parseFloat(v.close), date: new Date(t) };
      }).filter(c => !isNaN(c.c));
      allCandles = [...candles, ...allCandles];
      if (data.values.length < 5000) break; // got all data
      // set end_date to day before first candle for next page
      endDate = data.values[0].datetime.split(" ")[0];
    } catch { break; }
  }
  return allCandles.length > 10 ? allCandles : null;
};

// ── DETECT SOURCE ─────────────────────────────────────────────────────────────
const CRYPTO_LIST = ["BTC","ETH","SOL","BNB","XRP","ADA","AVAX","DOT","LINK","MATIC","DOGE","SHIB","UNI","ATOM","HYPE","SUI","APT","INJ","TIA","SEI","WIF","BONK","PEPE","ARB","OP","NEAR","FTM","ALGO","VET","SAND","MANA","AXS","GALA","ENJ","CHZ","LRC","CRV","AAVE","MKR","SNX","COMP","YFI","SUSHI","1INCH"];

const isCrypto = (ticker) => {
  const t = ticker.toUpperCase().replace("USDT","").trim();
  return CRYPTO_LIST.includes(t) || ticker.toUpperCase().endsWith("USDT");
};

// ── CSV PARSER (TradingView + Investing.com) ──────────────────────────────────
const parseCSV = (text, interval) => {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.trim().split("\n");
  const cols = lines[0].toLowerCase().split(",").map(c => c.trim().replace(/['"]/g, ""));
  const tIdx = cols.findIndex(c => c.includes("time") || c.includes("date"));
  const oIdx = cols.findIndex(c => c === "open");
  const hIdx = cols.findIndex(c => c === "high");
  const lIdx = cols.findIndex(c => c === "low");
  const cIdx = cols.findIndex(c =>
    c === "close" || c === "price" || c === "value" ||
    c === "usd (pm)" || c === "usd (am)" || c === "usd" ||
    c === "settle" || c === "settlement price" || c === "last"
  );
  if (tIdx === -1 || cIdx === -1) return null;
  const parseNum = (s) => s ? parseFloat(s.replace(/,/g, "")) : NaN;
  const daily = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map(s => s.trim().replace(/['"]/g, ""));
    if (parts.length < 2) continue;
    const raw = parts[tIdx];
    if (!raw) continue;
    let t;
    if (/^\d+$/.test(raw)) { t = parseInt(raw) * 1000; }
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [m, d, y] = raw.split("/"); t = new Date(`${y}-${m}-${d}`).getTime();
    } else { t = new Date(raw).getTime(); }
    if (isNaN(t)) continue;
    const c = parseNum(parts[cIdx]);
    if (isNaN(c) || c <= 0) continue;
    const o = oIdx >= 0 ? parseNum(parts[oIdx]) || c : c;
    const h = hIdx >= 0 ? parseNum(parts[hIdx]) || c : c;
    const l = lIdx >= 0 ? parseNum(parts[lIdx]) || c : c;
    daily.push({ t, o, h, l, c, date: new Date(t) });
  }
  daily.sort((a, b) => a.t - b.t);
  if (interval === "1w" && daily.length > 0) {
    const weeks = {};
    for (const d of daily) {
      const wd = new Date(d.t); const day = wd.getDay();
      const monday = new Date(new Date(d.t).setDate(wd.getDate() - day + (day === 0 ? -6 : 1)));
      const key = monday.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = {...d};
      else { weeks[key].h = Math.max(weeks[key].h, d.h); weeks[key].l = Math.min(weeks[key].l, d.l); weeks[key].c = d.c; }
    }
    return Object.values(weeks).sort((a, b) => a.t - b.t);
  }
  return daily;
};

const NASDAQ_MAP = {
  "WTI":       { ds: "NSE/OIL",      col: 2 },
  "OIL":       { ds: "NSE/OIL",      col: 2 },
  "CRUDE":     { ds: "NSE/OIL",      col: 2 },
  "GOLD":      { ds: "LBMA/GOLD",    col: 2 },
  "XAU":       { ds: "LBMA/GOLD",    col: 2 },
  "SILVER":    { ds: "LBMA/SILVER",  col: 2 },
  "XAG":       { ds: "LBMA/SILVER",  col: 2 },
  "PLATINUM":  { ds: "LPPM/PLAT",    col: 2 },
  "XPT":       { ds: "LPPM/PLAT",    col: 2 },
  "PALLADIUM": { ds: "LPPM/PALL",    col: 2 },
  "XPD":       { ds: "LPPM/PALL",    col: 2 },
  "COPPER":    { ds: "LME/PR_CU",    col: 2 },
  "HG":        { ds: "LME/PR_CU",    col: 2 },
  "ALUMINUM":  { ds: "LME/PR_AL",    col: 2 },
  "ALUMINIUM": { ds: "LME/PR_AL",    col: 2 },
  "WHEAT":     { ds: "CHRIS/CME_W1", col: 5 },
};
const COMMODITY_KEYS = new Set(Object.keys(NASDAQ_MAP));
const isCommodity = (ticker) => COMMODITY_KEYS.has(ticker.toUpperCase().trim());

const ND_PROXIES = [
  (u) => fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`).then(r => { if(!r.ok) throw new Error(); return r.json(); }).then(d => d.contents),
  (u) => fetch(`https://corsproxy.io/?${encodeURIComponent(u)}`).then(r => { if(!r.ok) throw new Error(); return r.text(); }),
  (u) => fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`).then(r => { if(!r.ok) throw new Error(); return r.text(); }),
];

const parseNasdaqCSV = (text, interval) => {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;
  const daily = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map(s => s.trim().replace(/['"]/g, ""));
    if (parts.length < 2) continue;
    const t = new Date(parts[0]).getTime();
    if (isNaN(t)) continue;
    const c = parseFloat(parts[1]);
    if (isNaN(c) || c <= 0) continue;
    daily.push({ t, o: c, h: c, l: c, c, date: new Date(t) });
  }
  daily.sort((a, b) => a.t - b.t);
  if (interval === "1w" && daily.length > 0) {
    const weeks = {};
    for (const d of daily) {
      const wd = new Date(d.t); const day = wd.getDay();
      const monday = new Date(new Date(d.t).setDate(wd.getDate() - day + (day === 0 ? -6 : 1)));
      const key = monday.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = {...d};
      else weeks[key].c = d.c;
    }
    return Object.values(weeks).sort((a, b) => a.t - b.t);
  }
  return daily.length > 5 ? daily : null;
};

const fetchNasdaqHistory = async (ticker, interval) => {
  const cfg = NASDAQ_MAP[ticker.toUpperCase().trim()];
  if (!cfg) return null;
  const url = `https://data.nasdaq.com/api/v3/datasets/${cfg.ds}/data.csv?order=asc&column_index=${cfg.col}`;
  for (const px of ND_PROXIES) {
    try {
      const text = await px(url);
      if (!text || text.includes("<!DOCTYPE") || text.length < 100) continue;
      const parsed = parseNasdaqCSV(text, interval);
      if (parsed && parsed.length > 10) return parsed;
    } catch { continue; }
  }
  return null;
};

const fetchHistory = async (ticker, interval) => {
  if (isCrypto(ticker)) return await fetchBinanceHistory(ticker, interval);
  if (isCommodity(ticker)) {
    const nd = await fetchNasdaqHistory(ticker, interval);
    if (nd && nd.length > 10) return nd;
  }
  return await fetchTwelveDataHistory(ticker, interval);
};

// ── SEASONALITY CALC ──────────────────────────────────────────────────────────
const calcSeasonality = (candles, years) => {
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // ── WEEKDAY: daily return = prevClose→close ────────────────────────────────
  const byWeekday = { 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] };
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const yr = c.date.getFullYear();
    if (!years.includes(yr)) continue;
    if (prev.c <= 0) continue;
    const pct = ((c.c - prev.c) / prev.c) * 100;
    byWeekday[c.date.getDay()].push(pct);
  }

  // ── MONTHLY: total return of each calendar month (first open → last close) ─
  // Group candles by year+month, take first open and last close of each month
  const monthMap = {};
  for (const c of candles) {
    const yr = c.date.getFullYear();
    const mo = c.date.getMonth() + 1;
    if (!years.includes(yr)) continue;
    const key = `${yr}-${mo}`;
    if (!monthMap[key]) monthMap[key] = { mo, first: c, last: c };
    else monthMap[key].last = c;
  }
  const byMonth = { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[], 10:[], 11:[], 12:[] };
  for (const { mo, first, last } of Object.values(monthMap)) {
    if (first.o <= 0) continue;
    const pct = ((last.c - first.o) / first.o) * 100;
    byMonth[mo].push(pct);
  }

  const wr = arr => arr.length ? (arr.filter(v => v > 0).length / arr.length) * 100 : 0;
  const mk = (label, arr) => ({ label, val: avg(arr), n: arr.length, wr: wr(arr) });

  const hasWeekend = byWeekday[6].length > 0 || byWeekday[0].length > 0;
  const weekdays = [
    mk("Mon", byWeekday[1]),
    mk("Tue", byWeekday[2]),
    mk("Wed", byWeekday[3]),
    mk("Thu", byWeekday[4]),
    mk("Fri", byWeekday[5]),
    ...(hasWeekend ? [
      mk("Sat", byWeekday[6]),
      mk("Sun", byWeekday[0]),
    ] : []),
  ];

  const months = [
    "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
  ].map((label, i) => mk(label, byMonth[i + 1]));

  return { weekdays, months };
};


// ── CYCLE ANALYSIS — bottom detection + inter-low spacing ────────────────────
const findSignificantLows = (candles, lookback) => {
  const n = candles.length;
  const lows_map = candles.map(c => c.l);
  const scales = [
    Math.max(3, Math.floor(lookback * 0.4)),
    lookback,
    Math.min(n / 4, Math.floor(lookback * 2)),
  ];
  const candidates = new Set();
  for (const lb of scales) {
    for (let i = lb; i < n - lb; i++) {
      const win = lows_map.slice(i - lb, i + lb + 1);
      const minV = Math.min(...win);
      if (lows_map[i] <= minV) candidates.add(i);
    }
  }
  const minProminence = 0.03;
  const prominent = [...candidates].filter(i => {
    const price = lows_map[i];
    const leftHigh = Math.max(...lows_map.slice(Math.max(0, i - lookback * 2), i).map((_, j) => candles[Math.max(0, i - lookback * 2) + j].h));
    const rightHigh = Math.max(...lows_map.slice(i + 1, Math.min(n, i + lookback * 2 + 1)).map((_, j) => candles[i + 1 + j].h));
    const refHigh = Math.min(leftHigh, rightHigh);
    return refHigh > 0 && (refHigh - price) / refHigh >= minProminence;
  });
  prominent.sort((a, b) => a - b);
  const deduped = [];
  for (const idx of prominent) {
    if (!deduped.length || idx - deduped[deduped.length - 1] > lookback) {
      deduped.push(idx);
    } else if (lows_map[idx] < lows_map[deduped[deduped.length - 1]]) {
      deduped[deduped.length - 1] = idx;
    }
  }
  return deduped;
};

const analyzeCycles = (candles, topN = 20, anchorIdx = null) => {
  if (candles.length < 20) return [];
  const n = candles.length;
  const lookback = Math.min(40, Math.max(3, Math.floor(n * 0.08)));
  const lows = findSignificantLows(candles, lookback);
  if (lows.length < 2) return [];

  let anchorLowIdx = null;
  if (anchorIdx != null) {
    let minDist = Infinity;
    lows.forEach((li, i) => {
      const d = Math.abs(li - anchorIdx);
      if (d < minDist) { minDist = d; anchorLowIdx = i; }
    });
  }

  const distances = [];
  for (let i = 1; i < lows.length; i++) distances.push({ d: lows[i] - lows[i-1], i1: i-1, i2: i });
  for (let i = 2; i < lows.length; i++) distances.push({ d: lows[i] - lows[i-2], i1: i-2, i2: i });

  const anchorBoost = (i1, i2) => {
    if (anchorLowIdx == null) return 1;
    const nearby = [anchorLowIdx - 1, anchorLowIdx, anchorLowIdx + 1];
    return (nearby.includes(i1) || nearby.includes(i2)) ? 3 : 1;
  };

  const clusters = [];
  for (const { d, i1, i2 } of distances) {
    if (d < 3) continue;
    const boost = anchorBoost(i1, i2);
    const ex = clusters.find(c => Math.abs(c.mean - d) / c.mean < 0.15);
    if (ex) {
      for (let b = 0; b < boost; b++) ex.vals.push(d);
      ex.mean = ex.vals.reduce((a, b) => a + b, 0) / ex.vals.length;
    } else {
      clusters.push({ mean: d, vals: Array(boost).fill(d) });
    }
  }

  const scored = clusters.map(c => {
    const m = c.mean;
    const variance = c.vals.reduce((a, v) => a + (v - m) ** 2, 0) / c.vals.length;
    const std = Math.sqrt(variance);
    const consistency = m > 0 ? Math.max(0, 1 - std / m) : 0;
    const accuracy = Math.min(99, consistency * 85 * Math.min(1, c.vals.length / 3));
    return { period: Math.round(m), accuracy, score: c.vals.length * consistency, amplitude: 1, phase: -Math.PI / 2, lowCount: c.vals.length };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = [];
  for (const s of scored) {
    if (s.period < 3) continue;
    if (!selected.some(x => Math.abs(x.period - s.period) / Math.max(x.period, s.period) < 0.1))
      selected.push(s);
    if (selected.length >= topN) break;
  }
  selected.sort((a, b) => b.accuracy - a.accuracy);
  return selected;
};

// Build composite sine wave — arithmetic, auto-scaled to visible price range
const buildComposite = (candles, selectedCycles, tweaks, anchorIdx, slopeMult = 1.0) => {
  if (!candles.length || !selectedCycles.length) return [];
  const n = candles.length;
  const fwdBars = Math.ceil(n * 0.5);
  const totalBars = n + fwdBars;
  const anchor = anchorIdx != null ? Math.min(anchorIdx, n - 1) : n - 1;

  const anchorPrice = candles[anchor].l;
  const priceMin = Math.min(...candles.map(c => c.l));
  const priceMax = Math.max(...candles.map(c => c.h));
  const priceRange = priceMax - priceMin;
  const numCyc = selectedCycles.length;

  // Skewed composite: -cos pins trough at anchor, peak shift via slopeMult
  const skewed = Array(totalBars).fill(0);
  for (const cyc of selectedCycles) {
    const tw = tweaks[cyc.period] || {};
    const period = cyc.period * (tw.periodMult || 1);
    const split = slopeMult / (1 + slopeMult);
    for (let t = 0; t < totalBars; t++) {
      const phase = ((t - anchor) % period + period) % period / period;
      let distorted;
      if (phase < split) {
        distorted = (phase / split) * Math.PI;
      } else {
        distorted = Math.PI + ((phase - split) / (1 - split)) * Math.PI;
      }
      skewed[t] += -Math.cos(distorted);
    }
  }

  // skewed in [-numCyc, +numCyc], anchor = trough = -numCyc
  const amplitude = (priceRange * 0.35) / numCyc;
  return skewed.map((v, t) => ({
    t,
    v: anchorPrice + (v + numCyc) * amplitude,
    isFuture: t >= n,
  }));
};

// ── SEASONAL PATTERN (Seasonax-style average annual price path) ──────────────
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const dayKey = (d) => (d.getMonth() + 1) * 100 + d.getDate();
const fmtKey = (k) => `${MONTH_SHORT[Math.floor(k / 100) - 1]} ${k % 100}`;

const calcSeasonalPattern = (candles, years) => {
  // average log return per calendar day → cumulated to the classic seasonal curve (indexed to 100)
  const dayLogRets = new Map();
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i], p = candles[i - 1];
    const yr = c.date.getFullYear();
    if (!years.includes(yr) || p.c <= 0 || c.c <= 0) continue;
    const key = dayKey(c.date);
    if (!dayLogRets.has(key)) dayLogRets.set(key, []);
    dayLogRets.get(key).push(Math.log(c.c / p.c));
  }
  const keys = [...dayLogRets.keys()].sort((a, b) => a - b);
  if (keys.length < 10) return null;
  let cum = 0;
  return keys.map(k => {
    const arr = dayLogRets.get(k);
    const avgR = arr.reduce((a, b) => a + b, 0) / arr.length;
    cum += avgR;
    const wins = arr.filter(v => v > 0).length;
    return { key: k, v: Math.exp(cum) * 100, winRate: (wins / arr.length) * 100, n: arr.length };
  });
};

const calcCurrentYearPath = (candles) => {
  const yr = new Date().getFullYear();
  const cur = candles.filter(c => c.date.getFullYear() === yr);
  if (cur.length < 2 || cur[0].c <= 0) return null;
  const base = cur[0].c;
  return { year: yr, points: cur.map(c => ({ key: dayKey(c.date), v: (c.c / base) * 100 })) };
};

// ── PATTERN STATISTICS (Seasonax-style window backtest) ──────────────────────
const idxAtOrAfter = (candles, ts) => {
  let lo = 0, hi = candles.length - 1, ans = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (candles[m].t >= ts) { ans = m; hi = m - 1; } else lo = m + 1; }
  return ans;
};
const idxAtOrBefore = (candles, ts) => {
  let lo = 0, hi = candles.length - 1, ans = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (candles[m].t <= ts) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
};

const calcWindowStats = (candles, startKey, endKey, years) => {
  const sm = Math.floor(startKey / 100), sd = startKey % 100;
  const em = Math.floor(endKey / 100), ed = endKey % 100;
  const wrap = endKey <= startKey;
  const DAY = 86400000;
  const rows = [];
  for (const y of years) {
    const t0 = new Date(y, sm - 1, sd).getTime();
    const t1 = new Date(wrap ? y + 1 : y, em - 1, ed, 23, 59).getTime();
    if (t1 > Date.now()) continue; // skip incomplete/ongoing window
    const i0 = idxAtOrAfter(candles, t0);
    const i1 = idxAtOrBefore(candles, t1);
    if (i0 == null || i1 == null || i1 <= i0) continue;
    // require entry & exit candles to actually sit near the intended dates
    if (candles[i0].t - t0 > 12 * DAY) continue;
    if (t1 - candles[i1].t > 12 * DAY) continue;
    const entry = candles[i0].c, exit = candles[i1].c;
    if (entry <= 0) continue;
    rows.push({ year: y, ret: (exit / entry - 1) * 100 });
  }
  if (!rows.length) return null;
  const rets = rows.map(r => r.ret);
  const wins = rets.filter(r => r > 0).length;
  const avgV = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sorted = [...rets].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  let lenDays = Math.round((new Date(wrap ? 2002 : 2001, em - 1, ed) - new Date(2001, sm - 1, sd)) / DAY);
  if (lenDays <= 0) lenDays = 1;
  const annualized = (Math.pow(1 + Math.max(avgV, -99) / 100, 365 / lenDays) - 1) * 100;
  return {
    rows, trades: rets.length,
    winRate: (wins / rets.length) * 100,
    avg: avgV, median,
    best: sorted[sorted.length - 1], worst: sorted[0],
    lenDays, annualized,
  };
};

// ── PATTERN SCANNER — best long/short seasonal windows ──────────────────────
const scanPatterns = (candles, years) => {
  const all = [];
  const lengths = [14, 21, 30, 45, 60, 91];
  const minTrades = Math.min(4, Math.max(2, years.length - 1));
  for (let m = 1; m <= 12; m++) for (const d of [1, 8, 15, 22]) {
    const startKey = m * 100 + d;
    const doy = Math.floor((new Date(2001, m - 1, d) - new Date(2001, 0, 1)) / 86400000);
    for (const L of lengths) {
      const end = new Date(2001, m - 1, d + L);
      const endKey = (end.getMonth() + 1) * 100 + end.getDate();
      const st = calcWindowStats(candles, startKey, endKey, years);
      if (!st || st.trades < minTrades) continue;
      all.push({ startKey, endKey, st, doy, L });
    }
  }
  const pickNonOverlapping = (sorted) => {
    const chosen = [];
    for (const x of sorted) {
      if (chosen.some(c => Math.abs(c.doy - x.doy) < Math.max(c.L, x.L) * 0.6)) continue;
      chosen.push(x);
      if (chosen.length >= 5) break;
    }
    return chosen;
  };
  const longs = pickNonOverlapping(
    all.filter(x => x.st.avg > 0)
      .sort((a, b) => b.st.avg * b.st.winRate - a.st.avg * a.st.winRate)
  );
  const shorts = pickNonOverlapping(
    all.filter(x => x.st.avg < 0)
      .sort((a, b) => (-b.st.avg) * (100 - b.st.winRate) - (-a.st.avg) * (100 - a.st.winRate))
  );
  return { longs, shorts };
};

// ── SPECTRAL CYCLE DETECTION (von-Thienen-style: DFT projection + Bartels) ──
// v3: ITERATIVE extraction (matching pursuit). The dominant cycle is measured,
// validated and then SUBTRACTED from the residual before re-scanning. Without
// this, cycle #1 masks everything else — secondary cycles test against a signal
// still full of #1's energy and score "dead". With it, each cycle is measured
// on a cleaned residual, so genuine secondary cycles surface with real scores.
const detectCyclesSpectral = (candles, maxCycles = 20) => {
  const n = candles.length;
  if (n < 80) return { cycles: [], trend: null, spectrum: [] };

  const y = candles.map(c => Math.log(Math.max(c.c, 1e-12)));

  // Linear fit kept only for the returned trend object (compat)
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxx += i * i; sxy += i * y[i]; }
  const den = n * sxx - sx * sx;
  const slope = den ? (n * sxy - sx * sy) / den : 0;
  const icept = (sy - slope * sx) / n;

  const minP = 8;
  const maxP = Math.min(Math.floor(n / 4), 500);
  if (maxP <= minP) return { cycles: [], trend: null, spectrum: [] };

  // HIGH-PASS detrend: subtract a centered moving average (window ≈ 1.2×maxP).
  // A linear detrend leaves the multi-year trend wiggle in the residual, which
  // then masquerades as huge phantom "cycles". The high-pass removes everything
  // slower than the analysis band while leaving phase intact (centered window).
  const L = Math.min(n - 1, (Math.round(maxP * 1.2) | 1));
  const halfL = Math.floor(L / 2);
  const ps = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) ps[i + 1] = ps[i] + y[i];
  const smooth = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - halfL), hi = Math.min(n - 1, i + halfL);
    smooth[i] = (ps[hi + 1] - ps[lo]) / (hi - lo + 1);
  }
  // Right-edge fix: the centered window shrinks near the end and bends the
  // trend estimate exactly where the phase refit anchors. Extrapolate the last
  // clean stretch of the smooth linearly instead.
  const eEnd = n - halfL;
  if (eEnd > 60) {
    const fitLen = Math.min(300, eEnd - 1);
    let fx = 0, fy = 0, fxx = 0, fxy = 0;
    for (let j = 0; j < fitLen; j++) {
      const idx = eEnd - fitLen + j;
      fx += j; fy += smooth[idx]; fxx += j * j; fxy += j * smooth[idx];
    }
    const fden = fitLen * fxx - fx * fx;
    const fsl = fden ? (fitLen * fxy - fx * fy) / fden : 0;
    const fic = (fy - fsl * fx) / fitLen;
    for (let i = eEnd; i < n; i++) smooth[i] = fic + fsl * (i - (eEnd - fitLen));
  }
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = y[i] - smooth[i];

  // Amplitude spectrum of an arbitrary series
  const scanSpectrum = (arr) => {
    const spec = [];
    for (let P = minP; P <= maxP; P++) {
      const w = (2 * Math.PI) / P;
      let ca = 0, sb = 0;
      for (let i = 0; i < n; i++) { ca += arr[i] * Math.cos(w * i); sb += arr[i] * Math.sin(w * i); }
      const a = (2 * ca) / n, b = (2 * sb) / n;
      spec.push({ period: P, a, b, amp: Math.hypot(a, b) });
    }
    return spec;
  };

  // Bartels-style phase-stability test on an arbitrary series: full-cycle
  // segments, each with its own mean + linear drift removed, phase coherence 0–1
  const bartelsOn = (arr, P) => {
    const w = (2 * Math.PI) / P;
    const k = Math.min(10, Math.floor(n / P));
    if (k < 2) return 0.3;
    const half = (P - 1) / 2;
    let den2 = 0;
    for (let i = 0; i < P; i++) den2 += (i - half) * (i - half);
    let re = 0, im = 0;
    for (let s = 0; s < k; s++) {
      const off = n - (s + 1) * P;
      let m0 = 0;
      for (let i = 0; i < P; i++) m0 += arr[off + i];
      m0 /= P;
      let num = 0;
      for (let i = 0; i < P; i++) num += (i - half) * (arr[off + i] - m0);
      const dr = den2 ? num / den2 : 0;
      let ca = 0, sb = 0;
      for (let i = 0; i < P; i++) {
        const g = off + i;
        const val = arr[g] - m0 - dr * (i - half);
        ca += val * Math.cos(w * g); sb += val * Math.sin(w * g);
      }
      const m = Math.hypot(ca, sb) || 1;
      re += ca / m; im += sb / m;
    }
    return Math.hypot(re, im) / k;
  };

  const firstSpec = scanSpectrum(r);
  const work = Float64Array.from(r);
  const found = [];
  let refAmp = null;

  for (let iter = 0; iter < Math.min(maxCycles, 12); iter++) {
    const spec = iter === 0 ? firstSpec : scanSpectrum(work);
    const peaks = [];
    for (let i = 1; i < spec.length - 1; i++) {
      if (spec[i].amp > spec[i - 1].amp && spec[i].amp >= spec[i + 1].amp) peaks.push(spec[i]);
    }
    peaks.sort((a, b) => b.amp - a.amp);

    // Among the strongest candidates, pick the one with the best amp·bartels²
    let best = null;
    for (const p of peaks.slice(0, 12)) {
      if (found.some(f => Math.abs(f.period - p.period) / Math.max(f.period, p.period) < 0.08)) continue;
      const bt = bartelsOn(work, p.period);
      const score = p.amp * bt * bt;
      if (!best || score > best.score) best = { ...p, bartels: bt, score };
    }
    if (!best) break;
    if (refAmp == null) refAmp = best.amp;
    if (best.amp < refAmp * 0.10) break; // remaining energy is noise
    found.push(best);

    // Subtract this cycle so the next scan sees a cleaned residual
    const w = (2 * Math.PI) / best.period;
    for (let i = 0; i < n; i++) work[i] -= best.a * Math.cos(w * i) + best.b * Math.sin(w * i);
  }

  // Drop phase-unstable candidates entirely unless that leaves too few
  let kept = found.filter(f => f.bartels >= 0.3);
  if (kept.length < 3) kept = found;

  // NOTE: no joint least-squares refit here. With several long cycles the
  // sine bases are near-collinear over a recency-weighted window, the normal
  // equations explode, and phases turn to garbage. Anchoring happens on REAL
  // bottoms below — far more robust than any regression.

  // BOTTOM-TO-BOTTOM anchoring + TOP-WITHIN-CYCLE skew:
  // From the fitted phase we know where each cycle's troughs sit. The skew is
  // then measured from the data: where do the actual tops occur between two
  // bottoms (relative position, averaged over the last complete cycles).
  // Tops are located on a SMOOTHED residual so noise spikes can't fake them.
  const psr = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) psr[i + 1] = psr[i] + r[i];
  const smoothAt = (i, h) => {
    const lo = Math.max(0, i - h), hi = Math.min(n - 1, i + h);
    return (psr[hi + 1] - psr[lo]) / (hi - lo + 1);
  };
  // Raw price extremes for snapping: the band signal finds the cycle turn,
  // but the user reads SWING lows/highs — so we snap to the actual wick
  const rawLo = candles.map(c => c.l), rawHi = candles.map(c => c.h);
  const snapToLow = (idx, hw) => {
    const lo = Math.max(0, idx - hw), hi = Math.min(n - 1, idx + hw);
    let b = idx, bv = Infinity;
    for (let i = lo; i <= hi; i++) if (rawLo[i] < bv) { bv = rawLo[i]; b = i; }
    return b;
  };
  const snapToHigh = (idx, hw) => {
    const lo = Math.max(0, idx - hw), hi = Math.min(n - 1, idx + hw);
    let b = idx, bv = -Infinity;
    for (let i = lo; i <= hi; i++) if (rawHi[i] > bv) { bv = rawHi[i]; b = i; }
    return b;
  };
  kept.forEach(c => {
    const P = c.period;
    const w = (2 * Math.PI) / P;
    const phi = Math.atan2(c.b, c.a);
    let t0 = ((phi + Math.PI) / w) % P;
    if (t0 < 0) t0 += P;
    const h = Math.max(2, Math.round(P / 12));
    const half = Math.round(P * 0.25);
    // Band-isolate this cycle: short MA minus MA of length ~P. An SMA of
    // window P has zero gain at period P, so subtracting it removes all slower
    // leakage (which shifts minima) while passing this cycle untouched.
    const hLong = Math.max(4, Math.round(P / 2));
    const bandAt = (i, hs) => smoothAt(i, hs) - smoothAt(i, hLong);
    // Locate the ACTUAL bottoms: search ±P/4 around each phase-predicted trough
    // for the true minimum of the smoothed residual (last 5 cycles)
    // Find the bottoms as a CHAIN: locate the most recent confirmed bottom
    // (wide search, since the phase guess t0 is only approximate), then walk
    // backwards one period at a time, re-centering each window on the last
    // confirmed bottom — so a coarse t0 can't derail the whole chain.
    const findBottom = (center, halfWin) => {
      const lo = Math.max(0, Math.round(center - halfWin)), hi = Math.min(n - 1, Math.round(center + halfWin));
      if (hi - lo < P * 0.2) return null;
      let best = lo, bv = Infinity;
      for (let i = lo; i <= hi; i++) { const v = bandAt(i, h); if (v < bv) { bv = v; best = i; } }
      // Reject minima clamped to the search edge or the data edge — those are
      // truncated / still-forming bottoms, not confirmed ones
      if (best <= lo + 1 || best >= hi - 1) return null;
      if (best > n - 1 - h) return null;
      // Snap to the actual swing low (wick) near the band minimum — tight
      // radius, otherwise a random deep wick nearby wins over the pivot
      return snapToLow(best, Math.min(7, Math.max(2, Math.round(P / 40))));
    };
    const bottoms = [];
    let seed = null;
    let tk = t0 + Math.floor((n - 1 - t0) / P) * P;
    for (let k = 0; k < 4 && seed == null; k++) { seed = findBottom(tk, P * 0.45); tk -= P; }
    if (seed != null) {
      bottoms.push(seed);
      let prev = seed;
      for (let k = 0; k < 6 && bottoms.length < 5; k++) {
        const found = findBottom(prev - P, P * 0.3);
        if (found == null) { prev -= P; continue; }
        bottoms.push(found);
        prev = found;
      }
    }
    bottoms.sort((x, z) => x - z);

    // Refined period = measured bottom-to-bottom spacing. The more spacings we
    // have, the more we trust the measurement over the coarse DFT bin.
    const spacings = [];
    for (let k = 1; k < bottoms.length; k++) {
      const d = bottoms[k] - bottoms[k - 1];
      if (d > P * 0.7 && d < P * 1.3) spacings.push(d);
    }
    let spacingCons = 0.75; // unknown regularity → mild penalty
    if (spacings.length >= 1) {
      const mean = spacings.reduce((x, z) => x + z, 0) / spacings.length;
      const trust = spacings.length >= 3 ? 0.85 : spacings.length === 2 ? 0.65 : 0.5;
      c.pf = (1 - trust) * P + trust * mean;
      if (spacings.length >= 2) {
        const sd = Math.sqrt(spacings.reduce((x, z) => x + (z - mean) ** 2, 0) / spacings.length);
        spacingCons = Math.max(0, Math.min(1, 1 - (sd / mean) * 2));
      }
    } else c.pf = P;

    // Anchor = the MOST RECENT real bottom, as an absolute bar index — exactly
    // like a manual Set Low. Averaging bottom phases mod the (coarse) bin
    // period while the wave runs on the refined period caused a phase offset.
    c.anchor = bottoms.length ? bottoms[bottoms.length - 1] : t0;

    // Skew = average relative top position between consecutive REAL bottoms.
    // Sharp smoothing + parabolic sub-bar refinement of the peak, then a gentle
    // de-bias (smoothing systematically compresses the estimate toward 0.5)
    const h2 = Math.max(2, Math.round(P / 24));
    let sum = 0, cnt = 0;
    for (let k = 1; k < bottoms.length; k++) {
      const a0 = bottoms[k - 1], b0 = bottoms[k];
      const len = b0 - a0;
      if (len < P * 0.5 || len > P * 1.5) continue;
      const lo = a0 + Math.round(len * 0.08), hi = b0 - Math.round(len * 0.08);
      let best = lo, bv = -Infinity;
      for (let i = lo; i <= hi; i++) { const v = bandAt(i, h2); if (v > bv) { bv = v; best = i; } }
      // Snap to the actual swing high (wick) near the band maximum — tight radius
      best = snapToHigh(best, Math.min(7, Math.max(2, Math.round(P / 40))));
      const pos = (best - a0) / len;
      if (pos > 0.05 && pos < 0.95) { sum += pos; cnt++; }
    }
    const rawSkew = cnt ? sum / cnt : 0.5;
    c.skew = Math.min(0.85, Math.max(0.15, 0.5 + (rawSkew - 0.5) * 1.5));

    // ACCURACY = phase stability (Bartels) × bottom-timing regularity
    c.acc = c.bartels * (0.6 + 0.4 * spacingCons);
    c.spacingCons = spacingCons;
    c.nBottoms = bottoms.length;
    c.nSpacings = spacings.length;
  });

  // QUALITY GATE: a cycle only makes the list if it proved itself on the chart —
  // at least 3 confirmed swing pivot lows, with at least 2 consecutive
  // bottom-to-bottom spacings inside the valid rhythm band (0.7–1.3 × P).
  kept = kept.filter(c => (c.nBottoms ?? 0) >= 3 && (c.nSpacings ?? 0) >= 2);
  // Sort by accuracy, top-down
  kept.sort((a, b) => (b.acc ?? 0) - (a.acc ?? 0) || b.score - a.score);
  const maxStr = kept.length ? Math.max(...kept.map(f => f.score)) : 1;

  const cycles = kept.map(s => ({
    period: s.period, pf: s.pf, a: s.a, b: s.b, amp: s.amp, bartels: s.bartels,
    anchor: s.anchor, skew: s.skew,
    acc: s.acc, accPct: (s.acc ?? s.bartels) * 100, spacingCons: s.spacingCons,
    nBottoms: s.nBottoms,
    strength: s.score,
    strengthPct: maxStr > 0 ? (s.score / maxStr) * 100 : 0,
    bartelsPct: s.bartels * 100,
  }));

  // Downsampled spectrum for the mini strip chart (first pass, pre-extraction)
  const stripBins = 110;
  const chunk = Math.max(1, Math.ceil(firstSpec.length / stripBins));
  const spectrum = [];
  for (let i = 0; i < firstSpec.length; i += chunk) {
    let best = firstSpec[i];
    for (let j = i; j < Math.min(i + chunk, firstSpec.length); j++) if (firstSpec[j].amp > best.amp) best = firstSpec[j];
    spectrum.push({ period: best.period, amp: best.amp });
  }

  return { cycles, trend: { slope, icept }, spectrum };
};

// Composite oscillator: each selected cycle contributes with UNIT amplitude
// (real detected phase, normalized swing) — same visual philosophy as the
// trough composite. Raw detected amplitudes create ugly beating envelopes when
// periods are close; equal weights keep the wave clean and readable while the
// timing information (what cycles are for) stays exact.
// Composite built EXACTLY like the trough (Set Low) mode: each cycle is a
// trough-pinned skewed wave over the FULL history + projection. Anchor comes
// from the detected phase (bottom-to-bottom), skew from where the real tops sit
// between two bottoms. Unit amplitude per cycle for a clean, readable wave.
const buildSpectralComposite = (candles, cycles) => {
  if (!candles.length || !cycles.length) return [];
  const n = candles.length;
  const fwd = Math.min(Math.ceil(n * 0.5), 500);
  const pts = [];
  for (let t = 0; t < n + fwd; t++) {
    let v = 0;
    for (const c of cycles) {
      const P = c.pf || c.period;
      const anchor = c.anchor ?? 0;
      const split = c.skew ?? 0.5;
      const phase = (((t - anchor) % P) + P) % P / P;
      const distorted = phase < split
        ? (phase / split) * Math.PI
        : Math.PI + ((phase - split) / (1 - split)) * Math.PI;
      v += -Math.cos(distorted);
    }
    pts.push({ t, v, isFuture: t >= n });
  }
  return pts;
};

// ── BAR CHART ─────────────────────────────────────────────────────────────────
function BarChart({ data, title }) {
  const vals = data.map(d => d.val);
  const maxAbs = Math.max(...vals.map(Math.abs), 0.001);
  const H = 248, PAD = { top: 40, bottom: 52, left: 52, right: 16 };
  const W = 560;
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const slotW = iW / data.length;
  const barW = Math.max(Math.floor(slotW * 0.55), 8);
  const zeroY = PAD.top + iH / 2;
  const yScale = (v) => zeroY - (v / maxAbs) * (iH / 2);

  // Y axis ticks — nice round numbers
  const yTicks = [-maxAbs, -maxAbs/2, 0, maxAbs/2, maxAbs];

  return (
    <div style={{ flex: 1, minWidth: 360 }}>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: "#444", textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line key={i} x1={PAD.left} x2={W - PAD.right} y1={yScale(v)} y2={yScale(v)}
            stroke={v === 0 ? "#2a2a2a" : "#181818"} strokeWidth={v === 0 ? 1 : 0.5} />
        ))}

        {/* Y labels */}
        {yTicks.map((v, i) => (
          <text key={i} x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end"
            fill={v === 0 ? "#333" : "#2a2a2a"} fontSize="9" fontFamily="'DM Mono', monospace">
            {v >= 0 ? "+" : ""}{v.toFixed(1)}%
          </text>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const x = PAD.left + slotW * i + (slotW - barW) / 2;
          const barH = Math.max(Math.abs(yScale(d.val) - zeroY), 1);
          const y = d.val >= 0 ? yScale(d.val) : zeroY;
          const color = d.val >= 0 ? "#22c55e" : "#ef4444";
          const colorFill = d.val >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
          // Label position: above bar if positive, below if negative
          const labelY = d.val >= 0 ? yScale(d.val) - 6 : zeroY + barH + 14;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH}
                fill={colorFill} stroke={color} strokeWidth="1" rx="2" />
              {/* Value label */}
              <text x={x + barW / 2} y={labelY} textAnchor="middle"
                fill={color} fontSize="8.5" fontFamily="'DM Mono', monospace" fontWeight="600">
                {d.val >= 0 ? "+" : ""}{d.val.toFixed(2)}%
              </text>
              {/* X label */}
              <text x={x + barW / 2} y={H - 18} textAnchor="middle"
                fill="#444" fontSize="9.5" fontFamily="'DM Mono', monospace">
                {d.label}
              </text>
              {/* Win rate */}
              {d.wr != null && d.n > 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle"
                  fill={d.wr >= 60 ? "#22c55e" : d.wr <= 40 ? "#ef4444" : "#333"} fontSize="7.5" fontFamily="'DM Mono', monospace">
                  {d.wr.toFixed(0)}% WR
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}


// ── INDICATOR CALCULATIONS ────────────────────────────────────────────────────
const calcSMA = (candles, period) => {
  const result = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    const sum = candles.slice(i - period + 1, i + 1).reduce((a, c) => a + c.c, 0);
    result[i] = sum / period;
  }
  return result;
};

const calcEMA = (candles, period) => {
  const result = new Array(candles.length).fill(null);
  const k = 2 / (period + 1);
  let ema = candles[period - 1]?.c;
  if (ema == null) return result;
  result[period - 1] = ema;
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].c * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
};

const calcBollinger = (candles, period = 20, mult = 2) => {
  const mid = calcSMA(candles, period);
  const upper = new Array(candles.length).fill(null);
  const lower = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1).map(c => c.c);
    const mean = mid[i];
    const sd = Math.sqrt(slice.reduce((a, v) => a + (v - mean) ** 2, 0) / period);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { mid, upper, lower };
};

const calcSAR = (candles, step = 0.02, max = 0.2) => {
  const result = new Array(candles.length).fill(null);
  if (candles.length < 2) return result;
  let bull = true;
  let sar = candles[0].l;
  let ep = candles[0].h;
  let af = step;
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    sar = sar + af * (ep - sar);
    if (bull) {
      if (cur.l < sar) {
        bull = false; sar = ep; ep = cur.l; af = step;
      } else {
        if (cur.h > ep) { ep = cur.h; af = Math.min(af + step, max); }
        sar = Math.min(sar, prev.l, i > 1 ? candles[i-2].l : prev.l);
      }
    } else {
      if (cur.h > sar) {
        bull = true; sar = ep; ep = cur.h; af = step;
      } else {
        if (cur.l < ep) { ep = cur.l; af = Math.min(af + step, max); }
        sar = Math.max(sar, prev.h, i > 1 ? candles[i-2].h : prev.h);
      }
    }
    result[i] = { val: sar, bull };
  }
  return result;
};

const calcSupertrend = (candles, period = 10, mult = 3) => {
  const result = new Array(candles.length).fill(null);
  const atr = new Array(candles.length).fill(0);
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i-1].c),
      Math.abs(candles[i].l - candles[i-1].c)
    );
    atr[i] = i < period ? tr : (atr[i-1] * (period-1) + tr) / period;
  }
  let upper = 0, lower = 0, trend = 1;
  for (let i = period; i < candles.length; i++) {
    const hl2 = (candles[i].h + candles[i].l) / 2;
    const bu = hl2 + mult * atr[i];
    const bl = hl2 - mult * atr[i];
    upper = (bu < upper || candles[i-1].c > upper) ? bu : upper;
    lower = (bl > lower || candles[i-1].c < lower) ? bl : lower;
    if (candles[i].c > upper) trend = 1;
    else if (candles[i].c < lower) trend = -1;
    result[i] = { val: trend === 1 ? lower : upper, bull: trend === 1 };
  }
  return result;
};

// Support/Resistance: pivot highs/lows in the visible range, clustered within
// 0.6% into levels. A level's weight = number of touches; top 6 returned.
const calcResistance = (visible) => {
  const n = visible.length;
  if (n < 20) return [];
  const lb = Math.max(4, Math.floor(n / 40));
  const piv = [];
  for (let i = lb; i < n - lb; i++) {
    let isH = true, isL = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (visible[j].h > visible[i].h) isH = false;
      if (visible[j].l < visible[i].l) isL = false;
      if (!isH && !isL) break;
    }
    if (isH) piv.push({ p: visible[i].h, i });
    if (isL) piv.push({ p: visible[i].l, i });
  }
  if (!piv.length) return [];
  piv.sort((a, b) => a.p - b.p);
  const clusters = [];
  for (const pv of piv) {
    const c = clusters[clusters.length - 1];
    if (c && (pv.p - c.hi) / c.avg < 0.006) {
      c.touches++; c.sum += pv.p; c.hi = Math.max(c.hi, pv.p); c.last = Math.max(c.last, pv.i);
      c.avg = c.sum / c.touches;
    } else {
      clusters.push({ sum: pv.p, avg: pv.p, hi: pv.p, touches: 1, last: pv.i });
    }
  }
  clusters.sort((a, b) => b.touches - a.touches || b.last - a.last);
  return clusters.slice(0, 6).map(c => ({ level: c.avg, touches: c.touches }));
};

// ── INDICATOR SETTINGS DEFAULTS ───────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  sma:        { period: 20 },
  ema:        { period: 21 },
  boll:       { period: 20, mult: 2 },
  sar:        { step: 0.02, max: 0.2 },
  supertrend: { period: 10, mult: 3 },
  resist:     {},
};

// ── PRICE CHART (zoom/pan) ────────────────────────────────────────────────────
function PriceChart({ candles, interval, activeIndicators, indSettings, compositeWave, waveDirect, pickingAnchor, onAnchorPick }) {
  const svgRef = useRef(null);
  const viewRef = useRef({ startIdx: 0, endIdx: Math.max(0, candles.length - 1) });
  const [viewVersion, setViewVersion] = useState(0); // trigger re-render
  const [hover, setHover] = useState(null);
  const isPanningRef = useRef(false);
  const panStart = useRef(null);
  const candlesRef = useRef(candles);
  const priceScaleRef = useRef({ minP: 0, pad: 0, range: 1 });
  candlesRef.current = candles;

  const W = 1000, H = 340, PAD = { top: 20, right: 20, bottom: 40, left: 80 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const fmtLabel = (ts) => {
    const d = new Date(ts);
    return interval === "1d"
      ? d.toLocaleDateString([], { day: "numeric", month: "short", year: "2-digit" })
      : d.toLocaleDateString([], { month: "short", year: "2-digit" });
  };

  const fmtPrice = (p) => {
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    if (p < 100) return p.toFixed(2);
    return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };

  // Reset view when candles change
  useEffect(() => {
    if (candles.length > 0) {
      const defaultShow = Math.min(candles.length, interval === "1d" ? 365 : 104);
      viewRef.current = { startIdx: candles.length - defaultShow, endIdx: candles.length - 1 };
      setViewVersion(v => v + 1);
    }
  }, [candles, interval]);

  // All interaction via refs — no state for zoom/pan so no re-render glitches
  const doZoom = useCallback((delta, centerFrac = 0.5) => {
    const { startIdx, endIdx } = viewRef.current;
    const len = endIdx - startIdx;
    const step = Math.max(1, Math.round(len * 0.15));
    const leftStep = Math.round(step * centerFrac);
    const rightStep = step - leftStep;
    let ns = startIdx + delta * leftStep;
    let ne = endIdx - delta * rightStep;
    if (ne - ns < 5) return;
    ns = Math.max(0, ns);
    const lastReal = candlesRef.current.length - 1;
    const viewLen = ne - ns;
    const maxEnd = lastReal + Math.floor(viewLen * 0.5);
    ne = Math.min(maxEnd, ne);
    viewRef.current = { startIdx: ns, endIdx: ne };
    setViewVersion(v => v + 1);
  }, []);

  // Wheel on SVG element — non-passive via ref
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const frac = (e.clientX - rect.left - PAD.left * (rect.width / W)) / (iW * (rect.width / W));
      doZoom(e.deltaY > 0 ? -1 : 1, Math.max(0, Math.min(1, frac)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }); // no deps — re-attach every render so ref is always fresh

  const handleMouseDown = (e) => {
    if (pickingAnchor && onAnchorPick) {
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const { startIdx, endIdx } = viewRef.current;
        const slots = endIdx - startIdx + 1;
        const idx = Math.max(0, Math.min(slots - 1, Math.round((x - PAD.left) / iW * (slots - 1))));
        onAnchorPick(startIdx + idx);
      }
      return;
    }
    isPanningRef.current = true;
    panStart.current = { x: e.clientX, start: viewRef.current.startIdx, end: viewRef.current.endIdx };
  };

  const handleMouseUp = () => { isPanningRef.current = false; };

  // Hover-only mousemove — pan is handled by document listener below
  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const { startIdx, endIdx } = viewRef.current;
    const slots = endIdx - startIdx + 1;
    const idx = Math.max(0, Math.min(slots - 1, Math.round((x - PAD.left) / iW * (slots - 1))));
    const absIdx = startIdx + idx;
    const c = candlesRef.current[absIdx];
    const xPos = PAD.left + (idx / Math.max(slots - 1, 1)) * iW;
    if (c) {
      const { minP, pad, range } = priceScaleRef.current;
      const yPos = PAD.top + iH - ((c.c - (minP - pad)) / (range + pad * 2)) * iH;
      setHover({ x: xPos, y: yPos, candle: c });
    } else {
      setHover({ x: xPos, y: PAD.top + iH / 2, candle: null });
    }
  };

  // Pan on document so mouse-leave doesn't kill it
  useEffect(() => {
    const onMove = (e) => {
      if (!isPanningRef.current || !panStart.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dx = e.clientX - panStart.current.x;
      const { start: ps, end: pe } = panStart.current;
      const len = pe - ps;
      const pixPerCandle = (iW * rect.width / W) / Math.max(len, 1);
      const shift = Math.round(-dx / pixPerCandle);
      let ns = ps + shift;
      let ne = ns + len;
      const lastReal = candlesRef.current.length - 1;
      const maxEnd = lastReal + Math.floor(len * 0.5);
      if (ns < 0) { ns = 0; ne = len; }
      if (ne > maxEnd) { ne = maxEnd; ns = Math.max(0, ne - len); }
      viewRef.current = { startIdx: ns, endIdx: ne };
      setViewVersion(v => v + 1);
    };
    const onUp = () => { isPanningRef.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [iW]);

  // ALL hooks done — early return safe here
  if (!candles.length) return null;

  const { startIdx, endIdx } = viewRef.current;
  const realEnd = Math.min(endIdx, candles.length - 1);
  const visible = candles.slice(startIdx, realEnd + 1);
  if (visible.length < 2) return null;
  const totalSlots = endIdx - startIdx + 1;

  const prices = visible.flatMap(c => [c.h, c.l]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const pad = range * 0.05;

  priceScaleRef.current = { minP, pad, range };

  const xScale = (i) => PAD.left + (i / Math.max(totalSlots - 1, 1)) * iW;
  const yScale = (v) => PAD.top + iH - ((v - (minP - pad)) / (range + pad * 2)) * iH;

  const pathD = visible.map((c, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(c.c)}`).join(" ");
  const areaD = pathD + ` L ${xScale(visible.length - 1)} ${PAD.top + iH} L ${PAD.left} ${PAD.top + iH} Z`;

  const isUp = visible[visible.length - 1].c >= visible[0].c;
  const color = isUp ? "#22c55e" : "#ef4444";

  const xStep = Math.max(1, Math.floor(totalSlots / 7));
  const xLabels = Array.from({ length: 8 }, (_, i) => Math.round(i * (totalSlots - 1) / 7));
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => minP - pad + ((range + pad * 2) / (yTicks - 1)) * i);

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: pickingAnchor ? "cell" : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHover(null); }}>

        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <clipPath id="chartClip">
            <rect x={PAD.left} y={PAD.top} width={iW} height={iH} />
          </clipPath>
        </defs>

        {/* Grid */}
        {yLabels.map((v, i) => (
          <line key={i} x1={PAD.left} x2={W - PAD.right} y1={yScale(v)} y2={yScale(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}

        {/* Y labels */}
        {yLabels.map((v, i) => (
          <text key={i} x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" fill="#444" fontSize="11" fontFamily="'DM Mono', monospace">
            {fmtPrice(v)}
          </text>
        ))}

        {/* X labels — real + future */}
        {Array.from({ length: 8 }, (_, i) => {
          const slotIdx = Math.round(i * (totalSlots - 1) / 7);
          const x = xScale(slotIdx);
          const isFut = slotIdx >= visible.length;
          const msPerBar = interval === "1d" ? 86400000 : 604800000;
          const ts = isFut
            ? visible[visible.length-1].t + (slotIdx - (visible.length-1)) * msPerBar
            : visible[Math.min(slotIdx, visible.length-1)]?.t;
          return (
            <text key={i} x={x} y={H - 8} textAnchor="middle"
              fill={isFut ? "#2a2a2a" : "#444"} fontSize="10" fontFamily="'DM Mono', monospace">
              {ts ? fmtLabel(ts) : ""}
            </text>
          );
        })}

        {/* Line only */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />

        {/* ── INDICATORS ── */}
        {(() => {
          const els = [];
          const toPath = (vals, clr, dash) => {
            let d = ""; let started = false;
            vals.forEach((v, i) => {
              if (v == null) { started = false; return; }
              const x = xScale(i), y = yScale(v);
              d += started ? ` L ${x} ${y}` : ` M ${x} ${y}`;
              started = true;
            });
            return d ? <path key={clr+dash} d={d} fill="none" stroke={clr} strokeWidth="1.2" strokeDasharray={dash||""} opacity="0.85" /> : null;
          };

          if (activeIndicators.has("sma")) {
            const s = calcSMA(candles, indSettings.sma.period).slice(startIdx, endIdx+1);
            els.push(toPath(s, "#f59e0b", ""));
          }
          if (activeIndicators.has("ema")) {
            const e = calcEMA(candles, indSettings.ema.period).slice(startIdx, endIdx+1);
            els.push(toPath(e, "#818cf8", ""));
          }
          if (activeIndicators.has("boll")) {
            const b = calcBollinger(candles, indSettings.boll.period, indSettings.boll.mult);
            els.push(toPath(b.upper.slice(startIdx, endIdx+1), "#38bdf8", "4 2"));
            els.push(toPath(b.mid.slice(startIdx, endIdx+1), "#38bdf8", ""));
            els.push(toPath(b.lower.slice(startIdx, endIdx+1), "#38bdf8", "4 2"));
            // Fill between bands
            const up = b.upper.slice(startIdx, endIdx+1);
            const lo = b.lower.slice(startIdx, endIdx+1);
            let fd = "";
            up.forEach((v, i) => { if (v != null) fd += fd ? ` L ${xScale(i)} ${yScale(v)}` : `M ${xScale(i)} ${yScale(v)}`; });
            for (let i = lo.length-1; i >= 0; i--) { if (lo[i] != null) fd += ` L ${xScale(i)} ${yScale(lo[i])}`; }
            if (fd) els.push(<path key="bollfill" d={fd+"Z"} fill="rgba(56,189,248,0.04)" stroke="none"/>);
          }
          if (activeIndicators.has("sar")) {
            const sarData = calcSAR(candles, indSettings.sar.step, indSettings.sar.max).slice(startIdx, endIdx+1);
            const dots = sarData.map((s, i) => s ? (
              <circle key={i} cx={xScale(i)} cy={yScale(s.val)} r="2"
                fill="#d4af37" opacity="0.9"/>
            ) : null);
            els.push(<g key="sar">{dots}</g>);
          }
          if (activeIndicators.has("supertrend")) {
            const st = calcSupertrend(candles, indSettings.supertrend.period, indSettings.supertrend.mult).slice(startIdx, endIdx+1);
            // Build separate segments, each closed individually between ST line and price
            let seg = null;
            const segments = [];
            st.forEach((s, i) => {
              if (!s || !visible[i]) { if (seg) { segments.push(seg); seg = null; } return; }
              if (!seg || seg.bull !== s.bull) {
                if (seg) segments.push(seg);
                seg = { bull: s.bull, points: [] };
              }
              seg.points.push({ i, stY: yScale(s.val), priceY: yScale(visible[i].c) });
            });
            if (seg) segments.push(seg);

            segments.forEach((seg, si) => {
              if (seg.points.length < 2) return;
              const color = seg.bull ? "#22c55e" : "#ef4444";
              const fill = seg.bull ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)";
              // Top edge: ST line forward
              let d = seg.points.map((p, j) => `${j===0?"M":"L"} ${xScale(p.i)} ${p.stY}`).join(" ");
              // Bottom edge: price line reversed
              d += " " + [...seg.points].reverse().map(p => `L ${xScale(p.i)} ${p.priceY}`).join(" ");
              d += " Z";
              els.push(<path key={"st"+si} d={d} fill={fill} stroke={color} strokeWidth="0.8" opacity="0.9"/>);
            });
          }
          if (activeIndicators.has("resist")) {
            const levels = calcResistance(visible);
            const lastClose = visible[visible.length - 1].c;
            levels.forEach(({ level, touches }, i) => {
              const y = yScale(level);
              if (y < PAD.top + 6 || y > PAD.top + iH - 4) return;
              const isRes = level >= lastClose;
              const clr = isRes ? "#ef4444" : "#22c55e";
              const op = Math.min(0.35 + touches * 0.12, 0.85);
              els.push(<line key={"res"+i} x1={PAD.left} x2={W-PAD.right} y1={y} y2={y} stroke={clr} strokeWidth={touches >= 3 ? 1.1 : 0.8} strokeDasharray="6 4" opacity={op}/>);
              els.push(
                <text key={"restxt"+i} x={W-PAD.right-6} y={y-4} textAnchor="end"
                  fill={clr} fontSize="9" fontFamily="'DM Mono',monospace" opacity={Math.min(op + 0.15, 1)}>
                  {fmtPrice(level)}{touches > 1 ? ` ·${touches}x` : ""}
                </text>
              );
            });
          }
          return els;
        })()}

        {/* ── COMPOSITE CYCLE WAVE ── */}
        {compositeWave && compositeWave.length > 1 && (() => {
          const visibleWave = compositeWave.filter(p => p.t >= startIdx && p.t <= endIdx);
          if (visibleWave.length < 2) return null;
          let waveToPrice;
          if (waveDirect) {
            // Spectral composite is already in real price space — plot 1:1
            waveToPrice = (v) => v;
          } else {
            // Trough composite: normalize wave to fit within visible price range
            const waveMin = Math.min(...visibleWave.map(p => p.v));
            const waveMax = Math.max(...visibleWave.map(p => p.v));
            const waveRange = waveMax - waveMin || 1;
            waveToPrice = (v) => minP + ((v - waveMin) / waveRange) * (maxP - minP);
          }

          const histPoints = compositeWave.filter(p => !p.isFuture);
          const futPoints = compositeWave.filter(p => p.isFuture);

          // Paths keyed by the point's absolute index p.t — works for waves
          // that start at 0 (trough) or mid-history (spectral analysis window)
          const buildPath = (pts) => {
            let d = "";
            pts.forEach(p => {
              const xi = p.t - startIdx;
              if (xi < 0 || xi > totalSlots - 1) return;
              const x = xScale(xi);
              const y = yScale(waveToPrice(p.v));
              d += d ? ` L ${x} ${y}` : `M ${x} ${y}`;
            });
            return d;
          };

          const histPath = buildPath(histPoints);
          const futPath = buildPath(futPoints);

          // Projected turning points: local extrema of the future wave, with dates
          const msPerBar = interval === "1d" ? 86400000 : 604800000;
          const nReal = candles.length;
          const lastRealTs = candles[nReal - 1].t;
          const turns = [];
          for (let i = 2; i < futPoints.length - 2; i++) {
            const v = futPoints[i].v;
            const isHigh = v >= futPoints[i-1].v && v >= futPoints[i-2].v && v > futPoints[i+1].v && v > futPoints[i+2].v;
            const isLow  = v <= futPoints[i-1].v && v <= futPoints[i-2].v && v < futPoints[i+1].v && v < futPoints[i+2].v;
            if (isHigh || isLow) turns.push({ p: futPoints[i], type: isHigh ? "high" : "low" });
          }
          // RSI-style fill: in each projected turn zone, fill the area BETWEEN
          // the cycle curve and a threshold level (25% of the wave's swing away
          // from the extreme). Gradient runs from nothing at the threshold to
          // gold at the curve — capped on the price axis by construction.
          const visVals = visibleWave.map(q => q.v);
          const vAmp = (Math.max(...visVals) - Math.min(...visVals)) || 1;
          const glowEls = turns.slice(0, 8).map(({ p, type }, k) => {
            const idx = futPoints.indexOf(p);
            if (idx < 0) return null;
            const thr = type === "high" ? p.v - 0.25 * vAmp : p.v + 0.25 * vAmp;
            const beyond = v => (type === "high" ? v >= thr : v <= thr);
            let i0 = idx, i1 = idx;
            while (i0 > 0 && beyond(futPoints[i0 - 1].v)) i0--;
            while (i1 < futPoints.length - 1 && beyond(futPoints[i1 + 1].v)) i1++;
            if (i1 - i0 < 3) return null;
            const pts = [];
            for (let i = i0; i <= i1; i++) {
              const xi = futPoints[i].t - startIdx;
              if (xi < 0 || xi > totalSlots - 1) continue;
              pts.push({ x: xScale(xi), y: yScale(waveToPrice(futPoints[i].v)) });
            }
            if (pts.length < 3) return null;
            const yThr = yScale(waveToPrice(thr));
            const yExt = yScale(waveToPrice(p.v));
            let d = `M ${pts[0].x} ${yThr}`;
            pts.forEach(q => { d += ` L ${q.x} ${q.y}`; });
            d += ` L ${pts[pts.length - 1].x} ${yThr} Z`;
            return (
              <g key={"glow" + k}>
                <linearGradient id={`tgl${k}`} gradientUnits="userSpaceOnUse" x1="0" y1={yThr} x2="0" y2={yExt}>
                  <stop offset="0%" stopColor="#d4af37" stopOpacity="0" />
                  <stop offset="70%" stopColor="#d4af37" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#d4af37" stopOpacity="0.22" />
                </linearGradient>
                <path d={d} fill={`url(#tgl${k})`} stroke="none" />
              </g>
            );
          });

          // Only label turns with enough horizontal breathing room (dots always drawn)
          let lastLblX = -1e9;
          const turnEls = turns.slice(0, 8).map(({ p, type }, k) => {
            const xi = p.t - startIdx;
            if (xi < 0 || xi > totalSlots - 1) return null;
            const x = xScale(xi);
            if (x > W - PAD.right || x < PAD.left) return null;
            const y = yScale(waveToPrice(p.v));
            const ts = lastRealTs + (p.t - (nReal - 1)) * msPerBar;
            const clr = type === "low" ? "#22c55e" : "#ef4444";
            const showLbl = x - lastLblX >= 115;
            if (showLbl) lastLblX = x;
            const yLbl = type === "low"
              ? Math.min(y + 40, PAD.top + iH - 6)
              : Math.max(y - 32, PAD.top + 12);
            return (
              <g key={"turn" + k}>
                <circle cx={x} cy={y} r="3.5" fill={clr} stroke="#0a0a0a" strokeWidth="1.5" />
                {showLbl && (
                  <text x={x} y={yLbl} textAnchor="middle"
                    fill={clr} fontSize="9" fontFamily="'DM Mono', monospace" fontWeight="600">
                    {type === "low" ? "▲ " : "▼ "}{fmtLabel(ts)}
                  </text>
                )}
              </g>
            );
          });

          return (
            <g clipPath="url(#chartClip)">
              {glowEls}
              {histPath && <path d={histPath} fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.85" strokeLinejoin="round" />}
              {futPath && <path d={futPath} fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.45" strokeDasharray="6 4" strokeLinejoin="round" />}
              {turnEls}
            </g>
          );
        })()}

        {/* Hover — crosshair + time tag */}
        {hover && (() => {
          const slotIdx = Math.round((hover.x - PAD.left) / iW * (totalSlots - 1));
          const isFut = slotIdx >= visible.length;
          const msPerBar = interval === "1d" ? 86400000 : 604800000;
          const ts = isFut
            ? visible[visible.length-1].t + (slotIdx - (visible.length-1)) * msPerBar
            : visible[Math.max(0, Math.min(slotIdx, visible.length-1))]?.t;
          const label = ts ? fmtLabel(ts) : "";
          const tagW = label.length * 6.5 + 12;
          const tagX = Math.max(PAD.left, Math.min(hover.x - tagW/2, W - PAD.right - tagW));
          return (
            <>
              <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + iH} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="4,3" />
              <line x1={PAD.left} x2={W - PAD.right} y1={hover.y} y2={hover.y} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="4,3" />
              {hover.candle && <circle cx={hover.x} cy={hover.y} r="4" fill={color} stroke="#0a0a0a" strokeWidth="2" />}
              <rect x={tagX} y={H - PAD.bottom + 2} width={tagW} height={18} fill="#1a1a1a" rx="3" />
              <text x={tagX + tagW/2} y={H - PAD.bottom + 14} textAnchor="middle"
                fill={isFut ? "#d4af37" : "#f8e49b"} fontSize="10"
                fontFamily="'DM Mono', monospace" fontWeight="600">{label}</text>
            </>
          );
        })()}
      </svg>

      {/* Tooltip */}
      {hover && hover.candle && (
        <div style={{ position: "absolute", top: 12, left: hover.x / W * 100 > 60 ? 90 : "auto", right: hover.x / W * 100 > 60 ? "auto" : 30, background: "rgba(15,17,23,0.78)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "8px 14px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#e8e8e8", pointerEvents: "none" }}>
          <div style={{ color: "#555", fontSize: 10, marginBottom: 2 }}>{fmtLabel(hover.candle.t)}</div>
          <div style={{ color, fontSize: 16, fontWeight: 600 }}>{fmtPrice(hover.candle.c)}</div>
        </div>
      )}
    </div>
  );
}

// ── SEASONAL CHART (Seasonax-style, drag to select a window) ─────────────────
function SeasonalChart({ pattern, curPath, showCur, selection, onSelect }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [dragSel, setDragSel] = useState(null); // {a, b} indices while dragging
  const [hoverI, setHoverI] = useState(null);

  const W = 1000, H = 300, PAD = { top: 20, right: 20, bottom: 34, left: 64 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const idxFromEvent = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    return Math.max(0, Math.min(pattern.length - 1, Math.round((x - PAD.left) / iW * (pattern.length - 1))));
  };

  // Finish drag even if mouse leaves the SVG
  useEffect(() => {
    const onUp = () => {
      if (dragRef.current == null) return;
      const { a, b } = dragRef.current;
      dragRef.current = null;
      setDragSel(null);
      if (Math.abs(a - b) >= 3) {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        onSelect({ startKey: pattern[lo].key, endKey: pattern[hi].key });
      } else {
        onSelect(null);
      }
    };
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [pattern, onSelect]);

  if (!pattern || pattern.length < 10) return null;

  const keyToIdx = new Map(pattern.map((p, i) => [p.key, i]));
  const curPts = showCur && curPath
    ? curPath.points.map(p => ({ i: keyToIdx.get(p.key), v: p.v })).filter(p => p.i != null)
    : [];

  const vals = [...pattern.map(p => p.v), ...curPts.map(p => p.v)];
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const vpad = range * 0.08;
  const xS = (i) => PAD.left + (i / (pattern.length - 1)) * iW;
  const yS = (v) => PAD.top + iH - ((v - (minV - vpad)) / (range + 2 * vpad)) * iH;

  // Month boundaries
  const monthMarks = [];
  let lastM = null;
  pattern.forEach((p, i) => {
    const m = Math.floor(p.key / 100);
    if (m !== lastM) { monthMarks.push({ i, m }); lastM = m; }
  });

  const pathD = pattern.map((p, i) => `${i ? "L" : "M"} ${xS(i)} ${yS(p.v)}`).join(" ");
  const areaD = pathD + ` L ${xS(pattern.length - 1)} ${PAD.top + iH} L ${PAD.left} ${PAD.top + iH} Z`;
  const curD = curPts.map((p, j) => `${j ? "L" : "M"} ${xS(p.i)} ${yS(p.v)}`).join(" ");

  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => minV - vpad + ((range + 2 * vpad) / (yTicks - 1)) * i);

  // Active selection region (drag preview wins over committed selection)
  let selRange = null;
  if (dragSel) selRange = [Math.min(dragSel.a, dragSel.b), Math.max(dragSel.a, dragSel.b)];
  else if (selection) {
    const a = keyToIdx.get(selection.startKey), b = keyToIdx.get(selection.endKey);
    if (a != null && b != null) selRange = [Math.min(a, b), Math.max(a, b)];
  }

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
        onMouseDown={(e) => {
          const i = idxFromEvent(e);
          if (i == null) return;
          dragRef.current = { a: i, b: i };
          setDragSel({ a: i, b: i });
        }}
        onMouseMove={(e) => {
          const i = idxFromEvent(e);
          if (i == null) return;
          setHoverI(i);
          if (dragRef.current) {
            dragRef.current.b = i;
            setDragSel({ ...dragRef.current });
          }
        }}
        onMouseLeave={() => setHoverI(null)}>

        {/* Month grid + labels */}
        {monthMarks.map(({ i, m }, j) => (
          <g key={j}>
            <line x1={xS(i)} x2={xS(i)} y1={PAD.top} y2={PAD.top + iH} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={xS(i) + 4} y={H - 10} fill="#444" fontSize="9.5" fontFamily="'DM Mono', monospace">
              {MONTH_SHORT[m - 1]}
            </text>
          </g>
        ))}

        {/* Y grid + labels (indexed to 100 at start of year) */}
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yS(v)} y2={yS(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={PAD.left - 8} y={yS(v) + 4} textAnchor="end" fill="#444" fontSize="10" fontFamily="'DM Mono', monospace">
              {(v - 100 >= 0 ? "+" : "") + (v - 100).toFixed(1)}%
            </text>
          </g>
        ))}

        {/* Selection highlight */}
        {selRange && (
          <rect x={xS(selRange[0])} y={PAD.top} width={Math.max(xS(selRange[1]) - xS(selRange[0]), 1)} height={iH}
            fill="rgba(212,175,55,0.08)" stroke="#d4af37" strokeWidth="1" strokeDasharray="4 3" />
        )}

        {/* Seasonal curve */}
        <defs>
          <linearGradient id="seasonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#seasonGrad)" stroke="none" />
        <path d={pathD} fill="none" stroke="#d4af37" strokeWidth="1.6" strokeLinejoin="round" />

        {/* Current year overlay */}
        {curD && <path d={curD} fill="none" stroke="#e8e8e8" strokeWidth="1.2" opacity="0.75" strokeLinejoin="round" />}

        {/* Hover crosshair */}
        {hoverI != null && pattern[hoverI] && (
          <>
            <line x1={xS(hoverI)} x2={xS(hoverI)} y1={PAD.top} y2={PAD.top + iH} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx={xS(hoverI)} cy={yS(pattern[hoverI].v)} r="3.5" fill="#d4af37" stroke="#0a0a0a" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoverI != null && pattern[hoverI] && (
        <div style={{ position: "absolute", top: 10, left: hoverI / pattern.length > 0.6 ? 76 : "auto", right: hoverI / pattern.length > 0.6 ? "auto" : 26, background: "rgba(15,17,23,0.78)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "7px 12px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#e8e8e8", pointerEvents: "none" }}>
          <div style={{ color: "#555", fontSize: 9, marginBottom: 2 }}>{fmtKey(pattern[hoverI].key)} · {pattern[hoverI].n} yrs</div>
          <div style={{ color: "#f8e49b", fontSize: 13, fontWeight: 600 }}>
            {(pattern[hoverI].v - 100 >= 0 ? "+" : "") + (pattern[hoverI].v - 100).toFixed(2)}% YTD avg
          </div>
          <div style={{ color: pattern[hoverI].winRate >= 55 ? "#22c55e" : pattern[hoverI].winRate <= 45 ? "#ef4444" : "#666", fontSize: 9, marginTop: 2 }}>
            day win rate {pattern[hoverI].winRate.toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
const VSXLogo = ({ size = 52 }) => (
  <img src="https://i.postimg.cc/pd4xzT1r/87011e66-b8e4-4d2b-9977-a06bb4b29902.png"
    width={size} height={size} alt="VisionX"
    style={{ objectFit: "contain", filter: "drop-shadow(0 0 12px rgba(212,175,55,0.5))" }} />
);

const ALL_YEARS = Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => 2010 + i);

// Institutional year-cycle presets. US presidential cycle: pre-election years
// are historically the strongest equity years; midterms the weakest/choppiest.
// BTC halvings share the election-year rhythm (2016, 2020, 2024).
const YEAR_PRESETS = [
  { label: "Election",     test: y => y % 4 === 0 },
  { label: "Midterm",      test: y => y % 4 === 2 },
  { label: "Pre-Election", test: y => y % 4 === 3 },
  { label: "₿ Halving",    test: y => y % 4 === 0 },
];

export default function App() {
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [interval, setInterval_] = useState("1d");
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState("");
  const [csvLoaded, setCsvLoaded] = useState(false);
  const csvLoadedRef = useRef(false);
  const [selectedYears, setSelectedYears] = useState([]);
  const [yearInput, setYearInput] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [activeIndicators, setActiveIndicators] = useState(new Set());
  const [indSettings, setIndSettings] = useState(DEFAULT_SETTINGS);
  const [editingInd, setEditingInd] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [selectedCycles, setSelectedCycles] = useState(new Set());
  const [cycleTweaks, setCycleTweaks] = useState({});
  const [showCycles, setShowCycles] = useState(false);
  const [cyclesPanelOpen, setCyclesPanelOpen] = useState(false);
  const [pickingAnchor, setPickingAnchor] = useState(false);
  const [cycleAnchorIdx, setCycleAnchorIdx] = useState(null);
  const [cycleSlopeMult, setCycleSlopeMult] = useState(1.0);
  // Spectral cycle detection (auto)
  const [cycleMode, setCycleMode] = useState("trough"); // 'trough' | 'spectral'
  const [spectral, setSpectral] = useState(null);
  const [selectedSpectral, setSelectedSpectral] = useState(new Set());
  const [detecting, setDetecting] = useState(false);
  // Seasonal pattern (Seasonax-style)
  const [seasonSel, setSeasonSel] = useState(null); // {startKey, endKey}
  const [showCurYear, setShowCurYear] = useState(true);
  const [scanResults, setScanResults] = useState(null);
  const [scanning, setScanning] = useState(false);

  const availableYears = [...new Set(candles.map(c => c.date.getFullYear()))].sort();

  const activeYears = selectedYears.length > 0
    ? selectedYears.filter(y => availableYears.includes(y))
    : availableYears;

  const seasonality = candles.length > 0 && activeYears.length > 0
    ? calcSeasonality(candles, activeYears)
    : null;

  const seasonalPattern = candles.length > 0 && activeYears.length > 0
    ? calcSeasonalPattern(candles, activeYears)
    : null;
  const curYearPath = candles.length > 0 ? calcCurrentYearPath(candles) : null;
  const windowStats = seasonSel && candles.length > 0
    ? calcWindowStats(candles, seasonSel.startKey, seasonSel.endKey, activeYears)
    : null;

  const load = async (t, iv) => {
    if (!t) return;
    setCsvLoaded(false);
    setLoading(true); setError(false); setCandles([]);
    setProgress(isCrypto(t) ? "Fetching Binance history…" : isCommodity(t) ? "Fetching commodity data…" : "Fetching Twelve Data history…");
    try {
      const data = await fetchHistory(t, iv);
      if (!data || data.length < 10) { setError(true); }
      else { setCandles(data); }
    } catch { setError(true); }
    setLoading(false); setProgress("");
  };

  // Compute cycles whenever candles change
  useEffect(() => {
    if (candles.length > 20) {
      setProgress("Analyzing cycles…");
      setTimeout(() => {
        const c = analyzeCycles(candles, 20);
        setCycles(c);
        setSelectedCycles(new Set());
        setCycleTweaks({});
        setProgress("");
      }, 50);
    }
    setSpectral(null);
    setSelectedSpectral(new Set());
    setSeasonSel(null);
    setScanResults(null);
  }, [candles]);

  const handleCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result, interval);
      if (!parsed || parsed.length < 10) { setError(true); return; }
      if (csvLoadedRef.current) {
        setCandles(prev => {
          const merged = [...prev, ...parsed];
          const seen = new Map();
          for (const c of merged) seen.set(c.t, c);
          return [...seen.values()].sort((a, b) => a.t - b.t);
        });
      } else {
        setTicker(file.name.replace(/\.csv$/i, "").toUpperCase());
        setCandles(parsed);
        setSelectedYears([]);
        setError(false);
        csvLoadedRef.current = true;
        setCsvLoaded(true);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const submit = () => {
    const raw = input.trim();
    if (!raw) return;
    // Keep original case for Stooq (aapl.us, ^SPX etc), uppercase only for crypto display
    setTicker(raw);
    setSelectedYears([]);
    load(raw, interval);
  };

  const switchInterval = (iv) => {
    setInterval_(iv);
    if (ticker) load(ticker, iv);
  };

  const toggleYear = (y) => {
    setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y].sort());
  };

  const applyRange = () => {
    const s = parseInt(rangeStart), e = parseInt(rangeEnd);
    if (!s || !e || s > e) return;
    const yrs = availableYears.filter(y => y >= s && y <= e);
    setSelectedYears(yrs);
  };

  const applyManual = () => {
    const yrs = yearInput.split(/[+,\s]+/).map(Number).filter(y => availableYears.includes(y));
    if (yrs.length) setSelectedYears([...new Set(yrs)].sort());
  };

  const maxOut = () => setSelectedYears([]);

  const toggleCycle = (period) => {
    setSelectedCycles(prev => {
      const next = new Set(prev);
      next.has(period) ? next.delete(period) : next.add(period);
      return next;
    });
  };

  const toggleSpectral = (period) => {
    setSelectedSpectral(prev => {
      const next = new Set(prev);
      next.has(period) ? next.delete(period) : next.add(period);
      return next;
    });
  };

  // Rule of harmony, simple: two cycles are harmonic when one divides into the
  // other — ratio ≈ whole number (2:1, 3:1, 4:1 …), with tolerance.
  const harmonicRatio = (p, q) => {
    const rr = Math.max(p, q) / Math.min(p, q);
    const k = Math.round(rr);
    if (k >= 2 && k <= 8 && Math.abs(rr - k) / k < 0.10) return `${k}:1`;
    return null;
  };
  // Periods closer than ~1.35:1 beat against each other → ugly, meaningless wave
  const beats = (p, q) => Math.max(p, q) / Math.min(p, q) < 1.35;

  const runSpectralDetect = () => {
    if (candles.length < 80 || detecting) return;
    setDetecting(true);
    setTimeout(() => {
      const res = detectCyclesSpectral(candles, 20);
      setSpectral(res);
      // Select only the single most accurate cycle — the user composes the
      // rest manually, guided by the ♪ harmonic hints
      setSelectedSpectral(new Set(res.cycles.length ? [res.cycles[0].period] : []));
      setShowCycles(true);
      setDetecting(false);
    }, 30);
  };

  const runScan = () => {
    if (!candles.length || scanning) return;
    setScanning(true);
    setTimeout(() => {
      setScanResults(scanPatterns(candles, activeYears));
      setScanning(false);
    }, 30);
  };

  const selectedCycleObjs = cycles.filter(c => selectedCycles.has(c.period));
  const selectedSpectralObjs = spectral ? spectral.cycles.filter(c => selectedSpectral.has(c.period)) : [];
  const compositeWave = !showCycles ? []
    : cycleMode === "spectral"
      ? (selectedSpectralObjs.length > 0 ? buildSpectralComposite(candles, selectedSpectralObjs) : [])
      : (selectedCycleObjs.length > 0 ? buildComposite(candles, selectedCycleObjs, cycleTweaks, cycleAnchorIdx, cycleSlopeMult) : []);

  const toggleIndicator = (id) => setActiveIndicators(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const INDICATORS = [
    { id: "sma",        label: "SMA",        color: "#f59e0b", fields: [{ k: "period", label: "Period", min: 2, max: 500 }] },
    { id: "ema",        label: "EMA",        color: "#818cf8", fields: [{ k: "period", label: "Period", min: 2, max: 500 }] },
    { id: "boll",       label: "BB",         color: "#38bdf8", fields: [{ k: "period", label: "Period", min: 2, max: 500 }, { k: "mult", label: "Mult", min: 0.5, max: 5, step: 0.1 }] },
    { id: "sar",        label: "SAR",        color: "#a3e635", fields: [{ k: "step", label: "Step", min: 0.001, max: 0.1, step: 0.001 }, { k: "max", label: "Max", min: 0.1, max: 0.5, step: 0.01 }] },
    { id: "supertrend", label: "Supertrend", color: "#fb923c", fields: [{ k: "period", label: "Period", min: 2, max: 100 }, { k: "mult", label: "Mult", min: 0.5, max: 10, step: 0.1 }] },
    { id: "resist",     label: "Resist",     color: "#fbbf24", fields: [] },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(1100px 700px at 85% -5%, rgba(212,175,55,0.07), transparent 60%), radial-gradient(800px 550px at 8% 110%, rgba(255,255,255,0.035), transparent 60%), #121212", backgroundAttachment: "fixed", color: "#e8e8e8", fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Bebas+Neue&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #121212; }

        .header { height: 76px; padding: 0 48px; display: flex; align-items: center; justify-content: space-between; background: rgba(18,18,18,0.55); backdrop-filter: blur(28px) saturate(160%); -webkit-backdrop-filter: blur(28px) saturate(160%); border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; z-index: 100; }
        .logo-area { display: flex; align-items: center; gap: 14px; }
        .logo-divider { width: 1px; height: 32px; background: linear-gradient(180deg, transparent, rgba(212,175,55,0.4), transparent); }
        .logo-name { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 0.25em; background: linear-gradient(135deg,#fff,#e8e8e8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .logo-sub { font-size: 7px; letter-spacing: 0.4em; color: #b99c64; font-weight: 500; text-transform: uppercase; margin-top: 2px; }

        .toolbar { display: flex; align-items: center; gap: 10px; padding: 32px 48px 24px; flex-wrap: wrap; }
        .ticker-inp { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #f8e49b; font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.15em; padding: 11px 18px; border-radius: 14px; outline: none; width: 180px; text-transform: uppercase; transition: all 0.25s; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
        .ticker-inp:focus { border-color: rgba(212,175,55,0.55); box-shadow: 0 0 0 3px rgba(212,175,55,0.10), 0 8px 32px rgba(212,175,55,0.08); }
        .ticker-inp::placeholder { color: #2f333b; }

        .btn { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; border: none; border-radius: 999px; cursor: pointer; transition: all 0.25s; text-transform: uppercase; padding: 11px 22px; }
        .btn-gold { background: linear-gradient(135deg, #e8c968, #c59958); color: #0a0a0a; box-shadow: 0 6px 26px rgba(212,175,55,0.28), inset 0 1px 0 rgba(255,255,255,0.35); }
        .btn-gold:hover { box-shadow: 0 10px 36px rgba(212,175,55,0.42), inset 0 1px 0 rgba(255,255,255,0.45); transform: translateY(-1px); }
        .btn-outline { background: rgba(255,255,255,0.02); color: #7a8089; border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
        .btn-outline:hover { border-color: rgba(255,255,255,0.18); color: #b9bec7; }
        .btn-outline.active { border-color: rgba(212,175,55,0.55); color: #f8e49b; background: rgba(212,175,55,0.10); box-shadow: 0 0 20px rgba(212,175,55,0.14), inset 0 1px 0 rgba(255,255,255,0.08); }

        .section { margin: 0 48px 24px; background: rgba(255,255,255,0.025); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%); border: 1px solid rgba(255,255,255,0.07); border-radius: 22px; overflow: hidden; box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.45); }
        .section-header { padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
        .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.15em; color: #fdfdfd; }
        .section-body { padding: 20px 16px 12px; }

        .year-filter { padding: 20px 48px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .year-filter-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .year-filter-label { font-size: 9px; color: #4a505a; letter-spacing: 0.22em; font-weight: 700; text-transform: uppercase; white-space: nowrap; margin-right: 4px; }
        .year-chips { display: flex; flex-wrap: wrap; gap: 5px; }
        .year-chip { font-family: 'DM Mono', monospace; font-size: 10px; padding: 4px 11px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.07); color: #5b616b; cursor: pointer; transition: all 0.2s; background: rgba(255,255,255,0.015); }
        .year-chip:hover { border-color: rgba(255,255,255,0.16); color: #9aa0aa; }
        .year-chip.active { border-color: rgba(212,175,55,0.55); color: #f8e49b; background: rgba(212,175,55,0.10); box-shadow: 0 0 14px rgba(212,175,55,0.12); }
        .year-chip.all-chip { color: #6b7078; margin-right: 4px; }
        .year-chip.all-chip.active { border-color: rgba(212,175,55,0.55); color: #f8e49b; }

        .year-filter-bottom { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .filter-group { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 6px 12px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
        .filter-group-label { font-size: 8px; color: #3d434d; letter-spacing: 0.2em; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
        .filter-input { background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); color: #e8e8e8; font-family: 'DM Mono', monospace; font-size: 11px; padding: 2px 4px; outline: none; width: 52px; transition: border-color 0.2s; text-align: center; }
        .filter-input:focus { border-bottom-color: rgba(212,175,55,0.7); }
        .filter-input::placeholder { color: #2f333b; }
        .filter-sep { color: #3d434d; font-size: 10px; }
        .filter-input-wide { background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.12); color: #e8e8e8; font-family: 'DM Mono', monospace; font-size: 11px; padding: 2px 4px; outline: none; width: 140px; transition: border-color 0.2s; }
        .filter-input-wide:focus { border-bottom-color: rgba(212,175,55,0.7); }
        .filter-input-wide::placeholder { color: #2f333b; }
        .active-years-tag { font-family: "DM Mono", monospace; font-size: 9px; color: #d4af37; letter-spacing: 0.06em; opacity: 0.7; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .spinner { width: 28px; height: 28px; border: 2px solid #1a1a1a; border-top-color: #d4af37; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 12px; }
        .empty-label { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.25em; color: #1e1e1e; }
        .empty-sub { font-size: 9px; color: #2a2a2a; letter-spacing: 0.15em; font-weight: 600; text-transform: uppercase; }

        .ind-bar { display: flex; align-items: center; gap: 8px; padding: 12px 24px; background: rgba(255,255,255,0.015); border-top: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; }
        .ind-btn { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); color: #6b7078; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.15em; cursor: pointer; transition: all 0.2s; text-transform: uppercase; position: relative; }
        .ind-btn:hover { border-color: rgba(255,255,255,0.18); color: #a6acb6; }
        .ind-btn.active { background: rgba(255,255,255,0.05); }
        .ind-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .ind-gear { font-size: 10px; opacity: 0.5; cursor: pointer; padding: 0 2px; transition: opacity 0.15s; }
        .ind-gear:hover { opacity: 1; }

        .ind-popup { position: absolute; bottom: calc(100% + 8px); left: 0; background: rgba(16,18,24,0.72); backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%); border: 1px solid rgba(255,255,255,0.10); border-radius: 16px; padding: 14px 16px; z-index: 200; min-width: 180px; box-shadow: 0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08); }
        .ind-popup-title { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.1em; color: #e8e8e8; margin-bottom: 10px; }
        .ind-field { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .ind-field label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 0.1em; color: #6b7078; text-transform: uppercase; }
        .ind-field input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); color: #e8e8e8; font-family: 'DM Mono', monospace; font-size: 11px; padding: 4px 8px; border-radius: 8px; outline: none; width: 70px; text-align: right; }
        .ind-field input:focus { border-color: rgba(212,175,55,0.6); }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <div className="logo-area">
          <VSXLogo />
          <div className="logo-divider" />
          <div>
            <div className="logo-name">VISIONX</div>
            <div className="logo-sub">Seasonality</div>
          </div>
        </div>
        {candles.length > 0 && (
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#444" }}>
            {candles.length.toLocaleString()} candles · {availableYears[0]}–{availableYears[availableYears.length - 1]}
          </div>
        )}
      </div>

      {/* TOOLBAR */}
      <div className="toolbar">
        <input className="ticker-inp" placeholder="BTC" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} />
        <button className="btn btn-gold" onClick={submit}>LOAD</button>
        <label style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 18px", background:"transparent", border:"1px solid rgba(255,255,255,0.10)", borderRadius:6, cursor:"pointer", fontFamily:"'Montserrat',sans-serif", fontSize:10, fontWeight:700, letterSpacing:"0.15em", color:"#555", textTransform:"uppercase", transition:"all 0.2s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#333"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.10)"}>
          ↑ CSV {csvLoaded ? `+ MERGE (${candles.length.toLocaleString()})` : ""}
          <input type="file" accept=".csv" style={{display:"none"}} onChange={handleCSV} />
        </label>
        {csvLoaded && (
          <button className="btn btn-outline" onClick={() => { setCandles([]); setCsvLoaded(false); csvLoadedRef.current = false; setTicker(""); setSelectedYears([]); }} style={{ padding: "11px 16px", fontSize: 9, color: "#ef4444", borderColor: "#2a1a1a" }}>✕ RESET</button>
        )}
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {["1d", "1w"].map(iv => (
            <button key={iv} className={`btn btn-outline ${interval === iv ? "active" : ""}`}
              onClick={() => switchInterval(iv)}>{iv.toUpperCase()}</button>
          ))}
        </div>
        {loading && <><div className="spinner" /><span style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em" }}>{progress}</span></>}
      </div>

      {/* YEAR FILTER */}
      {candles.length > 0 && (
        <div className="year-filter">
          {/* Top row: year chips */}
          <div className="year-filter-top">
            <span className="year-filter-label">Years</span>
            <div className="year-chips">
              <button className={`year-chip all-chip ${selectedYears.length === 0 ? "active" : ""}`} onClick={maxOut}>ALL</button>
              {availableYears.map(y => (
                <button key={y} className={`year-chip ${selectedYears.includes(y) ? "active" : ""}`} onClick={() => toggleYear(y)}>{y}</button>
              ))}
            </div>
          </div>

          {/* Bottom row: range + manual + active display */}
          <div className="year-filter-bottom">
            <div className="filter-group">
              <span className="filter-group-label">Range</span>
              <input className="filter-input" placeholder="2018" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
              <span className="filter-sep">→</span>
              <input className="filter-input" placeholder="2024" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
              <button className="btn btn-outline" style={{ padding: "5px 12px", fontSize: 9 }} onClick={applyRange}>GO</button>
            </div>
            <div className="filter-group">
              <span className="filter-group-label">Manual</span>
              <input className="filter-input-wide" placeholder="2016+2020+2024" value={yearInput}
                onChange={e => setYearInput(e.target.value)} onKeyDown={e => e.key === "Enter" && applyManual()} />
              <button className="btn btn-outline" style={{ padding: "5px 12px", fontSize: 9 }} onClick={applyManual}>APPLY</button>
            </div>
            <div className="filter-group">
              <span className="filter-group-label">Cycle</span>
              {YEAR_PRESETS.map(p => {
                const yrs = availableYears.filter(p.test);
                const isActive = selectedYears.length > 0 && selectedYears.length === yrs.length && yrs.every(y => selectedYears.includes(y));
                return (
                  <button key={p.label} className={`year-chip ${isActive ? "active" : ""}`}
                    disabled={yrs.length === 0} style={{ opacity: yrs.length === 0 ? 0.3 : 1 }}
                    title={yrs.join(" · ")}
                    onClick={() => setSelectedYears(isActive ? [] : yrs)}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            {activeYears.length > 0 && selectedYears.length > 0 && (
              <span className="active-years-tag">✦ {activeYears.join(" · ")}</span>
            )}
          </div>
        </div>
      )}

      {/* PRICE CHART */}
      {!ticker ? (
        <div className="empty">
          <div className="empty-label">Enter a ticker</div>
          <div className="empty-sub">Crypto: BTC · ETH · SOL · HYPE</div>
          <div className="empty-sub" style={{ marginTop: 6 }}>Stocks: AAPL · MSFT · ADS · BMW</div>
          <div className="empty-sub" style={{ marginTop: 4 }}>Indices: SPX · NDX · DAX · FTSE</div>
          <div className="empty-sub" style={{ marginTop: 4 }}>Commodities: XAU/USD · XAG/USD · WTI/USD</div>
        </div>
      ) : error ? (
        <div className="empty">
          <div className="empty-label" style={{ color: "#ef4444" }}>Could not load {ticker}</div>
          <div className="empty-sub">Check ticker and try again</div>
        </div>
      ) : candles.length > 0 ? (
        <>
          <div className="section">
            <div className="section-header">
              <div className="section-title">{ticker} · {interval === "1d" ? "DAILY" : "WEEKLY"} · {csvLoaded ? "CSV" : isCrypto(ticker) ? "BINANCE" : isCommodity(ticker) ? "NASDAQ" : "TWELVE DATA"}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-outline" style={{ padding: "6px 14px", fontSize: 9 }}
                  onClick={() => {/* zoom handled in component */}}>SCROLL TO ZOOM · DRAG TO PAN</button>
              </div>
            </div>
            <div style={{ display: "flex", position: "relative" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="section-body" style={{ padding: "12px 8px 4px" }}>
                  <PriceChart candles={candles} interval={interval} activeIndicators={activeIndicators} indSettings={indSettings} compositeWave={compositeWave}
                    pickingAnchor={pickingAnchor}
                    onAnchorPick={(idx) => {
                      setCycleAnchorIdx(idx);
                      setPickingAnchor(false);
                      setShowCycles(true);
                      setTimeout(() => {
                        const c = analyzeCycles(candles, 20, idx);
                        setCycles(c);
                        setSelectedCycles(new Set());
                      }, 10);
                    }} />
                </div>
              </div>
              {/* Cycle Panel Toggle */}
              {(cycles.length > 0 || candles.length > 80) && (
                <div style={{ position: "relative" }}>
                  <button onClick={() => setCyclesPanelOpen(o => !o)}
                    style={{ position: "absolute", top: 12, right: cyclesPanelOpen ? 280 : -1, background: cyclesPanelOpen ? "rgba(212,175,55,0.10)" : "rgba(255,255,255,0.04)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.10)", borderRight: "none", color: cyclesPanelOpen ? "#f8e49b" : "#555", fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", padding: "8px 10px", cursor: "pointer", borderRadius: "6px 0 0 6px", writingMode: "vertical-rl", textTransform: "uppercase", transition: "all 0.2s", zIndex: 5 }}>
                    {cyclesPanelOpen ? "◀ Cycles" : "▶ Cycles"}
                  </button>
                  {cyclesPanelOpen && (
                    <div style={{ width: 280, background: "rgba(20,20,20,0.55)", backdropFilter: "blur(26px) saturate(150%)", WebkitBackdropFilter: "blur(26px) saturate(150%)", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column" }}>
                      {/* Panel header */}
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: "0.1em", color: "#e8e8e8" }}>Cycle Analysis</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#444" }}>{cycleMode === "trough" ? selectedCycles.size : selectedSpectral.size} selected</span>
                          {cycleMode === "trough" && (
                          <button onClick={() => setPickingAnchor(p => !p)}
                            title="Click a low on the chart to anchor the wave"
                            style={{ background: pickingAnchor ? "rgba(239,68,68,0.15)" : cycleAnchorIdx != null ? "rgba(212,175,55,0.1)" : "transparent", border: `1px solid ${pickingAnchor ? "#ef4444" : cycleAnchorIdx != null ? "#d4af37" : "rgba(255,255,255,0.10)"}`, color: pickingAnchor ? "#ef4444" : cycleAnchorIdx != null ? "#f8e49b" : "#555", fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 4, cursor: "pointer", textTransform: "uppercase", transition: "all 0.2s" }}>
                            {pickingAnchor ? "↗ CLICK LOW" : cycleAnchorIdx != null ? "⊕ LOW SET" : "📍 SET LOW"}
                          </button>
                          )}
                          <button onClick={() => setShowCycles(s => !s)}
                            style={{ background: showCycles ? "rgba(212,175,55,0.15)" : "transparent", border: `1px solid ${showCycles ? "#d4af37" : "rgba(255,255,255,0.10)"}`, color: showCycles ? "#f8e49b" : "#555", fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", padding: "4px 10px", borderRadius: 4, cursor: "pointer", textTransform: "uppercase" }}>
                            {showCycles ? "ON" : "OFF"}
                          </button>
                        </div>
                      </div>
                      {/* Mode tabs: manual trough scan vs auto spectral detection */}
                      <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {[["trough", "TROUGH SCAN"], ["spectral", "AUTO SPECTRAL"]].map(([m, lbl]) => (
                          <button key={m} onClick={() => setCycleMode(m)}
                            style={{ flex: 1, background: cycleMode === m ? "rgba(212,175,55,0.1)" : "transparent", border: `1px solid ${cycleMode === m ? "#d4af37" : "rgba(255,255,255,0.08)"}`, color: cycleMode === m ? "#f8e49b" : "#444", fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", padding: "6px 0", borderRadius: 999, cursor: "pointer", textTransform: "uppercase", transition: "all 0.2s" }}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                      {cycleMode === "trough" && (<>
                      {/* Peak Shift slider */}
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", color: "#333", textTransform: "uppercase", whiteSpace: "nowrap" }}>Peak Shift</span>
                        <input type="range" min="0.5" max="1.5" step="0.01" value={cycleSlopeMult}
                          onChange={e => {
                            const raw = parseFloat(e.target.value);
                            const snapped = Math.round(raw * 10) / 10;
                            const dist = Math.abs(raw - snapped);
                            if (dist < 0.035) { setCycleSlopeMult(snapped); }
                            else if (dist < 0.08) {
                              const t = (dist - 0.035) / (0.08 - 0.035);
                              setCycleSlopeMult(snapped + (raw - snapped) * t * t * 0.25);
                            } else { setCycleSlopeMult(raw); }
                          }}
                          style={{ flex: 1, accentColor: "#d4af37", height: 2, cursor: "pointer" }} />
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#d4af37", width: 36, textAlign: "right" }}>{cycleSlopeMult.toFixed(2)}x</span>
                        <button onClick={() => setCycleSlopeMult(1.0)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.10)", color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 8, padding: "2px 6px", borderRadius: 3, cursor: "pointer" }}>↺</button>
                      </div>
                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "28px 56px 1fr 40px", gap: 0, padding: "6px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["#","Period","Accuracy",""].map((h, i) => (
                          <span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: "0.18em", color: "#2a2a2a", textTransform: "uppercase" }}>{h}</span>
                        ))}
                      </div>
                      {/* Cycle rows */}
                      <div style={{ overflowY: "auto", flex: 1, maxHeight: 320 }}>
                        {cycles.map((cyc, i) => {
                          const isOn = selectedCycles.has(cyc.period);
                          return (
                            <div key={cyc.period} onClick={() => toggleCycle(cyc.period)}
                              style={{ display: "grid", gridTemplateColumns: "28px 56px 1fr 40px", alignItems: "center", gap: 0, padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: isOn ? "rgba(212,175,55,0.05)" : "transparent", transition: "background 0.15s" }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#2a2a2a" }}>{i + 1}</span>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: isOn ? "#f8e49b" : "#555", fontWeight: isOn ? 600 : 400 }}>{cyc.period}d</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ flex: 1, height: 2, background: "#1a1a1a", borderRadius: 2 }}>
                                  <div style={{ width: `${Math.min(cyc.accuracy, 100)}%`, height: "100%", background: cyc.accuracy > 70 ? "#22c55e" : cyc.accuracy > 50 ? "#f59e0b" : "#ef4444", borderRadius: 2 }} />
                                </div>
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: isOn ? "#f8e49b" : "#444", width: 28, textAlign: "right" }}>{cyc.accuracy.toFixed(0)}%</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <div style={{ width: 7, height: 7, borderRadius: "50%", background: isOn ? "#d4af37" : "transparent", border: `1px solid ${isOn ? "#d4af37" : "#2a2a2a"}`, transition: "all 0.15s" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </>)}

                      {cycleMode === "spectral" && (<>
                      {/* Detect button */}
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <button onClick={runSpectralDetect} disabled={detecting}
                          style={{ width: "100%", background: "linear-gradient(135deg, #d4af37, #c59958)", border: "none", color: "#0a0a0a", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", padding: "9px 0", borderRadius: 5, cursor: detecting ? "wait" : "pointer", textTransform: "uppercase", opacity: detecting ? 0.6 : 1 }}>
                          {detecting ? "ANALYZING…" : spectral ? "↻ RE-DETECT CYCLES" : "⚡ DETECT DOMINANT CYCLES"}
                        </button>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#333", marginTop: 6, lineHeight: 1.5 }}>
                          Only cycles with ≥3 confirmed swing lows · sorted by accuracy · bottom-to-bottom anchored · ♪ = harmonic (whole-number ratio)
                        </div>
                      </div>
                      {/* Spectrum strip */}
                      {spectral && spectral.spectrum.length > 2 && (() => {
                        const sp = spectral.spectrum;
                        const maxAmp = Math.max(...sp.map(s => s.amp), 1e-9);
                        const sw = 248, sh = 44;
                        const bw = sw / sp.length;
                        return (
                          <div style={{ padding: "8px 16px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <svg viewBox={`0 0 ${sw} ${sh}`} style={{ width: "100%", height: "auto", display: "block" }}>
                              {sp.map((s, i) => {
                                const isSel = spectral.cycles.some(c => Math.abs(c.period - s.period) / c.period < 0.05 && selectedSpectral.has(c.period));
                                const h = Math.max((s.amp / maxAmp) * (sh - 6), 1);
                                return <rect key={i} x={i * bw + 0.5} y={sh - h} width={Math.max(bw - 1, 0.8)} height={h}
                                  fill={isSel ? "#d4af37" : "#2a2a2a"} opacity={isSel ? 0.95 : 0.8} />;
                              })}
                            </svg>
                            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono', monospace", fontSize: 7, color: "#333", marginTop: 2 }}>
                              <span>{sp[0].period}{interval === "1d" ? "d" : "w"}</span>
                              <span>spectrum</span>
                              <span>{sp[sp.length - 1].period}{interval === "1d" ? "d" : "w"}</span>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Beat warning: selected periods too close together */}
                      {spectral && (() => {
                        const sel = spectral.cycles.filter(c => selectedSpectral.has(c.period));
                        for (let a = 0; a < sel.length; a++) for (let b = a + 1; b < sel.length; b++) {
                          if (beats(sel[a].period, sel[b].period)) return (
                            <div style={{ padding: "7px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: "#f59e0b", lineHeight: 1.5, background: "rgba(245,158,11,0.05)" }}>
                              ⚠ {sel[a].period}{interval === "1d" ? "d" : "w"} & {sel[b].period}{interval === "1d" ? "d" : "w"} are too close — they beat against each other. Prefer ♪ harmonics.
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {/* Spectral table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "24px 52px 1fr 44px 24px", gap: 0, padding: "6px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["#", "Period", "Strength", "Acc", ""].map((h, i) => (
                          <span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", color: "#2a2a2a", textTransform: "uppercase" }}>{h}</span>
                        ))}
                      </div>
                      {/* Spectral cycle rows */}
                      <div style={{ overflowY: "auto", flex: 1, maxHeight: 300 }}>
                        {!spectral && !detecting && (
                          <div style={{ padding: "20px 16px", fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#333", textAlign: "center", lineHeight: 1.6 }}>
                            Run detection to extract the dominant cycles automatically
                          </div>
                        )}
                        {spectral && spectral.cycles.length === 0 && (
                          <div style={{ padding: "20px 16px", fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#333", textAlign: "center", lineHeight: 1.6 }}>
                            No cycle passed the quality gate (≥3 confirmed swing lows in rhythm) — this market is currently not cycling cleanly
                          </div>
                        )}
                        {spectral && spectral.cycles.map((cyc, i) => {
                          const isOn = selectedSpectral.has(cyc.period);
                          // Rule of harmony: flag unselected cycles in 2:1 / 3:1 / 3:2
                          // relation to the selection; warn on beat-danger picks
                          let harm = null, clash = false;
                          if (selectedSpectral.size >= 1 && selectedSpectral.size <= 3) {
                            for (const sp of spectral.cycles) {
                              if (!selectedSpectral.has(sp.period) || sp.period === cyc.period) continue;
                              if (!isOn && !harm) {
                                const m = harmonicRatio(cyc.period, sp.period);
                                if (m) harm = `${m} to ${sp.period}${interval === "1d" ? "d" : "w"}`;
                              }
                              if (beats(cyc.period, sp.period)) clash = true;
                            }
                          }
                          if (isOn) harm = null; else if (clash) harm = null;
                          return (
                            <div key={cyc.period} onClick={() => toggleSpectral(cyc.period)}
                              title={harm ? `Harmonic: ${harm}` : clash && !isOn ? "Too close to a selected period — would beat against it" : undefined}
                              style={{ display: "grid", gridTemplateColumns: "24px 52px 1fr 44px 24px", alignItems: "center", gap: 0, padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", borderLeft: harm ? "2px solid rgba(212,175,55,0.55)" : "2px solid transparent", cursor: "pointer", opacity: clash && !isOn ? 0.4 : 1, background: isOn ? "rgba(212,175,55,0.05)" : harm ? "rgba(212,175,55,0.03)" : "transparent", transition: "background 0.15s, opacity 0.15s" }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#2a2a2a" }}>{i + 1}</span>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: isOn ? "#f8e49b" : harm ? "#d4af37" : "#555", fontWeight: isOn ? 600 : 400 }}>
                                {cyc.period}{interval === "1d" ? "d" : "w"}{harm ? " ♪" : clash && !isOn ? " ≈" : ""}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 6 }}>
                                <div style={{ flex: 1, height: 2, background: "#1a1a1a", borderRadius: 2 }}>
                                  <div style={{ width: `${Math.min(cyc.strengthPct, 100)}%`, height: "100%", background: "#d4af37", borderRadius: 2, opacity: isOn ? 1 : 0.5 }} />
                                </div>
                              </div>
                              <span title={`Bartels ${cyc.bartelsPct.toFixed(0)}% · bottom-timing ${((cyc.spacingCons ?? 0.75) * 100).toFixed(0)}% · ${cyc.nBottoms} confirmed lows`}
                                style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: cyc.accPct > 60 ? "#22c55e" : cyc.accPct > 42 ? "#f59e0b" : "#ef4444" }}>{cyc.accPct.toFixed(0)}%</span>
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <div style={{ width: 7, height: 7, borderRadius: "50%", background: isOn ? "#d4af37" : "transparent", border: `1px solid ${isOn ? "#d4af37" : "#2a2a2a"}`, transition: "all 0.15s" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Indicator Bar */}
            <div className="ind-bar">
              {INDICATORS.map(ind => {
                const isActive = activeIndicators.has(ind.id);
                const isEditing = editingInd === ind.id;
                return (
                  <div key={ind.id} className={`ind-btn ${isActive ? "active" : ""}`} style={{ borderColor: isActive ? ind.color + "55" : undefined, color: isActive ? ind.color : undefined }}
                    onClick={() => toggleIndicator(ind.id)}>
                    <div className="ind-dot" style={{ background: isActive ? ind.color : "#333" }} />
                    {ind.label}
                    {ind.fields.length > 0 && (
                      <span className="ind-gear" onClick={e => { e.stopPropagation(); setEditingInd(isEditing ? null : ind.id); }}>⚙</span>
                    )}
                    {isEditing && (
                      <div className="ind-popup" onClick={e => e.stopPropagation()}>
                        <div className="ind-popup-title">{ind.label} Settings</div>
                        {ind.fields.map(f => (
                          <div key={f.k} className="ind-field">
                            <label>{f.label}</label>
                            <input type="number" min={f.min} max={f.max} step={f.step||1}
                              value={indSettings[ind.id][f.k]}
                              onChange={e => setIndSettings(prev => ({
                                ...prev,
                                [ind.id]: { ...prev[ind.id], [f.k]: parseFloat(e.target.value) || f.min }
                              }))} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEASONALITY */}
          {seasonality && (
            <div className="section">
              <div className="section-header">
                <div className="section-title">SEASONALITY · {activeYears.length === availableYears.length ? "ALL YEARS" : activeYears.join(", ")}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444" }}>
                  {activeYears.length} year{activeYears.length !== 1 ? "s" : ""} · avg return per period
                </div>
              </div>
              <div className="section-body">
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <BarChart data={seasonality.weekdays} title="Avg Return by Weekday (%)" />
                  <BarChart data={seasonality.months} title="Avg Return by Month (%)" />
                </div>
              </div>
            </div>
          )}

          {/* SEASONAL PATTERN (Seasonax-style) */}
          {seasonalPattern && (
            <div className="section">
              <div className="section-header">
                <div className="section-title">SEASONAL PATTERN · AVG ANNUAL PATH</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#333" }}>drag on chart to backtest a window</span>
                  {curYearPath && (
                    <button className={`btn btn-outline ${showCurYear ? "active" : ""}`} style={{ padding: "6px 14px", fontSize: 9 }}
                      onClick={() => setShowCurYear(s => !s)}>
                      {curYearPath.year} OVERLAY
                    </button>
                  )}
                  <button className="btn btn-outline" style={{ padding: "6px 14px", fontSize: 9, borderColor: scanResults ? "#d4af37" : undefined, color: scanResults ? "#f8e49b" : undefined }}
                    onClick={runScan} disabled={scanning}>
                    {scanning ? "SCANNING…" : "⚡ SCAN PATTERNS"}
                  </button>
                  {seasonSel && (
                    <button className="btn btn-outline" style={{ padding: "6px 14px", fontSize: 9, color: "#ef4444", borderColor: "#2a1a1a" }}
                      onClick={() => setSeasonSel(null)}>✕ CLEAR</button>
                  )}
                </div>
              </div>
              <div className="section-body" style={{ padding: "12px 8px 4px" }}>
                <SeasonalChart pattern={seasonalPattern} curPath={curYearPath} showCur={showCurYear}
                  selection={seasonSel} onSelect={setSeasonSel} />
              </div>

              {/* Window statistics */}
              {windowStats && seasonSel && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px 20px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.12em", color: "#f8e49b" }}>
                      {fmtKey(seasonSel.startKey)} → {fmtKey(seasonSel.endKey)}
                    </span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#444" }}>
                      {windowStats.lenDays} calendar days · {windowStats.trades} completed windows
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    {[
                      ["Win Rate", `${windowStats.winRate.toFixed(0)}%`, windowStats.winRate >= 60 ? "#22c55e" : windowStats.winRate <= 40 ? "#ef4444" : "#e8e8e8"],
                      ["Avg Return", `${windowStats.avg >= 0 ? "+" : ""}${windowStats.avg.toFixed(2)}%`, windowStats.avg >= 0 ? "#22c55e" : "#ef4444"],
                      ["Median", `${windowStats.median >= 0 ? "+" : ""}${windowStats.median.toFixed(2)}%`, windowStats.median >= 0 ? "#22c55e" : "#ef4444"],
                      ["Best", `+${windowStats.best.toFixed(2)}%`, "#22c55e"],
                      ["Worst", `${windowStats.worst.toFixed(2)}%`, "#ef4444"],
                      ["Annualized", `${windowStats.annualized >= 0 ? "+" : ""}${windowStats.annualized.toFixed(1)}%`, "#d4af37"],
                    ].map(([lbl, val, clr], i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 16px", minWidth: 104 }}>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: "0.2em", color: "#333", textTransform: "uppercase", marginBottom: 4 }}>{lbl}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 600, color: clr }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {/* Per-year returns */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {windowStats.rows.map(r => (
                      <div key={r.year} style={{ background: r.ret >= 0 ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)", border: `1px solid ${r.ret >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 6, padding: "6px 10px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#555" }}>{r.year}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, color: r.ret >= 0 ? "#22c55e" : "#ef4444" }}>
                          {r.ret >= 0 ? "+" : ""}{r.ret.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pattern scanner results */}
              {scanResults && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px 20px" }}>
                  <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                    {[["STRONGEST BULLISH WINDOWS", scanResults.longs, "#22c55e"], ["STRONGEST BEARISH WINDOWS", scanResults.shorts, "#ef4444"]].map(([title, list, clr]) => (
                      <div key={title} style={{ flex: 1, minWidth: 340 }}>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", color: clr, textTransform: "uppercase", marginBottom: 10, opacity: 0.85 }}>{title}</div>
                        {list.length === 0 && (
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#333" }}>No qualifying windows found</div>
                        )}
                        {list.map((p, i) => {
                          const isSel = seasonSel && seasonSel.startKey === p.startKey && seasonSel.endKey === p.endKey;
                          return (
                            <div key={i} onClick={() => setSeasonSel({ startKey: p.startKey, endKey: p.endKey })}
                              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: 6, border: `1px solid ${isSel ? "#d4af37" : "#1a1a1a"}`, background: isSel ? "rgba(212,175,55,0.06)" : "#0d0d0d", cursor: "pointer", marginBottom: 5, transition: "all 0.15s" }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: isSel ? "#f8e49b" : "#888" }}>
                                {fmtKey(p.startKey)} → {fmtKey(p.endKey)}
                              </span>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#444" }}>{p.st.lenDays}d</span>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, color: clr }}>
                                {p.st.avg >= 0 ? "+" : ""}{p.st.avg.toFixed(2)}% avg
                              </span>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#666" }}>{p.st.winRate.toFixed(0)}% WR</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ height: 48 }} />
        </>
      ) : loading ? null : null}
    </div>
  );
}
