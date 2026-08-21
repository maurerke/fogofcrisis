import { useState, useEffect } from "react";
import { Search, Flag, Trash2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useAdminFetch, adminFetch } from "../hooks/useAdminFetch";
import type { AdminContext } from "../AdminApp";

interface SessionDetail {
  session: {
    session_id: string;
    participant_id: string;
    group_assignment: string;
    scenario_id: string;
    scenario_version: string;
    started_at: string;
    completed_at: string | null;
    status: string;
    engine_state: string;
    current_phase_index: number;
    demographics_json: string | null;
    user_agent: string | null;
    screen_resolution: string | null;
    flagged_reason: string | null;
  };
  decisions: {
    phase_id: string;
    decision_id: string;
    selected_option_ids: string;
    decision_time_ms: number;
    phase_elapsed_ms: number;
    timed_out: number;
    revised_decision: number;
    events_seen_count: number;
    media_items_seen_count: number | null;
  }[];
  surveys: {
    instrument: string;
    responses_json: string;
    completed_at: string;
  }[];
}

interface AuditEntry {
  id: number;
  event_type: string;
  payload_json: string | null;
  timestamp: string;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-40 shrink-0 text-surface-500">{label}</span>
      <span className="text-surface-800">{value}</span>
    </div>
  );
}

