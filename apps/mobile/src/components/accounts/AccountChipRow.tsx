import { useRef, useState } from "react";
import {
  ScrollView,
  View,
  type AccessibilityActionEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { moveAccount, slotAfterDrag } from "@finance/core/account-order";

import { LAYOUT } from "@/components/motion/fade";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";

/** How long a finger rests on a chip before it lifts; a tap is shorter. */
const HOLD_MS = 350;
/** `gap-1.5`, the space between two chips. */
const GAP = 6;

interface Option<T extends string> {
  value: T;
  label: string;
}

/**
 * Placements' accounts as a row of chips, and the way to put them in an
 * order of one's own.
 *
 * `ChipRow`'s look and behaviour, plus a drag: hold a chip and it lifts,
 * follows the finger along the row, and drops where it is let go — the
 * others sliding into the new order. A finger that moves before the hold
 * scrolls the row as before; a tap still chooses. Screen readers get two
 * actions on each chip, earlier and later, for the same move.
 *
 * The chip moves alone while it is held rather than the others making room
 * as it passes, which is the web's way: each place it passes would mean a
 * round trip from the gesture to React and back, and a chip that jumped
 * under the finger is worse than one that waits for the drop.
 */
export function AccountChipRow<T extends string>({
  options,
  value,
  onChange,
  onReorder,
  trailing,
  label,
}: {
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** The values in their new order, once a chip has been dropped elsewhere. */
  onReorder: (order: T[]) => void;
  /** After the chips, not movable: the one that adds an account. */
  trailing?: { label: string; onPress: () => void };
  /** What the row holds, read before the chips by a screen reader. */
  label: string;
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  // The order the reader has made here, while it holds the same values as
  // the screen's: an account added or removed hands the order back to it.
  const [order, setOrder] = useState<T[] | null>(null);
  const [lifted, setLifted] = useState<T | null>(null);
  const values = options.map((option) => option.value);
  const shown =
    order &&
    order.length === values.length &&
    order.every((entry) => values.includes(entry))
      ? order
      : values;
  const labels = new Map(options.map((option) => [option.value, option.label]));
  const widths = useRef(new Map<T, number>());
  const movable = shown.length > 1;

  function drop(id: T, dx: number) {
    setLifted(null);
    const from = shown.indexOf(id);
    const to = slotAfterDrag(
      shown.map((entry) => widths.current.get(entry) ?? 0),
      GAP,
      from,
      dx,
    );
    if (to === from) {
      return;
    }
    void hapticSelection();
    const next = moveAccount(shown, from, to);
    setOrder(next);
    onReorder(next);
  }

  function step(id: T, by: number) {
    const from = shown.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= shown.length) {
      return;
    }
    const next = moveAccount(shown, from, to);
    setOrder(next);
    onReorder(next);
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={lifted === null}
        contentContainerClassName="gap-1.5"
        // The lifted chip is drawn over its neighbours, not cut at the row.
        style={{ overflow: "visible" }}
      >
        {shown.map((id) => (
          <Chip
            key={id}
            label={labels.get(id) ?? id}
            selected={id === value}
            lifted={lifted === id}
            movable={movable}
            reduceMotion={reduceMotion}
            hint={movable ? t("accounts.reorderHintPhone") : undefined}
            earlierLabel={t("accounts.moveEarlier")}
            laterLabel={t("accounts.moveLater")}
            onLayoutWidth={(width) => widths.current.set(id, width)}
            onSelect={() => {
              if (id !== value) {
                void hapticSelection();
                onChange(id);
              }
            }}
            onLift={() => {
              void hapticSelection();
              setLifted(id);
            }}
            onDrop={(dx) => drop(id, dx)}
            onStep={(by) => step(id, by)}
          />
        ))}
        {trailing ? (
          <Chip
            label={trailing.label}
            selected={false}
            lifted={false}
            movable={false}
            reduceMotion={reduceMotion}
            onSelect={trailing.onPress}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  selected,
  lifted,
  movable,
  reduceMotion,
  hint,
  earlierLabel,
  laterLabel,
  onLayoutWidth,
  onSelect,
  onLift,
  onDrop,
  onStep,
}: {
  label: string;
  selected: boolean;
  lifted: boolean;
  movable: boolean;
  reduceMotion: boolean;
  hint?: string;
  earlierLabel?: string;
  laterLabel?: string;
  onLayoutWidth?: (width: number) => void;
  onSelect: () => void;
  onLift?: () => void;
  onDrop?: (dx: number) => void;
  onStep?: (by: number) => void;
}) {
  const dx = useSharedValue(0);
  const lift = useSharedValue(0);

  const tap = Gesture.Tap()
    .maxDuration(HOLD_MS)
    .onEnd((_event, success) => {
      if (success) {
        scheduleOnRN(onSelect);
      }
    });
  const drag = Gesture.Pan()
    .enabled(movable)
    .activateAfterLongPress(HOLD_MS)
    .onStart(() => {
      lift.set(withTiming(1, { duration: 120 }));
      if (onLift) {
        scheduleOnRN(onLift);
      }
    })
    .onUpdate((event) => {
      dx.set(event.translationX);
    })
    .onEnd((event, success) => {
      // A drag the system cancelled puts the chip back where it was.
      if (onDrop) {
        scheduleOnRN(onDrop, success ? event.translationX : 0);
      }
    })
    .onFinalize(() => {
      dx.set(0);
      lift.set(withTiming(0, { duration: 120 }));
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.get() }, { scale: 1 + 0.08 * lift.get() }],
    zIndex: lift.get() > 0 ? 1 : 0,
  }));

  // A gesture is not a press, so the double tap that chooses a chip under a
  // screen reader has to be asked for by name.
  const actions = [
    { name: "activate" },
    ...(movable
      ? [
          { name: "earlier", label: earlierLabel ?? "" },
          { name: "later", label: laterLabel ?? "" },
        ]
      : []),
  ];

  return (
    <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
      <Animated.View
        layout={reduceMotion ? undefined : LAYOUT}
        style={style}
        onLayout={(event) => onLayoutWidth?.(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole={onLift ? "radio" : "button"}
        accessibilityState={onLift ? { selected } : undefined}
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityActions={actions}
        onAccessibilityAction={(event: AccessibilityActionEvent) => {
          if (event.nativeEvent.actionName === "activate") {
            onSelect();
          } else if (event.nativeEvent.actionName === "earlier") {
            onStep?.(-1);
          } else if (event.nativeEvent.actionName === "later") {
            onStep?.(1);
          }
        }}
        hitSlop={{ top: 8, bottom: 8 }}
        className={cn(
          "h-8 justify-center rounded-full border px-3",
          selected ? "border-foreground bg-foreground" : "border-border",
          lifted && "border-primary",
        )}
      >
        <Text
          numberOfLines={1}
          className={cn(
            "text-xs font-medium",
            selected ? "text-background" : "text-muted-foreground",
          )}
        >
          {label}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}
