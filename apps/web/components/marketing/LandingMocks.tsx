"use client";

import type { ReactNode } from "react";
import { formatEuro } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { WEEKDAY_LABELS } from "@finance/core/calendar";
import { StatHero } from "@/components/finance/StatHero";
import { ProgressRing } from "@/components/finance/lazy-charts";
import { Card } from "@/components/retroui/Card";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { Badge } from "@/components/retroui/Badge";
import { progressTone } from "@/lib/progress-tone";
import FadeContent from "@/components/react-bits/FadeContent";
import CountUp from "@/components/react-bits/CountUp";
import {
  landingCopy,
  type LandingPageId,
} from "@/components/marketing/landing-copy";
import { landingSample } from "@/components/marketing/landing-sample";
import { usePrefersReducedMotion } from "@/components/marketing/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

type Variant = "web" | "mobile";

// ---------------------------------------------------------------------------
// A device frame is a fixed-size box, not a real viewport — Tailwind's
// md:/lg: prefixes key off the *page's* width, not the frame's rendered
// size, so any responsive class from a reused web component would activate
// at full desktop size even inside the small phone mock. Every "mobile"
// branch below therefore hand-builds fixed-size markup (matching the real
// native app's actual, non-responsive classes) instead of reusing web's
// StatHero at a size meant to flex with a real viewport.
// ---------------------------------------------------------------------------

function EuroCountUp({
  value,
  prefix = "",
}: {
  value: number;
  prefix?: string;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return (
      <>
        {prefix}
        {formatEuro(value)}
      </>
    );
  }
  return (
    <>
      {prefix}
      <CountUp
        from={0}
        to={value}
        separator=" "
        direction="up"
        duration={1}
        delay={0}
      />
      {" €"}
    </>
  );
}

function MockCard({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <Card.Bezel
      className={cn("w-full", className)}
      innerClassName={innerClassName}
    >
      {children}
    </Card.Bezel>
  );
}

/** Fixed-size replica of the native app's StatHero — Fraunces is reserved for
 * the Home hero only, exactly like the real mobile app. Never responsive:
 * this sits inside a static-size phone frame regardless of page viewport. */
function MobileHero({
  label,
  amount,
  toneClass,
  subtitle,
  status,
}: {
  label: string;
  amount: ReactNode;
  toneClass: string;
  subtitle?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-serif text-4xl font-semibold", toneClass)}>
        {amount}
      </p>
      {subtitle ? (
        <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
      {status ? <div className="mt-2 text-sm font-medium">{status}</div> : null}
    </div>
  );
}

/** Matches the real mobile Screen header (Text variant="title" = text-2xl font-bold). */
function MobileScreenTitle({ title }: { title: string }) {
  return <p className="text-2xl font-bold">{title}</p>;
}

function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col gap-3 bg-background px-4 pt-8 pb-6">
      {children}
    </div>
  );
}

function WebShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col gap-4 bg-background px-8 py-8">
      {children}
    </div>
  );
}

