import { useState, useEffect, Component } from "react";
import Seasonality from "./Charts";
import RRG from "./RRG";
import VIX from "./VIX";
import Cycle from "./Cycle";
import Fundamentals from "./Fundamentals";
import Bottom from "./Bottom";
import Breadth from "./Breadth";
import OnChain from "./OnChain";
import { C, F, overline, GLOBAL_CSS, Wordmark } from "./ui";
import { AccessGate, useAccess } from "./access";

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
  { id: "onchain",      label: "ON-CHAIN" },
];

const COMPONENTS = { rrg: RRG, vix: VIX, cycle: Cycle, fundamentals: Fundamentals, bottom: Bottom, breadth: Breadth, onchain: OnChain };

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
function Header({ lang, setLang, clock, onSignOut }) {
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
        {onSignOut && (
          <button onClick={onSignOut} title="Sign out"
            style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${C.line}`, borderRadius: 9,
              color: C.textMute, cursor: "pointer", padding: "6px 11px", fontFamily: F.ui,
              fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", transition: "all 0.2s" }}
            className="vsx-hover-gold">⏻</button>
        )}
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

// ── FEHLERGRENZE ─────────────────────────────────────────────────────────────
// Ohne die reißt ein Render-Fehler in einem einzigen Modul den kompletten
// React-Baum ab — die Seite wird weiß und man sieht nirgends, woran es lag.
// Mit ihr bleibt Kopfzeile und Navigation stehen, und die Meldung samt
// Stack-Anfang steht auf dem Schirm.
class ModuleBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null, info: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    this.setState({ info });
    // Auch in der Konsole, mit vollem Stack
    console.error(`[VisionX] Modul "${this.props.moduleId}" ist abgestürzt:`, err, info);
  }

  componentDidUpdate(prev) {
    // Beim Wechsel auf ein anderes Modul zurücksetzen
    if (prev.moduleId !== this.props.moduleId && this.state.err) {
      this.setState({ err: null, info: null });
    }
  }

  render() {
    const { err, info } = this.state;
    if (!err) return this.props.children;

    const stack = String(info?.componentStack || "").trim().split("\n").slice(0, 6).join("\n");
    const box = {
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(239,68,68,0.35)",
      borderRadius: 12, padding: "18px 22px", marginTop: 14,
      fontFamily: F.mono, fontSize: 11, color: "#f87171",
      whiteSpace: "pre-wrap", overflowX: "auto",
    };

    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 34px 60px" }}>
        <div style={{ ...overline("#f87171"), marginBottom: 10 }}>
          MODUL {String(this.props.moduleId || "").toUpperCase()} — RENDER-FEHLER
        </div>
        <div style={{ fontFamily: F.ui, fontSize: 12, color: C.textDim, lineHeight: 1.7 }}>
          Der Rest der Anwendung läuft weiter. Meldung unten kopieren — sie sagt genau,
          welche Zeile gestolpert ist.
        </div>
        <div style={box}>{err?.message || String(err)}</div>
        {stack && (
          <div style={{ ...box, borderColor: C.line, color: C.textMute }}>{stack}</div>
        )}
        <button onClick={() => this.setState({ err: null, info: null })}
          style={{ marginTop: 14, padding: "9px 16px", borderRadius: 9, cursor: "pointer",
            background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.42)",
            color: "#f8e49b", fontFamily: F.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.16em" }}>
          ERNEUT VERSUCHEN
        </button>
      </div>
    );
  }
}

export default function App() {
  const [active, setActive] = useState("seasonality");
  const [lang, setLang] = useState(loadLang);
  const [clock, setClock] = useState("");
  const access = useAccess();

  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* private */ } }, [lang]);
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("de-DE", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const M = COMPONENTS[active];

  // Zugangsschirm, solange das Gate aktiv und nicht entsperrt ist
  if (access.loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint, letterSpacing: "0.24em" }}>VISIONX</span>
      </div>
    );
  }
  if (access.gated && !access.unlocked) {
    return <AccessGate lang={lang} onUnlock={access.unlock} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
        body { margin: 0; background: ${C.bg}; }
        ${GLOBAL_CSS}
      `}</style>

      <Header lang={lang} setLang={setLang} clock={clock} onSignOut={access.gated ? access.signOut : null} />
      <ModuleNav active={active} setActive={setActive} />

      <div key={active} className="vsx-fade">
        <ModuleBoundary moduleId={active}>
          {active === "seasonality" ? <Seasonality nav={null} lang={lang} /> : <M lang={lang} />}
        </ModuleBoundary>
      </div>
    </div>
  );
}
