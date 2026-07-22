import { useState, useEffect, useMemo, useRef } from "react";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · VIX OPPORTUNITY MAP
//  Live ^VIX (Daily Close, 1× täglich via CDN-Cache) als Candle-Chart nach
//  VSX Chart Guidelines (hollow gold up / filled charcoal down), Zonen-Bänder,
//  Event-Annotations und Sektor-Playbook-Cards.
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";

// ── ZONEN-FRAMEWORK ──────────────────────────────────────────────────────────
const ZONES = [
  { id: "danger", label: "DANGER", range: "0–15", lo: 0, hi: 15, color: "#ef4444",
    band: "rgba(239,68,68,0.055)",
    desc: ["Consensus feels safe — tops form here.", "Protection is cheapest when no one wants it."],
    buy: "XLP · XLU · XLV", sell: "XLK · XLY · XLC" },
  { id: "neutral", label: "NEUTRAL", range: "15–25", lo: 15, hi: 25, color: "#fb923c",
    band: "rgba(251,146,60,0.04)",
    desc: ["Normal market regime.", "Broad participation, no extremes."],
    buy: "XLF · XLI · XLB", sell: "None — stay balanced" },
  { id: "watch", label: "WATCH", range: "25–35", lo: 25, hi: 35, color: "#facc15",
    band: "rgba(250,204,21,0.045)",
    desc: ["Stress is building. Reduce size,", "prepare the quality watchlist."],
    buy: "XLV · XLP", sell: "XLK · XLY · XLB" },
  { id: "accumulate", label: "ACCUMULATE", range: "35–50", lo: 35, hi: 50, color: "#d5dd4a",
    band: "rgba(213,221,74,0.05)",
    desc: ["Panic begins — retail is selling.", "Scale in with tranches, start small."],
    buy: "XLK · XLY · XLF", sell: "XLU · XLP — first trim" },
  { id: "strike", label: "STRIKE ZONE", range: "50–100", lo: 50, hi: 100, color: "#22c55e",
    band: "rgba(34,197,94,0.06)",
    desc: ["Maximum fear, maximum opportunity.", "Best forward returns in history (2008, 2020)."],
    buy: "XLK · XLY · XLC · XLRE", sell: "XLP · XLU · XLV" },
];

const zoneAt = v => ZONES.find(z => v >= z.lo && v < z.hi) || ZONES[ZONES.length - 1];

// ── EVENT-ANNOTATIONS ────────────────────────────────────────────────────────
const EVENTS = [
  { date: "2018-12-24", lines: ["Q4 2018", "Fed Panic"] },
  { date: "2020-03-16", lines: ["COVID Crash", "VIX 85 — buy of the decade"] },
  { date: "2022-03-07", lines: ["2022", "Bear Market"] },
  { date: "2024-08-05", lines: ["Yen Carry Unwind", "VIX 66 intraday"] },
  { date: "2025-04-08", lines: ["Tariff Shock", "VIX 60"] },
];

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

