import { useState, useEffect, useMemo, useRef } from "react";
import { evaluate, lightFor, LIGHTS, CATEGORY_LIST, benchFor } from "./scoring";

// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · FUNDAMENTAL CHECK
//  Ticker eingeben → Bewertung, Margen, Wachstum, Bilanz, Short-Interest.
//  Quelle: Yahoo quoteSummary über /api/fundamentals (6h Edge-Cache).
// ═════════════════════════════════════════════════════════════════════════════

const GOLD = "#d4af37";
const STORAGE_KEY = "vsx_fundamentals_list_v1";

const DEFAULT_LIST = ["NVDA", "MSFT", "AAPL", "META", "AMZN", "GOOGL", "TSLA", "AMD"];

const loadList = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a; }
  } catch { /* default */ }
  return [...DEFAULT_LIST];
};

// ── FORMATIERUNG ─────────────────────────────────────────────────────────────
const fmtNum = (v, d = 2) => v == null || !isFinite(v) ? "—" : v.toFixed(d);
const fmtPct = (v, d = 1) => v == null || !isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`;
const fmtCap = (v) => {
  if (v == null || !isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return v.toFixed(0);
};

// ── METRIK-DEFINITIONEN ──────────────────────────────────────────────────────
// good: höher ist besser (true) / niedriger ist besser (false) / neutral (null)
const GROUPS = [
  {
    id: "valuation", label: "VALUATION",
    metrics: [
      { key: "peTrailing", label: "P/E", fmt: v => fmtNum(v, 1), good: false, lo: 10, hi: 40 },
      { key: "peForward", label: "Fwd P/E", fmt: v => fmtNum(v, 1), good: false, lo: 10, hi: 35 },
      { key: "pegRatio", label: "PEG", fmt: v => fmtNum(v, 2), good: false, lo: 0.8, hi: 3 },
      { key: "priceToSales", label: "P/S", fmt: v => fmtNum(v, 1), good: false, lo: 1, hi: 12 },
      { key: "priceToBook", label: "P/B", fmt: v => fmtNum(v, 1), good: false, lo: 1, hi: 10 },
      { key: "evEbitda", label: "EV/EBITDA", fmt: v => fmtNum(v, 1), good: false, lo: 8, hi: 30 },
    ],
  },
  {
    id: "profitability", label: "PROFITABILITY",
    metrics: [
      { key: "grossMargin", label: "Gross M.", fmt: fmtPct, good: true, lo: 0.2, hi: 0.7 },
      { key: "operatingMargin", label: "Op. M.", fmt: fmtPct, good: true, lo: 0.05, hi: 0.35 },
      { key: "profitMargin", label: "Net M.", fmt: fmtPct, good: true, lo: 0.03, hi: 0.3 },
      { key: "roe", label: "ROE", fmt: fmtPct, good: true, lo: 0.08, hi: 0.35 },
      { key: "roa", label: "ROA", fmt: fmtPct, good: true, lo: 0.03, hi: 0.2 },
    ],
  },
  {
    id: "growth", label: "GROWTH",
    metrics: [
      { key: "revenueGrowth", label: "Rev. Growth", fmt: fmtPct, good: true, lo: 0, hi: 0.35 },
      { key: "earningsGrowth", label: "EPS Growth", fmt: fmtPct, good: true, lo: 0, hi: 0.4 },
      { key: "epsTrailing", label: "EPS TTM", fmt: v => fmtNum(v, 2), good: null },
      { key: "epsForward", label: "EPS Fwd", fmt: v => fmtNum(v, 2), good: null },
    ],
  },
  {
    id: "balance", label: "BALANCE SHEET",
    metrics: [
      { key: "debtToEquity", label: "D/E", fmt: v => fmtNum(v, 1), good: false, lo: 30, hi: 150 },
      { key: "currentRatio", label: "Current R.", fmt: v => fmtNum(v, 2), good: true, lo: 1, hi: 2.5 },
      { key: "totalCash", label: "Cash", fmt: fmtCap, good: null },
      { key: "totalDebt", label: "Debt", fmt: fmtCap, good: null },
      { key: "freeCashflow", label: "FCF", fmt: fmtCap, good: true, lo: 0, hi: 1e10 },
    ],
  },
  {
    id: "short", label: "SHORT INTEREST",
    metrics: [
      { key: "shortPctFloat", label: "Short % Float", fmt: fmtPct, good: null, lo: 0.02, hi: 0.15, warn: 0.1 },
      { key: "shortRatio", label: "Short Ratio", fmt: v => fmtNum(v, 1), good: null, lo: 1, hi: 8, warn: 5 },
      { key: "sharesShort", label: "Shares Short", fmt: fmtCap, good: null },
      { key: "floatShares", label: "Float", fmt: fmtCap, good: null },
      { key: "beta", label: "Beta", fmt: v => fmtNum(v, 2), good: null },
    ],
  },
  {
    id: "market", label: "MARKET & ANALYSTS",
    metrics: [
      { key: "marketCap", label: "Mkt Cap", fmt: fmtCap, good: null },
      { key: "dividendYield", label: "Div. Yield", fmt: fmtPct, good: true, lo: 0, hi: 0.05 },
      { key: "payoutRatio", label: "Payout", fmt: fmtPct, good: null },
      { key: "targetMean", label: "Target", fmt: v => fmtNum(v, 2), good: null },
      { key: "upside", label: "Upside", fmt: fmtPct, good: true, lo: -0.1, hi: 0.4, derived: d => d.targetMean && d.price ? d.targetMean / d.price - 1 : null },
      { key: "from52High", label: "vs 52W High", fmt: fmtPct, good: null, derived: d => d.high52 && d.price ? d.price / d.high52 - 1 : null },
    ],
  },
];

const valueOf = (d, m) => m.derived ? m.derived(d) : d[m.key];

// Farbskala für eine Metrik
const colorFor = (m, v) => {
  if (v == null || !isFinite(v)) return "#555";
  if (m.warn != null && v >= m.warn) return "#f59e0b";
  if (m.good == null || m.lo == null) return "#c9c9c9";
  const t = Math.max(0, Math.min(1, (v - m.lo) / (m.hi - m.lo)));
  const score = m.good ? t : 1 - t;
  return score > 0.66 ? "#22c55e" : score > 0.33 ? "#c9c9c9" : "#ef4444";
};

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function Fundamentals() {
  const [list, setList] = useState(loadList);
  const [input, setInput] = useState("");
  const [data, setData] = useState({});
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [group, setGroup] = useState("rating");
  const [sort, setSort] = useState({ key: "score", dir: "desc" });
  const [detail, setDetail] = useState(null);
  const cacheRef = useRef({});

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* private */ }
  }, [list]);

  useEffect(() => {
    const missing = list.filter(s => !cacheRef.current[s]);
    if (!missing.length) { setData({ ...cacheRef.current }); return; }
    let alive = true;
    setLoading(true); setError("");
    fetch(`/api/fundamentals?symbols=${missing.join(",")}`)
      .then(r => { if (!r.ok) throw new Error(`API ${r.status} — läuft die Seite auf Vercel / \`vercel dev\`?`); return r.json(); })
      .then(json => {
        if (!alive) return;
        Object.assign(cacheRef.current, json.data || {});
        setData({ ...cacheRef.current });
        setFailed(f => [...new Set([...f, ...(json.failed || [])])]);
      })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [list]);

  const rows = useMemo(
    () => list.map(s => data[s]).filter(Boolean).map(d => {
      const ev = evaluate(d);
      return { ...d, score: ev.overall, ev };
    }),
    [list, data]
  );

  // Ampel-Verteilung fürs Resümee
  const summary = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0, grey: 0 };
    rows.forEach(r => { c[r.ev.light.id]++; });
    return c;
  }, [rows]);

  const activeGroup = GROUPS.find(g => g.id === group) || GROUPS[0];
  const ratingView = group === "rating";

  const sorted = useMemo(() => {
    const arr = [...rows];
    const get = (d) => {
      if (sort.key === "symbol") return d.symbol;
      if (sort.key === "score") return d.score;
      if (sort.key === "sector") return d.sector || "";
      if (sort.key.startsWith("cat:")) return d.ev.cats[sort.key.slice(4)];
      const m = activeGroup.metrics.find(x => x.key === sort.key);
      return m ? valueOf(d, m) : null;
    };
    arr.sort((a, b) => {
      const x = get(a), y = get(b);
      if (typeof x === "string") return x.localeCompare(y);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return x - y;
    });
    if (sort.dir === "desc") arr.reverse();
    return arr;
  }, [rows, sort, activeGroup]);

  const setSortKey = key => setSort(s => s.key === key
    ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
    : { key, dir: key === "symbol" ? "asc" : "desc" });

  const addTickers = () => {
    const parts = input.split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!parts.length) return;
    setList(l => [...new Set([...l, ...parts])]);
    setInput("");
  };
  const removeTicker = s => setList(l => l.filter(x => x !== s));

  const exportCsv = () => {
    const cols = ["symbol", "name", "sector", "industry", "light", "score",
      ...CATEGORY_LIST.map(c => "cat_" + c.id),
      ...GROUPS.flatMap(g => g.metrics.map(m => m.key))];
    const head = cols.join(",");
    const body = sorted.map(d => cols.map(c => {
      if (c === "score") return d.score ?? "";
      if (c === "light") return d.ev.light.label;
      if (c.startsWith("cat_")) return d.ev.cats[c.slice(4)] ?? "";
      const m = GROUPS.flatMap(g => g.metrics).find(x => x.key === c);
      const v = m ? valueOf(d, m) : d[c];
      return typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : (v ?? "");
    }).join(",")).join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vsx-fundamentals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const glass = {
    background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015) 55%, rgba(212,175,55,0.02))",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
    backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)",
    boxShadow: "0 14px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
  };
  const pill = (active) => ({
    padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
    background: active ? "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(212,175,55,0.07))" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.08)"}`,
    color: active ? "#f8e49b" : "#777", transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
    boxShadow: active ? "0 0 18px rgba(212,175,55,0.12)" : "none",
  });
  const th = (key, label, align = "right") => (
    <th onClick={() => setSortKey(key)}
      style={{ padding: "7px 10px", textAlign: align, cursor: "pointer", userSelect: "none",
        color: sort.key === key ? "#f8e49b" : "#555", whiteSpace: "nowrap", transition: "color 0.2s" }}>
      {label}{sort.key === key ? (sort.dir === "desc" ? " ▾" : " ▴") : ""}
    </th>
  );

  const scoreColor = s => s == null ? "#555" : s >= 65 ? "#22c55e" : s >= 40 ? "#facc15" : "#ef4444";

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "calc(100vh - 76px)" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -220, right: "-6%", width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,175,55,0.06), transparent 62%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: -320, left: "-10%", width: 880, height: 880, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,182,255,0.035), transparent 62%)", filter: "blur(60px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1840, margin: "0 auto", padding: "22px 30px 50px" }}>
        {/* KOPF */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: "0.18em", color: "#fdfdfd" }}>
            FUNDAMENTAL CHECK
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>
            {rows.length} SYMBOLS
          </div>
          {loading && <span style={{ fontSize: 10, color: GOLD, fontFamily: "'DM Mono', monospace", letterSpacing: "0.14em" }}>LOADING…</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={pill(false)} onClick={exportCsv}>↓ CSV</button>
          </div>
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#b99c64", letterSpacing: "0.04em", marginBottom: 16 }}>
          Valuation · Profitability · Growth · Balance Sheet · Short Interest — click a row for the full profile
        </div>

        {/* EINGABE */}
        <div style={{ ...glass, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 14 }}>
          <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && addTickers()}
            placeholder="NVDA, MSFT, BAS.DE …"
            style={{ flex: "1 1 260px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "#f8e49b", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.1em", padding: "9px 15px", borderRadius: 10, outline: "none", textTransform: "uppercase" }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(212,175,55,0.5)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"} />
          <button style={pill(true)} onClick={addTickers}>+ ADD</button>
          <button style={pill(false)} onClick={() => { setList([]); setFailed([]); }}>CLEAR ALL</button>
          <button style={pill(false)} onClick={() => setList([...DEFAULT_LIST])}>↺ DEFAULTS</button>
        </div>

        {error && (
          <div style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 14, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>{error}</div>
        )}
        {failed.length > 0 && (
          <div style={{ fontSize: 10, color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>
            Keine Daten: {failed.join(", ")}
          </div>
        )}

        {/* AMPEL-RESÜMEE */}
        {rows.length > 0 && (
          <div style={{ ...glass, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, padding: "14px 20px", marginBottom: 14 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.2em", color: "#fdfdfd" }}>RESÜMEE</span>
            {[LIGHTS.green, LIGHTS.yellow, LIGHTS.red, LIGHTS.grey].map(l => {
              const n = summary[l.id];
              return (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 9, opacity: n ? 1 : 0.3 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: l.color,
                    boxShadow: n ? `0 0 10px ${l.color}` : "none" }} />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: l.color, fontWeight: 700 }}>{n}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", color: "#777" }}>{l.label}</span>
                </div>
              );
            })}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 3, height: 10, flex: "1 1 220px", maxWidth: 320, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
              {[LIGHTS.green, LIGHTS.yellow, LIGHTS.red, LIGHTS.grey].map(l => summary[l.id] > 0 && (
                <div key={l.id} style={{ flex: summary[l.id], background: l.color, opacity: 0.75 }} />
              ))}
            </div>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#5a5a5a", letterSpacing: "0.1em" }}>
              SEKTOR-RELATIVE BEWERTUNG
            </span>
          </div>
        )}

        {/* GRUPPEN-TABS */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
          <button style={pill(group === "rating")} onClick={() => setGroup("rating")}>◆ RATING</button>
          <div style={{ width: 1, height: 22, background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.35), transparent)", margin: "0 3px" }} />
          {GROUPS.map(g => (
            <button key={g.id} style={pill(group === g.id)} onClick={() => setGroup(g.id)}>{g.label}</button>
          ))}
        </div>

        {/* TABELLE */}
        <div style={{ ...glass, padding: "16px 18px 14px", overflowX: "auto" }}>
          {rows.length === 0 && !loading ? (
            <div style={{ padding: 80, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.3em", color: "#262626" }}>
              TICKER EINGEBEN
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
              <thead>
                <tr style={{ fontSize: 8.5, letterSpacing: "0.14em", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, textTransform: "uppercase" }}>
                  {th("symbol", "Symbol", "left")}
                  <th style={{ padding: "7px 10px", textAlign: "left", color: "#555" }}>Name</th>
                  {ratingView && th("sector", "Sector / Industry", "left")}
                  {th("score", ratingView ? "Score" : "VSX")}
                  {ratingView
                    ? CATEGORY_LIST.map(c => th("cat:" + c.id, c.label))
                    : activeGroup.metrics.map(m => th(m.key, m.label))}
                  {ratingView && <th style={{ padding: "7px 10px", textAlign: "center", color: "#555" }}>Ampel</th>}
                  <th style={{ width: 26 }} />
                </tr>
              </thead>
              <tbody>
                {sorted.map(d => (
                  <tr key={d.symbol} onClick={() => setDetail(d)}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.06)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "9px 10px", color: "#f8e49b", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {d.symbol}
                      {d.changePct != null && (
                        <span style={{ marginLeft: 8, fontSize: 9, color: d.changePct >= 0 ? "#22c55e" : "#ef4444" }}>
                          {d.changePct >= 0 ? "+" : ""}{(d.changePct).toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "9px 10px", color: "#8f8f8f", fontFamily: "'Montserrat', sans-serif", fontSize: 10.5, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.name}
                    </td>
                    {ratingView && (
                      <td style={{ padding: "9px 10px", color: "#8f8f8f", fontFamily: "'Montserrat', sans-serif", fontSize: 9.5, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.sector || "—"}{d.industry ? <span style={{ color: "#4a4a4a" }}> · {d.industry}</span> : null}
                      </td>
                    )}
                    <td style={{ padding: "9px 10px", textAlign: "right" }}>
                      <span style={{ color: d.ev.light.color, fontWeight: 700 }}>{d.score ?? "—"}</span>
                    </td>
                    {ratingView
                      ? CATEGORY_LIST.map(c => {
                          const v = d.ev.cats[c.id];
                          const col = v == null ? "#555" : lightFor(v).color;
                          return (
                            <td key={c.id} style={{ padding: "9px 10px", textAlign: "right" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                                <span style={{ display: "inline-block", width: 34, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
                                  <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${v ?? 0}%`, background: col, opacity: 0.85 }} />
                                </span>
                                <span style={{ color: col, minWidth: 20, textAlign: "right" }}>{v ?? "—"}</span>
                              </span>
                            </td>
                          );
                        })
                      : activeGroup.metrics.map(m => {
                          const v = valueOf(d, m);
                          return (
                            <td key={m.key} style={{ padding: "9px 10px", textAlign: "right", color: colorFor(m, v), whiteSpace: "nowrap" }}>
                              {m.fmt(v)}
                            </td>
                          );
                        })}
                    {ratingView && (
                      <td style={{ padding: "9px 10px", textAlign: "center" }}>
                        <span title={d.ev.light.verdict} style={{ display: "inline-block", width: 13, height: 13, borderRadius: "50%", background: d.ev.light.color, boxShadow: `0 0 9px ${d.ev.light.color}88` }} />
                      </td>
                    )}
                    <td style={{ padding: "9px 4px", textAlign: "center" }}>
                      <button onClick={e => { e.stopPropagation(); removeTicker(d.symbol); }} title="Entfernen"
                        style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: 11, padding: 2 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = "#3a3a3a"}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* DETAIL-PANEL */}
        {detail && (
          <div style={{ ...glass, marginTop: 16, padding: "20px 24px 18px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.14em", color: "#fdfdfd" }}>{detail.symbol}</span>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#c9c9c9" }}>{detail.name}</span>
              {detail.score != null && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: scoreColor(detail.score) }}>VSX SCORE {detail.score}</span>
              )}
              <button onClick={() => setDetail(null)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9.5, color: "#666", letterSpacing: "0.1em", marginBottom: 16 }}>
              {[detail.sector, detail.industry, detail.currency, detail.recommendation?.toUpperCase()].filter(Boolean).join(" · ")}
              {detail.analystCount ? ` · ${detail.analystCount} ANALYSTS` : ""}
            </div>
            {/* AMPEL-URTEIL */}
            {(() => {
              const ev = evaluate(detail);
              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 14,
                    background: `${ev.light.color}0f`, border: `1px solid ${ev.light.color}44`, marginBottom: 14 }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: ev.light.color, boxShadow: `0 0 12px ${ev.light.color}` }} />
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: "0.16em", color: ev.light.color }}>{ev.light.label}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "#e8e8e8" }}>{ev.overall ?? "—"}<span style={{ color: "#555", fontSize: 10 }}>/100</span></span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10.5, color: "#9a9a9a" }}>{ev.light.verdict}</span>
                    <span style={{ marginLeft: "auto", fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#5a5a5a", letterSpacing: "0.12em" }}>
                      BENCHMARK: {ev.benchSource.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: ev.flags.length ? 14 : 0 }}>
                    {CATEGORY_LIST.map(c => {
                      const v = ev.cats[c.id];
                      const col = v == null ? "#555" : lightFor(v).color;
                      return (
                        <div key={c.id} style={{ flex: "1 1 150px", padding: "11px 14px", borderRadius: 12,
                          background: "rgba(255,255,255,0.025)", border: `1px solid ${col}33` }}>
                          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", color: "#777", marginBottom: 7 }}>{c.label}</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, color: col, fontWeight: 700 }}>{v ?? "—"}</span>
                            <span style={{ fontSize: 8, color: "#4a4a4a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em" }}>{v == null ? "" : lightFor(v).label}</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 8, overflow: "hidden" }}>
                            <div style={{ width: `${v ?? 0}%`, height: "100%", background: col, opacity: 0.8 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {ev.flags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {ev.flags.map((f, i) => {
                        const col = f.t === "warn" ? "#ef4444" : f.t === "good" ? "#22c55e" : "#facc15";
                        return (
                          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 9,
                            background: `${col}0f`, border: `1px solid ${col}33`, fontFamily: "'Montserrat', sans-serif", fontSize: 9.5, color: "#c9c9c9" }}>
                            <span style={{ color: col, fontWeight: 700 }}>{f.t === "warn" ? "!" : f.t === "good" ? "+" : "i"}</span>
                            {f.m}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
              {GROUPS.map(g => (
                <div key={g.id}>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.2em", color: "#b99c64", marginBottom: 8 }}>{g.label}</div>
                  {g.metrics.map(m => {
                    const v = valueOf(detail, m);
                    return (
                      <div key={m.key} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 10.5, fontFamily: "'DM Mono', monospace" }}>
                        <span style={{ color: "#777" }}>{m.label}</span>
                        <span style={{ color: colorFor(m, v) }}>{m.fmt(v)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 8.5, color: "#3a3a3a", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.06em", lineHeight: 1.9 }}>
          Data: Yahoo Finance quoteSummary, cached 6h · Scoring is sector-relative: every metric is measured against the median benchmark of its sector, so a P/E of 30 rates differently for a utility than for software. Category scores 0–100, overall verdict weighted (profitability 3 · valuation 2 · growth 2 · balance 2 · risk 1) and only computed when at least three categories have data. Green ≥62 · Yellow ≥42 · Red below. Fundamentals are reported with a lag and vary in coverage for non-US listings. Structural analysis — not investment advice.
        </div>
      </div>
    </div>
  );
}
