import { Download } from "lucide-react";
import type { AdminContext } from "../AdminApp";

function DownloadButton({ label, url, apiKey, filename }: { label: string; url: string; apiKey: string; filename: string }) {
  async function handleDownload() {
    const res = await fetch(url, { headers: apiKey ? { "x-api-key": apiKey } : {} });
    if (!res.ok) {
      alert(`Download fehlgeschlagen: ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 px-4 py-3 text-sm font-medium text-surface-700 shadow-panel hover:bg-surface-50 active:bg-surface-100"
    >
      <Download size={16} className="text-brand-600" />
      {label}
    </button>
  );
}

export function ExportSection({ apiKey }: AdminContext & { refreshKey: number }) {
  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold text-surface-900">10 — Daten-Export</h2>

      <div className="rounded-lg border border-surface-200 bg-surface-0 p-6">
        <h3 className="mb-4 text-sm font-semibold text-surface-800">Export-Formate</h3>
        <div className="flex flex-wrap gap-3">
          <DownloadButton
            label="CSV-Export (ZIP)"
            url="/api/admin/export/csv"
            apiKey={apiKey}
            filename="cybercrisis_export.zip"
          />
          <DownloadButton
            label="JSON-Export"
            url="/api/admin/export/json"
            apiKey={apiKey}
            filename="cybercrisis_export.json"
          />
        </div>
      </div>

      <div className="rounded-lg border border-surface-200 bg-surface-0 p-6">
        <h3 className="mb-3 text-sm font-semibold text-surface-800">Hinweise zum Export</h3>
        <div className="space-y-2 text-xs text-surface-600">
          <p>
            Der <strong>CSV-Export</strong> enthält ein ZIP-Archiv mit folgenden Dateien:
            sessions.csv, decisions.csv, decisions_long.csv, event_interactions.csv,
            survey_responses.csv, audit_log.csv, codebook.md sowie eine manifest.json
            mit SHA-256-Prüfsummen.
          </p>
          <p>
            Der <strong>JSON-Export</strong> enthält alle Daten in einem strukturierten
            JSON-Objekt ohne Prüfsummen.
          </p>
          <p>
            Beide Exporte enthalten nur Pseudonyme (keine Klarnamen). Freitexte (Rollen,
            Reflexionstexte) sind im Export enthalten. Für die konfirmatorische Auswertung
            (t-Test, Mann-Whitney-U, ANCOVA) das CSV-Export in R/SPSS laden.
          </p>
          <p className="font-medium text-warn-700">
            Exporte enthalten personenbezogene Metadaten (user_agent, Zeitstempel). Vor
            Weitergabe prüfen, ob eine Anonymisierung erforderlich ist.
          </p>
        </div>
      </div>
    </div>
  );
}
