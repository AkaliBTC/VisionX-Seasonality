import { useState, useEffect, useMemo, useRef } from "react";

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
function LineChart({ values, ts, color = GOLD, zeroLine = false, bands = null, height = 130, label, fmt = v => v.toFixed(0) }) {
  const W = 1000, H = height, PADL = 44, PADR = 12, PADT = 10, PADB = 18;
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
      style={{ width: "100%", display: "block" }}>
      {bands && bands.map((b, k) => (
        <g key={k}>
          <line x1={PADL} y1={Y(b)} x2={W - PADR} y2={Y(b)} stroke="rgba(255,255,255,0.09)" strokeDasharray="2 5" />
          <text x={PADL - 6} y={Y(b) + 3} textAnchor="end" fill="#4a4a4a" style={{ font: "500 8.5px 'DM Mono', monospace" }}>{b}</text>
        </g>
      ))}
      {zeroLine && <line x1={PADL} y1={Y(0)} x2={W - PADR} y2={Y(0)} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 5" />}
      {zeroLine && (
        <>
          <rect x={PADL} y={PADT} width={pw} height={Math.max(0, Y(0) - PADT)} fill="rgba(34,197,94,0.045)" />
          <rect x={PADL} y={Y(0)} width={pw} height={Math.max(0, H - PADB - Y(0))} fill="rgba(239,68,68,0.045)" />
        </>
      )}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 4px ${color}55)` }} />
      {!zeroLine && !bands && (
        <text x={PADL - 6} y={Y(vals[vals.length - 1]) + 3} textAnchor="end" fill="#4a4a4a" style={{ font: "500 8.5px 'DM Mono', monospace" }}>
          {fmt(vals[vals.length - 1])}
        </text>
      )}
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

// ── ÜBERSETZUNGEN ────────────────────────────────────────────────────────────
const T = {
  de: {
    title: "MARKET BREADTH",
    sub: "Marktbreite aus Einzelwerten berechnet · Advance/Decline · McClellan · Anteil über MA50/MA200 · neue Hochs/Tiefs",
    loading: "BERECHNE MARKTBREITE", universe: "TITEL IM UNIVERSUM",
    above200: "Über MA200", above50: "Über MA50", mcOsc: "McClellan Oszillator",
    mcSum: "McClellan Summation", adLine: "Advance/Decline-Linie", netHL: "Netto neue Hochs/Tiefs",
    advDec: "Advances / Declines", participation: "SEKTOR-BETEILIGUNG",
    partHint: "Anteil der Titel je Sektor über der 200-Tage-Linie",
    range: "ZEITRAUM", regime: "REGIME",
    hint200: "Unter 40 % gilt als Warnzone, unter 20 % als Kapitulationsbereich",
    hintOsc: "Über 0 = Breite verbessert sich · unter −50 = überverkauft · über +50 = überkauft",
    hintAd: "Steigt die Linie, während der Index fällt, spricht das für einen nahen Boden",
    footer: "Berechnet aus {n} Large Caps über alle elf Sektoren, nicht aus dem vollständigen S&P 500 — die Werte sind ein belastbarer Proxy, weichen aber leicht von offiziellen Indexdaten ab. McClellan als ratio-adjustierte Variante (Netto-Advances normiert), dadurch unabhängig von der Universumsgröße. Structural analysis — not investment advice.",
  },
  en: {
    title: "MARKET BREADTH",
    sub: "Breadth computed from constituents · Advance/Decline · McClellan · % above MA50/MA200 · new highs/lows",
    loading: "COMPUTING BREADTH", universe: "NAMES IN UNIVERSE",
    above200: "Above MA200", above50: "Above MA50", mcOsc: "McClellan Oscillator",
    mcSum: "McClellan Summation", adLine: "Advance/Decline Line", netHL: "Net New Highs/Lows",
    advDec: "Advances / Declines", participation: "SECTOR PARTICIPATION",
    partHint: "Share of names per sector above the 200-day line",
    range: "RANGE", regime: "REGIME",
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
  const cacheRef = useRef({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        for (let i = 0; i < ALL.length; i += 25) {
          const chunk = ALL.slice(i, i + 25);
          const res = await fetch(`/api/history?symbols=${chunk.join(",")}&interval=1d&range=2y`);
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

  const glass = {
    background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015) 55%, rgba(212,175,55,0.02))",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
    backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)",
    boxShadow: "0 14px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
  };
  const pill = (active) => ({
    padding: "7px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
    fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
    background: active ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(212,175,55,0.07))" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.08)"}`,
    color: active ? "#f8e49b" : "#777", transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
  });

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
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -220, right: "-6%", width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.06), transparent 62%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: -320, left: "-10%", width: 880, height: 880, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,182,255,0.035), transparent 62%)", filter: "blur(60px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1840, margin: "0 auto", padding: "22px 30px 50px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: "0.18em", color: "#fdfdfd" }}>{t.title}</div>
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
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#b99c64", letterSpacing: "0.04em", marginBottom: 16 }}>{t.sub}</div>

        {error && (
          <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 14, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>{error}</div>
        )}

        {!b && !error ? (
          <div style={{ ...glass, padding: 100, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.22em", color: "#3d3d3d" }}>
            {t.loading} {progress}%
          </div>
        ) : b && (
          <>
            {/* REGIME + KENNZAHLEN */}
            {R && (
              <div style={{ ...glass, padding: "16px 20px", marginBottom: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                <span style={{ width: 15, height: 15, borderRadius: "50%", background: R.color, boxShadow: `0 0 12px ${R.color}` }} />
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: "0.16em", color: R.color }}>{R[lang][0]}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#9a9a9a", flex: "1 1 320px", lineHeight: 1.6 }}>{R[lang][1]}</span>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              {stat(t.above200, pct200 == null ? "—" : `${pct200.toFixed(0)}%`, colFor(pct200, 40, 60), t.hint200)}
              {stat(t.above50, pct50 == null ? "—" : `${pct50.toFixed(0)}%`, colFor(pct50, 35, 60))}
              {stat(t.mcOsc, osc == null ? "—" : osc.toFixed(0), osc == null ? "#555" : osc > 0 ? "#22c55e" : "#ef4444", t.hintOsc)}
              {stat(t.mcSum, sum == null ? "—" : sum.toFixed(0), sum == null ? "#555" : sum > 0 ? "#22c55e" : "#ef4444")}
              {stat(t.netHL, netHL == null ? "—" : (netHL > 0 ? "+" : "") + netHL, netHL == null ? "#555" : netHL > 0 ? "#22c55e" : "#ef4444")}
            </div>

            {/* CHARTS */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
              <div style={{ ...glass, flex: "1 1 520px", padding: "14px 16px 8px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.18em", color: "#fdfdfd" }}>{t.above200}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#4a4a4a" }}>{t.hint200}</span>
                </div>
                <LineChart values={slice(b.pctMa200)} ts={slice(b.ts)} color="#63b6ff" bands={[20, 40, 60, 80]} fmt={v => `${v.toFixed(0)}%`} />
              </div>
              <div style={{ ...glass, flex: "1 1 520px", padding: "14px 16px 8px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.18em", color: "#fdfdfd" }}>{t.adLine}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#4a4a4a" }}>{t.hintAd}</span>
                </div>
                <LineChart values={slice(b.adLine)} ts={slice(b.ts)} color={GOLD} />
              </div>
              <div style={{ ...glass, flex: "1 1 520px", padding: "14px 16px 8px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.18em", color: "#fdfdfd" }}>{t.mcOsc}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#4a4a4a" }}>{t.hintOsc}</span>
                </div>
                <LineChart values={slice(b.mcOsc)} ts={slice(b.ts)} color="#f472b6" zeroLine />
              </div>
              <div style={{ ...glass, flex: "1 1 520px", padding: "14px 16px 8px" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.18em", color: "#fdfdfd", marginBottom: 4 }}>{t.netHL}</div>
                <LineChart values={slice(b.netNewHL)} ts={slice(b.ts)} color="#2dd4bf" zeroLine />
              </div>
            </div>

            {/* SEKTOR-BETEILIGUNG */}
            <div style={{ ...glass, padding: "18px 22px 16px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: "0.2em", color: "#fdfdfd" }}>{t.participation}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#4a4a4a" }}>{t.partHint}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 11 }}>
                {Object.entries(b.sectorPct)
                  .filter(([, v]) => v)
                  .sort((a, c) => c[1].pct - a[1].pct)
                  .map(([sec, v]) => (
                    <div key={sec} style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: `1px solid ${SECTOR_COLORS[sec]}30` }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", color: SECTOR_COLORS[sec] }}>{sec}</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#5a5a5a" }}>{SECTOR_NAMES[sec]}</span>
                        <span style={{ marginLeft: "auto", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: colFor(v.pct, 40, 60) }}>{v.pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ width: `${v.pct}%`, height: "100%", background: SECTOR_COLORS[sec], opacity: 0.85 }} />
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: "#4a4a4a", marginTop: 6 }}>{v.above} / {v.total}</div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: 16, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
          {t.footer.replace("{n}", b?.universe ?? ALL.length)}
        </div>
      </div>
    </div>
  );
}
