import { useState, useCallback } from "react";
import { useGame } from "../../context/GameContext";
import { FormShell } from "../forms/FormShell";
import { FormField, INPUT_CLS } from "../forms/FormField";
import { Button } from "../ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ImpressumLink } from "../common/Impressum";
import { FogOfCrisisLogo } from "../common/FogOfCrisisLogo";

/** Generate a short random participant ID (e.g. "K7X-M2P") */
function generateRandomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  const seg = (len: number) => Array.from({ length: len }, pick).join("");
  return `${seg(3)}-${seg(3)}`;
}

// Mirrors the server-side validation in gameSocket.ts (handleJoinSession)
function validateParticipantId(id: string): string | null {
  if (id.length < 3 || id.length > 80) {
    return "Die Teilnahme-ID muss zwischen 3 und 80 Zeichen lang sein.";
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return "Nur Buchstaben, Ziffern, Bindestrich und Unterstrich sind erlaubt (keine Leer- oder Sonderzeichen).";
  }
  return null;
}

export default function WelcomeScreen() {
  const { state, joinSession } = useGame();
  const [participantId, setParticipantId] = useState(generateRandomId);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleReroll = useCallback(() => {
    setParticipantId(generateRandomId());
    setValidationError(null);
  }, []);

  const handleStart = () => {
    const cleanId = participantId.trim();
    if (!cleanId) return;
    const err = validateParticipantId(cleanId);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    joinSession(cleanId);
  };

  // Server-side rejection (e.g. ID already used and finished) or local validation
  const errorMessage = validationError ?? state.error;

  return (
    <FormShell variant="light">
      {/* Logo / Header */}
      <div className="mb-8 flex justify-center">
        <FogOfCrisisLogo />
      </div>

      {/* Divider */}
      <div
        className="mb-6 h-px w-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(79,70,229,0.25), transparent)" }}
      />

      <div className="mb-6 space-y-2.5 text-sm text-[var(--color-study-text-muted)]">
        <p>
          Willkommen zur Studie <strong className="text-[var(--color-study-text)]">Entscheidungen in Cyberkrisen</strong>.
        </p>
        <p>
          Sie werden in die Rolle einer Krisenstabs-Leitung versetzt und
          müssen unter Zeitdruck Entscheidungen während eines Cyberangriffs treffen.
        </p>
        <p>
          Die Teilnahme dauert ca. <strong className="text-[var(--color-study-text)]">15–25 Minuten</strong>. Bitte
          stellen Sie sicher, dass Sie ungestört arbeiten können.
        </p>
        <p>
          Dieses Spiel ist Teil einer Masterarbeit. Im Rahmen der Studie werden Interaktions- und Entscheidungsdaten erhoben.
        </p>
      </div>

      <FormField
        label="Ihre anonyme Teilnahme-ID"
        hint="Diese ID wurde zufällig erzeugt. Sie können sie neu würfeln oder manuell ändern. Bitte notieren Sie die ID. Sie benötigen sie für Auskunfts- oder Löschanfragen."
      >
        <div className="flex gap-2">
          <input
            id="participantId"
            type="text"
            value={participantId}
            onChange={(e) => {
              setParticipantId(e.target.value);
              setValidationError(null);
            }}
            placeholder="z.B. K7X-M2P"
            className={INPUT_CLS}
            maxLength={80}
            aria-invalid={!!errorMessage}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
          />
          <button
            type="button"
            onClick={handleReroll}
            className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-study-field-border)] bg-[var(--color-study-nested)] p-2 text-[var(--color-study-text-subtle)] transition-colors hover:bg-[var(--color-study-card-border)] hover:text-[var(--color-study-text)]"
            title="Neue ID würfeln"
            aria-label="Neue ID würfeln"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </FormField>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--color-crit-200)] bg-[var(--color-crit-50)] p-3 text-sm text-[var(--color-crit-700)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleStart}
        disabled={!participantId.trim()}
      >
        Teilnahme starten
      </Button>

      <div className="mt-6 flex justify-center">
        <ImpressumLink />
      </div>
    </FormShell>
  );
}
