import { useState, useEffect } from "react";
import Seasonality from "./Charts";
import RRG from "./RRG";
import VIX from "./VIX";
import Cycle from "./Cycle";
import Fundamentals from "./Fundamentals";
import Bottom from "./Bottom";
import Breadth from "./Breadth";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · MODULE HUB
//  Kein zweiter Header — die Modul-Navigation sitzt exakt dort, wo vorher
//  die "SEASONALITY"-Subline stand. Neue Module: unten registrieren.
// ═════════════════════════════════════════════════════════════════════════════

const MODULES = [
  { id: "seasonality", label: "SEASONALITY" },
  { id: "rrg",         label: "RRG" },
  { id: "vix",         label: "VIX ANALYSIS" },
  { id: "cycle",       label: "SPX CYCLE" },
  { id: "fundamentals", label: "FUNDAMENTALS" },
  { id: "bottom",      label: "BOTTOM RADAR" },
  { id: "breadth",     label: "BREADTH" },
];

const COMPONENTS = { rrg: RRG, vix: VIX, cycle: Cycle, fundamentals: Fundamentals, bottom: Bottom, breadth: Breadth };

const LANG_KEY = "vsx_lang_v1";
const loadLang = () => { try { const l = localStorage.getItem(LANG_KEY); if (l === "de" || l === "en") return l; } catch { /* default */ } return "de"; };

// Subline-Tabs im Stil der alten .logo-sub (7px, letterspaced, gold)
function ModuleNav({ active, setActive }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
      {MODULES.map((m, i) => (
        <span key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {i > 0 && <span style={{ fontSize: 7, color: "#333" }}>◆</span>}
          <button onClick={() => setActive(m.id)}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif", fontSize: 7, fontWeight: active === m.id ? 700 : 500,
              letterSpacing: "0.4em", textTransform: "uppercase",
              color: active === m.id ? "#d4af37" : "#555",
              textShadow: active === m.id ? "0 0 10px rgba(212,175,55,0.4)" : "none",
              transition: "all 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            onMouseEnter={e => { if (active !== m.id) e.currentTarget.style.color = "#b99c64"; }}
            onMouseLeave={e => { if (active !== m.id) e.currentTarget.style.color = "#555"; }}>
            {m.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// DE/EN-Umschalter — für Posts, die in beiden Sprachen rausgehen
function LangToggle({ lang, setLang }) {
  return (
    <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 10,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {["de", "en"].map(l => (
        <button key={l} onClick={() => setLang(l)}
          style={{ padding: "5px 11px", borderRadius: 7, cursor: "pointer", border: "none",
            background: lang === l ? "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))" : "transparent",
            color: lang === l ? "#f8e49b" : "#5a5a5a",
            fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em",
            transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Header-Replikat für Nicht-Seasonality-Module (identisch zum Charts.jsx-Header)
function HubHeader({ nav, lang, setLang }) {
  return (
    <div style={{ height: 76, padding: "0 48px", display: "flex", alignItems: "center", background: "rgba(18,18,18,0.55)", backdropFilter: "blur(28px) saturate(160%)", WebkitBackdropFilter: "blur(28px) saturate(160%)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <img src="https://i.postimg.cc/pd4xzT1r/87011e66-b8e4-4d2b-9977-a06bb4b29902.png"
          width={52} height={52} alt="VisionX"
          style={{ objectFit: "contain", filter: "drop-shadow(0 0 12px rgba(212,175,55,0.5))" }} />
        <div style={{ width: 1, height: 32, background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.4), transparent)" }} />
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: "0.25em", background: "linear-gradient(135deg,#fff,#e8e8e8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VISIONX</div>
          {nav}
        </div>
      </div>
      <div style={{ marginLeft: "auto" }}><LangToggle lang={lang} setLang={setLang} /></div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("seasonality");
  const [lang, setLang] = useState(loadLang);
  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* private */ } }, [lang]);
  const nav = <ModuleNav active={active} setActive={setActive} />;

  if (active === "seasonality") return <Seasonality nav={nav} lang={lang} />;

  return (
    <div style={{ minHeight: "100vh", background: "#121212" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
        body { margin: 0; background: #121212; }
      `}</style>
      <HubHeader nav={nav} lang={lang} setLang={setLang} />
      {(() => { const M = COMPONENTS[active]; return <M lang={lang} />; })()}
    </div>
  );
}
