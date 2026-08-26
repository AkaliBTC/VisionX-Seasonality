import { guard } from "./_guard.js";

// ── VISIONX ANALYTICS · ON-CHAIN PROXY ───────────────────────────────────────
// GET /api/onchain?metrics=mvrv,nvt,hash-rate&timespan=3years
// GET /api/onchain?action=snapshot
//
// Quelle 1: blockchain.info /charts  — Aggregat-Zeitreihen, kein Key
// Quelle 2: mempool.space /api       — Live-Snapshot (Mempool, Fees, Difficulty)
// Quelle 3: api.bgeometrics.com /v1  — UTXO-Level (STH/LTH, SOPR, Supply in Profit)
//
// Alle drei Quellen sind frei zugänglich. BGeometrics liefert den Teil, den
// blockchain.info nicht kann: Kohorten-Metriken auf UTXO-Ebene.
//
// Cache: 12h s-maxage. On-Chain-Aggregate sind Tagesdaten, häufiger zu ziehen
// bringt nichts. Snapshot läuft mit 60s, weil Mempool und Fees leben.

const CHARTS = {
  // id                  → { chart: blockchain.info chart-name, unit, label, scale }
  "mvrv":               { chart: "mvrv",                           unit: "ratio", label: "MVRV" },
  "nvt":                { chart: "nvt",                            unit: "ratio", label: "NVT" },
  "nvts":               { chart: "nvts",                           unit: "ratio", label: "NVT Signal" },
  "hash-rate":          { chart: "hash-rate",                      unit: "TH/s",  label: "Hashrate" },
  "difficulty":         { chart: "difficulty",                     unit: "",      label: "Difficulty" },
  "n-transactions":     { chart: "n-transactions",                 unit: "tx",    label: "Transaktionen / Tag" },
  "n-unique-addresses": { chart: "n-unique-addresses",             unit: "addr",  label: "Aktive Adressen" },
  "miners-revenue":     { chart: "miners-revenue",                 unit: "USD",   label: "Miner-Umsatz" },
  "transaction-fees":   { chart: "transaction-fees-usd",           unit: "USD",   label: "Gebühren (USD)" },
  "market-cap":         { chart: "market-cap",                     unit: "USD",   label: "Market Cap" },
  "market-price":       { chart: "market-price",                   unit: "USD",   label: "BTC/USD" },
  "total-bitcoins":     { chart: "total-bitcoins",                 unit: "BTC",   label: "Umlaufmenge" },
  "tx-volume-usd":      { chart: "estimated-transaction-volume-usd", unit: "USD", label: "Transfervolumen" },
  "mempool-size":       { chart: "mempool-size",                   unit: "bytes", label: "Mempool-Größe" },
};

const TIMESPANS = new Set(["30days", "180days", "1year", "2years", "3years", "5years", "8years", "all"]);

// ── BGEOMETRICS / bitcoin-data.com ───────────────────────────────────────────
// Freie UTXO-Level-Metriken: genau die Lücke, die blockchain.info nicht deckt.
// Ohne Token läuft der Free-Tier mit begrenztem Kontingent; BG_TOKEN in den
// Vercel Environment Variables hebt das an.
//
// WICHTIG: Die Slugs unten sind aus der Doku-Übersicht abgeleitet, nicht
// einzeln verifiziert. Falls ein Endpoint 404 liefert, hier korrigieren —
// die Liste steht unter https://api.bgeometrics.com/scalar.html. Das Frontend
// fällt bei Fehlern automatisch auf die Volumenprofil-Proxies zurück.
const BG_BASE = "https://api.bgeometrics.com/v1";
const BG_TOKEN = process.env.BG_TOKEN || "";

