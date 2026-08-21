import { useMemo, useState, useEffect, useRef } from "react";
import {
  Mail,
  Paperclip,
  Search,
  Inbox,
  Archive,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import type { IncomingEvent } from "@cyber-crisis/shared";
import { useGame } from "../../context/GameContext";
import { playOutlookMailSound } from "../../lib/sounds";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn, formatGameClock } from "../../lib/utils";

type StoredEvent = IncomingEvent & { receivedAt: number; gameTimeSeconds: number };

interface ReadState {
  [eventId: string]: {
    opened: boolean;
    openedAt?: number;
  };
}

/**
 * MailInbox: Outlook-aehnlicher Posteingang als Haupt-Lesekanal.
 * - Links: Folder-Navigation (rein visuell -> Vertrautheit, Alexander 2005)
 * - Mitte: Mail-Liste (Reverse-Chrono, Schweregrad ueber Icon + Subtext)
 * - Rechts: Lesefenster
 * - Tracking (Phase G): mail_opened_at_ms wird beim ersten Oeffnen gesetzt.
 */
export default function MailInbox() {
  const { state, sendEventInteraction, markEventRead } = useGame();
  const events = state.events as StoredEvent[];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Lokaler Zeitstempel fuer Dwell-Time-Berechnung
  const [lastOpenedAt, setLastOpenedAt] = useState<number | null>(null);

  // Outlook-Ton bei jeder neu eintreffenden Mail
  const knownEventIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    let hasNew = false;
    for (const ev of events) {
      if (!knownEventIds.current.has(ev.id)) {
        knownEventIds.current.add(ev.id);
        hasNew = true;
      }
    }
    if (hasNew) playOutlookMailSound();
  }, [events]);

  // Erste eingehende Mail auto-selektieren.
  // Die Interaktion wird OHNE clickedAt geloggt — so bleibt in den Daten
  // unterscheidbar, ob eine Mail aktiv angeklickt oder automatisch
  // geoeffnet wurde (clicked_at_ms ist dann NULL).
  useEffect(() => {
    if (!selectedId && events.length > 0) {
      const first = events[0];
      const openedAt = Date.now();
      setSelectedId(first.id);
      setLastOpenedAt(openedAt);
      if (!state.readEventIds.includes(first.id)) {
        markEventRead(first.id);
        sendEventInteraction({
          eventId: first.id,
          eventType: "incident",
          firstSeenAtMs: openedAt,
        });
      }
    }
  }, [events, selectedId, markEventRead, sendEventInteraction, state.readEventIds]);

  const filtered = useMemo(() => {
    if (!query.trim()) return events;
    const q = query.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q),
    );
  }, [events, query]);

  const selected = events.find((e) => e.id === selectedId) || null;

  const handleOpen = (event: StoredEvent) => {
    const previousId = selectedId;
    const openedAt = Date.now();
    setSelectedId(event.id);

    // Beim Wechsel des selektierten Events: dwell_time der vorherigen Mail nachtragen
    if (previousId && previousId !== event.id && lastOpenedAt) {
      sendEventInteraction({
        eventId: previousId,
        eventType: "incident",
        firstSeenAtMs: lastOpenedAt,
        clickedAt: lastOpenedAt,
        dwellTimeMs: openedAt - lastOpenedAt,
      });
    }

    setLastOpenedAt(openedAt);

    if (!state.readEventIds.includes(event.id)) {
      markEventRead(event.id);
      // Tracking: erstes Oeffnen (Entscheidungsqualitaet, Zeitverhalten)
      sendEventInteraction({
        eventId: event.id,
        eventType: "incident",
        firstSeenAtMs: openedAt,
        clickedAt: openedAt,
      });
    }
  };

  const unreadCount = events.filter((e) => !state.readEventIds.includes(e.id)).length;

  return (
    <Card
      className="@container flex h-full min-h-0 flex-col overflow-hidden"
      aria-label="Mail-Posteingang"
      data-tutorial="mail-inbox"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--color-brand-700)]" aria-hidden />
          <CardTitle>Posteingang</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="solid" size="sm" aria-label={`${unreadCount} ungelesen`}>
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-surface-400)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen..."
            aria-label="Mails durchsuchen"
            className={cn(
              "h-7 w-48 rounded-[var(--radius-sm)] border pl-7 pr-2 text-xs",
              "border-[var(--color-surface-300)] bg-[var(--color-surface-50)]",
              "focus:border-[var(--color-brand-400)] focus:bg-white focus:outline-none",
            )}
          />
        </div>
      </CardHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(200px,1fr)_minmax(240px,1.6fr)] @[720px]:grid-cols-[140px_minmax(260px,1fr)_minmax(320px,1.6fr)]">
        {/* Folder-Navigation */}
        <nav
          className="hidden @[720px]:flex flex-col gap-1 border-r border-[var(--color-surface-100)] bg-[var(--color-surface-50)] p-3 text-xs"
          aria-label="Ordner"
        >
          <FolderItem icon={Inbox} label="Posteingang" count={events.length} active />
          <FolderItem icon={AlertCircle} label="Dringend" disabled />
          <FolderItem icon={Archive} label="Archiv" disabled />
        </nav>

        {/* Mail-Liste */}
        <ul
          className="min-h-0 overflow-y-auto border-r border-[var(--color-surface-100)] bg-white scrollbar-thin"
          role="listbox"
          aria-label="Eingehende Meldungen"
        >
          {filtered.length === 0 && (
            <li className="p-8 text-center text-xs text-slate-400 italic">
              Keine Meldungen im Posteingang.
            </li>
          )}
          {filtered.map((ev) => {
            const unread = !state.readEventIds.includes(ev.id);
            const isSelected = ev.id === selectedId;
            return (
              <li key={ev.id}>
                <button
                  onClick={() => handleOpen(ev)}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "relative flex w-full flex-col gap-1 border-b border-slate-50 px-4 py-3.5 text-left transition-all",
                    "hover:bg-slate-50",
                    isSelected && "bg-brand-50/40 hover:bg-brand-50/50",
                  )}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-600 shadow-[0_0_8px_rgba(79,70,229,0.4)]" />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-[10px] font-bold uppercase tracking-wider",
                        unread ? "text-brand-600" : "text-slate-500",
                      )}
                    >
                      {ev.source}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {formatGameClock(ev.gameTimeSeconds)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "truncate text-xs leading-tight",
                      unread
                        ? "font-bold text-slate-900"
                        : "font-medium text-slate-700",
                    )}
                  >
                    {ev.title}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="truncate text-[11px] text-slate-500 flex-1">
                      {ev.body}
                    </p>
                    <SeverityPill severity={ev.severity} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Lesefenster */}
        <section
          className="min-h-0 overflow-y-auto p-4 scrollbar-thin"
          aria-label="Lesefenster"
        >
          {selected ? (
            <MailReader event={selected} />
          ) : (
            <EmptyReader />
          )}
        </section>
      </div>
    </Card>
  );
}

