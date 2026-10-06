"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDots,
  ChartPieSlice,
  Fire,
  Receipt,
  TrendUp,
} from "@phosphor-icons/react";
import {
  formatDayMonth,
  formatMonthLabel,
  formatShortDate,
  monthSearchParams,
  shiftMonth,
} from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { balanceExplanation } from "@finance/core/month-balance";
import type { BankAttention } from "@finance/core/bank-attention";
import type { BearingMonth } from "@/lib/bearing/month";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { amountSign } from "@finance/core/amount-sign";
import { AttentionRow } from "@/components/finance/bearing/AttentionRow";
import { ArrivedCharges } from "@/components/finance/ArrivedCharges";
import { PurchasesToConfirm } from "@/components/finance/PurchasesToConfirm";
import { TransferToSend } from "@/components/finance/TransferToSend";
import { TransferInvite } from "@/components/finance/TransferInvite";
import { BankAttentionBanner } from "@/components/finance/bank/BankAttentionBanner";
import { ConnectBankInvite } from "@/components/finance/bank/ConnectBankInvite";
import { BalanceCurve } from "@/components/finance/bearing/BalanceCurve";
import { MonthPicker } from "@/components/layout/MonthPicker";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { buttonVariants } from "@/components/ui/Button";
import { GLASS_CARD, GLASS_HERO } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { FIGURE, FIGURE_HERO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";

/** How many charges still to come the card lists before "+N more". */
const UPCOMING_SHOWN = 4;

/**
 * The Bearing: one month, told in a few big cards.
 *
 * It used to be where everything stood on one day — two figures, then five
 * collapsible families of twenty-odd figures, each with a panel fetched on
 * the press. Most of it was true and almost none of it was what the screen is
 * opened for, which is two questions: what is on the account, and where the
 * month ends. So those lead, as big figures over the line that joins them,
 * and everything else is a card only when it has something to say.
 *
 * One month at a time, switched from the same control as the Ledger. A month
 * that has ended tells what it did; one ahead tells what its charges call
 * for; the month in progress tells both, joined at today.
 */
export function BearingMonthView({
  data,
  recapSlot,
  readSlot,
  bankInvite = false,
  bankAttention = null,
}: {
  data: BearingMonth;
  /** Whether to invite this reader to connect a bank, in the balance card. */
  bankInvite?: boolean;
  /** A connected bank about to stop, or stopped: shown above everything. */
  bankAttention?: BankAttention | null;
  /**
   * The week's recap, early in the week: streamed in like the read, and
   * nothing at all on the days it has nothing to show.
   */
  recapSlot?: ReactNode;
  /**
   * The month read, streamed in behind its own boundary: its facts are the
   * slowest thing on the page to gather, and the figures above it should not
   * wait for them.
   */
  readSlot?: ReactNode;
}) {
  const current = data.balance.period === "current";
  const past = data.balance.period === "past";
  const hasSpending = data.spending.total > 0;
  const hasMomentum = current && (data.run !== null || data.invested !== null);

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-5">
      <MonthPicker basePath="/bearing" className="self-center" />

      {bankAttention ? <BankAttentionBanner attention={bankAttention} /> : null}

      {data.attention.length > 0 ? (
        <AttentionRow attention={data.attention} />
      ) : null}

      {/* Before the figures, because answering one changes them: a salary
          confirmed as arrived stops being counted as still to come. */}
      {data.arrived ? (
        <section className={cn(GLASS_CARD, "rounded-card p-card")}>
          <ArrivedCharges proposals={data.arrived.proposals} />
        </section>
      ) : null}

      {/* The same kind of question, for what the bank cannot see. */}
      {data.purchases.length > 0 ? (
        <section className={cn(GLASS_CARD, "rounded-card p-card")}>
          <PurchasesToConfirm purchases={data.purchases} />
        </section>
      ) : null}

      {/* And what those purchases need sent before payday. */}
      {data.transfer ? (
        <section className={cn(GLASS_CARD, "rounded-card p-card")}>
          <TransferToSend transfer={data.transfer} />
        </section>
      ) : data.transferInvite ? (
        <section className={cn(GLASS_CARD, "rounded-card p-card")}>
          <TransferInvite invitation={data.transferInvite} />
        </section>
      ) : null}

      <Stagger
        // Replayed per month: a new month is a new set of figures arriving.
        key={`${data.year}-${data.month}`}
        // One column that may shrink below its content on a phone: a grid
        // with no columns sizes its one track to the widest thing in it.
        className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3"
        stagger={0.06}
      >
        <StaggerItem className="md:col-span-2 xl:col-span-3">
          <BalanceCard data={data} bankInvite={bankInvite} />
        </StaggerItem>

        {recapSlot ? (
          // Hidden while empty, so a week with no card leaves no gap.
          <StaggerItem className="empty:hidden md:col-span-2 xl:col-span-3">
            {recapSlot}
          </StaggerItem>
        ) : null}

        {data.empty ? (
          <StaggerItem className="md:col-span-2 xl:col-span-3">
            <SetUpCard />
          </StaggerItem>
        ) : null}

        {!data.empty && data.balance.period !== "future" ? (
          <StaggerItem>
            <SpentCard data={data} />
          </StaggerItem>
        ) : null}

        {!past && data.upcoming ? (
          <StaggerItem>
            <UpcomingCard data={data} />
          </StaggerItem>
        ) : null}

        {hasMomentum ? (
          <StaggerItem>
            <MomentumCard data={data} />
          </StaggerItem>
        ) : null}

        {hasSpending ? (
          <StaggerItem
            className={cn(
              "md:col-span-2",
              // Beside the spent card when nothing else shares the row.
              current ? "xl:col-span-3" : "xl:col-span-2",
            )}
          >
            <WhereItWentCard data={data} />
          </StaggerItem>
        ) : null}

        {readSlot ? (
          <StaggerItem className="md:col-span-2 xl:col-span-3">
            {readSlot}
          </StaggerItem>
        ) : null}
      </Stagger>
    </div>
  );
}

