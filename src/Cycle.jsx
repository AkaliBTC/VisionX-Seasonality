import React, { useState, useEffect } from "react";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · SPX SECTOR CYCLE
//  6-stage rotation matrix (best/worst performers per phase) with cycle wave,
//  example names per industry and a manually set, persisted current stage.
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";
const STAGE_STORAGE_KEY = "vsx_spx_cycle_stage_v1";

const STAGES = [
  {
    n: 1, title: "CYCLE TROUGH",
    desc: "The bottom is in — recovery begins. Rate-sensitive consumer groups lead first.",
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
    n: 2, title: "EARLY BULL",
    desc: "Financials and risk cyclicals accelerate — liquidity lifts the market broadly.",
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
    n: 3, title: "MID BULL",
    desc: "Tech, materials and energy take over leadership — the cycle runs hot.",
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
    n: 4, title: "LATE BULL",
    desc: "Inflation trades peak — hardware and gold shine while early cyclicals roll over.",
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
    n: 5, title: "TOP FORMS",
    desc: "Breadth narrows — defensives outperform while the index still holds up.",
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
    n: 6, title: "BEAR PHASE",
    desc: "Staples, insurance and food defend — deep cyclicals bleed into the low.",
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

// ── CYCLE WAVE ───────────────────────────────────────────────────────────────
function CycleWave({ selected, current }) {
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
          </g>
        );
      })}
    </svg>
  );
}

// ── MAIN MODULE ──────────────────────────────────────────────────────────────
export default function Cycle() {
  const [selected, setSelected] = useState(loadStage() || 1);
  const [selInd, setSelInd] = useState(null);
  const [current, setCurrent] = useState(loadStage);
  const [hoverCol, setHoverCol] = useState(null);

  useEffect(() => {
    try {
      if (current == null) localStorage.removeItem(STAGE_STORAGE_KEY);
      else localStorage.setItem(STAGE_STORAGE_KEY, String(current));
    } catch { /* private mode */ }
  }, [current]);

  const sel = STAGES.find(s => s.n === selected);

  const glass = {
    background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015) 55%, rgba(212,175,55,0.02))",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
    backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)",
    boxShadow: "0 14px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
  };

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
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -220, right: "-6%", width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.06), transparent 62%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: -320, left: "-10%", width: 880, height: 880, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,182,255,0.035), transparent 62%)", filter: "blur(60px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1840, margin: "0 auto", padding: "22px 30px 50px" }}>
        {/* HEADER */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: "0.18em", color: "#fdfdfd" }}>
            SPX SECTOR CYCLE
          </div>
          {current && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, boxShadow: `0 0 9px ${GOLD}` }} />
              <span style={{ color: "#c9c9c9" }}>CURRENT STAGE <span style={{ color: "#f8e49b", fontWeight: 700 }}>{current}</span></span>
              <span style={{ color: "#b99c64", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9.5, letterSpacing: "0.16em" }}>{STAGES[current - 1].title}</span>
            </div>
          )}
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#b99c64", letterSpacing: "0.04em", marginBottom: 18 }}>
          6-Stage Rotation Framework · Best & worst performers per cycle phase · Click a stage or industry for example names
        </div>

        {/* MATRIX */}
        <div style={{ ...glass, padding: "6px 0 0", marginBottom: 18, overflow: "hidden" }}>
          <div style={{ position: "relative" }}>
            <div style={{ display: "grid", gridTemplateColumns: "150px repeat(6, 1fr)" }}>
              <div style={{ padding: "13px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "#555", textTransform: "uppercase" }}>Stage</div>
              {STAGES.map(s => (
                <div key={"h" + s.n} onClick={() => { setSelected(s.n); setSelInd(null); }}
                  onMouseEnter={() => setHoverCol(s.n)} onMouseLeave={() => setHoverCol(null)}
                  style={{ ...cellBase(s.n), padding: "11px 8px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: "0.12em", color: selected === s.n ? "#f8e49b" : "#c9c9c9" }}>{s.n}</span>
                  {current === s.n && (
                    <span style={{ display: "block", fontSize: 7, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.22em", color: GOLD, marginTop: 2 }}>● CURRENT</span>
                  )}
                </div>
              ))}

              {[0, 1, 2].map(row => (
                <React.Fragment key={"best" + row}>
                  {row === 0 ? (
                    <div style={{ padding: "14px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "#22c55e", textTransform: "uppercase", display: "flex", alignItems: "center" }}>
                      Best Performers
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
                      Worst Performers
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
              <CycleWave selected={selected} current={current} />
            </div>
          </div>
        </div>

        {/* DETAIL */}
        {sel && (
          <div style={{ ...glass, padding: "20px 24px 18px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 23, letterSpacing: "0.14em", color: "#fdfdfd" }}>
                STAGE {sel.n} <span style={{ color: GOLD }}>·</span> {sel.title}
              </span>
              {current === sel.n ? (
                <button onClick={() => setCurrent(null)}
                  style={{ padding: "6px 14px", borderRadius: 9, cursor: "pointer", background: "rgba(212,175,55,0.13)", border: "1px solid rgba(212,175,55,0.5)", color: "#f8e49b", fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em" }}>● CURRENT — REMOVE</button>
              ) : (
                <button onClick={() => setCurrent(sel.n)}
                  style={{ padding: "6px 14px", borderRadius: 9, cursor: "pointer", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.3)", color: "#b99c64", fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.6)"; e.currentTarget.style.color = "#f8e49b"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.3)"; e.currentTarget.style.color = "#b99c64"; }}>SET AS CURRENT</button>
              )}
            </div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11.5, color: "#8f8f8f", lineHeight: 1.7, marginBottom: 16 }}>
              {sel.desc}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "#22c55e", marginBottom: 8 }}>BEST PERFORMERS <span style={{ color: "#4a4a4a", fontWeight: 600, letterSpacing: "0.06em", textTransform: "none" }}>· click for example names</span></div>
                {sel.best.map(x => indRow(x, "best"))}
              </div>
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "#ef4444", marginBottom: 8 }}>WORST PERFORMERS</div>
                {sel.worst.map(x => indRow(x, "worst"))}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
          SPX Cycle Framework · Historical sector leadership per cycle phase. Structural analysis — not investment advice.
        </div>
      </div>
    </div>
  );
}
