import { useState } from "react";
import { useGame } from "../../context/GameContext";
import ConsentInformation from "./ConsentInformation";
import { FormShell } from "../forms/FormShell";
import { Button } from "../ui/button";

const CONSENT_ITEMS = [
  "Ich habe die Datenschutz- und Studieninformation gelesen und verstanden.",
  "Ich nehme freiwillig teil und kann jederzeit ohne Angabe von Gründen abbrechen.",
  "Ich bin damit einverstanden, dass meine pseudonymisierten Daten erhoben und ausgewertet werden.",
  "Ich nehme zur Kenntnis, dass Teile des Szenarios bewusst irreführend gestaltet sein können und im Debriefing aufgeklärt werden.",
];

export default function ConsentForm() {
  const { state, setStatus } = useGame();
  const [checks, setChecks] = useState<boolean[]>(CONSENT_ITEMS.map(() => false));
  const [pdfLoading, setPdfLoading] = useState(false);

  const allChecked = checks.every((c) => c);
  const sessionId = state.session?.sessionId || "";
  const participantId = state.session?.participantId || "";

  const toggleCheck = (index: number) => {
    const next = [...checks];
    next[index] = !next[index];
    setChecks(next);
  };

  const handleContinue = () => {
    if (allChecked) setStatus("demographics");
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch("/api/consent/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudonymId: participantId, sessionId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Einverstaendnis_${participantId || "entwurf"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <FormShell variant="light" wide>
      <h2 className="mb-1 text-xl font-bold text-[var(--color-study-text)]">
        Einverständniserklärung
      </h2>
      <p className="mb-6 text-sm text-[var(--color-study-text-subtle)]">
        Bitte lesen Sie die Datenschutzinformation und bestätigen Sie Ihr Einverständnis.
      </p>

      <ConsentInformation />

      {/* Consent-Checkliste */}
      <div className="mb-6 space-y-2">
        {CONSENT_ITEMS.map((item, i) => (
          <label
            key={i}
            className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] p-3 text-sm text-[var(--color-study-text-muted)] transition-colors hover:bg-[var(--color-study-nested)]"
          >
            <input
              type="checkbox"
              checked={checks[i]}
              onChange={() => toggleCheck(i)}
              className="mt-0.5 shrink-0 accent-[var(--color-brand-500)]"
            />
            <span>{item}</span>
          </label>
        ))}
      </div>

      {/* Aktionen */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="secondary"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="flex-1"
        >
          {pdfLoading ? "Wird erstellt…" : "Einverständniserklärung herunterladen (PDF)"}
        </Button>
        <Button
          variant="primary"
          onClick={handleContinue}
          disabled={!allChecked}
          className="flex-1"
        >
          Einverständnis bestätigen →
        </Button>
      </div>
    </FormShell>
  );
}
