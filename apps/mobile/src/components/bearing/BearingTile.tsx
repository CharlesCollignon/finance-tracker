import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReorderableDrag } from "react-native-reorderable-list";

import type { RenderedTile } from "@finance/core/bearing-read";
import type { ReadSegment } from "@finance/core/month-read";

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
 */

interface BearingTileProps {
  tile: RenderedTile;
  pinned: boolean;
  draggable: boolean;
}

export function BearingTile({ tile, pinned, draggable }: BearingTileProps) {
  const router = useRouter();
  const t = useT();
  const colors = useThemeColors();
  const drag = useReorderableDrag();

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
      <View className="flex-row items-start justify-between gap-3">
        <Pressable
          className="min-w-0 flex-1"
          disabled={!tile.href}
          onPress={() => {
            if (tile.href) {
              router.push(tile.href as never);
            }
          }}
          // Named for what it is rather than what it does: the label and the
          // value together are the announcement, and "button" on its own
          // tells a screen reader nothing about the figure.
          accessibilityRole={tile.href ? "link" : "text"}
          accessibilityLabel={`${tile.label}: ${tile.display}`}
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
            // finger stayed down, on a card whose main job is to be a link.
            onLongPress={drag}
            delayLongPress={180}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("bearing.reorder", { label: tile.label })}
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
