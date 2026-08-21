import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { config } from "../config/env";
import type {
  DecisionRecord,
  EventInteraction,
  SurveyResponse,
  DemographicData,
} from "@cyber-crisis/shared";

// ========================
// SYNC DB ABSTRACTION
// Uses node:sqlite (built-in since Node 22.5 / stable in Node 24).
// DatabaseSync is a genuinely synchronous SQLite binding — it does NOT pump
// the libuv event loop during queries. This avoids the re-entrancy problem
// of the former sqlite3 + deasync approach, where deasync.sleep(5) pumped the
// event loop and caused the phase-countdown setInterval to fire re-entrantly
// (or starve), producing the visible timer freeze mid-phase.
// ========================

interface SyncDb {
  run(sql: string, ...params: unknown[]): { changes: number; lastID: number };
  get(sql: string, ...params: unknown[]): Record<string, unknown> | undefined;
  all(sql: string, ...params: unknown[]): Record<string, unknown>[];
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastID: number };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  transaction<T>(fn: () => T): T;
}

let syncDb: SyncDb;

export function initDatabase(): SyncDb {
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // node:sqlite (Node >= 22.5) is a genuinely synchronous SQLite binding. Unlike
  // the previous sqlite3 + deasync approach it does NOT pump the libuv event loop
  // while a query runs, so DB writes can no longer re-enter or starve the phase
  // countdown's setInterval. That re-entrancy was the cause of the timer freezing
  // mid-phase (e.g. Phase 2 at ~2:01, when an incoming event's audit-log write
  // coincided with a timer tick).
  const db = new DatabaseSync(config.dbPath);

  type RawChanges = { changes: number | bigint; lastInsertRowid: number | bigint };
  const toResult = (r: RawChanges) => ({
    changes: Number(r.changes),
    lastID: Number(r.lastInsertRowid),
  });

  syncDb = {
    run: (sql, ...params) => toResult(db.prepare(sql).run(...(params as any[]))),
    get: (sql, ...params) =>
      db.prepare(sql).get(...(params as any[])) as Record<string, unknown> | undefined,
    all: (sql, ...params) =>
      db.prepare(sql).all(...(params as any[])) as Record<string, unknown>[],
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        run: (...params) => toResult(stmt.run(...(params as any[]))),
        get: (...params) =>
          stmt.get(...(params as any[])) as Record<string, unknown> | undefined,
        all: (...params) =>
          stmt.all(...(params as any[])) as Record<string, unknown>[],
      };
    },
    transaction: <T>(fn: () => T): T => {
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };

  syncDb.exec("PRAGMA journal_mode = WAL");
  syncDb.exec("PRAGMA foreign_keys = ON");

  const schema = fs.readFileSync(
    path.resolve(__dirname, "schema.sql"),
    "utf-8"
  );
  syncDb.exec(schema);

  // Forward migration for DBs created before engine_state columns existed
  const columns = syncDb.all("PRAGMA table_info(sessions)") as { name: string }[];
  const colNames = new Set(columns.map((c) => c.name));
  if (!colNames.has("engine_state")) {
    syncDb.exec("ALTER TABLE sessions ADD COLUMN engine_state TEXT NOT NULL DEFAULT 'ONBOARDING'");
  }
  if (!colNames.has("current_phase_index")) {
    syncDb.exec("ALTER TABLE sessions ADD COLUMN current_phase_index INTEGER NOT NULL DEFAULT 0");
  }

  // Forward migration for DBs created before media_items_seen_count was added to decisions
  const decisionCols = syncDb.all("PRAGMA table_info(decisions)") as { name: string }[];
  const decisionColNames = new Set(decisionCols.map((c) => c.name));
  if (!decisionColNames.has("media_items_seen_count")) {
    syncDb.exec("ALTER TABLE decisions ADD COLUMN media_items_seen_count INTEGER");
  }

  console.log(`[DB] Database initialized at ${config.dbPath}`);
  return syncDb;
}

export function getDb(): SyncDb {
  if (!syncDb) throw new Error("Database not initialized. Call initDatabase() first.");
  return syncDb;
}

// ========================
// SESSION OPERATIONS
// ========================

export function createSession(
  sessionId: string,
  participantId: string,
  group: "A" | "B",
  scenarioId: string,
  scenarioVersion: string,
  userAgent: string,
  screenResolution: string
): void {
  getDb().prepare(`
    INSERT INTO sessions (session_id, participant_id, group_assignment, scenario_id, scenario_version, started_at, user_agent, screen_resolution)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)
  `).run(sessionId, participantId, group, scenarioId, scenarioVersion, userAgent, screenResolution);
}

