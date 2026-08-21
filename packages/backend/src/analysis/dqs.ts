import type { Scenario, ExpertDecision } from "@cyber-crisis/shared";

// ========================
// Decision Quality Score (DQS) — Definition
//
// DQS_Phase_binary  = weight_phase * indicator(selected ∩ optimalOptions ≠ ∅)
// DQS_Phase_partial = weight_phase * |selected ∩ optimalOptions| / |optimalOptions|
//
// DQS_Session_binary  = SUM(DQS_Phase_binary)  / SUM(weight_phase)
// DQS_Session_partial = SUM(DQS_Phase_partial) / SUM(weight_phase)
//
// Wertebereich jeweils [0, 1].
// ========================

export interface PhaseQuality {
  phaseId: string;
  decisionId: string;
  selectedOptionIds: string[];
  optimalOptionIds: string[];
  weight: number;
  dqsBinary: number;    // 0 oder weight
  dqsPartial: number;   // anteiliges Match × weight
  dqsNormBinary: number;  // nach Normierung [0,1]
  dqsNormPartial: number; // nach Normierung [0,1]
}

export interface SessionQuality {
  phases: PhaseQuality[];
  totalWeight: number;
  dqsSessionBinary: number;
  dqsSessionPartial: number;
}

/**
 * Berechnet den DQS für eine einzelne Phase.
 */
export function computePhaseDQS(
  selectedOptionIds: string[],
  expert: ExpertDecision
): { binary: number; partial: number } {
  const optimal = expert.optimalOptionIds;
  const matchCount = selectedOptionIds.filter((id) => optimal.includes(id)).length;
  
  return {
    binary: matchCount > 0 ? 1 : 0,
    partial: optimal.length > 0 ? matchCount / optimal.length : 0,
  };
}

/**
 * Berechnet den DQS für eine Session anhand ihrer Decisions und des Expert Paths.
 * @param decisions  Zeilen aus der decisions-Tabelle (one per phase)
 * @param expertPath Expert-Pfad aus dem Szenario
 */
export function computeSessionDQS(
  decisions: Array<{ phase_id: string; decision_id: string; selected_option_ids: string }>,
  expertPath: ExpertDecision[]
): SessionQuality {
  const phases: PhaseQuality[] = [];

  for (const expert of expertPath) {
    const dec = decisions.find(
      (d) => d.phase_id === expert.phaseId && d.decision_id === expert.decisionId
    );

    if (!dec) continue;

    const selected: string[] = safeParseJson(dec.selected_option_ids, []);
    const optimal: string[] = expert.optimalOptionIds;

    const matchCount = selected.filter((id) => optimal.includes(id)).length;
    const hasMatch = matchCount > 0;
    const partialRatio = optimal.length > 0 ? matchCount / optimal.length : 0;

    phases.push({
      phaseId: expert.phaseId,
      decisionId: expert.decisionId,
      selectedOptionIds: selected,
      optimalOptionIds: optimal,
      weight: expert.weight,
      dqsBinary: hasMatch ? expert.weight : 0,
      dqsPartial: partialRatio * expert.weight,
      dqsNormBinary: hasMatch ? 1 : 0,
      dqsNormPartial: partialRatio,
    });
  }

  const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0);

  const dqsSessionBinary =
    totalWeight > 0
      ? phases.reduce((sum, p) => sum + p.dqsBinary, 0) / totalWeight
      : 0;

  const dqsSessionPartial =
    totalWeight > 0
      ? phases.reduce((sum, p) => sum + p.dqsPartial, 0) / totalWeight
      : 0;

  return {
    phases,
    totalWeight,
    dqsSessionBinary: clamp01(dqsSessionBinary),
    dqsSessionPartial: clamp01(dqsSessionPartial),
  };
}

/**
 * Berechnet TLX-Gesamtwert (arithmetisches Mittel der 6 Dimensionen, Performance invertiert).
 */
export function computeTlxTotal(responses: Record<string, number | string>): number | null {
  const keys = ["mental_demand", "physical_demand", "temporal_demand", "performance", "effort", "frustration"];
  const values: number[] = [];

  for (const key of keys) {
    const raw = responses[key];
    if (raw === undefined || raw === null || raw === "") return null;
    let val = Number(raw);
    if (isNaN(val)) return null;
    if (key === "performance") val = 100 - val; // Inversion (niedrig = gut)
    values.push(val);
  }

  if (values.length !== 6) return null;
  return values.reduce((a, b) => a + b, 0) / 6;
}

// ========================
// Helpers
// ========================

export function safeParseJson<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