const BG_METRICS = {
  "sth-realized-price": { path: "sth-realized-price", label: "STH Realized Price", unit: "USD" },
  "lth-realized-price": { path: "lth-realized-price", label: "LTH Realized Price", unit: "USD" },
  "realized-price":     { path: "realized-price",     label: "Realized Price",     unit: "USD" },
  "sth-mvrv":           { path: "sth-mvrv",           label: "STH MVRV",           unit: "ratio" },
  "lth-mvrv":           { path: "lth-mvrv",           label: "LTH MVRV",           unit: "ratio" },
  "mvrv-zscore":        { path: "mvrv-zscore",        label: "MVRV Z-Score",       unit: "z" },
  "sopr":               { path: "sopr",               label: "SOPR",               unit: "ratio" },
  "nupl":               { path: "nupl",               label: "NUPL",               unit: "ratio" },
  "supply-in-profit":   { path: "supply-in-profit",   label: "Supply in Profit",   unit: "%" },
  "puell-multiple":     { path: "puell-multiple",     label: "Puell Multiple",     unit: "ratio" },
  "sth-risk-index":     { path: "sth-risk-index",     label: "STH Risk Index",     unit: "score" },
  "cycle-extreme":      { path: "cycle-extreme",      label: "Cycle Extreme",      unit: "score" },
  "aviv":               { path: "aviv",               label: "AVIV Ratio",         unit: "ratio" },
  "true-market-mean":   { path: "true-market-mean",   label: "True Market Mean",   unit: "USD" },
};

// BG benennt das Wertfeld je Metrik anders (sthRealizedPrice, sopr, nupl …).
// Statt die Namen zu raten: erstes numerisches Feld nehmen, das kein
// Zeitstempel ist. Robust gegen jede Umbenennung auf Anbieterseite.
const TIME_KEYS = new Set(["d", "date", "unixts", "unixTs", "timestamp", "time", "t"]);

const bgRow = (row) => {
  let ts = null, val = null;
  for (const [k, v] of Object.entries(row)) {
    const lk = k.toLowerCase();
    if (ts == null && (lk === "d" || lk === "date")) {
      const parsed = Date.parse(typeof v === "string" && v.length === 10 ? `${v}T00:00:00Z` : v);
      if (Number.isFinite(parsed)) ts = parsed;
      continue;
    }
    if (ts == null && (lk === "unixts" || lk === "timestamp" || lk === "time")) {
      const n = Number(v);
      if (Number.isFinite(n)) ts = n > 1e12 ? n : n * 1000;
      continue;
    }
    if (val == null && !TIME_KEYS.has(lk)) {
      const n = Number(v);
      if (Number.isFinite(n)) val = n;
    }
  }
  return ts != null && val != null ? [ts, val] : null;
};

const fetchBg = async (id) => {
  const def = BG_METRICS[id];
  if (!def) return null;
  try {
    const url = `${BG_BASE}/${def.path}${BG_TOKEN ? `?token=${encodeURIComponent(BG_TOKEN)}` : ""}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "VisionX-Analytics/1.0",
        Accept: "application/json",
        ...(BG_TOKEN ? { Authorization: `Bearer ${BG_TOKEN}` } : {}),
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const rows = Array.isArray(json) ? json : (json?.data || json?.values);
    if (!Array.isArray(rows) || rows.length < 10) return null;
    const out = rows.map(bgRow).filter(Boolean).sort((a, b) => a[0] - b[0]);
    return out.length > 10 ? out : null;
  } catch { return null; }
};

// ── ZEITREIHE ────────────────────────────────────────────────────────────────
const fetchChart = async (id, timespan) => {
  const def = CHARTS[id];
  if (!def) return null;
  try {
    const url = `https://api.blockchain.info/charts/${def.chart}`
      + `?timespan=${timespan}&format=json&sampled=false&cors=true`;
    const res = await fetch(url, { headers: { "User-Agent": "VisionX-Analytics/1.0" } });
    if (!res.ok) return null;
    const json = await res.json();
    const vals = json?.values;
    if (!Array.isArray(vals) || vals.length < 10) return null;
    return vals
      .filter(v => Number.isFinite(v?.x) && Number.isFinite(v?.y))
      .map(v => [v.x * 1000, +Number(v.y).toFixed(6)]);
  } catch { return null; }
};

