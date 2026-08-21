import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-brand-200)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]",
        neutral:
          "border-[var(--color-surface-200)] bg-[var(--color-surface-100)] text-[var(--color-surface-700)]",
        ok: "border-[color-mix(in_oklab,var(--color-ok-500)_35%,white)] bg-[var(--color-ok-50)] text-[var(--color-ok-600)]",
        warn: "border-[color-mix(in_oklab,var(--color-warn-500)_35%,white)] bg-[var(--color-warn-50)] text-[var(--color-warn-600)]",
        crit: "border-[color-mix(in_oklab,var(--color-crit-500)_35%,white)] bg-[var(--color-crit-50)] text-[var(--color-crit-600)]",
        solid:
          "border-transparent bg-[var(--color-brand-600)] text-white hover:bg-[var(--color-brand-700)]",
        outline:
          "border-[var(--color-surface-300)] bg-transparent text-[var(--color-surface-700)]",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px]",
        md: "px-2 py-0.5 text-xs",
        lg: "px-2.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { badgeVariants };
