"use client";

import { useEffect, type ReactNode } from "react";
import { m, useReducedMotion, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * A figure that springs to its new value rather than jumping, so a slider
 * pulled across feels like it moves money. Lands exactly on the value; under
 * reduced motion it simply changes.
 */
export function Count({
  value,
  format,
  className,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
}) {
  const still = useReducedMotion() ?? false;
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 });
  useEffect(() => {
    if (still) {
      spring.jump(value);
    } else {
      spring.set(value);
    }
  }, [spring, value, still]);
  const text = useTransform(spring, (current) => format(current));
  return <m.span className={cn("tabular-nums", className)}>{text}</m.span>;
}

/**
 * A slider, the browser's own — keyboard, touch and screen readers for
 * free — drawn as a thin track with the gold run up to the thumb.
 */
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** The value as it reads beside the label. */
  display: ReactNode;
}) {
  const filled = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex flex-col gap-3">
      <span className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-marketing-muted">{label}</span>
        <span className="font-mono text-marketing-ink">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="marketing-range"
        style={{
          background: `linear-gradient(to right, var(--primary) ${filled}%, rgb(255 255 255 / 0.12) ${filled}%)`,
        }}
      />
    </label>
  );
}

/** The card a demo is played on. */
export function Stage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-white/10 [background:radial-gradient(90%_70%_at_50%_0%,rgb(236_178_94/0.08),transparent_65%),rgba(255,255,255,0.025)] p-6 md:p-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A choice among a few, the chosen one lit. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors duration-200",
        active
          ? "border-primary/50 bg-primary/15 text-marketing-ink"
          : "border-white/12 text-marketing-muted hover:border-white/25 hover:text-white",
      )}
    >
      {children}
    </m.button>
  );
}
