CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL UNIQUE,
    group_assignment TEXT NOT NULL CHECK(group_assignment IN ('A', 'B')),
    scenario_id TEXT NOT NULL,
    scenario_version TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'paused', 'completed', 'abandoned', 'abandoned_revoked', 'abandoned_underage', 'flagged')),
    demographics_json TEXT,
    user_agent TEXT,
    screen_resolution TEXT,
    flagged_reason TEXT,
    -- Explicit engine state persistence (avoids heuristic reconstruction on reconnect)
    engine_state TEXT NOT NULL DEFAULT 'ONBOARDING'
        CHECK(engine_state IN ('ONBOARDING','BRIEFING','TUTORIAL','PLAYING','SURVEY','DEBRIEFING','COMPLETE','PAUSED')),
    current_phase_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(session_id),
    phase_id TEXT NOT NULL,
    decision_id TEXT NOT NULL,
    selected_option_ids TEXT NOT NULL,
    decision_time_ms INTEGER NOT NULL,
    phase_elapsed_ms INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    timed_out INTEGER NOT NULL DEFAULT 0,
    revised_decision INTEGER NOT NULL DEFAULT 0,
    events_seen_count INTEGER NOT NULL DEFAULT 0,
    media_items_seen_count INTEGER
);

CREATE TABLE IF NOT EXISTS event_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(session_id),
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('incident', 'media')),
    first_seen_at_ms INTEGER NOT NULL,
    clicked_at_ms INTEGER,
    dwell_time_ms INTEGER
);

CREATE TABLE IF NOT EXISTS survey_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(session_id),
    instrument TEXT NOT NULL,
    responses_json TEXT NOT NULL,
    completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    event_type TEXT NOT NULL,
    payload_json TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON event_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_survey_session ON survey_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);
