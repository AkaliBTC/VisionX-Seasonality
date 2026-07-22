import { useState, useEffect, useMemo, useRef, useCallback } from "react";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · RELATIVE ROTATION GRAPH
//  Level 1: 11 SPDR-Sektoren vs SPY · Level 2: Drilldown in Sektor-Holdings
//  + VisionX-Watchlist-Titel (gold). JdK-Approximation auf Daily/Weekly Closes.
// ═════════════════════════════════════════════════════════════════════════════

// ── SEKTOR-KONFIG (Top-Holdings statisch — hier pflegen) ─────────────────────
const SECTORS = [
  { etf: "XLK",  name: "Technology",   holdings: ["MSFT","AAPL","NVDA","AVGO","CRM","ORCL","AMD","ADBE","CSCO","ACN"] },
  { etf: "XLF",  name: "Financials",   holdings: ["BRK-B","JPM","V","MA","BAC","WFC","GS","MS","SPGI","AXP"] },
  { etf: "XLV",  name: "Health Care",  holdings: ["LLY","UNH","JNJ","ABBV","MRK","TMO","ABT","AMGN","ISRG","PFE"] },
  { etf: "XLY",  name: "Cons. Discr.", holdings: ["AMZN","TSLA","HD","MCD","BKNG","LOW","TJX","NKE","SBUX","CMG"] },
  { etf: "XLP",  name: "Cons. Staples",holdings: ["PG","COST","WMT","KO","PEP","PM","MDLZ","MO","CL","TGT"] },
  { etf: "XLE",  name: "Energy",       holdings: ["XOM","CVX","COP","WMB","EOG","SLB","PSX","MPC","KMI","OKE"] },
  { etf: "XLI",  name: "Industrials",  holdings: ["GE","CAT","UBER","RTX","HON","UNP","ETN","BA","DE","LMT"] },
  { etf: "XLB",  name: "Materials",    holdings: ["LIN","SHW","APD","ECL","FCX","NEM","CTVA","DD","DOW","PPG"] },
  { etf: "XLRE", name: "Real Estate",  holdings: ["PLD","AMT","EQIX","WELL","SPG","PSA","O","CCI","DLR","VICI"] },
  { etf: "XLU",  name: "Utilities",    holdings: ["NEE","SO","DUK","CEG","SRE","AEP","D","PCG","EXC","XEL"] },
  { etf: "XLC",  name: "Comm. Serv.",  holdings: ["META","GOOGL","NFLX","DIS","CMCSA","T","VZ","TMUS","EA","WBD"] },
];

// ── VISIONX WATCHLIST · eure Titel je Sektor (gold markiert) ─────────────────
// Auch Nicht-S&P-Titel (ADRs etc.) sind ok — geplottet wird gegen die Benchmark.
const VSX_WATCHLIST = {
  XLK: ["MSFT"],
  XLF: ["FI"],           // Fiserv (ex-FISV)
  XLV: ["HIMS", "JNJ"],
  XLY: ["BABA"],         // ADR — kein S&P-Mitglied, läuft trotzdem
};

const BENCH_DEFAULT = "SPY";

// ── FARB-PALETTE (Sektoren fix, Drilldown rotierend) ─────────────────────────
const SECTOR_COLORS = {
  XLK: "#63b6ff", XLF: "#22c55e", XLV: "#f472b6", XLY: "#a855f7",
  XLP: "#facc15", XLE: "#fb923c", XLI: "#94a3b8", XLB: "#2dd4bf",
  XLRE: "#e879f9", XLU: "#38bdf8", XLC: "#fb7185",
};
const PALETTE = ["#63b6ff","#22c55e","#f472b6","#a855f7","#facc15","#fb923c","#94a3b8","#2dd4bf","#e879f9","#38bdf8","#fb7185","#c084fc","#4ade80","#fbbf24"];
const GOLD = "#d4af37";

// ── MATH ─────────────────────────────────────────────────────────────────────
const meanStd = (arr) => {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return [m, Math.sqrt(v)];
};

// Daily-Serie → Weekly (letzter Close je ISO-Woche)
const toWeekly = (series) => {
  const out = [];
  let curKey = null;
  for (const [t, c] of series) {
    const d = new Date(t);
    const day = (d.getUTCDay() + 6) % 7;                 // Mo=0
    const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - day);
    const key = monday.toISOString().slice(0, 10);
    if (key !== curKey) { out.push([t, c]); curKey = key; }
    else out[out.length - 1] = [t, c];
  }
  return out;
};

