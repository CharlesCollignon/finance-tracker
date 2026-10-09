"use client";

import { SECTOR_IDS, type SectorId } from "@finance/core/instrument-reading";
import { AXIS_COVERAGE_FLOOR } from "@finance/core/look-through";
import type { ReadSegment } from "@finance/core/month-read";
import { Card } from "@/components/ui/Card";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useLocale, useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import { INTL_LOCALES } from "@finance/core/i18n/locale";

/**
 * What the look-through is drawn with: its sections and lines, the part of
 * a portfolio not yet read, the tilt against the target, a read's words.
 */

/**
 * One group of holdings the shares on this page do not cover.
 *
 * Drawn only when it has something in it, which is the whole reason this is a
 * component rather than four copies: every group used to carry its own
 * `length > 0 ?` guard, one of them was missing, and the pooled list under
 * them re-listed everything a second time regardless. Bitcoin appeared three
 * times on one card.
 *
 * Each group says what it is, why, and — where there is one — what to do
 * about it. A group with no action says so by having no child, which is the
 * honest shape for crypto: there is nothing to press.
 */
export function Uncovered({
  when,
  icon,
  heading,
  body,
  rows,
  formatEuro,
  children,
}: {
  /**
   * Whether this group has anything to say.
   *
   * Stated by the caller rather than inferred from `rows` being empty,
   * because for one group the two come apart: the queue counts instruments
   * worth reading, which includes a reading old enough to retake, and such a
   * position is classified and so is not in this card's rows at all. Inferring
   * would have taken the only button on the card away in exactly the case
   * where pressing it does something.
   */
  when: boolean;
  icon?: React.ReactNode;
  heading: string;
  body: string;
  rows: { positionId: string; name: string; value: number }[];
  formatEuro: (amount: number) => string;
  children?: React.ReactNode;
}) {
  if (!when) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {icon ? (
          <span aria-hidden="true" className="shrink-0 text-muted-foreground">
            {icon}
          </span>
        ) : null}
        {heading}
      </h3>
      <p className="text-sm text-muted-foreground">{body}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li
            key={row.positionId}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0 truncate">{row.name}</span>
            <PrivateAmount className="shrink-0 text-muted-foreground">
              {formatEuro(row.value)}
            </PrivateAmount>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

/**
 * A sector's name in the reader's language.
 *
 * The ids are a closed vocabulary in core, because a reading is verified
 * against them; the words are here, with the rest of the app's voice. They
 * used to be an English-only record in core, which put "Consumer
 * discretionary" under a heading reading "Ce qu'il y a dedans".
 *
 * A row whose id is not one of the eleven keeps whatever label the
 * look-through gave it, rather than resolving to a key on screen.
 */
export function sectorLabel(
  t: ReturnType<typeof useT>,
  id: string,
  fallback: string,
): string {
  return (SECTOR_IDS as readonly string[]).includes(id)
    ? t(`lookThrough.sectorLabels.${id as SectorId}`)
    : fallback;
}

/**
 * Said out loud when a factsheet did not publish a full breakdown.
 *
 * The shares above are what was published, so they do not add up to the whole
 * fund — and a reader who assumes otherwise will read a 25%-technology
 * portfolio as a 25%-of-what-we-found one, which is a different claim. An
 * earlier version normalised the gap away and turned that same fund into a
 * reported 69% technology; this is the sentence that replaced it.
 */
export function PartialAxis({
  coverage,
  rows,
}: {
  coverage: number;
  rows: number;
}) {
  const t = useT();

  if (rows === 0 || coverage >= AXIS_COVERAGE_FLOOR) {
    return null;
  }

  return (
    <p className={cn(MICRO, "mt-2 text-[var(--warning)]")}>
      {t("lookThrough.caveats.partialAxis", {
        coverage: `${Math.round(coverage * 100)}%`,
      })}
    </p>
  );
}

/** A titled block, the shape every section on this page takes. */
export function Section({
  icon,
  title,
  action,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  tone?: "warning";
  children: React.ReactNode;
}) {
  return (
    <Card.Bezel
      className="w-full"
      innerClassName="flex w-full min-w-0 flex-col gap-4 p-5 md:p-6"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span
            className={cn(
              "shrink-0",
              tone === "warning"
                ? "text-[var(--warning)]"
                : "text-muted-foreground",
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 truncate">{title}</span>
        </h2>
        {action}
      </div>
      <div className="min-w-0">{children}</div>
    </Card.Bezel>
  );
}

/** A label and a figure on one line. */
export function Line({
  label,
  value,
  strong,
  money = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  /**
   * Whether the figure is an amount of the user's money, and so goes under
   * the privacy blur.
   *
   * Off by default because most of what this line carries is a charge ratio,
   * and a ratio is a property of the funds held rather than of how much is
   * held — blurring "0.22 %" hides nothing and makes a half-covered list look
   * broken. The euro cost those ratios come to is money, and says so.
   */
  money?: boolean;
}) {
  const figureClass = cn(
    "tabular-nums",
    strong ? "text-sm font-semibold" : "text-sm",
  );

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={money ? undefined : figureClass}>
        {money ? (
          <PrivateAmount className={figureClass}>{value}</PrivateAmount>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/**
 * A region's share, next to what the market weighs it at.
 *
 * The factor is the claim worth making. "Thirty per cent France" means
 * nothing on its own; "ten times the market's weight" is the sentence a
 * reader can act on, and it is what the data actually supports.
 */
export function Bias({
  label,
  share,
  factor,
}: {
  label: string;
  share: number;
  factor: number | null;
}) {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="flex flex-col">
      <span className="text-sm font-semibold tabular-nums">
        {Math.round(share * 100)}%
      </span>
      <span className={cn(MICRO, "text-muted-foreground")}>{label}</span>
      {factor !== null && factor > 0 ? (
        <span className={cn(MICRO, "text-muted-foreground")}>
          {/* Within a sixth of the market's weight is "in line": the
              reference itself is approximate, so a tighter claim than that
              would be precision the figure does not have. */}
          {Math.abs(factor - 1) < 0.15
            ? t("lookThrough.inLineWithMarket")
            : t("lookThrough.timesMarket", {
                factor: new Intl.NumberFormat(INTL_LOCALES[locale], {
                  maximumFractionDigits: factor < 10 ? 1 : 0,
                }).format(factor),
              })}
        </span>
      ) : null}
    </div>
  );
}

/** A claim, with the app's own figures spliced into it. */
export function Segments({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span
            key={index}
            title={segment.label}
            className="font-semibold tabular-nums"
          >
            {segment.display}
          </span>
        ),
      )}
    </>
  );
}
