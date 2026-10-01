import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";

import { buildBudgetProgress } from "@finance/core/budget-limits";
import type { CloseableMonth } from "@finance/core/month-close";
import {
  buildForwardProjection,
  buildRunway,
  type ForwardProjection,
  type Runway,
} from "@finance/core/projection";
import {
  buildGoalRunningTotals,
  buildSavingsGoalProgress,
  earliestGoalStart,
  EMPTY_GOAL_LEDGER,
} from "@finance/core/savings-goals";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import type {
  BankAccount,
  Budget,
  Category,
  SavingsGoal,
} from "@finance/core/types/database";
import type { TagUsage } from "@finance/core/tags";
import { resolveMessage } from "@finance/core/i18n/t";

import { ConnectBankInvite } from "@/components/bank/ConnectBankInvite";
import { MonthCloseHistoryCard } from "@/components/MonthCloseHistoryCard";
import { MonthCloseSheet } from "@/components/MonthCloseSheet";
import { StaggerItem } from "@/components/motion/Stagger";
import { BudgetsCard } from "@/components/plan/BudgetsCard";
import { CashAccountsCard } from "@/components/plan/CashAccountsCard";
import { GoalsCard } from "@/components/plan/GoalsCard";
import { MonthCloseCard } from "@/components/plan/MonthCloseCard";
import { TagsCard } from "@/components/plan/TagsCard";
import { ProjectionCard } from "@/components/ProjectionCard";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useBankState } from "@/hooks/useBankState";
import { useRefreshable } from "@/hooks/useRefreshable";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { hapticLight } from "@/lib/haptics";
import {
  getBankAccounts,
  getBudgets,
  getCategories,
  getGoalLedger,
  getMonthCloseOverview,
  getMonthlySummary,
  getRecurringTemplates,
  getSavingsGoals,
  getSavingsReserve,
  getTagUsage,
  readCashBalance,
  type MonthCloseOverview,
} from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useFlag } from "@/providers/FlagsProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useTabBarClearance } from "@/theme/chrome";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * One close, and every figure the sheet reads while it is open. Assembled
 * from live data to render the trigger, and frozen into state the moment the
 * trigger is pressed — see `closing` below for why the freeze matters.
 */
interface ClosePrompt {
  month: CloseableMonth;
  monthlyCommitted: number;
  unrecordedCap: number | null;
  baseline: number | null;
}

/**
 * Plan, in the web's order: what the month may spend (budgets), what is being
 * saved towards (goals), the tags; then the footer the web keeps under them —
 * which accounts hold spending money, the month's close, the projection, the
 * way to categories and import, and the history of closes.
 *
 * It was the other way round on the phone: the projection and the close first,
 * the budgets fourth, and every form open at all times, so the screen was
 * mostly empty fields. A budget could only be set on all spending, and
 * nothing could be edited once made.
 */
