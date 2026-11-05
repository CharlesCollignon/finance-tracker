import type { Ref } from "react";
import { TextInput, type TextInputProps } from "react-native";

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";

export interface InputProps extends TextInputProps {
  invalid?: boolean;
  /**
   * `sheet`: the entry sheets' field (November 2026), a rounder well on a
   * faint lift of the sheet's own ground rather than the page's.
   */
  tone?: "field" | "sheet";
  className?: string;
  /**
   * Declared so a caller can chain focus between fields. React 19 hands a
   * function component its ref as an ordinary prop, so it spreads through to
   * the TextInput below with the rest of them.
   */
  ref?: Ref<TextInput>;
}

export function Input({
  invalid,
  tone = "field",
  className,
  style,
  ...props
}: InputProps) {
  const palette = useThemeColors();

  return (
    <TextInput
      placeholderTextColor={palette.mutedForeground}
      aria-invalid={invalid}
      style={style}
      className={cn(
        "min-h-12 w-full border px-4 py-2.5 text-base text-foreground",
        tone === "sheet"
          ? "rounded-2xl bg-foreground/5"
          : "rounded-control bg-background",
        invalid ? "border-destructive text-destructive" : "border-border",
        className,
      )}
      {...props}
    />
  );
}
