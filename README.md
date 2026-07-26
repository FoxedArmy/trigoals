# TriGoals

Trainingsziel-Plattform für Triathlon, Rad und Laufsport. Plane Einheiten, gleiche sie mit
den tatsächlich absolvierten Workouts ab und verfolge Fitness, Ermüdung und Form.

## Schnellstart

```bash
npm install
```

```bash
npm run dev
```

Läuft dann auf http://localhost:3000. Beim ersten Start wird automatisch eine lokale
Datenbank unter `.data/pglite` angelegt und migriert — es ist **keine externe Datenbank
nötig**, um zu entwickeln.

Einmalig noch ein Session-Schlüssel in `.env` (siehe `.env.example`):

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Den Wert als `NUXT_SESSION_PASSWORD` eintragen.

## Kommandos

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build |
| `npm test` | Unit-Tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript prüfen |
| `npm run db:generate` | Migration aus Schema-Änderungen erzeugen |
| `npm run db:migrate` | Migrationen auf `DATABASE_URL` anwenden |

## Architektur

```
app/
  components/charts/   ECharts-Komponenten (Performance, Volumen, Zonen)
  composables/         useVizTheme — liest die Chart-Palette aus CSS-Variablen
  pages/               Landing, Auth, Dashboard, Plan, Aktivitäten, Wettkämpfe, Profil
  assets/css/main.css  Design-Tokens inkl. geprüfter Visualisierungs-Palette
server/
  api/                 REST-Endpunkte (Nitro)
  database/schema.ts   Drizzle-Schema + Migrationen
  utils/               DB-Verbindung, Matching, Datei-Parser, Lastberechnung
shared/
  utils/               Reine Domänenlogik — Zonen, Trainingslast, Matching, Datum
  constants/sports.ts  Sportarten-Metadaten und Farbzuordnung
  data/templates.ts    Eingebaute Plan-Vorlagen
test/                  Unit-Tests der Domänenlogik
```

Die Rechenkerne in `shared/utils/` sind bewusst frei von Framework-Imports: sie laufen im
Browser, im Server und in den Tests identisch.

### Trainingslast

Wir verwenden neutrale Bezeichnungen statt der TrainingPeaks-Marken TSS/CTL/ATL/TSB:

| Begriff | Bedeutung |
|---|---|
| **Last** | Belastung einer Einheit; eine Stunde an der Schwelle = 100 Punkte |
| **Fitness** | exponentiell geglättete Tageslast über 42 Tage |
| **Ermüdung** | dasselbe über 7 Tage |
| **Form** | Fitness − Ermüdung |

Die Last wird aus dem verlässlichsten verfügbaren Signal abgeleitet: Leistung → Pace →
Herzfrequenz → Dauer als Rückfall (`server/utils/activityLoad.ts`).

### Datenbank

`server/utils/db.ts` wählt den Treiber automatisch:

- `DATABASE_URL` gesetzt → **Neon** (Produktion)
- nicht gesetzt → **PGlite** (nur Entwicklung, im Produktions-Build nicht enthalten)

Nach Schema-Änderungen:

```bash
npm run db:generate
```

## Deployment (Vercel)

1. Neon-Projekt anlegen, Connection-String kopieren.
2. In Vercel als Environment-Variablen setzen:
   - `DATABASE_URL` — Neon-Connection-String
   - `NUXT_SESSION_PASSWORD` — mind. 32 Zeichen
3. Migrationen einmalig gegen die Produktions-Datenbank laufen lassen:

```bash
npm run db:migrate
```

Nuxt erkennt Vercel automatisch, ein zusätzlicher Preset-Eintrag ist nicht nötig.

## Strava

Die App funktioniert vollständig ohne Strava — über manuelle Erfassung und Import von
`.fit`, `.gpx` und `.tcx`. Die direkte Anbindung ist vorbereitet
(`strava_connections`-Tabelle, Runtime-Config, Einstellungsseite), aber bewusst noch nicht
aktiv, weil sie eine freigegebene Strava-API-Anwendung voraussetzt.

Beim Aktivieren zu beachten:

- Strava-Daten dürfen **nur dem authentifizierten Athleten** gezeigt werden — kein
  Zusammenführen über Nutzer hinweg, kein KI-Training darauf.
- Brand Guidelines sind Pflicht: „Powered by Strava"-Hinweis und „View on Strava"-Link je
  Aktivität.
- Rate Limits (Standard 200 Requests/15 min, 2.000/Tag) → Webhooks statt Polling; Tokens
  laufen alle 6 Stunden ab und müssen erneuert werden.
- Mit `NUXT_PUBLIC_STRAVA_ENABLED=true` zeigt die Einstellungsseite den Verbinden-Button.

## Visualisierung

Die Chart-Palette in `app/assets/css/main.css` ist gegen Farbfehlsichtigkeit und
Kontrastanforderungen geprüft — je Modus eigene Farbstufen, nicht invertiert. Sportarten
sind fest an eine Farbe gebunden, damit eine Farbe überall dieselbe Disziplin bedeutet.
Zonen nutzen einen einfarbigen ordinalen Verlauf statt eines Regenbogens; Zonennummer und
Name stehen immer daneben, sodass nichts allein von der Farbe abhängt.
