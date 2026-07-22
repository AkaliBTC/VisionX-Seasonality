import { useState, useEffect, useMemo, useRef, useCallback } from "react";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · VIX OPPORTUNITY MAP v2
//  Live ^VIX Candles (Daily Close, 1× täglich via CDN-Cache) — interaktiv:
//  Wheel-Zoom auf Cursor · Drag-Pan · Auto-Y-Skalierung · kräftige Zonen-Bänder.
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";

// ── ZONEN-FRAMEWORK ──────────────────────────────────────────────────────────
const ZONES = [
  { id: "danger", label: "DANGER", range: "0–15", lo: 0, hi: 15, color: "#ef4444",
    band: "rgba(160,45,45,0.22)",
    desc: ["Consensus feels safe — tops form here.", "Protection is cheapest when no one wants it."],
    buy: "XLP · XLU · XLV", sell: "XLK · XLY · XLC" },
  { id: "neutral", label: "NEUTRAL", range: "15–25", lo: 15, hi: 25, color: "#fb923c",
    band: "rgba(150,85,40,0.16)",
    desc: ["Normal market regime.", "Broad participation, no extremes."],
    buy: "XLF · XLI · XLB", sell: "None — stay balanced" },
  { id: "watch", label: "WATCH", range: "25–35", lo: 25, hi: 35, color: "#facc15",
    band: "rgba(160,130,35,0.15)",
    desc: ["Stress is building. Reduce size,", "prepare the quality watchlist."],
    buy: "XLV · XLP", sell: "XLK · XLY · XLB" },
  { id: "accumulate", label: "ACCUMULATE", range: "35–50", lo: 35, hi: 50, color: "#d5dd4a",
    band: "rgba(130,145,45,0.16)",
    desc: ["Panic begins — retail is selling.", "Scale in with tranches, start small."],
    buy: "XLK · XLY · XLF", sell: "XLU · XLP — first trim" },
  { id: "strike", label: "STRIKE ZONE", range: "50–100", lo: 50, hi: 100, color: "#22c55e",
    band: "rgba(35,120,70,0.2)",
    desc: ["Maximum fear, maximum opportunity.", "Best forward returns in history (2008, 2020)."],
    buy: "XLK · XLY · XLC · XLRE", sell: "XLP · XLU · XLV" },
];

const zoneAt = v => ZONES.find(z => v >= z.lo && v < z.hi) || ZONES[ZONES.length - 1];

// ── AGGREGATION: 1D-OHLC → N-Tages-Candles ───────────────────────────────────
const aggregate = (candles, n) => {
  if (n <= 1) return candles;
  const out = [];
  for (let i = 0; i < candles.length; i += n) {
    const chunk = candles.slice(i, i + n);
    out.push([
      chunk[0][0],
      chunk[0][1],
      Math.max(...chunk.map(c => c[2])),
      Math.min(...chunk.map(c => c[3])),
      chunk[chunk.length - 1][4],
    ]);
  }
  return out;
};

