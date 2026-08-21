import { useState } from "react";
import { AlertTriangle, Flag, Trash2, ExternalLink } from "lucide-react";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { adminFetch } from "../hooks/useAdminFetch";
import { KpiCard } from "../components/KpiCard";
import type { AdminContext } from "../AdminApp";

interface AttentionFail {
  sessionId: string;
  group: string;
  value: number;
}

interface Speeder {
  sessionId: string;
  group: string;
  durationSec: number;
  medianSec: number;
}

interface Straightliner {
  sessionId: string;
  group: string;
  instrument: string;
  sdValue: number;
}

interface FlaggedSession {
  sessionId: string;
  group: string;
  reason: string;
}

interface ManipulationFailed {
  sessionId: string;
  selected: string;
}

interface IncompleteSurvey {
  sessionId: string;
  missing: string[];
}

interface DataQualityData {
  attentionCheckFails: AttentionFail[];
  speeders: Speeder[];
  straightliners: Straightliner[];
  flagged: FlaggedSession[];
  manipulationFailed: ManipulationFailed[];
  incompleteSurveys: IncompleteSurvey[];
  duplicatesIgnored: number;
}

function ShortId({ id }: { id: string }) {
  return <span className="font-mono text-[10px] text-surface-500">{id.slice(0, 8)}…</span>;
}

