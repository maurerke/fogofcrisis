import * as React from "react";
import { cn } from "../../lib/utils";

interface LikertOption {
  value: number;
  label?: string;
}

interface LikertScaleProps {
  name: string;
  value: number | undefined;
  onChange: (val: number) => void;
  options: LikertOption[];
  lowAnchor?: string;
  highAnchor?: string;
  /** When true, shows circle buttons (for 7-point survey scales) */
  circle?: boolean;
}

export function LikertScale({
  name,
  value,
  onChange,
  options,
  lowAnchor,
  highAnchor,
  circle = false,
}: LikertScaleProps) {
  if (circle) {
    return (
      <div>
        <div className="flex justify-center gap-2 my-3">
          {options.map((opt) => {
            const checked = value === opt.value;
            return (
              <label key={opt.value} className="flex flex-col items-center cursor-pointer">
                <input
                  type="radio"
                  name={name}
                  value={opt.value}
                  checked={checked}
                  onChange={() => onChange(opt.value)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    checked
                      ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)] text-white"
                      : "border-[var(--color-study-field-border)] text-[var(--color-study-text-muted)] hover:border-[var(--color-brand-400)]",
                  )}
                >
                  {opt.value}
                </span>
              </label>
            );
          })}
        </div>
        {(lowAnchor || highAnchor) && (
          <div className="flex justify-between text-xs text-[var(--color-study-faint)]">
            <span>{lowAnchor}</span>
            <span>{highAnchor}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-4 mt-2">
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label key={opt.value} className="flex flex-col items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                checked
                  ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)] text-white"
                  : "border-[var(--color-study-field-border)] text-[var(--color-study-text-muted)] hover:border-[var(--color-brand-400)]",
              )}
            >
              {opt.value}
            </span>
            {opt.label && (
              <span className="text-[0.65rem] text-[var(--color-study-text-subtle)] text-center max-w-[52px]">
                {opt.label}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
