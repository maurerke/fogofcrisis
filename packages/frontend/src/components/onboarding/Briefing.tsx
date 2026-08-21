import React, { useState } from "react";
import { useGame } from "../../context/GameContext";
import { FormShell } from "../forms/FormShell";
import { Button } from "../ui/button";
import { ShieldAlert, ChevronRight, Loader2, Radio } from "lucide-react";

export default function Briefing() {
  const { state, readyForNextPhase } = useGame();
  const { briefing, scenarioTitle } = state;
  const [step, setStep] = useState<0 | 1>(0);
  const [transitioning, setTransitioning] = useState(false);
  // Controls whether the dark veil overlay is mounted
  const [veilActive, setVeilActive] = useState(false);

  if (!briefing) return null;

  const handleBriefingClick = () => {
    setTransitioning(true);
    setVeilActive(true);
    // After 1600ms the veil is opaque; switch to dark step 1 while veil covers the transition
    setTimeout(() => setStep(1), 1600);
  };

  if (step === 0) {
    return (
      <>
        <FormShell variant="light">
          <div className="flex flex-col items-center text-center">
            {/* Brand-accented alert icon ring — calm on the light background */}
            <div className="relative mb-6">
              <div
                className="absolute inset-0 rounded-full opacity-20"
                style={{
                  background: "radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)",
                  animation: "float 3s ease-in-out infinite",
                }}
              />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-brand-200)] bg-[var(--color-brand-100)]">
                <ShieldAlert className="h-8 w-8 text-[var(--color-brand-600)]" />
              </div>
            </div>

            <h2 className="mt-1 text-2xl font-bold text-[var(--color-study-text)]">
              Das Experiment beginnt jetzt
            </h2>

            <p className="mt-4 text-sm leading-relaxed text-[var(--color-study-text-muted)]">
              Sie erhalten gleich das Szenario-Briefing für Ihre Einsatzsimulation.
              Lesen Sie es vollständig und aufmerksam. Danach startet die Simulation
              unmittelbar.
            </p>

            {/* Button: gradient flood + sheen + progress line on activation */}
            <button
              disabled={transitioning}
              onClick={handleBriefingClick}
              className="relative mt-8 w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-5 py-2.5 text-base font-medium text-white disabled:pointer-events-none"
            >
              {/* Gradient flood layer */}
              {transitioning && (
                <span className="briefing-btn-fill absolute inset-0" />
              )}
              {/* Sheen sweep layer — above flood, below text */}
              {transitioning && (
                <span className="briefing-btn-sheen absolute inset-0 z-[1]" />
              )}
              {/* Deterministic progress line at bottom edge */}
              {transitioning && (
                <span className="briefing-btn-progress absolute bottom-0 left-0 z-[2] h-[2px] w-full" />
              )}
              {/* Text + icon — always on top */}
              <span className="relative z-[3] inline-flex items-center justify-center gap-1.5">
                {transitioning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Briefing wird geladen …
                  </>
                ) : (
                  <>Jetzt beginnen <ChevronRight className="h-4 w-4" /></>
                )}
              </span>
            </button>
          </div>
        </FormShell>

        {/* Dark veil overlay: animates from transparent to opaque, covering the light→dark transition */}
        {veilActive && (
          <div
            className="study-darken-veil fixed inset-0 z-50"
            style={{
              background: "#020617",
              animation: "study-to-sim-darken 1.6s cubic-bezier(0.4, 0, 0.6, 1) forwards",
            }}
            aria-hidden
          />
        )}
      </>
    );
  }

  // ── Step 1: Lage-Briefing — stays dark (variant="dark"), unchanged ──
  return (
    <FormShell wide variant="dark" alertMode>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.08)] px-2 py-0.5 text-[10px] font-semibold tracking-widest text-[var(--color-brand-400)] uppercase">
              <Radio className="h-3 w-3" />
              Lage-Briefing
            </span>
          </div>
          <h2 className="text-lg font-bold leading-tight text-[var(--color-surface-100)]">
            {scenarioTitle}
          </h2>
        </div>
      </div>

      {/* Role */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold tracking-widest text-[var(--color-brand-400)] uppercase mb-0.5">
          Ihre Rolle
        </p>
        <p className="text-sm font-semibold text-[var(--color-surface-100)]">{briefing.role}</p>
      </div>

      {/* Situation */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold tracking-widest text-[var(--color-brand-400)] uppercase mb-0.5">
          Aktuelle Lage
        </p>
        <p className="text-sm leading-relaxed text-[var(--color-surface-300)]">{briefing.situation}</p>
      </div>

      {/* Objectives + Resources — two columns */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-[var(--color-brand-400)] uppercase mb-1.5">
            Ihre Aufgaben
          </p>
          <ul className="space-y-1">
            {briefing.objectives.map((obj, i) => (
              <li key={i} className="relative pl-4 text-xs leading-relaxed text-[var(--color-surface-300)]">
                <span className="absolute left-0 text-[var(--color-brand-400)]">▶</span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-[var(--color-brand-400)] uppercase mb-1.5">
            Verfügbare Ressourcen
          </p>
          <ul className="space-y-1">
            {briefing.resources.map((res, i) => (
              <li key={i} className="relative pl-4 text-xs leading-relaxed text-[var(--color-surface-300)]">
                <span className="absolute left-0 text-[var(--color-brand-400)]">▶</span>
                {res}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Warning note */}
      <div className="mb-5 border-l-4 border-[var(--color-warn-500)] bg-[var(--color-surface-700)] px-3 py-2.5 text-xs text-[var(--color-surface-300)]">
        <strong className="text-[var(--color-surface-100)]">Hinweis:</strong>{" "}
        Ihre Entscheidungen werden aufgezeichnet. Es gibt kein „richtig" oder „falsch" -
        handeln Sie nach bestem Wissen und Gewissen. Entscheidungen können nicht rückgängig
        gemacht werden.
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={readyForNextPhase}>
        Simulation starten
      </Button>
    </FormShell>
  );
}
