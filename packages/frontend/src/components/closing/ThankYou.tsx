import React from "react";
import { FormShell } from "../forms/FormShell";

export default function ThankYou() {
  return (
    <FormShell variant="light">
      <div className="mb-3 text-5xl text-[var(--color-ok-600)]">&#10003;</div>
      <h2 className="mb-4 text-xl font-bold text-[var(--color-study-text)]">Vielen Dank!</h2>
      <p className="mb-3 text-sm text-[var(--color-study-text-muted)]">
        Ihre Teilnahme an der Studie ist abgeschlossen. Ihre Daten wurden
        erfolgreich gespeichert.
      </p>
      <p className="mb-5 text-sm text-[var(--color-study-text-muted)]">
        Bei Fragen oder Anmerkungen können Sie sich jederzeit an die
        Studienleitung wenden.
      </p>
      <p className="text-sm text-[var(--color-study-faint)]">
        Sie können dieses Fenster nun schließen.
      </p>
    </FormShell>
  );
}
