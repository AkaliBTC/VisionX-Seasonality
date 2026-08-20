import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "./access";
import { C, F, panel, overline, displayTitle, btnGhost, btnPrimary, badge, tableHead, GLOBAL_CSS, Ambient } from "./ui";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · MARKET BREADTH
//  Marktbreite aus den Einzelwerten berechnet, nicht aus fertigen Indizes:
//  Advance/Decline-Linie, McClellan (ratio-adjusted), Anteil über MA50/MA200,
//  neue 52W-Hochs/Tiefs und Sektor-Beteiligung.
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";

// ── UNIVERSUM: S&P-100-nahe Large Caps über alle 11 Sektoren ────────────────
const UNIVERSE = {
  XLK:  ["MSFT","AAPL","NVDA","AVGO","CRM","ORCL","AMD","ADBE","CSCO","ACN","INTC","TXN","QCOM","NOW","INTU","AMAT","MU","LRCX","ADI","KLAC"],
  XLF:  ["BRK-B","JPM","V","MA","BAC","WFC","GS","MS","SPGI","AXP","BLK","C","SCHW","CB","PGR","MMC","ICE","CME","AON","USB"],
  XLV:  ["LLY","UNH","JNJ","ABBV","MRK","TMO","ABT","AMGN","ISRG","PFE","DHR","BMY","GILD","CVS","MDT","VRTX","REGN","ZTS","BSX","SYK"],
  XLY:  ["AMZN","TSLA","HD","MCD","BKNG","LOW","TJX","NKE","SBUX","CMG","ORLY","MAR","GM","F","DHI","ROST","AZO","YUM","LEN","EBAY"],
  XLP:  ["PG","COST","WMT","KO","PEP","PM","MDLZ","MO","CL","TGT","KMB","GIS","STZ","SYY","KHC","HSY","K","ADM","DG","EL"],
  XLE:  ["XOM","CVX","COP","WMB","EOG","SLB","PSX","MPC","KMI","OKE","VLO","HAL","BKR","OXY","DVN","FANG","HES","TRGP","EQT","CTRA"],
  XLI:  ["GE","CAT","UBER","RTX","HON","UNP","ETN","BA","DE","LMT","ADP","UPS","CSX","NOC","EMR","GD","FDX","NSC","WM","ITW"],
  XLB:  ["LIN","SHW","APD","ECL","FCX","NEM","CTVA","DD","DOW","PPG","NUE","VMC","MLM","ALB","IFF","STLD","PKG","AMCR","CF","MOS"],
  XLRE: ["PLD","AMT","EQIX","WELL","SPG","PSA","O","CCI","DLR","VICI","EXR","AVB","IRM","SBAC","EQR","INVH","MAA","ESS","ARE","KIM"],
  XLU:  ["NEE","SO","DUK","CEG","SRE","AEP","D","PCG","EXC","XEL","ED","PEG","WEC","ES","AWK","DTE","PPL","FE","AEE","CMS"],
  XLC:  ["META","GOOGL","NFLX","DIS","CMCSA","T","VZ","TMUS","EA","WBD","OMC","TTWO","LYV","MTCH","NWSA","CHTR","PARA","FOXA","IPG","NWS"],
};
const ALL = [...new Set(Object.values(UNIVERSE).flat())];
const SECTOR_OF = {};
Object.entries(UNIVERSE).forEach(([s, arr]) => arr.forEach(t => { if (!SECTOR_OF[t]) SECTOR_OF[t] = s; }));

const SECTOR_COLORS = {
  XLK: "#63b6ff", XLF: "#22c55e", XLV: "#f472b6", XLY: "#a855f7",
  XLP: "#facc15", XLE: "#fb923c", XLI: "#94a3b8", XLB: "#2dd4bf",
  XLRE: "#e879f9", XLU: "#38bdf8", XLC: "#fb7185",
};
const SECTOR_NAMES = {
  XLK: "Technology", XLF: "Financials", XLV: "Health Care", XLY: "Cons. Discr.",
  XLP: "Cons. Staples", XLE: "Energy", XLI: "Industrials", XLB: "Materials",
  XLRE: "Real Estate", XLU: "Utilities", XLC: "Comm. Serv.",
};

// ── MATHEMATIK ───────────────────────────────────────────────────────────────
const ema = (arr, n) => {
  const k = 2 / (n + 1);
  let e = arr[0];
  const out = [e];
  for (let i = 1; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); out.push(e); }
  return out;
};