export function Drilldown({
  apiKey,
  refreshKey,
  initialSessionId,
}: AdminContext & { refreshKey: number; initialSessionId: string | null }) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? "");
  const [inputValue, setInputValue] = useState(initialSessionId ?? "");
  const [showAudit, setShowAudit] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      setInputValue(initialSessionId);
    }
  }, [initialSessionId]);

  const { data, loading, error, refetch } = useAdminFetch<SessionDetail>(
    sessionId ? `/api/admin/sessions/${sessionId}?_r=${refreshKey}` : "",
    apiKey
  );

  const { data: auditData } = useAdminFetch<{ events: AuditEntry[] }>(
    showAudit && sessionId ? `/api/admin/sessions/${sessionId}/audit` : "",
    apiKey
  );

  async function doFlag() {
    if (!flagReason.trim() || !sessionId) return;
    await adminFetch(`/api/admin/sessions/${sessionId}/flag`, apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: flagReason.trim() }),
    });
    setFlagReason("");
    refetch();
  }

  async function doDelete() {
    if (!sessionId) return;
    await adminFetch(`/api/admin/sessions/${sessionId}`, apiKey, { method: "DELETE" });
    setConfirmDelete(false);
    setSessionId("");
    setInputValue("");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">9 — Session-Drilldown</h2>

      {/* Session ID input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSessionId(inputValue.trim())}
            placeholder="Session-ID eingeben und Enter drücken…"
            className="w-full rounded-md border border-surface-300 bg-surface-0 py-2 pl-9 pr-3 text-sm text-surface-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          onClick={() => setSessionId(inputValue.trim())}
          className="rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Laden
        </button>
      </div>

      {!sessionId && <p className="text-sm text-surface-400">Bitte Session-ID eingeben oder aus einer anderen Sektion auswählen.</p>}
      {loading && <div className="py-8 text-center text-sm text-surface-400">Lade Session…</div>}
      {error && <div className="text-sm text-crit-600">Fehler: {error}</div>}

      {data && (
        <div className="space-y-4">
          {/* Session meta */}
          <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-surface-800">Session-Stammdaten</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                data.session.status === "completed" ? "bg-ok-100 text-ok-700" :
                data.session.status === "flagged" ? "bg-warn-100 text-warn-700" :
                "bg-surface-100 text-surface-600"
              }`}>
                {data.session.status}
              </span>
            </div>
            <div className="space-y-1.5">
              <InfoRow label="Session-ID" value={<span className="font-mono text-[11px]">{data.session.session_id}</span>} />
              <InfoRow label="Teilnehmer-ID" value={data.session.participant_id} />
              <InfoRow label="Gruppe" value={<span className={`font-bold ${data.session.group_assignment === "A" ? "text-brand-600" : "text-ok-600"}`}>Gruppe {data.session.group_assignment}</span>} />
              <InfoRow label="Szenario" value={`${data.session.scenario_id} v${data.session.scenario_version}`} />
              <InfoRow label="Beginn" value={data.session.started_at} />
              <InfoRow label="Abschluss" value={data.session.completed_at ?? "–"} />
              <InfoRow label="Engine-State" value={data.session.engine_state} />
              <InfoRow label="Phase-Index" value={data.session.current_phase_index} />
              {data.session.flagged_reason && (
                <InfoRow label="Flag-Grund" value={<span className="text-warn-700">{data.session.flagged_reason}</span>} />
              )}
              {data.session.user_agent && (
                <InfoRow label="User-Agent" value={<span className="break-all font-mono text-[10px]">{data.session.user_agent}</span>} />
              )}
              <InfoRow label="Auflösung" value={data.session.screen_resolution ?? "–"} />
            </div>
          </div>

          {/* Demographics */}
          {data.session.demographics_json && (() => {
            const demo = (() => { try { return JSON.parse(data.session.demographics_json!); } catch { return null; } })();
            if (!demo) return null;
            return (
              <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
                <h3 className="mb-3 text-sm font-semibold text-surface-800">Demografie</h3>
                <div className="space-y-1.5">
                  {Object.entries(demo as Record<string, unknown>).map(([k, v]) => (
                    <InfoRow key={k} label={k} value={String(v ?? "–")} />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Decisions */}
          {data.decisions.length > 0 && (
            <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
              <h3 className="mb-3 text-sm font-semibold text-surface-800">Entscheidungen</h3>
              <div className="space-y-3">
                {data.decisions.map((dec, i) => {
                  const selected: string[] = (() => { try { return JSON.parse(dec.selected_option_ids); } catch { return []; } })();
                  return (
                    <div key={i} className="rounded border border-surface-100 bg-surface-50 p-3 text-xs">
                      <div className="mb-1 flex items-center gap-2 font-medium text-surface-700">
                        <span>Phase {i + 1}: {dec.phase_id}</span>
                        {dec.timed_out === 1 && <span className="flex items-center gap-0.5 text-warn-600"><Clock size={11} /> Timeout</span>}
                        {dec.revised_decision === 1 && <span className="text-surface-400">↩ Revidiert</span>}
                      </div>
                      <div className="space-y-0.5">
                        <div><span className="text-surface-500">Auswahl:</span> {selected.join(", ") || "–"}</div>
                        <div><span className="text-surface-500">Zeit:</span> {(dec.decision_time_ms / 1000).toFixed(1)} s</div>
                        <div><span className="text-surface-500">Events gesehen:</span> {dec.events_seen_count}</div>
                        {dec.media_items_seen_count !== null && (
                          <div><span className="text-surface-500">Medien gesehen:</span> {dec.media_items_seen_count}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Surveys */}
          {data.surveys.length > 0 && (
            <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
              <h3 className="mb-3 text-sm font-semibold text-surface-800">Survey-Antworten</h3>
              <div className="space-y-3">
                {data.surveys.map((survey, i) => {
                  const responses: Record<string, unknown> = (() => { try { return JSON.parse(survey.responses_json); } catch { return {}; } })();
                  return (
                    <div key={i} className="rounded border border-surface-100 bg-surface-50 p-3 text-xs">
                      <div className="mb-2 font-medium text-surface-700">{survey.instrument}</div>
                      <div className="space-y-0.5">
                        {Object.entries(responses).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="w-40 shrink-0 text-surface-500">{k}:</span>
                            <span className="break-all text-surface-800">{String(v ?? "–")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audit log */}
          <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-surface-800">Audit-Timeline</h3>
              <button
                onClick={() => setShowAudit(!showAudit)}
                className="text-xs text-brand-600 hover:underline"
              >
                {showAudit ? "Ausblenden" : "Einblenden"}
              </button>
            </div>
            {showAudit && auditData && (
              <div className="max-h-80 overflow-y-auto space-y-1">
                {auditData.events.map((ev) => (
                  <div key={ev.id} className="flex gap-3 text-xs">
                    <span className="w-32 shrink-0 font-mono text-surface-400">{ev.timestamp.slice(11, 19)}</span>
                    <span className="font-medium text-surface-700">{ev.event_type}</span>
                    {ev.payload_json && (
                      <span className="truncate text-surface-400">{ev.payload_json.slice(0, 60)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
            <h3 className="mb-3 text-sm font-semibold text-surface-800">Aktionen</h3>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <input
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Flag-Grund…"
                  className="rounded border border-surface-300 px-2 py-1 text-xs focus:outline-none focus:border-brand-400"
                />
                <button
                  onClick={doFlag}
                  disabled={!flagReason.trim()}
                  className="inline-flex items-center gap-1 rounded border border-warn-300 bg-warn-50 px-3 py-1 text-xs text-warn-700 hover:bg-warn-100 disabled:opacity-50"
                >
                  <Flag size={12} /> Flaggen
                </button>
              </div>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 rounded border border-crit-300 bg-crit-50 px-3 py-1 text-xs text-crit-700 hover:bg-crit-100"
                >
                  <Trash2 size={12} /> Löschen (DSGVO)
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-crit-600 font-medium">Unwiderruflich löschen?</span>
                  <button onClick={doDelete} className="rounded bg-crit-600 px-3 py-1 text-white hover:bg-crit-700">
                    <CheckCircle size={12} className="inline mr-1" /> Ja
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-surface-400">
                    <XCircle size={12} className="inline mr-1" /> Nein
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
