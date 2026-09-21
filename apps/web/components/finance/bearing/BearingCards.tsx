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
import { cssEasing, DURATION } from "@finance/core/motion";
import type { SpineState } from "@finance/core/spine";
import { Panel } from "@/components/finance/bearing/Panel";
import { Spine } from "@/components/finance/bearing/Spine";
import { Sparkline } from "@/components/finance/charts";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { BorderGlow } from "@/components/react-bits/BorderGlow";
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
  /** The ring, drawn inside "Your run" — its flame is dropped, see below. */
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
          // The ring belongs to the run, so it is that card's content rather
          // than the page's chrome.
          //
          // Load-bearing and worth saying out loud: the ring is drawn only if
          // a `run` card exists, and `buildBearingCards` silently drops a
          // family with no figures. The run family is non-empty today only
          // because `monthly-net-average` is always in the pack, which is
          // itself only true because `bucketMonthlyTrend` pre-seeds six month
          // buckets. If that ever stops holding, the ring disappears with no
          // error anywhere — the card it lives on will simply not be there.
          spine={card.id === "run" ? spine : null}
          // The headline states one of these figures itself, directly above
          // the cards, under the same label the card would repeat.
          restatesHeadline={card.lead?.id === spine.headline.figure}
          trend={trend}
        />
      ))}
    </div>
  );
}

/**
 * One card: `BorderGlow` at the edge, and the app's own `GLASS_CARD` as the
 * surface inside it.
 *
 * `BorderGlow` masks itself to a border box and says in its own doc that "the
 * fill is the caller's surface"; anything painted over that border box hides
 * it, so the glow gets a one-pixel gutter (`p-px`) of its own and the surface
 * sits inside.
 *
 * There used to be a `SpotlightCard` between them, drawing a radial gradient
 * that followed the pointer across the interior. It went because the card was
 * answering one hover four ways at once — an edge glow angled at the cursor, a
 * spotlight tracking the same cursor, a background wash and the chevron fading
 * in — and two of those were reading the same input to say the same thing. The
 * craft floor asks for one authored moment rather than scattered effects. What
 * is left is the edge, softened, plus the wash the rest of the app already uses
 * to say a surface is pressable.
 */