export default function PlanningScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const current = getCurrentMonth();
  const manageTags = useFlag("tags.manage");
  /**
   * Everything the sheet is working from, held rather than read live.
   *
   * Recording a close rewrites the very figures the sheet is still showing.
   * `closes.next` usually empties, because the following month's reading day
   * has not arrived — driving the mounted sheet off it would tear the sheet
   * away the instant the refresh landed, taking the reveal and its undo with
   * it, and the reveal is the entire reason the sheet asks before it commits.
   * `summary.baseline` moves too: it is the median of the reconciled closes,
   * so the close just written is one of the numbers it is a median of, and
   * the sentence under the figures would swap wording mid-read.
   *
   * So all four travel together. Web does not have to think about any of
   * this: its page is server-rendered and none of it moves under an open
   * sheet.
   */
  const [closing, setClosing] = useState<ClosePrompt | null>(null);
  /**
   * Whether the sheet is showing, kept apart from *what* it is showing, so
   * the month just closed stays on the sheet while it animates away — see
   * `closing` above.
   */
  const [sheetOpen, setSheetOpen] = useState(false);

  const dataVersion = useDataVersion();
  const { data, loading, refreshing, onRefresh, onRefreshAll, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          budgets: [] as Budget[],
          goals: [] as SavingsGoal[],
          tags: [] as TagUsage[],
          categories: [] as Category[],
          accounts: [] as BankAccount[],
          budgetProgress: [] as ReturnType<typeof buildBudgetProgress>,
          goalProgress: [] as ReturnType<typeof buildSavingsGoalProgress>,
          projection: null as ForwardProjection | null,
          runway: null as Runway | null,
          closes: null as MonthCloseOverview | null,
        };
      }

      const today = todayIsoLocal();

      const [
        budgets,
        goals,
        tags,
        categories,
        summary,
        templates,
        reserve,
        closes,
        // What the projection starts from. Two indexed reads and no network:
        // it reads the stored statement, which is why the phone can answer
        // at all. Null when no account is ticked, which is ordinary.
        cash,
        // Empty for anyone who has not connected a bank, which hides the
        // card that lists them.
        accounts,
      ] = await Promise.all([
        getBudgets(user.id),
        getSavingsGoals(user.id),
        getTagUsage(user.id),
        getCategories(user.id),
        getMonthlySummary(user.id, current.year, current.month),
        getRecurringTemplates(user.id),
        getSavingsReserve(user.id),
        getMonthCloseOverview(user.id, today, locale),
        readCashBalance(user.id, today),
        getBankAccounts(user.id),
      ]);

      // A running total from each goal's start. Asked for after the batch
      // because the window depends on the goals it fetched.
      const goalStart = earliestGoalStart(goals);
      const goalLedger = goalStart
        ? await getGoalLedger(user.id, goalStart, today)
        : EMPTY_GOAL_LEDGER;

      const categoryNames = new Map(
        categories.map((c) => [c.id, c.name] as const),
      );

      return {
        budgets,
        goals,
        tags,
        categories,
        accounts,
        budgetProgress: buildBudgetProgress(
          budgets,
          summary.expenseBreakdown,
          summary.expenses,
          categoryNames,
          locale,
        ),
        goalProgress: buildSavingsGoalProgress(
          goals,
          buildGoalRunningTotals(goals, goalLedger, templates, today),
        ),
        projection: buildForwardProjection({
          templates,
          year: current.year,
          month: current.month,
          today,
          months: 12,
          // Never a partial sum: a reading missing an account is short by
          // whatever that account holds, so it is not a balance.
          onHand: cash?.ok ? cash.total : null,
          closes: closes.summary,
          locale,
        }),
        runway: buildRunway(reserve, templates, current.year, current.month),
        closes,
      };
    }, [user?.id, current.year, current.month, dataVersion, locale]);
  const { bank } = useBankState();

  /** Every screen, not just this one: budgets and goals sit on Le point too. */
  function changed() {
    notifyDataChanged();
    void onRefresh();
  }

  const categories = (data?.categories ?? []).filter((c) => !c.archived);
  const closes = data?.closes ?? null;
  // What the app is currently asking about, if anything. Null once the latest
  // month is closed and the next one's reading day has not arrived.
  const prompt: ClosePrompt | null =
    closes && closes.next
      ? {
          month: closes.next,
          // Committed outgoings for the month in progress, which is what
          // turns a month's saving into days of runway. `buildRunway` derives
          // it from the templates alone, so the reserve this screen passes it
          // does not touch the figure.
          monthlyCommitted: data?.runway?.monthlyCommitted ?? 0,
          unrecordedCap: closes.settings.unrecordedCap,
          baseline: closes.summary.baseline,
        }
      : null;

  /**
   * The snapshot once one has been taken, the live prompt before that, so the
   * sheet can be mounted hidden and then toggled rather than appearing
   * already open on the frame it first exists.
   */
  const sheet = closing ?? prompt;

  return (
    <Screen title={t("nav.plan")} className="pb-0">
      {loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : error ? (
        <Text className="text-destructive">{resolveMessage(t, error)}</Text>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-4 pt-1"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
        >
          <StaggerItem index={0}>
            <BudgetsCard
              budgets={data?.budgets ?? []}
              progress={data?.budgetProgress ?? []}
              categories={categories.filter((c) => c.type === "expense")}
              onChanged={changed}
            />
          </StaggerItem>

          <StaggerItem index={1}>
            <GoalsCard
              goals={data?.goals ?? []}
              progress={data?.goalProgress ?? []}
              categories={categories.filter((c) => c.type === "savings")}
              onChanged={changed}
            />
          </StaggerItem>

          <StaggerItem index={2}>
            <TagsCard
              tags={data?.tags ?? []}
              manage={manageTags}
              onChanged={changed}
            />
          </StaggerItem>

          {/* The footer, as on the web. Which accounts hold spending money
              comes first: ticked and readable, they close months on their
              own, and the card below then never appears. */}
          <CashAccountsCard
            accounts={data?.accounts ?? []}
            onChanged={changed}
          />

          {/* Beside the close, because a connected bank is what closes
              months without being asked. */}
          <ConnectBankInvite surface="plan" bank={bank} />

          {/* Still here when the statement cannot answer: a lapsed consent, a
              month the provider no longer covers, or no bank at all. Le
              point's "ready to close" row sends people here. */}
          {prompt && closes ? (
            <MonthCloseCard
              monthLabel={prompt.month.label}
              isBaseline={prompt.month.isBaseline}
              unrecordedCap={prompt.unrecordedCap}
              baseline={prompt.baseline}
              streak={closes.summary.streak}
              onOpen={() => {
                setClosing(prompt);
                setSheetOpen(true);
              }}
            />
          ) : null}

          <ProjectionCard
            projection={data?.projection ?? null}
            runway={data?.runway ?? null}
          />

          <View className="gap-3">
            {(
              [
                {
                  href: "/categories",
                  title: t("plan.linkCategoriesTitle"),
                  hint: t("plan.linkCategoriesHint"),
                },
                {
                  href: "/import",
                  title: t("plan.linkImportTitle"),
                  hint: t("plan.linkImportHint"),
                },
              ] as const
            ).map((link) => (
              <PlanLink
                key={link.href}
                title={link.title}
                hint={link.hint}
                onPress={() => router.push(link.href as Href)}
              />
            ))}
          </View>

          {closes ? (
            <MonthCloseHistoryCard
              history={closes.history}
              summary={closes.summary}
              unrecordedCap={closes.settings.unrecordedCap}
              closeDay={closes.settings.closeDay}
              onChanged={changed}
            />
          ) : null}
        </ScrollView>
      )}

      {sheet ? (
        <MonthCloseSheet
          open={sheetOpen}
          onOpenChange={(value) => {
            if (!value) {
              setSheetOpen(false);
            }
          }}
          year={sheet.month.year}
          month={sheet.month.month}
          monthLabel={sheet.month.label}
          observeOn={sheet.month.observeOn}
          isBaseline={sheet.month.isBaseline}
          monthlyCommitted={sheet.monthlyCommitted}
          unrecordedCap={sheet.unrecordedCap}
          baseline={sheet.baseline}
          onClosed={changed}
        />
      ) : null}
    </Screen>
  );
}

/** One of the footer's ways out, as the web's linked cards. */
function PlanLink({
  title,
  hint,
  onPress,
}: {
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      accessibilityHint={hint}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      className="min-h-14 flex-row items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium">{title}</Text>
        <Text variant="muted" className="text-xs">
          {hint}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={ICON.md} color={colors.foreground} />
    </Pressable>
  );
}
