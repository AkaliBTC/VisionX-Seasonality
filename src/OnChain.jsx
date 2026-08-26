import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { apiFetch } from "./access";
import { C, F, panel, overline, displayTitle, btnGhost, badge, Ambient } from "./ui";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · ON-CHAIN
//
//  Neun umschaltbare Ansichten auf einer gemeinsamen Zoom-/Pan-Achse.
//
//  DATENHERKUNFT — bitte nicht vermischen:
//   [EXAKT]  aus blockchain.info abgeleitet, nur BTC:
//            MVRV · Realized Price · NUPL · MVRV-Z · Puell · Netzwerk
//   [EXAKT]  aus OHLCV berechnet, jede Coin:
//            Ω-Score · Fractal Intensity
//   [LIVE]   echte UTXO-Daten von BGeometrics, nur BTC:
//            STH/LTH Realised Price · Supply in Profit · SOPR · STH-MVRV
//   [PROXY]  Volumenprofil-Fallback, jede Coin — greift, wenn BGeometrics
//            nicht antwortet oder eine andere Coin gewählt ist:
//            Cost-Basis-Heatmap · Realised Price (ST) · Supply in Profit
//
//  Die PROXY-Reihen bilden die STH-Metriken über ein 155-Tage-Volumenprofil
//  nach: jeder Handelstag zählt mit seinem Volumen als "zu diesem Preis
//  erworben". Gleiche Logik wie eine UTXO-Kostenbasis, nur mit Börsenvolumen
//  statt Chain-Outputs. Die Form stimmt, das Niveau weicht ab. Sie sind in der
//  UI als PROXY markiert und dürfen nicht als echte On-Chain-Metrik auftreten.
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";
const STH_WINDOW = 155;          // Short-Term-Holder-Schwelle in Tagen
const HEAT_BINS = 46;            // Preisklassen der Kostenbasis-Heatmap

// ── COINS ────────────────────────────────────────────────────────────────────
const COINS = [
  { id: "BTC-USD", label: "BTC" },
  { id: "ETH-USD", label: "ETH" },
  { id: "SOL-USD", label: "SOL" },
  { id: "XRP-USD", label: "XRP" },
  { id: "BNB-USD", label: "BNB" },
  { id: "DOGE-USD", label: "DOGE" },
  { id: "ADA-USD", label: "ADA" },
];
const isBtc = c => c === "BTC-USD";

// ── ANSICHTEN ────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: "heat", label: "COST BASIS", kind: "proxy", btcOnly: false,
    de: "Verteilung der Kostenbasis über ein rollierendes 155-Tage-Volumenprofil. Helle Bänder sind Preiszonen, in denen viel Angebot erworben wurde — dort liegt Widerstand nach unten wie nach oben.",
    en: "Cost-basis distribution from a rolling 155-day volume profile. Bright bands are price zones where a lot of supply was acquired — support and resistance both live there." },
  { id: "realised", label: "REALISED PRICE", kind: "proxy", btcOnly: false,
    de: "Volumengewichteter Durchschnittspreis der letzten 155 Tage. Proxy für den STH Realised Price: darüber sitzt die kurzfristige Kohorte im Gewinn, darunter im Verlust.",
    en: "Volume-weighted average price over the last 155 days. Proxy for STH realised price: above it the short-term cohort is in profit, below it under water." },
  { id: "profit", label: "SUPPLY IN PROFIT", kind: "proxy", btcOnly: false,
    de: "Anteil des in den letzten 155 Tagen gehandelten Volumens, das unter dem aktuellen Kurs erworben wurde. Unter 10 % markierte historisch Kapitulationszonen, über 90 % Euphorie.",
    en: "Share of the last 155 days of volume acquired below spot. Sub-10 % historically marked capitulation, above 90 % euphoria." },
  { id: "omega", label: "Ω-SCORE", kind: "exact", btcOnly: false,
    de: "Perzentilrang der Abweichung vom Realised-Proxy, gemessen in σ über 365 Tage. 0 = maximal ausverkauft, 100 = maximal überkauft. Der Kursverlauf ist nach diesem Rang eingefärbt.",
    en: "Percentile rank of the deviation from the realised proxy, measured in σ over 365 days. 0 = maximally oversold, 100 = maximally overbought. Price is coloured by that rank." },
  { id: "fractal", label: "FRACTALS", kind: "exact", btcOnly: false,
    de: "Volatilitäts-Intensität: True Range gegen die eigene 60-Tage-Verteilung, verstärkt bei Ausbrüchen aus der 20-Tage-Spanne. Ausschläge markieren Regimewechsel, nicht Richtung.",
    en: "Volatility intensity: true range against its own 60-day distribution, amplified on breaks of the 20-day range. Spikes mark regime changes, not direction." },
  { id: "mvrv", label: "MVRV / NUPL", kind: "exact", btcOnly: true,
    de: "MVRV mit abgeleitetem NUPL (1 − 1/MVRV) und Realized Price. Die einzige Zyklus-Metrik dieser Sammlung, die exakt und frei verfügbar ist.",
    en: "MVRV with derived NUPL (1 − 1/MVRV) and realized price. The one cycle metric in this set that is both exact and freely available." },
  { id: "mvrvz", label: "MVRV Z-SCORE", kind: "exact", btcOnly: true,
    de: "Abstand von Market Cap zu Realized Cap in Standardabweichungen der Market Cap. Historisch die zuverlässigste Markierung von Zyklus-Hochs und -Tiefs.",
    en: "Distance between market cap and realized cap in standard deviations of market cap. Historically the most reliable marker of cycle tops and bottoms." },
  { id: "puell", label: "PUELL", kind: "exact", btcOnly: true,
    de: "Miner-Tagesumsatz gegen seinen eigenen 365-Tage-Durchschnitt. Misst Verkaufsdruck von der Angebotsseite.",
    en: "Daily miner revenue against its own 365-day average. Measures sell pressure from the supply side." },
  { id: "sopr", label: "SOPR", kind: "exact", btcOnly: true, needsUtxo: true,
    de: "Spent Output Profit Ratio: Verhältnis von Verkaufspreis zu Kaufpreis aller an einem Tag bewegten Coins. Über 1 wird im Schnitt Gewinn realisiert, unter 1 Verlust. Der Durchgang durch 1 ist die klassische Bullenmarkt-Unterstützung.",
    en: "Spent output profit ratio: sale price over cost basis of every coin moved that day. Above 1 profit is being realised on average, below 1 losses. The cross through 1 is the classic bull-market support." },
  { id: "sthmvrv", label: "STH-MVRV", kind: "exact", btcOnly: true, needsUtxo: true,
    de: "MVRV nur für die Kohorte unter 155 Tagen. Reagiert deutlich schneller als das aggregierte MVRV, weil ruhende und verlorene Coins draußen bleiben.",
    en: "MVRV for the sub-155-day cohort only. Reacts far faster than aggregate MVRV because dormant and lost coins are excluded." },
  { id: "network", label: "NETZWERK", kind: "exact", btcOnly: true,
    de: "Hashrate und aktive Adressen. Fundamentaldaten des Netzwerks, kein Timing-Signal.",
    en: "Hashrate and active addresses. Network fundamentals, not a timing signal." },
];

