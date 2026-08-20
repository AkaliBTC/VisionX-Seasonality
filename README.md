# VisionX Analytics

Multi-Modul-Marktanalyse: Seasonality · RRG · VIX · SPX Cycle · Fundamentals · Bottom Radar · Breadth

## Environment Variables (Vercel)

| Variable | Pflicht | Standard | Zweck |
|---|---|---|---|
| `VSX_ACCESS_TOKEN` | nein | leer | Zugangscode. **Leer = kein Gate.** Gesetzt = Zugangsschirm aktiv |
| `VSX_RATE_LIMIT` | nein | `40` | Requests pro IP und Minute |
| `VSX_TD_DAILY` | nein | `700` | Twelve-Data-Calls pro Tag |
| `VSX_CMC_DAILY` | nein | `300` | CoinMarketCap-Calls pro Tag |
| `TD_KEY` | nein | — | Twelve Data API Key (Fallback-Datenquelle) |
| `CMC_KEY` | nein | — | CoinMarketCap API Key |
| `CYCLE_TOOLS_KEY` | nein | `wttpreview` | Cycle-Engine von Lars von Thienen. Erfordert ein "Analyst"-Abo bei whentotrade. Ohne eigenen Key läuft der limitierte öffentliche Vorschau-Key |

## Schutz bei öffentlichem Link

1. `VSX_ACCESS_TOKEN` setzen → Zugangsschirm erscheint, Code einmal pro Gerät eingeben
2. Rate-Limit bremst automatisierte Zugriffe pro IP
3. Tageskontingente für TD und CMC; danach greifen automatisch die kostenlosen
   Quellen (Yahoo, Binance) statt die Kontingente zu überziehen
4. Alle Endpoints cachen am Vercel-Edge — viele Besucher erzeugen nicht viele
   Provider-Requests

Wichtig: Das Rate-Limit läuft pro Lambda-Instanz, ist also eine wirksame Bremse,
aber keine harte globale Obergrenze. Für harte Limits wäre ein zentraler Speicher
(Vercel KV / Upstash) nötig.

## Entwicklung

    npm install
    vercel dev      # nicht `npm run dev` — sonst fehlen die /api-Routen

## Zyklus-Engines

Zwei Wege stehen zur Verfügung:

**VSX Spectral** (eingebaut) — DFT-Projektion, Bartels-Phasenstabilität und ein
Surrogat-Test, dessen Vergleichsverteilung aus dem geladenen Chart selbst
erzeugt wird. Kein externer Dienst, keine Kosten, volle Kontrolle.

**cycle.tools** (optional, `/api/cycles`) — die Engine von Lars von Thienen.
Sein Verfahren ist proprietär und läuft ausschließlich serverseitig bei ihm;
er hält den Quellcode bewusst getrennt. Nachbauen ist deshalb nicht möglich,
anbinden schon. Liefert dominante Zykluslänge, Amplitude, Phase, die letzten
und die nächsten erwarteten Wendepunkte, einen lesbaren Phasenstatus sowie
einen Profitabilitäts- und Phasing-Score.

Wichtig zur Interpretation, in seinen eigenen Worten: Zyklen und Composite-
Modelle dienen **ausschließlich dem Timing** — man achtet auf Richtungswechsel.
Die Amplitude sagt nichts über Kursziele.
