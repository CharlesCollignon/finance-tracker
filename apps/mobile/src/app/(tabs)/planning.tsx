import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

import { buildBudgetProgress } from "@finance/core/budget-limits";
import {
  closeInvitation,
  type CloseableMonth,
} from "@finance/core/month-close";
import {
  buildForwardProjection,
  buildRunway,
  type ForwardProjection,
  type Runway,
} from "@finance/core/projection";
import {
  buildSavingsGoalProgress,
  computeGoalPacing,
  type GoalPacing,
} from "@finance/core/savings-goals";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import type {
  Budget,
  Category,
  SavingsGoal,
  Tag,
} from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { DateField } from "@/components/ui/DateField";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ProgressRing } from "@/components/charts";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { ProjectionCard } from "@/components/ProjectionCard";
import { MonthCloseHistoryCard } from "@/components/MonthCloseHistoryCard";
import { MonthCloseSheet } from "@/components/MonthCloseSheet";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useChartSeries } from "@/theme/chart-series";
import { useTabBarClearance } from "@/theme/chrome";
import { useLocale, useT } from "@/providers/LocaleProvider";
import type { Translate } from "@finance/core/i18n/t";
import { resolveMessage } from "@finance/core/i18n/t";
import {
  getBudgets,
  getCategories,
  getMonthCloseOverview,
  getMonthlySummary,
  getRecurringTemplates,
  getSavingsGoals,
  getSavingsReserve,
  getTags,
  readCashBalance,
  type MonthCloseOverview,
} from "@/lib/queries";
import {
  deleteBudget,
  deleteSavingsGoal,
  upsertBudget,
  upsertSavingsGoal,
  upsertTag,
} from "@/lib/mutations";

/** Plain-language pacing line under a goal's progress bar — no jargon, just what to do. */
function pacingHint(
  pacing: GoalPacing,
  formatEuro: (amount: number) => string,
  t: Translate,
): { text: string; className: string } | null {
  switch (pacing.status) {
    case "reached":
      return { text: t("plan.goalReached"), className: "text-success" };
    case "overdue":
      return {
        text: t("plan.goalOverdue", {
          amount: formatEuro(pacing.monthlyAmount ?? 0),
        }),
        className: "text-destructive",
      };
    case "on-schedule":
      return {
        text: t("plan.goalOnSchedule", {
          amount: formatEuro(pacing.monthlyAmount ?? 0),
          month: pacing.targetLabel ?? "",
        }),
        className: "text-muted-foreground",
      };
    case "no-date":
      return null;
  }
}

