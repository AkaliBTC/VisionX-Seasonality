import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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
// Gemeinsame Textur- und Bewegungsschicht. Liegt im globalen CSS, damit jeder
// Tab dieselbe Anmutung hat, ohne dass jedes Modul sie neu erfindet.
export const SURFACE_CSS = `
  /* Feines Rauschen über der ganzen Fläche — nimmt dem Schwarz das Flache,
     ohne sichtbares Muster. Rein dekorativ, fängt keine Klicks ab. */
  .vsx-app::before {
    content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    opacity: 0.035; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  /* Warmer Lichtabfall von oben, damit die Kopfzeile nicht auf Schwarz klebt */
  .vsx-app::after {
    content: ""; position: fixed; inset: 0 0 auto 0; height: 420px;
    pointer-events: none; z-index: 0;
    background: radial-gradient(120% 100% at 50% -30%, rgba(212,175,55,0.055), transparent 70%);
  }

  @keyframes vsxRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes vsxFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes vsxSheen { from { background-position: -200% 0; } to { background-position: 200% 0; } }

  .vsx-fade { animation: vsxRise 0.42s cubic-bezier(0.22,1,0.36,1) both; }
  .vsx-stagger > * { animation: vsxRise 0.4s cubic-bezier(0.22,1,0.36,1) both; }
  .vsx-stagger > *:nth-child(1) { animation-delay: 0.02s; }
  .vsx-stagger > *:nth-child(2) { animation-delay: 0.06s; }
  .vsx-stagger > *:nth-child(3) { animation-delay: 0.10s; }
  .vsx-stagger > *:nth-child(4) { animation-delay: 0.14s; }
  .vsx-stagger > *:nth-child(5) { animation-delay: 0.18s; }

  /* Panels: ruhiger Hover, kein Springen */
  .vsx-panel { transition: border-color 0.3s ease, background 0.3s ease, transform 0.3s cubic-bezier(0.22,1,0.36,1); }
  .vsx-panel:hover { border-color: rgba(212,175,55,0.18); }

  /* Ladeschimmer für Platzhalter */
  .vsx-shimmer {
    background: linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(212,175,55,0.07) 50%, rgba(255,255,255,0.02) 75%);
    background-size: 200% 100%; animation: vsxSheen 1.8s linear infinite;
  }

  /* ── TABELLEN · Terminal-Anmutung ───────────────────────────────────────── */
  /* Zahlen mit gleicher Ziffernbreite: Spalten fluchten, das Auge kann
     Größenordnungen vergleichen statt sie zu lesen. */
  .vsx-table { font-variant-numeric: tabular-nums; }
  .vsx-table thead th {
    position: sticky; top: 0; z-index: 3; padding-top: 14px; padding-bottom: 10px;
    background: linear-gradient(180deg, rgba(16,16,16,0.99), rgba(12,12,12,0.97));
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 1px 0 rgba(255,255,255,0.07);
  }
  .vsx-table tbody tr { transition: background 0.14s ease; }
  .vsx-table tbody tr:hover { background: rgba(212,175,55,0.05); }
  /* Goldene Kante links beim Überfahren — markiert die Zeile, ohne sie zu färben */
  .vsx-table tbody tr td:first-child { position: relative; }
  .vsx-table tbody tr:hover td:first-child::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
    background: linear-gradient(180deg, transparent, #d4af37, transparent);
  }
  /* Alle vier Zeilen eine minimal hellere Bahn: hilft beim Verfolgen nach rechts */
  .vsx-table tbody tr:nth-child(4n+1) { background: rgba(255,255,255,0.012); }
  .vsx-table tbody tr:nth-child(4n+1):hover { background: rgba(212,175,55,0.05); }

  @media (prefers-reduced-motion: reduce) {
    .vsx-fade, .vsx-stagger > *, .vsx-shimmer { animation: none !important; }
  }
`;

