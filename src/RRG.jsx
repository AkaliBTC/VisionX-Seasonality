import { useState, useEffect, useMemo, useRef } from "react";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · RELATIVE ROTATION GRAPH v2
//  Preset-System: SPDR Sectors (SPY-Basis, Drilldown mit Sektor-ETF-Basis),
//  Crypto (BTC-Basis, Alts rotieren gegen BTC) — weitere Presets unten anlegen.
//  Manuelles Add/Remove je View · sortierbare Tabelle · Tail 5 (max 10).
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";

// ── SEKTOR-KONFIG ────────────────────────────────────────────────────────────
const SECTORS = [
  { etf: "XLK",  name: "Technology",    holdings: ["MSFT","AAPL","NVDA","AVGO","CRM","ORCL","AMD","ADBE","CSCO","ACN"] },
  { etf: "XLF",  name: "Financials",    holdings: ["BRK-B","JPM","V","MA","BAC","WFC","GS","MS","SPGI","AXP"] },
  { etf: "XLV",  name: "Health Care",   holdings: ["LLY","UNH","JNJ","ABBV","MRK","TMO","ABT","AMGN","ISRG","PFE"] },
  { etf: "XLY",  name: "Cons. Discr.",  holdings: ["AMZN","TSLA","HD","MCD","BKNG","LOW","TJX","NKE","SBUX","CMG"] },
  { etf: "XLP",  name: "Cons. Staples", holdings: ["PG","COST","WMT","KO","PEP","PM","MDLZ","MO","CL","TGT"] },
  { etf: "XLE",  name: "Energy",        holdings: ["XOM","CVX","COP","WMB","EOG","SLB","PSX","MPC","KMI","OKE"] },
  { etf: "XLI",  name: "Industrials",   holdings: ["GE","CAT","UBER","RTX","HON","UNP","ETN","BA","DE","LMT"] },
  { etf: "XLB",  name: "Materials",     holdings: ["LIN","SHW","APD","ECL","FCX","NEM","CTVA","DD","DOW","PPG"] },
  { etf: "XLRE", name: "Real Estate",   holdings: ["PLD","AMT","EQIX","WELL","SPG","PSA","O","CCI","DLR","VICI"] },
  { etf: "XLU",  name: "Utilities",     holdings: ["NEE","SO","DUK","CEG","SRE","AEP","D","PCG","EXC","XEL"] },
  { etf: "XLC",  name: "Comm. Serv.",   holdings: ["META","GOOGL","NFLX","DIS","CMCSA","T","VZ","TMUS","EA","WBD"] },
];

// ── PRESETS — hier neue Universen registrieren ───────────────────────────────
const PRESETS = [
  {
    id: "sectors", label: "SPDR SECTORS", bench: "SPY", drillable: true,
    members: SECTORS.map(s => ({ symbol: s.etf, label: s.etf })),
  },
  {
    id: "crypto", label: "CRYPTO", bench: "BTC-USD", drillable: false, cryptoSuffix: true,
    members: ["ETH","SOL","BNB","XRP","ADA","AVAX","DOGE","LINK","DOT","LTC"]
      .map(c => ({ symbol: `${c}-USD`, label: c })),
  },
];

// ── VISIONX WATCHLIST · gold markiert, je View-Key ───────────────────────────
// Keys: Preset-Id oder "sectors:XLV" für Drilldowns. Hier eure Titel pflegen.
const VSX_WATCHLIST = {
  "sectors:XLK": ["MSFT"],
  "sectors:XLF": ["FI"],
  "sectors:XLV": ["HIMS", "JNJ"],
  "sectors:XLY": ["BABA"],
  "crypto": [],
};

const SECTOR_COLORS = {
  XLK: "#63b6ff", XLF: "#22c55e", XLV: "#f472b6", XLY: "#a855f7",
  XLP: "#facc15", XLE: "#fb923c", XLI: "#94a3b8", XLB: "#2dd4bf",
  XLRE: "#e879f9", XLU: "#38bdf8", XLC: "#fb7185",
};
const PALETTE = ["#63b6ff","#22c55e","#f472b6","#a855f7","#facc15","#fb923c","#94a3b8","#2dd4bf","#e879f9","#38bdf8","#fb7185","#c084fc","#4ade80","#fbbf24","#f87171","#7dd3fc"];

// ── MATH ─────────────────────────────────────────────────────────────────────
const meanStd = (arr) => {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return [m, Math.sqrt(v)];
};

