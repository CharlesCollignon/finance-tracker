"use client";

import type { ReactNode } from "react";
import type { PanelBlock } from "@finance/core/bearing-panels";
import type { Key } from "@finance/core/i18n/t";
import { formatMonthComparison } from "@finance/core/month-comparison";
import type { PanelDetail } from "@/lib/bearing/panel-detail";
import { BankInbox } from "@/components/finance/BankInbox";
import { CashAccountsCard } from "@/components/finance/CashAccountsCard";
import { FundCostCard } from "@/components/finance/FundCostCard";
import { MoneyOnHand } from "@/components/finance/MoneyOnHand";
import { MonthCloseHistory } from "@/components/finance/MonthCloseHistory";
import { MonthRead } from "@/components/finance/MonthRead";
import { MonthScore } from "@/components/finance/MonthScore";
import { MonthWallets } from "@/components/finance/MonthWallets";
import { ProgressRing } from "@/components/finance/ProgressRing";
import { ProjectionCard } from "@/components/finance/ProjectionCard";
import { RecentOnAccount } from "@/components/finance/RecentOnAccount";
import { StillToCome } from "@/components/finance/StillToCome";
import { WeightBars } from "@/components/finance/WeightBars";
import { BarSeries, SpendStrip } from "@/components/finance/charts";
import { GLASS_CARD } from "@/lib/glass";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/**
 * One block, drawn from the detail its family fetched.
 *
 * Returns null rather than an empty shell when the detail does not carry what
 * a block needs — a panel showing a headed box with nothing in it is worse
 * than a panel one block shorter. The family guard on every arm is not
 * defensive padding either: `PanelDetail` is a union keyed on family, so the
 * check is what narrows it, and TypeScript will not let an arm read a field
 * its branch never fetched.
 *
 * Nothing here is a new card. Every block is a component some other surface
 * already renders, which is the property the whole plan rests on: a panel and
 * the page its footer links to draw the same figure from the same component,
 * so they cannot come to disagree.
 */
