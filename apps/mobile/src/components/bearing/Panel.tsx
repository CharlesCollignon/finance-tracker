import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import type { BearingCard } from "@finance/core/bearing-cards";
import type { PanelChrome } from "@finance/core/bearing-panels";
import { phoneHref } from "@finance/core/bearing-tiles";
import {
  budgetViewOptionLabel,
  getCurrentMonth,
  type BudgetViewMode,
} from "@finance/core/constants";
import type { Key } from "@finance/core/i18n/t";

import {
  clearPanelCache,
  getPanelDetail,
  peekPanelDetail,
  type PanelDetail,
  type PanelScope,
} from "@/lib/bearing-panel";
import { notifyDataChanged } from "@/lib/data-version";
import {
  PanelBlockSkeleton,
  PanelBlockView,
} from "@/components/bearing/panel-blocks";
import { MonthPicker } from "@/components/MonthPicker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

/** The three windows worth offering. A year is the Plan surface's own. */
const HORIZONS = [6, 12, 24] as const;

/**
 * What a card holds under its figures, on the phone.
 *
 * The web's `Panel.tsx` carries the argument this one shares: the figures are
 * already on screen and already correct, so nothing here may cover them. The
 * lead stays exactly where `BearingCards` drew it and this component only
 * fills the space that card's own `Animated.View` grows to make room for —
 * chrome and block skeletons appear the instant the card opens, and the real
 * detail streams into them underneath. There is no spinner anywhere in this
 * file, and that is deliberate: a spinner over a number the app already knows
 * teaches the reader to distrust the number.
 *
 * Which blocks appear is `bearing-cards.ts`'s judgement, not this
 * component's, and the card arrives carrying them. It used to look itself up
 * through `panelFor(tile.id, tile.family)`, which was the right shape while
 * twelve tiles each explained one figure; with one card per family the lookup
 * and the card say the same thing, so the card says it.
 *
 * The scope (which month, which view, how far the projection runs) lives here
 * as local state rather than in the URL, because the phone has no address bar
 * for it to live in and because scoping it to the open card means the cards
 * above are untouched by it.
 *
 * Detail is fetched through `getPanelDetail`, which reads Supabase directly
 * (see `bearing-panel.ts`) and caches per family-and-scope for the session.
 * The initial state is seeded from that cache synchronously
 * (`peekPanelDetail`) so reopening a card already visited this session shows
 * its detail on the very first frame rather than flashing a skeleton for one.
 */
