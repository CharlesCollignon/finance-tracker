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
import { rollUpRecurring } from "@finance/core/recurring-rollup";
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
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import type { Translate } from "@finance/core/i18n/t";

type AllocType = Exclude<CategoryType, "income">;

const GROUP_ORDER: AllocType[] = ["expense", "savings", "investment"];

/**
 * What each of the three kinds of charge is called.
 *
 * A function of the locale, and drawn from the same `allocation.*` messages
 * the flow chart and the caps use, so the three kinds are named identically
 * wherever they appear.
 */
function groupLabels(t: Translate): Record<AllocType, string> {
  return {
    expense: t("allocation.expenses"),
    savings: t("allocation.savings"),
    investment: t("allocation.investments"),
  };
}

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
  const locale = useLocale();
  const t = useT();
  const sharesLabel = formatSharesLabel(template);

  return (
    <li
      className={cn(
        "flex items-stretch gap-3 rounded-control py-3",
        "transition-colors hover:bg-muted/30",
        !template.active && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(template)}
        className="min-w-0 flex-1 text-left"
        aria-label={t("charges.editNamed", { name: template.categories.name })}
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
            {t("charges.fixedToBitcoin")}
          </p>
        ) : null}
        {template.description ? (
          // The user's own note about the charge, and the only prose on the
          // row. It was `text-muted-foreground/70`, about 3.9:1 at 12px —
          // under the 4.5:1 body floor — and dimmer than the two lines above
          // it for no reason anyone chose. Full-strength muted foreground is
          // the token that already means secondary text.
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground break-words">
            {template.description}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRecurrenceSchedule(template, locale)}
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
          aria-label={t("charges.toggleFor", {
            action: template.active
              ? t("charges.deactivate")
              : t("charges.activate"),
            name: template.categories.name,
          })}
        >
          <Badge
            variant={template.active ? "surface" : "outline"}
            size="sm"
            className="rounded-full"
          >
            {t(template.active ? "recurring.on" : "recurring.off")}
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
  const t = useT();

  if (items.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        {t("charges.nothingHereYet")}
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
    <section className="flex min-w-0 flex-col gap-3 rounded-card p-card border border-border bg-card">
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
  const t = useT();
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
        label: groupLabels(t)[type],
        items: templates.filter((t) => t.categories.type === type),
      })),
    [templates, t],
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

  /*
   * One rollup rather than two reducers, and split by what kind of money each
   * template is rather than only by whether the summary counts it.
   *
   * This changes the middle figure. It used to sum every counting template —
   * expenses, savings and investments together — under the word "committed".
   * The rest of the product does not mean that: `buildRunway` says committed
   * is recurring expenses only, because contributions are what a person under
   * pressure stops before they stop paying rent, and the Bearing's committed
   * fact reads that same figure. This page was the outlier. What falls out of
   * the middle column is not lost, it is said beneath as what is set aside.
   */
  const rollup = rollUpRecurring(templates);

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
      toast(t("recurring.updatedHint"), "success");
      void refreshApplyPending();
    });
  }

  return (
    <>
      <PageHeader titleKey="nav.charges" />

      <PageContainer className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("charges.blurb")}</p>
          <Button
            variant="pill"
            size="sm"
            className="ml-auto"
            onClick={openCreate}
          >
            {t("charges.addCharge")}
            <ButtonNub>
              <Plus size={ICON.md} weight="bold" />
            </ButtonNub>
          </Button>
        </div>

        {applyPending ? (
          <p className="rounded-control border border-dashed border-hairline-strong px-4 py-3 text-sm text-muted-foreground">
            {t("charges.applyPendingBefore")}{" "}
            <Link
              href={transactionsHref}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {t("charges.applyPendingLink")}
            </Link>{" "}
            {t("charges.applyPendingAfter")}
          </p>
        ) : null}

        {hasTemplates ? (
          <>
            <section className="rounded-card border border-border bg-card p-5">
              {/* Three figures across, stacking on a phone. One card rather
                  than three, because they are one sentence: what comes in,
                  what is already promised, and what that leaves. None of them
                  is coloured — "what's left" being small is a circumstance,
                  not a category, and the Semantic Amount Rule reserves colour
                  for saying what kind of money a figure is. */}
              <div className="grid gap-5 sm:grid-cols-3 sm:gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    {t("charges.incomeEveryMonth")}
                  </p>
                  {rollup.income > 0 ? (
                    <span className="privacy-amount font-head text-3xl leading-none tabular-nums md:text-4xl">
                      {formatEuro(rollup.income)}
                    </span>
                  ) : (
                    // Not a zero. Nothing has been measured here, and a `0 €`
                    // in the same type as the figures beside it would claim
                    // otherwise.
                    <p className="text-sm text-muted-foreground">
                      {t("charges.noIncomeYet")}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    {t("charges.committedEveryMonth")}
                  </p>
                  <span className="privacy-amount font-head text-3xl leading-none tabular-nums md:text-4xl">
                    {formatEuro(rollup.committed)}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    {t("charges.leftEveryMonth")}
                  </p>
                  <span className="privacy-amount font-head text-3xl leading-none tabular-nums md:text-4xl">
                    {formatEuro(rollup.left)}
                  </span>
                </div>
              </div>

              {rollup.setAside > 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {t("charges.plusSetAsideBefore")}{" "}
                  <span className="privacy-amount tabular-nums text-foreground">
                    {formatEuro(rollup.setAside)}
                  </span>{" "}
                  {t("charges.plusSetAsideAfter")}
                </p>
              ) : null}

              {rollup.deployed > 0 ? (
                // The figure is its own element so the blur can cover it
                // without covering the sentence it sits in, which is why this
                // is two fragments either side of an amount rather than one
                // template.
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t("charges.plusMovedBefore")}{" "}
                  <span className="privacy-amount tabular-nums text-foreground">
                    {formatEuro(rollup.deployed)}
                  </span>{" "}
                  {t("charges.plusMovedAfter")}
                </p>
              ) : null}
            </section>

            {/* One column of charges at a time on a phone: three lists stacked
                would be a screen and a half of scrolling to reach investments,
                and the three kinds are rarely read together. */}
            <div className="flex flex-col gap-3 md:hidden">
              {/* A group of toggles, not tabs. `role="tablist"` over
                  `role="tab"` was a promise the markup did not keep: the list
                  below is not a `tabpanel`, nothing carries `aria-controls`,
                  and there was neither a roving `tabIndex` nor a key handler —
                  so a screen reader announced a tab set whose arrow keys did
                  nothing. `aria-pressed` on plain buttons says which kind is
                  showing and claims no keys the control does not handle. */}
              <div
                className="flex gap-1.5 overflow-x-auto"
                role="group"
                aria-label={t("charges.kindOfCharge")}
              >
                {groups.map(({ type, label, items }) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={activeTab === type}
                    onClick={() => setActiveTab(type)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                      "transition-colors duration-hover",
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
            title={t("charges.emptyTitle")}
            description={t("charges.emptyBody")}
          >
            <Button variant="pill" size="md" onClick={openCreate}>
              {t("charges.addCharge")}
              <ButtonNub>
                <Plus size={ICON.md} weight="bold" />
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
