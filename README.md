# Fog of Crisis — Serious-Game

---

## Forschungskontext

Dieses Repository enthält den vollständigen Code des browserbasierten Serious Games
**„Fog of Crisis"** (öffentlicher Name; interner Arbeitstitel war zunächst „CyberCrisis"), das im Rahmen der
Masterarbeit *„Desinformation und Entscheidungsqualität in Cyber-Krisen: Eine experimentelle
Studie mittels eines browserbasierten Serious Games"* entwickelt und für die Datenerhebung
produktiv betrieben wurde (https://fogofcrisis.de).

Die Studie untersucht, wie sich ein simulierter Desinformationsdruck (Smartphone-Medienfeed mit
eingebetteten Falschmeldungen) auf die Qualität und Geschwindigkeit von Entscheidungen sowie die
subjektiv empfundene kognitive Beanspruchung (NASA-TLX) in einer simulierten Cyber-Incident-
Response-Lage auswirkt. Methodisch handelt es sich um ein randomisiertes Between-Subject-
Experiment mit einem Ransomware-Szenario („Angriff auf ein fiktives Stadtwerk", 5 Phasen).

**Status der Datenerhebung:** Die Erhebung wurde am **20.07.2026** abgeschlossen. Das Spiel bleibt
unter https://fogofcrisis.de weiter online, es findet aber keine aktive Rekrutierung oder
Datenerhebung mehr statt. Der in diesem Repository enthaltene Code entspricht exakt dem Stand, mit
dem die Studiendaten erhoben wurden.

Aus methodischen Gründen (Vermeidung von Priming-/Selektionseffekten bei Studienteilnehmenden)
wurden die Begriffe „Desinformation" und „Medienfeed" in Rekrutierungs- und Teilnehmerkommunikation
bewusst vermieden. Im Code und in dieser Dokumentation werden sie hingegen offen verwendet.

## Architektur

TypeScript-Monorepo (npm Workspaces) mit drei Packages:

```
.
├── packages/
│   ├── frontend/       React + Vite + Tailwind 4 + Radix/shadcn-Primitives
│   ├── backend/        Express + Socket.IO + node:sqlite (Studiendaten-Persistenz) + pdfkit
│   └── shared/         Gemeinsame TypeScript-Typen (Scenario, Session, Decision, …)
├── scenarios/          Szenario-JSON-Dateien (Ransomware-Stadtwerke, 5 Phasen + Addendum)
└── data/               SQLite-Datenbank zur Laufzeit (gitignored, enthält Studiendaten)
```

Die Echtzeitkommunikation zwischen Frontend und Backend (Phasentimer, eingehende Ereignisse,
Medienfeed-Items, Entscheidungsübermittlung) läuft über Socket.IO. Persistiert wird über
`node:sqlite` (Node.js eingebautes, synchrones SQLite-Modul), siehe
`packages/backend/src/db/schema.sql` für das Datenmodell.

## Szenario und experimentelles Design

Das Szenario simuliert einen Ransomware-Vorfall bei einem fiktiven Stadtwerk über 5 Phasen
(`scenarios/ransomware_stadtwerke.json`, Addendum für Phase F wird automatisch nachgeladen). Phase 1
ist bewusst eindeutig gehalten (Kalibrierung), echte Zielkonflikte treten in den Phasen 2–5 auf.

| Gruppe | Unterschied |
|---|---|
| A (Kontrollgruppe) | Nur Incident-Events, kein Smartphone-Feed |
| B (Experimentalgruppe) | Incident-Events + simulierter Smartphone-Medienfeed mit eingebetteter Desinformation |

Die Gruppenzuteilung erfolgt automatisch (alternierend) beim Session-Join. Incident-Kanal,
Entscheidungsoptionen, Zeitlimits und UI sind für beide Gruppen identisch — der Medienfeed ist die
einzige systematische Differenz zwischen den Bedingungen.

## Datenschutz

Die Studie erhebt pseudonymisierte personenbezogene Daten (Demografie, Entscheidungsverhalten,
Interaktionsdaten, Fragebogenantworten). Details zu Rechtsgrundlage, erhobenen Daten,
Speicherdauer und Betroffenenrechten siehe **[PRIVACY.md](./PRIVACY.md)**.

Die produktive SQLite-Datenbank mit Studiendaten ist **nicht** Teil dieses Repositories
(`.gitignore`: `data/`, `*.sqlite`).

## Voraussetzungen

- **Node.js 20.19+ oder 22.12+** für die Entwicklung (wegen Vite 8)
- **Node.js 24+** für den Produktivbetrieb (Backend nutzt `node:sqlite`, siehe `Dockerfile`)
- npm 10+

## Installation

```bash
# Im Monorepo-Root
npm install --legacy-peer-deps
```

> Hinweis: `--legacy-peer-deps` ist nötig, weil `@vitejs/plugin-react@4.7.0` noch keine
> offizielle Peer-Dep-Deklaration für Vite 8 hat. Die Kombination funktioniert korrekt.

## Entwicklungsserver starten

```bash
# Im Monorepo-Root
npm run dev
```

Startet Backend (Port 3001) und Frontend (Vite, Port 5175) concurrent.

## Ports

| Dienst | Port |
|---|---|
| Backend (Express + Socket.IO) | 3001 |
| Frontend (Vite Dev Server) | 5175 |

## Umgebungsvariablen (Backend)

Konfiguration in `packages/backend/src/config/env.ts`, Vorlage in `.env.example`.

| Variable | Default | Beschreibung |
|---|---|---|
| `PORT` | 3001 | Backend-Port |
| `NODE_ENV` | `development` | Laufzeitmodus (`development` / `production`) |
| `SCENARIO_PATH` | `scenarios/ransomware_stadtwerke.json` | Pfad zur Szenario-Datei |
| `DB_PATH` | `data/cybercrisis.sqlite` | SQLite-Datenbankpfad |
| `ADMIN_API_KEY` | `changeme` | API-Key für Admin-Endpunkte (**vor Produktion ändern**) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS-Origin für Socket.IO (Produktion) |
| `RECONNECT_TIMEOUT_MS` | `300000` | Karenzzeit für Reconnects in Millisekunden |

## Wichtige API-Routen

| Route | Methode | Beschreibung |
|---|---|---|
| `/api/health` | GET | Health-Check |
| `/api/consent/pdf` | POST | Einverständniserklärung als PDF |
| `/api/admin/sessions` | GET | Alle Sessions (requires `x-api-key`) |
| `/api/admin/sessions/:id` | GET | Session-Detail |
| `/api/admin/sessions/:id/audit` | GET | Audit-Log einer Session |
| `/api/admin/sessions/:id/flag` | POST | Session flaggen |
| `/api/admin/sessions/:id` | DELETE | Session löschen |
| `/api/admin/stats` | GET | Aggregierte Statistiken |
| `/api/admin/export/csv` | GET | CSV-Export aller Daten |
| `/api/admin/export/zip` | GET | ZIP-Export (CSV + JSON) |

Socket.IO-Events: `join_session`, `submit_demographics`, `submit_decision`,
`submit_survey`, `submit_reflection`, `revoke_session`, `event_interaction`

## Datenbank

SQLite unter `data/cybercrisis.sqlite`.
Schema: `packages/backend/src/db/schema.sql`.

Die Datenbankdatei ist via `.gitignore` ausgeschlossen (enthält Studiendaten).

## Betrieb

Während der Datenerhebung wurde das Spiel unter https://fogofcrisis.de betrieben. Der Betrieb
erfolgt als Docker-Container: Das mitgelieferte `Dockerfile` (Multi-Stage-Build) erzeugt ein Image,
das Backend und statisch gebautes Frontend gemeinsam ausliefert. `docker-compose.yml` zeigt eine
minimale Single-Host-Konfiguration mit persistentem Volume für die SQLite-Datenbank.

Vor einem produktiven Betrieb sind mindestens `ADMIN_API_KEY` und `FRONTEND_ORIGIN` zu setzen
(siehe `.env.example`). Das Backend prüft diese Werte beim Start und verweigert im
Produktionsmodus den Start mit dem Default-Key.

## Lizenz

Dieser Quellcode steht unter der **PolyForm Noncommercial License 1.0.0** (siehe
[LICENSE.md](./LICENSE.md)). Nutzung, Weitergabe und Bearbeitung sind für nicht-kommerzielle
Zwecke gestattet, ausdrücklich auch für Forschung, Lehre und Studium. Eine kommerzielle Nutzung
ist nur mit gesonderter Zustimmung des Autors zulässig.

Copyright (c) 2026 Kevin Maurer
