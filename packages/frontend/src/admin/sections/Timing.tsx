import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { StatBox, type GroupStats } from "../components/StatBox";
import { CaveatBanner } from "../components/CaveatBanner";
import type { AdminContext } from "../AdminApp";

interface PhaseTimingEntry {
  phaseId: string;
  title: string;
  A: GroupStats;
  B: GroupStats;
}

interface TimingData {
  decisionTime: {
    overall: { A: GroupStats; B: GroupStats };
    perPhase: PhaseTimingEntry[];
  };
  timeoutRate: { A: number; B: number };
  revisionRate: { A: number; B: number };
  cohensD: { decisionTimeOverall: number | null };
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)} %`;
}

function msToSec(ms: number) {
  return (ms / 1000).toFixed(1) + " s";
}

export function Timing({ apiKey, groupFilter, refreshKey }: AdminContext & { refreshKey: number }) {
  const { data, loading, error } = useAdminFetch<TimingData>(
    `/api/admin/dashboard/timing?_r=${refreshKey}`,
    apiKey
  );

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade Zeitdaten…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const { decisionTime, timeoutRate, revisionRate, cohensD } = data;
  const showA = groupFilter !== "B";
  const showB = groupFilter !== "A";
  const totalN = decisionTime.overall.A.n + decisionTime.overall.B.n;

  // Convert ms to seconds for display
  const toSecStats = (s: GroupStats): GroupStats => ({
    ...s,
    mean: s.mean / 1000,
    median: s.median / 1000,
    sd: s.sd / 1000,
    ci95: [s.ci95[0] / 1000, s.ci95[1] / 1000],
    values: s.values.map((v) => v / 1000),
  });

  const perPhaseData = decisionTime.perPhase.map((p) => ({
    name: p.title.replace("Phase ", "P").slice(0, 20),
    A: Math.round(p.A.mean / 1000),
    B: Math.round(p.B.mean / 1000),
  }));

  const rateData = [
    { name: "Timeout-Rate", A: Math.round(timeoutRate.A * 1000) / 10, B: Math.round(timeoutRate.B * 1000) / 10 },
    { name: "Revisions-Rate", A: Math.round(revisionRate.A * 1000) / 10, B: Math.round(revisionRate.B * 1000) / 10 },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">4 — RQ2: Entscheidungsgeschwindigkeit</h2>
      <CaveatBanner n={totalN} extra="Längere Zeit kann Überlastung oder gründlichere Abwägung bedeuten — kausale Interpretation vorsichtig." />

      {cohensD.decisionTimeOverall !== null && (
        <span className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-surface-50 px-2 py-0.5 text-xs font-mono text-surface-700">
          Cohen's d (Entscheidungszeit): {cohensD.decisionTimeOverall.toFixed(2)} — explorativ
        </span>
      )}

      {/* Overall stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {showA && <StatBox label="Entscheidungszeit (gesamt) — Gruppe A" stats={toSecStats(decisionTime.overall.A)} unit="s" decimals={1} />}
        {showB && <StatBox label="Entscheidungszeit (gesamt) — Gruppe B" stats={toSecStats(decisionTime.overall.B)} unit="s" decimals={1} />}
      </div>

      {/* Per-phase */}
      {perPhaseData.length > 0 && (
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">Ø Entscheidungszeit pro Phase (Sekunden)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={perPhaseData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" s" />
              <Tooltip formatter={(v) => `${v} s`} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {showA && <Bar dataKey="A" name="Gruppe A" fill="#6366f1" radius={[3, 3, 0, 0]} />}
              {showB && <Bar dataKey="B" name="Gruppe B" fill="#10b981" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rates */}
      <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
        <h3 className="mb-3 text-sm font-semibold text-surface-800">Timeout- und Revisions-Rate (%)</h3>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={rateData} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip formatter={(v) => `${v} %`} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {showA && <Bar dataKey="A" name="Gruppe A" fill="#6366f1" radius={[3, 3, 0, 0]} />}
            {showB && <Bar dataKey="B" name="Gruppe B" fill="#10b981" radius={[3, 3, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-surface-100 bg-surface-50 p-2">
            <span className="text-surface-500">Timeout-Rate A:</span>{" "}
            <span className="font-medium">{pct(timeoutRate.A)}</span>
            {" · "}
            <span className="text-surface-500">B:</span>{" "}
            <span className="font-medium">{pct(timeoutRate.B)}</span>
          </div>
          <div className="rounded border border-surface-100 bg-surface-50 p-2">
            <span className="text-surface-500">Revision-Rate A:</span>{" "}
            <span className="font-medium">{pct(revisionRate.A)}</span>
            {" · "}
            <span className="text-surface-500">B:</span>{" "}
            <span className="font-medium">{pct(revisionRate.B)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
