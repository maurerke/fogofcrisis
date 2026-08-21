import { Router, Request, Response } from "express";
import {
  getAllSessions,
  getAllDecisions,
  getAllEventInteractions,
  getAllSurveyResponses,
  getDb,
} from "../db/database";
import { computeSessionDQS, computeTlxTotal, safeParseJson } from "../analysis/dqs";
import {
  buildMcDeliveredSet,
  buildGroupStats,
  cohensD,
  mean,
  sd,
  median,
} from "../analysis/aggregations";
import type { Scenario } from "@cyber-crisis/shared";
import { requireApiKey } from "./auth";

const router = Router();
router.use(requireApiKey);

let scenarioRef: Scenario | null = null;

export function setScenarioForDashboard(scenario: Scenario): void {
  scenarioRef = scenario;
}

// ========================
// Local row types
// ========================

interface SessionRow {
  session_id: string;
  participant_id: string;
  group_assignment: "A" | "B";
  scenario_id: string;
  scenario_version: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  engine_state: string;
  current_phase_index: number;
  demographics_json: string | null;
  user_agent: string | null;
  screen_resolution: string | null;
  flagged_reason: string | null;
}

interface DecisionRow {
  session_id: string;
  phase_id: string;
  decision_id: string;
  selected_option_ids: string;
  decision_time_ms: number;
  phase_elapsed_ms: number;
  timed_out: number;
  revised_decision: number;
  events_seen_count: number;
  media_items_seen_count: number | null;
  group_name: string;
}

interface EventRow {
  session_id: string;
  event_id: string;
  event_type: "incident" | "media";
  first_seen_at_ms: number;
  clicked_at_ms: number | null;
  dwell_time_ms: number | null;
  group_name: string;
}

interface SurveyRow {
  session_id: string;
  instrument: string;
  responses_json: string;
  group_name: string;
}

interface AuditRow {
  id: number;
  session_id: string | null;
  event_type: string;
  payload_json: string | null;
  timestamp: string;
}

// ========================
// Helpers
// ========================

const ENGINE_STATE_ORDER = ["ONBOARDING", "BRIEFING", "TUTORIAL", "PLAYING", "SURVEY", "DEBRIEFING", "COMPLETE"];

function stateIndex(state: string): number {
  const i = ENGINE_STATE_ORDER.indexOf(state);
  return i >= 0 ? i : 0;
}

function durationSec(s: SessionRow): number | null {
  if (!s.completed_at || !s.started_at) return null;
  const start = new Date(s.started_at).getTime();
  const end = new Date(s.completed_at).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  return Math.round((end - start) / 1000);
}

function isoDate(ts: string): string {
  return ts.split("T")[0].split(" ")[0];
}

function splitByGroup<T extends { group_assignment?: string; group_name?: string }>(
  rows: T[]
): { A: T[]; B: T[] } {
  const group = (r: T) => (r.group_assignment ?? r.group_name) as string;
  return {
    A: rows.filter((r) => group(r) === "A"),
    B: rows.filter((r) => group(r) === "B"),
  };
}

// ========================
// GET /api/admin/scenario-meta
// ========================

router.get("/scenario-meta", (_req: Request, res: Response) => {
  if (!scenarioRef) {
    res.status(503).json({ error: "Scenario not loaded" });
    return;
  }
  const sc = scenarioRef;
  const phases = sc.phases.map((phase) => {
    const expert = sc.expertPath.find(
      (e) => e.phaseId === phase.id && e.decisionId === phase.decision.id
    );
    return {
      phaseId: phase.id,
      title: phase.title,
      timeLimitSeconds: phase.timeLimitSeconds,
      allowMultiple: phase.decision.allowMultiple,
      decisionId: phase.decision.id,
      prompt: phase.decision.prompt,
      options: phase.decision.options.map((o) => ({ id: o.id, label: o.label })),
      optimalOptionIds: expert?.optimalOptionIds ?? [],
      weight: expert?.weight ?? 1,
    };
  });
  const mediaFeed = sc.mediaFeed ?? [];
  res.json({
    id: sc.id,
    title: sc.title,
    version: sc.version,
    phases,
    mediaFeed: {
      total: mediaFeed.length,
      disinformation: mediaFeed.filter((m) => m.isDisinformation).length,
    },
  });
});

// ========================
// GET /api/admin/dashboard/overview
// ========================

