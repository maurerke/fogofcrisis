import type { Server, Socket } from "socket.io";
import type {
  Scenario,
  Phase,
  DecisionRecord,
  SessionConfig,
  SubmitDecisionPayload,
  IncomingEvent,
  MediaFeedItem,
  DecisionRejectedPayload,
} from "@cyber-crisis/shared";
import { SocketEvent } from "@cyber-crisis/shared";
import { TimerManager } from "./timerManager";
import {
  insertDecision,
  auditLog,
  getDecisionsBySession,
  updateEngineState,
  flagSession,
} from "../db/database";
import { mapDecisionRowToRecord } from "../utils/mappers";

type EngineState = "ONBOARDING" | "BRIEFING" | "TUTORIAL" | "PLAYING" | "SURVEY" | "DEBRIEFING" | "COMPLETE" | "PAUSED";
export type { EngineState };

const PHASE_ADVANCE_DELAY_MS = 2000; // delay before advancing after a timeout (no dialog to read)
// Failsafe: if the client never acknowledges the consequence dialog (crash, old
// client), the phase advances anyway so the study session cannot get stuck.
const PHASE_ADVANCE_FAILSAFE_MS = 90_000;

export class ScenarioEngine {
  private state: EngineState = "ONBOARDING";
  private prePauseState: EngineState | null = null;
  private currentPhaseIndex: number = 0;
  private timerManager: TimerManager;
  private phaseStartTime: number = 0;
  private decisionShownTime: number = 0;
  private scenarioStartTime: number = 0;
  private remainingSeconds: number = 0;
  private decisionSubmitted: boolean = false;

  constructor(
    private session: SessionConfig,
    private scenario: Scenario,
    private socket: Socket,
    private io: Server
  ) {
    this.timerManager = new TimerManager();
  }

  getState(): EngineState {
    return this.state;
  }

  getSession(): SessionConfig {
    return this.session;
  }

  getCurrentPhaseIndex(): number {
    return this.currentPhaseIndex;
  }

  getRemainingSeconds(): number {
    return this.remainingSeconds;
  }

  /** Events already delivered up to now — used to re-hydrate the client after reconnect. */
  getDeliveredEvents(): IncomingEvent[] {
    const delivered: IncomingEvent[] = [];
    const decisions = getDecisionsBySession(this.session.sessionId);

    for (let i = 0; i < this.currentPhaseIndex; i++) {
      // Past phases: all time-based events were delivered; triggered events
      // only if the trigger option was actually selected.
      for (const e of this.scenario.phases[i].incomingEvents) {
        if (e.trigger) {
          if (this.wasTriggerSatisfied(e, decisions)) delivered.push(e);
        } else {
          delivered.push(e);
        }
      }
    }

    const currentPhase = this.scenario.phases[this.currentPhaseIndex];
    if (currentPhase) {
      const elapsed = currentPhase.timeLimitSeconds - this.remainingSeconds;
      for (const e of currentPhase.incomingEvents) {
        if (e.trigger) {
          if (this.wasTriggerSatisfied(e, decisions)) delivered.push(e);
        } else if (e.delaySeconds <= elapsed) {
          delivered.push(e);
        }
      }
    }

    return delivered;
  }

  /** True if the triggered event's phase has been decided in line with its trigger option. */
  private wasTriggerSatisfied(
    event: IncomingEvent,
    decisions: Record<string, unknown>[]
  ): boolean {
    if (!event.trigger) return false;
    const dec = decisions.find((d) => d.phase_id === event.trigger!.phaseId);
    if (!dec) return false;
    const selected: string[] = JSON.parse(String(dec.selected_option_ids ?? "[]"));
    return selected.includes(event.trigger.optionId);
  }

  /** Update socket reference after reconnect so engine can resume sending events. */
  updateSocket(socket: Socket): void {
    this.socket = socket;
  }

  /** Persist current engine state + phase index for crash/reconnect recovery. */
  private persistState(): void {
    try {
      updateEngineState(this.session.sessionId, this.state, this.currentPhaseIndex);
    } catch (err) {
      console.error(`[Engine] Failed to persist engine state:`, err);
    }
  }

