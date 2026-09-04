import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { apiFetch } from "./access";
import { C, F, panel, overline, displayTitle, btnGhost, btnPrimary, badge, tableHead, GLOBAL_CSS, Ambient } from "./ui";
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
    id: "valuation", label: "VALUATION", labelDe: "BEWERTUNG",
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
    id: "profitability", label: "PROFITABILITY", labelDe: "PROFITABILITÄT",
    metrics: [
      { key: "grossMargin", label: "Gross M.", fmt: fmtPct, good: true, lo: 0.2, hi: 0.7 },
      { key: "operatingMargin", label: "Op. M.", fmt: fmtPct, good: true, lo: 0.05, hi: 0.35 },
      { key: "profitMargin", label: "Net M.", fmt: fmtPct, good: true, lo: 0.03, hi: 0.3 },
      { key: "roe", label: "ROE", fmt: fmtPct, good: true, lo: 0.08, hi: 0.35 },
      { key: "roa", label: "ROA", fmt: fmtPct, good: true, lo: 0.03, hi: 0.2 },
    ],
  },
  {
    id: "growth", label: "GROWTH", labelDe: "WACHSTUM",
    metrics: [
      { key: "revenueGrowth", label: "Rev. Growth", fmt: fmtPct, good: true, lo: 0, hi: 0.35 },
      { key: "earningsGrowth", label: "EPS Growth", fmt: fmtPct, good: true, lo: 0, hi: 0.4 },
      { key: "epsTrailing", label: "EPS TTM", fmt: v => fmtNum(v, 2), good: null },
      { key: "epsForward", label: "EPS Fwd", fmt: v => fmtNum(v, 2), good: null },
    ],
  },
  {
    id: "balance", label: "BALANCE SHEET", labelDe: "BILANZ",
    metrics: [
      { key: "debtToEquity", label: "D/E", fmt: v => fmtNum(v, 1), good: false, lo: 30, hi: 150 },
      { key: "currentRatio", label: "Current R.", fmt: v => fmtNum(v, 2), good: true, lo: 1, hi: 2.5 },
      { key: "totalCash", label: "Cash", fmt: fmtCap, good: null },
      { key: "totalDebt", label: "Debt", fmt: fmtCap, good: null },
      { key: "freeCashflow", label: "FCF", fmt: fmtCap, good: true, lo: 0, hi: 1e10 },
    ],
  },
  {
    id: "short", label: "SHORT INTEREST", labelDe: "LEERVERKÄUFE",
    metrics: [
      { key: "shortPctFloat", label: "Short % Float", fmt: fmtPct, good: null, lo: 0.02, hi: 0.15, warn: 0.1 },
      { key: "shortRatio", label: "Short Ratio", fmt: v => fmtNum(v, 1), good: null, lo: 1, hi: 8, warn: 5 },
      { key: "sharesShort", label: "Shares Short", fmt: fmtCap, good: null },
      { key: "floatShares", label: "Float", fmt: fmtCap, good: null },
      { key: "beta", label: "Beta", fmt: v => fmtNum(v, 2), good: null },
    ],
  },
  {
    id: "market", label: "MARKET & ANALYSTS", labelDe: "MARKT & ANALYSTEN",
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

const DE = {
  sub: "Bewertung · Profitabilität · Wachstum · Bilanz · Short Interest · Zeile anklicken für das volle Profil",
  resume: "RESÜMEE", sectorRel: "SEKTOR-RELATIVE BEWERTUNG", notFound: "NICHT GEFUNDEN",
  hint: "Yahoo-Schreibweise prüfen (z.B. BAS.DE, 0700.HK, BRK-B)",
  researching: "RECHERCHIERE", symbols: "SYMBOLE", benchmark: "BENCHMARK",
  explain: "Kennzahl anklicken für die Erklärung", light: "Ampel", name: "Name",
  sectorInd: "Sektor / Branche", score: "Score", csv: "↓ CSV", clearAll: "Leeren", defaults: "↺ Standard",
};
const EN = {
  sub: "Valuation · Profitability · Growth · Balance Sheet · Short Interest · click a row for the full profile",
  resume: "SUMMARY", sectorRel: "SECTOR-RELATIVE RATING", notFound: "NOT FOUND",
  hint: "Check Yahoo notation (e.g. BAS.DE, 0700.HK, BRK-B)",
  researching: "RESEARCHING", symbols: "SYMBOLS", benchmark: "BENCHMARK",
  explain: "Click a metric for the explanation", light: "Signal", name: "Name",
  sectorInd: "Sector / Industry", score: "Score", csv: "↓ CSV", clearAll: "Clear", defaults: "↺ Defaults",
};

// ── KENNZAHL-ERKLÄRUNGEN (DE / EN) ───────────────────────────────────────────
const GLOSSARY = {
  peTrailing:      { de: ["Kurs-Gewinn-Verhältnis (letzte 12 Monate)", "Wie viele Jahresgewinne im Kurs stecken. Niedrig wirkt günstig, kann aber auch bedeuten, dass der Markt fallende Gewinne erwartet."], en: ["Price/Earnings (trailing 12 months)", "How many annual profits are priced in. Low looks cheap but can also mean the market expects earnings to fall."] },
  peForward:       { de: ["Erwartetes KGV (nächste 12 Monate)", "Basiert auf Analystenschätzungen. Liegt es klar unter dem aktuellen KGV, wird Gewinnwachstum erwartet."], en: ["Forward P/E (next 12 months)", "Based on analyst estimates. Clearly below the trailing P/E means earnings growth is expected."] },
  pegRatio:        { de: ["KGV im Verhältnis zum Wachstum", "Setzt die Bewertung ins Verhältnis zum Gewinnwachstum. Unter 1 gilt klassisch als günstig bewachsen."], en: ["P/E relative to growth", "Puts valuation in relation to earnings growth. Below 1 is classically considered cheap for the growth."] },
  priceToSales:    { de: ["Kurs-Umsatz-Verhältnis", "Marktkapitalisierung geteilt durch Jahresumsatz. Nützlich bei Firmen ohne Gewinn."], en: ["Price/Sales", "Market cap divided by annual revenue. Useful for companies without profits."] },
  priceToBook:     { de: ["Kurs-Buchwert-Verhältnis", "Kurs im Verhältnis zum bilanziellen Eigenkapital. Bei Banken und Industrie aussagekräftig, bei Software kaum."], en: ["Price/Book", "Price relative to book equity. Meaningful for banks and industrials, barely for software."] },
  evEbitda:        { de: ["Unternehmenswert zu EBITDA", "Kaufpreis inklusive Schulden im Verhältnis zum operativen Ergebnis. Vergleichbarer als das KGV, weil kapitalstrukturneutral."], en: ["Enterprise Value/EBITDA", "Purchase price including debt relative to operating earnings. More comparable than P/E because it ignores capital structure."] },
  grossMargin:     { de: ["Bruttomarge", "Was vom Umsatz nach direkten Herstellkosten bleibt. Zeigt die Preissetzungsmacht."], en: ["Gross margin", "What remains of revenue after direct costs. Shows pricing power."] },
  operatingMargin: { de: ["Operative Marge", "Ergebnis aus dem Kerngeschäft vor Zinsen und Steuern, in Prozent vom Umsatz."], en: ["Operating margin", "Core-business result before interest and tax, as a share of revenue."] },
  profitMargin:    { de: ["Nettomarge", "Was am Ende als Gewinn übrig bleibt. Der wichtigste Effizienz-Indikator."], en: ["Net margin", "What is left as profit at the end. The key efficiency indicator."] },
  roe:             { de: ["Eigenkapitalrendite", "Gewinn im Verhältnis zum Eigenkapital. Hohe Werte können auch aus hoher Verschuldung stammen — immer mit D/E zusammen lesen."], en: ["Return on equity", "Profit relative to equity. High values can also come from high leverage — always read together with D/E."] },
  roa:             { de: ["Gesamtkapitalrendite", "Gewinn im Verhältnis zur Bilanzsumme. Weniger von Verschuldung verzerrt als ROE."], en: ["Return on assets", "Profit relative to total assets. Less distorted by leverage than ROE."] },
  revenueGrowth:   { de: ["Umsatzwachstum", "Veränderung des Umsatzes gegenüber dem Vorjahresquartal."], en: ["Revenue growth", "Change in revenue versus the same quarter last year."] },
  earningsGrowth:  { de: ["Gewinnwachstum", "Veränderung des Gewinns gegenüber dem Vorjahresquartal. Volatiler als Umsatzwachstum."], en: ["Earnings growth", "Change in earnings versus the same quarter last year. More volatile than revenue growth."] },
  epsTrailing:     { de: ["Gewinn je Aktie (12 Monate)", "Nettogewinn geteilt durch die Aktienanzahl."], en: ["Earnings per share (trailing)", "Net profit divided by share count."] },
  epsForward:      { de: ["Erwarteter Gewinn je Aktie", "Analystenschätzung für die nächsten 12 Monate."], en: ["Forward earnings per share", "Analyst estimate for the next 12 months."] },
  debtToEquity:    { de: ["Verschuldungsgrad", "Fremdkapital im Verhältnis zum Eigenkapital. Über 150 wird es in den meisten Branchen sportlich, Versorger liegen strukturell höher."], en: ["Debt/Equity", "Debt relative to equity. Above 150 gets sporty in most industries; utilities sit structurally higher."] },
  currentRatio:    { de: ["Liquidität 3. Grades", "Kurzfristige Vermögenswerte geteilt durch kurzfristige Verbindlichkeiten. Unter 1 heißt: laufende Rechnungen sind nicht durch liquide Mittel gedeckt."], en: ["Current ratio", "Current assets divided by current liabilities. Below 1 means short-term bills are not covered by liquid assets."] },
  totalCash:       { de: ["Liquide Mittel", "Cash und kurzfristige Anlagen in der Bilanz."], en: ["Total cash", "Cash and short-term investments on the balance sheet."] },
  totalDebt:       { de: ["Gesamtverschuldung", "Summe der zinstragenden Verbindlichkeiten."], en: ["Total debt", "Sum of interest-bearing liabilities."] },
  freeCashflow:    { de: ["Freier Cashflow", "Operativer Cashflow minus Investitionen. Das Geld, das wirklich für Dividenden, Rückkäufe und Schuldentilgung übrig ist."], en: ["Free cash flow", "Operating cash flow minus capex. The money actually available for dividends, buybacks and debt repayment."] },
  shortPctFloat:   { de: ["Leerverkaufsquote (Float)", "Anteil der frei handelbaren Aktien, der leerverkauft ist. Über 10 % gilt als erhöht, über 20 % als Squeeze-Kandidat — aber auch als Warnsignal."], en: ["Short interest (% of float)", "Share of freely tradable stock sold short. Above 10% is elevated, above 20% a squeeze candidate — but also a warning sign."] },
  shortRatio:      { de: ["Days to Cover", "Wie viele Handelstage die Shorts bräuchten, um sich beim aktuellen Volumen einzudecken."], en: ["Days to cover", "How many trading days shorts would need to close out at current volume."] },
  sharesShort:     { de: ["Leerverkaufte Aktien", "Absolute Anzahl der leerverkauften Aktien."], en: ["Shares short", "Absolute number of shares sold short."] },
  floatShares:     { de: ["Streubesitz", "Frei handelbare Aktien ohne fest gebundene Pakete. Kleiner Float bedeutet größere Kursausschläge."], en: ["Float", "Freely tradable shares excluding locked-up blocks. A small float means larger price swings."] },
  beta:            { de: ["Beta", "Schwankung relativ zum Gesamtmarkt. 1 = wie der Markt, über 1 = stärker, unter 1 = defensiver."], en: ["Beta", "Volatility relative to the broad market. 1 = like the market, above 1 = stronger, below 1 = more defensive."] },
  marketCap:       { de: ["Marktkapitalisierung", "Aktienkurs mal Aktienanzahl — der Börsenwert des Unternehmens."], en: ["Market cap", "Share price times share count — the company's market value."] },
  dividendYield:   { de: ["Dividendenrendite", "Jahresdividende im Verhältnis zum Kurs."], en: ["Dividend yield", "Annual dividend relative to the share price."] },
  payoutRatio:     { de: ["Ausschüttungsquote", "Anteil des Gewinns, der als Dividende ausgeschüttet wird. Über 100 % heißt: aus der Substanz gezahlt."], en: ["Payout ratio", "Share of profit paid out as dividend. Above 100% means it is paid from substance."] },
  targetMean:      { de: ["Mittleres Kursziel", "Durchschnitt der Analystenziele. Historisch systematisch zu optimistisch."], en: ["Mean price target", "Average of analyst targets. Historically systematically too optimistic."] },
  upside:          { de: ["Potenzial zum Kursziel", "Abstand des aktuellen Kurses zum mittleren Analystenziel."], en: ["Upside to target", "Distance from the current price to the mean analyst target."] },
  from52High:      { de: ["Abstand zum 52-Wochen-Hoch", "Wie weit der Kurs unter dem Jahreshoch steht — der Drawdown."], en: ["Distance to 52-week high", "How far the price sits below the yearly high — the drawdown."] },
};

// ── HAUPT-MODUL ──────────────────────────────────────────────────────────────
export default function Fundamentals({ lang = "de" }) {
  const L = lang === "en" ? EN : DE;
  const catLabel = c => (lang === "de" && c.labelDe) ? c.labelDe : c.label;
  const [list, setList] = useState(loadList);
  const [input, setInput] = useState("");
  const [data, setData] = useState({});
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");
  const [group, setGroup] = useState("rating");
  const [sort, setSort] = useState({ key: "score", dir: "desc" });
  const [detail, setDetail] = useState(null);
  const [explain, setExplain] = useState(null);
  const cacheRef = useRef({});

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* private */ }
  }, [list]);

  useEffect(() => {
    const missing = list.filter(s => !cacheRef.current[s]);
    if (!missing.length) { setData({ ...cacheRef.current }); return; }
    let alive = true;
    setLoading(true); setError("");
    apiFetch(`/api/fundamentals?symbols=${missing.join(",")}`)
      .then(r => { if (!r.ok) throw new Error(`API ${r.status} — läuft die Seite auf Vercel / \`vercel dev\`?`); return r.json(); })
      .then(json => {
        if (!alive) return;
        Object.assign(cacheRef.current, json.data || {});
        setData({ ...cacheRef.current });
        const bad = json.failed || [];
        if (bad.length) setFailed(f => [...new Set([...f, ...bad])]);
        // Symbole ohne Treffer wieder aus der Liste nehmen, damit nichts leer hängt
        if (bad.length) setList(l => l.filter(s => !bad.includes(s)));
      })
      .catch(e => alive && setError(e.message))
      .finally(() => { if (alive) { setLoading(false); setPending([]); } });
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
    const parts = input.split(/[\s,;]+/)
      .map(s => s.trim().toUpperCase().replace(/[^A-Z0-9.\-^]/g, ""))
      .filter(Boolean);
    if (!parts.length) return;
    const fresh = parts.filter(p => !list.includes(p));
    if (fresh.length) {
      setFailed(f => f.filter(x => !fresh.includes(x)));   // Retry erlauben
      setPending(p => [...new Set([...p, ...fresh])]);
      setList(l => [...new Set([...l, ...fresh])]);
    }
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

  const glass = panel();
  const pill = (active) => btnGhost(active);
  const th = (key, label, align = "right") => (
    <th onClick={() => setSortKey(key)}
      style={{ padding: "7px 10px", textAlign: align, cursor: "pointer", userSelect: "none",
        color: sort.key === key ? "#f8e49b" : "#555", whiteSpace: "nowrap", transition: "color 0.2s" }}>
      {label}{sort.key === key ? (sort.dir === "desc" ? " ▾" : " ▴") : ""}
    </th>
  );

  const scoreColor = s => s == null ? "#555" : s >= 65 ? "#22c55e" : s >= 40 ? "#facc15" : "#ef4444";

  // Ausklapp-Inhalt einer Zeile — bricht die Tabelle an der geklickten
  // Stelle auf, statt die Ansicht in ein Overlay zu verlagern.
  const renderDetail = (detail) => (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: "0.14em", color: "#fdfdfd" }}>{detail.symbol}</span>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#c9c9c9" }}>{detail.name}</span>
        {detail.score != null && (
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: scoreColor(detail.score),
            border: `1px solid ${scoreColor(detail.score)}44`, borderRadius: 7, padding: "3px 9px", letterSpacing: "0.1em" }}>
            VSX SCORE {detail.score}
          </span>
        )}
        <button className="vsx-btn" onClick={e => { e.stopPropagation(); setDetail(null); }}
          style={{ ...pill(false), marginLeft: "auto", padding: "5px 12px", fontSize: 8.5 }}>✕</button>
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
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10.5, color: "#9a9a9a" }}>{lang === "en" && ev.light.verdictEn ? ev.light.verdictEn : ev.light.verdict}</span>
                    <span style={{ marginLeft: "auto", fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, color: "#5a5a5a", letterSpacing: "0.12em" }}>
                      {L.benchmark}: {ev.benchSource.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: ev.flags.length ? 14 : 0 }}>
                    {CATEGORY_LIST.map(c => {
                      const v = ev.cats[c.id];
                      const col = v == null ? "#555" : lightFor(v).color;
                      return (
                        <div key={c.id} style={{ flex: "1 1 150px", padding: "11px 14px", borderRadius: 12,
                          background: "rgba(255,255,255,0.025)", border: `1px solid ${col}33` }}>
                          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", color: "#777", marginBottom: 7 }}>{catLabel(c)}</div>
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
                            {lang === "en" && f.mEn ? f.mEn : f.m}
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
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.2em", color: "#b99c64", marginBottom: 8 }}>{catLabel(g)}</div>
                  {g.metrics.map(m => {
                    const v = valueOf(detail, m);
                    return (
                      <div key={m.key} onClick={() => GLOSSARY[m.key] && setExplain(m.key)}
                        title={GLOSSARY[m.key] ? GLOSSARY[m.key][lang][0] : ""}
                        style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 10.5, fontFamily: "'DM Mono', monospace", cursor: GLOSSARY[m.key] ? "pointer" : "default", borderRadius: 5, transition: "background 0.15s" }}
                        onMouseEnter={e => { if (GLOSSARY[m.key]) e.currentTarget.style.background = "rgba(212,175,55,0.06)"; }}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span style={{ color: "#777" }}>
                          {m.label}{GLOSSARY[m.key] && <span style={{ color: "#3a3a3a", marginLeft: 5, fontSize: 8 }}>ⓘ</span>}
                        </span>
                        <span style={{ color: colorFor(m, v) }}>{m.fmt(v)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
    </>
  );

  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "calc(100vh - 76px)" }}>
      <Ambient tint="rgba(99,182,255,0.03)" />

      <style>{`
        @keyframes vsxpulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        .vsx-fund-table tbody tr { transition: background 0.15s, box-shadow 0.15s; }
        .vsx-fund-table tbody tr:hover { background: rgba(212,175,55,0.06) !important; }
        .vsx-fund-scroll::-webkit-scrollbar { height: 7px; }
        .vsx-fund-scroll::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.25); border-radius: 4px; }
        .vsx-fund-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1880, margin: "0 auto", padding: "26px 34px 60px" }}>
        {/* KOPF */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
          <div><div style={{ ...overline(C.goldDim), marginBottom: 7 }}>VisionX Analytics</div>
          <div style={{ ...displayTitle(31) }}>
            FUNDAMENTAL CHECK
          </div></div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>
            {rows.length} {L.symbols}
          </div>
          {loading && <span style={{ fontSize: 10, color: GOLD, fontFamily: "'DM Mono', monospace", letterSpacing: "0.14em" }}>LOADING…</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="vsx-btn" style={pill(false)} onClick={exportCsv}>{L.csv}</button>
          </div>
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#b99c64", letterSpacing: "0.04em", marginBottom: 16 }}>
          {L.sub}
          <span style={{ marginLeft: 10, color: "#4a4a4a", fontSize: 9.5 }}>ⓘ {L.explain}</span>
        </div>

        {/* EINGABE */}
        <div className="vsx-lift" style={{ ...glass, padding: "14px 18px 12px", marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", flex: "1 1 300px" }}>
              <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTickers(); } }}
                placeholder="NVDA  MSFT  BAS.DE …"
                style={{ width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.09)",
                  color: "#f8e49b", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
                  letterSpacing: "0.12em", padding: "11px 46px 11px 16px", borderRadius: 12,
                  outline: "none", textTransform: "uppercase", transition: "all 0.25s" }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,175,55,0.55)"; e.currentTarget.style.background = "rgba(212,175,55,0.05)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }} />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                fontFamily: "'Montserrat', sans-serif", fontSize: 7.5, fontWeight: 700, letterSpacing: "0.16em",
                color: "#4a4a4a", pointerEvents: "none" }}>↵ ENTER</span>
            </div>
            <button className="vsx-btn" style={pill(true)} onClick={addTickers}>+ ADD</button>
            <div style={{ width: 1, height: 22, background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.35), transparent)" }} />
            <button className="vsx-btn" style={pill(false)} onClick={() => setList([...DEFAULT_LIST])}>{L.defaults}</button>
            <button className="vsx-btn" style={pill(false)} onClick={() => { setList([]); setFailed([]); setDetail(null); }}>{L.clearAll}</button>
            {loading && (
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
                fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: GOLD, letterSpacing: "0.14em" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD,
                  boxShadow: `0 0 8px ${GOLD}`, animation: "vsxpulse 1s ease-in-out infinite" }} />
                {L.researching}{pending.length ? ` ${pending.join(" · ")}` : "…"}
              </span>
            )}
          </div>

          {/* Aktive Ticker als Chips */}
          {list.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12,
              paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {list.map(s => {
                const d = data[s];
                const col = d ? evaluate(d).light.color : "#4a4a4a";
                return (
                  <span key={s} onClick={() => d && setDetail(d)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 8px 5px 11px",
                      borderRadius: 9, cursor: d ? "pointer" : "default",
                      background: "rgba(255,255,255,0.03)", border: `1px solid ${col}44`,
                      fontFamily: "'DM Mono', monospace", fontSize: 10, color: d ? "#e8e8e8" : "#5a5a5a",
                      letterSpacing: "0.05em", transition: "all 0.2s" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: col,
                      boxShadow: d ? `0 0 6px ${col}` : "none" }} />
                    {s}
                    <button onClick={e => { e.stopPropagation(); removeTicker(s); }}
                      style={{ background: "none", border: "none", color: "#4a4a4a", cursor: "pointer", fontSize: 9, padding: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                      onMouseLeave={e => e.currentTarget.style.color = "#4a4a4a"}>✕</button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="vsx-lift" style={{ ...glass, borderColor: "rgba(239,68,68,0.35)", padding: "14px 18px", marginBottom: 14, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#f87171" }}>{error}</div>
        )}
        {failed.length > 0 && (
          <div className="vsx-lift" style={{ ...glass, borderColor: "rgba(250,204,21,0.25)", padding: "10px 16px", marginBottom: 12,
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700,
              letterSpacing: "0.18em", color: "#facc15" }}>{L.notFound}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#8f8f8f" }}>
              {failed.join(" · ")}
            </span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#5a5a5a" }}>
              {L.hint}
            </span>
            <button onClick={() => setFailed([])}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "#4a4a4a", cursor: "pointer", fontSize: 12 }}>✕</button>
          </div>
        )}

        {/* AMPEL-RESÜMEE */}
        {rows.length > 0 && (
          <div className="vsx-lift" style={{ ...glass, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, padding: "14px 20px", marginBottom: 14 }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.2em", color: "#fdfdfd" }}>{L.resume}</span>
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
              {L.sectorRel}
            </span>
          </div>
        )}

        {/* GRUPPEN-TABS */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
          <button className="vsx-btn" style={pill(group === "rating")} onClick={() => setGroup("rating")}>◆ RATING</button>
          <div style={{ width: 1, height: 22, background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.35), transparent)", margin: "0 3px" }} />
          {GROUPS.map(g => (
            <button key={g.id} style={pill(group === g.id)} onClick={() => setGroup(g.id)}>{catLabel(g)}</button>
          ))}
        </div>

        {/* TABELLE */}
        <div className="vsx-scroll" style={{ ...glass, padding: "0 0 6px", overflowX: "auto",
          maxHeight: "min(72vh, 900px)", overflowY: "auto" }}>
          {rows.length === 0 && !loading ? (
            <div style={{ padding: 80, textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.3em", color: "#262626" }}>
              TICKER EINGEBEN
            </div>
          ) : (
            <table className="vsx-fund-table vsx-table" style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
              <thead>
                <tr style={{ ...tableHead }}>
                  {th("symbol", "Symbol", "left")}
                  <th style={{ padding: "7px 10px", textAlign: "left", color: "#555" }}>{L.name}</th>
                  {ratingView && th("sector", "Sector / Industry", "left")}
                  {th("score", ratingView ? L.score : "VSX")}
                  {ratingView
                    ? CATEGORY_LIST.map(c => th("cat:" + c.id, c.label))
                    : activeGroup.metrics.map(m => (
                        <th key={m.key}
                          onClick={() => GLOSSARY[m.key] ? setExplain(m.key) : setSortKey(m.key)}
                          title={GLOSSARY[m.key] ? GLOSSARY[m.key][lang][0] : ""}
                          style={{ padding: "7px 10px", textAlign: "right", cursor: "pointer", userSelect: "none",
                            color: sort.key === m.key ? "#f8e49b" : "#555", whiteSpace: "nowrap", transition: "color 0.2s" }}>
                          {m.label}
                          {GLOSSARY[m.key] && <span style={{ color: "#4a4a4a", marginLeft: 4, fontSize: 8 }}>ⓘ</span>}
                          <span onClick={e => { e.stopPropagation(); setSortKey(m.key); }}
                            style={{ marginLeft: 4, color: sort.key === m.key ? "#f8e49b" : "#3a3a3a" }}>
                            {sort.key === m.key ? (sort.dir === "desc" ? "▾" : "▴") : "⇅"}
                          </span>
                        </th>
                      ))}
                  {ratingView && <th style={{ padding: "7px 10px", textAlign: "center", color: "#555" }}>{L.light}</th>}
                  <th style={{ width: 26 }} />
                </tr>
              </thead>
              <tbody>
                {sorted.map(d => (
                  <Fragment key={d.symbol}>
                  <tr onClick={() => setDetail(cur => cur?.symbol === d.symbol ? null : d)}
                    className={detail?.symbol === d.symbol ? "vsx-row-open" : ""}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", transition: "background 0.15s" }}
>
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
                        <span title={lang === "en" && d.ev.light.verdictEn ? d.ev.light.verdictEn : d.ev.light.verdict} style={{ display: "inline-block", width: 13, height: 13, borderRadius: "50%", background: d.ev.light.color, boxShadow: `0 0 9px ${d.ev.light.color}88` }} />
                      </td>
                    )}
                    <td style={{ padding: "9px 4px", textAlign: "center" }}>
                      <button onClick={e => { e.stopPropagation(); removeTicker(d.symbol); }} title="Entfernen"
                        style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: 11, padding: 2 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = "#3a3a3a"}>✕</button>
                    </td>
                  </tr>
                  {detail?.symbol === d.symbol && (
                    <tr className="vsx-expand">
                      <td colSpan={99} style={{ padding: 0 }}>
                        <div className="vsx-expand-inner">{renderDetail(d)}</div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>


        {explain && GLOSSARY[explain] && (
          <div onClick={() => setExplain(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ ...glass, maxWidth: 520, width: "90vw", padding: "24px 28px 22px", background: "rgba(17,17,17,0.97)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", color: "#b99c64", marginBottom: 6 }}>
                    {(GROUPS.flatMap(g => g.metrics).find(m => m.key === explain) || {}).label}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: "0.12em", color: "#fdfdfd" }}>
                    {GLOSSARY[explain][lang][0]}
                  </div>
                </div>
                <button onClick={() => setExplain(null)}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 17 }}>✕</button>
              </div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#a8a8a8", lineHeight: 1.75 }}>
                {GLOSSARY[explain][lang][1]}
              </div>
              {detail && (() => {
                const m = GROUPS.flatMap(g => g.metrics).find(x => x.key === explain);
                const v = m ? valueOf(detail, m) : null;
                return m ? (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "baseline", gap: 10, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    <span style={{ color: "#f8e49b", fontWeight: 700 }}>{detail.symbol}</span>
                    <span style={{ color: colorFor(m, v), fontSize: 15 }}>{m.fmt(v)}</span>
                  </div>
                ) : null;
              })()}
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
