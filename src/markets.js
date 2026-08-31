// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · LÄNDERMÄRKTE
//
//  Struktur pro Land: lokaler Leitindex als Benchmark + Konstituenten, gruppiert
//  nach den SPDR-Sektorkürzeln (XLK, XLF, …). Die Kürzel sind hier reine Labels
//  — es gibt keine deutschen oder indischen SPDR-ETFs. Die Sektoren werden aus
//  den Einzelwerten als gleichgewichteter Index gerechnet (siehe buildComposite).
//
//  WARUM LOKALER BENCHMARK:
//  Deutsche Sektoren gegen SPY zu messen misst zur Hälfte EUR/USD. Gegen den DAX
//  gemessen kürzt sich die Währung raus, und die Frage wird die richtige:
//  welcher Sektor führt INNERHALB des Marktes.
//
//  ⚠ TICKER-LISTEN PRÜFEN
//  Das sind kuratierte Auswahlen der liquidesten Titel je Index, keine
//  vollständige Indexmitgliedschaft — für Sektor-Composites ist das sogar
//  besser, weil illiquide Nachzügler nur Rauschen beitragen. Sie sind aus
//  Kenntnis geschrieben, nicht gegen ein aktuelles Factsheet abgeglichen.
//  Symbole, die Yahoo nicht kennt, tauchen im RRG unter "Keine Daten" auf —
//  diese Liste ist die Korrekturliste. Indexänderungen hier pflegen.
// ═════════════════════════════════════════════════════════════════════════════

// SPDR-Kürzel → Klartext. Bewusst identisch zur US-Benennung, damit die
// Zuordnung im Kopf funktioniert.
export const SECTOR_LABELS = {
  XLK: "Technology",
  XLF: "Financials",
  XLV: "Health Care",
  XLY: "Cons. Discretionary",
  XLP: "Cons. Staples",
  XLE: "Energy",
  XLI: "Industrials",
  XLB: "Materials",
  XLU: "Utilities",
  XLC: "Communication",
  XLRE: "Real Estate",
};

export const SECTOR_ORDER = ["XLK", "XLF", "XLV", "XLY", "XLP", "XLE", "XLI", "XLB", "XLU", "XLC", "XLRE"];

// ── DEUTSCHLAND · DAX 40 + MDAX-Kern ─────────────────────────────────────────
const DE = {
  XLK: ["SAP.DE", "IFX.DE", "WAF.DE", "AIXA.DE", "BC8.DE", "NEM.DE", "TLX.DE"],
  XLF: ["ALV.DE", "MUV2.DE", "DBK.DE", "CBK.DE", "DB1.DE", "HNR1.DE"],
  XLV: ["BAYN.DE", "FRE.DE", "SHL.DE", "MRK.DE", "QIA.DE", "SRT3.DE", "AFX.DE"],
  XLY: ["MBG.DE", "BMW.DE", "P911.DE", "PAH3.DE", "VOW3.DE", "CON.DE", "ADS.DE", "ZAL.DE", "PUM.DE", "BOSS.DE"],
  XLP: ["BEI.DE", "HEN3.DE", "SY1.DE"],
  XLI: ["SIE.DE", "AIR.DE", "MTX.DE", "RHM.DE", "DHL.DE", "DTG.DE", "KGX.DE", "LHA.DE", "FRA.DE", "JUN3.DE"],
  XLB: ["BAS.DE", "1COV.DE", "BNR.DE", "HEI.DE", "LXS.DE", "WCH.DE", "EVK.DE", "SDF.DE", "TKA.DE"],
  XLU: ["RWE.DE", "EOAN.DE", "ENR.DE"],
  XLC: ["DTE.DE", "RRTL.DE"],
  XLRE: ["VNA.DE", "LEG.DE", "TEG.DE"],
};

