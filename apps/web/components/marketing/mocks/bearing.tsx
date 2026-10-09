"use client";

import type { ReactNode } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { formatDayMonth } from "@finance/core/constants";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  MobileHero,
  MobileShell,
  MockCard,
  SpendSplit,
  type Variant,
  WebHero,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/** Le point, as a landing mock (`./frame.tsx`). */

/**
 * One of the Bearing's five cards.
 *
 * Collapsed it is its name on the left and its lead figure on the right, with
 * the label above the figure — a figure read before its label is a number the
 * eye has to hold while it finds out what it was. Passing `children` draws it
 * open, which is how the mock shows one card explaining itself without
 * needing the accordion's state.
 *
 * "This month" passes no label, exactly as `BearingCards` drops it there: the
 * headline a few pixels above has already said those words, and one figure
 * under one label twice reads as two figures that happen to agree.
 */
function BearingCard({
  name,
  label,
  value,
  valueClassName,
  compact = false,
  children,
}: {
  name: string;
  label?: string;
  value: string;
  valueClassName?: string;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <MockCard innerClassName={compact ? "px-4 py-3" : "px-5 py-4"}>
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "min-w-0 flex-1 font-medium",
            compact ? "text-sm" : "text-base",
          )}
        >
          {name}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {label ? (
            <span className="text-[10px] leading-none text-muted-foreground">
              {label}
            </span>
          ) : null}
          <span
            className={cn(
              "privacy-amount font-mono font-semibold tabular-nums",
              compact ? "text-sm" : "text-base",
              valueClassName,
            )}
          >
            {value}
          </span>
        </span>
        <CaretDown
          size={16}
          weight="bold"
          aria-hidden
          className={cn(
            "shrink-0",
            children ? "rotate-180 opacity-60" : "opacity-30",
          )}
        />
      </div>
      {children ? (
        <div className="mt-3 flex flex-col border-t border-border pt-3">
          {children}
        </div>
      ) : null}
    </MockCard>
  );
}

/** One figure inside an open card. */
function BearingRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "privacy-amount font-mono text-xs tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * « Il vous reste », the line under the two figures that opens « Puis-je me
 * permettre ? » — the app's `LeftToSpendLine`, with the sample's figure.
 */
function LeftToSpendLine({ compact }: { compact: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { leftToSpend } = landingSampleFor(locale);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-border",
        compact ? "px-3 py-2.5 text-xs" : "px-4 py-3 text-sm",
      )}
    >
      <span className="min-w-0 flex-1 text-muted-foreground">
        {t("leftToSpend.title")}{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {euro(leftToSpend.amount)}
        </span>{" "}
        {t("leftToSpend.untilPayDay", {
          date: formatDayMonth(leftToSpend.through, locale),
        })}
        {" · "}
        {t("leftToSpend.perDay", { amount: euro(leftToSpend.perDay) })}
      </span>
      <CaretRight size={14} className="shrink-0 text-muted-foreground" />
    </div>
  );
}

/**
 * The Bearing: two figures, then five cards.
 *
 * Replaces the Month mock, which drew a screen the app no longer has. Every
 * word in it comes out of the app's own catalogue — `bearing.headline.*`,
 * `bearing.cards.*`, `bearingFacts.*` — rather than being written here, so
 * the mock cannot describe the screen differently from the screen, and it is
 * in the reader's language for free.
 *
 * Each card leads with the first figure of its family, which is what
 * `bearing-facts.ts` puts there: net position for the accounts, the usual
 * unrecorded spending for the run, where the accounts land for the year
 * ahead, what went into the wallets for wallets.
 */
export function BearingMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { bearing } = sample;
  const compact = variant === "mobile";

  const cards = (
    <>
      <BearingCard
        compact={compact}
        name={t("bearing.cards.month")}
        value={euro(bearing.free)}
        valueClassName="text-primary-ink"
      >
        <BearingRow
          label={t("bearingFacts.committed")}
          value={`−${euro(bearing.committed)}`}
          valueClassName="text-destructive"
        />
        <BearingRow
          label={t("bearingFacts.arriving")}
          value={`+${euro(bearing.arriving)}`}
          valueClassName="text-success"
        />
        <BearingRow
          label={t("bearingFacts.savingsRate")}
          value={`${bearing.savingsRate} %`}
        />
        {/* One of the blocks the month panel actually draws. Web only: the
            phone frame is 360×800 and already carries two hero figures above
            five cards, so the strip is what gives way rather than the
            figures. */}
        {compact ? null : (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              {t("marketingMock.whereItWent")}
            </p>
            <SpendSplit compact />
          </div>
        )}
      </BearingCard>
      <BearingCard
        compact={compact}
        name={t("bearing.cards.now")}
        label={t("bearingFacts.netPosition")}
        value={euro(bearing.netPosition)}
      />
      <BearingCard
        compact={compact}
        name={t("bearing.cards.run")}
        label={t("bearingFacts.unrecordedBaseline")}
        value={euro(bearing.unrecordedBaseline)}
      />
      <BearingCard
        compact={compact}
        name={t("bearing.cards.ahead")}
        label={t("bearingFacts.projectedBalanceBare")}
        value={euro(bearing.projectedBalance)}
      />
      <BearingCard
        compact={compact}
        name={t("bearing.cards.wallet")}
        label={t("bearingFacts.walletCost")}
        value={euro(sample.portfolioInvested)}
      />
    </>
  );

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.bearing">
        {/* Stacked below md, side by side above it — the same rule
            `bearing/Headline` follows. */}
        <div className="flex flex-col gap-3 pb-1">
          <MobileHero
            label={t("bearing.headline.onHand")}
            amount={euro(bearing.onHand)}
          />
          <MobileHero
            label={t("bearing.headline.free")}
            amount={euro(bearing.free)}
            amountClassName="text-primary-ink"
          />
        </div>
        <LeftToSpendLine compact />
        {cards}
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.bearing">
      <div className="grid grid-cols-2 gap-6 pb-2">
        <WebHero
          label={t("bearing.headline.onHand")}
          amount={euro(bearing.onHand)}
        />
        <WebHero
          label={t("bearing.headline.free")}
          amount={euro(bearing.free)}
          amountClassName="text-primary-ink"
        />
      </div>
      <LeftToSpendLine compact={false} />
      <div className="flex flex-col gap-3">{cards}</div>
    </WebShell>
  );
}