function GroupBadge({ group }: { group: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${group === "A" ? "bg-brand-100 text-brand-700" : "bg-ok-100 text-ok-700"}`}>
      {group}
    </span>
  );
}

function ActionRow({
  sessionId,
  group,
  children,
  apiKey,
  onDrilldown,
  onRefetch,
}: {
  sessionId: string;
  group: string;
  children: React.ReactNode;
  apiKey: string;
  onDrilldown: (id: string) => void;
  onRefetch: () => void;
}) {
  const [flagging, setFlagging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function doFlag() {
    if (!flagReason.trim()) return;
    setFlagging(true);
    await adminFetch(`/api/admin/sessions/${sessionId}/flag`, apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: flagReason.trim() }),
    });
    setFlagging(false);
    setFlagReason("");
    onRefetch();
  }

  async function doDelete() {
    setDeleting(true);
    await adminFetch(`/api/admin/sessions/${sessionId}`, apiKey, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    onRefetch();
  }

  return (
    <div className="rounded border border-surface-100 bg-surface-50 p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ShortId id={sessionId} />
        <GroupBadge group={group} />
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button
          onClick={() => onDrilldown(sessionId)}
          className="inline-flex items-center gap-1 rounded border border-surface-200 bg-surface-0 px-2 py-0.5 text-xs text-surface-600 hover:bg-surface-100"
        >
          <ExternalLink size={11} /> Details
        </button>
        {!flagging ? (
          <button
            onClick={() => setFlagging(true)}
            className="inline-flex items-center gap-1 rounded border border-warn-200 bg-warn-50 px-2 py-0.5 text-xs text-warn-700 hover:bg-warn-100"
          >
            <Flag size={11} /> Flaggen
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Grund…"
              className="rounded border border-surface-300 px-2 py-0.5 text-xs focus:outline-none focus:border-brand-400"
            />
            <button onClick={doFlag} className="rounded bg-warn-500 px-2 py-0.5 text-xs text-white hover:bg-warn-600">
              OK
            </button>
            <button onClick={() => setFlagging(false)} className="text-surface-400 hover:text-surface-600 text-xs">
              ✕
            </button>
          </div>
        )}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1 rounded border border-crit-200 bg-crit-50 px-2 py-0.5 text-xs text-crit-700 hover:bg-crit-100"
          >
            <Trash2 size={11} /> Löschen (DSGVO)
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-crit-600">Wirklich löschen?</span>
            <button onClick={doDelete} disabled={deleting} className="rounded bg-crit-600 px-2 py-0.5 text-xs text-white hover:bg-crit-700 disabled:opacity-50">
              {deleting ? "…" : "Ja"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-surface-400 hover:text-surface-600 text-xs">
              Nein
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DataQuality({ apiKey, onDrilldown, refreshKey }: AdminContext & { refreshKey: number }) {
  const { data, loading, error, refetch } = useAdminFetch<DataQualityData>(
    `/api/admin/dashboard/data-quality?_r=${refreshKey}`,
    apiKey
  );

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade Datenqualität…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const problems = new Set([
    ...data.attentionCheckFails.map((s) => s.sessionId),
    ...data.speeders.map((s) => s.sessionId),
    ...data.straightliners.map((s) => s.sessionId),
    ...data.flagged.map((s) => s.sessionId),
    ...data.manipulationFailed.map((s) => s.sessionId),
    ...data.incompleteSurveys.map((s) => s.sessionId),
  ]).size;

  const actionProps = { apiKey, onDrilldown, onRefetch: refetch };

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">7 — Datenqualität & Flags</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Auffällige Sessions" value={problems} warn={problems > 0} />
        <KpiCard label="Attention-Fails" value={data.attentionCheckFails.length} warn={data.attentionCheckFails.length > 0} />
        <KpiCard label="Speeders" value={data.speeders.length} warn={data.speeders.length > 0} />
        <KpiCard label="Survey-Duplikate ignoriert" value={data.duplicatesIgnored} />
      </div>

      {problems === 0 && (
        <div className="flex items-center gap-2 rounded-md border border-ok-200 bg-ok-50 px-4 py-3 text-sm text-ok-700">
          ✓ Keine Datenqualitätsprobleme gefunden.
        </div>
      )}

      {/* Attention check fails */}
      {data.attentionCheckFails.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
            <AlertTriangle size={14} className="text-warn-500" />
            Attention-Check-Fails (attention_check ≠ 3)
          </h3>
          <div className="space-y-2">
            {data.attentionCheckFails.map((s) => (
              <ActionRow key={s.sessionId} sessionId={s.sessionId} group={s.group} {...actionProps}>
                <span className="text-warn-700">Wert: {s.value} (Sollwert: 3)</span>
              </ActionRow>
            ))}
          </div>
        </section>
      )}

      {/* Speeders */}
      {data.speeders.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
            <AlertTriangle size={14} className="text-warn-500" />
            Speeders (&lt; 50 % der Median-Dauer)
          </h3>
          <div className="space-y-2">
            {data.speeders.map((s) => (
              <ActionRow key={s.sessionId} sessionId={s.sessionId} group={s.group} {...actionProps}>
                <span className="text-warn-700">Dauer: {s.durationSec}s (Median: {s.medianSec}s)</span>
              </ActionRow>
            ))}
          </div>
        </section>
      )}

      {/* Straightliners */}
      {data.straightliners.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
            <AlertTriangle size={14} className="text-warn-500" />
            Straightliner (TLX-SD ≈ 0)
          </h3>
          <div className="space-y-2">
            {data.straightliners.map((s) => (
              <ActionRow key={s.sessionId} sessionId={s.sessionId} group={s.group} {...actionProps}>
                <span className="text-warn-700">{s.instrument} SD={s.sdValue}</span>
              </ActionRow>
            ))}
          </div>
        </section>
      )}

      {/* Manipulation failed */}
      {data.manipulationFailed.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
            <AlertTriangle size={14} className="text-warn-500" />
            Manipulation-Check Fehlgeschlagen (Gruppe B)
          </h3>
          <div className="space-y-2">
            {data.manipulationFailed.map((s) => (
              <ActionRow key={s.sessionId} sessionId={s.sessionId} group="B" {...actionProps}>
                <span className="text-warn-700">Auswahl: {s.selected || "–"}</span>
              </ActionRow>
            ))}
          </div>
        </section>
      )}

      {/* Incomplete surveys */}
      {data.incompleteSurveys.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
            <AlertTriangle size={14} className="text-warn-500" />
            Unvollständige Surveys
          </h3>
          <div className="space-y-2">
            {data.incompleteSurveys.map((s) => (
              <ActionRow key={s.sessionId} sessionId={s.sessionId} group="?" {...actionProps}>
                <span className="text-warn-700">Fehlend: {s.missing.join(", ")}</span>
              </ActionRow>
            ))}
          </div>
        </section>
      )}

      {/* Flagged */}
      {data.flagged.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
            <Flag size={14} className="text-warn-500" />
            Manuell Geflaggt
          </h3>
          <div className="space-y-2">
            {data.flagged.map((s) => (
              <ActionRow key={s.sessionId} sessionId={s.sessionId} group={s.group} {...actionProps}>
                <span className="text-surface-600">{s.reason}</span>
              </ActionRow>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
