"use client";

import type { CSSProperties, ReactNode } from "react";
import { ENTRY_KINDS } from "@finance/core/entry-draft";
import type { CategoryType } from "@finance/core/types/database";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

/**
 * The colour each kind of money already wears on every amount in the app —
 * the Semantic Amount Rule — lent to the Add sheet while that kind is being
 * entered: the figure, the chosen category, the field being filled.
 */
export const KIND_INK: Record<CategoryType, string> = {
  expense: "var(--destructive)",
  income: "var(--success)",
  savings: "var(--primary)",
  investment: "var(--info)",
};

/** A kind's colour at an alpha, for a rim or a wash. */
export function inkAt(ink: string, percent: number): string {
  return `color-mix(in srgb, ${ink} ${percent}%, transparent)`;
}

const KIND_LABEL = {
  expense: "entry.kind.expense",
  income: "entry.kind.income",
  savings: "entry.kind.savings",
  investment: "entry.kind.investment",
} as const;

/**
 * Dépense · Revenu · Épargne · Placement, the first thing the sheet asks. A
 * raised pill under the chosen one slides across on **enter**, and a dot in
 * the kind's colour says which colour the figure is about to take.
 */
export function KindSwitch({
  value,
  onChange,
}: {
  value: CategoryType;
  onChange: (kind: CategoryType) => void;
}) {
  const t = useT();
  const index = ENTRY_KINDS.indexOf(value);
  return (
    <div
      role="radiogroup"
      aria-label={t("entry.kinds")}
      className="relative grid grid-cols-4 rounded-xl bg-foreground/5 p-[3px]"
    >
      <span
        aria-hidden
        className="absolute inset-y-[3px] left-[3px] rounded-[9px] border border-border bg-secondary transition-transform duration-enter ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: "calc((100% - 6px) / 4)",
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {ENTRY_KINDS.map((kind) => {
        const selected = kind === value;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(kind)}
            className={cn(
              "relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-medium",
              "transition-colors duration-hover",
              selected
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected ? (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: KIND_INK[kind] }}
              />
            ) : null}
            {t(KIND_LABEL[kind])}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A choice inside the Add sheet: a hairline when idle; once chosen, a rim and
 * a faint wash in the kind's colour.
 */
export function Chip({
  label,
  selected,
  ink,
  onClick,
  className,
}: {
  label: string;
  selected: boolean;
  ink: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      style={
        selected
          ? { borderColor: inkAt(ink, 70), background: inkAt(ink, 10) }
          : undefined
      }
      className={cn(
        "min-h-9 rounded-full border px-3.5 text-[13px] font-medium",
        "transition-[color,background-color,border-color,transform] duration-press active:scale-[0.96]",
        selected
          ? "text-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {label}
    </button>
  );
}

/** Two answers side by side on a recessed track: Une fois · Régulièrement. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-2 rounded-xl bg-foreground/5 p-[3px]"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 rounded-[9px] border text-[13px] font-medium transition-colors duration-hover",
              selected
                ? "border-border bg-secondary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Numbered cells seven to a row: the days of a month, or the 1–31 a
 * recurring entry falls on. A day that cannot be chosen is faint and inert.
 */
export function DayCells({
  cells,
  selected,
  ink,
  marked,
  onPick,
  label,
}: {
  /** Null for an empty cell before the 1st, so weekdays line up. */
  cells: readonly ({ day: number; disabled?: boolean } | null)[];
  selected: number | null;
  ink: string;
  /** A day ringed rather than filled: today. */
  marked?: number | null;
  onPick: (day: number) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-7 gap-0.5"
    >
      {cells.map((cell, index) =>
        cell ? (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={cell.day === selected}
            disabled={cell.disabled}
            onClick={() => onPick(cell.day)}
            style={
              cell.day === selected
                ? { background: ink, color: "var(--background)" }
                : undefined
            }
            className={cn(
              "h-9 rounded-[10px] text-sm tabular-nums transition-colors duration-hover",
              cell.day === selected && "font-semibold",
              cell.day !== selected &&
                !cell.disabled &&
                "hover:bg-foreground/5",
              cell.disabled && "cursor-default text-muted-foreground/40",
              cell.day !== selected &&
                cell.day === marked &&
                "ring-1 ring-inset ring-hairline-strong",
            )}
          >
            {cell.day}
          </button>
        ) : (
          <span key={index} aria-hidden />
        ),
      )}
    </div>
  );
}

/** A small heading over a group inside a panel. */
export function PanelHeading({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <p className="text-xs font-semibold tracking-[0.015em] text-muted-foreground">
        {children}
      </p>
      {action}
    </div>
  );
}

/**
 * One of the three tiles under the figure. The open one takes the kind's
 * rim; the one still missing carries a dot in the kind's colour.
 */
export function Tile({
  icon,
  label,
  value,
  empty = false,
  needed = false,
  active,
  ink,
  onClick,
  controls,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  empty?: boolean;
  needed?: boolean;
  active: boolean;
  ink: string;
  onClick: () => void;
  /** The panel this tile opens. */
  controls: string;
}) {
  const style: CSSProperties = active
    ? { borderColor: inkAt(ink, 70), background: inkAt(ink, 7) }
    : {};
  return (
    <button
      type="button"
      aria-expanded={active}
      aria-controls={controls}
      onClick={onClick}
      style={style}
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1 rounded-2xl border px-2.5 pb-2.5 pt-2 text-left",
        "transition-[background-color,border-color,transform] duration-press active:scale-[0.97]",
        !active &&
          "border-border bg-foreground/[0.04] hover:border-hairline-strong",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.015em] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
        {needed ? (
          <span
            aria-hidden
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: ink }}
          />
        ) : null}
      </span>
      <span
        className={cn(
          "truncate text-sm",
          empty ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {value}
      </span>
    </button>
  );
}
