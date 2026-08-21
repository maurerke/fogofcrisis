// ========================
// SZENARIO-DEFINITION
// ========================

/** Das gesamte Szenario, geladen aus JSON */
export interface Scenario {
  id: string;
  title: string;
  description: string;
  version: string;
  estimatedDurationMinutes: number;
  briefing: BriefingContent;
  phases: Phase[];
  debriefing: DebriefingContent;
  expertPath: ExpertDecision[];
  mediaFeed?: MediaFeedItem[];
}

export interface BriefingContent {
  role: string;
  situation: string;
  objectives: string[];
  resources: string[];
}

export interface DebriefingContent {
  title: string;
  summary: string;
  keyLessons: string[];
  disclaimer: string;
}

export interface Phase {
  id: string;
  title: string;
  timeLimitSeconds: number;
  incomingEvents: IncomingEvent[];
  decision: DecisionPoint;
}

export interface IncomingEvent {
  id: string;
  /**
   * Zeitgesteuerte Auslieferung relativ zum Phasenstart. Bei getriggerten
   * Events (trigger gesetzt) wird delaySeconds ignoriert; die Auslieferung
   * erfolgt stattdessen nach der Entscheidung.
   */
  delaySeconds: number;
  /**
   * Optionaler Konsequenz-Trigger. Ist trigger gesetzt, wird das Event NICHT
   * zeitgesteuert ausgeliefert, sondern erst nachdem in der angegebenen Phase
   * die angegebene Option gewaehlt wurde. Anders als beim Medienfeed gilt dies
   * fuer BEIDE Gruppen (A und B) identisch — es ist Teil des gemeinsamen
   * Incident-Kanals und damit kein Bestandteil der A/B-Manipulation.
   */
  trigger?: {
    phaseId: string;
    optionId: string;
  };
  /** Verzoegerung der getriggerten Auslieferung nach der Entscheidung (Sekunden). */
  delayAfterTrigger?: number;
  type: EventType;
  source: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  metadata?: Record<string, string>;
}

export enum EventType {
  SYSTEM_ALERT = "system_alert",
  EMAIL = "email",
  PHONE_CALL = "phone_call",
  REPORT = "report",
  CHAT_MESSAGE = "chat_message",
}

export interface DecisionPoint {
  id: string;
  prompt: string;
  context: string;
  options: DecisionOption[];
  allowMultiple: boolean;
  requireConfirmation: boolean;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  consequencePreview?: string;
}

export interface ExpertDecision {
  phaseId: string;
  decisionId: string;
  optimalOptionIds: string[];
  weight: number;
  rationale: string;
}

// ========================
// MEDIA FEED (nur Gruppe B)
// ========================

export interface MediaFeedItem {
  id: string;
  appearAfterSeconds?: number;
  trigger?: {
    phaseId: string;
    optionId: string;
  };
  delayAfterTrigger?: number;
  type: MediaItemType;
  source: string;
  sourceVerified: boolean;
  content: string;
  imageUrl?: string;
  isDisinformation: boolean;
  emotionalTone: "neutral" | "alarming" | "accusatory" | "panicking" | "reassuring" | "threatening" | "suspicious";
  engagementMetrics?: {
    likes: number;
    shares: number;
    comments: number;
  };
}

export enum MediaItemType {
  TWEET = "tweet",
  NEWS_HEADLINE = "news_headline",
  NEWS_TICKER = "news_ticker",
  FORUM_POST = "forum_post",
  OFFICIAL_STATEMENT = "official_statement",
  TELEGRAM_POST = "telegram_post",
}

// ========================
// SESSION & METRIKEN
// ========================

export interface SessionConfig {
  sessionId: string;
  participantId: string;
  group: "A" | "B";
  scenarioId: string;
  startedAt: string;
}

export interface DecisionRecord {
  sessionId: string;
  phaseId: string;
  decisionId: string;
  selectedOptionIds: string[];
  decisionTimeMs: number;
  phaseElapsedMs: number;
  timestamp: string;
  timedOut: boolean;
  revisedDecision: boolean;
  eventsSeenCount: number;
  mediaItemsSeenCount?: number;
}

export interface EventInteraction {
  sessionId: string;
  eventId: string;
  eventType: "incident" | "media";
  firstSeenAtMs: number;
  clickedAt?: number;
  dwellTimeMs?: number;
}

export interface SurveyResponse {
  sessionId: string;
  instrument: "NASA_TLX" | "custom_post" | "manipulation_check" | "debriefing_reflection";
  responses: Record<string, number | string>;
  completedAt: string;
}

export interface DemographicData {
  ageRange: string;
  gender: string;
  itExperienceYears: string;
  role: string;
  irExperience: number | undefined;
  crisisCommExperience: number | undefined;
  // P1: neue Kontrollvariablen
  education?: string;
  fieldOfStudy?: string;
  germanProficiency?: string;
  socialMediaUsage?: string;
  disinfoAwareness?: number;
  // Auto-erfasste Kontextvariablen
  timezone?: string;
  browserLocale?: string;
  inputDevice?: string;
}

