import { useState } from "react";
import { Pressable, View } from "react-native";

import { parseTypedAmount } from "@finance/core/amount-input";
import { todayIsoLocal } from "@finance/core/constants";
import type { Translate } from "@finance/core/i18n/t";
import {
  computeGoalPacing,
  type GoalPacing,
  type SavingsGoalProgress,
} from "@finance/core/savings-goals";
import type { Category, SavingsGoal } from "@finance/core/types/database";

import { ProgressRing } from "@/components/charts";
import { PlanCard, PlanCardHeader } from "@/components/plan/PlanCard";
import { Button } from "@/components/ui/Button";
import { ChipRow } from "@/components/ui/ChipRow";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { deleteSavingsGoal, upsertSavingsGoal } from "@/lib/mutations";
import { toTypedAmount } from "@/lib/typed-amount";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { useToast } from "@/providers/ToastProvider";
import { CHART_COLORS } from "@/theme/tokens";

/** "All savings" in the category row: a goal fed by every savings category. */
const ALL = "all";

/** Plain-language pacing line under a goal's ring — no jargon, just what to do. */
function pacingHint(
  pacing: GoalPacing,
  formatEuro: (amount: number) => string,
  t: Translate,
): { text: string; className: string; money: boolean } | null {
  switch (pacing.status) {
    case "reached":
      return {
        text: t("plan.goalReached"),
        className: "text-success",
        money: false,
      };
    case "overdue":
      return {
        text: t("plan.goalOverdue", {
          amount: formatEuro(pacing.monthlyAmount ?? 0),
        }),
        className: "text-destructive",
        money: true,
      };
    case "on-schedule":
      return {
        text: t("plan.goalOnSchedule", {
          amount: formatEuro(pacing.monthlyAmount ?? 0),
          month: pacing.targetLabel ?? "",
        }),
        className: "text-muted-foreground",
        money: true,
      };
    case "no-date":
      return null;
  }
}

/**
 * Savings goals, as the web's Plan card draws them: one ring each, filled by
 * the web's `--chart-3`, and tapping one edits it. Goals could only be added
 * on the phone before, through a form that never closed, and could not be
 * changed at all once made.
 */
