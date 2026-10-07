// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · KRYPTO-SEKTOREN
//  Zuordnung Coin → Sektor(en) für Filter und Heatmap im RRG.
//
//  1. Kuratierte Liste (unten) hat Vorrang — dort stehen die bekannten Coins
//     so, wie ein Trader sie einordnet.
//  2. Sonst entscheiden die Tags von CoinMarketCap (listings liefert sie mit).
//     CMC vergibt sehr viele Tags (Portfolios, Ökosysteme …), deshalb zählen
//     nur die Muster unten, und je Coin höchstens zwei Sektoren in der
//     Reihenfolge der Spezifität (MEME vor AI vor … vor L1).
// ═════════════════════════════════════════════════════════════════════════════

export const CRYPTO_SECTORS = [
  { key: "MEME",     label: "Meme",     color: "#f472b6", tags: [/meme/] },
  { key: "AI",       label: "AI",       color: "#a855f7", tags: [/(^|-)ai(-|$)/, /artificial-intelligence/, /machine-learning/, /ai-big-data/] },
  { key: "GAMEFI",   label: "GameFi",   color: "#fb923c", tags: [/gaming/, /gamefi/, /play-to-earn/, /metaverse/] },
  { key: "RWA",      label: "RWA",      color: "#facc15", tags: [/real-world-asset/, /(^|-)rwa(-|$)/, /tokenized/] },
  { key: "DEPIN",    label: "DePIN",    color: "#2dd4bf", tags: [/depin/, /distributed-computing/, /filesharing/, /storage/, /(^|-)iot(-|$)/] },
  { key: "PRIVACY",  label: "Privacy",  color: "#94a3b8", tags: [/privacy/] },
  { key: "PAYMENTS", label: "Payments", color: "#38bdf8", tags: [/^payments?$/] },
  { key: "EXCHANGE", label: "CEX",      color: "#fbbf24", tags: [/(^|[^e])centralized-exchange/, /^cex/] },
  { key: "L2",       label: "Layer 2",  color: "#7dd3fc", tags: [/layer-2/, /rollups?$/, /zero-knowledge/] },
  { key: "DEFI",     label: "DeFi",     color: "#22c55e", tags: [/^defi$/, /decentralized-exchange/, /lending/, /yield-farming/, /derivatives/, /perpetuals?/, /liquid-staking/] },
  { key: "INFRA",    label: "Infra",    color: "#c084fc", tags: [/oracles?/, /interoperability/, /cross-chain/, /indexing/] },
  { key: "L1",       label: "Layer 1",  color: "#63b6ff", tags: [/^layer-1$/] },
];

const ORDER = Object.fromEntries(CRYPTO_SECTORS.map((s, i) => [s.key, i]));
export const SECTOR_BY_KEY = Object.fromEntries(CRYPTO_SECTORS.map(s => [s.key, s]));

