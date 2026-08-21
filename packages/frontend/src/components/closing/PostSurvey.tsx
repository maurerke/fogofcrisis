import React, { useState, useMemo } from "react";
import { useGame } from "../../context/GameContext";
import { FormShell } from "../forms/FormShell";
import { LikertScale } from "../forms/LikertScale";
import { RadioGroup } from "../forms/RadioGroup";
import { Button } from "../ui/button";
import { INPUT_CLS } from "../forms/FormField";
import { CheckCircle2 } from "lucide-react";

// ========================
// NASA-TLX Skalendefinition (Hart & Staveland, 1988)
// ========================

const NASA_TLX_SCALES = [
  {
    id: "mental_demand",
    label: "Geistige Anforderung",
    description:
      "Wie viel geistige und wahrnehmungsbezogene Aktivität war erforderlich? " +
      "War die Aufgabe einfach oder komplex, ungenau oder präzise?",
    lowAnchor: "Sehr gering",
    highAnchor: "Sehr hoch",
    invertForTotal: false,
  },
  {
    id: "physical_demand",
    label: "Körperliche Anforderung",
    description:
      "Wie viel körperliche Aktivität war erforderlich? " +
      "War die Aufgabe gemächlich oder hastig, ruhig oder anstrengend?",
    lowAnchor: "Sehr gering",
    highAnchor: "Sehr hoch",
    invertForTotal: false,
  },
  {
    id: "temporal_demand",
    label: "Zeitliche Anforderung",
    description:
      "Wie stark war der Zeitdruck durch das Tempo der Aufgabe oder der Ereignisse? " +
      "War das Arbeitstempo langsam oder schnell?",
    lowAnchor: "Sehr gering",
    highAnchor: "Sehr hoch",
    invertForTotal: false,
  },
  {
    id: "performance",
    label: "Aufgabenerfüllung",
    description:
      "Wie erfolgreich haben Sie die Ziele der Aufgabe erfüllt? " +
      "Wie zufrieden waren Sie mit Ihrer Leistung? (Achtung: 'Niedrig' = gut, 'Hoch' = schlecht)",
    lowAnchor: "Perfekt",
    highAnchor: "Unzureichend",
    invertForTotal: true,
  },
  {
    id: "effort",
    label: "Anstrengung",
    description:
      "Wie hart mussten Sie arbeiten (geistig und körperlich), um Ihren Leistungsgrad zu erreichen?",
    lowAnchor: "Sehr gering",
    highAnchor: "Sehr hoch",
    invertForTotal: false,
  },
  {
    id: "frustration",
    label: "Frustration",
    description:
      "Wie unsicher, entmutigt, gereizt, gestresst oder verärgert waren Sie " +
      "im Vergleich zu sicher, zufrieden und entspannt?",
    lowAnchor: "Sehr gering",
    highAnchor: "Sehr hoch",
    invertForTotal: false,
  },
];

const CUSTOM_QUESTIONS = [
  {
    id: "info_pressure",
    label: "Wie stark fühlten Sie sich durch die Menge und Unübersichtlichkeit der verfügbaren Informationen unter Druck gesetzt?",
    min: 1,
    max: 7,
    lowAnchor: "Gar nicht",
    highAnchor: "Sehr stark",
  },
  {
    id: "decision_confidence",
    label: "Wie sicher waren Sie sich bei Ihren Entscheidungen?",
    min: 1,
    max: 7,
    lowAnchor: "Gar nicht sicher",
    highAnchor: "Sehr sicher",
  },
  {
    id: "attention_check",
    label: "Für diese Frage wählen Sie bitte den Wert 3 aus, um zu zeigen, dass Sie aufmerksam gelesen haben.",
    min: 1,
    max: 7,
    lowAnchor: "1",
    highAnchor: "7",
  },
  {
    id: "realism_perception",
    label: "Wie realistisch wirkte das simulierte Szenario auf Sie?",
    min: 1,
    max: 7,
    lowAnchor: "Völlig unrealistisch",
    highAnchor: "Sehr realistisch",
  },
];