// JdK-Approximation: RS-Ratio = 100 + z(RS über window) · RS-Mom = 100 + z(ΔRS-Ratio)
const computeRRG = (series, bench, { window: W, momP, tailLen }) => {
  const bMap = new Map(bench.map(([t, c]) => [new Date(t).toISOString().slice(0, 10), c]));
  const sMap = new Map(series.map(([t, c]) => [new Date(t).toISOString().slice(0, 10), c]));
  const rs = []; const ts = [];
  let lastS = null;
  for (const [t] of bench) {
    const key = new Date(t).toISOString().slice(0, 10);
    const b = bMap.get(key);
    const s = sMap.has(key) ? sMap.get(key) : lastS;
    if (sMap.has(key)) lastS = sMap.get(key);
    if (b != null && s != null) { rs.push(100 * s / b); ts.push(t); }
  }
  if (rs.length < W + momP + tailLen) return null;

  const ratio = new Array(rs.length).fill(null);
  for (let i = W - 1; i < rs.length; i++) {
    const [m, sd] = meanStd(rs.slice(i - W + 1, i + 1));
    ratio[i] = sd > 1e-9 ? 100 + ((rs[i] - m) / sd) : 100;
  }
  const roc = new Array(rs.length).fill(null);
  for (let i = W - 1 + momP; i < rs.length; i++) roc[i] = ratio[i] - ratio[i - momP];
  const mom = new Array(rs.length).fill(null);
  for (let i = W - 1 + momP + W - 1; i < rs.length; i++) {
    const win = roc.slice(i - W + 1, i + 1).filter(v => v != null);
    if (win.length < W) continue;
    const [m, sd] = meanStd(win);
    mom[i] = sd > 1e-9 ? 100 + ((roc[i] - m) / sd) : 100;
  }
  const tail = [];
  for (let i = rs.length - tailLen; i < rs.length; i++) {
    if (ratio[i] != null && mom[i] != null) tail.push({ x: ratio[i], y: mom[i], t: ts[i] });
  }
  return tail.length >= 2 ? tail : null;
};

const quadrantOf = (x, y) =>
  x >= 100 && y >= 100 ? "LEADING" : x >= 100 ? "WEAKENING" : y >= 100 ? "IMPROVING" : "LAGGING";
const QUAD_COLOR = { LEADING: "#22c55e", WEAKENING: "#facc15", LAGGING: "#ef4444", IMPROVING: "#63b6ff" };

// ── DATA LAYER ───────────────────────────────────────────────────────────────
const fetchHistories = async (symbols) => {
  const out = {}; const failed = [];
  for (let i = 0; i < symbols.length; i += 25) {
    const chunk = symbols.slice(i, i + 25);
    const res = await fetch(`/api/history?symbols=${chunk.join(",")}&interval=1d&range=2y`);
    if (!res.ok) throw new Error(`API ${res.status} — läuft die Seite auf Vercel / \`vercel dev\`?`);
    const json = await res.json();
    Object.assign(out, json.data);
    failed.push(...(json.failed || []));
  }
  return { data: out, failed };
};

