"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Badge } from "@/components/retroui/Badge";
import { Card } from "@/components/retroui/Card";
import { RecurringProposals } from "@/components/finance/RecurringProposals";
import type { RecurringProposal } from "@finance/core/recurring-detection";
import { PageHeader } from "@/components/layout/PageHeader";
import { PLAN_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { useToast } from "@/components/layout/ToastProvider";
import { RecurringForm } from "@/components/finance/RecurringForm";
import { StatHero } from "@/components/finance/StatHero";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { monthSearchParams, parseMonthParams } from "@finance/core/constants";
import { applyRecurringPlanCounts } from "@finance/core/apply-recurring";
import { isCryptoCategoryName } from "@finance/core/crypto-holdings";
import {
  estimateMonthlyAmount,
  formatRecurrenceSchedule,
} from "@finance/core/recurrence";
import { formatSharesLabel } from "@finance/core/recurring-shares";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import {
  previewApplyRecurringForMonth,
  toggleRecurringActive,
} from "@/lib/actions/finance";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

type AllocType = Exclude<CategoryType, "income">;

const GROUP_ORDER: AllocType[] = ["expense", "savings", "investment"];

const GROUP_LABELS: Record<AllocType, string> = {
  expense: "Expenses",
  savings: "Savings",
  investment: "Investments",
};

interface RecurringViewProps {
  templates: RecurringTemplateWithCategory[];
  categories: Category[];
  /** Standing charges the statement implies, keyed by category type. */
  proposals?: RecurringProposal[];
}

interface RecurringItemRowProps {
  template: RecurringTemplateWithCategory;
  onEdit: (template: RecurringTemplateWithCategory) => void;
  onToggle: (id: string, active: boolean) => void;
}

function RecurringItemRow({
  template,
  onEdit,
  onToggle,
}: RecurringItemRowProps) {
  const formatEuro = useFormatCurrency();
  const sharesLabel = formatSharesLabel(template);

  return (
    <li
      className={cn(
        "flex items-start gap-3 border-b border-border/40 py-3",
        "transition-colors hover:bg-muted/30",
        !template.active && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(template)}
        className="min-w-0 flex-1 text-left"
        aria-label={`Edit ${template.categories.name}`}
      >
        <p className="text-sm font-medium leading-snug break-words">
          {template.categories.name}
        </p>
        {template.pricing_type === "shares" && sharesLabel ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground break-words">
            {sharesLabel}
            {template.instrument_symbol
              ? ` · ${template.instrument_symbol}`
              : ""}
          </p>
        ) : null}
        {isCryptoCategoryName(template.categories.name) ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground break-words">
            Fixed EUR → Bitcoin
          </p>
        ) : null}
        {template.description ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground/70 break-words">
            {template.description}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRecurrenceSchedule(template)}
        </p>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="privacy-amount font-mono tabular-nums text-sm font-semibold">
          {template.pricing_type === "shares" ? "≈" : ""}
          {formatEuro(Number(template.amount))}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(template)}
            className="flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Edit ${template.categories.name}`}
          >
            <PencilSimple size={16} weight="light" />
          </button>
          <button
            type="button"
            onClick={() => onToggle(template.id, template.active)}
            className="shrink-0"
            aria-pressed={template.active}
            aria-label={`${
              template.active ? "Deactivate" : "Activate"
            } ${template.categories.name}`}
          >
            <Badge
              variant={template.active ? "surface" : "outline"}
              size="sm"
              className="rounded-full"
            >
              {template.active ? "On" : "Off"}
            </Badge>
          </button>
        </div>
      </div>
    </li>
  );
}

