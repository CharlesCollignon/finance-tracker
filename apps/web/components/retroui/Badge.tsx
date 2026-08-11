import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";

const badgeVariants = cva("font-medium rounded-md inline-flex items-center", {
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      outline: "border border-border text-foreground",
      solid: "bg-foreground text-background",
      surface: "bg-primary/15 text-primary",
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
});

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
