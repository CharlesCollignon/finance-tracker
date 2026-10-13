"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AnimatePresence,
  LazyMotion,
  m,
  MotionConfig,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { CaretDown } from "@phosphor-icons/react";
import {
  changelogMonths,
  entriesSince,
  weekMonday,
  type ChangeKind,
  type ChangelogMonth,
  type ChangelogWeek,
  type ChangePlatform,
} from "@finance/core/changelog";
import { monthLong } from "@finance/core/i18n/calendar-names";
import type { Locale } from "@finance/core/i18n/locale";
import { DURATION, EASE_STANDARD, STAGGER_STEP_MS } from "@finance/core/motion";
import {
  changelogTarget,
  NO_TALLY,
  type ReactionTally,
} from "@finance/core/reactions";
import { markNouveautesSeen } from "@/lib/actions/nouveautes";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import {
  countLabel,
  type NouveautesCopy,
} from "@/components/marketing/nouveautes-copy";
import {
  EntryCard,
  KIND_DOT,
} from "@/components/marketing/nouveautes/EntryCard";
import {
  dayAndMonth,
  type RiverEntry,
} from "@/components/marketing/nouveautes/river-entry";
import { GOTO_WEEK_EVENT } from "@/components/marketing/nouveautes/river-events";
import { SegmentedPills } from "@/components/marketing/SegmentedPills";
import { cn } from "@/lib/utils";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** The tabs' spring (`SurfaceTabs`): quick, a little springy. */
const PILL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/** Past the first screenful a cascade is not seen, only waited for. */
const STAGGER_CAP = 8;

/** Where on the screen the month marker reads the list: a third down. */
const READ_AT = 0.35;

/** The newest entry this browser has listed, and what was new on arrival. */
const SEEN_KEY = "pluclair.nouveautes.seen";
const FRESH_KEY = "pluclair.nouveautes.fresh";

type KindFilter = "all" | ChangeKind;
type PlatformFilter = "all" | ChangePlatform;

type Row =
  | { type: "month"; key: string; month: ChangelogMonth<RiverEntry> }
  | { type: "week"; key: string; week: ChangelogWeek<RiverEntry> }
  | { type: "entry"; key: string; entry: RiverEntry; compact: boolean }
  | { type: "fixes"; key: string; fixes: RiverEntry[]; unfolded: boolean }
  | { type: "empty"; key: string };

/**
 * The list itself: every entry, newest first, as months of weeks, with what
 * to show beside it.
 *
 * Beside the list on a desktop, held while it scrolls: the month being read,
 * whose name rolls over to the next as the list crosses into it (up or down,
 * with the scroll), and the filters. Choosing a filter does not redraw the
 * list: entries that stay slide to their new places, the others fade, and
 * those coming back rise a beat apart — the Journal's choreography
 * (`AnimatedDays`). A week's fixes fold into one line under « Tout », so the
 * new things lead.
 *
 * What arrived since this browser last listed the entries is marked in the
 * status green, and said once above the filters; the marker is kept in the
 * browser and nowhere else. Nothing moves on arrival but the entries rising
 * into view, and under reduced motion everything stands where it belongs.
 */
