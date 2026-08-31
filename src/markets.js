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


// ═════════════════════════════════════════════════════════════════════════════
//  ZWEITE GRUPPE · restliche Länder aus dem COUNTRIES-Preset
//
//  Abdeckung hier bewusst geringer: "core" statt "full". Für diese Märkte kann
//  ich keine vollständige Indexmitgliedschaft belegen, ohne Ticker zu erfinden.
//  Was drin steht, sind die schwergewichtigen, liquiden Namen — für Sektor-
//  Composites tragfähig, aber eben nicht der komplette Index. Im Dropdown sind
//  diese Märkte entsprechend markiert.
// ═════════════════════════════════════════════════════════════════════════════

// ── SCHWEDEN · OMXS30 ────────────────────────────────────────────────────────
const SE = {
  XLK: ["ERIC-B.ST", "HEXA-B.ST", "NIBE-B.ST"],
  XLF: ["SEB-A.ST", "SHB-A.ST", "SWED-A.ST", "NDA-SE.ST", "INVE-B.ST", "EQT.ST"],
  XLV: ["AZN.ST", "GETI-B.ST", "ELUX-B.ST"],
  XLY: ["HM-B.ST", "EVO.ST"],
  XLP: ["ESSITY-B.ST"],
  XLI: ["ATCO-A.ST", "ATCO-B.ST", "VOLV-B.ST", "SAND.ST", "ALFA.ST", "SKF-B.ST",
        "SECU-B.ST", "ASSA-B.ST", "EPI-A.ST", "INDT.ST"],
  XLB: ["BOL.ST", "SSAB-A.ST", "SCA-B.ST", "HOLM-B.ST"],
  XLC: ["TELIA.ST", "TEL2-B.ST"],
  XLRE: ["CAST.ST", "FABG.ST", "BALD-B.ST"],
};

// ── NORWEGEN · OBX ───────────────────────────────────────────────────────────
const NO = {
  XLF: ["DNB.OL", "STB.OL", "GJF.OL"],
  XLV: ["ORK.OL"],
  XLP: ["MOWI.OL", "SALM.OL", "LSG.OL", "BAKKA.OL"],
  XLE: ["EQNR.OL", "AKRBP.OL", "VAR.OL", "SUBC.OL", "TGS.OL", "FRO.OL"],
  XLI: ["KOG.OL", "TOM.OL", "AKSO.OL"],
  XLB: ["NHY.OL", "YAR.OL", "ELK.OL"],
  XLC: ["TEL.OL", "SCHA.OL"],
};

// ── BELGIEN · BEL 20 ─────────────────────────────────────────────────────────
const BE = {
  XLK: ["MELE.BR"],
  XLF: ["KBC.BR", "AGS.BR", "GBLB.BR"],
  XLV: ["UCB.BR", "ARGX.BR"],
  XLY: ["DIE.BR"],
  XLP: ["ABI.BR", "COLR.BR", "LOTB.BR"],
  XLI: ["BEKB.BR", "AZE.BR", "DEME.BR"],
  XLB: ["SOLB.BR", "UMI.BR"],
  XLC: ["PROX.BR"],
  XLRE: ["WDP.BR", "COFB.BR", "AED.BR"],
};

// ── IRLAND · ISEQ 20 ─────────────────────────────────────────────────────────
const IE = {
  XLF: ["BIRG.IR", "A5G.IR"],
  XLV: ["UPR.IR"],
  XLY: ["FLTR.IR", "DHG.IR", "GL9.IR"],
  XLP: ["GVR.IR", "KRZ.IR"],
  XLI: ["RY4C.IR", "KRX.IR", "GRP.IR"],
  XLB: ["CRG.IR", "SK3.IR"],
  XLRE: ["IRES.IR"],
};

// ── POLEN · WIG20 ────────────────────────────────────────────────────────────
const PL = {
  XLK: ["CDR.WA", "ALE.WA"],
  XLF: ["PKO.WA", "PEO.WA", "SPL.WA", "MBK.WA", "ALR.WA", "PZU.WA"],
  XLV: ["DNP.WA"],
  XLY: ["LPP.WA", "CCC.WA"],
    XLE: ["PKN.WA"],
  XLI: ["BDX.WA"],
  XLB: ["KGH.WA"],
  XLU: ["PGE.WA", "TPE.WA"],
  XLC: ["CPS.WA", "OPL.WA"],
};

