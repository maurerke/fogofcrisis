import { useState } from "react";
import { Search, ExternalLink, MessageSquare } from "lucide-react";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { KpiCard } from "../components/KpiCard";
import type { AdminContext } from "../AdminApp";

interface FreeTextEntry {
  sessionId: string;
  group: "A" | "B";
  status: string;
  completedAt: string | null;
  text: string;
}

interface MediaInfluenceEntry extends FreeTextEntry {
  mediaInfluence: string | null;
}

interface RoleFieldEntry {
  sessionId: string;
  group: "A" | "B";
  status: string;
  role: string;
  fieldOfStudy: string;
}

interface FreeTextData {
  reflections: FreeTextEntry[];
  influenceFactors: FreeTextEntry[];
  mediaInfluenceDetail: MediaInfluenceEntry[];
  rolesAndFields: RoleFieldEntry[];
  counts: {
    reflections: number;
    influenceFactors: number;
    mediaInfluenceDetail: number;
    rolesAndFields: number;
  };
}

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

function GroupBadge({ group }: { group: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${group === "A" ? "bg-brand-100 text-brand-700" : "bg-ok-100 text-ok-700"}`}>
      Gruppe {group}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
      status === "completed" ? "bg-ok-100 text-ok-700" : "bg-surface-100 text-surface-500"
    }`}>
      {status}
    </span>
  );
}

function SessionLink({ sessionId, onDrilldown }: { sessionId: string; onDrilldown: (id: string) => void }) {
  return (
    <button
      onClick={() => onDrilldown(sessionId)}
      className="inline-flex items-center gap-1 font-mono text-[10px] text-surface-500 hover:text-brand-600 hover:underline"
      title={sessionId}
    >
      <ExternalLink size={10} /> {sessionId.slice(0, 8)}…
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="py-6 text-center text-xs text-surface-400">{label}</div>;
}

export function FreeText({ apiKey, groupFilter, onDrilldown, refreshKey }: AdminContext & { refreshKey: number }) {
  const { data, loading, error } = useAdminFetch<FreeTextData>(
    `/api/admin/dashboard/freetext?_r=${refreshKey}`,
    apiKey
  );
  const [search, setSearch] = useState("");

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade Freitexte…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const q = search.trim().toLowerCase();

  const matchesGroup = (group: string) => groupFilter === "all" || groupFilter === group;
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q);

  const reflections = data.reflections.filter((e) => matchesGroup(e.group) && matchesSearch(e.text));
  const influenceFactors = data.influenceFactors.filter((e) => matchesGroup(e.group) && matchesSearch(e.text));
  const mediaInfluenceDetail = data.mediaInfluenceDetail.filter((e) => matchesGroup(e.group) && matchesSearch(e.text));
  const rolesAndFields = data.rolesAndFields.filter(
    (e) => matchesGroup(e.group) && (!q || e.role.toLowerCase().includes(q) || e.fieldOfStudy.toLowerCase().includes(q))
  );

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">8 — Freitext & Feedback</h2>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-md border border-surface-200 bg-surface-50 px-3 py-1.5 text-xs focus-within:border-brand-400">
        <Search size={12} className="text-surface-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Freitexte, Rolle oder Studienrichtung durchsuchen…"
          className="flex-1 bg-transparent outline-none text-xs text-surface-700 placeholder:text-surface-400"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Reflexionen" value={reflections.length} />
        <KpiCard label="Einflussfaktoren" value={influenceFactors.length} />
        <KpiCard label="Medienfeed-Einfluss (B)" value={mediaInfluenceDetail.length} />
        <KpiCard label="Rollen & Studienrichtungen" value={rolesAndFields.length} />
      </div>

      {/* Reflections */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
          <MessageSquare size={14} className="text-brand-500" />
          Abschluss-Reflexion ({reflections.length})
        </h3>
        {reflections.length === 0 ? (
          <EmptyState label="Noch keine Einträge." />
        ) : (
          <div className="space-y-2">
            {reflections.map((e) => (
              <div key={e.sessionId} className="rounded border border-surface-100 bg-surface-50 p-3 text-xs">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <SessionLink sessionId={e.sessionId} onDrilldown={onDrilldown} />
                  <GroupBadge group={e.group} />
                  <StatusBadge status={e.status} />
                  <span className="text-surface-400">{fmt(e.completedAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-surface-800">{e.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Influence factors */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
          <MessageSquare size={14} className="text-brand-500" />
          Einflussfaktoren auf Entscheidungen ({influenceFactors.length})
        </h3>
        {influenceFactors.length === 0 ? (
          <EmptyState label="Noch keine Einträge." />
        ) : (
          <div className="space-y-2">
            {influenceFactors.map((e) => (
              <div key={e.sessionId} className="rounded border border-surface-100 bg-surface-50 p-3 text-xs">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <SessionLink sessionId={e.sessionId} onDrilldown={onDrilldown} />
                  <GroupBadge group={e.group} />
                  <StatusBadge status={e.status} />
                  <span className="text-surface-400">{fmt(e.completedAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-surface-800">{e.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Media influence detail (Group B) */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
          <MessageSquare size={14} className="text-ok-500" />
          Medienfeed-Einfluss, Detail (Gruppe B) ({mediaInfluenceDetail.length})
        </h3>
        {mediaInfluenceDetail.length === 0 ? (
          <EmptyState label="Noch keine Einträge." />
        ) : (
          <div className="space-y-2">
            {mediaInfluenceDetail.map((e) => (
              <div key={e.sessionId} className="rounded border border-surface-100 bg-surface-50 p-3 text-xs">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <SessionLink sessionId={e.sessionId} onDrilldown={onDrilldown} />
                  <GroupBadge group={e.group} />
                  <StatusBadge status={e.status} />
                  <span className="text-surface-400">{fmt(e.completedAt)}</span>
                  {e.mediaInfluence && (
                    <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium text-surface-600">
                      media_influence: {e.mediaInfluence}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-surface-800">{e.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Roles and fields of study */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-800">
          <MessageSquare size={14} className="text-surface-500" />
          Berufsrollen & Studienrichtungen ({rolesAndFields.length})
        </h3>
        {rolesAndFields.length === 0 ? (
          <EmptyState label="Noch keine Einträge." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-surface-200">
            <table className="w-full min-w-[500px] text-xs">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left text-[11px] font-semibold text-surface-500 uppercase tracking-wide">
                  <th className="px-3 py-2">Rolle</th>
                  <th className="px-3 py-2">Studienrichtung</th>
                  <th className="px-3 py-2">Gruppe</th>
                  <th className="px-3 py-2">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rolesAndFields.map((e) => (
                  <tr key={e.sessionId} className="bg-surface-0 hover:bg-surface-50 transition-colors">
                    <td className="px-3 py-2 text-surface-800">{e.role || "–"}</td>
                    <td className="px-3 py-2 text-surface-800">{e.fieldOfStudy || "–"}</td>
                    <td className="px-3 py-2"><GroupBadge group={e.group} /></td>
                    <td className="px-3 py-2"><SessionLink sessionId={e.sessionId} onDrilldown={onDrilldown} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
