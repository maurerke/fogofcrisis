import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TooltipProvider } from "../ui/tooltip";
import { useGame } from "../../context/GameContext";
import AppBar from "./AppBar";
import IncidentBar from "./IncidentBar";
import SituationDashboard from "./SituationDashboard";
import MailInbox from "./MailInbox";
import SmartphoneFeed from "./SmartphoneFeed";
import DecisionDock from "./DecisionDock";
import PhaseTransition from "./PhaseTransition";
import TutorialOverlay, { type TutorialStep } from "./TutorialOverlay";
import { cn } from "../../lib/utils";

const TUTORIAL_STEPS_BASE: TutorialStep[] = [
  {
    targetSelector: '[role="banner"]',
    title: "Lageplattform",
    description:
      "Oben rechts sehen Sie die Entscheidungsfrist dieser Phase. Treffen Sie Ihre Entscheidung innerhalb der Zeit — läuft der Timer ab, wird die Phase ohne Auswahl automatisch beendet und die nächste Phase beginnt. Sie können jederzeit früher entscheiden.",
    position: "bottom",
  },
  {
    targetSelector: '[data-tutorial="situation-dashboard"]',
    title: "Lagebild",
    description:
      "Das Lagebild fasst den aktuellen Stand des Vorfalls zusammen — Systeme, Betroffene und Zeitleiste.",
    position: "right",
  },
  {
    targetSelector: '[data-tutorial="mail-inbox"]',
    title: "Posteingang",
    description:
      "Hier treffen laufend neue Meldungen ein — technische Berichte, Updates vom Team und Anfragen. Lesen Sie diese, um fundierte Entscheidungen zu treffen.",
    position: "top",
  },
  {
    targetSelector: '[role="region"][aria-label="Entscheidungs-Dock"]',
    title: "Entscheidungsbereich",
    description:
      "Klicken Sie auf 'Jetzt entscheiden', sobald Sie bereit sind — Sie müssen nicht auf den Ablauf des Timers warten. Läuft der Timer ab ohne dass Sie entschieden haben, wird die Phase automatisch beendet und die nächste beginnt.",
    position: "top",
  },
];

const TUTORIAL_STEP_SMARTPHONE: TutorialStep = {
  targetSelector: '[data-tutorial="smartphone-feed"]',
  title: "Medienfeed",
  description:
    "Auf Ihrem Diensthandy erscheinen Nachrichten aus sozialen Medien und Presse zum Vorfall.",
  position: "left",
};

/**
 * Workspace v2: Drei-Feed-Komposition (Dashboard / Mail / Smartphone).
 *
 * Methoden-Guardrails:
 * - Gruppe A rendert SmartphoneFeed nicht (keine DOM-Seiteneffekte).
 * - Dashboard, Mail, Timer, Decision Dock sind fuer A und B identisch.
 * - Min-Breite 1280px durch MinWidthGuard in App.tsx sichergestellt.
 */
export default function Workspace() {
  const { state, completeTutorial } = useGame();
  const isGroupB = state.session?.group === "B";

  const [showTransition, setShowTransition] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<{ index: number; title: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialShownRef = useRef(false);
  // Tracks which phase ID last triggered a splash to prevent duplicate overlays on reconnect (AP1)
  const lastSplashPhaseIdRef = useRef<string | null>(null);
  // Ref mirrors so stable callbacks can read current values without re-creation
  const tutorialActiveRef = useRef(state.tutorialActive);
  const statusRef = useRef(state.status);
  tutorialActiveRef.current = state.tutorialActive;
  statusRef.current = state.status;

  // AP1: Guard against duplicate splash on reconnect — only show if the phaseId actually changed.
  // showTransition is NOT set here — DecisionDock calls triggerTransition once the consequence
  // dialog has been acknowledged (or immediately if no consequence was pending).
  useEffect(() => {
    if (state.status === "playing" && state.currentPhase) {
      const phaseId = state.currentPhase.id;
      if (lastSplashPhaseIdRef.current === phaseId) return;
      lastSplashPhaseIdRef.current = phaseId;
      setTransitionPhase({
        index: state.currentPhaseIndex,
        title: state.currentPhase.title,
      });
    }
  }, [state.currentPhaseIndex, state.currentPhase?.id, state.status]);

  // Stable callback passed to DecisionDock — fires when it's safe to show the transition.
  const triggerTransition = useCallback(() => {
    setShowTransition(true);
  }, []);

  const handleTutorialDone = useCallback(() => {
    setShowTutorial(false);
    completeTutorial();
  }, [completeTutorial]);

  // Stable callback — fires AFTER PhaseTransition ends (avoids dark-overlay clash).
  // Shows tutorial whenever the server signals tutorialActive — no sessionStorage gate,
  // so a fresh game start always displays the tutorial regardless of prior runs.
  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    if (tutorialActiveRef.current && !tutorialShownRef.current) {
      tutorialShownRef.current = true;
      setShowTutorial(true);
    }
  }, []);

  const tutorialSteps: TutorialStep[] = useMemo(
    () =>
      isGroupB
        ? [
            ...TUTORIAL_STEPS_BASE.slice(0, 3),
            TUTORIAL_STEP_SMARTPHONE,
            TUTORIAL_STEPS_BASE[3],
          ]
        : TUTORIAL_STEPS_BASE,
    [isGroupB],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="app-gradient flex h-screen w-full flex-col text-[var(--color-surface-900)]">
        <AppBar />
        <IncidentBar />

        <main
          className={cn(
            "grid min-h-0 flex-1 gap-4 p-4",
            isGroupB
              ? "grid-cols-[280px_minmax(0,1fr)_340px]"
              : "grid-cols-[280px_minmax(0,1fr)]",
          )}
          aria-label="Lagebild"
        >
          <SituationDashboard />
          <MailInbox />
          {isGroupB && <SmartphoneFeed />}
        </main>

        <DecisionDock onPhaseTransitionReady={triggerTransition} />

        {showTransition && transitionPhase && (
          <PhaseTransition
            phaseIndex={transitionPhase.index}
            phaseTitle={transitionPhase.title}
            totalPhases={state.totalPhases}
            onComplete={handleTransitionComplete}
          />
        )}

        {showTutorial && (
          <TutorialOverlay
            steps={tutorialSteps}
            onComplete={handleTutorialDone}
            onSkip={handleTutorialDone}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