export function Panel({ card }: { card: BearingCard }) {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();

  const current = getCurrentMonth();
  const [scope, setScope] = useState<Required<PanelScope>>({
    year: current.year,
    month: current.month,
    view: "current",
    horizon: HORIZONS[1],
  });

  const [detail, setDetail] = useState<PanelDetail | null>(() =>
    user ? peekPanelDetail(user.id, card.id, scope, card.blocks, locale) : null,
  );
  const [failed, setFailed] = useState(false);
  // Bumped by the retry link and by any write a block makes (a decided bank
  // row, a saved close setting, a written read) — the only way to ask for
  // the same scope again once it is cached. Nothing reads it but the effect
  // below.
  const [attempt, setAttempt] = useState(0);

  /**
   * The figures belong to the scope they were fetched for, so a scope the
   * reader has moved on from must not keep rendering.
   *
   * `scope` is plain state and updates on the next frame; `detail` only
   * updates when the fetch resolves. Without this, stepping the month puts
   * the new month in the picker above the outgoing month's figures until the
   * round trip lands — a header and a body disagreeing about which month
   * they describe. Seeded from the cache exactly the way the first render is,
   * so a month already visited this session comes back instantly and only an
   * unvisited one falls back to the block skeletons.
   *
   * Reset during render rather than in an effect, which is React's own
   * remedy for state that has to follow a change — the Bearing screen uses
   * the same pattern for a dragged order. An effect would paint the
   * mismatched frame first and then correct it.
   *
   * Locale rides along with scope, for the same reason and with one the web
   * does not have: the detail carries month names and other rendered words,
   * so a language change leaves the chrome above it speaking the new
   * language and the body below it the old one. On the phone that change
   * does not even need the reader — `LocaleProvider` settles the language in
   * three asynchronous steps, so the stored and the account choice can both
   * land after a panel is already open.
   */
  const [shown, setShown] = useState({ scope, locale });
  if (shown.scope !== scope || shown.locale !== locale) {
    setShown({ scope, locale });
    setDetail(
      user
        ? peekPanelDetail(user.id, card.id, scope, card.blocks, locale)
        : null,
    );
    setFailed(false);
  }

  // `card.blocks` is safe in the dependency list: `buildBearingCards` hands
  // back one of the module-level arrays in `bearing-cards.ts` rather than
  // building a new one, so its identity is stable for as long as the card is.
  useEffect(() => {
    if (!user) {
      return;
    }
    let stale = false;

    void (async () => {
      const next = await getPanelDetail(
        user.id,
        card.id,
        scope,
        card.blocks,
        locale,
      );
      if (stale) {
        return;
      }
      setDetail(next);
      setFailed(next === null);
    })();

    return () => {
      stale = true;
    };
  }, [user, card.id, scope, card.blocks, locale, attempt]);

  function handleChanged() {
    // Clear first, and from here rather than from the screen's own
    // `dataVersion` effect. Both state changes below land in one commit, and
    // React flushes passive effects child-first — this component is several
    // levels below `BearingScreen`, so the refetch `attempt` triggers runs
    // before the screen's `clearPanelCache` does. `getPanelDetail` reads the
    // cache synchronously before its first await, so it would hand back the
    // entry written before the very change being reported, and the bump would
    // be a no-op on the one panel the reader is looking at.
    clearPanelCache();
    // And tell the rest of the app — the Bearing's own cards included — that
    // a write happened. This panel also asks again immediately, rather than
    // waiting to be reopened.
    notifyDataChanged();
    setAttempt((count) => count + 1);
  }

  return (
    <View className="mt-3 gap-4 border-t border-border pt-3">
      <Chrome
        chrome={card.chrome}
        scope={scope}
        setScope={setScope}
        detail={detail}
      />

      {detail
        ? card.blocks.map((block) => (
            <PanelBlockView
              key={block}
              block={block}
              detail={detail}
              onViewChange={(view) =>
                setScope((current) => ({ ...current, view }))
              }
              onChanged={handleChanged}
            />
          ))
        : failed
          ? null
          : card.blocks.map((block) => (
              <PanelBlockSkeleton key={block} block={block} />
            ))}

      {/* Instead of the blocks that could not be drawn, never over them. The
          figure above is still true — it was already on screen — so this is
          a note about the detail and not about the number. */}
      {failed ? (
        <View className="gap-1">
          <Text variant="muted" className="text-sm">
            {t("bearing.panel.failed")}
          </Text>
          <Pressable
            onPress={() => setAttempt((count) => count + 1)}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-primary-ink underline">
              {t("bearing.panel.retry")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Footer destinations={card.destinations} />
    </View>
  );
}

/* ---------------------------------------------------------------- footer */

/**
 * The ways out, and there is more than one of them.
 *
 * A tile had a single `href` and a footer that said "see the full surface". A
 * card holds a whole family, and its figures are explained in two or three
 * different places. Choosing one of them to be *the* destination would be the
 * same invention `bearing-tiles.ts` refuses when it leaves a figure's href
 * null, so every distinct destination the phone can actually reach is offered
 * and each is named after the tab it goes to.
 *
 * `card.destinations` is the web router's vocabulary — `bearing-tiles.ts` says
 * so itself — so each one goes through `phoneHref` first. That drops the two
 * paths this app has no screen for and translates `/budgets` to Plan, and the
 * translation can collapse two web destinations onto one tab, which is why
 * the result is de-duplicated again here rather than trusting the card's own
 * de-duplication to survive it.
 */
function Footer({ destinations }: { destinations: string[] }) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();

  const hrefs: string[] = [];
  for (const destination of destinations) {
    const href = phoneHref(destination);
    if (href && !hrefs.includes(href)) {
      hrefs.push(href);
    }
  }

  if (hrefs.length === 0) {
    return null;
  }

  return (
    <View className="flex-row flex-wrap items-center gap-x-5 gap-y-2">
      {hrefs.map((href) => (
        <Pressable
          key={href}
          onPress={() => router.push(href as Href)}
          accessibilityRole="link"
          className="flex-row items-center gap-1"
          hitSlop={8}
        >
          <Text className="text-sm font-medium text-primary-ink">
            {t(surfaceKey(href) ?? "bearing.panel.footer")}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={ICON.sm}
            color={colors.primaryInk}
          />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * What to call a destination: the tab's own name, in the words the tab bar
 * already uses for it.
 *
 * Written out rather than read off `(tabs)/_layout.tsx`'s `TABS`, which keys
 * route names and not paths, and which Expo Router would have to grow a
 * non-default export on to be readable from here. Four entries, because
 * `phoneHref` can only ever hand this four paths — `/dashboard` and
 * `/history` are already null by then, and `/budgets` has become `/planning`.
 * Anything unmapped falls back to the old "see the full surface" wording
 * rather than to a guess at a name.
 */
const SURFACE_KEYS: Record<string, Key> = {
  "/transactions": "nav.ledger",
  "/recurring": "nav.charges",
  "/planning": "nav.plan",
  "/investments": "nav.wallets",
};

function surfaceKey(href: string): Key | null {
  const query = href.indexOf("?");
  return SURFACE_KEYS[query < 0 ? href : href.slice(0, query)] ?? null;
}

/* ---------------------------------------------------------------- chrome */

/**
 * What sits above a card's blocks, per `card.chrome`.
 *
 * Four cases and one of them is nothing, which is the point of the type: the
 * `now` and `wallet` families have no window to choose — "now" is today and
 * a portfolio is whatever it is worth — so offering them a control would be
 * offering a choice the figures cannot honour.
 */
function Chrome({
  chrome,
  scope,
  setScope,
  detail,
}: {
  chrome: PanelChrome;
  scope: Required<PanelScope>;
  setScope: Dispatch<SetStateAction<Required<PanelScope>>>;
  detail: PanelDetail | null;
}) {
  const t = useT();
  const locale = useLocale();

  switch (chrome) {
    case "none":
      return null;

    case "month-scope":
      return (
        <View className="gap-2">
          <MonthPicker
            year={scope.year}
            month={scope.month}
            onChange={(year, month) =>
              setScope((current) => ({ ...current, year, month }))
            }
          />
          <SegmentedControl<BudgetViewMode>
            label={t("common.budgetView")}
            value={scope.view}
            onChange={(view) => setScope((current) => ({ ...current, view }))}
            segments={[
              {
                value: "current",
                label: budgetViewOptionLabel(
                  "current",
                  scope.year,
                  scope.month,
                  locale,
                ),
              },
              {
                value: "month_end",
                label: budgetViewOptionLabel(
                  "month_end",
                  scope.year,
                  scope.month,
                  locale,
                ),
              },
            ]}
          />
        </View>
      );

    case "streak":
      return <Streak detail={detail} />;

    case "horizon":
      return (
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="label">{t("bearing.panel.horizon")}</Text>
          <SegmentedControl
            label={t("bearing.panel.horizon")}
            value={String(scope.horizon)}
            onChange={(value) =>
              setScope((current) => ({ ...current, horizon: Number(value) }))
            }
            // "6M" and "1Y" read the same in both languages, which is why
            // these are written out directly rather than asked of the
            // catalogue for a two-character string — the same reasoning the
            // retired `TrendCard`'s own range switch used.
            segments={[
              { value: "6", label: "6M" },
              { value: "12", label: "1Y" },
              { value: "24", label: "2Y" },
            ]}
          />
        </View>
      );
  }
}

/**
 * The run, above the shelf that lists it.
 *
 * Waits for the detail rather than guessing: the streak is the one piece of
 * chrome that is itself a figure, and a placeholder zero would be a wrong
 * number shown confidently for as long as the fetch takes.
 *
 * No heading of its own any more. `bearing.panel.streakHeading` was the words
 * "Your run", which is also `bearing.cards.run` — on a tile it named a panel
 * nothing else had named, and on a card it is the card's own title repeated
 * one line under itself. The web dropped it when it moved to cards; this was
 * the last thing in either app still saying it, so the key went with it.
 */
function Streak({ detail }: { detail: PanelDetail | null }) {
  const t = useT();
  const summary = detail?.family === "run" ? detail.closes.summary : null;

  return (
    <View className="gap-0.5">
      {summary ? (
        <Text variant="muted" className="text-xs">
          {summary.streak > 0
            ? t("bearing.panel.streakMonths", { count: summary.streak })
            : t("bearing.panel.streakNone")}
          {summary.bestStreak > 0
            ? ` · ${t("bearing.panel.bestRun", { count: summary.bestStreak })}`
            : ""}
        </Text>
      ) : (
        <Skeleton className="h-3 w-48" />
      )}
    </View>
  );
}
