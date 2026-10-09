"use client";

import { ArrowRight, ChartBar, Fire, Flame, X } from "@phosphor-icons/react";
import { formatPercentLabel } from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { PlanCardFrame } from "@/components/marketing/mocks/planning";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import {
  ACTIVE_NAV,
  MobileShell,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";

/**
 * The month close, as a landing mock (`./frame.tsx`). It is not a screen of
 * its own: it is « Votre série » on the Plan, whose button opens the close
 * sheet — a dialog on a desktop, a sheet from the bottom on the phone. The
 * mock shows the moment worth showing, February just closed: what was kept,
 * the run going on, and the line no ledger could produce — what was spent
 * without ever being written down — as `MonthCloseSheet` draws it.
 *
 * `close.recordedOut` is the whole of what was recorded leaving, and the
 * sheet shows it in two: what was spent, and what was set aside.
 */

/** « Votre série »: the flame, the run, the last months, the next close. */
function RunCard() {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { close } = landingSampleFor(locale);
  // The six months before March, the last four kept.
  const chain = [9, 10, 11, 12, 1, 2].map((month, index) => ({
    month,
    won: index >= 2,
  }));
  return (
    <PlanCardFrame
      icon={<Flame size={14} weight="fill" />}
      title={t("futurePlan.runTitle")}
    >
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent shadow-[0_0_24px_rgb(236_178_94/0.35)]">
          <Flame size={28} weight="fill" className="text-primary" />
        </span>
        <div>
          <p className="font-head text-xl tabular-nums">
            {t("futurePlan.runCount", { count: close.streak })}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {t("futurePlan.runRecord", { count: close.streak })}
          </p>
        </div>
      </div>
      <ol className="flex items-end gap-2">
        {chain.map((row) => (
          <li
            key={row.month}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "block h-2 w-full rounded-full",
                row.won ? "bg-primary" : "bg-foreground/10",
              )}
            />
            <span className="text-xs text-muted-foreground">
              {monthShort(row.month, locale)}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-3 rounded-control border border-border p-3">
        <div>
          <p className="text-sm font-medium">
            {t("futurePlan.runKeep", { month: close.monthLabel })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("monthClose.inviteAllowance", {
              cap: euro(close.unrecordedCap),
            })}
          </p>
        </div>
        <span className="flex items-center gap-3 self-start rounded-full border border-primary-rim bg-primary py-1 pl-4 pr-1 text-sm font-medium text-primary-foreground">
          {t("monthClose.closeTheMonth")}
          <span className="flex size-[30px] items-center justify-center rounded-full bg-black/10">
            <ArrowRight size={16} />
          </span>
        </span>
      </div>
    </PlanCardFrame>
  );
}

/** « Vos mois »: what each closed month kept, as bars. */
function MonthsCard() {
  const t = useT();
  const locale = useLocale();
  const kept = [640, 880, 410, 950, 720, 1076];
  const peak = Math.max(...kept);
  return (
    <PlanCardFrame
      icon={<ChartBar size={14} weight="fill" />}
      title={t("futurePlan.monthsTitle")}
    >
      <div className="flex h-36 items-end gap-1.5">
        {kept.map((value, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "w-full rounded-t-[4px]",
                index === kept.length - 1 ? "bg-primary" : "bg-foreground/20",
              )}
              style={{ height: `${(value / peak) * 100}%` }}
            />
            <span className="text-[0.6875rem] text-muted-foreground">
              {monthShort([9, 10, 11, 12, 1, 2][index]!, locale)}
            </span>
          </div>
        ))}
      </div>
    </PlanCardFrame>
  );
}

/** The close sheet, February closed: what it kept and how it adds up. */
function ClosedSheet({ phone }: { phone: boolean }) {
  const t = useT();
  const locale = useLocale();
  const euro = useEuro();
  const { close } = landingSampleFor(locale);
  const spent = close.recordedOut - close.setAside;
  const rows = [
    { label: t("monthClose.cameIn"), value: close.recordedIn },
    { label: t("monthClose.recordedSpending"), value: spent },
    { label: t("monthClose.setAside"), value: close.setAside },
    { label: t("monthClose.neverRecorded"), value: close.unrecorded },
  ];
  return (
    <div
      className={cn(
        "relative z-10 w-full border border-border bg-background",
        phone ? "rounded-t-card border-b-0" : "max-w-xl rounded-control",
      )}
    >
      <header className="flex min-h-12 items-center justify-between border-b border-border bg-card px-4">
        <h2 className="font-head text-base">{close.monthLabel}</h2>
        <X size={20} />
      </header>
      <div className={cn("flex flex-col gap-4", phone ? "p-4" : "p-5")}>
        <div className="flex flex-col items-start gap-1">
          <p className="text-sm text-muted-foreground">
            {t("monthClose.keptIn", { month: close.monthLabel })}
          </p>
          <p className="font-serif text-3xl font-semibold tracking-tight tabular-nums text-primary">
            {euro(close.kept)}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("monthClose.keptRate", {
              rate: formatPercentLabel(close.keptRate, locale),
            })}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary">
            <Fire size={14} weight="fill" />
            {t("monthClose.runExtended", { count: close.streak })}
          </p>
        </div>
        <div className="rounded-control border border-border p-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 py-1.5"
            >
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="font-semibold tabular-nums">
                {euro(row.value)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("monthClose.insideAllowance", {
            cap: euro(close.unrecordedCap),
            spare: euro(close.unrecordedCap - close.unrecorded),
          })}
        </p>
        <div className="flex flex-col gap-2">
          <span className="flex h-11 w-full items-center justify-center rounded-control bg-primary text-sm font-medium text-primary-foreground">
            {t("monthClose.done")}
          </span>
          <span className="flex h-11 w-full items-center justify-center text-sm font-medium">
            {t("monthClose.reopen")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MonthCloseMock({ variant = "web" }: { variant?: Variant }) {
  if (variant === "mobile") {
    return (
      <MobileShell
        active={ACTIVE_NAV["month-close"]}
        overlay={
          <div className="flex size-full flex-col justify-end">
            <div className="absolute inset-0 bg-black/85" />
            <ClosedSheet phone />
          </div>
        }
      >
        <RunCard />
      </MobileShell>
    );
  }

  return (
    <WebShell
      active={ACTIVE_NAV["month-close"]}
      overlay={
        <div className="flex size-full items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85" />
          <ClosedSheet phone={false} />
        </div>
      }
    >
      <div className="grid grid-cols-2 items-start gap-4">
        <RunCard />
        <MonthsCard />
      </div>
    </WebShell>
  );
}
