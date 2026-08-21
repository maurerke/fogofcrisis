export interface GroupStats {
  n: number;
  mean: number;
  median: number;
  sd: number;
  ci95: [number, number];
  values: number[];
}

interface StatBoxProps {
  label: string;
  stats: GroupStats | null | undefined;
  unit?: string;
  decimals?: number;
}

export function StatBox({ label, stats, unit = "", decimals = 2 }: StatBoxProps) {
  const fmt = (v: number) => v.toFixed(decimals) + (unit ? ` ${unit}` : "");

  if (!stats || stats.n === 0) {
    return (
      <div className="rounded border border-surface-200 bg-surface-50 p-3">
        <div className="text-xs font-semibold text-surface-700">{label}</div>
        <div className="mt-1 text-xs text-surface-400">Keine Daten (n=0)</div>
      </div>
    );
  }

  return (
    <div className="rounded border border-surface-200 bg-surface-0 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-surface-700">{label}</span>
        <span className="text-xs text-surface-400">n={stats.n}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-surface-500">Mittel:</span>{" "}
          <span className="font-mono font-medium text-surface-900">{fmt(stats.mean)}</span>
        </div>
        <div>
          <span className="text-surface-500">Median:</span>{" "}
          <span className="font-mono font-medium text-surface-900">{fmt(stats.median)}</span>
        </div>
        <div>
          <span className="text-surface-500">SD:</span>{" "}
          <span className="font-mono font-medium text-surface-900">{fmt(stats.sd)}</span>
        </div>
        <div>
          <span className="text-surface-500">95%-CI:</span>{" "}
          <span className="font-mono font-medium text-surface-900">
            [{stats.ci95[0].toFixed(decimals)}, {stats.ci95[1].toFixed(decimals)}]
          </span>
        </div>
      </div>
    </div>
  );
}