function GroupList({
  label,
  items,
  onEdit,
  onToggle,
}: {
  label: string;
  items: RecurringTemplateWithCategory[];
  onEdit: (template: RecurringTemplateWithCategory) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-3 text-sm text-muted-foreground">
        No {label.toLowerCase()} yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {items.map((template) => (
        <RecurringItemRow
          key={template.id}
          template={template}
          onEdit={onEdit}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}

export function RecurringView({
  templates,
  categories,
  proposals = [],
}: RecurringViewProps) {
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTemplateWithCategory | null>(
    null,
  );
  const [applyPending, setApplyPending] = useState(false);
  const [, startTransition] = useTransition();
  const { year, month } = parseMonthParams();
  const transactionsHref = `/transactions${monthSearchParams(year, month)}`;

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((type) => ({
        type,
        label: GROUP_LABELS[type],
        items: templates.filter((t) => t.categories.type === type),
      })),
    [templates],
  );

  const defaultTab = useMemo<AllocType>(() => {
    const firstNonEmpty = groups.find((group) => group.items.length > 0);
    return firstNonEmpty?.type ?? "expense";
  }, [groups]);

  const [activeTab, setActiveTab] = useState<AllocType>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const refreshApplyPending = useCallback(async () => {
    const result = await previewApplyRecurringForMonth(year, month);
    if (result.error || !result.plan) {
      return;
    }
    const counts = applyRecurringPlanCounts(result.plan);
    setApplyPending(counts.creates + counts.updates > 0);
  }, [month, year]);

  useEffect(() => {
    void refreshApplyPending();
  }, [refreshApplyPending, templates]);

  const budgetMonthly = templates
    .filter((t) => t.active && t.categories.counts_toward_summary !== false)
    .reduce((sum, t) => sum + estimateMonthlyAmount(t), 0);

  const deploymentMonthly = templates
    .filter((t) => t.active && t.categories.counts_toward_summary === false)
    .reduce((sum, t) => sum + estimateMonthlyAmount(t), 0);

  const hasTemplates = templates.length > 0;
  const activeGroup = groups.find((group) => group.type === activeTab);

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
      const result = await toggleRecurringActive(id, !active);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(
        "Updated. Apply recurring on Transactions to see changes.",
        "success",
      );
      void refreshApplyPending();
    });
  }

  return (
    <>
      <PageHeader title="Plan" />

      <PageContainer>
        <SurfaceTabs tabs={PLAN_TABS} className="mb-4" />
        <Stagger
          className="flex flex-col items-center gap-8 md:gap-10"
          stagger={0.05}
        >
          {applyPending ? (
            <StaggerItem className="w-full">
              <p className="text-center text-sm text-muted-foreground">
                Recurring changes need apply.{" "}
                <Link
                  href={transactionsHref}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Open Transactions
                </Link>{" "}
                and tap Apply recurring.
              </p>
            </StaggerItem>
          ) : null}

          {hasTemplates ? (
            <>
              <StaggerItem className="w-full">
                <Card.Bezel className="w-full" innerClassName="p-6 md:p-8">
                  <StatHero
                    label="Expected budget impact"
                    amount={formatEuro(budgetMonthly)}
                    subtitle={
                      deploymentMonthly > 0 ? (
                        <p>
                          Broker deployment (tracking){" "}
                          <span className="privacy-amount font-mono font-medium tabular-nums text-foreground">
                            {formatEuro(deploymentMonthly)}
                          </span>
                        </p>
                      ) : null
                    }
                  />
                </Card.Bezel>
              </StaggerItem>

              <StaggerItem>
                <Button variant="pill" size="md" onClick={openCreate}>
                  Add recurring item
                  <ButtonNub>
                    <Plus size={16} weight="bold" />
                  </ButtonNub>
                </Button>
              </StaggerItem>

              <StaggerItem className="w-full md:hidden">
                <div
                  className="flex justify-center gap-2 overflow-x-auto pb-1"
                  role="tablist"
                  aria-label="Recurring type"
                >
                  {groups.map(({ type, label, items }) => (
                    <button
                      key={type}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === type}
                      onClick={() => setActiveTab(type)}
                      className={cn(
                        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold",
                        "transition-colors duration-300",
                        activeTab === type
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                      {items.length > 0 ? ` · ${items.length}` : ""}
                    </button>
                  ))}
                </div>
                {activeGroup ? (
                  <div className="mt-4 w-full">
                    <RecurringProposals
                      proposals={proposals.filter(
                        (p) => p.categoryType === activeGroup.type,
                      )}
                    />
                    <Card.Bezel className="w-full" innerClassName="px-4 py-1">
                      <GroupList
                        label={activeGroup.label}
                        items={activeGroup.items}
                        onEdit={openEdit}
                        onToggle={handleToggle}
                      />
                    </Card.Bezel>
                  </div>
                ) : null}
              </StaggerItem>

              <StaggerItem className="hidden w-full md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3">
                {groups.map(({ type, label, items }) => (
                  <section key={type} className="min-w-0">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      {label}
                      {items.length > 0 ? ` · ${items.length}` : ""}
                    </h2>
                    <div className="mt-3">
                      <RecurringProposals
                        proposals={proposals.filter(
                          (p) => p.categoryType === type,
                        )}
                      />
                    </div>
                    <Card.Bezel className="w-full" innerClassName="px-4 py-1">
                      <GroupList
                        label={label}
                        items={items}
                        onEdit={openEdit}
                        onToggle={handleToggle}
                      />
                    </Card.Bezel>
                  </section>
                ))}
              </StaggerItem>
            </>
          ) : (
            <StaggerItem className="w-full">
              <EmptyState
                title="No recurring items"
                description="Set up rent, DCA contributions, and other repeating flows."
              >
                <Button variant="pill" size="md" onClick={openCreate}>
                  Add recurring item
                  <ButtonNub>
                    <Plus size={16} weight="bold" />
                  </ButtonNub>
                </Button>
              </EmptyState>
            </StaggerItem>
          )}
        </Stagger>
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