export function HomeMock({ variant = "web" }: { variant?: Variant }) {
  const { remaining, income, spent, monthLabel, onBudgetLabel, budget, goal } =
    landingSample;

  if (variant === "mobile") {
    return (
      <MobileShell>
        <p className="text-center font-logo text-lg leading-none">Pluclair</p>
        <MockCard innerClassName="p-4">
          <MobileHero
            label={`Left in ${monthLabel.split(" ")[0]}`}
            amount={<EuroCountUp value={remaining} />}
            toneClass="text-primary-ink"
            subtitle={
              <p>
                <span className="privacy-amount text-success tabular-nums">
                  {formatEuro(income)}
                </span>
                {" earned · "}
                <span className="privacy-amount text-destructive tabular-nums">
                  {formatEuro(spent)}
                </span>
                {" spent"}
              </p>
            }
            status={<span className="text-success">{onBudgetLabel}</span>}
          />
        </MockCard>
        <MockCard innerClassName="p-4">
          <div className="flex justify-around gap-2">
            <ProgressRing
              ratio={budget.spent / budget.limit}
              label={budget.label}
              detail={`${formatEuro(budget.spent)} / ${formatEuro(budget.limit)}`}
            />
            <ProgressRing
              ratio={goal.saved / goal.target}
              label={goal.label}
              detail={`${formatEuro(goal.saved)} / ${formatEuro(goal.target)}`}
              colorVar="--info"
              colorFallback="#60a5fa"
            />
          </div>
        </MockCard>
        <MockCard innerClassName="p-4">
          <p className="text-sm text-muted-foreground">Portfolio value</p>
          <p className="mt-1 font-mono text-2xl font-bold">
            {formatEuro(landingSample.portfolio)}
          </p>
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-8 py-8">
            <StatHero
              label={`Left in ${monthLabel}`}
              amount={<EuroCountUp value={remaining} />}
              amountClassName="text-primary-ink"
              subtitle={
                <p>
                  <span className="privacy-amount text-success tabular-nums">
                    {formatEuro(income)}
                  </span>
                  {" earned · "}
                  <span className="privacy-amount text-destructive tabular-nums">
                    {formatEuro(spent)}
                  </span>
                  {" spent"}
                </p>
              }
              status={<span className="text-success">{onBudgetLabel}</span>}
            />
            <div className="mt-6 flex w-full flex-wrap justify-center gap-6 border-t border-border pt-6">
              <ProgressRing
                ratio={budget.spent / budget.limit}
                label={budget.label}
                detail={`${formatEuro(budget.spent)} / ${formatEuro(budget.limit)}`}
              />
              <ProgressRing
                ratio={goal.saved / goal.target}
                label={goal.label}
                detail={`${formatEuro(goal.saved)} / ${formatEuro(goal.target)}`}
                colorVar="--info"
                colorFallback="#60a5fa"
              />
            </div>
          </MockCard>
        </div>
        <div className="col-span-4">
          <MockCard innerClassName="flex h-full flex-col justify-center gap-2 px-5 py-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Wallets
            </p>
            <p className="font-mono text-lg font-semibold">
              {formatEuro(landingSample.portfolio)}
            </p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {landingSample.wallets.map((w) => (
                <li
                  key={w.label}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: `var(${w.colorVar})` }}
                      aria-hidden
                    />
                    {w.label}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatEuro(w.value)}
                  </span>
                </li>
              ))}
            </ul>
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}

function WebTransactionRow({
  item,
}: {
  item: (typeof landingSample.transactions)[number];
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 px-1">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon
          icon={item.icon}
          className="h-9 w-9 shrink-0 rounded-[11px] border-0 bg-muted"
        />
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.dayLabel} · {item.meta}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "privacy-amount shrink-0 whitespace-nowrap font-mono text-sm font-medium tabular-nums",
          TYPE_AMOUNT_CLASS[item.type],
        )}
      >
        {item.amount >= 0 ? "+" : "−"}
        {formatEuro(Math.abs(item.amount))}
      </span>
    </div>
  );
}

/** Real mobile transaction rows have no category-icon chip — just name/date
 * on the left and the amount on the right. */
function MobileTransactionRow({
  item,
}: {
  item: (typeof landingSample.transactions)[number];
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-1">
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.dayLabel} · {item.meta}
        </p>
      </div>
      <span
        className={cn(
          "privacy-amount shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums",
          TYPE_AMOUNT_CLASS[item.type],
        )}
      >
        {item.amount >= 0 ? "+" : "−"}
        {formatEuro(Math.abs(item.amount))}
      </span>
    </div>
  );
}

export function TransactionsMock({ variant = "web" }: { variant?: Variant }) {
  const { remaining, income, spent, transactions } = landingSample;

  if (variant === "mobile") {
    const rows = [...transactions].reverse().slice(0, 5);
    return (
      <MobileShell>
        <MobileScreenTitle title="Transactions" />
        <MockCard innerClassName="p-4">
          <MobileHero
            label="What's left"
            amount={<EuroCountUp value={remaining} prefix="+" />}
            toneClass="text-success"
            subtitle={
              <p>
                <span className="privacy-amount text-success tabular-nums">
                  {formatEuro(income)}
                </span>
                {" in · "}
                <span className="privacy-amount text-destructive tabular-nums">
                  {formatEuro(spent)}
                </span>
                {" out"}
              </p>
            }
          />
        </MockCard>
        <MockCard innerClassName="divide-y divide-border p-4">
          {rows.map((item) => (
            <MobileTransactionRow
              key={`${item.name}-${item.day}`}
              item={item}
            />
          ))}
        </MockCard>
      </MobileShell>
    );
  }

  const rows = [...transactions].reverse();
  return (
    <WebShell>
      <MockCard innerClassName="flex flex-col items-center px-7 py-6">
        <StatHero
          label="What's left"
          amount={<EuroCountUp value={remaining} prefix="+" />}
          amountClassName="text-success"
          subtitle={
            <p>
              <span className="privacy-amount text-success tabular-nums">
                {formatEuro(income)}
              </span>
              {" in · "}
              <span className="privacy-amount text-destructive tabular-nums">
                {formatEuro(spent)}
              </span>
              {" out"}
            </p>
          }
        />
      </MockCard>
      <MockCard innerClassName="divide-y divide-border px-2 py-1">
        {rows.map((item) => (
          <WebTransactionRow key={`${item.name}-${item.day}`} item={item} />
        ))}
      </MockCard>
    </WebShell>
  );
}

