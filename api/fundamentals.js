// ── VISIONX ANALYTICS · FUNDAMENTALS PROXY ───────────────────────────────────
// GET /api/fundamentals?symbols=NVDA,MSFT,BAS.DE
//
// Quelle: Yahoo Finance quoteSummary (server-side → kein CORS, kein Key).
// Liefert Bewertung, Margen, Wachstum, Bilanz, Short-Interest und Analysten-Ziele.
// Cache: 6h Edge (s-maxage) + 24h stale-while-revalidate — Fundamentaldaten
// ändern sich quartalsweise, ein Fetch pro Symbol pro Tag genügt völlig.

const MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "summaryProfile",
].join(",");

const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

const v = (o) => (o && typeof o === "object" && "raw" in o ? o.raw : o ?? null);

const fetchOne = async (symbol) => {
  for (const host of HOSTS) {
    try {
      const url = `https://${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${MODULES}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const json = await res.json();
      const r = json?.quoteSummary?.result?.[0];
      if (!r) continue;

      const p = r.price || {};
      const s = r.summaryDetail || {};
      const k = r.defaultKeyStatistics || {};
      const f = r.financialData || {};
      const pr = r.summaryProfile || {};

      const shares = v(k.sharesOutstanding);
      const shortShares = v(k.sharesShort);
      const floatShares = v(k.floatShares);

      return {
        symbol,
        name: p.longName || p.shortName || symbol,
        sector: pr.sector || null,
        industry: pr.industry || null,
        currency: p.currency || null,

        price: v(p.regularMarketPrice),
        changePct: v(p.regularMarketChangePercent),
        marketCap: v(p.marketCap),

        // Bewertung
        peTrailing: v(s.trailingPE),
        peForward: v(s.forwardPE) ?? v(k.forwardPE),
        pegRatio: v(k.pegRatio),
        priceToBook: v(k.priceToBook),
        priceToSales: v(k.priceToSalesTrailing12Months),
        evEbitda: v(k.enterpriseToEbitda),
        evRevenue: v(k.enterpriseToRevenue),

        // Profitabilität
        grossMargin: v(f.grossMargins),
        operatingMargin: v(f.operatingMargins),
        profitMargin: v(f.profitMargins),
        roe: v(f.returnOnEquity),
        roa: v(f.returnOnAssets),

        // Wachstum
        revenueGrowth: v(f.revenueGrowth),
        earningsGrowth: v(f.earningsGrowth),
        epsTrailing: v(k.trailingEps),
        epsForward: v(k.forwardEps),

        // Bilanz
        debtToEquity: v(f.debtToEquity),
        currentRatio: v(f.currentRatio),
        totalCash: v(f.totalCash),
        totalDebt: v(f.totalDebt),
        freeCashflow: v(f.freeCashflow),

        // Short-Interest
        sharesShort: shortShares,
        shortRatio: v(k.shortRatio),
        shortPctFloat: v(k.shortPercentOfFloat),
        floatShares,
        sharesOutstanding: shares,

        // Dividende
        dividendYield: v(s.dividendYield),
        payoutRatio: v(s.payoutRatio),

        // Kurs / Analysten
        beta: v(s.beta) ?? v(k.beta),
        high52: v(s.fiftyTwoWeekHigh),
        low52: v(s.fiftyTwoWeekLow),
        targetMean: v(f.targetMeanPrice),
        recommendation: f.recommendationKey || null,
        analystCount: v(f.numberOfAnalystOpinions),
      };
    } catch { /* nächster Host */ }
  }
  return null;
};

export default async function handler(req, res) {
  const symbols = String(req.query.symbols || "")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 40);

  if (!symbols.length) return res.status(400).json({ error: "symbols required" });

  const data = {};
  const failed = [];
  for (let i = 0; i < symbols.length; i += 5) {
    await Promise.all(symbols.slice(i, i + 5).map(async sym => {
      const d = await fetchOne(sym);
      if (d) data[sym] = d; else failed.push(sym);
    }));
  }

  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ asOf: Date.now(), failed, data });
}
