"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Plus, X } from "@phosphor-icons/react";
import {
  YEAR_AHEAD_EVENT_KINDS,
  YEAR_AHEAD_MAX_EVENTS,
  type YearAheadAccountId,
  type YearAheadEvent,
  type YearAheadEventKind,
} from "@finance/core/year-ahead";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { NumberField, Slider } from "./plan-controls";
import { EVENT_NAME_KEYS, EventIcon, FOLLOW } from "./year-ahead-parts";

/** What the "Et si…" slider runs to, in euros a month. */
const EXTRA_MAX = 500;
const EXTRA_STEP = 25;
const QUICK_EXTRAS = [50, 100, 200] as const;

/** The most an event can be: well past a car, short of a flat. */
const EVENT_MAX = 100_000;

const CHIP = cn(
  "relative isolate flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm lg:min-h-9",
  "transition-colors duration-hover",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
);

interface YearAheadWhatIfProps {
  extra: number;
  onExtraChange: (extra: number) => void;
  /** The accounts the extra can go to, the current account last. */
  targets: readonly YearAheadAccountId[];
  target: YearAheadAccountId;
  onTarget: (id: YearAheadAccountId) => void;
  /** What the extra adds by the end of the window, said in a sentence. */
  result: string | null;
  /** What it does to the next milestone; streams in on its own. */
  milestoneLine: ReactNode;
  events: readonly YearAheadEvent[];
  onAddEvent: (kind: YearAheadEventKind) => void;
  onChangeEvent: (id: string, patch: Partial<YearAheadEvent>) => void;
  onRemoveEvent: (id: string) => void;
  onClear: () => void;
  /** The months an event can land in, with their names. */
  monthOptions: { month: number; label: string }[];
  /** The window's length: an event after it waits. */
  months: number;
  color: (id: YearAheadAccountId) => string;
  name: (id: YearAheadAccountId) => string;
  format: (value: number) => string;
}

/**
 * « Et si… »: the one part of the page that is pure play, now with an aim
 * and a calendar. The slider puts so much more aside each month into the
 * account picked under it; the events are what the recurring entries cannot
 * know — a raise, a bonus, the car — each one a marker on the curve and one
 * line here, added from a single button that opens to the three kinds.
 *
 * Everything answers at once: the bands and the figure move while the thumb
 * does. The picked account wears a pill that slides from chip to chip.
 */
