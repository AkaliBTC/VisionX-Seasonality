import { useState, useEffect, useRef, useCallback } from "react";

// ── PROXIES ───────────────────────────────────────────────────────────────────
const PROXIES = [
  (u) => fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(d => JSON.parse(d.contents)),
  (u) => fetch(`https://corsproxy.io/?${encodeURIComponent(u)}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  (u) => fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  (u) => fetch(`https://yacdn.org/proxy/${u}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
];

const fetchYahooChart = async (ticker, range) => {
  // Do NOT encode the ticker — = must stay literal for futures (ES=F, GC=F etc.)
  const raw = ticker.toUpperCase().trim();
  const interval = range === "1d" ? "5m" : "1h";

  // ── Chart endpoint (primary — has OHLC + timestamps) ──────────────────────
  const chartUrls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${raw}?interval=${interval}&range=${range}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${raw}?interval=${interval}&range=${range}`,
  ];

  const extractChart = (data) => {
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close;
    const meta = result.meta;
    if (!timestamps || !closes) return null;
    const points = timestamps.map((t, i) => ({ t: t * 1000, v: closes[i] })).filter(p => p.v != null);
    if (points.length < 2) return null;
    return { points, meta, currency: meta?.currency || "" };
  };

  for (const url of chartUrls) {
    for (const px of PROXIES) {
      try {
        const data = await px(url);
        const r = extractChart(data);
        if (r) return r;
      } catch { continue; }
    }
  }

  // ── v6 quote fallback (no chart data, just current price — build flat line) ─
  const quoteUrls = [
    `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${raw}`,
    `https://query2.finance.yahoo.com/v6/finance/quote?symbols=${raw}`,
  ];
  for (const url of quoteUrls) {
    for (const px of PROXIES) {
      try {
        const data = await px(url);
        const item = data?.quoteResponse?.result?.[0];
        const price = item?.regularMarketPrice || item?.ask;
        if (price && price > 0) {
          const now = Date.now();
          const points = [{ t: now - 3600000, v: price }, { t: now, v: price }];
          return { points, currency: item?.currency || "" };
        }
      } catch { continue; }
    }
  }

  return null;
};

const fetchBinanceChart = async (ticker, range) => {
  const sym = ticker.toUpperCase().trim();
  const symbol = sym.endsWith("USDT") ? sym : sym + "USDT";
  const interval = range === "1d" ? "5m" : "1h";
  const limit = range === "1d" ? 288 : 168;
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const points = data.map(k => ({ t: k[0], v: parseFloat(k[4]) }));
    return { points, currency: "USDT" };
  } catch {}
  // Futures fallback
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const points = data.map(k => ({ t: k[0], v: parseFloat(k[4]) }));
    return { points, currency: "USDT" };
  } catch {}
  return null;
};

const isCrypto = (ticker) => {
  const t = ticker.toUpperCase();
  const cryptos = ["BTC","ETH","SOL","BNB","XRP","ADA","AVAX","DOT","LINK","MATIC","DOGE","SHIB","UNI","ATOM","HYPE","SUI","APT","INJ","TIA","SEI","WIF","BONK","PEPE","ARB","OP"];
  return cryptos.some(c => t === c || t === c + "USDT") || t.endsWith("USDT");
};

const fetchChart = async (ticker, range) => {
  // Crypto: Binance only
  if (isCrypto(ticker)) return fetchBinanceChart(ticker, range);
  // TradFi: race all proxies in parallel for speed, take first valid result
  return fetchYahooChart(ticker, range);
};

