import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · RELATIVE ROTATION GRAPH v4
//  StockCharts-Aufbau: Benchmark-Preischart oben · Animate/History-Scrub ·
//  RRG breit · Ranking rechts · Detail-Tabelle unten. Packs für Sektoren,
//  Crypto & Countries (Pack Manager, localStorage). Volle Breite, sauber skaliert.
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";
const PACK_STORAGE_KEY = "vsx_rrg_pack_v2";

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

// ── PRESETS ──────────────────────────────────────────────────────────────────
const PRESETS = [
  {
    id: "sectors", label: "SPDR SECTORS", bench: "SPY", drillable: true,
    members: SECTORS.map(s => ({ symbol: s.etf, label: s.etf })),
  },
  {
    id: "countries", label: "COUNTRIES", bench: "SPY", drillable: false, packKey: "COUNTRIES",
    members: [
      ["EWG","GER"],["EWQ","FRA"],["EWU","UK"],["EWL","SUI"],["EWI","ITA"],["EWP","ESP"],
      ["EWJ","JPN"],["EWY","KOR"],["EWT","TWN"],["MCHI","CHN"],["EWH","HK"],["INDA","IND"],
      ["EWZ","BRA"],["EWW","MEX"],["EWC","CAN"],["EWA","AUS"],
    ].map(([s, l]) => ({ symbol: s, label: l })),
  },
  {
    id: "crypto", label: "CRYPTO", bench: "BTC-USD", drillable: false, cryptoSuffix: true, packKey: "CRYPTO",
    members: ["ETH","SOL","LINK","TRX","XRP","XLM","DOGE"].map(c => ({ symbol: `${c}-USD`, label: c })),
  },
];

// ── VSX PACK DEFAULTS · im Pack Manager editierbar (Sektoren + Crypto + Countries)
const VSX_PACK_DEFAULTS = {
  XLK:  ["ADBE","AMD","AAPL","INTC","MSFT","NVDA","PLTR","QBTS","RGTI","SNDK","WDAY","1810.HK"],
  XLF:  ["AXP","BRK-B","CRCL","COIN","FIS","FI","GS","JPM"],
  XLV:  ["BAYN.DE","HIMS","ILMN","JNJ","MRNA","MOH","NOVO-B.CO","PFE","REGN","UNH"],
  XLY:  ["ADS.DE","BABA","AMZN","BMW.DE","RACE.MI","LULU","MC.PA","MBG.DE","P911.DE","PHM","TSLA","TSCO","VSCO"],
  XLP:  ["EL","LISN.SW","OR.PA","NESN.SW","RI.PA"],
  XLE:  ["CVX","OXY"],
  XLI:  ["GE","RHM.DE"],
  XLB:  ["AEM","ALB","B","BAS.DE","DOW","AG","FCX","FRES.L","LAC","NEM","PAAS","SCCO"],
  XLRE: ["IRM"],
  XLU:  [],
  XLC:  ["ASTS","GOOGL","META","NFLX","RDDT","TMUS","0700.HK","TME"],
  CRYPTO:    ["SUI-USD","TAO-USD","HYPE-USD","FET-USD","PEPE-USD","AKT-USD","ZEC-USD"],
  COUNTRIES: [],
};

const PACK_TABS = [
  ...SECTORS.map(s => ({ key: s.etf, label: s.etf, name: s.name })),
  { key: "CRYPTO", label: "CRYPTO", name: "Crypto vs BTC" },
  { key: "COUNTRIES", label: "CTRY", name: "Countries vs SPY" },
];

