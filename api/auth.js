// ── VISIONX ANALYTICS · ZUGANG ───────────────────────────────────────────────
// GET  /api/auth              → { gated: true|false }
// POST /api/auth { token }    → { ok: true|false }
//
// Das Frontend fragt beim Start ab, ob ein Gate aktiv ist, und validiert den
// eingegebenen Code hier. Der Code selbst liegt ausschließlich serverseitig.

import { gateEnabled, checkAccess, rateLimit } from "./_guard.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({ gated: gateEnabled() });
  }

  if (req.method === "POST") {
    // Brute-Force bremsen: Login-Versuche zählen dreifach
    const rl = rateLimit(req, 3);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfter || 60));
      return res.status(429).json({ ok: false, error: "rate_limited" });
    }
    let token = "";
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      token = String(body.token || "");
    } catch { /* leer lassen */ }
    const ok = checkAccess({ headers: { "x-vsx-token": token }, query: {} }).ok;
    // Kleine Verzögerung gegen automatisiertes Durchprobieren
    if (!ok) await new Promise(r => setTimeout(r, 600));
    return res.status(ok ? 200 : 401).json({ ok });
  }

  return res.status(405).json({ error: "method_not_allowed" });
}
