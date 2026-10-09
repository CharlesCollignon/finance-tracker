"use client";

import type { ReactNode } from "react";
import {
  ArrowClockwise,
  ArrowsClockwise,
  ArrowsLeftRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartLine,
  Compass,
  Eye,
  Flag,
  House,
  Plus,
  Repeat,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";
import { formatEuro } from "@finance/core/constants";
import { Orb } from "@/components/brand/Orb";
import { Card } from "@/components/ui/Card";
import { navItems, PROPERTY_NAV_ITEM } from "@/lib/navigation";
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
 * the screen it is showing. These are the message keys the nav items hold
 * rather than the words they render: the nav below highlights by matching, and
 * matching on a key survives both a reword and a change of language. Neither
 * the close nor the read is a surface, so both borrow the one they are met
 * on — the close's « Votre série » card is on Plan, the read is the last card
 * of Le point. Questions and the tax page are not surfaces either: they are
 * stack screens on the phone, so their key is the title the header says. */
export const ACTIVE_NAV: Record<LandingPageId, Key> = {
  bearing: "nav.bearing",
  ledger: "nav.ledger",
  charges: "nav.charges",
  plan: "nav.plan",
  wallets: "nav.wallets",
  "month-close": "nav.plan",
  "month-read": "nav.bearing",
  property: "nav.property",
  questions: "ask.title",
  // The shared space is every screen under « Commun »; its mock is the
  // Journal, where each row says who added it.
  together: "nav.ledger",
  tax: "tax.title",
};

/** The bar's surfaces, from the app's own `navItems`: Immobilier joins them
 * on its own screen, and under « Commun » Plan and Placements leave. */
function navFor(active: Key, space: boolean) {
  return navItems({
    property: active === PROPERTY_NAV_ITEM.labelKey,
    joint: space,
  });
}

/** The « Moi · Commun » switch, the shared space lit, as `OwnerSwitch` draws
 * it in the web bar and in place of the phone's title. */
function SpaceSwitch() {
  const t = useT();
  const { together } = landingSampleFor(useLocale());
  return (
    <span className="flex items-center rounded-full border border-border bg-muted/50 p-0.5 text-xs font-medium">
      <span className="flex h-7 items-center rounded-full px-3 text-muted-foreground">
        {t("space.mine")}
      </span>
      <span className="flex h-7 items-center gap-1.5 rounded-full bg-background px-3 shadow-sm ring-1 ring-border">
        <span className="relative flex h-4 items-center">
          {together.members.map((initial, index) => (
            <span
              key={initial}
              className={cn(
                "flex size-4 items-center justify-center rounded-full border border-background text-[8px] font-semibold leading-none text-background",
                index === 0 ? "bg-foreground" : "-ml-[5px] bg-muted-foreground",
              )}
            >
              {initial}
            </span>
          ))}
        </span>
        {together.name}
      </span>
    </span>
  );
}

/** The account chip at the end of both bars, as `UserInitial` draws it. */
function Initial({ size }: { size: "sm" | "md" }) {
  const { together } = landingSampleFor(useLocale());
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-muted font-head font-semibold",
        size === "sm" ? "size-6 text-[11px]" : "size-7 text-xs",
      )}
    >
      {together.members[0]}
    </span>
  );
}

/** The real top bar's structure — the wordmark (and, in the shared space,
 * the « Moi · Commun » switch), the notch holding the app's own `navItems`
 * and the add button, then « Questions », the refresh, the blur and the
 * avatar — drawn with the bar's own class strings from `lib/nav-notch` and
 * the same wings from `components/layout/NotchWing`, so the picture and the
 * thing it is a picture of cannot drift.
 *
 * Positioned over the top of `WebShell`'s pane, as the real bar is over the
 * page. The pill is still, because a picture has nowhere to slide from.
 *
 * The mock is 1200px wide, so it is drawn as the real bar is at that width:
 * five surfaces all labelled; six (with Immobilier) only the one you are in,
 * as the bar does below `xl`. */
