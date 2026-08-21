import { Card, CardTitle, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";
import { useGame } from "../../context/GameContext";
import StadtwerkeLogo from "./StadtwerkeLogo";
import {
  Droplets,
  Server,
  AlertOctagon,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

type Trend = "up" | "down" | "steady";
type Severity = "ok" | "warn" | "crit" | "info";

interface Kpi {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  severity: Severity;
  trend?: Trend;
}

/**
 * SituationDashboard: Linke Spalte mit KPIs und kurzer Lageuebersicht.
 * - Nur Faktenlage, keine Bewertung -> unterstuetzt Sense-Making (Klein 2006).
 * - Identisch fuer Gruppe A und B (Methoden-Guardrail).
 */
export default function SituationDashboard() {
  const { state } = useGame();

  // Phase-abhaengige Lageparameter (Platzhalter solange Backend keine Lagewerte liefert).
  // Diese Werte werden in Phase F durch echte Scenario-State-Felder ersetzt.
  const phaseIdx = state.currentPhaseIndex;

  // Phase-dependent KPI values — deterministic for experimental control.
  // Each phase escalates the situation narratively.
  const PHASE_KPIS = [
    // Phase 1: Erstmeldung — Beginn, wenige Hosts betroffen
    { hoursLeft: 36, infectedHosts: 12, totalHosts: 312, staffAvailable: 8, staffTotal: 10 },
    // Phase 2: Eskalation — OT betroffen, Wasserreserve sinkt
    { hoursLeft: 24, infectedHosts: 48, totalHosts: 312, staffAvailable: 7, staffTotal: 10 },
    // Phase 3: Kommunikation — Lage stabilisiert sich nicht
    { hoursLeft: 18, infectedHosts: 84, totalHosts: 312, staffAvailable: 6, staffTotal: 10 },
    // Phase 4: Lösegeldforderung — kritische Phase
    { hoursLeft: 12, infectedHosts: 126, totalHosts: 312, staffAvailable: 5, staffTotal: 10 },
    // Phase 5: Recovery — Zeitdruck bei Wasserversorgung
    { hoursLeft: 6, infectedHosts: 126, totalHosts: 312, staffAvailable: 5, staffTotal: 10 },
  ];

  const kpiData = PHASE_KPIS[phaseIdx] ?? PHASE_KPIS[0];
  const { hoursLeft, infectedHosts, totalHosts } = kpiData;

  const kpis: Kpi[] = [
    {
      id: "water-reserve",
      icon: Droplets,
      label: "Wasserreserve",
      value: `${Math.floor(hoursLeft)} h ${Math.floor(((hoursLeft % 1) * 60) || 0)
        .toString()
        .padStart(2, "0")} min`,
      sublabel: "bis Versorgungsengpass",
      severity: hoursLeft < 12 ? "crit" : hoursLeft < 24 ? "warn" : "ok",
      trend: "down",
    },
    {
      id: "hosts",
      icon: Server,
      label: "Infizierte Hosts",
      value: `${infectedHosts} / ${totalHosts}`,
      sublabel: "SCADA-Netz",
      severity: infectedHosts > 50 ? "crit" : infectedHosts > 20 ? "warn" : "ok",
      trend: "up",
    },
    {
      id: "ir-stage",
      icon: ShieldAlert,
      label: "IR-Phase",
      value:
        phaseIdx === 0
          ? "Detection"
          : phaseIdx === 1
            ? "Analysis"
            : phaseIdx === 2
              ? "Containment"
              : phaseIdx === 3
                ? "Eradication"
                : "Recovery",
      sublabel: "NIST SP 800-61",
      severity: "info",
    },
    {
      id: "staff",
      icon: Users,
      label: "Personal verfuegbar",
      value: `${kpiData.staffAvailable} / ${kpiData.staffTotal}`,
      sublabel: "IT + OT Krisenstab",
      severity: kpiData.staffAvailable <= 5 ? "warn" : "info",
    },
  ];

  return (
    <Card
      className="flex h-full flex-col overflow-hidden border-brand-500/10"
      aria-label="Lage-Dashboard"
      data-tutorial="situation-dashboard"
    >
      {/* Branded header: logo area + status row */}
      <div className="flex-shrink-0 overflow-hidden rounded-t-[var(--radius-md)]">
        {/* Logo band */}
        <div className="bg-[#eaf3fb] border-b border-[#cde3f3] px-4 pt-3 pb-2.5">
          <StadtwerkeLogo className="w-44" />
        </div>
        {/* Status row */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-surface-100)] bg-[var(--color-surface-50)] px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-crit-500 animate-pulse" />
            <CardTitle>Echtzeit-Lagebild</CardTitle>
          </div>
          <span className="rounded bg-crit-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-crit-600 border border-crit-100">
            Live
          </span>
        </div>
      </div>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scrollbar-thin p-4">
        <div className="flex flex-col gap-2">
          {kpis.map((kpi) => (
            <KpiRow key={kpi.id} kpi={kpi} />
          ))}
        </div>

        <div className="mt-2 rounded-[var(--radius-md)] border border-brand-100 bg-brand-50/50 p-4">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-brand-600">
            Aktueller Fokus
          </div>
          <p className="text-sm leading-relaxed font-medium text-slate-700">
            {state.currentPhase?.title || "Warte auf Lageupdate..."}
          </p>
        </div>

        <InfoCard />
      </CardContent>
    </Card>
  );
}

function KpiRow({ kpi }: { kpi: Kpi }) {
  const Icon = kpi.icon;
  const tone =
    kpi.severity === "crit"
      ? "text-crit-600"
      : kpi.severity === "warn"
        ? "text-warn-600"
        : kpi.severity === "ok"
          ? "text-ok-600"
          : "text-brand-600";

  const bgColor =
    kpi.severity === "crit"
      ? "bg-crit-50/30 border-crit-100"
      : kpi.severity === "warn"
        ? "bg-warn-50/30 border-warn-100"
        : "bg-slate-50 border-slate-100";

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-[var(--radius-md)] border p-3.5 transition-all hover:shadow-sm",
        bgColor,
      )}
      role="group"
      aria-label={`${kpi.label}: ${kpi.value}`}
    >
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm border border-inherit shrink-0", tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          {kpi.label}
        </div>
        <div
          className={cn(
            "mt-0.5 font-mono text-xl font-bold tabular-nums leading-none",
            tone,
          )}
        >
          {kpi.value}
        </div>
      </div>
      {kpi.trend && (
        <div className={cn("text-xs font-bold", tone)}>
          {kpi.trend === "up" ? "▲" : kpi.trend === "down" ? "▼" : "—"}
        </div>
      )}
    </div>
  );
}

function InfoCard() {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-surface-200)] bg-[var(--color-surface-0)] p-3">
      <div className="mb-1 flex items-center gap-2">
        <AlertOctagon
          className="h-3.5 w-3.5 text-[var(--color-brand-600)]"
          aria-hidden
        />
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-surface-600)]">
          Orientierung
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--color-surface-600)]">
        Bewertet die Lage, priorisiert eingehende Meldungen und trefft
        Entscheidungen unter Zeitdruck. Quellenkritik ist Teil der Aufgabe.
      </p>
    </div>
  );
}
