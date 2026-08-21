import * as React from "react";
import { cn } from "../../lib/utils";

interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <div className={cn("mb-5", className)}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-brand-400)]">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
