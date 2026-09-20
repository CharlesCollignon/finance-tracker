import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import type { PanelBlock } from "@finance/core/bearing-panels";
import type { Key } from "@finance/core/i18n/t";
import { getCurrentMonth, type BudgetViewMode } from "@finance/core/constants";
import { formatMonthComparison } from "@finance/core/month-comparison";
import { presentTrend } from "@finance/core/monthly-trend";

import type { PanelDetail } from "@/lib/bearing-panel";
import { ArrivedCharges } from "@/components/ArrivedCharges";
import { BankInboxSheet } from "@/components/BankInboxSheet";
import { FundCostCard } from "@/components/FundCostCard";
import { MoneyOnHand } from "@/components/MoneyOnHand";
import { MonthCloseHistoryCard } from "@/components/MonthCloseHistoryCard";
import { MonthRead } from "@/components/MonthRead";
import { MonthScore } from "@/components/MonthScore";
import { MonthWallets } from "@/components/MonthWallets";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ProjectionCard } from "@/components/ProjectionCard";
import { RecentOnAccount } from "@/components/RecentOnAccount";
import { StillToCome } from "@/components/StillToCome";
import { BarSeries, ProgressRing, SpendStrip } from "@/components/charts";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";

/**
 * One block, drawn from the detail its family fetched.
 *
 * The phone's answer to `apps/web/components/finance/bearing/panel-blocks.tsx` —
 * same shape, same reasoning, and read that file first if this one is
 * confusing. Returns null rather than an empty shell when the detail does not
 * carry what a block needs, and the family guard on every arm is what
 * narrows `PanelDetail`'s union rather than defensive padding: TypeScript
 * will not let an arm read a field its branch never fetched.
 *
 * Every block that already has a home elsewhere in the app — `MoneyOnHand`,
 * `RecentOnAccount`, `StillToCome`, `MonthRead`, `MonthScore`,
 * `MonthCloseHistoryCard`, `MonthWallets`, `ProjectionCard`, `FundCostCard` —
 * is that same component, so a panel and the screen its footer links to draw
 * the same figure from the same code and cannot come to disagree. Two blocks
 * have no such home: `cash-accounts` and the review summary under
 * `review-inbox` are new here, because nothing on the phone drew a bank
 * account list or an inbox summary before this screen needed one.
 */