/** "Monthly · day 5" / "Weekly · Friday" — matches formatRecurrenceSchedule's
 * real output shape without importing the DB-shaped template type. */
const SCHEDULE_LABEL: Record<string, string> = {
  Salary: "Monthly · day 3",
  Rent: "Monthly · day 5",
  "PEA DCA": "Weekly · Friday",
  Netflix: "Monthly · day 15",
};

export function RecurringMock({ variant = "web" }: { variant?: Variant }) {
  const { templates } = landingSample;
  const budgetMonthly = templates
    .filter((t) => t.amount < 0)
    .reduce(
      (sum, t) =>
        sum + Math.abs(t.amount) * (t.frequency === "Weekly" ? 4.33 : 1),
      0,
    );

  if (variant === "mobile") {
    return (
      <MobileShell>
        <MobileScreenTitle title="Recurring" />
        <MockCard innerClassName="flex-row items-center justify-between p-4">
          <p className="text-sm font-bold">Expected budget impact</p>
          <p className="font-mono text-lg font-bold">
            {formatEuro(budgetMonthly)}
          </p>
        </MockCard>
        <div className="flex flex-col gap-2">
          {templates.map((item) => (
            <MockCard key={item.name} innerClassName="p-3">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {SCHEDULE_LABEL[item.name]}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span
                  className={cn(
                    "font-mono text-sm font-bold tabular-nums",
                    TYPE_AMOUNT_CLASS[item.type],
                  )}
                >
                  {item.amount >= 0 ? "+" : "−"}
                  {formatEuro(Math.abs(item.amount))}
                </span>
                <span className="rounded-full border border-foreground bg-primary px-3 py-1 text-xs font-semibold">
                  On
                </span>
              </div>
            </MockCard>
          ))}
        </div>
      </MobileShell>
    );
  }

  return (
    <WebShell>
      <MockCard innerClassName="flex flex-col items-center px-7 py-6">
        <StatHero
          label="Expected budget impact"
          amount={formatEuro(budgetMonthly)}
        />
      </MockCard>
      <MockCard innerClassName="divide-y divide-border px-2 py-1">
        {templates.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between gap-3 py-3 px-2"
          >
            <div className="text-left">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {SCHEDULE_LABEL[item.name]}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "font-mono text-sm font-semibold tabular-nums",
                  TYPE_AMOUNT_CLASS[item.type],
                )}
              >
                {item.amount >= 0 ? "+" : "−"}
                {formatEuro(Math.abs(item.amount))}
              </span>
              <Badge variant="surface" size="sm" className="rounded-full">
                On
              </Badge>
            </div>
          </div>
        ))}
      </MockCard>
    </WebShell>
  );
}

/** Monday-first weeks for a fixed sample month, with leading/trailing days
 * from adjacent months dimmed — same convention as the real calendar. */
