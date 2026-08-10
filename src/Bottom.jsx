import { useState, useEffect, useMemo, useRef } from "react";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · BOTTOM RADAR
//  Screening auf Kapitulation und Erschöpfung statt auf Stärke.
//  Sechs unabhängige Washout-Signale je Titel, verdichtet zu einem
//  Capitulation Score (0–100) und einer Phasen-Einordnung.
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";
const STORAGE_KEY = "vsx_bottom_list_v1";

const PRESETS = {
  "SPDR SECTORS": ["XLK","XLF","XLV","XLY","XLP","XLE","XLI","XLB","XLRE","XLU","XLC"],
  "VSX EQUITIES": ["NVDA","AMD","MSFT","META","AMZN","TSLA","PLTR","HIMS","MRNA","ILMN","BABA","LULU","INTC","RGTI","QBTS","ASTS"],
  "CRYPTO": ["BTC-USD","ETH-USD","SOL-USD","LINK-USD","XRP-USD","DOGE-USD","AVAX-USD","DOT-USD"],
  "COMMODITIES": ["GLD","SLV","GDX","USO","UNG","DBA","CPER","URA","LIT","WEAT","CORN","SGG"],
};

const loadList = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a; }
  } catch { /* default */ }
  return [...PRESETS["SPDR SECTORS"]];
};

// ── INDIKATOREN ──────────────────────────────────────────────────────────────
// Wilder-RSI (VisionX-Standard: Periode 9)
const rsi = (closes, period = 9) => {
  if (closes.length < period + 2) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  g /= period; l /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    g = (g * (period - 1) + (d > 0 ? d : 0)) / period;
    l = (l * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (l === 0) return 100;
  return 100 - 100 / (1 + g / l);
};

const sma = (a, n) => a.length < n ? null : a.slice(-n).reduce((x, y) => x + y, 0) / n;

const stdev = (a) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
};

// Bewertet ein Signal auf 0..100 Punkte (100 = maximale Kapitulation)
const band = (v, none, full) => {
  if (v == null || !isFinite(v)) return null;
  const t = (v - none) / (full - none);
  return Math.max(0, Math.min(100, t * 100));
};

// ── ANALYSE JE TITEL ─────────────────────────────────────────────────────────
function analyse(candles) {
  if (!candles || candles.length < 220) return null;
  const closes = candles.map(c => c[4]);
  const lows = candles.map(c => c[3]);
  const highs = candles.map(c => c[2]);
  const vols = candles.map(c => c[5] || 0);
  const px = closes[closes.length - 1];

  // 1) Drawdown vom 52-Wochen-Hoch
  const win252 = closes.slice(-252);
  const high52 = Math.max(...highs.slice(-252));
  const low52 = Math.min(...lows.slice(-252));
  const drawdown = high52 > 0 ? px / high52 - 1 : null;

  // 2) RSI-9 (täglich) — VisionX-Signatur
  const r9 = rsi(closes.slice(-120), 9);

  // 3) Abstand zur 200-Tage-Linie
  const ma200 = sma(closes, 200);
  const distMa = ma200 ? px / ma200 - 1 : null;

  // 4) Volumen-Klimax: aktuelles Volumen vs. 20-Tage-Schnitt
  const v20 = sma(vols.slice(-21, -1), 20);
  const volSpike = v20 > 0 ? vols[vols.length - 1] / v20 : null;

  // 5) Statistische Überdehnung: z-Score des Kurses zum 20-Tage-Mittel
  const c20 = closes.slice(-20);
  const m20 = sma(closes, 20), sd20 = stdev(c20);
  const zScore = sd20 > 0 ? (px - m20) / sd20 : null;

  // 6) Position in der 52-Wochen-Spanne (0 = Jahrestief)
  const range = high52 - low52;
  const rangePos = range > 0 ? (px - low52) / range : null;

  // Rote Kerzen in Folge
  let streak = 0;
  for (let i = closes.length - 1; i > 0; i--) {
    if (closes[i] < closes[i - 1]) streak++; else break;
  }

  // Signal-Scores (100 = maximaler Washout)
  const sig = {
    drawdown: band(drawdown, -0.05, -0.45),
    rsi:      band(r9, 45, 18),
    distMa:   band(distMa, 0.02, -0.25),
    volume:   band(volSpike, 1.1, 3.0),
    zScore:   band(zScore, -0.5, -2.6),
    range:    band(rangePos, 0.5, 0.03),
  };

  const vals = Object.values(sig).filter(v => v != null);
  const score = vals.length >= 4 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;

  // 5-Tage-Trend des Scores wäre teuer — stattdessen Stabilisierungs-Hinweis:
  // Kurs über dem Tief der letzten 5 Tage und RSI dreht aus dem Extrem.
  const last5Low = Math.min(...lows.slice(-5));
  const turning = r9 != null && r9 > 25 && px > last5Low * 1.01 && sig.drawdown > 40;

  return {
    px, drawdown, rsi9: r9, distMa, volSpike, zScore, rangePos, streak,
    high52, low52, sig, score, turning,
  };
}