const loadPack = () => {
  try {
    const raw = localStorage.getItem(PACK_STORAGE_KEY);
    if (raw) return { ...VSX_PACK_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* defaults */ }
  return { ...VSX_PACK_DEFAULTS };
};

// ── VOLLE NAMEN (Defaults · via Pack Manager überschreib-/ergänzbar) ─────────
const NAMES_STORAGE_KEY = "vsx_rrg_names_v1";
const NAME_DEFAULTS = {
  SPY: "SPDR S&P 500 ETF",
  XLK: "Technology Select Sector", XLF: "Financial Select Sector", XLV: "Health Care Select Sector",
  XLY: "Consumer Discretionary Select", XLP: "Consumer Staples Select", XLE: "Energy Select Sector",
  XLI: "Industrial Select Sector", XLB: "Materials Select Sector", XLRE: "Real Estate Select Sector",
  XLU: "Utilities Select Sector", XLC: "Communication Services Select",
  // Holdings
  MSFT: "Microsoft", AAPL: "Apple", NVDA: "NVIDIA", AVGO: "Broadcom", CRM: "Salesforce", ORCL: "Oracle",
  AMD: "Advanced Micro Devices", ADBE: "Adobe", CSCO: "Cisco Systems", ACN: "Accenture",
  "BRK-B": "Berkshire Hathaway", JPM: "JPMorgan Chase", V: "Visa", MA: "Mastercard", BAC: "Bank of America",
  WFC: "Wells Fargo", GS: "Goldman Sachs", MS: "Morgan Stanley", SPGI: "S&P Global", AXP: "American Express",
  LLY: "Eli Lilly & Co.", UNH: "UnitedHealth Group", JNJ: "Johnson & Johnson", ABBV: "AbbVie", MRK: "Merck & Co.",
  TMO: "Thermo Fisher Scientific", ABT: "Abbott Laboratories", AMGN: "Amgen", ISRG: "Intuitive Surgical", PFE: "Pfizer",
  AMZN: "Amazon", TSLA: "Tesla", HD: "Home Depot", MCD: "McDonald's", BKNG: "Booking Holdings", LOW: "Lowe's",
  TJX: "TJX Companies", NKE: "Nike", SBUX: "Starbucks", CMG: "Chipotle Mexican Grill",
  PG: "Procter & Gamble", COST: "Costco Wholesale", WMT: "Walmart", KO: "Coca-Cola", PEP: "PepsiCo",
  PM: "Philip Morris Intl.", MDLZ: "Mondelez Intl.", MO: "Altria Group", CL: "Colgate-Palmolive", TGT: "Target",
  XOM: "Exxon Mobil", CVX: "Chevron", COP: "ConocoPhillips", WMB: "Williams Companies", EOG: "EOG Resources",
  SLB: "Schlumberger", PSX: "Phillips 66", MPC: "Marathon Petroleum", KMI: "Kinder Morgan", OKE: "ONEOK",
  GE: "GE Aerospace", CAT: "Caterpillar", UBER: "Uber Technologies", RTX: "RTX Corp.", HON: "Honeywell",
  UNP: "Union Pacific", ETN: "Eaton", BA: "Boeing", DE: "Deere & Co.", LMT: "Lockheed Martin",
  LIN: "Linde", SHW: "Sherwin-Williams", APD: "Air Products", ECL: "Ecolab", FCX: "Freeport-McMoRan",
  NEM: "Newmont", CTVA: "Corteva", DD: "DuPont", DOW: "Dow Inc.", PPG: "PPG Industries",
  PLD: "Prologis", AMT: "American Tower", EQIX: "Equinix", WELL: "Welltower", SPG: "Simon Property Group",
  PSA: "Public Storage", O: "Realty Income", CCI: "Crown Castle", DLR: "Digital Realty", VICI: "VICI Properties",
  NEE: "NextEra Energy", SO: "Southern Company", DUK: "Duke Energy", CEG: "Constellation Energy", SRE: "Sempra",
  AEP: "American Electric Power", D: "Dominion Energy", PCG: "PG&E", EXC: "Exelon", XEL: "Xcel Energy",
  META: "Meta Platforms", GOOGL: "Alphabet", NFLX: "Netflix", DIS: "Walt Disney", CMCSA: "Comcast",
  T: "AT&T", VZ: "Verizon", TMUS: "T-Mobile US", EA: "Electronic Arts", WBD: "Warner Bros. Discovery",
  // VSX Pack
  "ADS.DE": "Adidas", INTC: "Intel", PLTR: "Palantir Technologies", QBTS: "D-Wave Quantum", RGTI: "Rigetti Computing",
  SNDK: "Sandisk", WDAY: "Workday", "1810.HK": "Xiaomi", CRCL: "Circle Internet Group", COIN: "Coinbase",
  FIS: "Fidelity National Info.", FI: "Fiserv", "BAYN.DE": "Bayer", HIMS: "Hims & Hers Health", ILMN: "Illumina",
  MRNA: "Moderna", MOH: "Molina Healthcare", "NOVO-B.CO": "Novo Nordisk", REGN: "Regeneron Pharmaceuticals",
  BABA: "Alibaba Group", "BMW.DE": "BMW", "RACE.MI": "Ferrari", LULU: "Lululemon Athletica", "MC.PA": "LVMH",
  "MBG.DE": "Mercedes-Benz Group", "P911.DE": "Porsche AG", PHM: "PulteGroup", TSCO: "Tractor Supply",
  VSCO: "Victoria's Secret", EL: "Estée Lauder", "LISN.SW": "Lindt & Sprüngli", "OR.PA": "L'Oréal",
  "NESN.SW": "Nestlé", "RI.PA": "Pernod Ricard", OXY: "Occidental Petroleum", "RHM.DE": "Rheinmetall",
  AEM: "Agnico Eagle Mines", ALB: "Albemarle", B: "Barrick Mining", "BAS.DE": "BASF", AG: "First Majestic Silver",
  "FRES.L": "Fresnillo", LAC: "Lithium Americas", PAAS: "Pan American Silver", SCCO: "Southern Copper",
  IRM: "Iron Mountain", ASTS: "AST SpaceMobile", RDDT: "Reddit", "0700.HK": "Tencent Holdings", TME: "Tencent Music",
  // Crypto
  "BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana", "LINK-USD": "Chainlink", "TRX-USD": "Tron",
  "XRP-USD": "XRP", "XLM-USD": "Stellar", "DOGE-USD": "Dogecoin", "SUI-USD": "Sui", "TAO-USD": "Bittensor",
  "HYPE-USD": "Hyperliquid", "FET-USD": "Fetch.ai / ASI", "PEPE-USD": "Pepe", "AKT-USD": "Akash Network", "ZEC-USD": "Zcash",
  // Countries
  EWG: "Germany (MSCI)", EWQ: "France (MSCI)", EWU: "United Kingdom (MSCI)", EWL: "Switzerland (MSCI)",
  EWI: "Italy (MSCI)", EWP: "Spain (MSCI)", EWJ: "Japan (MSCI)", EWY: "South Korea (MSCI)", EWT: "Taiwan (MSCI)",
  MCHI: "China (MSCI)", EWH: "Hong Kong (MSCI)", INDA: "India (MSCI)", EWZ: "Brazil (MSCI)", EWW: "Mexico (MSCI)",
  EWC: "Canada (MSCI)", EWA: "Australia (MSCI)",
};

const loadNames = () => {
  try {
    const raw = localStorage.getItem(NAMES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return {};
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

// Volle RS-Ratio/-Momentum-Serien (für Animate/History-Scrub)
const computeFull = (series, bench, { window: W }) => {
  const bMap = new Map(bench.map(([t, c]) => [new Date(t).toISOString().slice(0, 10), c]));
  const sMap = new Map(series.map(([t, c]) => [new Date(t).toISOString().slice(0, 10), c]));
  const rs = []; const ts = []; const px = [];
  let lastS = null;
  for (const [t] of bench) {
    const key = new Date(t).toISOString().slice(0, 10);
    const b = bMap.get(key);
    const s = sMap.has(key) ? sMap.get(key) : lastS;
    if (sMap.has(key)) lastS = sMap.get(key);
    if (b != null && s != null) { rs.push(100 * s / b); ts.push(t); px.push(s); }
  }
  if (rs.length < 2 * W + 4) return null;

  // ── JdK-Approximation (StockCharts-Logik) ────────────────────────────────
  // RS        = 100 · Preis / Benchmark          → reine Relative Stärke
  // RS-Ratio  = 100 · RS / SMA(RS, W)            → RS relativ zum eigenen Trend
  // RS-Mom    = 100 · Ratio / SMA(Ratio, W)      → Ratio relativ zu IHREM Trend
  // Beide Achsen nutzen dasselbe lange Fenster W. Das entkoppelt Momentum von
  // der Ratio-Steigung (kein Diagonal-Artefakt) und erzeugt die echten Loops:
  // ein Wert kann rechts stehen (Ratio > 100) und trotzdem fallen (Mom < 100).
  const smaAt = (arr, i, n) => {
    let s = 0;
    for (let k = i - n + 1; k <= i; k++) { if (arr[k] == null) return null; s += arr[k]; }
    return s / n;
  };
  const ratio = new Array(rs.length).fill(null);
  for (let i = W - 1; i < rs.length; i++) {
    const m = smaAt(rs, i, W);
    ratio[i] = m > 1e-9 ? (100 * rs[i]) / m : null;
  }
  const mom = new Array(rs.length).fill(null);
  for (let i = 2 * W - 2; i < rs.length; i++) {
    const m = smaAt(ratio, i, W);
    mom[i] = m != null && m > 1e-9 ? (100 * ratio[i]) / m : null;
  }

  // Auf valide Punkte trimmen
  const xs = [], ys = [], tts = [], pxs = [];
  for (let i = 0; i < rs.length; i++) {
    if (ratio[i] != null && mom[i] != null) { xs.push(ratio[i]); ys.push(mom[i]); tts.push(ts[i]); pxs.push(px[i]); }
  }
  return xs.length >= 4 ? { xs, ys, ts: tts, px: pxs } : null;
};

const tailOf = (full, offset, tailLen) => {
  const end = full.xs.length - 1 - offset;
  const start = end - tailLen + 1;
  if (start < 0 || end < 1) return null;
  const tail = [];
  for (let i = Math.max(0, start); i <= end; i++) tail.push({ x: full.xs[i], y: full.ys[i], t: full.ts[i] });
  return tail.length >= 2 ? tail : null;
};

// Interpolierter Tail für fließende Animation (offset darf float sein)
const tailAtFloat = (full, offsetF, tailLen) => {
  const k = Math.floor(offsetF), f = offsetF - k;
  const a = tailOf(full, k, tailLen);
  if (f < 1e-4) return a;
  const b = tailOf(full, k + 1, tailLen);
  if (!a || !b || a.length !== b.length) return a || b;
  return a.map((p, i) => ({ x: p.x * (1 - f) + b[i].x * f, y: p.y * (1 - f) + b[i].y * f, t: p.t }));
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
    const res = await fetch(`/api/history?symbols=${chunk.join(",")}&interval=1d&range=10y`);
    if (!res.ok) throw new Error(`API ${res.status} — läuft die Seite auf Vercel / \`vercel dev\`?`);
    const json = await res.json();
    Object.assign(out, json.data);
    failed.push(...(json.failed || []));
  }
  return { data: out, failed };
};

// ── SMOOTH TAIL ──────────────────────────────────────────────────────────────
const smoothSegs = (pts) => {
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    segs.push(`M ${p1.x} ${p1.y} C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`);
  }
  return segs;
};

const fmtDate = t => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ── BENCHMARK-PREISCHART (nur scrubbare Range · Fenster direkt verschiebbar) ─
function BenchChart({ series, label, offset, tailLen, onScrub, maxOffset }) {
  const W = 1480, H = 110, PADL = 52, PADR = 18, PADT = 8, PADB = 4;
  const plotW = W - PADL - PADR, plotH = H - PADT - PADB;
  const svgRef = useRef(null);
  const draggingRef = useRef(false);
  const n = series.length;
  if (n < 10) return null;
  let min = Infinity, max = -Infinity;
  series.forEach(([, c]) => { if (c < min) min = c; if (c > max) max = c; });
  const X = i => PADL + (i / (n - 1)) * plotW;
  const Y = c => PADT + (1 - (c - min) / (max - min || 1)) * plotH;
  const path = series.map(([, c], i) => `${i ? "L" : "M"} ${X(i).toFixed(1)} ${Y(c).toFixed(1)}`).join(" ");
  const area = `${path} L ${X(n - 1)} ${H - PADB} L ${X(0)} ${H - PADB} Z`;
  const off = Math.round(offset);
  const end = n - 1 - off, start = Math.max(0, end - tailLen + 1);
  const last = series[end] || series[n - 1];

  const scrubTo = (clientX) => {
    const r = svgRef.current.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    const idx = Math.round(((px - PADL) / plotW) * (n - 1));
    const endIdx = Math.min(n - 1, Math.max(tailLen - 1, idx));
    onScrub(Math.min(maxOffset, Math.max(0, (n - 1) - endIdx)));
  };
  const onPointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubTo(e.clientX);
  };
  const onPointerMove = (e) => { if (draggingRef.current) scrubTo(e.clientX); };
  const onPointerUp = () => { draggingRef.current = false; };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      style={{ width: "100%", display: "block", cursor: "ew-resize", touchAction: "none" }}>
      <defs>
        <linearGradient id="bench-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(212,175,55,0.16)" /><stop offset="100%" stopColor="rgba(212,175,55,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#bench-fill)" />
      <path d={path} fill="none" stroke="rgba(212,175,55,0.55)" strokeWidth="1.4" />
      {/* Aktives Tail-Fenster — direkt verschiebbar */}
      <rect x={X(start)} y={PADT} width={Math.max(2, X(end) - X(start))} height={plotH}
        fill="rgba(212,175,55,0.13)" stroke="rgba(212,175,55,0.6)" strokeWidth="1" rx="2" />
      <line x1={X(end)} y1={PADT} x2={X(end)} y2={PADT + plotH} stroke="#f8e49b" strokeWidth="1.5" />
      <text x={PADL} y={PADT + 11} fill="#f8e49b" style={{ font: "700 11px 'Bebas Neue', sans-serif", letterSpacing: "0.15em", pointerEvents: "none" }}>
        {label}
      </text>
      <text x={PADL + 52} y={PADT + 11} fill="#555" style={{ font: "500 8.5px 'DM Mono', monospace", letterSpacing: "0.08em", pointerEvents: "none" }}>
        {last ? `${last[1].toFixed(2)} · ${tailLen} PERIODS ENDING ${fmtDate(series[end]?.[0] || series[n - 1][0]).toUpperCase()} · DRAG WINDOW` : ""}
      </text>
    </svg>
  );
}

