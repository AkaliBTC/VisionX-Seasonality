// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · TICKER-MAPPING
//  Die VSX-Watchlists aus TradingView, übersetzt in Yahoo-Notation.
//  Wo kein direktes Äquivalent existiert (Futures, Währungsindizes), steht ein
//  liquider ETF-Proxy — jeweils mit Herkunft dokumentiert.
// ═════════════════════════════════════════════════════════════════════════════

// ── AKTIEN ───────────────────────────────────────────────────────────────────
export const VSX_STOCKS = [
  "ADS.DE", "ADBE", "AEM", "ALB", "BABA", "AMD", "AMZN", "AXP", "AAPL", "ASTS",
  "B", "BAS.DE", "BAYN.DE", "BRK-B", "BMW.DE", "CVX", "CRCL", "COIN", "DOW", "QBTS",
  "EL", "RACE.MI", "FIS", "AG", "FI", "FRES.L", "GE", "GS", "GOOGL", "HIMS",
  "ILMN", "INTC", "IRM", "JNJ", "JPM", "LISN.SW", "LAC", "OR.PA", "LULU", "MC.PA",
  "MPC", "MBG.DE", "META", "MSFT", "MRNA", "MOH", "NESN.SW", "NFLX", "NEM", "NOVO-B.CO",
  "NVDA", "OXY", "PLTR", "PAAS", "RI.PA", "PSX", "P911.DE", "PHM", "RDDT", "RGTI",
  "RHM.DE", "SNDK", "SCCO", "TSM", "TMUS", "0700.HK", "TME", "TSLA", "TSCO", "UNH",
  "VSCO", "WDAY", "1810.HK",
];

// Sektor-Zuordnung der VSX-Titel (für Filter im Bottom Radar)
export const VSX_STOCK_SECTOR = {
  ADBE: "XLK", AMD: "XLK", AAPL: "XLK", INTC: "XLK", MSFT: "XLK", NVDA: "XLK",
  PLTR: "XLK", QBTS: "XLK", RGTI: "XLK", SNDK: "XLK", WDAY: "XLK", TSM: "XLK", "1810.HK": "XLK",
  AXP: "XLF", "BRK-B": "XLF", CRCL: "XLF", COIN: "XLF", FIS: "XLF", FI: "XLF", GS: "XLF", JPM: "XLF",
  "BAYN.DE": "XLV", HIMS: "XLV", ILMN: "XLV", JNJ: "XLV", MRNA: "XLV", MOH: "XLV",
  "NOVO-B.CO": "XLV", UNH: "XLV",
  "ADS.DE": "XLY", BABA: "XLY", AMZN: "XLY", "BMW.DE": "XLY", "RACE.MI": "XLY", LULU: "XLY",
  "MC.PA": "XLY", "MBG.DE": "XLY", "P911.DE": "XLY", PHM: "XLY", TSLA: "XLY", TSCO: "XLY", VSCO: "XLY",
  EL: "XLP", "LISN.SW": "XLP", "OR.PA": "XLP", "NESN.SW": "XLP", "RI.PA": "XLP",
  CVX: "XLE", OXY: "XLE", MPC: "XLE", PSX: "XLE",
  GE: "XLI", "RHM.DE": "XLI",
  AEM: "XLB", ALB: "XLB", B: "XLB", "BAS.DE": "XLB", DOW: "XLB", AG: "XLB",
  "FRES.L": "XLB", LAC: "XLB", NEM: "XLB", PAAS: "XLB", SCCO: "XLB",
  IRM: "XLRE",
  ASTS: "XLC", GOOGL: "XLC", META: "XLC", NFLX: "XLC", RDDT: "XLC", TMUS: "XLC",
  "0700.HK": "XLC", TME: "XLC",
};

// ── KRYPTO ───────────────────────────────────────────────────────────────────
// TOTAL3 (Aggregat ohne BTC/ETH) hat kein handelbares Äquivalent —
// als Näherung dient die CMC-Global-Metrik im Crypto-Preset.
export const VSX_CRYPTO = [
  "BTC-USD", "ETH-USD", "SOL-USD", "LINK-USD", "TRX-USD", "SUI-USD", "TAO-USD",
  "XRP-USD", "XLM-USD", "HYPE-USD", "FET-USD", "DOGE-USD", "PEPE-USD", "AKT-USD", "ZEC-USD",
];

