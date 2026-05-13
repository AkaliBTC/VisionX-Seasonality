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

// ── CSV PARSER (TradingView export) ──────────────────────────────────────────
const parseCSV = (text, interval) => {
  const lines = text.trim().split("\n");
  const cols = lines[0].toLowerCase().split(",").map(c => c.trim().replace(/['"]/g, ""));
  const tIdx = cols.findIndex(c => c.includes("time") || c.includes("date"));
  const oIdx = cols.findIndex(c => c === "open");
  const hIdx = cols.findIndex(c => c === "high");
  const lIdx = cols.findIndex(c => c === "low");
  const cIdx = cols.findIndex(c => c === "close" || c === "value" || c === "price");
  if (tIdx === -1 || cIdx === -1) return null;
  const daily = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map(s => s.trim().replace(/['"]/g, ""));
    if (parts.length < 2) continue;
    const raw = parts[tIdx];
    const t = isNaN(raw) ? new Date(raw).getTime() : parseInt(raw) * 1000;
    if (isNaN(t)) continue;
    const c = parseFloat(parts[cIdx]);
    if (isNaN(c)) continue;
    const o = oIdx >= 0 ? parseFloat(parts[oIdx]) || c : c;
    const h = hIdx >= 0 ? parseFloat(parts[hIdx]) || c : c;
    const l = lIdx >= 0 ? parseFloat(parts[lIdx]) || c : c;
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

// ── NASDAQ DATA LINK — Commodities ───────────────────────────────────────────
const NASDAQ_MAP = {
  "WTI": "CHRIS/CME_CL1", "OIL": "CHRIS/CME_CL1", "CRUDE": "CHRIS/CME_CL1",
  "GOLD": "LBMA/GOLD", "XAU": "LBMA/GOLD",
  "SILVER": "LBMA/SILVER", "XAG": "LBMA/SILVER",
  "PLATINUM": "LPPM/PLAT", "XPT": "LPPM/PLAT",
  "PALLADIUM": "LPPM/PALL", "XPD": "LPPM/PALL",
  "COPPER": "LME/PR_CU", "HG": "LME/PR_CU",
  "ALUMINUM": "LME/PR_AL", "ALUMINIUM": "LME/PR_AL",
  "WHEAT": "CHRIS/CME_W1", "ZW": "CHRIS/CME_W1",
};
const COMMODITY_KEYS = new Set(Object.keys(NASDAQ_MAP));
const isCommodity = (ticker) => COMMODITY_KEYS.has(ticker.toUpperCase().trim());

const ND_PROXIES = [
  (u) => fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`).then(r => { if(!r.ok) throw new Error(); return r.json(); }).then(d => d.contents),
  (u) => fetch(`https://corsproxy.io/?${encodeURIComponent(u)}`).then(r => { if(!r.ok) throw new Error(); return r.text(); }),
  (u) => fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`).then(r => { if(!r.ok) throw new Error(); return r.text(); }),
];

const fetchNasdaqHistory = async (ticker, interval) => {
  const dataset = NASDAQ_MAP[ticker.toUpperCase().trim()];
  if (!dataset) return null;
  const url = `https://data.nasdaq.com/api/v3/datasets/${dataset}/data.csv?order=asc`;
  for (const px of ND_PROXIES) {
    try {
      const text = await px(url);
      if (!text || text.includes("<!DOCTYPE") || text.length < 100) continue;
      const parsed = parseCSV(text, interval);
      if (parsed && parsed.length > 10) return parsed;
    } catch { continue; }
  }
  return null;
};

// ── DETECT SOURCE ─────────────────────────────────────────────────────────────
const CRYPTO_LIST = ["BTC","ETH","SOL","BNB","XRP","ADA","AVAX","DOT","LINK","MATIC","DOGE","SHIB","UNI","ATOM","HYPE","SUI","APT","INJ","TIA","SEI","WIF","BONK","PEPE","ARB","OP","NEAR","FTM","ALGO","VET","SAND","MANA","AXS","GALA","ENJ","CHZ","LRC","CRV","AAVE","MKR","SNX","COMP","YFI","SUSHI","1INCH"];

const isCrypto = (ticker) => {
  const t = ticker.toUpperCase().replace("USDT","").trim();
  return CRYPTO_LIST.includes(t) || ticker.toUpperCase().endsWith("USDT");
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

  const hasWeekend = byWeekday[6].length > 0 || byWeekday[0].length > 0;
  const weekdays = [
    { label: "Mon", val: avg(byWeekday[1]), n: byWeekday[1].length },
    { label: "Tue", val: avg(byWeekday[2]), n: byWeekday[2].length },
    { label: "Wed", val: avg(byWeekday[3]), n: byWeekday[3].length },
    { label: "Thu", val: avg(byWeekday[4]), n: byWeekday[4].length },
    { label: "Fri", val: avg(byWeekday[5]), n: byWeekday[5].length },
    ...(hasWeekend ? [
      { label: "Sat", val: avg(byWeekday[6]), n: byWeekday[6].length },
      { label: "Sun", val: avg(byWeekday[0]), n: byWeekday[0].length },
    ] : []),
  ];

  const months = [
    "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"
  ].map((label, i) => ({ label, val: avg(byMonth[i + 1]), n: byMonth[i + 1].length }));

  return { weekdays, months };
};


// ── CYCLE ANALYSIS — bottom detection + inter-low spacing ────────────────────
const findSignificantLows = (candles, lookback) => {
  const n = candles.length;
  const lows_map = candles.map(c => c.l);

  // Multi-scale: detect local minima at multiple lookback windows
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

  // Prominence filter: a low is significant if it drops at least X% from surrounding highs
  const minProminence = 0.03; // 3% drop from surrounding structure
  const prominent = [...candidates].filter(i => {
    const price = lows_map[i];
    // Find highest high within 2*lookback on each side
    const leftHigh = Math.max(...lows_map.slice(Math.max(0, i - lookback * 2), i).map((_, j, a) => candles[Math.max(0, i - lookback * 2) + j].h));
    const rightHigh = Math.max(...lows_map.slice(i + 1, Math.min(n, i + lookback * 2 + 1)).map((_, j) => candles[i + 1 + j].h));
    const refHigh = Math.min(leftHigh, rightHigh); // more conservative
    return refHigh > 0 && (refHigh - price) / refHigh >= minProminence;
  });

  prominent.sort((a, b) => a - b);

  // Deduplicate: within lookback distance keep only the deepest
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

  // If anchor is set, find the closest low to it and use its neighbors
  // to compute the most accurate cycles around that specific bottom
  let anchorLowIdx = null;
  if (anchorIdx != null) {
    let minDist = Infinity;
    lows.forEach((li, i) => {
      const d = Math.abs(li - anchorIdx);
      if (d < minDist) { minDist = d; anchorLowIdx = i; }
    });
  }

  // Build distances: all pairs + skip-one
  const distances = [];
  for (let i = 1; i < lows.length; i++) distances.push({ d: lows[i] - lows[i-1], i1: i-1, i2: i });
  for (let i = 2; i < lows.length; i++) distances.push({ d: lows[i] - lows[i-2], i1: i-2, i2: i });

  // If anchor low found, boost distances that include anchor ± 1 neighbor
  const anchorBoost = (i1, i2) => {
    if (anchorLowIdx == null) return 1;
    const nearby = [anchorLowIdx - 1, anchorLowIdx, anchorLowIdx + 1];
    return (nearby.includes(i1) || nearby.includes(i2)) ? 3 : 1;
  };

  // Cluster within 15%
  const clusters = [];
  for (const { d, i1, i2 } of distances) {
    if (d < 3) continue;
    const boost = anchorBoost(i1, i2);
    const ex = clusters.find(c => Math.abs(c.mean - d) / c.mean < 0.15);
    if (ex) {
      for (let b = 0; b < boost; b++) ex.vals.push(d);
      ex.mean = ex.vals.reduce((a,b)=>a+b,0)/ex.vals.length;
    } else {
      clusters.push({ mean: d, vals: Array(boost).fill(d) });
    }
  }

  // Score: count × consistency
  const scored = clusters.map(c => {
    const m = c.mean;
    const variance = c.vals.reduce((a,v)=>a+(v-m)**2,0)/c.vals.length;
    const std = Math.sqrt(variance);
    const consistency = m > 0 ? Math.max(0, 1 - std/m) : 0;
    const accuracy = Math.min(99, consistency * 85 * Math.min(1, c.vals.length / 3));
    return { period: Math.round(m), accuracy, score: c.vals.length * consistency, amplitude: 1, phase: -Math.PI/2, lowCount: c.vals.length };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = [];
  for (const s of scored) {
    if (s.period < 3) continue;
    if (!selected.some(x => Math.abs(x.period-s.period)/Math.max(x.period,s.period) < 0.1))
      selected.push(s);
    if (selected.length >= topN) break;
  }
  // Final sort: by accuracy descending
  selected.sort((a, b) => b.accuracy - a.accuracy);
  return selected;
};

// Build composite — anchor is a LOW, -cos pins trough there, projects fwd + bwd
const buildComposite = (candles, selectedCycles, tweaks, anchorIdx, slopeMult = 1.0) => {
  if (!candles.length || !selectedCycles.length) return [];
  const n = candles.length;
  const fwdBars = Math.ceil(n * 0.5);
  const totalBars = n + fwdBars;
  const anchor = anchorIdx != null ? Math.min(anchorIdx, n-1) : n-1;

  const anchorPrice = candles[anchor].l;
  const priceMin = Math.min(...candles.map(c => c.l));
  const priceMax = Math.max(...candles.map(c => c.h));
  const priceRange = priceMax - priceMin;
  const numCyc = selectedCycles.length;

  // -cos(w*(t-anchor)) = trough at t=anchor, crest at t=anchor+period/2
  const raw = Array(totalBars).fill(0);
  for (const cyc of selectedCycles) {
    const tw = tweaks[cyc.period] || {};
    const period = cyc.period * (tw.periodMult || 1);
    const w = 2 * Math.PI / period;
    for (let t = 0; t < totalBars; t++) {
      raw[t] += -Math.cos(w * (t - anchor));
    }
  }

  // raw in [-numCyc, +numCyc]; amplitude = 35% price range per cycle
  const amplitude = (priceRange * 0.35) / numCyc;
  // anchor (trough) maps to raw=-numCyc → anchorPrice
  const midPrice = anchorPrice + numCyc * amplitude;

  // Phase skew: shift where the HIGH occurs on the X axis
  // slopeMult=1 → symmetric (high at midpoint between lows)
  // slopeMult<1 → high shifted left (fast rise, slow fall)
  // slopeMult>1 → high shifted right (slow rise, fast fall)
  // Implementation: use a distorted time axis per cycle
  const skewed = Array(totalBars).fill(0);
  for (const cyc of selectedCycles) {
    const tw = tweaks[cyc.period] || {};
    const period = cyc.period * (tw.periodMult || 1);
    for (let t = 0; t < totalBars; t++) {
      // Map t into [0,1] within current cycle relative to anchor
      const phase = ((t - anchor) % period + period) % period / period; // 0→1 within cycle
      // Distort: compress/expand the rising part
      // phase < slopeMult/(1+slopeMult) = rising, rest = falling
      const split = slopeMult / (1 + slopeMult); // where the peak sits (0..1)
      let distorted;
      if (phase < split) {
        // Rising half: 0 → π  mapped over [0, split]
        distorted = (phase / split) * Math.PI;
      } else {
        // Falling half: π → 2π mapped over [split, 1]
        distorted = Math.PI + ((phase - split) / (1 - split)) * Math.PI;
      }
      skewed[t] += -Math.cos(distorted); // -cos: trough=0, peak=π
    }
  }

  // skewed in [-numCyc, +numCyc], anchor (t=anchor, phase=0) = trough = -numCyc
  return skewed.map((v, t) => ({
    t,
    v: anchorPrice + (v + numCyc) * amplitude,
    isFuture: t >= n,
  }));
};

// ── BAR CHART ─────────────────────────────────────────────────────────────────
function BarChart({ data, title }) {
  const vals = data.map(d => d.val);
  const maxAbs = Math.max(...vals.map(Math.abs), 0.001);
  const H = 240, PAD = { top: 40, bottom: 44, left: 52, right: 16 };
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
              <text x={x + barW / 2} y={H - 10} textAnchor="middle"
                fill="#444" fontSize="9.5" fontFamily="'DM Mono', monospace">
                {d.label}
              </text>
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

const calcResistance = (candles, visible, lookback = 20) => {
  const levels = new Set();
  for (let i = lookback; i < visible.length - lookback; i++) {
    const absI = visible[i];
    const slice = visible.slice(i - lookback, i + lookback + 1);
    const maxH = Math.max(...slice.map(c => c.h));
    const minL = Math.min(...slice.map(c => c.l));
    if (absI.h === maxH) levels.add(+(absI.h.toFixed(2)));
    if (absI.l === minL) levels.add(+(absI.l.toFixed(2)));
  }
  return [...levels].slice(0, 8);
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
function PriceChart({ candles, interval, activeIndicators, indSettings, compositeWave, pickingAnchor, onAnchorPick }) {
  const svgRef = useRef(null);
  const viewRef = useRef({ startIdx: 0, endIdx: Math.max(0, candles.length - 1) });
  const [viewVersion, setViewVersion] = useState(0); // trigger re-render
  const [hover, setHover] = useState(null);
  const isPanningRef = useRef(false);
  const panStart = useRef(null);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const W = 1000, H = 340, PAD = { top: 20, right: 20, bottom: 40, left: 80 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const fmtLabel = (ts) => {
    const d = new Date(ts);
    return interval === "1d"
      ? d.toLocaleDateString([], { month: "short", day: "numeric" })
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
    // Cap: last real candle must stay within left 50% of visible window
    const viewLen = ne - ns;
    const lastReal = candlesRef.current.length - 1;
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
    e.preventDefault();
    // If in anchor picking mode, capture the candle index and fire callback
    if (pickingAnchor && onAnchorPick) {
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (W / rect.width);
        const { startIdx, endIdx } = viewRef.current;
        const visLen = endIdx - startIdx + 1;
        const idx = Math.max(0, Math.min(visLen - 1, Math.round((x - PAD.left) / iW * (visLen - 1))));
        onAnchorPick(startIdx + idx);
      }
      return;
    }
    isPanningRef.current = true;
    panStart.current = { x: e.clientX, start: viewRef.current.startIdx, end: viewRef.current.endIdx };
  };

  const handleMouseUp = () => { isPanningRef.current = false; };

  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const { startIdx, endIdx } = viewRef.current;
    const visLen = endIdx - startIdx + 1;
    const idx = Math.max(0, Math.min(visLen - 1, Math.round((x - PAD.left) / iW * (visLen - 1))));
    const absIdx = startIdx + idx;
    const c = candlesRef.current[absIdx];
    if (c) {
      const slice = candlesRef.current.slice(startIdx, endIdx + 1);
      const prices2 = slice.flatMap(c => [c.h, c.l]);
      const minP2 = Math.min(...prices2), maxP2 = Math.max(...prices2);
      const r2 = maxP2 - minP2 || 1, p2 = r2 * 0.05;
      const xPos = PAD.left + (idx / Math.max(visLen - 1, 1)) * iW;
      const yPos = PAD.top + iH - ((c.c - (minP2 - p2)) / (r2 + p2 * 2)) * iH;
      setHover({ x: xPos, y: yPos, candle: c });
    }
    if (isPanningRef.current && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const { start: ps, end: pe } = panStart.current;
      const pixPerCandle = iW * (rect.width / W) / Math.max(pe - ps, 1);
      const shift = Math.round(-dx / pixPerCandle);
      const len = pe - ps;
      let ns = ps + shift, ne = pe + shift;
      const lastReal = candlesRef.current.length - 1;
      // Cap: last real candle must stay within left 50% of visible window
      const maxEnd = lastReal + Math.floor(len * 0.5);
      if (ns < 0) { ns = 0; ne = Math.min(len, maxEnd); }
      if (ne > maxEnd) { ne = maxEnd; ns = Math.max(0, ne - len); }
      viewRef.current = { startIdx: ns, endIdx: ne };
      setViewVersion(v => v + 1);
    }
  };

  // ALL hooks done — early return safe here
  if (!candles.length) return null;

  const { startIdx, endIdx } = viewRef.current;
  // Build visible array including virtual future bars (null candles for future)
  const realEnd = Math.min(endIdx, candles.length - 1);
  const visible = candles.slice(startIdx, realEnd + 1);
  if (visible.length < 2) return null;
  // Total slots including future virtual bars
  const totalSlots = endIdx - startIdx + 1;

  const prices = visible.flatMap(c => [c.h, c.l]);
  // Include composite wave values in auto-scale
  const waveVals = compositeWave
    ? compositeWave.filter(p => p.t >= startIdx && p.t < startIdx + visible.length).map(p => p.v)
    : [];
  const allVals = [...prices, ...waveVals].filter(v => v != null && isFinite(v));
  const minP = Math.min(...allVals);
  const maxP = Math.max(...allVals);
  const range = maxP - minP || 1;
  const pad = range * 0.05;

  const xScale = (i) => PAD.left + (i / (totalSlots - 1)) * iW;
  const yScale = (v) => PAD.top + iH - ((v - (minP - pad)) / (range + pad * 2)) * iH;

  const pathD = visible.map((c, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(c.c)}`).join(" ");
  const areaD = pathD + ` L ${xScale(visible.length - 1)} ${PAD.top + iH} L ${PAD.left} ${PAD.top + iH} Z`;
  // Future zone marker
  const futureX = xScale(visible.length - 1);

  const isUp = visible[visible.length - 1].c >= visible[0].c;
  const color = isUp ? "#22c55e" : "#ef4444";

  const xStep = Math.max(1, Math.floor(totalSlots / 7));
  const xLabels = visible.filter((_, i) => i % xStep === 0);
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => minP - pad + ((range + pad * 2) / (yTicks - 1)) * i);

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: pickingAnchor ? "cell" : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { isPanningRef.current = false; setHover(null); }}>

        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yLabels.map((v, i) => (
          <line key={i} x1={PAD.left} x2={W - PAD.right} y1={yScale(v)} y2={yScale(v)} stroke="#181818" strokeWidth="1" />
        ))}

        {/* Y labels */}
        {yLabels.map((v, i) => (
          <text key={i} x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" fill="#444" fontSize="11" fontFamily="'DM Mono', monospace">
            {fmtPrice(v)}
          </text>
        ))}

        {/* X labels */}
        {xLabels.map((c, i) => (
          <text key={i} x={xScale(visible.indexOf(c))} y={H - 8} textAnchor="middle" fill="#444" fontSize="10" fontFamily="'DM Mono', monospace">
            {fmtLabel(c.t)}
          </text>
        ))}

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
            const levels = calcResistance(candles, visible, 20);
            levels.forEach((lvl, i) => {
              const y = yScale(lvl);
              if (y < PAD.top || y > PAD.top + iH) return;
              els.push(<line key={"res"+i} x1={PAD.left} x2={W-PAD.right} y1={y} y2={y} stroke="#fbbf24" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.6"/>);
              els.push(<text key={"restxt"+i} x={W-PAD.right+4} y={y+4} fill="#fbbf24" fontSize="9" fontFamily="'DM Mono',monospace" opacity="0.7">{lvl.toLocaleString()}</text>);
            });
          }
          return els;
        })()}

        {/* ── COMPOSITE CYCLE WAVE ── */}
        {compositeWave && compositeWave.length > 1 && (() => {
          // Map composite wave values to visible range
          const histPoints = compositeWave.filter(p => !p.isFuture);
          const futPoints = compositeWave.filter(p => p.isFuture);

          // Scale: map index within visible range
          const buildPath = (pts, offset) => {
            let d = "";
            pts.forEach((p, i) => {
              const absIdx = offset + i;
              if (absIdx < startIdx || absIdx > endIdx) return;
              const xi = absIdx - startIdx;
              const x = xScale(xi);
              const y = yScale(p.v);
              d += d ? ` L ${x} ${y}` : `M ${x} ${y}`;
            });
            return d;
          };

          const histPath = buildPath(histPoints, 0);
          const futPath = (() => {
            let d = "";
            futPoints.forEach((p, i) => {
              const x = xScale(visible.length + i);
              const y = yScale(p.v);
              if (x > W - PAD.right + 60) return;
              d += d ? ` L ${x} ${y}` : `M ${x} ${y}`;
            });
            return d;
          })();

          return (
            <g>
              {histPath && <path d={histPath} fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.85" strokeLinejoin="round" />}
              {futPath && <path d={futPath} fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.45" strokeDasharray="6 4" strokeLinejoin="round" />}
            </g>
          );
        })()}

        {/* Hover */}
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + iH} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4,3" />
            <circle cx={hover.x} cy={hover.y} r="4" fill={color} stroke="#0a0a0a" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div style={{ position: "absolute", top: 12, left: 90, background: "#111", border: "1px solid #222", borderRadius: 8, padding: "8px 14px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#e8e8e8", pointerEvents: "none" }}>
          <div style={{ color: "#555", fontSize: 10, marginBottom: 2 }}>{fmtLabel(hover.candle.t)}</div>
          <div style={{ color, fontSize: 16, fontWeight: 600 }}>{fmtPrice(hover.candle.c)}</div>
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

export default function App() {
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [interval, setInterval_] = useState("1d");
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState("");
  const [selectedYears, setSelectedYears] = useState([]);
  const [yearInput, setYearInput] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [csvLoaded, setCsvLoaded] = useState(false);
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

  const availableYears = [...new Set(candles.map(c => c.date.getFullYear()))].sort();

  const activeYears = selectedYears.length > 0
    ? selectedYears.filter(y => availableYears.includes(y))
    : availableYears;

  const seasonality = candles.length > 0 && activeYears.length > 0
    ? calcSeasonality(candles, activeYears)
    : null;

  const handleCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result, interval);
      if (!parsed || parsed.length < 10) { setError(true); return; }
      setTicker(file.name.replace(/\.csv$/i, "").toUpperCase());
      setCandles(parsed); setCsvLoaded(true); setSelectedYears([]); setError(false);
    };
    reader.readAsText(file);
  };

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
        const c = analyzeCycles(candles, 20, cycleAnchorIdx);
        setCycles(c);
        setSelectedCycles(new Set());
        setCycleTweaks({});
        setProgress("");
      }, 50);
    }
  }, [candles]);

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

  const selectedCycleObjs = cycles.filter(c => selectedCycles.has(c.period));
  const compositeWave = (showCycles && selectedCycleObjs.length > 0)
    ? buildComposite(candles, selectedCycleObjs, cycleTweaks, cycleAnchorIdx, cycleSlopeMult)
    : [];

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
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8e8e8", fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Bebas+Neue&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; }

        .header { height: 80px; padding: 0 48px; display: flex; align-items: center; justify-content: space-between; background: rgba(10,10,10,0.92); backdrop-filter: blur(24px); border-bottom: 1px solid #1a1a1a; position: sticky; top: 0; z-index: 100; }
        .logo-area { display: flex; align-items: center; gap: 14px; }
        .logo-divider { width: 1px; height: 32px; background: linear-gradient(180deg, transparent, rgba(212,175,55,0.4), transparent); }
        .logo-name { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 0.25em; background: linear-gradient(135deg,#fff,#e8e8e8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .logo-sub { font-size: 7px; letter-spacing: 0.4em; color: #b99c64; font-weight: 500; text-transform: uppercase; margin-top: 2px; }

        .toolbar { display: flex; align-items: center; gap: 10px; padding: 32px 48px 24px; flex-wrap: wrap; }
        .ticker-inp { background: #111; border: 1px solid #222; color: #f8e49b; font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.15em; padding: 11px 18px; border-radius: 8px; outline: none; width: 180px; text-transform: uppercase; transition: border-color 0.2s; }
        .ticker-inp:focus { border-color: #d4af37; }
        .ticker-inp::placeholder { color: #2a2a2a; }

        .btn { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.15em; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; text-transform: uppercase; padding: 11px 22px; }
        .btn-gold { background: linear-gradient(135deg, #d4af37, #c59958); color: #0a0a0a; }
        .btn-gold:hover { background: linear-gradient(135deg, #f8e49b, #d4af37); transform: translateY(-1px); }
        .btn-outline { background: transparent; color: #555; border: 1px solid #222; }
        .btn-outline:hover { border-color: #333; color: #888; }
        .btn-outline.active { border-color: #d4af37; color: #f8e49b; background: rgba(212,175,55,0.08); }

        .section { margin: 0 48px 24px; background: #111; border: 1px solid #1a1a1a; border-radius: 14px; overflow: hidden; }
        .section-header { padding: 16px 24px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; justify-content: space-between; }
        .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 0.15em; color: #fdfdfd; }
        .section-body { padding: 20px 16px 12px; }

        .year-filter { padding: 20px 48px 16px; border-bottom: 1px solid #1a1a1a; }
        .year-filter-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .year-filter-label { font-size: 9px; color: #444; letter-spacing: 0.22em; font-weight: 700; text-transform: uppercase; white-space: nowrap; margin-right: 4px; }
        .year-chips { display: flex; flex-wrap: wrap; gap: 5px; }
        .year-chip { font-family: 'DM Mono', monospace; font-size: 10px; padding: 4px 9px; border-radius: 4px; border: 1px solid #1e1e1e; color: #444; cursor: pointer; transition: all 0.15s; background: transparent; }
        .year-chip:hover { border-color: #2a2a2a; color: #777; }
        .year-chip.active { border-color: #d4af37; color: #f8e49b; background: rgba(212,175,55,0.08); }
        .year-chip.all-chip { color: #555; border-color: #222; margin-right: 4px; }
        .year-chip.all-chip.active { border-color: #d4af37; color: #f8e49b; }

        .year-filter-bottom { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .filter-group { display: flex; align-items: center; gap: 6px; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 8px; padding: 6px 12px; }
        .filter-group-label { font-size: 8px; color: #333; letter-spacing: 0.2em; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
        .filter-input { background: transparent; border: none; border-bottom: 1px solid #222; color: #e8e8e8; font-family: 'DM Mono', monospace; font-size: 11px; padding: 2px 4px; outline: none; width: 52px; transition: border-color 0.2s; text-align: center; }
        .filter-input:focus { border-bottom-color: #d4af37; }
        .filter-input::placeholder { color: #2a2a2a; }
        .filter-sep { color: #2a2a2a; font-size: 10px; }
        .filter-input-wide { background: transparent; border: none; border-bottom: 1px solid #222; color: #e8e8e8; font-family: 'DM Mono', monospace; font-size: 11px; padding: 2px 4px; outline: none; width: 140px; transition: border-color 0.2s; }
        .filter-input-wide:focus { border-bottom-color: #d4af37; }
        .filter-input-wide::placeholder { color: #2a2a2a; }
        .active-years-tag { font-family: "DM Mono", monospace; font-size: 9px; color: #d4af37; letter-spacing: 0.06em; opacity: 0.7; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .spinner { width: 28px; height: 28px; border: 2px solid #1a1a1a; border-top-color: #d4af37; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 12px; }
        .empty-label { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 0.25em; color: #1e1e1e; }
        .empty-sub { font-size: 9px; color: #2a2a2a; letter-spacing: 0.15em; font-weight: 600; text-transform: uppercase; }

        .ind-bar { display: flex; align-items: center; gap: 8px; padding: 12px 24px; background: #0d0d0d; border-top: 1px solid #1a1a1a; flex-wrap: wrap; }
        .ind-btn { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; border: 1px solid #222; background: transparent; color: #555; font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.15em; cursor: pointer; transition: all 0.15s; text-transform: uppercase; position: relative; }
        .ind-btn:hover { border-color: #333; color: #888; }
        .ind-btn.active { background: rgba(255,255,255,0.05); }
        .ind-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .ind-gear { font-size: 10px; opacity: 0.5; cursor: pointer; padding: 0 2px; transition: opacity 0.15s; }
        .ind-gear:hover { opacity: 1; }

        .ind-popup { position: absolute; bottom: calc(100% + 8px); left: 0; background: #111; border: 1px solid #2a2a2a; border-radius: 10px; padding: 14px 16px; z-index: 200; min-width: 180px; box-shadow: 0 8px 32px rgba(0,0,0,0.6); }
        .ind-popup-title { font-family: 'Bebas Neue', sans-serif; font-size: 13px; letter-spacing: 0.1em; color: #e8e8e8; margin-bottom: 10px; }
        .ind-field { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .ind-field label { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 0.1em; color: #666; text-transform: uppercase; }
        .ind-field input { background: #0a0a0a; border: 1px solid #222; color: #e8e8e8; font-family: 'DM Mono', monospace; font-size: 11px; padding: 4px 8px; border-radius: 4px; outline: none; width: 70px; text-align: right; }
        .ind-field input:focus { border-color: #d4af37; }
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
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {["1d", "1w"].map(iv => (
            <button key={iv} className={`btn btn-outline ${interval === iv ? "active" : ""}`}
              onClick={() => switchInterval(iv)}>{iv.toUpperCase()}</button>
          ))}
        </div>
        {loading && <><div className="spinner" /><span style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em" }}>{progress}</span></>}
        <label style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 18px", background:"transparent", border:"1px solid #222", borderRadius:6, cursor:"pointer", fontFamily:"'Montserrat',sans-serif", fontSize:10, fontWeight:700, letterSpacing:"0.15em", color:"#555", textTransform:"uppercase", transition:"all 0.2s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#333"} onMouseLeave={e=>e.currentTarget.style.borderColor="#222"}>
          ↑ CSV
          <input type="file" accept=".csv" style={{display:"none"}} onChange={handleCSV} />
        </label>
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
            {activeYears.length > 0 && selectedYears.length > 0 && (
              <span className="active-years-tag">✦ {activeYears.join(" · ")}</span>
            )}
          </div>
        </div>
      )}

      {/* PRICE CHART */}
      {!ticker ? (
        <div className="empty">
          <div className="empty-label">Enter a crypto ticker</div>
          <div className="empty-sub">Crypto: BTC · ETH · SOL · HYPE</div>
          <div className="empty-sub" style={{ marginTop: 6 }}>Stocks: AAPL · MSFT · ADS · BMW</div>
          <div className="empty-sub" style={{ marginTop: 4 }}>Indices: SPX · NDX · DAX · FTSE</div>
          <div className="empty-sub" style={{ marginTop: 4 }}>Commodities: GOLD · SILVER · WTI · PLATINUM · PALLADIUM · COPPER · WHEAT · or ↑ CSV</div>
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
              <div className="section-title">{ticker} · {interval === "1d" ? "DAILY" : "WEEKLY"} · {isCrypto(ticker) ? "BINANCE" : csvLoaded ? "CSV" : isCommodity(ticker) ? "NASDAQ" : "TWELVE DATA"}</div>
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
                      // Recompute cycles with anchor context
                      setTimeout(() => {
                        const c = analyzeCycles(candles, 20, idx);
                        setCycles(c);
                        setSelectedCycles(new Set());
                      }, 10);
                    }} />
                </div>
              </div>
              {/* Cycle Panel Toggle */}
              {cycles.length > 0 && (
                <div style={{ position: "relative" }}>
                  <button onClick={() => setCyclesPanelOpen(o => !o)}
                    style={{ position: "absolute", top: 12, right: -1, background: cyclesPanelOpen ? "#1a1a1a" : "#111", border: "1px solid #222", borderRight: "none", color: cyclesPanelOpen ? "#f8e49b" : "#555", fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", padding: "8px 10px", cursor: "pointer", borderRadius: "6px 0 0 6px", writingMode: "vertical-rl", textTransform: "uppercase", transition: "all 0.2s" }}>
                    {cyclesPanelOpen ? "◀ Cycles" : "▶ Cycles"}
                  </button>
                  {cyclesPanelOpen && (
                    <div style={{ width: 340, background: "#0d0d0d", borderLeft: "1px solid #1a1a1a", display: "flex", flexDirection: "column" }}>
                      {/* Panel header */}
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: "0.1em", color: "#e8e8e8" }}>Cycle Analysis</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#444" }}>{selectedCycles.size} selected</span>
                          <button onClick={() => setPickingAnchor(p => !p)}
                            title="Click a point on the chart to anchor the wave"
                            style={{ background: pickingAnchor ? "rgba(239,68,68,0.15)" : cycleAnchorIdx != null ? "rgba(212,175,55,0.1)" : "transparent", border: `1px solid ${pickingAnchor ? "#ef4444" : cycleAnchorIdx != null ? "#d4af37" : "#222"}`, color: pickingAnchor ? "#ef4444" : cycleAnchorIdx != null ? "#f8e49b" : "#555", fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 4, cursor: "pointer", textTransform: "uppercase", transition: "all 0.2s" }}>
                            {pickingAnchor ? "↗ CLICK LOW" : cycleAnchorIdx != null ? "⊕ LOW SET" : "📍 SET LOW"}
                          </button>

                        </div>
                      </div>
                      {/* Slope control */}
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", color: "#333", textTransform: "uppercase", whiteSpace: "nowrap" }}>Peak Shift</span>
                        <input type="range" min="0.5" max="1.5" step="0.01" value={cycleSlopeMult}
                          onChange={e => {
                            const raw = parseFloat(e.target.value);
                            const snapped = Math.round(raw * 10) / 10;
                            const dist = Math.abs(raw - snapped);
                            if (dist < 0.035) {
                              // Hard snap zone — lock immediately
                              setCycleSlopeMult(snapped);
                            } else if (dist < 0.08) {
                              // Rubber band — pulls hard toward snap, exponential feel
                              const t = (dist - 0.035) / (0.08 - 0.035); // 0→1
                              const pull = snapped + (raw - snapped) * t * t * 0.25;
                              setCycleSlopeMult(pull);
                            } else {
                              setCycleSlopeMult(raw);
                            }
                          }}
                          style={{ flex: 1, accentColor: "#d4af37", height: 2, cursor: "pointer" }} />
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#d4af37", width: 36, textAlign: "right", whiteSpace: "nowrap" }}>{cycleSlopeMult.toFixed(2)}x</span>
                        <button onClick={() => setCycleSlopeMult(1.0)} style={{ background: "transparent", border: "1px solid #222", color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 8, padding: "2px 6px", borderRadius: 3, cursor: "pointer" }}>↺</button>
                      </div>
                      {/* Table header */}
                      <div style={{ display: "grid", gridTemplateColumns: "28px 64px 1fr 40px", gap: 0, padding: "6px 18px", borderBottom: "1px solid #1a1a1a" }}>
                        {["#","Period","Accuracy",""].map((h, i) => (
                          <span key={i} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 7, fontWeight: 700, letterSpacing: "0.18em", color: "#2a2a2a", textTransform: "uppercase" }}>{h}</span>
                        ))}
                      </div>
                      {/* Cycle rows */}
                      <div style={{ overflowY: "auto", flex: 1, maxHeight: 480 }}>
                        {cycles.map((cyc, i) => {
                          const isOn = selectedCycles.has(cyc.period);
                          return (
                            <div key={cyc.period} onClick={() => toggleCycle(cyc.period)}
                              style={{ display: "grid", gridTemplateColumns: "28px 64px 1fr 40px", alignItems: "center", gap: 0, padding: "9px 18px", borderBottom: "1px solid #0f0f0f", cursor: "pointer", background: isOn ? "rgba(212,175,55,0.05)" : "transparent", transition: "background 0.15s" }}>
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
          <div style={{ height: 48 }} />
        </>
      ) : loading ? null : null}
    </div>
  );
}
