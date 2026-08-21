import * as React from "react";
import { cn } from "../../lib/utils";

interface FormShellProps {
  children: React.ReactNode;
  wide?: boolean;
  alertMode?: boolean;
  className?: string;
  variant?: "light" | "dark";
}

export function FormShell({
  children,
  wide = false,
  alertMode = false,
  className,
  variant = "light",
}: FormShellProps) {
  // ── LIGHT variant (study screens: welcome, consent, demographics, post-survey, debriefing, thank-you) ──
  if (variant === "light") {
    return (
      <div
        className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 md:p-8"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.07) 0%, transparent 60%), var(--color-study-bg)",
        }}
      >
        {/* Card */}
        <div
          className={cn(
            "relative z-10 w-full rounded-[var(--radius-lg)] p-8 md:p-10",
            "border border-[var(--color-study-card-border)]",
            "shadow-[var(--shadow-study-card)]",
            wide ? "max-w-2xl" : "max-w-lg",
            className,
          )}
          style={{ background: "var(--color-study-card)" }}
        >
          {/* Dezent top accent line */}
          <div
            className="absolute left-0 right-0 top-0 h-px rounded-t-[var(--radius-lg)]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(79,70,229,0.45) 35%, rgba(129,140,248,0.30) 65%, transparent 100%)",
            }}
          />
          {children}
        </div>
      </div>
    );
  }

  // ── DARK variant (Briefing step 1 / Lage-Briefing — unchanged original look) ──
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 md:p-8"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 15% 35%, rgba(99,102,241,0.14) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 85% 75%, rgba(244,63,94,0.07) 0%, transparent 50%), #020617",
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Alert-mode: red grid that slowly pulses over the indigo base grid */}
      {alertMode && (
        <div
          className="briefing-grid-threat pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(244,63,94,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.10) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      )}

      {/* Alert-mode: large red ambient bloom in the center */}
      {alertMode && (
        <div
          className="briefing-bg-bloom pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 75% 65% at 50% 50%, rgba(244,63,94,0.13) 0%, transparent 65%)",
          }}
        />
      )}

      {/* Floating ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -left-32 top-1/4 h-72 w-72 rounded-full opacity-60"
          style={{
            background: alertMode
              ? "radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
            animation: "float 10s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full opacity-40"
          style={{
            background: alertMode
              ? "radial-gradient(circle, rgba(244,63,94,0.10) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)",
            animation: "float-slow 15s ease-in-out infinite",
          }}
        />
        <div
          className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full opacity-30"
          style={{
            background: alertMode
              ? "radial-gradient(circle, rgba(244,63,94,0.08) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
            animation: "float 13s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Card */}
      <div
        className={cn(
          "relative z-10 w-full rounded-[var(--radius-md)] p-8 md:p-10",
          "border border-[rgba(99,102,241,0.18)]",
          "shadow-[0_0_50px_rgba(99,102,241,0.07),0_25px_60px_rgba(0,0,0,0.5)]",
          wide ? "max-w-2xl" : "max-w-lg",
          className,
        )}
        style={{
          background: "rgba(10,14,28,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {/* Top gradient accent line */}
        <div
          className="absolute left-0 right-0 top-0 h-px rounded-t-[var(--radius-md)]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.7) 30%, rgba(129,140,248,0.4) 60%, transparent 100%)",
          }}
        />
        {children}
      </div>
    </div>
  );
}