  /** Mark session as flagged and notify client; used when engine enters an unrecoverable state. */
  private failSession(reason: string): void {
    try {
      flagSession(this.session.sessionId, reason);
    } catch (err) {
      console.error(`[Engine] Failed to flag session:`, err);
    }
    auditLog(this.session.sessionId, "engine_failure", { reason });
    this.socket.emit(SocketEvent.ERROR, {
      message: "Ein interner Fehler ist aufgetreten. Bitte wenden Sie sich an die Studienleitung.",
    });
    this.timerManager.clearAll();
  }

  /** Returns delivered media items (for Group B reconnect). */
  getDeliveredMediaItems(): MediaFeedItem[] {
    if (this.session.group !== "B" || !this.scenario.mediaFeed) return [];

    // After the scenario is over (survey/debriefing/complete) every time-based
    // item has been shown — the debriefing transparency list depends on this.
    const scenarioOver = ["SURVEY", "DEBRIEFING", "COMPLETE"].includes(this.getEffectiveState());
    const elapsedSec = scenarioOver
      ? Number.POSITIVE_INFINITY
      : (Date.now() - this.scenarioStartTime) / 1000;

    const delivered: MediaFeedItem[] = [];
    const decisions = getDecisionsBySession(this.session.sessionId);

    for (const item of this.scenario.mediaFeed) {
      // Time-based items: appear after global scenario time
      if (item.appearAfterSeconds !== undefined && item.appearAfterSeconds <= elapsedSec) {
        delivered.push(item);
        continue;
      }
      // Triggered items: included if their trigger phase has already been decided in line with the trigger option
      if (item.trigger) {
        const triggerDec = decisions.find((d) => d.phase_id === item.trigger!.phaseId);
        if (triggerDec) {
          const selected: string[] = JSON.parse(String(triggerDec.selected_option_ids ?? "[]"));
          if (selected.includes(item.trigger.optionId)) {
            delivered.push(item);
          }
        }
      }
    }

    return delivered;
  }

  /**
   * Restore engine state from saved data.
   */
  restoreState(phaseIndex: number, state: EngineState): void {
    if (state === "PLAYING" && (phaseIndex < 0 || phaseIndex >= this.scenario.phases.length)) {
      console.error(`[Engine] Invalid restore: phaseIndex ${phaseIndex} out of range`);
      this.failSession(`invalid_restore_phaseIndex_${phaseIndex}`);
      return;
    }
    this.currentPhaseIndex = phaseIndex;
    this.state = state;

    // Estimate scenarioStartTime based on previous phases' durations
    let elapsedBeforeThisPhase = 0;
    for (let i = 0; i < phaseIndex; i++) {
      elapsedBeforeThisPhase += this.scenario.phases[i].timeLimitSeconds;
    }
    this.scenarioStartTime = Date.now() - elapsedBeforeThisPhase * 1000;

    auditLog(this.session.sessionId, "engine_restored", { phaseIndex, state });

    if (this.state === "PLAYING") {
      const phase = this.scenario.phases[this.currentPhaseIndex];
      if (phase) {
        // Check if a decision for this phase already exists in the DB
        const decisions = getDecisionsBySession(this.session.sessionId);
        const phaseAlreadyDecided = decisions.some((d) => d.phase_id === phase.id);

        if (phaseAlreadyDecided) {
          // Decision was submitted before the disconnect — skip countdown and
          // wait for the client ack (it auto-acks on restore if no consequence
          // dialog is open); the failsafe covers clients that never ack.
          this.decisionSubmitted = true;
          this.remainingSeconds = 0;
          auditLog(this.session.sessionId, "engine_restored_pending_advance", { phaseId: phase.id });
          this.scheduleAutoAdvance("advance-failsafe", PHASE_ADVANCE_FAILSAFE_MS);
        } else {
          this.remainingSeconds = phase.timeLimitSeconds; // Default to full time on restore
          this.decisionSubmitted = false;
          this.phaseStartTime = Date.now();
          this.decisionShownTime = Date.now();

          // Resume countdown and event scheduling
          this.startCountdown(phase);
          this.scheduleIncomingEvents(phase);

          if (this.session.group === "B") {
            this.scheduleMediaFeedItems();
          }
        }
      }
    }

    // For TUTORIAL state: startTutorial() is called externally from gameSocket.ts
    // after SESSION_RESTORED is emitted, to guarantee correct message ordering.
  }

