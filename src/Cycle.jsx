import React, { useState, useEffect } from "react";
import { C, F, panel, overline, displayTitle, btnGhost, btnPrimary, badge, tableHead, GLOBAL_CSS, Ambient } from "./ui";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · SPX SECTOR CYCLE
//  6-stage rotation matrix (best/worst performers per phase) with cycle wave,
//  example names per industry and a manually set, persisted current stage.
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";
const STAGE_STORAGE_KEY = "vsx_spx_cycle_stage_v1";

const STAGES = [
  {
    n: 1, title: "CYCLE TROUGH", titleDe: "ZYKLUS-TIEF",
    desc: "The bottom is in — recovery begins. Rate-sensitive consumer groups lead first.",
    descDe: "Der Boden ist drin — die Erholung beginnt. Zinssensitive Consumer-Gruppen führen zuerst.",
    best: [
      { name: "Home Building", t: "XHB" },
      { name: "Restaurants", t: "PEJ" },
      { name: "Department Stores", t: "XRT" },
    ],
    worst: [
      { name: "Diversified Metals", t: "XME" },
      { name: "Industry", t: "XLI" },
      { name: "Comm. Equipment", t: "XLC" },
    ],
  },
  {
    n: 2, title: "EARLY BULL", titleDe: "FRÜHER BULL",
    desc: "Financials and risk cyclicals accelerate — liquidity lifts the market broadly.",
    descDe: "Financials und Risk-Zykliker beschleunigen — Liquidität hebt den Markt breit an.",
    best: [
      { name: "Brokers", t: "IAI" },
      { name: "Automobiles", t: "CARZ" },
      { name: "Semiconductors", t: "SMH" },
    ],
    worst: [
      { name: "Copper / Gold", t: "COPX" },
      { name: "Oil Drillers", t: "OIH" },
      { name: "Energy", t: "XLE" },
    ],
  },
  {
    n: 3, title: "MID BULL", titleDe: "MITTLERER BULL",
    desc: "Tech, materials and energy take over leadership — the cycle runs hot.",
    descDe: "Tech, Materials und Energy übernehmen die Führung — der Zyklus läuft heiß.",
    best: [
      { name: "Comm. Equipment", t: "XLC" },
      { name: "Diversified Metals", t: "XME" },
      { name: "Energy", t: "XLE" },
    ],
    worst: [
      { name: "Leisure", t: "PEJ" },
      { name: "Airlines", t: "JETS" },
      { name: "Home Furnishing", t: "XRT" },
    ],
  },
  {
    n: 4, title: "LATE BULL", titleDe: "SPÄTER BULL",
    desc: "Inflation trades peak — hardware and gold shine while early cyclicals roll over.",
    descDe: "Inflations-Trades peaken — Hardware und Gold glänzen, Frühzykliker rollen ab.",
    best: [
      { name: "Oil Drillers", t: "OIH" },
      { name: "Computer Hardware", t: "IYW" },
      { name: "Gold Shares", t: "GDX" },
    ],
    worst: [
      { name: "Hotels", t: "PEJ" },
      { name: "Brokers", t: "IAI" },
      { name: "Home Building", t: "XHB" },
    ],
  },
  {
    n: 5, title: "TOP FORMS", titleDe: "TOPBILDUNG",
    desc: "Breadth narrows — defensives outperform while the index still holds up.",
    descDe: "Die Breite verengt sich — Defensives outperformt, während der Index noch hält.",
    best: [
      { name: "Health Care", t: "XLV" },
      { name: "Diversified Chemicals", t: "XLB" },
      { name: "Consumer Staples", t: "XLP" },
    ],
    worst: [
      { name: "General Merchandising", t: "RTH" },
      { name: "Automobiles", t: "CARZ" },
      { name: "Semiconductors", t: "SMH" },
    ],
  },
  {
    n: 6, title: "BEAR PHASE", titleDe: "BÄRENPHASE",
    desc: "Staples, insurance and food defend — deep cyclicals bleed into the low.",
    descDe: "Staples, Insurance und Food verteidigen — tiefe Zykliker bluten in den Boden.",
    best: [
      { name: "Household Products", t: "XLP" },
      { name: "Life Insurance", t: "IAK" },
      { name: "Food Products", t: "XLP" },
    ],
    worst: [
      { name: "Chemicals", t: "XLB" },
      { name: "Railroads", t: "IYT" },
      { name: "Steel Companies", t: "SLX" },
    ],
  },
];

