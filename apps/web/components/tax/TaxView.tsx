"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from "motion/react";
import { CaretDown, Info } from "@phosphor-icons/react";
import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { EASE_STANDARD } from "@finance/core/motion";
import type {
  TaxBoxFigure,
  TaxBoxId,
  TaxBoxSource,
} from "@finance/core/tax-return";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useToast } from "@/components/layout/ToastProvider";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { setTaxBoxAction } from "@/lib/actions/tax";
import { GLASS_CARD } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { FIGURE } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

const SOURCE_KEYS: Record<
  Exclude<TaxBoxSource, "categories">,
  "tax.fromPer" | "tax.fromRentBare" | "tax.fromRentFurnished"
> = {
  per: "tax.fromPer",
  "rent-bare": "tax.fromRentBare",
  "rent-furnished": "tax.fromRentFurnished",
};

/**
 * « Déclaration de revenus »: one card a box, its amount counting up as it
 * arrives, its rows a press away, and — for the boxes a person fills with
 * their own categories — those categories as chips to file in or take out.
 * The year switches above, a pill sliding between them.
 */
export function TaxView({
  year,
  years,
  formsYear,
  rulesFormsYear,
  provisional,
  boxes,
  filed,
  categories,
}: {
  year: number;
  years: number[];
  /** The forms this year's income is declared on. */
  formsYear: number;
  /** The forms the boxes shown were read from. */
  rulesFormsYear: number;
  provisional: boolean;
  boxes: TaxBoxFigure[];
  /** Category id to the box it is filed in. */
  filed: Record<string, TaxBoxId>;
  categories: { id: string; name: string }[];
}) {
  const t = useT();

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="flex flex-col gap-6">
          <nav
            aria-label={t("tax.title")}
            className="flex gap-1 self-center rounded-full border border-border p-1"
          >
            {years.map((each) => (
              <Link
                key={each}
                href={`/tax?y=${each}`}
                aria-current={each === year ? "page" : undefined}
                className={cn(
                  "relative isolate rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-hover",
                  each === year
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {each === year ? (
                  <m.span
                    layoutId="tax-year"
                    className="absolute inset-0 -z-10 rounded-full bg-muted"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                ) : null}
                {t("tax.year", { year: each })}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-1 text-center">
            <p className="text-sm text-muted-foreground">
              {t("tax.intro", { year })}
            </p>
            <p className="text-xs text-muted-foreground">
              {provisional
                ? t("tax.provisional", {
                    forms: formsYear,
                    known: rulesFormsYear,
                  })
                : t("tax.forms", { forms: rulesFormsYear })}
            </p>
          </div>

          <Stagger className="grid gap-4 md:grid-cols-2">
            {boxes.map((box) => (
              <StaggerItem key={box.rule.id}>
                <TaxBox
                  box={box}
                  year={year}
                  filed={filed}
                  categories={categories}
                />
              </StaggerItem>
            ))}
          </Stagger>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={ICON.sm} className="mt-0.5 shrink-0" />
            {t("tax.footer")}
          </p>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

function TaxBox({
  box,
  year,
  filed,
  categories,
}: {
  box: TaxBoxFigure;
  year: number;
  filed: Record<string, TaxBoxId>;
  categories: { id: string; name: string }[];
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [mine, setMine] = useOptimistic(box.categoryIds);
  const { rule } = box;
  const words = `tax.boxes.${rule.id}` as const;

  function toggle(categoryId: string) {
    const filedHere = mine.includes(categoryId);
    startTransition(async () => {
      setMine(
        filedHere
          ? mine.filter((id) => id !== categoryId)
          : [...mine, categoryId],
      );
      const result = await setTaxBoxAction(
        categoryId,
        filedHere ? null : rule.id,
      );
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
      }
    });
  }

  return (
    <section
      className={cn(
        GLASS_CARD,
        "flex h-full flex-col gap-3 rounded-card p-card",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t(`${words}.label`)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(`${words}.rule`, {
              ceiling: rule.ceiling === null ? "" : format(rule.ceiling),
            })}
          </p>
          {rule.id === "7UD" && year === 2025 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("tax.note7UD2025")}
            </p>
          ) : null}
        </div>
        <span
          className="shrink-0 rounded-control border border-border px-2 py-0.5 font-mono text-sm font-semibold"
          title={rule.verify ? t("tax.verify") : undefined}
        >
          {rule.id}
          {rule.verify ? "*" : ""}
        </span>
      </header>

      <AnimatedAmount
        value={box.amount}
        format={format}
        className={cn(FIGURE, "block")}
      />

      {rule.source === "categories" ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            {categories.length > 0
              ? t("tax.categoriesHint")
              : t("tax.noCategory")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories
              .filter(
                (category) =>
                  !filed[category.id] ||
                  filed[category.id] === rule.id ||
                  mine.includes(category.id),
              )
              .map((category) => {
                const on = mine.includes(category.id);
                return (
                  <m.button
                    key={category.id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    aria-pressed={on}
                    onClick={() => toggle(category.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors duration-hover",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {category.name}
                  </m.button>
                );
              })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t(SOURCE_KEYS[rule.source])}
        </p>
      )}

      {box.rows.length > 0 ? (
        <div className="mt-auto">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t("tax.rows", { count: box.rows.length })}
            <m.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <CaretDown size={ICON.sm} />
            </m.span>
          </button>
          <AnimatePresence initial={false}>
            {open ? (
              <m.ul
                key="rows"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="mt-2 flex flex-col divide-y divide-border overflow-hidden rounded-control border border-border"
              >
                {box.rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {row.note || row.categoryName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatShortDate(row.occurredOn, locale)} ·{" "}
                        {row.categoryName}
                      </span>
                    </span>
                    <PrivateAmount className="shrink-0 tabular-nums">
                      {format(row.amount)}
                    </PrivateAmount>
                  </li>
                ))}
              </m.ul>
            ) : null}
          </AnimatePresence>
        </div>
      ) : (
        <p className="mt-auto text-xs text-muted-foreground">
          {t("tax.none", { year })}
        </p>
      )}
    </section>
  );
}