  /** Returns the effective state, falling back to prePauseState when PAUSED. */
  getEffectiveState(): EngineState {
    if (this.state === "PAUSED" && this.prePauseState) {
      return this.prePauseState;
    }
    return this.state;
  }

  /**
   * Transition to briefing state.
   */
  startBriefing(): void {
    this.state = "BRIEFING";
    auditLog(this.session.sessionId, "state_change", { to: "BRIEFING" });
    this.persistState();
  }

  /**
   * Start tutorial phase — sends TUTORIAL_START to client, schedules 180s failsafe.
   * Phase 1 timer and events do NOT start until TUTORIAL_COMPLETE is received.
   * Called from gameSocket.ts (not from within restoreState, to preserve SESSION_RESTORED ordering).
   */
  startTutorial(): void {
    this.state = "TUTORIAL";
    this.currentPhaseIndex = 0;
    auditLog(this.session.sessionId, "tutorial_start");
    this.persistState();

    const phase = this.scenario.phases[0];
    this.socket.emit(SocketEvent.TUTORIAL_START, {
      phase,
      totalPhases: this.scenario.phases.length,
    });

    // Failsafe: auto-start scenario if TUTORIAL_COMPLETE never arrives (e.g. client bug)
    this.timerManager.scheduleTimeout("tutorial-failsafe", 180_000, () => {
      if (this.state === "TUTORIAL") {
        auditLog(this.session.sessionId, "tutorial_failsafe_triggered");
        try {
          this.startScenario();
        } catch (err) {
          console.error(`[Engine] Tutorial failsafe failed:`, err);
          this.failSession(`tutorial_failsafe_error: ${(err as Error)?.message ?? "unknown"}`);
        }
      }
    });
  }

  /**
   * Start the scenario (first phase). Called after TUTORIAL_COMPLETE.
   */
  startScenario(): void {
    this.timerManager.clearTimeout("tutorial-failsafe");
    this.state = "PLAYING";
    this.scenarioStartTime = Date.now();
    this.currentPhaseIndex = 0;
    auditLog(this.session.sessionId, "scenario_start", { scenarioId: this.scenario.id });
    this.persistState();
    this.startPhase(0);
  }

  /**
   * Start a specific phase.
   */
  private startPhase(index: number): void {
    const phase = this.scenario.phases[index];
    if (!phase) {
      this.completeScenario();
      return;
    }

    this.state = "PLAYING";
    this.currentPhaseIndex = index;
    this.decisionSubmitted = false;
    this.phaseStartTime = Date.now();
    this.decisionShownTime = Date.now();
    this.remainingSeconds = phase.timeLimitSeconds;

    auditLog(this.session.sessionId, "phase_start", { phaseId: phase.id, index });
    this.persistState();

    // Send phase start to client
    this.socket.emit(SocketEvent.PHASE_START, {
      phase,
      phaseIndex: index,
      totalPhases: this.scenario.phases.length,
    });

    console.log(`[Engine] Phase ${index} started: ${phase.id}`);

    // Schedule incoming events
    this.scheduleIncomingEvents(phase);

    // Schedule media feed items for Group B
    if (this.session.group === "B" && this.scenario.mediaFeed) {
      this.scheduleMediaFeedItems();
    }

    // Start countdown timer (1s interval) — also handles timeout
    this.startCountdown(phase);
  }

