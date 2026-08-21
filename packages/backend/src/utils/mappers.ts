import type { DecisionRecord } from "@cyber-crisis/shared";

/**
 * Maps a raw database row from the 'decisions' table to the DecisionRecord interface.
 */
export function mapDecisionRowToRecord(row: any): DecisionRecord {
  return {
    sessionId: row.session_id,
    phaseId: row.phase_id,
    decisionId: row.decision_id,
    selectedOptionIds: JSON.parse(row.selected_option_ids || "[]"),
    decisionTimeMs: row.decision_time_ms,
    phaseElapsedMs: row.phase_elapsed_ms,
    timestamp: row.timestamp,
    timedOut: row.timed_out === 1,
    revisedDecision: row.revised_decision === 1,
    eventsSeenCount: row.events_seen_count,
    mediaItemsSeenCount: row.media_items_seen_count,
  };
}