function buildSampleWeeks(): {
  day: number;
  inMonth: boolean;
  isToday: boolean;
}[][] {
  const { year, month, today } = landingSample;
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  let offset = firstOfMonth.getDay();
  offset = offset === 0 ? 6 : offset - 1;

  const cells: { day: number; inMonth: boolean; isToday: boolean }[] = [];
  for (let i = offset - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false, isToday: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, inMonth: true, isToday: day === today });
  }
  while (cells.length % 7 !== 0) {
    cells.push({
      day: cells.length - (offset + daysInMonth) + 1,
      inMonth: false,
      isToday: false,
    });
  }

  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function CalendarMock({ variant = "web" }: { variant?: Variant }) {
  const weeks = buildSampleWeeks();
  const byDay = new Map<number, (typeof landingSample.transactions)[number]>(
    landingSample.transactions.map((t) => [t.day, t]),
  );
  const monthTotals = landingSample.transactions.reduce(
    (acc, t) => {
      if (t.amount > 0) acc.income += t.amount;
      else acc.outflow += Math.abs(t.amount);
      return acc;
    },
    { income: 0, outflow: 0 },
  );
  const net = monthTotals.income - monthTotals.outflow;

  if (variant === "mobile") {
    return (
      <MobileShell>
        <MobileScreenTitle title="Calendar" />
        <div className="flex gap-2">
          <MockCard innerClassName="items-center p-2">
            <p className="text-xs text-muted-foreground">In</p>
            <p className="font-mono text-sm font-bold text-success">
              +{formatEuro(monthTotals.income)}
            </p>
          </MockCard>
          <MockCard innerClassName="items-center p-2">
            <p className="text-xs text-muted-foreground">Out</p>
            <p className="font-mono text-sm font-bold text-destructive">
              −{formatEuro(monthTotals.outflow)}
            </p>
          </MockCard>
          <MockCard innerClassName="items-center p-2">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="font-mono text-sm font-bold">{formatEuro(net)}</p>
          </MockCard>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="pb-1 text-center text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label.charAt(0)}
            </div>
          ))}
          {weeks.flat().map((cell, index) => {
            const tx = cell.inMonth ? byDay.get(cell.day) : undefined;
            return (
              <div
                key={index}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl border",
                  cell.isToday
                    ? "border-primary bg-primary/10"
                    : "border-border",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold leading-none",
                    !cell.inMonth && "text-muted-foreground/40",
                  )}
                >
                  {cell.day}
                </span>
                {tx ? (
                  <span
                    className={cn(
                      "font-mono text-[8px] font-medium tabular-nums",
                      tx.amount > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {tx.amount > 0 ? "+" : "−"}
                    {Math.round(Math.abs(tx.amount))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </MobileShell>
    );
  }

  return (
    <WebShell>
      <MockCard innerClassName="flex flex-col items-center px-7 py-6">
        <StatHero
          label={landingSample.monthLabel}
          amount={`${net >= 0 ? "+" : "−"}${formatEuro(Math.abs(net))}`}
          amountClassName={net < 0 ? "text-destructive" : "text-success"}
          subtitle={
            <p className="font-mono">
              <span className="privacy-amount text-success tabular-nums">
                {formatEuro(monthTotals.income)}
              </span>
              {" in · "}
              <span className="privacy-amount text-destructive tabular-nums">
                {formatEuro(monthTotals.outflow)}
              </span>
              {" out"}
            </p>
          }
        />
      </MockCard>
      <div className="grid grid-cols-7 border-b border-border/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        {weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            className="grid grid-cols-7 border-b border-border/40 last:border-b-0"
          >
            {week.map((cell, cellIndex) => {
              const tx = cell.inMonth ? byDay.get(cell.day) : undefined;
              return (
                <div
                  key={cellIndex}
                  className={cn(
                    "flex min-h-16 flex-col items-stretch border-r border-border/40 p-1.5 last:border-r-0",
                    cell.isToday && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-semibold leading-none",
                      !cell.inMonth && "text-muted-foreground/50",
                      cell.isToday && "text-primary-ink",
                    )}
                  >
                    {cell.day}
                  </span>
                  {tx ? (
                    <span
                      className={cn(
                        "mt-1 font-mono text-[10px] font-medium tabular-nums",
                        tx.amount > 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {tx.amount > 0 ? "+" : "−"}
                      {formatEuro(Math.abs(tx.amount))}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </WebShell>
  );
}

export function WalletsMock({ variant = "web" }: { variant?: Variant }) {
  const { portfolio, portfolioInvested, portfolioGain, wallets } =
    landingSample;
  const total = wallets.reduce((sum, w) => sum + w.value, 0);

  const allocationBar = (
    <div className="h-2.5 w-full overflow-hidden rounded-full" aria-hidden>
      <div className="flex h-full w-full">
        {wallets.map((w) => (
          <div
            key={w.label}
            style={{
              width: `${(w.value / total) * 100}%`,
              backgroundColor: `var(${w.colorVar})`,
            }}
          />
        ))}
      </div>
    </div>
  );

  const legend = (
    <ul className="flex w-full flex-col gap-1.5">
      {wallets.map((w) => (
        <li key={w.label} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `var(${w.colorVar})` }}
              aria-hidden
            />
            {w.label}
          </span>
          <span className="font-mono tabular-nums">{formatEuro(w.value)}</span>
        </li>
      ))}
    </ul>
  );

  if (variant === "mobile") {
    return (
      <MobileShell>
        <MobileScreenTitle title="Wallets" />
        <MockCard innerClassName="p-4">
          <p className="text-sm text-muted-foreground">Portfolio value</p>
          <p className="mt-1 font-mono text-3xl font-bold">
            {formatEuro(portfolio)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Invested{" "}
            <span className="font-mono">{formatEuro(portfolioInvested)}</span>
          </p>
        </MockCard>
        <MockCard innerClassName="flex flex-col gap-3 p-4">
          {allocationBar}
          {legend}
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell>
      <MockCard innerClassName="flex flex-col items-center gap-5 px-7 py-6">
        <StatHero
          label="Market value"
          amount={formatEuro(portfolio)}
          subtitle={
            <p>
              <span className="privacy-amount tabular-nums">
                {formatEuro(portfolioInvested)}
              </span>
              {" invested · "}
              <span className="privacy-amount font-mono font-medium text-success tabular-nums">
                +{formatEuro(portfolioGain)}
              </span>
            </p>
          }
        />
        <div className="w-full max-w-xs">{allocationBar}</div>
        <div className="w-full max-w-xs">{legend}</div>
      </MockCard>
    </WebShell>
  );
}

function GoalBar({
  label,
  spent,
  limit,
  over = false,
}: {
  label: string;
  spent: number;
  limit: number;
  over?: boolean;
}) {
  const ratio = Math.min(1, spent / limit);
  const tone = progressTone(ratio, over);
  return (
    <div>
      <div className="flex justify-between text-sm font-medium">
        <span>{label}</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            tone === "danger" && "text-destructive",
          )}
        >
          {formatEuro(spent)} / {formatEuro(limit)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--hairline-strong)]">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "danger" ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PlanningMock({ variant = "web" }: { variant?: Variant }) {
  const { budget, goal } = landingSample;

  if (variant === "mobile") {
    return (
      <MobileShell>
        <MobileScreenTitle title="Planning" />
        <MockCard innerClassName="p-4">
          <p className="text-sm font-bold">Monthly budgets</p>
          <div className="mt-3">
            <GoalBar
              label={budget.label}
              spent={budget.spent}
              limit={budget.limit}
            />
          </div>
        </MockCard>
        <MockCard innerClassName="p-4">
          <p className="text-sm font-bold">Savings goals</p>
          <div className="mt-3">
            <GoalBar
              label={goal.label}
              spent={goal.saved}
              limit={goal.target}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Save {formatEuro(goal.monthlyPace)}/month to reach this by{" "}
            {goal.targetLabel}.
          </p>
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell>
      <MockCard innerClassName="p-4">
        <p className="font-head text-base">Monthly budgets</p>
        <div className="mt-3">
          <GoalBar
            label={budget.label}
            spent={budget.spent}
            limit={budget.limit}
          />
        </div>
      </MockCard>
      <MockCard innerClassName="p-4">
        <p className="font-head text-base">Savings goals</p>
        <div className="mt-3">
          <GoalBar label={goal.label} spent={goal.saved} limit={goal.target} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Save {formatEuro(goal.monthlyPace)}/month to reach this by{" "}
          {goal.targetLabel}.
        </p>
      </MockCard>
    </WebShell>
  );
}

const PAGE_MOCKS: Record<LandingPageId, (variant: Variant) => ReactNode> = {
  home: (variant) => <HomeMock variant={variant} />,
  transactions: (variant) => <TransactionsMock variant={variant} />,
  recurring: (variant) => <RecurringMock variant={variant} />,
  calendar: (variant) => <CalendarMock variant={variant} />,
  wallets: (variant) => <WalletsMock variant={variant} />,
  planning: (variant) => <PlanningMock variant={variant} />,
};

/** Renders the right mock for a feature id at a given device variant. */
export function FeatureMock({
  pageId,
  variant = "mobile",
}: {
  pageId: LandingPageId;
  variant?: Variant;
}) {
  return PAGE_MOCKS[pageId](variant);
}

function MotionFade({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <FadeContent
      className={className}
      duration={0.6}
      delay={delay}
      threshold={0.15}
    >
      {children}
    </FadeContent>
  );
}

export function LandingHowItWorks() {
  return (
    <div className="flex flex-col items-center gap-12 text-center">
      <MotionFade>
        <h2 className="font-head text-sm font-medium text-muted-foreground">
          {landingCopy.how.heading}
        </h2>
      </MotionFade>
      {landingCopy.how.beats.map((beat, index) => (
        <MotionFade key={beat.title} className="max-w-md" delay={index * 0.08}>
          <h3 className="font-head text-xl tracking-tight md:text-2xl">
            {beat.title}
          </h3>
          <p className="mt-3 text-base text-muted-foreground">{beat.body}</p>
        </MotionFade>
      ))}
      <MotionFade className="max-w-md" delay={0.24}>
        <p className="text-sm text-muted-foreground">
          {landingCopy.how.footnote}
        </p>
      </MotionFade>
    </div>
  );
}
