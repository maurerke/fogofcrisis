import { useGame } from "../../context/GameContext";
import { cn } from "../../lib/utils";

/**
 * IncidentBar: Operationskontext-Leiste unter der AppBar.
 */
export default function IncidentBar() {
  const { state } = useGame();
  const phase = state.currentPhase;

  return (
    <div
      className={cn(
        "flex h-8 items-center border-b border-white/[0.05]",
        "bg-[rgba(18,26,48,0.90)] backdrop-blur-sm",
      )}
    >
      {/* Op tag */}
      <div className="flex items-center gap-2.5 border-r border-white/[0.06] px-5 h-full shrink-0">
        <span className="text-[10px] font-bold tracking-[0.28em] text-brand-400/70 uppercase">
          OP
        </span>
        <span className="text-xs font-bold tracking-[0.08em] text-slate-300 uppercase">
          {state.scenarioTitle || "Fog of Crisis"}
        </span>
      </div>

      {/* Phase title */}
      {phase && (
        <div className="flex items-center gap-2.5 px-5 h-full min-w-0">
          <span className="text-[10px] font-bold tracking-[0.22em] text-slate-500 uppercase shrink-0">
            Status
          </span>
          <span
            className="text-xs text-slate-400 truncate"
            title={phase.title}
          >
            {phase.title}
          </span>
        </div>
      )}
    </div>
  );
}
