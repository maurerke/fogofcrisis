import type { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import type {
  Scenario,
  JoinSessionPayload,
  SubmitDecisionPayload,
  EventInteractionPayload,
  SubmitSurveyPayload,
  SubmitDemographicsPayload,
  SubmitReflectionPayload,
  RevokeSessionPayload,
  SessionConfig,
  GameStatus,
  SessionRestoredPayload,
  DemographicData,
} from "@cyber-crisis/shared";
import { SocketEvent } from "@cyber-crisis/shared";
import type { EngineState } from "../engine/scenarioEngine";
import { ScenarioEngine } from "../engine/scenarioEngine";
import {
  createSession,
  getSessionByParticipant,
  getNextGroupAssignment,
  updateSessionStatus,
  abandonSessionIfIncomplete,
  resumeSessionIfNotComplete,
  updateDemographics,
  insertEventInteraction,
  getReadEventIds,
  insertSurveyResponse,
  completeSession,
  revokeSession,
  auditLog,
  getDecisionsBySession,
} from "../db/database";
import { config } from "../config/env";
import { mapDecisionRowToRecord } from "../utils/mappers";

interface SessionRow {
  session_id: string;
  participant_id: string;
  group_assignment: "A" | "B";
  scenario_id: string;
  started_at: string;
  status: string;
  demographics_json?: string;
  engine_state?: EngineState;
  current_phase_index?: number;
}

// Active engine instances per session
const engines = new Map<string, ScenarioEngine>();
// Map socketId to sessionId for cleanup
const socketToSession = new Map<string, string>();
// Disconnect timers for reconnect grace period
const disconnectTimers = new Map<string, NodeJS.Timeout>();

export function setupGameSocket(io: Server, scenario: Scenario): void {
  io.on("connection", (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    socket.on(SocketEvent.JOIN_SESSION, (payload: JoinSessionPayload) => {
      try {
        handleJoinSession(io, socket, scenario, payload);
      } catch (err) {
        console.error(`[WS] Error in JOIN_SESSION:`, err);
        socket.emit(SocketEvent.ERROR, { message: "Failed to join session." });
      }
    });

    socket.on(SocketEvent.SUBMIT_DEMOGRAPHICS, (payload: SubmitDemographicsPayload) => {
      try {
        handleDemographics(socket, payload);
      } catch (err) {
        console.error(`[WS] Error in SUBMIT_DEMOGRAPHICS:`, err);
        socket.emit(SocketEvent.ERROR, { message: "Failed to submit demographics." });
      }
    });

    socket.on(SocketEvent.READY_FOR_NEXT_PHASE, () => {
      try {
        handleReadyForNextPhase(socket);
      } catch (err) {
        console.error(`[WS] Error in READY_FOR_NEXT_PHASE:`, err);
        socket.emit(SocketEvent.ERROR, { message: "Failed to advance phase." });
      }
    });

    socket.on(SocketEvent.SUBMIT_DECISION, (payload: SubmitDecisionPayload) => {
      try {
        handleDecision(socket, payload);
      } catch (err) {
        console.error(`[WS] Error in SUBMIT_DECISION:`, err);
        socket.emit(SocketEvent.ERROR, { message: "Failed to submit decision." });
      }
    });

    socket.on(SocketEvent.EVENT_INTERACTION, (payload: EventInteractionPayload) => {
      try {
        handleEventInteraction(socket, payload);
      } catch (err) {
        console.error(`[WS] Error in EVENT_INTERACTION:`, err);
      }
    });

    socket.on(SocketEvent.SUBMIT_SURVEY, (payload: SubmitSurveyPayload) => {
      try {
        handleSurvey(socket, payload);
      } catch (err) {
        console.error(`[WS] Error in SUBMIT_SURVEY:`, err);
        socket.emit(SocketEvent.ERROR, { message: "Failed to submit survey." });
      }
    });

    socket.on(SocketEvent.SUBMIT_REFLECTION, (payload: SubmitReflectionPayload) => {
      try {
        handleReflection(socket, payload);
      } catch (err) {
        console.error(`[WS] Error in SUBMIT_REFLECTION:`, err);
      }
    });

    socket.on(SocketEvent.REVOKE_SESSION, (payload: RevokeSessionPayload) => {
      try {
        handleRevoke(socket, payload);
      } catch (err) {
        console.error(`[WS] Error in REVOKE_SESSION:`, err);
        socket.emit(SocketEvent.ERROR, { message: "Failed to revoke session." });
      }
    });

    socket.on(SocketEvent.TUTORIAL_COMPLETE, () => {
      try {
        handleTutorialComplete(socket);
      } catch (err) {
        console.error(`[WS] Error in TUTORIAL_COMPLETE:`, err);
      }
    });

    socket.on("disconnect", (reason: string) => {
      try {
        handleDisconnect(socket, reason);
      } catch (err) {
        console.error(`[WS] Error in disconnect handler:`, err);
      }
    });
  });
}

function handleJoinSession(
  io: Server,
  socket: Socket,
  scenario: Scenario,
  payload: JoinSessionPayload
): void {
  const { participantId, userAgent, screenResolution } = payload;

  if (!participantId || participantId.trim().length === 0) {
    socket.emit(SocketEvent.ERROR, { message: "Participant ID is required." });
    return;
  }

  // Validate participantId format: 3–80 chars, alphanumeric + dash/underscore only
  const cleanId = participantId.trim();
  if (cleanId.length < 3 || cleanId.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
    socket.emit(SocketEvent.ERROR, {
      message: "Ungültige Teilnahme-ID. Nur Buchstaben, Ziffern, Bindestrich und Unterstrich erlaubt (3–80 Zeichen).",
    });
    auditLog(null, "join_rejected_invalid_id", { participantId: cleanId.substring(0, 20) });
    return;
  }

  // Check for existing session (reconnect) — always use the validated, trimmed ID
  const existing = getSessionByParticipant(cleanId) as SessionRow | undefined;

  if (existing) {
    if (["completed", "abandoned_revoked", "abandoned_underage"].includes(existing.status)) {
      console.log(`[WS] Participant ${cleanId} tried to join but session is ${existing.status}`);
      socket.emit(SocketEvent.ERROR, {
        message: existing.status === "abandoned_revoked"
          ? "Diese Teilnahme-ID wurde bereits verwendet und die Teilnahme beendet."
          : "Diese Teilnahme wurde bereits abgeschlossen."
      });
      return;
    }

    const sessionId = existing.session_id;
    console.log(`[WS] Reconnecting participant ${cleanId} to session ${sessionId}`);

    const disconnectTimer = disconnectTimers.get(sessionId);
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimers.delete(sessionId);
    }

    const sessionConfig: SessionConfig = {
      sessionId,
      participantId: cleanId,
      group: existing.group_assignment,
      scenarioId: scenario.id,
      startedAt: existing.started_at,
    };

    let engine = engines.get(sessionId);
    let resumeStatus: GameStatus;

    if (engine) {
      engine.updateSocket(socket);
      engine.resume();
      resumeStatus = mapEngineStateToGameStatus(engine.getEffectiveState());
    } else {
      // Restore from explicit persisted state; fall back to decisions heuristic only if missing
      // (e.g. very old session rows created before the engine_state column existed).
      let engineState: EngineState = (existing.engine_state as EngineState) ?? "ONBOARDING";
      let phaseIndex = existing.current_phase_index ?? 0;

      if (!existing.engine_state) {
        const decisions = getDecisionsBySession(sessionId);
        phaseIndex = decisions.length;
        if (existing.demographics_json) engineState = "BRIEFING";
        const isOngoing = ["active", "paused", "abandoned"].includes(existing.status);
        if (phaseIndex > 0 || (isOngoing && existing.demographics_json)) {
          engineState = phaseIndex < scenario.phases.length ? "PLAYING" : "SURVEY";
        }
      }

      // A PAUSED snapshot resumes into its pre-pause state on reconnect
      if (engineState === "PAUSED") engineState = "PLAYING";

      engine = new ScenarioEngine(sessionConfig, scenario, socket, io);
      engine.restoreState(phaseIndex, engineState);
      engines.set(sessionId, engine);
      resumeStatus = mapEngineStateToGameStatus(engineState);
    }

    resumeSessionIfNotComplete(sessionId);

    // Remove any stale socket mapping for this session.
    // Fixes race condition: if JOIN_SESSION arrives before the old socket's disconnect event,
    // the stale entry would cause handleDisconnect to pause the already-resumed engine.
    for (const [oldSocketId, sid] of socketToSession) {
      if (sid === sessionId && oldSocketId !== socket.id) {
        socketToSession.delete(oldSocketId);
        console.log(`[WS] Cleared stale socket mapping: ${oldSocketId} → ${sessionId}`);
        break;
      }
    }
    socketToSession.set(socket.id, sessionId);

    const restorePayload: SessionRestoredPayload = {
      session: sessionConfig,
      scenarioTitle: scenario.title,
      briefing: scenario.briefing,
      totalPhases: scenario.phases.length,
      resumeStatus,
    };

    if (engine && resumeStatus === "playing") {
      const phaseIndex = engine.getCurrentPhaseIndex();
      const currentPhase = scenario.phases[phaseIndex];
      restorePayload.currentPhase = currentPhase;
      restorePayload.currentPhaseIndex = phaseIndex;
      restorePayload.remainingSeconds = engine.getRemainingSeconds();
      restorePayload.previousEvents = engine.getDeliveredEvents();
      restorePayload.previousMediaItems = engine.getDeliveredMediaItems();
      restorePayload.readEventIds = getReadEventIds(sessionId);
      // Always include decisions for the playing state (AP1 fix: enables correct
      // alreadySubmitted detection after reconnect).
      const decisions = getDecisionsBySession(sessionId);
      restorePayload.previousDecisions = decisions.map(mapDecisionRowToRecord);
      restorePayload.decisionSubmittedForCurrentPhase = currentPhase
        ? decisions.some((d) => d.phase_id === currentPhase.id)
        : false;
    }

    if (resumeStatus === "survey" || resumeStatus === "debriefing" || resumeStatus === "complete") {
      const decisions = getDecisionsBySession(sessionId);
      restorePayload.previousDecisions = decisions.map(mapDecisionRowToRecord);
      restorePayload.debriefingContent = scenario.debriefing;
      restorePayload.expertPath = scenario.expertPath;
      restorePayload.scenarioPhases = scenario.phases;
      // Group B needs the delivered media items even after the scenario is over:
      // the debriefing transparency section lists every disinformation item shown.
      restorePayload.previousMediaItems = engine?.getDeliveredMediaItems() ?? [];
    }

    socket.emit(SocketEvent.SESSION_RESTORED, restorePayload);
    auditLog(sessionId, "reconnect", { socketId: socket.id, resumeStatus });

    // After SESSION_RESTORED: emit TUTORIAL_START if engine is in TUTORIAL state.
    // Must be emitted AFTER SESSION_RESTORED so the client has session context first.
    if (engine && engine.getEffectiveState() === "TUTORIAL") {
      engine.startTutorial();
    }

    return;
  }

  // Create new session
  const sessionId = uuidv4();
  const group = getNextGroupAssignment();

  // Cap technical context fields against oversized payloads
  const safeUserAgent = typeof userAgent === "string" ? userAgent.substring(0, 512) : "";
  const safeResolution = typeof screenResolution === "string" ? screenResolution.substring(0, 32) : "";

  createSession(sessionId, cleanId, group, scenario.id, scenario.version, safeUserAgent, safeResolution);

  const sessionConfig: SessionConfig = {
    sessionId,
    participantId: cleanId,
    group,
    scenarioId: scenario.id,
    startedAt: new Date().toISOString(),
  };

  const engine = new ScenarioEngine(sessionConfig, scenario, socket, io);
  engines.set(sessionId, engine);
  socketToSession.set(socket.id, sessionId);

  socket.emit(SocketEvent.SESSION_CREATED, {
    session: sessionConfig,
    scenarioTitle: scenario.title,
    briefing: scenario.briefing,
    totalPhases: scenario.phases.length,
  });

  auditLog(sessionId, "session_created", { group, participantId: cleanId });
  console.log(`[WS] New session created: ${sessionId} (Group ${group}) for participant ${cleanId}`);
}

