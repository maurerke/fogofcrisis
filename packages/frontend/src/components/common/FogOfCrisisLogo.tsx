import { cn } from "../../lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Show the pulsing live-indicator dot */
  live?: boolean;
}

/**
 * Icon mark — hexagonal, eye-through-fog motif.
 * Works at any size; use size prop to scale.
 */
export function FogOfCrisisLogoMark({ size = 64, className, live = false }: LogoMarkProps) {
  const id = "foc"; // stable prefix — one instance per page is expected

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        aria-hidden="true"
      >
        <defs>
          {/* Background gradient: deep indigo → violet */}
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1e1b4b" />
            <stop offset="0.5" stopColor="#312e81" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>

          {/* Radial glow on the iris */}
          <radialGradient id={`${id}-iris`} cx="50%" cy="45%" r="50%">
            <stop stopColor="#e0e7ff" />
            <stop offset="1" stopColor="#a5b4fc" />
          </radialGradient>

          {/* Horizontal fade for fog streaks */}
          <linearGradient id={`${id}-fog`} x1="4" y1="0" x2="60" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0" />
            <stop offset="0.22" stopColor="white" stopOpacity="0.65" />
            <stop offset="0.78" stopColor="white" stopOpacity="0.65" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Clip to hexagon shape */}
          <clipPath id={`${id}-hex-clip`}>
            <path d="M60 32 L46 57 L18 57 L4 32 L18 7 L46 7 Z" />
          </clipPath>
        </defs>

        {/* ── Hexagon background ── */}
        <path d="M60 32 L46 57 L18 57 L4 32 L18 7 L46 7 Z" fill={`url(#${id}-bg)`} />

        {/* Inner border */}
        <path
          d="M59 32 L45.4 56 L18.6 56 L5 32 L18.6 8 L45.4 8 Z"
          fill="none"
          stroke="white"
          strokeOpacity="0.12"
          strokeWidth="0.6"
        />

        {/* Subtle dot grid (clipped) */}
        <g clipPath={`url(#${id}-hex-clip)`} fill="white" fillOpacity="0.07">
          {/* row 1 */}
          <circle cx="16" cy="16" r="1" /><circle cx="24" cy="16" r="1" />
          <circle cx="32" cy="16" r="1" /><circle cx="40" cy="16" r="1" />
          <circle cx="48" cy="16" r="1" />
          {/* row 2 */}
          <circle cx="12" cy="24" r="1" /><circle cx="20" cy="24" r="1" />
          <circle cx="28" cy="24" r="1" /><circle cx="36" cy="24" r="1" />
          <circle cx="44" cy="24" r="1" /><circle cx="52" cy="24" r="1" />
          {/* row 4 */}
          <circle cx="12" cy="40" r="1" /><circle cx="20" cy="40" r="1" />
          <circle cx="28" cy="40" r="1" /><circle cx="36" cy="40" r="1" />
          <circle cx="44" cy="40" r="1" /><circle cx="52" cy="40" r="1" />
          {/* row 5 */}
          <circle cx="16" cy="48" r="1" /><circle cx="24" cy="48" r="1" />
          <circle cx="32" cy="48" r="1" /><circle cx="40" cy="48" r="1" />
          <circle cx="48" cy="48" r="1" />
        </g>

        {/* ── Eye shape (almond / vesica piscis) ── */}
        <path
          d="M11 32 C16 21 24 18 32 18 C40 18 48 21 53 32 C48 43 40 46 32 46 C24 46 16 43 11 32 Z"
          fill="none"
          stroke="white"
          strokeOpacity="0.75"
          strokeWidth="1.2"
        />

        {/* ── Iris ── */}
        <circle cx="32" cy="32" r="6.5" fill={`url(#${id}-iris)`} />

        {/* ── Pupil ── */}
        <circle cx="32" cy="32" r="3" fill="#1e1b4b" />

        {/* Highlight specular */}
        <circle cx="34" cy="30" r="1.2" fill="white" fillOpacity="0.7" />

        {/* ── Fog streak — broad soft middle band ── */}
        <path
          d="M6 32 Q20 28 32 32 Q44 36 58 32"
          stroke="white"
          strokeOpacity="0.12"
          strokeWidth="7"
          strokeLinecap="round"
          clipPath={`url(#${id}-hex-clip)`}
        />

        {/* ── Fog streak — upper wave ── */}
        <path
          d="M7 25 C14 22 20 28 28 25 C36 22 42 28 57 25"
          stroke={`url(#${id}-fog)`}
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* ── Fog streak — lower wave ── */}
        <path
          d="M7 39 C14 36 20 42 28 39 C36 36 42 42 57 39"
          stroke={`url(#${id}-fog)`}
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* ── Circuit node — top-right ── */}
        <g stroke="white" strokeOpacity="0.3" strokeWidth="0.9" strokeLinecap="round">
          <line x1="50" y1="13" x2="44" y2="13" />
          <line x1="44" y1="13" x2="44" y2="19" />
          <circle cx="50" cy="13" r="1.3" fill="white" fillOpacity="0.3" stroke="none" />
          <circle cx="44" cy="19" r="1.3" fill="white" fillOpacity="0.3" stroke="none" />
        </g>

        {/* ── Circuit node — bottom-left ── */}
        <g stroke="white" strokeOpacity="0.3" strokeWidth="0.9" strokeLinecap="round">
          <line x1="14" y1="51" x2="20" y2="51" />
          <line x1="20" y1="51" x2="20" y2="45" />
          <circle cx="14" cy="51" r="1.3" fill="white" fillOpacity="0.3" stroke="none" />
          <circle cx="20" cy="45" r="1.3" fill="white" fillOpacity="0.3" stroke="none" />
        </g>
      </svg>

      {/* Live-Indicator */}
      {live && (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-crit-400)] opacity-60" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[var(--color-crit-500)]" />
        </span>
      )}
    </div>
  );
}

interface LogoFullProps {
  className?: string;
  live?: boolean;
}

/**
 * Full logo: mark + wordmark. Used on the WelcomeScreen.
 */
export function FogOfCrisisLogo({ className, live = false }: LogoFullProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <FogOfCrisisLogoMark size={72} live={live} />
      <div className="text-center">
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{
            // Dark indigo gradient — readable on the light study background
            background: "linear-gradient(135deg, #4338ca 0%, #4f46e5 45%, #6366f1 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Fog of Crisis
        </h1>
        <p className="mt-1.5 text-xs font-semibold tracking-[0.2em] text-[var(--color-study-text-subtle)] uppercase">
          Krisenstab-Simulation · Forschungsstudie
        </p>
      </div>
    </div>
  );
}