export function PanelBlockView({
  block,
  detail,
}: {
  block: PanelBlock;
  detail: PanelDetail;
}): ReactNode {
  switch (block) {
    case "money-on-hand":
      return detail.family === "now" ? (
        <MoneyOnHand {...detail.hero} comparison={detail.comparison} />
      ) : null;

    case "cash-accounts":
      return detail.family === "now" ? (
        <CashAccountsCard accounts={detail.accounts} />
      ) : null;

    case "recent-on-account":
      return detail.family === "now" ? (
        <RecentOnAccount
          movements={detail.movements}
          pending={
            detail.movements.filter((movement) => movement.pending).length
          }
        />
      ) : null;

    case "review-inbox":
      return detail.family === "now" && detail.inbox ? (
        <BankInbox
          items={detail.inbox.items}
          decided={detail.inbox.decided}
          categories={detail.inbox.categories}
          showBackfill={detail.inbox.showBackfill}
          // Never on arrival. The reader pressed a tile to see what the
          // number is made of; throwing a full-screen review sheet over the
          // surface is a different request from the one they made.
          openOnArrival={false}
        />
      ) : null;

    case "spend-strip":
      return detail.family === "month" ? (
        <Framed headingKey="month.whereItWent">
          <SpendStrip
            rows={detail.summary.expenseBreakdown}
            total={detail.summary.expenses}
          />
        </Framed>
      ) : null;

    case "still-to-come":
      return detail.family === "month" ? (
        <StillToCome
          outgoing={detail.upcoming.outgoing}
          leaving={detail.upcoming.leaving}
          incoming={detail.upcoming.incoming}
          arriving={detail.upcoming.arriving}
        />
      ) : null;

    case "month-read":
      return detail.family === "month" && detail.read ? (
        <MonthRead
          year={detail.year}
          month={detail.month}
          monthLabel={detail.monthLabel}
          {...detail.read}
        />
      ) : null;

    case "month-comparison":
      return detail.family === "month" ? (
        <ComparisonLine comparison={detail.comparison} />
      ) : null;

    case "budget-progress":
      return detail.family === "month" ? (
        <Caps budgets={detail.budgets} />
      ) : null;

    case "close-shelf":
      return detail.family === "run" || detail.family === "month" ? (
        <MonthCloseHistory
          history={detail.closes.history}
          summary={detail.closes.summary}
          unrecordedCap={detail.closes.settings.unrecordedCap}
          closeDay={detail.closes.settings.closeDay}
        />
      ) : null;

    case "month-score":
      return detail.family === "run" || detail.family === "month" ? (
        <MonthScore
          pulse={detail.pulse}
          streak={detail.closes.summary.streak}
          bestStreak={detail.closes.summary.bestStreak}
          baseline={detail.closes.summary.baseline}
        />
      ) : null;

    case "trend":
      return detail.family === "run" || detail.family === "month" ? (
        <Trend points={detail.trend} />
      ) : null;

    case "projection":
      return detail.family === "ahead" ? (
        <ProjectionCard projection={detail.projection} runway={detail.runway} />
      ) : null;

    case "ingredients":
      // Nothing, deliberately. `ProjectionCard` above already lists what the
      // projection is made of — the card's own doc calls the ingredients the
      // answer to its original failure — so drawing them again here would be
      // the same list twice under one heading. The arm stays because the
      // block is real on the phone, whose projection card is a different
      // component and does not carry them.
      return null;

    case "wallets":
      return detail.family === "wallet" ? (
        <MonthWallets portfolio={detail.portfolio} />
      ) : null;

    case "weight-bars":
      return detail.family === "wallet" ? (
        <Holdings weights={detail.weights} />
      ) : null;

    case "fund-cost":
      return detail.family === "wallet" ? (
        <FundCostCard portfolio={detail.portfolio} />
      ) : null;

    default: {
      // Adding a block to the union is a type error here rather than a blank
      // space in a panel nobody notices for a month.
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

/**
 * The shape a block will take, while its detail is on the way.
 *
 * Per block rather than one spinner over everything, because the promise the
 * panel makes is that the figure above it is already correct: a spinner
 * covering the whole row says the opposite. A reader watching the outline of
 * a spend strip fill in knows what is coming and knows nothing is being
 * recomputed.
 *
 * Heights are the blocks' own rough heights, so the row does not lurch when
 * the real thing lands. Approximate on purpose — a skeleton measured to the
 * pixel would have to be remeasured every time a card changed.
 */
export function PanelBlockSkeleton({ block }: { block: PanelBlock }) {
  const height = SKELETON_HEIGHT[block];

  // Null for a block this client draws nothing for, so the panel does not
  // reserve a gap for something that is never going to arrive.
  if (!height) {
    return null;
  }

  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-3xl bg-muted/40", height)}
    />
  );
}

const SKELETON_HEIGHT: Record<PanelBlock, string | null> = {
  "money-on-hand": "h-64",
  "cash-accounts": "h-40",
  "recent-on-account": "h-56",
  "review-inbox": "h-48",
  "spend-strip": "h-28",
  "still-to-come": "h-56",
  "month-read": "h-48",
  "month-comparison": "h-20",
  "budget-progress": "h-36",
  "close-shelf": "h-56",
  "month-score": "h-44",
  trend: "h-36",
  projection: "h-72",
  // Drawn inside `ProjectionCard` on this client. See the arm above.
  ingredients: null,
  wallets: "h-32",
  "weight-bars": "h-40",
  "fund-cost": "h-48",
};

/* ------------------------------------------------------- small blocks */

/**
 * A heading over a mark that carries none of its own.
 *
 * `SpendStrip` and `BarSeries` are marks, not cards: they draw a shape and
 * leave the words to whoever placed them. On the Month screen that wrapper is
 * written inline in the page; here it has to be written once, because a panel
 * composes blocks it did not choose.
 */
function Framed({
  headingKey,
  children,
}: {
  headingKey: Key;
  children: ReactNode;
}) {
  const t = useT();

  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl p-5", GLASS_CARD)}>
      <h2 className="text-sm font-medium">{t(headingKey)}</h2>
      {children}
    </section>
  );
}

/** This month set against the last one, in core's own sentence. */
function ComparisonLine({
  comparison,
}: {
  comparison: Extract<PanelDetail, { family: "month" }>["comparison"];
}) {
  const locale = useLocale();
  const formatMoney = useFormatCurrency();
  const sentence = formatMonthComparison(comparison, formatMoney, locale);

  if (!sentence) {
    return null;
  }

  return (
    <Framed headingKey="bearing.panel.comparisonHeading">
      <p className="text-sm text-muted-foreground">{sentence}</p>
    </Framed>
  );
}

/** Where the months have actually landed, net. */
function Trend({
  points,
}: {
  points: Extract<PanelDetail, { family: "month" }>["trend"];
}) {
  if (points.length === 0) {
    return null;
  }

  return (
    <Framed headingKey="bearing.panel.trendHeading">
      <BarSeries
        // Signed, because a net month genuinely goes below the line and a
        // series clipped at zero would report every bad month as a quiet one.
        signed
        points={points.map((point) => ({
          key: point.monthKey,
          label: point.label,
          value: point.net,
        }))}
      />
    </Framed>
  );
}

/** Progress against the caps the user set themselves. */
function Caps({
  budgets,
}: {
  budgets: Extract<PanelDetail, { family: "month" }>["budgets"];
}) {
  if (budgets.length === 0) {
    return null;
  }

  return (
    <Framed headingKey="plan.capsHeading">
      <div className="flex flex-wrap gap-6">
        {budgets.map((row) => (
          <ProgressRing
            key={row.budgetId}
            ratio={row.ratio}
            label={row.label}
            // The percentage alone. "78% of cap" would be a sentence, and the
            // ring it sits inside has already said what the whole is.
            detail={`${Math.round(row.ratio * 100)}%`}
            over={row.over}
            meaning="limit"
            colorVar="--chart-1"
          />
        ))}
      </div>
    </Framed>
  );
}

/** What the portfolio is mostly made of, largest first. */
function Holdings({
  weights,
}: {
  weights: Extract<PanelDetail, { family: "wallet" }>["weights"];
}) {
  const t = useT();

  if (weights.length === 0) {
    return null;
  }

  return (
    <Framed headingKey="bearing.panel.holdingsHeading">
      <WeightBars
        rows={weights.map((holding) => ({
          id: holding.id,
          label: holding.label,
          weight: holding.weight,
        }))}
        restLabel={(count) => t("bearing.panel.moreHoldings", { count })}
      />
    </Framed>
  );
}
