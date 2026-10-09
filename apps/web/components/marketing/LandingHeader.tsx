"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import {
  AnimatePresence,
  m,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { formatDayMonth } from "@finance/core/constants";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ArrowsClockwise,
  CaretDown,
  ChartLineUp,
  ChatCircleDots,
  Compass,
  FileText,
  House,
  List,
  Mountains,
  Receipt,
  SealCheck,
  Sparkle,
  UsersThree,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { Orb } from "@/components/brand/Orb";
import { LandingCtas } from "@/components/marketing/LandingCtas";
import { LocaleChoices, LocaleMenu } from "@/components/marketing/LocaleSwitch";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import {
  featureHref,
  landingCopyFor,
  type LandingPageId,
  type LocalisedLandingCopy,
} from "@/components/marketing/landing-copy";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** The glass's own spring: quick to answer, settling without a wobble. */
const MORPH = {
  type: "spring",
  stiffness: 340,
  damping: 34,
  mass: 0.9,
} as const;

/** How far down the page before the pill tightens. */
const TIGHTEN_AT = 120;

/** Section anchors on the homepage. Written absolute so they also work from a
 * feature page, where the section itself is not on screen. The href is a
 * route and lives here; the word is copy and lives with the rest of it. */
const SECTION_LINKS = [
  { href: "/#how", key: "howItWorks" },
  { href: "/#privacy", key: "privacy" },
] as const;

/** Each feature page's mark on its card. */
const PAGE_ICON: Record<LandingPageId, Icon> = {
  bearing: Compass,
  ledger: Receipt,
  charges: ArrowsClockwise,
  "month-close": SealCheck,
  "month-read": Sparkle,
  plan: Mountains,
  wallets: ChartLineUp,
  property: House,
  questions: ChatCircleDots,
  together: UsersThree,
  tax: FileText,
};

/** The pages in three groups, Le point apart as the featured card. */
const GROUPS: {
  key: "groupMonth" | "groupWealth" | "groupMore";
  pages: LandingPageId[];
}[] = [
  {
    key: "groupMonth",
    pages: ["ledger", "charges", "month-close", "month-read"],
  },
  { key: "groupWealth", pages: ["plan", "wallets", "property"] },
  { key: "groupMore", pages: ["questions", "together", "tax"] },
];

type Panel = "product" | "sheet";
type Page = LocalisedLandingCopy["pages"][number];

function Wordmark({ folded }: { folded: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-full font-logo text-2xl leading-none text-marketing-ink",
        marketingFocus,
      )}
      aria-label="Pluclair"
    >
      <Orb size="26px" tone="mark" className="shrink-0" />
      {/* The word folds behind the orb once the pill tightens. */}
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-500",
          folded ? "max-w-0 opacity-0" : "max-w-32 opacity-100",
        )}
        aria-hidden
      >
        Pluclair
      </span>
    </Link>
  );
}

const linkClass =
  "rounded-control text-sm text-marketing-muted transition-colors duration-hover " +
  `hover:text-white ${marketingFocus}`;

/**
 * The marketing nav: a glass pill that is also its own menu.
 *
 * « Le produit » (the burger below the desktop width) does not drop a box
 * under the pill: the pill itself grows down into a panel, its corners
 * settling from a pill's to a card's, and the pages arrive inside it as
 * cards, one after another — Le point featured with its figure, the rest in
 * three groups. Closing runs it back.
 *
 * Scrolled past the hero, the pill tightens: narrower, a little higher and
 * darker, the wordmark folded behind its orb and « Se connecter » folded
 * away, so the page has more of the screen. Opening the menu gives it its
 * full width back.
 *
 * The glass is a layer behind the content rather than the box around it:
 * `backdrop-filter` makes an element a backdrop root for everything inside,
 * so a panel nested in a blurring box would only blur what the box paints.
 */
