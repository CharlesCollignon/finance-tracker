"use client";

import { PauseCircle, Plus } from "@phosphor-icons/react";
import {
  ALLOCATION_COLORS,
  TYPE_AMOUNT_CLASS,
} from "@finance/core/category-styles";
import { formatPercentLabel } from "@finance/core/constants";
import type { CategoryType } from "@finance/core/types/database";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileShell,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/**
 * Récurrents, as a landing mock (`./frame.tsx`): the line that says what
 * the page is, « Reste chaque mois » with the bar of where the income goes,
 * then the four kinds of charge — on a desktop in a grid, each under its
 * dashed add button; on the phone one kind at a time behind its chip — as
 * `RecurringView` and the Expo `recurring` screen draw them.
 */

const KINDS: CategoryType[] = ["income", "expense", "savings", "investment"];

const KIND_LABEL = {
  income: "allocation.income",
  expense: "allocation.expenses",
  savings: "allocation.savings",
  investment: "allocation.investments",
} as const;

/** « Reste chaque mois »: the figure, the income it is out of, the bar. */
function WhereItGoes({ ring }: { ring: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { rollup } = landingSampleFor(locale);
  const segments = [
    {
      key: "expense",
      amount: rollup.expense,
      color: ALLOCATION_COLORS.expenses,
      label: t("allocation.expenses"),
    },
    {
      key: "savings",
      amount: rollup.savings,
      color: ALLOCATION_COLORS.savings,
      label: t("allocation.savings"),
    },
    {
      key: "investment",
      amount: rollup.investment,
      color: ALLOCATION_COLORS.investments,
      label: t("allocation.investments"),
    },
    {
      key: "left",
      amount: rollup.left,
      color: ALLOCATION_COLORS.remaining,
      label: t("charges.tileLeft"),
    },
  ] as const;
  const kept = rollup.left / rollup.income;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-card border border-border bg-card px-5",
        ring ? "py-5" : "py-6",
      )}
    >
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("charges.leftEachMonth")}
          </h2>
          <span className="font-serif text-3xl font-semibold tracking-tight tabular-nums">
            {euro(rollup.left)}
          </span>
          {ring ? (
            <p className="text-sm text-muted-foreground">
              {t("charges.ofIncomeBefore")}{" "}
              <span className={TYPE_AMOUNT_CLASS.income}>
                {euro(rollup.income)}
              </span>{" "}
              {t("charges.ofIncomeAfter")}
            </p>
          ) : null}
        </div>
        {ring ? (
          <span className="relative flex size-14 items-center justify-center">
            <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
              <circle
                cx="28"
                cy="28"
                r={radius}
                fill="none"
                stroke="var(--hairline-strong)"
                strokeWidth="5"
              />
              <circle
                cx="28"
                cy="28"
                r={radius}
                fill="none"
                stroke="var(--chart-5)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${circumference * kept} ${circumference}`}
              />
            </svg>
            <span className="text-xs font-semibold tabular-nums">
              {formatPercentLabel(Math.round(kept * 100), locale)}
            </span>
          </span>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("charges.ofIncomeBefore")}{" "}
            <span className={cn("tabular-nums", TYPE_AMOUNT_CLASS.income)}>
              {euro(rollup.income)}
            </span>{" "}
            {t("charges.ofIncomeAfter")}
          </p>
        )}
      </div>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((segment) => (
          <span
            key={segment.key}
            className="h-full"
            style={{
              flex: `${segment.amount} 1 0%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>
      <ul
        className={cn(
          "text-sm",
          ring ? "grid grid-cols-2 gap-y-2" : "flex flex-wrap gap-x-6 gap-y-2",
        )}
      >
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2">
            {ring ? (
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
            ) : null}
            <span className={cn("text-muted-foreground", ring && "text-xs")}>
              {segment.label}
            </span>
            <span
              className={cn(
                "tabular-nums",
                ring && "text-xs",
                segment.key === "left"
                  ? "text-foreground"
                  : TYPE_AMOUNT_CLASS[segment.key],
              )}
            >
              {euro(segment.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A column's dashed way in, as `ColumnAdd` draws it. */
function ColumnAdd() {
  return (
    <span className="flex h-9 w-full items-center justify-center rounded-card border border-dashed border-border text-muted-foreground">
      <Plus size={14} weight="bold" />
    </span>
  );
}

/** One kind of charge: its name, what it costs a month, its rows. */
function GroupCard({ kind, phone }: { kind: CategoryType; phone: boolean }) {
  const t = useT();
  const euro = useEuro();
  const { templates, rollup } = landingSampleFor(useLocale());
  const rows = templates.filter((template) => template.type === kind);
  return (
    <section className="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{t(KIND_LABEL[kind])}</h2>
        <span className={cn("text-sm tabular-nums", TYPE_AMOUNT_CLASS[kind])}>
          {euro(rollup[kind])}
          <span className="text-xs text-muted-foreground">
            {t("charges.perMonthSuffix")}
          </span>
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((template) => (
          <li key={template.id} className="flex items-stretch gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">
                {template.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {template.schedule}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-2">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  TYPE_AMOUNT_CLASS[template.type],
                )}
              >
                {euro(Math.abs(template.amount))}
              </span>
              {phone ? (
                <PauseCircle size={18} className="text-muted-foreground" />
              ) : (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                  {t("recurring.on")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RecurringMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();
  const { templates } = landingSampleFor(useLocale());

  if (variant === "mobile") {
    // Dépenses chosen: the kind with the most in it.
    const shown: CategoryType = "expense";
    return (
      <MobileShell active="nav.charges">
        <WhereItGoes ring />
        <p className="-mt-1 px-1 text-[11px] text-muted-foreground">
          {t("charges.perMonth")}
        </p>
        <div className="flex gap-1.5 overflow-hidden">
          {KINDS.map((kind) => {
            const count = templates.filter((each) => each.type === kind).length;
            return (
              <span
                key={kind}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
                  kind === shown
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground",
                )}
              >
                {t(KIND_LABEL[kind])}
                {count > 0 ? ` · ${count}` : ""}
              </span>
            );
          })}
        </div>
        <ColumnAdd />
        <GroupCard kind={shown} phone />
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.charges">
      <p className="text-sm text-muted-foreground">{t("charges.blurb")}</p>
      <WhereItGoes ring={false} />
      <p className="-mt-1 px-1 text-xs text-muted-foreground">
        {t("charges.perMonth")}
      </p>
      <div className="grid grid-cols-2 items-start gap-4">
        {KINDS.map((kind) => (
          <div key={kind} className="flex min-w-0 flex-col gap-2">
            <ColumnAdd />
            <GroupCard kind={kind} phone={false} />
          </div>
        ))}
      </div>
    </WebShell>
  );
}