// ── CHART ────────────────────────────────────────────────────────────────────
function RRGChart({ items, hovered, setHovered, onNodeClick, tailLen }) {
  const SIZE = 680, PAD = 46;
  const plot = SIZE - PAD * 2;

  const ext = useMemo(() => {
    let m = 2;
    items.forEach(it => it.tail.forEach(p => {
      m = Math.max(m, Math.abs(p.x - 100), Math.abs(p.y - 100));
    }));
    return m * 1.15;
  }, [items]);

  const X = v => PAD + ((v - (100 - ext)) / (2 * ext)) * plot;
  const Y = v => PAD + (1 - (v - (100 - ext)) / (2 * ext)) * plot;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: "100%", maxWidth: 720, display: "block" }}>
      {/* Quadranten */}
      <rect x={X(100)} y={PAD} width={plot / 2} height={plot / 2} fill="rgba(34,197,94,0.045)" />
      <rect x={X(100)} y={Y(100)} width={plot / 2} height={plot / 2} fill="rgba(250,204,21,0.04)" />
      <rect x={PAD} y={Y(100)} width={plot / 2} height={plot / 2} fill="rgba(239,68,68,0.045)" />
      <rect x={PAD} y={PAD} width={plot / 2} height={plot / 2} fill="rgba(99,182,255,0.045)" />
      <rect x={PAD} y={PAD} width={plot} height={plot} fill="none" stroke="rgba(255,255,255,0.08)" />
      <line x1={X(100)} y1={PAD} x2={X(100)} y2={SIZE - PAD} stroke="rgba(255,255,255,0.14)" strokeDasharray="3 4" />
      <line x1={PAD} y1={Y(100)} x2={SIZE - PAD} y2={Y(100)} stroke="rgba(255,255,255,0.14)" strokeDasharray="3 4" />

      {[["LEADING", SIZE - PAD - 8, PAD + 16, "end", "#22c55e"], ["WEAKENING", SIZE - PAD - 8, SIZE - PAD - 10, "end", "#facc15"],
        ["LAGGING", PAD + 8, SIZE - PAD - 10, "start", "#ef4444"], ["IMPROVING", PAD + 8, PAD + 16, "start", "#63b6ff"]]
        .map(([label, x, y, anchor, col]) => (
          <text key={label} x={x} y={y} textAnchor={anchor} fill={col} opacity={0.55}
            style={{ font: "700 11px Montserrat, sans-serif", letterSpacing: "0.22em" }}>{label}</text>
        ))}
      <text x={SIZE / 2} y={SIZE - 12} textAnchor="middle" fill="#555" style={{ font: "500 10px 'DM Mono', monospace", letterSpacing: "0.15em" }}>JDK RS-RATIO →</text>
      <text x={14} y={SIZE / 2} textAnchor="middle" fill="#555" transform={`rotate(-90 14 ${SIZE / 2})`} style={{ font: "500 10px 'DM Mono', monospace", letterSpacing: "0.15em" }}>JDK RS-MOMENTUM →</text>

      {/* Tails + Nodes */}
      {items.map(it => {
        const dim = hovered && hovered !== it.symbol;
        const head = it.tail[it.tail.length - 1];
        return (
          <g key={it.symbol} opacity={dim ? 0.14 : 1} style={{ transition: "opacity 0.2s", cursor: onNodeClick ? "pointer" : "default" }}
            onMouseEnter={() => setHovered(it.symbol)} onMouseLeave={() => setHovered(null)}
            onClick={() => onNodeClick && onNodeClick(it)}>
            {it.tail.slice(0, -1).map((p, i) => {
              const n = it.tail[i + 1];
              return <line key={i} x1={X(p.x)} y1={Y(p.y)} x2={X(n.x)} y2={Y(n.y)}
                stroke={it.color} strokeWidth={it.vsx ? 2.4 : 1.8}
                opacity={0.15 + 0.75 * (i / (tailLen - 1))} strokeLinecap="round" />;
            })}
            {it.tail.slice(0, -1).map((p, i) => (
              <circle key={"d" + i} cx={X(p.x)} cy={Y(p.y)} r={it.vsx ? 2.2 : 1.8} fill={it.color} opacity={0.2 + 0.6 * (i / (tailLen - 1))} />
            ))}
            {it.vsx && <circle cx={X(head.x)} cy={Y(head.y)} r={11} fill="none" stroke={GOLD} strokeWidth={1} opacity={0.5} />}
            <circle cx={X(head.x)} cy={Y(head.y)} r={it.vsx ? 6.5 : 5.5} fill={it.color}
              stroke={it.vsx ? GOLD : "#0a0a0a"} strokeWidth={it.vsx ? 2 : 1.5}
              style={it.vsx ? { filter: `drop-shadow(0 0 6px rgba(212,175,55,0.65))` } : {}} />
            <text x={X(head.x)} y={Y(head.y) - 11} textAnchor="middle"
              fill={it.vsx ? "#f8e49b" : "#e8e8e8"}
              style={{ font: `700 ${it.vsx ? 11.5 : 10.5}px Montserrat, sans-serif`, letterSpacing: "0.06em", paintOrder: "stroke", stroke: "#0a0a0acc", strokeWidth: 3 }}>
              {it.symbol}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function RRG() {
  const [level, setLevel] = useState({ type: "sectors" });   // | {type:"drill", sector}
  const [interval_, setInterval_] = useState("1d");
  const [tailLen, setTailLen] = useState(10);
  const [benchMode, setBenchMode] = useState("SPY");         // Drilldown: "SPY" | "SECTOR"
  const [raw, setRaw] = useState({});                         // symbol → daily series
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);
  const [hovered, setHovered] = useState(null);
  const cacheRef = useRef({});

  const drillSector = level.type === "drill" ? SECTORS.find(s => s.etf === level.sector) : null;

  const neededSymbols = useMemo(() => {
    if (level.type === "sectors") return [BENCH_DEFAULT, ...SECTORS.map(s => s.etf)];
    const wl = VSX_WATCHLIST[level.sector] || [];
    return [...new Set([BENCH_DEFAULT, level.sector, ...drillSector.holdings, ...wl])];
  }, [level, drillSector]);

  useEffect(() => {
    let alive = true;
    const missing = neededSymbols.filter(s => !cacheRef.current[s]);
    if (!missing.length) { setRaw({ ...cacheRef.current }); return; }
    setLoading(true); setError("");
    fetchHistories(missing)
      .then(({ data, failed: f }) => {
        if (!alive) return;
        Object.assign(cacheRef.current, data);
        setRaw({ ...cacheRef.current });
        setFailed(f);
      })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [neededSymbols]);

  const params = interval_ === "1wk"
    ? { window: 14, momP: 4, tailLen }
    : { window: 63, momP: 10, tailLen };

  const items = useMemo(() => {
    const prep = s => interval_ === "1wk" ? toWeekly(s) : s;
    const benchSym = level.type === "drill" && benchMode === "SECTOR" ? level.sector : BENCH_DEFAULT;
    const bench = raw[benchSym] ? prep(raw[benchSym]) : null;
    if (!bench) return [];

    const universe = level.type === "sectors"
      ? SECTORS.map((s, i) => ({ symbol: s.etf, label: s.name, color: SECTOR_COLORS[s.etf] || PALETTE[i % PALETTE.length], vsx: false }))
      : [
          ...drillSector.holdings.map((h, i) => ({ symbol: h, label: h, color: PALETTE[i % PALETTE.length], vsx: false })),
          ...(VSX_WATCHLIST[level.sector] || []).filter(w => !drillSector.holdings.includes(w))
            .map(w => ({ symbol: w, label: w + " · VSX", color: GOLD, vsx: true })),
        ].filter(u => u.symbol !== benchSym);

    return universe.map(u => {
      if (!raw[u.symbol]) return null;
      const tail = computeRRG(prep(raw[u.symbol]), bench, params);
      return tail ? { ...u, tail } : null;
    }).filter(Boolean);
  }, [raw, level, interval_, tailLen, benchMode, drillSector, params.window]);

  const benchLabel = level.type === "drill" && benchMode === "SECTOR" ? level.sector : "SPY";

  const glass = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" };
  const pill = (active, colorOn = GOLD) => ({
    padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
    fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
    background: active ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(212,175,55,0.45)" : "rgba(255,255,255,0.08)"}`,
    color: active ? colorOn : "#888", transition: "all 0.2s",
  });

  const sorted = [...items].sort((a, b) => b.tail[b.tail.length - 1].x - a.tail[a.tail.length - 1].x);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 20px 60px" }}>
      {/* KOPFZEILE */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.22em", color: "#fdfdfd" }}>
          RELATIVE ROTATION
          <span style={{ color: "#555", margin: "0 10px" }}>·</span>
          <span style={{ color: GOLD }}>{level.type === "sectors" ? "SPDR SECTORS" : `${level.sector} DRILLDOWN`}</span>
        </div>
        {level.type === "drill" && (
          <button onClick={() => { setLevel({ type: "sectors" }); setBenchMode("SPY"); setHovered(null); }}
            style={pill(false)}>← Zurück zu Sektoren</button>
        )}
        <div style={{ marginLeft: "auto", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>
          BENCHMARK: <span style={{ color: "#f8e49b" }}>{benchLabel}</span>
        </div>
      </div>

      {/* CONTROLS */}
      <div style={{ ...glass, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "14px 16px", marginBottom: 18 }}>
        <button style={pill(interval_ === "1d")} onClick={() => setInterval_("1d")}>Daily</button>
        <button style={pill(interval_ === "1wk")} onClick={() => setInterval_("1wk")}>Weekly</button>
        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.08)" }} />
        <span style={{ fontSize: 9, letterSpacing: "0.18em", color: "#888", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>TAIL {tailLen}{interval_ === "1wk" ? "W" : "D"}</span>
        <input type="range" min={5} max={20} value={tailLen} onChange={e => setTailLen(+e.target.value)}
          style={{ width: 130, accentColor: GOLD }} />
        {level.type === "drill" && (
          <>
            <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.08)" }} />
            <button style={pill(benchMode === "SPY")} onClick={() => setBenchMode("SPY")}>vs SPY</button>
            <button style={pill(benchMode === "SECTOR")} onClick={() => setBenchMode("SECTOR")}>vs {level.sector}</button>
          </>
        )}
        {loading && <span style={{ marginLeft: "auto", fontSize: 10, color: GOLD, fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em" }}>LOADING…</span>}
      </div>

      {error && (
        <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 18, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>
          {error}
        </div>
      )}
      {failed.length > 0 && !error && (
        <div style={{ fontSize: 10, color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>
          Keine Daten: {failed.join(", ")}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* CHART */}
        <div style={{ ...glass, padding: 14, flex: "1 1 560px", minWidth: 320 }}>
          {items.length > 0 ? (
            <RRGChart items={items} hovered={hovered} setHovered={setHovered} tailLen={tailLen}
              onNodeClick={level.type === "sectors" ? (it) => { setLevel({ type: "drill", sector: it.symbol }); setHovered(null); } : null} />
          ) : !loading && !error ? (
            <div style={{ padding: 80, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: "0.25em", color: "#2a2a2a" }}>KEINE DATEN</div>
          ) : (
            <div style={{ padding: 80, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.2em", color: "#444" }}>FETCHING {neededSymbols.length} SYMBOLS…</div>
          )}
          {level.type === "sectors" && items.length > 0 && (
            <div style={{ textAlign: "center", fontSize: 9, color: "#555", letterSpacing: "0.16em", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, textTransform: "uppercase", paddingBottom: 6 }}>
              Sektor anklicken für Drilldown mit Holdings + <span style={{ color: GOLD }}>VSX-Watchlist</span>
            </div>
          )}
        </div>

        {/* TABELLE */}
        <div style={{ ...glass, padding: "16px 18px", flex: "1 1 320px", minWidth: 300 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.18em", color: "#fdfdfd", marginBottom: 12 }}>
            ROTATION RANKING
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
            <thead>
              <tr style={{ color: "#555", fontSize: 9, letterSpacing: "0.14em", textAlign: "left" }}>
                <th style={{ padding: "4px 6px" }}>SYMBOL</th>
                <th style={{ padding: "4px 6px" }}>QUADRANT</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>RS-R</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>RS-M</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(it => {
                const h = it.tail[it.tail.length - 1];
                const q = quadrantOf(h.x, h.y);
                return (
                  <tr key={it.symbol}
                    onMouseEnter={() => setHovered(it.symbol)} onMouseLeave={() => setHovered(null)}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "default", background: hovered === it.symbol ? "rgba(212,175,55,0.06)" : "transparent", transition: "background 0.15s" }}>
                    <td style={{ padding: "7px 6px", color: it.vsx ? "#f8e49b" : "#e8e8e8", fontWeight: it.vsx ? 700 : 400 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: it.color, marginRight: 8, boxShadow: it.vsx ? `0 0 6px ${GOLD}` : "none" }} />
                      {it.symbol}
                    </td>
                    <td style={{ padding: "7px 6px", color: QUAD_COLOR[q], fontSize: 9, letterSpacing: "0.1em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>{q}</td>
                    <td style={{ padding: "7px 6px", textAlign: "right", color: h.x >= 100 ? "#22c55e" : "#ef4444" }}>{h.x.toFixed(2)}</td>
                    <td style={{ padding: "7px 6px", textAlign: "right", color: h.y >= 100 ? "#22c55e" : "#ef4444" }}>{h.y.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 18, fontSize: 9, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.8 }}>
        JdK RS-Ratio / RS-Momentum als Normalisierungs-Approximation ({params.window}{interval_ === "1wk" ? "W" : "D"} Fenster, ROC {params.momP}). Structural analysis — not investment advice.
      </div>
    </div>
  );
}
