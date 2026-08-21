import { Router, Request, Response } from "express";
import AdmZip from "adm-zip";
import crypto from "crypto";
import {
  getAllSessions,
  getAllDecisions,
  getAllEventInteractions,
  getAllSurveyResponses,
  getDb,
} from "../db/database";
import {
  computeSessionDQS,
  computePhaseDQS,
  computeTlxTotal,
  safeParseJson
} from "../analysis/dqs";
import type { Scenario } from "@cyber-crisis/shared";
import { requireApiKey } from "./auth";
import { buildMcDeliveredSet } from "../analysis/aggregations";

const router = Router();

router.use(requireApiKey);

let scenarioRef: Scenario | null = null;

export function setScenarioForExport(scenario: Scenario): void {
  scenarioRef = scenario;
}

// GET /api/admin/export/json
router.get("/export/json", (_req: Request, res: Response) => {
  const data = {
    exportedAt: new Date().toISOString(),
    sessions: getAllSessions(),
    decisions: getAllDecisions(),
    eventInteractions: getAllEventInteractions(),
    surveyResponses: getAllSurveyResponses(),
  };
  res.json(data);
});

// GET /api/admin/export/csv
router.get("/export/csv", (_req: Request, res: Response) => {
  const sessions = getAllSessions();
  const decisions = getAllDecisions();
  const events = getAllEventInteractions();
  const surveys = getAllSurveyResponses();
  const auditRows = (getDb() as any).prepare("SELECT * FROM audit_log ORDER BY id ASC").all() as any[];

  // Compute DQS for each session
  const dqsMap = buildDqsMap(sessions, decisions);

  const sessionsCSV = buildSessionsCSV(sessions, dqsMap, auditRows);
  const decisionsCSV = buildDecisionsCSV(decisions);
  const decisionsLongCSV = buildDecisionsLongCSV(decisions);
  const eventsCSV = buildEventsCSV(events);
  const surveysCSV = buildSurveysCSV(surveys);
  const auditCSV = buildAuditCSV(auditRows);
  const codebookMd = buildCodebook();

  // Build ZIP with UTF-8 BOM for CSVs (Excel compat)
  const BOM = "\uFEFF";
  const zip = new AdmZip();
  zip.addFile("sessions.csv", Buffer.from(BOM + sessionsCSV, "utf8"));
  zip.addFile("decisions.csv", Buffer.from(BOM + decisionsCSV, "utf8"));
  zip.addFile("decisions_long.csv", Buffer.from(BOM + decisionsLongCSV, "utf8"));
  zip.addFile("event_interactions.csv", Buffer.from(BOM + eventsCSV, "utf8"));
  zip.addFile("survey_responses.csv", Buffer.from(BOM + surveysCSV, "utf8"));
  zip.addFile("audit_log.csv", Buffer.from(BOM + auditCSV, "utf8"));
  zip.addFile("codebook.md", Buffer.from(codebookMd, "utf8"));

  // Manifest with SHA-256 hashes
  const manifest = buildManifest({
    "sessions.csv": sessionsCSV,
    "decisions.csv": decisionsCSV,
    "decisions_long.csv": decisionsLongCSV,
    "event_interactions.csv": eventsCSV,
    "survey_responses.csv": surveysCSV,
    "audit_log.csv": auditCSV,
  });
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));

  const zipBuffer = zip.toBuffer();
  const filename = `cybercrisis_export_${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;

  res.set({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": zipBuffer.length,
  });
  res.send(zipBuffer);
});

// ========================
// DQS computation per session
// ========================

function buildDqsMap(sessions: any[], decisions: any[]): Map<string, { binary: number; partial: number }> {
  const map = new Map<string, { binary: number; partial: number }>();
  if (!scenarioRef) return map;

  for (const session of sessions) {
    const sessionDecisions = decisions.filter((d) => d.session_id === session.session_id);
    const result = computeSessionDQS(sessionDecisions, scenarioRef.expertPath);
    map.set(session.session_id, {
      binary: result.dqsSessionBinary,
      partial: result.dqsSessionPartial,
    });
  }
  return map;
}

// ========================
// CSV builders
// ========================


function buildSessionsCSV(sessions: any[], dqsMap: Map<string, any>, auditRows: any[]): string {
  const mcDelivered = buildMcDeliveredSet(auditRows);

  const header = [
    "session_id", "participant_id", "group", "scenario_id", "scenario_version",
    "started_at", "completed_at", "status",
    "age_range", "gender", "it_experience_years", "role",
    "ir_experience", "crisis_comm_experience",
    "education", "field_of_study", "german_proficiency",
    "social_media_usage", "disinfo_awareness",
    "timezone", "browser_locale", "input_device",
    "user_agent", "screen_resolution",
    "dqs_session_binary", "dqs_session_partial",
    "mc_real_item_delivered",
  ].join(",");

  const rows = sessions.map((s) => {
    const demo = s.demographics_json ? JSON.parse(s.demographics_json) : {};
    const dqs = dqsMap.get(s.session_id) || { binary: "", partial: "" };
    // Only relevant for Group B (treatment); Group A never sees mediaFeed
    const mcFlag = s.group_assignment === "B"
      ? (mcDelivered.has(s.session_id as string) ? 1 : 0)
      : "";
    return [
      s.session_id, s.participant_id, s.group_assignment,
      s.scenario_id, s.scenario_version || "",
      s.started_at, s.completed_at || "", s.status,
      demo.ageRange || "", demo.gender || "",
      demo.itExperienceYears || "", demo.role || "",
      demo.irExperience || "", demo.crisisCommExperience || "",
      demo.education || "", demo.fieldOfStudy || "",
      demo.germanProficiency || "", demo.socialMediaUsage || "",
      demo.disinfoAwareness !== undefined ? demo.disinfoAwareness : "",
      demo.timezone || "", demo.browserLocale || "", demo.inputDevice || "",
      s.user_agent || "", s.screen_resolution || "",
      dqs.binary !== "" ? dqs.binary.toFixed(4) : "",
      dqs.partial !== "" ? dqs.partial.toFixed(4) : "",
      mcFlag,
    ].map(csvEscape).join(",");
  });

  return [header, ...rows].join("\n");
}

function buildDecisionsCSV(decisions: any[]): string {
  const header = [
    "session_id", "group", "phase_id", "decision_id",
    "selected_options", "decision_time_ms", "phase_elapsed_ms",
    "timed_out", "revised", "events_seen", "media_seen",
    "dqs_binary", "dqs_partial",
  ].join(",");

  const rows = decisions.map((d) => {
    let dqsBinary = "";
    let dqsPartial = "";
    if (scenarioRef) {
      const expert = scenarioRef.expertPath.find(
        (e) => e.phaseId === d.phase_id && e.decisionId === d.decision_id
      );
      if (expert) {
        const selected: string[] = safeParseJson(d.selected_option_ids, []);
        const res = computePhaseDQS(selected, expert);
        dqsBinary = res.binary.toString();
        dqsPartial = res.partial.toFixed(4);
      }
    }
    return [
      d.session_id, d.group_name, d.phase_id, d.decision_id,
      d.selected_option_ids, d.decision_time_ms, d.phase_elapsed_ms,
      d.timed_out, d.revised_decision,
      d.events_seen_count, d.media_items_seen_count ?? "",
      dqsBinary, dqsPartial,
    ].map(csvEscape).join(",");
  });

  return [header, ...rows].join("\n");
}

function buildDecisionsLongCSV(decisions: any[]): string {
  // Long-format: one row per (session, phase, selected_option)
  const header = [
    "session_id", "group", "phase_id", "decision_id",
    "selected_option_id", "is_optimal", "decision_time_ms",
  ].join(",");

  const rows: string[] = [];
  for (const d of decisions) {
    const selected: string[] = safeParseJson(d.selected_option_ids, []);
    let optimalIds: string[] = [];
    if (scenarioRef) {
      const expert = scenarioRef.expertPath.find(
        (e) => e.phaseId === d.phase_id && e.decisionId === d.decision_id
      );
      if (expert) optimalIds = expert.optimalOptionIds;
    }
    for (const optId of selected) {
      rows.push([
        d.session_id, d.group_name, d.phase_id, d.decision_id,
        optId, optimalIds.includes(optId) ? 1 : 0, d.decision_time_ms,
      ].map(csvEscape).join(","));
    }
  }

  return [header, ...rows].join("\n");
}

function buildEventsCSV(events: any[]): string {
  const header = "session_id,group,event_id,event_type,first_seen_at_ms,clicked_at_ms,dwell_time_ms";
  const rows = events.map((e) =>
    [
      e.session_id, e.group_name, e.event_id, e.event_type,
      e.first_seen_at_ms, e.clicked_at_ms ?? "", e.dwell_time_ms ?? "",
    ].map(csvEscape).join(",")
  );
  return [header, ...rows].join("\n");
}

function buildSurveysCSV(surveys: any[]): string {
  // Long format: one row per item
  const header = "session_id,group,instrument,item_key,item_value,tlx_total";
  const rows: string[] = [];

  for (const s of surveys) {
    const responses = safeParseJson<Record<string, any>>(s.responses_json, {});

    // Compute tlx_total for NASA_TLX instrument
    let tlxTotal = "";
    if (s.instrument === "NASA_TLX") {
      const tot = computeTlxTotal(responses);
      if (tot !== null) tlxTotal = tot.toFixed(2);
    }

    for (const [key, value] of Object.entries(responses)) {
      rows.push(
        [s.session_id, s.group_name, s.instrument, key, String(value ?? ""), tlxTotal]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  return [header, ...rows].join("\n");
}

function buildAuditCSV(rows: any[]): string {
  const header = "id,session_id,event_type,payload_json,timestamp";
  const dataRows = rows.map((r) =>
    [r.id, r.session_id ?? "", r.event_type, r.payload_json ?? "", r.timestamp]
      .map(csvEscape).join(",")
  );
  return [header, ...dataRows].join("\n");
}

// ========================
// Codebook
// ========================

function buildCodebook(): string {
  return `# Fog of Crisis Study — Codebook