router.get("/dashboard/overview", (_req: Request, res: Response) => {
  const allSessions = getAllSessions() as unknown as SessionRow[];

  const total = allSessions.length;
  const completed = allSessions.filter((s) => s.status === "completed").length;
  const groupA = allSessions.filter((s) => s.group_assignment === "A").length;
  const groupB = allSessions.filter((s) => s.group_assignment === "B").length;

  // By status
  const statusCounts: Record<string, number> = {};
  for (const s of allSessions) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  }

  // By group × status
  const byGroupStatus: Record<string, Record<string, number>> = { A: {}, B: {} };
  for (const s of allSessions) {
    const g = s.group_assignment;
    byGroupStatus[g][s.status] = (byGroupStatus[g][s.status] ?? 0) + 1;
  }

  // Funnel
  const funnel = ENGINE_STATE_ORDER.map((state) => ({
    state,
    reached: allSessions.filter((s) => stateIndex(s.engine_state) >= stateIndex(state)).length,
  }));

  // Dropout by phase
  const dropoutByPhase: { phaseIndex: number; abandoned: number }[] = [];
  const maxPhase = scenarioRef ? scenarioRef.phases.length - 1 : 4;
  for (let i = 0; i <= maxPhase; i++) {
    dropoutByPhase.push({
      phaseIndex: i,
      abandoned: allSessions.filter(
        (s) =>
          (s.status === "abandoned" || s.status === "abandoned_revoked" || s.status === "abandoned_underage") &&
          s.current_phase_index === i
      ).length,
    });
  }

  // Recruitment timeline
  const timelineMap: Record<string, { started: number; completed: number }> = {};
  for (const s of allSessions) {
    const date = isoDate(s.started_at);
    if (!timelineMap[date]) timelineMap[date] = { started: 0, completed: 0 };
    timelineMap[date].started++;
    if (s.status === "completed") timelineMap[date].completed++;
  }
  const recruitmentTimeline = Object.entries(timelineMap)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Duration stats for completed sessions, per group
  const completedSessions = allSessions.filter((s) => s.status === "completed");
  const { A: completedA, B: completedB } = splitByGroup(completedSessions);
  const durA = completedA.map(durationSec).filter((d): d is number => d !== null);
  const durB = completedB.map(durationSec).filter((d): d is number => d !== null);

  const durationStats = (values: number[]) =>
    values.length === 0
      ? null
      : {
          n: values.length,
          meanSec: Math.round(mean(values)),
          medianSec: Math.round(median(values)),
          sd: Math.round(sd(values)),
        };

  res.json({
    totals: { all: total, completed, groupA, groupB, completionRate: total > 0 ? completed / total : 0 },
    byStatus: statusCounts,
    byGroupStatus,
    funnel,
    dropoutByPhase,
    recruitmentTimeline,
    balance: { groupA, groupB, delta: Math.abs(groupA - groupB) },
    duration: { groupA: durationStats(durA), groupB: durationStats(durB) },
  });
});

// ========================
// GET /api/admin/dashboard/demographics
// ========================