const fmtPrice = (p) => {
  if (p == null) return "—";
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(3);
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtTime = (ts, range) => {
  const d = new Date(ts);
  if (range === "1d") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

// ── LINE CHART ────────────────────────────────────────────────────────────────
function LineChart({ points, range, isPositive }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  if (!points || points.length < 2) return null;

  const W = 900, H = 320, PAD = { top: 20, right: 20, bottom: 40, left: 70 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const vals = points.map(p => p.v);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range_ = maxV - minV || 1;

  const xScale = (i) => PAD.left + (i / (points.length - 1)) * iW;
  const yScale = (v) => PAD.top + iH - ((v - minV) / range_) * iH;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.v)}`).join(" ");
  const areaD = pathD + ` L ${xScale(points.length - 1)} ${PAD.top + iH} L ${PAD.left} ${PAD.top + iH} Z`;

  const color = isPositive ? "#22c55e" : "#ef4444";
  const colorDim = isPositive ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";

  // Y axis labels
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const v = minV + (range_ / (yTicks - 1)) * i;
    const y = yScale(v);
    return { v, y };
  });

  // X axis labels — show ~6
  const xStep = Math.max(1, Math.floor(points.length / 6));
  const xLabels = points.filter((_, i) => i % xStep === 0 || i === points.length - 1);

  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const idx = Math.max(0, Math.min(points.length - 1, Math.round((x - PAD.left) / iW * (points.length - 1))));
    setHover({ idx, x: xScale(idx), y: yScale(points[idx].v), point: points[idx] });
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <line key={i} x1={PAD.left} x2={W - PAD.right} y1={l.y} y2={l.y}
            stroke="#1e1e1e" strokeWidth="1" />
        ))}

        {/* Y labels */}
        {yLabels.map((l, i) => (
          <text key={i} x={PAD.left - 10} y={l.y + 4}
            textAnchor="end" fill="#444" fontSize="11" fontFamily="'DM Mono', monospace">
            {fmtPrice(l.v)}
          </text>
        ))}

        {/* X labels */}
        {xLabels.map((p, i) => {
          const idx = points.indexOf(p);
          return (
            <text key={i} x={xScale(idx)} y={H - 8}
              textAnchor="middle" fill="#444" fontSize="10" fontFamily="'DM Mono', monospace">
              {fmtTime(p.t, range)}
            </text>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#areaGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover crosshair */}
        {hover && (
          <>
            <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={PAD.top + iH}
              stroke="#333" strokeWidth="1" strokeDasharray="4,3" />
            <circle cx={hover.x} cy={hover.y} r="4" fill={color} stroke="#0a0a0a" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div style={{
          position: "absolute", top: 8, left: 80,
          background: "#111", border: "1px solid #222",
          borderRadius: 8, padding: "8px 14px",
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: "#e8e8e8", pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
        }}>
          <div style={{ color: "#555", fontSize: 10, marginBottom: 2 }}>{fmtTime(hover.point.t, range)}</div>
          <div style={{ color, fontSize: 16, fontWeight: 600 }}>{fmtPrice(hover.point.v)}</div>
        </div>
      )}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
const VSXLogo = ({ size = 56 }) => (
  <img src="https://i.postimg.cc/pd4xzT1r/87011e66-b8e4-4d2b-9977-a06bb4b29902.png"
    width={size} height={size} alt="VisionX"
    style={{ objectFit: "contain", filter: "drop-shadow(0 0 12px rgba(212,175,55,0.5))" }} />
);

export default function App() {
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState("");
  const [range, setRange] = useState("1d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (t, r) => {
    if (!t) return;
    setLoading(true); setError(false); setData(null);
    const result = await fetchChart(t, r);
    if (result && result.points.length > 1) {
      setData(result);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  const submit = () => {
    const t = input.trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    load(t, range);
  };

  const switchRange = (r) => {
    setRange(r);
    if (ticker) load(ticker, r);
  };

  const pnlPct = data?.points?.length > 1
    ? ((data.points[data.points.length - 1].v - data.points[0].v) / data.points[0].v) * 100
    : null;
  const isPositive = pnlPct == null ? true : pnlPct >= 0;
  const lastPrice = data?.points?.[data.points.length - 1]?.v;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e8e8e8", fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Bebas+Neue&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; }

        .header {
          height: 80px; padding: 0 56px;
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(10,10,10,0.9);
          backdrop-filter: blur(24px);
          border-bottom: 1px solid #1a1a1a;
          position: sticky; top: 0; z-index: 100;
        }
        .logo-area { display: flex; align-items: center; gap: 14px; }
        .logo-divider { width: 1px; height: 32px; background: linear-gradient(180deg, transparent, rgba(212,175,55,0.4), transparent); }
        .logo-name { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 0.25em; background: linear-gradient(135deg,#fff,#e8e8e8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .logo-sub { font-size: 7px; letter-spacing: 0.4em; color: #b99c64; font-weight: 500; text-transform: uppercase; margin-top: 2px; }

        .search-bar {
          display: flex; align-items: center; gap: 10px;
          padding: 0 56px 0 56px; margin: 40px 0 32px;
        }
        .ticker-input {
          background: #111; border: 1px solid #222;
          color: #f8e49b; font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: 0.15em;
          padding: 12px 20px; border-radius: 8px; outline: none;
          width: 200px; transition: border-color 0.2s, background 0.2s;
          text-transform: uppercase;
        }
        .ticker-input:focus { border-color: #d4af37; background: rgba(212,175,55,0.04); }
        .ticker-input::placeholder { color: #333; }

        .btn-search {
          background: linear-gradient(135deg, #d4af37, #c59958);
          color: #0a0a0a; font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
          border: none; padding: 13px 28px; border-radius: 8px;
          cursor: pointer; transition: all 0.2s; text-transform: uppercase;
        }
        .btn-search:hover { background: linear-gradient(135deg, #f8e49b, #d4af37); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(212,175,55,0.3); }
        .btn-search:active { transform: translateY(0); }

        .range-btns { display: flex; gap: 6px; margin-left: 12px; }
        .range-btn {
          background: transparent; border: 1px solid #222;
          color: #555; font-family: 'Montserrat', sans-serif;
          font-size: 10px; font-weight: 700; letter-spacing: 0.15em;
          padding: 10px 18px; border-radius: 6px; cursor: pointer;
          transition: all 0.2s; text-transform: uppercase;
        }
        .range-btn:hover { border-color: #333; color: #888; }
        .range-btn.active { border-color: #d4af37; color: #f8e49b; background: rgba(212,175,55,0.08); }

        .chart-wrap {
          margin: 0 56px;
          background: #111; border: 1px solid #1a1a1a;
          border-radius: 16px; overflow: hidden;
          transition: border-color 0.3s;
        }
        .chart-wrap:hover { border-color: #222; }

        .chart-header {
          padding: 28px 36px 20px;
          border-bottom: 1px solid #1a1a1a;
          display: flex; align-items: flex-end; gap: 24px;
        }
        .chart-ticker {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 42px; letter-spacing: 0.08em; line-height: 1;
          color: #fdfdfd;
        }
        .chart-price {
          font-family: 'DM Mono', monospace;
          font-size: 28px; font-weight: 500; line-height: 1;
        }
        .chart-change {
          font-family: 'DM Mono', monospace;
          font-size: 14px; font-weight: 600;
          padding: 4px 10px; border-radius: 6px;
          margin-bottom: 4px;
        }
        .chart-body { padding: 24px 20px 8px; }

        .state-box {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 320px; gap: 12px;
          color: #333; font-size: 11px; letter-spacing: 0.2em;
          font-family: 'Montserrat', sans-serif; font-weight: 600;
          text-transform: uppercase;
        }
        .spinner {
          width: 32px; height: 32px; border: 2px solid #1a1a1a;
          border-top-color: #d4af37; border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .empty-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 400px; gap: 16px;
          margin: 0 56px;
        }
        .empty-label {
          font-family: 'Bebas Neue', sans-serif; font-size: 18px;
          letter-spacing: 0.25em; color: #222;
        }
        .empty-sub { font-size: 10px; color: #2a2a2a; letter-spacing: 0.15em; font-weight: 600; }
      `}</style>

      {/* HEADER */}
      <div className="header">
        <div className="logo-area">
          <VSXLogo size={52} />
          <div className="logo-divider" />
          <div>
            <div className="logo-name">VISIONX</div>
            <div className="logo-sub">Chart Viewer</div>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="search-bar">
        <input
          className="ticker-input"
          placeholder="TICKER"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && submit()}
        />
        <button className="btn-search" onClick={submit}>VIEW CHART</button>
        <div className="range-btns">
          {["1d", "1w"].map(r => (
            <button key={r} className={`range-btn ${range === r ? "active" : ""}`}
              onClick={() => switchRange(r)}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* CHART */}
      {!ticker ? (
        <div className="empty-state">
          <div className="empty-label">Enter a ticker to begin</div>
          <div className="empty-sub">Stocks · Crypto · Indices · Commodities · ETFs</div>
        </div>
      ) : (
        <div className="chart-wrap">
          <div className="chart-header">
            <div className="chart-ticker">{ticker}</div>
            {lastPrice && (
              <>
                <div className="chart-price" style={{ color: isPositive ? "#22c55e" : "#ef4444" }}>
                  {fmtPrice(lastPrice)}
                  {data?.currency ? <span style={{ fontSize: 14, color: "#444", marginLeft: 6 }}>{data.currency}</span> : null}
                </div>
                {pnlPct != null && (
                  <div className="chart-change" style={{
                    color: isPositive ? "#22c55e" : "#ef4444",
                    background: isPositive ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"
                  }}>
                    {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                    <span style={{ fontSize: 10, color: "#444", marginLeft: 6 }}>
                      {range === "1d" ? "TODAY" : "1W"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="chart-body">
            {loading ? (
              <div className="state-box"><div className="spinner" /><span>Loading {ticker}</span></div>
            ) : error ? (
              <div className="state-box">
                <span style={{ color: "#ef4444" }}>⚠</span>
                <span>Could not load {ticker}</span>
                <span style={{ color: "#2a2a2a", fontSize: 9 }}>Check ticker or try again</span>
              </div>
            ) : data ? (
              <LineChart points={data.points} range={range} isPositive={isPositive} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
