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
import { formatEuro } from "@/lib/constants";
import {
  estimateMonthlyAmount,
  formatRecurrenceSchedule,
} from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { toggleRecurringActive } from "@/lib/actions/finance";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
} from "@/lib/types/database";

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
                        <Card className="flex w-full items-center gap-3 p-3 transition-colors hover:bg-accent/30">
                          <button
                            type="button"
                            onClick={() => openEdit(template)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <CategoryIcon icon={template.categories.icon} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {template.categories.name}
                              </p>
                              {template.description && (
                                <p className="truncate text-xs text-muted-foreground/70">
                                  {template.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {formatRecurrenceSchedule(template)}
                              </p>
                            </div>
                            <span className="shrink-0 tabular-nums text-sm font-semibold">
                              {formatEuro(Number(template.amount))}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(template)}
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center",
                              "rounded border-2 border-border",
                              "hover:bg-accent",
                            )}
                            aria-label={`Edit ${template.categories.name}`}
                          >
                            <PencilSimple size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggle(template.id, template.active);
                            }}
                            className="shrink-0"
                          >
                            <Badge
                              variant={template.active ? "surface" : "outline"}
                              size="sm"
                            >
                              {template.active ? "On" : "Off"}
                            </Badge>
                          </button>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}

        {hasTemplates && (
          <>
            <Card className="flex w-full flex-col gap-3 p-4 md:p-5">
              <div className="flex items-center justify-between">
                <span className="font-head md:text-lg">Expected budget impact</span>
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