// ── EXAMPLE NAMES per industry ───────────────────────────────────────────────
const EXAMPLES = {
  "Home Building":        ["DHI", "LEN", "TOL", "PHM"],
  "Restaurants":          ["MCD", "CMG", "SBUX", "DRI"],
  "Department Stores":    ["M", "KSS", "JWN", "DDS"],
  "Diversified Metals":   ["FCX", "TECK", "RIO", "BHP"],
  "Industry":             ["GE", "CAT", "HON", "ETN"],
  "Comm. Equipment":      ["CSCO", "ANET", "MSI", "META"],
  "Brokers":              ["GS", "MS", "SCHW", "IBKR"],
  "Automobiles":          ["TSLA", "GM", "F", "RACE"],
  "Semiconductors":       ["NVDA", "AMD", "AVGO", "TSM"],
  "Copper / Gold":        ["FCX", "SCCO", "NEM", "AEM"],
  "Oil Drillers":         ["RIG", "HAL", "SLB", "BKR"],
  "Energy":               ["XOM", "CVX", "COP", "EOG"],
  "Leisure":              ["RCL", "BKNG", "LVS", "DKNG"],
  "Airlines":             ["DAL", "UAL", "LUV", "AAL"],
  "Home Furnishing":      ["W", "RH", "WSM", "TPX"],
  "Computer Hardware":    ["AAPL", "DELL", "HPQ", "SMCI"],
  "Gold Shares":          ["NEM", "B", "AEM", "KGC"],
  "Hotels":               ["MAR", "HLT", "H", "WH"],
  "Health Care":          ["LLY", "UNH", "JNJ", "ABBV"],
  "Diversified Chemicals":["LIN", "DOW", "DD", "APD"],
  "Consumer Staples":     ["PG", "KO", "PEP", "COST"],
  "General Merchandising":["WMT", "TGT", "COST", "DG"],
  "Household Products":   ["PG", "CL", "CHD", "KMB"],
  "Life Insurance":       ["MET", "PRU", "AFL", "GL"],
  "Food Products":        ["GIS", "HSY", "MDLZ", "K"],
  "Chemicals":            ["DOW", "LYB", "DD", "EMN"],
  "Railroads":            ["UNP", "CSX", "NSC", "CP"],
  "Steel Companies":      ["NUE", "STLD", "X", "CLF"],
};

const loadStage = () => {
  try {
    const v = parseInt(localStorage.getItem(STAGE_STORAGE_KEY) || "", 10);
    if (v >= 1 && v <= 6) return v;
  } catch { /* default */ }
  return null;
};

// ── AUTO-DETECT · EW-Relative-Stärke vs SPY auf drei Zyklus-Zeitebenen ───────
const CYCLE_ETFS = [...new Set(STAGES.flatMap(s => [...s.best, ...s.worst].map(x => x.t)))];

const CYCLE_TFS = {
  daily:   { label: "DAILY CYCLE",   sub: "252D lookback · HL 63D",  lookback: 252, halflife: 63, resample: "d" },
  weekly:  { label: "WEEKLY CYCLE",  sub: "104W lookback · HL 26W",  lookback: 104, halflife: 26, resample: "w" },
  monthly: { label: "MONTHLY CYCLE", sub: "36M lookback · HL 12M",   lookback: 36,  halflife: 12, resample: "m" },
};

const resampleSeries = (series, mode) => {
  if (mode === "d") return series;
  const out = []; let curKey = null;
  for (const [t, c] of series) {
    const d = new Date(t);
    let key;
    if (mode === "w") {
      const day = (d.getUTCDay() + 6) % 7;
      const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - day);
      key = monday.toISOString().slice(0, 10);
    } else {
      key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    }
    if (key !== curKey) { out.push([t, c]); curKey = key; }
    else out[out.length - 1] = [t, c];
  }
  return out;
};