function WebTopNav({ active, space }: { active: Key; space: boolean }) {
  const t = useT();
  const items = navFor(active, space);
  return (
    <div className="absolute inset-x-0 top-0 z-10">
      <div className={TOPBAR_START_CLASS}>
        <span className="flex items-center gap-2">
          <Orb tone="mark" size="28px" className="shrink-0" />
          <span className="font-logo text-[1.5rem] leading-none">Pluclair</span>
        </span>
        {space ? (
          <span className="ml-4">
            <SpaceSwitch />
          </span>
        ) : null}
      </div>

      <nav className={NOTCH_CENTRE_CLASS}>
        <NotchWing side="start" />
        <NotchWing side="end" />
        {items.map(({ labelKey, icon: Icon }) => {
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
                {isActive || items.length <= 5 ? t(labelKey) : null}
              </span>
            </span>
          );
        })}
        <span className="ml-1 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus size={18} weight="bold" />
        </span>
      </nav>

      <div className={TOPBAR_END_CLASS}>
        {[Sparkle, ArrowsClockwise, Eye].map((Icon, index) => {
          // « Questions » is lit on its own screen, as `AskButton` is.
          const here = index === 0 && active === "ask.title";
          return (
            <span
              key={index}
              className={cn(
                "flex size-11 items-center justify-center rounded-full",
                here ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon size={18} weight={here ? "fill" : "regular"} />
            </span>
          );
        })}
        <span className="flex size-11 items-center justify-center">
          <Initial size="md" />
        </span>
      </div>
    </div>
  );
}

/** The month as `MonthPicker` draws it in a page: two round arrows and the
 * month between them. Le point and the Journal put it in their content, not
 * in a header. */
export function MockMonthPicker({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  const arrow = cn(
    "flex shrink-0 items-center justify-center rounded-full border border-border",
    compact ? "size-9" : "size-10",
  );
  return (
    <span className="flex items-center gap-2">
      <span className={arrow}>
        <CaretLeft size={compact ? 14 : 16} weight="bold" />
      </span>
      <span
        className={cn(
          "flex items-center gap-1.5 px-2 font-semibold",
          compact ? "text-base" : "text-lg",
        )}
      >
        {label}
        <CaretDown size={12} weight="bold" className="text-muted-foreground" />
      </span>
      <span className={arrow}>
        <CaretRight size={compact ? 14 : 16} weight="bold" />
      </span>
    </span>
  );
}

/** A surface's tab strip, the first lit, as `SurfaceTabs` draws it. */
export function MockTabs({
  labels,
  compact = false,
}: {
  labels: Key[];
  compact?: boolean;
}) {
  const t = useT();
  return (
    <span className="flex items-center gap-1">
      {labels.map((label, index) => (
        <span
          key={label}
          className={cn(
            "whitespace-nowrap rounded-full py-1.5 text-sm font-medium",
            compact ? "px-2.5" : "px-3.5",
            index === 0
              ? "bg-foreground text-background"
              : "text-muted-foreground",
          )}
        >
          {t(label)}
        </span>
      ))}
    </span>
  );
}

export function WebShell({
  active,
  space = false,
  overlay,
  children,
}: {
  active: Key;
  /** Drawn under « Commun »: the switch in the bar, the shared nav. */
  space?: boolean;
  /** A sheet open over the whole window, its scrim and all. */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  return (
    // The bezel, and the page as a rounded pane set into it — the real shell's
    // `.app-frame`, drawn as a padding and a radius because a picture does
    // not scroll and so has no reason to use the outline the real one needs.
    <div className="relative flex size-full bg-frame p-2">
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-background pt-[var(--shell-notch-height)]">
        <WebTopNav active={active} space={space} />
        {/* The real app's column at this width, `PageContainer`'s `lg` step,
          rather than the whole frame: with no rail beside it, content left
          to fill 1200px would be drawn wider than the app ever draws it. */}
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-5">
          {children}
        </div>
      </div>
      {overlay ? <div className="absolute inset-0 z-20">{overlay}</div> : null}
    </div>
  );
}

/** The phone app's tab icons: Phosphor's closest to the Ionicons the Expo
 * bar draws (compass, swap-horizontal, repeat, flag, analytics, home). */
const PHONE_TAB_ICONS: Partial<Record<Key, Icon>> = {
  "nav.bearing": Compass,
  "nav.ledger": ArrowsLeftRight,
  "nav.charges": Repeat,
  "nav.plan": Flag,
  "nav.wallets": ChartLine,
  "nav.property": House,
};

/** The phone's bottom bar, as the Expo app docks it: full width, a hairline
 * on top, each surface an icon over a 10px label. */
function MobileTabBar({ active, space }: { active: Key; space: boolean }) {
  const t = useT();
  const items = navFor(active, space);
  return (
    <nav className="flex h-14 shrink-0 items-stretch border-t border-hairline-strong bg-background/90">
      {items.map(({ labelKey, icon }) => {
        const isActive = labelKey === active;
        const Glyph = PHONE_TAB_ICONS[labelKey] ?? icon;
        return (
          <span
            key={labelKey}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Glyph size={20} weight={isActive ? "fill" : "regular"} />
            <span className="text-[10px] font-medium leading-none">
              {t(labelKey)}
            </span>
          </span>
        );
      })}
    </nav>
  );
}

/**
 * A screen of the phone app, as the Expo `Screen` draws it: a 56px header
 * with the orb (or a back chevron on a screen pushed over the tabs) and the
 * title — or, under « Commun », the switch in its place — and « Questions »,
 * the refresh, the blur and the account on the right. A tab screen has the
 * docked tab bar and the gold « + » floating over it; a pushed screen —
 * Questions, the tax page, a property — has neither.
 */
export function MobileShell({
  active,
  title,
  back = false,
  space = false,
  overlay,
  children,
}: {
  active: Key;
  /** The header's words, when they are not the tab's name. */
  title?: string;
  /** A screen pushed over the tabs. */
  back?: boolean;
  space?: boolean;
  /** A sheet open over the whole screen, its scrim and all. */
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="relative flex size-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {back ? (
            <CaretLeft size={20} weight="bold" className="-ml-1 shrink-0" />
          ) : (
            <Orb tone="mark" size="22px" className="shrink-0" />
          )}
          {space ? (
            <SpaceSwitch />
          ) : (
            <h1 className="truncate text-[18px] leading-none">
              {title ?? t(active)}
            </h1>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
          {[Sparkle, ArrowClockwise, Eye].map((Icon, index) => {
            const here = index === 0 && active === "ask.title";
            return (
              <span
                key={index}
                className={cn(
                  "flex size-8 items-center justify-center",
                  here && "text-foreground",
                )}
              >
                <Icon size={19} weight={here ? "fill" : "regular"} />
              </span>
            );
          })}
          <span className="flex size-8 items-center justify-center">
            <Initial size="sm" />
          </span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-4">
        {children}
      </div>
      {back ? null : (
        <>
          <span className="absolute bottom-[4.5rem] right-4 flex size-14 items-center justify-center rounded-full border border-[rgba(255,240,210,0.35)] bg-[rgba(236,178,94,0.72)] text-primary-foreground shadow-[0_10px_30px_-10px_rgba(236,178,94,0.6)]">
            <Plus size={26} weight="bold" />
          </span>
          <MobileTabBar active={active} space={space} />
        </>
      )}
      {overlay ? <div className="absolute inset-0 z-20">{overlay}</div> : null}
    </div>
  );
}
