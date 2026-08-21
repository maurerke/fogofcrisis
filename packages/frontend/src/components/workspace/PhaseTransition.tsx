import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { ShieldAlert } from "lucide-react";

interface PhaseTransitionProps {
  phaseIndex: number;
  phaseTitle: string;
  totalPhases: number;
  onComplete: () => void;
}

const TRANSITION_DURATION_MS = 3000;

/**
 * PhaseTransition: Brief interstitial screen between scenario phases.
 * - 3-second display to orient the participant
 * - Prevents disorientation from abrupt phase switches
 * - Consistent with Serious Game pacing principles (Plass et al., 2015)
 */
export default function PhaseTransition({
  phaseIndex,
  phaseTitle,
  totalPhases,
  onComplete,
}: PhaseTransitionProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, TRANSITION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-slate-950/95 backdrop-blur-sm transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      role="status"
      aria-live="assertive"
      aria-label={`Phase ${phaseIndex + 1} von ${totalPhases}: ${phaseTitle}`}
    >
      <div className="text-center relative">
        {/* Glow effect in background */}
        <div className="absolute -inset-24 bg-brand-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/10 border border-brand-500/20 shadow-glow">
            <ShieldAlert
              className="h-10 w-10 text-brand-400"
              aria-hidden
            />
          </div>
          
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.4em] text-brand-500/70">
            Phase {phaseIndex + 1} von {totalPhases}
          </p>
          <h2 className="text-4xl font-black tracking-tight text-white mb-8">
            {phaseTitle}
          </h2>
          
          <div className="mx-auto h-1.5 w-64 overflow-hidden rounded-full bg-white/5 border border-white/5">
            <div
              className="h-full rounded-full bg-brand-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]"
              style={{
                animation: `phaseTransitionProgress ${TRANSITION_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes phaseTransitionProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