// ── PHASEN ───────────────────────────────────────────────────────────────────
const PHASES = [
  { min: 78, id: "capitulation", color: "#22c55e",
    de: { label: "KAPITULATION", desc: "Maximaler Washout — historisch die besten Einstiegszonen, aber Messerfang-Risiko. In Tranchen." },
    en: { label: "CAPITULATION", desc: "Maximum washout — historically the best entry zones, but knife-catching risk. Scale in tranches." } },
  { min: 60, id: "washout", color: "#84cc16",
    de: { label: "AUSVERKAUF", desc: "Deutlich überverkauft. Watchlist scharf stellen, erste Tranche vorbereiten." },
    en: { label: "WASHOUT", desc: "Clearly oversold. Sharpen the watchlist, prepare the first tranche." } },
  { min: 42, id: "pressure", color: "#facc15",
    de: { label: "DRUCK", desc: "Korrektur läuft, noch keine Erschöpfung. Beobachten, nicht greifen." },
    en: { label: "PRESSURE", desc: "Correction underway, no exhaustion yet. Watch, don't reach." } },
  { min: 22, id: "neutral", color: "#94a3b8",
    de: { label: "NEUTRAL", desc: "Kein Bottom-Setup. Normale Marktlage." },
    en: { label: "NEUTRAL", desc: "No bottom setup. Normal market conditions." } },
  { min: 0, id: "extended", color: "#ef4444",
    de: { label: "ÜBERDEHNT", desc: "Nahe Hoch, keine Schwäche. Für Bottom-Picking uninteressant." },
    en: { label: "EXTENDED", desc: "Near highs, no weakness. Irrelevant for bottom picking." } },
];

const phaseFor = (s) => s == null ? null : PHASES.find(p => s >= p.min) || PHASES[PHASES.length - 1];

// ── ÜBERSETZUNGEN ────────────────────────────────────────────────────────────
const T = {
  de: {
    title: "BOTTOM RADAR", sub: "Kapitulations-Screening · RSI-9 · Drawdown · Volumenklimax · MA-Abstand",
    add: "+ HINZU", clear: "Leeren", researching: "LADE", symbols: "TITEL",
    score: "Score", phase: "Phase", price: "Kurs", dd: "Drawdown", rsi: "RSI-9",
    ma: "vs MA200", vol: "Vol-Spike", z: "Z-Score", pos: "52W-Pos", streak: "Rote Tage",
    signals: "SIGNALE", summary: "RESÜMEE", turning: "STABILISIERT",
    sigNames: { drawdown: "Drawdown vom Hoch", rsi: "RSI-9 überverkauft", distMa: "Abstand zur MA200",
      volume: "Volumen-Klimax", zScore: "Statistische Überdehnung", range: "Position 52W-Spanne" },
    notFound: "NICHT GEFUNDEN", hint: "Yahoo-Schreibweise prüfen (z.B. BAS.DE, BTC-USD)",
    footer: "Capitulation Score = Mittel aus sechs unabhängigen Washout-Signalen (0–100). Kein Kaufsignal, sondern eine Rangfolge der Erschöpfung. Ein tiefer Score ersetzt weder Struktur- noch Fundamentalanalyse.",
  },
  en: {
    title: "BOTTOM RADAR", sub: "Capitulation screening · RSI-9 · Drawdown · Volume climax · MA distance",
    add: "+ ADD", clear: "Clear", researching: "LOADING", symbols: "SYMBOLS",
    score: "Score", phase: "Phase", price: "Price", dd: "Drawdown", rsi: "RSI-9",
    ma: "vs MA200", vol: "Vol Spike", z: "Z-Score", pos: "52W Pos", streak: "Down Days",
    signals: "SIGNALS", summary: "SUMMARY", turning: "STABILISING",
    sigNames: { drawdown: "Drawdown from high", rsi: "RSI-9 oversold", distMa: "Distance to MA200",
      volume: "Volume climax", zScore: "Statistical stretch", range: "Position in 52W range" },
    notFound: "NOT FOUND", hint: "Check Yahoo notation (e.g. BAS.DE, BTC-USD)",
    footer: "Capitulation Score = mean of six independent washout signals (0–100). Not a buy signal but a ranking of exhaustion. A deep score replaces neither structural nor fundamental analysis.",
  },
};