export default function PlanningScreen() {
  const t = useT();
  const locale = useLocale();
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  // The third chart series, matching the web app's goal rings.
  const goalColor = useChartSeries()[2];
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<{
    kind: "budget" | "goal";
    id: string;
  } | null>(null);
  const current = getCurrentMonth();
  const [budgetAmount, setBudgetAmount] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [tagName, setTagName] = useState("");
  const [pending, setPending] = useState(false);
  /**
   * The month the sheet is working on, held rather than read live.
   *
   * Recording a close is the one write on this screen that changes the answer
   * to "what is there left to close" — usually to nothing, because the next
   * month's reading day has not arrived. Driving the mounted sheet off
   * `closes.next` would therefore tear it off the screen the instant the
   * refresh lands, taking the reveal and its undo with it, and the reveal is
   * the entire reason the sheet asks before it commits. Web does not have to
   * think about this: its page is server-rendered and its `closes.next` does
   * not move under the open sheet.
   */
  const [closing, setClosing] = useState<CloseableMonth | null>(null);

  const dataVersion = useDataVersion();
  const { data, loading, refreshing, onRefresh, onRefreshAll, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          budgets: [] as Budget[],
          goals: [] as SavingsGoal[],
          tags: [] as Tag[],
          categories: [] as Category[],
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
      ] = await Promise.all([
        getBudgets(user.id),
        getSavingsGoals(user.id),
        getTags(user.id),
        getCategories(user.id),
        getMonthlySummary(user.id, current.year, current.month),
        getRecurringTemplates(user.id),
        getSavingsReserve(user.id),
        getMonthCloseOverview(user.id, today),
        readCashBalance(user.id, today),
      ]);

      const categoryNames = new Map(
        categories.map((c) => [c.id, c.name] as const),
      );

      return {
        budgets,
        goals,
        tags,
        categories,
        budgetProgress: buildBudgetProgress(
          budgets,
          summary.expenseBreakdown,
          summary.expenses,
          categoryNames,
          locale,
        ),
        goalProgress: buildSavingsGoalProgress(
          goals,
          summary.savingsBreakdown,
          summary.savings,
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
    }, [user?.id, current.year, current.month, dataVersion]);

  async function handleAddBudget() {
    setPending(true);
    const result = await upsertBudget({
      amount: Number(budgetAmount),
      categoryId: null,
    });
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setBudgetAmount("");
    await onRefresh();
  }

  async function handleAddGoal() {
    setPending(true);
    const result = await upsertSavingsGoal({
      name: goalName,
      targetAmount: Number(goalTarget),
      targetDate: goalTargetDate.trim() || undefined,
      categoryId: null,
    });
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setGoalName("");
    setGoalTarget("");
    setGoalTargetDate("");
    await onRefresh();
  }

  async function handleAddTag() {
    setPending(true);
    const result = await upsertTag(tagName);
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setTagName("");
    await onRefresh();
  }

  async function handleConfirmDelete() {
    if (!confirming) {
      return;
    }
    const result =
      confirming.kind === "budget"
        ? await deleteBudget(confirming.id)
        : await deleteSavingsGoal(confirming.id);
    setConfirming(null);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    await onRefresh();
  }

  const closes = data?.closes ?? null;
  // The month the app is currently asking about, if any. Null once the latest
  // one is closed and the next one's reading day has not arrived.
  const next = closes?.next ?? null;
  const invitation =
    closes && next
      ? closeInvitation({
          isBaseline: next.isBaseline,
          unrecordedCap: closes.settings.unrecordedCap,
          baseline: closes.summary.baseline,
        })
      : null;

  function inviteDetail(): string | null {
    if (invitation === null) {
      return null;
    }
    switch (invitation.kind) {
      case "baseline":
        return t("monthClose.inviteBaseline");
      case "allowance":
        return t("monthClose.inviteAllowance", {
          cap: formatEuro(invitation.cap),
        });
      case "normal":
        return t("monthClose.normalMonth", {
          amount: formatEuro(invitation.baseline),
        });
      case "bare":
        return t("monthClose.inviteBare");
    }
  }

  return (
    <Screen title={t("nav.plan")}>
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
          <ProjectionCard
            projection={data?.projection ?? null}
            runway={data?.runway ?? null}
          />

          {/* The close itself, directly above the history it writes into.
              The phone lost this when the Month tab was deleted: the sheet
              below survived with no caller at all, so a phone-only reader
              could not close a month — and every rung of Bearing's ladder
              above the first is derived from closes. Bearing's own "ready to
              close" row sends people here, and `monthCloseHistory`'s empty
              state names this surface by the same `nav.plan` word. */}
          {next ? (
            <Card bezel innerClassName="gap-4 p-5">
              <View>
                <Text className="font-semibold" style={{ fontSize: 16 }}>
                  {next.isBaseline
                    ? t("monthClose.setStartingBalance")
                    : t("month.attentionReadyToClose", { month: next.label })}
                </Text>
                <Text variant="muted" className="mt-1 text-sm">
                  {inviteDetail()}
                </Text>
              </View>
              <Button
                label={t("monthClose.closeMonth", { month: next.label })}
                onPress={() => setClosing(next)}
              />
            </Card>
          ) : null}

          {closes ? (
            <MonthCloseHistoryCard
              history={closes.history}
              summary={closes.summary}
              unrecordedCap={closes.settings.unrecordedCap}
              closeDay={closes.settings.closeDay}
              onChanged={() => {
                notifyDataChanged();
                void onRefresh();
              }}
            />
          ) : null}

          <Card bezel innerClassName="gap-4 p-5">
            <Text className="text-sm font-medium">{t("plan.capsHeading")}</Text>

            {(data?.budgetProgress ?? []).length > 0 ? (
              <View className="flex-row flex-wrap items-start gap-2">
                {(data?.budgetProgress ?? []).map((row) => (
                  <Pressable
                    hitSlop={8}
                    key={row.budgetId}
                    accessibilityRole="button"
                    accessibilityLabel={t("plan.capOn", { label: row.label })}
                    accessibilityHint={t("plan.capRemoveHint")}
                    onLongPress={() =>
                      setConfirming({ kind: "budget", id: row.budgetId })
                    }
                    className="rounded-lg p-1"
                  >
                    <ProgressRing
                      ratio={row.ratio}
                      label={row.label}
                      detail={t("plan.amountOfTotal", {
                        amount: formatEuro(row.spent),
                        total: formatEuro(row.limit),
                      })}
                      over={row.over}
                      meaning="limit"
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text variant="muted" className="text-sm">
                {t("plan.capsBlurb")}
              </Text>
            )}

            <View className="gap-2 border-t border-border pt-4">
              <Text variant="label">{t("plan.globalMonthlyLimit")}</Text>
              <Input
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                keyboardType="decimal-pad"
              />
              <Button
                label={t("plan.addCapSubmit")}
                disabled={pending}
                onPress={handleAddBudget}
              />
            </View>
          </Card>

          <Card bezel innerClassName="gap-4 p-5">
            <Text className="text-sm font-medium">
              {t("plan.goalsHeading")}
            </Text>

            {(data?.goalProgress ?? []).length > 0 ? (
              <View className="flex-row flex-wrap items-start gap-2">
                {(data?.goalProgress ?? []).map((row) => {
                  const hint = pacingHint(
                    computeGoalPacing(row),
                    formatEuro,
                    t,
                  );
                  return (
                    <Pressable
                      hitSlop={8}
                      key={row.goal.id}
                      accessibilityRole="button"
                      accessibilityLabel={t("plan.goalNamed", {
                        name: row.goal.name,
                      })}
                      accessibilityHint={t("plan.goalRemoveHint")}
                      onLongPress={() =>
                        setConfirming({ kind: "goal", id: row.goal.id })
                      }
                      className="items-center gap-1 rounded-lg p-1"
                    >
                      <ProgressRing
                        ratio={row.ratio}
                        label={row.goal.name}
                        detail={t("plan.amountOfTotal", {
                          amount: formatEuro(row.saved),
                          total: formatEuro(Number(row.goal.target_amount)),
                        })}
                        // A goal is a target, not a limit: filling it is the
                        // point, and a full ring in red says the opposite.
                        meaning="target"
                        color={goalColor}
                      />
                      {hint ? (
                        <Text
                          numberOfLines={2}
                          className={`w-32 text-center text-xs ${hint.className}`}
                        >
                          {hint.text}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text variant="muted" className="text-sm">
                {t("plan.goalsBlurb")}
              </Text>
            )}

            <View className="gap-2 border-t border-border pt-4">
              <Text variant="label">{t("plan.goalName")}</Text>
              <Input value={goalName} onChangeText={setGoalName} />
              <Text variant="label">{t("plan.goalTarget")}</Text>
              <Input
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="decimal-pad"
              />
              <Text variant="label">{t("plan.goalTargetDateOptional")}</Text>
              <DateField
                value={goalTargetDate}
                onChange={setGoalTargetDate}
                placeholder={t("recurring.noEndDate")}
                clearable
              />
              <Button
                label={t("plan.addGoalSubmit")}
                disabled={pending}
                onPress={handleAddGoal}
              />
            </View>
          </Card>

          <Card bezel>
            <Text className="text-base font-semibold">
              {t("plan.tagsHeading")}
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {(data?.tags ?? []).map((t) => (
                <View
                  key={t.id}
                  className="rounded-full border border-border bg-muted px-3 py-1"
                >
                  <Text className="text-xs font-semibold">{t.name}</Text>
                </View>
              ))}
            </View>
            <Text variant="label" className="mb-2 mt-4">
              {t("plan.newTag")}
            </Text>
            <Input value={tagName} onChangeText={setTagName} className="mb-3" />
            <Button
              label={t("plan.addTag")}
              disabled={pending}
              onPress={handleAddTag}
            />
          </Card>
        </ScrollView>
      )}

      {closing ? (
        <MonthCloseSheet
          open
          onOpenChange={(value) => {
            if (!value) {
              setClosing(null);
            }
          }}
          year={closing.year}
          month={closing.month}
          monthLabel={closing.label}
          observeOn={closing.observeOn}
          isBaseline={closing.isBaseline}
          // Committed outgoings for the month in progress, which is what turns
          // a month's saving into days of runway. `buildRunway` derives it
          // from the templates alone, so the reserve this screen passes it
          // does not touch the figure.
          monthlyCommitted={data?.runway?.monthlyCommitted ?? 0}
          unrecordedCap={closes?.settings.unrecordedCap ?? null}
          baseline={closes?.summary.baseline ?? null}
          onClosed={() => {
            notifyDataChanged();
            void onRefresh();
          }}
        />
      ) : null}

      <ConfirmSheet
        open={confirming !== null}
        title={
          confirming?.kind === "goal"
            ? t("plan.deleteGoalTitle")
            : t("plan.deleteCapTitle")
        }
        message={t("plan.deleteWarning")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}
