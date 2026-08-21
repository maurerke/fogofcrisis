import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  Cell, ReferenceLine,
} from "recharts";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { StatBox, type GroupStats } from "../components/StatBox";
import { CaveatBanner } from "../components/CaveatBanner";
import type { AdminContext } from "../AdminApp";

interface PhaseEntry {
  phaseId: string;
  title: string;
  weight: number;
  A: { dqsBinaryMean: number | null; n: number };
  B: { dqsBinaryMean: number | null; n: number };
}

interface OptionEntry {
  id: string;
  label: string;
  isOptimal: boolean;
  A: number;
  B: number;
}

interface PhaseDistEntry {
  phaseId: string;
  decisionId: string;
  optimalOptionIds: string[];
  options: OptionEntry[];
}

interface DQSData {
  sessionDqs: {
    binary: { A: GroupStats; B: GroupStats };
    partial: { A: GroupStats; B: GroupStats };
  };
  cohensD: { binary: number | null; partial: number | null };
  perPhase: (PhaseEntry | null)[];
  answerDistribution: PhaseDistEntry[];
}

function CohensBadge({ d, label }: { d: number | null; label: string }) {
  if (d === null) return <span className="text-xs text-surface-400">Cohen's d {label}: n.v.</span>;
  const abs = Math.abs(d);
  const size = abs >= 0.8 ? "groß" : abs >= 0.5 ? "mittel" : abs >= 0.2 ? "klein" : "vernachl.";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-surface-50 px-2 py-0.5 text-xs font-mono text-surface-700">
      Cohen's d {label}: {d.toFixed(2)} ({size}) — explorativ
    </span>
  );
}

export function DecisionQuality({ apiKey, groupFilter, refreshKey }: AdminContext & { refreshKey: number }) {
  const { data, loading, error } = useAdminFetch<DQSData>(
    `/api/admin/dashboard/decision-quality?_r=${refreshKey}`,
    apiKey
  );

  const [mode, setMode] = useState<"binary" | "partial">("binary");

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade DQS-Daten…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const { sessionDqs, cohensD, perPhase, answerDistribution } = data;
  const dqsA = sessionDqs[mode].A;
  const dqsB = sessionDqs[mode].B;
  const totalN = dqsA.n + dqsB.n;

  const showA = groupFilter !== "B";
  const showB = groupFilter !== "A";

  // Per-phase chart data
  const phaseChartData = perPhase
    .filter((p): p is PhaseEntry => p !== null)
    .map((p) => ({
      name: p.title.replace("Phase ", "P"),
      A: p.A.dqsBinaryMean !== null ? Math.round(p.A.dqsBinaryMean * 100) : 0,
      B: p.B.dqsBinaryMean !== null ? Math.round(p.B.dqsBinaryMean * 100) : 0,
      weight: p.weight,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-surface-900">3 — RQ1: Entscheidungsqualität (DQS)</h2>
        <div className="flex gap-1 rounded-md border border-surface-200 bg-surface-50 p-1 text-xs">
          <button
            onClick={() => setMode("binary")}
            className={`rounded px-2 py-0.5 font-medium ${mode === "binary" ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-200"}`}
          >
            Binär
          </button>
          <button
            onClick={() => setMode("partial")}
            className={`rounded px-2 py-0.5 font-medium ${mode === "partial" ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-200"}`}
          >
            Partiell
          </button>
        </div>
      </div>

      <CaveatBanner n={totalN} />

      {/* Effect size badges */}
      <div className="flex flex-wrap gap-2">
        <CohensBadge d={cohensD.binary} label="(binär)" />
        <CohensBadge d={cohensD.partial} label="(partiell)" />
      </div>

      {/* DQS stats per group */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {showA && <StatBox label={`DQS-Session ${mode} — Gruppe A`} stats={dqsA} decimals={3} />}
        {showB && <StatBox label={`DQS-Session ${mode} — Gruppe B`} stats={dqsB} decimals={3} />}
      </div>

      {/* Per-phase DQS */}
      {phaseChartData.length > 0 && (
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-800">DQS pro Phase (Korrektrate in %)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={phaseChartData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {showA && <Bar dataKey="A" name="Gruppe A" fill="#6366f1" radius={[3, 3, 0, 0]} />}
              {showB && <Bar dataKey="B" name="Gruppe B" fill="#10b981" radius={[3, 3, 0, 0]} />}
              <ReferenceLine y={50} stroke="#f97316" strokeDasharray="4 4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Answer distribution per phase */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-surface-800">Antwortverteilung je Phase (Häufigkeit)</h3>
        {answerDistribution.map((phase) => {
          const chartData = phase.options.map((opt) => ({
            name: opt.label.length > 35 ? opt.label.slice(0, 33) + "…" : opt.label,
            fullLabel: opt.label,
            A: showA ? opt.A : 0,
            B: showB ? opt.B : 0,
            isOptimal: opt.isOptimal,
          }));

          return (
            <div key={phase.phaseId} className="rounded-lg border border-surface-200 bg-surface-0 p-4">
              <div className="mb-3 flex items-center gap-2">
                <h4 className="text-xs font-semibold text-surface-700">{phase.phaseId}</h4>
                <span className="text-xs text-surface-400">
                  Optimale Option(en): {phase.optimalOptionIds.join(", ")}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ left: -10, right: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    content={({ payload, label }) => (
                      <div className="rounded border border-surface-200 bg-surface-0 p-2 text-xs shadow">
                        <div className="font-medium text-surface-700 mb-1">{label}</div>
                        {payload?.map((p) => (
                          <div key={p.dataKey as string} style={{ color: p.color }}>
                            {p.name}: {p.value}
                          </div>
                        ))}
                        {payload?.[0]?.payload?.isOptimal && (
                          <div className="mt-1 text-ok-600 font-medium">✓ Optimale Option</div>
                        )}
                      </div>
                    )}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  {showA && (
                    <Bar dataKey="A" name="Gruppe A" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isOptimal ? "#6366f1" : "#a5b4fc"} />
                      ))}
                    </Bar>
                  )}
                  {showB && (
                    <Bar dataKey="B" name="Gruppe B" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isOptimal ? "#10b981" : "#6ee7b7"} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 text-xs text-surface-400">
                Dunkle Balken = optimale Option(en) ✓
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