export function LandingHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useT();
  const copy = landingCopyFor(useLocale());
  const pathname = usePathname();
  const still = useReducedMotion() ?? false;
  const shell = useRef<HTMLDivElement>(null);

  // Open for one path at a time, so navigating from inside it closes it.
  const [openFor, setOpenFor] = useState<{ panel: Panel; path: string } | null>(
    null,
  );
  const panel = openFor?.path === pathname ? openFor.panel : null;
  const toggle = (next: Panel) =>
    setOpenFor(panel === next ? null : { panel: next, path: pathname });
  const close = () => setOpenFor(null);

  // A press outside the pill, or Escape, closes it.
  useEffect(() => {
    if (!panel) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!shell.current?.contains(event.target as Node)) setOpenFor(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFor(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panel]);

  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    const next = y > TIGHTEN_AT;
    setScrolled((current) => (current === next ? current : next));
  });
  const tight = scrolled && panel === null;
  const transition = still ? { duration: 0 } : MORPH;

  return (
    // Slides down as the page opens, the first beat of the hero's entrance.
    <m.header
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6 md:pt-6"
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
    >
      <m.div
        ref={shell}
        className="relative mx-auto"
        initial={false}
        animate={{
          maxWidth: tight ? "52rem" : "72rem",
          y: tight ? -8 : 0,
        }}
        transition={transition}
      >
        <m.div
          aria-hidden
          className="glass-panel pointer-events-none absolute inset-0"
          initial={false}
          animate={{ borderRadius: panel ? 28 : 30 }}
          transition={transition}
        />
        {/* A shade over the glass once tightened, so the pill holds its own
            over whatever the page scrolls under it. */}
        <m.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[30px] bg-black/35"
          initial={false}
          animate={{ opacity: tight ? 1 : 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        />

        <div className="relative flex items-center justify-between gap-4 py-2 pl-5 pr-2 md:pr-2.5">
          <Wordmark folded={tight} />

          <nav
            className={cn(
              "hidden items-center lg:flex",
              tight ? "gap-6" : "gap-8",
            )}
            aria-label={t("common.marketing")}
          >
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-control text-sm transition-colors duration-hover",
                marketingFocus,
                panel === "product" || pathname.startsWith("/features/")
                  ? "text-marketing-ink"
                  : "text-marketing-muted hover:text-white",
              )}
              aria-expanded={panel === "product"}
              aria-controls="marketing-panel"
              onClick={() => toggle("product")}
            >
              {t("common.product")}
              <m.span
                className="flex"
                animate={{ rotate: panel === "product" ? 180 : 0 }}
                transition={transition}
              >
                <CaretDown size={12} weight="bold" />
              </m.span>
            </button>
            {SECTION_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={linkClass}
                onClick={close}
              >
                {copy.nav[link.key]}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden lg:block">
              <LocaleMenu pathname={pathname} />
            </div>
            <LandingCtas
              isLoggedIn={isLoggedIn}
              size="md"
              layout="pair-compact"
              foldSecondary={tight}
            />
            <button
              type="button"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full text-marketing-ink transition-colors hover:bg-white/10 hover:text-white lg:hidden",
                marketingFocus,
              )}
              aria-expanded={panel === "sheet"}
              aria-controls="marketing-panel"
              aria-label={
                panel === "sheet" ? t("common.closeMenu") : t("common.openMenu")
              }
              onClick={() => toggle("sheet")}
            >
              <AnimatePresence initial={false} mode="wait">
                <m.span
                  key={panel === "sheet" ? "close" : "open"}
                  className="flex"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.18, ease: EASE }}
                >
                  {panel === "sheet" ? <X size={18} /> : <List size={18} />}
                </m.span>
              </AnimatePresence>
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {panel ? (
            <m.div
              key={panel}
              id="marketing-panel"
              className="relative overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: "auto",
                opacity: 1,
                transition: still
                  ? { duration: 0 }
                  : {
                      height: MORPH,
                      opacity: { duration: 0.25, ease: EASE },
                    },
              }}
              exit={{
                height: 0,
                opacity: 0,
                transition: still
                  ? { duration: 0 }
                  : {
                      height: { duration: 0.32, ease: EASE },
                      opacity: { duration: 0.2, ease: EASE, delay: 0.06 },
                    },
              }}
            >
              <div
                className="max-h-[calc(100dvh-7rem)] overflow-y-auto px-2.5 pb-2.5 pt-1 md:px-3 md:pb-3"
                data-lenis-prevent
              >
                {panel === "product" ? (
                  <ProductPanel
                    pathname={pathname}
                    onNavigate={close}
                    copy={copy}
                  />
                ) : (
                  <SheetPanel
                    pathname={pathname}
                    onNavigate={close}
                    copy={copy}
                    isLoggedIn={isLoggedIn}
                  />
                )}
              </div>
            </m.div>
          ) : null}
        </AnimatePresence>
      </m.div>
    </m.header>
  );
}

