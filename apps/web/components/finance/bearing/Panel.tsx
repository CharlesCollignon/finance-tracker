"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { BearingCard } from "@finance/core/bearing-cards";
import type { PanelChrome } from "@finance/core/bearing-panels";
import {
  budgetViewOptionLabel,
  formatMonthLabel,
  getCurrentMonth,
  shiftMonth,
  type BudgetViewMode,
} from "@finance/core/constants";
import type { Key } from "@finance/core/i18n/t";
import { bearingPanelAction } from "@/lib/actions/bearing-panel";
import type { PanelDetail, PanelScope } from "@/lib/bearing/panel-detail";
import {
  PanelBlockSkeleton,
  PanelBlockView,
} from "@/components/finance/bearing/panel-blocks";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { activeNavHref, APP_NAV_ITEMS } from "@/lib/navigation";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

/**
 * What a card holds under its figures.
 *
 * The argument the whole feature rests on: the figures are already on screen
 * and already correct, so nothing here may cover them. The card opens on the
 * press — chrome and block skeletons, immediately — and the detail streams
 * into it underneath. There is no spinner anywhere in this file, and that is
 * deliberate rather than an omission: a spinner over a number the app already
 * knows teaches the reader to distrust the number.
 *
 * Which blocks appear is `bearing-cards.ts`'s judgement, not this
 * component's, and the card arrives carrying them. It used to look itself up
 * through `panelFor(tile.id, tile.family)`, which was the right shape while
 * twelve tiles each explained one figure; with one card per family the
 * lookup and the card say the same thing, so the card says it. The curation
 * that table held did not go with it — `month-read` and `arrived-charges`
 * are the expensive blocks and `CARD_FAMILY_BLOCKS` still puts each on
 * exactly one card, which is what stops two open cards paying twice for one
 * answer.
 *
 * The scope lives here rather than in the address bar, which is the one place
 * this departs from how the rest of the app does months. `MonthPicker`
 * navigates: on the Bearing that would re-render a page whose cards do not
 * depend on the month at all, and scroll the reader back to the top of the
 * list away from the card they were reading. The retired `BudgetViewToggle`
 * navigated for the same reason, which is why its choice — current or
 * month-end — is redrawn below as this panel's own chrome instead. So the
 * chrome here is local state feeding the server function's `scope`, and the
 * figures above are untouched by it.
 *
 * It no longer draws its own unfolding. `BearingCards` wraps the whole open
 * region — figures, blocks and footer — in one `0fr`/`1fr` grid transition,
 * and a second one nested inside it would ease the same content twice and
 * arrive on a curve that is neither.
 */