export function getSessionByParticipant(participantId: string): Record<string, unknown> | undefined {
  return getDb().prepare("SELECT * FROM sessions WHERE participant_id = ?").get(participantId);
}

export function updateSessionStatus(sessionId: string, status: string): void {
  getDb().prepare("UPDATE sessions SET status = ? WHERE session_id = ?").run(status, sessionId);
}

/** Only abandons a session that is still active/paused — never overwrites completed/revoked/flagged. */
export function abandonSessionIfIncomplete(sessionId: string): void {
  getDb().prepare(
    "UPDATE sessions SET status = 'abandoned' WHERE session_id = ? AND status IN ('active', 'paused')"
  ).run(sessionId);
}

/** Resumes a session to active only if it is not already completed/revoked/flagged. */
export function resumeSessionIfNotComplete(sessionId: string): void {
  getDb().prepare(
    "UPDATE sessions SET status = 'active' WHERE session_id = ? AND status IN ('active', 'paused', 'abandoned')"
  ).run(sessionId);
}

export function updateEngineState(
  sessionId: string,
  engineState: string,
  phaseIndex: number
): void {
  getDb().prepare(
    "UPDATE sessions SET engine_state = ?, current_phase_index = ? WHERE session_id = ?"
  ).run(engineState, phaseIndex, sessionId);
}

export function completeSession(sessionId: string): void {
  getDb().prepare("UPDATE sessions SET status = 'completed', completed_at = datetime('now') WHERE session_id = ?").run(sessionId);
}

export function updateDemographics(sessionId: string, demographics: DemographicData): void {
  getDb().prepare("UPDATE sessions SET demographics_json = ? WHERE session_id = ?").run(
    JSON.stringify(demographics),
    sessionId
  );
}

// Permuted-block randomisation (block size 2): guarantees |n_A − n_B| ≤ 1 at any
// point in recruitment while keeping the order within each block random. Standard
// approach for small between-subject samples (cf. Suresh, 2011).
export function getNextGroupAssignment(): "A" | "B" {
  const row = getDb().prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number };
  const blockPosition = row.count % 2;
  if (blockPosition === 0) {
    return Math.random() < 0.5 ? "A" : "B";
  }
  const groupA = (getDb().prepare("SELECT COUNT(*) as count FROM sessions WHERE group_assignment = 'A'").get() as { count: number }).count;
  const groupB = row.count - groupA;
  return groupA <= groupB ? "A" : "B";
}

export function revokeSession(
  sessionId: string,
  status: "abandoned_revoked" | "abandoned_underage" = "abandoned_revoked"
): void {
  getDb().prepare(
    "UPDATE sessions SET status = ? WHERE session_id = ?"
  ).run(status, sessionId);
}

export function flagSession(sessionId: string, reason: string): void {
  getDb().prepare(
    "UPDATE sessions SET status = 'flagged', flagged_reason = ? WHERE session_id = ?"
  ).run(reason, sessionId);
}

export function getAuditLog(sessionId: string): Record<string, unknown>[] {
  return getDb().prepare(
    "SELECT * FROM audit_log WHERE session_id = ? ORDER BY id ASC"
  ).all(sessionId);
}

// ========================
// DECISION OPERATIONS
// ========================