  private startCountdown(phase: Phase): void {
    const timerId = `phase-timer-${phase.id}`;
    const phaseIndexAtStart = this.currentPhaseIndex;

    this.timerManager.scheduleInterval(timerId, 1000, () => {
      // Guard: stop stale interval when phase has advanced or engine is paused.
      if (this.state !== "PLAYING" || this.currentPhaseIndex !== phaseIndexAtStart) {
        console.log(`[Engine] Cleaning up stale interval for phase ${phase.id} (Current index: ${this.currentPhaseIndex})`);
        this.timerManager.clearInterval(timerId);
        return;
      }

      this.remainingSeconds--;

      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = 0;
        console.log(`[Engine] Phase ${phase.id} timed out`);
        this.timerManager.clearInterval(timerId);
        try {
          this.socket.emit(SocketEvent.TIMER_UPDATE, { remainingSeconds: 0, phaseId: phase.id });
        } catch (err) {
          console.error(`[Engine] Failed to emit TIMER_UPDATE(0) for ${phase.id}:`, err);
        }
        this.handleTimeout(phase);
        return;
      }

      try {
        this.socket.emit(SocketEvent.TIMER_UPDATE, {
          remainingSeconds: this.remainingSeconds,
          phaseId: phase.id,
        });
      } catch (err) {
        // Emit failure is non-fatal — the countdown continues so the phase can still
        // time out correctly even if the client is temporarily unreachable.
        console.error(`[Engine] Failed to emit TIMER_UPDATE(${this.remainingSeconds}) for ${phase.id}:`, err);
      }
    });
  }

  /**
   * Schedule incoming events with their delay offsets.
   */
  private scheduleIncomingEvents(phase: Phase): void {
    const elapsedInPhase = phase.timeLimitSeconds - this.remainingSeconds;

    for (const event of phase.incomingEvents) {
      // Triggered events are delivered after a decision, not on the timeline.
      if (event.trigger) continue;

      const delayMs = (event.delaySeconds - elapsedInPhase) * 1000;
      
      if (delayMs <= 0) {
        // Emit immediately if it already happened or should happen now
        this.socket.emit(SocketEvent.INCOMING_EVENT, event);
        auditLog(this.session.sessionId, "event_sent_immediate", { eventId: event.id, phaseId: phase.id });
      } else {
        this.timerManager.scheduleTimeout(
          `event-${event.id}`,
          delayMs,
          () => {
            this.socket.emit(SocketEvent.INCOMING_EVENT, event);
            auditLog(this.session.sessionId, "event_sent", { eventId: event.id, phaseId: phase.id });
          }
        );
      }
    }
  }

  /**
   * Schedule media feed items based on global scenario time.
   */
  private scheduleMediaFeedItems(): void {
    if (!this.scenario.mediaFeed) return;

    const elapsed = Date.now() - this.scenarioStartTime;

    for (const item of this.scenario.mediaFeed) {
      if (item.appearAfterSeconds === undefined) continue;

      const targetMs = item.appearAfterSeconds * 1000;
      const delayMs = targetMs - elapsed;

      if (delayMs > 0) {
        this.timerManager.scheduleTimeout(
          `media-${item.id}`,
          delayMs,
          () => {
            this.socket.emit(SocketEvent.MEDIA_FEED_ITEM, item);
            auditLog(this.session.sessionId, "media_sent", { itemId: item.id });
          }
        );
      }
      // Items that should have already appeared are NOT re-sent here. Reconnect
      // restoration delivers them via SessionRestoredPayload.previousMediaItems,
      // preserving exposure completeness for mediaItemsSeenCount (FF1).
    }
  }

  /**
   * Handle a decision submission from the client.
   */
  handleDecision(payload: SubmitDecisionPayload): void {
    const phase = this.scenario.phases[this.currentPhaseIndex];
    if (!phase) return;

    if (this.decisionSubmitted) {
      const rejected: DecisionRejectedPayload = { phaseId: payload.phaseId, reason: "already_submitted" };
      this.socket.emit(SocketEvent.DECISION_REJECTED, rejected);
      auditLog(this.session.sessionId, "decision_rejected", { reason: "already_submitted", phaseId: payload.phaseId });
      return;
    }

    if (payload.phaseId !== phase.id || payload.decisionId !== phase.decision.id) {
      const rejected: DecisionRejectedPayload = { phaseId: payload.phaseId, reason: "phase_mismatch" };
      this.socket.emit(SocketEvent.DECISION_REJECTED, rejected);
      auditLog(this.session.sessionId, "decision_rejected", {
        reason: "phase_mismatch",
        expected: phase.id,
        received: payload.phaseId,
      });
      return;
    }

    const validOptionIds = new Set(phase.decision.options.map((o) => o.id));
    const invalidIds = payload.selectedOptionIds.filter((id) => !validOptionIds.has(id));
    if (invalidIds.length > 0) {
      const rejected: DecisionRejectedPayload = { phaseId: payload.phaseId, reason: "invalid_options" };
      this.socket.emit(SocketEvent.DECISION_REJECTED, rejected);
      auditLog(this.session.sessionId, "decision_rejected", { reason: "invalid_option_ids", invalidIds });
      return;
    }

    this.decisionSubmitted = true;
    const now = Date.now();

    const record: DecisionRecord = {
      sessionId: this.session.sessionId,
      phaseId: phase.id,
      decisionId: phase.decision.id,
      selectedOptionIds: payload.selectedOptionIds,
      decisionTimeMs: now - this.decisionShownTime,
      phaseElapsedMs: now - this.phaseStartTime,
      timestamp: new Date(now).toISOString(),
      timedOut: false,
      revisedDecision: payload.revisedDecision,
      eventsSeenCount: payload.eventsSeenCount,
      mediaItemsSeenCount: payload.mediaItemsSeenCount,
    };

    console.log(`[Engine] Decision submitted for phase ${phase.id}. Waiting for client ack (failsafe ${PHASE_ADVANCE_FAILSAFE_MS}ms)...`);
    insertDecision(record);
    auditLog(this.session.sessionId, "decision_submitted", record);

    this.socket.emit(SocketEvent.DECISION_CONFIRMED, {
      phaseId: phase.id,
      decisionId: phase.decision.id,
    });

    // Decision may trigger conditional consequence events (both groups — part
    // of the shared incident channel, not the A/B manipulation).
    this.checkAndScheduleTriggeredEvents(phase.id, payload.selectedOptionIds);

    // Decision may trigger conditional media items (Group B only)
    this.checkAndScheduleTriggeredMedia(phase.id, payload.selectedOptionIds);

    // Clean up phase timers
    this.clearPhaseTimers(phase.id);

    // Do NOT advance yet: the client shows the consequence dialog and the
    // participant may read it at their own pace. The next phase (incl. timer)
    // starts only when the client sends READY_FOR_NEXT_PHASE — with a failsafe
    // so a crashed client cannot block the session forever.
    this.scheduleAutoAdvance("advance-failsafe", PHASE_ADVANCE_FAILSAFE_MS);
  }

  /**
   * Client acknowledged the consequence dialog ("Zur nächsten Phase").
   * Advances immediately. Idempotent: after the advance, decisionSubmitted is
   * reset by startPhase(), so duplicate acks are no-ops.
   */
  continueAfterDecision(): void {
    if (this.getEffectiveState() !== "PLAYING" || !this.decisionSubmitted) {
      // Duplicate acks (client retry) land here after the phase advanced — expected.
      console.log(`[Engine] Phase-advance ack ignored (state=${this.getEffectiveState()}, decisionSubmitted=${this.decisionSubmitted})`);
      return;
    }
    this.timerManager.clearTimeout("advance-phase");
    this.timerManager.clearTimeout("advance-failsafe");
    auditLog(this.session.sessionId, "phase_advance_acknowledged", {
      phaseIndex: this.currentPhaseIndex,
    });
    try {
      this.advancePhase();
    } catch (err) {
      console.error(`[Engine] CRITICAL: advancePhase() failed on client ack:`, err);
      this.failSession(`advancePhase_ack_error: ${(err as Error)?.message ?? "unknown"}`);
    }
  }

  /**
   * Schedule an automatic phase advance. The callback is guarded so that a
   * stale timer (e.g. after the client ack already advanced the phase) is a no-op.
   */
  private scheduleAutoAdvance(timerId: string, delayMs: number): void {
    const indexAtSchedule = this.currentPhaseIndex;
    this.timerManager.scheduleTimeout(timerId, delayMs, () => {
      if (this.currentPhaseIndex !== indexAtSchedule || !this.decisionSubmitted) return;
      console.log(`[Engine] Timeout '${timerId}' triggered for phase index ${indexAtSchedule}`);
      try {
        this.advancePhase();
      } catch (err) {
        console.error(`[Engine] CRITICAL: advancePhase() failed (${timerId}):`, err);
        this.failSession(`advancePhase_error_${timerId}: ${(err as Error)?.message ?? "unknown"}`);
      }
    });
  }

  /**
   * Handle phase timeout — no decision was made.
   */
  private handleTimeout(phase: Phase): void {
    if (this.decisionSubmitted) return;

    this.decisionSubmitted = true;
    const now = Date.now();

    const record: DecisionRecord = {
      sessionId: this.session.sessionId,
      phaseId: phase.id,
      decisionId: phase.decision.id,
      selectedOptionIds: [],
      decisionTimeMs: now - this.decisionShownTime,
      phaseElapsedMs: now - this.phaseStartTime,
      timestamp: new Date(now).toISOString(),
      timedOut: true,
      revisedDecision: false,
      eventsSeenCount: 0,
      mediaItemsSeenCount: undefined,
    };

    console.log(`[Engine] Phase ${phase.id} timed out. Transitioning in ${PHASE_ADVANCE_DELAY_MS}ms...`);
    insertDecision(record);
    auditLog(this.session.sessionId, "decision_timeout", { phaseId: phase.id });

    this.socket.emit(SocketEvent.PHASE_END, {
      phaseId: phase.id,
      reason: "timeout",
    });

    this.clearPhaseTimers(phase.id);

    // Timeout case: no consequence dialog is shown, so a short fixed delay is fine.
    this.scheduleAutoAdvance("advance-phase", PHASE_ADVANCE_DELAY_MS);
  }

  /**
   * Check for incident events that are triggered by a specific decision.
   * These deliver consequence feedback (the real cost of the chosen option)
   * and are sent to BOTH groups, since the incident channel is identical for
   * A and B. The events may be defined either inline in the phase or — like
   * the time-based events — in the event addendum.
   */
  private checkAndScheduleTriggeredEvents(phaseId: string, selectedOptionIds: string[]): void {
    // Triggered consequence events can be attached to any phase, but are most
    // naturally placed in the NEXT phase's incomingEvents (they describe the
    // fallout of the just-made decision). Scan all phases to stay flexible.
    for (const phase of this.scenario.phases) {
      for (const event of phase.incomingEvents) {
        if (
          event.trigger &&
          event.trigger.phaseId === phaseId &&
          selectedOptionIds.includes(event.trigger.optionId)
        ) {
          const delayMs = (event.delayAfterTrigger ?? 0) * 1000;
          this.timerManager.scheduleTimeout(
            `event-triggered-${event.id}`,
            delayMs,
            () => {
              this.socket.emit(SocketEvent.INCOMING_EVENT, event);
              auditLog(this.session.sessionId, "event_triggered_sent", {
                eventId: event.id,
                triggeredBy: selectedOptionIds,
              });
            }
          );
        }
      }
    }
  }

  /**
   * Check for media items that are triggered by a specific decision.
   */
  private checkAndScheduleTriggeredMedia(phaseId: string, selectedOptionIds: string[]): void {
    if (!this.scenario.mediaFeed || this.session.group !== "B") return;

    for (const item of this.scenario.mediaFeed) {
      if (item.trigger && item.trigger.phaseId === phaseId && selectedOptionIds.includes(item.trigger.optionId)) {
        const delayMs = (item.delayAfterTrigger || 0) * 1000;
        
        this.timerManager.scheduleTimeout(
          `media-triggered-${item.id}`,
          delayMs,
          () => {
            this.socket.emit(SocketEvent.MEDIA_FEED_ITEM, item);
            auditLog(this.session.sessionId, "media_triggered_sent", { itemId: item.id, triggeredBy: selectedOptionIds });
          }
        );
      }
    }
  }

  /**
   * Advance to the next phase or complete the scenario.
   */
  private advancePhase(): void {
    const nextIndex = this.currentPhaseIndex + 1;
    console.log(`[Engine] Advancing from phase index ${this.currentPhaseIndex} to ${nextIndex}`);
    
    if (nextIndex >= this.scenario.phases.length) {
      console.log(`[Engine] No more phases. Completing scenario.`);
      this.completeScenario();
    } else {
      this.startPhase(nextIndex);
    }
  }

  /**
   * Complete the scenario and transition to survey.
   */
  private completeScenario(): void {
    this.state = "SURVEY";
    this.timerManager.clearAll();
    auditLog(this.session.sessionId, "scenario_complete");
    this.persistState();

    // Load actual decisions from DB for debriefing display
    const decisions = getDecisionsBySession(this.session.sessionId);

    this.socket.emit(SocketEvent.SCENARIO_COMPLETE, {
      debriefing: this.scenario.debriefing,
      expertPath: this.scenario.expertPath,
      phases: this.scenario.phases,
      decisions: decisions.map(mapDecisionRowToRecord),
    });
  }

  /**
   * Transition to debriefing state.
   */
  startDebriefing(): void {
    this.state = "DEBRIEFING";
    auditLog(this.session.sessionId, "state_change", { to: "DEBRIEFING" });
    this.persistState();
  }

  /**
   * Mark session as complete.
   */
  markComplete(): void {
    this.state = "COMPLETE";
    this.timerManager.clearAll();
    auditLog(this.session.sessionId, "state_change", { to: "COMPLETE" });
    this.persistState();
  }

  /**
   * Pause the engine (e.g., on disconnect).
   */
  pause(): void {
    if (this.state === "PAUSED") return;
    this.prePauseState = this.state;
    this.state = "PAUSED";
    this.timerManager.clearAll();
    auditLog(this.session.sessionId, "session_paused");
  }

  /**
   * Resume the engine after reconnect.
   */
  resume(): void {
    if (this.state !== "PAUSED") return;

    const targetState = this.prePauseState || "PLAYING";
    this.state = targetState;
    this.prePauseState = null;

    auditLog(this.session.sessionId, "session_resumed", { state: this.state });

    if (this.state === "PLAYING") {
      const phase = this.scenario.phases[this.currentPhaseIndex];
      if (phase) {
        if (this.decisionSubmitted) {
          // Still waiting for the client to acknowledge the consequence dialog —
          // re-arm the failsafe only; the ack (or auto-ack on restore) advances.
          this.scheduleAutoAdvance("advance-failsafe", PHASE_ADVANCE_FAILSAFE_MS);
        } else {
          // Resume countdown and event scheduling
          this.startCountdown(phase);
          this.scheduleIncomingEvents(phase);
        }
      }

      if (this.session.group === "B") {
        this.scheduleMediaFeedItems();
      }
    }

    // For TUTORIAL: gameSocket.ts will call startTutorial() after SESSION_RESTORED
    // so that TUTORIAL_START arrives after SESSION_RESTORED on the client.
  }

  /**
   * Clean up and destroy this engine instance.
   */
  destroy(): void {
    this.timerManager.clearAll();
  }

  /**
   * Clear all timers for a specific phase.
   */
  private clearPhaseTimers(phaseId: string): void {
    this.timerManager.clearInterval(`phase-timer-${phaseId}`);

    // Clear event timers for this phase
    const phase = this.scenario.phases[this.currentPhaseIndex];
    if (phase) {
      for (const event of phase.incomingEvents) {
        this.timerManager.clearTimeout(`event-${event.id}`);
      }
    }
  }
}
