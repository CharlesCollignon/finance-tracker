import type { Ref } from "react";
import { TextInput, type TextInputProps } from "react-native";

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";

export interface InputProps extends TextInputProps {
  invalid?: boolean;
  className?: string;
  /**
   * Declared so a caller can chain focus between fields. React 19 hands a
   * function component its ref as an ordinary prop, so it spreads through to
   * the TextInput below with the rest of them.
   */
  ref?: Ref<TextInput>;
}

export function Input({ invalid, className, style, ...props }: InputProps) {
  const palette = useThemeColors();

  return (
    <TextInput
      placeholderTextColor={palette.mutedForeground}
      aria-invalid={invalid}
      style={style}
      className={cn(
        "min-h-12 w-full rounded-md border bg-background px-4 py-2.5 text-base text-foreground",
        invalid ? "border-destructive text-destructive" : "border-border",
        className,
      )}
      {...props}
    />
  );
}