Generated: ${new Date().toISOString()}
Scenario: ${scenarioRef?.title || "unknown"} v${scenarioRef?.version || "?"}

---

## sessions.csv

| Spalte | Beschreibung | Skalentyp | Wertebereich |
|--------|-------------|-----------|--------------|
| session_id | UUID der Session | nominal | UUID-String |
| participant_id | Pseudonym-ID des Teilnehmenden | nominal | String |
| group | Experimentalbedingung | nominal | A = Kontrolle, B = Treatment (mit Medienfeed) |
| scenario_id | ID des gespielten Szenarios | nominal | String |
| scenario_version | Szenario-Version | nominal | Semver-String |
| started_at | Startzeitpunkt der Session | interval | ISO 8601 Datetime |
| completed_at | Endzeitpunkt (wenn abgeschlossen) | interval | ISO 8601 Datetime oder leer |
| status | Sitzungsstatus | nominal | active, paused, completed, abandoned, abandoned_revoked, abandoned_underage, flagged |
| age_range | Altersgruppe | ordinal | 18-24, 25-34, 35-44, 45-54, 55-64, 65+ |
| gender | Geschlecht | nominal | Männlich, Weiblich, Divers, Keine Angabe |
| it_experience_years | IT-Berufserfahrung in Jahren | ordinal | 0, 1-2, 3-5, 6-10, 11-20, 20+ |
| role | Berufsrolle (Freitext) | nominal | String |
| ir_experience | IR-Erfahrung (Likert 1–5) | ordinal | 1 = keine, 5 = sehr hoch |
| crisis_comm_experience | Krisenkommunikations-Erfahrung (Likert 1–5) | ordinal | 1 = keine, 5 = sehr hoch |
| education | Bildungsabschluss | ordinal | Kein … Promotion, Keine Angabe |
| field_of_study | Studien-/Ausbildungsrichtung (Freitext) | nominal | String, max. 80 Zeichen |
| german_proficiency | Deutsch-Sprachkompetenz (GER-Skala) | ordinal | A1, A2, B1, B2, C1, C2 |
| social_media_usage | Häufigkeit sozialer Mediennutzung | ordinal | daily, several_per_week, rarely, never, no_answer |
| disinfo_awareness | Vorkenntnis Desinformation (Likert 1–5) | ordinal | 1 = keine, 5 = sehr gut |
| timezone | IANA-Zeitzone des Clients | nominal | z.B. Europe/Berlin |
| browser_locale | Browser-Spracheinstellung | nominal | z.B. de-DE |
| input_device | Eingabegerät-Heuristik | nominal | mouse, touch |
| user_agent | Browser-User-Agent-String | nominal | String |
| screen_resolution | Bildschirmauflösung | nominal | WxH in Pixeln |
| dqs_session_binary | Sitzungs-DQS (binär, gewichteter Mittelwert) | interval | [0, 1] |
| dqs_session_partial | Sitzungs-DQS (partiell, gewichteter Mittelwert) | interval | [0, 1] |
| mc_real_item_delivered | Wurde das Manipulation-Check-Item (id=mc_real) an diese Session ausgeliefert? | nominal | 0 oder 1 (nur Gruppe B); leer für Gruppe A |