export function ChangelogRiver({
  entries,
  copy,
  locale,
  openId,
  accountFresh,
  tallies,
  signedIn,
}: {
  entries: RiverEntry[];
  /** Readers' reactions to each change, by `changelog:<id>`. */
  tallies: Record<string, ReactionTally>;
  /** Whether the reader may react, or is asked to sign in first. */
  signedIn: boolean;
  copy: NouveautesCopy;
  locale: Locale;
  /** An entry opened by its own address (`/nouveautes/<id>`). */
  openId: string | null;
  /**
   * Signed in: the entries new to the account, which this visit marks
   * read. Null for a visitor, whose marker is the browser's.
   */
  accountFresh: string[] | null;
}) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(openId ? [openId] : []),
  );
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const fresh = useFresh(entries, accountFresh);

  // Read: the account's marker moves to the newest entry, so the dot on its
  // menu goes here and on the phone.
  const newestId = entries[0]?.id;
  const tracked = accountFresh !== null;
  useEffect(() => {
    if (tracked && newestId) {
      void markNouveautesSeen(newestId);
    }
  }, [tracked, newestId]);
  const listRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (kind === "all" || entry.kind === kind) &&
          (platform === "all" || entry.platforms.includes(platform)),
      ),
    [entries, kind, platform],
  );
  const months = useMemo(() => changelogMonths(shown), [shown]);
  const rows = useMemo(
    () => buildRows(months, { fold: kind === "all", unfolded }),
    [months, kind, unfolded],
  );

  // The month being read, and which way the list went to reach it.
  const [reading, setReading] = useState<{ key: string; dir: 1 | -1 }>({
    key: months[0]?.key ?? "",
    dir: 1,
  });
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", () => {
    const marks =
      listRef.current?.querySelectorAll<HTMLElement>("[data-month]");
    if (!marks?.length) {
      return;
    }
    const line = window.innerHeight * READ_AT;
    let key = marks[0]!.dataset.month!;
    for (const mark of marks) {
      if (mark.getBoundingClientRect().top <= line) {
        key = mark.dataset.month!;
      }
    }
    setReading((current) =>
      current.key === key ? current : { key, dir: key < current.key ? 1 : -1 },
    );
  });
  const readingMonth =
    months.find((month) => month.key === reading.key) ?? months[0] ?? null;

  const showAll = useCallback(() => {
    setKind("all");
    setPlatform("all");
  }, []);

  const still = useReducedMotion() ?? false;
  const behavior: ScrollBehavior = still ? "auto" : "smooth";

  /** Bring an entry or a week into view, once the list has caught up. */
  const scrollTo = useCallback(
    (selector: string) => {
      window.setTimeout(() => {
        listRef.current
          ?.querySelector(selector)
          ?.scrollIntoView({ behavior, block: "start" });
      }, 60);
    },
    [behavior],
  );

  /**
   * A filter chosen from the rail with the list scrolled away under it: the
   * list may now be a few rows long and end above the screen, so it is
   * brought back to its top rather than leaving the reader past it.
   */
  const filterBy =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      const top = listRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) {
        window.scrollTo({ top: window.scrollY + top - 140, behavior });
      }
    };

  // Asked from the strip in the hero: show that week, whatever is filtered.
  useEffect(() => {
    const onWeek = (event: Event) => {
      const week = (event as CustomEvent<string>).detail;
      showAll();
      scrollTo(`[data-week="${week}"]`);
    };
    window.addEventListener(GOTO_WEEK_EVENT, onWeek);
    return () => window.removeEventListener(GOTO_WEEK_EVENT, onWeek);
  }, [showAll, scrollTo]);

  // An entry reached by its own address opens where it stands.
  useEffect(() => {
    if (openId) {
      document
        .getElementById(`entry-${openId}`)
        ?.scrollIntoView({ block: "center" });
    }
  }, [openId]);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  const firstFresh = entries.find((entry) => fresh.has(entry.id));

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <section
          aria-label={copy.river.label}
          className="relative px-6 pb-24 md:pb-36"
        >
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-14">
            <aside className="min-w-0 md:sticky md:top-28 md:self-start">
              {readingMonth ? (
                <MonthMarker
                  month={readingMonth}
                  dir={reading.dir}
                  locale={locale}
                  copy={copy}
                />
              ) : null}

              <div className="flex flex-col gap-3 md:mt-10">
                <SegmentedPills
                  id="nouveautes-kind"
                  label={copy.filters.label}
                  value={kind}
                  onChange={filterBy(setKind)}
                  options={[
                    { value: "all", label: copy.filters.all },
                    ...(["new", "better", "fixed"] as const).map((value) => ({
                      value,
                      label: copy.filters.kinds[value],
                      dot: KIND_DOT[value],
                    })),
                  ]}
                />
                <SegmentedPills
                  id="nouveautes-platform"
                  label={copy.filters.platformsLabel}
                  value={platform}
                  onChange={filterBy(setPlatform)}
                  options={[
                    { value: "all", label: copy.filters.platformsAll },
                    { value: "web", label: copy.filters.platforms.web },
                    { value: "phone", label: copy.filters.platforms.phone },
                  ]}
                />
              </div>

              <AnimatePresence initial={false}>
                {firstFresh ? (
                  <m.button
                    type="button"
                    className={cn(
                      "mt-4 inline-flex min-h-11 items-center gap-2.5 rounded-full border border-success/30 bg-success/10 px-4 text-left text-sm text-marketing-ink transition-colors duration-hover hover:bg-success/15",
                      marketingFocus,
                    )}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DURATION.enter / 1000, ease: EASE }}
                    onClick={() => {
                      showAll();
                      scrollTo(`#entry-${firstFresh.id}`);
                    }}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full bg-success"
                      aria-hidden
                    />
                    {countLabel(copy.fresh, fresh.size)}
                  </m.button>
                ) : null}
              </AnimatePresence>
            </aside>

            <div ref={listRef} className="relative flex min-w-0 flex-col">
              <AnimatePresence initial={false} mode="popLayout">
                {rows.map((row, index) => (
                  <m.div
                    key={row.key}
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      transition: { duration: DURATION.press / 1000 },
                    }}
                    transition={{
                      duration: DURATION.enter / 1000,
                      ease: EASE,
                      delay:
                        (Math.min(index, STAGGER_CAP) * STAGGER_STEP_MS) / 1000,
                    }}
                    className={rowSpacing(row)}
                  >
                    <RowView
                      row={row}
                      copy={copy}
                      locale={locale}
                      fresh={fresh}
                      tallies={tallies}
                      signedIn={signedIn}
                      open={open}
                      onToggle={toggle}
                      onUnfold={(key) =>
                        setUnfolded((current) => {
                          const next = new Set(current);
                          if (!next.delete(key)) {
                            next.add(key);
                          }
                          return next;
                        })
                      }
                      onShowAll={showAll}
                    />
                  </m.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * The ids new since this browser last listed the entries.
 *
 * Worked out once per visit — on the first read of the session, from the
 * account's marker when signed in, else from the one this browser's last
 * visit left — and kept for the session, so a reload does not take the
 * highlight away; the browser's marker then moves to the newest entry.
 * Empty on the server, on a visitor's first visit (there is no « since »
 * yet), and wherever storage is refused.
 */
