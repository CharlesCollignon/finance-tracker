"use client";

import type { ReactNode } from "react";
import { ArrowsClockwise, Eye, Plus } from "@phosphor-icons/react";
import { formatEuro, formatPercent } from "@finance/core/constants";
import { Orb } from "@/components/brand/Orb";
import { Card } from "@/components/ui/Card";
import { APP_NAV_ITEMS, PROPERTY_NAV_ITEM } from "@/lib/navigation";
import {
  NOTCH_CENTRE_CLASS,
  NOTCH_ITEM_ACTIVE_CLASS,
  NOTCH_ITEM_CLASS,
  NOTCH_ITEM_IDLE_CLASS,
  NOTCH_PILL_CLASS,
  TOPBAR_END_CLASS,
  TOPBAR_START_CLASS,
} from "@/lib/nav-notch";
import { NotchWing } from "@/components/layout/NotchWing";
import type { LandingPageId } from "@/components/marketing/landing-copy";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import type { Key } from "@finance/core/i18n/t";

/**
 * What every landing mock is drawn in: the viewport that scales it, the
 * web and phone shells around it, and the figures formatted for the reader.
 * Each feature's screen is a file beside this one; `../LandingMocks.tsx`
 * picks the one a page shows.
 */

/**
 * Sample figures, formatted the way the reader's own would be.
 *
 * These mocks are the only money on the marketing site, and the point of
 * them is that the app looks like this — so a French visitor has to see
 * "3 200 €" and an English one "€3,200". A hook rather than a bare call
 * because the locale lives in context, and one per component rather than a
 * prop threaded through thirteen of them.
 */
export function useEuro(): (amount: number) => string {
  const locale = useLocale();
  return (amount: number) => formatEuro(amount, locale);
}

/**
 * The same for a rate: "33.6%" in English, "33,6 %" in French.
 *
 * Both halves are the language's — the decimal separator and the space before
 * the sign — so neither is written into the sentences that quote a rate.
 */
export function usePercent(): (value: number) => string {
  const locale = useLocale();
  const t = useT();
  return (value: number) =>
    t("units.percent", { value: formatPercent(value, locale) });
}

export type Variant = "web" | "mobile";

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
// It does not rule out the app's own marks, though it used to. The old
// progress ring was an echarts gauge that read its colours from
// document.documentElement — a charting runtime on the marketing critical
// path, keyed to whatever theme the *app* was set to rather than the dark one
// this shell scopes — so there was a hand-drawn twin here to avoid it. The
// ring and its twin are both gone now, but the rule stands: the app's own
// component, not a picture of it.
//
// The orb in both shells is the real `Orb` for the same reason. It used to be
// a flat gold radial-gradient disc, which was a second mark nobody would have
// remembered to recolour; when the sphere went warm, it did not.
//
// SpendStrip is still not reused, for a different reason: it picks its band
// colours by sorted index, while sample assigns each category an
// explicit token so the mock's colours match what the app shows for that kind
// of spending. It also has one density, and the phone frame needs a tighter
// one. SpendSplit below stays.
// ---------------------------------------------------------------------------

export const WEB_WIDTH = 1200;

export const WEB_HEIGHT = 700;

export const MOBILE_WIDTH = 360;

export const MOBILE_HEIGHT = 800;

/**
 * Renders a mock at its design size and lets an SVG viewBox scale it to
 * whatever the surrounding device frame happens to be.
 *
 * Hidden from assistive technology deliberately: this is a picture of an
 * interface, and reading out a fabricated ledger row by row helps nobody. The
 * surrounding copy carries the meaning.
 */
