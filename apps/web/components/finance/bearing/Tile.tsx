"use client";

import type { HTMLAttributes } from "react";
import { CaretDown, DotsSixVertical } from "@phosphor-icons/react";
import type { RenderedTile } from "@finance/core/bearing-read";
import { cssEasing, DURATION } from "@finance/core/motion";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Sparkline } from "@/components/finance/charts";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { FIGURE, FIGURE_HERO, MICRO } from "@/lib/type-scale";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * One figure, on glass.
 *
 * Label above, figure below, and as little else as the tile can get away
 * with. That order is not decoration: a figure read before its label is a
 * number the eye has to hold while it finds out what it was, and on a screen
 * of a dozen of them that cost is paid a dozen times.
 *
 * Not `GLASS_HERO`. That file says the top-edge highlight is used on the
 * Month headline "and nowhere else… the effect is only 'expensive' while it
 * is rare", and a grid where the first tile glinted would spend the whole
 * effect on a slot whose occupant changes every time somebody rearranges.
 *
 * The press is a stretched button, overlaid rather than wrapped, and that is
 * still what makes the drag handle work — the reason just changed hands. A
 * handle nested inside a button is a button inside a button, invalid the
 * same way a button inside a link was; stretching the button across the card
 * behind everything else keeps the whole tile pressable while leaving the
 * handle a plain sibling the pointer reaches first. Pressing it no longer
 * navigates: it expands the tile's own panel in place, which is why it
 * carries `aria-expanded` — a screen reader has to be told the row under
 * this card just opened, the same way it would for any other disclosure
 * control. `tile.href` moves to the panel's own footer link instead.
 *
 * Which is also why the corner mark is a caret and not an arrow. It was an
 * up-and-right arrow shown only on tiles that had an `href`, because that is
 * what an arrow means — you are about to leave. Both halves were wrong once
 * the press became a disclosure: every tile expands, `net-position` with no
 * link included, and none of them takes you anywhere. A caret that turns
 * over when the panel is open is the mark this control has always had,
 * everywhere else in the app and outside it.
 *
 * And it sits beside the drag handle rather than instead of it. The arrow
 * was the handle's alternative, which meant the one hint that a tile does
 * anything at all vanished on exactly the grids where it does the most —
 * every signed-in grid is draggable. They are both small and both quiet;
 * there is room.
 */

interface TileProps {
  tile: RenderedTile;
  /** True while the user is dragging this one. */
  dragging?: boolean;
  /** True when the user put this tile here themselves. */
  pinned?: boolean;
  /** Recent months of net, for the tiles that draw a run behind their figure. */
  trend?: number[];
  /** Props for the drag affordance. Absent when the grid is not draggable. */
  handleProps?: HTMLAttributes<HTMLElement>;
  handleRef?: (element: HTMLElement | null) => void;
  /** What the handle is for, in the reader's language. */
  handleLabel?: string;
  /** True while this tile's panel is open. Absent (and false) for the drag ghost. */
  open?: boolean;
  /** Called on press. Absent for the drag ghost, which nothing can press. */
  onOpen?: () => void;
}

/** The colour a figure takes from which way it has gone. */
function toneFor(tile: RenderedTile): string {
  if (tile.sense === "neutral" || tile.value === 0) {
    return "text-foreground";
  }
  // The datum says which way is good; the value says which way it went. A
  // rise in something marked "rising is bad" is the one combination worth
  // colouring, and its opposite is the one worth rewarding.
  const good = tile.sense === "up-is-good" ? tile.value > 0 : tile.value < 0;
  return good ? "text-primary-ink" : "text-destructive";
}

