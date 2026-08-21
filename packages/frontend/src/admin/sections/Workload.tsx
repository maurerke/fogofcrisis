import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { StatBox, type GroupStats } from "../components/StatBox";
import { CaveatBanner } from "../components/CaveatBanner";
import type { AdminContext } from "../AdminApp";

interface TlxDimEntry {
  dim: string;
  A: number | null;
  B: number | null;
  A_sd: number | null;
  B_sd: number | null;
}

interface WorkloadData {
  tlxTotal: { A: GroupStats; B: GroupStats };
  tlxDimensions: TlxDimEntry[];
  infoPressure: { A: GroupStats; B: GroupStats };
  decisionConfidence: { A: GroupStats; B: GroupStats };
  cohensD: {
    tlxTotal: number | null;
    infoPressure: number | null;
    decisionConfidence: number | null;
  };
}

const DIM_LABELS: Record<string, string> = {
  mental_demand: "Mental",
  physical_demand: "Physisch",
  temporal_demand: "Zeitdruck",
  performance: "Leistung*",
  effort: "Aufwand",
  frustration: "Frustration",
};

function CohensBadge({ label, d }: { label: string; d: number | null }) {
  if (d === null) return <span className="text-xs text-surface-400">{label}: n.v.</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-surface-50 px-2 py-0.5 text-xs font-mono text-surface-700">
      d({label}): {d.toFixed(2)} — explorativ
    </span>
  );
}

export function Workload({ apiKey, groupFilter, refreshKey }: AdminContext & { refreshKey: number }) {
  const { data, loading, error } = useAdminFetch<WorkloadData>(
    `/api/admin/dashboard/workload?_r=${refreshKey}`,
    apiKey
  );

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade Belastungsdaten…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const { tlxTotal, tlxDimensions, infoPressure, decisionConfidence, cohensD } = data;
  const showA = groupFilter !== "B";
  const showB = groupFilter !== "A";
  const totalN = tlxTotal.A.n + tlxTotal.B.n;

  // Radar data
  const radarData = tlxDimensions.map((d) => ({
    dim: DIM_LABELS[d.dim] ?? d.dim,
    A: d.A ?? 0,
    B: d.B ?? 0,
  }));

  // Bar chart for dimensions
  const dimBarData = tlxDimensions.map((d) => ({
    name: DIM_LABELS[d.dim] ?? d.dim,
    A: d.A ?? 0,
    B: d.B ?? 0,
  }));

  // Custom survey items bar data
  const customData = [
    {
      name: "Info-Druck",
      A: infoPressure.A.n > 0 ? Math.round(infoPressure.A.mean * 100) / 100 : 0,
      B: infoPressure.B.n > 0 ? Math.round(infoPressure.B.mean * 100) / 100 : 0,
    },
    {
      name: "Entsch.-Konfidenz",
      A: decisionConfidence.A.n > 0 ? Math.round(decisionConfidence.A.mean * 100) / 100 : 0,
      B: decisionConfidence.B.n > 0 ? Math.round(decisionConfidence.B.mean * 100) / 100 : 0,
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">5 — RQ3: Kognitive Beanspruchung (NASA-TLX)</h2>
      <CaveatBanner n={totalN} />

      {/* Effect sizes */}
      <div className="flex flex-wrap gap-2">
        <CohensBadge label="TLX-Gesamt" d={cohensD.tlxTotal} />
        <CohensBadge label="Info-Druck" d={cohensD.infoPressure} />
        <CohensBadge label="Konfidenz" d={cohensD.decisionConfidence} />
      </div>

      {/* TLX Total stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {showA && <StatBox label="TLX-Gesamt — Gruppe A" stats={tlxTotal.A} unit="" decimals={1} />}
        {showB && <StatBox label="TLX-Gesamt — Gruppe B" stats={tlxTotal.B} unit="" decimals={1} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* TLX Radar */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">TLX-Dimensionen — Profil A vs. B</h3>
          <p className="mb-2 text-xs text-surface-400">* Leistung bereits invertiert (100 − raw)</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid />
              <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} />
              {showA && <Radar name="Gruppe A" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />}
              {showB && <Radar name="Gruppe B" dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />}
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* TLX dimension bars */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">TLX-Dimensionen Mittelwerte (0–100)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dimBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {showA && <Bar dataKey="A" name="Gruppe A" fill="#6366f1" radius={[0, 3, 3, 0]} />}
              {showB && <Bar dataKey="B" name="Gruppe B" fill="#10b981" radius={[0, 3, 3, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Custom survey items */}
      <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
        <h3 className="mb-3 text-sm font-semibold text-surface-800">
          Custom-Items: Info-Druck & Entscheidungs-Konfidenz (1–7)
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
          {showA && <StatBox label="Info-Druck — Gruppe A" stats={infoPressure.A} decimals={2} />}
          {showB && <StatBox label="Info-Druck — Gruppe B" stats={infoPressure.B} decimals={2} />}
          {showA && <StatBox label="Entsch.-Konfidenz — Gruppe A" stats={decisionConfidence.A} decimals={2} />}
          {showB && <StatBox label="Entsch.-Konfidenz — Gruppe B" stats={decisionConfidence.B} decimals={2} />}
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={customData} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 7]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            {showA && <Bar dataKey="A" name="Gruppe A" fill="#6366f1" radius={[3, 3, 0, 0]} />}
            {showB && <Bar dataKey="B" name="Gruppe B" fill="#10b981" radius={[3, 3, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