const viewById = id => VIEWS.find(v => v.id === id) || VIEWS[0];

// ── FARBEN ───────────────────────────────────────────────────────────────────
const MAGMA = [
  [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129],
  [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191],
];
const magma = t => {
  const x = Math.max(0, Math.min(1, t)) * (MAGMA.length - 1);
  const i = Math.min(MAGMA.length - 2, Math.floor(x));
  const f = x - i;
  const a = MAGMA[i], b = MAGMA[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
};

const HEAT_STOPS = [[0, 60, 120, 255], [25, 60, 210, 200], [50, 90, 220, 110], [75, 250, 200, 60], [90, 250, 130, 50], [100, 240, 60, 60]];
const heatColor = p => {
  const v = Math.max(0, Math.min(100, p));
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const [p0, r0, g0, b0] = HEAT_STOPS[i], [p1, r1, g1, b1] = HEAT_STOPS[i + 1];
    if (v <= p1) {
      const f = (v - p0) / (p1 - p0 || 1);
      return `rgb(${Math.round(r0 + (r1 - r0) * f)},${Math.round(g0 + (g1 - g0) * f)},${Math.round(b0 + (b1 - b0) * f)})`;
    }
  }
  return "rgb(240,60,60)";
};

const OMEGA_ZONES = [
  { lo: 95, label: "HEAVILY OVERBOUGHT", color: "#ef4444" },
  { lo: 80, label: "OVERBOUGHT", color: "#fb923c" },
  { lo: 60, label: "WARM", color: "#facc15" },
  { lo: 40, label: "NEUTRAL", color: "#8f8f8f" },
  { lo: 20, label: "COOL", color: "#5ecfa0" },
  { lo: 5, label: "OVERSOLD", color: "#3fcf8e" },
  { lo: -1, label: "HEAVILY OVERSOLD", color: "#22c55e" },
];
const omegaZone = v => OMEGA_ZONES.find(z => v >= z.lo) || OMEGA_ZONES[OMEGA_ZONES.length - 1];

