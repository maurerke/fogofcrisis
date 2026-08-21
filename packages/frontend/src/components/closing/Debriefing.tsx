import { useState, useEffect, useRef, useCallback } from "react";
import { useGame } from "../../context/GameContext";
import { FormShell } from "../forms/FormShell";
import { Button } from "../ui/button";
import { INPUT_CLS } from "../forms/FormField";
import { cn } from "../../lib/utils";

// B4: 15s minimum per step + scroll-to-bottom detection. Combined readiness prevents
// participants from clicking through without reading (cf. Mayer & Moreno 2003).
const MIN_SECONDS_PER_STEP = 15;

type DebriefStep = "events" | "analysis" | "application" | "reflection" | "reveal" | "done";

function ProgressBar({
  percent,
  remainingSeconds,
  ready,
  scrolled,
}: {
  percent: number;
  remainingSeconds: number;
  ready: boolean;
  scrolled: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="overflow-hidden rounded-full bg-[var(--color-study-card-border)]">
        <div
          className={cn(
            "h-1.5 rounded-full transition-all duration-500",
            ready && scrolled ? "bg-[var(--color-ok-600)]" : "bg-[var(--color-brand-500)]",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {!(ready && scrolled) && (
        <p className="mt-1 text-center text-xs text-[var(--color-study-text-subtle)]">
          {!scrolled
            ? "Bitte lesen Sie den Abschnitt vollständig"
            : `Bitte nehmen Sie sich einen Moment Zeit (${remainingSeconds}s)`}
        </p>
      )}
    </div>
  );
}

/**
 * Sentinel placed at the bottom of each step's content area.
 * Returns whether the sentinel is visible (scrolled into view).
 */
function useScrolledToBottom(dep: string): [React.RefObject<HTMLDivElement>, boolean] {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setScrolled(false);
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setScrolled(true);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [dep]); // Reset when step changes

  return [sentinelRef, scrolled];
}

/**
 * Small local illustration: a phone screen showing a media feed with several
 * generic post skeletons, one of which is visually flagged as disinformation.
 * Used on the "reveal" step to contrast Group A (no feed) with Group B (feed).
 */
function FeedPost({ flagged }: { flagged: boolean }) {
  return (
    <div
      className={cn(
        "relative mb-1.5 flex items-start gap-1 rounded-[6px] border p-1 last:mb-0",
        flagged
          ? "border-[var(--color-crit-200)] bg-[var(--color-crit-50)]"
          : "border-[var(--color-study-field-border)] bg-[var(--color-study-faint)]/10",
      )}
    >
      <div
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          flagged ? "bg-[var(--color-crit-300)]" : "bg-[var(--color-study-field-border)]",
        )}
        aria-hidden
      />
      <div className="flex-1 space-y-1">
        <div
          className={cn(
            "h-[3px] w-full rounded-full",
            flagged ? "bg-[var(--color-crit-300)]" : "bg-[var(--color-study-field-border)]",
          )}
          aria-hidden
        />
        <div
          className={cn(
            "h-[3px] w-2/3 rounded-full",
            flagged ? "bg-[var(--color-crit-300)]" : "bg-[var(--color-study-field-border)]",
          )}
          aria-hidden
        />
      </div>
      {flagged && (
        <span
          className="absolute -right-1 -top-1 flex h-3.5 w-3.5 animate-pulse items-center justify-center rounded-full bg-[var(--color-crit-500)] text-[8px] font-bold leading-none text-white"
          aria-hidden
        >
          !
        </span>
      )}
    </div>
  );
}