---

## decisions.csv

| Spalte | Beschreibung | Skalentyp | Wertebereich |
|--------|-------------|-----------|--------------|
| session_id | UUID der Session | nominal | |
| group | Experimentalbedingung | nominal | A oder B |
| phase_id | ID der Phase | nominal | |
| decision_id | ID des Entscheidungspunkts | nominal | |
| selected_options | Gewählte Options-IDs (JSON-Array) | nominal | |
| decision_time_ms | Zeit von Panelöffnung bis Submit (ms) | ratio | ≥ 0 |
| phase_elapsed_ms | Vergangene Zeit seit Phasenstart (ms) | ratio | ≥ 0 |
| timed_out | Entscheidung durch Timeout | nominal | 0 oder 1 |
| revised | Entscheidung vor Submit geändert | nominal | 0 oder 1 |
| events_seen | Anzahl gesehener Incidents | ratio | ≥ 0 |
| media_seen | Anzahl gesehener Medien (nur Gruppe B) | ratio | ≥ 0 oder leer |
| dqs_binary | Phasen-DQS (0/1: mind. eine optimale Option gewählt) | nominal | 0 oder 1 |
| dqs_partial | Phasen-DQS (Anteil optimaler Optionen) | interval | [0, 1] |

---

## decisions_long.csv

