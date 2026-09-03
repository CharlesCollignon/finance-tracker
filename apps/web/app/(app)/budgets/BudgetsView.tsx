"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Trash } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressRing } from "@/components/finance/charts";
import { useToast } from "@/components/layout/ToastProvider";
import {
  deleteBudget,
  deleteSavingsGoal,
  upsertBudget,
  upsertSavingsGoal,
  upsertTag,
} from "@/lib/actions/phase4";
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
  /** Projection, links and close history — same column, one container. */
  footer?: ReactNode;
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
  footer,
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
  // The forms used to sit open under a duplicate list of everything they
  // could edit. A cap now appears once, as its own ring, and tapping it is
  // how you edit it — so the form is only on screen when there is something
  // to fill in.
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const savingsCategories = categories.filter((c) => c.type === "savings");

  useEffect(() => {
    if (budgetState.success) {
      toast("Cap saved", "success");
      setEditingBudget(null);
      setBudgetFormOpen(false);
    } else if (budgetState.error) {
      toast(budgetState.error, "error");
    }
  }, [budgetState, toast]);

  useEffect(() => {
    if (goalState.success) {
      toast("Goal saved", "success");
      setEditingGoal(null);
      setGoalFormOpen(false);
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

      <PageContainer className="flex flex-col gap-4">

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">Spending caps</h2>
            <Button
              variant="link"
              size="sm"
              className="h-8 px-1"
              onClick={() => {
                setEditingBudget(null);
                setBudgetFormOpen((open) => !(open && !editingBudget));
              }}
            >
              {budgetFormOpen && !editingBudget ? "Cancel" : "Add a cap"}
            </Button>
          </div>

          {budgetProgress.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {budgetProgress.map((row) => {
                const budget = budgets.find((b) => b.id === row.budgetId);
                return (
                  <button
                    key={row.budgetId}
                    type="button"
                    onClick={() => {
                      if (!budget) {
                        return;
                      }
                      setEditingBudget(budget);
                      setBudgetFormOpen(true);
                    }}
                    aria-label={`Edit the cap on ${row.label}`}
                    className={cn(
                      "rounded-lg p-2 transition-colors hover:bg-muted/40",
                      editingBudget?.id === row.budgetId && "bg-muted/60",
                    )}
                  >
                    <ProgressRing
                      ratio={row.ratio}
                      label={row.label}
                      detail={`${formatEuro(row.spent)} of ${formatEuro(row.limit)}`}
                      over={row.over}
                      meaning="limit"
                      colorVar="--chart-1"
                      size={84}
                    />
                  </button>
                );
              })}
            </div>
          ) : budgetFormOpen ? null : (
            <p className="text-sm text-muted-foreground">
              A cap is a monthly ceiling — on one category, or on everything.
              Month shows how close you are to each.
            </p>
          )}

          {budgetFormOpen ? (
            <form
              action={budgetAction}
              className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3"
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
              <div className="flex flex-wrap items-end gap-2">
                <Button type="submit" disabled={budgetPending}>
                  {editingBudget ? "Update" : "Add cap"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingBudget(null);
                    setBudgetFormOpen(false);
                  }}
                >
                  Cancel
                </Button>
                {editingBudget ? (
                  <Button
                    type="button"
                    variant="link"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteBudget(editingBudget.id);
                        if (result.error) {
                          toast(result.error, "error");
                          return;
                        }
                        toast("Cap removed", "success");
                        setEditingBudget(null);
                        setBudgetFormOpen(false);
                      })
                    }
                  >
                    <Trash size={16} weight="light" className="mr-1.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">Savings goals</h2>
            <Button
              variant="link"
              size="sm"
              className="h-8 px-1"
              onClick={() => {
                setEditingGoal(null);
                setGoalFormOpen((open) => !(open && !editingGoal));
              }}
            >
              {goalFormOpen && !editingGoal ? "Cancel" : "Add a goal"}
            </Button>
          </div>

          {goalProgress.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {goalProgress.map((row) => {
                const goal = goals.find((g) => g.id === row.goalId);
                const hint = pacingHint(row.pacing, formatEuro);
                return (
                  <button
                    key={row.goalId}
                    type="button"
                    onClick={() => {
                      if (!goal) {
                        return;
                      }
                      setEditingGoal(goal);
                      setGoalFormOpen(true);
                    }}
                    aria-label={`Edit the goal ${row.name}`}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg p-2",
                      "transition-colors hover:bg-muted/40",
                      editingGoal?.id === row.goalId && "bg-muted/60",
                    )}
                  >
                    <ProgressRing
                      ratio={row.ratio}
                      label={row.name}
                      detail={`${formatEuro(row.saved)} of ${formatEuro(row.target)}`}
                      meaning="target"
                      colorVar="--chart-3"
                      size={84}
                    />
                    {hint ? (
                      <span
                        className={cn(
                          "max-w-36 text-balance text-center text-xs",
                          hint.className,
                        )}
                      >
                        {hint.text}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : goalFormOpen ? null : (
            <p className="text-sm text-muted-foreground">
              A goal is an amount to reach — a deposit, a trip, a buffer. Set
              aside money in a savings category and it fills.
            </p>
          )}

          {goalFormOpen ? (
            <form
              action={goalAction}
              className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
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
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={goalPending}>
                  {editingGoal ? "Update goal" : "Add goal"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingGoal(null);
                    setGoalFormOpen(false);
                  }}
                >
                  Cancel
                </Button>
                {editingGoal ? (
                  <Button
                    type="button"
                    variant="link"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteSavingsGoal(editingGoal.id);
                        if (result.error) {
                          toast(result.error, "error");
                          return;
                        }
                        toast("Goal removed", "success");
                        setEditingGoal(null);
                        setGoalFormOpen(false);
                      })
                    }
                  >
                    <Trash size={16} weight="light" className="mr-1.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:p-5">
          <h2 className="text-sm font-medium">Tags</h2>
          <p className="text-sm text-muted-foreground">
            A second way to group an entry, cutting across categories — a
            holiday, a flatmate, a side project.
          </p>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className={cn(
                    "rounded-full border border-border bg-muted",
                    "px-3 py-1 text-xs font-medium",
                  )}
                >
                  {t.name}
                </span>
              ))}
            </div>
          ) : null}
          <form action={tagAction} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <FormLabel htmlFor="tag-name">New tag</FormLabel>
              <Input id="tag-name" name="name" required maxLength={40} />
            </div>
            <Button type="submit" variant="outline" disabled={tagPending}>
              Add tag
            </Button>
          </form>
        </section>

        {footer}
      </PageContainer>
    </>
  );
}
