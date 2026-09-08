import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import {
  getMonthComparison,
  getMonthlySummary,
  getMonthlyTrend,
  getRecurringSkipKeys,
  getRecurringTemplates,
  getTransactions,
} from "@/lib/queries/finance";
import { getBudgets, getSavingsGoals } from "@/lib/queries/phase4";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import {
  countSwallowedFeedItems,
  getPendingFeedItems,
  getRecentBankMovements,
  getRecurringProposals,
  hasBankFeed,
} from "@/lib/queries/bank";
import { readCashBalance } from "@/lib/queries/bank-balance";
import {
  getFulfilledKeys,
  getFulfilmentReport,
} from "@/lib/queries/fulfilment";
import { bankFeedConfigured } from "@/lib/bank/client";
import { monthReadConfigured } from "@/lib/month-read/client";
import { gatherMonthFacts } from "@/lib/month-read/facts";
import { getMonthRead } from "@/lib/queries/month-read";
import { writesRemaining } from "@finance/core/month-read-budget";
import { readMonthReadState } from "@/lib/month-read/store";
import {
  getMonthCloseOverview,
  getRecordedCashFlows,
  type MonthCloseOverview,
} from "@/lib/queries/month-close";
import { previewApplyRecurringForMonth } from "@/lib/actions/finance";
import {
  formatMonthLabel,
  getCurrentMonth,
  parseBudgetViewMode,
  savingsRatePercent,
  todayIsoLocal,
} from "@finance/core/constants";
import { resolveMonthScope } from "@/lib/month-scope";
import { previousMonthKey } from "@finance/core/month-close";
import { buildMonthPulse } from "@finance/core/month-pulse";
import { buildBudgetProgress } from "@finance/core/budget-limits";
import { buildStillToCome } from "@finance/core/still-to-come";
import {
  buildSavingsGoalProgress,
  type SavingsGoalProgress,
} from "@finance/core/savings-goals";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Disclosure } from "@/components/ui/Disclosure";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { BudgetViewToggle } from "@/components/finance/BudgetViewToggle";
import {
  MonthAttention,
  type AttentionItem,
} from "@/components/finance/MonthAttention";
import { MonthClosedRecap } from "@/components/finance/MonthClosedRecap";
import { MonthFirstRun } from "@/components/finance/MonthFirstRun";
import { MoneyOnHand } from "@/components/finance/MoneyOnHand";
import { MonthScore } from "@/components/finance/MonthScore";
import { RecentOnAccount } from "@/components/finance/RecentOnAccount";
import { MonthRead } from "@/components/finance/MonthRead";
import { ArrivedCharges } from "@/components/finance/ArrivedCharges";
import { StillToCome } from "@/components/finance/StillToCome";
import { ProgressRing, SpendStrip } from "@/components/finance/charts";
import { MonthWallets } from "@/components/finance/MonthWallets";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import type { BudgetProgress } from "@finance/core/budget-limits";
import { getLocale, getT } from "@/lib/locale";
import type {
  Category,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

interface DashboardPageProps {
  searchParams: Promise<{ y?: string; m?: string; view?: string }>;
}

/**
 * Everything outstanding, gathered from wherever it actually lives.
 *
 * Streamed on its own because it asks the bank for its inbox and runs pattern
 * detection over three thousand transactions — neither of which the month's
 * headline figures should wait behind. A slow or unreachable answer means no
 * block, not a slow page.
 *
 * The month closes are no longer fetched here. The hero now needs them too —
 * measuring unrecorded spending starts from the last close — so they are read
 * once in the page body and handed down, rather than replayed twice.
 */
async function AttentionSlot({
  userId,
  year,
  month,
  closes,
  templates,
  categories,
}: {
  userId: string;
  year: number;
  month: number;
  closes: MonthCloseOverview;
  templates: RecurringTemplateWithCategory[];
  categories: Category[];
}) {
  const locale = await getLocale();
  const t = await getT();
  const today = todayIsoLocal();
  const bankFed = await hasBankFeed(userId);

  const [pending, swallowed, proposals, applyPlan, arrived] = await Promise.all(
    [
      bankFed ? getPendingFeedItems(userId, locale) : [],
      bankFed ? countSwallowedFeedItems(userId) : 0,
      bankFed ? getRecurringProposals(userId, today) : [],
      // Only meaningful without a feed: with one, templates never apply.
      bankFed ? null : previewApplyRecurringForMonth(year, month),
      // Asked whether or not a bank feeds the ledger. A CSV import produces
      // the same situation: rows no template wrote that look like the charges
      // a template calls for.
      getFulfilmentReport(userId, templates, categories, year, month),
    ],
  );

  const items: AttentionItem[] = [];

  if (swallowed > 0) {
    items.push({
      id: "swallowed",
      tone: "wrong",
      text: t("month.attentionSwallowed", { count: swallowed }),
      href: "/transactions",
      action: t("month.actionReopen"),
    });
  }

  if (pending.length > 0) {
    items.push({
      id: "inbox",
      text: t("month.attentionInbox", { count: pending.length }),
      // The review itself, not the page it lives on. Pressing Review used to
      // land on the Ledger with the inbox still shut behind a second Review
      // button, which is the same question asked twice and looks from here
      // like nothing happened.
      href: "/transactions?review=inbox",
      action: t("month.actionReview"),
    });
  }

  const creates = applyPlan?.plan?.toCreate.length ?? 0;
  if (creates > 0) {
    items.push({
      id: "apply",
      text: t("month.attentionApply", { count: creates }),
      // The Ledger, not the Charges list: applying writes rows, and the
      // button that writes them lives where the rows land.
      href: "/transactions",
      action: t("month.actionApply"),
    });
  }

  if (closes.next) {
    items.push({
      id: "close",
      text: closes.next.isBaseline
        ? t("month.attentionBaseline")
        : t("month.attentionReadyToClose", { month: closes.next.label }),
      href: "/budgets",
      action: closes.next.isBaseline
        ? t("month.actionStart")
        : t("month.actionClose"),
    });
  }

  if (proposals.length > 0) {
    items.push({
      id: "proposals",
      text: t("month.attentionProposals", { count: proposals.length }),
      href: "/recurring",
      action: t("month.actionReview"),
    });
  }

  return (
    <MonthAttention
      items={items}
      slot={
        arrived.proposals.length > 0 ? (
          <ArrivedCharges
            proposals={arrived.proposals}
            misses={arrived.misses}
          />
        ) : undefined
      }
    />
  );
}

/**
 * The month in words, streamed.
 *
 * The fact pack is a dozen reads — every figure the Month page shows, plus
 * the close history — and the headline figures must not wait behind it. The
 * card renders from the stored row, so nothing here calls a model: a page
 * render never spends money, only a press does.
 */
async function ReadSlot({
  userId,
  year,
  month,
  monthLabel,
}: {
  userId: string;
  year: number;
  month: number;
  monthLabel: string;
}) {
  const configured = monthReadConfigured();
  const locale = await getLocale();
  const facts = await gatherMonthFacts(userId, year, month);

  const [view, { stored }] = await Promise.all([
    getMonthRead(userId, year, month, facts),
    readMonthReadState(userId, year, month),
  ]);

  // A read stays in the language it was written in, so its figures have to be
  // labelled in that language too — otherwise a French paragraph comes back
  // with English labels dropped into its sentences. Only built when the two
  // actually differ, which is rare and only after somebody switches.
  const readFacts =
    view && view.locale !== locale
      ? await gatherMonthFacts(userId, year, month, undefined, view.locale)
      : facts;

  return (
    <MonthRead
      year={year}
      month={month}
      monthLabel={monthLabel}
      read={view?.read ?? null}
      freshness={view?.freshness ?? null}
      facts={facts}
      readFacts={readFacts}
      readLocale={view?.locale ?? locale}
      writesLeft={writesRemaining(stored?.tally ?? null)}
      configured={configured}
    />
  );
}

/**
 * The statement itself, streamed because it is a second read of the feed and
 * the figures above it do not depend on it.
 */
async function RecentSlot({ userId }: { userId: string }) {
  const movements = await getRecentBankMovements(userId);
  return (
    <RecentOnAccount
      movements={movements}
      pending={movements.filter((movement) => movement.pending).length}
    />
  );
}

function Caps({
  budgetProgress,
  goalProgress,
}: {
  budgetProgress: BudgetProgress[];
  goalProgress: SavingsGoalProgress[];
}) {
  const rings = [
    ...budgetProgress.slice(0, 2).map((row) => ({
      key: `b-${row.budgetId}`,
      label: row.label,
      detail: `${Math.round(row.ratio * 100)}% of cap`,
      ratio: row.ratio,
      over: row.over,
      meaning: "limit" as const,
      colorVar: "--chart-1",
    })),
    ...goalProgress.slice(0, 2).map((row) => ({
      key: `g-${row.goal.id}`,
      label: row.goal.name,
      detail: row.complete
        ? "reached"
        : `${Math.round(row.ratio * 100)}% saved`,
      ratio: row.ratio,
      over: false,
      // A goal is a target, not a limit: filling it is the point.
      meaning: "target" as const,
      colorVar: "--chart-3",
    })),
  ];

  if (rings.length === 0) {
    return null;
  }

  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl p-5", GLASS_CARD)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Caps and goals</h2>
        <Link
          href="/budgets"
          className="flex items-center gap-1 text-sm text-primary-ink"
        >
          Plan
          <ArrowRight size={ICON.sm} />
        </Link>
      </div>
      <div className="flex flex-wrap gap-6">
        {rings.map((ring) => (
          <ProgressRing
            key={ring.key}
            ratio={ring.ratio}
            label={ring.label}
            detail={ring.detail}
            over={ring.over}
            meaning={ring.meaning}
            colorVar={ring.colorVar}
          />
        ))}
      </div>
    </section>
  );
}