router.get("/dashboard/demographics", (_req: Request, res: Response) => {
  const allSessions = getAllSessions() as unknown as SessionRow[];

  type DistMap = { A: Record<string, number>; B: Record<string, number> };
  const dist: Record<string, DistMap> = {};

  const categoricalFields = [
    "ageRange", "gender", "itExperienceYears", "education",
    "germanProficiency", "socialMediaUsage",
  ];

  for (const field of categoricalFields) {
    dist[field] = { A: {}, B: {} };
  }

  const likertFields = ["irExperience", "crisisCommExperience", "disinfoAwareness"];
  const likertValues: Record<string, { A: number[]; B: number[] }> = {};
  for (const f of likertFields) {
    likertValues[f] = { A: [], B: [] };
  }

  const roleSamples: string[] = [];
  const contextInputDevice: Record<string, number> = {};
  const contextLocales: Record<string, number> = {};
  const contextScreenBuckets: Record<string, number> = {};

  for (const session of allSessions) {
    if (!session.demographics_json) continue;
    const demo = safeParseJson<Record<string, unknown>>(session.demographics_json, {});
    const g = session.group_assignment;

    for (const field of categoricalFields) {
      const val = String(demo[field] ?? "unknown");
      dist[field][g][val] = (dist[field][g][val] ?? 0) + 1;
    }

    for (const field of likertFields) {
      const raw = demo[field];
      if (raw !== undefined && raw !== null && raw !== "") {
        const n = Number(raw);
        if (!isNaN(n)) likertValues[field][g].push(n);
      }
    }

    const role = String(demo["role"] ?? "").trim();
    if (role && role !== "undefined") roleSamples.push(role);

    const device = String(demo["inputDevice"] ?? "");
    if (device) contextInputDevice[device] = (contextInputDevice[device] ?? 0) + 1;

    const locale = String(demo["browserLocale"] ?? "");
    if (locale) contextLocales[locale] = (contextLocales[locale] ?? 0) + 1;

    const res_ = String(session.screen_resolution ?? "");
    if (res_) {
      const width = parseInt(res_.split("x")[0], 10);
      const bucket = width >= 1920 ? "≥1920px" : width >= 1440 ? "1440–1919px" : width >= 1280 ? "1280–1439px" : "<1280px";
      contextScreenBuckets[bucket] = (contextScreenBuckets[bucket] ?? 0) + 1;
    }
  }

  const likertAgg: Record<string, { A: unknown; B: unknown }> = {};
  for (const field of likertFields) {
    const buildLikert = (values: number[]) => ({
      n: values.length,
      mean: values.length > 0 ? Math.round(mean(values) * 100) / 100 : null,
      sd: values.length > 0 ? Math.round(sd(values) * 100) / 100 : null,
      hist: [1, 2, 3, 4, 5].map((v) => values.filter((x) => x === v).length),
    });
    likertAgg[field] = { A: buildLikert(likertValues[field].A), B: buildLikert(likertValues[field].B) };
  }

  const topLocales = Object.entries(contextLocales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const screenBuckets = Object.entries(contextScreenBuckets)
    .sort((a, b) => b[1] - a[1]);

  res.json({
    ...dist,
    likert: likertAgg,
    roleSamples: roleSamples.slice(0, 50),
    context: {
      inputDevice: contextInputDevice,
      topLocales,
      screenBuckets,
    },
  });
});

// ========================
// GET /api/admin/dashboard/decision-quality
// ========================

router.get("/dashboard/decision-quality", (_req: Request, res: Response) => {
  if (!scenarioRef) {
    res.status(503).json({ error: "Scenario not loaded" });
    return;
  }
  const sc = scenarioRef;
  const allSessions = (getAllSessions() as unknown as SessionRow[]).filter(
    (s) => s.status === "completed"
  );
  const allDecisions = getAllDecisions() as unknown as DecisionRow[];

  const completedIds = new Set(allSessions.map((s) => s.session_id));
  const decisions = allDecisions.filter((d) => completedIds.has(d.session_id));

  const { A: sessionsA, B: sessionsB } = splitByGroup(allSessions);

  // DQS per session
  const dqsBinaryA: number[] = [];
  const dqsPartialA: number[] = [];
  const dqsBinaryB: number[] = [];
  const dqsPartialB: number[] = [];

  for (const session of allSessions) {
    const sessionDecs = decisions.filter((d) => d.session_id === session.session_id);
    const result = computeSessionDQS(sessionDecs, sc.expertPath);
    if (session.group_assignment === "A") {
      dqsBinaryA.push(result.dqsSessionBinary);
      dqsPartialA.push(result.dqsSessionPartial);
    } else {
      dqsBinaryB.push(result.dqsSessionBinary);
      dqsPartialB.push(result.dqsSessionPartial);
    }
  }

  // Per-phase DQS
  const perPhase = sc.phases.map((phase) => {
    const expert = sc.expertPath.find(
      (e) => e.phaseId === phase.id && e.decisionId === phase.decision.id
    );
    if (!expert) return null;

    const phaseDqsFor = (sessions: SessionRow[]) => {
      const vals: number[] = [];
      for (const session of sessions) {
        const dec = decisions.find(
          (d) => d.session_id === session.session_id && d.phase_id === phase.id
        );
        if (!dec) continue;
        const selected: string[] = safeParseJson(dec.selected_option_ids, []);
        const matchCount = selected.filter((id) => expert.optimalOptionIds.includes(id)).length;
        vals.push(matchCount > 0 ? 1 : 0);
      }
      return { dqsBinaryMean: vals.length > 0 ? mean(vals) : null, n: vals.length };
    };

    return {
      phaseId: phase.id,
      title: phase.title,
      weight: expert.weight,
      A: phaseDqsFor(sessionsA),
      B: phaseDqsFor(sessionsB),
    };
  }).filter(Boolean);

  // Answer distribution per phase
  const answerDistribution = sc.phases.map((phase) => {
    const expert = sc.expertPath.find(
      (e) => e.phaseId === phase.id && e.decisionId === phase.decision.id
    );
    const optimalIds = expert?.optimalOptionIds ?? [];

    const countFor = (sessions: SessionRow[], optionId: string): number => {
      let count = 0;
      for (const session of sessions) {
        const dec = decisions.find(
          (d) => d.session_id === session.session_id && d.phase_id === phase.id
        );
        if (!dec) continue;
        const selected: string[] = safeParseJson(dec.selected_option_ids, []);
        if (selected.includes(optionId)) count++;
      }
      return count;
    };

    return {
      phaseId: phase.id,
      decisionId: phase.decision.id,
      optimalOptionIds: optimalIds,
      options: phase.decision.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        isOptimal: optimalIds.includes(opt.id),
        A: countFor(sessionsA, opt.id),
        B: countFor(sessionsB, opt.id),
      })),
    };
  });

  res.json({
    sessionDqs: {
      binary: { A: buildGroupStats(dqsBinaryA), B: buildGroupStats(dqsBinaryB) },
      partial: { A: buildGroupStats(dqsPartialA), B: buildGroupStats(dqsPartialB) },
    },
    cohensD: {
      binary: cohensD(dqsBinaryA, dqsBinaryB),
      partial: cohensD(dqsPartialA, dqsPartialB),
    },
    perPhase,
    answerDistribution,
  });
});

