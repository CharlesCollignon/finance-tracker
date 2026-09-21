import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";

const badgeVariants = cva(
  "font-medium rounded-control inline-flex items-center",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
        solid: "bg-foreground text-background",
        // The raised surface with full-strength ink, where `default` takes
        // the same ground with muted ink. The two steps of emphasis a badge
        // needs, without either of them being the accent.
        surface: "bg-secondary text-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({
  children,
  size = "md",
  variant = "default",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </span>
  );
}