// ── CHINA / HONGKONG · HSI + HSCEI ───────────────────────────────────────────
const CN = {
  XLK: ["0700.HK", "9988.HK", "3690.HK", "9618.HK", "1810.HK", "0992.HK", "0981.HK", "1024.HK", "9999.HK"],
  XLF: ["1398.HK", "0939.HK", "3988.HK", "1288.HK", "2318.HK", "2628.HK", "0388.HK", "3968.HK", "1299.HK"],
  XLV: ["1093.HK", "1177.HK", "2269.HK", "6160.HK"],
  XLY: ["1211.HK", "2015.HK", "0175.HK", "2331.HK", "1929.HK", "6690.HK"],
  XLP: ["0322.HK", "0288.HK", "2319.HK"],
  XLE: ["0857.HK", "0386.HK", "0883.HK", "1088.HK"],
  XLI: ["1766.HK", "0669.HK", "0392.HK"],
  XLB: ["0914.HK", "2600.HK", "0347.HK"],
  XLU: ["0836.HK", "0902.HK", "0003.HK", "0006.HK"],
  XLC: ["0941.HK", "0762.HK", "0728.HK"],
  XLRE: ["0016.HK", "0823.HK", "1109.HK", "0688.HK", "1997.HK"],
};

// ── HONGKONG · HSI-Kern (lokale Werte) ───────────────────────────────────────
const HK = {
  XLK: ["0700.HK", "0992.HK", "0285.HK", "0981.HK"],
  XLF: ["0388.HK", "0011.HK", "0005.HK", "2388.HK", "1299.HK", "0023.HK"],
  XLV: ["1093.HK", "1177.HK"],
  XLY: ["0027.HK", "1929.HK"],
  XLP: ["0322.HK", "0288.HK"],
  XLI: ["0019.HK", "0316.HK", "0669.HK", "0293.HK"],
  XLB: ["0914.HK"],
  XLU: ["0002.HK", "0003.HK", "0006.HK", "0836.HK"],
  XLC: ["0941.HK", "0728.HK"],
  XLRE: ["0016.HK", "0823.HK", "0017.HK", "0101.HK", "1113.HK", "0688.HK", "1997.HK"],
};

// ── SÜDKOREA · KOSPI 200 ─────────────────────────────────────────────────────
const KR = {
  XLK: ["005930.KS", "000660.KS", "042700.KS", "009150.KS", "011070.KS", "035420.KS", "035720.KS"],
  XLF: ["105560.KS", "055550.KS", "086790.KS", "316140.KS", "032830.KS", "138040.KS"],
  XLV: ["207940.KS", "068270.KS", "128940.KS", "000100.KS"],
  XLY: ["005380.KS", "000270.KS", "012330.KS", "161390.KS", "090430.KS"],
  XLP: ["097950.KS", "271560.KS", "033780.KS"],
  XLE: ["096770.KS", "010950.KS"],
  XLI: ["009540.KS", "010140.KS", "042660.KS", "000720.KS", "047050.KS"],
  XLB: ["005490.KS", "051910.KS", "010130.KS", "011170.KS", "004020.KS", "006400.KS"],
  XLU: ["015760.KS", "036460.KS"],
  XLC: ["030200.KS", "017670.KS", "032640.KS"],
};

// ── TAIWAN · TAIEX ───────────────────────────────────────────────────────────
const TW = {
  XLK: ["2330.TW", "2454.TW", "2317.TW", "2382.TW", "3711.TW", "2308.TW", "3034.TW",
        "2379.TW", "3008.TW", "2357.TW", "2409.TW", "3037.TW", "2303.TW", "2408.TW"],
  XLF: ["2881.TW", "2882.TW", "2886.TW", "2891.TW", "2884.TW", "2892.TW", "2880.TW", "2887.TW"],
  XLV: ["1707.TW", "4142.TW"],
  XLY: ["2912.TW", "9910.TW", "2207.TW"],
  XLP: ["1216.TW", "1301.TW"],
  XLE: ["6505.TW"],
  XLI: ["2603.TW", "2609.TW", "2615.TW", "2618.TW", "2610.TW"],
  XLB: ["1303.TW", "1326.TW", "2002.TW", "1101.TW", "1102.TW"],
  XLU: ["9904.TW"],
  XLC: ["3045.TW", "4904.TW", "4977.TW"],
};