const fmtDate = t => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── INTERAKTIVER CANDLE-CHART ────────────────────────────────────────────────
function VixChart({ candles }) {
  const W = 1560, H = 620, PADL = 46, PADR = 150, PADT = 14, PADB = 34;
  const plotW = W - PADL - PADR, plotH = H - PADT - PADB;
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [hover, setHover] = useState(null);
  const n = candles.length;
  const PADN = Math.max(4, Math.round(n * 0.04));      // Freiraum rechts (in Candles)
  const NMAX = n + PADN;
  const [view, setView] = useState({ a: 0, b: n + Math.max(4, Math.round(n * 0.04)) });

  // Temporäres Drawing-Tool (nur im Chart, nicht persistiert)
  const [tool, setTool] = useState("pan");             // "pan" | "free" | "line"
  const [drawings, setDrawings] = useState([]);        // in Daten-Koordinaten {i, v}
  const [draft, setDraft] = useState(null);

  // Bei neuen Daten / Aggregation: Range + Zeichnungen zurücksetzen
  useEffect(() => { setView({ a: 0, b: NMAX }); setDrawings([]); setDraft(null); }, [n, NMAX]);

  const a = Math.max(0, Math.min(view.a, n - 2));
  const b = Math.max(a + 2, Math.min(view.b, NMAX));
  const span = b - a;
  const zoomed = span < NMAX - 0.5;

  // Sichtbare Candles → Auto-Y-Skalierung
  const [yMin, yMax] = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (let i = Math.max(0, Math.floor(a)); i < Math.min(n, Math.ceil(b)); i++) {
      if (candles[i][3] < lo) lo = candles[i][3];
      if (candles[i][2] > hi) hi = candles[i][2];
    }
    if (!isFinite(lo)) { lo = 0; hi = 100; }
    const pad = (hi - lo) * 0.08 || 2;
    return [Math.max(0, lo - pad), hi + pad];
  }, [candles, a, b, n]);

  const X = i => PADL + ((i + 0.5 - a) / span) * plotW;
  const Y = v => PADT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const cw = Math.max(1.2, Math.min(16, (plotW / span) * 0.62));

  // Wheel-Zoom auf Cursor (non-passive)
  const zoomAt = useCallback((factor, px) => {
    setView(v => {
      const s0 = v.b - v.a;
      const s1 = Math.max(15, Math.min(NMAX, s0 / factor));
      const focus = v.a + ((px - PADL) / plotW) * s0;
      let na = focus - (focus - v.a) * (s1 / s0);
      let nb = na + s1;
      if (na < 0) { nb -= na; na = 0; }
      if (nb > NMAX) { na -= nb - NMAX; nb = NMAX; }
      return { a: Math.max(0, na), b: Math.min(NMAX, nb) };
    });
  }, [NMAX, plotW]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, px);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Pixel → Daten-Koordinaten (Index i, Wert v), auf Plot geclampt
  const toData = (clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect();
    const px = Math.min(PADL + plotW, Math.max(PADL, ((clientX - r.left) / r.width) * W));
    const py = Math.min(PADT + plotH, Math.max(PADT, ((clientY - r.top) / r.height) * H));
    return {
      i: a + ((px - PADL) / plotW) * span - 0.5,
      v: yMin + (1 - (py - PADT) / plotH) * (yMax - yMin),
    };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    if (tool !== "pan") {
      const p = toData(e.clientX, e.clientY);
      setDraft({ type: tool, pts: [p, p] });
      setHover(null);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    dragRef.current = { x: e.clientX, a: view.a, b: view.b, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    if (draft) {
      const p = toData(e.clientX, e.clientY);
      setDraft(d => d.type === "line"
        ? { ...d, pts: [d.pts[0], p] }
        : { ...d, pts: [...d.pts, p] });
      return;
    }
    const d = dragRef.current;
    if (d) {
      const dxIdx = ((e.clientX - d.x) / r.width) * W / plotW * (d.b - d.a);
      if (Math.abs(e.clientX - d.x) > 3) d.moved = true;
      let na = d.a - dxIdx, nb = d.b - dxIdx;
      if (na < 0) { nb -= na; na = 0; }
      if (nb > NMAX) { na -= nb - NMAX; nb = NMAX; }
      setView({ a: na, b: nb });
      setHover(null);
      return;
    }
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(a + ((px - PADL) / plotW) * span - 0.5);
    setHover(i >= 0 && i < n ? i : null);
  };
  const onPointerUp = () => {
    if (draft) {
      if (draft.pts.length >= 2) setDrawings(ds => [...ds, draft]);
      setDraft(null);
    }
    dragRef.current = null;
  };

  const drawPath = (dw) => dw.pts.map((p, k) => `${k ? "L" : "M"} ${X(p.i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");

  // Zeit-Ticks: Jahre, bei starkem Zoom Monate
  const ticks = useMemo(() => {
    const out = []; let lastY = null, lastM = null;
    const useMonths = span < 95;
    for (let i = Math.max(0, Math.floor(a)); i < Math.min(n, Math.ceil(b)); i++) {
      const d = new Date(candles[i][0]);
      if (useMonths) {
        const key = d.getFullYear() * 12 + d.getMonth();
        if (key !== lastM) { out.push({ i, label: `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` }); lastM = key; }
      } else {
        if (d.getFullYear() !== lastY) { out.push({ i, label: String(d.getFullYear()) }); lastY = d.getFullYear(); }
      }
    }
    return out.slice(1);
  }, [candles, a, b, n, span]);

  const yTicks = [0, 10, 15, 20, 25, 30, 35, 40, 50, 65, 80, 100].filter(v => v >= yMin && v <= yMax);

  const B = H - PADB, R = PADL + plotW;
  const zoomBtn = {
    width: 30, height: 30, borderRadius: 9, cursor: "pointer",
    background: "rgba(18,18,18,0.75)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#c9c9c9", fontSize: 13, fontFamily: "'DM Mono', monospace",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
  };

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onMouseLeave={() => setHover(null)}
        style={{ width: "100%", display: "block", touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
          cursor: tool !== "pan" ? "crosshair" : dragRef.current ? "grabbing" : "grab" }}>
        <defs>
          <clipPath id="vix-clip"><rect x={PADL} y={PADT} width={plotW} height={plotH} rx="2" /></clipPath>
        </defs>

        {/* Zonen-Bänder (kräftig, auf sichtbare Y-Range geclippt) */}
        <g clipPath="url(#vix-clip)">
          {ZONES.map(z => {
            const top = Y(Math.min(z.hi, yMax)), bot = Y(Math.max(z.lo, yMin));
            if (bot - top < 1) return null;
            return (
              <g key={z.id}>
                <rect x={PADL} y={top} width={plotW} height={bot - top} fill={z.band} />
                {z.lo > yMin && z.lo < yMax && (
                  <line x1={PADL} y1={Y(z.lo)} x2={R} y2={Y(z.lo)} stroke={`${z.color}55`} strokeWidth="0.9" />
                )}
              </g>
            );
          })}

          {/* Candles — hollow gold up / filled charcoal down */}
          {candles.map((c, i) => {
            if (i + 1 < a || i > b) return null;
            const [, o, h, l, cl] = c;
            const up = cl >= o;
            const x = X(i);
            const bodyTop = Y(Math.max(o, cl)), bodyBot = Y(Math.min(o, cl));
            return (
              <g key={i} opacity={hover != null && hover !== i ? 0.8 : 1}>
                <line x1={x} y1={Y(h)} x2={x} y2={Y(l)} stroke={up ? "rgba(212,175,55,0.85)" : "rgba(178,181,190,0.7)"} strokeWidth="1" />
                <rect x={x - cw / 2} y={bodyTop} width={cw} height={Math.max(1, bodyBot - bodyTop)}
                  fill={up ? "transparent" : "#9598a1"}
                  stroke={up ? "#d4af37" : "#b2b5be"} strokeWidth="1" />
              </g>
            );
          })}

          {/* Temporäre Zeichnungen (Daten-Koordinaten → pan/zoom-fest) */}
          {[...drawings, ...(draft ? [draft] : [])].map((dw, k) => (
            <path key={"dw" + k} d={drawPath(dw)} fill="none" stroke={GOLD}
              strokeWidth={dw.type === "line" ? 1.6 : 1.4} strokeLinecap="round" strokeLinejoin="round"
              opacity={0.85} style={{ filter: "drop-shadow(0 0 4px rgba(212,175,55,0.4))" }} />
          ))}
        </g>

        {/* Rechte Zonen-Labels (mittig im sichtbaren Band-Ausschnitt) */}
        {ZONES.map(z => {
          const top = Y(Math.min(z.hi, yMax)), bot = Y(Math.max(z.lo, yMin));
          if (bot - top < 26 || bot < PADT || top > B) return null;
          const mid = (Math.max(PADT, top) + Math.min(B, bot)) / 2;
          return (
            <g key={"lbl" + z.id} pointerEvents="none">
              <text x={R + 16} y={mid - 3} fill={z.color} style={{ font: "700 13px Montserrat, sans-serif", letterSpacing: "0.12em" }}>{z.label}</text>
              <text x={R + 16} y={mid + 13} fill="#666" style={{ font: "500 9.5px 'DM Mono', monospace", letterSpacing: "0.1em" }}>{z.range}</text>
            </g>
          );
        })}

        {/* Skalen */}
        {yTicks.map(v => (
          <g key={v}>
            <text x={PADL - 8} y={Y(v) + 3} textAnchor="end" fill="#5a5a5a" style={{ font: "500 10px 'DM Mono', monospace" }}>{v}</text>
          </g>
        ))}
        {ticks.map(t => (
          <text key={t.label + t.i} x={X(t.i)} y={H - 12} textAnchor="middle" fill="#5a5a5a"
            style={{ font: "500 10.5px 'DM Mono', monospace", letterSpacing: "0.06em" }}>{t.label}</text>
        ))}

        <rect x={PADL} y={PADT} width={plotW} height={plotH} fill="none" stroke="rgba(255,255,255,0.09)" rx="2" />

        {/* Hover-Crosshair + Tooltip */}
        {hover != null && !draft && tool === "pan" && candles[hover] && (() => {
          const [t, o, h, l, cl] = candles[hover];
          const x = X(hover);
          const tipX = x > W / 2 ? x - 186 : x + 14;
          return (
            <g pointerEvents="none">
              <line x1={x} y1={PADT} x2={x} y2={B} stroke="rgba(212,175,55,0.3)" strokeDasharray="2 4" />
              <line x1={PADL} y1={Y(cl)} x2={R} y2={Y(cl)} stroke="rgba(212,175,55,0.18)" strokeDasharray="2 4" />
              <rect x={tipX} y={PADT + 8} width={172} height={64} rx="7" fill="rgba(14,14,14,0.95)" stroke="rgba(255,255,255,0.12)" />
              <text x={tipX + 12} y={PADT + 26} fill="#f8e49b" style={{ font: "700 10px 'DM Mono', monospace", letterSpacing: "0.06em" }}>{fmtDate(t).toUpperCase()}</text>
              <text x={tipX + 12} y={PADT + 42} fill="#c9c9c9" style={{ font: "500 9.5px 'DM Mono', monospace" }}>O {o.toFixed(2)}  H {h.toFixed(2)}</text>
              <text x={tipX + 12} y={PADT + 56} fill="#c9c9c9" style={{ font: "500 9.5px 'DM Mono', monospace" }}>L {l.toFixed(2)}  C <tspan fill={zoneAt(cl).color}>{cl.toFixed(2)}</tspan></text>
            </g>
          );
        })()}
      </svg>

      {/* Drawing-Toolbar */}
      <div style={{ position: "absolute", top: 10, left: 56, display: "flex", gap: 7 }}>
        {[["pan", "✋", "Pan / Hover"], ["free", "✏", "Freihand zeichnen"], ["line", "╱", "Trendlinie ziehen"]].map(([id, icon, tip]) => (
          <button key={id} title={tip} onClick={() => setTool(id)}
            style={{ ...zoomBtn, color: tool === id ? "#f8e49b" : "#c9c9c9",
              borderColor: tool === id ? "rgba(212,175,55,0.55)" : "rgba(255,255,255,0.1)",
              background: tool === id ? "rgba(212,175,55,0.12)" : zoomBtn.background }}>
            {icon}
          </button>
        ))}
        {drawings.length > 0 && (
          <button title="Zeichnungen löschen" onClick={() => { setDrawings([]); setDraft(null); }}
            style={{ ...zoomBtn, color: "#b06060", borderColor: "rgba(239,68,68,0.35)" }}>🗑</button>
        )}
      </div>

      {/* Zoom-Controls */}
      <div style={{ position: "absolute", top: 10, right: 160, display: "flex", gap: 7 }}>
        <button style={zoomBtn} onClick={() => zoomAt(1.35, PADL + plotW / 2)} title="Zoom in"
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"; e.currentTarget.style.color = "#f8e49b"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#c9c9c9"; }}>＋</button>
        <button style={zoomBtn} onClick={() => zoomAt(1 / 1.35, PADL + plotW / 2)} title="Zoom out"
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"; e.currentTarget.style.color = "#f8e49b"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#c9c9c9"; }}>−</button>
        {zoomed && (
          <button style={{ ...zoomBtn, color: GOLD, borderColor: "rgba(212,175,55,0.4)" }}
            onClick={() => setView({ a: 0, b: NMAX })} title="Range zurücksetzen">⟲</button>
        )}
      </div>
      {zoomed && (
        <div style={{ position: "absolute", bottom: 40, right: 160, fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#666", letterSpacing: "0.14em", background: "rgba(18,18,18,0.7)", padding: "4px 9px", borderRadius: 7, backdropFilter: "blur(10px)" }}>
          {Math.round(span)} CANDLES · DRAG TO PAN
        </div>
      )}
    </div>
  );
}

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function VIX() {
  const [daily, setDaily] = useState(null);
  const [agg, setAgg] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/history?symbols=${encodeURIComponent("^VIX")}&interval=1d&range=10y&ohlc=1`)
      .then(r => { if (!r.ok) throw new Error(`API ${r.status} — läuft die Seite auf Vercel / \`vercel dev\`?`); return r.json(); })
      .then(json => {
        if (!alive) return;
        const s = json.data?.["^VIX"];
        if (!s || s.length < 50) throw new Error("Keine VIX-Daten erhalten");
        setDaily(s);
      })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const candles = useMemo(() => daily ? aggregate(daily, agg) : [], [daily, agg]);
  const last = daily ? daily[daily.length - 1] : null;
  const lastClose = last ? last[4] : null;
  const curZone = lastClose != null ? zoneAt(lastClose) : null;
  const rangeLabel = candles.length
    ? `${new Date(candles[0][0]).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${new Date(candles[candles.length - 1][0]).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : "";

  const glass = {
    background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015) 55%, rgba(212,175,55,0.02))",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
    backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)",
    boxShadow: "0 14px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
  };
  const pill = (active) => ({
    padding: "8px 15px", borderRadius: 10, cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
    background: active ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(212,175,55,0.07))" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.08)"}`,
    color: active ? "#f8e49b" : "#777", transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
  });

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "calc(100vh - 76px)" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -220, right: "-6%", width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.06), transparent 62%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: -320, left: "-10%", width: 880, height: 880, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.035), transparent 62%)", filter: "blur(60px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1840, margin: "0 auto", padding: "22px 30px 50px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: "0.18em", color: "#fdfdfd" }}>
            VIX OPPORTUNITY MAP
          </div>
          {curZone && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.08em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: curZone.color, boxShadow: `0 0 9px ${curZone.color}` }} />
              <span style={{ color: "#c9c9c9" }}>VIX <span style={{ color: "#f8e49b", fontWeight: 700 }}>{lastClose.toFixed(2)}</span></span>
              <span style={{ color: curZone.color, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 9.5, letterSpacing: "0.16em" }}>{curZone.label}</span>
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
            {[[1, "1D"], [2, "2D"], [4, "4D"], [5, "1W"]].map(([v, l]) => (
              <button key={v} style={pill(agg === v)} onClick={() => setAgg(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#b99c64", letterSpacing: "0.04em", marginBottom: 16 }}>
          CBOE Volatility Index · {agg === 5 ? "Weekly" : `${agg}-Day`} Candles · {rangeLabel} · Buy fear, sell complacency · Scroll = Zoom · Drag = Pan
        </div>

        {error && (
          <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 16, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>
            {error}
          </div>
        )}

        <div style={{ ...glass, padding: "16px 14px 8px", marginBottom: 18 }}>
          {loading ? (
            <div style={{ padding: 130, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.22em", color: "#3d3d3d" }}>FETCHING ^VIX…</div>
          ) : candles.length > 0 ? (
            <VixChart key={agg} candles={candles} />
          ) : !error ? (
            <div style={{ padding: 130, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.3em", color: "#262626" }}>KEINE DATEN</div>
          ) : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {ZONES.map(z => {
            const active = curZone?.id === z.id;
            return (
              <div key={z.id} style={{
                ...glass, borderColor: `${z.color}${active ? "88" : "40"}`, borderRadius: 16,
                padding: "16px 18px 14px",
                boxShadow: active ? `0 0 26px ${z.color}22, inset 0 1px 0 rgba(255,255,255,0.06)` : glass.boxShadow,
              }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, color: z.color, letterSpacing: "0.1em", marginBottom: 5 }}>
                  VIX {z.range}{active && <span style={{ marginLeft: 8, fontSize: 8, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, letterSpacing: "0.18em", color: "#f8e49b" }}>● NOW</span>}
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: "0.1em", color: "#fdfdfd", marginBottom: 9 }}>{z.label}</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#8f8f8f", lineHeight: 1.65, marginBottom: 13, minHeight: 34 }}>
                  {z.desc.join(" ")}
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 11, display: "flex", flexDirection: "column", gap: 7, fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
                  <div><span style={{ color: "#22c55e", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 8.5, letterSpacing: "0.16em", marginRight: 10 }}>BUY</span><span style={{ color: "#c9c9c9" }}>{z.buy}</span></div>
                  <div><span style={{ color: "#ef4444", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 8.5, letterSpacing: "0.16em", marginRight: 10 }}>SELL</span><span style={{ color: "#c9c9c9" }}>{z.sell}</span></div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
          <span>SPDR SELECT SECTOR ETFS · XLE trades on crude, not volatility — treated separately · XLRE is rate-driven</span>
          <span>Not investment advice. For educational purposes only. Past performance is not indicative of future results.</span>
        </div>
      </div>
    </div>
  );
}