const toWeekly = (series) => {
  const out = [];
  let curKey = null;
  for (const [t, c] of series) {
    const d = new Date(t);
    const day = (d.getUTCDay() + 6) % 7;
    const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - day);
    const key = monday.toISOString().slice(0, 10);
    if (key !== curKey) { out.push([t, c]); curKey = key; }
    else out[out.length - 1] = [t, c];
  }
  return out;
};

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
  if (rs.length < W * 2 + momP + tailLen) return null;

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
const QUAD_ORDER = { LEADING: 0, IMPROVING: 1, WEAKENING: 2, LAGGING: 3 };

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
  const SIZE = 680, PAD = 48;
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
      <defs>
        <radialGradient id="rrg-vig" cx="50%" cy="50%" r="72%">
          <stop offset="70%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
        </radialGradient>
      </defs>

      {/* Quadranten */}
      <rect x={X(100)} y={PAD} width={plot / 2} height={plot / 2} fill="rgba(34,197,94,0.05)" />
      <rect x={X(100)} y={Y(100)} width={plot / 2} height={plot / 2} fill="rgba(250,204,21,0.045)" />
      <rect x={PAD} y={Y(100)} width={plot / 2} height={plot / 2} fill="rgba(239,68,68,0.05)" />
      <rect x={PAD} y={PAD} width={plot / 2} height={plot / 2} fill="rgba(99,182,255,0.05)" />
      <rect x={PAD} y={PAD} width={plot} height={plot} fill="url(#rrg-vig)" pointerEvents="none" />
      <rect x={PAD} y={PAD} width={plot} height={plot} fill="none" stroke="rgba(255,255,255,0.09)" rx="2" />
      <line x1={X(100)} y1={PAD} x2={X(100)} y2={SIZE - PAD} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 5" />
      <line x1={PAD} y1={Y(100)} x2={SIZE - PAD} y2={Y(100)} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 5" />

      {[["LEADING", SIZE - PAD - 10, PAD + 20, "end", "#22c55e"], ["WEAKENING", SIZE - PAD - 10, SIZE - PAD - 12, "end", "#facc15"],
        ["LAGGING", PAD + 10, SIZE - PAD - 12, "start", "#ef4444"], ["IMPROVING", PAD + 10, PAD + 20, "start", "#63b6ff"]]
        .map(([label, x, y, anchor, col]) => (
          <text key={label} x={x} y={y} textAnchor={anchor} fill={col} opacity={0.5}
            style={{ font: "700 10.5px Montserrat, sans-serif", letterSpacing: "0.26em" }}>{label}</text>
        ))}
      <text x={SIZE / 2} y={SIZE - 13} textAnchor="middle" fill="#4a4a4a" style={{ font: "500 9.5px 'DM Mono', monospace", letterSpacing: "0.18em" }}>JDK RS-RATIO →</text>
      <text x={15} y={SIZE / 2} textAnchor="middle" fill="#4a4a4a" transform={`rotate(-90 15 ${SIZE / 2})`} style={{ font: "500 9.5px 'DM Mono', monospace", letterSpacing: "0.18em" }}>JDK RS-MOMENTUM →</text>

      {items.map(it => {
        const dim = hovered && hovered !== it.symbol;
        const head = it.tail[it.tail.length - 1];
        return (
          <g key={it.symbol} opacity={dim ? 0.12 : 1} style={{ transition: "opacity 0.25s", cursor: onNodeClick ? "pointer" : "default" }}
            onMouseEnter={() => setHovered(it.symbol)} onMouseLeave={() => setHovered(null)}
            onClick={() => onNodeClick && onNodeClick(it)}>
            {it.tail.slice(0, -1).map((p, i) => {
              const n = it.tail[i + 1];
              return <line key={i} x1={X(p.x)} y1={Y(p.y)} x2={X(n.x)} y2={Y(n.y)}
                stroke={it.color} strokeWidth={it.vsx ? 2.6 : 1.9}
                opacity={0.14 + 0.78 * (i / Math.max(1, tailLen - 1))} strokeLinecap="round" />;
            })}
            {it.tail.slice(0, -1).map((p, i) => (
              <circle key={"d" + i} cx={X(p.x)} cy={Y(p.y)} r={it.vsx ? 2.3 : 1.9} fill={it.color} opacity={0.2 + 0.6 * (i / Math.max(1, tailLen - 1))} />
            ))}
            {it.vsx && <circle cx={X(head.x)} cy={Y(head.y)} r={12} fill="none" stroke={GOLD} strokeWidth={1} opacity={0.55} />}
            <circle cx={X(head.x)} cy={Y(head.y)} r={it.vsx ? 6.8 : 5.6} fill={it.color}
              stroke={it.vsx ? GOLD : "#0a0a0a"} strokeWidth={it.vsx ? 2 : 1.5}
              style={it.vsx ? { filter: "drop-shadow(0 0 7px rgba(212,175,55,0.7))" } : {}} />
            <text x={X(head.x)} y={Y(head.y) - 12} textAnchor="middle"
              fill={it.vsx ? "#f8e49b" : "#eaeaea"}
              style={{ font: `700 ${it.vsx ? 11.5 : 10.5}px Montserrat, sans-serif`, letterSpacing: "0.06em", paintOrder: "stroke", stroke: "#0a0a0add", strokeWidth: 3.5 }}>
              {it.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function RRG() {
  const [presetId, setPresetId] = useState("sectors");
  const [drill, setDrill] = useState(null);                 // Sektor-ETF oder null
  const [interval_, setInterval_] = useState("1d");
  const [tailLen, setTailLen] = useState(5);
  const [benchMode, setBenchMode] = useState("SECTOR");     // Drilldown-Basis: "SECTOR" | "TOP"
  const [customAdd, setCustomAdd] = useState({});           // viewKey → [symbols]
  const [removed, setRemoved] = useState({});               // viewKey → Set-Array
  const [addInput, setAddInput] = useState("");
  const [sort, setSort] = useState({ key: "rsr", dir: "desc" });
  const [raw, setRaw] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);
  const [hovered, setHovered] = useState(null);
  const cacheRef = useRef({});

  const preset = PRESETS.find(p => p.id === presetId);
  const drillSector = drill ? SECTORS.find(s => s.etf === drill) : null;
  const viewKey = drill ? `${presetId}:${drill}` : presetId;

  const benchSym = drill
    ? (benchMode === "SECTOR" ? drill : preset.bench)
    : preset.bench;
  const benchLabel = benchSym.replace("-USD", "");

  // Universum der aktuellen View: Preset-Members bzw. Holdings + Watchlist + Custom − Removed
  const universe = useMemo(() => {
    const rm = new Set(removed[viewKey] || []);
    const custom = customAdd[viewKey] || [];
    let base;
    if (drill) {
      base = [
        ...drillSector.holdings.map(h => ({ symbol: h, label: h, vsx: false })),
        ...(VSX_WATCHLIST[viewKey] || []).filter(w => !drillSector.holdings.includes(w))
          .map(w => ({ symbol: w, label: w, vsx: true })),
      ];
    } else {
      base = [
        ...preset.members.map(m => ({ ...m, vsx: false })),
        ...(VSX_WATCHLIST[viewKey] || []).map(w => ({ symbol: w, label: w.replace("-USD", ""), vsx: true })),
      ];
    }
    const known = new Set(base.map(b => b.symbol));
    custom.forEach(c => { if (!known.has(c)) base.push({ symbol: c, label: c.replace("-USD", ""), vsx: false, custom: true }); });
    return base.filter(b => !rm.has(b.symbol) && b.symbol !== benchSym);
  }, [preset, drill, drillSector, viewKey, customAdd, removed, benchSym]);

  const neededSymbols = useMemo(
    () => [...new Set([benchSym, ...universe.map(u => u.symbol)])],
    [benchSym, universe]
  );

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
    const bench = raw[benchSym] ? prep(raw[benchSym]) : null;
    if (!bench) return [];
    return universe.map((u, i) => {
      if (!raw[u.symbol]) return null;
      const tail = computeRRG(prep(raw[u.symbol]), bench, params);
      if (!tail) return null;
      const color = u.vsx ? GOLD : (SECTOR_COLORS[u.symbol] || PALETTE[i % PALETTE.length]);
      return { ...u, color, tail };
    }).filter(Boolean);
  }, [raw, universe, interval_, tailLen, benchSym, params.window, params.momP]);

  // ── SORTIERUNG ─────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...items];
    const head = it => it.tail[it.tail.length - 1];
    const cmp = {
      alpha: (a, b) => a.label.localeCompare(b.label),
      quad:  (a, b) => (QUAD_ORDER[quadrantOf(head(a).x, head(a).y)] - QUAD_ORDER[quadrantOf(head(b).x, head(b).y)]) || (head(b).x - head(a).x),
      rsr:   (a, b) => head(a).x - head(b).x,
      rsm:   (a, b) => head(a).y - head(b).y,
    }[sort.key];
    arr.sort(cmp);
    if (sort.dir === "desc" && sort.key !== "quad") arr.reverse();
    return arr;
  }, [items, sort]);

  const setSortKey = key => setSort(s => s.key === key
    ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
    : { key, dir: key === "alpha" || key === "quad" ? "asc" : "desc" });

  // ── ADD / REMOVE ───────────────────────────────────────────────────────────
  const addSymbol = () => {
    let sym = addInput.trim().toUpperCase();
    if (!sym) return;
    if (preset.cryptoSuffix && !drill && !sym.includes("-")) sym = `${sym}-USD`;
    setCustomAdd(p => ({ ...p, [viewKey]: [...new Set([...(p[viewKey] || []), sym])] }));
    setRemoved(p => ({ ...p, [viewKey]: (p[viewKey] || []).filter(s => s !== sym) }));
    setAddInput("");
  };
  const removeSymbol = sym =>
    setRemoved(p => ({ ...p, [viewKey]: [...new Set([...(p[viewKey] || []), sym])] }));
  const resetView = () => {
    setRemoved(p => ({ ...p, [viewKey]: [] }));
    setCustomAdd(p => ({ ...p, [viewKey]: [] }));
  };
  const hasEdits = (removed[viewKey] || []).length > 0 || (customAdd[viewKey] || []).length > 0;

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const glass = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
    border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18,
    backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
    boxShadow: "0 10px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
  };
  const pill = (active) => ({
    padding: "9px 18px", borderRadius: 11, cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
    fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
    background: active ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(212,175,55,0.07))" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.08)"}`,
    color: active ? "#f8e49b" : "#777", transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
    boxShadow: active ? "0 0 18px rgba(212,175,55,0.12)" : "none",
  });
  const divider = { width: 1, height: 24, background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.35), transparent)" };
  const th = (key, label, align = "left") => (
    <th onClick={() => setSortKey(key)}
      style={{ padding: "6px 8px", textAlign: align, cursor: "pointer", userSelect: "none", color: sort.key === key ? "#f8e49b" : "#555", transition: "color 0.2s" }}>
      {label}{sort.key === key ? (sort.dir === "desc" ? " ▾" : " ▴") : ""}
    </th>
  );

  return (
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: "28px 22px 70px" }}>
      {/* TITELZEILE */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 14, marginBottom: 20 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: "0.2em", color: "#fdfdfd" }}>
          RELATIVE ROTATION
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.28em", color: "#b99c64", textTransform: "uppercase" }}>
          {drill ? `${drill} · ${drillSector.name}` : preset.label}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, boxShadow: `0 0 8px ${GOLD}` }} />
          BASIS <span style={{ color: "#f8e49b" }}>{benchLabel}</span>
        </div>
      </div>

      {/* PRESETS + DRILL-BREADCRUMB */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, marginBottom: 14 }}>
        {PRESETS.map(p => (
          <button key={p.id} style={pill(presetId === p.id && !drill)}
            onClick={() => { setPresetId(p.id); setDrill(null); setHovered(null); }}>
            {p.label}
          </button>
        ))}
        {drill && (
          <>
            <span style={{ color: "#3a3a3a", fontSize: 11 }}>›</span>
            <button style={pill(true)} onClick={() => {}}>{drill}</button>
            <button style={{ ...pill(false), padding: "9px 13px" }} onClick={() => { setDrill(null); setHovered(null); }}>✕</button>
          </>
        )}
      </div>

      {/* CONTROLS */}
      <div style={{ ...glass, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 11, padding: "13px 16px", marginBottom: 20 }}>
        <button style={pill(interval_ === "1d")} onClick={() => setInterval_("1d")}>Daily</button>
        <button style={pill(interval_ === "1wk")} onClick={() => setInterval_("1wk")}>Weekly</button>
        <div style={divider} />
        <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "#888", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
          TAIL <span style={{ color: "#f8e49b" }}>{tailLen}</span>{interval_ === "1wk" ? "W" : "D"}
        </span>
        <input type="range" min={3} max={10} value={tailLen} onChange={e => setTailLen(+e.target.value)}
          style={{ width: 110, accentColor: GOLD }} />
        {drill && (
          <>
            <div style={divider} />
            <button style={pill(benchMode === "SECTOR")} onClick={() => setBenchMode("SECTOR")}>vs {drill}</button>
            <button style={pill(benchMode === "TOP")} onClick={() => setBenchMode("TOP")}>vs {preset.bench}</button>
          </>
        )}
        <div style={divider} />
        <input value={addInput} onChange={e => setAddInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && addSymbol()}
          placeholder={preset.cryptoSuffix && !drill ? "z.B. PEPE" : "z.B. NVDA"}
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "#f8e49b", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: "0.12em", padding: "8px 14px", borderRadius: 10, outline: "none", width: 110, textTransform: "uppercase" }}
          onFocus={e => e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"} />
        <button style={{ ...pill(true), padding: "9px 15px" }} onClick={addSymbol}>+ ADD</button>
        {hasEdits && (
          <button style={{ ...pill(false), color: "#777" }} onClick={resetView}>↺ RESET</button>
        )}
        {loading && <span style={{ marginLeft: "auto", fontSize: 10, color: GOLD, fontFamily: "'DM Mono', monospace", letterSpacing: "0.14em" }}>LOADING…</span>}
      </div>

      {error && (
        <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 20, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>
          {error}
        </div>
      )}
      {failed.length > 0 && !error && (
        <div style={{ fontSize: 10, color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>
          Keine Daten: {failed.join(", ")}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
        {/* CHART */}
        <div style={{ ...glass, padding: 16, flex: "1 1 560px", minWidth: 320 }}>
          {items.length > 0 ? (
            <RRGChart items={items} hovered={hovered} setHovered={setHovered} tailLen={tailLen}
              onNodeClick={preset.drillable && !drill
                ? (it) => { setDrill(it.symbol); setBenchMode("SECTOR"); setHovered(null); }
                : null} />
          ) : !loading && !error ? (
            <div style={{ padding: 90, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.3em", color: "#262626" }}>KEINE DATEN</div>
          ) : (
            <div style={{ padding: 90, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.22em", color: "#3d3d3d" }}>FETCHING {neededSymbols.length} SYMBOLS…</div>
          )}
          {preset.drillable && !drill && items.length > 0 && (
            <div style={{ textAlign: "center", fontSize: 8.5, color: "#4d4d4d", letterSpacing: "0.2em", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, textTransform: "uppercase", paddingBottom: 6 }}>
              Sektor anklicken → Drilldown mit Holdings + <span style={{ color: GOLD }}>VSX Watchlist</span>
            </div>
          )}
        </div>

        {/* RANKING */}
        <div style={{ ...glass, padding: "18px 18px 14px", flex: "1 1 330px", minWidth: 310 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 13 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: "0.2em", color: "#fdfdfd" }}>ROTATION RANKING</span>
            <span style={{ fontSize: 8, color: "#4a4a4a", letterSpacing: "0.16em", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{items.length} TITEL</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
            <thead>
              <tr style={{ fontSize: 8.5, letterSpacing: "0.16em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                {th("alpha", "Symbol")}
                {th("quad", "Quadrant")}
                {th("rsr", "RS-R", "right")}
                {th("rsm", "RS-M", "right")}
                <th style={{ width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(it => {
                const h = it.tail[it.tail.length - 1];
                const q = quadrantOf(h.x, h.y);
                return (
                  <tr key={it.symbol}
                    onMouseEnter={() => setHovered(it.symbol)} onMouseLeave={() => setHovered(null)}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: hovered === it.symbol ? "rgba(212,175,55,0.07)" : "transparent", transition: "background 0.15s" }}>
                    <td style={{ padding: "8px 8px", color: it.vsx ? "#f8e49b" : "#e8e8e8", fontWeight: it.vsx ? 700 : 400, whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: it.color, marginRight: 9, boxShadow: it.vsx ? `0 0 7px ${GOLD}` : "none" }} />
                      {it.label}
                      {it.custom && <span style={{ marginLeft: 6, fontSize: 7, color: "#666", letterSpacing: "0.1em" }}>ADD</span>}
                    </td>
                    <td style={{ padding: "8px 8px" }}>
                      <span style={{ fontSize: 8, letterSpacing: "0.12em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: QUAD_COLOR[q], background: `${QUAD_COLOR[q]}14`, border: `1px solid ${QUAD_COLOR[q]}30`, padding: "2.5px 8px", borderRadius: 20 }}>{q}</span>
                    </td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: h.x >= 100 ? "#22c55e" : "#ef4444" }}>{h.x.toFixed(2)}</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: h.y >= 100 ? "#22c55e" : "#ef4444" }}>{h.y.toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "center" }}>
                      <button onClick={() => removeSymbol(it.symbol)} title="Titel entfernen"
                        style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: 11, padding: 2, transition: "color 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = "#3a3a3a"}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
        JdK RS-Ratio / RS-Momentum als Normalisierungs-Approximation ({params.window}{interval_ === "1wk" ? "W" : "D"} Fenster · ROC {params.momP}). Structural analysis — not investment advice.
      </div>
    </div>
  );
}