// ── FRANKREICH · CAC 40 (vollständig) ────────────────────────────────────────
const FR = {
  XLK: ["STM.PA", "CAP.PA", "DSY.PA", "SW.PA"],
  XLF: ["BNP.PA", "ACA.PA", "GLE.PA", "CS.PA"],
  XLV: ["SAN.PA", "EL.PA"],
  XLY: ["MC.PA", "RMS.PA", "KER.PA", "STLAP.PA", "RNO.PA", "AC.PA", "EDEN.PA"],
  XLP: ["OR.PA", "RI.PA", "BN.PA", "CA.PA"],
  XLE: ["TTE.PA"],
  XLI: ["AIR.PA", "SU.PA", "SAF.PA", "DG.PA", "LR.PA", "HO.PA", "ALO.PA", "BOL.PA"],
  XLB: ["AI.PA", "SGO.PA", "AKE.PA", "ERF.PA"],
  XLU: ["ENGI.PA", "VIE.PA"],
  XLC: ["ORA.PA", "PUB.PA", "VIV.PA", "TEP.PA"],
  XLRE: ["URW.PA"],
};

// ── GROSSBRITANNIEN · FTSE 100 (vollständig) ─────────────────────────────────
const UK = {
  XLK: ["SGE.L", "EXPN.L", "AVST.L", "SPX.L"],
  XLF: ["HSBA.L", "BARC.L", "LLOY.L", "NWG.L", "STAN.L", "PRU.L", "LGEN.L", "AV.L",
        "LSEG.L", "III.L", "ABDN.L", "SDR.L", "HL.L", "PHNX.L", "BEZ.L", "HSX.L",
        "ADM.L", "SJP.L", "ICG.L", "MNG.L"],
  XLV: ["AZN.L", "GSK.L", "HLN.L", "SN.L", "CTEC.L"],
  XLY: ["NXT.L", "IHG.L", "WTB.L", "FLTR.L", "BDEV.L", "PSN.L", "TW.L", "BKG.L",
        "ENT.L", "JD.L", "BRBY.L", "FRAS.L", "HWDN.L", "CCL.L", "MKS.L", "AUTO.L"],
  XLP: ["ULVR.L", "DGE.L", "BATS.L", "IMB.L", "TSCO.L", "SBRY.L", "OCDO.L", "CPG.L"],
  XLE: ["SHEL.L", "BP.L", "HBR.L"],
  XLI: ["BA.L", "RR.L", "SMIN.L", "MRO.L", "IAG.L", "BNZL.L", "RTO.L", "DCC.L",
        "WEIR.L", "IMI.L", "BAB.L", "RMV.L", "ITRK.L"],
  XLB: ["RIO.L", "AAL.L", "GLEN.L", "ANTO.L", "CRDA.L", "MNDI.L", "SMDS.L", "FRES.L", "EDV.L"],
  XLU: ["NG.L", "SSE.L", "SVT.L", "UU.L", "CNA.L", "PNN.L", "DRX.L"],
  XLC: ["VOD.L", "BT-A.L", "ITV.L", "REL.L", "PSON.L", "INF.L", "WPP.L"],
  XLRE: ["LAND.L", "BLND.L", "SGRO.L", "UTG.L", "DLN.L", "BBOX.L"],
};

// ── SCHWEIZ · SMI + SMIM-Kern (vollständig) ──────────────────────────────────
const CH = {
  XLK: ["LOGN.SW", "TEMN.SW", "INRN.SW", "ALSN.SW"],
  XLF: ["UBSG.SW", "ZURN.SW", "SREN.SW", "SLHN.SW", "PGHN.SW", "BAER.SW", "PARG.SW",
        "CMBN.SW", "VONN.SW", "HELN.SW"],
  XLV: ["NOVN.SW", "ROG.SW", "LONN.SW", "ALC.SW", "SOON.SW", "BACHEM.SW", "TECN.SW", "SDZ.SW"],
  XLY: ["CFR.SW", "UHR.SW", "DOKA.SW", "BARN.SW"],
  XLP: ["NESN.SW", "EMMN.SW", "LISN.SW"],
  XLI: ["ABBN.SW", "GEBN.SW", "SCHP.SW", "ADEN.SW", "KNIN.SW", "SGSN.SW", "VACN.SW",
        "BUCN.SW", "BELIMO.SW", "SIGN.SW", "RIEN.SW"],
  XLB: ["SIKA.SW", "HOLN.SW", "GIVN.SW", "CLN.SW", "EMSN.SW"],
  XLU: ["BKW.SW"],
  XLC: ["SCMN.SW"],
  XLRE: ["SPSN.SW", "PSPN.SW", "ALLN.SW"],
};