// ========================
// GET /api/admin/dashboard/timing
// ========================

router.get("/dashboard/timing", (_req: Request, res: Response) => {
  if (!scenarioRef) {
    res.status(503).json({ error: "Scenario not loaded" });
    return;
  }
  const sc = scenarioRef;
  const allSessions = (getAllSessions() as unknown as SessionRow[]).filter(
    (s) => s.status === "completed"
  );
  const completedIds = new Set(allSessions.map((s) => s.session_id));
  const allDecisions = (getAllDecisions() as unknown as DecisionRow[]).filter(
    (d) => completedIds.has(d.session_id)
  );

  const timesA = allDecisions.filter((d) => d.group_name === "A").map((d) => d.decision_time_ms);
  const timesB = allDecisions.filter((d) => d.group_name === "B").map((d) => d.decision_time_ms);

  // Per-phase timing
  const perPhase = sc.phases.map((phase) => {
    const phDecs = allDecisions.filter((d) => d.phase_id === phase.id);
    const phA = phDecs.filter((d) => d.group_name === "A").map((d) => d.decision_time_ms);
    const phB = phDecs.filter((d) => d.group_name === "B").map((d) => d.decision_time_ms);
    return {
      phaseId: phase.id,
      title: phase.title,
      A: buildGroupStats(phA),
      B: buildGroupStats(phB),
    };
  });

  // Timeout and revision rates per group
  const rateFor = (decs: DecisionRow[], field: "timed_out" | "revised_decision") => {
    if (!decs.length) return 0;
    return decs.filter((d) => d[field] === 1).length / decs.length;
  };

  const decisionsA = allDecisions.filter((d) => d.group_name === "A");
  const decisionsB = allDecisions.filter((d) => d.group_name === "B");

  res.json({
    decisionTime: {
      overall: { A: buildGroupStats(timesA), B: buildGroupStats(timesB) },
      perPhase,
    },
    timeoutRate: { A: rateFor(decisionsA, "timed_out"), B: rateFor(decisionsB, "timed_out") },
    revisionRate: { A: rateFor(decisionsA, "revised_decision"), B: rateFor(decisionsB, "revised_decision") },
    cohensD: { decisionTimeOverall: cohensD(timesA, timesB) },
  });
});

// ========================
// GET /api/admin/dashboard/workload
// ========================

