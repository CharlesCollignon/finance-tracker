import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReorderableList, { reorderItems } from "react-native-reorderable-list";

import {
  renderArrangement,
  type RenderedTile,
} from "@finance/core/bearing-read";
import { slotSpan, type TileId, type TilePins } from "@finance/core/bearing-tiles";
import { formatShortDate } from "@finance/core/constants";

import {
  arrangeBearing,
  bearingOrder,
  bearingWritable,
  gatherBearingFacts,
  getBearingArrangement,
  getBearingPins,
  saveBearingPins,
} from "@/lib/bearing";

import { BearingTile } from "@/components/bearing/BearingTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { hapticSuccess } from "@/lib/haptics";
import { useDataVersion } from "@/lib/data-version";
import { ICON, TYPE } from "@/theme/tokens";
import { useTabBarClearance } from "@/theme/chrome";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Where the whole of it stands, on one day.
 *
 * The phone's first tab, and the app's landing surface on both clients. Every
 * figure here is one some other screen already renders, so a tile is a link
 * to the place its number is explained — Month, the Ledger, Plan, Wallets.
 *
 * A model chooses which figures lead and may write a few words beside one. It
 * never computes anything: it names figures by id and the values are
 * substituted here, on the device, which is what keeps the currency toggle
 * and the privacy blur working on a caption.
 *
 * Nothing on this screen calls a model. The stored arrangement renders for
 * free; only the button spends, and it is absent on a build with no web app
 * to reach — in which case the app's own ordering is what shows, which is a
 * working Bearing rather than a degraded one.
 */
export default function BearingScreen() {
  const { user } = useAuth();
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const bottom = useTabBarClearance();
  const dataVersion = useDataVersion();

  /**
   * What the user has dragged, since the last load.
   *
   * Null until they drag something, and reset the moment fresh data arrives.
   * Holding the order in state and seeding it from an effect was the obvious
   * shape and the wrong one: it derives state from props, which costs a
   * second render on every load and leaves a window where the list is empty.
   * This is the reset-during-render pattern instead — the order is derived,
   * and a drag is the only thing that overrides it.
   */
  const [dragged, setDragged] = useState<{
    order: TileId[];
    pins: TilePins;
  } | null>(null);
  const [arranging, setArranging] = useState(false);

  const { data, loading, refreshing, onRefreshAll, onRefresh } = useRefreshable(
    async () => {
      if (!user) {
        return null;
      }

      const facts = await gatherBearingFacts(user.id, locale);
      const [stored, savedPins] = await Promise.all([
        getBearingArrangement(user.id, facts),
        getBearingPins(user.id),
      ]);

      return { facts, stored, pins: savedPins };
    },
    [user?.id, locale, dataVersion],
  );

  const [snapshot, setSnapshot] = useState(data);
  if (snapshot !== data) {
    setSnapshot(data);
    setDragged(null);
  }

  // The reconciliation the whole app agrees on: the arrangement with the
  // user's pins applied. A drag overrides it until the next load, which then
  // agrees anyway, because the drag wrote those pins.
  const settled = useMemo(
    () =>
      data
        ? bearingOrder(data.stored.arrangement, data.pins, data.facts)
        : [],
    [data],
  );

  const order = dragged?.order ?? settled;
  // Memoised because the `?? {}` fallback is a fresh object every render,
  // which would re-create the reorder callback on each one.
  const pins = useMemo(
    () => dragged?.pins ?? data?.pins ?? {},
    [dragged, data],
  );

  const onReorder = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      const next = reorderItems(order, from, to);

      // Everything the user has ever placed, re-read off the list they can
      // actually see. Pinning only the tile just moved would let the ones it
      // pushed past drift back on the next arrangement.
      const moved = order[from];
      const nowPinned = new Set(Object.keys(pins));
      if (moved) {
        nowPinned.add(moved);
      }

      const nextPins: TilePins = Object.fromEntries(
        next.flatMap((id, index) => (nowPinned.has(id) ? [[id, index]] : [])),
      );
      setDragged({ order: next, pins: nextPins });
      // Fire and forget: the tile has already moved under the finger, and the
      // cost of losing the position is dragging it again.
      void saveBearingPins(nextPins);
    },
    [order, pins],
  );

  async function arrange() {
    setArranging(true);
    try {
      const outcome = await arrangeBearing();
      if (outcome.message) {
        toast(outcome.message, outcome.arranged ? "success" : "error");
      }
      if (outcome.arranged) {
        hapticSuccess();
        onRefresh();
      }
    } finally {
      setArranging(false);
    }
  }

  if (loading || !data) {
    return (
      <Screen title={t("nav.bearing")}>
        <ScreenSkeleton />
      </Screen>
    );
  }

  const { facts, stored } = data;

  if (facts.thin) {
    return (
      <Screen title={t("nav.bearing")}>
        <EmptyState
          title={t("bearing.title")}
          description={t("bearing.empty")}
        />
      </Screen>
    );
  }

  // Rendered here rather than upstream, because the display currency lives on
  // this device and no server knows it. Spans come from the position, so the
  // first tile is the hero whatever it happens to be.
  const tiles = renderArrangement(
    order,
    stored.arrangement,
    facts,
    formatEuro,
    stored.locale,
  );

  const canArrange = bearingWritable() && stored.tracked;

  return (
    <Screen title={t("nav.bearing")} className="px-4 py-0">
      <ReorderableList
        data={tiles}
        keyExtractor={(tile: RenderedTile) => tile.id}
        renderItem={({ item, index }) => (
          <BearingTile
            tile={{ ...item, span: slotSpan(index) }}
            pinned={item.id in pins}
            draggable={stored.tracked}
          />
        )}
        onReorder={onReorder}
        dragEnabled={stored.tracked}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshAll}
            tintColor={colors.mutedForeground}
          />
        }
        ListHeaderComponent={
          <View className="mb-3 gap-2">
            <Text className="text-muted-foreground" style={TYPE.micro}>
              {t("bearing.asOf", { date: formatShortDate(facts.asOf, locale) })}
              {" · "}
              {stored.arrangement
                ? t("bearing.arrangeHint")
                : t("bearing.ownOrder")}
            </Text>

            {canArrange ? (
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={arrange}
                  disabled={arranging || stored.arrangementsLeft <= 0}
                  className="flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 py-1.5"
                  style={{
                    opacity:
                      arranging || stored.arrangementsLeft <= 0 ? 0.5 : 1,
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={ICON.sm}
                    color={colors.primaryRim}
                  />
                  <Text className="text-sm">
                    {arranging ? t("bearing.arranging") : t("bearing.arrange")}
                  </Text>
                </Pressable>
                <Text className="text-muted-foreground" style={TYPE.micro}>
                  {t("bearing.arrangementsLeft", {
                    count: stored.arrangementsLeft,
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          /* Only when the figures the choice rests on have actually moved. A
             staleness line that is always on is one nobody reads. */
          stored.freshness?.standing === "moved" ? (
            <Text
              className="mt-1 text-muted-foreground"
              style={TYPE.micro}
            >
              {t("bearing.moved", {
                count: stored.freshness.moved.length,
                age: stored.freshness.age,
              })}
            </Text>
          ) : null
        }
      />
    </Screen>
  );
}
