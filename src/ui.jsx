import { useState, useEffect, useRef } from "react";
// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · DESIGN SYSTEM
//  Design-Sprache aus dem VSX Portfolio Tracker übernommen:
//  tiefes Schwarz, Gold-Gradient-Wordmark, Overline-Labels, KPI-Leiste mit
//  Trennern, gebrandete Panel-Header und dichte Mono-Tabellen.
// ═════════════════════════════════════════════════════════════════════════════

export const C = {
  bg:        "#080808",
  bgPanel:   "#0d0d0d",
  bgRaised:  "rgba(255,255,255,0.022)",
  line:      "rgba(255,255,255,0.07)",
  lineSoft:  "rgba(255,255,255,0.045)",
  gold:      "#d4af37",
  goldLight: "#f8e49b",
  goldDim:   "#b99c64",
  goldFaint: "#8a7440",
  text:      "#e8e8e8",
  textDim:   "#8f8f8f",
  textMute:  "#5a5a5a",
  textFaint: "#3f3f3f",
  green:     "#3fcf8e",
  red:       "#f0506e",
  amber:     "#facc15",
  blue:      "#63b6ff",
};

export const F = {
  display: "'Bebas Neue', sans-serif",
  ui:      "'Montserrat', sans-serif",
  mono:    "'DM Mono', monospace",
};

// ── PANEL ────────────────────────────────────────────────────────────────────
export const panel = (accent = false) => ({
  background: "linear-gradient(168deg, rgba(255,255,255,0.032), rgba(255,255,255,0.008) 60%, rgba(212,175,55,0.014))",
  border: `1px solid ${accent ? "rgba(212,175,55,0.22)" : C.line}`,
  borderRadius: 14,
  backdropFilter: "blur(18px) saturate(140%)",
  WebkitBackdropFilter: "blur(18px) saturate(140%)",
  boxShadow: "0 18px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.045)",
});

// ── TYPOGRAFIE ───────────────────────────────────────────────────────────────
export const overline = (color = C.textMute) => ({
  fontFamily: F.ui, fontSize: 8, fontWeight: 700,
  letterSpacing: "0.24em", textTransform: "uppercase", color,
});

export const kpiValue = (color = C.text, size = 22) => ({
  fontFamily: F.mono, fontSize: size, fontWeight: 500, letterSpacing: "-0.01em", color,
});

export const displayTitle = (size = 26) => ({
  fontFamily: F.display, fontSize: size, letterSpacing: "0.16em", color: "#fdfdfd", lineHeight: 1,
});

// ── BUTTONS ──────────────────────────────────────────────────────────────────
export const btnPrimary = {
  padding: "10px 20px", borderRadius: 9, cursor: "pointer", border: "none",
  background: "linear-gradient(135deg, #e8c86a, #c9a24b 55%, #a8823a)",
  color: "#0a0a0a", fontFamily: F.ui, fontSize: 9.5, fontWeight: 700,
  letterSpacing: "0.16em", textTransform: "uppercase",
  boxShadow: "0 4px 16px rgba(212,175,55,0.22)", transition: "all 0.2s",
};

export const btnGhost = (active = false) => ({
  padding: "9px 16px", borderRadius: 9, cursor: "pointer",
  background: active ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.02)",
  border: `1px solid ${active ? "rgba(212,175,55,0.42)" : C.line}`,
  color: active ? C.goldLight : C.textDim,
  fontFamily: F.ui, fontSize: 9, fontWeight: 700,
  letterSpacing: "0.16em", textTransform: "uppercase", transition: "all 0.2s",
});

// ── BADGE / PILL ─────────────────────────────────────────────────────────────
export const badge = (color, filled = false) => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  fontFamily: F.ui, fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
  color: filled ? "#0a0a0a" : color,
  background: filled ? color : `${color}14`,
  border: `1px solid ${color}${filled ? "" : "38"}`,
  padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
});

export const countPill = (color = C.gold) => ({
  fontFamily: F.mono, fontSize: 8.5, color,
  background: `${color}12`, border: `1px solid ${color}30`,
  padding: "1.5px 6px", borderRadius: 5, marginLeft: 7,
});

// ── TABELLE ──────────────────────────────────────────────────────────────────
export const tableHead = {
  fontFamily: F.ui, fontSize: 8, fontWeight: 700,
  letterSpacing: "0.2em", textTransform: "uppercase", color: C.textFaint,
};
export const cell = { padding: "11px 12px", fontFamily: F.mono, fontSize: 11.5, color: C.text };
export const rowBorder = `1px solid ${C.lineSoft}`;

// ── GLOBALE STYLES ───────────────────────────────────────────────────────────
export const GLOBAL_CSS = `
  @keyframes vsxpulse { 0%,100% { opacity: 1; } 50% { opacity: 0.22; } }
  @keyframes vsxfade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .vsx-fade { animation: vsxfade 0.35s cubic-bezier(0.22,1,0.36,1); }
  .vsx-table tbody tr { transition: background 0.14s; }
  .vsx-table tbody tr:hover { background: rgba(212,175,55,0.055) !important; }
  .vsx-scroll::-webkit-scrollbar { height: 7px; width: 7px; }
  .vsx-scroll::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.22); border-radius: 4px; }
  .vsx-scroll::-webkit-scrollbar-track { background: transparent; }
  .vsx-chart, .vsx-chart * { user-select: none; -webkit-user-select: none; -moz-user-select: none; }
  .vsx-hover-gold:hover { border-color: rgba(212,175,55,0.5) !important; color: ${C.goldLight} !important; }
`;

