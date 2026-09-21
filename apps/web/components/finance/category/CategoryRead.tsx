"use client";

import { useState, useTransition } from "react";
import { PencilSimple, Sparkle } from "@phosphor-icons/react";
import type { CategoryFacts } from "@finance/core/category-facts";
import {
  renderCategoryRead,
  type CategoryRead as CategoryReadValue,
} from "@finance/core/category-read";
import type { ReadSegment } from "@finance/core/month-read";
import type { Locale } from "@finance/core/i18n/locale";
import { LOCALE_LABELS } from "@finance/core/i18n/locale";
import { writeCategoryReadAction } from "@/lib/actions/category-read";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/retroui/Button";
import { cn } from "@/lib/utils";
import { GLASS_CARD } from "@/lib/glass";
import { useFormatCurrency } from "@/lib/use-currency";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

interface CategoryReadProps {
  categoryId: string;
  categoryName: string;
  /** Null when nothing has been written for this category. */
  read: CategoryReadValue | null;
  /**
   * The category's current figures, labelled in the language the read was
   * written in. Null exactly when `read` is — there is nothing to render
   * against otherwise.
   */
  readFacts: CategoryFacts | null;
  /** The language the prose is in, which may not be the reader's. */
  readLocale: Locale;
  /** Too little recorded to be worth a read; the writer is not offered. */
  thin: boolean;
  writesLeft: number;
  /** Whether a writer exists on this deployment at all. */
  configured: boolean;
}

/**
 * A category, in words.
 *
 * `MonthRead`'s contract, narrowed to one category: the prose is a model's,
 * every figure in it is the app's, and `renderCategoryRead` substitutes the
 * app's own formatted value for each `{{fact:id}}` — which is what makes the
 * currency toggle and the privacy blur work on a written sentence.
 *
 * Rendered from the *current* figures rather than the ones stored with the
 * read, so a number here can never contradict the bars above it in the same
 * panel. What can age is the judgement, not the arithmetic.
 *
 * Said plainly rather than implied: this was written by a model. Not for
 * liability — a card that quietly suggests a person looked at this category
 * is the same class of small lie `MonthRead` already refuses to tell.
 */
export function CategoryRead({
  categoryId,
  categoryName,
  read,
  readFacts,
  readLocale,
  thin,
  writesLeft,
  configured,
}: CategoryReadProps) {
  const { toast } = useToast();
  const formatMoney = useFormatCurrency();
  const locale = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(writesLeft);

  const rendered =
    read && readFacts
      ? renderCategoryRead(read, readFacts, formatMoney, readLocale)
      : null;
  // Stated rather than smoothed over — see `MonthRead`'s own comment on this.
  const inAnotherLanguage = Boolean(rendered) && readLocale !== locale;

  // Nothing to show and nothing that could be written. No broken button on a
  // deployment with no model key.
  if (!configured && !rendered) {
    return null;
  }

  // A category with too little history is not worth offering a read of, and
  // the server refuses one anyway.
  if (!rendered && thin) {
    return null;
  }

  function write() {
    startTransition(async () => {
      const outcome = await writeCategoryReadAction(categoryId);
      setLeft(outcome.writesLeft);
      toast(
        outcome.message ??
          t("categoryRead.writtenToast", { category: categoryName }),
        outcome.written ? "success" : "error",
      );
    });
  }

  return (
    <section
      className={cn("flex flex-col gap-3 rounded-card p-card", GLASS_CARD)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkle size={ICON.sm} className="text-muted-foreground" />
          {t("categoryRead.title")}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t("categoryRead.subtitle")}
        </p>
      </div>

      {rendered ? (
        <ul className="flex flex-col gap-2">
          {rendered.observations.map((row, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  row.tone === "good"
                    ? "bg-success"
                    : row.tone === "watch"
                      ? "bg-destructive"
                      : "bg-muted-foreground",
                )}
              />
              <span className="min-w-0">
                <Segments segments={row.segments} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("categoryRead.empty")}
        </p>
      )}

      {rendered && rendered.suggestions.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-foreground/10 pt-2">
          {rendered.suggestions.map((row, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"
              />
              <span className="min-w-0">
                <Segments segments={row.segments} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 pt-2">
        <p className="text-xs text-muted-foreground">
          {inAnotherLanguage
            ? t("categoryRead.writtenInOtherLanguage", {
                language: LOCALE_LABELS[readLocale],
              })
            : null}
        </p>

        {configured ? (
          <Button
            type="button"
            onClick={write}
            disabled={pending || left <= 0}
            variant={left > 0 ? "default" : "ghost"}
            size="sm"
            className={cn(
              "shrink-0 gap-1.5 rounded-full",
              left <= 0 && "cursor-not-allowed text-muted-foreground",
            )}
          >
            <PencilSimple size={ICON.sm} />
            {pending
              ? t("categoryRead.writing")
              : left <= 0
                ? t("categoryRead.noReadsLeft")
                : rendered
                  ? t("categoryRead.writeAgain", { left })
                  : t("categoryRead.writeOne", { left })}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Prose and figures, interleaved. Identical to `MonthRead`'s own — see there
 * for why each figure gets its own element.
 */
function Segments({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <PrivateAmount
            key={index}
            title={segment.label}
            className="font-medium tabular-nums"
          >
            {segment.display}
          </PrivateAmount>
        ),
      )}
    </>
  );
}