function handleDemographics(socket: Socket, payload: SubmitDemographicsPayload): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) return;

  // Guard against oversized payloads (max 5 KB after serialisation)
  const serialised = JSON.stringify(payload.demographics ?? {});
  if (serialised.length > 5_000) {
    socket.emit(SocketEvent.ERROR, { message: "Demographiedaten überschreiten die maximal erlaubte Größe." });
    return;
  }

  // Server-side validation of required Likert fields (B3)
  const demo: DemographicData = payload.demographics;
  const missingFields: string[] = [];
  if (!demo.irExperience || demo.irExperience < 1 || demo.irExperience > 5) missingFields.push("irExperience");
  if (!demo.crisisCommExperience || demo.crisisCommExperience < 1 || demo.crisisCommExperience > 5) missingFields.push("crisisCommExperience");
  if (!demo.disinfoAwareness || demo.disinfoAwareness < 1 || demo.disinfoAwareness > 5) missingFields.push("disinfoAwareness");
  if (!demo.socialMediaUsage) missingFields.push("socialMediaUsage");
  if (!demo.itExperienceYears) missingFields.push("itExperienceYears");
  if (missingFields.length > 0) {
    socket.emit(SocketEvent.ERROR, { message: `Pflichtfelder fehlen oder ungültig: ${missingFields.join(", ")}` });
    return;
  }

  updateDemographics(sessionId, payload.demographics);
  auditLog(sessionId, "demographics_submitted");

  const engine = engines.get(sessionId);
  if (engine) {
    engine.startBriefing();
  }
}

