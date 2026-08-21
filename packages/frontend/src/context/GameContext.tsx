import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { gameElapsedSeconds } from "../lib/utils";
import type {
  GameState,
  GameStatus,
  SessionConfig,
  Phase,
  IncomingEvent,
  MediaFeedItem,
  DecisionRecord,
  BriefingContent,
  DebriefingContent,
  ExpertDecision,
  PhaseStartPayload,
  TimerUpdatePayload,
  SessionCreatedPayload,
  SessionRestoredPayload,
  ScenarioCompletePayload,
  SubmitDecisionPayload,
  EventInteractionPayload,
  SubmitSurveyPayload,
  SubmitDemographicsPayload,
  SubmitReflectionPayload,
  RevokeSessionPayload,
  DemographicData,
  DecisionRejectedPayload,
  TutorialStartPayload,
} from "@cyber-crisis/shared";
import { SocketEvent } from "@cyber-crisis/shared";

const STORAGE_KEY_PARTICIPANT = "cybercrisis_participant_id";

const SOCKET_URL = import.meta.env.DEV ? "http://localhost:3001" : window.location.origin;

// ========================
// ACTIONS
// ========================

type GameAction =
  | { type: "SET_STATUS"; status: GameStatus }
  | { type: "SESSION_CREATED"; payload: SessionCreatedPayload }
  | { type: "SESSION_RESTORED"; payload: SessionRestoredPayload }
  | { type: "PHASE_START"; payload: PhaseStartPayload }
  | { type: "INCOMING_EVENT"; event: IncomingEvent }
  | { type: "MEDIA_FEED_ITEM"; item: MediaFeedItem }
  | { type: "TIMER_UPDATE"; payload: TimerUpdatePayload }
  | { type: "DECISION_CONFIRMED"; payload: { phaseId: string, decisionId: string, label: string, selectedOptionIds: string[] } }
  | { type: "DECISION_REJECTED"; payload: DecisionRejectedPayload }
  | { type: "TUTORIAL_START"; payload: TutorialStartPayload }
  | { type: "SCENARIO_COMPLETE"; payload: ScenarioCompletePayload }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_SERVER_ERROR"; message: string }
  | { type: "CLEAR_ERROR" }
  | { type: "MARK_EVENT_READ"; eventId: string }
  | { type: "CLEAR_EVENTS" };

// ========================
// REDUCER
// ========================

