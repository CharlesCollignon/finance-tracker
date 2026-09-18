"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { panelFor } from "@finance/core/bearing-panels";
import type { PanelSpec } from "@finance/core/bearing-panels";
import type { RenderedTile } from "@finance/core/bearing-read";
import {
  budgetViewOptionLabel,
  formatMonthLabel,
  getCurrentMonth,
  shiftMonth,
  type BudgetViewMode,
} from "@finance/core/constants";
import { cssEasing, DURATION } from "@finance/core/motion";
import { bearingPanelAction } from "@/lib/actions/bearing-panel";
import type { PanelDetail, PanelScope } from "@/lib/bearing/panel-detail";
import {
  PanelBlockSkeleton,
  PanelBlockView,
} from "@/components/finance/bearing/panel-blocks";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

/**
 * What opens under a pressed tile.
 *
 * The argument the whole feature rests on: the figure is already on screen
 * and already correct, so nothing here may cover it. The panel opens on the
 * press — chrome and block skeletons, immediately — and the detail streams
 * into it underneath. There is no spinner anywhere in this file, and that is
 * deliberate rather than an omission: a spinner over a number the app already
 * knows teaches the reader to distrust the number.
 *
 * Which blocks appear is `panelFor`'s judgement, not this component's. A
 * panel explains *its tile*, not its whole family, which is what makes this a
 * dissolution of the Month screen rather than a hiding of it — `free` gets
 * the fulfilment question, the spend strip, what is still to come, and the
 * month in words; `arriving` carries the same fulfilment question, because a
 * reader with nothing "left" to see has no other month tile telling them a
 * charge is waiting; the other seven month tiles get whatever explains them
 * and nothing else.
 *
 * The scope lives here rather than in the address bar, which is the one place
 * this departs from how the rest of the app does months. `MonthPicker`
 * navigates: on the Bearing that would re-render a page whose tiles do not
 * depend on the month at all, and scroll the reader back to the top of the
 * grid away from the panel they were reading. The retired `BudgetViewToggle`
 * navigated for the same reason, which is why its choice — current or
 * month-end — is redrawn below as this panel's own chrome instead. So the
 * chrome here is local state feeding the server function's `scope`, and the
 * tiles above are untouched by it.
 *
 * The signature is unchanged from the stub it replaces: `{ tile }` is
 * everything a panel needs to look itself up, so `BearingGrid` did not have
 * to change to call it.
 */
export function Panel({ tile }: { tile: RenderedTile }) {
  const t = useT();
  const locale = useLocale();
  const reducedMotion = usePrefersReducedMotion();
  const spec = panelFor(tile.id, tile.family);

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
   * remedy for state that has to follow a change — the Bearing screen on the
   * phone uses the same pattern for a dragged order. An effect would paint
   * the mismatched frame first and then correct it.
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
  // `spec.blocks` is safe in the dependency list: `panelFor` hands back one of
  // the module-level arrays in `bearing-panels.ts` rather than building a new
  // one, so its identity is stable for as long as the tile is.
  useEffect(() => {
    let stale = false;

    startTransition(async () => {
      const next = await bearingPanelAction(
        tile.family,
        scope,
        spec.blocks,
      ).catch(() => null);

      if (stale) {
        return;
      }
      setDetail(next);
      setFailed(next === null);
    });

    return () => {
      stale = true;
    };
  }, [tile.family, scope, spec.blocks, attempt, locale]);

  return (
    <Expand reducedMotion={reducedMotion}>
      <div
        data-panel-for={tile.id}
        className="flex flex-col gap-4 pt-3 md:pt-4"
      >
        <Chrome spec={spec} scope={scope} setScope={setScope} detail={detail} />

        {detail
          ? spec.blocks.map((block) => (
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
            : spec.blocks.map((block) => (
                <PanelBlockSkeleton key={block} block={block} />
              ))}

        {/* Instead of the blocks that could not be drawn, never over them.
            The figure above is still true — it came with the page — so this
            is a note about the detail and not about the number. */}
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

        {spec.href ? (
          <Link
            href={spec.href}
            className="flex items-center gap-1 self-start text-sm text-primary-ink"
          >
            {t("bearing.panel.footer")}
            <ArrowRight size={ICON.sm} />
          </Link>
        ) : null}
      </div>
    </Expand>
  );
}

/**
 * The opening itself.
 *
 * `grid-template-rows: 0fr → 1fr` over a child that hides its overflow, which
 * is the only way to transition to a height nobody has measured. The
 * alternative — measuring the content and animating a pixel height — has to
 * re-measure every time the detail lands and changes the height, and gets it
 * wrong on the frame in between.
 *
 * Suppressed outright rather than shortened when the reader has asked for
 * less motion: a row unfolding under the pointer is exactly the effect that
 * setting exists to turn off, and the panel is just as usable arriving at
 * full height.
 *
 * Only the opening animates. The close is `BearingGrid` unmounting this
 * component, and holding a closed panel mounted so it could shrink would
 * leave a zero-height grid child with the grid's own gap on either side of
 * it — a seam that stays in the bento after the panel has gone.
 */
function Expand({
  reducedMotion,
  children,
}: {
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  // Already open when the reader has asked for less motion — the state starts
  // there rather than being corrected in the effect, so there is no frame in
  // which a reduced-motion panel is collapsed.
  const [open, setOpen] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    // Next frame, so the browser has painted the closed state to animate
    // from. Setting it in the effect body alone can be coalesced into the
    // first paint, and a transition between two values in the same frame is
    // a jump cut.
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  return (
    <div
      className="grid"
      style={{
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: reducedMotion
          ? undefined
          : `grid-template-rows ${DURATION.panel}ms ${cssEasing()}`,
      }}
    >
      {/* `min-h-0` because a grid item's default `min-height: auto` refuses
          to shrink below its content, which would hold the row open at full
          height and leave nothing for the transition to do. */}
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- chrome */

/** The three windows worth offering. A year is the Plan surface's own. */
const HORIZONS = [6, 12, 24] as const;

/**
 * What sits above a panel's blocks, per `spec.chrome`.
 *
 * Four cases and one of them is nothing, which is the point of the type: the
 * `now` and `wallet` families have no window to choose — "now" is today and a
 * portfolio is whatever it is worth — so offering them a control would be
 * offering a choice the figures cannot honour.
 */
function Chrome({
  spec,
  scope,
  setScope,
  detail,
}: {
  spec: PanelSpec;
  scope: Required<PanelScope>;
  setScope: (next: Required<PanelScope>) => void;
  detail: PanelDetail | null;
}) {
  const t = useT();
  const locale = useLocale();

  switch (spec.chrome) {
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