function handleReadyForNextPhase(socket: Socket): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) {
    // Reconnect race: the ack can arrive before the re-JOIN is processed.
    // The client retries, so dropping it here is safe — but log it for diagnosis.
    console.warn(`[WS] READY_FOR_NEXT_PHASE from unmapped socket ${socket.id} — dropped (awaiting re-join)`);
    return;
  }

  const engine = engines.get(sessionId);
  if (!engine) {
    console.warn(`[WS] READY_FOR_NEXT_PHASE for session ${sessionId} without engine — dropped`);
    return;
  }

  // Use effective state so PAUSED sessions (mid-reconnect) resolve correctly
  const state = engine.getEffectiveState();
  if (state === "BRIEFING" || state === "ONBOARDING") {
    // Start tutorial instead of scenario directly — Phase 1 timer starts only
    // after TUTORIAL_COMPLETE to avoid polluting decision_time_ms (AP4).
    engine.startTutorial();
  } else if (state === "PLAYING") {
    // Client acknowledged the consequence dialog — advance to the next phase.
    // Idempotent: no-op unless a decision for the current phase was submitted.
    engine.continueAfterDecision();
  } else if (state === "SURVEY") {
    engine.startDebriefing();
  } else if (state === "DEBRIEFING") {
    engine.markComplete();
    completeSession(sessionId);
  }
}

