import { useState } from "react";
import Seasonality from "./Charts";
import RRG from "./RRG";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · MODULE HUB
//  Neue Module hier registrieren — Seasonality & RRG sind die ersten beiden.
// ═════════════════════════════════════════════════════════════════════════════

const MODULES = [
  { id: "seasonality", label: "SEASONALITY", component: Seasonality },
  { id: "rrg",         label: "RRG",         component: RRG },
];

const GOLD = "#d4af37";

export default function App() {
  const [active, setActive] = useState("seasonality");
  const Active = MODULES.find(m => m.id === active).component;

  return (
    <div style={{ minHeight: "100vh", background: "#121212" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
        body { margin: 0; background: #121212; }
        .hub-tab { transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
        .hub-tab:hover { color: #f8e49b !important; }
      `}</style>

      {/* HUB-NAVIGATION */}
      <div style={{
        display: "flex", alignItems: "center", gap: 26, padding: "16px 28px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(18,18,18,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.3em", lineHeight: 1, whiteSpace: "nowrap" }}>
          <span style={{ color: "#fdfdfd" }}>VISION</span>
          <span style={{ color: GOLD, textShadow: "0 0 14px rgba(212,175,55,0.45)" }}>X</span>
          <span style={{ color: "#4a4a4a", marginLeft: 14, fontSize: 15, letterSpacing: "0.32em" }}>ANALYTICS</span>
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {MODULES.map(m => (
            <button key={m.id} className="hub-tab" onClick={() => setActive(m.id)}
              style={{
                background: active === m.id ? "rgba(212,175,55,0.1)" : "transparent",
                border: `1px solid ${active === m.id ? "rgba(212,175,55,0.4)" : "transparent"}`,
                borderRadius: 10, padding: "9px 18px", cursor: "pointer",
                fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 700,
                letterSpacing: "0.2em", color: active === m.id ? GOLD : "#777",
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <Active />
    </div>
  );
}
