"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretDown } from "@phosphor-icons/react";
import {
  buildBearingCards,
  type BearingCard,
  type CardFigure,
  type CardId,
} from "@finance/core/bearing-cards";
import type { BearingFacts } from "@finance/core/bearing-facts";
import { BEARING_TILES } from "@finance/core/bearing-tiles";
import { cssEasing, DURATION } from "@finance/core/motion";
import type { SpineState } from "@finance/core/spine";
import { Panel } from "@/components/finance/bearing/Panel";
import { Spine } from "@/components/finance/bearing/Spine";
import { Sparkline } from "@/components/finance/charts";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { BorderGlow } from "@/components/react-bits/BorderGlow";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { FIGURE, MICRO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * The five cards, in `CARD_ORDER`, each opening where it stands.
 *
 * What this replaces is worth naming, because the shape is the argument. The
 * Bearing was twelve draggable tiles in a bento whose order a model chose and
 * a reader could overrule. Three separate mechanisms — an arrangement, a set
 * of pins and a twelve-slot template — each answered "which of these figures
 * matters?", and none of them could answer it for somebody who had not yet
 * told the app anything. Five cards, one per fact family, is short enough
 * that the question does not need answering: nothing is hidden behind a
 * ranking, so nothing has to be ranked.
 *
 * One card open at a time, and closed by default. Two open cards double the
 * height of an already tall screen and put two detail fetches in flight for
 * figures the reader has stopped looking at — the same reasoning the bento's
 * single open panel was built on.
 *
 * The figures are formatted here and never on the server. The display
 * currency lives in this browser's `localStorage`, so `buildBearingCards`
 * takes the formatter rather than the amounts, which is also why this is a
 * client component holding a server-gathered fact pack.
 */
export function BearingCards({
  facts,
  spine,
  trend,
}: {
  facts: BearingFacts;
  /** The ring and the flame, drawn inside "Your run" — see `Spine`. */
  spine: SpineState;
  /** Recent months of net, for the figures that draw a run behind them. */
  trend: number[];
}) {
  const locale = useLocale();
  const formatMoney = useFormatCurrency();
  const [open, setOpen] = useState<CardId | null>(null);

  const cards = useMemo(
    () => buildBearingCards(facts, formatMoney, locale),
    [facts, formatMoney, locale],
  );

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          open={open === card.id}
          onToggle={() =>
            setOpen((current) => (current === card.id ? null : card.id))
          }
          // The ring and the streak flame belong to the run, so they are that
          // card's content rather than the page's chrome.
          spine={card.id === "run" ? spine : null}
          trend={trend}
        />
      ))}
    </div>
  );
}

/**
 * One card: `BorderGlow` at the edge, `SpotlightCard` across the interior,
 * and the app's own `GLASS_CARD` as the surface between them.
 *
 * The nesting is not arbitrary. `BorderGlow` masks itself to a border box and
 * says in its own doc that "the fill is the caller's surface"; anything
 * painted over that border box hides it, so the glow gets a one-pixel gutter
 * (`p-px`) of its own and the surface sits inside. `SpotlightCard` is the
 * surface — it draws its gradient above its own background and below its
 * content, which is exactly where a spotlight belongs, and it takes
 * `GLASS_CARD` as a class rather than painting a palette of its own.
 */