function Card({
  card,
  open,
  onToggle,
  spine,
  restatesHeadline,
  trend,
}: {
  card: BearingCard;
  open: boolean;
  onToggle: () => void;
  spine: SpineState | null;
  /** This card's lead figure is the one the headline already states. */
  restatesHeadline: boolean;
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
    <BorderGlow className="rounded-card p-px">
      <div className={cn("rounded-card", GLASS_CARD)}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={cn(
            // No `group` any more: the caret was the only thing reading it,
            // and it no longer changes under a hover.
            "flex w-full items-center gap-4 p-4 text-left md:p-5",
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
              <span className={cn(MICRO, "text-muted-foreground")}>
                {card.lead.note}
              </span>
            ) : null}
          </span>

          {card.lead ? (
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              {/* Label above, figure below: a figure read before its label is
                  a number the eye has to hold while it finds out what it
                  was.

                  Dropped on the one card whose lead the headline has already
                  stated. `free` is the first `month` fact, so "This month"
                  led with "Yours to spend this month" under the identical
                  words the headline uses a few pixels higher — the same
                  figure said twice under one label reads as two figures that
                  happen to agree. The card's own name still says which
                  family it is, and the figure is still there. */}
              {restatesHeadline ? null : (
                <span className={cn(MICRO, "text-muted-foreground")}>
                  {card.lead.label}
                </span>
              )}
              <span className="flex items-end gap-2">
                <Run figure={card.lead} trend={trend} className="mb-1" />
                <PrivateAmount className={cn(FIGURE, toneFor(card.lead))}>
                  {card.lead.display}
                </PrivateAmount>
              </span>
            </span>
          ) : null}

          {/* One opacity, in both states, and the rotation carries the
              state on its own.

              The caret used to rest at 30% and rise to 60 under the pointer.
              Over the glass card — `--card` at 60% on `--background`, so
              about `#0f0f1a` — 30% of `--foreground` measures 2.44:1, under
              the 3:1 SC 1.4.11 asks of anything that identifies a control,
              and the step that fixed it only existed for people with a
              pointer. On a phone, where the Bearing is the screen the app
              opens to, the affordance was simply below the floor. At 60% it
              measures 6.28:1 resting — a shade quieter than the muted
              foreground beside it (6.95:1), which is the weight chrome
              should have — and it is the same at rest as it is on hover,
              because a permanent affordance beats a revealed one. */}
          <CaretDown
            size={ICON.md}
            weight="bold"
            aria-hidden
            className={cn("shrink-0 opacity-60", open && "rotate-180")}
            // Transform only now. The opacity half of this transition had
            // nothing left to animate once the two states share one value.
            style={{
              transition: reducedMotion
                ? undefined
                : `transform ${DURATION.panel}ms ${cssEasing()}`,
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
                  {/* The ring, and deliberately not the flame. `Spine` still
                      draws one when it is handed one; this card is handed
                      `null` because `streak` and `best-streak` are figures in
                      the pack and are already listed below as rows, in the
                      same form every other figure on this surface takes. A
                      badge saying the same two numbers a third time — the
                      panel's own streak line says them twice — is the kind of
                      repetition that makes a reader stop trusting that two
                      statements of one figure are the same figure. */}
                  {spine ? <Spine state={{ ...spine, flame: null }} /> : null}

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
      </div>
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
          // Resting at 40%, which over the glass card is 3.42:1 — past the
          // 3:1 SC 1.4.11 sets for a graphic that identifies a control. It
          // was `opacity-0`, so on a touch device the arrow never appeared
          // at all and the only way to find out whether a figure led
          // anywhere was to press it. `bearing-tiles.ts` is explicit that a
          // tile with nowhere honest to lead must lead nowhere, "because
          // inventing a destination would teach people that pressing tiles
          // is a coin flip" — an invisible arrow taught them the same thing
          // from the other side.
          //
          // The rise to 60% is the enhancement, not the affordance, which is
          // why it costs nothing on a phone: Tailwind v4 already compiles
          // `group-hover` inside `@media (hover: hover)`, so a device with
          // no pointer gets the resting state and never the reveal. Focus
          // gets the same rise, so a keyboard walking the rows can see which
          // one it is on without relying on the ring alone.
          <ArrowRight
            size={ICON.xs}
            aria-hidden
            className={cn(
              "opacity-40 transition-opacity",
              "group-hover/row:opacity-60 group-focus-visible/row:opacity-60",
            )}
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
    <Link
      href={figure.href}
      className={cn(
        shape,
        "group/row",
        // The same ring the card's own button carries, so a keyboard moving
        // from the card header into its rows does not change focus
        // vocabulary halfway down. Inset, because the row is flush with the
        // card's padding and an outset ring would be clipped.
        "focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset focus-visible:outline-none",
      )}
    >
      {body}
    </Link>
  );
}

/**
 * The shape of the run, for the figures that draw one behind themselves.
 *
 * `figure.series` rather than `BEARING_TILES[figure.id].series`. This file
 * used to reach past the card list into the table it is built from for that
 * one field, which made the "one place both clients agree about what a card
 * is" seam leak — the phone would have had to make the same reach. The
 * series now rides on the figure, like the href.
 */
function Run({
  figure,
  trend,
  className,
}: {
  figure: CardFigure;
  trend: number[];
  className?: string;
}) {
  if (figure.series !== "trend" || trend.length < 2) {
    return null;
  }
  return (
    <Sparkline
      values={trend}
      className={cn("shrink-0 opacity-70", className)}
    />
  );
}

/**
 * The colour a card figure takes, which is almost always none of its own.
 *
 * This used to read the datum's `sense`, paint Lamplit Gold on every figure
 * that had moved the way the sense calls good and Destructive on every one
 * that had not. Three rules say it cannot. The Semantic Amount Rule is that a
 * colour names what kind of money a figure is — income, expense, savings,
 * investment — and never whether it is up or down. The Rare Accent Rule is
 * that gold is scarce and means savings, and `bearing-facts.ts` declares
 * seventeen `up-is-good` data, so one healthy month spent the accent a dozen
 * times on a single screen. And PRODUCT.md's third refusal is that the app
 * does not tell the user what to do: a wall of good/bad colour is a score,
 * whatever the tooltip says.
 *
 * So the default is the foreground, and two figures keep Destructive because
 * each names something to do rather than a verdict. `free` below zero says
 * the month has already promised more than it has. `unrecorded-over` is in
 * the pack at all only when measured unrecorded spending has passed the
 * allowance the reader set themselves — its presence is the finding, so it
 * needs no threshold here.
 *
 * `sense` stays on the datum and is untouched. MonthRead is the surface
 * licensed to say in a sentence that a month went well, and it reads the same
 * field; this card only shows the figure.
 */
function toneFor(figure: CardFigure): string {
  if (figure.id === "free") {
    return figure.value < 0 ? "text-destructive" : "text-foreground";
  }
  if (figure.id === "unrecorded-over") {
    return "text-destructive";
  }
  return "text-foreground";
}