const initialState: GameState = {
  status: "loading",
  session: null,
  currentPhase: null,
  currentPhaseIndex: 0,
  totalPhases: 0,
  events: [],
  eventHistory: [],
  readEventIds: [],
  mediaItems: [],
  decisions: [],
  timerSeconds: 0,
  scenarioElapsedOffsetSeconds: 0,
  error: null,
  scenarioTitle: "",
  briefing: null,
  debriefingContent: null,
  expertPath: [],
  scenarioPhases: [],
  tutorialActive: false,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_STATUS":
      // Underage screening must not be overridden by the async SESSION_REVOKED
      // confirmation (the underage exit revokes the session in the background).
      if (state.status === "underage" && action.status === "revoked") return state;
      return { ...state, status: action.status };

    case "SESSION_CREATED":
      return {
        ...state,
        status: "consent",
        session: action.payload.session,
        scenarioTitle: action.payload.scenarioTitle,
        briefing: action.payload.briefing,
        totalPhases: action.payload.totalPhases,
      };

    case "SESSION_RESTORED": {
      const p = action.payload;
      // Reconstruct the cumulative elapsed offset from completed phase durations
      const restoredOffset = (p.scenarioPhases ?? [])
        .slice(0, p.currentPhaseIndex ?? 0)
        .reduce((sum, ph) => sum + ph.timeLimitSeconds, 0);
      // Best-effort game time at restore point (original arrival times are lost)
      const restoredGameSeconds =
        restoredOffset +
        (p.currentPhase
          ? Math.max(0, p.currentPhase.timeLimitSeconds - (p.remainingSeconds ?? 0))
          : 0);
      const restoredEvents = (p.previousEvents ?? []).map((e) => ({
        ...e,
        receivedAt: Date.now(),
        gameTimeSeconds: restoredGameSeconds,
      }));
      const restoredMedia = (p.previousMediaItems ?? []).map((m) => ({
        ...m,
        receivedAt: Date.now(),
        gameTimeSeconds: restoredGameSeconds,
      }));
      return {
        ...state,
        status: p.resumeStatus,
        session: p.session,
        scenarioTitle: p.scenarioTitle,
        briefing: p.briefing,
        totalPhases: p.totalPhases,
        currentPhase: p.currentPhase ?? null,
        currentPhaseIndex: p.currentPhaseIndex ?? 0,
        timerSeconds: p.remainingSeconds ?? 0,
        scenarioElapsedOffsetSeconds: restoredOffset,
        decisions: p.previousDecisions ?? [],
        debriefingContent: p.debriefingContent ?? null,
        expertPath: p.expertPath ?? [],
        scenarioPhases: p.scenarioPhases ?? [],
        events: [...restoredEvents].reverse(),
        eventHistory: restoredEvents,
        readEventIds: p.readEventIds ?? [],
        mediaItems: restoredMedia,
        error: null,
      };
    }

    case "TUTORIAL_START":
      return {
        ...state,
        status: "playing",
        currentPhase: action.payload.phase,
        currentPhaseIndex: 0,
        totalPhases: action.payload.totalPhases,
        timerSeconds: action.payload.phase.timeLimitSeconds, // Static — timer not running yet
        scenarioElapsedOffsetSeconds: 0,
        tutorialActive: true,
      };

    case "PHASE_START": {
      // Beim Phasenwechsel: Alle bisherigen Events als gelesen markieren
      const allCurrentEventIds = state.events.map((e) => e.id);
      const newReadEventIds = Array.from(new Set([...state.readEventIds, ...allCurrentEventIds]));

      return {
        ...state,
        status: "playing",
        currentPhase: action.payload.phase,
        currentPhaseIndex: action.payload.phaseIndex,
        totalPhases: action.payload.totalPhases,
        events: state.events, // Nicht leeren, sondern behalten
        readEventIds: newReadEventIds,
        timerSeconds: action.payload.phase.timeLimitSeconds,
        scenarioElapsedOffsetSeconds:
          action.payload.phaseIndex > 0
            ? state.scenarioElapsedOffsetSeconds + (state.currentPhase?.timeLimitSeconds ?? 0)
            : 0,
        tutorialActive: false, // Tutorial ends when first real phase starts
      };
    }

    case "INCOMING_EVENT": {
      if (state.events.some((e) => e.id === action.event.id)) return state;
      const newEvent = {
        ...action.event,
        receivedAt: Date.now(),
        gameTimeSeconds: gameElapsedSeconds(state),
      };
      return {
        ...state,
        events: [newEvent, ...state.events],
        eventHistory: [...state.eventHistory, newEvent],
      };
    }

    case "MARK_EVENT_READ":
      if (state.readEventIds.includes(action.eventId)) return state;
      return {
        ...state,
        readEventIds: [...state.readEventIds, action.eventId],
      };

    case "MEDIA_FEED_ITEM":
      if (state.mediaItems.some((m) => m.id === action.item.id)) return state;
      return {
        ...state,
        mediaItems: [
          { ...action.item, receivedAt: Date.now(), gameTimeSeconds: gameElapsedSeconds(state) },
          ...state.mediaItems,
        ],
      };

    case "TIMER_UPDATE":
      // Ignoriere Timer-Updates für falsche Phasen (Stale Timers vom Backend)
      if (state.currentPhase && action.payload.phaseId !== state.currentPhase.id) {
        return state;
      }
      return {
        ...state,
        timerSeconds: action.payload.remainingSeconds,
      };

    case "DECISION_CONFIRMED": {
      const decisionRecord: DecisionRecord & { label?: string } = {
        sessionId: state.session?.sessionId ?? "",
        phaseId: action.payload.phaseId,
        decisionId: action.payload.decisionId,
        label: action.payload.label,
        selectedOptionIds: action.payload.selectedOptionIds,
        decisionTimeMs: 0,
        phaseElapsedMs: 0,
        timestamp: new Date().toISOString(),
        timedOut: false,
        revisedDecision: false,
        eventsSeenCount: 0,
      };
      return {
        ...state,
        decisions: [...state.decisions, decisionRecord],
        error: null, // Clear any prior decision rejection error
      };
    }

    case "DECISION_REJECTED": {
      let message: string;
      if (action.payload.reason === "already_submitted") {
        message = "Für diese Phase wurde bereits eine Entscheidung registriert. Ihre erste Auswahl bleibt gültig.";
      } else {
        message = "Die Entscheidung konnte nicht übermittelt werden. Bitte versuchen Sie es erneut.";
      }
      return { ...state, error: message };
    }

    case "SCENARIO_COMPLETE":
      return {
        ...state,
        status: "survey",
        debriefingContent: action.payload.debriefing,
        expertPath: action.payload.expertPath,
        scenarioPhases: action.payload.phases,
        decisions: action.payload.decisions,
      };

    case "SET_ERROR":
      return { ...state, status: "error", error: action.error };

    case "SET_SERVER_ERROR":
      // Non-fatal server message — store for display without forcing error screen.
      // If the error arrives while auto-rejoining (status "loading"), fall back to
      // the welcome screen so the participant is not stuck on "Lade…".
      if (state.status === "loading") {
        return { ...state, status: "onboarding", error: action.message };
      }
      return { ...state, error: action.message };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "CLEAR_EVENTS":
      return { ...state, events: [], mediaItems: [], readEventIds: [] };

    default:
      return state;
  }
}

