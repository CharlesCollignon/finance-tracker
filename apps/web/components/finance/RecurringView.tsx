"use client";

import { useState, useTransition } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { RecurringForm } from "@/components/finance/RecurringForm";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { formatEuro } from "@finance/core/constants";
import { isCryptoCategoryName } from "@finance/core/crypto-holdings";
import {
  estimateMonthlyAmount,
  formatRecurrenceSchedule,
} from "@finance/core/recurrence";
import { formatSharesLabel } from "@finance/core/recurring-shares";
import { cn } from "@/lib/utils";
import { toggleRecurringActive } from "@/lib/actions/finance";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

const GROUP_LABELS: Record<Exclude<CategoryType, "income">, string> = {
  expense: "Expenses",
  savings: "Savings",
  investment: "Investments",
};

interface RecurringViewProps {
  templates: RecurringTemplateWithCategory[];
  categories: Category[];
}

export function RecurringView({ templates, categories }: RecurringViewProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] =
    useState<RecurringTemplateWithCategory | null>(null);
  const [, startTransition] = useTransition();

  const groups = (
    ["expense", "savings", "investment"] as const
  ).map((type) => ({
    type,
    label: GROUP_LABELS[type],
    items: templates.filter((t) => t.categories.type === type),
  }));

  const budgetMonthly = templates
    .filter((t) => t.active && t.categories.counts_toward_summary !== false)
    .reduce((sum, t) => sum + estimateMonthlyAmount(t), 0);

  const deploymentMonthly = templates
    .filter((t) => t.active && t.categories.counts_toward_summary === false)
    .reduce((sum, t) => sum + estimateMonthlyAmount(t), 0);

  const hasTemplates = templates.length > 0;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(template: RecurringTemplateWithCategory) {
    setEditing(template);
    setFormOpen(true);
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      await toggleRecurringActive(id, !active);
    });
  }

  return (
    <>
      <PageHeader title="Recurring">
        <div className="md:hidden">
          <SignOutButton />
        </div>
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        {hasTemplates && (
          <>
            <Card className="flex w-full flex-col gap-3 p-4 md:p-5">
              <div className="flex items-center justify-between">
                <span className="font-head md:text-lg">
                  Expected budget impact
                </span>
                <span className="tabular-nums text-lg font-semibold md:text-xl">
                  {formatEuro(budgetMonthly)}
                </span>
              </div>
              {deploymentMonthly > 0 && (
                <div className="flex items-center justify-between border-t-2 border-border pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Broker deployment (tracking)
                  </span>
                  <span className="tabular-nums font-semibold">
                    {formatEuro(deploymentMonthly)}
                  </span>
                </div>
              )}
            </Card>

            <div className="md:flex md:justify-end">
              <Button
                size="lg"
                className="w-full md:w-auto md:min-w-[14rem]"
                onClick={openCreate}
              >
                Add recurring item
              </Button>
            </div>
          </>
        )}

        {!hasTemplates ? (
          <EmptyState
            title="No recurring items"
            description="Set up your salary, rent, DCA contributions, and other monthly flows."
          >
            <Button size="lg" onClick={openCreate}>
              Add recurring item
            </Button>
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map(({ type, label, items }) => (
              <section
                key={type}
                className="flex flex-col gap-2 rounded border-2 border-border bg-card p-4"
              >
                <h2 className="font-head text-sm uppercase tracking-wide">
                  {label}
                </h2>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No {label.toLowerCase()} yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {items.map((template) => (
                      <li key={template.id}>
                        <Card
                          className={cn(
                            "flex w-full flex-col gap-2 p-3",
                            "transition-colors hover:bg-accent/30",
                            "sm:gap-2.5 sm:p-4",
                            !template.active && "opacity-70",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => openEdit(template)}
                            className="flex w-full gap-3 text-left"
                          >
                            <CategoryIcon icon={template.categories.icon} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug break-words">
                                {template.categories.name}
                              </p>
                              {template.pricing_type === "shares" &&
                                formatSharesLabel(template) && (
                                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground break-words">
                                    {formatSharesLabel(template)}
                                    {template.instrument_symbol
                                      ? ` · ${template.instrument_symbol}`
                                      : ""}
                                  </p>
                                )}
                              {isCryptoCategoryName(template.categories.name) && (
                                <p className="mt-0.5 text-xs leading-snug text-muted-foreground break-words">
                                  Fixed EUR → Bitcoin
                                </p>
                              )}
                              {template.description && (
                                <p className="mt-0.5 text-xs leading-snug text-muted-foreground/70 break-words">
                                  {template.description}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatRecurrenceSchedule(template)}
                              </p>
                            </div>
                          </button>
                          <div
                            className={cn(
                              "flex items-center justify-between gap-2",
                              "border-t-2 border-border pt-2 sm:pt-2.5",
                            )}
                          >
                            <span className="tabular-nums text-base font-semibold">
                              {template.pricing_type === "shares" ? "≈ " : ""}
                              {formatEuro(Number(template.amount))}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(template)}
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center",
                                  "rounded border-2 border-border",
                                  "hover:bg-accent sm:h-10 sm:w-10",
                                )}
                                aria-label={`Edit ${template.categories.name}`}
                              >
                                <PencilSimple size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggle(
                                    template.id,
                                    template.active,
                                  );
                                }}
                                className="shrink-0"
                              >
                                <Badge
                                  variant={
                                    template.active ? "surface" : "outline"
                                  }
                                  size="sm"
                                >
                                  {template.active ? "On" : "Off"}
                                </Badge>
                              </button>
                            </div>
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </PageContainer>

      <RecurringForm
        categories={categories}
        template={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}