function useFresh(
  entries: RiverEntry[],
  accountFresh: string[] | null,
): ReadonlySet<string> {
  const newest = entries[0]?.id ?? "";
  const raw = useSyncExternalStore(
    subscribeNever,
    () => readFresh(entries, newest, accountFresh),
    () => "",
  );
  return useMemo(() => new Set(raw ? raw.split(",") : []), [raw]);
}

function subscribeNever(): () => void {
  return () => {};
}

function readFresh(
  entries: RiverEntry[],
  newest: string,
  accountFresh: string[] | null,
): string {
  try {
    const kept = window.sessionStorage.getItem(FRESH_KEY);
    if (kept !== null) {
      return kept;
    }
    const ids = (
      accountFresh ??
      entriesSince(entries, window.localStorage.getItem(SEEN_KEY)).map(
        (entry) => entry.id,
      )
    ).join(",");
    window.sessionStorage.setItem(FRESH_KEY, ids);
    window.localStorage.setItem(SEEN_KEY, newest);
    return ids;
  } catch {
    return "";
  }
}

function buildRows(
  months: ChangelogMonth<RiverEntry>[],
  { fold, unfolded }: { fold: boolean; unfolded: ReadonlySet<string> },
): Row[] {
  if (months.length === 0) {
    return [{ type: "empty", key: "empty" }];
  }
  const rows: Row[] = [];
  for (const month of months) {
    rows.push({ type: "month", key: `month-${month.key}`, month });
    for (const week of month.weeks) {
      rows.push({ type: "week", key: `week-${week.start}`, week });
      const fixes = week.entries.filter((entry) => entry.kind === "fixed");
      const folded = fold && fixes.length >= 2;
      for (const entry of week.entries) {
        if (folded && entry.kind === "fixed") {
          continue;
        }
        rows.push({
          type: "entry",
          key: `entry-${entry.id}`,
          entry,
          compact: false,
        });
      }
      if (folded) {
        const key = `fixes-${week.start}`;
        const isOpen = unfolded.has(key);
        rows.push({ type: "fixes", key, fixes, unfolded: isOpen });
        if (isOpen) {
          for (const entry of fixes) {
            rows.push({
              type: "entry",
              key: `entry-${entry.id}`,
              entry,
              compact: true,
            });
          }
        }
      }
    }
  }
  return rows;
}

function rowSpacing(row: Row): string {
  switch (row.type) {
    case "month":
      return "pt-16 first:pt-0 md:pt-0";
    case "week":
      return "pb-1 pt-12 first:pt-0";
    case "fixes":
      return "py-3";
    default:
      return "";
  }
}