router.get("/dashboard/workload", (_req: Request, res: Response) => {
  const allSessions = (getAllSessions() as unknown as SessionRow[]).filter(
    (s) => s.status === "completed"
  );
  const completedIds = new Set(allSessions.map((s) => s.session_id));
  const allSurveys = (getAllSurveyResponses() as unknown as SurveyRow[]).filter(
    (s) => completedIds.has(s.session_id)
  );

  const tlxA: number[] = [];
  const tlxB: number[] = [];

  const TLX_DIMS = ["mental_demand", "physical_demand", "temporal_demand", "performance", "effort", "frustration"];
  const dimValuesA: Record<string, number[]> = {};
  const dimValuesB: Record<string, number[]> = {};
  for (const dim of TLX_DIMS) {
    dimValuesA[dim] = [];
    dimValuesB[dim] = [];
  }

  const surveyItemValues = (instrument: string, key: string): { A: number[]; B: number[] } => {
    const A: number[] = [];
    const B: number[] = [];
    for (const s of allSurveys) {
      if (s.instrument !== instrument) continue;
      const responses = safeParseJson<Record<string, unknown>>(s.responses_json, {});
      const val = responses[key];
      if (val !== undefined && val !== null && val !== "") {
        const n = Number(val);
        if (!isNaN(n)) {
          if (s.group_name === "A") A.push(n);
          else B.push(n);
        }
      }
    }
    return { A, B };
  };

  for (const survey of allSurveys) {
    if (survey.instrument !== "NASA_TLX") continue;
    const responses = safeParseJson<Record<string, number | string>>(survey.responses_json, {});
    const total = computeTlxTotal(responses);
    if (total === null) continue;

    if (survey.group_name === "A") {
      tlxA.push(total);
      for (const dim of TLX_DIMS) {
        const raw = Number(responses[dim]);
        if (!isNaN(raw)) {
          const val = dim === "performance" ? 100 - raw : raw;
          dimValuesA[dim].push(val);
        }
      }
    } else {
      tlxB.push(total);
      for (const dim of TLX_DIMS) {
        const raw = Number(responses[dim]);
        if (!isNaN(raw)) {
          const val = dim === "performance" ? 100 - raw : raw;
          dimValuesB[dim].push(val);
        }
      }
    }
  }

  const tlxDimensions = TLX_DIMS.map((dim) => ({
    dim,
    A: dimValuesA[dim].length > 0 ? Math.round(mean(dimValuesA[dim] )) : null,
    B: dimValuesB[dim].length > 0 ? Math.round(mean(dimValuesB[dim])) : null,
    A_sd: dimValuesA[dim].length > 0 ? sd(dimValuesA[dim]) : null,
    B_sd: dimValuesB[dim].length > 0 ? sd(dimValuesB[dim]) : null,
  }));

  const { A: ipA, B: ipB } = surveyItemValues("custom_post", "info_pressure");
  const { A: dcA, B: dcB } = surveyItemValues("custom_post", "decision_confidence");

  const roundD = (d: number | null) => d !== null ? Math.round(d * 100) / 100 : null;

  res.json({
    tlxTotal: { A: buildGroupStats(tlxA), B: buildGroupStats(tlxB) },
    tlxDimensions,
    infoPressure: { A: buildGroupStats(ipA), B: buildGroupStats(ipB) },
    decisionConfidence: { A: buildGroupStats(dcA), B: buildGroupStats(dcB) },
    cohensD: {
      tlxTotal: roundD(cohensD(tlxA, tlxB)),
      infoPressure: roundD(cohensD(ipA, ipB)),
      decisionConfidence: roundD(cohensD(dcA, dcB)),
    },
  });
});

// ========================
// GET /api/admin/dashboard/attention
// ========================

