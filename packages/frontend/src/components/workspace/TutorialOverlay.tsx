import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export interface TutorialStep {
  targetSelector: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

interface Props {
  steps: TutorialStep[];
  onComplete: () => void;
  onSkip: () => void;
}

const SPOTLIGHT_PAD = 8;
const TOOLTIP_WIDTH = 300;
const TOOLTIP_GAP = 14;
const VIEWPORT_MARGIN = 12;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function TutorialOverlay({ steps, onComplete, onSkip }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<Rect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(160);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[stepIndex];

  // Measure target element position
  useLayoutEffect(() => {
    function measure() {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        setSpotlight({
          top: r.top - SPOTLIGHT_PAD,
          left: r.left - SPOTLIGHT_PAD,
          width: r.width + SPOTLIGHT_PAD * 2,
          height: r.height + SPOTLIGHT_PAD * 2,
        });
      } else {
        setSpotlight(null);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.targetSelector]);

  // Measure tooltip height after each render so clamping uses the real value
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
  });

  function computeTooltipStyle(): React.CSSProperties {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!spotlight) {
      return {
        top: Math.max(VIEWPORT_MARGIN, vh / 2 - tooltipHeight / 2),
        left: Math.max(VIEWPORT_MARGIN, vw / 2 - TOOLTIP_WIDTH / 2),
        width: TOOLTIP_WIDTH,
      };
    }

    const spotCenterX = spotlight.left + spotlight.width / 2;
    const spotCenterY = spotlight.top + spotlight.height / 2;

    // Ideal position relative to spotlight
    let top: number;
    let left: number;

    switch (step.position) {
      case "bottom":
        top = spotlight.top + spotlight.height + TOOLTIP_GAP;
        left = spotCenterX - TOOLTIP_WIDTH / 2;
        break;
      case "top":
        top = spotlight.top - TOOLTIP_GAP - tooltipHeight;
        left = spotCenterX - TOOLTIP_WIDTH / 2;
        break;
      case "right":
        top = spotCenterY - tooltipHeight / 2;
        left = spotlight.left + spotlight.width + TOOLTIP_GAP;
        break;
      case "left":
        top = spotCenterY - tooltipHeight / 2;
        left = spotlight.left - TOOLTIP_GAP - TOOLTIP_WIDTH;
        break;
    }

    // Clamp both axes to keep tooltip fully inside viewport
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - tooltipHeight - VIEWPORT_MARGIN));
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN));

    return { top, left, width: TOOLTIP_WIDTH };
  }

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial Schritt ${stepIndex + 1} von ${steps.length}`}
    >
      {/* Backdrop — split into four rects around the spotlight so clicks on the
          highlighted element are not blocked */}
      {spotlight ? (
        <>
          {/* Top strip */}
          <div
            className="absolute left-0 right-0 top-0"
            style={{ height: spotlight.top, background: "rgba(0,0,0,0.55)" }}
          />
          {/* Bottom strip */}
          <div
            className="absolute left-0 right-0 bottom-0"
            style={{
              top: spotlight.top + spotlight.height,
              background: "rgba(0,0,0,0.55)",
            }}
          />
          {/* Left strip */}
          <div
            className="absolute left-0"
            style={{
              top: spotlight.top,
              width: spotlight.left,
              height: spotlight.height,
              background: "rgba(0,0,0,0.55)",
            }}
          />
          {/* Right strip */}
          <div
            className="absolute right-0"
            style={{
              top: spotlight.top,
              left: spotlight.left + spotlight.width,
              height: spotlight.height,
              background: "rgba(0,0,0,0.55)",
            }}
          />
          {/* Spotlight border ring */}
          <div
            className="absolute rounded-[var(--radius-md)] pointer-events-none transition-all duration-300"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: "0 0 0 2px rgba(255,255,255,0.25)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className={cn(
          "absolute z-10 rounded-[var(--radius-md)] border border-brand-500/10",
          "bg-white shadow-[var(--shadow-elevated)] p-5 transition-[top,left] duration-300",
        )}
        style={computeTooltipStyle()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600">
            Tutorial · {stepIndex + 1} / {steps.length}
          </span>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === stepIndex
                    ? "w-4 bg-brand-500"
                    : "w-1.5 bg-slate-200",
                )}
              />
            ))}
          </div>
        </div>

        <h3 className="text-base font-bold text-slate-900 leading-tight">
          {step.title}
        </h3>
        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
          {step.description}
        </p>

        <div className="mt-6 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" className="text-slate-400 font-bold hover:text-slate-600" onClick={onSkip}>
            Überspringen
          </Button>
          <Button variant="primary" size="sm" className="px-5 font-bold shadow-md shadow-brand-500/20" onClick={handleNext}>
            {stepIndex < steps.length - 1 ? "Nächster Schritt" : "Starten"}
          </Button>
        </div>
      </div>
    </div>
  );
}
