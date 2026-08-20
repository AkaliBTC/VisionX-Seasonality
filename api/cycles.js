// ── VISIONX ANALYTICS · CYCLE.TOOLS PROXY ────────────────────────────────────
// Anbindung an die Zyklus-Engine von Lars von Thienen (whentotrade / Foundation
// for the Study of Cycles). Der Algorithmus selbst ist proprietär und läuft
// serverseitig bei ihm — deshalb bindet man ihn an, statt ihn nachzubauen.
//
// POST /api/cycles?min=30&max=290&forward=0
//   Body: { closes: [ ... ] }   (Schlusskurse als Zahlenarray, ältester zuerst)
//
// Antwort (Auszug aus der CycleExplorer-Spezifikation):
//   length            dominante Zykluslänge in Bars
//   amplitude, phase  Zyklus-Kenngrößen
//   lastlow, lasttop  letzte Wendepunkte als Bar-Versatz zum letzten Bar
//   nextlow, nexttop  nächste erwartete Wendepunkte als Bar-Versatz
//   cyclePhase        lesbarer Phasenstatus, z.B. "approaching top"
//   cycleProfitability  Score für den Handel dieses Zyklus auf den Daten
//   phasingScore      kombinierter Phasenstatus kurz-/langfristig (−200…+200)
//   timeseries        Punktreihe zum Plotten
//
// Environment Variable auf Vercel:
//   CYCLE_TOOLS_KEY   persönlicher API-Key (erfordert "Analyst"-Abo bei
//                     whentotrade). Ohne Key nutzt der Endpoint den öffentlichen
//                     Vorschau-Key, der nur zum Testen gedacht und limitiert ist.

import { guard } from "./_guard.js";

const KEY = process.env.CYCLE_TOOLS_KEY || "wttpreview";
const BASE = process.env.CYCLE_TOOLS_BASE || "https://api.marketcycles.online/api";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!guard(req, res, 3)) return;

  let closes = [];
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    closes = Array.isArray(body.closes) ? body.closes : [];
  } catch { /* leer lassen */ }

  closes = closes.map(Number).filter(Number.isFinite);
  if (closes.length < 100) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({ error: "need_at_least_100_closes", got: closes.length });
  }
  // Die Engine arbeitet auf einem begrenzten Fenster; mehr bringt keinen
  // Mehrwert, kostet aber Übertragung und Rechenzeit.
  if (closes.length > 3000) closes = closes.slice(-3000);

  const min = Math.max(5, parseInt(req.query.min) || 30);
  const max = Math.min(1000, Math.max(min + 5, parseInt(req.query.max) || 290));
  const forward = Math.min(400, Math.max(0, parseInt(req.query.forward) || 0));

  const url = `${BASE}/CycleExplorer`
    + `?minCycleLength=${min}&maxCycleLength=${max}`
    + `&plotForward=${forward}&includeTimeseries=true&api_Key=${encodeURIComponent(KEY)}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(closes),
    });
    const text = await r.text();
    if (!r.ok) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        error: "cycle_tools_error",
        status: r.status,
        detail: text.slice(0, 300),
        usingPreviewKey: KEY === "wttpreview",
      });
    }
    let json = null;
    try { json = JSON.parse(text); } catch { /* nicht parsebar */ }
    if (!json) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ error: "unparsable_response", detail: text.slice(0, 300) });
    }
    // Ergebnis 6h am Edge cachen — die Analyse ändert sich nur mit neuen Kerzen
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({
      engine: "cycle.tools",
      usingPreviewKey: KEY === "wttpreview",
      bars: closes.length,
      band: { min, max },
      result: json,
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ error: String(e?.message || e) });
  }
}
