import { useState } from "react";
import { Pressable, View } from "react-native";

import { parseTypedAmount } from "@finance/core/amount-input";
import type { Budget, Category } from "@finance/core/types/database";

import { ProgressRing } from "@/components/charts";
import { PlanCard, PlanCardHeader } from "@/components/plan/PlanCard";
import { Button } from "@/components/ui/Button";
import { ChipRow } from "@/components/ui/ChipRow";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { deleteBudget, upsertBudget } from "@/lib/mutations";
import { toTypedAmount } from "@/lib/typed-amount";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

export interface BudgetProgressRow {
  budgetId: string;
  label: string;
  limit: number;
  spent: number;
  ratio: number;
  over: boolean;
}

/** "All spending" in the scope row: a budget with no category. */
const ALL = "all";

/**
 * The month's budgets, as the web's Plan card draws them.
 *
 * A budget appears once, as its own ring, and tapping the ring is how it is
 * edited. The form is on screen only when there is something to fill in: it
 * used to sit open under the rings at all times, and could only add a single
 * budget over all spending — the per-category ones the web sets were not
 * reachable from the phone at all.
 */
export function BudgetsCard({
  budgets,
  progress,
  categories,
  onChanged,
}: {
  budgets: Budget[];
  progress: BudgetProgressRow[];
  /** Expense categories, the only kind a budget can be set on. */
  categories: Category[];
  onChanged: () => void;
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);

  function openNew() {
    void hapticLight();
    setEditing(null);
    setFormOpen((open) => !(open && editing === null));
  }

  function openEdit(budgetId: string) {
    const budget = budgets.find((row) => row.id === budgetId);
    if (!budget) {
      return;
    }
    void hapticLight();
    setEditing(budget);
    setFormOpen(true);
  }

  function close() {
    setEditing(null);
    setFormOpen(false);
  }

  return (
    <PlanCard>
      <PlanCardHeader
        title={t("plan.capsHeading")}
        action={
          formOpen && editing === null ? t("plan.cancel") : t("plan.addCap")
        }
        onAction={openNew}
      />

      {progress.length > 0 ? (
        <View className="flex-row flex-wrap">
          {progress.map((row) => (
            <Pressable
              key={row.budgetId}
              accessibilityRole="button"
              accessibilityLabel={t("plan.editCapOn", { label: row.label })}
              accessibilityState={{ selected: editing?.id === row.budgetId }}
              onPress={() => openEdit(row.budgetId)}
              className={cn(
                "w-1/2 items-center rounded-control py-2",
                editing?.id === row.budgetId && "bg-muted/60",
              )}
            >
              <ProgressRing
                ratio={row.ratio}
                label={row.label}
                detail={t("plan.amountOfTotal", {
                  amount: formatEuro(row.spent),
                  total: formatEuro(row.limit),
                })}
                money
                over={row.over}
                meaning="limit"
                size={84}
              />
            </Pressable>
          ))}
        </View>
      ) : formOpen ? null : (
        <Text variant="muted" className="text-sm">
          {t("plan.capsBlurb")}
        </Text>
      )}

      {formOpen ? (
        <BudgetForm
          // A fresh form for each budget, so its fields start from that one.
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

function BudgetForm({
  editing,
  categories,
  onDone,
  onChanged,
}: {
  editing: Budget | null;
  categories: Category[];
  onDone: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [scope, setScope] = useState<string>(editing?.category_id ?? ALL);
  const [amount, setAmount] = useState(
    editing ? toTypedAmount(Number(editing.amount), locale) : "",
  );
  const [pending, setPending] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const parsed = parseTypedAmount(amount);
  const scopeOptions = [
    { value: ALL, label: t("allocation.allExpenses") },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  async function save() {
    if (parsed === null) {
      return;
    }
    setPending(true);
    const result = await upsertBudget({
      id: editing?.id,
      categoryId: scope === ALL ? null : scope,
      amount: parsed,
    });
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    void hapticSuccess();
    toast(t("plan.capSaved"), "success");
    onDone();
    onChanged();
  }

  async function remove() {
    if (!editing) {
      return;
    }
    setPending(true);
    const result = await deleteBudget(editing.id);
    setPending(false);
    setConfirmingRemove(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(t("plan.capRemoved"), "success");
    onDone();
    onChanged();
  }

  return (
    <View className="gap-3 border-t border-border pt-4">
      <View className="gap-2">
        <Text variant="label">{t("plan.capScope")}</Text>
        <ChipRow
          label={t("plan.capScope")}
          options={scopeOptions}
          value={scope}
          onChange={setScope}
        />
      </View>

      <View className="gap-2">
        <Text variant="label">{t("plan.monthlyLimit")}</Text>
        <Input
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          accessibilityLabel={t("plan.monthlyLimit")}
          invalid={amount.trim() !== "" && parsed === null}
        />
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          label={editing ? t("plan.update") : t("plan.addCapSubmit")}
          size="sm"
          disabled={pending || parsed === null || parsed <= 0}
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
        title={t("plan.deleteCapTitle")}
        message={t("plan.deleteWarning")}
        confirmLabel={t("common.remove")}
        pending={pending}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmingRemove(false)}
      />
    </View>
  );
}
