import { TextInput, type TextInputProps } from "react-native";

import { cn } from "@/lib/cn";
import { colorsForScheme } from "@/theme/tokens";
import { useColorScheme } from "react-native";

export interface InputProps extends TextInputProps {
  invalid?: boolean;
  className?: string;
}

export function Input({ invalid, className, style, ...props }: InputProps) {
  const scheme = useColorScheme();
  const palette = colorsForScheme(scheme === "light" ? "light" : "dark");

  return (
    <TextInput
      placeholderTextColor={palette.mutedForeground}
      style={style}
      className={cn(
        "min-h-12 w-full rounded-md border bg-background px-4 py-2.5 text-base text-foreground",
        "dark:border-border-dark dark:bg-card-dark dark:text-foreground-dark",
        invalid ? "border-destructive text-destructive" : "border-border",
        className,
      )}
      {...props}
    />
  );
}
