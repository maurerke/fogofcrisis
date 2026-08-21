import { FogOfCrisisLogoMark } from "../common/FogOfCrisisLogo";
import { cn, formatClock } from "../../lib/utils";
import { useGame } from "../../context/GameContext";

/**
 * AppBar: Behoerden-/SOC-Kopfzeile mit Lagebild-Status.
 * Literatur: Alexander 2005 (funktionale Fidelitaet), Goodall 2009 (SOC-UX)
 */
export default function AppBar() {
  const { state, connected } = useGame();
  const remainingMs = state.timerSeconds * 1000;

  // Escalation level derived from phase index.
  const phaseIdx = state.currentPhaseIndex;
  const severity = phaseIdx >= 3 ? "crit" : phaseIdx >= 1 ? "warn" : "ok";

  const isTimerLow = state.timerSeconds > 0 && state.timerSeconds <= 60;
  const isTimerCritical = state.timerSeconds > 0 && state.timerSeconds <= 20;

  const sevConfig = {
    ok: {
      accent: "var(--color-ok-400)",
      accentRaw: "#34d399",
      glow: "rgba(52,211,153,0.35)",
    },
    warn: {
      accent: "var(--color-warn-400)",
      accentRaw: "#fb923c",
      glow: "rgba(251,146,60,0.35)",
    },
    crit: {
      accent: "var(--color-crit-400)",
      accentRaw: "#fb7185",
      glow: "rgba(251,113,133,0.45)",
    },
  } as const;

  const sev = sevConfig[severity];

  return (
    <>
      {/* ── Top severity accent line ── */}
      <div
        aria-hidden="true"
        style={{
          height: "2px",
          background: `linear-gradient(90deg, transparent 0%, ${sev.accentRaw} 25%, ${sev.accentRaw} 75%, transparent 100%)`,
          boxShadow: `0 0 14px 2px ${sev.glow}`,
          animation: severity === "crit" ? "severity-glow 1.8s ease-in-out infinite" : undefined,
        }}
      />

      <header
        className="z-10 flex h-16 items-center border-b relative overflow-hidden"
        style={{
          background:
            "linear-gradient(90deg, rgba(20,28,54,0.98) 0%, rgba(28,36,70,0.95) 50%, rgba(20,28,54,0.98) 100%)",
          borderBottomColor: `${sev.accentRaw}22`,
          backdropFilter: "blur(12px)",
        }}
        role="banner"
      >
        {/* Scanline texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)",
          }}
        />

        {/* ── Zone 1: Identity ── */}
        <div className="relative flex items-center gap-3.5 border-r border-white/[0.07] px-6 h-full shrink-0">
          <FogOfCrisisLogoMark size={30} />
          <div className="flex flex-col leading-none gap-1">
            <span className="text-base font-bold tracking-tight text-white">
              Fog of Crisis
            </span>
          </div>
        </div>

        {/* ── Zone 2: Center status ── */}
        <div className="relative flex flex-1 items-center justify-center gap-5">
          {/* Phase progress */}
          {state.currentPhase && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-[0.18em] text-slate-400 uppercase">
                Phase
              </span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: state.totalPhases }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-500"
                    style={
                      i < phaseIdx
                        ? { width: 16, height: 4, background: "rgba(100,116,139,0.45)", borderRadius: 2 }
                        : i === phaseIdx
                          ? { width: 22, height: 7, background: sev.accentRaw, boxShadow: `0 0 8px 1px ${sev.glow}`, borderRadius: 3 }
                          : { width: 7, height: 7, background: "rgba(51,65,85,0.9)", borderRadius: "50%" }
                    }
                  />
                ))}
              </div>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {phaseIdx + 1}
                <span className="text-slate-600"> / </span>
                {state.totalPhases}
              </span>
            </div>
          )}

        </div>

        {/* ── Zone 3: Timer + Connection ── */}
        <div className="relative flex items-center border-l border-white/[0.07] h-full shrink-0">
          {/* Timer block */}
          <div
            className={cn("flex flex-col items-center justify-center px-7 h-full border-r border-white/[0.07]")}
            style={
              isTimerCritical
                ? { background: "rgba(244,63,94,0.08)" }
                : isTimerLow
                  ? { background: "rgba(249,115,22,0.06)" }
                  : undefined
            }
          >
            <span className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase">
              Entscheidungsfrist
            </span>
            <span
              className={cn(
                "font-mono font-bold tabular-nums leading-none mt-1",
                isTimerCritical
                  ? "text-crit-400"
                  : isTimerLow
                    ? "text-warn-400"
                    : "text-white",
              )}
              style={{
                fontSize: "28px",
                letterSpacing: "0.04em",
                ...(isTimerCritical
                  ? { animation: "timer-urgent 0.8s ease-in-out infinite" }
                  : {}),
              }}
              aria-live="polite"
              aria-label="Verbleibende Zeit bis zur Entscheidung"
            >
              {formatClock(remainingMs)}
            </span>
          </div>

          {/* Connection indicator */}
          <div className="flex items-center justify-center gap-2 px-6 h-full">
            <span
              className={cn("rounded-full shrink-0", connected ? "bg-ok-400" : "bg-crit-400")}
              style={{
                width: 7,
                height: 7,
                animation: "severity-glow 1.6s ease-in-out infinite",
                boxShadow: connected
                  ? "0 0 6px 2px rgba(52,211,153,0.55)"
                  : "0 0 6px 2px rgba(251,113,133,0.55)",
              }}
              aria-hidden
            />
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-widest",
                connected ? "text-ok-400" : "text-crit-400",
              )}
              aria-live="polite"
            >
              {connected ? "Uplink aktiv" : "Getrennt"}
            </span>
          </div>
        </div>
      </header>
    </>
  );
}
