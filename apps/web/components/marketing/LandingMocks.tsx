"use client";

import type { ReactNode } from "react";
import { CaretDown, Eye, Plus, Sparkle } from "@phosphor-icons/react";
import { formatEuro, formatPercent } from "@finance/core/constants";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { Orb } from "@/components/brand/Orb";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { Card } from "@/components/retroui/Card";
import { Badge } from "@/components/retroui/Badge";
import { APP_NAV_ITEMS, PROFILE_NAV_ITEM } from "@/lib/navigation";
import {
  branchPath,
  childrenHeight,
  INDENT,
  reachPath,
  ROW_HEIGHT,
  trunkPath,
} from "@/lib/nav-tree";
import { progressTone } from "@/lib/progress-tone";
import type { LandingPageId } from "@/components/marketing/landing-copy";
import {
  landingSampleFor,
  type LocalisedLandingSample,
} from "@/components/marketing/landing-sample";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/locale-context";
import type { Key } from "@finance/core/i18n/t";

/**
 * Sample figures, formatted the way the reader's own would be.
 *
 * These mocks are the only money on the marketing site, and the point of
 * them is that the app looks like this — so a French visitor has to see
 * "3 200 €" and an English one "€3,200". A hook rather than a bare call
 * because the locale lives in context, and one per component rather than a
 * prop threaded through thirteen of them.
 */
function useEuro(): (amount: number) => string {
  const locale = useLocale();
  return (amount: number) => formatEuro(amount, locale);
}

/**
 * The same for a rate: "33.6%" in English, "33,6 %" in French.
 *
 * Both halves are the language's — the decimal separator and the space before
 * the sign — so neither is written into the sentences that quote a rate.
 */
function usePercent(): (value: number) => string {
  const locale = useLocale();
  const t = useT();
  return (value: number) =>
    t("units.percent", { value: formatPercent(value, locale) });
}

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
// It does not rule out the app's own marks, though it used to. ProgressRing was
// an echarts gauge that read its colours from document.documentElement — a
// charting runtime on the marketing critical path, keyed to whatever theme the
// *app* was set to rather than the dark one this shell scopes — so there was a
// hand-drawn twin here to avoid it. The app's ring is plain SVG now, coloured
// through CSS tokens, and carries no breakpoints, so the twin is gone. Nothing
// here draws a ring at the moment — Month did, and Month was retired — but the
// rule stands: the app's own component, not a picture of it.
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
 * the screen it is showing. These are the message keys APP_NAV_ITEMS holds
 * rather than the words it renders: the nav below highlights by matching, and
 * matching on a key survives both a reword and a change of language, where
 * matching on "Month" survived neither. Calendar has no slot of its own — it
 * is the Ledger seen by date — and neither the close nor the read is a
 * surface, so both borrow the one they are reached from. */
const ACTIVE_NAV: Record<LandingPageId, Key> = {
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
};

/** The real side nav's structure — logo band, primary action, then the same
 * APP_NAV_ITEMS the app renders, drawn as the tree `BranchedNav` draws, off
 * the shared geometry in `lib/nav-tree`. All three are shared rather than
 * copied, so the picture and the thing it is a picture of cannot drift.
 *
 * The colours are not shared and that is the seam to watch. The drift-proofing
 * above guards the structure axis only: when the app's active state moved off
 * Lamplit Gold onto the foreground — a rail marker in `bg-foreground`, a row
 * in `text-foreground` with no pill behind it, a reach path in
 * `stroke-foreground` — this mock went on painting the gold version, because
 * every one of those classes is hand-written here and hand-written there.
 *
 * So: **`components/layout/BranchedNav.tsx` and this component must move
 * together**, and `components/layout/BottomNav.tsx` and `MobileTabBar` below
 * are the same pair for the phone. Sharing the colour the way the geometry is
 * shared means lifting the four class strings — marker, active row, idle row,
 * reach stroke — into a module beside `lib/nav-tree`, which is a change to
 * `components/layout/**` and `lib/**` rather than to the marketing surface,
 * and is the right fix the day either of those files is open. Until then the
 * four call sites below carry a note apiece. */
