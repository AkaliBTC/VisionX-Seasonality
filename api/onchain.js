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

// Mehrere Slug-Kandidaten je Metrik: der erste, der 200 liefert, gewinnt.
// So kippt ein einzelner Namensdreher nicht die ganze Ansicht.
const BG_METRICS = {
  "sth-realized-price": { paths: ["sth-realized-price", "realized-price-sth", "sth_realized_price"], label: "STH Realized Price", unit: "USD" },
  "lth-realized-price": { paths: ["lth-realized-price", "realized-price-lth"], label: "LTH Realized Price", unit: "USD" },
  "realized-price":     { paths: ["realized-price", "realised-price"], label: "Realized Price", unit: "USD" },
  "sth-mvrv":           { paths: ["sth-mvrv", "mvrv-sth"], label: "STH MVRV", unit: "ratio" },
  "lth-mvrv":           { paths: ["lth-mvrv", "mvrv-lth"], label: "LTH MVRV", unit: "ratio" },
  "mvrv":               { paths: ["mvrv-ratio", "mvrv"], label: "MVRV", unit: "ratio" },
  "mvrv-zscore":        { paths: ["mvrv-zscore", "mvrv-z-score", "mvrv"], label: "MVRV Z-Score", unit: "z" },
  "sopr":               { paths: ["sopr"], label: "SOPR", unit: "ratio" },
  "nupl":               { paths: ["nupl"], label: "NUPL", unit: "ratio" },
  "supply-in-profit":   { paths: ["supply-in-profit", "supply-profit", "utxo-in-profit", "supply_in_profit"], label: "Supply in Profit", unit: "%" },
  "puell-multiple":     { paths: ["puell-multiple", "puell"], label: "Puell Multiple", unit: "ratio" },
  "sth-risk-index":     { paths: ["sth-risk-index", "sth-risk"], label: "STH Risk Index", unit: "score" },
  "cycle-extreme":      { paths: ["cycle-extreme"], label: "Cycle Extreme", unit: "score" },
  "aviv":               { paths: ["aviv"], label: "AVIV Ratio", unit: "ratio" },
  "hashrate":           { paths: ["hashrate", "hash-rate"], label: "Hashrate", unit: "H/s" },
  "active-addresses":   { paths: ["active-addresses", "address-active"], label: "Active Addresses", unit: "addr" },
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
  for (const path of def.paths) {
    try {
      const url = `${BG_BASE}/${path}${BG_TOKEN ? `?token=${encodeURIComponent(BG_TOKEN)}` : ""}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "VisionX-Analytics/1.0",
          Accept: "application/json",
          ...(BG_TOKEN ? { Authorization: `Bearer ${BG_TOKEN}` } : {}),
        },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json?.data || json?.values);
      if (!Array.isArray(rows) || rows.length < 10) continue;
      const out = rows.map(bgRow).filter(Boolean).sort((a, b) => a[0] - b[0]);
      if (out.length > 10) { out.slug = path; return out; }
    } catch { /* nächster Kandidat */ }
  }
  return null;
};

// ── ZEITREIHE ────────────────────────────────────────────────────────────────
// Zwei Hosts, weil api.blockchain.info zeitweise 5xx liefert, und sampled=true
// bei langen Zeiträumen — ungesampelt sind das ~6000 Punkte pro Chart und der
// Request läuft in den 30-Sekunden-Timeout der Function.
const BCI_HOSTS = ["https://blockchain.info", "https://api.blockchain.info"];

const fetchChart = async (id, timespan) => {
  const def = CHARTS[id];
  if (!def) return null;
  const sampled = timespan === "all" || timespan === "8years" ? "true" : "false";
  for (const host of BCI_HOSTS) {
    try {
      const url = `${host}/charts/${def.chart}?timespan=${timespan}&format=json&sampled=${sampled}&cors=true`;
      const res = await fetch(url, { headers: { "User-Agent": "VisionX-Analytics/1.0", Accept: "application/json" } });
      if (!res.ok) continue;
      const json = await res.json();
      const vals = json?.values;
      if (!Array.isArray(vals) || vals.length < 10) continue;
      const out = vals
        .filter(v => Number.isFinite(v?.x) && Number.isFinite(v?.y))
        .map(v => [v.x * 1000, +Number(v.y).toFixed(6)]);
      if (out.length > 10) return out;
    } catch { /* nächster Host */ }
  }
  return null;
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

// ── ANGEBOTSVERTEILUNG (Movement Zones) ──────────────────────────────────────
// Die echte Kostenbasis-Verteilung: wie viel BTC-Angebot liegt in welchem
// Preisbucket. Das ist der Datensatz hinter der STH-Distribution-Heatmap —
// gezählt wird Angebot in BTC, nicht gehandeltes Volumen.
//
// Format unbekannt, deshalb defensiv geparst. Zwei plausible Formen:
//   BREIT: { d: "2026-08-20", "60000": 12345, "61000": 23456, … }
//   LANG:  { d: "2026-08-20", price: 60000, supply: 12345 }
// Beide landen in derselben Struktur { ts[], buckets[], grid[][] }.
const BG_DIST_PATHS = [
  "movement-zones", "supply-distribution", "cost-basis-distribution",
  "realized-price-distribution", "distribution-realized-price", "utxo-distribution",
];

const MAX_DIST_DATES = 2200;
const MAX_DIST_BUCKETS = 420;

const parseDistribution = (rows) => {
  const first = rows.find(r => r && typeof r === "object");
  if (!first) return null;

  const dateOf = (row) => {
    for (const [k, v] of Object.entries(row)) {
      const lk = k.toLowerCase();
      if (lk === "d" || lk === "date") {
        const t = Date.parse(typeof v === "string" && v.length === 10 ? `${v}T00:00:00Z` : v);
        if (Number.isFinite(t)) return t;
      }
      if (lk === "unixts" || lk === "timestamp" || lk === "time") {
        const n = Number(v);
        if (Number.isFinite(n)) return n > 1e12 ? n : n * 1000;
      }
    }
    return null;
  };

  const numericKeys = Object.keys(first).filter(k => {
    const n = Number(k);
    return Number.isFinite(n) && n > 0;
  });

  // ── BREITES FORMAT ────────────────────────────────────────────────────────
  if (numericKeys.length >= 5) {
    const buckets = numericKeys.map(Number).sort((a, b) => a - b);
    const ts = [], grid = [];
    for (const row of rows) {
      const t = dateOf(row);
      if (t == null) continue;
      const line = new Array(buckets.length);
      for (let i = 0; i < buckets.length; i++) {
        const v = Number(row[String(buckets[i])]);
        line[i] = Number.isFinite(v) && v > 0 ? v : 0;
      }
      ts.push(t); grid.push(line);
    }
    return ts.length > 20 ? { ts, buckets, grid } : null;
  }

  // ── LANGES FORMAT ─────────────────────────────────────────────────────────
  // Zwei numerische Felder neben dem Datum: eines ist der Preisbucket, eines
  // die Menge. Erst über die Feldnamen entscheiden, sonst über die Streuung —
  // Buckets wiederholen sich über die Tage, Mengen praktisch nie.
  const skip = new Set(["d", "date", "unixts", "timestamp", "time", "t"]);
  const cand = Object.keys(first).filter(k => !skip.has(k.toLowerCase()) && Number.isFinite(Number(first[k])));
  if (cand.length < 2) return null;

  const priceLike = /price|bucket|zone|level|band|bin/i;
  const supplyLike = /supply|btc|coins|amount|value|qty/i;
  let priceKey = cand.find(k => priceLike.test(k));
  let supplyKey = cand.find(k => k !== priceKey && supplyLike.test(k));

  if (!priceKey || !supplyKey) {
    const distinct = k => new Set(rows.slice(0, 4000).map(r => Number(r[k]))).size;
    const sorted = [...cand].sort((a, b) => distinct(a) - distinct(b));
    priceKey = priceKey || sorted[0];
    supplyKey = supplyKey || sorted.find(k => k !== priceKey);
  }
  if (!priceKey || !supplyKey) return null;

  const byDate = new Map();
  const bucketSet = new Set();
  for (const row of rows) {
    const t = dateOf(row);
    const price = Number(row[priceKey]);
    const supply = Number(row[supplyKey]);
    if (t == null || !Number.isFinite(price) || price <= 0 || !Number.isFinite(supply)) continue;
    bucketSet.add(price);
    if (!byDate.has(t)) byDate.set(t, new Map());
    byDate.get(t).set(price, supply);
  }
  if (byDate.size < 20 || bucketSet.size < 5) return null;

  const buckets = [...bucketSet].sort((a, b) => a - b);
  const ts = [...byDate.keys()].sort((a, b) => a - b);
  const grid = ts.map(t => {
    const m = byDate.get(t);
    return buckets.map(b => {
      const v = m.get(b);
      return Number.isFinite(v) && v > 0 ? v : 0;
    });
  });
  return { ts, buckets, grid };
};

// Auf handliche Größe bringen: sonst wandern schnell mehrere MB durch die Leitung
const shrinkDistribution = (dist) => {
  let { ts, buckets, grid } = dist;

  if (buckets.length > MAX_DIST_BUCKETS) {
    const g = Math.ceil(buckets.length / MAX_DIST_BUCKETS);
    const nb = [], ng = grid.map(() => []);
    for (let i = 0; i < buckets.length; i += g) {
      const end = Math.min(buckets.length, i + g);
      nb.push(buckets[i]);
      for (let r = 0; r < grid.length; r++) {
        let sum = 0;
        for (let j = i; j < end; j++) sum += grid[r][j];
        ng[r].push(sum);
      }
    }
    buckets = nb; grid = ng;
  }

  if (ts.length > MAX_DIST_DATES) {
    const g = Math.ceil(ts.length / MAX_DIST_DATES);
    const nt = [], ng = [];
    for (let i = 0; i < ts.length; i += g) { nt.push(ts[i]); ng.push(grid[i]); }
    ts = nt; grid = ng;
  }

  // Auf ganze Zahlen runden — die Nachkommastellen kosten nur Bandbreite
  return { ts, buckets, grid: grid.map(r => r.map(v => Math.round(v))) };
};

const fetchBgDistribution = async () => {
  for (const path of BG_DIST_PATHS) {
    try {
      const url = `${BG_BASE}/${path}${BG_TOKEN ? `?token=${encodeURIComponent(BG_TOKEN)}` : ""}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "VisionX-Analytics/1.0",
          Accept: "application/json",
          ...(BG_TOKEN ? { Authorization: `Bearer ${BG_TOKEN}` } : {}),
        },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json?.data || json?.values);
      if (!Array.isArray(rows) || rows.length < 20) continue;
      const parsed = parseDistribution(rows);
      if (parsed) return { ...shrinkDistribution(parsed), slug: path };
    } catch { /* nächster Kandidat */ }
  }
  return null;
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
        if (series) {
          data[id] = Array.from(series);
          meta[id] = { label: BG_METRICS[id].label, unit: BG_METRICS[id].unit, slug: series.slug };
        } else failed.push(id);
      }));
    }
    res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
    return res.status(200).json({ data, meta, failed, source: "bgeometrics", tokenSet: Boolean(BG_TOKEN) });
  }

  // Angebotsverteilung — eigener Zweig, weil das Ergebnis eine Matrix ist
  if (req.query.action === "distribution") {
    const dist = await fetchBgDistribution();
    res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
    if (!dist) return res.status(200).json({ distribution: null, tried: BG_DIST_PATHS });
    return res.status(200).json({ distribution: dist, source: "bgeometrics" });
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