const smaAt = (arr, i, n) => {
  if (i < n - 1) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
};

// ── BREADTH-BERECHNUNG ───────────────────────────────────────────────────────
function computeBreadth(data) {
  const syms = ALL.filter(s => Array.isArray(data[s]) && data[s].length > 260);
  if (syms.length < 40) return null;

  // Gemeinsame Zeitachse (Schnittmenge der Handelstage)
  const key = t => new Date(t).toISOString().slice(0, 10);
  const counts = new Map();
  syms.forEach(s => new Set(data[s].map(([t]) => key(t))).forEach(k => counts.set(k, (counts.get(k) || 0) + 1)));
  const dates = [...counts.entries()].filter(([, c]) => c >= syms.length * 0.9).map(([k]) => k).sort();
  if (dates.length < 260) return null;

  // Kursmatrix je Symbol auf die gemeinsame Achse mappen (forward fill)
  const series = {};
  syms.forEach(s => {
    const m = new Map(data[s].map(([t, c]) => [key(t), c]));
    const arr = [];
    let last = null;
    dates.forEach(d => { if (m.has(d)) last = m.get(d); arr.push(last); });
    if (arr.every(v => v != null)) series[s] = arr;
  });
  const valid = Object.keys(series);
  if (valid.length < 40) return null;

  const n = dates.length;
  const adv = [], dec = [], pctMa50 = [], pctMa200 = [], newHigh = [], newLow = [], netNewHL = [];

  for (let i = 1; i < n; i++) {
    let a = 0, d = 0, above50 = 0, above200 = 0, cnt50 = 0, cnt200 = 0, nh = 0, nl = 0;
    for (const s of valid) {
      const arr = series[s];
      if (arr[i] > arr[i - 1]) a++; else if (arr[i] < arr[i - 1]) d++;

      const m50 = smaAt(arr, i, 50);
      if (m50 != null) { cnt50++; if (arr[i] > m50) above50++; }
      const m200 = smaAt(arr, i, 200);
      if (m200 != null) { cnt200++; if (arr[i] > m200) above200++; }

      if (i >= 252) {
        const win = arr.slice(i - 251, i + 1);
        const hi = Math.max(...win), lo = Math.min(...win);
        if (arr[i] >= hi) nh++;
        if (arr[i] <= lo) nl++;
      }
    }
    adv.push(a); dec.push(d);
    pctMa50.push(cnt50 ? (above50 / cnt50) * 100 : null);
    pctMa200.push(cnt200 ? (above200 / cnt200) * 100 : null);
    newHigh.push(nh); newLow.push(nl); netNewHL.push(nh - nl);
  }

  // Advance/Decline-Linie (kumulierte Netto-Advances)
  let cum = 0;
  const adLine = adv.map((a, i) => (cum += a - dec[i]));

  // Ratio-Adjusted Net Advances → McClellan (universumsgrößen-unabhängig)
  const rana = adv.map((a, i) => {
    const tot = a + dec[i];
    return tot > 0 ? ((a - dec[i]) / tot) * 1000 : 0;
  });
  const e19 = ema(rana, 19), e39 = ema(rana, 39);
  const mcOsc = rana.map((_, i) => e19[i] - e39[i]);
  let s2 = 0;
  const mcSum = mcOsc.map(v => (s2 += v));

  // Sektor-Beteiligung: Anteil über MA200 je Sektor
  const sectorPct = {};
  Object.entries(UNIVERSE).forEach(([sec, arr]) => {
    const members = arr.filter(t => series[t]);
    if (!members.length) return;
    let above = 0, cnt = 0;
    members.forEach(t => {
      const a = series[t];
      const m = smaAt(a, n - 1, 200);
      if (m != null) { cnt++; if (a[n - 1] > m) above++; }
    });
    sectorPct[sec] = cnt ? { pct: (above / cnt) * 100, above, total: cnt } : null;
  });

  const ts = dates.slice(1).map(d => new Date(d + "T00:00:00Z").getTime());
  return {
    ts, adLine, mcOsc, mcSum, pctMa50, pctMa200, newHigh, newLow, netNewHL,
    adv, dec, sectorPct, universe: valid.length,
  };
}

