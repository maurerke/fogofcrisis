import { useEffect, useMemo, useRef, useState } from "react";
import { Gavel, ShieldCheck, CheckCircle2, Loader2, ArrowRight, ChevronRight, Clock, Radio } from "lucide-react";
import { useGame } from "../../context/GameContext";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import WithdrawLink from "../common/WithdrawLink";

const SUBMIT_TIMEOUT_MS = 5000;
const ACK_RETRY_INTERVAL_MS = 4000;

interface FrozenFeedback {
  prompt: string;
  label: string;
  consequenceText: string | null;
}

interface DecisionDockProps {
  onPhaseTransitionReady?: () => void;
}

/**
 * DecisionDock: Persistenter Entscheidungs-Streifen am unteren Rand.
 *
 * Signaling/Cueing (Aufgabe 1a):
 * Zeigt "Lageinformationen treffen ein…" solange zeitgesteuerte Events der
 * aktuellen Phase noch nicht vollstaendig ausgeliefert wurden, danach
 * "Lage erfasst — Entscheidung moeglich". Kein Zwang, kein Blockieren —
 * der Button bleibt jederzeit anklickbar, damit Zeitdruck-Verhalten
 * messbar bleibt (Methoden-Guardrail). Signal gilt identisch fuer Gruppe A
 * und B (nur Medienfeed variiert zwischen Gruppen).
 *
 * Literatur: Mayer & Moreno (2003) signaling principle; Plass et al. (2015)
 * Engagement without distraction (Cognitive Theory of Multimedia Learning);
 * bereits im Projekt zitiert.
 */