function PhoneFrame({ children, dimmed }: { children?: React.ReactNode; dimmed?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-[100px] rounded-[18px] border-2 p-1.5",
        dimmed
          ? "border-[var(--color-study-faint)] bg-[var(--color-study-nested)] opacity-60"
          : "border-[var(--color-study-text-muted)] bg-[var(--color-study-card)]",
      )}
      style={{ height: "200px" }}
      aria-hidden
    >
      {/* notch / speaker line */}
      <div className="mb-1.5 flex justify-center">
        <div className="h-1 w-8 rounded-full bg-[var(--color-study-field-border)]" />
      </div>
      {/* screen area */}
      <div
        className={cn(
          "h-[calc(100%-14px)] rounded-[10px] p-1.5",
          dimmed ? "bg-[var(--color-study-nested)]" : "bg-[var(--color-study-card)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Group B illustration: an active phone with a feed, one post flagged as disinformation. */
function ActiveFeedPhone() {
  return (
    <div role="img" aria-label="Smartphone mit Nachrichtenfeed, ein Beitrag als Desinformation markiert">
      <PhoneFrame>
        <FeedPost flagged={false} />
        <FeedPost flagged={true} />
        <FeedPost flagged={false} />
      </PhoneFrame>
    </div>
  );
}

/** Group A illustration: an empty, dimmed, crossed-out phone (no feed at all). */
function CrossedOutPhone() {
  return (
    <div
      role="img"
      aria-label="Smartphone durchgestrichen: kein Medienfeed"
      className="relative mx-auto w-[100px]"
    >
      <PhoneFrame dimmed />
      {/* diagonal strike-through bar */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[5px] w-[135px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-[var(--color-study-text-subtle)]"
        style={{ boxShadow: "0 0 0 3px var(--color-study-nested)" }}
        aria-hidden
      />
    </div>
  );
}

export default function Debriefing() {
  const { state, setStatus, readyForNextPhase, submitReflection } = useGame();
  const { debriefingContent, expertPath, decisions, session, mediaItems, scenarioPhases } = state;

  const [step, setStep] = useState<DebriefStep>("events");
  const [reflectionText, setReflectionText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const startTimeRef = useRef<number>(Date.now());

  const togglePhase = (phaseId: string) =>
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(phaseId) ? next.delete(phaseId) : next.add(phaseId);
      return next;
    });

  const isGroupB = session?.group === "B";

  const phaseMap = new Map(scenarioPhases.map((p) => [p.id, p]));

  const getPhaseTitle = (phaseId: string): string => phaseMap.get(phaseId)?.title ?? phaseId;

  const getOptionLabels = (phaseId: string, optionIds: string[]): string => {
    const phase = phaseMap.get(phaseId);
    if (!phase) return optionIds.join(", ");
    return optionIds
      .map((oid) => phase.decision.options.find((o) => o.id === oid)?.label ?? oid)
      .join(", ");
  };

  const [sentinelRef, scrolled] = useScrolledToBottom(step);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(Math.min(elapsed, MIN_SECONDS_PER_STEP));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const progressPercent = Math.min((elapsedSeconds / MIN_SECONDS_PER_STEP) * 100, 100);
  const remainingSeconds = Math.max(MIN_SECONDS_PER_STEP - elapsedSeconds, 0);
  const timerReady = elapsedSeconds >= MIN_SECONDS_PER_STEP;
  const readyToAdvance = timerReady && scrolled;

  const disinfoItems = isGroupB ? mediaItems.filter((item) => item.isDisinformation) : [];

  const handleReflectionSubmit = useCallback(() => {
    if (reflectionText.trim()) submitReflection(reflectionText.trim());
    // Data collection ends with the reflection question, so the run is finalised here:
    // the server persists the reflection and then marks the session complete (events are
    // processed in order on the same socket). markComplete does not push a status change,
    // so the reveal/done screens below keep rendering. If the participant closes the
    // window during the following (purely informational) reveal step, the run still
    // counts as completed. The reveal is post-hoc disclosure of the A/B design and is not
    // gated by the timer/scroll requirements used for the earlier steps.
    readyForNextPhase();
    setStep("reveal");
  }, [reflectionText, submitReflection, readyForNextPhase]);

  if (!debriefingContent) return null;

  const handleComplete = () => {
    readyForNextPhase();
    setStatus("complete");
  };

  // ========================
  // Phase 1: Events
  // ========================
  if (step === "events") {
    return (
      <FormShell variant="light" wide>
        <div className="mb-5">
          <span className="inline-block rounded-full bg-[var(--color-study-nested)] border border-[var(--color-study-card-border)] px-2.5 py-0.5 text-xs text-[var(--color-study-text-muted)] mb-2">
            Schritt 1 von 4
          </span>
          <h2 className="text-xl font-bold text-[var(--color-study-text)]">Ihre Entscheidungen im Überblick</h2>
          <p className="mt-1 text-sm text-[var(--color-study-text-muted)]">
            Welche Option Sie in jeder Phase gewählt haben und wie schnell Sie entschieden haben.
          </p>
        </div>

        <div className="mb-6 space-y-2">
          {decisions.length > 0 ? (
            decisions.map((dec, i) => (
              <div
                key={dec.phaseId}
                className="rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] bg-[var(--color-study-nested)] overflow-hidden"
              >
                {/* Card header */}
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-study-nested-border)] px-4 py-2.5">
                  <span className="text-xs font-semibold text-[var(--color-study-text-subtle)] uppercase tracking-wide">
                    Phase {i + 1}
                  </span>
                  <span className="text-xs text-[var(--color-study-faint)]">·</span>
                  <span className="text-sm font-semibold text-[var(--color-study-text)]">
                    {getPhaseTitle(dec.phaseId)}
                  </span>
                  {dec.timedOut && (
                    <span className="ml-auto rounded-full bg-[var(--color-warn-50)] border border-[var(--color-warn-300)] px-2 py-0.5 text-xs text-[var(--color-warn-700)]">
                      Zeit abgelaufen
                    </span>
                  )}
                  {dec.revisedDecision && (
                    <span className={dec.timedOut ? "" : "ml-auto"}>
                      <span className="rounded-full bg-[var(--color-brand-50)] border border-[var(--color-brand-200)] px-2 py-0.5 text-xs text-[var(--color-brand-700)]">
                        Revidiert
                      </span>
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="px-4 py-3">
                  {dec.selectedOptionIds && dec.selectedOptionIds.length > 0 ? (
                    <p className="mb-2 text-sm text-[var(--color-study-text)]">
                      <span className="text-[var(--color-study-text-subtle)]">Gewählt: </span>
                      {getOptionLabels(dec.phaseId, dec.selectedOptionIds)}
                    </p>
                  ) : (
                    <p className="mb-2 text-sm italic text-[var(--color-study-text-subtle)]">Keine Option gewählt</p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-study-text-subtle)]">
                    <span>
                      Reaktionszeit:{" "}
                      <span className="text-[var(--color-study-text-muted)]">
                        {dec.decisionTimeMs ? (dec.decisionTimeMs / 1000).toFixed(1) + " s" : "—"}
                      </span>
                    </span>
                    <span>
                      Ereignisse gelesen:{" "}
                      <span className="text-[var(--color-study-text-muted)]">{dec.eventsSeenCount}</span>
                    </span>
                    {isGroupB && dec.mediaItemsSeenCount != null && (
                      <span>
                        Medienbeiträge gesehen:{" "}
                        <span className="text-[var(--color-study-text-muted)]">{dec.mediaItemsSeenCount}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--color-study-text-subtle)]">Keine Entscheidungsdaten verfügbar.</p>
          )}
        </div>

        {/* B4: Scroll-to-bottom sentinel */}
        <div ref={sentinelRef} aria-hidden />

        <ProgressBar percent={progressPercent} remainingSeconds={remainingSeconds} ready={timerReady} scrolled={scrolled} />

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => setStep("analysis")}
          disabled={!readyToAdvance}
          title={!readyToAdvance ? "Bitte lesen Sie den Abschnitt vollständig" : undefined}
        >
          Weiter: Fachliche Einschätzung →
        </Button>
      </FormShell>
    );
  }

  // ========================
  // Phase 2: Analysis
  // ========================
  if (step === "analysis") {
    return (
      <FormShell variant="light" wide>
        <div className="mb-5">
          <span className="inline-block rounded-full bg-[var(--color-study-nested)] border border-[var(--color-study-card-border)] px-2.5 py-0.5 text-xs text-[var(--color-study-text-muted)] mb-2">
            Schritt 2 von 4
          </span>
          <h2 className="text-xl font-bold text-[var(--color-study-text)]">Fachliche Einschätzung der Entscheidungspunkte</h2>
          <p className="mt-1 text-sm text-[var(--color-study-text-muted)]">
            So wurde die Entscheidungssituation von einer IR-Fachperson bewertet.
            Dies ist keine Bewertung Ihrer Entscheidungen. In Krisenlagen gibt es selten nur einen richtigen Weg.
          </p>
        </div>

        <div className="mb-6 space-y-2">
          {expertPath.map((expert, i) => {
            const isOpen = expandedPhases.has(expert.phaseId);
            return (
              <div
                key={expert.phaseId}
                className="rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] bg-[var(--color-study-nested)] overflow-hidden"
              >
                {/* Accordion header — always visible */}
                <button
                  type="button"
                  onClick={() => togglePhase(expert.phaseId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-study-card-border)] transition-colors"
                >
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--color-study-text-subtle)]">
                    Phase {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-[var(--color-study-text)]">
                    {getPhaseTitle(expert.phaseId)}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-study-text-subtle)]">
                    {getOptionLabels(expert.phaseId, expert.optimalOptionIds)}
                  </span>
                  <svg
                    className={`h-4 w-4 shrink-0 text-[var(--color-study-text-subtle)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
                  </svg>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-[var(--color-study-nested-border)] px-4 py-3">
                    <p className="mb-3 text-sm text-[var(--color-study-text-muted)] leading-relaxed">
                      {expert.rationale}
                    </p>
                    <p className="text-xs text-[var(--color-study-text-subtle)]">
                      <span className="font-semibold text-[var(--color-study-text-muted)]">Empfohlene Option(en): </span>
                      <span className="text-[var(--color-brand-700)]">
                        {getOptionLabels(expert.phaseId, expert.optimalOptionIds)}
                      </span>
                      <span className="ml-3 text-[var(--color-study-faint)]">
                        · Gewichtung: {(expert.weight * 100).toFixed(0)} %
                      </span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div ref={sentinelRef} aria-hidden />

        <ProgressBar percent={progressPercent} remainingSeconds={remainingSeconds} ready={timerReady} scrolled={scrolled} />

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => setStep("application")}
          disabled={!readyToAdvance}
          title={!readyToAdvance ? "Bitte lesen Sie den Abschnitt vollständig" : undefined}
        >
          Weiter: Erkenntnisse →
        </Button>
      </FormShell>
    );
  }

  // ========================
  // Phase 3: Application
  // ========================
  if (step === "application") {
    return (
      <FormShell variant="light" wide>
        <div className="mb-5">
          <span className="inline-block rounded-full bg-[var(--color-study-nested)] border border-[var(--color-study-card-border)] px-2.5 py-0.5 text-xs text-[var(--color-study-text-muted)] mb-2">
            Schritt 3 von 4
          </span>
          <h2 className="text-xl font-bold text-[var(--color-study-text)]">{debriefingContent.title}</h2>
        </div>

        <div className="mb-5">
          <p className="text-sm text-[var(--color-study-text-muted)]">{debriefingContent.summary}</p>
        </div>

        <div className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-brand-700)]">Zentrale Erkenntnisse aus dem Szenario</h3>
          <ul className="space-y-1.5">
            {debriefingContent.keyLessons.map((lesson, i) => (
              <li key={i} className="relative pl-5 text-sm text-[var(--color-study-text-muted)]">
                <span className="absolute left-0 text-[var(--color-brand-700)]">&#9656;</span>
                {lesson}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] bg-[var(--color-study-nested)] p-3">
          <h4 className="mb-1 text-xs font-semibold text-[var(--color-study-text-muted)]">Kontaktangaben</h4>
          <p className="text-xs text-[var(--color-study-text-subtle)]">
            <strong className="text-[var(--color-study-text-muted)]">Forschungsleitung:</strong> Kevin Maurer, IU Internationale Hochschule<br />
            <strong className="text-[var(--color-study-text-muted)]">Betreuer:</strong> Prof. Dr.-Ing. Jörn-Marc Schmidt, IU Internationale Hochschule<br />
            <strong className="text-[var(--color-study-text-muted)]">Kontakt:</strong> kevin.maurer@iu-study.org<br />
            <strong className="text-[var(--color-study-text-muted)]">Widerruf / Löschanfragen (Art. 17 DSGVO):</strong> Bitte senden Sie eine E-Mail mit Ihrer Teilnahme-ID an die oben genannte Adresse.
          </p>
        </div>

        <p className="mb-4 text-xs italic text-[var(--color-study-faint)]">{debriefingContent.disclaimer}</p>

        <div ref={sentinelRef} aria-hidden />

        <ProgressBar percent={progressPercent} remainingSeconds={remainingSeconds} ready={timerReady} scrolled={scrolled} />

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => setStep("reflection")}
          disabled={!readyToAdvance}
          title={!readyToAdvance ? "Bitte lesen Sie den Abschnitt vollständig" : undefined}
        >
          Weiter: Abschlussfrage →
        </Button>
      </FormShell>
    );
  }

  // ========================
  // Schritt 4: Reflexion
  // ========================
  if (step === "reflection") {
    return (
      <FormShell variant="light" wide>
        <span className="mb-2 inline-block rounded-full bg-[var(--color-study-nested)] border border-[var(--color-study-card-border)] px-2.5 py-0.5 text-xs text-[var(--color-study-text-muted)]">
          Schritt 4 von 4
        </span>
        <h2 className="mb-1 text-xl font-bold text-[var(--color-study-text)]">
          Abschließende Reflexion (optional)
        </h2>
        <p className="mb-5 text-sm text-[var(--color-study-text-subtle)]">
          Diese Frage ist freiwillig. Ihre Antwort wird qualitativ ausgewertet.
        </p>

        <div className="mb-6">
          <p className="mb-2 text-sm text-[var(--color-study-text)]">
            Würden Sie im Nachhinein eine andere Entscheidung treffen?
            Falls ja: Welche und warum? (max. 500 Zeichen)
          </p>
          <textarea
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value.substring(0, 500))}
            className={`${INPUT_CLS} resize-y`}
            rows={5}
            placeholder="Ihre Gedanken..."
            maxLength={500}
          />
          <p className="mt-1 text-right text-xs text-[var(--color-study-faint)]">{reflectionText.length}/500</p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={handleReflectionSubmit}>
            Überspringen
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleReflectionSubmit}>
            Antwort speichern &amp; Studie abschließen
          </Button>
        </div>
      </FormShell>
    );
  }

  // ========================
  // Schritt 5: Reveal (Aufklärung zum A/B-Design)
  // ========================
  if (step === "reveal") {
    const groups: Array<{ id: "A" | "B"; label: string; sub: string; desc: string }> = [
      {
        id: "A",
        label: "Gruppe A",
        sub: "Kontrollgruppe · ohne Medienfeed",
        desc: "Nur der offizielle Incident-Kanal. Kein Smartphone, kein Nachrichtenfeed.",
      },
      {
        id: "B",
        label: "Gruppe B",
        sub: "Experimentalgruppe · mit Medienfeed",
        desc: "Zusätzlich ein simulierter Social-Media-Feed, ein Teil der Beiträge war gezielte Desinformation.",
      },
    ];

    return (
      <FormShell variant="light" wide>
        <div className="mb-5">
          <span className="inline-block rounded-full bg-[var(--color-ok-50)] border border-[var(--color-ok-200)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-ok-700)] mb-2">
            Teilnahme abgeschlossen
          </span>
          <h2 className="text-xl font-bold text-[var(--color-study-text)]">
            Zum Abschluss: Aufklärung zur Studie
          </h2>
          <p className="mt-1 text-sm text-[var(--color-study-text-muted)]">
            Ihre Antworten sind gespeichert und Ihre Teilnahme ist damit abgeschlossen. Zum Schluss
            möchten wir offenlegen, worum es in dieser Studie ging. Sie waren Teil eines Experiments
            mit zwei Gruppen. Alle Teilnehmenden wurden zu Beginn zufällig einer von zwei Gruppen
            zugeteilt. Beide Gruppen erlebten exakt dasselbe Szenario, dieselben Informationen im
            Incident-Kanal, dieselben Entscheidungsoptionen und dieselben Zeitlimits. Der einzige
            Unterschied: das Smartphone mit dem Nachrichtenfeed.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {groups.map((group) => {
            const isOwnGroup = (group.id === "B") === isGroupB;
            return (
              <div
                key={group.id}
                className={cn(
                  "relative rounded-[var(--radius-sm)] border bg-[var(--color-study-nested)] p-4 text-center",
                  isOwnGroup
                    ? "ring-2 ring-[var(--color-brand-500)] border-[var(--color-brand-200)]"
                    : "border-[var(--color-study-card-border)]",
                )}
              >
                {isOwnGroup && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-brand-50)] border border-[var(--color-brand-200)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-brand-700)] whitespace-nowrap">
                    Ihre Gruppe
                  </span>
                )}
                <h3 className="text-sm font-semibold text-[var(--color-study-text)]">{group.label}</h3>
                <p className="mb-3 text-xs text-[var(--color-study-text-subtle)]">{group.sub}</p>

                <div className="mb-3">{group.id === "B" ? <ActiveFeedPhone /> : <CrossedOutPhone />}</div>

                <p className="text-xs text-[var(--color-study-text-muted)]">{group.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mb-5 rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] bg-[var(--color-study-nested)] p-3">
          <h3 className="mb-1 text-sm font-semibold text-[var(--color-brand-700)]">Was wurde untersucht?</h3>
          <p className="text-sm text-[var(--color-study-text-muted)]">
            Die Studie untersucht, ob ein Nachrichtenfeed mit Desinformation die Qualität und die
            Geschwindigkeit von Entscheidungen in einer simulierten Cyber-Krise verändert und ob er
            die empfundene Belastung erhöht. Dazu werden die Entscheidungen beider Gruppen
            miteinander verglichen.
          </p>
        </div>

        {isGroupB ? (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-[var(--color-brand-700)]">
              Ihr Durchgang: der Feed war aktiv
            </h3>
            <p className="mb-3 text-sm text-[var(--color-study-text-muted)]">
              Sie waren der Experimentalgruppe zugeteilt.{" "}
              <strong className="text-[var(--color-study-text)]">{disinfoItems.length}</strong> von{" "}
              <strong className="text-[var(--color-study-text)]">{mediaItems.length}</strong> im Feed
              angezeigten Beiträgen waren bewusst gestaltete Desinformation.
            </p>

            {disinfoItems.length > 0 && (
              <div className="mb-4 space-y-3">
                <h4 className="text-xs font-semibold text-[var(--color-study-text-subtle)]">Folgende Beiträge waren Desinformation:</h4>
                {disinfoItems.map((item) => (
                  <div key={item.id} className="rounded-[var(--radius-sm)] border border-[var(--color-crit-200)] bg-[var(--color-crit-50)] p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-[var(--color-crit-100)] border border-[var(--color-crit-200)] px-2 py-0.5 text-xs font-semibold text-[var(--color-crit-700)]">
                        Desinformation
                      </span>
                      <span className="text-xs text-[var(--color-study-faint)]">{item.source}</span>
                    </div>
                    <p className="mb-1 text-sm text-[var(--color-study-text)]">"{item.content}"</p>
                    <p className="text-xs text-[var(--color-study-text-subtle)]">
                      <strong className="text-[var(--color-study-text-muted)]">Einordnung:</strong> Dieser Beitrag war fiktiv und wurde als{" "}
                      {item.emotionalTone === "alarming" ? "alarmierender" :
                        item.emotionalTone === "accusatory" ? "anklagender" :
                        item.emotionalTone === "panicking" ? "panikauslösender" :
                        item.emotionalTone === "reassuring" ? "beruhigender" : "neutraler"}{" "}
                      Beitrag gestaltet, um seinen emotionalen Einfluss auf Entscheidungen zu untersuchen.
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm text-[var(--color-study-text-muted)]">
              <p className="mb-1">
                Desinformation (FIMI - Foreign Information Manipulation and Interference) ist ein
                reales Phänomen in Krisenlagen. Weitere Informationen:
              </p>
              <ul className="ml-4 list-disc text-xs text-[var(--color-study-text-subtle)]">
                <li>BSI — Bundesamt für Sicherheit in der Informationstechnik: bsi.bund.de</li>
                <li>BfV — Bundesamt für Verfassungsschutz: verfassungsschutz.de</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-[var(--color-brand-700)]">
              Ihr Durchgang: ohne Feed
            </h3>
            <p className="text-sm text-[var(--color-study-text-muted)]">
              Sie waren der Kontrollgruppe zugeteilt und haben ausschließlich über den offiziellen
              Incident-Kanal entschieden. Ihre Entscheidungen bilden den Vergleichsmaßstab, an dem
              sich der Einfluss des Feeds in der anderen Gruppe messen lässt.
            </p>
          </div>
        )}

        <Button variant="primary" size="lg" className="w-full" onClick={() => setStep("done")}>
          Weiter →
        </Button>
      </FormShell>
    );
  }

  // ========================
  // Done
  // ========================
  if (step === "done") {
    return (
      <FormShell variant="light">
        <h2 className="mb-3 text-xl font-bold text-[var(--color-study-text)]">Vielen Dank!</h2>
        <p className="mb-5 text-sm text-[var(--color-study-text-subtle)]">
          Ihre Antworten wurden gespeichert. Bitte klicken Sie auf den Button, um die Studie abzuschließen.
        </p>
        <Button variant="primary" size="lg" className="w-full" onClick={handleComplete}>
          Studie abschließen
        </Button>
      </FormShell>
    );
  }

  return null;
}
