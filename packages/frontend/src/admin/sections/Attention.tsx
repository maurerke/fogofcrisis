import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { StatBox, type GroupStats } from "../components/StatBox";
import { CaveatBanner } from "../components/CaveatBanner";
import type { AdminContext } from "../AdminApp";

interface AttentionData {
  dwellByType: {
    A: { incidentMeanMs: number | null };
    B: { incidentMeanMs: number | null; mediaMeanMs: number | null; mediaShare: number };
  };
  mediaItemsSeen: { B: GroupStats };
  incidentsSeen: { A: GroupStats; B: GroupStats };
  clickRate: {
    incident: { A: number; B: number };
    media: { B: number };
  };
  realismPerception: {
    A: { mean: number | null; n: number };
    B: { mean: number | null; n: number };
  };
  mediaCredibility: { B: { mean: number | null; n: number } };
  mediaInfluenceSelfReport: { B: Record<string, number> };
  manipulationCheck: {
    B: {
      correctRate: number | null;
      mcRealDelivered: number;
      n: number;
      selectedHistogram: Record<string, number>;
    };
  };
}

const PIE_COLORS = ["#10b981", "#6366f1", "#f97316", "#94a3b8"];

function fmtMs(ms: number | null) {
  if (ms === null) return "–";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

export function Attention({ apiKey, refreshKey }: AdminContext & { refreshKey: number }) {
  const { data, loading, error } = useAdminFetch<AttentionData>(
    `/api/admin/dashboard/attention?_r=${refreshKey}`,
    apiKey
  );

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade Aufmerksamkeitsdaten…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const { dwellByType, mediaItemsSeen, incidentsSeen, clickRate, realismPerception, mediaCredibility, mediaInfluenceSelfReport, manipulationCheck } = data;
  const mc = manipulationCheck.B;
  const influencePieData = Object.entries(mediaInfluenceSelfReport.B).map(([name, value]) => ({ name, value }));
  const mcHistData = Object.entries(mc.selectedHistogram).map(([name, value]) => ({ name, value }));

  const dwellBarData = [
    {
      name: "Incident-Dwell (A)",
      ms: dwellByType.A.incidentMeanMs ?? 0,
    },
    {
      name: "Incident-Dwell (B)",
      ms: dwellByType.B.incidentMeanMs ?? 0,
    },
    {
      name: "Media-Dwell (B)",
      ms: dwellByType.B.mediaMeanMs ?? 0,
    },
  ];

  const clickRateData = [
    { name: "Incident-Klicks A", rate: Math.round(clickRate.incident.A * 1000) / 10 },
    { name: "Incident-Klicks B", rate: Math.round(clickRate.incident.B * 1000) / 10 },
    { name: "Media-Klicks B", rate: Math.round(clickRate.media.B * 1000) / 10 },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">6 — RQ4: Aufmerksamkeitsverteilung (explorativ)</h2>
      <CaveatBanner extra="RQ4 ist explorativ. Alle Aufmerksamkeitsmetriken nur als Hinweis interpretieren." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dwell time */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-2 text-sm font-semibold text-surface-800">Ø Verweildauer nach Event-Typ (ms)</h3>
          <p className="mb-3 text-xs text-surface-400">
            Media-Anteil Gruppe B: {Math.round(dwellByType.B.mediaShare * 100)} %
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={dwellBarData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtMs(v as number)} />
              <Bar dataKey="ms" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Click rates */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">Klick-Raten (%)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={clickRateData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v) => `${v} %`} />
              <Bar dataKey="rate" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Items seen */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">Gesehene Events (Incidents & Medien)</h3>
          <div className="space-y-3">
            <StatBox label="Incidents gesehen — Gruppe A" stats={incidentsSeen.A} decimals={1} />
            <StatBox label="Incidents gesehen — Gruppe B" stats={incidentsSeen.B} decimals={1} />
            <StatBox label="Medien-Items gesehen — Gruppe B" stats={mediaItemsSeen.B} decimals={1} />
          </div>
        </div>

        {/* Realism + Credibility */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">Realismus & Glaubwürdigkeit (1–7)</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between rounded bg-surface-50 px-3 py-2">
              <span className="text-surface-600">Realismus-Wahrnehmung A:</span>
              <span className="font-mono font-medium">
                {realismPerception.A.mean?.toFixed(1) ?? "–"} (n={realismPerception.A.n})
              </span>
            </div>
            <div className="flex justify-between rounded bg-surface-50 px-3 py-2">
              <span className="text-surface-600">Realismus-Wahrnehmung B:</span>
              <span className="font-mono font-medium">
                {realismPerception.B.mean?.toFixed(1) ?? "–"} (n={realismPerception.B.n})
              </span>
            </div>
            <div className="flex justify-between rounded bg-surface-50 px-3 py-2">
              <span className="text-surface-600">Medien-Glaubwürdigkeit B:</span>
              <span className="font-mono font-medium">
                {mediaCredibility.B.mean?.toFixed(1) ?? "–"} (n={mediaCredibility.B.n})
              </span>
            </div>
          </div>
        </div>

        {/* Media influence self-report */}
        {influencePieData.length > 0 && (
          <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
            <h3 className="mb-3 text-sm font-semibold text-surface-800">Selbstbericht: Hat der Medienfeed Ihre Entscheidung beeinflusst? (Gruppe B)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={influencePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {influencePieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Manipulation check */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">Manipulation-Check (Gruppe B)</h3>
          <div className="mb-3 space-y-1 text-xs">
            <div className="flex justify-between rounded bg-surface-50 px-3 py-2">
              <span className="text-surface-600">Korrekt-Quote:</span>
              <span className={`font-mono font-medium ${mc.correctRate !== null && mc.correctRate >= 0.5 ? "text-ok-700" : "text-warn-700"}`}>
                {mc.correctRate !== null ? `${(mc.correctRate * 100).toFixed(0)} %` : "–"} (n={mc.n})
              </span>
            </div>
            <div className="flex justify-between rounded bg-surface-50 px-3 py-2">
              <span className="text-surface-600">mc_real ausgeliefert:</span>
              <span className="font-mono font-medium">{mc.mcRealDelivered} / {mc.n}</span>
            </div>
          </div>
          {mcHistData.length > 0 && (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={mcHistData} margin={{ left: -10, right: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
