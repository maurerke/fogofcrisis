import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { GameState } from "@cyber-crisis/shared";

/**
 * Kombiniert Tailwind-Klassen konfliktfrei.
 * Nutzung: cn("p-2", condition && "bg-brand-600", overrideClass)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formatiert Millisekunden als "mm:ss" fuer Spielzeit-Timer. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Formatiert einen Zeitpunkt als "HH:mm" (24h). */
export function formatHHMM(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Scenario in-game start time: 07:45 expressed as seconds since midnight. */
export const SCENARIO_START_SECONDS = 7 * 3600 + 45 * 60;

/**
 * Elapsed in-game seconds since scenario start (07:45), continuous across phases.
 * timerSeconds is a per-phase countdown, so within-phase elapsed is
 * (timeLimitSeconds - timerSeconds); prior phases are summed in the offset.
 */
export function gameElapsedSeconds(
  state: Pick<GameState, "scenarioElapsedOffsetSeconds" | "currentPhase" | "timerSeconds">,
): number {
  const inPhase = state.currentPhase
    ? Math.max(0, state.currentPhase.timeLimitSeconds - state.timerSeconds)
    : 0;
  return state.scenarioElapsedOffsetSeconds + inPhase;
}

/** Formats in-game elapsed seconds as a wall-clock "HH:mm" from the 07:45 start. */
export function formatGameClock(elapsedSeconds: number): string {
  const total = SCENARIO_START_SECONDS + Math.max(0, Math.floor(elapsedSeconds));
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
