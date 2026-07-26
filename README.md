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

## Admin-Bereich

Die Strava-Anbindung ist ein Betreiber-Feature und hinter einem Passwort versteckt. Sie
wird über `users.is_admin` freigegeben — ein Flag, das man sich nur mit dem Admin-Passwort
selbst setzen kann:

1. `NUXT_ADMIN_UNLOCK_PASSWORD` setzen (mind. 12 Zeichen, sonst bleibt das Gate zu).
2. Als eingeloggter Nutzer `/settings/strava` aufrufen und das Passwort eingeben.
3. Danach erscheint der Menüpunkt „Strava" dauerhaft für dieses Konto.

Die Seite ist absichtlich nicht verlinkt, solange man kein Admin ist. Entscheidend ist
aber, dass die **Server-Endpunkte selbst** prüfen: `requireAdmin` liest bei jedem Aufruf
die Datenbank und antwortet für alle anderen mit `404` — ein entzogenes Flag wirkt damit
sofort, und ein ausgeblendeter Link ist nie die einzige Absicherung.

Weitere Härtung: Der Vergleich läuft timing-sicher über SHA-256-Digests, und nach fünf
Fehlversuchen pro Konto sperrt ein 15-Minuten-Fenster. Der Zähler liegt im
Arbeitsspeicher, überlebt also keinen Neustart — deshalb sollte das Passwort lang und
zufällig sein statt merkbar.

## Strava

Die App funktioniert vollständig ohne Strava — über manuelle Erfassung und Import von
`.fit`, `.gpx` und `.tcx`. Die direkte Anbindung ist implementiert und admin-geschützt.

**Einrichtung:**

1. Unter <https://www.strava.com/settings/api> eine API-Anwendung anlegen
   (Callback-Domain: `localhost` für die Entwicklung, sonst dein Host).
2. `NUXT_STRAVA_CLIENT_ID` und `NUXT_STRAVA_CLIENT_SECRET` setzen.
3. `NUXT_TOKEN_ENCRYPTION_KEY` setzen (mind. 32 Zeichen) — ohne diesen Schlüssel werden
   keine Tokens gespeichert.
4. Im Admin-Bereich auf „Mit Strava verbinden", danach „Jetzt synchronisieren".

**Wie es funktioniert:**

- OAuth mit Scope `read,activity:read_all` — Letzteres erfasst auch als privat markierte
  Einheiten, was ein Trainingstagebuch erst vollständig macht.
- Der `state`-Parameter liegt in einem eigenen kurzlebigen Cookie und wird beim Callback
  gelesen *und gelöscht*, ist also einmalig verwendbar (CSRF-Schutz).
- Tokens werden mit AES-256-GCM verschlüsselt gespeichert; ein Datenbank-Dump allein gibt
  keinen Strava-Zugriff her. Manipulierte Werte scheitern laut statt still.
- Access-Tokens laufen nach 6 Stunden ab und werden bei Bedarf automatisch erneuert.
- Der Sync setzt beim letzten Lauf an (mit einem Tag Überlappung für spät hochgeladene
  Einheiten) und überspringt bereits vorhandene Aktivitäten anhand der Strava-ID — er ist
  also beliebig oft wiederholbar.
- Trennen widerruft den Zugriff auch bei Strava. Bereits importierte Aktivitäten bleiben —
  das ist deine Trainingshistorie.

**Auflagen von Strava, die du einhalten musst:**

- Strava-Daten dürfen **nur dem authentifizierten Athleten** gezeigt werden — kein
  Zusammenführen über Nutzer hinweg, kein KI-Training darauf.
- Brand Guidelines: der „Powered by Strava"-Hinweis ist auf der Verbindungsseite gesetzt;
  bei einer öffentlichen Aktivitätsansicht kommt ein „View on Strava"-Link pro Aktivität
  hinzu.
- Rate Limits (Standard 200 Requests/15 min, 2.000/Tag). Der Sync holt daher maximal 10
  Seiten pro Lauf. Für echten Live-Betrieb sind Webhooks statt Polling vorgesehen —
  `NUXT_STRAVA_WEBHOOK_VERIFY_TOKEN` ist dafür schon vorgesehen, der Endpunkt fehlt noch
  (er braucht eine öffentlich erreichbare URL).

## Visualisierung

Die Chart-Palette in `app/assets/css/main.css` ist gegen Farbfehlsichtigkeit und
Kontrastanforderungen geprüft — je Modus eigene Farbstufen, nicht invertiert. Sportarten
sind fest an eine Farbe gebunden, damit eine Farbe überall dieselbe Disziplin bedeutet.
Zonen nutzen einen einfarbigen ordinalen Verlauf statt eines Regenbogens; Zonennummer und
Name stehen immer daneben, sodass nichts allein von der Farbe abhängt.