// ── LIVE-SNAPSHOT ────────────────────────────────────────────────────────────
const j = async (url) => {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "VisionX-Analytics/1.0" } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
};

const fetchSnapshot = async () => {
  const [mempool, fees, diff, tip, price] = await Promise.all([
    j("https://mempool.space/api/mempool"),
    j("https://mempool.space/api/v1/fees/recommended"),
    j("https://mempool.space/api/v1/difficulty-adjustment"),
    j("https://mempool.space/api/blocks/tip/height"),
    j("https://mempool.space/api/v1/prices"),
  ]);
  return {
    mempoolTx:      mempool?.count ?? null,
    mempoolVsize:   mempool?.vsize ?? null,
    mempoolFeeBtc:  mempool?.total_fee != null ? mempool.total_fee / 1e8 : null,
    feeFastest:     fees?.fastestFee ?? null,
    feeHalfHour:    fees?.halfHourFee ?? null,
    feeHour:        fees?.hourFee ?? null,
    feeMinimum:     fees?.minimumFee ?? null,
    blockHeight:    typeof tip === "number" ? tip : null,
    diffChangePct:  diff?.difficultyChange ?? null,
    diffProgress:   diff?.progressPercent ?? null,
    diffRemaining:  diff?.remainingBlocks ?? null,
    priceUsd:       price?.USD ?? null,
    ts:             Date.now(),
  };
};

// ── HANDLER ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!guard(req, res, 1)) return;

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.query.action === "snapshot") {
    const snap = await fetchSnapshot();
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ snapshot: snap });
  }

  if (req.query.action === "catalog") {
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    return res.status(200).json({
      metrics: [
        ...Object.entries(CHARTS).map(([id, d]) => ({ id, label: d.label, unit: d.unit, source: "blockchain.info" })),
        ...Object.entries(BG_METRICS).map(([id, d]) => ({ id, label: d.label, unit: d.unit, source: "bgeometrics" })),
      ],
      timespans: [...TIMESPANS],
    });
  }

  // UTXO-Level-Metriken von BGeometrics. Eigener Zweig, weil der Anbieter
  // keine Zeitraum-Parameter kennt — es kommt immer die volle Historie.
  if (req.query.action === "utxo") {
    const want = String(req.query.metrics || "")
      .split(",").map(x => x.trim().toLowerCase()).filter(x => BG_METRICS[x]).slice(0, 10);
    if (!want.length) return res.status(400).json({ error: "metrics required" });

    const data = {}, meta = {}, failed = [];
    for (let i = 0; i < want.length; i += 3) {
      await Promise.all(want.slice(i, i + 3).map(async id => {
        const series = await fetchBg(id);
        if (series) { data[id] = series; meta[id] = BG_METRICS[id]; }
        else failed.push(id);
      }));
    }
    res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
    return res.status(200).json({ data, meta, failed, source: "bgeometrics", tokenSet: Boolean(BG_TOKEN) });
  }

  const ids = String(req.query.metrics || "mvrv,nvt,hash-rate")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 8);
  const timespan = TIMESPANS.has(req.query.timespan) ? req.query.timespan : "3years";

  if (!ids.length) return res.status(400).json({ error: "metrics required" });

  const data = {};
  const meta = {};
  const failed = [];

  // 4 parallel — blockchain.info verträgt das, mehr bringt nichts
  for (let i = 0; i < ids.length; i += 4) {
    await Promise.all(ids.slice(i, i + 4).map(async id => {
      const series = await fetchChart(id, timespan);
      if (series && series.length) {
        data[id] = series;
        meta[id] = { label: CHARTS[id].label, unit: CHARTS[id].unit };
      } else failed.push(id);
    }));
  }

  res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
  return res.status(200).json({ data, meta, failed, timespan, source: "blockchain.info" });
}
