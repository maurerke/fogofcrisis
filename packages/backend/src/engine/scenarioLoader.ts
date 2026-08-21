import fs from "fs";
import path from "path";
import type { Scenario, IncomingEvent } from "@cyber-crisis/shared";

/**
 * Laedt ein Szenario und merged optional ein Event-Addendum.
 * Konvention: liegt neben der Szenario-JSON eine Datei <name>_events_addendum.json,
 * werden deren additions[phaseId] an die incomingEvents der jeweiligen Phase
 * angehaengt und nach delaySeconds sortiert. Gruppe A und B bekommen exakt
 * diesen gemeinsamen Mail-Fluss (Methoden-Guardrail).
 */
export function loadScenario(filePath: string): Scenario {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Scenario file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  let scenario: Scenario;

  try {
    scenario = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in scenario file: ${filePath}`);
  }

  // Optionales Event-Addendum
  const addendumPath = filePath.replace(/\.json$/i, "_events_addendum.json");
  if (fs.existsSync(addendumPath)) {
    try {
      const addendumRaw = fs.readFileSync(addendumPath, "utf-8");
      const addendum: {
        additions?: Record<string, IncomingEvent[]>;
      } = JSON.parse(addendumRaw);

      if (addendum.additions) {
        let mergedCount = 0;
        for (const phase of scenario.phases) {
          const extra = addendum.additions[phase.id];
          if (Array.isArray(extra) && extra.length > 0) {
            phase.incomingEvents = [...phase.incomingEvents, ...extra].sort(
              (a, b) => a.delaySeconds - b.delaySeconds,
            );
            mergedCount += extra.length;
          }
        }
        console.log(
          `[Scenario] Merged ${mergedCount} events from addendum ${path.basename(addendumPath)}`,
        );
      }
    } catch (err) {
      console.warn(
        `[Scenario] Addendum ${addendumPath} vorhanden, aber nicht lesbar:`,
        err,
      );
    }
  }

  validateScenario(scenario);
  console.log(
    `[Scenario] Loaded: "${scenario.title}" (v${scenario.version}) with ${scenario.phases.length} phases, ` +
      `${scenario.phases.reduce((n, p) => n + p.incomingEvents.length, 0)} events total`,
  );
  return scenario;
}

function validateScenario(s: Scenario): void {
  const errors: string[] = [];

  if (!s.id) errors.push("Missing scenario.id");
  if (!s.title) errors.push("Missing scenario.title");
  if (!s.version) errors.push("Missing scenario.version");
  if (!s.briefing) errors.push("Missing scenario.briefing");
  if (!s.debriefing) errors.push("Missing scenario.debriefing");
  if (!Array.isArray(s.phases) || s.phases.length === 0) {
    errors.push("Scenario must have at least one phase");
  }
  if (!Array.isArray(s.expertPath) || s.expertPath.length === 0) {
    errors.push("Scenario must have an expertPath");
  }

  // Validate briefing
  if (s.briefing) {
    if (!s.briefing.role) errors.push("Missing briefing.role");
    if (!s.briefing.situation) errors.push("Missing briefing.situation");
    if (!Array.isArray(s.briefing.objectives)) errors.push("briefing.objectives must be an array");
    if (!Array.isArray(s.briefing.resources)) errors.push("briefing.resources must be an array");
  }

  // Validate phases
  const phaseIds = new Set<string>();
  const decisionIds = new Set<string>();
  const allOptionIds = new Set<string>();

  for (const phase of s.phases || []) {
    if (!phase.id) errors.push("Phase missing id");
    if (phaseIds.has(phase.id)) errors.push(`Duplicate phase id: ${phase.id}`);
    phaseIds.add(phase.id);

    if (!phase.title) errors.push(`Phase ${phase.id}: missing title`);
    if (typeof phase.timeLimitSeconds !== "number" || phase.timeLimitSeconds <= 0) {
      errors.push(`Phase ${phase.id}: timeLimitSeconds must be a positive number`);
    }

    if (!phase.decision) {
      errors.push(`Phase ${phase.id}: missing decision`);
    } else {
      if (!phase.decision.id) errors.push(`Phase ${phase.id}: decision missing id`);
      decisionIds.add(phase.decision.id);
      if (!phase.decision.prompt) errors.push(`Phase ${phase.id}: decision missing prompt`);
      if (!Array.isArray(phase.decision.options) || phase.decision.options.length < 2) {
        errors.push(`Phase ${phase.id}: decision must have at least 2 options`);
      }
      for (const opt of phase.decision.options || []) {
        if (!opt.id) errors.push(`Phase ${phase.id}: option missing id`);
        if (!opt.label) errors.push(`Phase ${phase.id}: option missing label`);
        allOptionIds.add(opt.id);
      }
    }

    // Validate incoming events
    for (const event of phase.incomingEvents || []) {
      if (!event.id) errors.push(`Phase ${phase.id}: event missing id`);
      if (typeof event.delaySeconds !== "number") {
        errors.push(`Phase ${phase.id}: event ${event.id} missing delaySeconds`);
      }
    }
  }

  // Validate triggered incident events (trigger references must resolve)
  for (const phase of s.phases || []) {
    for (const event of phase.incomingEvents || []) {
      if (!event.trigger) continue;
      if (!phaseIds.has(event.trigger.phaseId)) {
        errors.push(
          `Event ${event.id}: trigger.phaseId "${event.trigger.phaseId}" does not exist`,
        );
      }
      if (!allOptionIds.has(event.trigger.optionId)) {
        errors.push(
          `Event ${event.id}: trigger.optionId "${event.trigger.optionId}" does not exist`,
        );
      }
    }
  }

  // Validate expert path references
  for (const expert of s.expertPath || []) {
    if (!phaseIds.has(expert.phaseId)) {
      errors.push(`ExpertPath: phaseId "${expert.phaseId}" does not exist`);
    }
    if (!decisionIds.has(expert.decisionId)) {
      errors.push(`ExpertPath: decisionId "${expert.decisionId}" does not exist`);
    }
    for (const optId of expert.optimalOptionIds) {
      if (!allOptionIds.has(optId)) {
        errors.push(`ExpertPath: optionId "${optId}" does not exist`);
      }
    }
    if (typeof expert.weight !== "number" || expert.weight < 0 || expert.weight > 1) {
      errors.push(`ExpertPath: weight for phase ${expert.phaseId} must be between 0 and 1`);
    }
  }

  // Validate media feed items
  if (s.mediaFeed) {
    const mediaIds = new Set<string>();
    for (const item of s.mediaFeed) {
      if (!item.id) errors.push("MediaFeedItem missing id");
      if (mediaIds.has(item.id)) errors.push(`Duplicate MediaFeedItem id: ${item.id}`);
      mediaIds.add(item.id);
      if (typeof item.appearAfterSeconds !== "number" && !item.trigger) {
        errors.push(`MediaFeedItem ${item.id}: must have either appearAfterSeconds or a trigger`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Scenario validation failed:\n  - ${errors.join("\n  - ")}`);
  }
}