export function MockViewport({
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

/** Centred KPI block, at the desktop mock's scale. */
export function WebHero({
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
export function MobileHero({
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

export function MockCard({
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
 * the screen it is showing. These are the message keys APP_NAV_ITEMS holds
 * rather than the words it renders: the nav below highlights by matching, and
 * matching on a key survives both a reword and a change of language, where
 * matching on "Month" survived neither. Calendar has no slot of its own — it
 * is the Ledger seen by date — and neither the close nor the read is a
 * surface, so both borrow the one they are reached from. */
export const ACTIVE_NAV: Record<LandingPageId, Key> = {
  bearing: "nav.bearing",
  ledger: "nav.ledger",
  charges: "nav.charges",
  plan: "nav.plan",
  wallets: "nav.wallets",
  // Neither of these is a surface. The close and the read are both met on
  // Plan — the close card, its history and the projection live there — so
  // that is the nav entry their chrome lights.
  "month-close": "nav.plan",
  "month-read": "nav.plan",
  property: "nav.property",
  // Neither is a tab: Questions opens from the header's sparkle, and the tax
  // page from Profile. The chrome lights nothing; the title names the screen.
  questions: "ask.title",
  // The shared space is every screen under « Commun »; its mock is Le point.
  together: "nav.bearing",
  tax: "tax.title",
};

/** The bar's surfaces: Immobilier joins them on its own screen. */
function navFor(active: Key) {
  return active === PROPERTY_NAV_ITEM.labelKey
    ? [...APP_NAV_ITEMS, PROPERTY_NAV_ITEM]
    : APP_NAV_ITEMS;
}

/** The real top bar's structure — the wordmark, the notch holding the same
 * APP_NAV_ITEMS the app renders and the add button, then the refresh, the
 * blur and the avatar — drawn with the bar's own
 * class strings from `lib/nav-notch` and the same wings from
 * `components/layout/NotchWing`. Structure, colour and shape are all shared,
 * so the picture and the thing it is a picture of cannot drift; the side rail
 * this replaced shared only its geometry, and went on painting an active
 * state the app had dropped.
 *
 * Positioned over the top of `WebShell`'s pane, as the real bar is over the
 * page. The pill is still, because a picture has nowhere to slide from.
 *
 * The mock is 1200px wide, so it is drawn as the real bar is at that width:
 * every surface labelled, and the add button as the gold disc at the end of
 * the notch. */
function WebTopNav({ active }: { active: Key }) {
  const t = useT();
  return (
    <div className="absolute inset-x-0 top-0 z-10">
      <div className={TOPBAR_START_CLASS}>
        <span className="flex items-center gap-2">
          <Orb tone="mark" size="28px" className="shrink-0" />
          <span className="font-logo text-[1.5rem] leading-none">Pluclair</span>
        </span>
      </div>

      <nav className={NOTCH_CENTRE_CLASS}>
        <NotchWing side="start" />
        <NotchWing side="end" />
        {navFor(active).map(({ labelKey, icon: Icon }) => {
          const isActive = labelKey === active;
          return (
            <span
              key={labelKey}
              className={cn(
                NOTCH_ITEM_CLASS,
                isActive ? NOTCH_ITEM_ACTIVE_CLASS : NOTCH_ITEM_IDLE_CLASS,
              )}
            >
              {isActive ? <span className={NOTCH_PILL_CLASS} /> : null}
              <span className="relative flex items-center gap-2">
                <Icon size={18} weight={isActive ? "fill" : "light"} />
                {t(labelKey)}
              </span>
            </span>
          );
        })}
        <span className="ml-1 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus size={18} weight="bold" />
        </span>
      </nav>

      <div className={TOPBAR_END_CLASS}>
        <span className="flex size-11 items-center justify-center rounded-full text-muted-foreground">
          <ArrowsClockwise size={18} />
        </span>
        <span className="flex size-11 items-center justify-center rounded-full text-muted-foreground">
          <Eye size={18} />
        </span>
        <span className="flex size-11 items-center justify-center">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            C
          </span>
        </span>
      </div>
    </div>
  );
}

/** What is left of the page header on a desktop: the page's own controls,
 * which in these screenshots is only ever the Ledger's month. The title is
 * the notch's to say and the blur is in the top bar, as in the real
 * `PageHeader`, so a page with nothing of its own draws no band at all. */
function WebHeaderBand({ trailing }: { trailing: ReactNode }) {
  return (
    <header className="mx-auto flex h-[52px] w-full max-w-5xl shrink-0 items-center justify-end gap-4 px-6">
      {trailing}
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

export function WebShell({
  active,
  monthLabel,
  children,
}: {
  active: Key;
  monthLabel?: string;
  children: ReactNode;
}) {
  return (
    // The bezel, and the page as a rounded pane set into it — the real shell's
    // `.app-frame`, drawn as a padding and a radius because a picture does
    // not scroll and so has no reason to use the outline the real one needs.
    <div className="flex size-full bg-frame p-2">
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-background pt-[var(--shell-notch-height)]">
        <WebTopNav active={active} />
        {monthLabel ? (
          <WebHeaderBand trailing={<MonthStepper label={monthLabel} />} />
        ) : null}
        {/* The real app's column at this width, `PageContainer`'s `lg` step,
          rather than the whole frame: with no rail beside it, content left
          to fill 1200px would be drawn wider than the app ever draws it. */}
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-3">
          {children}
        </div>
      </div>
    </div>
  );
}

/** The phone's bottom bar: the surfaces alone, as the app draws them — the
 * account is in the page header. */
function MobileTabBar({ active }: { active: Key }) {
  const t = useT();
  const items = navFor(active);
  return (
    <nav className="flex h-14 shrink-0 items-stretch border-t border-border bg-background/95">
      {items.map(({ labelKey, icon: Icon }) => {
        const isActive = labelKey === active;
        return (
          <span
            key={labelKey}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5",
              // Foreground and a filled glyph, with
              // `components/layout/BottomNav.tsx`. `text-primary` here was the
              // accent spent on a state the step up from muted foreground and
              // the icon's weight already make unmistakable — the same reason
              // the gold wash came off the real bar.
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon size={19} weight={isActive ? "fill" : "light"} />
            <span className="text-[9px] font-medium leading-none">
              {t(labelKey)}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

export function MobileShell({
  active,
  children,
}: {
  active: Key;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex size-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Orb tone="mark" size="22px" className="shrink-0" />
          <h1 className="font-head text-lg leading-none">{t(active)}</h1>
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
export function SpendSplit({ compact = false }: { compact?: boolean }) {
  const sample = landingSampleFor(useLocale());
  const euro = useEuro();
  const rows = sample.spendByCategory;
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
            <span className="font-mono tabular-nums">{euro(row.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
