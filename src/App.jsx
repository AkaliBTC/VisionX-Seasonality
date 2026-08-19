import { useState, useEffect } from "react";
import Seasonality from "./Charts";
import RRG from "./RRG";
import VIX from "./VIX";
import Cycle from "./Cycle";
import Fundamentals from "./Fundamentals";
import Bottom from "./Bottom";
import Breadth from "./Breadth";
import { C, F, overline, GLOBAL_CSS, Wordmark } from "./ui";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · SHELL
//  Kopfzeile, Modul-Navigation und Sprachumschalter im Portfolio-Tracker-Stil.
// ═════════════════════════════════════════════════════════════════════════════

const MODULES = [
  { id: "seasonality",  label: "SEASONALITY" },
  { id: "rrg",          label: "RRG" },
  { id: "vix",          label: "VIX ANALYSIS" },
  { id: "cycle",        label: "SPX CYCLE" },
  { id: "fundamentals", label: "FUNDAMENTALS" },
  { id: "bottom",       label: "BOTTOM RADAR" },
  { id: "breadth",      label: "BREADTH" },
];

const COMPONENTS = { rrg: RRG, vix: VIX, cycle: Cycle, fundamentals: Fundamentals, bottom: Bottom, breadth: Breadth };

const LANG_KEY = "vsx_lang_v1";
const loadLang = () => {
  try { const l = localStorage.getItem(LANG_KEY); if (l === "de" || l === "en") return l; } catch { /* default */ }
  return "de";
};

const LOGO = "https://i.postimg.cc/pd4xzT1r/87011e66-b8e4-4d2b-9977-a06bb4b29902.png";

// ── SPRACHUMSCHALTER ─────────────────────────────────────────────────────────
function LangToggle({ lang, setLang }) {
  return (
    <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 9,
      background: "rgba(255,255,255,0.025)", border: `1px solid ${C.line}` }}>
      {["de", "en"].map(l => (
        <button key={l} onClick={() => setLang(l)}
          style={{
            padding: "5px 12px", borderRadius: 6, cursor: "pointer", border: "none",
            background: lang === l ? "linear-gradient(135deg, #e8c86a, #c9a24b)" : "transparent",
            color: lang === l ? "#0a0a0a" : C.textMute,
            fontFamily: F.ui, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em",
            transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
          }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── KOPFZEILE ────────────────────────────────────────────────────────────────
function Header({ lang, setLang, clock }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 20, padding: "16px 34px 0 34px",
      background: "rgba(8,8,8,0.9)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
    }}>
      <img src={LOGO} width={46} height={46} alt="VisionX"
        style={{ objectFit: "contain", filter: "drop-shadow(0 0 14px rgba(212,175,55,0.45))" }} />
      <div style={{ width: 1, height: 34, background: `linear-gradient(180deg, transparent, rgba(212,175,55,0.35), transparent)` }} />
      <Wordmark sub="Market Analytics" size={23} />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, letterSpacing: "0.1em" }}>{clock}</span>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
    </div>
  );
}

// ── MODUL-NAVIGATION ─────────────────────────────────────────────────────────
function ModuleNav({ active, setActive }) {
  return (
    <div className="vsx-scroll" style={{
      display: "flex", alignItems: "stretch", gap: 4, padding: "0 34px",
      borderBottom: `1px solid ${C.line}`, overflowX: "auto",
      background: "rgba(8,8,8,0.9)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      {MODULES.map(m => {
        const on = active === m.id;
        return (
          <button key={m.id} onClick={() => setActive(m.id)}
            style={{
              position: "relative", background: "transparent", border: "none", cursor: "pointer",
              padding: "16px 18px 14px", whiteSpace: "nowrap",
              fontFamily: F.ui, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.2em",
              color: on ? C.goldLight : C.textMute,
              transition: "color 0.22s cubic-bezier(0.22,1,0.36,1)",
            }}
            onMouseEnter={e => { if (!on) e.currentTarget.style.color = C.textDim; }}
            onMouseLeave={e => { if (!on) e.currentTarget.style.color = C.textMute; }}>
            {m.label}
            <span style={{
              position: "absolute", left: 14, right: 14, bottom: -1, height: 2, borderRadius: 2,
              background: on ? "linear-gradient(90deg, transparent, #d4af37, transparent)" : "transparent",
              boxShadow: on ? "0 0 12px rgba(212,175,55,0.65)" : "none",
              transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
            }} />
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("seasonality");
  const [lang, setLang] = useState(loadLang);
  const [clock, setClock] = useState("");

  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* private */ } }, [lang]);
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("de-DE", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const M = COMPONENTS[active];

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
        body { margin: 0; background: ${C.bg}; }
        ${GLOBAL_CSS}
      `}</style>

      <Header lang={lang} setLang={setLang} clock={clock} />
      <ModuleNav active={active} setActive={setActive} />

      <div key={active} className="vsx-fade">
        {active === "seasonality" ? <Seasonality nav={null} lang={lang} /> : <M lang={lang} />}
      </div>
    </div>
  );
}