export const GLOBAL_CSS = SURFACE_CSS + `
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
export function Dropdown({ value, options, onChange, placeholder, width = 230, search = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // Position beim Öffnen messen. Das Popover hängt per Portal am <body>, damit
  // es nicht am overflow eines Panels abgeschnitten wird — genau das ist im
  // Bottom Radar passiert, wo die Liste an der Panelkante endete.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setRect({
      left: Math.min(r.left, window.innerWidth - (width + 60)),
      top: below > 300 ? r.bottom + 6 : null,
      bottom: below > 300 ? null : window.innerHeight - r.top + 6,
      maxH: Math.max(200, Math.min(420, below > 300 ? below - 24 : r.top - 24)),
    });
  }, [open, width]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = e => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    // Scrollen INNERHALB der Liste darf nicht schließen — vorher hat der
    // Handler jedes Scroll-Ereignis abgefangen, auch das eigene.
    const onScroll = e => { if (popRef.current?.contains(e.target)) return; setOpen(false); };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const current = options.find(o => o.value === value);
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? options.filter(o => `${o.code || ""} ${o.label} ${o.hint || ""}`.toLowerCase().includes(needle))
    : options;

  const rowStyle = active => ({
    display: "flex", alignItems: "baseline", gap: 9, padding: "8px 11px",
    borderRadius: 7, cursor: "pointer",
    background: active ? "rgba(212,175,55,0.14)" : "transparent",
    color: active ? "#f8e49b" : "#c9c9c9",
    fontFamily: F.ui, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.1em",
  });

  let lastGroup = null;

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          minWidth: width, padding: "7px 12px", borderRadius: 9, cursor: "pointer",
          background: value ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(212,175,55,0.05))" : "rgba(255,255,255,0.02)",
          border: `1px solid ${value ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.09)"}`,
          color: value ? "#f8e49b" : "#8a8a8a",
          fontFamily: F.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", textAlign: "left",
        }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current ? current.label : placeholder}
        </span>
        <span style={{ fontSize: 7, opacity: 0.7, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
      </button>

      {open && rect && createPortal(
        <div ref={popRef} style={{
          position: "fixed", left: rect.left, top: rect.top ?? undefined, bottom: rect.bottom ?? undefined,
          zIndex: 9999, minWidth: width + 40, maxHeight: rect.maxH, overflowY: "auto",
          background: "rgba(13,13,13,0.98)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(212,175,55,0.22)", borderRadius: 11,
          boxShadow: "0 20px 50px rgba(0,0,0,0.75)", padding: 5,
          overscrollBehavior: "contain",   // am Listenende nicht auf die Seite durchreichen
        }} className="vsx-scroll">
          {search && (
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="…"
              style={{ width: "100%", boxSizing: "border-box", margin: "2px 0 6px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 7, padding: "7px 10px", color: "#f8e49b", outline: "none",
                fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em" }} />
          )}
          {shown.length === 0 && (
            <div style={{ padding: "10px 11px", fontFamily: F.mono, fontSize: 10, color: "#5a5a5a" }}>—</div>
          )}
          {shown.map(o => {
            const active = o.value === value;
            const head = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group || lastGroup;
            return (
              <div key={o.value ?? `__none_${o.label}`}>
                {head && (
                  <div style={{ padding: "9px 11px 5px", fontFamily: F.ui, fontSize: 7.5, fontWeight: 700,
                    letterSpacing: "0.22em", color: "#5f5f5f", textTransform: "uppercase" }}>
                    {head}
                  </div>
                )}
                <div role="button" onClick={() => { onChange(o.value); setOpen(false); }}
                  style={rowStyle(active)}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  {o.code !== undefined && (
                    <span style={{ minWidth: 30, color: active ? C.gold : "#7f7f7f", fontFamily: F.mono, fontSize: 9 }}>
                      {o.code}
                    </span>
                  )}
                  <span style={{ flex: 1, textTransform: "uppercase" }}>{o.label}</span>
                  {o.hint && (
                    <span style={{ fontFamily: F.mono, fontSize: 8.5, color: "#5f5f5f", letterSpacing: "0.04em" }}>
                      {o.hint}
                    </span>
                  )}
                  {o.tag && (
                    <span style={{ fontFamily: F.mono, fontSize: 7.5, color: o.tagColor || "#7a6a3a",
                      border: `1px solid ${o.tagColor || "#7a6a3a"}55`, borderRadius: 4, padding: "1px 4px" }}>
                      {o.tag}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>, document.body)}
    </>
  );
}

// ── MODAL ────────────────────────────────────────────────────────────────────
// Detailansichten gehören nicht unter die Tabelle, wo man erst hinscrollen muss
// und die Zeile aus dem Blick verliert. Overlay per Portal, damit kein
// overflow eines Panels dazwischenfunkt.
export function Modal({ open, onClose, title, subtitle, badge: badgeNode, children, width = 1180 }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9998, display: "flex",
        alignItems: "flex-start", justifyContent: "center", padding: "48px 24px",
        background: "rgba(4,4,4,0.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        animation: "vsxFadeIn 0.18s ease both", overflowY: "auto",
      }}>
      <div className="vsx-scroll" style={{
        width: "100%", maxWidth: width, background: "rgba(13,13,13,0.97)",
        border: "1px solid rgba(212,175,55,0.20)", borderRadius: 18,
        boxShadow: "0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03) inset",
        animation: "vsxRise 0.26s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 2, display: "flex", flexWrap: "wrap",
          alignItems: "center", gap: 14, padding: "18px 22px",
          borderBottom: `1px solid ${C.lineSoft}`,
          background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(13,13,13,0.96))",
          borderRadius: "18px 18px 0 0", backdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 11, minWidth: 0 }}>
            <span style={{ fontFamily: F.display, fontSize: 24, letterSpacing: "0.14em", color: "#fdfdfd",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
            {subtitle && (
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textMute, letterSpacing: "0.06em" }}>{subtitle}</span>
            )}
          </div>
          {badgeNode}
          <button onClick={onClose} title="Esc"
            style={{ marginLeft: "auto", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}`,
              borderRadius: 9, color: C.textMute, cursor: "pointer", padding: "7px 13px",
              fontFamily: F.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.16em" }}
            className="vsx-hover-gold">ESC ✕</button>
        </div>
        <div style={{ padding: "20px 22px 24px" }}>{children}</div>
      </div>
    </div>, document.body);
}