/** The cards arrive one after another, lifting out of a slight blur. */
const cascade = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.035, delayChildren: 0.08 } },
};
const arrive = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE },
  },
};

function pageOf(copy: LocalisedLandingCopy, id: LandingPageId): Page {
  return copy.pages.find((page) => page.id === id)!;
}

/** The desktop panel: Le point featured, then the three groups. */
function ProductPanel({
  pathname,
  onNavigate,
  copy,
}: {
  pathname: string;
  onNavigate: () => void;
  copy: LocalisedLandingCopy;
}) {
  return (
    <m.div
      className="grid grid-cols-[1.25fr_1fr_1fr_1fr] gap-3"
      variants={cascade}
      initial="hidden"
      animate="shown"
    >
      <m.div variants={arrive} className="row-span-1">
        <FeaturedCard
          page={pageOf(copy, "bearing")}
          copy={copy}
          active={pathname === featureHref("bearing")}
          onNavigate={onNavigate}
        />
      </m.div>
      {GROUPS.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <m.p
            variants={arrive}
            className="px-1 pt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint"
          >
            {copy.nav[group.key]}
          </m.p>
          {group.pages.map((id) => (
            <m.div key={id} variants={arrive}>
              <PageCard
                page={pageOf(copy, id)}
                active={pathname === featureHref(id)}
                onNavigate={onNavigate}
              />
            </m.div>
          ))}
        </div>
      ))}
    </m.div>
  );
}

/** Below the desktop width: the same cards, smaller, and the rest of the nav. */
function SheetPanel({
  pathname,
  onNavigate,
  copy,
  isLoggedIn,
}: {
  pathname: string;
  onNavigate: () => void;
  copy: LocalisedLandingCopy;
  isLoggedIn: boolean;
}) {
  const t = useT();
  return (
    <m.div
      className="flex flex-col gap-4"
      variants={cascade}
      initial="hidden"
      animate="shown"
    >
      <m.div variants={arrive}>
        <FeaturedCard
          page={pageOf(copy, "bearing")}
          copy={copy}
          active={pathname === featureHref("bearing")}
          onNavigate={onNavigate}
          compact
        />
      </m.div>
      {GROUPS.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <m.p
            variants={arrive}
            className="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint"
          >
            {copy.nav[group.key]}
          </m.p>
          <div className="grid grid-cols-2 gap-2">
            {group.pages.map((id) => (
              <m.div key={id} variants={arrive}>
                <PageCard
                  page={pageOf(copy, id)}
                  active={pathname === featureHref(id)}
                  onNavigate={onNavigate}
                  compact
                />
              </m.div>
            ))}
          </div>
        </div>
      ))}
      <m.div
        variants={arrive}
        className="flex flex-col gap-1 border-t border-white/10 pt-3"
      >
        {SECTION_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center rounded-control px-3 text-sm text-marketing-muted transition-colors hover:bg-white/[0.07] hover:text-white",
              marketingFocus,
            )}
          >
            {copy.nav[link.key]}
          </Link>
        ))}
        {isLoggedIn ? null : (
          <Link
            href="/login"
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center rounded-control px-3 text-sm text-marketing-muted transition-colors hover:bg-white/[0.07] hover:text-white sm:hidden",
              marketingFocus,
            )}
          >
            {copy.cta.signIn}
          </Link>
        )}
      </m.div>
      {/* Last, under its own rule: it changes the page rather than leaving
          it, and the panel stays open while the language swaps. */}
      <m.div variants={arrive} className="border-t border-white/10 pt-3">
        <h2 className="px-3 text-xs font-medium uppercase tracking-[0.16em] text-marketing-faint">
          {t("locale.settingLabel")}
        </h2>
        <LocaleChoices variant="sheet" className="mt-1" />
      </m.div>
    </m.div>
  );
}