// ── REGIME-EINSCHÄTZUNG ──────────────────────────────────────────────────────
function regimeOf(b) {
  if (!b) return null;
  const last = a => a[a.length - 1];
  const p200 = last(b.pctMa200), osc = last(b.mcOsc), sum = last(b.mcSum);
  const adSlope = b.adLine.length > 21 ? last(b.adLine) - b.adLine[b.adLine.length - 22] : 0;
  const netHL = last(b.netNewHL);

  let score = 0;
  score += p200 >= 60 ? 2 : p200 >= 45 ? 1 : p200 >= 30 ? 0 : -2;
  score += osc > 25 ? 1 : osc > 0 ? 0.5 : osc > -25 ? -0.5 : -1;
  score += adSlope > 0 ? 1 : -1;
  score += netHL > 0 ? 1 : netHL < -20 ? -1 : 0;
  score += sum > 0 ? 0.5 : -0.5;

  if (score >= 3.5) return "strong";
  if (score >= 1) return "healthy";
  if (score >= -1) return "mixed";
  if (score >= -3) return "deteriorating";
  return "washout";
}

const REGIMES = {
  strong:        { color: "#22c55e", de: ["BREITE STÄRKE", "Breite Beteiligung über alle Sektoren. Rücksetzer sind in diesem Umfeld meist Kaufgelegenheiten."], en: ["BROAD STRENGTH", "Wide participation across sectors. Pullbacks in this regime are usually buying opportunities."] },
  healthy:       { color: "#84cc16", de: ["GESUND", "Mehrheit der Titel im Aufwärtstrend. Keine Warnsignale in der Breite."], en: ["HEALTHY", "Majority of names in uptrends. No warning signs in breadth."] },
  mixed:         { color: "#facc15", de: ["GEMISCHT", "Breite verengt sich. Index kann noch steigen, während die Mehrheit bereits abbaut — Selektivität erhöhen."], en: ["MIXED", "Breadth is narrowing. The index can still rise while the majority already deteriorates — increase selectivity."] },
  deteriorating: { color: "#fb923c", de: ["SCHWÄCHT AB", "Deutliche Verschlechterung. Historisch die Phase vor größeren Korrekturen."], en: ["DETERIORATING", "Clear deterioration. Historically the phase before larger corrections."] },
  washout:       { color: "#22c55e", de: ["WASHOUT", "Extrem negative Breite. Solche Werte markieren häufig Kapitulationstiefs — aber erst die Erholung der Breite bestätigt den Boden."], en: ["WASHOUT", "Extremely negative breadth. Such readings often mark capitulation lows — but only recovering breadth confirms the bottom."] },
};