// ── NIEDERLANDE · AEX (vollständig) ──────────────────────────────────────────
const NL = {
  XLK: ["ASML.AS", "ASM.AS", "BESI.AS", "ADYEN.AS"],
  XLF: ["INGA.AS", "ABN.AS", "NN.AS", "ASRNL.AS", "AGN.AS"],
  XLV: ["PHIA.AS"],
  XLY: ["HEIO.AS", "PRX.AS"],
  XLP: ["HEIA.AS", "AD.AS", "IMCD.AS"],
  XLE: ["SHELL.AS"],
  XLI: ["WKL.AS", "RAND.AS", "AALB.AS", "BAMNB.AS", "ARCAD.AS"],
  XLB: ["AKZA.AS", "DSFIR.AS", "AMG.AS"],
  XLU: ["ALFEN.AS"],
  XLC: ["KPN.AS"],
  XLRE: ["URW.AS", "WHA.AS"],
};

// ── ITALIEN · FTSE MIB (vollständig) ─────────────────────────────────────────
const IT = {
  XLK: ["STM.MI", "PRY.MI", "REY.MI"],
  XLF: ["ISP.MI", "UCG.MI", "G.MI", "BAMI.MI", "BMPS.MI", "MB.MI", "UNI.MI",
        "BGN.MI", "BPE.MI", "FBK.MI", "AZM.MI", "BPSO.MI"],
  XLV: ["REC.MI", "DIA.MI", "AMP.MI"],
  XLY: ["RACE.MI", "STLAM.MI", "MONC.MI", "BC.MI", "IVG.MI"],
  XLP: ["CPR.MI"],
  XLE: ["ENI.MI", "TEN.MI", "SPM.MI"],
  XLI: ["LDO.MI", "IG.MI", "CNHI.MI", "INW.MI", "PST.MI", "MONI.MI"],
  XLB: ["BZU.MI", "PIRC.MI"],
  XLU: ["ENEL.MI", "TRN.MI", "SRG.MI", "A2A.MI", "HER.MI", "ERG.MI"],
  XLC: ["TIT.MI", "MFEB.MI"],
};

// ── SPANIEN · IBEX 35 (vollständig) ──────────────────────────────────────────
const ES = {
  XLK: ["AMS.MC", "IDR.MC"],
  XLF: ["SAN.MC", "BBVA.MC", "CABK.MC", "SAB.MC", "BKT.MC", "UNI.MC", "MAP.MC"],
  XLV: ["GRF.MC", "ROVI.MC", "FDR.MC"],
  XLY: ["ITX.MC", "MEL.MC", "IAG.MC"],
  XLP: ["EBRO.MC", "VIS.MC"],
  XLE: ["REP.MC"],
  XLI: ["FER.MC", "ACS.MC", "AENA.MC", "ACX.MC", "SLR.MC", "ANA.MC", "CIE.MC", "LOG.MC"],
  XLB: ["ANE.MC"],
  XLU: ["IBE.MC", "ELE.MC", "NTGY.MC", "RED.MC", "ENG.MC", "SCYR.MC"],
  XLC: ["TEF.MC", "CLNX.MC"],
  XLRE: ["MRL.MC", "COL.MC"],
};

// ── INDIEN · NIFTY 50 (vollständig) ──────────────────────────────────────────
const IN = {
  XLK: ["TCS.NS", "INFY.NS", "HCLTECH.NS", "WIPRO.NS", "TECHM.NS", "LTIM.NS"],
  XLF: ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS",
        "BAJFINANCE.NS", "BAJAJFINSV.NS", "INDUSINDBK.NS", "HDFCLIFE.NS", "SBILIFE.NS",
        "SHRIRAMFIN.NS", "JIOFIN.NS"],
  XLV: ["SUNPHARMA.NS", "CIPLA.NS", "DRREDDY.NS", "APOLLOHOSP.NS", "DIVISLAB.NS"],
  XLY: ["MARUTI.NS", "M&M.NS", "TATAMOTORS.NS", "BAJAJ-AUTO.NS", "EICHERMOT.NS",
        "HEROMOTOCO.NS", "TITAN.NS", "TRENT.NS"],
  XLP: ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS", "BRITANNIA.NS", "TATACONSUM.NS"],
  XLE: ["RELIANCE.NS", "ONGC.NS", "BPCL.NS", "COALINDIA.NS"],
  XLI: ["LT.NS", "ADANIPORTS.NS", "BEL.NS", "ADANIENT.NS"],
  XLB: ["TATASTEEL.NS", "JSWSTEEL.NS", "HINDALCO.NS", "ULTRACEMCO.NS", "GRASIM.NS", "SHREECEM.NS"],
  XLU: ["NTPC.NS", "POWERGRID.NS", "TATAPOWER.NS"],
  XLC: ["BHARTIARTL.NS"],
};