// EW-gewichtete RS-Returns vs SPY (annualisierungsfrei — Vergleich innerhalb der Zeitebene)
const ewRsTf = (seriesD, spyD, tf, shift = 0) => {
  if (!seriesD || !spyD) return null;
  const series = resampleSeries(seriesD, tf.resample);
  const spy = resampleSeries(spyD, tf.resample);
  const key = t => new Date(t).toISOString().slice(0, 10);
  const sMap = new Map(series.map(([t, c]) => [key(t), c]));
  const px = []; let last = null;
  for (const [t, b] of spy) {
    const k = key(t);
    if (sMap.has(k)) last = sMap.get(k);
    if (last != null) px.push([last, b]);
  }
  const end = px.length - shift;
  if (end < Math.min(tf.lookback, 12) + 2) return null;
  const win = px.slice(Math.max(0, end - (tf.lookback + 1)), end);
  const lam = Math.pow(0.5, 1 / tf.halflife);
  let num = 0, den = 0;
  for (let i = 1; i < win.length; i++) {
    const r = Math.log(win[i][0] / win[i - 1][0]) - Math.log(win[i][1] / win[i - 1][1]);
    const w = Math.pow(lam, win.length - 1 - i);
    num += w * r; den += w;
  }
  return den > 0 ? (num / den) * win.length : null;   // skaliert auf Fenster-Länge
};

const SPDRS = ["XLK","XLF","XLV","XLY","XLP","XLE","XLI","XLB","XLRE","XLU","XLC"];

const computeCycleScores = (data, tf, shift = 0) => {
  const spy = data.SPY;
  if (!spy) return null;
  const cache = {};
  const raw = t => {
    if (!(t in cache)) cache[t] = ewRsTf(data[t], spy, tf, shift);
    return cache[t];
  };
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const scores = STAGES.map(st => {
    const best = st.best.map(x => ({ ...x, v: raw(x.t) }));
    const worst = st.worst.map(x => ({ ...x, v: raw(x.t) }));
    const bv = best.map(p => p.v).filter(v => v != null);
    const wv = worst.map(p => p.v).filter(v => v != null);
    if (!bv.length || !wv.length) return { n: st.n, score: null, best, worst };
    return { n: st.n, score: avg(bv) - avg(wv), best, worst };
  });
  return scores.every(s => s.score == null) ? null : scores;
};

