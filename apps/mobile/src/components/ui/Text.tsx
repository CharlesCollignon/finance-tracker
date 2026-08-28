import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { cn } from "@/lib/cn";
import { hasTextColor, withoutTextColor } from "@/lib/text-class";

type Variant =
  "body" | "head" | "heading" | "title" | "muted" | "label" | "amount";

export interface TextProps extends RNTextProps {
  variant?: Variant;
  className?: string;
}

/*
 * Each variant sets exactly one text-size utility. Layering a second one at a
 * call site (className="text-lg" over a variant's text-base) leaves font size
 * and line height to resolve from different rules, which clipped the header
 * title on Android.
 */
const VARIANTS: Record<Variant, string> = {
  body: "font-sans text-base text-foreground",
  /** Page header title, matching the web PageHeader. */
  heading: "font-sans text-lg leading-7 text-foreground",
  head: "font-sans text-base font-bold text-foreground",
  title: "font-sans text-2xl font-bold text-foreground",
  muted: "font-sans text-sm text-muted-foreground",
  label: "font-sans text-xs font-semibold uppercase text-muted-foreground",
  amount: "font-mono text-base text-foreground",
};

export function Text({ variant = "body", className, ...props }: TextProps) {
  // A colour on the call site must win over the variant's; NativeWind would
  // otherwise resolve the two by alphabetical order rather than by intent.
  const base = hasTextColor(className)
    ? withoutTextColor(VARIANTS[variant])
    : VARIANTS[variant];

  return <RNText className={cn(base, className)} {...props} />;
}
