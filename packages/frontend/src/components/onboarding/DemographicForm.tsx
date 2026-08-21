import React, { useState, useEffect, useMemo } from "react";
import { useGame } from "../../context/GameContext";
import type { DemographicData } from "@cyber-crisis/shared";
import { FormShell } from "../forms/FormShell";
import { FormField, INPUT_CLS } from "../forms/FormField";
import { LikertScale } from "../forms/LikertScale";
import { RadioGroup } from "../forms/RadioGroup";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const AGE_RANGES = [
  { value: "unter_18", label: "Unter 18 Jahre" },
  { value: "18-24", label: "18–24 Jahre" },
  { value: "25-34", label: "25–34 Jahre" },
  { value: "35-44", label: "35–44 Jahre" },
  { value: "45-54", label: "45–54 Jahre" },
  { value: "55-64", label: "55–64 Jahre" },
  { value: "65+", label: "65 Jahre oder älter" },
];
const GENDERS = ["Männlich", "Weiblich", "Divers", "Keine Angabe"];
const IT_EXPERIENCE = ["0", "1-2", "3-5", "6-10", "11-20", "20+"];
const LIKERT_LABELS = ["Keine", "Gering", "Mittel", "Hoch", "Sehr hoch"];

const EDUCATION_OPTIONS = [
  "Kein Abschluss",
  "Hauptschulabschluss",
  "Mittlerer Abschluss (MSA / Realschule)",
  "Fachhochschulreife",
  "Abitur / Allgemeine Hochschulreife",
  "Bachelor",
  "Master / Diplom / Magister",
  "Promotion",
  "Keine Angabe",
];

const GERMAN_PROFICIENCY_OPTIONS = [
  { value: "A1", label: "A1 — Anfänger" },
  { value: "A2", label: "A2 — Grundkenntnisse" },
  { value: "B1", label: "B1 — Mittelstufe" },
  { value: "B2", label: "B2 — Gute Kenntnisse" },
  { value: "C1", label: "C1 — Fortgeschritten" },
  { value: "C2", label: "C2 — Muttersprachliches Niveau" },
];

const SOCIAL_MEDIA_USAGE_OPTIONS = [
  { value: "daily", label: "Täglich" },
  { value: "several_per_week", label: "Mehrmals pro Woche" },
  { value: "rarely", label: "Selten" },
  { value: "never", label: "Nie" },
  { value: "no_answer", label: "Keine Angabe" },
];

const likert5 = [1, 2, 3, 4, 5].map((v, i) => ({ value: v, label: LIKERT_LABELS[i] }));

function detectInputDevice(): string {
  if (typeof window === "undefined") return "unknown";
  const hasTouch = window.matchMedia("(pointer: coarse)").matches;
  return hasTouch ? "touch" : "mouse";
}

const SECTIONS = [
  { id: "person", label: "Person" },
  { id: "experience", label: "Erfahrung" },
] as const;

type Section = (typeof SECTIONS)[number]["id"];

