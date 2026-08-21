import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--radius-md)] text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-400)]",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-brand-600)] text-white hover:bg-[var(--color-brand-700)] active:bg-[var(--color-brand-800)]",
        secondary:
          "border border-[var(--color-surface-300)] bg-[var(--color-surface-0)] text-[var(--color-surface-800)] hover:bg-[var(--color-surface-100)]",
        outline:
          "border border-[var(--color-brand-300)] bg-transparent text-[var(--color-brand-700)] hover:bg-[var(--color-brand-50)]",
        ghost:
          "bg-transparent text-[var(--color-surface-700)] hover:bg-[var(--color-surface-100)]",
        destructive:
          "bg-[var(--color-crit-500)] text-white hover:bg-[var(--color-crit-600)]",
        link: "bg-transparent text-[var(--color-brand-600)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-5 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