// Kuratierte Zuordnung (Basis-Symbol ohne -USD)
const CURATED = {
  // Layer 1
  ETH: ["L1"], SOL: ["L1"], ADA: ["L1"], AVAX: ["L1"], DOT: ["L1"], TRX: ["L1"],
  TON: ["L1"], SUI: ["L1"], APT: ["L1"], SEI: ["L1"], ATOM: ["L1"], ALGO: ["L1"],
  HBAR: ["L1"], ICP: ["L1"], KAS: ["L1"], ETC: ["L1"], EGLD: ["L1"], BERA: ["L1"],
  S: ["L1"], FTM: ["L1"], XTZ: ["L1"], EOS: ["L1"], NEO: ["L1"], VET: ["L1"],
  KAIA: ["L1"], FLOW: ["L1", "GAMEFI"], MINA: ["L1"], CORE: ["L1"], MOVE: ["L1"],
  NEAR: ["L1", "AI"], INJ: ["L1", "DEFI"], BNB: ["L1", "EXCHANGE"],
  // Payments
  BTC: ["PAYMENTS"], XRP: ["PAYMENTS"], XLM: ["PAYMENTS"], LTC: ["PAYMENTS"],
  BCH: ["PAYMENTS"], XDC: ["PAYMENTS"],
  // Layer 2
  ARB: ["L2"], OP: ["L2"], POL: ["L2"], MATIC: ["L2"], STRK: ["L2"], MNT: ["L2"],
  ZK: ["L2"], METIS: ["L2"], MANTA: ["L2"], STX: ["L2"], TAIKO: ["L2"],
  // DeFi
  UNI: ["DEFI"], AAVE: ["DEFI"], MKR: ["DEFI"], SKY: ["DEFI"], LDO: ["DEFI"],
  CRV: ["DEFI"], COMP: ["DEFI"], SNX: ["DEFI"], DYDX: ["DEFI"], JUP: ["DEFI"],
  RAY: ["DEFI"], CAKE: ["DEFI"], PENDLE: ["DEFI"], ENA: ["DEFI"], GMX: ["DEFI"],
  HYPE: ["DEFI"], RUNE: ["DEFI"], "1INCH": ["DEFI"], SUSHI: ["DEFI"], JTO: ["DEFI"],
  ETHFI: ["DEFI"], MORPHO: ["DEFI"], AERO: ["DEFI"], EIGEN: ["DEFI"], CVX: ["DEFI"],
  // AI
  FET: ["AI"], TAO: ["AI"], WLD: ["AI"], VIRTUAL: ["AI"], AI16Z: ["AI", "MEME"],
  ARKM: ["AI"], OCEAN: ["AI"], AGIX: ["AI"], AIOZ: ["AI", "DEPIN"], GRT: ["AI", "INFRA"],
  RENDER: ["AI", "DEPIN"], RNDR: ["AI", "DEPIN"], AKT: ["AI", "DEPIN"], IO: ["AI", "DEPIN"],
  KAITO: ["AI"], GRASS: ["AI", "DEPIN"], AIXBT: ["AI"],
  // GameFi
  IMX: ["GAMEFI", "L2"], SAND: ["GAMEFI"], MANA: ["GAMEFI"], AXS: ["GAMEFI"],
  GALA: ["GAMEFI"], APE: ["GAMEFI"], ILV: ["GAMEFI"], BEAM: ["GAMEFI"], RON: ["GAMEFI"],
  PRIME: ["GAMEFI"], MAGIC: ["GAMEFI"], YGG: ["GAMEFI"], ENJ: ["GAMEFI"], PIXEL: ["GAMEFI"],
  NOT: ["GAMEFI"],
  // Meme
  DOGE: ["MEME"], SHIB: ["MEME"], PEPE: ["MEME"], BONK: ["MEME"], WIF: ["MEME"],
  FLOKI: ["MEME"], TRUMP: ["MEME"], BRETT: ["MEME"], POPCAT: ["MEME"], MEW: ["MEME"],
  FARTCOIN: ["MEME"], PENGU: ["MEME"], SPX: ["MEME"], MOG: ["MEME"], TURBO: ["MEME"],
  PNUT: ["MEME"], NEIRO: ["MEME"], BOME: ["MEME"], WLFI: ["DEFI"],
  // RWA
  ONDO: ["RWA"], OM: ["RWA"], PLUME: ["RWA"], CFG: ["RWA"], POLYX: ["RWA"],
  PAXG: ["RWA"], XAUT: ["RWA"], SYRUP: ["RWA", "DEFI"],
  // DePIN
  FIL: ["DEPIN"], AR: ["DEPIN"], HNT: ["DEPIN"], IOTX: ["DEPIN"], THETA: ["DEPIN"],
  IOTA: ["DEPIN"], JASMY: ["DEPIN"],
  // Infra
  LINK: ["INFRA"], PYTH: ["INFRA"], BAND: ["INFRA"], QNT: ["INFRA"], API3: ["INFRA"],
  TIA: ["INFRA"], W: ["INFRA"], AXL: ["INFRA"], ZRO: ["INFRA"], ENS: ["INFRA"],
  // Privacy
  XMR: ["PRIVACY"], ZEC: ["PRIVACY"], DASH: ["PRIVACY"], ROSE: ["PRIVACY"], SCRT: ["PRIVACY"],
  // CEX
  OKB: ["EXCHANGE"], CRO: ["EXCHANGE"], LEO: ["EXCHANGE"], KCS: ["EXCHANGE"],
  GT: ["EXCHANGE"], BGB: ["EXCHANGE"],
};

export const baseSymbol = (sym) => String(sym || "").toUpperCase().replace(/-USDT?$/, "");

// Sektoren eines Coins (Array, 0–2 Einträge, spezifischster zuerst)
export const cryptoSectorsOf = (sym, tags) => {
  const b = baseSymbol(sym);
  if (CURATED[b]) return CURATED[b];
  if (!Array.isArray(tags) || !tags.length) return [];
  const hits = new Set();
  for (const raw of tags) {
    const tag = String(raw).toLowerCase();
    for (const s of CRYPTO_SECTORS) if (s.tags.some(re => re.test(tag))) hits.add(s.key);
  }
  return [...hits].sort((a, z) => ORDER[a] - ORDER[z]).slice(0, 2);
};
