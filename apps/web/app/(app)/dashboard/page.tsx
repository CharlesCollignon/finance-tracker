import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCategories } from "@/lib/queries/categories";
import {
  getMonthComparison,
  getMonthlySummary,
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
import { cn } from "@/lib/utils";
import type { BudgetProgress } from "@finance/core/budget-limits";
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
 * measuring untracked spending starts from the last close — so they are read
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
  const today = todayIsoLocal();
  const bankFed = await hasBankFeed(userId);

  const [pending, swallowed, proposals, applyPlan, arrived] = await Promise.all(
    [
      bankFed ? getPendingFeedItems(userId) : [],
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
      text: `${swallowed} bank ${swallowed === 1 ? "entry was" : "entries were"} merged away by an earlier sync`,
      href: "/transactions",
      action: "Reopen",
    });
  }

  if (pending.length > 0) {
    items.push({
      id: "inbox",
      text: `${pending.length} ${pending.length === 1 ? "entry needs" : "entries need"} a category`,
      href: "/transactions",
      action: "Review",
    });
  }

  const creates = applyPlan?.plan?.toCreate.length ?? 0;
  if (creates > 0) {
    items.push({
      id: "apply",
      text: `${creates} recurring ${creates === 1 ? "item is" : "items are"} ready to add`,
      // The Ledger, not the Charges list: applying writes rows, and the
      // button that writes them lives where the rows land.
      href: "/transactions",
      action: "Apply",
    });
  }

  if (closes.next) {
    items.push({
      id: "close",
      text: closes.next.isBaseline
        ? "Enter your account balance once, to start catching spending the app never sees"
        : `${closes.next.label} is ready to close`,
      href: "/budgets",
      action: closes.next.isBaseline ? "Start" : "Close",
    });
  }

  if (proposals.length > 0) {
    items.push({
      id: "proposals",
      text: `${proposals.length} ${proposals.length === 1 ? "charge looks" : "charges look"} like they repeat`,
      href: "/recurring",
      action: "Review",
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
  const facts = await gatherMonthFacts(userId, year, month);

  const [view, { stored }] = await Promise.all([
    getMonthRead(userId, year, month, facts),
    readMonthReadState(userId, year, month),
  ]);

  return (
    <MonthRead
      year={year}
      month={month}
      monthLabel={monthLabel}
      read={view?.read ?? null}
      freshness={view?.freshness ?? null}
      facts={facts}
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
          <ArrowRight size={13} />
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
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const budgetView = parseBudgetViewMode(params.view);
  // The month the user was last looking at. Restored into the address by the
  // middleware, which clones the URL and so keeps `view` along with it.
  const { year, month } = await resolveMonthScope(params);

  const today = todayIsoLocal();
  const current = getCurrentMonth();
  const isCurrentMonth = year === current.year && month === current.month;
  // Whether a balance could exist at all, as against whether one was read.
  // The hero needs the difference to explain itself honestly.
  const bankConnected = bankFeedConfigured();

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
  ]);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name] as const));
  const budgetProgress = buildBudgetProgress(
    budgets,
    summary.expenseBreakdown,
    summary.expenses,
    categoryNames,
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

  return (
    <>
      <PageHeader title="Month">
        <Suspense fallback={null}>
          <BudgetViewToggle basePath="/dashboard" className="hidden sm:flex" />
        </Suspense>
        <Suspense fallback={<span className="text-sm">…</span>}>
          <MonthPicker basePath="/dashboard" />
        </Suspense>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
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
            noBalanceReason={
              isCurrentMonth ? (bankConnected ? null : "no-bank") : "past-month"
            }
          />
        )}

        {/* Only for the month in progress. A finished month's untracked
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

        <Suspense fallback={null}>
          <RecentSlot userId={user.id} />
        </Suspense>

        {latestClose ? (
          <MonthClosedRecap
            row={latestClose}
            streak={closes.summary.streak}
            cap={closes.settings.unrecordedCap}
          />
        ) : null}

        {/* After the figures, never before them. The read interprets what is
            above it, and a paragraph above the numbers it discusses asks the
            reader to take it on trust. */}
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
                <ArrowRight size={13} />
              </Link>
            </div>
            <SpendStrip
              rows={summary.expenseBreakdown}
              total={summary.expenses}
            />
          </section>
        ) : null}

        <Caps budgetProgress={budgetProgress} goalProgress={goalProgress} />

        <Suspense fallback={null}>
          <WalletsSlot userId={user.id} />
        </Suspense>
      </PageContainer>
    </>
  );
}

/**
 * The balance this month's untracked spending is measured from.
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
