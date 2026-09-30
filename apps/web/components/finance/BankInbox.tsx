"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  CaretRight,
  CheckCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { CategoryPicker } from "@/components/finance/CategoryPicker";
import { useToast } from "@/components/layout/ToastProvider";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { formatDayMonth, formatShortDate } from "@finance/core/constants";
import type { FeedGroup } from "@finance/core/bank-inbox-groups";
import {
  ignoreFeedItem,
  ignoreFeedItems,
  importFeedItem,
  importFeedItems,
  recategoriseFeedItem,
  syncBankFeedAction,
  undoFeedDecision,
  undoFeedDecisions,
} from "@/lib/actions/bank";
import type { Category } from "@finance/core/types/database";
import type { DecidedFeedRow, PendingFeedRow } from "@/lib/queries/bank";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

type Group = FeedGroup<PendingFeedRow>;

interface BankInboxProps {
  items: PendingFeedRow[];
  /** The same rows, one group per shop — see `groupPendingFeed`. */
  groups: Group[];
  /** What was decided recently, so a decision can be taken back. */
  decided: DecidedFeedRow[];
  categories: Category[];
  /** True until the whole statement has been pulled once. */
  showBackfill: boolean;
  /**
   * Whether to arrive with the review already open.
   *
   * Set by `?review=inbox`, which is the address of the decision rather than
   * of the page it sits on. Everything that says "you have entries to
   * categorise" — the Month screen's Needs you block, the statement card, the
   * push the bank sync sends — links to that address, because sending someone
   * who pressed Review to a page with a Review button on it is asking the
   * same question twice.
   *
   * Read once, as the initial state: a server action in here revalidates this
   * page, and a prop consulted on every render would force the sheet back
   * open after the user had closed it.
   */
  openOnArrival?: boolean;
}

/** How long a filed group takes to slide away. */
const LEAVE_MS = 220;

/**
 * Money in reads green and money out reads red, on the bank's own direction.
 *
 * Not the category's colour, which is what the ledger uses: at this point in
 * the flow there is no category yet — deciding it is the whole job — and the
 * one thing the bank has already told us is which way the money went.
 */
function Amount({
  direction,
  amount,
  className,
}: {
  direction: "in" | "out";
  amount: number;
  className?: string;
}) {
  const formatMoney = useFormatCurrency();

  return (
    <span
      className={cn(
        "privacy-amount shrink-0 tabular-nums",
        direction === "in" ? "text-success" : "text-destructive",
        className,
      )}
    >
      {direction === "in" ? "+" : "−"}
      {formatMoney(amount)}
    </span>
  );
}

/**
 * A count that runs down to its new value rather than jumping, so filing a
 * group of twenty-three reads as twenty-three things done. Straight to the
 * value under reduced motion.
 */