export function Panel({ card }: { card: BearingCard }) {
  const t = useT();
  const locale = useLocale();

  const current = getCurrentMonth();
  const [scope, setScope] = useState<Required<PanelScope>>({
    year: current.year,
    month: current.month,
    view: "current",
    horizon: HORIZONS[1]!,
  });

  const [detail, setDetail] = useState<PanelDetail | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by the retry and by any block that has just written something —
  // the two ways to ask for the same scope twice. Nothing reads it but the
  // effect below.
  const [attempt, setAttempt] = useState(0);
  const [, startTransition] = useTransition();

  /**
   * The figures belong to the scope they were fetched for, so a scope the
   * reader has moved on from must not keep rendering.
   *
   * `scope` is plain state and updates on the next paint; `detail` only
   * updates when the server function resolves. Without this, stepping the
   * month puts the new month's name in the chrome above the outgoing month's
   * spend strip, still-to-come and budget rings, for as long as the round
   * trip takes — a header and a body that disagree about which month they
   * are describing, which is the failure this module's own doc comment warns
   * about elsewhere. Skeletons instead, exactly as on first open: the same
   * "never a wrong number stated confidently" rule that keeps a spinner off
   * the headline.
   *
   * Reset during render rather than in an effect, which is React's own
   * remedy for state that has to follow a change — `BearingCards` uses the
   * same pattern to mount a card's body on its first open. An effect would
   * paint the mismatched frame first and then correct it.
   *
   * Locale rides along with scope here: a language switch changes the month
   * label the same detail carries, so a scope the reader has not moved from
   * still needs a reset the moment the language underneath it changes.
   */
  const [shown, setShown] = useState({ scope, locale });
  if (shown.scope !== scope || shown.locale !== locale) {
    setShown({ scope, locale });
    setDetail(null);
    setFailed(false);
  }

  // Refetched when the chrome moves, because that is what the chrome is for.
  // `stale` rather than an abort: a server function has no signal to cancel
  // with, and the only harm an overtaken answer can do is land after a newer
  // one — which this stops.
  // `card.blocks` is safe in the dependency list: `buildBearingCards` hands
  // back one of the module-level arrays in `bearing-cards.ts` rather than
  // building a new one, so its identity is stable for as long as the card is.
  useEffect(() => {
    let stale = false;

    startTransition(async () => {
      const next = await bearingPanelAction(card.id, scope, card.blocks).catch(
        () => null,
      );

      if (stale) {
        return;
      }
      setDetail(next);
      setFailed(next === null);
    });

    return () => {
      stale = true;
    };
  }, [card.id, scope, card.blocks, attempt, locale]);

  return (
    <div data-panel-for={card.id} className="flex flex-col gap-4">
      <Chrome
        chrome={card.chrome}
        scope={scope}
        setScope={setScope}
        detail={detail}
      />

      {detail
        ? card.blocks.map((block) => (
            <PanelBlockView
              key={block}
              block={block}
              detail={detail}
              // The same counter the retry bumps: a block that wrote
              // something has made every other block in the panel stale,
              // and "fetch this scope again" is exactly what `attempt` is
              // for.
              onChanged={() => setAttempt((count) => count + 1)}
            />
          ))
        : failed
          ? null
          : card.blocks.map((block) => (
              <PanelBlockSkeleton key={block} block={block} />
            ))}

      {/* Instead of the blocks that could not be drawn, never over them.
          The figures above are still true — they came with the page — so this
          is a note about the detail and not about the numbers. */}
      {failed ? (
        <p className="text-sm text-muted-foreground">
          {t("bearing.panel.failed")}{" "}
          <button
            type="button"
            onClick={() => setAttempt((count) => count + 1)}
            className="font-medium text-primary-ink underline underline-offset-2"
          >
            {t("bearing.panel.retry")}
          </button>
        </p>
      ) : null}

      <Footer destinations={card.destinations} />
    </div>
  );
}

/* ---------------------------------------------------------------- footer */

/**
 * The ways out, and there is more than one of them.
 *
 * A tile had a single `href` and a footer that said "see the full surface".
 * A card holds a whole family, and its figures are explained in two or three
 * different places — "This month" alone reaches Charges, the Ledger and the
 * Plan. Choosing one of them to be *the* destination would be the same
 * invention `bearing-tiles.ts` refuses when it leaves a figure's href null,
 * so every distinct destination is offered and each is named after the
 * surface it goes to, in the words the sidebar already uses for it.
 *
 * `card.destinations` is de-duplicated and contains only hrefs the card's own
 * figures carry, so a card whose figures all lead nowhere renders nothing
 * here rather than a link to somewhere plausible.
 */
function Footer({ destinations }: { destinations: string[] }) {
  const t = useT();

  if (destinations.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={t("bearing.panel.footer")}
      className="flex flex-wrap items-center gap-x-5 gap-y-2"
    >
      {destinations.map((href) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-1 text-sm font-medium text-primary-ink"
        >
          {t(surfaceKey(href) ?? "bearing.panel.footer")}
          <ArrowRight size={ICON.sm} />
        </Link>
      ))}
    </nav>
  );
}

/**
 * What to call a destination: the surface's own name, from `navigation.ts`.
 *
 * Reuses `activeNavHref` rather than matching paths a second time, so a link
 * is named by exactly the rule that decides which sidebar entry lights up for
 * it — `/history` is the Ledger here because it is the Ledger there. The
 * query string is cut first: `/transactions?review=inbox` is the Ledger, and
 * `activeNavHref` is given pathnames.
 */
