"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { RecurringForm } from "@/components/finance/RecurringForm";
import { formatEuro } from "@/lib/constants";
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

  const monthlyTotal = templates
    .filter((t) => t.active)
    .reduce((sum, t) => sum + Number(t.amount), 0);

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
                        <Card
                          className="flex w-full cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-accent/30"
                          onClick={() => openEdit(template)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {template.categories.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Day {template.day_of_month}
                            </p>
                          </div>
                          <span className="shrink-0 tabular-nums text-sm font-semibold">
                            {formatEuro(Number(template.amount))}
                          </span>
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
            <Card className="flex w-full items-center justify-between p-4 md:p-5">
              <span className="font-head md:text-lg">Expected monthly total</span>
              <span className="tabular-nums text-lg font-semibold md:text-xl">
                {formatEuro(monthlyTotal)}
              </span>
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