router.get("/dashboard/attention", (_req: Request, res: Response) => {
  const allSessions = (getAllSessions() as unknown as SessionRow[]).filter(
    (s) => s.status === "completed"
  );
  const completedIds = new Set(allSessions.map((s) => s.session_id));
  const allEvents = (getAllEventInteractions() as unknown as EventRow[]).filter(
    (e) => completedIds.has(e.session_id)
  );
  const allSurveys = (getAllSurveyResponses() as unknown as SurveyRow[]).filter(
    (s) => completedIds.has(s.session_id)
  );
  const auditRows = (getDb() as unknown as { prepare: (s: string) => { all: () => AuditRow[] } })
    .prepare("SELECT * FROM audit_log ORDER BY id ASC")
    .all();
  const mcDelivered = buildMcDeliveredSet(auditRows);

  const sessionsA = allSessions.filter((s) => s.group_assignment === "A");
  const sessionsB = allSessions.filter((s) => s.group_assignment === "B");
  const sessionsAIds = new Set(sessionsA.map((s) => s.session_id));
  const sessionsBIds = new Set(sessionsB.map((s) => s.session_id));

  // Dwell by type (Group B only for media)
  const incidentDwellA = allEvents
    .filter((e) => e.event_type === "incident" && sessionsAIds.has(e.session_id) && e.dwell_time_ms !== null)
    .map((e) => e.dwell_time_ms as number);
  const incidentDwellB = allEvents
    .filter((e) => e.event_type === "incident" && sessionsBIds.has(e.session_id) && e.dwell_time_ms !== null)
    .map((e) => e.dwell_time_ms as number);
  const mediaDwellB = allEvents
    .filter((e) => e.event_type === "media" && sessionsBIds.has(e.session_id) && e.dwell_time_ms !== null)
    .map((e) => e.dwell_time_ms as number);

  const totalDwellB = incidentDwellB.reduce((a, b) => a + b, 0) + mediaDwellB.reduce((a, b) => a + b, 0);
  const mediaShare = totalDwellB > 0 ? mediaDwellB.reduce((a, b) => a + b, 0) / totalDwellB : 0;

  // Items seen per session
  const mediaSeenPerSession = sessionsB.map((s) => {
    return allEvents.filter((e) => e.session_id === s.session_id && e.event_type === "media").length;
  });
  const incidentsSeenA = sessionsA.map((s) => {
    return allEvents.filter((e) => e.session_id === s.session_id && e.event_type === "incident").length;
  });
  const incidentsSeenB = sessionsB.map((s) => {
    return allEvents.filter((e) => e.session_id === s.session_id && e.event_type === "incident").length;
  });

  // Click rates
  const clickRateFor = (events: EventRow[]) => {
    if (!events.length) return 0;
    return events.filter((e) => e.clicked_at_ms !== null).length / events.length;
  };
  const incidentEventsA = allEvents.filter((e) => e.event_type === "incident" && sessionsAIds.has(e.session_id));
  const incidentEventsB = allEvents.filter((e) => e.event_type === "incident" && sessionsBIds.has(e.session_id));
  const mediaEventsB = allEvents.filter((e) => e.event_type === "media" && sessionsBIds.has(e.session_id));

  // Survey items
  const getSurveyItem = (sessionId: string, instrument: string, key: string): string | number | null => {
    const survey = allSurveys.find((s) => s.session_id === sessionId && s.instrument === instrument);
    if (!survey) return null;
    const responses = safeParseJson<Record<string, unknown>>(survey.responses_json, {});
    const val = responses[key];
    return val !== undefined ? val as string | number : null;
  };

  const realismA = sessionsA.map((s) => Number(getSurveyItem(s.session_id, "custom_post", "realism_perception"))).filter((n) => !isNaN(n));
  const realismB = sessionsB.map((s) => Number(getSurveyItem(s.session_id, "custom_post", "realism_perception"))).filter((n) => !isNaN(n));
  const credibilityB = sessionsB.map((s) => Number(getSurveyItem(s.session_id, "custom_post", "media_credibility_overall"))).filter((n) => !isNaN(n));

  // Media influence self-report
  const mediaInfluence: Record<string, number> = {};
  for (const s of sessionsB) {
    const val = String(getSurveyItem(s.session_id, "custom_post", "media_influence") ?? "");
    if (val && val !== "null") {
      mediaInfluence[val] = (mediaInfluence[val] ?? 0) + 1;
    }
  }

  // Manipulation check (Group B)
  const mcCorrect: number[] = [];
  const mcHistogram: Record<string, number> = {};
  let mcRealDeliveredCount = 0;

  for (const s of sessionsB) {
    if (mcDelivered.has(s.session_id)) mcRealDeliveredCount++;
    const survey = allSurveys.find((sr) => sr.session_id === s.session_id && sr.instrument === "manipulation_check");
    if (!survey) continue;
    const responses = safeParseJson<Record<string, unknown>>(survey.responses_json, {});
    const correct = Number(responses["manipulation_check_correct"]);
    if (!isNaN(correct)) mcCorrect.push(correct);
    const selected = String(responses["manipulation_check_selected"] ?? "");
    for (const item of selected.split(",").map((x) => x.trim()).filter(Boolean)) {
      mcHistogram[item] = (mcHistogram[item] ?? 0) + 1;
    }
  }

  res.json({
    dwellByType: {
      A: {
        incidentMeanMs: incidentDwellA.length > 0 ? Math.round(mean(incidentDwellA)) : null,
      },
      B: {
        incidentMeanMs: incidentDwellB.length > 0 ? Math.round(mean(incidentDwellB)) : null,
        mediaMeanMs: mediaDwellB.length > 0 ? Math.round(mean(mediaDwellB)) : null,
        mediaShare: Math.round(mediaShare * 100) / 100,
      },
    },
    mediaItemsSeen: {
      B: buildGroupStats(mediaSeenPerSession),
    },
    incidentsSeen: {
      A: buildGroupStats(incidentsSeenA),
      B: buildGroupStats(incidentsSeenB),
    },
    clickRate: {
      incident: { A: clickRateFor(incidentEventsA), B: clickRateFor(incidentEventsB) },
      media: { B: clickRateFor(mediaEventsB) },
    },
    realismPerception: {
      A: { mean: realismA.length > 0 ? Math.round(mean(realismA) * 100) / 100 : null, n: realismA.length },
      B: { mean: realismB.length > 0 ? Math.round(mean(realismB) * 100) / 100 : null, n: realismB.length },
    },
    mediaCredibility: {
      B: { mean: credibilityB.length > 0 ? Math.round(mean(credibilityB) * 100) / 100 : null, n: credibilityB.length },
    },
    mediaInfluenceSelfReport: { B: mediaInfluence },
    manipulationCheck: {
      B: {
        correctRate: mcCorrect.length > 0 ? Math.round(mean(mcCorrect) * 100) / 100 : null,
        mcRealDelivered: mcRealDeliveredCount,
        n: sessionsB.length,
        selectedHistogram: mcHistogram,
      },
    },
  });
});