function useTweenedCount(value: number): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const last = useRef(value);

  useEffect(() => {
    if (reduced) {
      last.current = value;
      return;
    }
    const origin = last.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 400);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(origin + (value - origin) * eased);
      last.current = next;
      setShown(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return reduced ? value : shown;
}

/**
 * What the bank reported that the app would not file on its own, one shop at
 * a time.
 *
 * Everything the user's own history already answered for is in the ledger by
 * the time they see this, so the inbox is the exceptions — a first visit
 * somewhere, money arriving, a cash withdrawal. After a first sync over a
 * whole statement that can still be hundreds of rows, so they arrive grouped
 * by shop, the biggest first: one answer files the lot, and teaches the
 * matcher that shop for next month. A shop already filed more than one way
 * (the Amazon case) opens row by row, because one answer for all of it would
 * be a guess.
 *
 * Beside it, what was decided recently. Filing a card payment under the wrong
 * category is the easiest mistake to make here, and until now it was a
 * one-way door: the row vanished from the only screen that knew which bank
 * line it came from, and the fix meant hunting the transaction down in the
 * ledger, where that connection is no longer visible.
 */
export function BankInbox({
  items,
  groups,
  decided,
  categories,
  showBackfill,
  openOnArrival = false,
}: BankInboxProps) {
  const t = useT();
  const locale = useLocale();
  const formatMoney = useFormatCurrency();
  const { toast } = useToast();
  const reducedMotion = usePrefersReducedMotion();
  const [pending, startTransition] = useTransition();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(openOnArrival);
  const [editing, setEditing] = useState<string | null>(null);
  // Rows answered here, hidden at once rather than when the revalidated page
  // arrives. By row rather than by group, so an undo puts back exactly what
  // it took and a shop that turns up again in a later sync is not hidden.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  // Opened or shut by hand; otherwise a mixed group is open and the rest shut.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const groupRefs = useRef(new Map<string, HTMLLIElement>());
  const leaveTimers = useRef(new Map<string, number>());

  const visible = groups.flatMap((group) => {
    const rows = group.rows.filter((row) => !hidden.has(row.id));
    if (rows.length === 0) {
      return [];
    }
    if (rows.length === group.rows.length) {
      return [group];
    }
    const total =
      Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
    return [
      {
        ...group,
        rows,
        count: rows.length,
        total,
        firstOn: rows[rows.length - 1]!.occurredOn,
        lastOn: rows[0]!.occurredOn,
      },
    ];
  });
  const remaining = visible.reduce((sum, group) => sum + group.count, 0);
  const shownGroups = useTweenedCount(visible.length);
  const shownEntries = useTweenedCount(remaining);
  const done = visible.length === 0 && hidden.size > 0;

  function run(work: () => Promise<{ error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await work();
      toast(
        result.error ?? result.message ?? t("inbox.done"),
        result.error ? "error" : "success",
      );
    });
  }

  function hide(ids: readonly string[]) {
    setHidden((current) => new Set([...current, ...ids]));
  }

  function unhide(ids: readonly string[]) {
    setHidden((current) => {
      const rest = new Set(current);
      ids.forEach((id) => rest.delete(id));
      return rest;
    });
  }

  function rowCategory(row: PendingFeedRow): string {
    return choices[row.id] ?? row.suggestedCategoryId ?? "";
  }

  /** One entry of an open group, answered on its own. */
  function decideRow(
    id: string,
    work: () => Promise<{ error?: string; message?: string }>,
  ) {
    hide([id]);
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        unhide([id]);
      }
      toast(
        result.error ?? result.message ?? t("inbox.done"),
        result.error ? "error" : "success",
      );
    });
  }

  function accept(row: PendingFeedRow) {
    const categoryId = rowCategory(row);
    if (!categoryId) {
      toast(t("inbox.pickCategoryFirst"), "error");
      return;
    }
    decideRow(row.id, () => importFeedItem(row.id, categoryId));
  }

  /**
   * Slide a group away, then drop its rows from the list. Focus goes to the
   * group that takes its place, so a keyboard run through the pile never
   * falls back to the top of the sheet.
   */
  function dismiss(group: Group) {
    const index = visible.findIndex((other) => other.key === group.key);
    const next = visible[index + 1] ?? visible[index - 1];
    const element = groupRefs.current.get(group.key);
    const hadFocus = !!element && element.contains(document.activeElement);
    const ids = group.rows.map((row) => row.id);

    setLeaving((current) => new Set(current).add(group.key));
    leaveTimers.current.set(
      group.key,
      window.setTimeout(
        () => {
          leaveTimers.current.delete(group.key);
          hide(ids);
          setLeaving((current) => {
            const rest = new Set(current);
            rest.delete(group.key);
            return rest;
          });
          if (hadFocus && next) {
            setFocusedKey(next.key);
            groupRefs.current.get(next.key)?.focus();
          }
        },
        reducedMotion ? 0 : LEAVE_MS,
      ),
    );
  }

  /** Put a dismissed group back, whether it is still leaving or gone. */
  function restore(key: string, ids: readonly string[]) {
    const timer = leaveTimers.current.get(key);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      leaveTimers.current.delete(key);
    }
    setLeaving((current) => {
      const rest = new Set(current);
      rest.delete(key);
      return rest;
    });
    unhide(ids);
  }

  function offerUndo(title: string, key: string, ids: string[]) {
    if (ids.length === 0) {
      toast(title, "success");
      return;
    }
    toast({
      title,
      variant: "success",
      actionLabel: t("inbox.undo"),
      onAction: () => {
        startTransition(async () => {
          const result = await undoFeedDecisions(ids);
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          restore(key, ids);
          toast(
            t("inboxGroups.putBack", { count: result.reopened ?? ids.length }),
            "success",
          );
        });
      },
    });
  }

  function groupCategory(group: Group): string {
    return choices[group.key] ?? group.suggestedCategoryId ?? "";
  }

  function fileGroup(group: Group) {
    if (leaving.has(group.key)) {
      return;
    }
    const categoryId = groupCategory(group);
    if (!categoryId) {
      toast(t("inbox.pickCategoryFirst"), "error");
      return;
    }
    const ids = group.rows.map((row) => row.id);
    const name =
      categories.find((category) => category.id === categoryId)?.name ?? "";
    dismiss(group);
    startTransition(async () => {
      const result = await importFeedItems(ids, categoryId);
      if (result.error) {
        restore(group.key, ids);
        toast(result.error, "error");
        return;
      }
      const parts: string[] = [];
      if (result.imported) {
        parts.push(
          t("inboxGroups.filed", { count: result.imported, category: name }),
        );
      }
      if (result.matched) {
        parts.push(t("inboxGroups.alreadyRecorded", { count: result.matched }));
      }
      offerUndo(
        parts.join(" · ") || t("inbox.done"),
        group.key,
        result.decidedIds ?? [],
      );
    });
  }

  function leaveOutGroup(group: Group) {
    if (leaving.has(group.key)) {
      return;
    }
    const ids = group.rows.map((row) => row.id);
    dismiss(group);
    startTransition(async () => {
      const result = await ignoreFeedItems(ids);
      if (result.error) {
        restore(group.key, ids);
        toast(result.error, "error");
        return;
      }
      offerUndo(
        t("inboxGroups.leftOut", { count: result.ignored ?? 0 }),
        group.key,
        result.decidedIds ?? [],
      );
    });
  }

  /**
   * Keys that only mean something while a group itself has focus — never
   * while typing in its picker or pressing one of its buttons, and never on
   * the page at large. A bare "L" bound anywhere else would be the
   * character-key shortcut WCAG 2.1.4 rules out; scoped to the focused list
   * item, it is not one.
   */
  function handleListKey(event: KeyboardEvent<HTMLUListElement>) {
    const key = (event.target as HTMLElement).dataset.groupKey;
    const index = key ? visible.findIndex((group) => group.key === key) : -1;
    const group = visible[index];
    if (!group || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const focusAt = (to: number) => {
      const target = visible[to];
      if (target) {
        setFocusedKey(target.key);
        groupRefs.current.get(target.key)?.focus();
      }
    };

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      fileGroup(group);
    } else if (event.key === "l" || event.key === "L") {
      event.preventDefault();
      leaveOutGroup(group);
    }
  }

  // Nothing waiting, nothing drawn. A bar saying so was a permanent row at
  // the top of the Ledger announcing the absence of a chore. The review is
  // where the recently decided list lives too, so it is there whenever there
  // is something to decide and a mistake is most likely to be fresh — and it
  // stays open after the last entry is filed, so that one can still be taken
  // back before the sheet is closed.
  const waiting = items.length > 0;
  if (!waiting && !open) {
    return null;
  }

  /* Rimmed and dotted, the same dot and the same rim as the Needs you block
     on Month, because it is the same errand seen from its other end. */
  const bar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-hairline-strong bg-muted px-4 py-2.5">
      <p className="flex min-w-0 items-center gap-2.5 text-sm">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-foreground"
        />
        {/* One sentence rather than a bold numeral beside a fragment: French
            puts zero in the singular and agrees the verb, which a fragment
            assembled around the count cannot do. */}
        <span className="min-w-0 text-muted-foreground">
          {t("ledger.needsCategory", { count: items.length })}
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          {t("inbox.review")}
        </Button>
        {/* "Fetch everything" reaches for the whole statement rather than the
            recent window, which is a different job from the header's Refresh
            and worth its own button. */}
        {showBackfill ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={pending}
            onClick={() => run(() => syncBankFeedAction(true))}
          >
            <ArrowsClockwise size={ICON.sm} />
            {pending ? t("inbox.fetching") : t("inbox.fetchEverything")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  // One group in the tab order at a time; the arrows move between them.
  const rovingKey = visible.some((group) => group.key === focusedKey)
    ? focusedKey
    : (visible[0]?.key ?? null);

  return (
    <>
      {waiting ? bar : null}

      <MobileSheet
        open={open}
        onOpenChange={setOpen}
        title={t("inbox.fromYourBank")}
        wide={decided.length > 0}
      >
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {visible.length > 0
                ? t("inbox.needsCategory")
                : t("inbox.nothingWaiting")}
            </h3>

            {visible.length > 0 ? (
              <>
                {/* The visible count runs down; a screen reader is given
                    the settled figure instead of every step on the way. */}
                <p
                  aria-hidden
                  className="text-sm font-medium tabular-nums text-foreground"
                >
                  {t("inboxGroups.groups", { count: shownGroups })}
                  {" · "}
                  {t("inboxGroups.entries", { count: shownEntries })}
                </p>
                <p className="sr-only">
                  {t("inboxGroups.groups", { count: visible.length })}
                  {" · "}
                  {t("inboxGroups.entries", { count: remaining })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("inbox.taughtIt")}
                </p>
                <p className="hidden text-xs text-muted-foreground md:block">
                  {t("inboxGroups.keyboardHint")}
                </p>
              </>
            ) : done ? (
              <p className="flex items-center gap-2 text-sm text-success">
                <CheckCircle size={ICON.md} weight="fill" aria-hidden />
                {t("inboxGroups.allFiled")}
              </p>
            ) : null}

            <ul
              className="flex flex-col gap-3 md:max-h-[55vh] md:overflow-y-auto md:p-1"
              onKeyDown={handleListKey}
            >
              {visible.map((group) => {
                const single = group.count === 1;
                const expanded = !single && (toggled[group.key] ?? group.mixed);
                const only = group.rows[0]!;
                const entries = t("inboxGroups.entries", {
                  count: group.count,
                });

                return (
                  <li
                    key={group.key}
                    ref={(element) => {
                      if (element) {
                        groupRefs.current.set(group.key, element);
                      } else {
                        groupRefs.current.delete(group.key);
                      }
                    }}
                    data-group-key={group.key}
                    tabIndex={group.key === rovingKey ? 0 : -1}
                    onFocus={(event) => {
                      if (event.target === event.currentTarget) {
                        setFocusedKey(group.key);
                      }
                    }}
                    aria-label={t("inboxGroups.groupLabel", {
                      name: group.name,
                      entries,
                      amount: formatMoney(group.total),
                    })}
                    className={cn(
                      "flex flex-col gap-2 rounded-control border border-border p-3 outline-none",
                      "transition-[opacity,transform] duration-hover ease-out",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      leaving.has(group.key) &&
                        "pointer-events-none translate-x-6 opacity-0",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {single ? (
                        <div className="min-w-0">
                          {/* Wraps rather than truncates: the whole decision
                              is what the line says, and a bank writes
                              "PRELEVEMENT Navigo Annuel - COMUTITRES SAS",
                              which clipped tells you nothing. */}
                          <p className="text-sm font-medium">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(only.occurredOn, locale)} ·{" "}
                            {only.why}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={
                            expanded
                              ? t("inboxGroups.hideRows")
                              : t("inboxGroups.showRows")
                          }
                          onClick={() =>
                            setToggled((current) => ({
                              ...current,
                              [group.key]: !expanded,
                            }))
                          }
                          className="flex min-w-0 items-start gap-2 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <CaretRight
                            size={ICON.sm}
                            weight="bold"
                            aria-hidden
                            className={cn(
                              "mt-1 shrink-0 text-muted-foreground transition-transform duration-hover",
                              expanded && "rotate-90",
                            )}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">
                              {group.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {entries}
                              {" · "}
                              {group.firstOn === group.lastOn
                                ? formatDayMonth(group.firstOn, locale)
                                : `${formatDayMonth(group.firstOn, locale)} – ${formatDayMonth(group.lastOn, locale)}`}
                            </span>
                          </span>
                        </button>
                      )}
                      <Amount
                        direction={group.direction}
                        amount={group.total}
                        className="text-sm font-semibold"
                      />
                    </div>

                    {group.mixed ? (
                      <p className="text-xs text-muted-foreground">
                        {t("inboxGroups.mixed")}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryPicker
                        id={`feed-group-${group.key}`}
                        categories={categories}
                        value={groupCategory(group)}
                        onValueChange={(categoryId) =>
                          setChoices((current) => ({
                            ...current,
                            [group.key]: categoryId,
                          }))
                        }
                        className="min-w-44 flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fileGroup(group)}
                      >
                        {single ? t("inbox.add") : t("inboxGroups.fileAll")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => leaveOutGroup(group)}
                      >
                        {single
                          ? t("inbox.leaveOut")
                          : t("inboxGroups.leaveOutAll")}
                      </Button>
                    </div>

                    {expanded ? (
                      <ul className="mt-1 flex flex-col divide-y divide-border border-t border-border">
                        {group.rows.map((row) => (
                          <li
                            key={row.id}
                            className="flex flex-col gap-2 py-2.5"
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm">
                                  {row.counterparty ?? row.note}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatShortDate(row.occurredOn, locale)} ·{" "}
                                  {row.why}
                                </p>
                              </div>
                              <Amount
                                direction={row.direction}
                                amount={row.amount}
                                className="text-sm"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <CategoryPicker
                                id={`feed-category-${row.id}`}
                                categories={categories}
                                value={rowCategory(row)}
                                onValueChange={(categoryId) =>
                                  setChoices((current) => ({
                                    ...current,
                                    [row.id]: categoryId,
                                  }))
                                }
                                className="min-w-40 flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => accept(row)}
                              >
                                {t("inbox.add")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  decideRow(row.id, () =>
                                    ignoreFeedItem(row.id),
                                  )
                                }
                              >
                                {t("inbox.leaveOut")}
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {decided.length > 0 ? (
            <section className="flex min-w-0 flex-col gap-3 border-t border-border pt-6 md:w-80 md:shrink-0 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("inbox.recentlyDecided")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("inbox.putOneBack")}
              </p>

              <ul className="flex flex-col divide-y divide-border md:max-h-[55vh] md:overflow-y-auto">
                {decided.map((row) => (
                  <li key={row.id} className="flex flex-col gap-1.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 flex-1 text-sm">
                        {row.counterparty ?? row.note}
                      </p>
                      <Amount
                        direction={row.direction}
                        amount={row.amount}
                        className="text-sm"
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(row.occurredOn, locale)}
                      {" · "}
                      {row.status === "ignored"
                        ? t("inbox.leftOut")
                        : (row.categoryName ?? t("inbox.inYourLedger"))}
                    </p>

                    {editing === row.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryPicker
                          id={`decided-category-${row.id}`}
                          categories={categories}
                          value={choices[row.id] ?? row.categoryId ?? ""}
                          onValueChange={(categoryId) =>
                            setChoices((current) => ({
                              ...current,
                              [row.id]: categoryId,
                            }))
                          }
                          className="min-w-40 flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            const categoryId = choices[row.id];
                            if (!categoryId) {
                              toast(t("inbox.pickCategoryFirst"), "error");
                              return;
                            }
                            setEditing(null);
                            run(() => recategoriseFeedItem(row.id, categoryId));
                          }}
                        >
                          {t("inbox.move")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {row.status === "imported" ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-7 px-0"
                            disabled={pending}
                            onClick={() => setEditing(row.id)}
                          >
                            {t("inbox.changeCategory")}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-7 gap-1 px-2 text-muted-foreground"
                          disabled={pending}
                          onClick={() => run(() => undoFeedDecision(row.id))}
                        >
                          <ArrowCounterClockwise size={ICON.sm} />
                          {t("inbox.undo")}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </MobileSheet>
    </>
  );
}
