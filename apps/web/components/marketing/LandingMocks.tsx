"use client";

import type { ReactNode } from "react";
import { Eye, Plus } from "@phosphor-icons/react";
import { formatEuro } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { WEEKDAY_LABELS } from "@finance/core/calendar";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { Card } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import { APP_NAV_ITEMS, PROFILE_NAV_ITEM } from "@/lib/navigation";
import { progressTone } from "@/lib/progress-tone";
import type { LandingPageId } from "@/components/marketing/landing-copy";
import { landingSample } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";

type Variant = "web" | "mobile";

// ---------------------------------------------------------------------------
// Why these mocks are built the way they are
//
// A device frame is a box whose *rendered* size follows the page, but Tailwind's
// md:/lg: prefixes key off the page's viewport, not the frame. Reusing a
// responsive app component inside a phone-sized frame therefore activates its
// desktop breakpoint, and hand-writing "small" classes to compensate produces a
// picture of an app nobody ships.
//
// So each variant is authored once, at the real client's real size — 1200×700
// for the desktop screen, 360×800 for the phone — and MockViewport scales the
// whole thing like an image. Every class below is therefore a fixed size chosen
// for that design width, and none of them are responsive on purpose.
//
// The same reasoning rules out two components the app itself uses. ProgressRing
// is echarts, which would pull a charting runtime onto the marketing critical
// path and reads its colours from document.documentElement — which on these
// pages carries whatever theme the *app* is set to, not the dark one the
// marketing shell scopes. MockRing below is plain SVG and inherits its colour
// from the shell like everything else.
// ---------------------------------------------------------------------------

const WEB_WIDTH = 1200;
const WEB_HEIGHT = 700;
const MOBILE_WIDTH = 360;
const MOBILE_HEIGHT = 800;

/**
 * Renders a mock at its design size and lets an SVG viewBox scale it to
 * whatever the surrounding device frame happens to be.
 *
 * Hidden from assistive technology deliberately: this is a picture of an
 * interface, and reading out a fabricated ledger row by row helps nobody. The
 * surrounding copy carries the meaning.
 */
function MockViewport({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className="block size-full"
      aria-hidden
    >
      <foreignObject x={0} y={0} width={width} height={height}>
        <div
          className="flex overflow-hidden bg-background"
          style={{ width, height }}
        >
          {children}
        </div>
      </foreignObject>
    </svg>
  );
}

/* -------------------------------------------------------------- primitives */