export function YearAheadWhatIf({
  extra,
  onExtraChange,
  targets,
  target,
  onTarget,
  result,
  milestoneLine,
  events,
  onAddEvent,
  onChangeEvent,
  onRemoveEvent,
  onClear,
  monthOptions,
  months,
  color,
  name,
  format,
}: YearAheadWhatIfProps) {
  const t = useT();
  const reduce = useReducedMotion() ?? false;
  const pillId = useId();
  const [adding, setAdding] = useState(false);
  const full = events.length >= YEAR_AHEAD_MAX_EVENTS;

  return (
    // Side by side on a wide card: the extra on the left, the events on
    // the right, so neither leaves half the card empty.
    <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:gap-12">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("futurePlan.whatIfLabel")}
            </p>
            <span
              className={cn(
                "privacy-sensitive shrink-0 text-sm font-medium tabular-nums",
                extra === 0 && "text-muted-foreground",
              )}
            >
              {t("futurePlan.whatIfPerMonth", { amount: format(extra) })}
            </span>
          </div>
          <Slider
            value={extra}
            min={0}
            max={EXTRA_MAX}
            step={EXTRA_STEP}
            onChange={onExtraChange}
            label={t("futurePlan.whatIfLabel")}
            valueText={t("futurePlan.whatIfPerMonth", {
              amount: format(extra),
            })}
          />
          <div className="flex flex-wrap gap-2">
            {QUICK_EXTRAS.map((amount) => {
              const on = extra === amount;
              return (
                <m.button
                  key={amount}
                  type="button"
                  aria-pressed={on}
                  whileTap={reduce ? undefined : { scale: 0.94 }}
                  onClick={() => onExtraChange(on ? 0 : amount)}
                  className={cn(
                    CHIP,
                    "tabular-nums",
                    on
                      ? "border-foreground/30 bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  +{format(amount)}
                </m.button>
              );
            })}
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label={t("futurePlan.whatIfToLabel")}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-muted-foreground">
            {t("futurePlan.whatIfTo")}
          </span>
          {targets.map((id) => {
            const on = id === target;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onTarget(id)}
                className={cn(
                  CHIP,
                  "border-border",
                  on
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {on ? (
                  <m.span
                    layoutId={pillId}
                    transition={reduce ? { duration: 0 } : FOLLOW}
                    className="absolute inset-0 -z-10 rounded-full bg-muted"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: color(id) }}
                />
                {name(id)}
              </button>
            );
          })}
        </div>

        <div aria-live="polite">
          {result ? (
            <>
              <p className="privacy-sensitive text-base font-medium">
                {result}
              </p>
              {milestoneLine}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("futurePlan.whatIfNone")}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {events.map((event) => (
              <m.li
                key={event.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={reduce ? { duration: 0 } : FOLLOW}
                // Two lines — the event and its cross, then its amount and
                // month — which fit a phone and the half-card column alike.
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted",
                    event.kind === "expense"
                      ? "text-destructive"
                      : "text-primary-ink",
                  )}
                >
                  <EventIcon kind={event.kind} size={ICON.sm} />
                </span>
                <span className="min-w-24 flex-1 text-sm">
                  {t(EVENT_NAME_KEYS[event.kind])}
                </span>
                <div className="col-span-3 flex gap-2">
                  <NumberField
                    label={
                      event.kind === "raise"
                        ? t("futurePlan.eventRaiseAmount")
                        : t("futurePlan.eventAmount")
                    }
                    labelHidden
                    value={event.amount}
                    min={0}
                    max={EVENT_MAX}
                    sensitive
                    onChange={(amount) => onChangeEvent(event.id, { amount })}
                    className="w-28 shrink-0"
                  />
                  <MonthSelect
                    value={event.month}
                    options={monthOptions}
                    months={months}
                    onChange={(month) => onChangeEvent(event.id, { month })}
                  />
                </div>
                <button
                  type="button"
                  aria-label={t("futurePlan.eventRemove", {
                    name: t(EVENT_NAME_KEYS[event.kind]),
                  })}
                  onClick={() => onRemoveEvent(event.id)}
                  className={cn(
                    "col-start-3 row-start-1 flex size-11 items-center justify-center rounded-full text-muted-foreground",
                    "transition-colors duration-hover hover:bg-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <X size={ICON.sm} weight="bold" aria-hidden />
                </button>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
        {events.length > 0 ? (
          <p className={cn(MICRO, "text-muted-foreground")}>
            {t("futurePlan.eventsHint")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {adding ? (
              YEAR_AHEAD_EVENT_KINDS.map((kind, index) => (
                <m.button
                  key={kind}
                  type="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { ...FOLLOW, delay: index * 0.04 }
                  }
                  onClick={() => {
                    onAddEvent(kind);
                    setAdding(false);
                  }}
                  className={cn(
                    CHIP,
                    "border-border text-foreground hover:bg-muted",
                  )}
                >
                  <EventIcon kind={kind} size={ICON.sm} />
                  {t(EVENT_NAME_KEYS[kind])}
                </m.button>
              ))
            ) : (
              <m.button
                key="add"
                type="button"
                disabled={full}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAdding(true)}
                className={cn(
                  CHIP,
                  "border-dashed border-border text-muted-foreground hover:border-solid hover:bg-muted hover:text-foreground",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                <Plus size={ICON.sm} weight="bold" aria-hidden />
                {t("futurePlan.eventAdd")}
              </m.button>
            )}
          </AnimatePresence>
          {extra > 0 || events.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto text-sm text-muted-foreground underline-offset-2 transition-colors duration-hover hover:text-foreground hover:underline"
            >
              {t("futurePlan.whatIfClear")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MonthSelect({
  value,
  options,
  months,
  onChange,
}: {
  value: number;
  options: { month: number; label: string }[];
  months: number;
  onChange: (month: number) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        {t("futurePlan.eventMonth")}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(
          "min-h-11 w-full min-w-0 rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground",
          "transition-colors duration-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value > months && "text-muted-foreground",
        )}
      >
        {options.map((option) => (
          <option key={option.month} value={option.month}>
            {option.month > months
              ? `${option.label} · ${t("futurePlan.eventBeyond")}`
              : option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
