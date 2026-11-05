"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
} from "@phosphor-icons/react";
import { formatOccurrenceDates } from "@finance/core/apply-recurring";
import { shiftIsoDate, todayIsoLocal } from "@finance/core/constants";
import {
  ENTRY_RHYTHMS,
  offersAdvance,
  type EntryRhythm,
} from "@finance/core/entry-draft";
import {
  monthLong,
  monthShort,
  weekdayShortMondayFirst,
} from "@finance/core/i18n/calendar-names";
import {
  lookupMerchant,
  suggestMerchants,
  type MerchantIndex,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import type { Category, CategoryType } from "@finance/core/types/database";
import { CategoryGlyph } from "@/components/finance/CategoryIcon";
import { Switch } from "@/components/ui/Switch";
import { useFormatCurrency } from "@/lib/use-currency";
import { useLocale, useT } from "@/lib/locale-context";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { Chip, DayCells, PanelHeading, Segmented } from "./parts";

const QUESTION_KEY = {
  expense: "entry.whereFrom.expense",
  income: "entry.whereFrom.income",
  savings: "entry.whereFrom.savings",
  investment: "entry.whereFrom.investment",
} as const;

const RHYTHM_KEY = {
  monthly: "entry.rhythm.monthly",
  weekly: "entry.rhythm.weekly",
  quarterly: "entry.rhythm.quarterly",
  yearly: "entry.rhythm.yearly",
} as const;

const FIELD =
  "min-h-11 w-full rounded-2xl border border-border bg-foreground/5 px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none";

/* ---------------------------------------------------------------------- */

/**
 * The kind's categories laid out four to a row, each a glyph on a disc with
 * its name under it. The chosen one fills in the kind's colour.
 */
export function CategoryGrid({
  kind,
  categories,
  value,
  ink,
  onChange,
  onLeave,
}: {
  kind: CategoryType;
  /** The kind's categories, the ones used lately first. */
  categories: Category[];
  value: string;
  ink: string;
  onChange: (id: string) => void;
  /** Closes the sheet before going to Catégories. */
  onLeave: () => void;
}) {
  const t = useT();
  return (
    <div>
      <PanelHeading
        action={
          <Link
            href="/categories"
            onClick={onLeave}
            className="text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("entry.manage")}
          </Link>
        }
      >
        {t(QUESTION_KEY[kind])}
      </PanelHeading>
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("entry.noCategory")}</p>
      ) : (
        <div
          role="radiogroup"
          aria-label={t("entry.category")}
          className="grid grid-cols-4 gap-x-1 gap-y-2"
        >
          {categories.map((category) => {
            const selected = category.id === value;
            return (
              <button
                key={category.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(category.id)}
                className="group flex flex-col items-center gap-1.5 rounded-2xl px-0.5 pb-1.5 pt-1 transition-transform duration-press active:scale-[0.94]"
              >
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-hover",
                    selected
                      ? "text-background"
                      : "bg-foreground/[0.06] text-foreground group-hover:bg-foreground/10",
                  )}
                  style={selected ? { background: ink } : undefined}
                >
                  <CategoryGlyph icon={category.icon} size={ICON.xl + 2} />
                </span>
                <span
                  className={cn(
                    "line-clamp-2 text-center text-xs leading-tight",
                    selected
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

/**
 * The shop or the label. Before anything is typed it lists the shops used
 * last for this kind of money; typing narrows them. Picking one brings its
 * category, and its last amount when none is typed yet.
 */
export function NotePanel({
  value,
  onChange,
  merchants,
  categories,
  label,
  placeholder,
  onPick,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The remembered shops of the kind being entered, and only those. */
  merchants: MerchantIndex;
  categories: Category[];
  label: string;
  placeholder: string;
  onPick: (rule: MerchantRule) => void;
  onSubmit: () => void;
}) {
  const t = useT();
  const formatEuro = useFormatCurrency();
  const suggestions = useMemo(() => {
    if (value.trim() === "") {
      return [...merchants.values()]
        .sort((a, b) => b.lastUsedOn.localeCompare(a.lastUsedOn))
        .slice(0, 4);
    }
    return suggestMerchants(merchants, value, 4);
  }, [merchants, value]);
  const known = lookupMerchant(merchants, value);
  const iconOf = (id: string) =>
    categories.find((category) => category.id === id)?.icon ?? null;

  return (
    <div>
      <input
        // The panel opens on this field: the tile was pressed to type here.
        autoFocus
        type="text"
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className={cn(FIELD, "focus-visible:ring-2 focus-visible:ring-ring")}
      />
      {value.trim() === "" && suggestions.length > 0 ? (
        <p className="mt-2.5 text-xs text-muted-foreground">
          {t("entry.knownShopHint")}
        </p>
      ) : null}
      {value.trim() !== "" && !known && suggestions.length === 0 ? (
        <p className="mt-2.5 text-xs text-muted-foreground">
          {t("entry.newShop")}
        </p>
      ) : null}
      <ul className="mt-1">
        {suggestions.map((rule) => (
          <li
            key={rule.key}
            className="border-t border-border first:border-t-0"
          >
            <button
              type="button"
              aria-label={t("formPickers.useSuggestion", {
                label: rule.label,
                category: rule.categoryName,
              })}
              onClick={() => onPick(rule)}
              className="flex min-h-14 w-full items-center gap-3 rounded-control px-1 py-2 text-left transition-colors duration-hover hover:bg-foreground/[0.04]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                <CategoryGlyph icon={iconOf(rule.categoryId)} size={ICON.lg} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{rule.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t("entry.lastTime", { category: rule.categoryName })}
                </span>
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatEuro(rule.lastAmount)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

export interface WhenState {
  recurring: boolean;
  /** For an entry that happened once. */
  occurredOn: string;
  rhythm: EntryRhythm;
  dayOfMonth: number;
  dayOfWeek: number;
  month: number;
  amountVaries: boolean;
  withAdvance: boolean;
  advanceDay: number;
  advanceAmount: string;
  startThisMonth: boolean;
  startsOn: string;
  endsOn: string;
}

/**
 * « Quand », which is where an entry becomes recurring: once, on a day
 * picked from the month, or regularly, on a rhythm and a day. The rarer
 * settings wait behind « Plus d'options ».
 */
export function WhenPanel({
  kind,
  value,
  ink,
  onChange,
  pastThisMonth,
}: {
  kind: CategoryType;
  value: WhenState;
  ink: string;
  onChange: (patch: Partial<WhenState>) => void;
  /** The days this schedule has already passed this month, today included. */
  pastThisMonth: string[];
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label={t("entry.when")}
        value={value.recurring ? "repeats" : "once"}
        onChange={(answer) => onChange({ recurring: answer === "repeats" })}
        options={[
          { value: "once", label: t("entry.once") },
          { value: "repeats", label: t("entry.repeats") },
        ]}
      />
      {value.recurring ? (
        <Recurring
          kind={kind}
          value={value}
          ink={ink}
          onChange={onChange}
          pastThisMonth={pastThisMonth}
        />
      ) : (
        <Once value={value.occurredOn} ink={ink} onChange={onChange} />
      )}
    </div>
  );
}

function Once({
  value,
  ink,
  onChange,
}: {
  value: string;
  ink: string;
  onChange: (patch: Partial<WhenState>) => void;
}) {
  const t = useT();
  const today = todayIsoLocal();
  const quick = [
    { date: today, label: t("calendar.today") },
    { date: shiftIsoDate(today, -1), label: t("calendar.yesterday") },
    { date: shiftIsoDate(today, -2), label: t("entry.dayBefore") },
  ];
  return (
    <>
      <div
        role="radiogroup"
        aria-label={t("quickAdd.date")}
        className="flex flex-wrap gap-2"
      >
        {quick.map((option) => (
          <Chip
            key={option.date}
            label={option.label}
            selected={value === option.date}
            ink={ink}
            onClick={() => onChange({ occurredOn: option.date })}
          />
        ))}
      </div>
      <MonthGrid
        value={value}
        today={today}
        ink={ink}
        onPick={(occurredOn) => onChange({ occurredOn })}
      />
    </>
  );
}

function MonthGrid({
  value,
  today,
  ink,
  onPick,
}: {
  value: string;
  today: string;
  ink: string;
  onPick: (date: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [shown, setShown] = useState(() => {
    const [year, month] = value.split("-").map(Number);
    return { year: year!, month: month! };
  });
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const isCurrent = shown.year === todayYear && shown.month === todayMonth;
  const length = new Date(shown.year, shown.month, 0).getDate();
  const lead = (new Date(shown.year, shown.month - 1, 1).getDay() + 6) % 7;
  const iso = (day: number) =>
    `${shown.year}-${String(shown.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, i) => ({
      day: i + 1,
      disabled: iso(i + 1) > today,
    })),
  ];
  const [pickedYear, pickedMonth, pickedDay] = value.split("-").map(Number);
  const step = (by: number) =>
    setShown(({ year, month }) => {
      const next = new Date(year, month - 1 + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={t("common.previousMonth")}
          onClick={() => step(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-foreground/5"
        >
          <CaretLeft size={ICON.md} />
        </button>
        <span className="text-sm font-semibold first-letter:uppercase">
          {`${monthLong(shown.month, locale)} ${shown.year}`}
        </span>
        <button
          type="button"
          aria-label={t("common.nextMonth")}
          disabled={isCurrent}
          onClick={() => step(1)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <CaretRight size={ICON.md} />
        </button>
      </div>
      <div
        aria-hidden
        className="mb-1 grid grid-cols-7 text-center text-[11px] text-muted-foreground"
      >
        {weekdayShortMondayFirst(locale).map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <DayCells
        label={t("quickAdd.date")}
        cells={cells}
        ink={ink}
        selected={
          pickedYear === shown.year && pickedMonth === shown.month
            ? pickedDay!
            : null
        }
        marked={isCurrent ? todayDay : null}
        onPick={(day) => onPick(iso(day))}
      />
    </div>
  );
}

function Recurring({
  kind,
  value,
  ink,
  onChange,
  pastThisMonth,
}: {
  kind: CategoryType;
  value: WhenState;
  ink: string;
  onChange: (patch: Partial<WhenState>) => void;
  pastThisMonth: string[];
}) {
  const t = useT();
  const locale = useLocale();
  const [more, setMore] = useState(
    value.startsOn !== "" || value.endsOn !== "",
  );
  const days = Array.from({ length: 31 }, (_, i) => ({ day: i + 1 }));

  return (
    <>
      <div
        role="radiogroup"
        aria-label={t("recurring.rhythm")}
        className="flex flex-wrap gap-2"
      >
        {ENTRY_RHYTHMS.map((rhythm) => (
          <Chip
            key={rhythm}
            label={t(RHYTHM_KEY[rhythm])}
            selected={value.rhythm === rhythm}
            ink={ink}
            onClick={() => onChange({ rhythm })}
          />
        ))}
      </div>

      {value.rhythm === "weekly" ? (
        <div>
          <PanelHeading>{t("entry.whichDay")}</PanelHeading>
          <div
            role="radiogroup"
            aria-label={t("entry.whichDay")}
            className="grid grid-cols-7 gap-1"
          >
            {weekdayShortMondayFirst(locale).map((name, index) => (
              <Chip
                key={name}
                label={name}
                selected={value.dayOfWeek === index + 1}
                ink={ink}
                onClick={() => onChange({ dayOfWeek: index + 1 })}
                className="px-0"
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {value.rhythm === "yearly" || value.rhythm === "quarterly" ? (
            <div>
              <PanelHeading>
                {value.rhythm === "yearly"
                  ? t("entry.whichMonth")
                  : t("entry.startsMonth")}
              </PanelHeading>
              <div role="radiogroup" className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <Chip
                    key={month}
                    label={monthShort(month, locale)}
                    selected={value.month === month}
                    ink={ink}
                    onClick={() => onChange({ month })}
                    className="px-0"
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <PanelHeading>{t("entry.dayOfMonth")}</PanelHeading>
            <DayCells
              label={t("entry.dayOfMonth")}
              cells={days}
              selected={value.dayOfMonth}
              ink={ink}
              onPick={(dayOfMonth) => onChange({ dayOfMonth })}
            />
          </div>
        </>
      )}

      <div>
        <ToggleRow
          title={t("recurring.amountVaries")}
          hint={t("recurring.amountVariesHint")}
          checked={value.amountVaries}
          onChange={(amountVaries) => onChange({ amountVaries })}
        />
        {offersAdvance(kind, value.rhythm) ? (
          <ToggleRow
            title={t("recurring.advance")}
            hint={t("recurring.advanceHint")}
            checked={value.withAdvance}
            onChange={(withAdvance) => onChange({ withAdvance })}
          >
            {value.withAdvance ? (
              <div className="fade-in mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={t("recurring.advanceAmount")}
                  placeholder={t("recurring.advanceAmount")}
                  value={value.advanceAmount}
                  onChange={(event) =>
                    onChange({ advanceAmount: event.target.value })
                  }
                  className={cn(
                    FIELD,
                    "focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  {t("recurring.advanceDay")}
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={value.advanceDay}
                    onChange={(event) =>
                      onChange({
                        advanceDay: Math.min(
                          31,
                          Math.max(1, Number(event.target.value) || 1),
                        ),
                      })
                    }
                    className={cn(FIELD, "w-16 px-2 text-center tabular-nums")}
                  />
                </label>
              </div>
            ) : null}
          </ToggleRow>
        ) : null}
        {pastThisMonth.length > 0 ? (
          <ToggleRow
            title={t("recurring.startThisMonth")}
            hint={t("recurring.startThisMonthHint", {
              count: pastThisMonth.length,
              dates: formatOccurrenceDates(pastThisMonth, locale),
            })}
            checked={value.startThisMonth}
            onChange={(startThisMonth) => onChange({ startThisMonth })}
          />
        ) : null}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((open) => !open)}
          className="flex min-h-9 items-center gap-1.5 text-[13px] font-medium"
        >
          {more ? t("entry.fewerOptions") : t("entry.moreOptions")}
          {more ? <CaretUp size={ICON.sm} /> : <CaretDown size={ICON.sm} />}
        </button>
        {more ? (
          <div className="fade-in mt-2 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              {t("recurring.activePeriodNote")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                {t("recurring.startsOn")}
                <input
                  type="date"
                  value={value.startsOn}
                  onChange={(event) =>
                    onChange({ startsOn: event.target.value })
                  }
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                {t("recurring.endsOn")}
                <input
                  type="date"
                  value={value.endsOn}
                  onChange={(event) => onChange({ endsOn: event.target.value })}
                  className={FIELD}
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
  children,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-border py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Switch
          checked={checked}
          onChange={onChange}
          label={title}
          className="mt-0.5"
        />
      </div>
      {children}
    </div>
  );
}
