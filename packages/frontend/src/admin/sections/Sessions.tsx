import { useState } from "react";
import { Trash2, ExternalLink, Search } from "lucide-react";
import { useAdminFetch, adminFetch } from "../hooks/useAdminFetch";
import type { AdminContext } from "../AdminApp";

interface SessionRow {
  session_id: string;
  participant_id: string;
  group_assignment: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  engine_state: string;
  current_phase_index: number;
  flagged_reason: string | null;
}

interface SessionsResponse {
  sessions: SessionRow[];
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-ok-100 text-ok-700",
  active: "bg-brand-100 text-brand-700",
  paused: "bg-warn-100 text-warn-700",
  abandoned: "bg-surface-100 text-surface-500",
  abandoned_revoked: "bg-surface-100 text-surface-500",
  abandoned_underage: "bg-surface-100 text-surface-500",
  flagged: "bg-crit-100 text-crit-700",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Abgeschlossen",
  active: "Aktiv",
  paused: "Pausiert",
  abandoned: "Abgebrochen",
  abandoned_revoked: "Widerrufen",
  abandoned_underage: "Minderjährig",
  flagged: "Geflaggt",
};

function fmt(dt: string | null): string {
  if (!dt) return "–";
  const d = new Date(dt + (dt.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DeleteButton({
  sessionId,
  apiKey,
  onDone,
}: {
  sessionId: string;
  apiKey: string;
  onDone: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function doDelete() {
    setLoading(true);
    await adminFetch(`/api/admin/sessions/${sessionId}`, apiKey, { method: "DELETE" });
    setLoading(false);
    setConfirm(false);
    onDone();
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        title="Session löschen"
        className="inline-flex items-center gap-1 rounded border border-crit-200 bg-crit-50 px-2 py-0.5 text-xs text-crit-700 hover:bg-crit-100"
      >
        <Trash2 size={11} /> Löschen
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-crit-600 font-medium">Wirklich löschen?</span>
      <button
        onClick={doDelete}
        disabled={loading}
        className="rounded bg-crit-600 px-2 py-0.5 text-xs text-white hover:bg-crit-700 disabled:opacity-50"
      >
        {loading ? "…" : "Ja"}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="text-surface-400 hover:text-surface-600"
      >
        Nein
      </button>
    </span>
  );
}

export function Sessions({
  apiKey,
  groupFilter,
  onDrilldown,
  refreshKey,
}: AdminContext & { refreshKey: number }) {
  const { data, loading, error, refetch } = useAdminFetch<SessionsResponse>(
    `/api/admin/sessions?_r=${refreshKey}`,
    apiKey
  );
  const [search, setSearch] = useState("");

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade Sessions…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const filtered = data.sessions.filter((s) => {
    if (groupFilter !== "all" && s.group_assignment !== groupFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        s.session_id.toLowerCase().includes(q) ||
        s.participant_id.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-bold text-surface-900">Sessions</h2>
        <span className="text-xs text-surface-400">
          {filtered.length} von {data.sessions.length} Sessions
        </span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-md border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs focus-within:border-brand-400">
        <Search size={12} className="text-surface-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Session-ID, Teilnehmer-ID oder Status suchen…"
          className="flex-1 bg-transparent outline-none text-xs text-surface-700 placeholder:text-surface-400"
        />
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center text-sm text-surface-400">Keine Sessions gefunden.</div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-surface-200">
          <table className="w-full min-w-[700px] text-xs">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left text-[11px] font-semibold text-surface-500 uppercase tracking-wide">
                <th className="px-3 py-2">Session-ID</th>
                <th className="px-3 py-2">Teilnehmer-ID</th>
                <th className="px-3 py-2">Gruppe</th>
                <th className="px-3 py-2">Gestartet</th>
                <th className="px-3 py-2">Beendet</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Phase</th>
                <th className="px-3 py-2">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filtered.map((s) => (
                <tr
                  key={s.session_id}
                  className="bg-surface-0 hover:bg-surface-50 transition-colors"
                >
                  <td className="px-3 py-2">
                    <span
                      className="font-mono text-[10px] text-surface-500 cursor-pointer hover:text-brand-600"
                      title={s.session_id}
                      onClick={() => navigator.clipboard?.writeText(s.session_id)}
                    >
                      {s.session_id.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="font-mono text-[10px] text-surface-500 cursor-pointer hover:text-brand-600"
                      title={s.participant_id}
                      onClick={() => navigator.clipboard?.writeText(s.participant_id)}
                    >
                      {s.participant_id.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        s.group_assignment === "A"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-ok-100 text-ok-700"
                      }`}
                    >
                      {s.group_assignment}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-surface-600">
                    {fmt(s.started_at)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-surface-600">
                    {fmt(s.completed_at)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        STATUS_STYLES[s.status] ?? "bg-surface-100 text-surface-500"
                      }`}
                      title={s.flagged_reason ?? undefined}
                    >
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                    {s.flagged_reason && (
                      <span className="ml-1 text-[10px] text-surface-400" title={s.flagged_reason}>
                        ({s.flagged_reason.slice(0, 20)}{s.flagged_reason.length > 20 ? "…" : ""})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-surface-500">
                    {s.engine_state} / P{s.current_phase_index}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onDrilldown(s.session_id)}
                        className="inline-flex items-center gap-1 rounded border border-surface-200 bg-surface-0 px-2 py-0.5 text-xs text-surface-600 hover:bg-surface-100"
                      >
                        <ExternalLink size={11} /> Details
                      </button>
                      <DeleteButton
                        sessionId={s.session_id}
                        apiKey={apiKey}
                        onDone={refetch}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