function surfaceKey(href: string): Key | null {
  const query = href.indexOf("?");
  const surface = activeNavHref(query < 0 ? href : href.slice(0, query));
  return APP_NAV_ITEMS.find((item) => item.href === surface)?.labelKey ?? null;
}

/* ---------------------------------------------------------------- chrome */

/** The three windows worth offering. A year is the Plan surface's own. */
const HORIZONS = [6, 12, 24] as const;

/**
 * What sits above a card's blocks, per `card.chrome`.
 *
 * Four cases and one of them is nothing, which is the point of the type: the
 * `now` and `wallet` families have no window to choose — "now" is today and a
 * portfolio is whatever it is worth — so offering them a control would be
 * offering a choice the figures cannot honour.
 */
function Chrome({
  chrome,
  scope,
  setScope,
  detail,
}: {
  chrome: PanelChrome;
  scope: Required<PanelScope>;
  setScope: (next: Required<PanelScope>) => void;
  detail: PanelDetail | null;
}) {
  const t = useT();
  const locale = useLocale();

  switch (chrome) {
    case "none":
      return null;

    case "month-scope":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label={t("bearing.panel.monthScope")}
            className="flex items-center gap-1"
          >
            <Step
              label={t("common.previousMonth")}
              onPress={() =>
                setScope({ ...scope, ...shiftMonth(scope.year, scope.month, -1) })
              }
            >
              <CaretLeft size={ICON.sm} weight="bold" />
            </Step>
            <span className="min-w-[8.5rem] text-center text-sm font-medium">
              {formatMonthLabel(scope.year, scope.month, locale)}
            </span>
            <Step
              label={t("common.nextMonth")}
              onPress={() =>
                setScope({ ...scope, ...shiftMonth(scope.year, scope.month, 1) })
              }
            >
              <CaretRight size={ICON.sm} weight="bold" />
            </Step>
          </div>

          <SegmentedControl<BudgetViewMode>
            label={t("common.budgetView")}
            value={scope.view}
            onChange={(view) => setScope({ ...scope, view })}
            segments={[
              {
                value: "current",
                label: budgetViewOptionLabel(
                  "current",
                  scope.year,
                  scope.month,
                  locale,
                ),
              },
              {
                value: "month_end",
                label: budgetViewOptionLabel(
                  "month_end",
                  scope.year,
                  scope.month,
                  locale,
                ),
              },
            ]}
          />
        </div>
      );

    case "streak":
      return <Streak detail={detail} />;

    case "horizon":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{t("bearing.panel.horizon")}</p>
          <SegmentedControl
            label={t("bearing.panel.horizon")}
            value={String(scope.horizon)}
            onChange={(value) =>
              setScope({ ...scope, horizon: Number(value) })
            }
            // "6M" and "1Y" read the same in both languages, which is why the
            // Wallets range switch writes them out too rather than asking the
            // catalogue for a two-character string.
            segments={[
              { value: "6", label: "6M" },
              { value: "12", label: "1Y" },
              { value: "24", label: "2Y" },
            ]}
          />
        </div>
      );
  }
}

/**
 * The run, above the shelf that lists it.
 *
 * Waits for the detail rather than guessing: the streak is the one piece of
 * chrome that is itself a figure, and a placeholder zero would be a wrong
 * number shown confidently for as long as the fetch takes.
 */
function Streak({ detail }: { detail: PanelDetail | null }) {
  const t = useT();

  const summary = detail?.family === "run" ? detail.closes.summary : null;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm font-medium">{t("bearing.panel.streakHeading")}</p>
      {summary ? (
        <p className={cn(MICRO, "text-muted-foreground")}>
          {summary.streak > 0
            ? t("bearing.panel.streakMonths", { count: summary.streak })
            : t("bearing.panel.streakNone")}
          {summary.bestStreak > 0
            ? ` · ${t("bearing.panel.bestRun", { count: summary.bestStreak })}`
            : null}
        </p>
      ) : (
        <div
          aria-hidden
          className="h-3 w-48 max-w-full animate-pulse rounded bg-muted/40"
        />
      )}
    </div>
  );
}

/** One month either way. Sized for a thumb, like the header's own arrows. */
function Step({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border hover:bg-accent"
    >
      {children}
    </button>
  );
}