// ── JAPAN · Nikkei-225-Kern ──────────────────────────────────────────────────
// Erweitert, aber bewusst nicht die kompletten 225: die zweite Hälfte des
// Index besteht aus dünn gehandelten Werten, deren Ticker ich nicht sicher
// belegen kann. Was hier steht, deckt den weit überwiegenden Teil der
// Indexkapitalisierung ab. Ergänzungen jederzeit möglich.
const JP = {
  XLK: ["6758.T", "6861.T", "8035.T", "6857.T", "6501.T", "6702.T", "6971.T", "6981.T",
        "6752.T", "6503.T", "6645.T", "6146.T", "7735.T", "6920.T", "4062.T", "6762.T",
        "6723.T", "6963.T", "3436.T"],
  XLF: ["8306.T", "8316.T", "8411.T", "8766.T", "8591.T", "8604.T", "8725.T", "8750.T",
        "8630.T", "8309.T", "8308.T", "7182.T"],
  XLV: ["4568.T", "4502.T", "4519.T", "4523.T", "7741.T", "4503.T", "4507.T", "4578.T",
        "4151.T", "4506.T", "7733.T", "6869.T"],
  XLY: ["7203.T", "7267.T", "7269.T", "6902.T", "9983.T", "4661.T", "7201.T", "7270.T",
        "7211.T", "3382.T", "8267.T", "9843.T", "7936.T", "2670.T", "8113.T"],
  XLP: ["2914.T", "4452.T", "2502.T", "2801.T", "2503.T", "2802.T", "2871.T", "4911.T", "2269.T"],
  XLI: ["6301.T", "6367.T", "7011.T", "6954.T", "8058.T", "8031.T", "9020.T", "6273.T",
        "6326.T", "7012.T", "7013.T", "6473.T", "6506.T", "5108.T", "9022.T", "9021.T",
        "9101.T", "9104.T", "9107.T", "8001.T", "8002.T", "8053.T", "6098.T", "2181.T",
        "1801.T", "1802.T", "1803.T", "1812.T", "5631.T"],
  XLB: ["4063.T", "5401.T", "4188.T", "4005.T", "4021.T", "4183.T", "4208.T", "3407.T",
        "5411.T", "5713.T", "5714.T", "5802.T", "5803.T", "5333.T", "5301.T", "3861.T", "3405.T"],
  XLE: ["5020.T", "1605.T", "5019.T"],
  XLU: ["9501.T", "9503.T", "9502.T", "9531.T", "9532.T", "9508.T"],
  XLC: ["9432.T", "9433.T", "9984.T", "7974.T", "9613.T", "4324.T", "2432.T", "4755.T",
        "9766.T", "9602.T", "9735.T"],
  XLRE: ["8801.T", "8802.T", "8830.T", "3289.T"],
};

// ── KANADA · S&P/TSX 60 (vollständig) ────────────────────────────────────────
const CA = {
  XLK: ["SHOP.TO", "CSU.TO", "OTEX.TO", "GIB-A.TO", "DSG.TO"],
  XLF: ["RY.TO", "TD.TO", "BNS.TO", "BMO.TO", "CM.TO", "NA.TO", "MFC.TO", "SLF.TO",
        "IFC.TO", "GWO.TO", "POW.TO", "BAM.TO", "BN.TO", "IGM.TO", "X.TO"],
  XLV: ["BHC.TO"],
  XLY: ["QSR.TO", "DOL.TO", "MG.TO", "GIL.TO", "CTC-A.TO", "ATZ.TO", "LNR.TO"],
  XLP: ["L.TO", "ATD.TO", "MRU.TO", "SAP.TO", "EMP-A.TO", "WN.TO"],
  XLE: ["ENB.TO", "CNQ.TO", "SU.TO", "TRP.TO", "PPL.TO", "IMO.TO", "CVE.TO", "TOU.TO",
        "ARX.TO", "MEG.TO", "GEI.TO", "KEY.TO"],
  XLI: ["CNR.TO", "CP.TO", "WCN.TO", "TFII.TO", "TIH.TO", "STN.TO", "WSP.TO", "AC.TO", "RBA.TO"],
  XLB: ["ABX.TO", "AEM.TO", "WPM.TO", "FNV.TO", "TECK-B.TO", "NTR.TO", "K.TO", "FM.TO",
        "IVN.TO", "LUN.TO", "CCO.TO", "PAAS.TO", "WFG.TO", "CAS.TO"],
  XLU: ["FTS.TO", "EMA.TO", "H.TO", "CU.TO", "AQN.TO", "NPI.TO", "BLX.TO"],
  XLC: ["BCE.TO", "T.TO", "RCI-B.TO", "QBR-B.TO", "CJR-B.TO"],
  XLRE: ["REI-UN.TO", "CAR-UN.TO", "GRT-UN.TO", "FCR-UN.TO", "SRU-UN.TO"],
};

