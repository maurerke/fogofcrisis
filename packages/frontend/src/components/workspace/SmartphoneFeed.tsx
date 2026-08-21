import { useEffect, useMemo, useRef } from "react";
import type { MediaFeedItem } from "@cyber-crisis/shared";
import { useGame } from "../../context/GameContext";
import { cn, formatGameClock, gameElapsedSeconds } from "../../lib/utils";
import { playIphoneNotification } from "../../lib/sounds";
import {
  BatteryFull,
  Signal,
  Wifi,
  MessageCircle,
  Newspaper,
  Camera,
  Globe,
  Send,
  type LucideIcon,
} from "lucide-react";

type StoredMedia = MediaFeedItem & { receivedAt: number; gameTimeSeconds: number };

/**
 * SmartphoneFeed: iOS-artige Lockscreen-Push-Darstellung fuer Gruppe B.
 * - Platform-Vertrautheit (Alexander 2005, Wardle/Derakhshan 2017)
 * - Rein visuelle Anzeige: Quellenhinweise, Engagement-Metrik, Zeitstempel
 * - Methoden-Guardrail: Gruppe A rendert diese Komponente gar nicht.
 */
export default function SmartphoneFeed() {
  const { state, sendEventInteraction } = useGame();
  const items = state.mediaItems as StoredMedia[];
  const seenRef = useRef<Set<string>>(new Set());

  // Tracking: jede neu eintreffende Push-Notification als "first_seen" registrieren
  useEffect(() => {
    let hasNew = false;
    for (const item of items) {
      if (!seenRef.current.has(item.id)) {
        seenRef.current.add(item.id);
        hasNew = true;
        sendEventInteraction({
          eventId: item.id,
          eventType: "media",
          firstSeenAtMs: item.receivedAt,
        });
      }
    }
    if (hasNew) playIphoneNotification();
  }, [items, sendEventInteraction]);

  const clockLabel = useMemo(
    () => formatGameClock(gameElapsedSeconds(state)),
    [state.scenarioElapsedOffsetSeconds, state.currentPhase, state.timerSeconds],
  );

  // Fixed scenario date: the scenario takes place on a Tuesday morning
  const dateLabel = "Dienstag, 14. Oktober";

  return (
    <div
      className="flex h-full min-h-0 items-center justify-center p-4"
      aria-label="Medien-Feed (Smartphone)"
      data-tutorial="smartphone-feed"
    >
      <div
        className={cn(
          "phone-frame relative flex flex-col overflow-hidden",
          "aspect-[9/18.5] w-full max-w-[300px]",
          "rounded-[48px] border-[8px] border-slate-900 bg-slate-950 p-1.5 shadow-2xl",
          "ring-2 ring-white/5",
        )}
        role="region"
      >
        {/* Bezel / Screen */}
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[40px] bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white">
          {/* Internal Reflection / Shine */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_50%)] pointer-events-none" />
          
          {/* Dynamic Island */}
          <div
            aria-hidden
            className="absolute left-1/2 top-2.5 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black shadow-inner"
          />

          {/* Status Bar */}
          <div className="relative z-10 flex items-center justify-between px-7 pt-4 text-[12px] font-bold">
            <span className="font-sans tabular-nums">{clockLabel}</span>
            <div className="flex items-center gap-1.5 opacity-80">
              <Signal className="h-3 w-3" aria-hidden />
              <Wifi className="h-3 w-3" aria-hidden />
              <div className="flex h-3 w-5 items-center justify-center rounded-sm border border-white/30 px-0.5">
                <div className="h-full w-full bg-white/90 rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* Lockscreen Clock */}
          <div className="mt-8 text-center px-4">
            <div className="text-[13px] font-medium text-white/60 tracking-tight">{dateLabel}</div>
            <div className="font-sans text-6xl font-extralight leading-none tracking-tighter mt-1">
              {clockLabel}
            </div>
          </div>

          {/* Push Notifications */}
          <div
            className="mt-6 flex-1 overflow-y-auto px-3 pb-6 scrollbar-thin"
            role="list"
            aria-label="Push-Nachrichten"
          >
            {items.length === 0 && (
              <div className="mt-12 text-center text-xs text-white/30 font-medium italic">
                Sperrbildschirm leer.
              </div>
            )}
            <ul className="flex flex-col gap-2.5">
              {items.map((item) => (
                <PushItem key={item.id} item={item} />
              ))}
            </ul>
          </div>

          {/* Home Indicator */}
          <div
            aria-hidden
            className="mx-auto mb-2 h-1.5 w-28 rounded-full bg-white/30"
          />
        </div>
      </div>
    </div>
  );
}

function PushItem({ item }: { item: StoredMedia }) {
  const meta = AppMetaFor(item);
  const engagement = item.engagementMetrics;
  const isTelegram = item.type === "telegram_post";
  const tone =
    item.emotionalTone === "alarming" || item.emotionalTone === "panicking"
      ? "border-red-400/40"
      : item.emotionalTone === "threatening"
        ? "border-red-600/60"
        : item.emotionalTone === "accusatory"
          ? "border-amber-400/40"
          : item.emotionalTone === "suspicious"
            ? "border-amber-300/30"
            : "border-white/20";

  return (
    <li
      role="listitem"
      className={cn(
        "rounded-2xl border p-2.5 backdrop-blur",
        "text-white shadow-sm",
        isTelegram ? "bg-[#1e3a5f]/80" : "bg-white/10",
        tone,
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-[10px] text-white/80">
        <meta.icon className="h-3 w-3" aria-hidden />
        <span className="font-medium uppercase tracking-wider">{meta.app}</span>
        <span className="text-white/50">·</span>
        <span className="truncate">{item.source}</span>
        <span className="ml-auto font-mono tabular-nums text-white/60">
          {formatGameClock(item.gameTimeSeconds)}
        </span>
      </div>
      <p className="text-[12px] leading-snug">
        {item.content}
      </p>
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt={`Bild zu: ${item.source}`}
          loading="lazy"
          className="mt-2 w-full max-h-40 rounded-xl object-cover"
        />
      )}
      {engagement && (
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-white/60">
          <span>♥ {formatCompact(engagement.likes)}</span>
          <span>↻ {formatCompact(engagement.shares)}</span>
          <span>💬 {formatCompact(engagement.comments)}</span>
          {item.sourceVerified ? (
            <span className="ml-auto text-sky-300">✓ verifiziert</span>
          ) : (
            <span className="ml-auto text-white/40">unverifiziert</span>
          )}
        </div>
      )}
    </li>
  );
}

function AppMetaFor(item: MediaFeedItem): {
  app: string;
  icon: LucideIcon;
} {
  switch (item.type) {
    case "tweet":
      return { app: "X", icon: MessageCircle };
    case "news_headline":
      return { app: "News", icon: Newspaper };
    case "news_ticker":
      return { app: "Live", icon: Camera };
    case "forum_post":
      return { app: "Forum", icon: MessageCircle };
    case "official_statement":
      return { app: "Behörde", icon: Globe };
    case "telegram_post":
      return { app: "Telegram", icon: Send };
    default:
      return { app: "Feed", icon: Newspaper };
  }
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}