const TLX_STEPS = Array.from({ length: 21 }, (_, i) => i * 5);

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    s = ((s * 1664525 + 1013904223) >>> 0);
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const MANIPULATION_CHECK_REAL_ID = "mc_real";
const MANIPULATION_CHECK_ITEMS = [
  { id: MANIPULATION_CHECK_REAL_ID, label: "\"Stadtwerke-Hack: Experten warnen vor Dominoeffekt im Stromnetz\"", isReal: true },
  { id: "mc_decoy_1", label: "\"Bundesregierung verhängt Internet-Notstand über Bayern\"", isReal: false },
  { id: "mc_decoy_2", label: "\"Anonymous übernimmt Verantwortung für Angriff auf Bundesbehörden\"", isReal: false },
];

type SurveyStep = "handoff" | "instruction" | "tlx" | "custom" | "manipulation_check";

export default function PostSurvey() {
  const { state, submitSurvey, setStatus } = useGame();
  const [tlxResponses, setTlxResponses] = useState<Record<string, number>>({});
  const [customResponses, setCustomResponses] = useState<Record<string, number | string>>({});
  const [freeText, setFreeText] = useState("");
  const [mediaCredibility, setMediaCredibility] = useState<number | null>(null);
  const [mediaInfluence, setMediaInfluence] = useState<string>("");
  const [mediaFreeText, setMediaFreeText] = useState("");
  const [mcSelections, setMcSelections] = useState<string[]>([]);
  const [step, setStep] = useState<SurveyStep>("handoff");
  // Controls whether the light veil overlay is mounted (dark→light transition)
  const [lightVeilActive, setLightVeilActive] = useState(false);

  const isGroupB = state.session?.group === "B";
  const sessionId = state.session?.sessionId || "";

  const orderedScales = useMemo(
    () => seededShuffle(NASA_TLX_SCALES, sessionId),
    [sessionId]
  );
  const tlxOrder = orderedScales.map((s) => s.id);

  const shuffledMcItems = useMemo(
    () => seededShuffle(MANIPULATION_CHECK_ITEMS, sessionId + "_mc"),
    [sessionId]
  );

  const tlxComplete = orderedScales.every((s) => tlxResponses[s.id] !== undefined);
  const customComplete = CUSTOM_QUESTIONS.every((q) => customResponses[q.id] !== undefined);
  const credibilityComplete = !isGroupB || mediaCredibility !== null;

  const handleTlxSubmit = () => {
    submitSurvey({
      instrument: "NASA_TLX",
      responses: { ...tlxResponses, tlx_order: tlxOrder.join(",") },
    });
    setStep("custom");
  };

  const handleCustomSubmit = () => {
    const responses: Record<string, number | string> = {
      ...customResponses,
      influence_factors: freeText,
    };
    if (isGroupB) {
      responses.media_influence = mediaInfluence;
      responses.media_influence_detail = mediaFreeText;
      responses.media_credibility_overall = mediaCredibility ?? "";
    }
    submitSurvey({ instrument: "custom_post", responses });
    if (isGroupB) {
      setStep("manipulation_check");
    } else {
      setStatus("debriefing");
    }
  };

  const handleManipulationCheckSubmit = () => {
    submitSurvey({
      instrument: "manipulation_check",
      responses: {
        manipulation_check_selected: mcSelections.join(","),
        manipulation_check_correct: mcSelections.includes(MANIPULATION_CHECK_REAL_ID) ? 1 : 0,
      },
    });
    setStatus("debriefing");
  };

  // Trigger the dark→light veil: wait for the veil to reach full opacity, then reveal
  // the light "instruction" step underneath — same technique as Briefing's light→dark handoff.
  const handleHandoffContinue = () => {
    setLightVeilActive(true);
    setTimeout(() => setStep("instruction"), 1600);
  };

  // ========================
  // Schritt –1: Handoff (dark interstitial after the game, before the survey)
  // ========================
  if (step === "handoff") {
    return (
      <>
        <FormShell variant="dark">
          <div className="flex flex-col items-center text-center">
            {/* Emerald closure icon ring — calm on the dark background */}
            <div className="relative mb-6">
              <div
                className="absolute inset-0 rounded-full opacity-20"
                style={{
                  background: "radial-gradient(circle, rgba(16,185,129,0.5) 0%, transparent 70%)",
                  animation: "float 3s ease-in-out infinite",
                }}
              />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-ok-500)]/40 bg-[var(--color-ok-500)]/15">
                <CheckCircle2 className="h-8 w-8 text-[var(--color-ok-400)]" />
              </div>
            </div>

            <h2 className="mt-1 text-2xl font-bold text-[var(--color-surface-100)]">
              Simulation beendet
            </h2>

            <p className="mt-4 text-sm leading-relaxed text-[var(--color-surface-300)]">
              Vielen Dank — die Simulation ist abgeschlossen. Im Anschluss folgen einige
              kurze Fragen zu Ihrem Erleben während der Simulation. Bitte beantworten Sie
              diese spontan und ehrlich; es gibt keine richtigen oder falschen Antworten.
            </p>

            <Button
              variant="primary"
              size="lg"
              className="mt-8 w-full"
              onClick={handleHandoffContinue}
            >
              Weiter zu den Fragen →
            </Button>
          </div>
        </FormShell>

        {/* Light veil overlay: fades in from transparent to opaque, covering the dark→light transition */}
        {lightVeilActive && (
          <div
            className="study-lighten-veil fixed inset-0 z-50"
            style={{
              background: "var(--color-study-bg)",
              animation: "study-to-survey-lighten 1.6s cubic-bezier(0.4,0,0.6,1) forwards",
            }}
            aria-hidden
          />
        )}
      </>
    );
  }

  // ========================
  // Schritt 0: Instruktion
  // ========================
  if (step === "instruction") {
    const totalSteps = isGroupB ? 4 : 3;
    const dimensions = [
      { label: "Geistige Anforderung", desc: "Komplexität und gedanklicher Anspruch der Aufgabe", note: "" },
      { label: "Körperliche Anforderung", desc: "Physischer Aufwand (Tippen, Klicken etc.)", note: "" },
      { label: "Zeitliche Anforderung", desc: "Zeitdruck durch den Phasen-Timer", note: "" },
      { label: "Aufgabenerfüllung", desc: "Zielerreichung und Leistungszufriedenheit", note: "Niedrig = gut, Hoch = schlecht" },
      { label: "Anstrengung", desc: "Eingesetzter Aufwand für die erbrachte Leistung", note: "" },
      { label: "Frustration", desc: "Gereiztheit, Stress und Verunsicherung", note: "" },
    ];

    return (
      <FormShell variant="light" wide>
        {/* Progress indicator */}
        <div className="mb-6 flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i === 0 ? "bg-[var(--color-brand-500)]" : "bg-[var(--color-study-card-border)]"}`}
            />
          ))}
          <span className="ml-1 shrink-0 text-xs text-[var(--color-study-text-subtle)]">
            Schritt 1 von {totalSteps}
          </span>
        </div>

        <h2 className="mb-1 text-xl font-bold text-[var(--color-study-text)]">
          Abschlussfragebogen
        </h2>
        <p className="mb-6 text-sm text-[var(--color-study-text-muted)]">
          Bevor Sie beginnen, lesen Sie bitte kurz, was im ersten Teil erfragt wird.
        </p>

        {/* NASA-TLX info block */}
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--color-brand-50)] text-[11px] font-bold text-[var(--color-brand-700)]">
            i
          </span>
          <h3 className="text-sm font-semibold text-[var(--color-study-text)]">
            NASA Task Load Index (NASA-TLX)
          </h3>
        </div>
        <p className="mb-4 text-sm text-[var(--color-study-text-muted)]">
          Sie werden zu sechs Dimensionen Ihrer subjektiven Beanspruchung während der Simulation befragt.
          Jede Dimension hat eine 21-stufige Skala von 0 bis 100 (Schrittweite 5).
        </p>

        {/* Dimension cards — 2-column grid */}
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {dimensions.map(({ label, desc, note }) => (
            <div
              key={label}
              className="rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] bg-[var(--color-study-nested)] p-3"
            >
              <p className="mb-0.5 text-xs font-semibold text-[var(--color-study-text)]">{label}</p>
              <p className="text-xs text-[var(--color-study-text-muted)]">{desc}</p>
              {note && (
                <p className="mt-1 text-xs text-[var(--color-study-text-subtle)]">{note}</p>
              )}
            </div>
          ))}
        </div>

        <Button variant="primary" size="lg" className="w-full" onClick={() => setStep("tlx")}>
          Fragebogen starten →
        </Button>
      </FormShell>
    );
  }

  // ========================
  // Schritt 1: NASA-TLX
  // ========================
  if (step === "tlx") {
    return (
      <FormShell variant="light" wide>
        <h2 className="mb-1 text-xl font-bold text-[var(--color-study-text)]">
          Beanspruchungsempfinden (NASA-TLX)
        </h2>
        <p className="mb-5 text-sm text-[var(--color-study-text-muted)]">
          Bewerten Sie jede Dimension für die soeben abgeschlossene Simulation.
        </p>

        <div className="mb-6 space-y-5">
          {orderedScales.map((scale) => (
            <div key={scale.id} className="border-b border-[var(--color-study-card-border)] pb-5 last:border-0 last:pb-0">
              <div className="mb-2">
                <strong className="text-sm text-[var(--color-study-text)]">{scale.label}</strong>
                {scale.invertForTotal && (
                  <span className="ml-2 text-xs text-[var(--color-warn-700)]"> (Niedrig = gut)</span>
                )}
                <p className="mt-0.5 text-xs text-[var(--color-study-text-muted)]">{scale.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="min-w-[60px] text-xs text-[var(--color-study-text-muted)]">{scale.lowAnchor}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={tlxResponses[scale.id] ?? 50}
                  onChange={(e) =>
                    setTlxResponses({ ...tlxResponses, [scale.id]: parseInt(e.target.value) })
                  }
                  className={`flex-1 accent-[var(--color-brand-500)]${tlxResponses[scale.id] === undefined ? " tlx-slider--unset" : ""}`}
                />
                <span className="min-w-[60px] text-right text-xs text-[var(--color-study-text-muted)]">{scale.highAnchor}</span>
                <span className="min-w-[32px] text-right font-mono text-sm font-semibold text-[var(--color-study-text)]">
                  {tlxResponses[scale.id] !== undefined ? tlxResponses[scale.id] : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="mb-4 text-xs text-[var(--color-study-text-subtle)]">
          Alle 6 Skalen müssen ausgefüllt sein. Bewegen Sie jeden Regler mindestens einmal.
        </p>

        <Button variant="primary" size="lg" className="w-full" onClick={handleTlxSubmit} disabled={!tlxComplete}>
          Weiter zu Teil 2 →
        </Button>
      </FormShell>
    );
  }

  // ========================
  // Schritt 2: Custom-Fragen
  // ========================
  if (step === "custom") {
    return (
      <FormShell variant="light" wide>
        <h2 className="mb-5 text-xl font-bold text-[var(--color-study-text)]">Abschließende Fragen</h2>

        <div className="mb-6 space-y-5">
          {CUSTOM_QUESTIONS.map((q) => {
            const opts = Array.from({ length: q.max - q.min + 1 }, (_, i) => ({ value: i + q.min }));
            return (
              <div key={q.id} className="border-b border-[var(--color-study-card-border)] pb-5 last:border-0 last:pb-0">
                <p className="mb-2 text-sm text-[var(--color-study-text)]">{q.label}</p>
                <LikertScale
                  name={q.id}
                  value={customResponses[q.id] as number | undefined}
                  onChange={(val) => setCustomResponses({ ...customResponses, [q.id]: val })}
                  options={opts}
                  lowAnchor={q.lowAnchor}
                  highAnchor={q.highAnchor}
                  circle
                />
              </div>
            );
          })}

          <div className="border-b border-[var(--color-study-card-border)] pb-5">
            <p className="mb-2 text-sm text-[var(--color-study-text)]">
              Was hat Ihre Entscheidungen am stärksten beeinflusst? (optional, max. 500 Zeichen)
            </p>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value.substring(0, 500))}
              className={`${INPUT_CLS} resize-y`}
              rows={3}
              placeholder="Bitte beschreiben Sie..."
              maxLength={500}
            />
            <p className="mt-1 text-right text-xs text-[var(--color-study-faint)]">{freeText.length}/500</p>
          </div>

          {isGroupB && (
            <>
              <div className="border-b border-[var(--color-study-card-border)] pb-5">
                <p className="mb-2 text-sm text-[var(--color-study-text)]">
                  Wie glaubwürdig empfanden Sie den simulierten Medienfeed insgesamt?
                </p>
                <LikertScale
                  name="mediaCredibility"
                  value={mediaCredibility ?? undefined}
                  onChange={(val) => setMediaCredibility(val)}
                  options={[1, 2, 3, 4, 5, 6, 7].map((v) => ({ value: v }))}
                  lowAnchor="Gar nicht glaubwürdig"
                  highAnchor="Sehr glaubwürdig"
                  circle
                />
              </div>

              <div className="pb-5">
                <p className="mb-2 text-sm text-[var(--color-study-text)]">
                  Haben Sie Informationen aus dem Nachrichtenfeed in Ihre Entscheidungen einbezogen?
                </p>
                <RadioGroup
                  name="mediaInfluence"
                  options={[
                    { value: "ja", label: "Ja" },
                    { value: "nein", label: "Nein" },
                    { value: "teilweise", label: "Teilweise" },
                  ]}
                  value={mediaInfluence}
                  onChange={setMediaInfluence}
                />
                {(mediaInfluence === "ja" || mediaInfluence === "teilweise") && (
                  <textarea
                    value={mediaFreeText}
                    onChange={(e) => setMediaFreeText(e.target.value.substring(0, 500))}
                    className={`${INPUT_CLS} mt-2 resize-y`}
                    rows={2}
                    placeholder="Falls ja, beschreiben Sie bitte inwiefern..."
                    maxLength={500}
                  />
                )}
              </div>
            </>
          )}
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleCustomSubmit}
          disabled={!customComplete || !credibilityComplete}
        >
          {isGroupB ? "Weiter zur letzten Frage →" : "Fragebogen abschließen"}
        </Button>
      </FormShell>
    );
  }

  // ========================
  // Schritt 3: Manipulation Check (nur Gruppe B)
  // ========================
  if (step === "manipulation_check" && isGroupB) {
    return (
      <FormShell variant="light" wide>
        <h2 className="mb-1 text-xl font-bold text-[var(--color-study-text)]">
          Abschließende Kontrollfrage
        </h2>
        <p className="mb-5 text-sm text-[var(--color-study-text-subtle)]">
          Welche der folgenden Schlagzeilen haben Sie während der Simulation
          im Nachrichtenfeed gesehen? (Mehrfachauswahl möglich)
        </p>

        <div className="mb-6 space-y-2">
          {shuffledMcItems.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] p-3 text-sm text-[var(--color-study-text-muted)] transition-colors hover:bg-[var(--color-study-nested)]"
            >
              <input
                type="checkbox"
                checked={mcSelections.includes(item.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    // Selecting a headline contradicts "none of these" — drop it
                    setMcSelections([...mcSelections.filter((id) => id !== "mc_none"), item.id]);
                  } else {
                    setMcSelections(mcSelections.filter((id) => id !== item.id));
                  }
                }}
                className="mt-0.5 shrink-0 accent-[var(--color-brand-500)]"
              />
              <span>{item.label}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] p-3 text-sm text-[var(--color-study-text-muted)] transition-colors hover:bg-[var(--color-study-nested)]">
            <input
              type="checkbox"
              checked={mcSelections.includes("mc_none")}
              onChange={(e) => {
                if (e.target.checked) setMcSelections(["mc_none"]);
                else setMcSelections(mcSelections.filter((id) => id !== "mc_none"));
              }}
              className="mt-0.5 shrink-0 accent-[var(--color-brand-500)]"
            />
            <span>Keine dieser Schlagzeilen</span>
          </label>
        </div>

        <Button variant="primary" size="lg" className="w-full" onClick={handleManipulationCheckSubmit}>
          Fragebogen abschließen →
        </Button>
      </FormShell>
    );
  }

  return null;
}