// ── ROHSTOFFE ────────────────────────────────────────────────────────────────
// ETF-Proxys bevorzugt (echtes Volumen, keine Rollover-Lücken).
// Wo kein liquider ETF existiert, steht der Yahoo-Future.
export const VSX_COMMODITIES = [
  // Energie
  { symbol: "USO",   label: "WTI Crude",    src: "NYMEX:CL1!",  proxy: true },
  { symbol: "BNO",   label: "Brent Crude",  src: "ICEEUR:BRN1!", proxy: true },
  { symbol: "URNM",  label: "Uranium",      src: "AMEX:URNM" },
  { symbol: "LIT",   label: "Lithium",      src: "AMEX:LIT" },
  // Edelmetalle
  { symbol: "GLD",   label: "Gold",         src: "TVC:GOLD",     proxy: true },
  { symbol: "PPLT",  label: "Platinum",     src: "TVC:PLATINUM", proxy: true },
  { symbol: "SLV",   label: "Silver",       src: "TVC:SILVER",   proxy: true },
  { symbol: "PALL",  label: "Palladium",    src: "TVC:PALLADIUM", proxy: true },
  // Industriemetalle
  { symbol: "CPER",  label: "Copper",       src: "COMEX:HG1!",  proxy: true },
  { symbol: "ALI=F", label: "Aluminium",    src: "COMEX:ALI1!", future: true },
  // Agrar
  { symbol: "WEAT",  label: "Wheat",        src: "CBOT:ZW1!",  proxy: true },
  { symbol: "CORN",  label: "Corn",         src: "CBOT:ZC1!",  proxy: true },
  { symbol: "NIB",   label: "Cocoa",        src: "ICEUS:CC1!", proxy: true },
  { symbol: "CANE",  label: "Sugar",        src: "ICEUS:SB1!", proxy: true },
  { symbol: "COW",   label: "Live Cattle",  src: "CME:LE1!",   proxy: true },
  { symbol: "ZR=F",  label: "Rough Rice",   src: "CBOT:ZR1!",  future: true },
  { symbol: "SOYB",  label: "Soybeans",     src: "CBOT:ZS1!",  proxy: true },
];

// ── FOREX ────────────────────────────────────────────────────────────────────
// Die TVC-Währungsindizes gibt es bei Yahoo nicht. Die Currency-Trust-ETFs
// bilden dieselbe Bewegung gegen den Dollar ab und haben sauberes Volumen.
export const VSX_FOREX = [
  { symbol: "DX-Y.NYB", label: "US Dollar Index", src: "TVC:DXY" },
  { symbol: "FXE",  label: "Euro",         src: "TVC:EXY", proxy: true },
  { symbol: "FXY",  label: "Yen",          src: "TVC:JXY", proxy: true },
  { symbol: "FXC",  label: "CAD",          src: "TVC:CXY", proxy: true },
  { symbol: "FXF",  label: "Swiss Franc",  src: "TVC:SXY", proxy: true },
  { symbol: "FXB",  label: "Pound",        src: "TVC:BXY", proxy: true },
  { symbol: "FXA",  label: "Aussie",       src: "TVC:AXY", proxy: true },
];

// ── INDIZES ──────────────────────────────────────────────────────────────────
export const VSX_INDICES = [
  { symbol: "^GDAXI", label: "DAX",        src: "XETR:DAX" },
  { symbol: "^MDAXI", label: "MDAX",       src: "XETR:MDAX" },
  { symbol: "DIA",    label: "Dow",        src: "CBOT_MINI:YM1!", proxy: true },
  { symbol: "QQQ",    label: "Nasdaq 100", src: "CME_MINI:NQ1!",  proxy: true },
  { symbol: "SPY",    label: "S&P 500",    src: "CME_MINI:ES1!",  proxy: true },
  { symbol: "IWM",    label: "Russell 2000", src: "AMEX:IWM" },
  { symbol: "^HSI",   label: "Hang Seng",  src: "TVC:HSI" },
];

// ── ETFs ─────────────────────────────────────────────────────────────────────
export const VSX_ETFS = [
  "URTH", "VWCE.DE", "ACWI",                       // Global
  "VOO", "QQQ", "IWM",                             // USA
  "EEM", "VXUS",                                   // International
  "SXRT.DE", "^GDAXI",                             // Europa
  "^N225", "MCHI",                                 // Asien
  "IXN", "VIG",                                    // Themen
  "XLE", "XLK", "XLV", "XLF", "XLY", "XLP", "XLU", "XLI", "XLRE", "XLB", "XLC",
  "GLD", "SHY",                                    // Real Assets
  "IGF", "ITA",                                    // Infrastruktur
];

// Flache Symbol-Listen für die Module
export const VSX_COMMODITY_SYMBOLS = VSX_COMMODITIES.map(c => c.symbol);
export const VSX_FOREX_SYMBOLS = VSX_FOREX.map(c => c.symbol);
export const VSX_INDEX_SYMBOLS = VSX_INDICES.map(c => c.symbol);

// Anzeigenamen über alle Listen
export const VSX_LABELS = {};
[...VSX_COMMODITIES, ...VSX_FOREX, ...VSX_INDICES].forEach(x => { VSX_LABELS[x.symbol] = x.label; });
