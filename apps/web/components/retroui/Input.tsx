import React, { type InputHTMLAttributes } from "react";
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
        "w-full min-h-11 rounded-md border border-border px-3 py-2",
        "bg-input text-foreground text-sm",
        "transition-colors duration-200",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props["aria-invalid"] && "border-destructive text-destructive",
        className,
      )}
      {...props}
    />
  );
};