export default function DemographicForm() {
  const { state, submitDemographics, setStatus, revokeSession } = useGame();

  const [form, setForm] = useState<DemographicData>({
    ageRange: "",
    gender: "",
    itExperienceYears: "",
    role: "",
    irExperience: undefined,
    crisisCommExperience: undefined,
    education: "",
    fieldOfStudy: "",
    germanProficiency: "",
    socialMediaUsage: "",
    disinfoAwareness: undefined,
    timezone: "",
    browserLocale: "",
    inputDevice: "",
  });

  const [activeSection, setActiveSection] = useState<Section>("person");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      browserLocale: navigator.language || "",
      inputDevice: detectInputDevice(),
    }));
  }, []);

  const isUnderage = form.ageRange === "unter_18";

  // Per-section required field validity
  const sectionValid = useMemo(() => ({
    person:
      form.ageRange !== "" &&
      form.germanProficiency !== "" &&
      (form.socialMediaUsage ?? "") !== "",
    experience:
      (form.itExperienceYears ?? "") !== "" &&
      form.irExperience != null &&
      form.crisisCommExperience != null &&
      form.disinfoAwareness != null,
    context: true,
  }), [form]);

  const allValid = sectionValid.person && sectionValid.experience;

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!sectionValid.person) { setActiveSection("person"); return; }
    if (!sectionValid.experience) { setActiveSection("experience"); return; }
    if (isUnderage) {
      setStatus("underage");
      revokeSession("underage");
      return;
    }
    submitDemographics(form);
  };

  return (
    <FormShell variant="light" wide>
      <h2 className="mb-1 text-xl font-bold text-[var(--color-study-text)]">Demografische Angaben</h2>
      <p className="mb-5 text-sm text-[var(--color-study-text-subtle)]">
        Diese Angaben dienen ausschließlich der wissenschaftlichen Auswertung.
        Mit * markierte Felder sind Pflichtfelder. Alle anderen Felder können Sie mit "Keine Angabe" ausfüllen.
      </p>

      {/* Section-Tabs — with missing-field indicator */}
      <div className="mb-6 flex gap-1 rounded-[var(--radius-sm)] border border-[var(--color-study-card-border)] bg-[var(--color-study-nested)] p-1">
        {SECTIONS.map((sec) => {
          const invalid = submitAttempted && !sectionValid[sec.id];
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={cn(
                "relative flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                activeSection === sec.id
                  ? "bg-[var(--color-brand-600)] text-white"
                  : "text-[var(--color-study-text-muted)] hover:text-[var(--color-study-text)]",
                invalid && activeSection !== sec.id && "text-[var(--color-crit-600)]",
              )}
            >
              {sec.label}
              {invalid && (
                <span
                  className="absolute -right-1 -top-1 flex h-2 w-2 items-center justify-center rounded-full bg-[var(--color-crit-500)]"
                  aria-label="Pflichtfeld fehlt"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ===================== Sektion: Person ===================== */}
      {activeSection === "person" && (
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Altersgruppe" required>
            <select
              value={form.ageRange}
              onChange={(e) => setForm({ ...form, ageRange: e.target.value })}
              className={cn(INPUT_CLS, submitAttempted && !form.ageRange && "border-[var(--color-crit-500)]")}
            >
              <option value="">Bitte wählen</option>
              {AGE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Geschlecht">
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">Bitte wählen</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Höchster Bildungsabschluss">
            <select
              value={form.education || ""}
              onChange={(e) => setForm({ ...form, education: e.target.value })}
              className={INPUT_CLS}
            >
              <option value="">Bitte wählen</option>
              {EDUCATION_OPTIONS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Studien- oder Ausbildungsrichtung (optional)">
            <input
              type="text"
              value={form.fieldOfStudy || ""}
              onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value.substring(0, 80) })}
              placeholder="z.B. Informatik, Verwaltung, Wirtschaft"
              className={INPUT_CLS}
              maxLength={80}
            />
          </FormField>

          <FormField
            label="Deutsche Sprachkompetenz (Selbsteinschätzung)"
            required
            hint="Das Szenario ist ausschließlich auf Deutsch — bitte schätzen Sie Ihr Niveau ein."
            fullWidth
          >
            <select
              value={form.germanProficiency || ""}
              onChange={(e) => setForm({ ...form, germanProficiency: e.target.value })}
              className={cn(INPUT_CLS, submitAttempted && !form.germanProficiency && "border-[var(--color-crit-500)]")}
            >
              <option value="">Bitte wählen</option>
              {GERMAN_PROFICIENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Nutzung sozialer Medien / Nachrichten-Feeds" required fullWidth>
            <RadioGroup
              name="socialMedia"
              options={SOCIAL_MEDIA_USAGE_OPTIONS}
              value={form.socialMediaUsage ?? ""}
              onChange={(val) => setForm({ ...form, socialMediaUsage: val })}
            />
            {submitAttempted && !form.socialMediaUsage && (
              <p className="mt-1 text-xs text-[var(--color-crit-600)]">Bitte eine Option wählen.</p>
            )}
          </FormField>
        </div>
      )}

      {/* ===================== Sektion: Erfahrung ===================== */}
      {activeSection === "experience" && (
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Berufserfahrung IT / IT-Security (Jahre)" required>
            <select
              value={form.itExperienceYears}
              onChange={(e) => setForm({ ...form, itExperienceYears: e.target.value })}
              className={cn(INPUT_CLS, submitAttempted && !form.itExperienceYears && "border-[var(--color-crit-500)]")}
            >
              <option value="">Bitte wählen</option>
              {IT_EXPERIENCE.map((y) => (
                <option key={y} value={y}>{y} Jahre</option>
              ))}
            </select>
          </FormField>

          <FormField label="Aktuelle Rolle / Position">
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="z.B. IT-Administrator, CISO, Student"
              className={INPUT_CLS}
            />
          </FormField>

          <FormField label="Erfahrung mit Incident Response (Likert 1–5)" required fullWidth>
            <LikertScale
              name="irExperience"
              value={form.irExperience}
              onChange={(val) => setForm({ ...form, irExperience: val })}
              options={likert5}
            />
            {submitAttempted && form.irExperience == null && (
              <p className="mt-1 text-xs text-[var(--color-crit-600)]">Bitte eine Stufe auswählen.</p>
            )}
          </FormField>

          <FormField label="Erfahrung mit Krisenkommunikation (Likert 1–5)" required fullWidth>
            <LikertScale
              name="crisisComm"
              value={form.crisisCommExperience}
              onChange={(val) => setForm({ ...form, crisisCommExperience: val })}
              options={likert5}
            />
            {submitAttempted && form.crisisCommExperience == null && (
              <p className="mt-1 text-xs text-[var(--color-crit-600)]">Bitte eine Stufe auswählen.</p>
            )}
          </FormField>

          <FormField
            label="Vorkenntnis zu Desinformation / FIMI (Likert 1–5)"
            required
            hint="Wie gut kennen Sie sich mit dem Thema Desinformation und Informationsmanipulation aus?"
            fullWidth
          >
            <LikertScale
              name="disinfoAwareness"
              value={form.disinfoAwareness}
              onChange={(val) => setForm({ ...form, disinfoAwareness: val })}
              options={[
                { value: 1, label: "Gar nicht" },
                { value: 2 },
                { value: 3, label: "Mittel" },
                { value: 4 },
                { value: 5, label: "Sehr gut" },
              ]}
            />
            {submitAttempted && form.disinfoAwareness == null && (
              <p className="mt-1 text-xs text-[var(--color-crit-600)]">Bitte eine Stufe auswählen.</p>
            )}
          </FormField>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            if (activeSection === "experience") setActiveSection("person");
          }}
          disabled={activeSection === "person"}
          className="flex-1"
        >
          ← Zurück
        </Button>

        {activeSection !== "experience" ? (
          <Button
            variant="secondary"
            onClick={() => {
              if (activeSection === "person") setActiveSection("experience");
            }}
            className="flex-1"
          >
            Weiter →
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSubmit}
            title={!allValid ? "Bitte alle Pflichtfelder ausfüllen" : undefined}
            className="flex-1"
          >
            Weiter zum Briefing
          </Button>
        )}
      </div>
    </FormShell>
  );
}