function WebSideNav({ active }: { active: Key }) {
  const t = useT();
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-[52px] shrink-0 items-center justify-center gap-2 border-b border-border px-5">
        <Orb tone="mark" size="24px" className="shrink-0" />
        <span className="font-logo text-xl leading-none">Pluclair</span>
      </div>

      <div className="px-3 pt-3">
        <div className="flex min-h-10 items-center gap-3 rounded-control bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          <Plus size={18} weight="bold" />
          {t("ledger.addTransaction")}
          {/* The shortcut the app actually has. This said `N` until now, and
              `SideNav`'s own comment says why that is wrong: the bare-letter
              binding was removed because a single key opens the sheet over
              whatever a screen reader is in the middle of (WCAG 2.1 SC 2.1.4),
              which left the picture teaching a key that does nothing. The real
              badge reads the platform and says `⌘K` or `Ctrl K`; a still
              picture cannot ask, so it shows the one a visitor on a keyboard
              with no Command key can still press. */}
          <kbd className="ml-auto rounded-control bg-black/15 px-1.5 py-0.5 text-[10px] font-normal">
            Ctrl K
          </kbd>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {APP_NAV_ITEMS.map(({ labelKey, icon: Icon, children }) => {
          const isActive = labelKey === active;
          // The real sidebar unfolds the surface you are in and leaves the
          // others folded, so the mock shows one surface's views and no
          // others. `BranchedNav` keeps that in state; here it is the
          // active flag, which is the same rule with nothing to remember.
          const showKids = isActive && children.length > 0;
          return (
            <div key={labelKey} className="relative flex flex-col">
              {/* `bg-foreground`, with `components/layout/BranchedNav.tsx`:
                  against a rail that is otherwise a hairline, full-strength
                  ink is already the brightest thing on it. */}
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute -left-1.5 top-3 z-10 h-4 w-0.5 rounded-full bg-foreground"
                />
              ) : null}
              <div className="flex items-center gap-1">
                {/* No pill behind the row you are in, with
                    `components/layout/BranchedNav.tsx`: DESIGN.md's Navigation
                    section puts the active state in the foreground colour, and
                    the marker beside it and the icon's `fill` weight say the
                    rest. What stood here was `bg-primary/10 text-primary-ink`
                    — the accent spent twice on a state three other channels
                    already make unmistakable. */}
                <span
                  className={cn(
                    "flex min-h-10 flex-1 items-center gap-3 rounded-control px-3 py-2 text-sm font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon size={18} weight={isActive ? "fill" : "light"} />
                  {t(labelKey)}
                </span>
                {children.length > 0 ? (
                  <span className="shrink-0 p-1.5 text-muted-foreground">
                    <CaretDown
                      size={14}
                      weight="bold"
                      className={cn(!showKids && "-rotate-90")}
                    />
                  </span>
                ) : null}
              </div>

              {showKids ? (
                <div
                  className="relative"
                  style={{ height: childrenHeight(children.length) }}
                >
                  <svg
                    width={INDENT}
                    height={childrenHeight(children.length)}
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-0 overflow-visible"
                  >
                    <path
                      d={trunkPath(children.length)}
                      className="fill-none stroke-hairline-strong"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                    {children.map((kid, index) => (
                      <path
                        key={kid.href}
                        d={branchPath(index)}
                        className="fill-none stroke-hairline-strong"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {/* The reach, traced to the view the mock is showing —
                        always the first, because that is the view each of
                        these screenshots is of. `stroke-foreground` against
                        the hairline the rest of the tree is drawn in, with
                        `components/layout/BranchedNav.tsx`: two steps of the
                        same ink, so the drawing and the words agree. It was
                        `stroke-primary`, which made the tree the one place
                        left on either surface where the accent marked a
                        position. */}
                    <path
                      d={reachPath(0)}
                      className="fill-none stroke-foreground"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {children.map((kid, index) => (
                    <span
                      key={kid.href}
                      style={{ height: ROW_HEIGHT, paddingLeft: INDENT }}
                      className={cn(
                        "flex items-center rounded-control pr-3 text-sm",
                        index === 0
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {t(kid.labelKey)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
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
        <span className="flex h-8 w-8 items-center justify-center rounded-control text-muted-foreground">
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
  active,
  monthLabel,
  children,
}: {
  active: Key;
  monthLabel?: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex size-full">
      <WebSideNav active={active} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WebHeaderBand
          title={t(active)}
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
function MobileTabBar({ active }: { active: Key }) {
  const t = useT();
  const items = [...APP_NAV_ITEMS, PROFILE_NAV_ITEM];
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

function MobileShell({
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
function SpendSplit({ compact = false }: { compact?: boolean }) {
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
      <div className="flex flex-col gap-3">{cards}</div>
    </WebShell>
  );
}

/* ----------------------------------------------------------- transactions */

function WebTransactionRow({
  item,
}: {
  item: LocalisedLandingSample["transactions"][number];
}) {
  const euro = useEuro();
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <CategoryIcon
          icon={item.icon}
          className="h-9 w-9 shrink-0 rounded-control border-0 bg-muted"
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
        {euro(Math.abs(item.amount))}
      </span>
    </div>
  );
}

/** Real phone rows carry no icon chip — name and date left, amount right. */
function MobileTransactionRow({
  item,
}: {
  item: LocalisedLandingSample["transactions"][number];
}) {
  const euro = useEuro();
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
        {euro(Math.abs(item.amount))}
      </span>
    </div>
  );
}

export function TransactionsMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { remaining, income, spent, transactions, monthLabel } = sample;
  const rows = [...transactions].reverse();

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.ledger">
        <MockCard innerClassName="p-4">
          <MobileHero
            label={t("marketingMock.whatsLeft")}
            amount={`+${euro(remaining)}`}
            amountClassName="text-success"
            subtitle={
              <p>
                <span className="privacy-amount text-success tabular-nums">
                  {euro(income)}
                </span>
                {" in · "}
                <span className="privacy-amount text-destructive tabular-nums">
                  {euro(spent)}
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
    <WebShell active="nav.ledger" monthLabel={monthLabel}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-6 py-6">
            <WebHero
              label={t("marketingMock.whatsLeft")}
              amount={`+${euro(remaining)}`}
              amountClassName="text-success"
              subtitle={
                <p>
                  <span className="privacy-amount text-success tabular-nums">
                    {euro(income)}
                  </span>
                  {" in · "}
                  <span className="privacy-amount text-destructive tabular-nums">
                    {euro(spent)}
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

/** The share-priced template is the one worth pointing at: its amount comes
 * from a quote rather than a figure anyone typed.
 *
 * Matched on the id rather than the name. The name is translated — "PEA DCA"
 * is "DCA PEA" in French — so a name comparison silently stopped finding this
 * template, and the badge it controls simply never appeared for a French
 * reader. The schedule line moved out for the same reason and now lives in
 * the sample beside the rest of the words. */
const SHARE_PRICED = "pea-dca";

export function RecurringMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { templates } = sample;
  const monthlyImpact = templates
    .filter((template) => template.amount < 0)
    .reduce(
      (sum, template) =>
        sum +
        Math.abs(template.amount) * (template.cadence === "weekly" ? 4.33 : 1),
      0,
    );

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.charges">
        <MockCard innerClassName="flex flex-row items-center justify-between p-4">
          <p className="text-sm font-bold">
            {t("marketingMock.expectedImpact")}
          </p>
          <p className="font-mono text-lg font-bold tabular-nums">
            {euro(monthlyImpact)}
          </p>
        </MockCard>
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <MockCard key={template.name} innerClassName="p-3">
              <p className="text-sm font-semibold">{template.name}</p>
              <p className="text-xs text-muted-foreground">
                {template.schedule}
                {template.id === SHARE_PRICED
                  ? ` · ${t("marketingMock.oneShare")}`
                  : null}
              </p>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span
                  className={cn(
                    "font-mono text-sm font-bold tabular-nums",
                    TYPE_AMOUNT_CLASS[template.type],
                  )}
                >
                  {template.amount >= 0 ? "+" : "−"}
                  {euro(Math.abs(template.amount))}
                </span>
                <span className="rounded-full border border-primary-rim bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  {t("recurring.on")}
                </span>
              </div>
            </MockCard>
          ))}
        </div>
      </MobileShell>
    );
  }

  return (
    // No month stepper: only the Ledger carries one. `TransactionsView` and
    // `CalendarView` are the two `MonthPicker` call sites in the app, and
    // Charges renders a bare `<PageHeader titleKey="nav.charges" />`. A
    // template is not a month's row, which is the reason the real header has
    // nothing to step through here.
    <WebShell active="nav.charges">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-6 py-6">
            <WebHero
              label={t("marketingMock.expectedImpactPerMonth")}
              amount={euro(monthlyImpact)}
              subtitle={
                <p>
                  {t("marketingMock.templatesAllApplied", {
                    count: templates.length,
                  })}
                </p>
              }
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
                    {template.schedule}
                    {template.id === SHARE_PRICED
                      ? ` · ${t("marketingMock.oneShareAtQuote")}`
                      : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {template.id === SHARE_PRICED ? (
                    <Badge variant="outline" size="sm" className="rounded-full">
                      {t("marketingMock.sharePriced")}
                    </Badge>
                  ) : null}
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold tabular-nums",
                      TYPE_AMOUNT_CLASS[template.type],
                    )}
                  >
                    {template.amount >= 0 ? "+" : "−"}
                    {euro(Math.abs(template.amount))}
                  </span>
                  <Badge variant="surface" size="sm" className="rounded-full">
                    {t("recurring.on")}
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

/* ----------------------------------------------------------------- wallets */

export function WalletsMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { portfolio, portfolioInvested, portfolioGain, wallets } = sample;
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
          <span className="font-mono tabular-nums">{euro(wallet.value)}</span>
        </li>
      ))}
    </ul>
  );

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.wallets">
        <MockCard innerClassName="p-4">
          <p className="text-sm text-muted-foreground">
            {t("marketingMock.portfolioValue")}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
            {euro(portfolio)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-mono">{euro(portfolioInvested)}</span>
            {" invested · "}
            <span className="font-mono text-success">
              +{euro(portfolioGain)}
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
    <WebShell active="nav.wallets">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7">
          <MockCard innerClassName="flex h-full flex-col items-center justify-center px-8 py-7">
            <WebHero
              label={t("wallets.marketValue")}
              amount={euro(portfolio)}
              subtitle={
                <p>
                  <span className="privacy-amount tabular-nums">
                    {euro(portfolioInvested)}
                  </span>
                  {" invested · "}
                  <span className="privacy-amount font-mono font-medium tabular-nums text-success">
                    +{euro(portfolioGain)}
                  </span>
                </p>
              }
            />
          </MockCard>
        </div>
        <div className="col-span-5">
          <MockCard innerClassName="flex h-full flex-col justify-center gap-4 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("position.allocation")}
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
  const euro = useEuro();
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
          {euro(spent)} / {euro(limit)}
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
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { budget, goal } = sample;

  if (variant === "mobile") {
    return (
      <MobileShell active="nav.plan">
        <MockCard innerClassName="p-4">
          <p className="text-sm font-bold">
            {t("marketingMock.monthlyBudgets")}
          </p>
          <div className="mt-3">
            <GoalBar
              label={budget.label}
              spent={budget.spent}
              limit={budget.limit}
            />
          </div>
        </MockCard>
        <MockCard innerClassName="p-4">
          <p className="text-sm font-bold">{t("marketingMock.savingsGoals")}</p>
          <div className="mt-3">
            <GoalBar
              label={goal.label}
              spent={goal.saved}
              limit={goal.target}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("plan.goalOnSchedule", {
              amount: euro(goal.monthlyPace),
              month: goal.targetLabel,
            })}
          </p>
        </MockCard>
      </MobileShell>
    );
  }

  return (
    <WebShell active="nav.plan">
      <div className="grid grid-cols-2 gap-4">
        <MockCard innerClassName="flex h-full flex-col px-6 py-5">
          <p className="font-head text-base">
            {t("marketingMock.monthlyBudgets")}
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <GoalBar
              label={budget.label}
              spent={budget.spent}
              limit={budget.limit}
            />
            <GoalBar
              label={t("marketingMock.sampleHousing")}
              spent={850}
              limit={900}
            />
            <GoalBar
              label={t("marketingMock.sampleEverythingElse")}
              spent={185}
              limit={400}
            />
          </div>
        </MockCard>
        <MockCard innerClassName="flex h-full flex-col px-6 py-5">
          <p className="font-head text-base">
            {t("marketingMock.savingsGoals")}
          </p>
          <div className="mt-4">
            <GoalBar
              label={goal.label}
              spent={goal.saved}
              limit={goal.target}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("plan.goalOnSchedule", {
              amount: euro(goal.monthlyPace),
              month: goal.targetLabel,
            })}
          </p>
        </MockCard>
      </div>
    </WebShell>
  );
}

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
     `MonthCloseCard` does: you close February from inside March, and the only
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

/* -------------------------------------------------------------- the router */

/* -------------------------------------------------------------- month read */

/**
 * The read card, as the app draws it: a headline, observations under a tone
 * dot each, and suggestions below a rule under a heading of their own.
 *
 * The dots carry the tone rather than the text being coloured — a whole
 * sentence in red reads as an error, and "this went up" is not one.
 */
function ReadCard({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const sample = landingSampleFor(useLocale());
  const { read } = sample;
  const dot = {
    good: "bg-success",
    bad: "bg-destructive",
    flat: "bg-muted-foreground",
  };

  return (
    <MockCard innerClassName={compact ? "p-4" : "p-5"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkle size={14} className="text-primary-rim" />
          {t("marketingMock.monthRead")}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {read.writtenOn}
        </span>
      </div>

      <p
        className={cn(
          "mt-3 font-head leading-snug",
          compact ? "text-base" : "text-lg",
        )}
      >
        {read.headline}
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {read.observations
          .slice(0, compact ? 2 : 3)
          .map((observation, index) => (
            <li
              key={index}
              className={cn(
                "flex items-start gap-2",
                compact ? "text-[11px]" : "text-sm",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  dot[observation.tone],
                )}
              />
              <span className="min-w-0 text-muted-foreground">
                {observation.text}
              </span>
            </li>
          ))}
      </ul>

      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("monthRead.suggestionsHeading")}
        </h4>
        {read.suggestions.map((suggestion) => (
          <div
            key={suggestion}
            className={cn(
              "flex items-start gap-2",
              compact ? "text-[11px]" : "text-sm",
            )}
          >
            <span
              aria-hidden
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-rim"
            />
            <span className="min-w-0 text-muted-foreground">{suggestion}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
        {read.standing}
      </p>
    </MockCard>
  );
}

export function MonthReadMock({ variant = "web" }: { variant?: Variant }) {
  const sample = landingSampleFor(useLocale());
  const t = useT();
  const euro = useEuro();
  const { monthLabel, remaining, income } = sample;

  const monthWord = monthLabel.split(" ")[0];

  if (variant === "mobile") {
    return (
      <MockViewport width={MOBILE_WIDTH} height={MOBILE_HEIGHT}>
        <MobileShell active={ACTIVE_NAV["month-read"]}>
          <MockCard innerClassName="p-4">
            <MobileHero
              label={t("marketingStat.leftIn", { month: monthWord! })}
              amount={euro(remaining)}
              subtitle={t("marketingStat.ofEarned", { amount: euro(income) })}
            />
          </MockCard>
          <ReadCard compact />
        </MobileShell>
      </MockViewport>
    );
  }

  return (
    <MockViewport width={WEB_WIDTH} height={WEB_HEIGHT}>
      {/* Plan, and no stepper — see the Charges mock. */}
      <WebShell active={ACTIVE_NAV["month-read"]}>
        {/* Seven and five, the same split the surface itself uses on a wide
            screen: the read sits under the figure it interprets, never
            beside it. */}
        <div className="grid flex-1 grid-cols-12 gap-4">
          <div className="col-span-7 flex flex-col gap-4">
            <MockCard innerClassName="p-5">
              <WebHero
                label={t("marketingStat.leftIn", { month: monthWord! })}
                amount={euro(remaining)}
                subtitle={t("marketingStat.ofEarned", { amount: euro(income) })}
              />
            </MockCard>
            <ReadCard />
          </div>
          <div className="col-span-5">
            <MockCard innerClassName="p-4">
              <SpendSplit compact />
            </MockCard>
          </div>
        </div>
      </WebShell>
    </MockViewport>
  );
}

const PAGE_MOCKS: Record<LandingPageId, (variant: Variant) => ReactNode> = {
  bearing: (variant) => <BearingMock variant={variant} />,
  ledger: (variant) => <TransactionsMock variant={variant} />,
  charges: (variant) => <RecurringMock variant={variant} />,
  plan: (variant) => <PlanningMock variant={variant} />,
  wallets: (variant) => <WalletsMock variant={variant} />,
  "month-close": (variant) => <MonthCloseMock variant={variant} />,
  "month-read": (variant) => <MonthReadMock variant={variant} />,
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
