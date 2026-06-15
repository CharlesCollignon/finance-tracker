"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
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
        <SignOutButton />
      </PageHeader>

      <div className="flex flex-col gap-4 p-4">
        {groups.map(({ type, label, items }) => (
          <section key={type}>
            <h2 className="mb-2 font-head text-sm uppercase tracking-wide">
              {label}
            </h2>
            {items.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">
                No {label.toLowerCase()} templates yet.
              </Card>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((template) => (
                  <li key={template.id}>
                    <Card
                      className="flex cursor-pointer items-center gap-3 p-4"
                      onClick={() => openEdit(template)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {template.categories.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Day {template.day_of_month}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums font-semibold">
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

        <Card className="flex items-center justify-between p-4">
          <span className="font-head">Expected monthly total</span>
          <span className="tabular-nums text-lg font-semibold">
            {formatEuro(monthlyTotal)}
          </span>
        </Card>

        <Button size="lg" className="w-full" onClick={openCreate}>
          Add recurring item
        </Button>
      </div>

      <RecurringForm
        categories={categories}
        template={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}
