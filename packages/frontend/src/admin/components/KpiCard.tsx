interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  warn?: boolean;
}

export function KpiCard({ label, value, sub, highlight, warn }: KpiCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-brand-200 bg-brand-50"
          : warn
          ? "border-warn-200 bg-warn-50"
          : "border-surface-200 bg-surface-0"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${
          highlight ? "text-brand-700" : warn ? "text-warn-700" : "text-surface-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-surface-500">{sub}</div>}
    </div>
  );
}
