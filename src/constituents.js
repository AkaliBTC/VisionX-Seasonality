// ═════════════════════════════════════════════════════════════════════════════
//  VISIONX ANALYTICS · INDEX-KONSTITUENTEN
//  S&P 500 nach GICS-Sektoren (SPDR-Zuordnung) und DAX 40 / MDAX.
//  Stand: Snapshot — Indexänderungen hier pflegen, alle Module ziehen daraus.
// ═════════════════════════════════════════════════════════════════════════════

export const SPX_BY_SECTOR = {
  XLK: [
    "AAPL","MSFT","NVDA","AVGO","ORCL","CRM","AMD","ADBE","ACN","CSCO","IBM","TXN","QCOM","NOW","INTU",
    "AMAT","MU","LRCX","ADI","KLAC","PANW","SNPS","CDNS","ANET","APH","MSI","ROP","ADSK","FTNT","NXPI",
    "MCHP","TEL","IT","GLW","HPQ","DELL","WDC","STX","HPE","KEYS","ON","TDY","TER","ZBRA","NTAP",
    "JBL","FSLR","ENPH","TYL","PTC","CDW","GDDY","AKAM","EPAM","JNPR","SWKS","MPWR","TRMB","SMCI","VRSN",
    "FICO","CTSH","GEN","QRVO","INTC","NOW",
  ],
  XLF: [
    "BRK-B","JPM","V","MA","BAC","WFC","GS","MS","SPGI","AXP","BLK","C","SCHW","CB","PGR",
    "MMC","ICE","CME","AON","USB","PNC","AJG","COF","TFC","AFL","BK","TRV","ALL","MET","PRU",
    "AMP","DFS","FIS","FI","STT","NTRS","RJF","WTW","HIG","CINF","BRO","MTB","FITB","HBAN","RF",
    "CFG","KEY","SYF","NDAQ","MCO","MSCI","CBOE","ACGL","GL","AIZ","L","PFG","IVZ","BEN","TROW",
    "WRB","EG","JKHY","ERIE",
  ],
  XLV: [
    "LLY","UNH","JNJ","ABBV","MRK","TMO","ABT","AMGN","ISRG","PFE","DHR","BMY","GILD","CVS","MDT",
    "VRTX","REGN","ZTS","BSX","SYK","CI","ELV","HCA","MCK","COR","CAH","BDX","A","EW","IQV",
    "RMD","MTD","WST","HOLX","ZBH","BAX","DXCM","IDXX","STE","CNC","MOH","VTRS","TECH","CRL","PODD",
    "GEHC","SOLV","RVTY","LH","DGX","UHS","HSIC","BIIB","INCY","ALGN",
  ],
  XLY: [
    "AMZN","TSLA","HD","MCD","BKNG","LOW","TJX","NKE","SBUX","CMG","ORLY","MAR","GM","F","DHI",
    "ROST","AZO","YUM","LEN","ABNB","HLT","RCL","CCL","NCLH","LVS","WYNN","MGM","DRI","DPZ","EBAY",
    "EXPE","GRMN","GPC","APTV","BWA","LKQ","TSCO","ULTA","POOL","NVR","PHM","TPR","RL","DECK","KMX",
    "BBY","WSM","CZR","MHK",
  ],
  XLP: [
    "PG","COST","WMT","KO","PEP","PM","MDLZ","MO","CL","TGT","KMB","GIS","STZ","SYY","KHC",
    "HSY","K","ADM","DG","DLTR","KR","CHD","MKC","CLX","SJM","CAG","CPB","HRL","TAP","TSN",
    "LW","BG","EL","MNST","KDP","KVUE",
  ],
  XLE: [
    "XOM","CVX","COP","WMB","EOG","SLB","PSX","MPC","KMI","OKE","VLO","HAL","BKR","OXY","DVN",
    "FANG","HES","TRGP","EQT","CTRA","APA",
  ],
  XLI: [
    "GE","CAT","UBER","RTX","HON","UNP","ETN","BA","DE","LMT","ADP","UPS","CSX","NOC","EMR",
    "GD","FDX","NSC","WM","ITW","PH","MMM","TT","CARR","JCI","CMI","PCAR","ROK","AME","OTIS",
    "IR","FAST","GWW","VRSK","EFX","URI","PAYX","CPRT","ODFL","LHX","TDG","AXON","HWM","DAL","UAL",
    "LUV","DOV","SWK","PNR","XYL","IEX","SNA","TXT","J","PWR","MAS","ALLE","NDSN","ROL","CHRW",
    "EXPD","JBHT","LDOS","HII","GNRC","AOS","BLDR","PAYC","CTAS","RSG","WAB",
  ],
  XLB: [
    "LIN","SHW","APD","ECL","FCX","NEM","CTVA","DD","DOW","PPG","NUE","VMC","MLM","ALB","IFF",
    "STLD","PKG","AMCR","CF","MOS","LYB","EMN","CE","IP","SW","AVY","BALL","SMG",
  ],
  XLRE: [
    "PLD","AMT","EQIX","WELL","SPG","PSA","O","CCI","DLR","VICI","EXR","AVB","IRM","SBAC","EQR",
    "INVH","MAA","ESS","ARE","KIM","UDR","HST","REG","CPT","BXP","DOC","FRT","WY","CSGP","CBRE",
  ],
  XLU: [
    "NEE","SO","DUK","CEG","SRE","AEP","D","PCG","EXC","XEL","ED","PEG","WEC","ES","AWK",
    "DTE","PPL","FE","AEE","CMS","CNP","ATO","NI","LNT","EVRG","NRG","VST","PNW","AES",
  ],
  XLC: [
    "META","GOOGL","GOOG","NFLX","DIS","CMCSA","T","VZ","TMUS","EA","WBD","OMC","TTWO","LYV","MTCH",
    "NWSA","CHTR","PARA","FOXA","IPG","NWS","FOX",
  ],
};

