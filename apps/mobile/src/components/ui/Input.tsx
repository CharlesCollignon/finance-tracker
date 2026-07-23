import { TextInput, type TextInputProps } from "react-native";

import { cn } from "@/lib/cn";
import { BRUTAL_SHADOW } from "@/theme/tokens";
import { COLORS } from "@/theme/tokens";

export interface InputProps extends TextInputProps {
  invalid?: boolean;
  className?: string;
}

export function Input({ invalid, className, style, ...props }: InputProps) {
  return (
    <TextInput
      placeholderTextColor={COLORS.mutedForeground}
      style={[BRUTAL_SHADOW, style]}
      className={cn(
        "min-h-12 w-full border-2 bg-background px-4 py-2.5 text-base text-foreground",
        invalid ? "border-destructive text-destructive" : "border-border",
        className,
      )}
      {...props}
    />
  );
}
