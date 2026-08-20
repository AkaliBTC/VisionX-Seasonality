// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · API-SCHUTZ
//  Drei Stufen, damit ein öffentlich sichtbarer Link keine Kontingente frisst:
//   1. Zugangs-Token  — nur wer den Code kennt, löst Requests aus
//   2. Rate-Limit     — Requests pro IP und Zeitfenster
//   3. Provider-Quota — Tageslimit für kostenpflichtige Quellen (TD, CMC)
//
//  Environment Variables auf Vercel:
//   VSX_ACCESS_TOKEN   Zugangscode (leer = Gate deaktiviert)
//   VSX_RATE_LIMIT     Requests pro IP und Minute (Standard 40)
//   VSX_TD_DAILY       Twelve-Data-Calls pro Tag (Standard 700)
//   VSX_CMC_DAILY      CMC-Calls pro Tag (Standard 300)
// ═════════════════════════════════════════════════════════════════════════════

const TOKEN = process.env.VSX_ACCESS_TOKEN || "";
const RATE = parseInt(process.env.VSX_RATE_LIMIT || "40", 10);
const TD_DAILY = parseInt(process.env.VSX_TD_DAILY || "700", 10);
const CMC_DAILY = parseInt(process.env.VSX_CMC_DAILY || "300", 10);

export const gateEnabled = () => Boolean(TOKEN);

// ── ZUGANG ───────────────────────────────────────────────────────────────────
// Token kommt als Header oder Query-Parameter. Zeitkonstanter Vergleich, damit
// sich der Code nicht über Antwortzeiten erraten lässt.
const safeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const checkAccess = (req) => {
  if (!TOKEN) return { ok: true, gated: false };
  const given = String(req.headers["x-vsx-token"] || req.query?.token || "");
  return { ok: given.length > 0 && safeEqual(given, TOKEN), gated: true };
};

// ── RATE-LIMIT (pro Lambda-Instanz) ──────────────────────────────────────────
// Hinweis: Serverless-Instanzen sind kurzlebig und laufen parallel, das Limit
// ist daher eine wirksame Bremse, aber keine harte globale Obergrenze.
const buckets = new Map();
const WINDOW = 60_000;

export const rateLimit = (req, cost = 1) => {
  if (RATE <= 0) return { ok: true };
  const ip = String(
    req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown"
  ).split(",")[0].trim();
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.start > WINDOW) {
    buckets.set(ip, { start: now, used: cost });
    if (buckets.size > 500) {                       // Speicher begrenzen
      for (const [k, v] of buckets) if (now - v.start > WINDOW) buckets.delete(k);
    }
    return { ok: true, remaining: RATE - cost };
  }
  b.used += cost;
  if (b.used > RATE) {
    return { ok: false, retryAfter: Math.ceil((WINDOW - (now - b.start)) / 1000) };
  }
  return { ok: true, remaining: RATE - b.used };
};

// ── PROVIDER-QUOTA (Tageszähler) ─────────────────────────────────────────────
const quota = { day: "", td: 0, cmc: 0 };
const today = () => new Date().toISOString().slice(0, 10);

const roll = () => { if (quota.day !== today()) { quota.day = today(); quota.td = 0; quota.cmc = 0; } };

export const quotaLeft = (provider) => {
  roll();
  const cap = provider === "td" ? TD_DAILY : CMC_DAILY;
  return Math.max(0, cap - quota[provider]);
};

export const useQuota = (provider, n = 1) => {
  roll();
  const cap = provider === "td" ? TD_DAILY : CMC_DAILY;
  if (quota[provider] + n > cap) return false;
  quota[provider] += n;
  return true;
};

// ── STANDARD-WACHE für einen Endpoint ───────────────────────────────────────
// Gibt true zurück, wenn weitergearbeitet werden darf; sonst ist die Antwort
// bereits gesendet.
export const guard = (req, res, cost = 1) => {
  const access = checkAccess(req);
  if (!access.ok) {
    res.setHeader("Cache-Control", "no-store");
    res.status(401).json({ error: "unauthorized", gated: true });
    return false;
  }
  const rl = rateLimit(req, cost);
  if (!rl.ok) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", String(rl.retryAfter || 60));
    res.status(429).json({ error: "rate_limited", retryAfter: rl.retryAfter });
    return false;
  }
  return true;
};