/** Plain-SVG donut, in place of the app's echarts ring. See the note above. */
function MockRing({
  ratio,
  label,
  detail,
  colorVar = "--primary",
  size = 108,
}: {
  ratio: number;
  label: string;
  detail: string;
  colorVar?: string;
  size?: number;
}) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const danger = progressTone(clamped, false) === "danger";
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--hairline-strong)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={danger ? "var(--destructive)" : `var(${colorVar})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-base font-semibold tabular-nums">
          {Math.round(clamped * 100)}%
        </span>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium">{label}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

/** Centred KPI block, at the desktop mock's scale. */
function WebHero({
  label,
  amount,
  amountClassName,
  subtitle,
  status,
}: {
  label: string;
  amount: string;
  amountClassName?: string;
  subtitle?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-serif text-6xl font-semibold tracking-tight tabular-nums",
          amountClassName,
        )}
      >
        {amount}
      </p>
      {subtitle ? (
        <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
      {status ? <div className="mt-2 text-sm font-medium">{status}</div> : null}
    </div>
  );
}

/** The phone's one hero figure. Fraunces here only, exactly as on device. */
function MobileHero({
  label,
  amount,
  amountClassName,
  subtitle,
  status,
}: {
  label: string;
  amount: string;
  amountClassName?: string;
  subtitle?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 font-serif text-4xl font-semibold tabular-nums",
          amountClassName,
        )}
      >
        {amount}
      </p>
      {subtitle ? (
        <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
      ) : null}
      {status ? <div className="mt-2 text-sm font-medium">{status}</div> : null}
    </div>
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

/* ------------------------------------------------------------------ chrome */

/** Which nav entry the screen belongs under, so the mock's chrome agrees with
 * the screen it is showing. Month close has no nav entry of its own: it is met
 * on the dashboard, which is where the mock puts it. */
const ACTIVE_NAV: Record<LandingPageId, string> = {
  home: "Home",
  transactions: "Transaction",
  recurring: "Recurring",
  calendar: "Calendar",
  wallets: "Wallets",
  planning: "Planning",
  "month-close": "Home",
};

/** The real side nav's structure — logo band, primary action, then the same
 * APP_NAV_ITEMS the app renders, so the two can never drift apart. */
function WebSideNav({ active }: { active: string }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-[52px] shrink-0 items-center justify-center gap-2 border-b border-border px-5">
        <span className="h-6 w-6 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fdefb4,#dcbb7c_52%,#b68c42)]" />
        <span className="font-logo text-xl leading-none">Pluclair</span>
      </div>

      <div className="px-3 pt-3">
        <div className="flex min-h-10 items-center gap-3 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          <Plus size={18} weight="bold" />
          Add transaction
          <span className="ml-auto rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-normal">
            N
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {APP_NAV_ITEMS.map(({ label, icon: Icon }) => {
          const isActive = label === active;
          return (
            <span
              key={label}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm",
                isActive
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon size={18} weight={isActive ? "fill" : "regular"} />
              {label}
            </span>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-border p-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          C
        </span>
        <span className="text-sm text-muted-foreground">Charles</span>
      </div>
    </aside>
  );
}

/** Header band: the screen's title, the month it is showing, privacy toggle. */
function WebHeaderBand({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-border px-6">
      <h1 className="font-head text-xl leading-none">{title}</h1>
      <div className="flex items-center gap-3">
        {trailing}
        <span className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
          <Eye size={18} />
        </span>
      </div>
    </header>
  );
}

function MonthStepper({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
      <span className="text-muted-foreground">‹</span>
      {label}
      <span className="text-muted-foreground">›</span>
    </span>
  );
}

function WebShell({
  title,
  active,
  monthLabel,
  children,
}: {
  title: string;
  active: string;
  monthLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex size-full">
      <WebSideNav active={active} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WebHeaderBand
          title={title}
          trailing={monthLabel ? <MonthStepper label={monthLabel} /> : null}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/** The phone's bottom bar carries Profile alongside the six screens, for
 * thumb reach — the same BOTTOM_NAV_ITEMS split the app uses. */
function MobileTabBar({ active }: { active: string }) {
  const items = [...APP_NAV_ITEMS, PROFILE_NAV_ITEM];
  return (
    <nav className="flex h-14 shrink-0 items-stretch border-t border-border bg-background/95">
      {items.map(({ label, icon: Icon }) => {
        const isActive = label === active;
        return (
          <span
            key={label}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon size={19} weight={isActive ? "fill" : "regular"} />
            <span className="text-[9px] font-medium leading-none">{label}</span>
          </span>
        );
      })}
    </nav>
  );
}

function MobileShell({
  title,
  active,
  children,
}: {
  title: string;
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="flex size-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex items-center gap-2">
          <span className="h-[22px] w-[22px] shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fdefb4,#dcbb7c_52%,#b68c42)]" />
          <h1 className="font-head text-lg leading-none">{title}</h1>
        </div>
        <Eye size={18} className="text-muted-foreground" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-4">
        {children}
      </div>
      <MobileTabBar active={active} />
    </div>
  );
}

/* ------------------------------------------------------------------- home */

/** Where the month's spending went — the stacked bar plus its legend, shared
 * by both variants at different densities. */
function SpendSplit({ compact = false }: { compact?: boolean }) {
  const rows = landingSample.spendByCategory;
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-full",
          compact ? "h-2" : "h-2.5",
        )}
        aria-hidden
      >
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              width: `${(row.amount / total) * 100}%`,
              backgroundColor: `var(${row.colorVar})`,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.slice(0, compact ? 3 : 5).map((row) => (
          <li
            key={row.label}
            className={cn(
              "flex items-center justify-between gap-2",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: `var(${row.colorVar})` }}
                aria-hidden
              />
              {row.label}
            </span>
            <span className="font-mono tabular-nums">
              {formatEuro(row.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomeMock({ variant = "web" }: { variant?: Variant }) {
  const { remaining, income, spent, monthLabel, onBudgetLabel, budget, goal } =
    landingSample;
  const shortMonth = monthLabel.split(" ")[0];

  if (variant === "mobile") {
    return (
      <MobileShell title="Home" active="Home">
        <MockCard innerClassName="p-4">
          <MobileHero
            label={`Left in ${shortMonth}`}
            amount={formatEuro(remaining)}
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
        </MockCard>
        <MockCard innerClassName="p-4">
          <div className="flex justify-around gap-2">
            <MockRing
              ratio={budget.spent / budget.limit}
              label={budget.label}
              detail={`${formatEuro(budget.spent)} / ${formatEuro(budget.limit)}`}
              size={88}
            />
            <MockRing
              ratio={goal.saved / goal.target}
              label={goal.label}
              detail={`${formatEuro(goal.saved)} / ${formatEuro(goal.target)}`}
              colorVar="--info"
              size={88}
            />
          </div>
        </MockCard>
        <MockCard innerClassName="p-4">
          <p className="text-sm font-semibold">Where it went</p>
          <div className="mt-3">
            <SpendSplit compact />
          </div>
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell title="Home" active="Home" monthLabel={monthLabel}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-8 py-7">
            <WebHero
              label={`Left in ${monthLabel}`}
              amount={formatEuro(remaining)}
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
            <div className="mt-6 flex w-full justify-center gap-10 border-t border-border pt-6">
              <MockRing
                ratio={budget.spent / budget.limit}
                label={budget.label}
                detail={`${formatEuro(budget.spent)} / ${formatEuro(budget.limit)}`}
              />
              <MockRing
                ratio={goal.saved / goal.target}
                label={goal.label}
                detail={`${formatEuro(goal.saved)} / ${formatEuro(goal.target)}`}
                colorVar="--info"
              />
            </div>
          </MockCard>
        </div>
        <div className="col-span-4 flex flex-col gap-4">
          <MockCard innerClassName="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Wallets
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums">
                {formatEuro(landingSample.portfolio)}
              </p>
            </div>
            <ul className="flex flex-col gap-1.5">
              {landingSample.wallets.map((wallet) => (
                <li
                  key={wallet.label}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: `var(${wallet.colorVar})` }}
                      aria-hidden
                    />
                    {wallet.label}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatEuro(wallet.value)}
                  </span>
                </li>
              ))}
            </ul>
          </MockCard>
          <MockCard innerClassName="flex flex-1 flex-col gap-3 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Where it went
            </p>
            <SpendSplit />
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}

/* ----------------------------------------------------------- transactions */

function WebTransactionRow({
  item,
}: {
  item: (typeof landingSample.transactions)[number];
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2.5">
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

/** Real phone rows carry no icon chip — name and date left, amount right. */
function MobileTransactionRow({
  item,
}: {
  item: (typeof landingSample.transactions)[number];
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-2.5">
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
  const { remaining, income, spent, transactions, monthLabel } = landingSample;
  const rows = [...transactions].reverse();

  if (variant === "mobile") {
    return (
      <MobileShell title="Transactions" active="Transaction">
        <MockCard innerClassName="p-4">
          <MobileHero
            label="What's left"
            amount={`+${formatEuro(remaining)}`}
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
        <MockCard innerClassName="divide-y divide-border p-4">
          {rows.slice(0, 5).map((item) => (
            <MobileTransactionRow
              key={`${item.name}-${item.day}`}
              item={item}
            />
          ))}
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell title="Transactions" active="Transaction" monthLabel={monthLabel}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-6 py-6">
            <WebHero
              label="What's left"
              amount={`+${formatEuro(remaining)}`}
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
        </div>
        <div className="col-span-8">
          <MockCard innerClassName="divide-y divide-border px-3 py-1.5">
            {rows.map((item) => (
              <WebTransactionRow key={`${item.name}-${item.day}`} item={item} />
            ))}
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}

/* --------------------------------------------------------------- recurring */

/** "Monthly · day 5" / "Weekly · Friday" — the shape formatRecurrenceSchedule
 * produces, without importing the DB-shaped template type into a mock. */
const SCHEDULE_LABEL: Record<string, string> = {
  Salary: "Monthly · day 3",
  Rent: "Monthly · day 5",
  "PEA DCA": "Weekly · Friday",
  Netflix: "Monthly · day 15",
};

/** The share-priced template is the one worth pointing at: its amount comes
 * from a quote rather than a figure anyone typed. */
const SHARE_PRICED = "PEA DCA";

export function RecurringMock({ variant = "web" }: { variant?: Variant }) {
  const { templates, monthLabel } = landingSample;
  const monthlyImpact = templates
    .filter((template) => template.amount < 0)
    .reduce(
      (sum, template) =>
        sum +
        Math.abs(template.amount) *
          (template.frequency === "Weekly" ? 4.33 : 1),
      0,
    );

  if (variant === "mobile") {
    return (
      <MobileShell title="Recurring" active="Recurring">
        <MockCard innerClassName="flex flex-row items-center justify-between p-4">
          <p className="text-sm font-bold">Expected impact</p>
          <p className="font-mono text-lg font-bold tabular-nums">
            {formatEuro(monthlyImpact)}
          </p>
        </MockCard>
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <MockCard key={template.name} innerClassName="p-3">
              <p className="text-sm font-semibold">{template.name}</p>
              <p className="text-xs text-muted-foreground">
                {SCHEDULE_LABEL[template.name]}
                {template.name === SHARE_PRICED ? " · 1 share" : null}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span
                  className={cn(
                    "font-mono text-sm font-bold tabular-nums",
                    TYPE_AMOUNT_CLASS[template.type],
                  )}
                >
                  {template.amount >= 0 ? "+" : "−"}
                  {formatEuro(Math.abs(template.amount))}
                </span>
                <span className="rounded-full border border-primary-rim bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
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
    <WebShell title="Recurring" active="Recurring" monthLabel={monthLabel}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-6 py-6">
            <WebHero
              label="Expected impact per month"
              amount={formatEuro(monthlyImpact)}
              subtitle={<p>{templates.length} templates, all applied</p>}
            />
          </MockCard>
        </div>
        <div className="col-span-8">
          <MockCard innerClassName="divide-y divide-border px-3 py-1.5">
            {templates.map((template) => (
              <div
                key={template.name}
                className="flex items-center justify-between gap-3 px-2 py-3"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold">{template.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {SCHEDULE_LABEL[template.name]}
                    {template.name === SHARE_PRICED
                      ? " · 1 share at the current quote"
                      : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {template.name === SHARE_PRICED ? (
                    <Badge variant="outline" size="sm" className="rounded-full">
                      Share-priced
                    </Badge>
                  ) : null}
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      TYPE_AMOUNT_CLASS[template.type],
                    )}
                  >
                    {template.amount >= 0 ? "+" : "−"}
                    {formatEuro(Math.abs(template.amount))}
                  </span>
                  <Badge variant="surface" size="sm" className="rounded-full">
                    On
                  </Badge>
                </div>
              </div>
            ))}
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}

/* ---------------------------------------------------------------- calendar */

/** Monday-first weeks for the fixed sample month, with the leading and
 * trailing days of adjacent months dimmed — the real calendar's convention. */
function buildSampleWeeks(): {
  day: number;
  inMonth: boolean;
  isToday: boolean;
}[][] {
  const { year, month, today } = landingSample;
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();
  // getDay() is Sunday-first; the grid is Monday-first.
  const lead = (first.getDay() + 6) % 7;

  const cells: { day: number; inMonth: boolean; isToday: boolean }[] = [];
  for (let index = lead; index > 0; index -= 1) {
    cells.push({ day: daysInPrev - index + 1, inMonth: false, isToday: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, inMonth: true, isToday: day === today });
  }
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: trailing, inMonth: false, isToday: false });
    trailing += 1;
  }

  const weeks: (typeof cells)[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export function CalendarMock({ variant = "web" }: { variant?: Variant }) {
  const weeks = buildSampleWeeks();
  // Annotated because landingSample is `as const`: inferred from the entries
  // the key type would be the union of the sample's literal days, and the
  // grid asks about days that are not in it.
  const byDay = new Map<number, (typeof landingSample.transactions)[number]>(
    landingSample.transactions.map((item) => [item.day, item]),
  );
  const totals = landingSample.transactions.reduce(
    (acc, item) => {
      if (item.amount > 0) acc.income += item.amount;
      else acc.outflow += Math.abs(item.amount);
      return acc;
    },
    { income: 0, outflow: 0 },
  );
  const net = totals.income - totals.outflow;

  if (variant === "mobile") {
    return (
      <MobileShell title="Calendar" active="Calendar">
        <div className="flex gap-2">
          <MockCard innerClassName="flex flex-col items-center p-2">
            <p className="text-[11px] text-muted-foreground">In</p>
            <p className="font-mono text-sm font-bold tabular-nums text-success">
              +{formatEuro(totals.income)}
            </p>
          </MockCard>
          <MockCard innerClassName="flex flex-col items-center p-2">
            <p className="text-[11px] text-muted-foreground">Out</p>
            <p className="font-mono text-sm font-bold tabular-nums text-destructive">
              −{formatEuro(totals.outflow)}
            </p>
          </MockCard>
          <MockCard innerClassName="flex flex-col items-center p-2">
            <p className="text-[11px] text-muted-foreground">Net</p>
            <p className="font-mono text-sm font-bold tabular-nums">
              {formatEuro(net)}
            </p>
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
            const item = cell.inMonth ? byDay.get(cell.day) : undefined;
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
                {item ? (
                  <span
                    className={cn(
                      "font-mono text-[8px] font-medium tabular-nums",
                      item.amount > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {item.amount > 0 ? "+" : "−"}
                    {Math.round(Math.abs(item.amount))}
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
    <WebShell
      title="Calendar"
      active="Calendar"
      monthLabel={landingSample.monthLabel}
    >
      <div className="flex gap-4">
        <MockCard innerClassName="flex flex-1 flex-col items-center px-5 py-3">
          <p className="text-xs text-muted-foreground">In</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-success">
            +{formatEuro(totals.income)}
          </p>
        </MockCard>
        <MockCard innerClassName="flex flex-1 flex-col items-center px-5 py-3">
          <p className="text-xs text-muted-foreground">Out</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-destructive">
            −{formatEuro(totals.outflow)}
          </p>
        </MockCard>
        <MockCard innerClassName="flex flex-1 flex-col items-center px-5 py-3">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {formatEuro(net)}
          </p>
        </MockCard>
      </div>
      <MockCard className="flex-1" innerClassName="flex h-full flex-col p-3">
        <div className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="pb-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {weeks.map((week, weekIndex) => (
            <div
              key={weekIndex}
              className="grid flex-1 grid-cols-7 border-t border-border/40"
            >
              {week.map((cell, cellIndex) => {
                const item = cell.inMonth ? byDay.get(cell.day) : undefined;
                return (
                  <div
                    key={cellIndex}
                    className={cn(
                      "flex flex-col items-stretch border-r border-border/40 p-1.5 last:border-r-0",
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
                    {item ? (
                      <span
                        className={cn(
                          "mt-1 font-mono text-[10px] font-medium tabular-nums",
                          item.amount > 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {item.amount > 0 ? "+" : "−"}
                        {formatEuro(Math.abs(item.amount))}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </MockCard>
    </WebShell>
  );
}

/* ----------------------------------------------------------------- wallets */

export function WalletsMock({ variant = "web" }: { variant?: Variant }) {
  const { portfolio, portfolioInvested, portfolioGain, wallets } =
    landingSample;
  const total = wallets.reduce((sum, wallet) => sum + wallet.value, 0);

  const allocationBar = (
    <div className="h-2.5 w-full overflow-hidden rounded-full" aria-hidden>
      <div className="flex h-full w-full">
        {wallets.map((wallet) => (
          <div
            key={wallet.label}
            style={{
              width: `${(wallet.value / total) * 100}%`,
              backgroundColor: `var(${wallet.colorVar})`,
            }}
          />
        ))}
      </div>
    </div>
  );

  const legend = (
    <ul className="flex w-full flex-col gap-1.5">
      {wallets.map((wallet) => (
        <li
          key={wallet.label}
          className="flex items-center justify-between text-sm"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `var(${wallet.colorVar})` }}
              aria-hidden
            />
            {wallet.label}
          </span>
          <span className="font-mono tabular-nums">
            {formatEuro(wallet.value)}
          </span>
        </li>
      ))}
    </ul>
  );

  if (variant === "mobile") {
    return (
      <MobileShell title="Wallets" active="Wallets">
        <MockCard innerClassName="p-4">
          <p className="text-sm text-muted-foreground">Portfolio value</p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
            {formatEuro(portfolio)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono">{formatEuro(portfolioInvested)}</span>
            {" invested · "}
            <span className="font-mono text-success">
              +{formatEuro(portfolioGain)}
            </span>
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
    <WebShell title="Wallets" active="Wallets">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-8 py-7">
            <WebHero
              label="Market value"
              amount={formatEuro(portfolio)}
              subtitle={
                <p>
                  <span className="privacy-amount tabular-nums">
                    {formatEuro(portfolioInvested)}
                  </span>
                  {" invested · "}
                  <span className="privacy-amount font-mono font-medium tabular-nums text-success">
                    +{formatEuro(portfolioGain)}
                  </span>
                </p>
              }
            />
          </MockCard>
        </div>
        <div className="col-span-5">
          <MockCard innerClassName="flex h-full flex-col justify-center gap-4 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Allocation
            </p>
            {allocationBar}
            {legend}
          </MockCard>
        </div>
      </div>
    </WebShell>
  );
}

/* ---------------------------------------------------------------- planning */

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
      <MobileShell title="Planning" active="Planning">
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
    <WebShell title="Planning" active="Planning">
      <div className="grid grid-cols-2 gap-4">
        <MockCard innerClassName="flex h-full flex-col px-6 py-5">
          <p className="font-head text-base">Monthly budgets</p>
          <div className="mt-4 flex flex-col gap-4">
            <GoalBar
              label={budget.label}
              spent={budget.spent}
              limit={budget.limit}
            />
            <GoalBar label="Housing" spent={850} limit={900} />
            <GoalBar label="Everything else" spent={185} limit={400} />
          </div>
        </MockCard>
        <MockCard innerClassName="flex h-full flex-col px-6 py-5">
          <p className="font-head text-base">Savings goals</p>
          <div className="mt-4">
            <GoalBar
              label={goal.label}
              spent={goal.saved}
              limit={goal.target}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Save {formatEuro(goal.monthlyPace)}/month to reach this by{" "}
            {goal.targetLabel}.
          </p>
        </MockCard>
      </div>
    </WebShell>
  );
}

/* ------------------------------------------------------------- month close */

/** The reconciliation, laid out the way the close sheet lays it out: what the
 * account did, then the two figures only a balance can produce. */
function CloseLedger({ dense = false }: { dense?: boolean }) {
  const { close } = landingSample;
  const rows = [
    { label: "Opening balance", value: formatEuro(close.openingBalance) },
    { label: "Recorded in", value: `+${formatEuro(landingSample.income)}` },
    {
      label: "Recorded out",
      value: `−${formatEuro(landingSample.spent)}`,
    },
    { label: "Closing balance", value: formatEuro(close.closingBalance) },
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
  const { close } = landingSample;
  const capRatio = close.unrecorded / close.unrecordedCap;

  if (variant === "mobile") {
    return (
      <MobileShell title="Home" active="Home">
        <MockCard innerClassName="p-4">
          <MobileHero
            label={`Unrecorded in ${close.monthLabel.split(" ")[0]}`}
            amount={formatEuro(close.unrecorded)}
            amountClassName="text-primary-ink"
            subtitle={
              <p>under your {formatEuro(close.unrecordedCap)} allowance</p>
            }
            status={
              <span className="text-success">
                {close.streak} months in a row
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
            <p className="text-sm font-semibold">Kept</p>
            <p className="font-mono text-lg font-bold tabular-nums text-success">
              {formatEuro(close.kept)}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {close.keptRate}% of what came in
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

  return (
    <WebShell title="Home" active="Home" monthLabel={landingSample.monthLabel}>
      <MockCard innerClassName="flex items-center justify-between gap-6 px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-head text-lg">
              {landingSample.monthLabel} is ready to close
            </p>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {close.streak} in a row
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Stay under {formatEuro(close.unrecordedCap)} of unrecorded spending
            to keep the run going.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-3 rounded-full border border-primary-rim bg-primary py-1.5 pl-5 pr-1.5 text-sm font-medium text-primary-foreground">
          Close the month
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/10">
            →
          </span>
        </span>
      </MockCard>

      <div className="grid flex-1 grid-cols-12 gap-4">
        <div className="col-span-5">
          <MockCard innerClassName="flex h-full flex-col justify-center px-7 py-6">
            <WebHero
              label={`Unrecorded in ${close.monthLabel}`}
              amount={formatEuro(close.unrecorded)}
              amountClassName="text-primary-ink"
              subtitle={
                <p>under your {formatEuro(close.unrecordedCap)} allowance</p>
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
              Kept in {close.monthLabel.split(" ")[0]}
            </p>
            <p className="font-serif text-4xl font-semibold tabular-nums text-success">
              {formatEuro(close.kept)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {close.keptRate}% of what came in
            </p>
          </MockCard>
        </div>
        <div className="col-span-3">
          <MockCard innerClassName="flex h-full flex-col justify-center px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              How it reconciled
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

/* -------------------------------------------------------------- the router */

const PAGE_MOCKS: Record<LandingPageId, (variant: Variant) => ReactNode> = {
  home: (variant) => <HomeMock variant={variant} />,
  transactions: (variant) => <TransactionsMock variant={variant} />,
  recurring: (variant) => <RecurringMock variant={variant} />,
  calendar: (variant) => <CalendarMock variant={variant} />,
  wallets: (variant) => <WalletsMock variant={variant} />,
  planning: (variant) => <PlanningMock variant={variant} />,
  "month-close": (variant) => <MonthCloseMock variant={variant} />,
};

/** The right mock for a feature, at its design size, ready to be scaled by
 * whatever frame it is dropped into. */
export function FeatureMock({
  pageId,
  variant = "mobile",
}: {
  pageId: LandingPageId;
  variant?: Variant;
}) {
  return (
    <MockViewport
      width={variant === "web" ? WEB_WIDTH : MOBILE_WIDTH}
      height={variant === "web" ? WEB_HEIGHT : MOBILE_HEIGHT}
    >
      {PAGE_MOCKS[pageId](variant)}
    </MockViewport>
  );
}

export { ACTIVE_NAV };
