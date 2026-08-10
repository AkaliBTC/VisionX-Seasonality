// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · FUNDAMENTAL SCORING ENGINE
//  Sektor-relative Bewertung: jede Kennzahl wird gegen die Median-Benchmark
//  ihres Sektors gemessen, nicht gegen einen absoluten Universalwert.
//  P/E 30 ist für Utilities teuer, für Software normal — genau das bildet das ab.
// ═════════════════════════════════════════════════════════════════════════════

// ── SEKTOR-BENCHMARKS ────────────────────────────────────────────────────────
// Werte = typische Mediane des jeweiligen Sektors (Richtwerte, langfristig
// stabil genug für relative Einordnung). Anpassbar, wenn eure Datenlage abweicht.
export const SECTOR_BENCH = {
  "Technology":             { pe: 30, pfwd: 26, ps: 6.0, pb: 7.0, ev: 20, gm: 0.55, om: 0.22, nm: 0.18, roe: 0.22, rg: 0.12, eg: 0.15, de: 55,  cr: 1.9 },
  "Communication Services": { pe: 22, pfwd: 19, ps: 3.2, pb: 3.4, ev: 12, gm: 0.48, om: 0.18, nm: 0.13, roe: 0.16, rg: 0.08, eg: 0.10, de: 70,  cr: 1.3 },
  "Consumer Cyclical":      { pe: 20, pfwd: 18, ps: 1.4, pb: 3.5, ev: 13, gm: 0.36, om: 0.10, nm: 0.07, roe: 0.18, rg: 0.07, eg: 0.09, de: 95,  cr: 1.2 },
  "Consumer Defensive":     { pe: 21, pfwd: 19, ps: 1.3, pb: 4.0, ev: 14, gm: 0.38, om: 0.12, nm: 0.08, roe: 0.20, rg: 0.04, eg: 0.05, de: 90,  cr: 1.1 },
  "Healthcare":             { pe: 24, pfwd: 18, ps: 3.0, pb: 4.2, ev: 15, gm: 0.60, om: 0.18, nm: 0.13, roe: 0.18, rg: 0.08, eg: 0.10, de: 65,  cr: 1.5 },
  "Financial Services":     { pe: 13, pfwd: 12, ps: 3.0, pb: 1.5, ev: 12, gm: 0.55, om: 0.30, nm: 0.22, roe: 0.13, rg: 0.06, eg: 0.08, de: 120, cr: 1.1 },
  "Industrials":            { pe: 22, pfwd: 19, ps: 2.0, pb: 4.0, ev: 14, gm: 0.32, om: 0.13, nm: 0.09, roe: 0.18, rg: 0.06, eg: 0.08, de: 90,  cr: 1.3 },
  "Basic Materials":        { pe: 16, pfwd: 14, ps: 1.5, pb: 2.2, ev: 9,  gm: 0.28, om: 0.13, nm: 0.09, roe: 0.13, rg: 0.04, eg: 0.05, de: 60,  cr: 1.8 },
  "Energy":                 { pe: 13, pfwd: 12, ps: 1.2, pb: 1.8, ev: 6,  gm: 0.35, om: 0.15, nm: 0.10, roe: 0.15, rg: 0.03, eg: 0.04, de: 45,  cr: 1.3 },
  "Utilities":              { pe: 19, pfwd: 17, ps: 2.2, pb: 2.0, ev: 12, gm: 0.42, om: 0.20, nm: 0.11, roe: 0.10, rg: 0.03, eg: 0.05, de: 145, cr: 0.9 },
  "Real Estate":            { pe: 33, pfwd: 30, ps: 6.5, pb: 2.4, ev: 19, gm: 0.55, om: 0.28, nm: 0.18, roe: 0.08, rg: 0.05, eg: 0.06, de: 110, cr: 1.1 },
};
// Fallback = breiter Marktdurchschnitt
export const MARKET_BENCH = { pe: 21, pfwd: 18, ps: 2.5, pb: 3.2, ev: 14, gm: 0.42, om: 0.16, nm: 0.11, roe: 0.16, rg: 0.07, eg: 0.09, de: 85, cr: 1.4 };

export const benchFor = (sector) => SECTOR_BENCH[sector] || MARKET_BENCH;