function Card({
  card,
  open,
  onToggle,
  spine,
  trend,
}: {
  card: BearingCard;
  open: boolean;
  onToggle: () => void;
  spine: SpineState | null;
  trend: number[];
}) {
  const t = useT();
  const reducedMotion = usePrefersReducedMotion();
  const bodyId = `bearing-card-${card.id}`;

  /**
   * Mounted on the first open, and never unmounted after it.
   *
   * The bento's panel was mounted and unmounted with the press, which meant
   * only the opening could animate — a closing panel had already vanished by
   * the time the row shrank. A card is not a grid cell with a gap on either
   * side of it, so there is nothing to be gained by that here and a whole
   * closing gesture to be lost: the body stays mounted so the collapse has
   * something to collapse.
   *
   * Set during render rather than in an effect, which is React's own remedy
   * for state that has to follow a change and the pattern `Panel` already
   * uses for a scope the reader has moved on from. Nothing is fetched until
   * the first open, which is the part that mattered.
   *
   * Two consequences, both accepted. A card reopens on the month the reader
   * last stepped it to rather than on this one, which is the better answer
   * anyway — they stepped it on purpose. And a language switch refetches
   * every card that has been opened this session rather than only the open
   * one, because `Panel` treats locale as part of its scope; that is a
   * handful of reads on an action nobody takes twice.
   */
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) {
    setMounted(true);
  }

  // The lead is the card's own figure and stays in the header whether the
  // card is open or shut: `Panel` is built on "the figure is already on
  // screen and already correct, so nothing here may cover it", and a headline
  // that jumped out of the header on the press would break exactly that.
  const rest = card.lead ? card.figures.slice(1) : card.figures;

  return (
    <BorderGlow className="rounded-3xl p-px">
      <SpotlightCard className={cn("rounded-3xl", GLASS_CARD)}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={cn(
            "group flex w-full items-center gap-4 p-4 text-left md:p-5",
            "transition-colors hover:bg-foreground/[0.03]",
            "focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset focus-visible:outline-none",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium md:text-base">
              {t(card.nameKey)}
            </span>
            {/* The caveat rides on the datum, so it is drawn beside the
                figure it qualifies rather than left in a tooltip — a figure
                presented as somebody's worth, in an app that records no
                debts, is wrong by exactly their mortgage. */}
            {card.lead?.note ? (
              <span className={cn(MICRO, "text-muted-foreground/70")}>
                {card.lead.note}
              </span>
            ) : null}
          </span>

          {card.lead ? (
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              {/* Label above, figure below: a figure read before its label is
                  a number the eye has to hold while it finds out what it
                  was. */}
              <span className={cn(MICRO, "text-muted-foreground")}>
                {card.lead.label}
              </span>
              <span className="flex items-end gap-2">
                <Run figure={card.lead} trend={trend} className="mb-1" />
                <PrivateAmount className={cn(FIGURE, toneFor(card.lead))}>
                  {card.lead.display}
                </PrivateAmount>
              </span>
            </span>
          ) : null}

          <CaretDown
            size={ICON.md}
            weight="bold"
            aria-hidden
            className={cn(
              "shrink-0",
              open
                ? "rotate-180 opacity-60"
                : "opacity-30 group-hover:opacity-60",
            )}
            style={{
              transition: reducedMotion
                ? undefined
                : `transform ${DURATION.panel}ms ${cssEasing()}, opacity ${DURATION.panel}ms ${cssEasing()}`,
            }}
          />

          {/* What pressing does, for a reader who cannot see the caret. Said
              in a hidden span rather than an `aria-label` so the card's name
              and its figure are still the button's announced content. */}
          <span className="sr-only">
            {t(open ? "bearing.panel.close" : "bearing.panel.open")}
          </span>
        </button>

        {/* `grid-template-rows: 0fr → 1fr` over a child that hides its
            overflow, which is the only way to transition to a height nobody
            has measured — the same mechanism `BranchedNav` folds its views
            with, on the same curve. Measuring the content instead would mean
            re-measuring every time a block's detail lands and changes the
            height, and being wrong on the frame in between.

            Suppressed outright rather than shortened when the reader has
            asked for less motion: a card unfolding under the pointer is
            exactly the effect that setting exists to turn off. */}
        <div
          id={bodyId}
          className="grid"
          style={{
            gridTemplateRows: open ? "1fr" : "0fr",
            transition: reducedMotion
              ? undefined
              : `grid-template-rows ${DURATION.panel}ms ${cssEasing()}`,
          }}
        >
          {/* `min-h-0` because a grid item's default `min-height: auto`
              refuses to shrink below its content, which would hold the row
              open at full height and leave the transition nothing to do. */}
          <div className="min-h-0 overflow-hidden">
            {/* `inert` rather than `aria-hidden`: a collapsed card still has
                links and buttons in it, and hiding them from a screen reader
                while leaving them in the tab order is the worse half of the
                job. */}
            <div
              inert={!open}
              className="flex flex-col gap-4 px-4 pb-4 md:px-5 md:pb-5"
            >
              {mounted ? (
                <>
                  {spine ? <Spine state={spine} /> : null}

                  {rest.length > 0 ? (
                    <ul className="flex flex-col">
                      {rest.map((figure) => (
                        <li key={figure.id}>
                          <FigureRow figure={figure} trend={trend} />
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <Panel card={card} />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </SpotlightCard>
    </BorderGlow>
  );
}

/**
 * One figure, and where it is explained — when it is explained anywhere.
 *
 * A row is a link only when its own figure carries an href. Four figures
 * across the pack carry none, and `bearing-tiles.ts` is explicit about why
 * that must stay visible: "a tile with nowhere honest to lead leads nowhere;
 * inventing a destination would teach people that pressing tiles is a coin
 * flip". So a figure with no destination is drawn as what it is — a label and
 * a number — with no hover, no arrow and nothing to press.
 */
function FigureRow({ figure, trend }: { figure: CardFigure; trend: number[] }) {
  const body = (
    <>
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
        {figure.label}
      </span>
      <Run figure={figure} trend={trend} />
      {/* The house figure face, one step down from the lead's — a row
          amount in a different typeface would be a third treatment of the
          same kind of number on the same card. */}
      <PrivateAmount
        className={cn("font-serif text-base font-semibold", toneFor(figure))}
        title={figure.note ?? undefined}
      >
        {figure.display}
      </PrivateAmount>
      {/* Kept as an empty slot on a row that leads nowhere, rather than
          dropped: the arrow is what says this row can be pressed, and a
          column of figures that shifted sideways depending on whether the
          row above it had a destination would be harder to read than the
          affordance is worth. */}
      <span className="flex w-3 shrink-0 justify-end">
        {figure.href ? (
          <ArrowRight
            size={ICON.xs}
            aria-hidden
            className="opacity-0 transition-opacity group-hover/row:opacity-60"
          />
        ) : null}
      </span>
    </>
  );

  // The same box either way, so the hairlines between rows line up whether
  // or not the row above one leads anywhere.
  const shape = "flex items-center gap-3 border-t border-foreground/5 py-2.5";

  if (!figure.href) {
    return <div className={shape}>{body}</div>;
  }

  return (
    <Link href={figure.href} className={cn(shape, "group/row")}>
      {body}
    </Link>
  );
}

/** The shape of the run, for the figures that draw one behind themselves. */
function Run({
  figure,
  trend,
  className,
}: {
  figure: CardFigure;
  trend: number[];
  className?: string;
}) {
  if (BEARING_TILES[figure.id].series !== "trend" || trend.length < 2) {
    return null;
  }
  return (
    <Sparkline
      values={trend}
      className={cn("shrink-0 opacity-70", className)}
    />
  );
}

/** The colour a figure takes from which way it has gone. */
function toneFor(figure: CardFigure): string {
  if (figure.sense === "neutral" || figure.value === 0) {
    return "text-foreground";
  }
  // The datum says which way is good; the value says which way it went. A
  // rise in something marked "rising is bad" is the one combination worth
  // colouring, and its opposite is the one worth rewarding.
  const good =
    figure.sense === "up-is-good" ? figure.value > 0 : figure.value < 0;
  return good ? "text-primary-ink" : "text-destructive";
}
