"use client";

import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  ACTIVE_NAV,
  MobileHero,
  MobileShell,
  MockCard,
  type Variant,
  WebHero,
  WebShell,
  useEuro,
  usePercent,
} from "@/components/marketing/mocks/frame";

/** The month close, as a landing mock (`./frame.tsx`). */

/* ------------------------------------------------------------- month close */

/** The reconciliation, laid out the way the close sheet lays it out: what the
 * account did, then the two figures only a balance can produce.
 *
 * The unrecorded row is the point of the panel and it used to be missing.
 * Without it the four rows were an equation with a term taken out — they
 * ran opening, in, out, closing, and the reader who added them up landed
 * somewhere other than the closing balance and concluded the mock could not
 * count. That row is the product: it is the line no ledger arithmetic can
 * produce and only a typed balance can, so the panel that promises to show
 * how it adds up has to show it.
 *
 * It is labelled with the close sheet's own word — `monthClose.neverRecorded`,
 * the label the real sheet puts on this line — rather than a second wording
 * invented for marketing.
 *
 * The middle two rows read `close.recordedIn` and `close.recordedOut`, which
 * are February's. They used to read `sample.income` and `sample.spent`, which
 * are March's and which March is nineteen days into. */
function CloseLedger({ dense = false }: { dense?: boolean }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { close } = sample;
  const rows = [
    {
      label: t("marketingMock.openingBalance"),
      value: euro(close.openingBalance),
    },
    {
      label: t("marketingMock.recordedIn"),
      value: `+${euro(close.recordedIn)}`,
    },
    {
      label: t("marketingMock.recordedOut"),
      value: `−${euro(close.recordedOut)}`,
    },
    {
      label: t("monthClose.neverRecorded"),
      value: `−${euro(close.unrecorded)}`,
    },
    {
      label: t("marketingMock.closingBalance"),
      value: euro(close.closingBalance),
    },
  ];

  return (
    <ul
      className={cn(
        "flex flex-col divide-y divide-border",
        dense ? "text-xs" : "text-sm",
      )}
    >
      {rows.map((row, index) => (
        <li
          key={row.label}
          className={cn(
            "flex items-center justify-between gap-3",
            dense ? "py-1.5" : "py-2",
            index === rows.length - 1 && "font-semibold",
          )}
        >
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-mono tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function MonthCloseMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();
  const sample = landingSampleFor(useLocale());
  const euro = useEuro();
  const percent = usePercent();
  const { close } = sample;
  const capRatio = close.unrecorded / close.unrecordedCap;

  if (variant === "mobile") {
    return (
      <MobileShell active={ACTIVE_NAV["month-close"]}>
        <MockCard innerClassName="p-4">
          <MobileHero
            label={t("marketingStat.unrecordedIn", {
              month: close.monthLabel.split(" ")[0]!,
            })}
            amount={euro(close.unrecorded)}
            amountClassName="text-primary-ink"
            subtitle={
              <p>
                {t("marketingStat.underAllowance", {
                  amount: euro(close.unrecordedCap),
                })}
              </p>
            }
            status={
              <span className="text-success">
                {t("marketingStat.monthsInARow", { count: close.streak })}
              </span>
            }
          />
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--hairline-strong)]">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(1, capRatio) * 100}%` }}
            />
          </div>
        </MockCard>
        <MockCard innerClassName="p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">{t("common.kept")}</p>
            <p className="font-mono text-lg font-bold tabular-nums text-success">
              {euro(close.kept)}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("marketingStat.ofWhatCameIn", {
              percent: percent(close.keptRate),
            })}
          </p>
        </MockCard>
        <MockCard innerClassName="p-4">
          <p className="text-sm font-semibold">{close.monthLabel}</p>
          <div className="mt-2">
            <CloseLedger dense />
          </div>
        </MockCard>
      </MobileShell>
    );
  }

  /* The Plan surface, not a "Month" one. This shell used to title itself
     after `nav.month`, a surface the app retired, so it named something that
     does not exist and lit nothing in the rail. Taking it off here left that
     key with no reader anywhere, and the catalogue's dead-key test said so,
     so the word went too. The close card, its history and the projection all live on
     Plan, which is where `ACTIVE_NAV` has said to put it all along.

     No month stepper either. Only the Ledger carries one — `TransactionsView`
     and `CalendarView` are the two `MonthPicker` call sites — and a stepper
     reading March above a card offering to close February was the loudest
     half of that collision. The card names its own month now, which is what
     the Plan's `RunCard` does: you close February from inside March, and the only
     month worth printing here is the one being closed. */
  return (
    <WebShell active={ACTIVE_NAV["month-close"]}>
      <MockCard innerClassName="flex items-center justify-between gap-6 px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-head text-lg">
              {t("marketingStat.readyToClose", { month: close.monthLabel })}
            </p>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {t("marketingStat.inARow", { count: close.streak })}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("marketingStat.keepTheRun", {
              amount: euro(close.unrecordedCap),
            })}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-3 rounded-full border border-primary-rim bg-primary py-1.5 pl-5 pr-1.5 text-sm font-medium text-primary-foreground">
          {t("monthClose.closeMonth", { month: sample.close.monthLabel })}
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/10">
            →
          </span>
        </span>
      </MockCard>

      <div className="grid flex-1 grid-cols-12 gap-4">
        <div className="col-span-5">
          <MockCard innerClassName="flex h-full flex-col justify-center px-7 py-6">
            <WebHero
              label={t("marketingStat.unrecordedIn", {
                month: close.monthLabel,
              })}
              amount={euro(close.unrecorded)}
              amountClassName="text-primary-ink"
              subtitle={
                <p>
                  {t("marketingStat.underAllowance", {
                    amount: euro(close.unrecordedCap),
                  })}
                </p>
              }
            />
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hairline-strong)]">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(1, capRatio) * 100}%` }}
              />
            </div>
          </MockCard>
        </div>
        <div className="col-span-4">
          <MockCard innerClassName="flex h-full flex-col justify-center gap-1 px-6 py-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {t("marketingStat.keptIn", {
                month: close.monthLabel.split(" ")[0]!,
              })}
            </p>
            <p className="font-serif text-4xl font-semibold tabular-nums text-success">
              {euro(close.kept)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("marketingStat.ofWhatCameIn", {
                percent: percent(close.keptRate),
              })}
            </p>
          </MockCard>
        </div>
        <div className="col-span-3">
          <MockCard innerClassName="flex h-full flex-col justify-center px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("marketingMock.howItAddsUp")}
            </p>
            <div className="mt-2">
              <CloseLedger dense />
            </div>
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}