// ── PUNKTVERGABE ─────────────────────────────────────────────────────────────
// Jede Kennzahl → 0..100 Punkte, gemessen als Verhältnis zur Sektor-Benchmark.
// higherBetter=false: Wert unter Benchmark ist gut (z.B. P/E).
// tol bestimmt, wie stark eine Abweichung durchschlägt (1.0 = ±100% -> 0/100).
const scoreRatio = (value, bench, higherBetter, tol = 0.6) => {
  if (value == null || !isFinite(value) || bench == null || bench === 0) return null;
  if (value <= 0 && !higherBetter) return null;          // negatives KGV: nicht bewertbar
  const rel = higherBetter ? value / bench - 1 : 1 - value / bench;
  return Math.max(0, Math.min(100, 50 + (rel / tol) * 50));
};

// Kategorie-Definitionen: welche Kennzahl gegen welche Benchmark, mit Gewicht
const CATEGORIES = [
  {
    id: "valuation", label: "VALUATION",
    parts: [
      { key: "peForward", bench: "pfwd", hb: false, w: 3 },
      { key: "peTrailing", bench: "pe", hb: false, w: 2 },
      { key: "priceToSales", bench: "ps", hb: false, w: 2 },
      { key: "evEbitda", bench: "ev", hb: false, w: 2 },
      { key: "priceToBook", bench: "pb", hb: false, w: 1 },
    ],
  },
  {
    id: "profitability", label: "PROFITABILITY",
    parts: [
      { key: "profitMargin", bench: "nm", hb: true, w: 3 },
      { key: "operatingMargin", bench: "om", hb: true, w: 2 },
      { key: "roe", bench: "roe", hb: true, w: 3 },
      { key: "grossMargin", bench: "gm", hb: true, w: 1 },
    ],
  },
  {
    id: "growth", label: "GROWTH",
    parts: [
      { key: "revenueGrowth", bench: "rg", hb: true, w: 3, tol: 1.5 },
      { key: "earningsGrowth", bench: "eg", hb: true, w: 3, tol: 1.5 },
    ],
  },
  {
    id: "balance", label: "BALANCE",
    parts: [
      { key: "debtToEquity", bench: "de", hb: false, w: 3 },
      { key: "currentRatio", bench: "cr", hb: true, w: 2 },
    ],
  },
];

// Risiko wird separat bewertet (absolut, nicht sektorrelativ)
const riskScore = (d) => {
  const parts = [];
  if (d.shortPctFloat != null && isFinite(d.shortPctFloat)) {
    // <3% Float short = unauffällig, >20% = kritisch
    parts.push({ v: Math.max(0, Math.min(100, 100 - ((d.shortPctFloat - 0.03) / 0.17) * 100)), w: 3 });
  }
  if (d.beta != null && isFinite(d.beta)) {
    // Beta 1 = neutral (75 Pkt), 2+ = hoch riskant, <0.7 = defensiv
    parts.push({ v: Math.max(0, Math.min(100, 100 - Math.abs(d.beta - 0.9) * 55)), w: 2 });
  }
  if (d.freeCashflow != null && isFinite(d.freeCashflow)) {
    parts.push({ v: d.freeCashflow > 0 ? 85 : 20, w: 2 });
  }
  if (!parts.length) return null;
  const wsum = parts.reduce((a, p) => a + p.w, 0);
  return Math.round(parts.reduce((a, p) => a + p.v * p.w, 0) / wsum);
};

// ── AMPEL ────────────────────────────────────────────────────────────────────
export const LIGHTS = {
  green:  { id: "green",  label: "GREEN",  color: "#22c55e", verdict: "Solide Fundamentaldaten über Sektorschnitt", verdictEn: "Solid fundamentals above sector average" },
  yellow: { id: "yellow", label: "YELLOW", color: "#facc15", verdict: "Gemischtes Bild — Stärken und Schwächen halten sich die Waage", verdictEn: "Mixed picture — strengths and weaknesses balance out" },
  red:    { id: "red",    label: "RED",    color: "#ef4444", verdict: "Fundamental unter Sektorschnitt", verdictEn: "Fundamentals below sector average" },
  grey:   { id: "grey",   label: "N/A",    color: "#6b7280", verdict: "Zu wenige Daten für eine Bewertung", verdictEn: "Not enough data to rate" },
};

