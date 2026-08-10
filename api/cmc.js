// ── VISIONX ANALYTICS · COINMARKETCAP PROXY ──────────────────────────────────
// GET /api/cmc?action=listings&limit=50           → Top-Coins nach Marktkapitalisierung
// GET /api/cmc?action=quotes&symbols=BTC,ETH      → aktuelle Kennzahlen je Coin
// GET /api/cmc?action=global                      → BTC-Dominanz, Total Market Cap
// GET /api/cmc?action=ohlcv&symbol=BTC&count=400  → Tageshistorie (nur ab Hobbyist-Plan)
//
// API-Key als Vercel Environment Variable: CMC_KEY
// Free/Basic-Tier: listings, quotes und global funktionieren; historische OHLCV
// verlangen einen bezahlten Plan. Das Frontend nutzt CMC daher fürs Universum
// und die Kennzahlen, die Kurshistorie kommt weiter über Binance (/api/history).

const CMC_KEY = process.env.CMC_KEY || "";
const BASE = "https://pro-api.coinmarketcap.com";

const call = async (path, params = {}) => {
  if (!CMC_KEY) return { error: "CMC_KEY not configured" };
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { "X-CMC_PRO_API_KEY": CMC_KEY, Accept: "application/json" },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return { error: json?.status?.error_message || `CMC ${res.status}`, status: res.status };
  }
  return json;
};

// Coins ohne verlässliches Binance-USDT-Paar rausfiltern lohnt nicht —
// das Frontend prüft ohnehin, ob Historie ankommt. Stablecoins und
// gewrappte Token sind für Rotation/Bottom-Picking aber sinnlos.
const EXCLUDE = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "PYUSD", "USDS", "BUSD",
  "WBTC", "WETH", "WBETH", "STETH", "WSTETH", "WEETH", "RETH", "CBBTC", "SOLVBTC",
  "BSC-USD", "USDT0",
]);

export default async function handler(req, res) {
  const action = String(req.query.action || "listings");

  try {
    if (action === "listings") {
      const limit = Math.min(200, Math.max(5, parseInt(req.query.limit) || 50));
      const json = await call("/v1/cryptocurrency/listings/latest", {
        start: 1, limit: limit + 25, convert: "USD", sort: "market_cap",
      });
      if (json.error) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ error: json.error, data: [] });
      }
      const data = (json.data || [])
        .filter(c => !EXCLUDE.has(c.symbol))
        .slice(0, limit)
        .map(c => ({
          symbol: c.symbol,
          name: c.name,
          rank: c.cmc_rank,
          price: c.quote?.USD?.price ?? null,
          marketCap: c.quote?.USD?.market_cap ?? null,
          volume24h: c.quote?.USD?.volume_24h ?? null,
          change24h: c.quote?.USD?.percent_change_24h ?? null,
          change7d: c.quote?.USD?.percent_change_7d ?? null,
          change30d: c.quote?.USD?.percent_change_30d ?? null,
          change90d: c.quote?.USD?.percent_change_90d ?? null,
          dominance: c.quote?.USD?.market_cap_dominance ?? null,
          supplyRatio: c.max_supply ? c.circulating_supply / c.max_supply : null,
        }));
      res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=7200");
      return res.status(200).json({ asOf: Date.now(), count: data.length, data });
    }

    if (action === "quotes") {
      const symbols = String(req.query.symbols || "")
        .split(",").map(s => s.trim().toUpperCase().replace(/-USD$/, "")).filter(Boolean).slice(0, 60);
      if (!symbols.length) return res.status(400).json({ error: "symbols required" });
      const json = await call("/v2/cryptocurrency/quotes/latest", {
        symbol: symbols.join(","), convert: "USD",
      });
      if (json.error) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ error: json.error, data: {} });
      }
      const out = {};
      for (const [sym, arr] of Object.entries(json.data || {})) {
        const c = Array.isArray(arr) ? arr[0] : arr;
        if (!c) continue;
        out[sym] = {
          symbol: sym, name: c.name, rank: c.cmc_rank,
          price: c.quote?.USD?.price ?? null,
          marketCap: c.quote?.USD?.market_cap ?? null,
          volume24h: c.quote?.USD?.volume_24h ?? null,
          change24h: c.quote?.USD?.percent_change_24h ?? null,
          change7d: c.quote?.USD?.percent_change_7d ?? null,
          change30d: c.quote?.USD?.percent_change_30d ?? null,
          change90d: c.quote?.USD?.percent_change_90d ?? null,
          dominance: c.quote?.USD?.market_cap_dominance ?? null,
        };
      }
      res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
      return res.status(200).json({ asOf: Date.now(), data: out });
    }

    if (action === "global") {
      const json = await call("/v1/global-metrics/quotes/latest", { convert: "USD" });
      if (json.error) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ error: json.error });
      }
      const d = json.data || {};
      res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
      return res.status(200).json({
        asOf: Date.now(),
        btcDominance: d.btc_dominance ?? null,
        ethDominance: d.eth_dominance ?? null,
        totalMarketCap: d.quote?.USD?.total_market_cap ?? null,
        totalVolume24h: d.quote?.USD?.total_volume_24h ?? null,
        altcoinMarketCap: d.quote?.USD?.altcoin_market_cap ?? null,
        defiMarketCap: d.quote?.USD?.defi_market_cap ?? null,
      });
    }

    if (action === "ohlcv") {
      // Nur mit bezahltem Plan verfügbar — Frontend fällt sonst auf Binance zurück.
      const symbol = String(req.query.symbol || "").toUpperCase().replace(/-USD$/, "");
      const count = Math.min(1000, Math.max(30, parseInt(req.query.count) || 400));
      if (!symbol) return res.status(400).json({ error: "symbol required" });
      const json = await call("/v2/cryptocurrency/ohlcv/historical", {
        symbol, count, interval: "daily", convert: "USD",
      });
      if (json.error) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ error: json.error, status: json.status, data: null });
      }
      const raw = json.data?.quotes || json.data?.[symbol]?.[0]?.quotes || [];
      const series = raw.map(q => [
        new Date(q.time_open).getTime(),
        q.quote?.USD?.open, q.quote?.USD?.high, q.quote?.USD?.low, q.quote?.USD?.close,
        q.quote?.USD?.volume ?? 0,
      ]).filter(r => r.slice(1, 5).every(Number.isFinite));
      res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
      return res.status(200).json({ asOf: Date.now(), symbol, data: series });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ error: String(e?.message || e) });
  }
}