async function WalletsSlot({ userId }: { userId: string }) {
  const portfolio = await getWalletPortfolio(userId, { includeHistory: false });
  return <MonthWallets portfolio={portfolio} />;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const t = await getT();
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const budgetView = parseBudgetViewMode(params.view);
  // The month the user was last looking at. Restored into the address by the
  // proxy, which clones the URL and so keeps `view` along with it.
  const { year, month } = await resolveMonthScope(params);

  const today = todayIsoLocal();
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;
  // Whether a balance could exist at all, as against whether one was read.
  // The hero needs the difference to explain itself honestly.
  const bankConnected = bankFeedConfigured();
  const locale = await getLocale();

  const [
    summary,
    budgets,
    goals,
    categories,
    comparison,
    templates,
    monthTransactions,
    skippedKeys,
    closes,
    // What the accounts hold now. Only for the month in progress: the figure
    // is today's, and presenting it beside March's totals would be inviting
    // the reader to do arithmetic across two different moments.
    cash,
    flows,
    fulfilledKeys,
    // Six months of net, for the mark beside the hero figure. Cheap enough to
    // join the batch: one indexed read, and the bucketing is arithmetic.
    trend,
  ] = await Promise.all([
    getMonthlySummary(user.id, year, month, budgetView),
    getBudgets(user.id),
    getSavingsGoals(user.id),
    getCategories(user.id),
    getMonthComparison(user.id, year, month),
    getRecurringTemplates(user.id),
    getTransactions(user.id, year, month),
    getRecurringSkipKeys(user.id, year, month),
    getMonthCloseOverview(user.id, today),
    isCurrentMonth ? readCashBalance(user.id, today) : null,
    isCurrentMonth ? getRecordedCashFlows(user.id, year, month) : null,
    getFulfilledKeys(user.id),
    getMonthlyTrend(user.id),
  ]);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name] as const));
  const budgetProgress = buildBudgetProgress(
    budgets,
    summary.expenseBreakdown,
    summary.expenses,
    categoryNames,
    locale,
  );
  const goalProgress = buildSavingsGoalProgress(
    goals,
    summary.savingsBreakdown,
    summary.savings,
  );

  const monthLabel = formatMonthLabel(year, month);
  // Only a month in progress has an "of it gone" to report.
  const elapsed = isCurrentMonth
    ? Number(today.slice(8, 10)) / new Date(year, month, 0).getDate()
    : null;

  // Nothing set up and nothing recorded: the standing card would report "0 €
  // left" over two more zeros, which is a correct answer to a question nobody
  // asked. Show the way in instead.
  const firstRun =
    templates.length === 0 &&
    budgets.length === 0 &&
    goals.length === 0 &&
    summary.income === 0 &&
    summary.expenses === 0;

  const upcoming = buildStillToCome(
    monthTransactions,
    templates,
    year,
    month,
    today,
    skippedKeys,
    // Without this, every recurring charge the bank delivers is forecast on
    // top of the movement that already paid it.
    fulfilledKeys,
  );

  const savingsRate = savingsRatePercent(
    summary.savings,
    summary.investments,
    summary.investmentDeployments,
    summary.income,
  );

  const pulse = buildMonthPulse({
    // A reading that failed comes back with `ok: false`, and its total is
    // short by whatever the unreadable accounts hold — so it is not a balance
    // and must not be presented as one.
    onHand: cash?.ok ? cash.total : null,
    committed: upcoming.leaving,
    arriving: upcoming.arriving,
    flows: flows ?? { income: 0, expenses: 0, savings: 0, transfers: 0 },
    openingBalance: openingBalanceFor(closes, year, month),
    cap: closes.settings.unrecordedCap,
  });

  const unreadable = (cash?.missing ?? []).map((entry) => entry.label);
  const latestClose = closes.history[0] ?? null;
  // Exactly when `Caps` below has a ring to draw. The desktop layout needs to
  // know before it lays out, because an empty rail would leave the main
  // column at seven of twelve with nothing beside it.
  const hasCaps = budgetProgress.length > 0 || goalProgress.length > 0;

  return (
    <>
      <PageHeader titleKey="nav.month">
        <Suspense fallback={null}>
          <BudgetViewToggle basePath="/dashboard" className="hidden sm:flex" />
        </Suspense>
        <Suspense fallback={<span className="text-sm">…</span>}>
          <MonthPicker basePath="/dashboard" />
        </Suspense>
      </PageHeader>

      {/* Twelve columns above xl, one below it.

          The order here is the reading order on every width — what wants a
          decision, then the figure, then what supports it — and the grid only
          decides what sits beside what. Nothing above xl:, so the phone and
          tablet layouts are untouched. */}
      <PageContainer className="flex flex-col gap-4 xl:grid xl:grid-cols-12 xl:items-start xl:gap-6">
        {/* Spanning the width: it is the one block on this screen that asks
            rather than tells. `empty:hidden` because a month with nothing
            outstanding renders nothing, and a wrapper left behind would show
            as a gap. */}
        <div className="empty:hidden xl:col-span-12">
          <Suspense fallback={null}>
            <AttentionSlot
              userId={user.id}
              year={year}
              month={month}
              closes={closes}
              templates={templates}
              categories={categories}
            />
          </Suspense>
        </div>

        {/* The answer, and the breakdown that supports it. */}
        <div
          className={cn(
            "flex flex-col gap-4",
            hasCaps ? "xl:col-span-7" : "xl:col-span-12",
          )}
        >
          {firstRun ? <MonthFirstRun /> : null}

          {firstRun ? null : (
            <MoneyOnHand
              pulse={pulse}
              monthLabel={monthLabel}
              income={summary.income}
              expenses={summary.expenses}
              remaining={summary.remaining}
              budgetView={budgetView}
              elapsed={elapsed}
              comparison={comparison}
              savingsRate={savingsRate}
              unreadable={unreadable}
              trend={trend.map((point) => point.net)}
              noBalanceReason={
                isCurrentMonth
                  ? bankConnected
                    ? null
                    : "no-bank"
                  : "past-month"
              }
            />
          )}

          {/* Where the month went, and what it was allowed to spend. These
            stay above the fold with the hero: they are the answer to "how is
            the month going", not commentary on it. */}
          {summary.expenses > 0 ? (
            <section
              className={cn("flex flex-col gap-4 rounded-3xl p-5", GLASS_CARD)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">Where it went</h2>
                <Link
                  href="/transactions"
                  className="flex items-center gap-1 text-sm text-primary-ink"
                >
                  Ledger
                  <ArrowRight size={ICON.sm} />
                </Link>
              </div>
              <SpendStrip
                rows={summary.expenseBreakdown}
                total={summary.expenses}
              />
            </section>
          ) : null}
        </div>

        {/* The rail: progress toward the things the user set themselves. */}
        {hasCaps ? (
          <div className="flex flex-col gap-4 xl:col-span-5">
            <Caps budgetProgress={budgetProgress} goalProgress={goalProgress} />
          </div>
        ) : null}

        {/* Everything that elaborates on the figures above rather than
            stating them, in the order the phone shows it. Closed by default:
            the point of this screen is the answer, not the whole file on the
            month.

            The children still render — `<details>` hides its contents rather
            than dropping them — so the streamed slots below resolve on the
            server as they always did and opening this costs nothing. */}
        <div className="xl:col-span-12">
          <Disclosure
            label={t("month.moreThisMonth")}
            contentClassName="xl:grid xl:grid-cols-2 xl:items-start xl:gap-6"
          >
            {/* After the figures, never before them. The read interprets what
              is above it, and a paragraph above the numbers it discusses asks
              the reader to take it on trust. */}
            {firstRun ? null : (
              <Suspense fallback={null}>
                <ReadSlot
                  userId={user.id}
                  year={year}
                  month={month}
                  monthLabel={monthLabel}
                />
              </Suspense>
            )}

            {/* Only in the as-of-today view: the month-end view has already
              counted these into the headline, so listing them again would
              invite the reader to subtract them twice. */}
            {!firstRun && budgetView === "current" ? (
              <StillToCome
                outgoing={upcoming.outgoing}
                leaving={upcoming.leaving}
                incoming={upcoming.incoming}
                arriving={upcoming.arriving}
              />
            ) : null}

            {/* Only for the month in progress. A finished month's unrecorded
              spending is a settled figure and belongs to its close, which the
              recap below reports. */}
            {!firstRun && isCurrentMonth ? (
              <MonthScore
                pulse={pulse}
                streak={closes.summary.streak}
                bestStreak={closes.summary.bestStreak}
                baseline={closes.summary.baseline}
              />
            ) : null}

            <Suspense fallback={null}>
              <RecentSlot userId={user.id} />
            </Suspense>

            <Suspense fallback={null}>
              <WalletsSlot userId={user.id} />
            </Suspense>

            {latestClose ? (
              <MonthClosedRecap
                row={latestClose}
                streak={closes.summary.streak}
                cap={closes.settings.unrecordedCap}
              />
            ) : null}
          </Disclosure>
        </div>
      </PageContainer>
    </>
  );
}

/**
 * The balance this month's unrecorded spending is measured from.
 *
 * Only the close of the month immediately before counts. A user who has
 * fallen behind has a newest close two or three months back, and measuring
 * this month's recorded flows against that balance would compare a balance
 * against transactions from a different window — producing a figure that
 * looks authoritative and is nonsense. Null instead, which reads as "not
 * known yet" everywhere downstream.
 */
function openingBalanceFor(
  closes: MonthCloseOverview,
  year: number,
  month: number,
): number | null {
  const latest = closes.history[0];
  if (!latest) {
    return null;
  }
  const wanted = previousMonthKey(`${year}-${String(month).padStart(2, "0")}`);
  return latest.monthKey === wanted ? latest.closingBalance : null;
}
