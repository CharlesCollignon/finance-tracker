import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { cn } from "@/lib/cn";

type Variant = "body" | "head" | "title" | "muted" | "label";

export interface TextProps extends RNTextProps {
  variant?: Variant;
  className?: string;
}

const VARIANTS: Record<Variant, string> = {
  body: "text-base text-foreground",
  head: "text-base font-bold text-foreground",
  title: "text-2xl font-bold text-foreground",
  muted: "text-sm text-muted-foreground",
  label: "text-xs font-semibold uppercase text-muted-foreground",
};

export function Text({ variant = "body", className, ...props }: TextProps) {
  return <RNText className={cn(VARIANTS[variant], className)} {...props} />;
}
