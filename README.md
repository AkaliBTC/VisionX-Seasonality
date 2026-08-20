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
