import { TextInput, type TextInputProps } from "react-native";

import { cn } from "@/lib/cn";
import { useThemeColors } from "@/theme/useThemeColors";

export interface InputProps extends TextInputProps {
  invalid?: boolean;
  className?: string;
}

export function Input({ invalid, className, style, ...props }: InputProps) {
  const palette = useThemeColors();

  return (
    <TextInput
      placeholderTextColor={palette.mutedForeground}
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
