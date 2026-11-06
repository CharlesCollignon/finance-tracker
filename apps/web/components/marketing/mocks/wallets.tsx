"use client";

import { ArrowsClockwise, Plus } from "@phosphor-icons/react";
import { formatSigned } from "@finance/core/amount-sign";
import { PRICE_RANGES } from "@finance/core/instrument-price-series";
import { formatSignedPercent } from "@finance/core/instrument-price-series";
import { accountShortName } from "@/components/finance/accounts/account-format";
import { Sparkline } from "@/components/finance/charts/Sparkline";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import {
  MobileHero,
  MobileShell,
  MockCard,
  MockTabs,
  type Variant,
  WebHero,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/** Placements, as a landing mock (`./frame.tsx`). */

/* ----------------------------------------------------------------- wallets */

/**
 * Placements' Comptes view with the PEA open, as the app draws it: the
 * three views and the quotes' refresh, the total, what is sent each month,
 * one pill per account, and the open account's figures and lines — each
 * with its price over the year.
 */
export function WalletsMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { portfolio, portfolioInvested, portfolioGain, wallets, pea } = sample;
  const open = wallets[0]!;
  const mobile = variant === "mobile";

  const views = (
    <div className="flex items-center justify-between gap-2">
      <MockTabs
        labels={[
          "nav.walletsPositions",
          "nav.walletsAnalysis",
          "nav.walletsLookThrough",
        ]}
        compact={mobile}
      />
      <span className="flex items-center rounded-control border border-border px-3 py-1.5 text-sm font-medium">
        <ArrowsClockwise
          size={14}
          weight="light"
          className={mobile ? undefined : "mr-2"}
        />
        {mobile ? null : t("wallets.refreshQuotes")}
      </span>
    </div>
  );

  const subtitle = (
    <p>
      <span className="tabular-nums">{euro(portfolioInvested)}</span>
      {` ${t("wallets.investedSuffix")} · `}
      <span className="font-mono font-medium tabular-nums text-success">
        {formatSigned(portfolioGain, euro)}
      </span>
    </p>
  );

  const funding = (
    <span className="flex items-baseline gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
      <span>{accountShortName(open.id, locale)}</span>
      <span className="font-mono font-medium text-foreground tabular-nums">
        {euro(pea.monthly)}
      </span>
      <span>{t("wallets.perMonth")}</span>
    </span>
  );

  const pills = (
    <div className="flex flex-wrap justify-center gap-2">
      {wallets.map((wallet) => (
        <span
          key={wallet.id}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-semibold",
            wallet.id === open.id
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground",
          )}
        >
          {accountShortName(wallet.id, locale)}
        </span>
      ))}
      <span className="flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground">
        <Plus size={12} weight="bold" />
        {t("accounts.add")}
      </span>
    </div>
  );

  const gain = open.value - open.invested;
  const panel = (
    <MockCard
      innerClassName={cn("flex flex-col", mobile ? "gap-3 p-4" : "gap-4 p-6")}
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-2">
        <Figure label={t("wallets.value")} value={euro(open.value)} />
        <Figure label={t("wallets.invested")} value={euro(open.invested)} />
        <Figure
          label={t("wallets.profitLoss")}
          value={formatSigned(gain, euro)}
          positive
        />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("wallets.positions")}
          </h3>
          <span className="flex items-center text-sm font-medium">
            <Plus size={14} weight="light" className="mr-1" />
            {t("position.addItem")}
          </span>
        </div>
        {mobile ? null : (
          <div className="mt-2 flex justify-end gap-2">
            <Segments
              labels={[t("wallets.orderByName"), t("wallets.orderByInvested")]}
              active={1}
            />
            <Segments
              labels={PRICE_RANGES.map((range) =>
                range === "ALL" ? t("wallets.rangeAll") : range,
              )}
              active={1}
            />
          </div>
        )}
        <ul
          className={cn(
            "mt-3 grid grid-cols-2",
            mobile ? "gap-2" : "gap-2.5 sm:grid-cols-3",
          )}
        >
          {pea.positions.map((position) => (
            <li key={position.symbol} className="min-w-0">
              <PositionTile position={position} />
            </li>
          ))}
        </ul>
      </div>
    </MockCard>
  );

  if (mobile) {
    return (
      <MobileShell active="nav.wallets">
        {views}
        <MobileHero
          label={t("accounts.total")}
          amount={euro(portfolio)}
          subtitle={subtitle}
        />
        <div className="flex justify-center">{funding}</div>
        {pills}
        {panel}
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.wallets">
      {views}
      <div className="flex flex-col items-center gap-5">
        <WebHero
          label={t("accounts.total")}
          amount={euro(portfolio)}
          subtitle={subtitle}
        />
        {funding}
        {pills}
      </div>
      {panel}
    </WebShell>
  );
}

/** A `SegmentedControl` at rest. */
function Segments({ labels, active }: { labels: string[]; active: number }) {
  return (
    <span
      className="grid rounded-full border border-border p-1"
      style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}
    >
      {labels.map((label, index) => (
        <span
          key={label}
          className={cn(
            "rounded-full px-3 py-1 text-center text-xs font-medium",
            index === active
              ? "bg-secondary text-foreground ring-1 ring-inset ring-hairline-strong"
              : "text-muted-foreground",
          )}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

/** One of the open wallet's three figures, as `Metric` draws it. */
function Figure({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate font-mono text-sm font-semibold tabular-nums",
          positive && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}

type Position = ReturnType<typeof landingSampleFor>["pea"]["positions"][number];

/** A holding of the wallet, as `InvestmentPositionTile` draws it. */
function PositionTile({ position }: { position: Position }) {
  const locale = useLocale();
  const t = useT();
  const euro = useEuro();
  const gain = position.value - position.invested;
  return (
    <div className="flex h-full min-w-0 flex-col gap-2 rounded-card border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold">
          {position.symbol.slice(0, 2)}
        </span>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-success">
          {formatSignedPercent(
            Math.round((gain / position.invested) * 10000) / 100,
            locale,
          )}
        </span>
      </div>
      <p className="line-clamp-2 text-xs font-semibold leading-tight">
        {position.name}
      </p>
      <div className="mt-auto min-w-0">
        <p className="truncate font-serif text-lg font-semibold tabular-nums tracking-[-0.03em]">
          {euro(position.value)}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {t("wallets.invested")} {euro(position.invested)}
        </p>
      </div>
      <Sparkline
        values={position.trend}
        height={20}
        fluid
        colorVar="--muted-foreground"
        className="opacity-60"
      />
    </div>
  );
}
