import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReorderableDrag } from "react-native-reorderable-list";
import Animated, {
  Easing,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

import type { RenderedTile } from "@finance/core/bearing-read";
import type { ReadSegment } from "@finance/core/month-read";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";

import { Panel } from "@/components/bearing/Panel";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { PrivateAmount } from "@/components/PrivateAmount";
import { cn } from "@/lib/cn";
import { useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * One figure, on the phone.
 *
 * A single column rather than the web's bento, and that is a deliberate
 * difference rather than an unfinished port. A phone wants one figure per
 * row anyway, and drag-reordering a grid of mixed spans on a 375px screen is
 * a great deal of complexity for a layout nobody was asking for. The order is
 * the same order and it is stored in the same place, so a tile moved here
 * moves on the laptop.
 *
 * The span still arrives on the tile and is still used: the first slot is the
 * hero, and it gets the large figure. That is the one piece of the web's
 * rhythm worth keeping, because "the thing to look at first" should look like
 * it.
 *
 * Pressing a tile no longer navigates. It opens `Panel` in the row beneath
 * it — the same disclosure the web app's `Tile.tsx` switched to, and for the
 * same reason: `tile.href` used to be what a press did, and it is now only
 * the way out to the full surface, from the panel's own footer link. The row
 * growing to fit the panel is `Animated.View`'s own `layout` transition
 * rather than a measured height, which is what lets it work for content
 * whose height nobody knows in advance — the panel's blocks stream in one at
 * a time as their detail arrives.
 */

interface BearingTileProps {
  tile: RenderedTile;
  pinned: boolean;
  draggable: boolean;
  /** True while this tile's panel is open. */
  open: boolean;
  /** Opens this tile's panel, or closes it if it is already open. */
  onToggle: () => void;
}

export function BearingTile({
  tile,
  pinned,
  draggable,
  open,
  onToggle,
}: BearingTileProps) {
  const t = useT();
  const colors = useThemeColors();
  const drag = useReorderableDrag();
  const reduceMotion = useReducedMotion();

  const hero = tile.span === "hero";

  // The datum says which way is good; the value says which way it went. A
  // rise in something marked "rising is bad" is the one combination worth
  // colouring, and its opposite is the one worth rewarding.
  const tone =
    tile.sense === "neutral" || tile.value === 0
      ? colors.foreground
      : (tile.sense === "up-is-good" ? tile.value > 0 : tile.value < 0)
        ? colors.primaryInk
        : colors.destructive;

  return (
    <Card
      className={cn("mb-3", pinned && "border-foreground/25")}
      style={{ paddingVertical: hero ? 20 : 14 }}
    >
      <Animated.View
        layout={
          reduceMotion
            ? undefined
            : LinearTransition.duration(DURATION.panel).easing(
                Easing.bezier(...EASE_STANDARD),
              )
        }
      >
        <View className="flex-row items-start justify-between gap-3">
          <Pressable
            className="min-w-0 flex-1"
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            // The catalogue's own wording, not the label alone: a screen
            // reader landing on one of a dozen otherwise-identical tiles
            // needs to hear which figure it presses as well as what pressing
            // it does, and what pressing it does depends on whether it is
            // already open.
            accessibilityLabel={`${tile.label}: ${tile.display}. ${
              open ? t("bearing.panel.close") : t("bearing.panel.open")
            }`}
          >
            <Text className="text-sm text-muted-foreground">{tile.label}</Text>

            <PrivateAmount
              style={[hero ? TYPE.hero : TYPE.figure, { color: tone }]}
              className="mt-1"
            >
              {tile.display}
            </PrivateAmount>

            {tile.caption ? (
              <View className="mt-1 flex-row flex-wrap items-baseline">
                <Caption segments={tile.caption} />
              </View>
            ) : null}

            {/* Only on the hero, and only when the pack put one there. A caveat
                repeated on every tile is a caveat nobody reads. */}
            {hero && tile.note ? (
              <Text
                className="mt-1 text-muted-foreground"
                style={TYPE.micro}
              >
                {tile.note}
              </Text>
            ) : null}
          </Pressable>

          {draggable ? (
            <Pressable
              // The handle starts the drag; nothing else does. Long-pressing
              // the whole card would make every press a gamble on how long the
              // finger stayed down, on a card whose main job is to open its
              // panel.
              //
              // Inert rather than merely dimmed while this tile's own panel
              // is open — not styled-disabled, actually unable to start a
              // drag. `react-native-reorderable-list`'s `startDrag` sizes the
              // drop indicator and the neighbours' shift distance from
              // `itemSize` synchronously, *before* it calls `onDragStart`
              // (its own source comment: "run animation before onDragStart
              // to avoid potentially waiting for it"). Closing the panel from
              // `onDragStart` — which is how `index.tsx` closes every
              // *other* open panel when a drag begins elsewhere — is a JS
              // state update that lands a render late for the tile actually
              // being dragged: the list would size the whole gesture to the
              // panel-open height while the tile shrank underneath it.
              // Never wiring `drag` at all for this tile while its own panel
              // is open removes that race instead of losing it: `dragHandler`
              // is this cell's only path into `startDrag`, so an `onLongPress`
              // that is never bound here means `startDrag` is never called
              // for this index while the panel is up, whatever the gesture
              // does.
              onLongPress={open ? undefined : drag}
              delayLongPress={180}
              disabled={open}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityState={{ disabled: open }}
              accessibilityLabel={t("bearing.reorder", { label: tile.label })}
              className={cn(open && "opacity-50")}
            >
              <Ionicons
                name="reorder-two-outline"
                size={ICON.lg}
                color={colors.mutedForeground}
              />
            </Pressable>
          ) : tile.href ? (
            <Ionicons
              name="chevron-forward"
              size={ICON.sm}
              color={colors.mutedForeground}
            />
          ) : null}
        </View>

        {open ? <Panel tile={tile} /> : null}
      </Animated.View>
    </Card>
  );
}

/**
 * A caption, with each figure in its own element.
 *
 * That separation is not styling: privacy mode blurs amounts one element at a
 * time, and prose cannot be blurred selectively. It is one of the reasons the
 * model is never allowed to write a number itself.
 */
function Caption({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <Text key={index} className="text-muted-foreground" style={TYPE.micro}>
            {segment.text}
          </Text>
        ) : (
          <PrivateAmount
            key={index}
            className="font-medium text-muted-foreground"
            style={TYPE.micro}
          >
            {segment.display}
          </PrivateAmount>
        ),
      )}
    </>
  );
}