// ── CYCLE WAVE ───────────────────────────────────────────────────────────────
function CycleWave({ selected, current, auto }) {
  const pts = [];
  for (let x = 0; x <= 600; x += 4) {
    const y = 50 - 40 * Math.sin(((x - 40) / 600) * Math.PI * 2 - Math.PI / 2);
    pts.push(`${x === 0 ? "M" : "L"} ${x} ${y.toFixed(2)}`);
  }
  return (
    <svg viewBox="0 0 600 100" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}>
      <defs>
        <linearGradient id="cycle-wave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(212,175,55,0.25)" />
          <stop offset="50%" stopColor="rgba(212,175,55,0.85)" />
          <stop offset="100%" stopColor="rgba(212,175,55,0.25)" />
        </linearGradient>
      </defs>
      <path d={pts.join(" ")} fill="none" stroke="url(#cycle-wave)" strokeWidth="2.2"
        vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px rgba(212,175,55,0.5))" }} />
      {STAGES.map((s, i) => {
        const x = i * 100 + 50;
        const y = 50 - 40 * Math.sin(((x - 40) / 600) * Math.PI * 2 - Math.PI / 2);
        return (
          <g key={s.n}>
            <circle cx={x} cy={y} r={selected === s.n ? 5 : 3}
              fill={selected === s.n ? "#f8e49b" : GOLD} vectorEffect="non-scaling-stroke"
              style={{ filter: selected === s.n ? "drop-shadow(0 0 8px rgba(212,175,55,0.9))" : "none", transition: "all 0.25s" }} />
            {current === s.n && (
              <circle cx={x} cy={y} r={8} fill="none" stroke={GOLD} strokeWidth="1.2"
                vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px rgba(212,175,55,0.7))" }} />
            )}
            {auto === s.n && (
              <circle cx={x} cy={y} r={11} fill="none" stroke="#22c55e" strokeWidth="1.2"
                vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px rgba(34,197,94,0.65))" }} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── MAIN MODULE ──────────────────────────────────────────────────────────────
const CY_T = {
  de: {
    sub: "6-Stufen-Rotations-Framework · Beste & schwächste Performer je Zyklusphase · Stage oder Industrie anklicken für Beispiel-Titel",
    best: "Beste Performer", worst: "Schwächste Performer", clickEx: "· anklicken für Beispiel-Titel",
    stage: "Stage", current: "AKTUELLE STAGE", setCurrent: "ALS AKTUELL SETZEN", removeCurrent: "● AKTUELL — ENTFERNEN",
    badge: "● AKTUELL", manual: "MANUELL: STAGE", auto: "AUTO-ERKENNUNG:",
    badgeAuto: "● AUTO", badgeManual: "● MANUELL", whereAreWe: "WO STEHEN WIR?",
    prevWindow: "VORHERIGES FENSTER:", seqPick: "SEQUENZ-WAHL:",
    rawNote: "· roher Höchstwert Stage", rawNote2: "— gefiltert (Zyklen laufen 1→6, nicht querbeet)",
    spdrExtremes: "· SPDR EXTREMA", top: "TOP", lag: "SCHWACH", autoDetected: "● AUTOMATISCH ERKANNT",
    computing: "BERECHNE…", notEnough: "Zu wenige Daten für die Auto-Erkennung",
    method: "Stage-Score = aggregierte RS der 3 besten minus der 3 schwächsten Titel gegen SPY. Klick auf ▸ für die ETF-Aufschlüsselung.",
    footer: "SPX Cycle Framework · Auto-Erkennung über exponentiell gewichtete relative Stärke vs SPY je Stage-Korb (3 beste − 3 schwächste) auf Tages-, Wochen- und Monatsebene, sequenzgeprüft gegen das vorherige Fenster (Zyklen laufen 1→6). Strukturanalyse — keine Anlageberatung.",
  },
  en: {
    sub: "6-Stage Rotation Framework · Best & worst performers per cycle phase · Click a stage or industry for example names",
    best: "Best Performers", worst: "Worst Performers", clickEx: "· click for example names",
    stage: "Stage", current: "CURRENT STAGE", setCurrent: "SET AS CURRENT", removeCurrent: "● CURRENT — REMOVE",
    badge: "● CURRENT", manual: "MANUAL: STAGE", auto: "AUTO-DETECT:",
    badgeAuto: "● AUTO", badgeManual: "● MANUAL", whereAreWe: "WHERE ARE WE?",
    prevWindow: "PREV WINDOW:", seqPick: "SEQUENCE PICK:",
    rawNote: "· raw max Stage", rawNote2: "— filtered (cycles run 1→6, not sideways)",
    spdrExtremes: "· SPDR EXTREMES", top: "TOP", lag: "LAG", autoDetected: "● AUTO-DETECTED",
    computing: "COMPUTING…", notEnough: "Not enough data for auto-detect",
    method: "Stage score = aggregated RS of the 3 Best vs SPY minus aggregated RS of the 3 Worst vs SPY. Click ▸ for the ETF breakdown.",
    footer: "SPX Cycle Framework · Auto-detect: EW relative strength vs SPY per stage basket (3 Best − 3 Worst) on daily / weekly / monthly resolution, sequence-checked against the previous window (cycles run 1→6). Structural analysis — not investment advice.",
  },
};

export default function Cycle({ lang = "de" }) {
  const T = CY_T[lang] || CY_T.de;
  const stageTitle = s => (lang === "de" && s.titleDe) ? s.titleDe : s.title;
  const stageDesc = s => (lang === "de" && s.descDe) ? s.descDe : s.desc;
  const [selected, setSelected] = useState(loadStage() || 1);
  const [selInd, setSelInd] = useState(null);
  const [current, setCurrent] = useState(loadStage);
  const [hoverCol, setHoverCol] = useState(null);
  const [cycleTf, setCycleTf] = useState("weekly");
  const [rawData, setRawData] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [scoreError, setScoreError] = useState("");
  const [expandedScore, setExpandedScore] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/history?symbols=${[...new Set(["SPY", ...CYCLE_ETFS, ...SPDRS])].join(",")}&interval=1d&range=10y`)
      .then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json(); })
      .then(json => { if (alive) setRawData(json.data || {}); })
      .catch(e => alive && setScoreError(e.message))
      .finally(() => alive && setScoreLoading(false));
    return () => { alive = false; };
  }, []);

  const scores = React.useMemo(
    () => rawData ? computeCycleScores(rawData, CYCLE_TFS[cycleTf]) : null,
    [rawData, cycleTf]
  );
  // Fenster DAVOR (um volle Lookback-Länge zurückgeschoben) — für die Sequenz-Prüfung
  const scoresPrev = React.useMemo(
    () => rawData ? computeCycleScores(rawData, CYCLE_TFS[cycleTf], CYCLE_TFS[cycleTf].lookback) : null,
    [rawData, cycleTf]
  );
  const argmax = sc => {
    if (!sc) return null;
    const valid = sc.filter(s => s.score != null);
    return valid.length ? valid.reduce((a, b) => (b.score > a.score ? b : a)).n : null;
  };
  const rawTop = React.useMemo(() => argmax(scores), [scores]);
  const prevStage = React.useMemo(() => argmax(scoresPrev), [scoresPrev]);
  // Sequenz-Check: Zyklus läuft 1→6→1 — erlaubt ist Verbleib oder der nächste Schritt.
  const autoStage = React.useMemo(() => {
    if (!scores) return null;
    if (!prevStage) return rawTop;
    const nextStage = prevStage === 6 ? 1 : prevStage + 1;
    const sc = n => scores.find(s => s.n === n)?.score;
    const a = sc(prevStage), b = sc(nextStage);
    if (a == null && b == null) return rawTop;
    if (b == null) return prevStage;
    if (a == null) return nextStage;
    return b > a ? nextStage : prevStage;
  }, [scores, prevStage, rawTop]);
  const maxAbs = scores ? Math.max(1e-9, ...scores.map(s => Math.abs(s.score ?? 0))) : 1;

  // SPDR-Extrema (Top / Loser) je Zyklus-Ebene
  const extremes = React.useMemo(() => {
    if (!rawData) return null;
    const out = {};
    for (const [id, tf] of Object.entries(CYCLE_TFS)) {
      const vals = SPDRS.map(t => [t, ewRsTf(rawData[t], rawData.SPY, tf)]).filter(([, v]) => v != null);
      if (!vals.length) { out[id] = null; continue; }
      vals.sort((a, b) => a[1] - b[1]);
      out[id] = { low: { t: vals[0][0], v: vals[0][1] }, top: { t: vals[vals.length - 1][0], v: vals[vals.length - 1][1] } };
    }
    return out;
  }, [rawData]);

  useEffect(() => {
    try {
      if (current == null) localStorage.removeItem(STAGE_STORAGE_KEY);
      else localStorage.setItem(STAGE_STORAGE_KEY, String(current));
    } catch { /* private mode */ }
  }, [current]);

  const sel = STAGES.find(s => s.n === selected);

  const glass = panel();

  const cellBase = (col) => ({
    padding: "11px 10px", textAlign: "center", cursor: "pointer",
    borderLeft: "1px solid rgba(255,255,255,0.05)",
    background: selected === col ? "rgba(212,175,55,0.07)" : hoverCol === col ? "rgba(255,255,255,0.025)" : "transparent",
    transition: "background 0.2s",
  });

  const pickInd = (stageN, name) => { setSelected(stageN); setSelInd(name); };

  const indRow = (x, side) => {
    const active = selInd === x.name;
    const ex = EXAMPLES[x.name] || [];
    return (
      <div key={side + x.name + x.t}>
        <div onClick={() => setSelInd(active ? null : x.name)}
          style={{ display: "flex", justifyContent: "space-between", padding: "8px 2px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 11, cursor: "pointer", background: active ? "rgba(212,175,55,0.05)" : "transparent", borderRadius: 6, transition: "background 0.15s" }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", color: side === "best" ? "#dcdcdc" : "#9a9a9a" }}>
            <span style={{ color: active ? GOLD : "#4a4a4a", marginRight: 7, fontSize: 9 }}>{active ? "▾" : "▸"}</span>{x.name}
          </span>
          <span style={{ fontFamily: "'DM Mono', monospace", color: side === "best" ? "#f8e49b" : "#8a7440", letterSpacing: "0.08em" }}>${x.t}</span>
        </div>
        {active && ex.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 2px 10px 20px" }}>
            {ex.map(t => (
              <span key={t} style={{ padding: "3.5px 10px", borderRadius: 8, background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.28)", fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: "#f8e49b", letterSpacing: "0.06em" }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "calc(100vh - 76px)" }}>
      <Ambient tint="rgba(99,182,255,0.03)" />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1880, margin: "0 auto", padding: "26px 34px 60px" }}>
        {/* HEADER */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div><div style={{ ...overline(C.goldDim), marginBottom: 7 }}>VisionX Analytics</div>
          <div style={{ ...displayTitle(31) }}>
            SPX SECTOR CYCLE
          </div></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(CYCLE_TFS).map(([id, tf]) => (
              <button key={id} onClick={() => { setCycleTf(id); setExpandedScore(null); }} title={tf.sub}
                style={{ padding: "7px 15px", borderRadius: 10, cursor: "pointer",
                  background: cycleTf === id ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(212,175,55,0.07))" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${cycleTf === id ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.08)"}`,
                  color: cycleTf === id ? "#f8e49b" : "#777",
                  fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em",
                  transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                  boxShadow: cycleTf === id ? "0 0 16px rgba(212,175,55,0.12)" : "none" }}>
                {tf.label}
              </button>
            ))}
          </div>
          {autoStage && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 9px #22c55e" }} />
              <span style={{ color: "#c9c9c9" }}>{T.auto.replace("STAGE","")}{CYCLE_TFS[cycleTf].label}: STAGE <span style={{ color: "#f8e49b", fontWeight: 700 }}>{autoStage}</span></span>
              <span style={{ color: "#22c55e", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9.5, letterSpacing: "0.16em" }}>{STAGES[autoStage - 1].title}</span>
            </div>
          )}
          {current && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, boxShadow: `0 0 9px ${GOLD}` }} />
              <span style={{ color: "#c9c9c9" }}>{T.manual} <span style={{ color: "#f8e49b", fontWeight: 700 }}>{current}</span></span>
              <span style={{ color: "#b99c64", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9.5, letterSpacing: "0.16em" }}>{stageTitle(STAGES[current - 1])}</span>
            </div>
          )}
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#b99c64", letterSpacing: "0.04em", marginBottom: 18 }}>
          {T.sub}
        </div>

        {/* SPDR SECTOR EXTREMES je Zyklus-Ebene */}
        {extremes && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            {Object.entries(CYCLE_TFS).map(([id, tf]) => extremes[id] && (
              <div key={id} onClick={() => setCycleTf(id)}
                style={{ ...glass, flex: "1 1 280px", minWidth: 260, padding: "13px 18px 11px", cursor: "pointer",
                  borderColor: cycleTf === id ? "rgba(212,175,55,0.45)" : "rgba(255,255,255,0.08)",
                  boxShadow: cycleTf === id ? "0 0 22px rgba(212,175,55,0.1), inset 0 1px 0 rgba(255,255,255,0.06)" : glass.boxShadow }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", color: cycleTf === id ? "#f8e49b" : "#777", marginBottom: 9 }}>
                  {tf.label} <span style={{ color: "#4a4a4a", fontWeight: 600, letterSpacing: "0.08em" }}>{T.spdrExtremes}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 7.5, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.16em", color: "#22c55e" }}>{T.top}</span>
                    <span style={{ color: "#e8e8e8", fontWeight: 700 }}>{extremes[id].top.t}</span>
                    <span style={{ color: "#22c55e" }}>+{(extremes[id].top.v * 100).toFixed(1)}%</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 7.5, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.16em", color: "#ef4444" }}>{T.lag}</span>
                    <span style={{ color: "#9a9a9a", fontWeight: 700 }}>{extremes[id].low.t}</span>
                    <span style={{ color: "#ef4444" }}>{(extremes[id].low.v * 100).toFixed(1)}%</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MATRIX */}
        <div style={{ ...glass, padding: "6px 0 0", marginBottom: 18, overflow: "hidden" }}>
          <div style={{ position: "relative" }}>
            <div style={{ display: "grid", gridTemplateColumns: "150px repeat(6, 1fr)" }}>
              <div style={{ padding: "13px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "#555", textTransform: "uppercase" }}>{T.stage}</div>
              {STAGES.map(s => (
                <div key={"h" + s.n} onClick={() => { setSelected(s.n); setSelInd(null); }}
                  onMouseEnter={() => setHoverCol(s.n)} onMouseLeave={() => setHoverCol(null)}
                  style={{ ...cellBase(s.n), padding: "11px 8px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: "0.12em", color: selected === s.n ? "#f8e49b" : "#c9c9c9" }}>{s.n}</span>
                  <span style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 2 }}>
                    {autoStage === s.n && (
                      <span style={{ fontSize: 7, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.18em", color: "#22c55e" }}>{T.badgeAuto}</span>
                    )}
                    {current === s.n && (
                      <span style={{ fontSize: 7, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.18em", color: GOLD }}>{T.badgeManual}</span>
                    )}
                  </span>
                </div>
              ))}

              {[0, 1, 2].map(row => (
                <React.Fragment key={"best" + row}>
                  {row === 0 ? (
                    <div style={{ padding: "14px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#22c55e", textTransform: "uppercase", display: "flex", alignItems: "center" }}>
                      {T.best}
                    </div>
                  ) : <div />}
                  {STAGES.map(s => (
                    <div key={`b${row}-${s.n}`} onClick={() => pickInd(s.n, s.best[row].name)}
                      onMouseEnter={() => setHoverCol(s.n)} onMouseLeave={() => setHoverCol(null)}
                      style={{ ...cellBase(s.n), background: selInd === s.best[row].name && selected === s.n ? "rgba(212,175,55,0.12)" : cellBase(s.n).background }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10.5, color: "#dcdcdc", lineHeight: 1.35 }}>{s.best[row].name}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#f8e49b", letterSpacing: "0.08em", marginTop: 3 }}>${s.best[row].t}</div>
                    </div>
                  ))}
                </React.Fragment>
              ))}

              <div style={{ gridColumn: "1 / -1", height: 1, background: "rgba(255,255,255,0.08)" }} />

              {[0, 1, 2].map(row => (
                <React.Fragment key={"worst" + row}>
                  {row === 0 ? (
                    <div style={{ padding: "14px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#ef4444", textTransform: "uppercase", display: "flex", alignItems: "center" }}>
                      {T.worst}
                    </div>
                  ) : <div />}
                  {STAGES.map(s => (
                    <div key={`w${row}-${s.n}`} onClick={() => pickInd(s.n, s.worst[row].name)}
                      onMouseEnter={() => setHoverCol(s.n)} onMouseLeave={() => setHoverCol(null)}
                      style={{ ...cellBase(s.n), paddingBottom: row === 2 ? 16 : 11, background: selInd === s.worst[row].name && selected === s.n ? "rgba(212,175,55,0.12)" : cellBase(s.n).background }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10.5, color: "#9a9a9a", lineHeight: 1.35 }}>{s.worst[row].name}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#8a7440", letterSpacing: "0.08em", marginTop: 3 }}>${s.worst[row].t}</div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>

            <div style={{ position: "absolute", top: 0, bottom: 0, left: 150, right: 0, pointerEvents: "none" }}>
              <CycleWave selected={selected} current={current} auto={autoStage} />
            </div>
          </div>
        </div>

        {/* AUTO-DETECT + DETAIL */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <div style={{ ...glass, flex: "1 1 360px", minWidth: 330, padding: "18px 22px 16px", borderColor: "rgba(34,197,94,0.3)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: "0.18em", color: "#fdfdfd" }}>{T.whereAreWe}</span>
              <span style={{ fontSize: 8, color: "#4a4a4a", letterSpacing: "0.14em", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>EW-RS vs SPY · BEST − WORST</span>
            </div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#666", marginBottom: 10, lineHeight: 1.6 }}>
              {CYCLE_TFS[cycleTf].sub} · exponentially weighted · aggregated RS of the 3 Best minus the 3 Worst vs SPY. Click ▸ for the ETF breakdown.
            </div>
            {prevStage && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: "0.05em" }}>
                <span style={{ color: "#666" }}>{T.prevWindow}</span>
                <span style={{ color: "#c9c9c9", fontWeight: 700 }}>Stage {prevStage}</span>
                <span style={{ color: "#4a4a4a" }}>→</span>
                <span style={{ color: "#666" }}>{T.seqPick}</span>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>Stage {autoStage}</span>
                {rawTop != null && rawTop !== autoStage && (
                  <span style={{ color: "#b99c64", fontSize: 8.5 }}>{T.rawNote} {rawTop} {T.rawNote2}</span>
                )}
              </div>
            )}
            {scoreLoading ? (
              <div style={{ padding: "24px 0", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.2em", color: "#3d3d3d" }}>{T.computing}</div>
            ) : scoreError ? (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#f87171" }}>{scoreError}</div>
            ) : scores && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {scores.map(sc => {
                  const st = STAGES[sc.n - 1];
                  const isTop = sc.n === autoStage;
                  const isOpen = expandedScore === sc.n;
                  const w = sc.score == null ? 0 : (Math.abs(sc.score) / maxAbs) * 100;
                  const pos = (sc.score ?? 0) >= 0;
                  const chip = (p, side) => (
                    <span key={side + p.t + p.name} title={p.name}
                      style={{ padding: "3px 8px", borderRadius: 7, fontFamily: "'DM Mono', monospace", fontSize: 8.5,
                        background: "rgba(255,255,255,0.03)", border: `1px solid ${side === "b" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.22)"}`,
                        color: p.v == null ? "#555" : p.v >= 0 ? "#22c55e" : "#ef4444" }}>
                      {p.t} {p.v == null ? "—" : `${p.v >= 0 ? "+" : ""}${(p.v * 100).toFixed(0)}%`}
                    </span>
                  );
                  return (
                    <div key={sc.n}>
                      <div onClick={() => { setSelected(sc.n); setSelInd(null); }}
                        style={{ display: "grid", gridTemplateColumns: "14px 16px 88px 1fr 52px", alignItems: "center", gap: 8, cursor: "pointer", padding: "5px 8px", borderRadius: 9, background: isTop ? "rgba(34,197,94,0.06)" : selected === sc.n ? "rgba(212,175,55,0.05)" : "transparent", transition: "background 0.15s" }}>
                        <span onClick={e => { e.stopPropagation(); setExpandedScore(o => o === sc.n ? null : sc.n); }}
                          style={{ color: isOpen ? GOLD : "#4a4a4a", fontSize: 9, cursor: "pointer", userSelect: "none" }}>{isOpen ? "▾" : "▸"}</span>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: isTop ? "#22c55e" : "#c9c9c9" }}>{sc.n}</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: isTop ? "#22c55e" : "#777" }}>
                          {st.title}{isTop && " ●"}
                        </span>
                        <div style={{ height: 7, borderRadius: 4, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                          <div style={{ width: `${w}%`, height: "100%", borderRadius: 4, background: pos ? (isTop ? "linear-gradient(90deg, #22c55e88, #22c55e)" : "rgba(34,197,94,0.45)") : "rgba(239,68,68,0.5)", transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textAlign: "right", color: sc.score == null ? "#555" : sc.score >= 0 ? "#22c55e" : "#ef4444" }}>
                          {sc.score == null ? "—" : `${sc.score >= 0 ? "+" : ""}${(sc.score * 100).toFixed(1)}%`}
                        </span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: "5px 8px 9px 38px", display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                            <span style={{ fontSize: 7, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.16em", color: "#22c55e", width: 36 }}>BEST</span>
                            {sc.best.map(p => chip(p, "b"))}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                            <span style={{ fontSize: 7, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.16em", color: "#ef4444", width: 36 }}>WORST</span>
                            {sc.worst.map(p => chip(p, "w"))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        {/* DETAIL */}
        {sel && (
          <div style={{ ...glass, flex: "2 1 560px", padding: "20px 24px 18px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 23, letterSpacing: "0.14em", color: "#fdfdfd" }}>
                STAGE {sel.n} <span style={{ color: GOLD }}>·</span> {stageTitle(sel)}
              </span>
              {autoStage === sel.n && (
                <span style={{ fontSize: 8.5, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.16em", color: "#22c55e" }}>{T.autoDetected} ({CYCLE_TFS[cycleTf].label})</span>
              )}
              {current === sel.n ? (
                <button onClick={() => setCurrent(null)}
                  style={{ padding: "6px 14px", borderRadius: 9, cursor: "pointer", background: "rgba(212,175,55,0.13)", border: "1px solid rgba(212,175,55,0.5)", color: "#f8e49b", fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em" }}>{T.removeCurrent}</button>
              ) : (
                <button onClick={() => setCurrent(sel.n)}
                  style={{ padding: "6px 14px", borderRadius: 9, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.3)", color: "#b99c64", fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.6)"; e.currentTarget.style.color = "#f8e49b"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.3)"; e.currentTarget.style.color = "#b99c64"; }}>{T.setCurrent}</button>
              )}
            </div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: "#8f8f8f", lineHeight: 1.7, marginBottom: 16 }}>
              {stageDesc(sel)}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "#22c55e", marginBottom: 8 }}>{T.best.toUpperCase()} <span style={{ color: "#4a4a4a", fontWeight: 600, letterSpacing: "0.06em", textTransform: "none" }}>{T.clickEx}</span></div>
                {sel.best.map(x => indRow(x, "best"))}
              </div>
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "#ef4444", marginBottom: 8 }}>{T.worst.toUpperCase()}</div>
                {sel.worst.map(x => indRow(x, "worst"))}
              </div>
            </div>
          </div>
        )}
        </div>

        <div style={{ marginTop: 16, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
          SPX Cycle Framework · Auto-detect: EW relative strength vs SPY per stage basket (3 Best − 3 Worst) on daily / weekly / monthly resolution, sequence-checked against the previous window (cycles run 1→6). Structural analysis — not investment advice.
        </div>
      </div>
    </div>
  );
}