One row per (session, phase, selected_option). Ideal für Mixed-Effects-Modelle.

| Spalte | Beschreibung |
|--------|-------------|
| session_id | UUID der Session |
| group | A oder B |
| phase_id | Phasen-ID |
| decision_id | Entscheidungs-ID |
| selected_option_id | Gewählte Options-ID |
| is_optimal | 1 wenn die Option im Expert Path, 0 sonst |
| decision_time_ms | Entscheidungszeit in ms |

---

## event_interactions.csv

| Spalte | Beschreibung | Skalentyp |
|--------|-------------|-----------|
| session_id | UUID | nominal |
| group | A oder B | nominal |
| event_id | Ereignis-ID | nominal |
| event_type | incident oder media | nominal |
| first_seen_at_ms | Erste Sichtbarkeit (ms seit Phasenstart) | ratio |
| clicked_at_ms | Zeitpunkt des Detail-Klicks (ms, kann leer sein) | ratio |
| dwell_time_ms | Gesamte Verweildauer (ms) | ratio |

---

## survey_responses.csv (Long Format)

| Spalte | Beschreibung |
|--------|-------------|
| session_id | UUID |
| group | A oder B |
| instrument | NASA_TLX / custom_post / manipulation_check / debriefing_reflection |
| item_key | Item-Bezeichner |
| item_value | Antwort-Wert |
| tlx_total | TLX-Gesamtwert (nur für NASA_TLX, Performance invertiert) |

**NASA-TLX Items:** mental_demand, physical_demand, temporal_demand, performance (invertiert: 100-x), effort, frustration. Alle 0–100, Schritt 5.
**Performance-Inversion:** Beim Export wird performance bereits invertiert als (100 - raw) dargestellt. tlx_total = Durchschnitt aller 6 invertierten Werte.

**Custom-Post Items:** info_pressure (1–7), decision_confidence (1–7), attention_check (1–7, Sollwert 3), realism_perception (1–7), influence_factors (Freitext), media_influence (ja/nein/teilweise, nur Gruppe B), media_credibility_overall (1–7, nur Gruppe B).
**Manipulation-Check Items (nur Gruppe B):** manipulation_check_selected (kommagetrennte Auswahl), manipulation_check_correct (1 = real gezeigte Schlagzeile erkannt).
**Hinweis Duplikate:** Pro (session, instrument) wird nur die erste vollständige Einreichung gespeichert; erneute Einreichungen nach Reconnect werden serverseitig ignoriert (audit_log: survey_duplicate_ignored).

---

## audit_log.csv

Alle System-Events der Session. Für Replays und Integritätsprüfung.

---

## DQS-Formel

\`\`\`
DQS_Phase_binary  = w_i × I(selected ∩ optimal ≠ ∅)
DQS_Phase_partial = w_i × |selected ∩ optimal| / |optimal|
DQS_Session       = Σ DQS_Phase / Σ w_i
\`\`\`

Referenz: Bellotti et al. (2013), Mayer (2014).
`;
}

// ========================
// Manifest
// ========================

function buildManifest(files: Record<string, string>): object {
  const hashes: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    hashes[name] = crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }
  return {
    exportedAt: new Date().toISOString(),
    scenarioId: scenarioRef?.id || "unknown",
    scenarioVersion: scenarioRef?.version || "unknown",
    fileHashes: hashes,
  };
}

// ========================
// Helpers
// ========================

function csvEscape(value: any): string {
  let str = String(value ?? "");
  // Mitigate CSV/formula injection: free-text fields (role, survey answers, …)
  // could start with =, +, -, @, TAB or CR and would be executed as formulas
  // by Excel/LibreOffice. Numbers pass through unchanged (typeof check).
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default router;