function FolderItem({
  icon: Icon,
  label,
  count,
  active,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5",
        active
          ? "bg-[var(--color-brand-50)] font-medium text-[var(--color-brand-700)]"
          : disabled
            ? "cursor-default opacity-50 text-[var(--color-surface-400)]"
            : "text-[var(--color-surface-600)] hover:bg-[var(--color-surface-100)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] text-[var(--color-surface-500)]">{count}</span>
      )}
    </div>
  );
}

function SeverityPill({ severity }: { severity: IncomingEvent["severity"] }) {
  if (severity === "critical") {
    return <Badge variant="crit" size="sm">krit.</Badge>;
  }
  if (severity === "warning") {
    return <Badge variant="warn" size="sm">warn.</Badge>;
  }
  return <Badge variant="neutral" size="sm">info</Badge>;
}

function MailReader({ event }: { event: StoredEvent }) {
  const attachmentCount = event.metadata?.attachments
    ? Number.parseInt(event.metadata.attachments, 10) || 0
    : 0;

  return (
    <article className="max-w-3xl mx-auto">
      <header className="mb-6 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-2 mb-3">
          <SeverityPill severity={event.severity} />
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
            ID: {event.id.split('-')[0]}
          </span>
        </div>
        <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-900 mb-4">
          {event.title}
        </h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">Absender</span>
            <span className="font-bold text-slate-800">{event.source}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">Zeitstempel</span>
            <span className="font-mono font-medium text-slate-600">{formatGameClock(event.gameTimeSeconds)}</span>
          </div>
        </div>
      </header>

      <div className="prose-sm max-w-none whitespace-pre-line text-[15px] leading-relaxed text-slate-700 font-medium">
        {event.body}
      </div>

      {attachmentCount > 0 && (
        <div className="mt-8 rounded-[var(--radius-md)] border border-brand-100 bg-brand-50/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-brand-700 uppercase tracking-widest">
            <Paperclip className="h-4 w-4" aria-hidden />
            Anhänge ({attachmentCount})
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: attachmentCount }).map((_, i) => (
              <Badge key={i} variant="outline" size="md" className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer shadow-sm">
                Dokument_{i + 1}.pdf
              </Badge>
            ))}
          </div>
        </div>
      )}

      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <details className="mt-6 rounded-[var(--radius-md)] border border-slate-100 bg-slate-50 p-4 group">
          <summary className="cursor-pointer text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-brand-600 transition-colors outline-none">
            Metadaten & Header
          </summary>
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-[11px] leading-tight">
            {Object.entries(event.metadata).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-400">{k}:</dt>
                <dd className="text-slate-600 break-all">{v}</dd>
              </div>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function EmptyReader() {
  return (
    <div className="flex h-full items-center justify-center text-center text-xs text-[var(--color-surface-500)]">
      <div>
        <Mail
          className="mx-auto mb-2 h-8 w-8 text-[var(--color-surface-300)]"
          aria-hidden
        />
        Wähle eine Meldung aus.
      </div>
    </div>
  );
}