function handleTutorialComplete(socket: Socket): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) return;

  const engine = engines.get(sessionId);
  if (!engine) return;

  // Idempotent: only proceed if engine is still in TUTORIAL state
  if (engine.getEffectiveState() !== "TUTORIAL") return;

  engine.startScenario();
}

function handleDecision(socket: Socket, payload: SubmitDecisionPayload): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) return;

  const engine = engines.get(sessionId);
  if (!engine) return;

  engine.handleDecision(payload);
}

function handleEventInteraction(socket: Socket, payload: EventInteractionPayload): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) return;

  // Validate untrusted payload before it reaches the DB — do not trust the client.
  if (
    typeof payload.eventId !== "string" ||
    payload.eventId.length < 1 ||
    payload.eventId.length > 128
  ) {
    auditLog(sessionId, "event_interaction_rejected", { reason: "invalid_eventId" });
    return;
  }

  if (payload.eventType !== "incident" && payload.eventType !== "media") {
    auditLog(sessionId, "event_interaction_rejected", { reason: "invalid_eventType" });
    return;
  }

  if (typeof payload.firstSeenAtMs !== "number" || !Number.isFinite(payload.firstSeenAtMs) || payload.firstSeenAtMs < 0) {
    auditLog(sessionId, "event_interaction_rejected", { reason: "invalid_firstSeenAtMs" });
    return;
  }

  const clickedAt =
    payload.clickedAt !== undefined && Number.isFinite(payload.clickedAt) && payload.clickedAt >= 0
      ? payload.clickedAt
      : undefined;

  const dwellTimeMs =
    payload.dwellTimeMs !== undefined && Number.isFinite(payload.dwellTimeMs) && payload.dwellTimeMs >= 0
      ? payload.dwellTimeMs
      : undefined;

  insertEventInteraction(sessionId, {
    sessionId,
    eventId: payload.eventId,
    eventType: payload.eventType,
    firstSeenAtMs: payload.firstSeenAtMs,
    clickedAt,
    dwellTimeMs,
  });
}

