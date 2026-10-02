import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeOutRight,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

import {
  groupDecidedFeed,
  type DecidedFeedGroup,
} from "@finance/core/bank-decided-groups";
import {
  groupPendingFeed,
  type FeedGroup,
} from "@finance/core/bank-inbox-groups";
import type { BankMerchantIndex } from "@finance/core/bank-merchant";
import type { Category } from "@finance/core/types/database";

import { ReviewCategoryChooser } from "@/components/review/ReviewCategoryChooser";
import { ReviewGroupCard } from "@/components/review/ReviewGroupCard";
import { RecentlyDecided } from "@/components/review/RecentlyDecided";
import { useTweenedCount } from "@/components/review/useTweenedCount";
import { Button } from "@/components/ui/Button";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import {
  fileFeedGroup,
  leaveOutFeedGroup,
  reopenFeedGroup,
  type GroupDecision,
} from "@/lib/bank-connect";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { getBankMerchantIndex, type PendingFeedRow } from "@/lib/queries";
import {
  fetchWholeStatement,
  getDecidedFeedRows,
  recategoriseDecidedRows,
  wholeStatementWorthFetching,
  type DecidedFeedRow,
} from "@/lib/review-data";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface BankInboxSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PendingFeedRow[];
  categories: Category[];
  /** Most-recently-used category ids, newest first. */
  recentCategoryIds?: string[];
}

type Group = FeedGroup<PendingFeedRow>;
type Decided = DecidedFeedGroup<DecidedFeedRow>;

/** What the category list is open for, while it fills the sheet. */
type Choosing =
  | { kind: "pending"; key: string; title: string }
  | { kind: "decided"; group: Decided };

const LEAVE_MS = 220;

/** Drops the rows answered here, recomputing what each group still holds. */
function withoutHidden(
  groups: readonly Group[],
  hidden: ReadonlySet<string>,
): Group[] {
  return groups.flatMap((group) => {
    const rows = group.rows.filter((row) => !hidden.has(row.id));
    if (rows.length === 0) {
      return [];
    }
    if (rows.length === group.rows.length) {
      return [group];
    }
    return [
      {
        ...group,
        rows,
        count: rows.length,
        total:
          Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) /
          100,
        firstOn: rows[rows.length - 1]!.occurredOn,
        lastOn: rows[0]!.occurredOn,
      },
    ];
  });
}

/**
 * The review inbox: every shop at once, as on the web.
 *
 * What the bank reported that the app would not file on its own, grouped by
 * shop (`groupPendingFeed`) with the biggest first, so one answer files every
 * row of a shop and teaches the matcher that shop once. It used to be one
 * card at a time; a list shows how much there is, lets the obvious ones go in
 * any order, and leaves the hard one for last without a "later" button. The
 * category list fills the sheet while one is being chosen
 * (`ReviewCategoryChooser`) rather than giving every card its own dropdown.
 *
 * Below, what was decided recently, read from the database
 * (`RecentlyDecided`), so a decision can still be taken back after the sheet
 * has closed. "Fetch everything" asks the bank for the whole statement while
 * the feed is still short of it. Decisions go through the web server
 * (`/api/bank/feed`), so the duplicate check is the web's own.
 */
