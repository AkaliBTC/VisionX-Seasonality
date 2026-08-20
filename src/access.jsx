import { useState, useEffect } from "react";
import { C, F, overline, btnPrimary, panel } from "./ui";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · ZUGANG
//  Schützt die API-Kontingente, wenn der Link im Stream sichtbar ist.
//  Der Code liegt ausschließlich serverseitig (VSX_ACCESS_TOKEN auf Vercel);
//  das Frontend hält nur ein bestätigtes Token im localStorage.
// ═════════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = "vsx_access_token";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
};
const setToken = (v) => {
  try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch { /* private */ }
};

// ── FETCH-WRAPPER ────────────────────────────────────────────────────────────
// Hängt das Token an jede API-Anfrage und übersetzt 401/429 in klare Fehler,
// damit die Module nicht stumm leer bleiben.
export async function apiFetch(url, options = {}) {
  const token = getToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { "x-vsx-token": token } : {}) },
  });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("vsx-auth-required"));
    throw new Error("ACCESS_REQUIRED");
  }
  if (res.status === 429) {
    const retry = res.headers.get("Retry-After") || "60";
    throw new Error(`RATE_LIMITED:${retry}`);
  }
  return res;
}

const T = {
  de: {
    title: "ZUGANG", sub: "VisionX Analytics ist zugangsbeschränkt",
    label: "Zugangscode", button: "ENTSPERREN", wrong: "Code nicht korrekt",
    limited: "Zu viele Versuche · bitte kurz warten",
    hint: "Der Code schützt die Datenkontingente. Er gilt für dieses Gerät, bis du dich abmeldest.",
    checking: "PRÜFE…",
  },
  en: {
    title: "ACCESS", sub: "VisionX Analytics is access-restricted",
    label: "Access code", button: "UNLOCK", wrong: "Code not correct",
    limited: "Too many attempts · please wait a moment",
    hint: "The code protects the data quotas. It stays valid on this device until you sign out.",
    checking: "CHECKING…",
  },
};

// ── ZUGANGSSCHIRM ────────────────────────────────────────────────────────────
export function AccessGate({ lang = "de", onUnlock }) {
  const t = T[lang] || T.de;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code.trim() }),
      });
      if (res.ok) { setToken(code.trim()); onUnlock(); }
      else if (res.status === 429) setErr(t.limited);
      else setErr(t.wrong);
    } catch { setErr(t.wrong); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 700, height: 700,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.07), transparent 62%)", filter: "blur(60px)" }} />
      </div>
      <div style={{ ...panel(true), position: "relative", width: 420, maxWidth: "100%", padding: "34px 34px 30px", textAlign: "center" }}>
        <img src="https://i.postimg.cc/pd4xzT1r/87011e66-b8e4-4d2b-9977-a06bb4b29902.png"
          width={58} height={58} alt="VisionX"
          style={{ objectFit: "contain", filter: "drop-shadow(0 0 16px rgba(212,175,55,0.5))", marginBottom: 18 }} />
        <div style={{ fontFamily: F.display, fontSize: 24, letterSpacing: "0.3em",
          background: "linear-gradient(135deg, #ffffff 30%, #e6d6a8 75%, #c9a24b)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>VISIONX</div>
        <div style={{ ...overline(C.goldDim), marginBottom: 22 }}>{t.title}</div>
        <div style={{ fontFamily: F.ui, fontSize: 11, color: C.textDim, marginBottom: 20 }}>{t.sub}</div>

        <input type="password" value={code} autoFocus
          onChange={e => { setCode(e.target.value); setErr(""); }}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder={t.label}
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.035)",
            border: `1px solid ${err ? "rgba(240,80,110,0.5)" : C.line}`, color: C.goldLight,
            fontFamily: F.mono, fontSize: 15, letterSpacing: "0.22em", textAlign: "center",
            padding: "13px 16px", borderRadius: 11, outline: "none", marginBottom: 14, transition: "border-color 0.2s" }} />

        <button onClick={submit} disabled={busy}
          style={{ ...btnPrimary, width: "100%", padding: "12px 20px", opacity: busy ? 0.6 : 1 }}>
          {busy ? t.checking : t.button}
        </button>

        {err && (
          <div style={{ fontFamily: F.ui, fontSize: 10, color: C.red, marginTop: 13 }}>{err}</div>
        )}
        <div style={{ fontFamily: F.ui, fontSize: 9, color: C.textFaint, marginTop: 20, lineHeight: 1.7 }}>{t.hint}</div>
      </div>
    </div>
  );
}

// ── HOOK: Gate-Status ────────────────────────────────────────────────────────
export function useAccess() {
  const [state, setState] = useState({ loading: true, gated: false, unlocked: false });

  const check = async () => {
    try {
      const res = await fetch("/api/auth");
      const json = await res.json();
      if (!json.gated) return setState({ loading: false, gated: false, unlocked: true });
      // Gate aktiv: gespeichertes Token gegen einen echten Call prüfen
      const token = getToken();
      if (!token) return setState({ loading: false, gated: true, unlocked: false });
      const probe = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState({ loading: false, gated: true, unlocked: probe.ok });
      if (!probe.ok) setToken("");
    } catch {
      // API nicht erreichbar (z.B. lokal ohne `vercel dev`) — nicht aussperren
      setState({ loading: false, gated: false, unlocked: true });
    }
  };

  useEffect(() => { check(); }, []);
  useEffect(() => {
    const onAuth = () => setState(s => ({ ...s, gated: true, unlocked: false }));
    window.addEventListener("vsx-auth-required", onAuth);
    return () => window.removeEventListener("vsx-auth-required", onAuth);
  }, []);

  return { ...state, unlock: () => setState(s => ({ ...s, unlocked: true })), signOut: () => { setToken(""); setState(s => ({ ...s, unlocked: false })); } };
}
