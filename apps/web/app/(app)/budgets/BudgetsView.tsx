"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Input } from "@/components/retroui/Input";
import { Text } from "@/components/retroui/Text";
import { FormLabel } from "@/components/layout/FormLabel";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PLAN_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { useToast } from "@/components/layout/ToastProvider";
import {
  deleteBudget,
  deleteSavingsGoal,
  upsertBudget,
  upsertSavingsGoal,
  upsertTag,
} from "@/lib/actions/phase4";
import { progressTone } from "@/lib/progress-tone";
import { useFormatCurrency } from "@/lib/use-currency";
import type { GoalPacing } from "@finance/core/savings-goals";
import type {
  Budget,
  Category,
  SavingsGoal,
  Tag,
} from "@finance/core/types/database";
import { cn } from "@/lib/utils";

type BudgetProgress = {
  budgetId: string;
  label: string;
  limit: number;
  spent: number;
  remaining: number;
  ratio: number;
  over: boolean;
};

type GoalProgress = {
  goalId: string;
  name: string;
  target: number;
  saved: number;
  remaining: number;
  ratio: number;
  pacing: GoalPacing;
};

/** Plain-language pacing line under a goal's progress bar — no jargon, just what to do.
 * Module-level (not a hook), so it takes the caller's already-bound formatter. */
function pacingHint(
  pacing: GoalPacing,
  format: (amount: number) => string,
): { text: string; className: string } | null {
  switch (pacing.status) {
    case "reached":
      return { text: "Goal reached!", className: "text-success" };
    case "overdue":
      return {
        text: `Target date passed — ${format(pacing.monthlyAmount ?? 0)} still to save.`,
        className: "text-destructive",
      };
    case "on-schedule":
      return {
        text: `Save ${format(pacing.monthlyAmount ?? 0)}/month to reach this by ${pacing.targetLabel}.`,
        className: "text-muted-foreground",
      };
    case "no-date":
      return null;
  }
}

type Props = {
  budgets: Budget[];
  categories: Category[];
  tags: Tag[];
  goals: SavingsGoal[];
  budgetProgress: BudgetProgress[];
  goalProgress: GoalProgress[];
};

