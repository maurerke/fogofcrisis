import { useState } from "react";
import { X } from "lucide-react";

export function ImpressumLink() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--color-study-text-subtle)] underline-offset-2 hover:text-[var(--color-study-text-muted)] hover:underline transition-colors"
      >
        Impressum
      </button>

      {open && <ImpressumModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ImpressumModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-study-card-border)] p-7 text-sm"
        style={{
          background: "var(--color-study-card)",
          boxShadow: "var(--shadow-study-card)",
        }}
      >
        {/* Dezent top accent line — lighter version matching the light FormShell card */}
        <div
          className="absolute left-0 right-0 top-0 h-px rounded-t-[var(--radius-md)]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(79,70,229,0.45) 35%, rgba(129,140,248,0.30) 65%, transparent 100%)",
          }}
        />

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-study-text)]">Impressum</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-study-text-subtle)] hover:text-[var(--color-study-text-muted)] transition-colors"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-[var(--color-study-text-muted)] leading-relaxed">
          <section>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-study-text-subtle)]">Angaben gem. § 5 TMG</p>
            <p className="text-[var(--color-study-text)]">Kevin Maurer</p>
            <p>Kontakt: <a href="mailto:kevin.maurer@iu-study.org" className="text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)] underline-offset-2 hover:underline">kevin.maurer@iu-study.org</a></p>
          </section>

          <section>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-study-text-subtle)]">Akademischer Rahmen</p>
            <p>
              Diese Website ist ein Forschungsinstrument im Rahmen einer Masterarbeit
              (M.Sc. Cyber Security) an der{" "}
              <span className="text-[var(--color-study-text)]">IU Internationale Hochschule</span>.
            </p>
          </section>

          <section>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-study-text-subtle)]">Hinweis</p>
            <p>
              Dieses Angebot verfolgt ausschließlich nicht-kommerzielle, wissenschaftliche
              Zwecke und ist auf einen begrenzten Teilnehmerkreis beschränkt.
              Anfragen zum Datenschutz oder zur Datenauskunft richten Sie bitte per
              E-Mail an die oben genannte Adresse.
            </p>
          </section>

          <section>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-study-text-subtle)]">Haftungsausschluss</p>
            <p>
              Die Inhalte dieser Seite wurden mit Sorgfalt erstellt.
              Eine Haftung für die Richtigkeit, Vollständigkeit und Aktualität
              der Inhalte wird nicht übernommen.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