// ── SINGAPUR · STI ───────────────────────────────────────────────────────────
const SG = {
  XLF: ["D05.SI", "O39.SI", "U11.SI", "S68.SI"],
  XLV: ["Y92.SI"],
  XLY: ["C09.SI", "G13.SI"],
  XLP: ["F34.SI", "V03.SI"],
  XLE: ["BN4.SI"],
  XLI: ["Z74.SI", "C6L.SI", "S63.SI", "BS6.SI", "U96.SI"],
  XLU: ["AJBU.SI"],
    XLRE: ["C38U.SI", "A17U.SI", "M44U.SI", "J69U.SI", "ME8U.SI", "N2IU.SI", "C07.SI", "U14.SI"],
};

// ── INDONESIEN · IDX30 ───────────────────────────────────────────────────────
const ID = {
  XLF: ["BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "ARTO.JK", "BRIS.JK"],
  XLV: ["KLBF.JK", "SIDO.JK", "MIKA.JK"],
  XLY: ["ASII.JK", "MAPI.JK", "ACES.JK"],
  XLP: ["UNVR.JK", "ICBP.JK", "INDF.JK", "AMRT.JK", "CPIN.JK"],
  XLE: ["PGAS.JK", "ADRO.JK", "PTBA.JK", "MEDC.JK", "ITMG.JK"],
  XLI: ["UNTR.JK", "JSMR.JK"],
  XLB: ["INTP.JK", "SMGR.JK", "ANTM.JK", "INCO.JK", "BRPT.JK", "TPIA.JK"],
  XLU: ["POWR.JK"],
  XLC: ["TLKM.JK", "EXCL.JK", "TOWR.JK", "TBIG.JK"],
  XLRE: ["BSDE.JK", "PWON.JK", "CTRA.JK"],
};

// ── THAILAND · SET50 ─────────────────────────────────────────────────────────
const TH = {
  XLK: ["DELTA.BK"],
  XLF: ["SCB.BK", "KBANK.BK", "BBL.BK", "KTB.BK", "TTB.BK", "TISCO.BK"],
  XLV: ["BDMS.BK", "BH.BK", "BCH.BK"],
  XLY: ["CPALL.BK", "CRC.BK", "HMPRO.BK", "MINT.BK", "CENTEL.BK"],
  XLP: ["CPF.BK", "TU.BK", "OSP.BK"],
  XLE: ["PTT.BK", "PTTEP.BK", "TOP.BK", "IRPC.BK", "BCP.BK", "OR.BK"],
  XLI: ["AOT.BK", "BEM.BK", "BTS.BK"],
  XLB: ["SCC.BK", "PTTGC.BK", "IVL.BK", "SCGP.BK"],
  XLU: ["GULF.BK", "GPSC.BK", "EGCO.BK", "RATCH.BK", "BGRIM.BK"],
  XLC: ["ADVANC.BK", "TRUE.BK", "INTUCH.BK"],
  XLRE: ["LH.BK", "AP.BK", "CPN.BK", "WHA.BK"],
};

// ── MALAYSIA · KLCI ──────────────────────────────────────────────────────────
const MY = {
  XLF: ["1155.KL", "1295.KL", "1023.KL", "5819.KL", "1066.KL", "6888.KL"],
  XLV: ["7113.KL", "5168.KL", "101.KL"],
  XLY: ["4715.KL", "5285.KL"],
  XLP: ["4707.KL", "3689.KL", "2445.KL"],
  XLE: ["5681.KL", "5183.KL", "5347.KL"],
  XLI: ["5014.KL", "3816.KL", "6947.KL"],
  XLB: ["4197.KL", "2291.KL", "5185.KL"],
  XLU: ["6033.KL"],
  XLC: ["6012.KL", "4863.KL"],
  XLRE: ["5296.KL", "8583.KL"],
};

// ── BRASILIEN · IBOVESPA ─────────────────────────────────────────────────────
const BR = {
  XLK: ["TOTS3.SA"],
  XLF: ["ITUB4.SA", "BBDC4.SA", "BBAS3.SA", "SANB11.SA", "B3SA3.SA", "BBSE3.SA", "BPAC11.SA"],
  XLV: ["RDOR3.SA", "HAPV3.SA", "FLRY3.SA", "HYPE3.SA"],
  XLY: ["LREN3.SA", "MGLU3.SA", "RENT3.SA", "CVCB3.SA", "AZUL4.SA", "RAIL3.SA"],
  XLP: ["ABEV3.SA", "JBSS3.SA", "BRFS3.SA", "RAIZ4.SA", "SMTO3.SA", "ASAI3.SA"],
  XLE: ["PETR4.SA", "PETR3.SA", "PRIO3.SA", "UGPA3.SA", "CSAN3.SA"],
  XLI: ["WEGE3.SA", "EMBR3.SA", "CCRO3.SA"],
  XLB: ["VALE3.SA", "GGBR4.SA", "CSNA3.SA", "SUZB3.SA", "KLBN11.SA", "BRAP4.SA"],
  XLU: ["ELET3.SA", "ELET6.SA", "CMIG4.SA", "CPFE3.SA", "EQTL3.SA", "ENGI11.SA", "SBSP3.SA"],
  XLC: ["VIVT3.SA", "TIMS3.SA"],
  XLRE: ["MRVE3.SA", "CYRE3.SA", "MULT3.SA"],
};

// ── MEXIKO · IPC ─────────────────────────────────────────────────────────────
const MX = {
  XLF: ["GFNORTEO.MX", "BBAJIOO.MX", "GENTERA.MX", "Q.MX", "BOLSAA.MX"],
  XLV: ["LABB.MX"],
  XLY: ["WALMEX.MX", "LIVEPOLC-1.MX", "ALSEA.MX", "CHDRAUIB.MX"],
  XLP: ["FEMSAUBD.MX", "KOFUBL.MX", "GRUMAB.MX", "BIMBOA.MX", "LALAB.MX"],
  XLE: ["ALPEKA.MX"],
  XLI: ["GAPB.MX", "ASURB.MX", "OMAB.MX", "GCARSOA1.MX", "ALFAA.MX"],
  XLB: ["CEMEXCPO.MX", "GMEXICOB.MX", "PE&OLES.MX", "ORBIA.MX"],
  XLC: ["AMXB.MX", "TLEVISACPO.MX"],
  XLRE: ["FUNO11.MX", "VESTA.MX"],
};

// ── SAUDI-ARABIEN · TASI ─────────────────────────────────────────────────────
const SA = {
  XLF: ["1120.SR", "1180.SR", "1010.SR", "1060.SR", "1050.SR", "1150.SR", "8010.SR"],
  XLV: ["4013.SR", "4002.SR", "4004.SR"],
  XLY: ["4190.SR", "4161.SR", "4003.SR"],
  XLP: ["2280.SR", "6001.SR", "2050.SR"],
  XLE: ["2222.SR", "2380.SR", "2030.SR"],
  XLI: ["4110.SR", "2040.SR"],
  XLB: ["2010.SR", "1211.SR", "2020.SR", "2290.SR", "1301.SR", "3030.SR", "2060.SR"],
  XLU: ["5110.SR", "2082.SR", "4200.SR"],
  XLC: ["7010.SR", "7020.SR", "7030.SR"],
  XLRE: ["4300.SR", "4020.SR"],
};

// ── ISRAEL · TA-35 ───────────────────────────────────────────────────────────
const IL = {
  XLK: ["NICE.TA", "NVMI.TA", "CAMT.TA", "ELTR.TA"],
  XLF: ["POLI.TA", "LUMI.TA", "DSCT.TA", "MZTF.TA", "FIBI.TA", "PHOE.TA", "CLIS.TA"],
  XLV: ["TEVA.TA"],
  XLY: ["FOX.TA", "SAE.TA"],
  XLP: ["STRS.TA", "OSEM.TA"],
  XLE: ["NWMD.TA", "DLEKG.TA"],
  XLI: ["ESLT.TA", "ORA.TA", "SHOM.TA"],
  XLB: ["ICL.TA"],
  XLC: ["BEZQ.TA"],
  XLRE: ["AZRG.TA", "MLSR.TA", "BIG.TA", "AMOT.TA"],
};

// ── SÜDAFRIKA · JSE Top 40 ───────────────────────────────────────────────────
const ZA = {
  XLK: ["PRX.JO", "NPN.JO", "KRO.JO"],
  XLF: ["FSR.JO", "SBK.JO", "ABG.JO", "NED.JO", "CPI.JO", "SLM.JO", "DSY.JO", "OMU.JO", "INL.JO"],
  XLV: ["APN.JO", "NTC.JO", "LHC.JO"],
  XLY: ["SHP.JO", "TFG.JO", "MRP.JO", "CLS.JO", "TRU.JO"],
  XLP: ["BTI.JO", "AVI.JO", "TBS.JO"],
  XLE: ["SOL.JO"],
  XLI: ["BVT.JO", "BAW.JO"],
  XLB: ["AGL.JO", "BHG.JO", "AMS.JO", "IMP.JO", "SSW.JO", "GFI.JO", "ANG.JO", "HAR.JO", "EXX.JO"],
  XLC: ["MTN.JO", "VOD.JO"],
  XLRE: ["GRT.JO", "RDF.JO", "HYP.JO"],
};

// ── TÜRKEI · BIST 30 ─────────────────────────────────────────────────────────
const TR = {
  XLK: ["ASELS.IS", "LOGO.IS"],
  XLF: ["AKBNK.IS", "GARAN.IS", "ISCTR.IS", "YKBNK.IS", "VAKBN.IS", "HALKB.IS", "TSKB.IS"],
  XLV: ["ECILC.IS"],
  XLY: ["FROTO.IS", "TOASO.IS", "ARCLK.IS", "BIMAS.IS", "MGROS.IS", "TTRAK.IS"],
  XLP: ["ULKER.IS", "CCOLA.IS", "AEFES.IS"],
  XLE: ["TUPRS.IS", "PETKM.IS"],
  XLI: ["THYAO.IS", "PGSUS.IS", "ENKAI.IS", "OYAKC.IS"],
  XLB: ["EREGL.IS", "KRDMD.IS", "SISE.IS", "KOZAL.IS", "HEKTS.IS"],
  XLU: ["AKSEN.IS", "ZOREN.IS"],
  XLC: ["TCELL.IS", "TTKOM.IS"],
};

// ── VEREINIGTE ARABISCHE EMIRATE ─────────────────────────────────────────────
// Kein Sektorblock: Yahoo-Symbole für ADX und DFM sind uneinheitlich und ich
// kann sie nicht sicher belegen. Der Markt bleibt Ebene 1 (ETF), ohne Drill.

// ── LÄNDERREGISTER ───────────────────────────────────────────────────────────
// etf     — der ETF, unter dem das Land im Länder-RRG läuft (Ebene 1)
// bench   — lokaler Leitindex, gegen den die Sektoren gemessen werden (Ebene 2/3)
// coverage: "full" = Indexmitgliedschaft weitgehend vollständig
//           "core" = liquide Schwergewichte, kein kompletter Index
export const MARKETS = {
  EWG:  { code: "GER", name: "Deutschland",    nameEn: "Germany",        bench: "^GDAXI",     benchLabel: "DAX 40",      coverage: "full", sectors: DE },
  EWQ:  { code: "FRA", name: "Frankreich",     nameEn: "France",         bench: "^FCHI",      benchLabel: "CAC 40",      coverage: "full", sectors: FR },
  EWU:  { code: "UK",  name: "Großbritannien", nameEn: "United Kingdom", bench: "^FTSE",      benchLabel: "FTSE 100",    coverage: "full", sectors: UK },
  EWL:  { code: "SUI", name: "Schweiz",        nameEn: "Switzerland",    bench: "^SSMI",      benchLabel: "SMI",         coverage: "full", sectors: CH },
  EWN:  { code: "NED", name: "Niederlande",    nameEn: "Netherlands",    bench: "^AEX",       benchLabel: "AEX",         coverage: "full", sectors: NL },
  EWI:  { code: "ITA", name: "Italien",        nameEn: "Italy",          bench: "FTSEMIB.MI", benchLabel: "FTSE MIB",    coverage: "full", sectors: IT },
  EWP:  { code: "ESP", name: "Spanien",        nameEn: "Spain",          bench: "^IBEX",      benchLabel: "IBEX 35",     coverage: "full", sectors: ES },
  INDA: { code: "IND", name: "Indien",         nameEn: "India",          bench: "^NSEI",      benchLabel: "NIFTY 50",    coverage: "full", sectors: IN },
  EWJ:  { code: "JPN", name: "Japan",          nameEn: "Japan",          bench: "^N225",      benchLabel: "Nikkei 225",  coverage: "core", sectors: JP },
  EWC:  { code: "CAN", name: "Kanada",         nameEn: "Canada",         bench: "^GSPTSE",    benchLabel: "S&P/TSX",     coverage: "full", sectors: CA },
  EWA:  { code: "AUS", name: "Australien",     nameEn: "Australia",      bench: "^AXJO",      benchLabel: "ASX 200",     coverage: "core", sectors: AU },

  EWD:  { code: "SWE", name: "Schweden",       nameEn: "Sweden",         bench: "^OMX",       benchLabel: "OMXS30",      coverage: "core", sectors: SE },
  NORW: { code: "NOR", name: "Norwegen",       nameEn: "Norway",         bench: "^OSEAX",     benchLabel: "OSEAX",       coverage: "core", sectors: NO },
  EWK:  { code: "BEL", name: "Belgien",        nameEn: "Belgium",        bench: "^BFX",       benchLabel: "BEL 20",      coverage: "core", sectors: BE },
  EIRL: { code: "IRL", name: "Irland",         nameEn: "Ireland",        bench: "^ISEQ",      benchLabel: "ISEQ 20",     coverage: "core", sectors: IE },
  EPOL: { code: "POL", name: "Polen",          nameEn: "Poland",         bench: "WIG20.WA",   benchLabel: "WIG20",       coverage: "core", sectors: PL },
  MCHI: { code: "CHN", name: "China",          nameEn: "China",          bench: "^HSCE",      benchLabel: "HSCEI",       coverage: "core", sectors: CN },
  EWH:  { code: "HK",  name: "Hongkong",       nameEn: "Hong Kong",      bench: "^HSI",       benchLabel: "Hang Seng",   coverage: "core", sectors: HK },
  EWY:  { code: "KOR", name: "Südkorea",       nameEn: "South Korea",    bench: "^KS11",      benchLabel: "KOSPI",       coverage: "core", sectors: KR },
  EWT:  { code: "TWN", name: "Taiwan",         nameEn: "Taiwan",         bench: "^TWII",      benchLabel: "TAIEX",       coverage: "core", sectors: TW },
  EWS:  { code: "SGP", name: "Singapur",       nameEn: "Singapore",      bench: "^STI",       benchLabel: "STI",         coverage: "core", sectors: SG },
  EIDO: { code: "IDN", name: "Indonesien",     nameEn: "Indonesia",      bench: "^JKSE",      benchLabel: "IDX Comp.",   coverage: "core", sectors: ID },
  THD:  { code: "THA", name: "Thailand",       nameEn: "Thailand",       bench: "^SET.BK",    benchLabel: "SET",         coverage: "core", sectors: TH },
  EWM:  { code: "MYS", name: "Malaysia",       nameEn: "Malaysia",       bench: "^KLSE",      benchLabel: "KLCI",        coverage: "core", sectors: MY },
  EWZ:  { code: "BRA", name: "Brasilien",      nameEn: "Brazil",         bench: "^BVSP",      benchLabel: "Ibovespa",    coverage: "core", sectors: BR },
  EWW:  { code: "MEX", name: "Mexiko",         nameEn: "Mexico",         bench: "^MXX",       benchLabel: "IPC",         coverage: "core", sectors: MX },
  KSA:  { code: "SAU", name: "Saudi-Arabien",  nameEn: "Saudi Arabia",   bench: "^TASI.SR",   benchLabel: "TASI",        coverage: "core", sectors: SA },
  EIS:  { code: "ISR", name: "Israel",         nameEn: "Israel",         bench: "^TA125.TA",  benchLabel: "TA-125",      coverage: "core", sectors: IL },
  EZA:  { code: "ZAF", name: "Südafrika",      nameEn: "South Africa",   bench: "^J203.JO",   benchLabel: "JSE All Share", coverage: "core", sectors: ZA },
  TUR:  { code: "TUR", name: "Türkei",         nameEn: "Turkey",         bench: "XU100.IS",   benchLabel: "BIST 100",    coverage: "core", sectors: TR },
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