export default function DecisionDock({ onPhaseTransitionReady }: DecisionDockProps) {
  const { state, submitDecision, readyForNextPhase } = useGame();
  const { currentPhase, timerSeconds, events, mediaItems } = state;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmStep, setConfirmStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitTimeoutError, setSubmitTimeoutError] = useState<string | null>(null);
  const [hasRevised, setHasRevised] = useState(false);
  const firstSelectionRef = useRef<string[] | null>(null);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [frozenFeedback, setFrozenFeedback] = useState<FrozenFeedback | null>(null);
  const frozenFeedbackRef = useRef<FrozenFeedback | null>(null);
  frozenFeedbackRef.current = frozenFeedback;
  const onPhaseTransitionReadyRef = useRef(onPhaseTransitionReady);
  onPhaseTransitionReadyRef.current = onPhaseTransitionReady;

  useEffect(() => {
    setSelected([]);
    setConfirmStep(false);
    setSubmitting(false);
    setSubmitTimeoutError(null);
    setHasRevised(false);
    firstSelectionRef.current = null;
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
    if (frozenFeedbackRef.current) {
      // keep open — waiting for user ack of consequence
    } else {
      setOpen(false);
      onPhaseTransitionReadyRef.current?.();
    }
  }, [currentPhase?.id]);

  const decision = currentPhase?.decision;

  const alreadySubmitted = useMemo(() => {
    if (!currentPhase) return false;
    return state.decisions.some(d => d.phaseId === currentPhase.id);
  }, [state.decisions, currentPhase]);

  useEffect(() => {
    if (!(alreadySubmitted && !frozenFeedback && state.status === "playing")) return;
    readyForNextPhase();
    const retry = setInterval(() => readyForNextPhase(), ACK_RETRY_INTERVAL_MS);
    return () => clearInterval(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadySubmitted, frozenFeedback, state.status]);

  useEffect(() => {
    if (alreadySubmitted && submitting) {
      setSubmitting(false);
      setSubmitTimeoutError(null);
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }
    }
  }, [alreadySubmitted, submitting]);

  const prevErrorRef = useRef(state.error);
  useEffect(() => {
    if (submitting && state.error && state.error !== prevErrorRef.current) {
      setSubmitting(false);
      setFrozenFeedback(null);
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }
    }
    prevErrorRef.current = state.error;
  }, [submitting, state.error]);

  const isMultiple = decision?.allowMultiple ?? false;
  const timeLowSeconds = useMemo(
    () => Math.min(30, Math.max(10, Math.floor((currentPhase?.timeLimitSeconds ?? 120) * 0.2))),
    [currentPhase?.timeLimitSeconds],
  );
  const timeLow = timerSeconds <= timeLowSeconds;

  const consequenceText = useMemo(() => {
    if (!decision || selected.length === 0) return null;
    return decision.options
      .filter((o) => selected.includes(o.id))
      .map((o) => o.consequencePreview)
      .filter(Boolean)
      .join(" ");
  }, [decision, selected]);

  // ── Signaling/Cueing (Aufgabe 1a) ──────────────────────────────────────────
  // Counts time-based (non-triggered) incomingEvents for the current phase and
  // compares them to received events. Triggered consequence-events (evt_cons_*)
  // are excluded because they arrive AFTER decisions and should not delay the
  // readiness cue. The threshold is the last timed event, not a hard barrier —
  // the button remains clickable at all times (Methoden-Guardrail).
  //
  // Identical for groups A and B — only the mediaFeed column varies (A/B).
  const { situationReadyCount, situationTotalCount, situationReady } = useMemo(() => {
    if (!currentPhase) return { situationReadyCount: 0, situationTotalCount: 0, situationReady: false };

    // Only time-based events (no trigger field) count toward the readiness cue.
    const timedEvents = currentPhase.incomingEvents.filter(e => !e.trigger);
    const total = timedEvents.length;
    if (total === 0) return { situationReadyCount: 0, situationTotalCount: 0, situationReady: true };

    // Count how many of the current phase's timed events are in the received list.
    const timedIds = new Set(timedEvents.map(e => e.id));
    const receivedCount = events.filter(e => timedIds.has(e.id)).length;

    return {
      situationReadyCount: receivedCount,
      situationTotalCount: total,
      situationReady: receivedCount >= total,
    };
  }, [currentPhase, events]);
  // ────────────────────────────────────────────────────────────────────────────

  if (!frozenFeedback && (!currentPhase || !decision)) return null;

  const toggle = (id: string) => {
    if (submitting || alreadySubmitted) return;
    setSelected((prev) => {
      let next: string[];
      if (isMultiple) {
        next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      } else {
        next = [id];
      }
      if (firstSelectionRef.current === null) {
        firstSelectionRef.current = next;
      } else if (JSON.stringify(firstSelectionRef.current) !== JSON.stringify(next)) {
        setHasRevised(true);
      }
      return next;
    });
  };

  const submit = () => {
    if (!decision || !currentPhase) return;
    if (selected.length === 0 || submitting || alreadySubmitted) return;
    if (decision.requireConfirmation && !confirmStep) {
      setConfirmStep(true);
      return;
    }
    setSubmitting(true);
    setSubmitTimeoutError(null);
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    submitTimerRef.current = setTimeout(() => {
      setSubmitting(false);
      setSubmitTimeoutError("Verbindungsproblem — bitte erneut bestätigen.");
      submitTimerRef.current = null;
    }, SUBMIT_TIMEOUT_MS);

    const labels = decision.options
      .filter((o) => selected.includes(o.id))
      .map((o) => o.label)
      .join(", ");

    setFrozenFeedback({ prompt: decision.prompt, label: labels, consequenceText });
    submitDecision(
      {
        phaseId: currentPhase.id,
        decisionId: decision.id,
        selectedOptionIds: selected,
        revisedDecision: hasRevised,
        eventsSeenCount: events.length,
        mediaItemsSeenCount: state.session?.group === "B" ? mediaItems.length : undefined,
      },
      labels,
    );
  };

  const handleConsequenceAck = () => {
    setFrozenFeedback(null);
    setOpen(false);
    if (!alreadySubmitted) {
      onPhaseTransitionReadyRef.current?.();
    }
  };

  return (
    <>
      {/* ── Dock ── */}
      <div
        className="z-20 relative overflow-hidden"
        role="region"
        aria-label="Entscheidungs-Dock"
      >
        {/* Top accent line */}
        <div
          aria-hidden
          style={{
            height: "1px",
            background: timeLow && !alreadySubmitted
              ? "linear-gradient(90deg, transparent 0%, rgba(244,63,94,0.6) 30%, rgba(244,63,94,0.6) 70%, transparent 100%)"
              : "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.35) 30%, rgba(99,102,241,0.35) 70%, transparent 100%)",
            boxShadow: timeLow && !alreadySubmitted
              ? "0 0 12px 1px rgba(244,63,94,0.3)"
              : undefined,
          }}
        />

        {/* Scanline texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px)",
          }}
        />

        <div
          className={cn(
            "relative transition-colors duration-700",
            timeLow && !alreadySubmitted
              ? "bg-[rgba(32,10,22,0.97)] backdrop-blur-md"
              : "bg-[rgba(20,28,52,0.97)] backdrop-blur-md",
          )}
        >
          <div className="mx-auto max-w-6xl flex items-stretch min-h-[56px]">

            {/* ── Left zone: status ── */}
            <div className="flex flex-col justify-center gap-1 border-r border-white/[0.07] px-6 shrink-0">
              <div className="flex items-center gap-2">
                <Gavel
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    alreadySubmitted ? "text-ok-400" : timeLow ? "text-crit-400" : "text-brand-400",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-[0.2em]",
                    alreadySubmitted ? "text-ok-400" : timeLow ? "text-crit-400" : "text-brand-400",
                  )}
                >
                  {alreadySubmitted ? "Entscheidung erfolgt" : "Handlungsbedarf"}
                </span>
              </div>
              {alreadySubmitted && (
                <div className="flex items-center gap-1.5 text-[10px] text-ok-500">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  <span className="font-medium tracking-wide">Nächste Phase beginnt…</span>
                </div>
              )}
            </div>

            {/* ── Center: situation-readiness cue ── */}
            {/* Prompt text intentionally omitted from the dock strip — the full
                question is always visible in the decision modal. Showing a
                truncated version here added no informational value. */}
            <div className="flex flex-1 items-center px-6 min-w-0">

              {/* Situation-readiness cue — identical for groups A and B.
                  Appears only while the phase is active and not yet decided.
                  Design intent: low-salience cueing so participants know when
                  enough information has arrived to make an informed decision,
                  without blocking early decisions (Mayer & Moreno 2003,
                  signaling principle; Plass et al. 2015). */}
              {!alreadySubmitted && !frozenFeedback && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 shrink-0 rounded-sm border px-3 py-1 transition-all duration-500",
                    situationReady
                      ? "border-ok-700/40 bg-ok-950/40"
                      : "border-white/[0.06] bg-white/[0.03]",
                  )}
                  role="status"
                  aria-live="polite"
                  aria-label={
                    situationReady
                      ? "Lage erfasst — Entscheidung möglich"
                      : situationTotalCount > 0
                        ? `Lage wird erfasst: ${situationReadyCount} von ${situationTotalCount} Meldungen eingetroffen`
                        : "Lageinformationen treffen ein"
                  }
                >
                  {situationReady ? (
                    <>
                      <Radio className="h-3 w-3 text-ok-400 shrink-0" aria-hidden />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ok-400 whitespace-nowrap">
                        Lage erfasst — Jetzt entscheiden
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full bg-slate-500 shrink-0 animate-pulse"
                        style={{ animationDuration: "2s" }}
                      />
                      <span className="text-[10px] font-medium tracking-wide text-slate-400 whitespace-nowrap">
                        {/* Show counter when total is known and > 0; fall back to
                            plain label if total is 0 (phase has no timed events). */}
                        {situationTotalCount > 0
                          ? `Lage wird erfasst · ${situationReadyCount}/${situationTotalCount}`
                          : "Lageinformationen treffen ein…"}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Right zone: actions ── */}
            <div className="flex items-center gap-4 border-l border-white/[0.07] px-6 shrink-0">
              <WithdrawLink variant="dock" />

              {alreadySubmitted ? (
                <div
                  className="flex items-center gap-2 rounded-sm border px-4 py-2"
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    borderColor: "rgba(52,211,153,0.3)",
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 text-ok-400" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-widest text-ok-400">
                    Registriert
                  </span>
                </div>
              ) : submitting ? (
                <div
                  className="flex items-center gap-2 rounded-sm border px-4 py-2"
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    borderColor: "rgba(99,102,241,0.3)",
                  }}
                >
                  <Loader2 className="h-4 w-4 animate-spin text-brand-400" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-widest text-brand-400">
                    Übermittlung…
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-sm px-8 py-2.5",
                    "text-sm font-bold uppercase tracking-widest text-white",
                    "transition-all duration-200 active:scale-[0.98]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                    timeLow
                      ? "bg-crit-600 hover:bg-crit-700"
                      : "bg-brand-600 hover:bg-brand-700",
                  )}
                  style={{
                    boxShadow: timeLow
                      ? "0 0 28px -4px rgba(244,63,94,0.7), 0 2px 8px rgba(0,0,0,0.4)"
                      : "0 0 22px -4px rgba(99,102,241,0.65), 0 2px 8px rgba(0,0,0,0.4)",
                    animation: timeLow ? "severity-glow 1.2s ease-in-out infinite" : undefined,
                  }}
                  onClick={() => {
                    setConfirmStep(false);
                    setSubmitTimeoutError(null);
                    setOpen(true);
                  }}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                  Jetzt entscheiden
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Decision Modal ── */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (submitting) return;
          if (!v && frozenFeedback) {
            handleConsequenceAck();
          } else {
            setOpen(v);
          }
        }}
      >
        <DialogContent
          className="max-w-2xl p-0 overflow-x-hidden"
          style={{
            background: "rgba(22,32,62,0.98)",
            border: "1px solid rgba(99,102,241,0.28)",
            boxShadow: "0 0 60px -10px rgba(99,102,241,0.2), 0 25px 50px -12px rgba(0,0,0,0.55)",
          }}
        >
          {/* Modal header */}
          <div
            className="relative flex items-center gap-3 border-b px-6 py-4 overflow-hidden"
            style={{
              background: "linear-gradient(90deg, rgba(14,22,50,0.98) 0%, rgba(18,28,58,0.98) 100%)",
              borderBottomColor: "rgba(99,102,241,0.2)",
            }}
          >
            {/* Accent line top */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.8) 30%, rgba(99,102,241,0.8) 70%, transparent 100%)",
              }}
            />
            <ShieldCheck className="h-4 w-4 text-brand-400 shrink-0" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-300">
              Sicherheitskritische Entscheidung
            </span>
          </div>

          <div className="p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-lg font-bold text-white leading-tight">
                {frozenFeedback ? frozenFeedback.prompt : decision?.prompt}
              </DialogTitle>
              {!frozenFeedback && !alreadySubmitted && !submitting && decision?.context && (
                <DialogDescription className="text-sm text-slate-300 leading-relaxed mt-2">
                  {decision.context}
                </DialogDescription>
              )}
            </DialogHeader>

            {frozenFeedback ? (
              /* ── Consequence view ── */
              <div className="space-y-4">
                <div
                  className="flex items-start gap-4 rounded-sm border p-4"
                  style={{
                    background: "rgba(16,185,129,0.1)",
                    borderColor: "rgba(52,211,153,0.3)",
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
                    style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(52,211,153,0.4)" }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-ok-400" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ok-400 mb-1">
                      Entscheidung übermittelt
                    </p>
                    <p className="text-sm font-semibold text-ok-300">
                      {frozenFeedback.label}
                    </p>
                  </div>
                </div>

                {frozenFeedback.consequenceText && (
                  <div
                    className="rounded-sm border p-4"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "rgba(255,255,255,0.12)",
                    }}
                  >
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.25em] text-slate-400">
                      Erwartete Auswirkungen
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed italic">
                      „{frozenFeedback.consequenceText}"
                    </p>
                  </div>
                )}

                <DialogFooter>
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2.5 rounded-sm px-8 py-3 font-bold uppercase tracking-widest text-sm text-white transition-all duration-200 active:scale-[0.99] bg-brand-600 hover:bg-brand-700"
                    style={{ boxShadow: "0 0 22px -4px rgba(99,102,241,0.55), 0 2px 8px rgba(0,0,0,0.4)" }}
                    onClick={handleConsequenceAck}
                  >
                    Zur nächsten Phase
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </DialogFooter>
              </div>
            ) : alreadySubmitted ? (
              /* ── Already submitted (reload) ── */
              <div className="space-y-4">
                <div
                  className="flex items-start gap-4 rounded-sm border p-4"
                  style={{ background: "rgba(16,185,129,0.1)", borderColor: "rgba(52,211,153,0.3)" }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
                    style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(52,211,153,0.4)" }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-ok-400" aria-hidden />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ok-400 mb-1">
                      Entscheidung bereits registriert
                    </p>
                    <p className="text-sm font-semibold text-ok-300">
                      {(() => {
                        const stored = state.decisions.find(d => d.phaseId === currentPhase?.id);
                        if (stored?.label) return stored.label;
                        return decision?.options.filter((o) => selected.includes(o.id)).map((o) => o.label).join(", ") ?? "";
                      })()}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <button
                    type="button"
                    className="w-full rounded-sm px-8 py-3 font-bold uppercase tracking-widest text-sm text-white bg-brand-600 hover:bg-brand-700 transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    Schließen
                  </button>
                </DialogFooter>
              </div>
            ) : (
              /* ── Option selection ── */
              <>
                {isMultiple && (
                  <div
                    className="mb-4 flex items-center gap-2 rounded-sm border px-4 py-2.5"
                    style={{ background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.28)" }}
                  >
                    <span className="text-xs font-bold text-brand-200 uppercase tracking-wide">
                      Mehrfachauswahl möglich
                    </span>
                    <span className="text-xs text-slate-300">— alle zutreffenden Maßnahmen wählen.</span>
                  </div>
                )}

                <div
                  className="flex flex-col gap-2.5"
                  role={isMultiple ? "group" : "radiogroup"}
                  aria-label="Entscheidungsoptionen"
                >
                  {(decision?.options ?? []).map((opt) => {
                    const active = selected.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-4 rounded-sm border p-4 transition-all duration-150",
                          (submitting) && "opacity-50 cursor-not-allowed",
                        )}
                        style={
                          active
                            ? {
                                background: "rgba(99,102,241,0.15)",
                                borderColor: "rgba(99,102,241,0.5)",
                                boxShadow: "0 0 12px -4px rgba(99,102,241,0.3)",
                              }
                            : {
                                background: "rgba(255,255,255,0.05)",
                                borderColor: "rgba(255,255,255,0.12)",
                              }
                        }
                      >
                        <div className="mt-0.5 shrink-0">
                          <input
                            type={isMultiple ? "checkbox" : "radio"}
                            name="decision"
                            className="h-4 w-4 accent-brand-400"
                            checked={active}
                            onChange={() => toggle(opt.id)}
                            disabled={submitting}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              "text-sm font-bold tracking-tight",
                              active ? "text-brand-100" : "text-slate-100",
                            )}
                          >
                            {opt.label}
                          </div>
                          <div className="mt-1 text-xs text-slate-300 leading-relaxed">
                            {opt.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  {confirmStep && (
                    <div
                      className="rounded-sm border px-4 py-3 text-center"
                      style={{ background: "rgba(244,63,94,0.1)", borderColor: "rgba(251,113,133,0.3)" }}
                    >
                      <p className="text-xs font-bold text-crit-200">
                        Achtung: Diese Entscheidung ist endgültig und kann nicht revidiert werden.
                      </p>
                    </div>
                  )}

                  {isMultiple && confirmStep && selected.length === 1 && (
                    <div
                      className="rounded-sm border px-4 py-2.5 text-center"
                      style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.25)" }}
                    >
                      <p className="text-xs text-brand-200">
                        Sie haben 1 Option gewählt. Es können mehrere Maßnahmen kombiniert werden.
                      </p>
                    </div>
                  )}

                  {submitTimeoutError && (
                    <div
                      className="rounded-sm border px-4 py-2.5 text-center"
                      style={{ background: "rgba(249,115,22,0.1)", borderColor: "rgba(251,146,60,0.3)" }}
                    >
                      <p className="text-xs text-warn-200">{submitTimeoutError}</p>
                    </div>
                  )}

                  {state.error && !submitting && (
                    <div
                      className="rounded-sm border px-4 py-2.5 text-center"
                      style={{ background: "rgba(244,63,94,0.1)", borderColor: "rgba(251,113,133,0.3)" }}
                    >
                      <p className="text-xs text-crit-200">{state.error}</p>
                    </div>
                  )}

                  <DialogFooter className="sm:justify-between gap-3 mt-1">
                    {confirmStep ? (
                      <>
                        <button
                          type="button"
                          className="rounded-sm px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors"
                          onClick={() => setConfirmStep(false)}
                          disabled={submitting}
                        >
                          Überdenken
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-sm px-8 py-2.5 font-bold uppercase tracking-widest text-sm text-white bg-crit-600 hover:bg-crit-700 transition-colors disabled:opacity-50"
                          style={{ boxShadow: "0 0 22px -4px rgba(244,63,94,0.5), 0 2px 8px rgba(0,0,0,0.4)" }}
                          onClick={submit}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Übermittlung läuft…</>
                          ) : "Final bestätigen"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rounded-sm px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors"
                          onClick={() => setOpen(false)}
                          disabled={submitting}
                        >
                          Später entscheiden
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-2.5 rounded-sm px-8 py-2.5 font-bold uppercase tracking-widest text-sm text-white bg-brand-600 hover:bg-brand-700 transition-all duration-150 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            boxShadow: selected.length > 0
                              ? "0 0 22px -4px rgba(99,102,241,0.6), 0 2px 8px rgba(0,0,0,0.4)"
                              : undefined,
                          }}
                          onClick={submit}
                          disabled={selected.length === 0 || submitting}
                        >
                          {submitting ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Übermittlung läuft…</>
                          ) : (
                            <>
                              {isMultiple ? `Auswahl bestätigen (${selected.length})` : "Auswahl bestätigen"}
                              <ArrowRight className="h-4 w-4" aria-hidden />
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </DialogFooter>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
