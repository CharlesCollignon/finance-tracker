"use client";

import { formatPercentLabel } from "@finance/core/constants";
import type { LoanPayment } from "@finance/core/loan-schedule";
import {
  PROGRESS_MARKS,
  type LoanProgress,
  type Ownership,
} from "@finance/core/property-progress";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { monthAndYear } from "./property-labels";

/**
 * A property's progress, drawn: how much of it is the user's, how far a
 * loan has come, and what this month's payment makes theirs.
 *
 * Neutral bars, as the Plan's milestones ahead are: gold means done
 * (DESIGN.md « Moments »), so only a mark already passed takes it. Each bar
 * grows from nothing as it arrives (`grow-in`), and reduced motion shows it
 * at its length.
 */

function percent(
  value: number,
  locale: Parameters<typeof formatPercentLabel>[1],
) {
  return formatPercentLabel(Math.round(value * 1000) / 10, locale);
}

/** « À vous / à la banque »: the user's part of a home that is theirs. */
export function OwnershipBar({
  ownership,
  detailed = false,
}: {
  ownership: Ownership;
  /** With the amounts under it, on the property's own page. */
  detailed?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const all = ownership.owed <= 0;
  const under = !all && ownership.yours <= 0;
  const yours = all
    ? t("property.ownershipAll")
    : t("property.ownershipYours", { share: percent(ownership.share, locale) });
  const bank = under
    ? t("property.ownershipUnder")
    : t("property.ownershipBank", {
        share: percent(1 - ownership.share, locale),
      });

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={all ? yours : `${yours} · ${bank}`}
        className="relative h-2 overflow-hidden rounded-full bg-foreground/10"
      >
        <div
          className="grow-in h-full rounded-full bg-foreground/70"
          style={{ width: `${ownership.share * 100}%` }}
        />
        {PROGRESS_MARKS.map((mark) => (
          <span
            key={mark}
            aria-hidden
            className="absolute inset-y-0 w-px bg-background/60"
            style={{ left: `${mark * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="font-medium">{yours}</span>
        {all ? null : <span className="text-muted-foreground">{bank}</span>}
      </div>
      {detailed && !all ? (
        <p className="privacy-sensitive text-xs tabular-nums text-muted-foreground">
          {t("property.ownershipAmounts", {
            yours: format(ownership.yours),
            owed: format(ownership.owed),
          })}
        </p>
      ) : null}
    </div>
  );
}

/** A loan's track: what is repaid, its marks, and what is left. */
export function LoanTrack({
  progress,
  inFine,
}: {
  progress: LoanProgress;
  inFine: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const end = progress.endsOn ? monthAndYear(progress.endsOn, locale) : null;

  if (inFine) {
    return end && progress.paymentsLeft > 0 ? (
      <p className="text-xs text-muted-foreground">
        {t("property.loanInFineTrack", { date: end })}
      </p>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="font-medium">
          {t("property.loanRepaidShare", {
            share: percent(progress.repaid, locale),
          })}
        </span>
        {end && progress.paymentsLeft > 0 ? (
          <span className="text-muted-foreground">
            {t("property.loanLeft", {
              count: progress.paymentsLeft,
              date: end,
            })}
          </span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.repaid * 100)}
        aria-label={t("property.loanRepaidShare", {
          share: percent(progress.repaid, locale),
        })}
        className="relative h-1.5 rounded-full bg-foreground/10"
      >
        <div
          className="grow-in h-full rounded-full bg-foreground/60"
          style={{ width: `${progress.repaid * 100}%` }}
        />
        {/* The marks: gold once passed, because passed means done. */}
        {PROGRESS_MARKS.map((mark) => (
          <span
            key={mark}
            aria-hidden
            className={cn(
              "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
              progress.passed.includes(mark)
                ? "bg-primary"
                : "bg-foreground/20",
            )}
            style={{ left: `${mark * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The next payment, as one bar: the principal it repays — what becomes the
 * user's — then its interest and insurance.
 */
export function PaymentBar({
  split,
}: {
  split: Pick<LoanPayment, "principal" | "interest" | "insurance">;
}) {
  const t = useT();
  const format = useFormatCurrency();
  const principal = Math.max(0, split.principal);
  const total = principal + split.interest + split.insurance;
  if (total <= 0) {
    return null;
  }
  const part = (value: number) => `${(value / total) * 100}%`;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        aria-hidden
        className="grow-in flex h-1.5 gap-0.5 overflow-hidden rounded-full"
      >
        <span
          className="rounded-full bg-foreground/70"
          style={{ width: part(principal) }}
        />
        <span
          className="rounded-full bg-foreground/30"
          style={{ width: part(split.interest) }}
        />
        {split.insurance > 0 ? (
          <span
            className="rounded-full bg-foreground/15"
            style={{ width: part(split.insurance) }}
          />
        ) : null}
      </div>
      <p className="privacy-sensitive text-xs tabular-nums text-muted-foreground">
        <span className="font-medium text-foreground">
          {t("property.paymentYours", { amount: format(principal) })}
        </span>
        {" · "}
        {t("property.paymentInterest", { amount: format(split.interest) })}
        {split.insurance > 0
          ? ` · ${t("property.paymentInsurance", {
              amount: format(split.insurance),
            })}`
          : ""}
      </p>
    </div>
  );
}