// ── AUSTRALIEN · ASX-200-Kern ────────────────────────────────────────────────
// Wie bei Japan: die großen und mittleren Werte sind drin, der lange Schwanz
// der ASX 200 nicht. Deckt den überwiegenden Teil der Indexkapitalisierung ab.
const AU = {
  XLK: ["XRO.AX", "WTC.AX", "ALU.AX", "NXT.AX", "TNE.AX"],
  XLF: ["CBA.AX", "NAB.AX", "WBC.AX", "ANZ.AX", "MQG.AX", "QBE.AX", "SUN.AX",
        "IAG.AX", "BEN.AX", "BOQ.AX", "ASX.AX", "MPL.AX", "AMP.AX", "CGF.AX"],
  XLV: ["CSL.AX", "RMD.AX", "COH.AX", "SHL.AX", "RHC.AX", "FPH.AX", "PME.AX", "ANN.AX"],
  XLY: ["WES.AX", "ALL.AX", "JBH.AX", "HVN.AX", "DMP.AX", "LOV.AX", "TAH.AX",
        "ARB.AX", "SUL.AX", "IEL.AX", "FLT.AX", "WEB.AX"],
  XLP: ["WOW.AX", "COL.AX", "TWE.AX", "EDV.AX", "A2M.AX"],
  XLE: ["WDS.AX", "STO.AX", "BPT.AX", "WHC.AX", "NHC.AX", "YAL.AX"],
  XLI: ["TCL.AX", "BXB.AX", "QAN.AX", "ALX.AX", "CPU.AX", "REH.AX", "SVW.AX", "DOW.AX", "AZJ.AX"],
  XLB: ["BHP.AX", "RIO.AX", "FMG.AX", "NST.AX", "S32.AX", "JHX.AX", "MIN.AX",
        "PLS.AX", "IGO.AX", "LYC.AX", "ORI.AX", "AMC.AX", "EVN.AX", "SFR.AX", "IPL.AX"],
  XLU: ["AGL.AX", "ORG.AX", "APA.AX"],
  XLC: ["TLS.AX", "REA.AX", "CAR.AX", "SEK.AX", "NEC.AX"],
  XLRE: ["GMG.AX", "SCG.AX", "SGP.AX", "MGR.AX", "DXS.AX", "VCX.AX", "CHC.AX", "GPT.AX"],
};