// ── RRG-CHART (breites Rechteck · zoombar) ───────────────────────────────────
function RRGChart({ items, hovered, setHovered, onNodeClick, tailLen, ext, showTails }) {
  const W = 1480, H = 560, PADL = 52, PADR = 18, PADT = 14, PADB = 38;
  const plotW = W - PADL - PADR, plotH = H - PADT - PADB;
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [view, setView] = useState({ cx: 100, cy: 100, z: 1 });

  // Feste, getrennte Extents je Achse über die gesamte scrubbare Historie
  const halfX = ext.x / view.z;
  const halfY = ext.y / view.z;
  const X = v => PADL + ((v - (view.cx - halfX)) / (2 * halfX)) * plotW;
  const Y = v => PADT + (1 - (v - (view.cy - halfY)) / (2 * halfY)) * plotH;

  const zoomAt = useCallback((factor, px, py) => {
    setView(v => {
      const z = Math.min(8, Math.max(1, v.z * factor));
      if (z === 1) return { cx: 100, cy: 100, z: 1 };
      const hx0 = ext.x / v.z, hx1 = ext.x / z;
      const hy0 = ext.y / v.z, hy1 = ext.y / z;
      const dx = px != null ? (v.cx - hx0 + ((px - PADL) / plotW) * 2 * hx0) : v.cx;
      const dy = py != null ? (v.cy - hy0 + (1 - (py - PADT) / plotH) * 2 * hy0) : v.cy;
      return { z, cx: dx - (dx - v.cx) * (hx1 / hx0), cy: dy - (dy - v.cy) * (hy1 / hy0) };
    });
  }, [ext.x, ext.y, plotW, plotH]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const py = ((e.clientY - r.top) / r.height) * H;
      zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, px, py);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e) => {
    if (view.z === 1) return;
    dragRef.current = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const r = svgRef.current.getBoundingClientRect();
    const sx = (2 * halfX) / (plotW * (r.width / W));
    const sy = (2 * halfY) / (plotH * (r.height / H));
    setView(v => ({ ...v, cx: d.cx - (e.clientX - d.x) * sx, cy: d.cy + (e.clientY - d.y) * sy }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const zoomBtn = {
    width: 30, height: 30, borderRadius: 9, cursor: "pointer",
    background: "rgba(18,18,18,0.75)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#c9c9c9", fontSize: 13, fontFamily: "'DM Mono', monospace",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
  };

  const stepFor = h => h >= 8 ? 4 : h >= 4 ? 2 : h >= 2 ? 1 : 0.5;
  const gsX = stepFor(halfX), gsY = stepFor(halfY);
  const gridLines = [];
  for (let g = Math.ceil((view.cx - halfX) / gsX) * gsX; g <= view.cx + halfX; g += gsX) {
    if (Math.abs(g - 100) > 1e-9) gridLines.push({ o: "v", v: g });
  }
  for (let g = Math.ceil((view.cy - halfY) / gsY) * gsY; g <= view.cy + halfY; g += gsY) {
    if (Math.abs(g - 100) > 1e-9) gridLines.push({ o: "h", v: g });
  }

  const cxP = X(100), cyP = Y(100);
  const R = W - PADR, B = H - PADB;

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        style={{ width: "100%", display: "block", touchAction: "none", cursor: view.z > 1 ? "grab" : "default" }}>
        <defs>
          <clipPath id="rrg-clip"><rect x={PADL} y={PADT} width={plotW} height={plotH} rx="4" /></clipPath>
          <linearGradient id="q-lead" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(34,197,94,0.03)" /><stop offset="100%" stopColor="rgba(34,197,94,0.14)" />
          </linearGradient>
          <linearGradient id="q-weak" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(250,204,21,0.025)" /><stop offset="100%" stopColor="rgba(250,204,21,0.11)" />
          </linearGradient>
          <linearGradient id="q-lag" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(239,68,68,0.03)" /><stop offset="100%" stopColor="rgba(239,68,68,0.13)" />
          </linearGradient>
          <linearGradient id="q-imp" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(99,182,255,0.03)" /><stop offset="100%" stopColor="rgba(99,182,255,0.12)" />
          </linearGradient>
        </defs>

        <rect x={PADL} y={PADT} width={plotW} height={plotH} rx="4" fill="rgba(255,255,255,0.012)" />
        <g clipPath="url(#rrg-clip)">
          <rect x={cxP} y={PADT} width={Math.max(0, R - cxP)} height={Math.max(0, cyP - PADT)} fill="url(#q-lead)" />
          <rect x={cxP} y={cyP} width={Math.max(0, R - cxP)} height={Math.max(0, B - cyP)} fill="url(#q-weak)" />
          <rect x={PADL} y={cyP} width={Math.max(0, cxP - PADL)} height={Math.max(0, B - cyP)} fill="url(#q-lag)" />
          <rect x={PADL} y={PADT} width={Math.max(0, cxP - PADL)} height={Math.max(0, cyP - PADT)} fill="url(#q-imp)" />

          {gridLines.map((g, i) => g.o === "v"
            ? <line key={i} x1={X(g.v)} y1={PADT} x2={X(g.v)} y2={B} stroke="rgba(255,255,255,0.03)" />
            : <line key={i} x1={PADL} y1={Y(g.v)} x2={R} y2={Y(g.v)} stroke="rgba(255,255,255,0.03)" />)}

          <line x1={cxP} y1={PADT} x2={cxP} y2={B} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 6" />
          <line x1={PADL} y1={cyP} x2={R} y2={cyP} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 6" />

          {items.map(it => {
            const dim = hovered && hovered !== it.symbol;
            const head = it.tail[it.tail.length - 1];
            const pts = it.tail.map(p => ({ x: X(p.x), y: Y(p.y) }));
            const segs = smoothSegs(pts);
            return (
              <g key={it.symbol} opacity={dim ? 0.1 : 1} style={{ transition: "opacity 0.25s", cursor: onNodeClick ? "pointer" : undefined }}
                onMouseEnter={() => setHovered(it.symbol)} onMouseLeave={() => setHovered(null)}
                onClick={() => onNodeClick && onNodeClick(it)}>
                {showTails && segs.map((d, i) => (
                  <path key={i} d={d} fill="none" stroke={it.color}
                    strokeWidth={it.vsx ? 1.8 : 1.45}
                    opacity={0.08 + 0.5 * (i / Math.max(1, segs.length - 1))}
                    strokeLinecap="round" />
                ))}
                {showTails && pts.slice(0, -1).map((p, i) => (
                  <circle key={"d" + i} cx={p.x} cy={p.y} r={1.4} fill={it.color} opacity={0.12 + 0.42 * (i / Math.max(1, tailLen - 1))} />
                ))}
                {it.vsx && <circle cx={X(head.x)} cy={Y(head.y)} r={9} fill="none" stroke={GOLD} strokeWidth={0.75} opacity={0.45} />}
                <circle cx={X(head.x)} cy={Y(head.y)} r={5.2} fill={it.color}
                  stroke={it.vsx ? GOLD : "#0a0a0a"} strokeWidth={it.vsx ? 1.2 : 1.4}
                  style={it.vsx ? { filter: "drop-shadow(0 0 5px rgba(212,175,55,0.55))" } : {}} />
                <text x={X(head.x)} y={Y(head.y) - 10.5} textAnchor="middle"
                  fill={it.vsx ? "#f8e49b" : "#eaeaea"}
                  style={{ font: `700 ${it.vsx ? 11 : 10.5}px Montserrat, sans-serif`, letterSpacing: "0.06em", paintOrder: "stroke", stroke: "#0a0a0add", strokeWidth: 3.5 }}>
                  {it.label}
                </text>
              </g>
            );
          })}
        </g>

        <rect x={PADL} y={PADT} width={plotW} height={plotH} rx="4" fill="none" stroke="rgba(255,255,255,0.09)" />
        {[["LEADING", R - 12, PADT + 20, "end", "#22c55e"], ["WEAKENING", R - 12, B - 12, "end", "#facc15"],
          ["LAGGING", PADL + 12, B - 12, "start", "#ef4444"], ["IMPROVING", PADL + 12, PADT + 20, "start", "#63b6ff"]]
          .map(([label, x, y, anchor, col]) => (
            <text key={label} x={x} y={y} textAnchor={anchor} fill={col} opacity={0.6}
              style={{ font: "700 11px Montserrat, sans-serif", letterSpacing: "0.26em" }}>{label}</text>
          ))}
        <text x={PADL + plotW / 2} y={H - 9} textAnchor="middle" fill="#4a4a4a" style={{ font: "500 9.5px 'DM Mono', monospace", letterSpacing: "0.18em" }}>JDK RS-RATIO →</text>
        <text x={16} y={PADT + plotH / 2} textAnchor="middle" fill="#4a4a4a" transform={`rotate(-90 16 ${PADT + plotH / 2})`} style={{ font: "500 9.5px 'DM Mono', monospace", letterSpacing: "0.18em" }}>JDK RS-MOMENTUM →</text>
      </svg>

      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 7 }}>
        <button style={zoomBtn} onClick={() => zoomAt(1.35)} title="Zoom in"
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"; e.currentTarget.style.color = "#f8e49b"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#c9c9c9"; }}>＋</button>
        <button style={zoomBtn} onClick={() => zoomAt(1 / 1.35)} title="Zoom out"
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"; e.currentTarget.style.color = "#f8e49b"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#c9c9c9"; }}>−</button>
        {view.z > 1 && (
          <button style={{ ...zoomBtn, color: GOLD, borderColor: "rgba(212,175,55,0.4)" }}
            onClick={() => setView({ cx: 100, cy: 100, z: 1 })} title="Zoom zurücksetzen">⟲</button>
        )}
      </div>
      {view.z > 1 && (
        <div style={{ position: "absolute", bottom: 12, right: 12, fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#666", letterSpacing: "0.14em", background: "rgba(18,18,18,0.7)", padding: "4px 9px", borderRadius: 7, backdropFilter: "blur(10px)" }}>
          {view.z.toFixed(1)}× · DRAG TO PAN
        </div>
      )}
    </div>
  );
}

// ── PACK MANAGER MODAL ───────────────────────────────────────────────────────
function PackManager({ pack, setPack, names, setNames, onClose }) {
  const [sel, setSel] = useState("XLK");
  const [inp, setInp] = useState("");
  const [nameInp, setNameInp] = useState("");
  const titles = pack[sel] || [];
  const selTab = PACK_TABS.find(t => t.key === sel);

  const add = () => {
    let sym = inp.trim().toUpperCase();
    if (!sym) return;
    if (sel === "CRYPTO" && !sym.includes("-") && !sym.includes(".")) sym = `${sym}-USD`;
    setPack(p => ({ ...p, [sel]: [...new Set([...(p[sel] || []), sym])] }));
    const nm = nameInp.trim();
    if (nm) setNames(n => ({ ...n, [sym]: nm }));
    setInp(""); setNameInp("");
  };
  const remove = (sym) => setPack(p => ({ ...p, [sel]: (p[sel] || []).filter(s => s !== sym) }));
  const clearSector = () => setPack(p => ({ ...p, [sel]: [] }));
  const resetAll = () => setPack({ ...VSX_PACK_DEFAULTS });

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "rgba(17,17,17,0.97)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, width: 680, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", padding: "26px 28px 24px", fontFamily: "'Montserrat', sans-serif", color: "#e8e8e8", boxShadow: "0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.2em", color: "#fdfdfd" }}>
              <span style={{ color: GOLD }}>◆</span> VSX PACK MANAGER
            </div>
            <div style={{ fontSize: 8, letterSpacing: "0.3em", color: "#b99c64", textTransform: "uppercase", marginTop: 4 }}>Watchlist-Titel je Paket · lokal gespeichert</div>
          </div>
          <button onClick={onClose}
            onMouseEnter={e => { e.currentTarget.style.color = GOLD; e.currentTarget.style.transform = "rotate(90deg)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#444"; e.currentTarget.style.transform = "none"; }}
            style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 18, padding: "4px 8px", transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "18px 0 20px" }}>
          {PACK_TABS.map(t => (
            <button key={t.key} onClick={() => setSel(t.key)} title={t.name}
              style={{
                padding: "7px 13px", borderRadius: 9, cursor: "pointer",
                fontFamily: "'Montserrat', sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
                background: sel === t.key ? "rgba(212,175,55,0.13)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${sel === t.key ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.07)"}`,
                color: sel === t.key ? "#f8e49b" : (SECTOR_COLORS[t.key] ? `${SECTOR_COLORS[t.key]}99` : "#b99c64"),
                transition: "all 0.2s",
              }}>
              {t.label}<span style={{ marginLeft: 6, fontSize: 8, color: "#666" }}>{(pack[t.key] || []).length}</span>
            </button>
          ))}
        </div>

        <div style={{ fontSize: 9, letterSpacing: "0.22em", color: "#888", textTransform: "uppercase", marginBottom: 10 }}>
          {selTab?.name} · {titles.length} Titel
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20, minHeight: 36 }}>
          {titles.length === 0 && (
            <span style={{ fontSize: 10, color: "#3a3a3a", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", padding: "8px 0" }}>— leer —</span>
          )}
          {titles.map(t => (
            <span key={t} title={names[t] || NAME_DEFAULTS[t] || ""} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 12px", borderRadius: 9, background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.25)", fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: "#f8e49b", letterSpacing: "0.06em" }}>
              {t}
              {(names[t] || NAME_DEFAULTS[t]) && (
                <span style={{ fontSize: 8.5, color: "#8a7440", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.02em", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names[t] || NAME_DEFAULTS[t]}</span>
              )}
              <button onClick={() => remove(t)}
                style={{ background: "none", border: "none", color: "#7a6a3d", cursor: "pointer", fontSize: 10, padding: 0, transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={e => e.currentTarget.style.color = "#7a6a3d"}>✕</button>
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 9, marginBottom: 22, flexWrap: "wrap" }}>
          <input value={inp} onChange={e => setInp(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder={sel === "CRYPTO" ? "TICKER · z.B. PEPE" : "TICKER · z.B. NVDA, BAS.DE"}
            style={{ flex: "1 1 180px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "#f8e49b", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.1em", padding: "10px 15px", borderRadius: 11, outline: "none", textTransform: "uppercase" }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"} />
          <input value={nameInp} onChange={e => setNameInp(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder="Voller Name · z.B. NVIDIA Corp. (optional)"
            style={{ flex: "2 1 240px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "#c9c9c9", fontFamily: "'Montserrat', sans-serif", fontSize: 12, padding: "10px 15px", borderRadius: 11, outline: "none" }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"} />
          <button onClick={add}
            style={{ padding: "10px 20px", borderRadius: 11, cursor: "pointer", background: "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.08))", border: "1px solid rgba(212,175,55,0.5)", color: "#f8e49b", fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em" }}>+ ADD</button>
        </div>

        <div style={{ display: "flex", gap: 9, justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 18 }}>
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={clearSector}
              style={{ padding: "9px 16px", borderRadius: 9, cursor: "pointer", background: "transparent", border: "1px solid rgba(239,68,68,0.25)", color: "#b06060", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em" }}>PAKET LEEREN</button>
            <button onClick={resetAll}
              style={{ padding: "9px 16px", borderRadius: 9, cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#777", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em" }}>↺ DEFAULTS</button>
          </div>
          <button onClick={onClose}
            style={{ padding: "9px 24px", borderRadius: 9, cursor: "pointer", background: "linear-gradient(135deg, #d4af37, #b8963c)", border: "none", color: "#0a0a0a", fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em" }}>FERTIG</button>
        </div>
      </div>
    </div>
  , document.body);
}

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function RRG() {
  const [presetId, setPresetId] = useState("sectors");
  const [drill, setDrill] = useState(null);
  const [interval_, setInterval_] = useState("1d");
  const [tailLen, setTailLen] = useState(5);
  const [showTails, setShowTails] = useState(true);
  const [benchMode, setBenchMode] = useState("SECTOR");
  const [vsxPack, setVsxPack] = useState(true);
  const [pack, setPack] = useState(loadPack);
  const [names, setNames] = useState(loadNames);
  const [showManager, setShowManager] = useState(false);
  const [customAdd, setCustomAdd] = useState({});
  const [removed, setRemoved] = useState({});
  const [addInput, setAddInput] = useState("");
  const [sort, setSort] = useState({ key: "quad", dir: "asc" });
  const [raw, setRaw] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);
  const [hovered, setHovered] = useState(null);
  const [offset, setOffset] = useState(0);          // History-Scrub: 0 = aktuell
  const [playing, setPlaying] = useState(false);
  const cacheRef = useRef({});

  const MAX_OFFSET = 60;

  useEffect(() => {
    try { localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(pack)); } catch { /* private mode */ }
  }, [pack]);
  useEffect(() => {
    try { localStorage.setItem(NAMES_STORAGE_KEY, JSON.stringify(names)); } catch { /* private mode */ }
  }, [names]);

  // Animate: fließend via requestAnimationFrame (interpolierte Frames)
  useEffect(() => {
    if (!playing) return;
    let raf; let lastT = performance.now();
    const SPEED = 4; // Perioden pro Sekunde (−20%)
    const step = (now) => {
      const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
      setOffset(o => Math.max(0, o - dt * SPEED));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  useEffect(() => { if (playing && offset <= 0) setPlaying(false); }, [playing, offset]);

  const preset = PRESETS.find(p => p.id === presetId);
  const drillSector = drill ? SECTORS.find(s => s.etf === drill) : null;
  const viewKey = drill ? `${presetId}:${drill}` : presetId;

  const benchSym = drill ? (benchMode === "SECTOR" ? drill : preset.bench) : preset.bench;
  const benchLabel = benchSym.replace("-USD", "");

  const universe = useMemo(() => {
    const rm = new Set(removed[viewKey] || []);
    const custom = customAdd[viewKey] || [];
    let base;
    if (drill) {
      const packTitles = vsxPack ? (pack[drill] || []) : [];
      base = [
        ...drillSector.holdings.filter(h => !packTitles.includes(h)).map(h => ({ symbol: h, label: h, vsx: false })),
        ...packTitles.map(w => ({ symbol: w, label: w.replace(/\.[A-Z]+$|-USD$/, ""), vsx: true })),
      ];
    } else {
      const packKey = preset.packKey;
      const packTitles = packKey && vsxPack ? (pack[packKey] || []) : [];
      const memberSyms = new Set(preset.members.map(m => m.symbol));
      base = [
        ...preset.members.map(m => ({ ...m, vsx: false })),
        ...packTitles.filter(w => !memberSyms.has(w)).map(w => ({ symbol: w, label: w.replace(/\.[A-Z]+$|-USD$/, ""), vsx: true })),
      ];
    }
    const known = new Set(base.map(b => b.symbol));
    custom.forEach(c => { if (!known.has(c)) base.push({ symbol: c, label: c.replace("-USD", ""), vsx: false, custom: true }); });
    return base.filter(b => !rm.has(b.symbol) && b.symbol !== benchSym);
  }, [preset, drill, drillSector, viewKey, customAdd, removed, benchSym, vsxPack, pack]);

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
    ? { window: 52 }     // 1 Jahr Trendbasis (StockCharts-Default)
    : { window: 252 };

  const benchSeries = useMemo(() => {
    const s = raw[benchSym];
    if (!s) return null;
    return interval_ === "1wk" ? toWeekly(s) : s;
  }, [raw, benchSym, interval_]);

  // Volle Serien je Symbol
  const fullItems = useMemo(() => {
    if (!benchSeries) return [];
    const prep = s => interval_ === "1wk" ? toWeekly(s) : s;
    return universe.map((u, i) => {
      if (!raw[u.symbol]) return null;
      const full = computeFull(prep(raw[u.symbol]), benchSeries, params);
      if (!full) return null;
      const color = u.vsx ? GOLD : (SECTOR_COLORS[u.symbol] || PALETTE[i % PALETTE.length]);
      return { ...u, color, full };
    }).filter(Boolean);
  }, [raw, universe, interval_, benchSeries, params.window]);

  // Anzeige-Tails am aktuellen (float-)Offset — interpoliert für smooth Animation
  const items = useMemo(() =>
    fullItems.map(it => {
      const tail = tailAtFloat(it.full, offset, tailLen);
      return tail ? { ...it, tail } : null;
    }).filter(Boolean),
  [fullItems, offset, tailLen]);

  // Feste, getrennte X/Y-Extents über die komplette scrubbare Range (kein Jiggle)
  const chartExt = useMemo(() => {
    let mx = 1.5, my = 1.5;
    fullItems.forEach(it => {
      const len = it.full.xs.length;
      const start = Math.max(0, len - MAX_OFFSET - tailLen);
      for (let i = start; i < len; i++) {
        mx = Math.max(mx, Math.abs(it.full.xs[i] - 100));
        my = Math.max(my, Math.abs(it.full.ys[i] - 100));
      }
    });
    return { x: mx * 1.08, y: my * 1.08 };
  }, [fullItems, tailLen]);

  const sorted = useMemo(() => {
    const arr = [...items];
    const head = it => it.tail[it.tail.length - 1];
    const dist = it => { const h = head(it); return Math.hypot(h.x - 100, h.y - 100); };
    const cmp = {
      alpha: (a, b) => a.label.localeCompare(b.label),
      quad:  (a, b) => (QUAD_ORDER[quadrantOf(head(a).x, head(a).y)] - QUAD_ORDER[quadrantOf(head(b).x, head(b).y)]) || (dist(b) - dist(a)),
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

  const headDate = items[0]?.tail?.[items[0].tail.length - 1]?.t;

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const glass = {
    background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015) 55%, rgba(212,175,55,0.02))",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
    backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)",
    boxShadow: "0 14px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
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
      style={{ padding: "6px 9px", textAlign: align, cursor: "pointer", userSelect: "none", color: sort.key === key ? "#f8e49b" : "#555", transition: "color 0.2s" }}>
      {label}{sort.key === key ? (sort.dir === "desc" ? " ▾" : " ▴") : ""}
    </th>
  );

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "calc(100vh - 76px)" }}>
      {/* AMBIENT */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -220, right: "-6%", width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.06), transparent 62%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: -320, left: "-10%", width: 880, height: 880, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,182,255,0.04), transparent 62%)", filter: "blur(60px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1840, margin: "0 auto", padding: "20px 30px 50px" }}>
        {/* TITELZEILE */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 14, marginBottom: 12 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 27, letterSpacing: "0.2em", color: "#fdfdfd" }}>
            RELATIVE ROTATION
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.28em", color: "#b99c64", textTransform: "uppercase" }}>
            {drill ? `${drill} · ${drillSector.name}` : preset.label}
          </div>
          {headDate && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: "#555", letterSpacing: "0.1em" }}>
              {tailLen} {interval_ === "1wk" ? "WEEKS" : "DAYS"} ENDING {fmtDate(headDate).toUpperCase()}
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, boxShadow: `0 0 8px ${GOLD}` }} />
            BASIS <span style={{ color: "#f8e49b" }}>{benchLabel}</span>
          </div>
        </div>

        {/* PRESETS */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, marginBottom: 8 }}>
          {PRESETS.map(p => (
            <button key={p.id} style={pill(presetId === p.id && !drill)}
              onClick={() => { setPresetId(p.id); setDrill(null); setHovered(null); setOffset(0); setPlaying(false); }}>
              {p.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowManager(true)}
            style={{ ...pill(false), display: "flex", alignItems: "center", gap: 7, color: "#b99c64", borderColor: "rgba(212,175,55,0.25)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.55)"; e.currentTarget.style.color = "#f8e49b"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.25)"; e.currentTarget.style.color = "#b99c64"; }}>
            <span style={{ fontSize: 8 }}>◆</span> PACK MANAGER
          </button>
        </div>
        {presetId === "sectors" && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 10 }}>
            {SECTORS.map(s => (
              <button key={s.etf} title={s.name}
                style={{ ...pill(drill === s.etf), padding: "6.5px 12px", fontSize: 9, letterSpacing: "0.12em",
                  color: drill === s.etf ? "#f8e49b" : (SECTOR_COLORS[s.etf] ? `${SECTOR_COLORS[s.etf]}aa` : "#777") }}
                onClick={() => { setDrill(d => d === s.etf ? null : s.etf); setBenchMode("SECTOR"); setHovered(null); setOffset(0); setPlaying(false); }}>
                {s.etf}
              </button>
            ))}
          </div>
        )}

        {/* CONTROLS */}
        <div style={{ ...glass, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 11, padding: "11px 16px", marginBottom: 14 }}>
          <button onClick={() => { if (playing) { setPlaying(false); } else { setOffset(o => o > 0 ? o : MAX_OFFSET); setPlaying(true); } }}
            style={{ ...pill(playing), display: "flex", alignItems: "center", gap: 8, background: playing ? "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.09))" : "linear-gradient(135deg, #d4af37, #b8963c)", color: playing ? "#f8e49b" : "#0a0a0a", border: "1px solid rgba(212,175,55,0.6)" }}>
            {playing ? "⏸ PAUSE" : "▶ ANIMATE"}
          </button>
          <span style={{ fontSize: 9, letterSpacing: "0.18em", color: "#888", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>HISTORY</span>
          <input type="range" min={0} max={MAX_OFFSET} value={MAX_OFFSET - Math.round(offset)}
            onChange={e => { setPlaying(false); setOffset(MAX_OFFSET - +e.target.value); }}
            style={{ width: 150, accentColor: GOLD }} />
          {offset > 0 && (
            <span style={{ fontSize: 9.5, color: "#f8e49b", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }}>−{Math.round(offset)}{interval_ === "1wk" ? "W" : "D"}</span>
          )}
          <div style={divider} />
          <button style={pill(interval_ === "1d")} onClick={() => { setInterval_("1d"); setOffset(0); setPlaying(false); }}>Daily</button>
          <button style={pill(interval_ === "1wk")} onClick={() => { setInterval_("1wk"); setOffset(0); setPlaying(false); }}>Weekly</button>
          <div style={divider} />
          <span style={{ fontSize: 9, letterSpacing: "0.2em", color: "#888", fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}>
            TAIL <span style={{ color: "#f8e49b" }}>{tailLen}</span>{interval_ === "1wk" ? "W" : "D"}
          </span>
          <input type="range" min={3} max={10} value={tailLen} onChange={e => setTailLen(+e.target.value)}
            style={{ width: 100, accentColor: GOLD }} />
          <button style={pill(showTails)} onClick={() => setShowTails(v => !v)} title="Tails ein-/ausblenden">Tails</button>
          {drill && (
            <>
              <div style={divider} />
              <button style={pill(benchMode === "SECTOR")} onClick={() => setBenchMode("SECTOR")}>vs {drill}</button>
              <button style={pill(benchMode === "TOP")} onClick={() => setBenchMode("TOP")}>vs {preset.bench}</button>
            </>
          )}
          {(drill || preset.packKey) && (
            <>
              <div style={divider} />
              <button onClick={() => setVsxPack(v => !v)} title="VisionX-Pack-Titel ein-/ausblenden"
                style={{ ...pill(vsxPack), display: "flex", alignItems: "center", gap: 7,
                  color: vsxPack ? GOLD : "#777",
                  textShadow: vsxPack ? "0 0 10px rgba(212,175,55,0.5)" : "none" }}>
                <span style={{ fontSize: 8 }}>◆</span> VSX PACK
                {vsxPack && (pack[drill || preset.packKey] || []).length > 0 && (
                  <span style={{ fontSize: 8, color: "#b99c64" }}>{(pack[drill || preset.packKey] || []).length}</span>
                )}
              </button>
            </>
          )}
          <div style={divider} />
          <input value={addInput} onChange={e => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && addSymbol()}
            placeholder={preset.cryptoSuffix && !drill ? "z.B. PEPE" : "z.B. NVDA"}
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "#f8e49b", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: "0.12em", padding: "8px 14px", borderRadius: 10, outline: "none", width: 105, textTransform: "uppercase" }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"} />
          <button style={{ ...pill(true), padding: "9px 15px" }} onClick={addSymbol}>+ ADD</button>
          {hasEdits && (
            <button style={{ ...pill(false), color: "#777" }} onClick={resetView}>↺ RESET</button>
          )}
          {loading && <span style={{ marginLeft: "auto", fontSize: 10, color: GOLD, fontFamily: "'DM Mono', monospace", letterSpacing: "0.14em" }}>LOADING…</span>}
        </div>

        {error && (
          <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 14, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>
            {error}
          </div>
        )}
        {failed.length > 0 && !error && (
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>
            Keine Daten: {failed.join(", ")}
          </div>
        )}

        {/* BENCH-CHART + RRG + RANKING */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch", marginBottom: 16 }}>
          <div style={{ ...glass, padding: "12px 14px 4px", flex: "1 1 760px", minWidth: 360 }}>
            {benchSeries && benchSeries.length > 10 && (
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
                <BenchChart series={benchSeries.slice(-Math.min(benchSeries.length, MAX_OFFSET + tailLen))}
                  label={benchLabel} offset={offset} tailLen={tailLen} maxOffset={MAX_OFFSET}
                  onScrub={(o) => { setPlaying(false); setOffset(o); }} />
              </div>
            )}
            {items.length > 0 ? (
              <RRGChart key={viewKey + interval_} items={items} hovered={hovered} setHovered={setHovered} tailLen={tailLen} ext={chartExt} showTails={showTails}
                onNodeClick={preset.drillable && !drill
                  ? (it) => { setDrill(it.symbol); setBenchMode("SECTOR"); setHovered(null); setOffset(0); setPlaying(false); }
                  : null} />
            ) : !loading && !error ? (
              <div style={{ padding: 110, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.3em", color: "#262626" }}>KEINE DATEN</div>
            ) : (
              <div style={{ padding: 110, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.22em", color: "#3d3d3d" }}>FETCHING {neededSymbols.length} SYMBOLS…</div>
            )}
            {preset.drillable && !drill && items.length > 0 && (
              <div style={{ textAlign: "center", fontSize: 8.5, color: "#4d4d4d", letterSpacing: "0.2em", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, textTransform: "uppercase", padding: "4px 0 8px" }}>
                Sektor anklicken → Drilldown mit Holdings + <span style={{ color: GOLD }}>VSX Pack</span> · Scroll = Zoom
              </div>
            )}
          </div>

          {/* RANKING rechts */}
          <div style={{ ...glass, padding: "16px 16px 12px", flex: "1 1 360px", minWidth: 320, maxWidth: 480, maxHeight: 760, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 11 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.2em", color: "#fdfdfd" }}>ROTATION RANKING</span>
              <span style={{ fontSize: 8, color: "#4a4a4a", letterSpacing: "0.16em", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>{items.length} TITEL</span>
            </div>
            <div style={{ overflowY: "auto", flex: 1, marginRight: -6, paddingRight: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 10.5 }}>
                <thead style={{ position: "sticky", top: 0, background: "rgba(20,20,20,0.96)", backdropFilter: "blur(8px)", zIndex: 2 }}>
                  <tr style={{ fontSize: 8, letterSpacing: "0.14em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                    {th("alpha", "Symbol")}
                    {th("quad", "Quad")}
                    {th("rsr", "RS-R", "right")}
                    {th("rsm", "RS-M", "right")}
                    <th style={{ width: 22 }} />
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
                        <td style={{ padding: "7px 8px", color: it.vsx ? "#f8e49b" : "#e8e8e8", fontWeight: it.vsx ? 700 : 400, whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: it.color, marginRight: 8, boxShadow: it.vsx ? `0 0 6px ${GOLD}` : "none" }} />
                          {it.label}
                          {it.vsx && <span style={{ marginLeft: 6, fontSize: 6.5, color: "#8a7440", letterSpacing: "0.12em" }}>◆</span>}
                          {it.custom && <span style={{ marginLeft: 6, fontSize: 6.5, color: "#666", letterSpacing: "0.1em" }}>ADD</span>}
                        </td>
                        <td style={{ padding: "7px 7px" }}>
                          <span title={q} style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: `${QUAD_COLOR[q]}cc`, boxShadow: `0 0 6px ${QUAD_COLOR[q]}55` }} />
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: h.x >= 100 ? "#22c55e" : "#ef4444" }}>{h.x.toFixed(2)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: h.y >= 100 ? "#22c55e" : "#ef4444" }}>{h.y.toFixed(2)}</td>
                        <td style={{ padding: "7px 3px", textAlign: "center" }}>
                          <button onClick={() => removeSymbol(it.symbol)} title="Titel entfernen"
                            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: 10, padding: 2, transition: "color 0.15s" }}
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
        </div>

        {/* DETAIL-TABELLE (StockCharts-Style) */}
        {items.length > 0 && (
          <div style={{ ...glass, padding: "18px 20px 14px" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.2em", color: "#fdfdfd", marginBottom: 12 }}>
              MEMBER DETAIL
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
              <thead>
                <tr style={{ fontSize: 8.5, letterSpacing: "0.16em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                  <th style={{ padding: "6px 9px", textAlign: "left", color: "#555" }}>Tail</th>
                  {th("alpha", "Symbol")}
                  <th style={{ padding: "6px 9px", textAlign: "left", color: "#555" }}>Name</th>
                  {th("quad", "Quadrant")}
                  {th("rsr", "RS-Ratio", "right")}
                  {th("rsm", "RS-Momentum", "right")}
                  <th style={{ padding: "6px 9px", textAlign: "right", color: "#555" }}>Price</th>
                  <th style={{ padding: "6px 9px", textAlign: "right", color: "#555" }}>% Chg ({tailLen}{interval_ === "1wk" ? "W" : "D"})</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(it => {
                  const h = it.tail[it.tail.length - 1];
                  const q = quadrantOf(h.x, h.y);
                  const dist = Math.hypot(h.x - 100, h.y - 100);
                  const end = it.full.xs.length - 1 - Math.round(offset);
                  const start = Math.max(0, end - tailLen + 1);
                  const price = it.full.px[end];
                  const chg = it.full.px[start] ? (price / it.full.px[start] - 1) * 100 : null;
                  return (
                    <tr key={it.symbol}
                      onMouseEnter={() => setHovered(it.symbol)} onMouseLeave={() => setHovered(null)}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: hovered === it.symbol ? "rgba(212,175,55,0.07)" : `${QUAD_COLOR[q]}08`, transition: "background 0.15s" }}>
                      <td style={{ padding: "8px 9px", width: 90 }}>
                        <div style={{ width: Math.min(80, 10 + dist * 16), height: 8, borderRadius: 3, background: `linear-gradient(90deg, ${QUAD_COLOR[q]}44, ${QUAD_COLOR[q]}cc)` }} />
                      </td>
                      <td style={{ padding: "8px 9px", color: it.vsx ? "#f8e49b" : "#e8e8e8", fontWeight: it.vsx ? 700 : 400, whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: it.color, marginRight: 8, boxShadow: it.vsx ? `0 0 6px ${GOLD}` : "none" }} />
                        {it.label}
                        {it.vsx && <span style={{ marginLeft: 6, fontSize: 6.5, color: "#8a7440", letterSpacing: "0.12em" }}>◆ VSX</span>}
                      </td>
                      <td style={{ padding: "8px 9px", color: "#8f8f8f", fontFamily: "'Montserrat', sans-serif", fontSize: 10.5, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {names[it.symbol] || NAME_DEFAULTS[it.symbol] || "—"}
                      </td>
                      <td style={{ padding: "8px 9px" }}>
                        <span style={{ fontSize: 8, letterSpacing: "0.12em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, color: QUAD_COLOR[q], background: `${QUAD_COLOR[q]}14`, border: `1px solid ${QUAD_COLOR[q]}30`, padding: "2.5px 9px", borderRadius: 20 }}>{q}</span>
                      </td>
                      <td style={{ padding: "8px 9px", textAlign: "right", color: h.x >= 100 ? "#22c55e" : "#ef4444" }}>{h.x.toFixed(2)}</td>
                      <td style={{ padding: "8px 9px", textAlign: "right", color: h.y >= 100 ? "#22c55e" : "#ef4444" }}>{h.y.toFixed(2)}</td>
                      <td style={{ padding: "8px 9px", textAlign: "right", color: "#c9c9c9" }}>{price != null ? price.toLocaleString("en-US", { maximumFractionDigits: price < 1 ? 6 : 2 }) : "—"}</td>
                      <td style={{ padding: "8px 9px", textAlign: "right", color: chg == null ? "#555" : chg >= 0 ? "#22c55e" : "#ef4444" }}>
                        {chg == null ? "—" : `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
          JdK-style approximation · RS = 100 · price / benchmark · RS-Ratio = 100 · RS / SMA(RS, {params.window}{interval_ === "1wk" ? "W" : "D"}) · RS-Momentum = 100 · Ratio / SMA(Ratio, {params.window}). JdK is proprietary — quadrants and rotation shape align with StockCharts, absolute values may differ slightly. Not investment advice.
        </div>
      </div>

      {showManager && <PackManager pack={pack} setPack={setPack} names={names} setNames={setNames} onClose={() => setShowManager(false)} />}
    </div>
  );
}
