import * as React from "react";
import { cn } from "../../lib/utils";

export const INPUT_CLS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-study-field-border)] " +
  "bg-[var(--color-study-field-bg)] px-3.5 py-2.5 text-sm text-[var(--color-study-text)] " +
  "font-[var(--font-sans)] outline-none transition-colors " +
  "placeholder:text-[var(--color-study-text-subtle)] " +
  "focus:border-[var(--color-brand-500)] disabled:opacity-50";

interface FormFieldProps {
  id?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
  fullWidth,
}: FormFieldProps) {
  return (
    <div className={cn("mb-5", fullWidth && "col-span-2", className)}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-[var(--color-study-text)]"
        >
          {label}
          {required && <span className="ml-1 text-[var(--color-crit-600)]">*</span>}
        </label>
      )}
      {children}
      {hint && (
        <p className="mt-1 text-xs text-[var(--color-study-text-subtle)]">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-[var(--color-crit-600)]">{error}</p>
      )}
    </div>
  );
}