// ========================
// GET /api/admin/dashboard/data-quality
// ========================

router.get("/dashboard/data-quality", (_req: Request, res: Response) => {
  const allSessions = getAllSessions() as unknown as SessionRow[];
  const allSurveys = getAllSurveyResponses() as unknown as SurveyRow[];
  const auditRows = (getDb() as unknown as { prepare: (s: string) => { all: () => AuditRow[] } })
    .prepare("SELECT * FROM audit_log ORDER BY id ASC")
    .all();

  const completedSessions = allSessions.filter((s) => s.status === "completed");

  // Attention check fails (attention_check != 3)
  const attentionCheckFails: { sessionId: string; group: string; value: number }[] = [];
  for (const survey of allSurveys) {
    if (survey.instrument !== "custom_post") continue;
    const responses = safeParseJson<Record<string, unknown>>(survey.responses_json, {});
    const val = Number(responses["attention_check"]);
    if (!isNaN(val) && val !== 3) {
      attentionCheckFails.push({
        sessionId: survey.session_id,
        group: survey.group_name,
        value: val,
      });
    }
  }

  // Speeders (< 0.5 × median duration among completed)
  const durations = completedSessions.map((s) => ({
    sessionId: s.session_id,
    group: s.group_assignment,
    durationSec: durationSec(s),
  })).filter((d) => d.durationSec !== null) as { sessionId: string; group: string; durationSec: number }[];

  const medianDur = durations.length > 0 ? median(durations.map((d) => d.durationSec)) : 0;
  const threshold = medianDur * 0.5;
  const speeders = durations
    .filter((d) => d.durationSec < threshold)
    .map((d) => ({ sessionId: d.sessionId, group: d.group, durationSec: d.durationSec, medianSec: Math.round(medianDur) }));

  // Straightliners (TLX items SD ≈ 0, threshold < 2)
  const straightliners: { sessionId: string; group: string; instrument: string; sdValue: number }[] = [];
  const TLX_DIMS = ["mental_demand", "physical_demand", "temporal_demand", "performance", "effort", "frustration"];
  for (const survey of allSurveys) {
    if (survey.instrument !== "NASA_TLX") continue;
    const responses = safeParseJson<Record<string, unknown>>(survey.responses_json, {});
    const vals = TLX_DIMS.map((d) => Number(responses[d])).filter((n) => !isNaN(n));
    if (vals.length < 4) continue;
    const s = sd(vals);
    if (s < 2) {
      straightliners.push({ sessionId: survey.session_id, group: survey.group_name, instrument: "NASA_TLX", sdValue: Math.round(s * 100) / 100 });
    }
  }

  // Flagged sessions
  const flagged = allSessions
    .filter((s) => s.status === "flagged")
    .map((s) => ({ sessionId: s.session_id, group: s.group_assignment, reason: s.flagged_reason ?? "" }));

  // Manipulation check failures (Group B only)
  const manipulationFailed: { sessionId: string; selected: string }[] = [];
  for (const survey of allSurveys) {
    if (survey.instrument !== "manipulation_check") continue;
    const session = allSessions.find((s) => s.session_id === survey.session_id);
    if (!session || session.group_assignment !== "B") continue;
    const responses = safeParseJson<Record<string, unknown>>(survey.responses_json, {});
    const correct = Number(responses["manipulation_check_correct"]);
    if (correct === 0) {
      manipulationFailed.push({
        sessionId: survey.session_id,
        selected: String(responses["manipulation_check_selected"] ?? ""),
      });
    }
  }

  // Incomplete surveys (completed sessions missing expected instruments)
  const expectedInstruments = ["NASA_TLX", "custom_post"];
  const incompleteSurveys: { sessionId: string; missing: string[] }[] = [];
  for (const session of completedSessions) {
    const sessionSurveys = allSurveys.filter((s) => s.session_id === session.session_id);
    const foundInstruments = new Set(sessionSurveys.map((s) => s.instrument));
    const missing = expectedInstruments.filter((inst) => !foundInstruments.has(inst));
    if (session.group_assignment === "B") {
      if (!foundInstruments.has("manipulation_check")) missing.push("manipulation_check");
    }
    if (missing.length > 0) {
      incompleteSurveys.push({ sessionId: session.session_id, missing });
    }
  }

  // Duplicate survey submissions ignored (from audit log)
  const duplicatesIgnored = auditRows.filter((r) => r.event_type === "survey_duplicate_ignored").length;

  res.json({
    attentionCheckFails,
    speeders,
    straightliners,
    flagged,
    manipulationFailed,
    incompleteSurveys,
    duplicatesIgnored,
  });
});

