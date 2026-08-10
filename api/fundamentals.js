// ── VISIONX ANALYTICS · FUNDAMENTALS PROXY v2 ────────────────────────────────
// GET /api/fundamentals?symbols=NVDA,MSFT,BAS.DE
//
// WICHTIG: Yahoos quoteSummary verlangt seit 2023 Cookie + Crumb. Ohne die
// Kombination antwortet der Endpoint mit 401 "Invalid Cookie". Ablauf:
//   1. fc.yahoo.com aufrufen → Set-Cookie (A3-Session)
//   2. /v1/test/getcrumb mit diesem Cookie → Crumb-Token
//   3. quoteSummary mit Cookie-Header + &crumb=…
// Cookie/Crumb bleiben im Lambda-Speicher (~55 Min) und werden bei 401 erneuert.

let SESSION = { cookie: null, crumb: null, ts: 0 };
const SESSION_TTL = 55 * 60 * 1000;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getSession(force = false) {
  if (!force && SESSION.crumb && Date.now() - SESSION.ts < SESSION_TTL) return SESSION;
  try {
    const c = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
    });
    const raw = c.headers.get("set-cookie") || "";
    const cookie = raw.split(",").map(p => p.split(";")[0].trim())
      .filter(p => p.includes("=")).join("; ");
    if (!cookie) return SESSION;

    const r = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie, Accept: "*/*" },
    });
    const crumb = (await r.text()).trim();
    if (!crumb || crumb.length > 32 || crumb.includes("<")) return SESSION;

    SESSION = { cookie, crumb, ts: Date.now() };
  } catch { /* Session bleibt bestehen */ }
  return SESSION;
}

const MODULES = ["price", "summaryDetail", "defaultKeyStatistics", "financialData", "summaryProfile"].join(",");
const v = (o) => (o && typeof o === "object" && "raw" in o ? o.raw : o ?? null);

async function quoteSummary(symbol, retry = true) {
  const s = await getSession();
  if (!s.crumb) return null;
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`
    + `?modules=${MODULES}&crumb=${encodeURIComponent(s.crumb)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Cookie: s.cookie, Accept: "application/json" },
  });
  if ((res.status === 401 || res.status === 403) && retry) {
    await getSession(true);
    return quoteSummary(symbol, false);
  }
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.quoteSummary?.result?.[0] || null;
}

// Fallback: v7/quote liefert Basiswerte, falls quoteSummary streikt
async function quoteLite(symbol) {
  const s = await getSession();
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`
    + (s.crumb ? `&crumb=${encodeURIComponent(s.crumb)}` : "");
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...(s.cookie ? { Cookie: s.cookie } : {}), Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.quoteResponse?.result?.[0] || null;
}

const shape = (symbol, r, lite) => {
  const p = r?.price || {};
  const s = r?.summaryDetail || {};
  const k = r?.defaultKeyStatistics || {};
  const f = r?.financialData || {};
  const pr = r?.summaryProfile || {};
  const L = lite || {};

  return {
    symbol,
    name: p.longName || p.shortName || L.longName || L.shortName || symbol,
    sector: pr.sector || null,
    industry: pr.industry || null,
    currency: p.currency || L.currency || null,

    price: v(p.regularMarketPrice) ?? L.regularMarketPrice ?? null,
    changePct: v(p.regularMarketChangePercent) ?? L.regularMarketChangePercent ?? null,
    marketCap: v(p.marketCap) ?? L.marketCap ?? null,

    peTrailing: v(s.trailingPE) ?? L.trailingPE ?? null,
    peForward: v(s.forwardPE) ?? v(k.forwardPE) ?? L.forwardPE ?? null,
    pegRatio: v(k.pegRatio),
    priceToBook: v(k.priceToBook) ?? L.priceToBook ?? null,
    priceToSales: v(k.priceToSalesTrailing12Months),
    evEbitda: v(k.enterpriseToEbitda),
    evRevenue: v(k.enterpriseToRevenue),

    grossMargin: v(f.grossMargins),
    operatingMargin: v(f.operatingMargins),
    profitMargin: v(f.profitMargins),
    roe: v(f.returnOnEquity),
    roa: v(f.returnOnAssets),

    revenueGrowth: v(f.revenueGrowth),
    earningsGrowth: v(f.earningsGrowth),
    epsTrailing: v(k.trailingEps) ?? L.epsTrailingTwelveMonths ?? null,
    epsForward: v(k.forwardEps) ?? L.epsForward ?? null,

    debtToEquity: v(f.debtToEquity),
    currentRatio: v(f.currentRatio),
    totalCash: v(f.totalCash),
    totalDebt: v(f.totalDebt),
    freeCashflow: v(f.freeCashflow),

    sharesShort: v(k.sharesShort),
    shortRatio: v(k.shortRatio),
    shortPctFloat: v(k.shortPercentOfFloat),
    floatShares: v(k.floatShares),
    sharesOutstanding: v(k.sharesOutstanding) ?? L.sharesOutstanding ?? null,

    dividendYield: v(s.dividendYield) ?? L.trailingAnnualDividendYield ?? null,
    payoutRatio: v(s.payoutRatio),

    beta: v(s.beta) ?? v(k.beta),
    high52: v(s.fiftyTwoWeekHigh) ?? L.fiftyTwoWeekHigh ?? null,
    low52: v(s.fiftyTwoWeekLow) ?? L.fiftyTwoWeekLow ?? null,
    targetMean: v(f.targetMeanPrice),
    recommendation: f.recommendationKey || null,
    analystCount: v(f.numberOfAnalystOpinions),

    partial: !r,
  };
};

const fetchOne = async (symbol) => {
  try {
    const full = await quoteSummary(symbol);
    if (full) return shape(symbol, full, null);
    const lite = await quoteLite(symbol);
    if (lite) return shape(symbol, null, lite);
  } catch { /* durchfallen */ }
  return null;
};

export default async function handler(req, res) {
  const symbols = String(req.query.symbols || "")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 40);

  if (!symbols.length) return res.status(400).json({ error: "symbols required" });

  await getSession();

  const data = {};
  const failed = [];
  for (let i = 0; i < symbols.length; i += 4) {
    await Promise.all(symbols.slice(i, i + 4).map(async sym => {
      const d = await fetchOne(sym);
      if (d) data[sym] = d; else failed.push(sym);
    }));
  }

  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ asOf: Date.now(), authed: Boolean(SESSION.crumb), failed, data });
}