export function GoalsCard({
  goals,
  progress,
  categories,
  onChanged,
}: {
  goals: SavingsGoal[];
  progress: SavingsGoalProgress[];
  /** Savings categories, the ones a goal can follow. */
  categories: Category[];
  onChanged: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const { hidden } = usePrivacy();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);

  function openNew() {
    void hapticLight();
    setEditing(null);
    setFormOpen((open) => !(open && editing === null));
  }

  function openEdit(goalId: string) {
    const goal = goals.find((row) => row.id === goalId);
    if (!goal) {
      return;
    }
    void hapticLight();
    setEditing(goal);
    setFormOpen(true);
  }

  function close() {
    setEditing(null);
    setFormOpen(false);
  }

  return (
    <PlanCard>
      <PlanCardHeader
        title={t("plan.goalsHeading")}
        action={
          formOpen && editing === null ? t("plan.cancel") : t("plan.addGoal")
        }
        onAction={openNew}
      />

      {progress.length > 0 ? (
        <View className="flex-row flex-wrap">
          {progress.map((row) => {
            const hint = pacingHint(
              computeGoalPacing(row, locale),
              formatEuro,
              t,
            );
            const selected = editing?.id === row.goal.id;
            return (
              <Pressable
                key={row.goal.id}
                accessibilityRole="button"
                accessibilityLabel={t("plan.editGoalNamed", {
                  name: row.goal.name,
                })}
                accessibilityState={{ selected }}
                onPress={() => openEdit(row.goal.id)}
                className={cn(
                  "w-1/2 items-center gap-1 rounded-control py-2",
                  selected && "bg-muted/60",
                )}
              >
                <ProgressRing
                  ratio={row.ratio}
                  label={row.goal.name}
                  detail={t("plan.amountOfTotal", {
                    amount: formatEuro(row.saved),
                    total: formatEuro(Number(row.goal.target_amount)),
                  })}
                  money
                  // A goal is a target, not a limit: filling it is the point,
                  // and a full ring in red says the opposite.
                  meaning="target"
                  color={CHART_COLORS[2]}
                  size={84}
                />
                {hint ? (
                  <Text
                    numberOfLines={2}
                    className={cn("w-36 text-center text-xs", hint.className)}
                  >
                    {/* The two lines that name a monthly amount are the user's
                        own figure inside a sentence, so they go under the
                        mask; "Objectif atteint !" names none. */}
                    {hidden && hint.money ? "••••••" : hint.text}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : formOpen ? null : (
        <Text variant="muted" className="text-sm">
          {t("plan.goalsBlurb")}
        </Text>
      )}

      {formOpen ? (
        <GoalForm
          key={editing?.id ?? "new"}
          editing={editing}
          categories={categories}
          onDone={close}
          onChanged={onChanged}
        />
      ) : null}
    </PlanCard>
  );
}

function GoalForm({
  editing,
  categories,
  onDone,
  onChanged,
}: {
  editing: SavingsGoal | null;
  categories: Category[];
  onDone: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [target, setTarget] = useState(
    editing ? toTypedAmount(Number(editing.target_amount), locale) : "",
  );
  const [targetDate, setTargetDate] = useState(editing?.target_date ?? "");
  const [startsOn, setStartsOn] = useState(
    editing?.starts_on ?? todayIsoLocal(),
  );
  const [category, setCategory] = useState<string>(editing?.category_id ?? ALL);
  const [pending, setPending] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const parsedTarget = parseTypedAmount(target);
  const canSave =
    name.trim() !== "" && parsedTarget !== null && parsedTarget > 0;
  const categoryOptions = [
    { value: ALL, label: t("plan.allSavings") },
    ...categories.map((row) => ({ value: row.id, label: row.name })),
  ];

  async function save() {
    if (!canSave || parsedTarget === null) {
      return;
    }
    setPending(true);
    const result = await upsertSavingsGoal({
      id: editing?.id,
      name: name.trim(),
      targetAmount: parsedTarget,
      targetDate: targetDate.trim() || undefined,
      startsOn,
      categoryId: category === ALL ? null : category,
    });
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    void hapticSuccess();
    toast(t("plan.goalSaved"), "success");
    onDone();
    onChanged();
  }

  async function remove() {
    if (!editing) {
      return;
    }
    setPending(true);
    const result = await deleteSavingsGoal(editing.id);
    setPending(false);
    setConfirmingRemove(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(t("plan.goalRemoved"), "success");
    onDone();
    onChanged();
  }

  return (
    <View className="gap-3 border-t border-border pt-4">
      <View className="gap-2">
        <Text variant="label">{t("plan.goalName")}</Text>
        <Input
          value={name}
          onChangeText={setName}
          maxLength={100}
          accessibilityLabel={t("plan.goalName")}
        />
      </View>

      <View className="gap-2">
        <Text variant="label">{t("plan.goalTarget")}</Text>
        <Input
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          accessibilityLabel={t("plan.goalTarget")}
          invalid={target.trim() !== "" && parsedTarget === null}
        />
      </View>

      <View className="gap-2">
        <Text variant="label">{t("plan.goalTargetDateOptional")}</Text>
        <DateField
          value={targetDate}
          onChange={setTargetDate}
          placeholder={t("planScreen.noTargetDate")}
          accessibilityLabel={t("plan.goalTargetDateOptional")}
          clearable
        />
      </View>

      <View className="gap-2">
        <Text variant="label">{t("plan.goalStartsOn")}</Text>
        <DateField
          value={startsOn}
          onChange={setStartsOn}
          accessibilityLabel={t("plan.goalStartsOn")}
        />
        <Text variant="muted" className="text-xs">
          {t("plan.goalStartsOnHint")}
        </Text>
      </View>

      {categories.length > 0 ? (
        <View className="gap-2">
          <Text variant="label">{t("plan.trackCategoryOptional")}</Text>
          <ChipRow
            label={t("plan.trackCategoryOptional")}
            options={categoryOptions}
            value={category}
            onChange={setCategory}
          />
        </View>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          label={editing ? t("plan.updateGoal") : t("plan.addGoalSubmit")}
          size="sm"
          disabled={pending || !canSave}
          onPress={() => void save()}
        />
        <Button
          label={t("plan.cancel")}
          variant="outline"
          size="sm"
          disabled={pending}
          onPress={onDone}
        />
        {editing ? (
          <Button
            label={t("common.remove")}
            variant="ghost"
            size="sm"
            disabled={pending}
            onPress={() => setConfirmingRemove(true)}
          />
        ) : null}
      </View>

      <ConfirmSheet
        open={confirmingRemove}
        title={t("plan.deleteGoalTitle")}
        message={t("plan.deleteWarning")}
        confirmLabel={t("common.remove")}
        pending={pending}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmingRemove(false)}
      />
    </View>
  );
}