// ========================
// GET /api/admin/dashboard/freetext
// ========================

interface FreeTextEntry {
  sessionId: string;
  group: "A" | "B";
  status: string;
  completedAt: string | null;
  text: string;
}

interface MediaInfluenceEntry extends FreeTextEntry {
  mediaInfluence: string | null;
}

interface RoleFieldEntry {
  sessionId: string;
  group: "A" | "B";
  status: string;
  role: string;
  fieldOfStudy: string;
}

function sortByCompletedDesc<T extends { completedAt: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.completedAt === null && b.completedAt === null) return 0;
    if (a.completedAt === null) return 1;
    if (b.completedAt === null) return -1;
    return b.completedAt.localeCompare(a.completedAt);
  });
}

router.get("/dashboard/freetext", (_req: Request, res: Response) => {
  const allSessions = getAllSessions() as unknown as SessionRow[];
  const allSurveys = getAllSurveyResponses() as unknown as SurveyRow[];
  const sessionById = new Map(allSessions.map((s) => [s.session_id, s]));

  const reflections: FreeTextEntry[] = [];
  const influenceFactors: FreeTextEntry[] = [];
  const mediaInfluenceDetail: MediaInfluenceEntry[] = [];

  for (const survey of allSurveys) {
    const session = sessionById.get(survey.session_id);
    const group = (session?.group_assignment ?? survey.group_name) as "A" | "B";
    const status = session?.status ?? "unknown";
    const completedAt = session?.completed_at ?? null;

    if (survey.instrument === "debriefing_reflection") {
      const responses = safeParseJson<Record<string, unknown>>(survey.responses_json, {});
      const text = String(responses["reflection_text"] ?? "").trim();
      if (text) {
        reflections.push({ sessionId: survey.session_id, group, status, completedAt, text });
      }
    }

    if (survey.instrument === "custom_post") {
      const responses = safeParseJson<Record<string, unknown>>(survey.responses_json, {});

      const influenceText = String(responses["influence_factors"] ?? "").trim();
      if (influenceText) {
        influenceFactors.push({ sessionId: survey.session_id, group, status, completedAt, text: influenceText });
      }

      const mediaText = String(responses["media_influence_detail"] ?? "").trim();
      if (mediaText) {
        const mediaInfluenceRaw = responses["media_influence"];
        const mediaInfluence =
          mediaInfluenceRaw !== undefined && mediaInfluenceRaw !== null && mediaInfluenceRaw !== ""
            ? String(mediaInfluenceRaw)
            : null;
        mediaInfluenceDetail.push({
          sessionId: survey.session_id,
          group,
          status,
          completedAt,
          text: mediaText,
          mediaInfluence,
        });
      }
    }
  }

  const rolesAndFieldsRaw: { entry: RoleFieldEntry; completedAt: string | null }[] = [];
  for (const session of allSessions) {
    if (!session.demographics_json) continue;
    const demo = safeParseJson<Record<string, unknown>>(session.demographics_json, {});
    const role = String(demo["role"] ?? "").trim();
    const fieldOfStudy = String(demo["fieldOfStudy"] ?? "").trim();
    if (!role && !fieldOfStudy) continue;
    rolesAndFieldsRaw.push({
      entry: {
        sessionId: session.session_id,
        group: session.group_assignment,
        status: session.status,
        role,
        fieldOfStudy,
      },
      completedAt: session.completed_at,
    });
  }
  const rolesAndFields = sortByCompletedDesc(rolesAndFieldsRaw).map((r) => r.entry);

  res.json({
    reflections: sortByCompletedDesc(reflections),
    influenceFactors: sortByCompletedDesc(influenceFactors),
    mediaInfluenceDetail: sortByCompletedDesc(mediaInfluenceDetail),
    rolesAndFields,
    counts: {
      reflections: reflections.length,
      influenceFactors: influenceFactors.length,
      mediaInfluenceDetail: mediaInfluenceDetail.length,
      rolesAndFields: rolesAndFields.length,
    },
  });
});

export default router;