function handleSurvey(socket: Socket, payload: SubmitSurveyPayload): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) return;

  // Guard against oversized survey payloads (max 20 KB)
  const serialised = JSON.stringify(payload.responses ?? {});
  if (serialised.length > 20_000) {
    socket.emit(SocketEvent.ERROR, { message: "Survey-Antworten überschreiten die maximal erlaubte Größe." });
    return;
  }

  const inserted = insertSurveyResponse(sessionId, {
    sessionId,
    instrument: payload.instrument,
    responses: payload.responses,
    completedAt: new Date().toISOString(),
  });

  if (inserted) {
    auditLog(sessionId, "survey_submitted", { instrument: payload.instrument });
  } else {
    auditLog(sessionId, "survey_duplicate_ignored", { instrument: payload.instrument });
  }

  const engine = engines.get(sessionId);
  if (engine) {
    // After the custom questionnaire the engine moves to debriefing.
    // (Group B's manipulation check arrives afterwards; the transition is idempotent.)
    if (payload.instrument === "custom_post" || payload.instrument === "manipulation_check") {
      engine.startDebriefing();
    }
  }
}

function handleReflection(socket: Socket, payload: SubmitReflectionPayload): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) return;

  // Cap free-text length (client enforces 500 chars; do not trust the client)
  const text = typeof payload.text === "string" ? payload.text.substring(0, 2000) : "";
  if (!text.trim()) return;

  const inserted = insertSurveyResponse(sessionId, {
    sessionId,
    instrument: "debriefing_reflection",
    responses: { reflection_text: text },
    completedAt: new Date().toISOString(),
  });

  auditLog(sessionId, inserted ? "reflection_submitted" : "survey_duplicate_ignored");
}

function handleRevoke(socket: Socket, payload: RevokeSessionPayload): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) return;

  // Clear any pending disconnect timers
  const disconnectTimer = disconnectTimers.get(sessionId);
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimers.delete(sessionId);
  }

  // Underage exits are recorded with their own status so that screening
  // dropouts are distinguishable from withdrawals in the data set.
  const status = payload.reason === "underage" ? "abandoned_underage" : "abandoned_revoked";
  revokeSession(sessionId, status);
  auditLog(sessionId, "session_revoked", { reason: payload.reason || "user_request" });

  const engine = engines.get(sessionId);
  if (engine) {
    engine.pause();
    engine.destroy();
    engines.delete(sessionId);
  }

  socketToSession.delete(socket.id);
  socket.emit(SocketEvent.SESSION_REVOKED, { sessionId });
  console.log(`[WS] Session revoked: ${sessionId}`);
}

function mapEngineStateToGameStatus(state: EngineState): GameStatus {
  switch (state) {
    case "ONBOARDING": return "onboarding";
    case "BRIEFING": return "briefing";
    case "TUTORIAL": return "playing"; // Tutorial shows workspace in playing mode, no timer running
    case "PLAYING": return "playing";
    case "SURVEY": return "survey";
    case "DEBRIEFING": return "debriefing";
    case "COMPLETE": return "complete";
    default: return "onboarding";
  }
}

function handleDisconnect(socket: Socket, reason: string): void {
  const sessionId = socketToSession.get(socket.id);
  if (!sessionId) return;

  console.log(`[WS] Client disconnected: ${socket.id} (session: ${sessionId}, reason: ${reason})`);

  const engine = engines.get(sessionId);
  if (engine) {
    const effectiveState = engine.getEffectiveState();

    // Do not pause or abandon sessions that are already complete (AP2 fix).
    // A tab close after the thank-you page must not overwrite completed status.
    if (effectiveState === "COMPLETE") {
      engine.destroy();
      engines.delete(sessionId);
      socketToSession.delete(socket.id);
      auditLog(sessionId, "disconnected_after_complete", { socketId: socket.id, reason });
      return;
    }

    engine.pause();
    updateSessionStatus(sessionId, "paused");

    // Set a timeout to abandon the session if no reconnect
    const timer = setTimeout(() => {
      // Use safe update that never overwrites completed/revoked/flagged status (AP2 defense-in-depth)
      abandonSessionIfIncomplete(sessionId);
      engine.destroy();
      engines.delete(sessionId);
      disconnectTimers.delete(sessionId);
      auditLog(sessionId, "session_abandoned");
      console.log(`[WS] Session abandoned: ${sessionId}`);
    }, config.reconnectTimeoutMs);

    disconnectTimers.set(sessionId, timer);
  }

  socketToSession.delete(socket.id);
  auditLog(sessionId, "disconnected", { socketId: socket.id, reason });
}
