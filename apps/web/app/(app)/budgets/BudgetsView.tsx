"use client";

import { useActionState, useState, useTransition } from "react";
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
import { todayIsoLocal } from "@finance/core/constants";
import type { GoalPacing } from "@finance/core/savings-goals";
import type {
  Budget,
  Category,
  SavingsGoal,
  Tag,
} from "@finance/core/types/database";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import type { Translate } from "@finance/core/i18n/t";

type PlanActionResult = { error?: string; success?: boolean };

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
          amount: format(pacing.monthlyAmount ?? 0),
        }),
        className: "text-destructive",
        // The two pacing lines that name what to put by each month are
        // figures of the user's own inside a sentence, so they go under the
        // blur; "You have reached it" names none and stays legible.
        money: true,
      };
    case "on-schedule":
      return {
        text: t("plan.goalOnSchedule", {
          amount: format(pacing.monthlyAmount ?? 0),
          month: pacing.targetLabel ?? "",
        }),
        className: "text-muted-foreground",
        money: true,
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
  const t = useT();
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  // The forms used to sit open under a duplicate list of everything they
  // could edit. A cap now appears once, as its own ring, and tapping it is
  // how you edit it — so the form is only on screen when there is something
  // to fill in.
  const [budgetFormOpen, setBudgetFormOpen] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  // Each action says what happened itself, once, when it returns. The three
  // effects that used to watch the returned state set state inside an
  // effect, which re-rendered the page a second time for every save.
  const [, budgetAction, budgetPending] = useActionState(
    async (previous: PlanActionResult, formData: FormData) => {
      const result = await upsertBudget(previous, formData);
      if (result.success) {
        toast(t("plan.capSaved"), "success");
        setEditingBudget(null);
        setBudgetFormOpen(false);
      } else if (result.error) {
        toast(result.error, "error");
      }
      return result;
    },
    {},
  );
  const [, goalAction, goalPending] = useActionState(
    async (previous: PlanActionResult, formData: FormData) => {
      const result = await upsertSavingsGoal(previous, formData);
      if (result.success) {
        toast(t("plan.goalSaved"), "success");
        setEditingGoal(null);
        setGoalFormOpen(false);
      } else if (result.error) {
        toast(result.error, "error");
      }
      return result;
    },
    {},
  );
  const [, tagAction, tagPending] = useActionState(
    async (previous: PlanActionResult, formData: FormData) => {
      const result = await upsertTag(previous, formData);
      if (result.success) {
        toast(t("plan.tagAdded"), "success");
      } else if (result.error) {
        toast(result.error, "error");
      }
      return result;
    },
    {},
  );
  const [pending, startTransition] = useTransition();

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const savingsCategories = categories.filter((c) => c.type === "savings");

  return (
    <>
      <PageHeader titleKey="nav.plan" />

      <PageContainer className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-card p-card border border-border bg-card">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">{t("plan.capsHeading")}</h2>
            <Button
              variant="link"
              size="sm"
              className="h-8 px-1"
              onClick={() => {
                setEditingBudget(null);
                setBudgetFormOpen((open) => !(open && !editingBudget));
              }}
            >
              {budgetFormOpen && !editingBudget
                ? t("plan.cancel")
                : t("plan.addCap")}
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
                    aria-label={t("plan.editCapOn", { label: row.label })}
                    className={cn(
                      "rounded-control p-2 transition-colors hover:bg-muted/40",
                      editingBudget?.id === row.budgetId && "bg-muted/60",
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
                      colorVar="--chart-1"
                      size={84}
                    />
                  </button>
                );
              })}
            </div>
          ) : budgetFormOpen ? null : (
            <p className="text-sm text-muted-foreground">
              {t("plan.capsBlurb")}
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
                <FormLabel htmlFor="budget-category">
                  {t("plan.capScope")}
                </FormLabel>
                <select
                  id="budget-category"
                  name="categoryId"
                  defaultValue={editingBudget?.category_id ?? ""}
                  className={cn(
                    "h-11 w-full rounded-control border border-border",
                    "bg-background px-3 text-base",
                  )}
                >
                  <option value="">{t("allocation.allExpenses")}</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="budget-amount">
                  {t("plan.monthlyLimit")}
                </FormLabel>
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
                  {editingBudget ? t("plan.update") : t("plan.addCapSubmit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingBudget(null);
                    setBudgetFormOpen(false);
                  }}
                >
                  {t("plan.cancel")}
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
                        toast(t("plan.capRemoved"), "success");
                        setEditingBudget(null);
                        setBudgetFormOpen(false);
                      })
                    }
                  >
                    <Trash size={ICON.md} weight="light" className="mr-1.5" />
                    {t("common.remove")}
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}
        </section>

        <section className="flex flex-col gap-4 rounded-card p-card border border-border bg-card">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">{t("plan.goalsHeading")}</h2>
            <Button
              variant="link"
              size="sm"
              className="h-8 px-1"
              onClick={() => {
                setEditingGoal(null);
                setGoalFormOpen((open) => !(open && !editingGoal));
              }}
            >
              {goalFormOpen && !editingGoal
                ? t("plan.cancel")
                : t("plan.addGoal")}
            </Button>
          </div>

          {goalProgress.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {goalProgress.map((row) => {
                const goal = goals.find((g) => g.id === row.goalId);
                const hint = pacingHint(row.pacing, formatEuro, t);
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
                    aria-label={t("plan.editGoalNamed", { name: row.name })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-control p-2",
                      "transition-colors hover:bg-muted/40",
                      editingGoal?.id === row.goalId && "bg-muted/60",
                    )}
                  >
                    <ProgressRing
                      ratio={row.ratio}
                      label={row.name}
                      detail={t("plan.amountOfTotal", {
                        amount: formatEuro(row.saved),
                        total: formatEuro(row.target),
                      })}
                      money
                      meaning="target"
                      colorVar="--chart-3"
                      size={84}
                    />
                    {hint ? (
                      <span
                        className={cn(
                          "max-w-36 text-balance text-center text-xs",
                          hint.className,
                          hint.money && "privacy-sensitive",
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
              {t("plan.goalsBlurb")}
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
                <FormLabel htmlFor="goal-name">{t("plan.goalName")}</FormLabel>
                <Input
                  id="goal-name"
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={editingGoal?.name ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="goal-target">
                  {t("plan.goalTarget")}
                </FormLabel>
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
                <FormLabel htmlFor="goal-date">
                  {t("plan.goalTargetDate")}
                </FormLabel>
                <Input
                  id="goal-date"
                  name="targetDate"
                  type="date"
                  defaultValue={editingGoal?.target_date ?? ""}
                />
              </div>
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="goal-starts">
                  {t("plan.goalStartsOn")}
                </FormLabel>
                <Input
                  id="goal-starts"
                  name="startsOn"
                  type="date"
                  aria-describedby="goal-starts-hint"
                  defaultValue={editingGoal?.starts_on ?? todayIsoLocal()}
                />
                <p
                  id="goal-starts-hint"
                  className="text-xs text-muted-foreground"
                >
                  {t("plan.goalStartsOnHint")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="goal-category">
                  {t("plan.trackCategoryOptional")}
                </FormLabel>
                <select
                  id="goal-category"
                  name="categoryId"
                  defaultValue={editingGoal?.category_id ?? ""}
                  className={cn(
                    "h-11 w-full rounded-control border border-border",
                    "bg-background px-3 text-base",
                  )}
                >
                  <option value="">{t("plan.allSavings")}</option>
                  {savingsCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={goalPending}>
                  {editingGoal ? t("plan.updateGoal") : t("plan.addGoalSubmit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingGoal(null);
                    setGoalFormOpen(false);
                  }}
                >
                  {t("plan.cancel")}
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
                        toast(t("plan.goalRemoved"), "success");
                        setEditingGoal(null);
                        setGoalFormOpen(false);
                      })
                    }
                  >
                    <Trash size={ICON.md} weight="light" className="mr-1.5" />
                    {t("common.remove")}
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}
        </section>

        <section className="flex flex-col gap-3 rounded-card p-card border border-border bg-card">
          <h2 className="text-sm font-medium">{t("plan.tagsHeading")}</h2>
          <p className="text-sm text-muted-foreground">{t("plan.tagsBlurb")}</p>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className={cn(
                    "rounded-full border border-border bg-muted",
                    "px-3 py-1 text-xs font-medium",
                  )}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
          <form action={tagAction} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <FormLabel htmlFor="tag-name">{t("plan.newTag")}</FormLabel>
              <Input id="tag-name" name="name" required maxLength={40} />
            </div>
            <Button type="submit" variant="outline" disabled={tagPending}>
              {t("plan.addTag")}
            </Button>
          </form>
        </section>

        {/* Wrapped rather than dropped in bare: see PageContainer. */}
        {footer ? <div className="contents">{footer}</div> : null}
      </PageContainer>
    </>
  );
}
