"use client";

import {
  Fragment,
  useId,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LazyMotion, m, MotionConfig } from "motion/react";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import type { LedgerWeek } from "@finance/core/ledger-view";
import { cn } from "@/lib/utils";
import { MICRO } from "@/lib/type-scale";
import { useLocale, useT } from "@/lib/locale-context";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

/** The tabs' pill spring, so the two pills on the page move alike. */
const PILL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/**
 * How far a press has to travel sideways before it is a scrub rather than a
 * tap. A thumb resting on a segment wobbles a few pixels on its own.
 */
const SCRUB_THRESHOLD_PX = 6;

interface Bar {
  recorded: number;
  planned: number;
  /** Today's bar carries a dot under it, so the strip says where "now" is. */
  today?: boolean;
}

interface LedgerWeekStripProps {
  weeks: LedgerWeek[];
  /** The week the list shows, by its first day; null for the whole month. */
  value: string | null;
  onChange: (from: string | null) => void;
}

/**
 * The month above the Journal, a week at a time.
 *
 * A month can run to two hundred rows, and the list read them all in one
 * column. This is the month drawn small — a bar for every day, as tall as
 * the rows the list shows on it — cut into its weeks, so choosing one is a
 * single press and the reader can see where the month's rows are before
 * choosing. The first segment is the whole month, its bars one per week.
 *
 * The bars count rows, not money: what makes a list long is how many lines
 * it has, and a count says nothing the privacy blur would have to hide.
 * They are drawn from the rows the other filters keep, so a search lights
 * up the days it found something on.
 *
 * A radio group: arrow keys move the choice, and so does dragging a finger
 * or the pointer along the strip, which picks whichever week it is over.
 * Pressing the chosen week again goes back to the whole month.
 */
