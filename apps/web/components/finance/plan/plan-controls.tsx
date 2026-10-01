"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatMonthLabel } from "@finance/core/constants";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import { GLASS_CARD } from "@/lib/glass";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import styles from "./plan.module.css";

/**
 * A card on the Plan page: glass over the lit ground, a small icon and its
 * title, as the Bearing draws its own.
 */
export function PlanCard({
  icon,
  title,
  aside,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  /** Beside the title, at the end of the row. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        GLASS_CARD,
        "flex h-full min-w-0 flex-col gap-4 rounded-card p-card",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground"
          >
            {icon}
          </span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/**
 * A slider over a native range input, filled to the thumb. The input does
 * the keyboard and the screen reader; `valueText` is what it announces.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  valueText,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  valueText: string;
  className?: string;
}) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
      aria-valuetext={valueText}
      className={cn(styles.slider, className)}
      style={{ "--fill": `${fill}%` } as CSSProperties}
    />
  );
}

function plainNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * A number typed in the reader's own way — "1 500", "1.500", "6,5" — and
 * handed up as soon as it reads as one.
 *
 * The text is held while the field is being typed in and dropped on blur,
 * so a half-typed "6," is not reformatted to "6" under the cursor, and the
 * field shows the figure in the locale's own digits when it is not being
 * edited.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
  hint,
  sensitive = false,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** A unit drawn inside the field's end — "%", never glued to the digits. */
  suffix?: string;
  hint?: string;
  /** Blurred with the rest of the user's amounts in privacy mode. */
  sensitive?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft ?? plainNumber(value, locale)}
          onFocus={(event) => {
            setDraft(plainNumber(value, locale));
            event.target.select();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = parseTypedAmount(event.target.value);
            if (parsed !== null) {
              onChange(
                Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed)),
              );
            }
          }}
          onBlur={() => setDraft(null)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(
            "min-h-11 w-full rounded-control border border-border bg-input px-3 py-2 text-sm tabular-nums text-foreground",
            "transition-colors duration-hover",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            suffix && "pr-8",
            sensitive && "privacy-sensitive",
          )}
        />
        {suffix ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The month `count` months after the given one, labelled — "mai 2027". */
export function monthLabelAhead(
  year: number,
  month: number,
  count: number,
  locale: Locale,
): string {
  const date = new Date(year, month - 1 + count, 1);
  return formatMonthLabel(date.getFullYear(), date.getMonth() + 1, locale);
}