// ========================
// CONTEXT
// ========================

interface GameContextType {
  state: GameState;
  socket: Socket | null;
  connected: boolean;
  joinSession: (participantId: string) => void;
  submitDemographics: (demographics: DemographicData) => void;
  readyForNextPhase: () => void;
  submitDecision: (payload: SubmitDecisionPayload, label: string) => void;
  sendEventInteraction: (payload: EventInteractionPayload) => void;
  markEventRead: (eventId: string) => void;
  submitSurvey: (payload: SubmitSurveyPayload) => void;
  submitReflection: (text: string) => void;
  revokeSession: (reason?: string) => void;
  setStatus: (status: GameStatus) => void;
  completeTutorial: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const socketRef = useRef<Socket | null>(null);
  const pendingDecisionRef = useRef<{ phaseId: string, decisionId: string, label: string, selectedOptionIds: string[] } | null>(null);
  const [connected, setConnected] = React.useState(false);

  useEffect(() => {
    if (["complete", "revoked", "error", "underage"].includes(state.status)) {
      sessionStorage.removeItem(STORAGE_KEY_PARTICIPANT);
    }
  }, [state.status]);

  // Ref mirror of status for use inside socket listeners (registered once)
  const statusRef = useRef(state.status);
  statusRef.current = state.status;

  // Initialize socket
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      const savedParticipantId = sessionStorage.getItem(STORAGE_KEY_PARTICIPANT);
      if (savedParticipantId) {
        socket.emit(SocketEvent.JOIN_SESSION, {
          participantId: savedParticipantId,
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        });
      } else {
        dispatch({ type: "SET_STATUS", status: "onboarding" });
      }
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on(SocketEvent.SESSION_CREATED, (payload: SessionCreatedPayload) => {
      // Persist the ID only after the server accepted it — prevents reload
      // loops with IDs that were rejected or belong to finished sessions.
      sessionStorage.setItem(STORAGE_KEY_PARTICIPANT, payload.session.participantId);
      dispatch({ type: "SESSION_CREATED", payload });
    });

    socket.on(SocketEvent.SESSION_RESTORED, (payload: SessionRestoredPayload) => {
      sessionStorage.setItem(STORAGE_KEY_PARTICIPANT, payload.session.participantId);
      dispatch({ type: "SESSION_RESTORED", payload });
    });

    socket.on(SocketEvent.PHASE_START, (payload: PhaseStartPayload) => {
      dispatch({ type: "PHASE_START", payload });
    });

    socket.on(SocketEvent.INCOMING_EVENT, (event: IncomingEvent) => {
      dispatch({ type: "INCOMING_EVENT", event });
    });

    socket.on(SocketEvent.MEDIA_FEED_ITEM, (item: MediaFeedItem) => {
      dispatch({ type: "MEDIA_FEED_ITEM", item });
    });

    socket.on(SocketEvent.TIMER_UPDATE, (payload: TimerUpdatePayload) => {
      dispatch({ type: "TIMER_UPDATE", payload });
    });

