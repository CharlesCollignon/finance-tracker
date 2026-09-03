"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/retroui/Button";
import { Badge } from "@/components/retroui/Badge";
import { RecurringProposals } from "@/components/finance/RecurringProposals";
import type { RecurringProposal } from "@finance/core/recurring-detection";
import { PageHeader } from "@/components/layout/PageHeader";
import { PLAN_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { useToast } from "@/components/layout/ToastProvider";
import { RecurringForm } from "@/components/finance/RecurringForm";
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
        "flex items-stretch gap-3 rounded-lg py-3",
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

      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <span className="privacy-amount text-sm font-semibold tabular-nums">
          {template.pricing_type === "shares" ? "≈" : ""}
          {formatEuro(Number(template.amount))}
        </span>
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
    </li>
  );
}

function GroupList({
  items,
  onEdit,
  onToggle,
}: {
  items: RecurringTemplateWithCategory[];
  onEdit: (template: RecurringTemplateWithCategory) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        Nothing here yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
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

/**
 * One kind of charge, with what it costs a month and anything the statement
 * suggests belongs in it.
 *
 * At module scope rather than nested in the view: a component declared inside
 * a render is a new type each pass, so React would remount the proposals
 * below and throw away which ones the reader had just waved off.
 */
function GroupCard({
  type,
  label,
  items,
  proposals,
  onEdit,
  onToggle,
}: {
  type: AllocType;
  label: string;
  items: RecurringTemplateWithCategory[];
  proposals: RecurringProposal[];
  onEdit: (template: RecurringTemplateWithCategory) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const formatEuro = useFormatCurrency();
  const monthly = items
    .filter((t) => t.active)
    .reduce((sum, t) => sum + estimateMonthlyAmount(t), 0);

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{label}</h2>
        {monthly > 0 ? (
          <span className="privacy-amount text-sm tabular-nums text-muted-foreground">
            {formatEuro(monthly)}
            <span className="text-xs"> / mo</span>
          </span>
        ) : null}
      </div>
      <RecurringProposals
        proposals={proposals.filter((p) => p.categoryType === type)}
      />
      <GroupList items={items} onEdit={onEdit} onToggle={onToggle} />
    </section>
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
        "Updated. Apply recurring in the Ledger to see the change.",
        "success",
      );
      void refreshApplyPending();
    });
  }

  return (
    <>
      <PageHeader title="Plan" />

      <PageContainer className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SurfaceTabs tabs={PLAN_TABS} />
          <Button variant="pill" size="sm" onClick={openCreate}>
            Add charge
            <ButtonNub>
              <Plus size={16} weight="bold" />
            </ButtonNub>
          </Button>
        </div>

        {applyPending ? (
          <p className="rounded-lg border border-dashed border-primary-rim/50 px-4 py-3 text-sm text-muted-foreground">
            These charges have changed since this month was written.{" "}
            <Link
              href={transactionsHref}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Open the Ledger
            </Link>{" "}
            and apply them.
          </p>
        ) : null}

        {hasTemplates ? (
          <>
            <section className="flex flex-col gap-1 rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Committed every month
              </p>
              <span className="privacy-amount font-head text-3xl leading-none tabular-nums md:text-4xl">
                {formatEuro(budgetMonthly)}
              </span>
              {deploymentMonthly > 0 ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Plus{" "}
                  <span className="privacy-amount tabular-nums text-foreground">
                    {formatEuro(deploymentMonthly)}
                  </span>{" "}
                  moved into the broker — tracked, but not spent.
                </p>
              ) : null}
            </section>

            {/* One column of charges at a time on a phone: three lists stacked
                would be a screen and a half of scrolling to reach investments,
                and the three kinds are rarely read together. */}
            <div className="flex flex-col gap-3 md:hidden">
              <div
                className="flex gap-1.5 overflow-x-auto"
                role="tablist"
                aria-label="Kind of charge"
              >
                {groups.map(({ type, label, items }) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === type}
                    onClick={() => setActiveTab(type)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                      "transition-colors duration-200",
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
                <GroupCard
                  type={activeGroup.type}
                  label={activeGroup.label}
                  items={activeGroup.items}
                  proposals={proposals}
                  onEdit={openEdit}
                  onToggle={handleToggle}
                />
              ) : null}
            </div>

            <div className="hidden items-start gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
              {groups.map(({ type, label, items }) => (
                <GroupCard
                  key={type}
                  type={type}
                  label={label}
                  items={items}
                  proposals={proposals}
                  onEdit={openEdit}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No charges yet"
            description="Rent, subscriptions, a monthly transfer into savings — anything you already know is coming."
          >
            <Button variant="pill" size="md" onClick={openCreate}>
              Add charge
              <ButtonNub>
                <Plus size={16} weight="bold" />
              </ButtonNub>
            </Button>
          </EmptyState>
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