// ── ZAHLEN ───────────────────────────────────────────────────────────────────
const compact = (v, d = 1) => {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k`;
  return v.toFixed(d);
};
const usd = v => (v == null || !Number.isFinite(v)) ? "—" : `$${compact(v, v < 10 ? 3 : 2)}`;
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", year: "numeric" });

// ── ABLEITUNGEN AUS OHLCV ────────────────────────────────────────────────────
// Rollierendes Volumenprofil als Ersatz für die UTXO-Kostenbasis: jeder Tag
// steuert sein Volumen beim Typical Price bei.
const buildProxies = (ohlc, w = STH_WINDOW) => {
  const n = ohlc?.length || 0;
  if (n < w + 20) return null;

  const tp = new Array(n), vol = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = ohlc[i];
    tp[i] = (r[2] + r[3] + r[4]) / 3;
    vol[i] = Number.isFinite(r[5]) && r[5] > 0 ? r[5] : 1;   // Fallback: Gleichgewichtung
  }

  const ts = [], realised = [], upper = [], lower = [], profit = [], price = [];
  for (let i = w - 1; i < n; i++) {
    let sw = 0, sv = 0;
    for (let k = i - w + 1; k <= i; k++) { sw += vol[k]; sv += tp[k] * vol[k]; }
    const mean = sv / sw;
    let varSum = 0;
    for (let k = i - w + 1; k <= i; k++) varSum += vol[k] * (tp[k] - mean) ** 2;
    const sd = Math.sqrt(varSum / sw);

    const close = ohlc[i][4];
    let inProfit = 0;
    for (let k = i - w + 1; k <= i; k++) if (tp[k] < close) inProfit += vol[k];

    ts.push(ohlc[i][0]);
    price.push(close);
    realised.push(mean);
    upper.push(mean + sd);
    lower.push(mean - sd);
    profit.push((inProfit / sw) * 100);
  }
  return { ts, price, realised, upper, lower, profit };
};

// Kostenbasis-Heatmap: pro Tag ein Volumen-Histogramm über Preisklassen
const buildHeat = (ohlc, w = STH_WINDOW, bins = HEAT_BINS) => {
  const n = ohlc?.length || 0;
  if (n < w + 20) return null;
  const tp = [], vol = [];
  for (let i = 0; i < n; i++) {
    const r = ohlc[i];
    tp.push((r[2] + r[3] + r[4]) / 3);
    vol.push(Number.isFinite(r[5]) && r[5] > 0 ? r[5] : 1);
  }
  const cols = [];
  for (let i = w - 1; i < n; i++) {
    let lo = Infinity, hi = -Infinity;
    for (let k = i - w + 1; k <= i; k++) { if (tp[k] < lo) lo = tp[k]; if (tp[k] > hi) hi = tp[k]; }
    const step = (hi - lo) / bins || 1;
    const hist = new Float64Array(bins);
    for (let k = i - w + 1; k <= i; k++) {
      const b = Math.min(bins - 1, Math.max(0, Math.floor((tp[k] - lo) / step)));
      hist[b] += vol[k];
    }
    let max = 0;
    for (let b = 0; b < bins; b++) if (hist[b] > max) max = hist[b];
    cols.push({ ts: ohlc[i][0], lo, step, hist, max: max || 1 });
  }
  return cols;
};

// Ω-Score: Perzentilrang der σ-Abweichung vom Realised-Proxy
const buildOmega = (px) => {
  if (!px) return null;
  const { ts, price, realised, upper } = px;
  const dev = price.map((p, i) => {
    const sd = upper[i] - realised[i];
    return sd > 1e-9 ? (p - realised[i]) / sd : 0;
  });
  const look = 365;
  const score = dev.map((d, i) => {
    const from = Math.max(0, i - look + 1);
    let below = 0, cnt = 0;
    for (let k = from; k <= i; k++) { if (dev[k] < d) below++; cnt++; }
    return (below / cnt) * 100;
  });
  return { ts, price, score };
};

// Fractal Intensity: True Range gegen die eigene 60-Tage-Verteilung
const buildFractal = (ohlc) => {
  const n = ohlc?.length || 0;
  if (n < 90) return null;
  const tr = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const r = ohlc[i], pc = ohlc[i - 1][4];
    tr[i] = Math.max(r[2] - r[3], Math.abs(r[2] - pc), Math.abs(r[3] - pc)) / pc;
  }
  const ts = [], price = [], intensity = [];
  const WIN = 60;
  for (let i = WIN; i < n; i++) {
    let m = 0;
    for (let k = i - WIN + 1; k <= i; k++) m += tr[k];
    m /= WIN;
    let vs = 0;
    for (let k = i - WIN + 1; k <= i; k++) vs += (tr[k] - m) ** 2;
    const sd = Math.sqrt(vs / WIN) || 1e-9;

    let hi20 = -Infinity, lo20 = Infinity;
    for (let k = i - 20; k < i; k++) { if (ohlc[k][2] > hi20) hi20 = ohlc[k][2]; if (ohlc[k][3] < lo20) lo20 = ohlc[k][3]; }
    const brk = (ohlc[i][4] > hi20 || ohlc[i][4] < lo20) ? 1.6 : 1;

    ts.push(ohlc[i][0]);
    price.push(ohlc[i][4]);
    intensity.push(Math.max(0, ((tr[i] - m) / sd) * 8 * brk + 6));
  }
  return { ts, price, intensity };
};

// Gleitender Durchschnitt über eine [ts, value]-Reihe
const sma = (series, w) => series.map((p, i) => {
  if (i < w - 1) return [p[0], null];
  let s = 0;
  for (let k = i - w + 1; k <= i; k++) s += series[k][1];
  return [p[0], s / w];
});

const align = (a, b) => {
  const m = new Map(b.map(([t, v]) => [t, v]));
  const out = [];
  for (const [t, v] of a) { const w = m.get(t); if (w != null && Number.isFinite(w)) out.push([t, v, w]); }
  return out;
};

// ── i18n ─────────────────────────────────────────────────────────────────────
const T_ = {
  de: {
    title: "ON-CHAIN", noData: "KEINE DATEN", loading: "LADE", reset: "↺ ZOOM",
    hint: "SCROLLEN = ZOOM · ZIEHEN = VERSCHIEBEN",
    sub: "Kostenbasis, Bewertung und Volatilität auf einer Achse · Ansicht per Toggle wechseln",
    proxy: "PROXY", exact: "EXAKT", btcOnly: "NUR BTC",
    btcNote: "Diese Ansicht braucht Chain-Daten und ist nur für BTC verfügbar.",
    live: "LIVE", height: "BLOCKHÖHE", mempool: "MEMPOOL", fee: "FEE (SCHNELL)", diff: "NÄCHSTE ANPASSUNG",
    price: "KURS", realised: "REALISED", band: "±1σ", profitLbl: "IN PROFIT", score: "Ω-SCORE",
    above: "KURS DARÜBER", below: "KURS DARUNTER", addresses: "ADRESSEN",
    proxyWarn: "Volumenprofil-Näherung, keine UTXO-Daten. Form belastbar, Niveau nicht.",
    liveNote: "Echte UTXO-Kohortendaten von BGeometrics. Der Proxy ist nur noch Rückfallebene.",
    live_: "LIVE", sources: "QUELLEN",
  },
  en: {
    title: "ON-CHAIN", noData: "NO DATA", loading: "LOADING", reset: "↺ ZOOM",
    hint: "SCROLL = ZOOM · DRAG = PAN",
    sub: "Cost basis, valuation and volatility on one axis · switch views with the toggle",
    proxy: "PROXY", exact: "EXACT", btcOnly: "BTC ONLY",
    btcNote: "This view needs chain data and is only available for BTC.",
    live: "LIVE", height: "BLOCK HEIGHT", mempool: "MEMPOOL", fee: "FEE (FASTEST)", diff: "NEXT ADJUSTMENT",
    price: "PRICE", realised: "REALISED", band: "±1σ", profitLbl: "IN PROFIT", score: "Ω-SCORE",
    above: "PRICE ABOVE", below: "PRICE BELOW", addresses: "ADDRESSES",
    proxyWarn: "Volume-profile approximation, not UTXO data. The shape holds, the level does not.",
    liveNote: "Real UTXO cohort data from BGeometrics. The proxy is only a fallback now.",
    live_: "LIVE", sources: "SOURCES",
  },
};

// ── CHART ────────────────────────────────────────────────────────────────────
const W = 1480, H = 500, PADL = 68, PADR = 68, PADT = 18, PADB = 34;
const plotW = W - PADL - PADR, plotH = H - PADT - PADB;

function Chart({ view, px, heat, omega, fractal, chain, coin, lang, T }) {
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [win, setWin] = useState({ a: 0, b: 1 });
  const [hoverK, setHoverK] = useState(null);

  useEffect(() => { setWin({ a: 0, b: 1 }); setHoverK(null); }, [view.id, coin]);

  // Reihen je Ansicht
  const model = useMemo(() => {
    if (view.id === "heat" || view.id === "realised") {
      if (!px) return null;
      const lines = view.id === "heat"
        ? [{ key: "price", vals: px.price, color: "#ffffff", w: 1.3 },
           { key: "realised", vals: px.realised, color: "#fb923c", w: 1.7 },
           { key: "upper", vals: px.upper, color: "#fecaca", w: 0.9, dash: "4 4" },
           { key: "lower", vals: px.lower, color: "#fecaca", w: 0.9, dash: "4 4" }]
        : [{ key: "price", vals: px.price, color: "#ffffff", w: 1.3 },
           { key: "realised", vals: px.realised, color: "#f0622e", w: 2.3 }];
      return {
        ts: px.ts, log: true, lines,
        readout: i => [
          { label: T.price, value: usd(px.price[i]), color: "#fff" },
          { label: T.realised, value: usd(px.realised[i]), color: "#fb923c" },
          { label: T.band, value: `${usd(px.lower[i])} – ${usd(px.upper[i])}`, color: "#fecaca" },
        ],
      };
    }
    if (view.id === "profit") {
      if (!px) return null;
      return {
        ts: px.ts, log: false, pct: true,
        right: { vals: px.price, color: "#ffffff", log: true },
        area: { vals: px.profit, color: "#2f8f5b", min: 0, max: 100 },
        readout: i => [
          { label: T.profitLbl, value: `${px.profit[i].toFixed(1)}%`, color: "#3fcf8e" },
          { label: T.price, value: usd(px.price[i]), color: "#fff" },
        ],
      };
    }
    if (view.id === "omega") {
      if (!omega) return null;
      return {
        ts: omega.ts, log: true, scatter: { vals: omega.price, score: omega.score },
        readout: i => {
          const z = omegaZone(omega.score[i]);
          return [
            { label: T.price, value: usd(omega.price[i]), color: "#fff" },
            { label: T.score, value: `${omega.score[i].toFixed(1)}%`, color: z.color },
            { label: "", value: z.label, color: z.color },
          ];
        },
      };
    }
    if (view.id === "fractal") {
      if (!fractal) return null;
      return {
        ts: fractal.ts, log: false,
        right: { vals: fractal.price, color: "#ffffff", log: true },
        bars: { vals: fractal.intensity, color: "#7c3aed" },
        readout: i => [
          { label: "INTENSITY", value: fractal.intensity[i].toFixed(1), color: "#a78bfa" },
          { label: T.price, value: usd(fractal.price[i]), color: "#fff" },
        ],
      };
    }
    if (!chain) return null;
    if (view.id === "mvrv") {
      const s = chain.mvrv;
      if (!s?.length) return null;
      const rp = new Map((chain.realisedPrice || []).map(([t, v]) => [t, v]));
      return {
        ts: s.map(p => p[0]), log: false,
        lines: [{ key: "mvrv", vals: s.map(p => p[1]), color: GOLD, w: 1.7 }],
        levels: [{ v: 1, label: "1 · COST BASIS", color: "#3fcf8e" }, { v: 2, label: "2", color: "#facc15" },
                 { v: 3, label: "3", color: "#fb923c" }, { v: 3.7, label: "EUPHORIA", color: "#ef4444" }],
        readout: i => [
          { label: "MVRV", value: s[i][1].toFixed(2), color: GOLD },
          { label: "NUPL", value: (1 - 1 / s[i][1]).toFixed(3), color: "#63b6ff" },
          { label: T.realised, value: usd(rp.get(s[i][0])), color: "#fb923c" },
        ],
      };
    }
    if (view.id === "mvrvz") {
      const s = chain.mvrvZ;
      if (!s?.length) return null;
      return {
        ts: s.map(p => p[0]), log: false,
        lines: [{ key: "z", vals: s.map(p => p[1]), color: "#63b6ff", w: 1.7 }],
        levels: [{ v: 0.1, label: "BOTTOM ZONE", color: "#22c55e" }, { v: 7, label: "TOP ZONE", color: "#ef4444" }],
        readout: i => [{ label: "MVRV-Z", value: s[i][1].toFixed(2), color: "#63b6ff" }],
      };
    }
    if (view.id === "puell") {
      const s = chain.puell;
      if (!s?.length) return null;
      return {
        ts: s.map(p => p[0]), log: true,
        lines: [{ key: "puell", vals: s.map(p => p[1]), color: "#facc15", w: 1.6 }],
        levels: [{ v: 0.5, label: "MINER CAPITULATION", color: "#22c55e" }, { v: 4, label: "DISTRIBUTION", color: "#ef4444" }],
        readout: i => [{ label: "PUELL", value: s[i][1].toFixed(2), color: "#facc15" }],
      };
    }
    if (view.id === "sopr" || view.id === "sthmvrv") {
      const s = view.id === "sopr" ? chain.sopr : chain.sthMvrv;
      if (!s?.length) return null;
      const isSopr = view.id === "sopr";
      return {
        ts: s.map(p => p[0]), log: false,
        lines: [{ key: view.id, vals: s.map(p => p[1]), color: isSopr ? "#63b6ff" : "#f0622e", w: 1.6 }],
        levels: [{ v: 1, label: isSopr ? "1 · BREAK-EVEN" : "1 · COST BASIS", color: "#8f8f8f" },
                 ...(isSopr ? [] : [{ v: 1.35, label: "OVERHEATED", color: "#ef4444" },
                                     { v: 0.85, label: "CAPITULATION", color: "#22c55e" }])],
        readout: i => [{ label: isSopr ? "SOPR" : "STH-MVRV", value: s[i][1].toFixed(3),
          color: isSopr ? "#63b6ff" : "#f0622e" }],
      };
    }
    if (view.id === "network") {
      const s = chain["hash-rate"];
      if (!s?.length) return null;
      const addr = new Map((chain["n-unique-addresses"] || []).map(([t, v]) => [t, v]));
      return {
        ts: s.map(p => p[0]), log: true,
        lines: [{ key: "hash", vals: s.map(p => p[1]), color: GOLD, w: 1.6 }],
        readout: i => [
          { label: "HASHRATE", value: compact(s[i][1], 0), color: GOLD },
          { label: T.addresses, value: compact(addr.get(s[i][0]), 0), color: "#63b6ff" },
        ],
      };
    }
    return null;
  }, [view, px, omega, fractal, chain, T]);

  // Sichtfenster + Achsenbereiche
  const vp = useMemo(() => {
    if (!model?.ts?.length) return null;
    const n = model.ts.length;
    const i0 = Math.max(0, Math.floor(win.a * n));
    const i1 = Math.min(n, Math.max(i0 + 3, Math.ceil(win.b * n)));
    const idx = [];
    for (let i = i0; i < i1; i++) idx.push(i);
    if (idx.length < 2) return null;

    const useLog = Boolean(model.log);
    let lo, hi;

    if (model.area) { lo = model.area.min; hi = model.area.max; }
    else {
      const vals = [];
      if (model.lines) model.lines.forEach(l => idx.forEach(i => { const v = l.vals[i]; if (Number.isFinite(v)) vals.push(v); }));
      if (model.scatter) idx.forEach(i => { const v = model.scatter.vals[i]; if (Number.isFinite(v)) vals.push(v); });
      if (model.bars) idx.forEach(i => { const v = model.bars.vals[i]; if (Number.isFinite(v)) vals.push(v); });
      const usable = vals.filter(v => !useLog || v > 0);
      if (!usable.length) return null;
      lo = Math.min(...usable); hi = Math.max(...usable);
      if (model.bars) lo = 0;
      if (useLog) { lo = Math.log10(Math.max(lo, 1e-12)); hi = Math.log10(hi); }
      const pad = (hi - lo) * 0.07 || Math.abs(hi) * 0.07 || 1;
      lo -= model.bars ? 0 : pad; hi += pad;
    }

    let rlo = 0, rhi = 1;
    if (model.right) {
      const rv = idx.map(i => model.right.vals[i]).filter(v => Number.isFinite(v) && v > 0);
      if (rv.length) {
        rlo = Math.min(...rv); rhi = Math.max(...rv);
        if (model.right.log) { rlo = Math.log10(rlo); rhi = Math.log10(rhi); }
        const rp = (rhi - rlo) * 0.08 || 1;
        rlo -= rp; rhi += rp;
      }
    }
    return { idx, lo, hi, useLog, rlo, rhi };
  }, [model, win]);

  const X = useCallback(k => (vp ? PADL + (k / Math.max(1, vp.idx.length - 1)) * plotW : 0), [vp]);
  const Y = useCallback(v => {
    if (!vp) return 0;
    const t = vp.useLog ? Math.log10(Math.max(v, 1e-12)) : v;
    return PADT + (1 - (t - vp.lo) / (vp.hi - vp.lo || 1)) * plotH;
  }, [vp]);
  const YR = useCallback(v => {
    if (!vp || !model?.right) return 0;
    const t = model.right.log ? Math.log10(Math.max(v, 1e-12)) : v;
    return PADT + (1 - (t - vp.rlo) / (vp.rhi - vp.rlo || 1)) * plotH;
  }, [vp, model]);

  // Wheel-Zoom auf den Cursor
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      setWin(w => {
        const span = w.b - w.a;
        const next = Math.min(1, Math.max(0.004, span * (e.deltaY < 0 ? 1 / 1.22 : 1.22)));
        const anchor = w.a + span * frac;
        let a = Math.min(1 - next, Math.max(0, anchor - next * frac));
        return { a, b: a + next };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onDown = e => { dragRef.current = { x: e.clientX, ...win }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = e => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (dragRef.current) {
      const d = dragRef.current;
      const span = d.b - d.a;
      const a = Math.min(1 - span, Math.max(0, d.a - ((e.clientX - d.x) / r.width) * span));
      setWin({ a, b: a + span });
      return;
    }
    if (!vp) return;
    const left = (PADL / W) * r.width;
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left - left) / (r.width * (plotW / W))));
    setHoverK(Math.round(frac * (vp.idx.length - 1)));
  };
  const onUp = () => { dragRef.current = null; };

  // Heatmap auf Canvas — SVG wäre bei zehntausenden Rechtecken zu langsam
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    if (view.id !== "heat" || !heat || !vp) return;
    const cols = vp.idx.map(i => heat[i]).filter(Boolean);
    if (!cols.length) return;
    const cw = plotW / cols.length;
    ctx.globalAlpha = 0.86;
    for (let k = 0; k < cols.length; k++) {
      const col = cols[k];
      const x = PADL + k * cw;
      for (let b = 0; b < col.hist.length; b++) {
        const w8 = col.hist[b] / col.max;
        if (w8 < 0.035) continue;
        const p0 = col.lo + b * col.step;
        const y1 = Y(p0 + col.step), y0 = Y(p0);
        ctx.fillStyle = magma(Math.pow(w8, 0.55));
        ctx.fillRect(x, y1, Math.max(1, cw + 0.6), Math.max(1, y0 - y1));
      }
    }
    ctx.globalAlpha = 1;
  }, [view, heat, vp, Y]);

  if (!model || !vp) {
    return (
      <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: F.mono, fontSize: 11, color: C.textMute, letterSpacing: "0.2em" }}>{T.noData}</div>
    );
  }

  const linePath = vals => vp.idx
    .map((i, k) => (Number.isFinite(vals[i]) ? `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(vals[i]).toFixed(1)}` : ""))
    .join("");

  const ticks = Array.from({ length: 6 }, (_, i) => {
    const t = vp.lo + ((vp.hi - vp.lo) * i) / 5;
    return { y: PADT + (1 - i / 5) * plotH, v: vp.useLog ? 10 ** t : t };
  });
  const rTicks = model.right ? Array.from({ length: 6 }, (_, i) => {
    const t = vp.rlo + ((vp.rhi - vp.rlo) * i) / 5;
    return { y: PADT + (1 - i / 5) * plotH, v: model.right.log ? 10 ** t : t };
  }) : [];

  const hoverI = hoverK != null && vp.idx[hoverK] != null ? vp.idx[hoverK] : null;
  const scatterStep = model.scatter ? Math.max(1, Math.round(vp.idx.length / 420)) : 1;

  return (
    <div style={{ position: "relative" }} className="vsx-chart">
      <canvas ref={canvasRef} width={W} height={H}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ position: "relative", width: "100%", display: "block", touchAction: "none",
          cursor: dragRef.current ? "grabbing" : "crosshair" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerLeave={() => { onUp(); setHoverK(null); }}>

        <defs>
          <linearGradient id="ocArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f8f5b" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#2f8f5b" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={`t${i}`}>
            <line x1={PADL} x2={PADL + plotW} y1={t.y} y2={t.y} stroke={C.lineSoft} strokeDasharray="2 5" />
            <text x={PADL - 9} y={t.y + 3.5} textAnchor="end" fill={C.textFaint} style={{ font: `500 9.5px ${F.mono}` }}>
              {model.pct ? `${t.v.toFixed(0)}%` : compact(t.v, 2)}
            </text>
          </g>
        ))}
        {rTicks.map((t, i) => (
          <text key={`r${i}`} x={PADL + plotW + 9} y={t.y + 3.5} fill={C.textFaint} style={{ font: `500 9.5px ${F.mono}` }}>
            {usd(t.v)}
          </text>
        ))}

        {model.levels?.map(l => {
          const y = Y(l.v);
          if (!(y > PADT && y < PADT + plotH)) return null;
          return (
            <g key={l.label}>
              <line x1={PADL} x2={PADL + plotW} y1={y} y2={y} stroke={l.color} strokeOpacity="0.4" strokeDasharray="5 5" />
              <text x={PADL + 8} y={y - 5} fill={l.color} opacity="0.8" style={{ font: `700 8px ${F.ui}`, letterSpacing: "0.18em" }}>{l.label}</text>
            </g>
          );
        })}

        {model.area && (
          <path fill="url(#ocArea)" stroke={model.area.color} strokeWidth="1"
            d={`${vp.idx.map((i, k) => `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(model.area.vals[i]).toFixed(1)}`).join("")}L${X(vp.idx.length - 1).toFixed(1)},${PADT + plotH}L${PADL},${PADT + plotH}Z`} />
        )}

        {model.bars && vp.idx.map((i, k) => {
          const v = model.bars.vals[i];
          if (!Number.isFinite(v)) return null;
          const y = Y(v);
          const bw = Math.max(0.7, plotW / vp.idx.length - 0.4);
          const hot = v > 26;
          return <rect key={`b${k}`} x={X(k) - bw / 2} y={y} width={bw} height={Math.max(0, PADT + plotH - y)}
            fill={hot ? "#c4b5fd" : model.bars.color} opacity={hot ? 0.95 : 0.7} />;
        })}

        {model.right && (
          <path fill="none" stroke={model.right.color} strokeWidth="1.2" strokeLinejoin="round"
            d={vp.idx.map((i, k) => `${k ? "L" : "M"}${X(k).toFixed(1)},${YR(model.right.vals[i]).toFixed(1)}`).join("")} />
        )}

        {model.lines?.map(l => (
          <path key={l.key} d={linePath(l.vals)} fill="none" stroke={l.color} strokeWidth={l.w}
            strokeDasharray={l.dash || undefined} strokeLinejoin="round" opacity={l.dash ? 0.75 : 1} />
        ))}

        {model.scatter && (
          <g>
            <path fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.9"
              d={vp.idx.map((i, k) => `${k ? "L" : "M"}${X(k).toFixed(1)},${Y(model.scatter.vals[i]).toFixed(1)}`).join("")} />
            {vp.idx.map((i, k) => (k % scatterStep ? null : (
              <circle key={`s${k}`} cx={X(k)} cy={Y(model.scatter.vals[i])} r={2.6}
                fill={heatColor(model.scatter.score[i])} />
            )))}
          </g>
        )}

        {hoverK != null && vp.idx[hoverK] != null && (
          <line x1={X(hoverK)} x2={X(hoverK)} y1={PADT} y2={PADT + plotH}
            stroke={C.goldDim} strokeWidth="0.8" strokeDasharray="3 4" />
        )}

        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const k = Math.round(f * (vp.idx.length - 1));
          return (
            <text key={`x${f}`} x={X(k)} y={H - 11} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
              fill={C.textFaint} style={{ font: `500 9px ${F.mono}`, letterSpacing: "0.1em" }}>
              {fmtDate(model.ts[vp.idx[k]])}
            </text>
          );
        })}
      </svg>

      {hoverI != null && (
        <div style={{ position: "absolute", top: 12, left: 80, display: "flex", alignItems: "center", gap: 16,
          background: "rgba(12,12,12,0.9)", border: `1px solid ${C.line}`, borderRadius: 9,
          padding: "8px 15px", backdropFilter: "blur(14px)", pointerEvents: "none", flexWrap: "wrap" }}>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.textMute }}>
            {new Date(model.ts[hoverI]).toLocaleDateString(lang === "en" ? "en-GB" : "de-DE")}
          </span>
          {model.readout(hoverI).map((r, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {r.label && <span style={{ ...overline(C.textFaint), fontSize: 7.5 }}>{r.label}</span>}
              <span style={{ fontFamily: F.mono, fontSize: 12, color: r.color }}>{r.value}</span>
            </span>
          ))}
        </div>
      )}

      <button onClick={() => setWin({ a: 0, b: 1 })}
        style={{ ...btnGhost(false), position: "absolute", top: 12, right: 12, padding: "6px 11px", fontSize: 8.5 }}>
        {T.reset}
      </button>

      <div style={{ position: "absolute", bottom: 8, right: 14, fontFamily: F.mono, fontSize: 9,
        color: C.textFaint, letterSpacing: "0.14em", pointerEvents: "none" }}>
        {T.hint}
      </div>
    </div>
  );
}

// ── MODUL ────────────────────────────────────────────────────────────────────
export default function OnChain({ lang = "de" }) {
  const T = T_[lang] || T_.de;
  const [coin, setCoin] = useState("BTC-USD");
  const [viewId, setViewId] = useState("heat");
  const [ohlc, setOhlc] = useState(null);
  const [raw, setRaw] = useState({});
  const [utxo, setUtxo] = useState({});     // echte Kohorten-Reihen von BGeometrics
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const view = viewById(viewId);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(""); setOhlc(null);
    apiFetch(`/api/history?symbols=${encodeURIComponent(coin)}&interval=1d&range=10y&ohlc=1`)
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then(json => {
        if (!alive) return;
        const s = json.data?.[coin];
        if (!s || s.length < 200) {
          throw new Error(lang === "en" ? `No usable history for ${coin}` : `Keine brauchbare Historie für ${coin}`);
        }
        setOhlc(s);
      })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [coin, lang]);

  useEffect(() => {
    let alive = true;
    if (!isBtc(coin)) return undefined;
    apiFetch("/api/onchain?metrics=mvrv,market-cap,total-bitcoins,miners-revenue,hash-rate,n-unique-addresses&timespan=all")
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j?.data) setRaw(j.data); })
      .catch(() => { /* Chain-Daten sind optional */ });
    return () => { alive = false; };
  }, [coin]);

  // UTXO-Level-Kohorten. Schlägt der Call fehl, bleiben die Proxies aktiv.
  useEffect(() => {
    let alive = true;
    if (!isBtc(coin)) { setUtxo({}); return undefined; }
    apiFetch("/api/onchain?action=utxo&metrics=sth-realized-price,lth-realized-price,supply-in-profit,sopr,sth-mvrv,realized-price")
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j?.data) setUtxo(j.data); })
      .catch(() => { /* Fallback auf Proxy */ });
    return () => { alive = false; };
  }, [coin]);

  useEffect(() => {
    let alive = true;
    if (!isBtc(coin)) { setSnap(null); return undefined; }
    const load = () => apiFetch("/api/onchain?action=snapshot")
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j?.snapshot) setSnap(j.snapshot); })
      .catch(() => { /* optional */ });
    load();
    const id = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, [coin]);

  // Echte STH-Reihen auf das Zeitraster der Kursreihe legen. Liegt für einen
  // Tag ein echter Wert vor, ersetzt er den Proxy — sonst bleibt der Proxy.
  const pxBase = useMemo(() => buildProxies(ohlc), [ohlc]);

  const realSth = utxo["sth-realized-price"];
  const realProfit = utxo["supply-in-profit"];

  const px = useMemo(() => {
    if (!pxBase) return null;
    if (!realSth?.length && !realProfit?.length) return { ...pxBase, real: false };
    const dayKey = t => new Date(t).toISOString().slice(0, 10);
    const sthMap = new Map((realSth || []).map(([t, v]) => [dayKey(t), v]));
    const prfMap = new Map((realProfit || []).map(([t, v]) => [dayKey(t), v]));

    let hitSth = 0, hitPrf = 0;
    const realised = pxBase.realised.slice();
    const upper = pxBase.upper.slice();
    const lower = pxBase.lower.slice();
    const profit = pxBase.profit.slice();

    pxBase.ts.forEach((t, i) => {
      const k = dayKey(t);
      const rv = sthMap.get(k);
      if (Number.isFinite(rv)) {
        // Bandbreite aus dem Proxy übernehmen, Mitte durch den echten Wert ersetzen
        const halfBand = pxBase.upper[i] - pxBase.realised[i];
        realised[i] = rv; upper[i] = rv + halfBand; lower[i] = rv - halfBand;
        hitSth++;
      }
      const pv = prfMap.get(k);
      if (Number.isFinite(pv)) { profit[i] = pv <= 1.5 ? pv * 100 : pv; hitPrf++; }
    });

    const cover = pxBase.ts.length || 1;
    return {
      ...pxBase, realised, upper, lower, profit,
      real: hitSth / cover > 0.5,
      realProfit: hitPrf / cover > 0.5,
    };
  }, [pxBase, realSth, realProfit]);
  const heat = useMemo(() => (viewId === "heat" ? buildHeat(ohlc) : null), [ohlc, viewId]);
  const omega = useMemo(() => buildOmega(px), [px]);
  const fractal = useMemo(() => buildFractal(ohlc), [ohlc]);

  // Realized Cap, Realized Price, MVRV-Z und Puell aus den freien Reihen ableiten
  const chain = useMemo(() => {
    const mvrv = raw.mvrv, cap = raw["market-cap"], supply = raw["total-bitcoins"], rev = raw["miners-revenue"];
    if (!mvrv?.length || !cap?.length) return null;
    const capByTs = new Map(cap.map(([t, v]) => [t, v]));
    const supByTs = supply ? new Map(supply.map(([t, v]) => [t, v])) : null;

    const realisedCap = [], realisedPrice = [], capSeries = [];
    for (const [t, m] of mvrv) {
      const c = capByTs.get(t);
      if (!Number.isFinite(c) || !Number.isFinite(m) || m <= 0) continue;
      const rc = c / m;
      realisedCap.push([t, rc]);
      capSeries.push([t, c]);
      const s = supByTs?.get(t);
      if (Number.isFinite(s) && s > 0) realisedPrice.push([t, rc / s]);
    }

    // MVRV-Z: (Market Cap − Realized Cap) / σ(Market Cap) über die ganze Historie
    const capVals = capSeries.map(p => p[1]);
    const mean = capVals.reduce((a, b) => a + b, 0) / (capVals.length || 1);
    const sd = Math.sqrt(capVals.reduce((a, b) => a + (b - mean) ** 2, 0) / (capVals.length || 1)) || 1;
    const mvrvZ = capSeries.map((p, i) => [p[0], (p[1] - realisedCap[i][1]) / sd]);

    // Puell: Miner-Tagesumsatz / eigener 365-Tage-Durchschnitt
    let puell = null;
    if (rev?.length > 400) {
      puell = align(rev, sma(rev, 365)).filter(r => r[2] > 0).map(([t, v, m]) => [t, v / m]);
    }

    return {
      mvrv, realisedCap, realisedPrice, mvrvZ, puell,
      sopr: utxo.sopr || null,
      sthMvrv: utxo["sth-mvrv"] || null,
      "hash-rate": raw["hash-rate"],
      "n-unique-addresses": raw["n-unique-addresses"],
    };
  }, [raw, utxo]);

  // Statuszeile im Kopf je Ansicht
  const status = useMemo(() => {
    if (viewId === "omega" && omega?.score?.length) {
      const v = omega.score[omega.score.length - 1];
      const z = omegaZone(v);
      return { value: `${v.toFixed(1)}%`, label: z.label, color: z.color };
    }
    if (viewId === "profit" && px?.profit?.length) {
      const v = px.profit[px.profit.length - 1];
      return { value: `${v.toFixed(1)}%`, label: T.profitLbl, color: v > 90 ? "#ef4444" : v < 10 ? "#22c55e" : C.textDim };
    }
    if ((viewId === "heat" || viewId === "realised") && px?.realised?.length) {
      const p = px.price[px.price.length - 1];
      const r = px.realised[px.realised.length - 1];
      return { value: usd(r), label: p > r ? T.above : T.below, color: p > r ? "#3fcf8e" : "#f0506e" };
    }
    if (viewId === "fractal" && fractal?.intensity?.length) {
      const v = fractal.intensity[fractal.intensity.length - 1];
      return { value: v.toFixed(1), label: "INTENSITY", color: v > 26 ? "#c4b5fd" : "#a78bfa" };
    }
    if (viewId === "mvrv" && chain?.mvrv?.length) {
      const v = chain.mvrv[chain.mvrv.length - 1][1];
      return { value: v.toFixed(2), label: `NUPL ${(1 - 1 / v).toFixed(2)}`, color: v > 3 ? "#ef4444" : v < 1 ? "#22c55e" : GOLD };
    }
    if (viewId === "mvrvz" && chain?.mvrvZ?.length) {
      const v = chain.mvrvZ[chain.mvrvZ.length - 1][1];
      return { value: v.toFixed(2), label: "MVRV-Z", color: v > 5 ? "#ef4444" : v < 0.5 ? "#22c55e" : "#63b6ff" };
    }
    if (viewId === "puell" && chain?.puell?.length) {
      const v = chain.puell[chain.puell.length - 1][1];
      return { value: v.toFixed(2), label: "PUELL", color: v > 3 ? "#ef4444" : v < 0.6 ? "#22c55e" : "#facc15" };
    }
    return null;
  }, [viewId, omega, px, fractal, chain, T]);

  // Eine Ansicht ist nur so lange PROXY, wie keine echten UTXO-Daten anliegen
  const kindOf = useCallback(v => {
    if (v.kind !== "proxy") return "exact";
    if (v.id === "profit") return px?.realProfit ? "live" : "proxy";
    if (v.id === "realised" || v.id === "heat") return px?.real ? "live" : "proxy";
    return "proxy";
  }, [px]);

  const kindBadge = k => k === "live" ? { text: T.live_, color: "#3fcf8e" }
    : k === "proxy" ? { text: T.proxy, color: "#fb923c" }
    : { text: T.exact, color: C.green };

  const glass = panel();
  const viewKind = kindOf(view);
  const blocked = (view.btcOnly && !isBtc(coin)) || (view.needsUtxo && !chain?.[view.id === "sopr" ? "sopr" : "sthMvrv"]);

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "calc(100vh - 76px)" }}>
      <Ambient tint="rgba(247,147,26,0.035)" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1880, margin: "0 auto", padding: "26px 34px 60px" }}>

        {/* KOPF */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div>
            <div style={{ ...overline(C.goldDim), marginBottom: 7 }}>VisionX Analytics</div>
            <div style={displayTitle(31)}>{T.title}</div>
          </div>
          {status && !blocked && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: F.mono, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: status.color, boxShadow: `0 0 9px ${status.color}` }} />
              <span style={{ color: C.goldLight, fontWeight: 700 }}>{status.value}</span>
              <span style={{ ...overline(status.color), fontSize: 9.5 }}>{status.label}</span>
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {COINS.map(c => (
              <button key={c.id} style={btnGhost(coin === c.id)} onClick={() => setCoin(c.id)}>{c.label}</button>
            ))}
            {loading && <span style={{ ...overline(GOLD), fontFamily: F.mono, fontSize: 10, marginLeft: 6 }}>{T.loading}…</span>}
          </div>
        </div>

        <div style={{ fontFamily: F.ui, fontSize: 11, color: C.goldDim, letterSpacing: "0.04em", marginBottom: 16 }}>
          {T.sub}
        </div>

        {error && (
          <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 16,
            fontFamily: F.mono, fontSize: 11, color: "#f87171" }}>{error}</div>
        )}

        {/* LIVE-SNAPSHOT */}
        {snap && (
          <div style={{ ...glass, padding: "14px 22px", marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, paddingRight: 26 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green,
                boxShadow: `0 0 8px ${C.green}`, animation: "vsxpulse 2.4s infinite" }} />
              <span style={overline(C.green)}>{T.live}</span>
            </div>
            {[
              { label: T.height, value: snap.blockHeight != null ? snap.blockHeight.toLocaleString("de-DE") : "—" },
              { label: "BTC/USD", value: snap.priceUsd != null ? `$${snap.priceUsd.toLocaleString("en-US")}` : "—" },
              { label: T.mempool, value: snap.mempoolTx != null ? `${compact(snap.mempoolTx, 0)} tx` : "—" },
              { label: T.fee, value: snap.feeFastest != null ? `${snap.feeFastest} sat/vB` : "—" },
              { label: T.diff, value: snap.diffChangePct != null ? `${snap.diffChangePct > 0 ? "+" : ""}${snap.diffChangePct.toFixed(2)}%` : "—",
                color: snap.diffChangePct == null ? C.text : snap.diffChangePct >= 0 ? C.green : C.red },
            ].map((k, i) => (
              <div key={k.label} style={{ padding: "0 26px", display: "flex", flexDirection: "column", gap: 6,
                borderLeft: i === 0 ? "none" : `1px solid ${C.lineSoft}` }}>
                <span style={overline()}>{k.label}</span>
                <span style={{ fontFamily: F.mono, fontSize: 16, color: k.color || C.text }}>{k.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ANSICHTS-TOGGLE */}
        <div style={{ ...glass, padding: "12px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
          {VIEWS.map(v => {
            const off = v.btcOnly && !isBtc(coin);
            return (
              <button key={v.id} onClick={() => setViewId(v.id)} disabled={off}
                style={{ ...btnGhost(viewId === v.id), opacity: off ? 0.35 : 1,
                  cursor: off ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                {v.label}
                {(() => {
                  const b = kindBadge(kindOf(v));
                  return (
                    <span style={{ fontFamily: F.mono, fontSize: 7, letterSpacing: "0.1em",
                      color: b.color, border: `1px solid ${b.color}55`, borderRadius: 4, padding: "1px 4px" }}>
                      {b.text}
                    </span>
                  );
                })()}
              </button>
            );
          })}
        </div>

        {/* CHART */}
        <div style={{ ...glass, padding: "12px 8px 4px", marginBottom: 16 }}>
          {blocked ? (
            <div style={{ height: 320, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center" }}>
              <span style={badge("#facc15")}>{T.btcOnly}</span>
              <span style={{ fontFamily: F.ui, fontSize: 11, color: C.textMute }}>{T.btcNote}</span>
              <button style={btnGhost(false)} onClick={() => setCoin("BTC-USD")}>→ BTC</button>
            </div>
          ) : (
            <Chart view={view} px={px} heat={heat} omega={omega} fractal={fractal}
              chain={chain} coin={coin} lang={lang} T={T} />
          )}
        </div>

        {/* BESCHREIBUNG */}
        <div style={{ ...glass, padding: "16px 22px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9, flexWrap: "wrap" }}>
            <span style={overline(C.goldDim)}>{view.label}</span>
            <span style={badge(kindBadge(viewKind).color)}>{kindBadge(viewKind).text}</span>
            {view.btcOnly && <span style={badge("#facc15")}>{T.btcOnly}</span>}
          </div>
          <div style={{ fontFamily: F.ui, fontSize: 11.5, color: C.textDim, lineHeight: 1.65, maxWidth: 900 }}>
            {lang === "en" ? view.en : view.de}
          </div>
          {viewKind === "proxy" && (
            <div style={{ marginTop: 10, fontFamily: F.mono, fontSize: 10, color: "#fb923c", opacity: 0.85 }}>
              {T.proxyWarn}
            </div>
          )}
          {viewKind === "live" && (
            <div style={{ marginTop: 10, fontFamily: F.mono, fontSize: 10, color: "#3fcf8e", opacity: 0.85 }}>
              {T.liveNote}
            </div>
          )}
        </div>

        <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.textFaint, letterSpacing: "0.1em" }}>
          {T.sources}: blockchain.info · mempool.space · bgeometrics · Binance
        </div>
      </div>
    </div>
  );
}