export const lightFor = (score) => {
  if (score == null) return LIGHTS.grey;
  if (score >= 62) return LIGHTS.green;
  if (score >= 42) return LIGHTS.yellow;
  return LIGHTS.red;
};

// Gewichtung der Kategorien im Gesamturteil
const CAT_WEIGHTS = { valuation: 2, profitability: 3, growth: 2, balance: 2, risk: 1 };

// ── HAUPTFUNKTION ────────────────────────────────────────────────────────────
export function evaluate(d) {
  const b = benchFor(d.sector);
  const cats = {};
  const details = {};

  for (const cat of CATEGORIES) {
    const scored = [];
    for (const p of cat.parts) {
      const s = scoreRatio(d[p.key], b[p.bench], p.hb, p.tol);
      if (s != null) scored.push({ ...p, score: s, value: d[p.key], bench: b[p.bench] });
    }
    details[cat.id] = scored;
    if (!scored.length) { cats[cat.id] = null; continue; }
    const wsum = scored.reduce((a, x) => a + x.w, 0);
    cats[cat.id] = Math.round(scored.reduce((a, x) => a + x.score * x.w, 0) / wsum);
  }
  cats.risk = riskScore(d);

  // Gesamtscore nur, wenn mindestens drei Kategorien belegt sind
  const avail = Object.entries(cats).filter(([, v]) => v != null);
  let overall = null;
  if (avail.length >= 3) {
    const wsum = avail.reduce((a, [k]) => a + (CAT_WEIGHTS[k] || 1), 0);
    overall = Math.round(avail.reduce((a, [k, v]) => a + v * (CAT_WEIGHTS[k] || 1), 0) / wsum);
  }

  // Auffälligkeiten für das Resümee
  const flags = [];
  if (d.shortPctFloat != null && d.shortPctFloat >= 0.15) flags.push({ t: "warn", m: `Short Interest ${(d.shortPctFloat * 100).toFixed(0)}% des Float` });
  else if (d.shortPctFloat != null && d.shortPctFloat >= 0.08) flags.push({ t: "info", m: `Erhöhter Short Interest (${(d.shortPctFloat * 100).toFixed(0)}%)` });
  if (d.debtToEquity != null && d.debtToEquity > b.de * 2) flags.push({ t: "warn", m: `Verschuldung weit über Sektorschnitt (${d.debtToEquity.toFixed(0)} vs ${b.de})` });
  if (d.currentRatio != null && d.currentRatio < 1) flags.push({ t: "warn", m: `Current Ratio unter 1 (${d.currentRatio.toFixed(2)})` });
  if (d.freeCashflow != null && d.freeCashflow < 0) flags.push({ t: "warn", m: "Negativer Free Cashflow" });
  if (d.profitMargin != null && d.profitMargin < 0) flags.push({ t: "warn", m: "Verlust in der letzten Periode" });
  if (d.revenueGrowth != null && d.revenueGrowth > b.rg * 2.5) flags.push({ t: "good", m: `Umsatzwachstum weit über Sektor (${(d.revenueGrowth * 100).toFixed(0)}%)` });
  if (d.roe != null && d.roe > b.roe * 1.8) flags.push({ t: "good", m: `ROE deutlich über Sektor (${(d.roe * 100).toFixed(0)}%)` });
  if (cats.valuation != null && cats.valuation >= 70) flags.push({ t: "good", m: "Bewertung günstig relativ zum Sektor" });
  if (cats.valuation != null && cats.valuation <= 25) flags.push({ t: "info", m: "Bewertung ambitioniert relativ zum Sektor" });
  if (d.targetMean && d.price) {
    const up = d.targetMean / d.price - 1;
    if (up > 0.25) flags.push({ t: "good", m: `Analysten-Kursziel ${(up * 100).toFixed(0)}% über Kurs` });
    if (up < -0.05) flags.push({ t: "info", m: "Kurs über dem mittleren Analystenziel" });
  }

  return {
    overall,
    light: lightFor(overall),
    cats,
    details,
    bench: b,
    benchSource: SECTOR_BENCH[d.sector] ? d.sector : "Market average",
    flags,
    coverage: avail.length,
  };
}

export const CATEGORY_LIST = [...CATEGORIES.map(c => ({ id: c.id, label: c.label })), { id: "risk", label: "RISK" }];