// ========================
// GAME STATE
// ========================

export type GameStatus =
  | "loading"
  | "onboarding"
  | "consent"
  | "demographics"
  | "briefing"
  | "playing"
  | "survey"
  | "debriefing"
  | "complete"
  | "revoked"
  | "underage"
  | "error";

export interface GameState {
  status: GameStatus;
  session: SessionConfig | null;
  currentPhase: Phase | null;
  currentPhaseIndex: number;
  totalPhases: number;
  events: (IncomingEvent & { receivedAt: number; gameTimeSeconds: number })[];
  eventHistory: (IncomingEvent & { receivedAt: number; gameTimeSeconds: number })[];
  readEventIds: string[];
  mediaItems: (MediaFeedItem & { receivedAt: number; gameTimeSeconds: number })[];
  decisions: (DecisionRecord & { label?: string })[];
  timerSeconds: number;
  scenarioElapsedOffsetSeconds: number;
  error: string | null;
  scenarioTitle: string;
  briefing: BriefingContent | null;
  debriefingContent: DebriefingContent | null;
  expertPath: ExpertDecision[];
  scenarioPhases: Phase[];
  tutorialActive: boolean;
}

// ========================
// WEBSOCKET EVENTS
// ========================

export enum SocketEvent {
  // Client → Server
  JOIN_SESSION = "join_session",
  SUBMIT_DECISION = "submit_decision",
  EVENT_INTERACTION = "event_interaction",
  SUBMIT_SURVEY = "submit_survey",
  SUBMIT_DEMOGRAPHICS = "submit_demographics",
  READY_FOR_NEXT_PHASE = "ready_for_next_phase",
  REVOKE_SESSION = "revoke_session",
  SUBMIT_REFLECTION = "submit_reflection",
  TUTORIAL_COMPLETE = "tutorial_complete",

  // Server → Client
  SESSION_CREATED = "session_created",
  SESSION_RESTORED = "session_restored",
  PHASE_START = "phase_start",
  INCOMING_EVENT = "incoming_event",
  MEDIA_FEED_ITEM = "media_feed_item",
  TIMER_UPDATE = "timer_update",
  PHASE_END = "phase_end",
  DECISION_CONFIRMED = "decision_confirmed",
  DECISION_REJECTED = "decision_rejected",
  TUTORIAL_START = "tutorial_start",
  SCENARIO_COMPLETE = "scenario_complete",
  SESSION_REVOKED = "session_revoked",
  ERROR = "error",
}

// ========================
// SOCKET PAYLOADS
// ========================

export interface JoinSessionPayload {
  participantId: string;
  userAgent: string;
  screenResolution: string;
}

export interface SubmitDecisionPayload {
  phaseId: string;
  decisionId: string;
  selectedOptionIds: string[];
  revisedDecision: boolean;
  eventsSeenCount: number;
  mediaItemsSeenCount?: number;
}

export interface EventInteractionPayload {
  eventId: string;
  eventType: "incident" | "media";
  firstSeenAtMs: number;
  clickedAt?: number;
  dwellTimeMs?: number;
}

export interface SubmitSurveyPayload {
  instrument: "NASA_TLX" | "custom_post" | "manipulation_check";
  responses: Record<string, number | string>;
}

export interface SubmitDemographicsPayload {
  demographics: DemographicData;
}

export interface SubmitReflectionPayload {
  text: string;
}

export interface RevokeSessionPayload {
  reason?: string;
}

export interface PhaseStartPayload {
  phase: Phase;
  phaseIndex: number;
  totalPhases: number;
}

export interface TimerUpdatePayload {
  remainingSeconds: number;
  phaseId: string;
}

export interface SessionCreatedPayload {
  session: SessionConfig;
  scenarioTitle: string;
  briefing: BriefingContent;
  totalPhases: number;
}

export interface ScenarioCompletePayload {
  debriefing: DebriefingContent;
  expertPath: ExpertDecision[];
  phases: Phase[];
  decisions: DecisionRecord[];
}

export interface SessionRestoredPayload {
  session: SessionConfig;
  scenarioTitle: string;
  briefing: BriefingContent;
  totalPhases: number;
  resumeStatus: GameStatus;
  currentPhase?: Phase;
  currentPhaseIndex?: number;
  remainingSeconds?: number;
  previousEvents?: IncomingEvent[];
  previousMediaItems?: MediaFeedItem[];
  readEventIds?: string[];
  previousDecisions?: DecisionRecord[];
  decisionSubmittedForCurrentPhase?: boolean;
  debriefingContent?: DebriefingContent;
  expertPath?: ExpertDecision[];
  scenarioPhases?: Phase[];
}

export interface DecisionRejectedPayload {
  phaseId: string;
  reason: "already_submitted" | "phase_mismatch" | "invalid_options";
}

export interface TutorialStartPayload {
  phase: Phase;
  totalPhases: number;
}
