"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  MONTH_SHORT,
  formatMonthCompact,
  formatMonthLabel,
  getCurrentMonth,
  monthSearchParams,
  parseBudgetViewMode,
  parseMonthParams,
  shiftMonth,
} from "@finance/core/constants";
import type { MonthAvailability } from "@/lib/queries/month-availability";
import { getMonthAvailabilityAction } from "@/lib/actions/months";
import { rememberMonth } from "@/lib/month-memory";
import { cn } from "@/lib/utils";
import { SOLID_PANEL } from "@/lib/glass";

interface MonthPickerProps {
  basePath: string;
  className?: string;
}

/**
 * Which month a surface is showing, and how to get to another one.
 *
 * The arrows were the only way through, which made them the wrong way: going
 * back to March from September is six clicks, and doing it again on the
 * Ledger was six more, because the month did not survive changing surface.
 * The month now follows the user (see `lib/month-scope`), and the label is a
 * button: two taps reach any month of any year.
 *
 * The arrows stay. Stepping to the month either side is the commonest move by
 * a wide margin, and making that a two-tap popover to save a control would be
 * a poor trade.
 */
export function MonthPicker({ basePath, className }: MonthPickerProps) {
  const searchParams = useSearchParams();
  const { year, month } = parseMonthParams(
    searchParams.get("y") ?? undefined,
    searchParams.get("m") ?? undefined,
  );
  const view = parseBudgetViewMode(searchParams.get("view"));

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div
      className={cn("relative flex items-center gap-0.5 sm:gap-1", className)}
    >
      <Link
        href={`${basePath}${monthSearchParams(prev.year, prev.month, view)}`}
        onClick={() => rememberMonth(prev.year, prev.month)}
        className={cn(
          // Narrower, never shorter: the 44px touch height is kept, and only
          // the horizontal padding gives way on a phone.
          "flex h-11 w-8 shrink-0 items-center justify-center rounded sm:w-11",
          "border border-border hover:bg-accent",
        )}
        aria-label="Previous month"
      >
        <CaretLeft size={20} weight="bold" />
      </Link>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        className={cn(
          "flex h-11 min-w-0 shrink items-center gap-1 rounded px-1.5 text-sm font-medium sm:px-2",
          "hover:bg-accent",
        )}
      >
        <span className="hidden whitespace-nowrap text-center sm:inline sm:min-w-[8.5rem]">
          {formatMonthLabel(year, month)}
        </span>
        <span className="whitespace-nowrap text-center sm:hidden">
          {formatMonthCompact(year, month)}
        </span>
        <CaretDown
          size={12}
          weight="bold"
          className={cn(
            "shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <Link
        href={`${basePath}${monthSearchParams(next.year, next.month, view)}`}
        onClick={() => rememberMonth(next.year, next.month)}
        className={cn(
          "flex h-11 w-8 shrink-0 items-center justify-center rounded sm:w-11",
          "border border-border hover:bg-accent",
        )}
        aria-label="Next month"
      >
        <CaretRight size={20} weight="bold" />
      </Link>

      {open ? (
        <MonthGrid
          id={panelId}
          basePath={basePath}
          year={year}
          month={month}
          view={view}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * A year of months, marked with what each one holds.
 *
 * Anchored under the label rather than opened as a sheet: twelve short
 * buttons and a year stepper is a small thing, and a full-screen sheet for it
 * would be more ceremony than the decision deserves — on a phone as much as
 * on a desktop.
 */
function MonthGrid({
  id,
  basePath,
  year,
  month,
  view,
  onClose,
}: {
  id: string;
  basePath: string;
  year: number;
  month: number;
  view: "current" | "month_end";
  onClose: () => void;
}) {
  const router = useRouter();
  const [shownYear, setShownYear] = useState(year);
  const [availability, setAvailability] = useState<MonthAvailability | null>(
    null,
  );
  const [loading, startLoading] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const today = getCurrentMonth();

  // Closing on an outside press or Escape, which is what a popover has to do
  // and what nothing in the panel itself can know about.
  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    // Deferred to the next frame: the press that opened this panel is still
    // propagating, and listening immediately would close it again at once.
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("touchstart", onPointerDown);
    }, 0);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  // The markers are a decoration on a control that works without them, so the
  // fetch is fire-and-forget and a failure leaves the grid plain.
  useEffect(() => {
    let stale = false;
    startLoading(async () => {
      const result = await getMonthAvailabilityAction(shownYear);
      if (!stale) {
        setAvailability(result);
      }
    });
    return () => {
      stale = true;
    };
  }, [shownYear]);

  const marks = availability?.year === shownYear ? availability : null;

  function go(targetYear: number, targetMonth: number) {
    rememberMonth(targetYear, targetMonth);
    onClose();
    router.push(
      `${basePath}${monthSearchParams(targetYear, targetMonth, view)}`,
    );
  }

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label="Pick a month"
      className={cn(
        "absolute right-0 top-full z-50 mt-1 w-[min(17rem,calc(100vw-2rem))]",
        "rounded-xl p-3",
        SOLID_PANEL,
        "account-menu-panel",
      )}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShownYear((current) => current - 1)}
          aria-label={`Show ${shownYear - 1}`}
          className="flex size-8 items-center justify-center rounded hover:bg-muted"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <span className="text-sm font-medium tabular-nums">{shownYear}</span>
        <button
          type="button"
          onClick={() => setShownYear((current) => current + 1)}
          aria-label={`Show ${shownYear + 1}`}
          className="flex size-8 items-center justify-center rounded hover:bg-muted"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1">
        {MONTH_SHORT.map((label, index) => {
          const value = index + 1;
          const selected = shownYear === year && value === month;
          const isToday = shownYear === today.year && value === today.month;
          const closed = marks?.closed.includes(value) ?? false;
          const hasData = marks?.withData.includes(value) ?? false;
          // Only ever ahead of today: a month that has not happened cannot
          // have records, and greying it out says so without a tooltip.
          const future =
            shownYear > today.year ||
            (shownYear === today.year && value > today.month);

          return (
            <button
              key={label}
              type="button"
              onClick={() => go(shownYear, value)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex h-11 flex-col items-center justify-center gap-1 rounded-md",
                "text-sm transition-colors",
                selected
                  ? "bg-primary font-medium text-primary-foreground"
                  : future
                    ? "text-muted-foreground/50 hover:bg-muted"
                    : "hover:bg-muted",
                isToday && !selected && "ring-1 ring-inset ring-primary-rim/60",
              )}
            >
              {label}
              {/* One dot, three meanings, and absent is the fourth. Filled is
                  a month whose books are closed, hollow is one with records
                  in it, and nothing at all is a month with no history. */}
              <span
                aria-hidden
                className={cn(
                  "size-1 rounded-full",
                  closed
                    ? "bg-success"
                    : hasData
                      ? "bg-current opacity-40"
                      : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-foreground/10 pt-2">
        <button
          type="button"
          onClick={() => go(today.year, today.month)}
          className="rounded px-2 py-1 text-sm text-primary-ink hover:bg-muted"
        >
          This month
        </button>
        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-1 rounded-full bg-success" />
            closed
          </span>
          <span className="flex items-center gap-1">
            <span
              aria-hidden
              className="size-1 rounded-full bg-current opacity-40"
            />
            {loading && !marks ? "…" : "records"}
          </span>
        </span>
      </div>
    </div>
  );
}

export function useSelectedMonth() {
  const searchParams = useSearchParams();
  return parseMonthParams(
    searchParams.get("y") ?? undefined,
    searchParams.get("m") ?? undefined,
  );
}