export function PanelBlockView({
  block,
  detail,
  onViewChange,
  onChanged,
}: {
  block: PanelBlock;
  detail: PanelDetail;
  /** The "now" family's own today/month-end pill, and the month-scope chrome. */
  onViewChange: (next: BudgetViewMode) => void;
  /** After a write this panel's own detail rests on. Clears the panel cache too. */
  onChanged: () => void;
}): ReactNode {
  switch (block) {
    case "money-on-hand": {
      if (detail.family !== "now") {
        return null;
      }
      const { year, month } = getCurrentMonth();
      return (
        <MoneyOnHand
          {...detail.hero}
          comparison={detail.comparison}
          year={year}
          month={month}
          onBudgetViewChange={onViewChange}
        />
      );
    }

    case "cash-accounts":
      return detail.family === "now" ? (
        <CashAccounts accounts={detail.accounts} />
      ) : null;

    case "recent-on-account":
      return detail.family === "now" ? (
        <RecentOnAccount movements={detail.movements} />
      ) : null;

    case "review-inbox":
      return detail.family === "now" && detail.inbox ? (
        <ReviewInbox inbox={detail.inbox} onChanged={onChanged} />
      ) : null;

    case "arrived-charges":
      return detail.family === "month" &&
        detail.arrived &&
        (detail.arrived.proposals.length > 0 ||
          detail.arrived.misses.length > 0) ? (
        <Card bezel innerClassName="p-0">
          <ArrivedCharges
            proposals={detail.arrived.proposals}
            misses={detail.arrived.misses}
            onDecided={onChanged}
          />
        </Card>
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
          read={detail.read.read}
          freshness={detail.read.freshness}
          facts={detail.read.facts}
          readFacts={detail.read.readFacts}
          readLocale={detail.read.readLocale}
          writesLeft={detail.read.writesLeft}
          writable={detail.read.configured}
          onWritten={onChanged}
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
        <MonthCloseHistoryCard
          history={detail.closes.history}
          summary={detail.closes.summary}
          unrecordedCap={detail.closes.settings.unrecordedCap}
          closeDay={detail.closes.settings.closeDay}
          onChanged={onChanged}
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
 * Per block rather than one skeleton over everything, for the reason the web
 * twin gives: the promise the panel makes is that the figure above it is
 * already correct, and a single placeholder covering the whole row would
 * deny that. Heights are rough on purpose — approximate is all a placeholder
 * needs to be, and one measured to the pixel would need updating every time
 * a card's own layout changed.
 */
export function PanelBlockSkeleton({ block }: { block: PanelBlock }) {
  return (
    <Skeleton
      className="w-full rounded-card"
      style={{ height: SKELETON_HEIGHT[block] }}
    />
  );
}

const SKELETON_HEIGHT: Record<PanelBlock, number> = {
  "money-on-hand": 260,
  "cash-accounts": 160,
  "recent-on-account": 220,
  "review-inbox": 64,
  "arrived-charges": 190,
  "spend-strip": 96,
  "still-to-come": 220,
  "month-read": 190,
  "month-comparison": 56,
  "budget-progress": 140,
  "close-shelf": 220,
  "month-score": 175,
  trend: 128,
  projection: 280,
  wallets: 110,
  "weight-bars": 160,
  "fund-cost": 190,
};

/* ------------------------------------------------------- small blocks */

/**
 * A heading over a mark that carries none of its own.
 *
 * `SpendStrip` and `BarSeries` are marks, not cards — they draw a shape and
 * leave the words to whoever placed them. On the Month screen that wrapper
 * is written inline in the screen; here it has to be written once, because a
 * panel composes blocks it did not choose.
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
    <Card className="gap-4">
      <Text variant="label">{t(headingKey)}</Text>
      {children}
    </Card>
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
      <Text variant="muted" className="text-sm">
        {sentence}
      </Text>
    </Framed>
  );
}

/** Where the months have actually landed, net. */
/**
 * `presentTrend` (core) is what tells a real flat month apart from a month
 * before the account existed — both are a zero in `points`, and a chart
 * cannot draw that difference. Below three real months it lists them
 * instead of plotting two bars as though they were a shape.
 */
function Trend({
  points,
}: {
  points: Extract<PanelDetail, { family: "month" }>["trend"];
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const presentation = presentTrend(points);

  if (presentation.kind === "empty") {
    return null;
  }

  if (presentation.kind === "thin") {
    return (
      <Framed headingKey="bearing.panel.trendHeading">
        <Text variant="muted" className="text-sm">
          {t("bearing.panel.trendThin", { count: presentation.points.length })}
        </Text>
        <View className="gap-1">
          {presentation.points.map((point) => (
            <View
              key={point.monthKey}
              className="flex-row items-baseline justify-between gap-3"
            >
              <Text variant="muted" className="text-sm">
                {point.label}
              </Text>
              <PrivateAmount
                className={cn("text-sm", point.net < 0 && "text-destructive")}
              >
                {formatEuro(point.net)}
              </PrivateAmount>
            </View>
          ))}
        </View>
      </Framed>
    );
  }

  return (
    <Framed headingKey="bearing.panel.trendHeading">
      <BarSeries
        // Signed, because a net month genuinely goes below the line and a
        // series clipped at zero would report every bad month as a quiet one.
        signed
        points={presentation.points.map((point) => ({
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
      <View className="flex-row flex-wrap gap-6">
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
          />
        ))}
      </View>
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

  const limit = 6;
  const sorted = [...weights].sort((a, b) => b.weight - a.weight);
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const restWeight = rest.reduce((sum, row) => sum + row.weight, 0);
  const largest = Math.max(
    ...head.map((row) => row.weight),
    restWeight,
    0.0001,
  );

  return (
    <Framed headingKey="bearing.panel.holdingsHeading">
      <View className="gap-2.5">
        {head.map((row) => (
          <HoldingBar
            key={row.id}
            label={row.label}
            weight={row.weight}
            largest={largest}
          />
        ))}
        {restWeight > 0.001 ? (
          <HoldingBar
            label={t("bearing.panel.moreHoldings", { count: rest.length })}
            weight={restWeight}
            largest={largest}
          />
        ) : null}
      </View>
    </Framed>
  );
}

/**
 * One ranked row: a label, its share, and a bar scaled to the largest row —
 * so the shape of the ranking is legible even when nothing reaches a fifth
 * of the portfolio.
 */
function HoldingBar({
  label,
  weight,
  largest,
}: {
  label: string;
  weight: number;
  largest: number;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
          {label}
        </Text>
        <Text className="shrink-0 text-sm font-semibold">
          {`${Math.round(weight * 100)}%`}
        </Text>
      </View>
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <View
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, (weight / largest) * 100)}%` }}
        />
      </View>
    </View>
  );
}

/**
 * Which connected accounts hold money the reader spends.
 *
 * New here rather than borrowed: nothing on the phone drew this list before
 * the `on-hand` tile needed a panel, because a connection has always been
 * configured from the web app. Read-only for that reason — the tick that
 * decides whether an account counts as cash lives on the web's settings
 * screen, and duplicating that control here would give the phone a second,
 * unsynchronised opinion about it.
 */
function CashAccounts({
  accounts,
}: {
  accounts: Extract<PanelDetail, { family: "now" }>["accounts"];
}) {
  const t = useT();
  const formatMoney = useFormatCurrency();

  if (accounts.length === 0) {
    return null;
  }

  return (
    <Framed headingKey="bearing.panel.cashAccountsHeading">
      <Text variant="muted" className="-mt-2 text-sm">
        {t("bearing.panel.cashAccountsBody")}
      </Text>
      <View>
        {accounts.map((account, index) => (
          <View
            key={account.provider_account_id}
            className={
              index === accounts.length - 1
                ? "flex-row items-center justify-between gap-3 py-2.5"
                : "flex-row items-center justify-between gap-3 border-b border-border py-2.5"
            }
          >
            <View className="min-w-0 flex-1 gap-0.5">
              <Text numberOfLines={1} className="text-sm font-medium">
                {account.label}
              </Text>
              {account.needs_reconnect ? (
                <Text className="text-xs text-destructive">
                  {t("bearing.panel.cashAccountsLapsed")}
                </Text>
              ) : account.reported_on ? (
                <Text variant="muted" className="text-xs">
                  {t("bearing.panel.cashAccountsLastRead", {
                    when: account.reported_on,
                  })}
                </Text>
              ) : null}
            </View>
            {account.reported_balance !== null && !account.needs_reconnect ? (
              <PrivateAmount className="shrink-0 text-sm">
                {formatMoney(Number(account.reported_balance))}
              </PrivateAmount>
            ) : null}
          </View>
        ))}
      </View>
    </Framed>
  );
}

/**
 * The count, and the way in, rather than the queue itself.
 *
 * `BankInboxSheet` already is the phone's review flow — the Ledger opens the
 * same sheet from the same count. Embedding its whole one-card-at-a-time
 * flow inline in an accordion row would fight the row it sits in; a summary
 * that opens the existing sheet as a modal does not.
 *
 * `arrived-charges`, below, does not follow this shape even though it is the
 * same "a decision, not a destination" idea: its rows are a handful at most
 * and each is answered with two taps rather than a swipe through a stack, so
 * the list itself fits the row it sits in and a summary-plus-sheet would only
 * add a tap in front of it.
 */
function ReviewInbox({
  inbox,
  onChanged,
}: {
  inbox: NonNullable<Extract<PanelDetail, { family: "now" }>["inbox"]>;
  onChanged: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  if (inbox.items.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="flex-row items-center justify-between gap-3">
        <Text className="min-w-0 flex-1 text-sm font-medium">
          {t("ledger.needsCategory", { count: inbox.items.length })}
        </Text>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("ledger.review")}
          hitSlop={8}
        >
          <Text className="text-sm font-medium text-primary-ink">
            {t("ledger.review")}
          </Text>
        </Pressable>
      </Card>

      <BankInboxSheet
        open={open}
        onOpenChange={setOpen}
        items={inbox.items}
        categories={inbox.categories}
        onDecided={onChanged}
      />
    </>
  );
}