// ── WORDMARK ─────────────────────────────────────────────────────────────────
export function Wordmark({ sub, size = 22 }) {
  return (
    <div style={{ lineHeight: 1 }}>
      <div style={{
        fontFamily: F.display, fontSize: size, letterSpacing: "0.3em",
        background: "linear-gradient(135deg, #ffffff 30%, #e6d6a8 75%, #c9a24b)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>VISIONX</div>
      {sub && <div style={{ ...overline(C.goldDim), fontSize: 7, letterSpacing: "0.42em", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── KPI-LEISTE (Kopfzeile wie im Portfolio Tracker) ─────────────────────────
export function KpiStrip({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 0 }}>
      {items.filter(Boolean).map((k, i) => (
        <div key={k.label + i} style={{
          padding: "0 26px", display: "flex", flexDirection: "column", gap: 7,
          borderLeft: i === 0 ? "none" : `1px solid ${C.lineSoft}`,
        }}>
          <span style={overline()}>{k.label}</span>
          <span style={kpiValue(k.color || C.text, k.size || 21)}>{k.value}</span>
          {k.hint && <span style={{ fontFamily: F.mono, fontSize: 9, color: k.hintColor || C.textMute }}>{k.hint}</span>}
        </div>
      ))}
    </div>
  );
}

// ── PANEL-HEADER (gebrandeter Block über Tabellen) ──────────────────────────
export function PanelHeader({ overline: ov, title, meta = [] }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 22,
      padding: "18px 22px", borderBottom: `1px solid ${C.lineSoft}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Wordmark sub="Market Analytics" size={19} />
        <div style={{ width: 1, alignSelf: "stretch", background: `linear-gradient(180deg, transparent, ${C.line}, transparent)` }} />
        <div>
          {ov && <div style={{ ...overline(C.goldDim), marginBottom: 6 }}>{ov}</div>}
          <div style={displayTitle(21)}>{title}</div>
        </div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 30 }}>
        {meta.filter(Boolean).map((m, i) => (
          <div key={i} style={{ textAlign: "right" }}>
            <div style={{ ...overline(), marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontFamily: F.mono, fontSize: 13, color: m.color || C.text }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SEITENKOPF je Modul ──────────────────────────────────────────────────────
export function ModuleHead({ title, sub, kpis = [], right = null }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 24, marginBottom: 10 }}>
        <div>
          <div style={{ ...overline(C.goldDim), marginBottom: 8 }}>VisionX Analytics</div>
          <div style={displayTitle(30)}>{title}</div>
        </div>
        {kpis.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex" }}>
            <KpiStrip items={kpis} />
          </div>
        )}
        {right && <div style={{ marginLeft: kpis.length ? 0 : "auto" }}>{right}</div>}
      </div>
      {sub && (
        <div style={{ fontFamily: F.ui, fontSize: 10.5, color: C.textMute, letterSpacing: "0.03em", lineHeight: 1.6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── AMBIENT-HINTERGRUND ──────────────────────────────────────────────────────
export function Ambient({ tint = "rgba(99,182,255,0.03)" }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      <div style={{ position: "absolute", top: -260, right: "-8%", width: 900, height: 900, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(212,175,55,0.055), transparent 62%)", filter: "blur(60px)" }} />
      <div style={{ position: "absolute", bottom: -340, left: "-12%", width: 940, height: 940, borderRadius: "50%",
        background: `radial-gradient(circle, ${tint}, transparent 62%)`, filter: "blur(70px)" }} />
    </div>
  );
}

// ── DROPDOWN ─────────────────────────────────────────────────────────────────
// Ein natives <select> lässt sich nicht stylen — die Optionsliste kommt vom
// Betriebssystem, weiß mit Systemschrift, und goldener Text darauf ist
// unlesbar. Deshalb ein eigenes Popover.
export function Dropdown({ value, options, onChange, placeholder, width = 230 }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const current = options.find(o => o.value === value);

  return (
    <div ref={boxRef} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          minWidth: width, padding: "7px 12px", borderRadius: 9, cursor: "pointer",
          background: value ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(212,175,55,0.05))" : "rgba(255,255,255,0.02)",
          border: `1px solid ${value ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.09)"}`,
          color: value ? "#f8e49b" : "#8a8a8a",
          fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", textAlign: "left",
        }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current ? current.label : placeholder}
        </span>
        <span style={{ fontSize: 7, opacity: 0.7, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 90,
          minWidth: width + 30, maxHeight: 340, overflowY: "auto",
          background: "rgba(14,14,14,0.97)", backdropFilter: "blur(18px)",
          border: "1px solid rgba(212,175,55,0.22)", borderRadius: 11,
          boxShadow: "0 18px 46px rgba(0,0,0,0.7)", padding: 5,
        }} className="vsx-scroll">
          {options.map(o => {
            const active = o.value === value;
            return (
              <div key={o.value ?? "__none"} role="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "baseline", gap: 9, padding: "8px 11px",
                  borderRadius: 7, cursor: "pointer",
                  background: active ? "rgba(212,175,55,0.14)" : "transparent",
                  color: active ? "#f8e49b" : "#c9c9c9",
                  fontFamily: "'Montserrat', sans-serif", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.1em",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ minWidth: 30, color: active ? C.gold : "#7f7f7f", fontFamily: "'DM Mono', monospace", fontSize: 9 }}>
                  {o.code || ""}
                </span>
                <span style={{ flex: 1, textTransform: "uppercase" }}>{o.label}</span>
                {o.hint && (
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: "#5f5f5f", letterSpacing: "0.04em" }}>
                    {o.hint}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