// ── CANDLE-CHART ─────────────────────────────────────────────────────────────
function VixChart({ candles }) {
  const W = 1560, H = 620, PADL = 46, PADR = 150, PADT = 14, PADB = 34;
  const plotW = W - PADL - PADR, plotH = H - PADT - PADB;
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const n = candles.length;
  const maxV = useMemo(() => Math.max(...candles.map(c => c[2])) * 1.06, [candles]);
  const X = i => PADL + ((i + 0.5) / n) * plotW;
  const Y = v => PADT + (1 - v / maxV) * plotH;
  const cw = Math.max(1.2, (plotW / n) * 0.62);

  // Jahres-Ticks
  const yearTicks = useMemo(() => {
    const ticks = []; let lastYear = null;
    candles.forEach((c, i) => {
      const y = new Date(c[0]).getFullYear();
      if (y !== lastYear) { ticks.push({ i, y }); lastYear = y; }
    });
    return ticks.slice(1);
  }, [candles]);

  // Event-Positionen
  const eventPos = useMemo(() => EVENTS.map(ev => {
    const t = new Date(ev.date + "T00:00:00Z").getTime();
    let best = -1, bd = Infinity;
    candles.forEach((c, i) => { const d = Math.abs(c[0] - t); if (d < bd) { bd = d; best = i; } });
    if (best < 0 || bd > 20 * 86400e3) return null;
    return { ...ev, i: best, high: candles[best][2] };
  }).filter(Boolean), [candles]);

  const onMove = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.min(n - 1, Math.max(0, Math.round(((px - PADL) / plotW) * n - 0.5)));
    setHover(i);
  };

  const B = H - PADB;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      style={{ width: "100%", display: "block" }}>
      {/* Zonen-Bänder */}
      {ZONES.map(z => {
        const top = Y(Math.min(z.hi, maxV)), bot = Y(z.lo);
        if (bot <= PADT) return null;
        return (
          <g key={z.id}>
            <rect x={PADL} y={Math.max(PADT, top)} width={plotW} height={Math.min(B, bot) - Math.max(PADT, top)} fill={z.band} />
            {z.lo > 0 && <line x1={PADL} y1={Y(z.lo)} x2={PADL + plotW} y2={Y(z.lo)} stroke={`${z.color}30`} strokeWidth="0.75" />}
            {/* Rechte Zonen-Labels */}
            <text x={PADL + plotW + 16} y={(Math.max(PADT, top) + Math.min(B, bot)) / 2 - 4} fill={z.color}
              style={{ font: "700 13px Montserrat, sans-serif", letterSpacing: "0.12em" }}>{z.label}</text>
            <text x={PADL + plotW + 16} y={(Math.max(PADT, top) + Math.min(B, bot)) / 2 + 12} fill="#555"
              style={{ font: "500 9.5px 'DM Mono', monospace", letterSpacing: "0.1em" }}>{z.range}</text>
          </g>
        );
      })}

      {/* Y-Skala */}
      {[0, 15, 25, 35, 50, 65, 80].filter(v => v < maxV).map(v => (
        <text key={v} x={PADL - 8} y={Y(v) + 3} textAnchor="end" fill="#4a4a4a"
          style={{ font: "500 10px 'DM Mono', monospace" }}>{v}</text>
      ))}
      {yearTicks.map(t => (
        <text key={t.y} x={X(t.i)} y={H - 12} textAnchor="middle" fill="#555"
          style={{ font: "500 11px 'DM Mono', monospace", letterSpacing: "0.08em" }}>{t.y}</text>
      ))}

      <rect x={PADL} y={PADT} width={plotW} height={plotH} fill="none" stroke="rgba(255,255,255,0.08)" rx="2" />

      {/* Candles — hollow gold up / filled charcoal down (VSX Chart Guidelines) */}
      {candles.map((c, i) => {
        const [, o, h, l, cl] = c;
        const up = cl >= o;
        const x = X(i);
        const bodyTop = Y(Math.max(o, cl)), bodyBot = Y(Math.min(o, cl));
        return (
          <g key={i} opacity={hover != null && hover !== i ? 0.75 : 1}>
            <line x1={x} y1={Y(h)} x2={x} y2={Y(l)} stroke={up ? "rgba(232,217,160,0.75)" : "rgba(120,120,120,0.6)"} strokeWidth="1" />
            <rect x={x - cw / 2} y={bodyTop} width={cw} height={Math.max(1, bodyBot - bodyTop)}
              fill={up ? "rgba(18,18,18,0.9)" : "#3a3a3a"}
              stroke={up ? "#e8d9a0" : "#6a6a6a"} strokeWidth="1" />
          </g>
        );
      })}

      {/* Event-Annotations */}
      {eventPos.map((ev, k) => {
        const x = X(ev.i);
        const yTop = Y(ev.high);
        const boxW = Math.max(...ev.lines.map(l => l.length)) * 6.4 + 20;
        const boxH = ev.lines.length * 14 + 12;
        const bx = Math.min(W - PADR - boxW - 6, Math.max(PADL + 6, x - boxW / 2 + 60));
        const by = Math.max(PADT + 6, yTop - boxH - 34);
        return (
          <g key={k} pointerEvents="none">
            <line x1={x} y1={yTop - 4} x2={bx + boxW / 2} y2={by + boxH} stroke="rgba(212,175,55,0.55)" strokeWidth="1" />
            <rect x={bx} y={by} width={boxW} height={boxH} rx="6" fill="rgba(14,14,14,0.94)" stroke="rgba(212,175,55,0.5)" strokeWidth="1" />
            {ev.lines.map((l, li) => (
              <text key={li} x={bx + 10} y={by + 16 + li * 14} fill={li === 0 ? "#f8e49b" : "#c9c9c9"}
                style={{ font: `${li === 0 ? 700 : 500} 10.5px Montserrat, sans-serif` }}>{l}</text>
            ))}
          </g>
        );
      })}

      {/* Hover-Tooltip */}
      {hover != null && candles[hover] && (() => {
        const [t, o, h, l, cl] = candles[hover];
        const x = X(hover);
        const tipX = x > W / 2 ? x - 180 : x + 14;
        return (
          <g pointerEvents="none">
            <line x1={x} y1={PADT} x2={x} y2={B} stroke="rgba(212,175,55,0.25)" strokeDasharray="2 4" />
            <rect x={tipX} y={PADT + 8} width={166} height={64} rx="7" fill="rgba(14,14,14,0.95)" stroke="rgba(255,255,255,0.12)" />
            <text x={tipX + 12} y={PADT + 26} fill="#f8e49b" style={{ font: "700 10px 'DM Mono', monospace", letterSpacing: "0.06em" }}>{fmtDate(t).toUpperCase()}</text>
            <text x={tipX + 12} y={PADT + 42} fill="#c9c9c9" style={{ font: "500 9.5px 'DM Mono', monospace" }}>O {o.toFixed(2)}  H {h.toFixed(2)}</text>
            <text x={tipX + 12} y={PADT + 56} fill="#c9c9c9" style={{ font: "500 9.5px 'DM Mono', monospace" }}>L {l.toFixed(2)}  C <tspan fill={zoneAt(cl).color}>{cl.toFixed(2)}</tspan></text>
          </g>
        );
      })()}
    </svg>
  );
}

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function VIX() {
  const [daily, setDaily] = useState(null);
  const [agg, setAgg] = useState(4);           // Candle-Größe in Tagen
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/history?symbols=${encodeURIComponent("^VIX")}&interval=1d&range=8y&ohlc=1`)
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
        {/* KOPF */}
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
          CBOE Volatility Index · {agg === 5 ? "Weekly" : `${agg}-Day`} Candles · {rangeLabel} · Buy fear, sell complacency
        </div>

        {error && (
          <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 16, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>
            {error}
          </div>
        )}

        {/* CHART */}
        <div style={{ ...glass, padding: "16px 14px 8px", marginBottom: 18 }}>
          {loading ? (
            <div style={{ padding: 130, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.22em", color: "#3d3d3d" }}>FETCHING ^VIX…</div>
          ) : candles.length > 0 ? (
            <VixChart candles={candles} />
          ) : !error ? (
            <div style={{ padding: 130, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.3em", color: "#262626" }}>KEINE DATEN</div>
          ) : null}
        </div>

        {/* ZONEN-CARDS */}
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
