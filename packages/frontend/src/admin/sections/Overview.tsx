import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { KpiCard } from "../components/KpiCard";
import type { AdminContext } from "../AdminApp";

interface OverviewData {
  totals: { all: number; completed: number; groupA: number; groupB: number; completionRate: number };
  byStatus: Record<string, number>;
  byGroupStatus: Record<string, Record<string, number>>;
  funnel: { state: string; reached: number }[];
  dropoutByPhase: { phaseIndex: number; abandoned: number }[];
  recruitmentTimeline: { date: string; started: number; completed: number }[];
  balance: { groupA: number; groupB: number; delta: number };
  duration: {
    groupA: { n: number; meanSec: number; medianSec: number; sd: number } | null;
    groupB: { n: number; meanSec: number; medianSec: number; sd: number } | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  abandoned: "#f97316",
  abandoned_revoked: "#ef4444",
  abandoned_underage: "#fb923c",
  flagged: "#eab308",
  active: "#6366f1",
  paused: "#94a3b8",
};

const fmtSec = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

export function Overview({ apiKey, refreshKey }: AdminContext & { refreshKey: number }) {
  const { data, loading, error } = useAdminFetch<OverviewData>(
    `/api/admin/dashboard/overview?_r=${refreshKey}`,
    apiKey
  );

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade Überblicksdaten…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const { totals, byStatus, funnel, dropoutByPhase, recruitmentTimeline, balance, duration } = data;

  const pieData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

  const funnelData = funnel.map((f, i, arr) => ({
    state: f.state,
    reached: f.reached,
    dropPct: i > 0 && arr[i - 1].reached > 0
      ? Math.round((1 - f.reached / arr[i - 1].reached) * 100)
      : 0,
  }));

  const TARGET_N = 60;

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">1 — Überblick & Rekrutierung</h2>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Gesamt" value={totals.all} />
        <KpiCard
          label="Abgeschlossen"
          value={totals.completed}
          sub={`${(totals.completionRate * 100).toFixed(0)} %`}
          highlight
        />
        <KpiCard
          label="Gruppe A"
          value={totals.groupA}
          sub="Kontrolle"
        />
        <KpiCard
          label="Gruppe B"
          value={totals.groupB}
          sub="Medienfeed"
        />
        <KpiCard
          label="Gruppenbalance"
          value={balance.delta === 0 ? "✓ Ausgeglichen" : `|Δ|=${balance.delta}`}
          warn={balance.delta > 2}
        />
        <KpiCard
          label="Ziel-N"
          value={`${totals.completed} / ${TARGET_N}`}
          sub={`${Math.round((totals.completed / TARGET_N) * 100)} % erreicht`}
        />
      </div>

      {/* Duration */}
      {(duration.groupA || duration.groupB) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["groupA", "groupB"] as const).map((g) => {
            const d = duration[g];
            if (!d) return null;
            return (
              <div key={g} className="rounded-lg border border-surface-200 bg-surface-0 p-4">
                <div className="text-xs font-semibold text-surface-500 mb-2">
                  Ø Dauer — {g === "groupA" ? "Gruppe A" : "Gruppe B"} (n={d.n})
                </div>
                <div className="text-lg font-bold text-surface-900">{fmtSec(d.meanSec)}</div>
                <div className="text-xs text-surface-400">Median: {fmtSec(d.medianSec)} · SD: {fmtSec(d.sd)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-4 text-sm font-semibold text-surface-800">Drop-off-Funnel (Engine States)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 30 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="state" type="category" tick={{ fontSize: 10 }} width={95} />
              <Tooltip
                formatter={(val, _name, props) => [
                  `${val} Sessions`,
                  `${props.payload.dropPct > 0 ? `(−${props.payload.dropPct}% vs. vorh. Stufe)` : ""}`,
                ]}
              />
              <Bar dataKey="reached" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie */}
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-4 text-sm font-semibold text-surface-800">Sessions nach Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recruitment Timeline */}
        {recruitmentTimeline.length > 0 && (
          <div className="rounded-lg border border-surface-200 bg-surface-0 p-4 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-surface-800">
              Rekrutierungsverlauf (kumuliert)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={(() => {
                  let cumStarts = 0;
                  let cumCompleted = 0;
                  return recruitmentTimeline.map((d) => {
                    cumStarts += d.started;
                    cumCompleted += d.completed;
                    return { date: d.date, Starts: cumStarts, Abschlüsse: cumCompleted };
                  });
                })()}
                margin={{ left: 0, right: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Starts" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Abschlüsse" stroke="#10b981" strokeWidth={2} dot={false} />
                {/* Reference line for target */}
                <Line
                  type="monotone"
                  dataKey={() => TARGET_N}
                  stroke="#f97316"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  name={`Ziel N=${TARGET_N}`}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Dropout by Phase */}
        {dropoutByPhase.some((d) => d.abandoned > 0) && (
          <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
            <h3 className="mb-4 text-sm font-semibold text-surface-800">Abbrüche nach Phase</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dropoutByPhase} margin={{ left: 0, right: 10 }}>
                <XAxis dataKey="phaseIndex" tickFormatter={(v) => `Phase ${v + 1}`} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} Abbrüche`]} labelFormatter={(l) => `Phase ${Number(l) + 1}`} />
                <Bar dataKey="abandoned" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