// ── LÄNDERREGISTER ───────────────────────────────────────────────────────────
// etf     — der ETF, unter dem das Land im Länder-RRG läuft (Ebene 1)
// bench   — lokaler Leitindex, gegen den die Sektoren gemessen werden (Ebene 2/3)
export const MARKETS = {
  EWG:  { code: "GER", name: "Deutschland",   nameEn: "Germany",       bench: "^GDAXI",     benchLabel: "DAX 40",     sectors: DE },
  EWQ:  { code: "FRA", name: "Frankreich",    nameEn: "France",        bench: "^FCHI",      benchLabel: "CAC 40",     sectors: FR },
  EWU:  { code: "UK",  name: "Großbritannien", nameEn: "United Kingdom", bench: "^FTSE",    benchLabel: "FTSE 100",   sectors: UK },
  EWL:  { code: "SUI", name: "Schweiz",       nameEn: "Switzerland",   bench: "^SSMI",      benchLabel: "SMI",        sectors: CH },
  EWN:  { code: "NED", name: "Niederlande",   nameEn: "Netherlands",   bench: "^AEX",       benchLabel: "AEX",        sectors: NL },
  EWI:  { code: "ITA", name: "Italien",       nameEn: "Italy",         bench: "FTSEMIB.MI", benchLabel: "FTSE MIB",   sectors: IT },
  EWP:  { code: "ESP", name: "Spanien",       nameEn: "Spain",         bench: "^IBEX",      benchLabel: "IBEX 35",    sectors: ES },
  INDA: { code: "IND", name: "Indien",        nameEn: "India",         bench: "^NSEI",      benchLabel: "NIFTY 50",   sectors: IN },
  EWJ:  { code: "JPN", name: "Japan",         nameEn: "Japan",         bench: "^N225",      benchLabel: "Nikkei 225", sectors: JP },
  EWC:  { code: "CAN", name: "Kanada",        nameEn: "Canada",        bench: "^GSPTSE",    benchLabel: "S&P/TSX",    sectors: CA },
  EWA:  { code: "AUS", name: "Australien",    nameEn: "Australia",     bench: "^AXJO",      benchLabel: "ASX 200",    sectors: AU },
};

export const hasMarket = etf => Boolean(MARKETS[etf]);

// Sektoren eines Landes, nur die tatsächlich befüllten, in fester Reihenfolge
export const marketSectors = (etf) => {
  const m = MARKETS[etf];
  if (!m) return [];
  return SECTOR_ORDER
    .filter(k => (m.sectors[k] || []).length > 0)
    .map(k => ({ key: k, etf: k, label: k, name: SECTOR_LABELS[k], members: m.sectors[k] }));
};

// Alle Einzeltitel eines Landes
export const marketMembers = (etf) => {
  const m = MARKETS[etf];
  return m ? [...new Set(Object.values(m.sectors).flat())] : [];
};

// Pseudo-Symbol für einen Sektor-Composite: "EWG#XLK"
export const compositeId = (etf, sector) => `${etf}#${sector}`;
export const parseComposite = (sym) => {
  const i = String(sym).indexOf("#");
  return i < 0 ? null : { etf: sym.slice(0, i), sector: sym.slice(i + 1) };
};

// ── COMPOSITE ────────────────────────────────────────────────────────────────
// Gleichgewichteter, verketteter Renditeindex über die Mitglieder.
//
// Warum verkettet und nicht "Preise mitteln": Mitglieder haben unterschiedlich
// lange Historien und gelegentlich Lücken. Mittelt man Preise, springt der Index
// jedes Mal, wenn ein Titel dazukommt oder ausfällt. Über Tagesrenditen gemittelt
// passiert das nicht — an jedem Tag zählen nur die Titel, die an diesem UND am
// Vortag einen Kurs haben.
//
// series: { symbol: [[ts, close], …] }  →  [[ts, indexLevel], …]
export const buildComposite = (members, series) => {
  const avail = members.map(s => series[s]).filter(a => Array.isArray(a) && a.length > 20);
  if (avail.length < 2) return null;

  // Kurs je Symbol nach Tagesschlüssel
  const maps = avail.map(a => {
    const m = new Map();
    for (const [t, c] of a) {
      if (Number.isFinite(c) && c > 0) m.set(new Date(t).toISOString().slice(0, 10), c);
    }
    return m;
  });

  // Gemeinsames Zeitraster: alle Tage, an denen mindestens die Hälfte handelt
  const count = new Map();
  for (const m of maps) for (const k of m.keys()) count.set(k, (count.get(k) || 0) + 1);
  const minMembers = Math.max(2, Math.ceil(avail.length * 0.5));
  const days = [...count.entries()].filter(([, n]) => n >= minMembers).map(([k]) => k).sort();
  if (days.length < 30) return null;

  const out = [];
  let level = 100;
  for (let i = 0; i < days.length; i++) {
    if (i === 0) { out.push([Date.parse(`${days[0]}T00:00:00Z`), level]); continue; }
    let sum = 0, n = 0;
    for (const m of maps) {
      const a = m.get(days[i - 1]), b = m.get(days[i]);
      if (Number.isFinite(a) && Number.isFinite(b) && a > 0) { sum += b / a - 1; n++; }
    }
    if (n > 0) level *= 1 + sum / n;
    out.push([Date.parse(`${days[i]}T00:00:00Z`), level]);
  }
  return out;
};
