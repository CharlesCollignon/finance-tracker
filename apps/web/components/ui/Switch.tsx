import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Names the control for a screen reader — "Unlock with biometrics". */
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A setting that is on or off, as one control.
 *
 * `role="switch"` rather than a checkbox: the two are announced differently,
 * and "on/off" is what a settings row means. The knob moves with a transform
 * rather than by changing `left`, so the browser animates it off the main
 * thread — and the global reduced-motion rule in globals.css lands it at its
 * end position instead when that setting is on.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
        "border border-border transition-colors duration-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        checked ? "bg-primary" : "bg-muted",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none ml-0.5 size-4.5 rounded-full transition-transform duration-200",
          checked
            ? "translate-x-5 bg-primary-foreground"
            : "translate-x-0 bg-foreground/70",
        )}
      />
    </button>
  );
}