// Dubletten entfernen (GOOGL/GOOG, NOW etc.)
Object.keys(SPX_BY_SECTOR).forEach(k => { SPX_BY_SECTOR[k] = [...new Set(SPX_BY_SECTOR[k])]; });

export const SPX_ALL = [...new Set(Object.values(SPX_BY_SECTOR).flat())];

export const SPX_SECTOR_OF = {};
Object.entries(SPX_BY_SECTOR).forEach(([sec, arr]) => arr.forEach(t => { if (!SPX_SECTOR_OF[t]) SPX_SECTOR_OF[t] = sec; }));

// ── DAX 40 ───────────────────────────────────────────────────────────────────
export const DAX40 = [
  "ADS.DE","AIR.DE","ALV.DE","BAS.DE","BAYN.DE","BEI.DE","BMW.DE","BNR.DE","CBK.DE","CON.DE",
  "1COV.DE","DTG.DE","DBK.DE","DB1.DE","DHL.DE","DTE.DE","EOAN.DE","FRE.DE","HNR1.DE","HEI.DE",
  "HEN3.DE","IFX.DE","MBG.DE","MRK.DE","MTX.DE","MUV2.DE","P911.DE","PAH3.DE","QIA.DE","RHM.DE",
  "RWE.DE","SAP.DE","SRT3.DE","SIE.DE","ENR.DE","SHL.DE","SY1.DE","VOW3.DE","VNA.DE","ZAL.DE",
];

// ── MDAX (Auswahl der liquidesten Werte) ─────────────────────────────────────
export const MDAX = [
  "AFX.DE","AIXA.DE","BC8.DE","BOSS.DE","COK.DE","DUE.DE","EVK.DE","EVD.DE","FIE.DE","FRA.DE",
  "FPE3.DE","G1A.DE","GXI.DE","HFG.DE","HLE.DE","HOT.DE","JUN3.DE","KGX.DE","KRN.DE","LEG.DE",
  "LHA.DE","LXS.DE","NDA.DE","NEM.DE","PBB.DE","PUM.DE","RAA.DE","RRTL.DE","SAX.DE","SDF.DE",
  "SIX2.DE","SZG.DE","TEG.DE","TLX.DE","TKA.DE","UN01.DE","WCH.DE","WAF.DE",
];

// Deutsche Titel grob den SPDR-Sektoren zuordnen (für Filter)
export const DE_SECTOR_OF = {
  "SAP.DE":"XLK","IFX.DE":"XLK","SRT3.DE":"XLK","WAF.DE":"XLK","AIXA.DE":"XLK","BC8.DE":"XLK","NEM.DE":"XLK","TLX.DE":"XLK",
  "ALV.DE":"XLF","MUV2.DE":"XLF","DBK.DE":"XLF","CBK.DE":"XLF","DB1.DE":"XLF","HNR1.DE":"XLF","PBB.DE":"XLF",
  "BAYN.DE":"XLV","FRE.DE":"XLV","SHL.DE":"XLV","MRK.DE":"XLV","QIA.DE":"XLV","SRT3.DE":"XLV","AFX.DE":"XLV",
  "ADS.DE":"XLY","BMW.DE":"XLY","MBG.DE":"XLY","P911.DE":"XLY","PAH3.DE":"XLY","VOW3.DE":"XLY","CON.DE":"XLY",
  "ZAL.DE":"XLY","PUM.DE":"XLY","BOSS.DE":"XLY","HFG.DE":"XLY","RRTL.DE":"XLY","LEG.DE":"XLRE","VNA.DE":"XLRE",
  "BEI.DE":"XLP","HEN3.DE":"XLP","SY1.DE":"XLP","DUE.DE":"XLP",
  "EOAN.DE":"XLU","RWE.DE":"XLU","ENR.DE":"XLU",
  "SIE.DE":"XLI","AIR.DE":"XLI","MTX.DE":"XLI","RHM.DE":"XLI","DHL.DE":"XLI","DTG.DE":"XLI","KGX.DE":"XLI",
  "LHA.DE":"XLI","FRA.DE":"XLI","GXI.DE":"XLI","KRN.DE":"XLI","JUN3.DE":"XLI","DUE.DE":"XLI","G1A.DE":"XLI",
  "BAS.DE":"XLB","1COV.DE":"XLB","BNR.DE":"XLB","HEI.DE":"XLB","LXS.DE":"XLB","WCH.DE":"XLB","EVK.DE":"XLB",
  "SDF.DE":"XLB","SZG.DE":"XLB","TKA.DE":"XLB",
  "DTE.DE":"XLC","UN01.DE":"XLC",
};

export const DE_ALL = [...new Set([...DAX40, ...MDAX])];