function RowView({
  row,
  copy,
  locale,
  fresh,
  tallies,
  signedIn,
  open,
  onToggle,
  onUnfold,
  onShowAll,
}: {
  row: Row;
  copy: NouveautesCopy;
  locale: Locale;
  fresh: ReadonlySet<string>;
  tallies: Record<string, ReactionTally>;
  signedIn: boolean;
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onUnfold: (key: string) => void;
  onShowAll: () => void;
}) {
  switch (row.type) {
    case "month":
      // Read from the rail beside the list on a desktop, said here on a
      // phone; the mark is the month marker's reading point either way.
      return (
        <div data-month={row.month.key}>
          <h2 className="marketing-display text-display-sub md:sr-only">
            {monthTitle(row.month, locale)}
          </h2>
        </div>
      );
    case "week":
      return (
        <div
          data-week={weekMonday(row.week.start)}
          className="flex scroll-mt-32 items-center gap-4"
        >
          <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
            {weekTitle(row.week, locale)}
          </p>
          <span className="h-px flex-1 bg-white/10" aria-hidden />
        </div>
      );
    case "entry":
      return (
        <EntryCard
          entry={row.entry}
          copy={copy}
          fresh={fresh.has(row.entry.id)}
          open={open.has(row.entry.id)}
          onToggle={() => onToggle(row.entry.id)}
          tally={tallies[changelogTarget(row.entry.id)] ?? NO_TALLY}
          signedIn={signedIn}
          compact={row.compact}
        />
      );
    case "fixes":
      return (
        <button
          type="button"
          aria-expanded={row.unfolded}
          onClick={() => onUnfold(row.key)}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 rounded-[1.25rem] border border-white/[0.07] px-5 text-left text-sm transition-colors duration-hover hover:border-white/15 hover:bg-white/[0.04]",
            marketingFocus,
          )}
        >
          <span
            className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT.fixed)}
            aria-hidden
          />
          <span className="shrink-0 font-medium text-marketing-ink">
            {countLabel(copy.river.fixes, row.fixes.length)}
          </span>
          <span className="min-w-0 flex-1 truncate text-marketing-muted">
            {row.fixes.map((entry) => entry.title).join(" · ")}
          </span>
          <m.span
            className="flex shrink-0 text-marketing-muted"
            animate={{ rotate: row.unfolded ? 180 : 0 }}
            transition={PILL_SPRING}
          >
            <CaretDown size={14} weight="bold" aria-hidden />
          </m.span>
        </button>
      );
    case "empty":
      return (
        <div className="glass-flat flex flex-col items-start gap-4 rounded-[1.5rem] p-6">
          <p className="text-marketing-muted">{copy.river.empty}</p>
          <button
            type="button"
            onClick={onShowAll}
            className={cn(
              "min-h-11 rounded-full border border-white/12 px-4 text-sm text-marketing-ink transition-colors duration-hover hover:bg-white/[0.07]",
              marketingFocus,
            )}
          >
            {copy.river.reset}
          </button>
        </div>
      );
  }
}

/**
 * The month being read, on a desktop: its name rolling over to the next as
 * the list crosses into it — up when the list goes on, down when it goes
 * back — with the year and its count under it.
 */
function MonthMarker({
  month,
  dir,
  locale,
  copy,
}: {
  month: ChangelogMonth<RiverEntry>;
  dir: 1 | -1;
  locale: Locale;
  copy: NouveautesCopy;
}) {
  const count = month.weeks.reduce((sum, week) => sum + week.entries.length, 0);
  return (
    <div className="hidden md:block" aria-hidden>
      <div className="relative h-[1.15em] overflow-hidden marketing-display text-display-sub">
        <AnimatePresence initial={false} custom={dir}>
          <m.span
            key={month.key}
            custom={dir}
            className="absolute inset-0 block"
            variants={{
              enter: (d: 1 | -1) => ({ y: d > 0 ? "105%" : "-105%" }),
              rest: { y: "0%" },
              leave: (d: 1 | -1) => ({ y: d > 0 ? "-105%" : "105%" }),
            }}
            initial="enter"
            animate="rest"
            exit="leave"
            transition={{ duration: 0.6, ease: EASE }}
          >
            {capitalised(monthLong(month.month, locale))}
          </m.span>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-sm text-marketing-muted">
        {month.year} · {countLabel(copy.river.monthCount, count)}
      </p>
    </div>
  );
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthTitle(month: ChangelogMonth<RiverEntry>, locale: Locale) {
  return `${capitalised(monthLong(month.month, locale))} ${month.year}`;
}

/** « 5 – 11 octobre », « 1er – 4 octobre », or one day alone. */
function weekTitle(week: ChangelogWeek<RiverEntry>, locale: Locale): string {
  const end = dayAndMonth(week.end, locale);
  return week.start === week.end
    ? end
    : `${dayAndMonth(week.start, locale).split(" ")[0]} – ${end}`;
}