export function BankInboxSheet({
  open,
  onOpenChange,
  items,
  categories,
  recentCategoryIds = [],
}: BankInboxSheetProps) {
  const t = useT();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  /*
   * Keyed by group or by row, like the web inbox's `choices`: a missing key
   * is an empty selection rather than a comparison that can reach into null.
   */
  const [choices, setChoices] = useState<Record<string, string>>({});
  // Rows answered here, hidden at once rather than when the screen's reload
  // arrives. By row, so an undo puts back exactly what it took.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  // Only until the screen's next read says the row is gone. Kept for good, a
  // row put back somewhere else — undone on the web — would stay invisible
  // here for as long as the Journal stayed open. Adjusted while rendering,
  // the pattern React documents for "reset state when an input changes".
  const [readItems, setReadItems] = useState(items);
  if (readItems !== items) {
    setReadItems(items);
    const present = new Set(items.map((item) => item.id));
    setHidden((current) => {
      const kept = [...current].filter((id) => present.has(id));
      return kept.length === current.size ? current : new Set(kept);
    });
  }
  // Opened or shut by hand; otherwise a mixed group is open and the rest shut.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const [answered, setAnswered] = useState(false);
  const [pending, setPending] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [merchants, setMerchants] = useState<BankMerchantIndex | null>(null);
  const [decided, setDecided] = useState<DecidedFeedRow[]>([]);
  const [backfill, setBackfill] = useState(false);

  const readDecided = useCallback(async () => {
    if (!userId) {
      return;
    }
    setDecided(await getDecidedFeedRows(userId));
  }, [userId]);

  // Read on each opening: filing is what teaches the suggestions, so the last
  // sitting's answers belong in this one's, and the decided list is the
  // database's, not the sheet's.
  useEffect(() => {
    if (!open || !userId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const [index, rows, worth] = await Promise.all([
        getBankMerchantIndex(userId),
        getDecidedFeedRows(userId),
        wholeStatementWorthFetching(userId),
      ]);
      if (!cancelled) {
        setMerchants(index);
        setDecided(rows);
        setBackfill(worth);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const groups = useMemo(
    () =>
      merchants
        ? groupPendingFeed(items, { bankMerchants: merchants, categories })
        : null,
    [items, merchants, categories],
  );
  const visible = useMemo(
    () => (groups ? withoutHidden(groups, hidden) : []),
    [groups, hidden],
  );
  const decidedGroups = useMemo(() => groupDecidedFeed(decided), [decided]);
  const remaining = visible.reduce((sum, group) => sum + group.count, 0);
  const shownGroups = useTweenedCount(visible.length);
  const shownEntries = useTweenedCount(remaining);

  function close() {
    setChoosing(null);
    onOpenChange(false);
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

  /**
   * Every surface moves with a decision — totals, the statement, the tab dot
   * — because the write announces itself; this sheet only has its own list
   * of what was decided to read again.
   */
  function settled() {
    setAnswered(true);
    void readDecided();
  }

  function decide(
    ids: string[],
    work: () => Promise<GroupDecision | { error: string }>,
    describe: (decision: GroupDecision) => string,
    good: boolean,
  ) {
    hide(ids);
    void (async () => {
      const result = await work();
      if ("error" in result) {
        unhide(ids);
        toast(result.error, "error");
        return;
      }
      void (good ? hapticSuccess() : hapticLight());
      toast(describe(result), "success");
      settled();
    })();
  }

  function filedSummary(decision: GroupDecision, categoryId: string): string {
    const name =
      categories.find((category) => category.id === categoryId)?.name ?? "";
    return (
      [
        decision.imported > 0
          ? t("inboxGroups.filed", { count: decision.imported, category: name })
          : null,
        decision.matched > 0
          ? t("inboxGroups.alreadyRecorded", { count: decision.matched })
          : null,
      ]
        .filter((part): part is string => part !== null)
        .join(" · ") || t("inbox.done")
    );
  }

  function file(ids: string[], categoryId: string) {
    if (!categoryId) {
      toast(t("inbox.pickCategoryFirst"), "error");
      return;
    }
    decide(
      ids,
      () => fileFeedGroup(ids, categoryId),
      (decision) => filedSummary(decision, categoryId),
      true,
    );
  }

  function leaveOut(ids: string[]) {
    decide(
      ids,
      () => leaveOutFeedGroup(ids),
      (decision) => t("inboxGroups.leftOut", { count: decision.ignored }),
      false,
    );
  }

  function undo(group: Decided) {
    if (pending) {
      return;
    }
    const ids = group.rows.map((row) => row.id);
    setPending(true);
    void (async () => {
      const result = await reopenFeedGroup(ids);
      setPending(false);
      if ("error" in result) {
        toast(result.error, "error");
        return;
      }
      unhide(ids);
      toast(
        t("inboxGroups.putBack", { count: result.reopened || ids.length }),
        "success",
      );
      settled();
    })();
  }

  function recategorise(group: Decided, categoryId: string) {
    setPending(true);
    void (async () => {
      const result = await recategoriseDecidedRows(
        group.rows.map((row) => row.id),
        categoryId,
      );
      setPending(false);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      void hapticSuccess();
      toast(t("actions.moved"), "success");
      settled();
    })();
  }

  function fetchEverything() {
    if (fetching) {
      return;
    }
    setFetching(true);
    void (async () => {
      const result = await fetchWholeStatement();
      setFetching(false);
      if ("error" in result) {
        toast(result.error, "error");
        return;
      }
      toast(result.message, "success");
      if (userId) {
        setBackfill(await wholeStatementWorthFetching(userId));
      }
    })();
  }

  function pick(categoryId: string) {
    if (!choosing) {
      return;
    }
    if (choosing.kind === "decided") {
      const group = choosing.group;
      setChoosing(null);
      recategorise(group, categoryId);
      return;
    }
    setChoices((current) => ({ ...current, [choosing.key]: categoryId }));
    setChoosing(null);
  }

  const chooserValue =
    choosing?.kind === "pending"
      ? (choices[choosing.key] ??
        visible.find((group) => group.key === choosing.key)
          ?.suggestedCategoryId ??
        "")
      : choosing?.kind === "decided"
        ? (choosing.group.categoryId ?? "")
        : "";

  const body = !groups ? (
    <View className="items-center py-10">
      <ActivityIndicator color={colors.mutedForeground} />
    </View>
  ) : choosing ? (
    <ReviewCategoryChooser
      title={choosing.kind === "pending" ? choosing.title : choosing.group.name}
      categories={categories}
      recentCategoryIds={recentCategoryIds}
      value={chooserValue}
      onPick={pick}
      onBack={() => setChoosing(null)}
    />
  ) : (
    <View className="gap-5">
      <View className="gap-2">
        <Text variant="label">
          {visible.length > 0
            ? t("inbox.needsCategory")
            : t("inbox.nothingWaiting")}
        </Text>
        {visible.length > 0 ? (
          <>
            <Text
              accessibilityLabel={`${t("inboxGroups.groups", {
                count: visible.length,
              })} · ${t("inboxGroups.entries", { count: remaining })}`}
              className="font-sans tabular-nums text-sm font-medium"
            >
              {`${t("inboxGroups.groups", { count: shownGroups })} · ${t(
                "inboxGroups.entries",
                { count: shownEntries },
              )}`}
            </Text>
            <Text variant="muted" className="text-sm">
              {t("inbox.taughtIt")}
            </Text>
          </>
        ) : answered ? (
          <View className="flex-row items-center gap-2">
            <Ionicons
              name="checkmark-circle"
              size={ICON.md}
              color={colors.success}
            />
            <Text className="text-sm text-success">
              {t("inboxGroups.allFiled")}
            </Text>
          </View>
        ) : null}
        {/* The whole statement rather than the recent window: a different
            job from the header's refresh, and worth its own button. */}
        {backfill ? (
          <Button
            label={fetching ? t("inbox.fetching") : t("inbox.fetchEverything")}
            variant="outline"
            size="sm"
            icon="cloud-download-outline"
            className="self-start"
            disabled={fetching}
            onPress={fetchEverything}
          />
        ) : null}
      </View>

      {visible.length > 0 ? (
        <View className="gap-3">
          {visible.map((group) => (
            <Animated.View
              key={group.key}
              exiting={
                reduceMotion ? undefined : FadeOutRight.duration(LEAVE_MS)
              }
              layout={
                reduceMotion ? undefined : LinearTransition.duration(LEAVE_MS)
              }
            >
              <ReviewGroupCard
                group={group}
                categories={categories}
                choices={choices}
                expanded={
                  group.count > 1 && (toggled[group.key] ?? group.mixed)
                }
                onToggle={() =>
                  setToggled((current) => ({
                    ...current,
                    [group.key]: !(current[group.key] ?? group.mixed),
                  }))
                }
                onChoose={(key, title) =>
                  setChoosing({ kind: "pending", key, title })
                }
                onFile={() =>
                  file(
                    group.rows.map((row) => row.id),
                    choices[group.key] ?? group.suggestedCategoryId ?? "",
                  )
                }
                onLeaveOut={() => leaveOut(group.rows.map((row) => row.id))}
                onFileRow={(row) => file([row.id], choices[row.id] ?? "")}
                onLeaveOutRow={(row) => leaveOut([row.id])}
              />
            </Animated.View>
          ))}
        </View>
      ) : null}

      <RecentlyDecided
        groups={decidedGroups}
        pending={pending}
        onChangeCategory={(group) => setChoosing({ kind: "decided", group })}
        onUndo={undo}
      />

      <Button label={t("inbox.done")} variant="outline" onPress={close} />
    </View>
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => (choosing ? setChoosing(null) : close())}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityLabel={t("inbox.close")}
          className="flex-1"
          onPress={close}
        />
        <View className="max-h-[90%] rounded-t-card border border-border bg-card px-card pt-3">
          <SheetGrabber />
          <View className="mb-3 flex-row items-center justify-between gap-3">
            <Text
              accessibilityRole="header"
              className="min-w-0 flex-1 font-semibold"
              style={{ fontSize: 18 }}
            >
              {t("inbox.fromYourBank")}
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t("inbox.close")}
              className="min-h-11 justify-center px-2"
            >
              <Text variant="muted">{t("inbox.close")}</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="pb-10"
          >
            {body}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