/* ------------------------------------------------------------ the shells */

/**
 * A card on this screen: glass over the lit ground, a small icon and title,
 * and — where there is a surface that explains its figures — a link there.
 * It lifts a pixel under the pointer; nothing else about it moves.
 */
function Card({
  icon,
  title,
  href,
  hrefLabel,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        GLASS_CARD,
        "flex h-full flex-col gap-4 rounded-card p-card",
        "transition-[transform,border-color] duration-hover",
        "hover:-translate-y-0.5 hover:border-foreground/20",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
            {icon}
          </span>
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            aria-label={hrefLabel ?? title}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
          >
            <ArrowRight size={ICON.md} />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** A signed difference, as a pill: up is green and down is red, with an arrow. */
function DeltaChip({ value, label }: { value: number; label: string }) {
  const format = useFormatCurrency();
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        up
          ? "bg-success/10 text-success"
          : "bg-destructive/10 text-destructive",
      )}
      title={label}
    >
      {up ? (
        <ArrowUpRight size={ICON.sm} weight="bold" />
      ) : (
        <ArrowDownRight size={ICON.sm} weight="bold" />
      )}
      <PrivateAmount className="tabular-nums">
        {`${up ? "+" : "−"}${format(Math.abs(value))}`}
      </PrivateAmount>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------ the balance */

function BalanceCard({
  data,
  bankInvite,
}: {
  data: BearingMonth;
  bankInvite: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { balance, source, upcoming } = data;
  const net = balance.basis === "net";
  const monthLabel = formatMonthLabel(data.year, data.month, locale);

  // The two figures, named by what they can claim.
  const figures = (() => {
    if (balance.period === "current") {
      return {
        left: {
          label: net ? t("bearingMonth.netSoFar") : t("bearingMonth.onAccount"),
          value: balance.today ?? 0,
        },
        right: {
          label: net
            ? t("bearingMonth.netByEnd")
            : t("bearingMonth.expectedEnd"),
          value: balance.end,
        },
        delta: (balance.end ?? 0) - (balance.today ?? 0),
      };
    }
    if (balance.period === "past") {
      return net
        ? { left: { label: t("bearingMonth.netMonth"), value: balance.end } }
        : {
            left: {
              label: t("bearingMonth.startedWith"),
              value: balance.start,
            },
            right: { label: t("bearingMonth.endedWith"), value: balance.end },
            delta: balance.end - balance.start,
          };
    }
    return net
      ? { left: { label: t("bearingMonth.netByEnd"), value: balance.end } }
      : {
          left: {
            label: t("bearingMonth.expectedStart"),
            value: balance.start,
          },
          right: { label: t("bearingMonth.expectedEnd"), value: balance.end },
          delta: balance.end - balance.start,
        };
  })();

  const caption =
    balance.period === "future"
      ? t("bearingMonth.plannedOnly")
      : net
        ? t("bearingMonth.netCaption")
        : source === "bank"
          ? t("bearingMonth.fromBank")
          : t("bearingMonth.fromClose");

  // Only for a balance. A month's running net dips below zero every month
  // before payday, and flagging that as the account's lowest point would be
  // an alarm about a figure that is not a balance at all.
  const lowest = balance.lowest;
  const showLowest =
    !net &&
    lowest !== null &&
    !past(balance) &&
    lowest.value < Math.min(balance.end, balance.today ?? balance.start);
  // Red only where a balance is below zero — an overdrawn account. A net
  // below zero is spending before income, which is most of every month.
  const overdrawn = (value: number) => !net && value < 0;

  return (
    <section
      className={cn(
        GLASS_CARD,
        GLASS_HERO,
        "flex flex-col gap-5 rounded-card p-card md:gap-6 md:p-8",
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {figures.left.label}
          </p>
          <AnimatedAmount
            value={figures.left.value}
            format={format}
            className={cn(
              FIGURE_HERO,
              "mt-2 block",
              overdrawn(figures.left.value) && "text-destructive",
            )}
          />
          <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
          {/* Native disclosure: keyboard, screen reader and the open state
              are the browser's. */}
          <details className="mt-1.5 text-xs text-muted-foreground">
            <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-4 transition-colors duration-hover hover:text-foreground [&::-webkit-details-marker]:hidden">
              {t("bearingMonth.how.title")}
            </summary>
            <p className="mt-2 max-w-prose leading-relaxed">
              {t(`bearingMonth.how.${balanceExplanation(balance, source)}`)}
            </p>
          </details>
        </div>

        {figures.right ? (
          <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
            <p className="text-sm font-medium text-muted-foreground">
              {figures.right.label}
            </p>
            <AnimatedAmount
              value={figures.right.value}
              format={format}
              className={cn(
                FIGURE,
                "block",
                overdrawn(figures.right.value) && "text-destructive",
              )}
            />
            {figures.delta !== undefined ? (
              <DeltaChip
                value={figures.delta}
                label={t("bearingMonth.fromToday", {
                  amount: format(figures.delta),
                })}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <BalanceCurve
        key={`${data.year}-${data.month}`}
        points={balance.points}
        outflows={data.outflows}
        today={balance.period === "current" ? data.today : null}
        format={format}
        label={t(
          net ? "bearingMonth.netChartLabel" : "bearingMonth.chartLabel",
          {
            month: monthLabel,
          },
        )}
      />

      {showLowest ||
      (upcoming && (upcoming.arriving > 0 || upcoming.leaving > 0)) ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {showLowest && lowest ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
                lowest.value < 0
                  ? "border-destructive/40 text-destructive"
                  : "border-border text-muted-foreground",
              )}
            >
              <PrivateAmount>
                {t(
                  balance.period === "current"
                    ? "bearingMonth.lowestAhead"
                    : "bearingMonth.lowest",
                  {
                    amount: format(lowest.value),
                    date: formatShortDate(lowest.date, locale),
                  },
                )}
              </PrivateAmount>
            </span>
          ) : null}
          {upcoming && upcoming.arriving > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
              <PrivateAmount>
                {t("bearingMonth.toComeIn", {
                  amount: format(upcoming.arriving),
                })}
              </PrivateAmount>
            </span>
          ) : null}
          {upcoming && upcoming.leaving > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-destructive"
              />
              <PrivateAmount>
                {t("bearingMonth.toGoOut", {
                  amount: format(upcoming.leaving),
                })}
              </PrivateAmount>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Where the real balance would be: the strongest place to offer it.
          Typing a balance by hand stays the alternative for anyone who would
          rather not connect a bank. */}
      {bankInvite && balance.period !== "future" ? (
        <div className="flex flex-col gap-2">
          <ConnectBankInvite surface="bearing" variant="card" />
          {net ? (
            <Link
              href="/plan"
              className="self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t("bankConnect.orEnterBalance")}
            </Link>
          ) : null}
        </div>
      ) : net && balance.period !== "future" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-dashed border-hairline-strong px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t("bearingMonth.setBalanceBody")}
          </p>
          <Link
            href="/plan"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("bearingMonth.setBalance")}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function past(balance: BearingMonth["balance"]): boolean {
  return balance.period === "past";
}

/* ------------------------------------------------------------ the spending */

function SpentCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { spent } = data;
  const current = data.balance.period === "current";
  const previous = shiftMonth(data.year, data.month, -1);
  const previousLabel = formatMonthLabel(previous.year, previous.month, locale);

  const comparison = (() => {
    if (spent.previous === null || spent.previous === 0) {
      return null;
    }
    const difference = spent.total - spent.previous;
    if (Math.abs(difference) < 1) {
      return {
        text: t("bearingMonth.spentSame", { month: previousLabel }),
        better: true,
      };
    }
    const amount = format(Math.abs(difference));
    const key =
      difference < 0
        ? current
          ? "bearingMonth.spentLessSoFar"
          : "bearingMonth.spentLess"
        : current
          ? "bearingMonth.spentMoreSoFar"
          : "bearingMonth.spentMore";
    return {
      text: t(key, { amount, month: previousLabel }),
      better: difference < 0,
    };
  })();

  const peak = Math.max(1, ...spent.trend.map((point) => point.total));
  const shownKey = `${data.year}-${String(data.month).padStart(2, "0")}`;

  return (
    <Card
      icon={<Receipt size={ICON.sm} weight="bold" />}
      title={t("bearingMonth.spent")}
      href={`/transactions${monthSearchParams(data.year, data.month)}`}
      hrefLabel={t("bearingMonth.seeInLedger")}
    >
      <AnimatedAmount
        value={spent.total}
        format={format}
        className={cn(FIGURE, "block")}
      />

      {comparison ? (
        <p
          className={cn(
            "text-sm",
            comparison.better ? "text-success" : "text-muted-foreground",
          )}
        >
          <PrivateAmount>{comparison.text}</PrivateAmount>
        </p>
      ) : null}

      {/* Six months of spending, this one lit and the rest in the background:
          one series, so emphasis rather than colour. */}
      <div className="mt-auto flex h-20 items-end gap-2" role="list">
        {spent.trend.map((point) => {
          const shown = point.monthKey === shownKey;
          return (
            <div
              key={point.monthKey}
              role="listitem"
              className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="sr-only">
                {`${point.label}: ${format(point.total)}`}
              </span>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute -top-7 whitespace-nowrap rounded-control bg-popover px-2 py-0.5 text-[0.6875rem] tabular-nums opacity-0",
                  "privacy-amount transition-opacity duration-hover group-hover:opacity-100",
                )}
              >
                {format(point.total)}
              </span>
              <span
                aria-hidden
                className={cn(
                  "w-full max-w-6 origin-bottom rounded-t-[4px] transition-colors duration-hover",
                  shown
                    ? "bg-primary"
                    : "bg-foreground/15 group-hover:bg-foreground/30",
                )}
                style={{
                  height: `${Math.max(4, (point.total / peak) * 100)}%`,
                }}
              />
              <span
                aria-hidden
                className={cn(
                  "text-[0.6875rem] uppercase",
                  shown ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {point.label.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WhereItWentCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const format = useFormatCurrency();
  const { spending } = data;
  const peak = Math.max(1, ...spending.top.map((entry) => entry.total));

  return (
    <Card
      icon={<ChartPieSlice size={ICON.sm} weight="bold" />}
      title={t("bearingMonth.whereItWent")}
      href="/history"
    >
      <ul className="flex flex-col gap-4">
        {spending.top.map((entry) => {
          // Against the month's largest, so the bars rank the categories.
          const ratio = entry.total / peak;
          return (
            <li key={entry.categoryId} className="flex items-center gap-3">
              <CategoryIcon
                icon={entry.icon}
                className="size-9 shrink-0 rounded-control border-0 bg-muted"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">
                    {entry.name}
                  </span>
                  <PrivateAmount className="shrink-0 text-sm tabular-nums">
                    {format(entry.total)}
                  </PrivateAmount>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="grow-in h-full rounded-full bg-foreground/40"
                    style={{ width: `${Math.min(100, ratio * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {spending.rest > 0 ? (
        <p className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("bearingMonth.everythingElse")}</span>
          <PrivateAmount className="tabular-nums">
            {format(spending.rest)}
          </PrivateAmount>
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------ what comes */

function UpcomingCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const upcoming = data.upcoming!;
  const shown = upcoming.charges.slice(0, UPCOMING_SHOWN);
  const more = upcoming.charges.length - shown.length;

  return (
    <Card
      icon={<CalendarDots size={ICON.sm} weight="bold" />}
      title={
        data.balance.period === "future"
          ? t("bearingMonth.plannedThisMonth")
          : t("bearingMonth.stillToCome")
      }
      href={`/transactions${monthSearchParams(data.year, data.month)}`}
      hrefLabel={t("bearingMonth.seeInLedger")}
    >
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("bearingMonth.nothingToCome")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((charge) => (
            <li key={charge.key} className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-control border border-dashed border-hairline-strong leading-none">
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    charge.awaited && "text-muted-foreground",
                  )}
                >
                  {Number(charge.occurredOn.slice(8, 10))}
                </span>
                <span className="mt-0.5 text-[0.625rem] uppercase text-muted-foreground">
                  {formatDayMonth(charge.occurredOn, locale).split(" ")[1]}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {charge.description?.trim() || charge.name}
                </span>
                {/* Its day is behind it and the bank has not brought it: it
                    is still to leave, but not coming up, and the date alone
                    would read as the card having fallen behind. */}
                {charge.awaited ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {t("ledger.awaited")}
                  </span>
                ) : null}
              </span>
              <PrivateAmount
                className={cn(
                  "shrink-0 text-sm tabular-nums",
                  TYPE_AMOUNT_CLASS[charge.type],
                )}
              >
                {`${amountSign(charge.type)}${format(charge.amount)}`}
              </PrivateAmount>
            </li>
          ))}
        </ul>
      )}
      {more > 0 ? (
        <p className="mt-auto text-xs text-muted-foreground">
          {t("bearingMonth.moreToCome", { count: more })}
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------ the run */

/**
 * What the month is adding up to beyond itself: the run of months closed
 * under the allowance, and what is invested.
 * The one card on the screen that keeps score, so it is the one that is
 * allowed to feel like it.
 */
function MomentumCard({ data }: { data: BearingMonth }) {
  const t = useT();
  const format = useFormatCurrency();

  return (
    <Card
      icon={<Fire size={ICON.sm} weight="bold" />}
      title={t("removal.momentumTitle")}
      href="/plan"
    >
      {data.run ? (
        <div className="flex items-center gap-3 rounded-control bg-accent px-3 py-2.5">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              data.run.streak > 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Fire size={ICON.lg} weight="fill" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {data.run.streak > 0
                ? t("bearingMonth.run", { count: data.run.streak })
                : t("bearingMonth.noRunYet")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("bearingMonth.runBody")}
              {data.run.best > data.run.streak
                ? ` · ${t("bearingMonth.bestRun", { count: data.run.best })}`
                : ""}
            </p>
          </div>
        </div>
      ) : null}

      {data.invested !== null ? (
        <Link
          href="/investments"
          className="mt-auto flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5 transition-colors duration-hover hover:bg-muted"
        >
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendUp size={ICON.md} />
            {t("bearingMonth.invested")}
          </span>
          <PrivateAmount className="text-sm font-semibold tabular-nums">
            {format(data.invested)}
          </PrivateAmount>
        </Link>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------ first visit */

function SetUpCard() {
  const t = useT();
  return (
    <section
      className={cn(
        GLASS_CARD,
        "flex flex-col items-start gap-3 rounded-card p-card md:flex-row md:items-center md:justify-between",
      )}
    >
      <div>
        <h2 className="text-base font-semibold">{t("month.setUpTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("month.setUpBody")}
        </p>
      </div>
      <Link
        href="/welcome"
        className={buttonVariants({ variant: "default", size: "sm" })}
      >
        {t("month.setUpCharges")}
      </Link>
    </section>
  );
}