export function Tile({
  tile,
  dragging = false,
  pinned = false,
  trend,
  handleProps,
  handleRef,
  handleLabel,
  open = false,
  onOpen,
}: TileProps) {
  const t = useT();
  const reducedMotion = usePrefersReducedMotion();
  const hero = tile.span === "hero";
  // The catalog's own wording, not tile.label alone: a screen reader landing
  // on one of a dozen otherwise-identical buttons needs to hear which figure
  // it presses as well as what pressing it does, and what pressing it does
  // depends on whether it is already open.
  const panelLabel = `${tile.label}. ${
    open ? t("bearing.panel.close") : t("bearing.panel.open")
  }`;

  return (
    <div
      className={cn(
        "group relative isolate flex h-full min-h-[7.5rem] flex-col gap-1 rounded-3xl p-4 md:p-5",
        GLASS_CARD,
        hero && "min-h-[11rem] md:p-6",
        // Every tile responds now. The hover used to be gated on `href`,
        // from when only a tile with somewhere to go did anything on press.
        "transition-colors hover:border-foreground/25",
        dragging && "opacity-40",
        // Said quietly. A pinned tile is not an error state; the ring is
        // there so somebody who dragged three tiles can see which three.
        pinned && "ring-1 ring-inset ring-foreground/15",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        aria-label={panelLabel}
        // Behind the content, over the card. `-z-10` with `isolate` on the
        // parent keeps it out of the way of the handle without escaping the
        // tile's own stacking context.
        className="absolute inset-0 -z-10 rounded-3xl focus-visible:ring-2 focus-visible:ring-foreground/40"
      />

      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "min-w-0 text-sm font-medium text-muted-foreground",
            hero && "text-base",
          )}
        >
          {tile.label}
        </p>

        <span className="flex shrink-0 items-center gap-1">
          <CaretDown
            size={ICON.sm}
            weight="bold"
            // Faint until wanted, and plain once the panel is open — an open
            // disclosure's mark is state, not a hint. Never announced: the
            // stretched button behind it already carries `aria-expanded`,
            // and a second voice for the same fact is one too many.
            className={cn(
              open
                ? "rotate-180 opacity-40"
                : "opacity-0 group-hover:opacity-40",
            )}
            style={{
              transition: reducedMotion
                ? undefined
                : `transform ${DURATION.panel}ms ${cssEasing()}, opacity ${DURATION.panel}ms ${cssEasing()}`,
            }}
            aria-hidden
          />

          {handleProps ? (
            <span
              ref={handleRef}
              {...handleProps}
              role="button"
              tabIndex={0}
              aria-label={handleLabel}
              // `touch-none` so a drag on a touch screen is a drag rather
              // than a scroll — without it the browser claims the gesture
              // first and the tile never moves.
              className="-m-1 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:text-foreground active:cursor-grabbing"
            >
              <DotsSixVertical size={ICON.sm} weight="bold" />
            </span>
          ) : null}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <PrivateAmount
          className={cn(hero ? FIGURE_HERO : FIGURE, toneFor(tile))}
          title={tile.note ?? undefined}
        >
          {tile.display}
        </PrivateAmount>
        {tile.series === "trend" && trend && trend.length > 1 ? (
          <Sparkline values={trend} className="mb-1 opacity-70" />
        ) : null}
      </div>

      {tile.caption ? (
        <p className={cn(MICRO, "text-muted-foreground")}>
          {tile.caption.map((segment, index) =>
            segment.kind === "text" ? (
              <span key={index}>{segment.text}</span>
            ) : (
              // The app's own value, formatted here, blurred here. This is
              // the whole reason the model writes {{fact:id}} and never a
              // number: prose cannot be blurred selectively, an element can.
              <PrivateAmount key={index} title={segment.label}>
                {segment.display}
              </PrivateAmount>
            ),
          )}
        </p>
      ) : null}

      {/* Only on the hero, and only when the pack put one there. A caveat
          repeated on twelve tiles is a caveat nobody reads; on the one figure
          that needs it, beside the figure, it is the sentence that stops
          "everything added up" being taken for a net worth. */}
      {hero && tile.note ? (
        <p className={cn(MICRO, "text-muted-foreground/70")}>{tile.note}</p>
      ) : null}
    </div>
  );
}