export function LedgerWeekStrip({
  weeks,
  value,
  onChange,
}: LedgerWeekStripProps) {
  const t = useT();
  const locale = useLocale();
  const pillId = useId();
  const today = todayIsoLocal();

  const options: (string | null)[] = [null, ...weeks.map((week) => week.from)];
  const chosen = Math.max(0, options.indexOf(value));

  const segments = useRef<(HTMLButtonElement | null)[]>([]);
  const press = useRef<{ x: number; scrubbing: boolean } | null>(null);
  // A scrub ends on a pointer-up that the browser may also report as a
  // click on the segment it started on, which would undo the scrub.
  const scrubbed = useRef(false);

  const dayMax = Math.max(
    1,
    ...weeks.flatMap((week) =>
      week.days.map((day) => (day ? day.recorded + day.planned : 0)),
    ),
  );
  const weekMax = Math.max(
    1,
    ...weeks.map((week) => week.recorded + week.planned),
  );

  function choose(index: number, focus: boolean) {
    const next = options[(index + options.length) % options.length] ?? null;
    if (next !== value) {
      onChange(next);
    }
    if (focus) {
      segments.current[(index + options.length) % options.length]?.focus();
    }
  }

  /** The segment under a pointer, or null between or beyond them. */
  function segmentAt(clientX: number): number | null {
    const found = segments.current.findIndex((segment) => {
      const rect = segment?.getBoundingClientRect();
      return rect ? clientX >= rect.left && clientX <= rect.right : false;
    });
    return found === -1 ? null : found;
  }

  function onPointerDown(event: ReactPointerEvent) {
    press.current = { x: event.clientX, scrubbing: false };
    scrubbed.current = false;
  }

  function onPointerMove(event: ReactPointerEvent) {
    const current = press.current;
    if (!current) {
      return;
    }
    if (!current.scrubbing) {
      if (Math.abs(event.clientX - current.x) < SCRUB_THRESHOLD_PX) {
        return;
      }
      current.scrubbing = true;
      scrubbed.current = true;
    }
    const index = segmentAt(event.clientX);
    if (index !== null) {
      choose(index, false);
    }
  }

  function onPointerEnd() {
    press.current = null;
  }

  function onKeyDown(event: KeyboardEvent) {
    scrubbed.current = false;
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step !== 0) {
      event.preventDefault();
      choose(chosen + step, true);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      choose(event.key === "Home" ? 0 : options.length - 1, true);
    }
  }

  function pressSegment(index: number) {
    if (scrubbed.current) {
      scrubbed.current = false;
      return;
    }
    // The chosen week again: back to the month.
    choose(index === chosen && index !== 0 ? 0 : index, false);
  }

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <div
          role="radiogroup"
          aria-label={t("ledger.weeks")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
          // Vertical drags still scroll the page; sideways ones are the scrub.
          className="flex touch-pan-y select-none items-stretch gap-0.5"
        >
          {options.map((from, index) => {
            const week = index === 0 ? null : weeks[index - 1]!;
            const selected = index === chosen;
            const bars: (Bar | null)[] = week
              ? week.days.map((day) =>
                  day
                    ? {
                        recorded: day.recorded,
                        planned: day.planned,
                        today: day.date === today,
                      }
                    : null,
                )
              : weeks.map((each) => ({
                  recorded: each.recorded,
                  planned: each.planned,
                }));
            // Lit means "on screen": every bar while the month is shown, and
            // only the chosen week's once one is.
            const lit = (barIndex: number) =>
              value === null || (week ? selected : barIndex === chosen - 1);

            return (
              <Fragment key={from ?? "month"}>
                {index === 1 ? (
                  <span aria-hidden className="my-2 w-px shrink-0 bg-border" />
                ) : null}
                <button
                  ref={(node) => {
                    segments.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  aria-label={
                    week
                      ? week.from === week.to
                        ? formatShortDate(week.from, locale)
                        : t("ledger.weekLabel", {
                            from: formatShortDate(week.from, locale),
                            to: formatShortDate(week.to, locale),
                          })
                      : t("ledger.wholeMonthLabel")
                  }
                  onClick={() => pressSegment(index)}
                  className={cn(
                    "relative flex min-h-11 min-w-0 flex-1 basis-0 flex-col items-center justify-end gap-1.5 rounded-control px-1 pb-1.5 pt-2",
                    "outline-none transition-colors duration-hover focus-visible:ring-2 focus-visible:ring-ring",
                    !selected && "hover:bg-muted/40",
                  )}
                >
                  {selected ? (
                    <m.span
                      layoutId={pillId}
                      aria-hidden
                      className="absolute inset-0 rounded-control bg-muted ring-1 ring-inset ring-hairline-strong"
                      transition={PILL_SPRING}
                    />
                  ) : null}
                  <Bars bars={bars} max={week ? dayMax : weekMax} lit={lit} />
                  <span
                    className={cn(
                      "relative tabular-nums transition-colors duration-hover",
                      MICRO,
                      selected
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {week
                      ? week.from === week.to
                        ? Number(week.from.slice(8))
                        : `${Number(week.from.slice(8))}–${Number(week.to.slice(8))}`
                      : t("ledger.wholeMonth")}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * A segment's bars, faded in when the strip first draws and easing to their
 * new heights whenever a filter changes them.
 *
 * Planned rows sit on top of the recorded ones, fainter, the way the list
 * draws them muted under the rows that have happened. A day with nothing on
 * it keeps a stub, so the week still reads as seven days.
 */
function Bars({
  bars,
  max,
  lit,
}: {
  bars: (Bar | null)[];
  max: number;
  lit: (index: number) => boolean;
}) {
  return (
    <span
      aria-hidden
      // Taller and wider bars where a week has a desktop's width to fill.
      className="fade-in relative flex h-6 w-full items-end justify-center gap-[2px] md:h-8 md:gap-[3px]"
    >
      {bars.map((bar, index) => {
        if (!bar) {
          return (
            <span key={index} className="h-full max-w-1.5 flex-1 md:max-w-2" />
          );
        }
        const on = lit(index);
        const empty = bar.recorded + bar.planned === 0;
        return (
          <span
            key={index}
            className="relative flex h-full max-w-1.5 flex-1 flex-col justify-end md:max-w-2"
          >
            {empty ? (
              <span
                className={cn(
                  "h-0.5 w-full rounded-full transition-colors duration-hover",
                  on ? "bg-muted-foreground/40" : "bg-muted-foreground/20",
                )}
              />
            ) : (
              <>
                <span
                  className={cn(
                    "w-full rounded-t-full transition-[height,background-color] duration-enter",
                    bar.recorded === 0 && "rounded-b-full",
                    bar.planned > 0 && "min-h-[3px]",
                    on ? "bg-foreground/30" : "bg-muted-foreground/15",
                  )}
                  style={{ height: `${(bar.planned / max) * 100}%` }}
                />
                <span
                  className={cn(
                    "w-full rounded-b-full transition-[height,background-color] duration-enter",
                    bar.planned === 0 && "rounded-t-full",
                    bar.recorded > 0 && "min-h-[3px]",
                    on ? "bg-foreground/85" : "bg-muted-foreground/35",
                  )}
                  style={{ height: `${(bar.recorded / max) * 100}%` }}
                />
              </>
            )}
            {bar.today ? (
              <span className="absolute -bottom-1 left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-foreground" />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
