import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { cn } from "@/lib/cn";

type Variant = "body" | "head" | "title" | "muted" | "label" | "amount";

export interface TextProps extends RNTextProps {
  variant?: Variant;
  className?: string;
}

const VARIANTS: Record<Variant, string> = {
  body: "font-sans text-base text-foreground",
  head: "font-sans text-base font-bold text-foreground",
  title: "font-sans text-2xl font-bold text-foreground",
  muted: "font-sans text-sm text-muted-foreground",
  label: "font-sans text-xs font-semibold uppercase text-muted-foreground",
  amount: "font-mono text-base text-foreground",
};

export function Text({ variant = "body", className, ...props }: TextProps) {
  return <RNText className={cn(VARIANTS[variant], className)} {...props} />;
}
