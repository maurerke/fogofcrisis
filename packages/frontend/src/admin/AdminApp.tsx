import { useState, lazy, Suspense } from "react";
import "./admin.css";
import { Login } from "./sections/Login";
import { LogOut, RefreshCw } from "lucide-react";

const Overview = lazy(() => import("./sections/Overview").then((m) => ({ default: m.Overview })));
const Demographics = lazy(() => import("./sections/Demographics").then((m) => ({ default: m.Demographics })));
const DecisionQuality = lazy(() => import("./sections/DecisionQuality").then((m) => ({ default: m.DecisionQuality })));
const Timing = lazy(() => import("./sections/Timing").then((m) => ({ default: m.Timing })));
const Workload = lazy(() => import("./sections/Workload").then((m) => ({ default: m.Workload })));
const Attention = lazy(() => import("./sections/Attention").then((m) => ({ default: m.Attention })));
const DataQuality = lazy(() => import("./sections/DataQuality").then((m) => ({ default: m.DataQuality })));
const FreeText = lazy(() => import("./sections/FreeText").then((m) => ({ default: m.FreeText })));
const Drilldown = lazy(() => import("./sections/Drilldown").then((m) => ({ default: m.Drilldown })));
const ExportSection = lazy(() => import("./sections/ExportSection").then((m) => ({ default: m.ExportSection })));
const Sessions = lazy(() => import("./sections/Sessions").then((m) => ({ default: m.Sessions })));

const TABS = [
  { label: "Überblick", short: "Überblick" },
  { label: "Stichprobe & Demografie", short: "Demografie" },
  { label: "RQ1 — Entscheidungsqualität", short: "RQ1 DQS" },
  { label: "RQ2 — Geschwindigkeit", short: "RQ2 Zeit" },
  { label: "RQ3 — Kognitive Beanspruchung", short: "RQ3 TLX" },
  { label: "RQ4 — Aufmerksamkeit", short: "RQ4 Attn" },
  { label: "Datenqualität & Flags", short: "Qualität" },
  { label: "Freitext & Feedback", short: "Freitext" },
  { label: "Session-Drilldown", short: "Drilldown" },
  { label: "Export", short: "Export" },
  { label: "Sessions verwalten", short: "Sessions" },
];

export interface AdminContext {
  apiKey: string;
  groupFilter: "all" | "A" | "B";
  onDrilldown: (sessionId: string) => void;
}

function SectionFallback() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-surface-400">
      Lade Sektion…
    </div>
  );
}

export default function AdminApp() {
  const stored = sessionStorage.getItem("admin_api_key") ?? "";
  const [apiKey, setApiKey] = useState(stored);
  const [activeTab, setActiveTab] = useState(0);
  const [groupFilter, setGroupFilter] = useState<"all" | "A" | "B">("all");
  const [drilldownId, setDrilldownId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!apiKey) {
    return <Login onLogin={(k) => setApiKey(k)} />;
  }

  const ctx: AdminContext = {
    apiKey,
    groupFilter,
    onDrilldown: (id) => {
      setDrilldownId(id);
      setActiveTab(8);
    },
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_api_key");
    setApiKey("");
  };

  const renderSection = () => {
    switch (activeTab) {
      case 0: return <Overview {...ctx} refreshKey={refreshKey} />;
      case 1: return <Demographics {...ctx} refreshKey={refreshKey} />;
      case 2: return <DecisionQuality {...ctx} refreshKey={refreshKey} />;
      case 3: return <Timing {...ctx} refreshKey={refreshKey} />;
      case 4: return <Workload {...ctx} refreshKey={refreshKey} />;
      case 5: return <Attention {...ctx} refreshKey={refreshKey} />;
      case 6: return <DataQuality {...ctx} refreshKey={refreshKey} />;
      case 7: return <FreeText {...ctx} refreshKey={refreshKey} />;
      case 8: return <Drilldown {...ctx} refreshKey={refreshKey} initialSessionId={drilldownId} />;
      case 9: return <ExportSection {...ctx} refreshKey={refreshKey} />;
      case 10: return <Sessions {...ctx} refreshKey={refreshKey} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-surface-200 bg-surface-0 shadow-panel">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-surface-900">Fog of Crisis — Admin</span>
            <span className="hidden text-xs text-surface-400 sm:block">Forschungs-Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Group filter */}
            <div className="flex items-center gap-1 rounded-md border border-surface-200 bg-surface-50 p-1 text-xs">
              {(["all", "A", "B"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupFilter(g)}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    groupFilter === g
                      ? "bg-brand-600 text-white"
                      : "text-surface-600 hover:bg-surface-200"
                  }`}
                >
                  {g === "all" ? "A+B" : `Gruppe ${g}`}
                </button>
              ))}
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Daten neu laden"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-surface-500 hover:bg-surface-100"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={handleLogout}
              title="Abmelden"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-surface-500 hover:bg-surface-100"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
        {/* Tab navigation */}
        <nav className="mx-auto flex max-w-screen-2xl gap-0.5 overflow-x-auto px-4 pb-0">
          {TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`whitespace-nowrap border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === i
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700"
              }`}
            >
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden">{tab.short}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-screen-2xl px-4 py-6">
        <Suspense fallback={<SectionFallback />}>
          {renderSection()}
        </Suspense>
      </main>
    </div>
  );
}
