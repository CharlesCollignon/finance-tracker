"use client";

import type { HTMLAttributes } from "react";
import Link from "next/link";
import { ArrowUpRight, DotsSixVertical } from "@phosphor-icons/react";
import type { RenderedTile } from "@finance/core/bearing-read";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Sparkline } from "@/components/finance/charts";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { FIGURE, FIGURE_HERO, MICRO } from "@/lib/type-scale";
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
 * The link is an overlay rather than a wrapper, and that is what makes the
 * drag handle work. A handle nested inside an anchor is a button inside a
 * link — invalid, and worse, a drag that ends where it started fires the
 * navigation. Stretching the anchor across the card behind everything else
 * keeps the whole tile pressable while leaving the handle a plain sibling
 * that the pointer reaches first.
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
}: TileProps) {
  const hero = tile.span === "hero";

  return (
    <div
      className={cn(
        "group relative isolate flex h-full min-h-[7.5rem] flex-col gap-1 rounded-3xl p-4 md:p-5",
        GLASS_CARD,
        hero && "min-h-[11rem] md:p-6",
        tile.href && "transition-colors hover:border-foreground/25",
        dragging && "opacity-40",
        // Said quietly. A pinned tile is not an error state; the ring is
        // there so somebody who dragged three tiles can see which three.
        pinned && "ring-1 ring-inset ring-foreground/15",
      )}
    >
      {tile.href ? (
        <Link
          href={tile.href}
          // Behind the content, over the card. `-z-10` with `isolate` on the
          // parent keeps it out of the way of the handle without escaping the
          // tile's own stacking context.
          className="absolute inset-0 -z-10 rounded-3xl focus-visible:ring-2 focus-visible:ring-foreground/40"
        >
          <span className="sr-only">{tile.label}</span>
        </Link>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "min-w-0 text-sm font-medium text-muted-foreground",
            hero && "text-base",
          )}
        >
          {tile.label}
        </p>

        {handleProps ? (
          <span
            ref={handleRef}
            {...handleProps}
            role="button"
            tabIndex={0}
            aria-label={handleLabel}
            // `touch-none` so a drag on a touch screen is a drag rather than
            // a scroll — without it the browser claims the gesture first and
            // the tile never moves.
            className="-m-1 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:text-foreground active:cursor-grabbing"
          >
            <DotsSixVertical size={ICON.sm} weight="bold" />
          </span>
        ) : tile.href ? (
          <ArrowUpRight
            size={ICON.sm}
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
            aria-hidden
          />
        ) : null}
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
