import { useState, FormEvent } from "react";
import { Lock } from "lucide-react";

interface LoginProps {
  onLogin: (apiKey: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-api-key": key },
      });
      if (res.status === 401) {
        setError("Ungültiger API-Key.");
      } else if (res.status === 429) {
        setError("Zu viele Fehlversuche. Bitte warten.");
      } else if (!res.ok) {
        setError(`Fehler: HTTP ${res.status}`);
      } else {
        sessionStorage.setItem("admin_api_key", key);
        onLogin(key);
      }
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-surface-200 bg-surface-0 p-8 shadow-panel">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Lock size={22} className="text-brand-600" />
          </div>
          <h1 className="text-lg font-bold text-surface-900">Admin-Dashboard</h1>
          <p className="text-center text-xs text-surface-500">Fog of Crisis — Studienleitung</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-700" htmlFor="apikey">
              API-Key
            </label>
            <input
              id="apikey"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-surface-300 bg-surface-0 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="rounded-md bg-crit-50 px-3 py-2 text-xs text-crit-700 border border-crit-200">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="flex h-9 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Prüfe…" : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}