export function BudgetsView({
  budgets,
  categories,
  tags,
  goals,
  budgetProgress,
  goalProgress,
}: Props) {
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const [budgetState, budgetAction, budgetPending] = useActionState(
    upsertBudget,
    {},
  );
  const [goalState, goalAction, goalPending] = useActionState(
    upsertSavingsGoal,
    {},
  );
  const [tagState, tagAction, tagPending] = useActionState(upsertTag, {});
  const [pending, startTransition] = useTransition();
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const savingsCategories = categories.filter((c) => c.type === "savings");

  useEffect(() => {
    if (budgetState.success) {
      toast("Budget saved", "success");
      setEditingBudget(null);
    } else if (budgetState.error) {
      toast(budgetState.error, "error");
    }
  }, [budgetState, toast]);

  useEffect(() => {
    if (goalState.success) {
      toast("Goal saved", "success");
      setEditingGoal(null);
    } else if (goalState.error) {
      toast(goalState.error, "error");
    }
  }, [goalState, toast]);

  useEffect(() => {
    if (tagState.success) {
      toast("Tag added", "success");
    } else if (tagState.error) {
      toast(tagState.error, "error");
    }
  }, [tagState, toast]);

  return (
    <>
      <PageHeader title="Plan" />

      <PageContainer className="flex flex-col gap-6">
        <SurfaceTabs tabs={PLAN_TABS} className="mb-4" />
        <section className="space-y-3">
          <h2 className="font-head text-base">Monthly budgets</h2>
          {budgetProgress.map((row) => {
            const tone = progressTone(row.ratio, row.over);
            return (
              <Card.Bezel
                key={row.budgetId}
                className="w-full"
                innerClassName="p-4"
              >
                <div className="flex justify-between text-sm font-medium">
                  <span>{row.label}</span>
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      tone === "danger" && "text-destructive",
                    )}
                  >
                    {formatEuro(row.spent)} / {formatEuro(row.limit)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--hairline-strong)]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      tone === "danger" ? "bg-destructive" : "bg-primary",
                    )}
                    style={{
                      width: `${Math.min(100, row.ratio * 100)}%`,
                    }}
                  />
                </div>
              </Card.Bezel>
            );
          })}

          <Card className="w-full p-4">
            <form
              action={budgetAction}
              className="grid gap-3 sm:grid-cols-3"
              key={editingBudget?.id ?? "new-budget"}
            >
              {editingBudget && (
                <input type="hidden" name="id" value={editingBudget.id} />
              )}
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="budget-category">Scope</FormLabel>
                <select
                  id="budget-category"
                  name="categoryId"
                  defaultValue={editingBudget?.category_id ?? ""}
                  className={cn(
                    "h-11 w-full rounded border border-border",
                    "bg-background px-3 text-base",
                  )}
                >
                  <option value="">All expenses</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="budget-amount">Monthly limit</FormLabel>
                <Input
                  id="budget-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={
                    editingBudget
                      ? String(Number(editingBudget.amount))
                      : undefined
                  }
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={budgetPending}>
                  {editingBudget ? "Update" : "Add budget"}
                </Button>
                {editingBudget && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingBudget(null)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <ul className="space-y-2">
            {budgets.map((b) => {
              const cat = categories.find((c) => c.id === b.category_id);
              return (
                <li key={b.id}>
                  <Card className="flex w-full items-center justify-between p-3">
                    <span className="text-sm font-medium">
                      {cat?.name ?? "All expenses"} —{" "}
                      <span className="font-mono tabular-nums">
                        {formatEuro(Number(b.amount))}
                      </span>
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className={cn(
                          "flex h-11 w-11 items-center justify-center",
                          "rounded-full border border-border hover:bg-accent",
                        )}
                        aria-label="Edit budget"
                        onClick={() => setEditingBudget(b)}
                      >
                        <PencilSimple size={18} weight="light" />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "flex h-11 w-11 items-center justify-center",
                          "rounded-full border border-border",
                          "hover:bg-destructive hover:text-destructive-foreground",
                        )}
                        aria-label="Delete budget"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deleteBudget(b.id);
                            if (result.error) {
                              toast(result.error, "error");
                            } else {
                              toast("Budget deleted", "success");
                            }
                          })
                        }
                      >
                        <Trash size={18} weight="light" />
                      </button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-head text-base">Savings goals</h2>
          {goalProgress.map((row) => {
            const hint = pacingHint(row.pacing, formatEuro);
            return (
              <Card.Bezel
                key={row.goalId}
                className="w-full"
                innerClassName="p-4"
              >
                <div className="flex justify-between text-sm font-medium">
                  <span>{row.name}</span>
                  <span className="font-mono tabular-nums">
                    {formatEuro(row.saved)} / {formatEuro(row.target)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--hairline-strong)]">
                  <div
                    className="h-full rounded-full bg-[var(--chart-4)]"
                    style={{
                      width: `${Math.min(100, row.ratio * 100)}%`,
                    }}
                  />
                </div>
                {hint ? (
                  <p className={cn("mt-2 text-xs", hint.className)}>
                    {hint.text}
                  </p>
                ) : null}
              </Card.Bezel>
            );
          })}

          <Card className="w-full p-4">
            <form
              action={goalAction}
              className="grid gap-3 sm:grid-cols-2"
              key={editingGoal?.id ?? "new-goal"}
            >
              {editingGoal && (
                <input type="hidden" name="id" value={editingGoal.id} />
              )}
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="goal-name">Name</FormLabel>
                <Input
                  id="goal-name"
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={editingGoal?.name ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="goal-target">Target (€)</FormLabel>
                <Input
                  id="goal-target"
                  name="targetAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={
                    editingGoal
                      ? String(Number(editingGoal.target_amount))
                      : undefined
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="goal-date">Target date</FormLabel>
                <Input
                  id="goal-date"
                  name="targetDate"
                  type="date"
                  defaultValue={editingGoal?.target_date ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="goal-category">
                  Track category (optional)
                </FormLabel>
                <select
                  id="goal-category"
                  name="categoryId"
                  defaultValue={editingGoal?.category_id ?? ""}
                  className={cn(
                    "h-11 w-full rounded border border-border",
                    "bg-background px-3 text-base",
                  )}
                >
                  <option value="">All savings</option>
                  {savingsCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={goalPending}>
                  {editingGoal ? "Update goal" : "Add goal"}
                </Button>
                {editingGoal && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingGoal(null)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <ul className="space-y-2">
            {goals.map((g) => (
              <li key={g.id}>
                <Card className="flex w-full items-center justify-between p-3">
                  <span className="text-sm font-medium">
                    {g.name} —{" "}
                    <span className="font-mono tabular-nums">
                      {formatEuro(Number(g.target_amount))}
                    </span>
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className={cn(
                        "flex h-11 w-11 items-center justify-center",
                        "rounded-full border border-border hover:bg-accent",
                      )}
                      aria-label="Edit goal"
                      onClick={() => setEditingGoal(g)}
                    >
                      <PencilSimple size={18} weight="light" />
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "flex h-11 w-11 items-center justify-center",
                        "rounded-full border border-border",
                        "hover:bg-destructive hover:text-destructive-foreground",
                      )}
                      aria-label="Delete goal"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteSavingsGoal(g.id);
                          if (result.error) {
                            toast(result.error, "error");
                          } else {
                            toast("Goal deleted", "success");
                          }
                        })
                      }
                    >
                      <Trash size={18} weight="light" />
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-head text-base">Tags</h2>
          <Card className="w-full p-4">
            <form action={tagAction} className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-48 flex-1 flex-col gap-2">
                <FormLabel htmlFor="tag-name">New tag</FormLabel>
                <Input id="tag-name" name="name" required maxLength={40} />
              </div>
              <Button type="submit" disabled={tagPending}>
                Add tag
              </Button>
            </form>
          </Card>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t.id}
                className={cn(
                  "rounded-full border border-border bg-muted",
                  "px-3 py-1 text-xs font-semibold",
                )}
              >
                {t.name}
              </span>
            ))}
            {tags.length === 0 && (
              <Text className="text-sm text-muted-foreground">
                No tags yet. Create tags here, then attach them when editing a
                transaction.
              </Text>
            )}
          </div>
        </section>
      </PageContainer>
    </>
  );
}