// ── SPARKLINE / CHART ────────────────────────────────────────────────────────
function LineChart({ values, ts, color = GOLD, zeroLine = false, bands = null, height = 230, label, fmt = v => v.toFixed(0) }) {
  const W = 1000, H = height, PADL = 46, PADR = 14, PADT = 12, PADB = 22;
  const pw = W - PADL - PADR, ph = H - PADT - PADB;
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const vals = values.filter(v => v != null && isFinite(v));
  if (vals.length < 5) return null;

  let min = Math.min(...vals), max = Math.max(...vals);
  if (zeroLine) { const m = Math.max(Math.abs(min), Math.abs(max)); min = -m; max = m; }
  if (bands) { min = Math.min(min, ...bands); max = Math.max(max, ...bands); }
  const pad = (max - min) * 0.08 || 1;
  min -= pad; max += pad;

  const n = values.length;
  const X = i => PADL + (i / (n - 1)) * pw;
  const Y = v => PADT + (1 - (v - min) / (max - min)) * ph;

  let d = "";
  values.forEach((v, i) => { if (v != null && isFinite(v)) d += `${d ? "L" : "M"} ${X(i).toFixed(1)} ${Y(v).toFixed(1)} `; });

  const onMove = e => {
    const r = ref.current.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width * W - PADL) / pw * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      style={{ width: "100%", display: "block", userSelect: "none" }} className="vsx-chart">
      {bands && bands.map((b, k) => (
        <g key={k}>
          <line x1={PADL} y1={Y(b)} x2={W - PADR} y2={Y(b)} stroke="rgba(255,255,255,0.09)" strokeDasharray="2 5" />
          <text x={PADL - 6} y={Y(b) + 3} textAnchor="end" fill="#4a4a4a" style={{ font: "500 9.5px 'DM Mono', monospace" }}>{b}</text>
        </g>
      ))}
      {zeroLine && <line x1={PADL} y1={Y(0)} x2={W - PADR} y2={Y(0)} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 5" />}
      {zeroLine && (
        <>
          <rect x={PADL} y={PADT} width={pw} height={Math.max(0, Y(0) - PADT)} fill="rgba(34,197,94,0.045)" />
          <rect x={PADL} y={Y(0)} width={pw} height={Math.max(0, H - PADB - Y(0))} fill="rgba(239,68,68,0.045)" />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="1.7" style={{ filter: `drop-shadow(0 0 5px ${color}66)` }} />
      {!zeroLine && !bands && (
        <text x={PADL - 6} y={Y(vals[vals.length - 1]) + 3} textAnchor="end" fill="#4a4a4a" style={{ font: "500 8.5px 'DM Mono', monospace" }}>
          {fmt(vals[vals.length - 1])}
        </text>
      )}
      {/* Zeitmarken auf der X-Achse — bei voller Breite gut lesbar */}
      {(() => {
        const marks = [];
        const step = Math.max(1, Math.floor(n / 8));
        for (let i = step; i < n - step / 2; i += step) {
          marks.push(
            <g key={"x" + i}>
              <line x1={X(i)} y1={PADT} x2={X(i)} y2={H - PADB} stroke="rgba(255,255,255,0.028)" />
              <text x={X(i)} y={H - 6} textAnchor="middle" fill="#3f3f3f" style={{ font: "500 8.5px 'DM Mono', monospace" }}>
                {new Date(ts[i]).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
              </text>
            </g>
          );
        }
        return marks;
      })()}
      {label && <text x={PADL} y={PADT + 10} fill="#5a5a5a" style={{ font: "700 9px Montserrat, sans-serif", letterSpacing: "0.18em" }}>{label}</text>}
      {hover != null && values[hover] != null && (
        <g pointerEvents="none">
          <line x1={X(hover)} y1={PADT} x2={X(hover)} y2={H - PADB} stroke="rgba(212,175,55,0.3)" strokeDasharray="2 4" />
          <circle cx={X(hover)} cy={Y(values[hover])} r="3" fill={color} />
          <text x={X(hover) > W / 2 ? X(hover) - 8 : X(hover) + 8} y={PADT + 22}
            textAnchor={X(hover) > W / 2 ? "end" : "start"} fill="#f8e49b" style={{ font: "700 10px 'DM Mono', monospace" }}>
            {fmt(values[hover])}
          </text>
          <text x={X(hover) > W / 2 ? X(hover) - 8 : X(hover) + 8} y={PADT + 34}
            textAnchor={X(hover) > W / 2 ? "end" : "start"} fill="#5a5a5a" style={{ font: "500 8.5px 'DM Mono', monospace" }}>
            {new Date(ts[hover]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
          </text>
        </g>
      )}
    </svg>
  );
}


// ── ERKLÄRUNGEN (DE / EN) ────────────────────────────────────────────────────
const GLOSSARY = {
  pctMa200: {
    de: ["Anteil über der 200-Tage-Linie",
      "Wie viele Titel des Universums über ihrem 200-Tage-Durchschnitt notieren. Die wichtigste Beteiligungskennzahl überhaupt: Sie sagt, ob eine Indexbewegung breit getragen wird oder nur von wenigen Schwergewichten. Über 60 % gilt als gesund, unter 40 % als Warnzone, unter 20 % als Kapitulationsbereich. Fällt der Index auf ein neues Tief, während dieser Anteil steigt, ist das eine der verlässlichsten Bodendivergenzen."],
    en: ["Share above the 200-day line",
      "How many names in the universe trade above their 200-day average. The single most important participation metric: it tells you whether an index move is broadly carried or driven by a few heavyweights. Above 60% is healthy, below 40% a warning zone, below 20% capitulation territory. If the index makes a new low while this share rises, that is one of the most reliable bottoming divergences."] },
  pctMa50: {
    de: ["Anteil über der 50-Tage-Linie",
      "Dieselbe Logik wie MA200, nur kurzfristiger. Reagiert deutlich schneller und eignet sich zur Bestätigung: Dreht MA50 nach oben, während MA200 noch tief steht, beginnt eine Erholung. Bleibt MA50 tief, obwohl der Index steigt, trägt die Rally nicht."],
    en: ["Share above the 50-day line",
      "Same logic as MA200 but shorter term. It reacts much faster and works as confirmation: if MA50 turns up while MA200 is still low, a recovery is starting. If MA50 stays low while the index rises, the rally is not carried."] },
  mcOsc: {
    de: ["McClellan Oszillator",
      "Die Differenz zweier exponentieller Durchschnitte (19 und 39 Perioden) der Netto-Advances, also der Zahl steigender minus fallender Titel. Misst die Beschleunigung der Marktbreite. Über 0 verbessert sich die Breite, unter 0 verschlechtert sie sich. Werte unter −50 gelten als überverkauft, über +50 als überkauft. Wir nutzen die ratio-adjustierte Variante, die Netto-Advances auf die Universumsgröße normiert — dadurch bleiben die Schwellen unabhängig von der Titelanzahl vergleichbar."],
    en: ["McClellan Oscillator",
      "The difference between two exponential averages (19 and 39 periods) of net advances, meaning advancing minus declining names. It measures the acceleration of breadth. Above 0 breadth is improving, below 0 deteriorating. Readings below −50 count as oversold, above +50 as overbought. We use the ratio-adjusted variant that normalises net advances to universe size, so the thresholds stay comparable regardless of how many names are included."] },
  mcSum: {
    de: ["McClellan Summation Index",
      "Die laufende Summe des Oszillators — das langfristige Gegenstück. Während der Oszillator die Beschleunigung misst, zeigt der Summation Index den kumulierten Zustand der Marktbreite. Ein steigender Summation Index bei fallendem Index ist ein starkes bullisches Signal; ein fallender Summation Index bei steigendem Index warnt vor einer sich verengenden Rally."],
    en: ["McClellan Summation Index",
      "The running sum of the oscillator — its long-term counterpart. Where the oscillator measures acceleration, the summation index shows the cumulative state of breadth. A rising summation index while the index falls is a strong bullish signal; a falling summation index while the index rises warns of a narrowing rally."] },
  adLine: {
    de: ["Advance/Decline-Linie",
      "Die kumulierte Summe aus steigenden minus fallenden Titeln, Tag für Tag fortgeschrieben. Sie gewichtet jeden Titel gleich, unabhängig von der Marktkapitalisierung — deshalb entlarvt sie Rallys, die nur von wenigen Großkonzernen getragen werden. Die klassische Anwendung ist die Divergenz: Macht der Index neue Hochs, während die AD-Linie zurückbleibt, verliert der Aufwärtstrend seine Basis."],
    en: ["Advance/Decline Line",
      "The cumulative sum of advancing minus declining names, carried forward day by day. It weights every name equally regardless of market cap, which is why it exposes rallies carried by only a handful of mega caps. The classic use is divergence: if the index makes new highs while the AD line lags, the uptrend is losing its base."] },
  netHL: {
    de: ["Netto neue Hochs/Tiefs",
      "Die Zahl der Titel auf einem 52-Wochen-Hoch minus jener auf einem 52-Wochen-Tief. Der schnellste Frühindikator für Regimewechsel: Extreme Negativwerte markieren häufig Kapitulationstiefs, und der erste Umschwung ins Positive nach einer Abverkaufsphase ist historisch einer der frühesten Bodenhinweise überhaupt."],
    en: ["Net New Highs/Lows",
      "The number of names at a 52-week high minus those at a 52-week low. The fastest early indicator for regime change: extreme negative readings often mark capitulation lows, and the first flip back to positive after a selloff is historically one of the earliest bottom signals available."] },
  participation: {
    de: ["Sektor-Beteiligung",
      "Der Anteil der Titel je Sektor über der 200-Tage-Linie. Zeigt, wo die Stärke tatsächlich sitzt. Eine Rally, bei der nur ein oder zwei Sektoren über 60 % liegen, ist strukturell fragil; sind acht oder mehr Sektoren stark, ist der Aufwärtstrend breit fundiert. Für die Rotationsanalyse ist der Vergleich mit dem RRG-Modul aufschlussreich."],
    en: ["Sector participation",
      "The share of names per sector above the 200-day line. It shows where strength actually sits. A rally in which only one or two sectors exceed 60% is structurally fragile; if eight or more sectors are strong, the uptrend is broadly founded. Comparing this with the RRG module is instructive for rotation analysis."] },
  regime: {
    de: ["Breiten-Regime",
      "Eine Gesamteinschätzung aus fünf Faktoren: Anteil über MA200, McClellan Oszillator, Steigung der AD-Linie über einen Monat, Netto neue Hochs/Tiefs und Vorzeichen des Summation Index. Die Skala reicht von breiter Stärke über gesund, gemischt und abschwächend bis zum Washout. Das Regime ist ein Kontextfilter, kein Timing-Signal: Es sagt, in welchem Umfeld Einzelsignale zu bewerten sind."],
    en: ["Breadth regime",
      "An overall read from five factors: share above MA200, McClellan oscillator, one-month slope of the AD line, net new highs/lows and the sign of the summation index. The scale runs from broad strength through healthy, mixed and deteriorating to washout. The regime is a context filter, not a timing signal: it tells you in what environment individual signals should be judged."] },
};

// ── ÜBERSETZUNGEN ────────────────────────────────────────────────────────────
const T = {
  de: {
    title: "MARKET BREADTH",
    sub: "Marktbreite direkt aus den Einzelwerten berechnet",
    loading: "BERECHNE MARKTBREITE", universe: "TITEL IM UNIVERSUM",
    above200: "Über MA200", above50: "Über MA50", mcOsc: "McClellan Oszillator",
    mcSum: "McClellan Summation", adLine: "Advance/Decline-Linie", netHL: "Netto neue Hochs/Tiefs",
    advDec: "Advances / Declines", participation: "SEKTOR-BETEILIGUNG",
    partHint: "Anteil der Titel je Sektor über der 200-Tage-Linie",
    range: "ZEITRAUM", regime: "REGIME", explain: "Kennzahl anklicken für die Erklärung", close: "Schließen",
    hint200: "Unter 40 % gilt als Warnzone, unter 20 % als Kapitulationsbereich",
    hintOsc: "Über 0 = Breite verbessert sich · unter −50 = überverkauft · über +50 = überkauft",
    hintAd: "Steigt die Linie, während der Index fällt, spricht das für einen nahen Boden",
    footer: "Berechnet aus {n} Large Caps über alle elf Sektoren, nicht aus dem vollständigen S&P 500 — die Werte sind ein belastbarer Proxy, weichen aber leicht von offiziellen Indexdaten ab. McClellan als ratio-adjustierte Variante (Netto-Advances normiert), dadurch unabhängig von der Universumsgröße. Structural analysis — not investment advice.",
  },
  en: {
    title: "MARKET BREADTH",
    sub: "Breadth computed directly from the constituents",
    loading: "COMPUTING BREADTH", universe: "NAMES IN UNIVERSE",
    above200: "Above MA200", above50: "Above MA50", mcOsc: "McClellan Oscillator",
    mcSum: "McClellan Summation", adLine: "Advance/Decline Line", netHL: "Net New Highs/Lows",
    advDec: "Advances / Declines", participation: "SECTOR PARTICIPATION",
    partHint: "Share of names per sector above the 200-day line",
    range: "RANGE", regime: "REGIME", explain: "Click a metric for the explanation", close: "Close",
    hint200: "Below 40% is a warning zone, below 20% capitulation territory",
    hintOsc: "Above 0 = breadth improving · below −50 oversold · above +50 overbought",
    hintAd: "If the line rises while the index falls, that argues for a nearby bottom",
    footer: "Computed from {n} large caps across all eleven sectors, not the full S&P 500 — the readings are a solid proxy but differ slightly from official index data. McClellan uses the ratio-adjusted variant (normalised net advances), making it independent of universe size. Structural analysis — not investment advice.",
  },
};

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function Breadth({ lang = "de" }) {
  const t = T[lang] || T.de;
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [range, setRange] = useState(252);
  const [explain, setExplain] = useState(null);
  const cacheRef = useRef({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        for (let i = 0; i < ALL.length; i += 25) {
          const chunk = ALL.slice(i, i + 25);
          const res = await apiFetch(`/api/history?symbols=${chunk.join(",")}&interval=1d&range=2y`);
          if (!res.ok) throw new Error(`API ${res.status}`);
          const json = await res.json();
          if (!alive) return;
          Object.assign(cacheRef.current, json.data || {});
          setProgress(Math.min(100, Math.round(((i + 25) / ALL.length) * 100)));
          setData({ ...cacheRef.current });
        }
      } catch (e) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const b = useMemo(() => computeBreadth(data), [data]);
  const regime = useMemo(() => regimeOf(b), [b]);
  const R = regime ? REGIMES[regime] : null;

  const slice = arr => arr ? arr.slice(-range) : [];
  const last = arr => arr && arr.length ? arr[arr.length - 1] : null;

  const glass = panel();
  const pill = (active) => btnGhost(active);

  const pct200 = last(b?.pctMa200), pct50 = last(b?.pctMa50);
  const osc = last(b?.mcOsc), sum = last(b?.mcSum), netHL = last(b?.netNewHL);
  const colFor = (v, lo, hi) => v == null ? "#555" : v >= hi ? "#22c55e" : v >= lo ? "#facc15" : "#ef4444";

  const stat = (label, value, color, hint) => (
    <div style={{ flex: "1 1 170px", padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.025)", border: `1px solid ${color}33` }}>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", color: "#777", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 700, color }}>{value}</div>
      {hint && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#4a4a4a", marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "calc(100vh - 76px)" }}>
      <style>{`@keyframes vsxpulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }`}</style>
      <Ambient tint="rgba(99,182,255,0.03)" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1880, margin: "0 auto", padding: "26px 34px 60px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div><div style={{ ...overline(C.goldDim), marginBottom: 7 }}>VisionX Analytics</div>
          <div style={{ ...displayTitle(31) }}>{t.title}</div></div>
          {b && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>
              {b.universe} {t.universe}
            </div>
          )}
          {loading && (
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: GOLD, letterSpacing: "0.14em" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, boxShadow: `0 0 8px ${GOLD}`, animation: "vsxpulse 1s ease-in-out infinite" }} />
              {t.loading} {progress}%
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.16em", color: "#777", alignSelf: "center", marginRight: 4 }}>{t.range}</span>
            {[[63, "3M"], [126, "6M"], [252, "1Y"], [504, "2Y"]].map(([v, l]) => (
              <button key={v} style={pill(range === v)} onClick={() => setRange(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#b99c64", letterSpacing: "0.04em", marginBottom: 16 }}>{t.sub}<span style={{ marginLeft: 10, color: C.textFaint }}>ⓘ {t.explain}</span></div>

        {error && (
          <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 14, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>{error}</div>
        )}

        {!b && !error ? (
          <div style={{ ...glass, padding: 100, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.22em", color: "#3d3d3d" }}>
            {t.loading} {progress}%
          </div>
        ) : b && (
          <>
            {/* REGIME */}
            {R && (
              <div onClick={() => setExplain("regime")}
                style={{ ...glass, padding: "16px 22px", marginBottom: 14, display: "flex", flexWrap: "wrap",
                  alignItems: "center", gap: 15, cursor: "pointer", borderColor: `${R.color}33` }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: R.color, boxShadow: `0 0 13px ${R.color}` }} />
                <span style={{ fontFamily: F.display, fontSize: 21, letterSpacing: "0.16em", color: R.color }}>{R[lang][0]}</span>
                <span style={{ fontFamily: F.ui, fontSize: 11, color: C.textDim, flex: "1 1 340px", lineHeight: 1.6 }}>{R[lang][1]}</span>
                <span style={{ color: C.textFaint, fontSize: 10 }}>ⓘ</span>
              </div>
            )}

            {/* KENNZAHLEN — nur Werte, Erklärung per Klick */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              {[
                ["pctMa200", t.above200, pct200 == null ? "—" : `${pct200.toFixed(0)}%`, colFor(pct200, 40, 60)],
                ["pctMa50",  t.above50,  pct50 == null ? "—" : `${pct50.toFixed(0)}%`,  colFor(pct50, 35, 60)],
                ["mcOsc",    t.mcOsc,    osc == null ? "—" : osc.toFixed(0), osc == null ? C.textMute : osc > 0 ? C.green : C.red],
                ["mcSum",    t.mcSum,    sum == null ? "—" : sum.toFixed(0), sum == null ? C.textMute : sum > 0 ? C.green : C.red],
                ["netHL",    t.netHL,    netHL == null ? "—" : (netHL > 0 ? "+" : "") + netHL, netHL == null ? C.textMute : netHL > 0 ? C.green : C.red],
              ].map(([key, label, value, color]) => (
                <div key={key} onClick={() => setExplain(key)}
                  style={{ flex: "1 1 190px", padding: "15px 20px", borderRadius: 13, cursor: "pointer",
                    background: C.bgRaised, border: `1px solid ${color}2e`, transition: "border-color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = `${color}66`}
                  onMouseLeave={e => e.currentTarget.style.borderColor = `${color}2e`}>
                  <div style={{ ...overline(), marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}>
                    {label}<span style={{ color: C.textFaint, fontSize: 8 }}>ⓘ</span>
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 27, fontWeight: 500, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* CHARTS — zwei Spalten, volle Höhe */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 14 }}>
              {[
                ["pctMa200", t.above200, slice(b.pctMa200), C.blue, { bands: [20, 40, 60, 80], fmt: v => `${v.toFixed(0)}%` }],
                ["adLine",   t.adLine,   slice(b.adLine),   C.gold, {}],
                ["mcOsc",    t.mcOsc,    slice(b.mcOsc),    "#f472b6", { zeroLine: true }],
                ["netHL",    t.netHL,    slice(b.netNewHL), "#2dd4bf", { zeroLine: true }],
              ].map(([key, label, values, color, opts]) => (
                <div key={key} style={{ ...glass, padding: "18px 22px 12px" }}>
                  <div onClick={() => setExplain(key)}
                    style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
                    <span style={{ fontFamily: F.display, fontSize: 17, letterSpacing: "0.2em", color: "#fdfdfd" }}>{label}</span>
                    <span style={{ color: C.textFaint, fontSize: 9 }}>ⓘ</span>
                    <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 17, fontWeight: 500, color }}>
                      {(() => {
                        const v = values.filter(x => x != null && isFinite(x)).slice(-1)[0];
                        if (v == null) return "—";
                        return opts.fmt ? opts.fmt(v) : (v > 0 && opts.zeroLine ? "+" : "") + v.toFixed(0);
                      })()}
                    </span>
                  </div>
                  <LineChart values={values} ts={slice(b.ts)} color={color} height={190} {...opts} />
                </div>
              ))}
            </div>

            {/* SEKTOR-BETEILIGUNG */}
            <div style={{ ...glass, padding: "20px 22px 18px" }}>
              <div onClick={() => setExplain("participation")}
                style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }}>
                <span style={{ fontFamily: F.display, fontSize: 17, letterSpacing: "0.2em", color: "#fdfdfd" }}>{t.participation}</span>
                <span style={{ color: C.textFaint, fontSize: 9 }}>ⓘ</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                {Object.entries(b.sectorPct).filter(([, v]) => v).sort((a, c) => c[1].pct - a[1].pct).map(([sec, v]) => (
                  <div key={sec} style={{ padding: "13px 16px", borderRadius: 12, background: C.bgRaised, border: `1px solid ${SECTOR_COLORS[sec]}2e` }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 10 }}>
                      <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: SECTOR_COLORS[sec] }}>{sec}</span>
                      <span style={{ fontFamily: F.ui, fontSize: 9, color: C.textMute }}>{SECTOR_NAMES[sec]}</span>
                      <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 16, fontWeight: 600, color: colFor(v.pct, 40, 60) }}>{v.pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                      <div style={{ width: `${v.pct}%`, height: "100%", background: SECTOR_COLORS[sec], opacity: 0.85 }} />
                    </div>
                    <div style={{ fontFamily: F.mono, fontSize: 9, color: C.textFaint, marginTop: 8 }}>{v.above} / {v.total}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ERKLÄRUNGS-POPUP */}
        {explain && GLOSSARY[explain] && (
          <div onClick={() => setExplain(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ ...glass, background: "rgba(14,14,14,0.98)", maxWidth: 620, width: "100%", padding: "26px 30px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ ...overline(C.goldDim), marginBottom: 8 }}>VisionX Analytics</div>
                  <div style={{ fontFamily: F.display, fontSize: 23, letterSpacing: "0.12em", color: "#fdfdfd" }}>
                    {GLOSSARY[explain][lang][0]}
                  </div>
                </div>
                <button onClick={() => setExplain(null)} title={t.close}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: C.textFaint, cursor: "pointer", fontSize: 17 }}>✕</button>
              </div>
              <div style={{ fontFamily: F.ui, fontSize: 12, color: "#a8a8a8", lineHeight: 1.8 }}>
                {GLOSSARY[explain][lang][1]}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
          {t.footer.replace("{n}", b?.universe ?? ALL.length)}
        </div>
      </div>
    </div>
  );
}