const fmtPct = (v, d = 1) => v == null || !isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`;
const fmtNum = (v, d = 1) => v == null || !isFinite(v) ? "—" : v.toFixed(d);

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function Bottom({ lang = "de" }) {
  const t = T[lang] || T.de;
  const [list, setList] = useState(loadList);
  const [input, setInput] = useState("");
  const [raw, setRaw] = useState({});
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "score", dir: "desc" });
  const [detail, setDetail] = useState(null);
  const cacheRef = useRef({});

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* private */ }
  }, [list]);

  useEffect(() => {
    const missing = list.filter(s => !cacheRef.current[s]);
    if (!missing.length) { setRaw({ ...cacheRef.current }); return; }
    let alive = true;
    setLoading(true); setError("");
    (async () => {
      try {
        for (let i = 0; i < missing.length; i += 20) {
          const chunk = missing.slice(i, i + 20);
          const res = await fetch(`/api/history?symbols=${chunk.join(",")}&interval=1d&range=2y&ohlc=1`);
          if (!res.ok) throw new Error(`API ${res.status}`);
          const json = await res.json();
          if (!alive) return;
          Object.assign(cacheRef.current, json.data || {});
          setRaw({ ...cacheRef.current });
          const bad = json.failed || [];
          if (bad.length) {
            setFailed(f => [...new Set([...f, ...bad])]);
            setList(l => l.filter(s => !bad.includes(s)));
          }
        }
      } catch (e) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [list]);

  const rows = useMemo(() => list.map(s => {
    const a = analyse(raw[s]);
    return a ? { symbol: s, ...a, phase: phaseFor(a.score) } : null;
  }).filter(Boolean), [list, raw]);

  const summary = useMemo(() => {
    const c = {};
    PHASES.forEach(p => c[p.id] = 0);
    rows.forEach(r => { if (r.phase) c[r.phase.id]++; });
    return c;
  }, [rows]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const get = d => d[sort.key];
    arr.sort((a, b) => {
      const x = get(a), y = get(b);
      if (typeof x === "string") return x.localeCompare(y);
      if (x == null) return 1;
      if (y == null) return -1;
      return x - y;
    });
    if (sort.dir === "desc") arr.reverse();
    return arr;
  }, [rows, sort]);

  const setSortKey = k => setSort(s => s.key === k ? { key: k, dir: s.dir === "desc" ? "asc" : "desc" } : { key: k, dir: k === "symbol" ? "asc" : "desc" });

  const addTickers = () => {
    const parts = input.split(/[\s,;]+/).map(s => s.trim().toUpperCase().replace(/[^A-Z0-9.\-^]/g, "")).filter(Boolean);
    const fresh = parts.filter(p => !list.includes(p));
    if (fresh.length) {
      setFailed(f => f.filter(x => !fresh.includes(x)));
      setList(l => [...new Set([...l, ...fresh])]);
    }
    setInput("");
  };

  const glass = {
    background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015) 55%, rgba(212,175,55,0.02))",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
    backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)",
    boxShadow: "0 14px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
  };
  const pill = (active) => ({
    padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
    background: active ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(212,175,55,0.07))" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.08)"}`,
    color: active ? "#f8e49b" : "#777", transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
  });
  const th = (key, label, align = "right") => (
    <th onClick={() => setSortKey(key)}
      style={{ padding: "7px 10px", textAlign: align, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
        color: sort.key === key ? "#f8e49b" : "#555", transition: "color 0.2s" }}>
      {label}{sort.key === key ? (sort.dir === "desc" ? " ▾" : " ▴") : ""}
    </th>
  );

  const sigColor = v => v == null ? "#555" : v >= 70 ? "#22c55e" : v >= 45 ? "#facc15" : "#6b7280";

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "calc(100vh - 76px)" }}>
      <style>{`
        @keyframes vsxpulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        .vsx-bt tbody tr { transition: background 0.15s; }
        .vsx-bt tbody tr:hover { background: rgba(212,175,55,0.06) !important; }
        .vsx-bt-scroll::-webkit-scrollbar { height: 7px; }
        .vsx-bt-scroll::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.25); border-radius: 4px; }
      `}</style>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -220, right: "-6%", width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.06), transparent 62%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: -320, left: "-10%", width: 880, height: 880, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.035), transparent 62%)", filter: "blur(60px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1840, margin: "0 auto", padding: "22px 30px 50px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: "0.18em", color: "#fdfdfd" }}>{t.title}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>{rows.length} {t.symbols}</div>
          {loading && (
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: GOLD, letterSpacing: "0.14em" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, boxShadow: `0 0 8px ${GOLD}`, animation: "vsxpulse 1s ease-in-out infinite" }} />
              {t.researching}…
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#b99c64", letterSpacing: "0.04em", marginBottom: 16 }}>{t.sub}</div>

        {/* EINGABE + PRESETS */}
        <div style={{ ...glass, padding: "14px 18px 12px", marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", flex: "1 1 280px" }}>
              <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTickers(); } }}
                placeholder="NVDA  BTC-USD  BAS.DE …"
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.09)", color: "#f8e49b", fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 18, letterSpacing: "0.12em", padding: "11px 46px 11px 16px", borderRadius: 12, outline: "none", textTransform: "uppercase" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.55)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }} />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "'Montserrat', sans-serif", fontSize: 7.5, fontWeight: 700, letterSpacing: "0.16em", color: "#4a4a4a", pointerEvents: "none" }}>↵</span>
            </div>
            <button style={pill(true)} onClick={addTickers}>{t.add}</button>
            <div style={{ width: 1, height: 22, background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.35), transparent)" }} />
            {Object.entries(PRESETS).map(([name, syms]) => (
              <button key={name} style={pill(false)} onClick={() => { setFailed([]); setList([...syms]); }}>{name}</button>
            ))}
            <button style={pill(false)} onClick={() => { setList([]); setFailed([]); setDetail(null); }}>{t.clear}</button>
          </div>
        </div>

        {error && (
          <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "13px 18px", marginBottom: 12, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>{error}</div>
        )}
        {failed.length > 0 && (
          <div style={{ ...glass, borderColor: "rgba(250,204,21,0.25)", padding: "10px 16px", marginBottom: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", color: "#facc15" }}>{t.notFound}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#8f8f8f" }}>{failed.join(" · ")}</span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#5a5a5a" }}>{t.hint}</span>
            <button onClick={() => setFailed([])} style={{ marginLeft: "auto", background: "none", border: "none", color: "#4a4a4a", cursor: "pointer", fontSize: 12 }}>✕</button>
          </div>
        )}

        {/* PHASEN-RESÜMEE */}
        {rows.length > 0 && (
          <div style={{ ...glass, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, padding: "14px 20px", marginBottom: 14 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.2em", color: "#fdfdfd" }}>{t.summary}</span>
            {PHASES.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: summary[p.id] ? 1 : 0.3 }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: p.color, boxShadow: summary[p.id] ? `0 0 10px ${p.color}` : "none" }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: p.color, fontWeight: 700 }}>{summary[p.id]}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", color: "#777" }}>{p[lang].label}</span>
              </div>
            ))}
          </div>
        )}

        {/* TABELLE */}
        <div className="vsx-bt-scroll" style={{ ...glass, padding: "16px 18px 14px", overflowX: "auto" }}>
          {rows.length === 0 && !loading ? (
            <div style={{ padding: 80, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.3em", color: "#262626" }}>—</div>
          ) : (
            <table className="vsx-bt" style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
              <thead>
                <tr style={{ fontSize: 8.5, letterSpacing: "0.14em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                  {th("symbol", "Symbol", "left")}
                  {th("score", t.score)}
                  <th style={{ padding: "7px 10px", textAlign: "left", color: "#555" }}>{t.phase}</th>
                  {th("px", t.price)}
                  {th("drawdown", t.dd)}
                  {th("rsi9", t.rsi)}
                  {th("distMa", t.ma)}
                  {th("volSpike", t.vol)}
                  {th("zScore", t.z)}
                  {th("rangePos", t.pos)}
                  {th("streak", t.streak)}
                  <th style={{ width: 26 }} />
                </tr>
              </thead>
              <tbody>
                {sorted.map(d => (
                  <tr key={d.symbol} onClick={() => setDetail(d)} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
                    <td style={{ padding: "9px 10px", color: "#f8e49b", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {d.symbol.replace("-USD", "")}
                      {d.turning && <span title={t.turning} style={{ marginLeft: 7, fontSize: 8, color: "#22c55e" }}>▲</span>}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                        <span style={{ display: "inline-block", width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
                          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${d.score ?? 0}%`, background: d.phase?.color || "#555", opacity: 0.85 }} />
                        </span>
                        <span style={{ color: d.phase?.color || "#555", fontWeight: 700, minWidth: 22, textAlign: "right" }}>{d.score ?? "—"}</span>
                      </span>
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      <span style={{ fontSize: 8, letterSpacing: "0.12em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
                        color: d.phase?.color, background: `${d.phase?.color}14`, border: `1px solid ${d.phase?.color}30`, padding: "2.5px 9px", borderRadius: 20 }}>
                        {d.phase?.[lang].label}
                      </span>
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: "#c9c9c9" }}>{d.px < 1 ? d.px.toFixed(4) : d.px.toFixed(2)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: d.drawdown < -0.2 ? "#22c55e" : "#9a9a9a" }}>{fmtPct(d.drawdown)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: d.rsi9 < 30 ? "#22c55e" : d.rsi9 > 70 ? "#ef4444" : "#c9c9c9" }}>{fmtNum(d.rsi9)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: d.distMa < -0.1 ? "#22c55e" : "#9a9a9a" }}>{fmtPct(d.distMa)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: d.volSpike > 1.8 ? "#22c55e" : "#9a9a9a" }}>{fmtNum(d.volSpike, 2)}×</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: d.zScore < -1.5 ? "#22c55e" : "#9a9a9a" }}>{fmtNum(d.zScore, 2)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: d.rangePos < 0.15 ? "#22c55e" : "#9a9a9a" }}>{fmtPct(d.rangePos, 0)}</td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: d.streak >= 4 ? "#22c55e" : "#9a9a9a" }}>{d.streak}</td>
                    <td style={{ padding: "9px 4px", textAlign: "center" }}>
                      <button onClick={e => { e.stopPropagation(); setList(l => l.filter(x => x !== d.symbol)); }}
                        style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: 11 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = "#3a3a3a"}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DETAIL */}
        {detail && (
          <div style={{ ...glass, marginTop: 16, padding: "20px 24px 18px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.14em", color: "#fdfdfd" }}>{detail.symbol.replace("-USD", "")}</span>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: detail.phase?.color, boxShadow: `0 0 11px ${detail.phase?.color}` }} />
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.16em", color: detail.phase?.color }}>{detail.phase?.[lang].label}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#e8e8e8" }}>{detail.score}<span style={{ color: "#555", fontSize: 10 }}>/100</span></span>
              <button onClick={() => setDetail(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: "#9a9a9a", lineHeight: 1.7, marginBottom: 18 }}>
              {detail.phase?.[lang].desc}
            </div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.2em", color: "#b99c64", marginBottom: 10 }}>{t.signals}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              {Object.entries(detail.sig).map(([k, v]) => (
                <div key={k} style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: `1px solid ${sigColor(v)}33` }}>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#777", marginBottom: 7 }}>{t.sigNames[k]}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, color: sigColor(v), fontWeight: 700 }}>{v == null ? "—" : Math.round(v)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 8, overflow: "hidden" }}>
                    <div style={{ width: `${v ?? 0}%`, height: "100%", background: sigColor(v), opacity: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
          {t.footer}
        </div>
      </div>
    </div>
  );
}
