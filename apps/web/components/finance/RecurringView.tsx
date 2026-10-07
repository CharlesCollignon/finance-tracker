"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FIGURE } from "@/lib/type-scale";
import {
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { CheckCircle, Circle, House, Plus } from "@phosphor-icons/react";
import { Button, ButtonNub } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RecurringProposals } from "@/components/finance/RecurringProposals";
import type { RecurringProposal } from "@finance/core/recurring-detection";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/layout/ToastProvider";
import { RecurringForm } from "@/components/finance/RecurringForm";
import { useQuickAdd } from "@/components/layout/QuickAddProvider";
import { isCryptoCategoryName } from "@finance/core/crypto-holdings";
import {
  brokerTransferOf,
  canBeFundedByTransfer,
  isFundedDca,
} from "@finance/core/dca-need";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import moments from "@/components/motion/moments.module.css";
import { formatRecurrenceSchedule } from "@finance/core/recurrence";
import {
  allocationSegments,
  rollUpRecurring,
  type AllocationKind,
  type RecurringRollup,
} from "@finance/core/recurring-rollup";
import {
  ALLOCATION_COLORS,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import { formatSharesLabel } from "@finance/core/recurring-shares";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import {
  setFundedByTransfer,
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

/**
 * Income first: it is what the other three are paid from, and the header
 * reads the same way — income, then what is committed and set aside.
 */
const GROUP_ORDER: CategoryType[] = [
  "income",
  "expense",
  "savings",
  "investment",
];

/**
 * What each of the four kinds of charge is called.
 *
 * A function of the locale, and drawn from the same `allocation.*` messages
 * the flow chart and the caps use, so the four kinds are named identically
 * wherever they appear.
 */
function groupLabels(t: Translate): Record<CategoryType, string> {
  return {
    income: t("allocation.income"),
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
  /** The days each charge is already recorded on this month, by template. */
  recordedThisMonth?: Record<string, string[]>;
  /** A charge to arrive with open for editing. */
  initialEditId?: string;
  /** The user's properties, which a charge can belong to (migration 049). */
  properties?: { id: string; name: string }[];
  /**
   * The categories of the wallets the bank debits from the account
   * (`walletCategoriesTheBankDebits`): their buys leave it, where a DCA
   * bought at the broker does not.
   */
  debitedCategoryIds?: string[];
}

/** Each property's name by id, for the row of a charge that belongs to one. */
const PropertyNames = createContext<ReadonlyMap<string, string>>(new Map());

/**
 * What a DCA's « Payé par le virement » tick needs: which wallets the bank
 * debits, whose DCAs carry none, and what pressing it does.
 */
const TransferTicks = createContext<{
  debited: ReadonlySet<string>;
  onFund: (template: RecurringTemplateWithCategory) => void;
} | null>(null);

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
  const propertyNames = useContext(PropertyNames);
  const propertyName = template.property_id
    ? propertyNames.get(template.property_id)
    : undefined;
  const ticks = useContext(TransferTicks);
  const tickable =
    ticks !== null &&
    template.active &&
    canBeFundedByTransfer(template, ticks.debited);
  const funded = template.funded_by_transfer;

  return (
    <li
      className={cn(
        "flex items-stretch gap-3 rounded-control py-3",
        "transition-colors hover:bg-muted/30",
        !template.active && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onEdit(template)}
          className="w-full text-left"
          aria-label={t("charges.editNamed", {
            name: template.categories.name,
          })}
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
        {/* The DCA's tick, outside the row's button like the link below:
            whether the monthly transfer to the broker pays for it. */}
        {tickable ? (
          <button
            type="button"
            onClick={() => ticks.onFund(template)}
            aria-pressed={funded}
            aria-label={t("dcaTransfer.fundedFor", {
              name: template.description?.trim() || template.categories.name,
            })}
            className={cn(
              "mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
              "transition-colors duration-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              funded
                ? "border-transparent bg-foreground/10 text-foreground"
                : "border-dashed border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {/* Keyed by the answer, so each press lands with a pop. */}
            <span key={String(funded)} className={moments.pop} aria-hidden>
              {funded ? (
                <CheckCircle size={ICON.xs} weight="fill" />
              ) : (
                <Circle size={ICON.xs} />
              )}
            </span>
            {t("dcaTransfer.funded")}
          </button>
        ) : null}
        {/* Its own link, outside the row's button: the property it belongs to. */}
        {propertyName && template.property_id ? (
          <Link
            href={`/property/${template.property_id}`}
            className="mt-1 inline-flex max-w-full items-center gap-1 rounded-control text-xs text-muted-foreground underline-offset-4 transition-colors duration-hover hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <House size={ICON.xs} aria-hidden className="shrink-0" />
            <span className="truncate">{propertyName}</span>
          </Link>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        {/* Coloured by kind of money, as the ledger's amounts are: the
            Semantic Amount Rule, from the same map. */}
        <span
          className={cn(
            "privacy-amount text-sm font-semibold tabular-nums",
            TYPE_AMOUNT_CLASS[template.categories.type],
          )}
        >
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
 * suggests belongs in it. The monthly figure is the rollup's `byType`, the
 * same number the bar above draws, so the two cannot disagree.
 *
 * At module scope rather than nested in the view: a component declared inside
 * a render is a new type each pass, so React would remount the proposals
 * below and throw away which ones the reader had just waved off.
 */
function GroupCard({
  type,
  label,
  monthly,
  items,
  proposals,
  onEdit,
  onToggle,
  header,
}: {
  type: CategoryType;
  label: string;
  monthly: number;
  items: RecurringTemplateWithCategory[];
  proposals: RecurringProposal[];
  onEdit: (template: RecurringTemplateWithCategory) => void;
  onToggle: (id: string, active: boolean) => void;
  /** Drawn under the title: the investments' transfer to the broker. */
  header?: ReactNode;
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-card p-card border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{label}</h2>
        {monthly > 0 ? (
          <span
            className={cn(
              "privacy-amount text-sm tabular-nums",
              TYPE_AMOUNT_CLASS[type],
            )}
          >
            {formatEuro(monthly)}
            <span className="text-xs text-muted-foreground">
              {t("charges.perMonthSuffix")}
            </span>
          </span>
        ) : null}
      </div>
      {header}
      <RecurringProposals
        proposals={proposals.filter((p) => p.categoryType === type)}
      />
      <GroupList items={items} onEdit={onEdit} onToggle={onToggle} />
    </section>
  );
}

/**
 * The app's transfer to the broker, at the head of the investments: what it
 * comes to and how many DCAs it pays for. Not an item to open — the ticks
 * below are how it is set — and its figure counts to its new value when a
 * tick changes it.
 */
function BrokerTransferHeader({
  amount,
  count,
}: {
  amount: number;
  count: number;
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-muted/20 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{t("dcaTransfer.headerTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("dcaTransfer.headerWhen", { count })}
        </p>
      </div>
      <AnimatedAmount
        value={amount}
        format={formatEuro}
        className={cn(
          "shrink-0 text-sm font-semibold",
          TYPE_AMOUNT_CLASS.investment,
        )}
      />
    </div>
  );
}

/**
 * A column's way in, above its card: a thin card in outline only, that takes
 * shape under the pointer — its border drawn, its ground filled, its cross a
 * quarter turned — and opens the add sheet on a charge of the column's kind.
 */
function ColumnAdd({
  type,
  label,
  onAdd,
}: {
  type: CategoryType;
  label: string;
  onAdd: (type: CategoryType) => void;
}) {
  const t = useT();
  const addLabel = t("charges.addTo", { group: label });
  return (
    <button
      type="button"
      onClick={() => onAdd(type)}
      aria-label={addLabel}
      title={addLabel}
      className={cn(
        "group/add flex h-9 w-full items-center justify-center rounded-card border border-dashed border-border text-muted-foreground",
        "transition-[background-color,border-color,color,transform] duration-hover ease-out",
        "hover:border-solid hover:border-foreground/30 hover:bg-card hover:text-foreground active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Plus
        size={ICON.sm}
        weight="bold"
        aria-hidden
        className="transition-transform duration-300 ease-out group-hover/add:rotate-90 motion-reduce:transition-none motion-reduce:group-hover/add:rotate-0"
      />
    </button>
  );
}

/** A figure at the documented card-level step, behind the privacy blur. */
function PrivateFigure({ children }: { children: ReactNode }) {
  return <span className={cn("privacy-amount", FIGURE)}>{children}</span>;
}

/** Each part of the bar in the allocation chart's own colour, from one map. */
const SEGMENT_COLOR: Record<AllocationKind, string> = {
  expense: ALLOCATION_COLORS.expenses,
  savings: ALLOCATION_COLORS.savings,
  investment: ALLOCATION_COLORS.investments,
  left: ALLOCATION_COLORS.remaining,
};

/**
 * What a month of charges leaves, and where the rest of the income goes.
 *
 * One card in place of four tiles, which sat in the same four-column rhythm
 * as the groups below and read as their headings while meaning something
 * else. `Left` leads, uncoloured: a small figure there is a circumstance, not
 * a kind of money. The bar and its legend keep every other term on screen —
 * a total whose subtrahends nobody can see is not believed — in the colours
 * the groups below give the same amounts.
 */
function WhereItGoes({ rollup }: { rollup: RecurringRollup }) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const segments = allocationSegments(rollup);
  const labels: Record<AllocationKind, string> = {
    expense: t("allocation.expenses"),
    savings: t("allocation.savings"),
    investment: t("allocation.investments"),
    left: t("charges.tileLeft"),
  };

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-card px-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("charges.leftEachMonth")}
          </h2>
          {rollup.income > 0 ? (
            <PrivateFigure>{formatEuro(rollup.left)}</PrivateFigure>
          ) : (
            // Not a figure: with no income recorded, what is left would only
            // be the outgoings with a minus sign.
            <p className="text-sm text-muted-foreground">
              {t("charges.noIncomeYet")}
            </p>
          )}
        </div>
        {rollup.income > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("charges.ofIncomeBefore")}{" "}
            <span
              className={cn(
                "privacy-amount tabular-nums",
                TYPE_AMOUNT_CLASS.income,
              )}
            >
              {formatEuro(rollup.income)}
            </span>{" "}
            {t("charges.ofIncomeAfter")}
          </p>
        ) : null}
      </div>

      {segments.length > 0 ? (
        <>
          {/* Hidden from screen readers: the legend says the same in words.
              Grown by share rather than sized in percent, so the gaps between
              segments come out of the bar instead of overflowing it. */}
          <div
            aria-hidden="true"
            className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
          >
            {segments.map((segment) => (
              <span
                key={segment.kind}
                className="h-full"
                style={{
                  flex: `${segment.share} 1 0%`,
                  backgroundColor: SEGMENT_COLOR[segment.kind],
                }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {segments.map((segment) => (
              <li key={segment.kind} className="flex items-baseline gap-2">
                <span className="text-muted-foreground">
                  {labels[segment.kind]}
                </span>
                <span
                  className={cn(
                    "privacy-amount tabular-nums",
                    segment.kind === "left"
                      ? "text-foreground"
                      : TYPE_AMOUNT_CLASS[segment.kind],
                  )}
                >
                  {formatEuro(segment.amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

export function RecurringView({
  templates: savedTemplates,
  categories,
  proposals = [],
  recordedThisMonth = {},
  initialEditId,
  properties = [],
  debitedCategoryIds = [],
}: RecurringViewProps) {
  const t = useT();
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const quickAdd = useQuickAdd();
  // A switch turns at once and the totals with it, before the server
  // answers; the saved list takes over again when the redrawn page arrives,
  // and puts the switch back on its own if the write failed. Waiting for the
  // round trip left the badge unchanged under the finger, and a second press
  // in that wait sent the same "off" twice.
  const [templates, showToggled] = useOptimistic(
    savedTemplates,
    (current, change: { id: string; active?: boolean; funded?: boolean }) =>
      current.map((template) =>
        template.id === change.id
          ? {
              ...template,
              ...(change.active !== undefined ? { active: change.active } : {}),
              ...(change.funded !== undefined
                ? { funded_by_transfer: change.funded }
                : {}),
            }
          : template,
      ),
  );
  // Read once, as the initial state: a save revalidates this page with the
  // same address, and consulting the param on every render would reopen the
  // editor the user had just closed.
  const [editing, setEditing] = useState<RecurringTemplateWithCategory | null>(
    () => templates.find((template) => template.id === initialEditId) ?? null,
  );

  // Out of the address once it has been read, so a reload after closing the
  // editor does not open it again.
  useEffect(() => {
    if (!initialEditId) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [initialEditId]);
  const [, startTransition] = useTransition();

  // The app's transfer to the broker is not an item to manage: it heads the
  // investments instead, set by the DCAs' ticks.
  const groups = useMemo(
    () =>
      GROUP_ORDER.map((type) => ({
        type,
        label: groupLabels(t)[type],
        items: templates.filter(
          (t) => t.categories.type === type && t.pricing_type !== "purchases",
        ),
      })),
    [templates, t],
  );
  const debited = useMemo(
    () => new Set(debitedCategoryIds),
    [debitedCategoryIds],
  );
  const transfer = brokerTransferOf(templates);
  const fundedCount = templates.filter((template) =>
    isFundedDca(template, debited),
  ).length;
  const transferHeader =
    transfer?.active && fundedCount > 0 ? (
      <BrokerTransferHeader
        amount={Number(transfer.amount)}
        count={fundedCount}
      />
    ) : null;

  const defaultTab = useMemo<CategoryType>(() => {
    const firstNonEmpty = groups.find((group) => group.items.length > 0);
    return firstNonEmpty?.type ?? "expense";
  }, [groups]);

  // Derived rather than synced through an effect: the tab follows the first
  // non-empty group until the user picks one, as on the phone.
  const [tabOverride, setTabOverride] = useState<CategoryType | null>(null);
  const activeTab = tabOverride ?? defaultTab;

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
  const rollup = rollUpRecurring(templates, { debited });

  const hasTemplates = templates.length > 0;
  const activeGroup = groups.find((group) => group.type === activeTab);

  // The same sheet as every other Add, opened on a charge because this is
  // the page of them — on a column's kind, from that column's « + ».
  // Editing one still happens in a sheet of its own.
  function openCreate(categoryType?: CategoryType) {
    quickAdd?.open({ kind: "charge", categoryType });
  }

  function openEdit(template: RecurringTemplateWithCategory) {
    setEditing(template);
  }

  /** Tick or untick a DCA, at once; the transfer's figure follows. */
  function handleFund(template: RecurringTemplateWithCategory) {
    const funded = !template.funded_by_transfer;
    startTransition(async () => {
      showToggled({ id: template.id, funded });
      const result = await setFundedByTransfer(template.id, funded);
      if (result.error) {
        toast(result.error, "error");
      }
    });
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      showToggled({ id, active: !active });
      const result = await toggleRecurringActive(id, !active);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(t("recurring.updatedHint"), "success");
    });
  }

  return (
    <PropertyNames.Provider
      value={new Map(properties.map(({ id, name }) => [id, name]))}
    >
      <TransferTicks.Provider value={{ debited, onFund: handleFund }}>
        <PageHeader titleKey="nav.charges" />

        <PageContainer className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("charges.blurb")}</p>

          {hasTemplates ? (
            <>
              <WhereItGoes rollup={rollup} />

              <p className="-mt-1 px-1 text-xs text-muted-foreground">
                {t("charges.perMonth")}
                {rollup.deployed > 0 ? (
                  <>
                    {" · "}
                    {t("charges.trackedBefore")}{" "}
                    <span className="privacy-amount tabular-nums text-foreground">
                      {formatEuro(rollup.deployed)}
                    </span>{" "}
                    {t("charges.trackedAfter")}
                  </>
                ) : null}
              </p>

              {/* One column of charges at a time on a phone: four lists stacked
                would be a screen and a half of scrolling to reach investments,
                and the four kinds are rarely read together. */}
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
                      onClick={() => setTabOverride(type)}
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
                  <div className="flex flex-col gap-2">
                    <ColumnAdd
                      type={activeGroup.type}
                      label={activeGroup.label}
                      onAdd={openCreate}
                    />
                    <GroupCard
                      type={activeGroup.type}
                      label={activeGroup.label}
                      monthly={rollup.byType[activeGroup.type]}
                      items={activeGroup.items}
                      proposals={proposals}
                      onEdit={openEdit}
                      onToggle={handleToggle}
                      header={
                        activeGroup.type === "investment"
                          ? transferHeader
                          : null
                      }
                    />
                  </div>
                ) : null}
              </div>

              {/* Four columns from xl, in the order of the tiles above. Not from
                lg: beside the side rail it left about 170px a column, too
                narrow for a name, an amount and its on/off pill. */}
              <div className="hidden items-start gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
                {groups.map(({ type, label, items }) => (
                  <div key={type} className="flex min-w-0 flex-col gap-2">
                    <ColumnAdd type={type} label={label} onAdd={openCreate} />
                    <GroupCard
                      type={type}
                      label={label}
                      monthly={rollup.byType[type]}
                      items={items}
                      proposals={proposals}
                      onEdit={openEdit}
                      onToggle={handleToggle}
                      header={type === "investment" ? transferHeader : null}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title={t("charges.emptyTitle")}
              description={t("charges.emptyBody")}
            >
              <Button variant="pill" size="md" onClick={() => openCreate()}>
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
          properties={properties}
          template={editing}
          recordedDates={editing ? recordedThisMonth[editing.id] : undefined}
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
            }
          }}
        />
      </TransferTicks.Provider>
    </PropertyNames.Provider>
  );
}