export function insertDecision(record: DecisionRecord): void {
  getDb().prepare(`
    INSERT INTO decisions (session_id, phase_id, decision_id, selected_option_ids, decision_time_ms, phase_elapsed_ms, timestamp, timed_out, revised_decision, events_seen_count, media_items_seen_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.sessionId,
    record.phaseId,
    record.decisionId,
    JSON.stringify(record.selectedOptionIds),
    record.decisionTimeMs,
    record.phaseElapsedMs,
    record.timestamp,
    record.timedOut ? 1 : 0,
    record.revisedDecision ? 1 : 0,
    record.eventsSeenCount,
    record.mediaItemsSeenCount ?? null
  );
}

export function getDecisionsBySession(sessionId: string): Record<string, unknown>[] {
  return getDb().prepare("SELECT * FROM decisions WHERE session_id = ? ORDER BY id").all(sessionId);
}

export function getReadEventIds(sessionId: string): string[] {
  const rows = getDb().prepare("SELECT DISTINCT event_id FROM event_interactions WHERE session_id = ?").all(sessionId) as { event_id: string }[];
  return rows.map((r) => r.event_id);
}

// ========================
// EVENT INTERACTION OPERATIONS
// ========================

export function insertEventInteraction(sessionId: string, interaction: EventInteraction): void {
  getDb().prepare(`
    INSERT INTO event_interactions (session_id, event_id, event_type, first_seen_at_ms, clicked_at_ms, dwell_time_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    interaction.eventId,
    interaction.eventType,
    interaction.firstSeenAtMs,
    interaction.clickedAt ?? null,
    interaction.dwellTimeMs ?? null
  );
}

// ========================
// SURVEY OPERATIONS
// ========================

/**
 * Inserts a survey response. Duplicate submissions for the same
 * (session, instrument) — e.g. after a reload during the survey phase —
 * are ignored so each instrument is recorded exactly once ("first wins").
 * @returns true if inserted, false if a response already existed.
 */
export function insertSurveyResponse(sessionId: string, survey: SurveyResponse): boolean {
  const existing = getDb().prepare(
    "SELECT COUNT(*) as count FROM survey_responses WHERE session_id = ? AND instrument = ?"
  ).get(sessionId, survey.instrument) as { count: number };
  if (existing.count > 0) return false;

  getDb().prepare(`
    INSERT INTO survey_responses (session_id, instrument, responses_json, completed_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, survey.instrument, JSON.stringify(survey.responses), survey.completedAt);
  return true;
}

// ========================
// AUDIT LOG
// ========================

export function auditLog(sessionId: string | null, eventType: string, payload?: unknown): void {
  getDb().prepare(`
    INSERT INTO audit_log (session_id, event_type, payload_json)
    VALUES (?, ?, ?)
  `).run(sessionId, eventType, payload ? JSON.stringify(payload) : null);
}

// ========================
// ADMIN QUERIES
// ========================

export function getAllSessions(): Record<string, unknown>[] {
  return getDb().prepare("SELECT * FROM sessions ORDER BY started_at DESC").all();
}

export function getSessionDetail(sessionId: string): Record<string, unknown> | null {
  const session = getDb().prepare("SELECT * FROM sessions WHERE session_id = ?").get(sessionId);
  if (!session) return null;
  const decisions = getDecisionsBySession(sessionId);
  const events = getDb().prepare("SELECT * FROM event_interactions WHERE session_id = ?").all(sessionId);
  const surveys = getDb().prepare("SELECT * FROM survey_responses WHERE session_id = ?").all(sessionId);
  return { session, decisions, events, surveys };
}

export function deleteSession(sessionId: string): boolean {
  return getDb().transaction(() => {
    const d = getDb();
    d.prepare("DELETE FROM audit_log WHERE session_id = ?").run(sessionId);
    d.prepare("DELETE FROM survey_responses WHERE session_id = ?").run(sessionId);
    d.prepare("DELETE FROM event_interactions WHERE session_id = ?").run(sessionId);
    d.prepare("DELETE FROM decisions WHERE session_id = ?").run(sessionId);
    const result = d.prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
    return result.changes > 0;
  });
}

export function getStats(): Record<string, unknown> {
  const d = getDb();
  const total = (d.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number }).count;
  const groupA = (d.prepare("SELECT COUNT(*) as count FROM sessions WHERE group_assignment = 'A'").get() as { count: number }).count;
  const groupB = (d.prepare("SELECT COUNT(*) as count FROM sessions WHERE group_assignment = 'B'").get() as { count: number }).count;
  const completed = (d.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'completed'").get() as { count: number }).count;
  const avgDuration = d.prepare(`
    SELECT AVG(
      CAST((julianday(completed_at) - julianday(started_at)) * 86400 AS INTEGER)
    ) as avg_seconds
    FROM sessions WHERE status = 'completed' AND completed_at IS NOT NULL
  `).get() as { avg_seconds: number | null } | undefined;

  return {
    totalSessions: total,
    groupA,
    groupB,
    completed,
    completionRate: total > 0 ? (completed / total * 100).toFixed(1) + "%" : "0%",
    averageDurationSeconds: avgDuration?.avg_seconds ?? null,
  };
}

// ========================
// EXPORT HELPERS
// ========================

export function getAllDecisions(): Record<string, unknown>[] {
  return getDb().prepare(`
    SELECT d.*, s.group_assignment as group_name
    FROM decisions d
    JOIN sessions s ON d.session_id = s.session_id
    ORDER BY d.session_id, d.id
  `).all();
}

export function getAllEventInteractions(): Record<string, unknown>[] {
  return getDb().prepare(`
    SELECT ei.*, s.group_assignment as group_name
    FROM event_interactions ei
    JOIN sessions s ON ei.session_id = s.session_id
    ORDER BY ei.session_id, ei.id
  `).all();
}

export function getAllSurveyResponses(): Record<string, unknown>[] {
  return getDb().prepare(`
    SELECT sr.*, s.group_assignment as group_name
    FROM survey_responses sr
    JOIN sessions s ON sr.session_id = s.session_id
    ORDER BY sr.session_id, sr.id
  `).all();
}
