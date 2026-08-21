import type { ReactNode } from "react";
import "./index.css";
import { GameProvider, useGame } from "./context/GameContext";
import WelcomeScreen from "./components/onboarding/WelcomeScreen";
import ConsentForm from "./components/onboarding/ConsentForm";
import DemographicForm from "./components/onboarding/DemographicForm";
import Briefing from "./components/onboarding/Briefing";
import Workspace from "./components/workspace/Workspace";
import PostSurvey from "./components/closing/PostSurvey";
import Debriefing from "./components/closing/Debriefing";
import ThankYou from "./components/closing/ThankYou";
import WithdrawLink from "./components/common/WithdrawLink";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

function GameRouter() {
  const { state, connected } = useGame();

  if (!connected) {
    return (
      <FullscreenMessage title="Verbinde…">
        <p>Verbindung zum Server wird hergestellt.</p>
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[11px] text-surface-500 italic">
            Falls dies länger als 10 Sekunden dauert, ist der Server möglicherweise nicht erreichbar.
          </p>
          <p className="text-[11px] text-surface-500 italic">
            Wird diese Meldung bereits von Beginn an angezeigt, kann auch der Browser oder eine Firewall die Verbindung blockieren. Wechseln Sie in diesem Fall den Browser oder nutzen Sie, falls Sie ein dienstliches Gerät verwenden, ein privates Gerät. Vielen Dank für Ihre Unterstützung.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Seite neu laden
          </button>
        </div>
      </FullscreenMessage>
    );
  }

  switch (state.status) {
    case "loading":
      return <FullscreenMessage title="Lade…">Moment bitte.</FullscreenMessage>;
    case "onboarding":
      return <WelcomeScreen />;
    case "consent":
      return <ConsentForm />;
    case "demographics":
      return <DemographicForm />;
    case "briefing":
      return <Briefing />;
    case "playing":
      return <Workspace />;
    case "survey":
      return <PostSurvey />;
    case "debriefing":
      return <Debriefing />;
    case "complete":
      return <ThankYou />;
    case "revoked":
      return (
        <FullscreenMessage title="Teilnahme beendet">
          <p>Ihre Teilnahme wurde beendet. Ihre Daten sind zur Löschung vorgemerkt.</p>
          <p>
            Für eine vollständige Löschung Ihrer Daten kontaktieren Sie bitte die Forschungsleitung
            und geben Ihre Teilnahme-ID an.
          </p>
          <p>Vielen Dank für Ihre Zeit.</p>
        </FullscreenMessage>
      );
    case "underage":
      return (
        <FullscreenMessage title="Teilnahme nicht möglich">
          Die Teilnahme an dieser Studie ist nur für Personen ab 18 Jahren möglich.
        </FullscreenMessage>
      );
    case "error":
      return (
        <FullscreenMessage title="Fehler">
          <p>{state.error || "Ein unbekannter Fehler ist aufgetreten."}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Seite neu laden
          </button>
        </FullscreenMessage>
      );
    default:
      return <WelcomeScreen />;
  }
}

function MinWidthGuard({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="hidden min-h-screen items-center justify-center bg-surface-50 p-6 text-center text-surface-700 max-[1279px]:flex">
        <div className="max-w-sm rounded-lg border border-surface-200 bg-surface-0 p-6 shadow-panel">
          <h2 className="text-lg font-semibold text-surface-900">
            Bildschirm zu klein
          </h2>
          <p className="mt-2 text-sm">
            Diese Simulation erfordert eine Mindestbreite von 1280&nbsp;Pixeln. Bitte
            verwenden Sie einen größeren Bildschirm oder vergrößern Sie das Browserfenster.
          </p>
        </div>
      </div>
      <div className="max-[1279px]:hidden">{children}</div>
    </>
  );
}

function FullscreenMessage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6">
      <div className="max-w-md rounded-lg border border-surface-200 bg-surface-0 p-6 shadow-panel text-surface-800">
        <h2 className="mb-2 text-lg font-semibold text-surface-900">
          {title}
        </h2>
        <div className="space-y-2 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <MinWidthGuard>
          <GameRouter />
          <WithdrawLinkWrapper />
        </MinWidthGuard>
      </GameProvider>
    </ErrorBoundary>
  );
}

const WITHDRAW_VISIBLE_STATES = new Set([
  "demographics",
  "briefing",
  "survey",
  "debriefing",
]);

function WithdrawLinkWrapper() {
  const { state } = useGame();
  if (!WITHDRAW_VISIBLE_STATES.has(state.status)) return null;
  return <WithdrawLink />;
}
