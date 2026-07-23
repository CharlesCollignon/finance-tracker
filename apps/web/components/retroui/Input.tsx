import React, { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  type = "text",
  placeholder,
  className = "",
  ...props
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className={cn(
        "px-4 py-2 w-full min-h-11 rounded border-2 border-border",
        "bg-background text-foreground text-base shadow-md",
        "transition focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-primary focus:shadow-xs",
        props["aria-invalid"] &&
          "border-destructive text-destructive shadow-xs shadow-destructive",
        className,
      )}
      {...props}
    />
  );
};