/** The light under the pointer, as on the landing's grid. */
function follow(event: ReactPointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--x", `${event.clientX - box.left}px`);
  event.currentTarget.style.setProperty("--y", `${event.clientY - box.top}px`);
}

const cardBase =
  "group relative isolate flex overflow-hidden rounded-[1.25rem] border border-white/[0.07] bg-white/[0.03] transition-[transform,background-color,border-color] duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.06] " +
  "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:opacity-0 before:transition-opacity before:duration-500 before:[background:radial-gradient(14rem_circle_at_var(--x,50%)_var(--y,50%),rgb(236_178_94/0.14),transparent_60%)] hover:before:opacity-100";

function PageCard({
  page,
  active,
  onNavigate,
  compact = false,
}: {
  page: Page;
  active: boolean;
  onNavigate: () => void;
  compact?: boolean;
}) {
  const PageIcon = PAGE_ICON[page.id];
  return (
    <Link
      href={featureHref(page.id)}
      onClick={onNavigate}
      onPointerMove={follow}
      aria-current={active ? "page" : undefined}
      className={cn(
        cardBase,
        compact ? "items-center gap-2.5 p-2.5" : "items-start gap-3 p-3",
        active && "border-primary/30 bg-white/[0.07]",
        marketingFocus,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
          compact ? "size-8" : "size-9",
        )}
      >
        <PageIcon size={compact ? 16 : 18} weight="duotone" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-marketing-ink">
          {page.title}
          <ArrowRight
            size={12}
            aria-hidden
            className="-translate-x-1 text-primary opacity-0 transition-[transform,opacity] duration-300 group-hover:translate-x-0 group-hover:opacity-100"
          />
        </span>
        {compact ? null : (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-marketing-muted">
            {page.body}
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * Le point, the card the panel leads with: what the page is for, and the
 * figure it opens on, lit gold, from the landing's sample month.
 */
function FeaturedCard({
  page,
  copy,
  active,
  onNavigate,
  compact = false,
}: {
  page: Page;
  copy: LocalisedLandingCopy;
  active: boolean;
  onNavigate: () => void;
  compact?: boolean;
}) {
  const locale = useLocale();
  const euro = useFormatCurrency();
  const { leftToSpend } = landingSampleFor(locale);
  const date = formatDayMonth(leftToSpend.through, locale);
  return (
    <Link
      href={featureHref(page.id)}
      onClick={onNavigate}
      onPointerMove={follow}
      aria-current={active ? "page" : undefined}
      className={cn(
        cardBase,
        "h-full flex-col justify-between gap-6 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(236_178_94/0.16),transparent_60%),rgb(255_255_255/0.03)]",
        compact ? "p-4" : "p-5",
        marketingFocus,
      )}
    >
      <span>
        <span className="flex items-center gap-2 text-sm font-medium text-marketing-ink">
          <Compass size={18} weight="duotone" className="text-primary" />
          {page.title}
          <ArrowRight
            size={12}
            aria-hidden
            className="-translate-x-1 text-primary opacity-0 transition-[transform,opacity] duration-300 group-hover:translate-x-0 group-hover:opacity-100"
          />
        </span>
        <span className="mt-1 block text-xs leading-snug text-marketing-muted">
          {page.body}
        </span>
      </span>
      <span className="block">
        <span className="block text-xs text-marketing-muted">
          {copy.figure.title}
        </span>
        <span
          className={cn(
            "block font-serif font-semibold leading-none tracking-[-0.035em] text-primary tabular-nums",
            compact ? "mt-1 text-3xl" : "mt-1.5 text-5xl",
          )}
        >
          {euro(leftToSpend.amount)}
        </span>
        <span className="mt-2 block text-xs text-marketing-muted">
          {copy.figure.until.replace("{date}", date)} ·{" "}
          {copy.figure.perDay.replace("{amount}", euro(leftToSpend.perDay))}
        </span>
      </span>
    </Link>
  );
}
