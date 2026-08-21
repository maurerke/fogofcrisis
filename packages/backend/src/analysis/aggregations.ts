export const MC_REAL_ITEM_ID = "mc_real";

/** Returns the set of session IDs where the manipulation-check real item was delivered. */
export function buildMcDeliveredSet(
  auditRows: { event_type: string; payload_json?: string | null; session_id?: string | null }[]
): Set<string> {
  const delivered = new Set<string>();
  for (const row of auditRows) {
    if (
      (row.event_type === "media_sent" || row.event_type === "media_triggered_sent") &&
      row.payload_json?.includes(`"itemId":"${MC_REAL_ITEM_ID}"`) &&
      row.session_id
    ) {
      delivered.add(row.session_id);
    }
  }
  return delivered;
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function sd(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

export function ci95(values: number[]): [number, number] {
  const m = mean(values);
  const margin = values.length > 1 ? 1.96 * sd(values) / Math.sqrt(values.length) : 0;
  return [m - margin, m + margin];
}

export function cohensD(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const pooled = Math.sqrt(
    ((a.length - 1) * sd(a) ** 2 + (b.length - 1) * sd(b) ** 2) /
    (a.length + b.length - 2)
  );
  if (pooled === 0) return null;
  return (mean(b) - mean(a)) / pooled;
}

export interface GroupStats {
  n: number;
  mean: number;
  median: number;
  sd: number;
  ci95: [number, number];
  values: number[];
}

export function buildGroupStats(values: number[]): GroupStats {
  return {
    n: values.length,
    mean: mean(values),
    median: median(values),
    sd: sd(values),
    ci95: ci95(values),
    values,
  };
}