    socket.on(SocketEvent.DECISION_CONFIRMED, (data: { phaseId: string, decisionId: string }) => {
      const pending = pendingDecisionRef.current;
      if (pending && pending.phaseId === data.phaseId && pending.decisionId === data.decisionId) {
        dispatch({ type: "DECISION_CONFIRMED", payload: pending });
        pendingDecisionRef.current = null;
      }
    });

    socket.on(SocketEvent.DECISION_REJECTED, (payload: DecisionRejectedPayload) => {
      pendingDecisionRef.current = null;
      dispatch({ type: "DECISION_REJECTED", payload });
    });

    socket.on(SocketEvent.TUTORIAL_START, (payload: TutorialStartPayload) => {
      dispatch({ type: "TUTORIAL_START", payload });
    });

    socket.on(SocketEvent.SCENARIO_COMPLETE, (payload: ScenarioCompletePayload) => {
      dispatch({ type: "SCENARIO_COMPLETE", payload });
    });

    socket.on(SocketEvent.ERROR, (data: { message: string }) => {
      console.error("[Game] Server error:", data.message);
      // A join failure (during auto-rejoin or from the welcome screen) means the
      // stored ID is unusable — drop it so reloads don't repeat the same error.
      if (statusRef.current === "loading" || statusRef.current === "onboarding") {
        sessionStorage.removeItem(STORAGE_KEY_PARTICIPANT);
      }
      // Non-fatal errors are only logged. Fatal errors (no session mapping etc.)
      // are already handled by the backend before they reach the client.
      // Expose the message for display in components that listen to state.error
      // but avoid transitioning to the full "error" page for recoverable issues.
      dispatch({ type: "SET_SERVER_ERROR", message: data.message });
    });

    socket.on(SocketEvent.SESSION_REVOKED, () => {
      dispatch({ type: "SET_STATUS", status: "revoked" });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinSession = useCallback((participantId: string) => {
    dispatch({ type: "CLEAR_ERROR" });
    socketRef.current?.emit(SocketEvent.JOIN_SESSION, {
      participantId,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    });
  }, []);

  const submitDemographics = useCallback((demographics: DemographicData) => {
    socketRef.current?.emit(SocketEvent.SUBMIT_DEMOGRAPHICS, { demographics });
    dispatch({ type: "SET_STATUS", status: "briefing" });
  }, []);

  const readyForNextPhase = useCallback(() => {
    socketRef.current?.emit(SocketEvent.READY_FOR_NEXT_PHASE);
  }, []);

  const submitDecision = useCallback((payload: SubmitDecisionPayload, label: string) => {
    pendingDecisionRef.current = {
      phaseId: payload.phaseId,
      decisionId: payload.decisionId,
      label,
      selectedOptionIds: payload.selectedOptionIds,
    };
    socketRef.current?.emit(SocketEvent.SUBMIT_DECISION, payload);
  }, []);

  const sendEventInteraction = useCallback((payload: EventInteractionPayload) => {
    socketRef.current?.emit(SocketEvent.EVENT_INTERACTION, payload);
  }, []);

  const markEventRead = useCallback((eventId: string) => {
    dispatch({ type: "MARK_EVENT_READ", eventId });
  }, []);

  const submitSurvey = useCallback((payload: SubmitSurveyPayload) => {
    socketRef.current?.emit(SocketEvent.SUBMIT_SURVEY, payload);
  }, []);

  const submitReflection = useCallback((text: string) => {
    const payload: SubmitReflectionPayload = { text };
    socketRef.current?.emit(SocketEvent.SUBMIT_REFLECTION, payload);
  }, []);

  const revokeSession = useCallback((reason?: string) => {
    sessionStorage.removeItem(STORAGE_KEY_PARTICIPANT);
    const payload: RevokeSessionPayload = { reason };
    socketRef.current?.emit(SocketEvent.REVOKE_SESSION, payload);
  }, []);

  const setStatus = useCallback((status: GameStatus) => {
    dispatch({ type: "SET_STATUS", status });
  }, []);

  const completeTutorial = useCallback(() => {
    socketRef.current?.emit(SocketEvent.TUTORIAL_COMPLETE);
  }, []);

  return (
    <GameContext.Provider
      value={{
        state,
        socket: socketRef.current,
        connected,
        joinSession,
        submitDemographics,
        readyForNextPhase,
        submitDecision,
        sendEventInteraction,
        markEventRead,
        submitSurvey,
        submitReflection,
        revokeSession,
        setStatus,
        completeTutorial,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}