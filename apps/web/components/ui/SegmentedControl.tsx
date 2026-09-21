"use client";

import { cn } from "@/lib/utils";

export interface Segment<T extends string> {
  value: T;
  /** Two or three characters — "6M", "1Y", "All". */
  label: string;
  /** A range with nothing to draw is shown, not hidden: its absence is data. */
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Names the set for a screen reader — "Chart range". */
  label: string;
  className?: string;
}

/**
 * A small set of alternatives, as one control rather than a row of buttons.
 *
 * The selection is a single pill that slides between positions instead of a
 * background appearing and disappearing per item: the movement is what says
 * the segments are one set of alternatives rather than several independent
 * toggles.
 *
 * Ranges that cannot be drawn stay in place, dimmed. Removing them would make
 * the control change width as history accumulates, and a control that moves
 * under the pointer is worse than one with a greyed option in it.
 *
 * The track is an equal-fraction grid, so the pill's offset is a whole number
 * of columns and needs no measurement — the phone's twin has to measure with
 * `onLayout` because React Native has no grid to lean on.
 *
 * Plain buttons carrying `aria-pressed`, and deliberately not a radio group.
 * It was `role="radiogroup"` over `role="radio"` children, which is a promise
 * the markup did not keep: a radio group is a single tab stop whose members
 * are moved between with the arrow keys, and there was no roving `tabIndex`
 * and no key handler, so a screen reader announced "1 of 4" and then Down did
 * nothing. Between implementing that contract and dropping it, dropping it is
 * the honest fix — these segments are one tab stop each, which is what they
 * have always actually been, and `aria-pressed` says which is in force
 * without claiming keys the control does not handle.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const index = Math.max(
    0,
    segments.findIndex((segment) => segment.value === value),
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "relative isolate grid rounded-full border border-border p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${segments.length}, 1fr)` }}
    >
      {/* The pill. Inset by the track's padding on every side, and offset in
          whole columns, so it lands exactly on a segment at any width.

          A raised surface under an inset hairline rather than a gold fill:
          the step up from the track and the edge around it are what make the
          pill a thing, and the active label goes to full-strength foreground
          against muted to say which segment it is under. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 -z-10 rounded-full",
          "bg-secondary ring-1 ring-inset ring-hairline-strong",
          "transition-transform duration-hover ease-out",
        )}
        style={{
          width: `calc((100% - 0.5rem) / ${segments.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={active}
            disabled={segment.disabled}
            // Pressing the segment already in force is not a change, so it
            // does not report one. Unguarded, the setter still fires and
            // anything downstream that resets on the chrome moving — the
            // Bearing panel does — blanks to skeletons and re-resolves the
            // figures it is already showing correctly.
            onClick={() => {
              if (!active) onChange(segment.value);
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap",
              "transition-colors duration-hover sm:text-sm",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              segment.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
