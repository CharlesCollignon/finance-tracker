import { useEffect } from "react";
import { RefreshControl, ScrollView } from "react-native";

import { buildAttention } from "@finance/core/attention";
import { resolveSpine } from "@finance/core/spine";

import { gatherBearingFacts } from "@/lib/bearing";
import { clearPanelCache } from "@/lib/bearing-panel";

import { AttentionRow } from "@/components/bearing/AttentionRow";
import { BearingCards } from "@/components/bearing/BearingCards";
import { Headline } from "@/components/bearing/Headline";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useDataVersion } from "@/lib/data-version";
import { useTabBarClearance } from "@/theme/chrome";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Where the whole of it stands, on one day.
 *
 * The phone's first tab, and the app's landing surface on both clients. Two
 * figures and five cards, the same five the web draws and in the same order:
 * every figure here is one some other screen already renders, so a card is a
 * way in to the places its numbers are explained — the Ledger, Charges, Plan,
 * Wallets.
 *
 * It was twelve draggable tiles whose order a model wrote and a reader could
 * overrule, and the three mechanisms that produced that order — an
 * arrangement, a set of pins, a slot template — were all answers to "which of
 * these matters most?". A list of five, one per fact family, does not ask the
 * question: nothing is ranked because nothing is hidden. The model, the pins,
 * the drag handle and the arrange button are gone with it, and so is the
 * staleness line that existed to say the model's choice had aged.
 *
 * Nothing on this screen calls a model, and nothing on it now reaches the web
 * app at all: the fact pack comes straight out of Supabase like every other
 * query, so the Bearing renders with no server of ours in the path.
 *
 * Everything visible comes from one fact pack, so there is no half of the
 * screen that could arrive first. What a card holds *under* its figures is
 * fetched on the press instead — see `Panel`.
 */
export default function BearingScreen() {
  const { user } = useAuth();
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const bottom = useTabBarClearance();
  const dataVersion = useDataVersion();

  // A write anywhere in the app should not leave a panel showing what a
  // figure used to be. This covers the writes made from outside a panel —
  // the quick-add sheet, another screen — so that a panel not open yet is
  // not handed stale detail the next time it opens.
  //
  // It is not what rescues the panel a write was made *in*. That one clears
  // the cache itself before asking again, because this effect runs after its
  // refetch rather than before it: passive effects flush child-first, and
  // `Panel` sits several levels below this screen. See `handleChanged` in
  // `components/bearing/Panel.tsx`.
  useEffect(() => {
    clearPanelCache();
  }, [dataVersion]);

  const { data, loading, refreshing, onRefreshAll } = useRefreshable(
    async () => (user ? await gatherBearingFacts(user.id, locale) : null),
    [user?.id, locale, dataVersion],
  );

  if (loading || !data) {
    return (
      <Screen title={t("nav.bearing")}>
        <ScreenSkeleton />
      </Screen>
    );
  }

  const facts = data;

  // Built above the thin branch on purpose. `thin` is not "nobody has done
  // anything" — it is "no position has been taken yet", which is exactly
  // what a reader who has just finished onboarding looks like: templates
  // saved, not one row written, so `recurringToApply` is already non-zero
  // and this list already has an item in it. It used to be built below the
  // branch and thrown away for them.
  const attention = buildAttention({
    swallowed: facts.swallowed,
    pendingInbox: facts.pendingInbox,
    recurringToApply: facts.recurringToApply,
    readyToClose: facts.closes.next
      ? {
          monthLabel: facts.closes.next.label,
          isBaseline: facts.closes.next.isBaseline,
        }
      : null,
    proposals: facts.proposals,
  });

  if (facts.thin) {
    return (
      <Screen title={t("nav.bearing")}>
        <EmptyState title={t("bearing.title")} description={t("bearing.empty")}>
          {/* The row, and deliberately not the headline: two hero-sized
              figures over an empty account are two statements about a
              position nobody has taken yet. The row states nothing about the
              account. It names the one thing worth doing and links to where
              it is done, which is all this reader is short of. */}
          {attention.length > 0 ? (
            <AttentionRow attention={attention} />
          ) : undefined}
        </EmptyState>
      </Screen>
    );
  }

  // The spine's ladder, a pure function of figures `gatherBearingFacts`
  // already widened its return with — see that function's own doc comment
  // for where `swallowed`, `proposals` and `recurringToApply` come from.
  // The action row's own list is built above, before the thin branch.
  //
  // `everClosed` and `closes` answer two different questions, per
  // `spine.ts`'s own doc comment on `SpineInput`, and per the identical
  // reasoning the web `BearingPage` already carries: `everClosed` is "has
  // any close happened, a baseline included" — `history` carries a baseline
  // close, so its length is the right signal, not `summary.sample` (which
  // only counts *reconciled* closes and stays 0 for the whole month between
  // a baseline close and the first one after it). `closes` is only "is
  // there a streak worth a flame", which a baseline genuinely has none of
  // yet, so it stays null exactly when `sample` is 0.
  const spineState = resolveSpine({
    pulse: facts.pulse,
    everClosed: facts.closes.history.length > 0,
    closes:
      facts.closes.summary.sample > 0
        ? {
            streak: facts.closes.summary.streak,
            bestStreak: facts.closes.summary.bestStreak,
          }
        : null,
    remaining: facts.summary.remaining,
  });

  return (
    <Screen title={t("nav.bearing")} className="px-4 py-0">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshAll}
            tintColor={colors.mutedForeground}
          />
        }
        contentContainerClassName="gap-6"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* The two figures the screen is opened for, before anything that has
            to be pressed to be read. */}
        <Headline state={spineState} />

        {attention.length > 0 ? <AttentionRow attention={attention} /> : null}

        <BearingCards
          facts={facts}
          spine={spineState}
          trend={facts.trend}
          locale={locale}
        />
      </ScrollView>
    </Screen>
  );
}
