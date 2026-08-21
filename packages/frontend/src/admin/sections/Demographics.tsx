import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { useAdminFetch } from "../hooks/useAdminFetch";
import { CaveatBanner } from "../components/CaveatBanner";
import type { AdminContext } from "../AdminApp";

interface LikertDist {
  n: number;
  mean: number | null;
  sd: number | null;
  hist: number[];
}

interface DemographicsData {
  ageRange: { A: Record<string, number>; B: Record<string, number> };
  gender: { A: Record<string, number>; B: Record<string, number> };
  itExperienceYears: { A: Record<string, number>; B: Record<string, number> };
  education: { A: Record<string, number>; B: Record<string, number> };
  germanProficiency: { A: Record<string, number>; B: Record<string, number> };
  socialMediaUsage: { A: Record<string, number>; B: Record<string, number> };
  likert: {
    irExperience: { A: LikertDist; B: LikertDist };
    crisisCommExperience: { A: LikertDist; B: LikertDist };
    disinfoAwareness: { A: LikertDist; B: LikertDist };
  };
  roleSamples: string[];
  context: {
    inputDevice: Record<string, number>;
    topLocales: [string, number][];
    screenBuckets: [string, number][];
  };
}

function CatChart({ title, dist }: { title: string; dist: { A: Record<string, number>; B: Record<string, number> } }) {
  const keys = Array.from(new Set([...Object.keys(dist.A), ...Object.keys(dist.B)])).sort();
  const chartData = keys.map((k) => ({ name: k, A: dist.A[k] ?? 0, B: dist.B[k] ?? 0 }));

  return (
    <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-600">{title}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ left: -10, right: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={40} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="A" name="Gruppe A" fill="#6366f1" radius={[2, 2, 0, 0]} />
          <Bar dataKey="B" name="Gruppe B" fill="#10b981" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LikertRow({ label, a, b }: { label: string; a: LikertDist; b: LikertDist }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded border border-surface-100 bg-surface-50 px-3 py-2 text-xs">
      <span className="min-w-[160px] font-medium text-surface-700">{label}</span>
      <span className="text-surface-600">
        A: n={a.n}, Ø={a.mean?.toFixed(1) ?? "–"} (SD {a.sd?.toFixed(1) ?? "–"})
      </span>
      <span className="text-surface-600">
        B: n={b.n}, Ø={b.mean?.toFixed(1) ?? "–"} (SD {b.sd?.toFixed(1) ?? "–"})
      </span>
    </div>
  );
}

export function Demographics({ apiKey, refreshKey }: AdminContext & { refreshKey: number }) {
  const { data, loading, error } = useAdminFetch<DemographicsData>(
    `/api/admin/dashboard/demographics?_r=${refreshKey}`,
    apiKey
  );

  if (loading) return <div className="py-12 text-center text-sm text-surface-400">Lade Demografiedaten…</div>;
  if (error) return <div className="py-12 text-center text-sm text-crit-600">Fehler: {error}</div>;
  if (!data) return null;

  const totalN = Object.values(data.ageRange.A).reduce((a, b) => a + b, 0) +
    Object.values(data.ageRange.B).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">2 — Stichprobe & Demografie</h2>
      <CaveatBanner n={totalN} extra="Gruppenunterschiede in Kovariaten ggf. als Kontrollvariablen in die konfirmatorische Auswertung aufnehmen." />

      {/* Categorical distributions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CatChart title="Altersgruppe" dist={data.ageRange} />
        <CatChart title="Geschlecht" dist={data.gender} />
        <CatChart title="IT-Erfahrung (Jahre)" dist={data.itExperienceYears} />
        <CatChart title="Bildungsabschluss" dist={data.education} />
        <CatChart title="Deutsch-Sprachkompetenz" dist={data.germanProficiency} />
        <CatChart title="Social-Media-Nutzung" dist={data.socialMediaUsage} />
      </div>

      {/* Likert means */}
      <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
        <h3 className="mb-3 text-sm font-semibold text-surface-800">Likert-Mittelwerte A vs. B (1–5)</h3>
        <div className="space-y-2">
          <LikertRow label="IR-Erfahrung" a={data.likert.irExperience.A} b={data.likert.irExperience.B} />
          <LikertRow label="Krisenkomm.-Erfahrung" a={data.likert.crisisCommExperience.A} b={data.likert.crisisCommExperience.B} />
          <LikertRow label="Desinfo-Awareness" a={data.likert.disinfoAwareness.A} b={data.likert.disinfoAwareness.B} />
        </div>
      </div>

      {/* Context info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Eingabegerät</h3>
          {Object.entries(data.context.inputDevice).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs py-0.5">
              <span className="text-surface-600">{k}</span>
              <span className="font-mono text-surface-800">{v}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Browser-Locales (Top 5)</h3>
          {data.context.topLocales.map(([locale, count]) => (
            <div key={locale} className="flex justify-between text-xs py-0.5">
              <span className="text-surface-600">{locale}</span>
              <span className="font-mono text-surface-800">{count}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Auflösungs-Buckets</h3>
          {data.context.screenBuckets.map(([bucket, count]) => (
            <div key={bucket} className="flex justify-between text-xs py-0.5">
              <span className="text-surface-600">{bucket}</span>
              <span className="font-mono text-surface-800">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Role samples */}
      {data.roleSamples.length > 0 && (
        <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
          <h3 className="mb-2 text-sm font-semibold text-surface-800">Rollen-Freitexte (anonym, max. 50)</h3>
          <div className="flex flex-wrap gap-2">
            {data.roleSamples.map((r, i) => (
              <span key={i} className="rounded-full bg-surface-100 px-2 py-0.5 text-xs text-surface-700">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
