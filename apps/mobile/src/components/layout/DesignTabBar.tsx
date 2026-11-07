import { Ionicons } from "@expo/vector-icons";
import type { Tabs } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { Design } from "@finance/core/designs";

import { hapticLight, hapticMedium, hapticSelection } from "@/lib/haptics";
import { useQuickAdd } from "@/providers/QuickAddProvider";
import { useT } from "@/providers/LocaleProvider";
import { COLORS } from "@/theme/tokens";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

/** What `Tabs` hands a custom bar (expo-router exports no name for it). */
type BarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

/** One surface of the bar, as `(tabs)/_layout.tsx` lists them. */
export interface DesignTab {
  name: string;
  label: string;
  icon: IoniconName;
  iconInactive: IoniconName;
  /** Something waits behind it: a dot. */
  waiting: boolean;
}

/**
 * The tab bar of « Papier », « Bento » and « Console »: drawn whole rather
 * than as React Navigation's bar dressed up, so each design controls every
 * pixel of it (`docs/plans/DESIGN_LAYOUTS_PLAN.md`, phase 7, redone after
 * the owner saw 1.9.0). « Nuit » keeps the platform bar.
 *
 * - « Papier »: the surfaces as words on a ruled line of ink; an accent
 *   underline glides to the one pressed.
 * - « Bento »: a dark pill floating over the foot of the screen, the add as
 *   a lime disc in its middle; a lighter disc slides behind the icon you are
 *   in, and the icon springs in as it lands.
 * - « Console »: numbered tabs; a block of the accent snaps across to the one
 *   you are in, its number followed by a blinking caret.
 *
 * Every press gives a light tick; the motions stand still under « reduce
 * motion ». Heights match `theme/chrome.ts`, so screens clear the bar as
 * before.
 */
export function DesignTabBar({
  design,
  tabs,
  active,
  barHeight,
  state,
  navigation,
  insets,
}: BarProps & {
  design: Exclude<Design, "nuit">;
  tabs: DesignTab[];
  /** The surface the screen on view belongs to (`barTabOf`). */
  active: string | null;
  barHeight: number;
}) {
  const press = (name: string) => {
    const route = state.routes.find((candidate) => candidate.name === name);
    if (!route) {
      return;
    }
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (active !== name) {
      void hapticSelection();
    }
    if (!event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  switch (design) {
    case "papier":
      return (
        <PapierBar
          tabs={tabs}
          active={active}
          onPress={press}
          barHeight={barHeight}
          insetBottom={insets.bottom}
        />
      );
    case "bento":
      return (
        <BentoDock
          tabs={tabs}
          active={active}
          onPress={press}
          insetBottom={insets.bottom}
        />
      );
    case "console":
      return (
        <ConsoleBar
          tabs={tabs}
          active={active}
          onPress={press}
          barHeight={barHeight}
          insetBottom={insets.bottom}
        />
      );
  }
}

interface BarPartProps {
  tabs: DesignTab[];
  active: string | null;
  onPress: (name: string) => void;
}

/** Where each item sits in its bar, measured as it lays out. */
type Slots = Record<string, { x: number; width: number }>;

function useSlots() {
  const [slots, setSlots] = useState<Slots>({});
  const measure = (name: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setSlots((current) =>
      current[name]?.x === x && current[name]?.width === width
        ? current
        : { ...current, [name]: { x, width } },
    );
  };
  return { slots, measure };
}

/** The move of an indicator: quick, settled, no bounce; none if asked. */
function useGlide(reduce: boolean, duration: number) {
  return (to: number) =>
    reduce
      ? to
      : withTiming(to, { duration, easing: Easing.out(Easing.cubic) });
}

/* ------------------------------------------------------------------ Papier */

/** Inset of the underline from its cell's edges, so it reads as the word's. */
const PAPIER_UNDERLINE_INSET = 10;

function PapierBar({
  tabs,
  active,
  onPress,
  barHeight,
  insetBottom,
}: BarPartProps & { barHeight: number; insetBottom: number }) {
  const reduce = useReducedMotion();
  const glide = useGlide(reduce, 260);
  const { slots, measure } = useSlots();
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const shown = useSharedValue(0);

  const slot = active ? slots[active] : undefined;
  useEffect(() => {
    if (!slot) {
      shown.set(0);
      return;
    }
    const left = slot.x + PAPIER_UNDERLINE_INSET;
    const span = Math.max(slot.width - PAPIER_UNDERLINE_INSET * 2, 12);
    // The first placement lands without travelling in from the left edge.
    if (shown.get() === 0) {
      x.set(left);
      width.set(span);
      shown.set(1);
      return;
    }
    x.set(glide(left));
    width.set(glide(span));
  }, [slot, glide, shown, x, width]);

  const underline = useAnimatedStyle(() => ({
    opacity: shown.get(),
    width: width.get(),
    transform: [{ translateX: x.get() }],
  }));

  return (
    <View
      style={[
        styles.docked,
        {
          height: barHeight + insetBottom,
          paddingBottom: insetBottom,
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: COLORS.foreground,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.papierUnderline,
          { backgroundColor: COLORS.primary },
          underline,
        ]}
      />
      <View style={styles.row}>
        {tabs.map((tab) => (
          <PapierWord
            key={tab.name}
            tab={tab}
            lit={tab.name === active}
            // Six words across a 360pt phone leave about 58pt each, under
            // what « Récurrents » needs at 14: the size follows the count,
            // and Android and iOS shrink a word further rather than cut it.
            size={tabs.length > 5 ? 12 : 14}
            onLayout={measure(tab.name)}
            onPress={() => onPress(tab.name)}
          />
        ))}
      </View>
    </View>
  );
}

/** One word of « Papier »'s bar: it gives a little under the finger, and
 * the one you are in rises a hair and darkens as the underline arrives. */
function PapierWord({
  tab,
  lit,
  size,
  onPress,
  onLayout,
}: {
  tab: DesignTab;
  lit: boolean;
  size: number;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const ink = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    ink.set(reduce ? (lit ? 1 : 0) : withTiming(lit ? 1 : 0, { duration: 220 }));
  }, [lit, reduce, ink]);
  const word = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }, { translateY: -1.5 * ink.get() }],
  }));
  const deep = useAnimatedStyle(() => ({ opacity: ink.get() }));
  const text = (color: string) => (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
      maxFontSizeMultiplier={1.3}
      style={{
        fontFamily: "Newsreader-SemiBold",
        fontSize: size,
        letterSpacing: -0.1,
        color,
      }}
    >
      {tab.label}
    </Text>
  );
  return (
    <Pressable
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: lit }}
      accessibilityLabel={tab.label}
      onPressIn={() => {
        if (!reduce) scale.set(withTiming(0.92, { duration: 90 }));
      }}
      onPressOut={() => {
        if (!reduce) scale.set(withSpring(1, { damping: 14, stiffness: 320 }));
      }}
      onPress={onPress}
      style={styles.cell}
    >
      <Animated.View style={word}>
        {text(COLORS.mutedForeground)}
        {/* The deep ink laid over the quiet one, faded in: a colour change
            Reanimated can run on the UI thread. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { alignItems: "center" }, deep]}
        >
          {text(COLORS.foreground)}
        </Animated.View>
      </Animated.View>
      {tab.waiting ? (
        <View style={[styles.papierDot, { backgroundColor: COLORS.primary }]} />
      ) : null}
    </Pressable>
  );
}

/* ------------------------------------------------------------------- Bento */

/** « Bento »'s pill keeps its own dark ground whatever the palette around. */
const BENTO = {
  ground: "#0f1115",
  lit: "#2a2e37",
  ink: "#ffffff",
  quiet: "#9aa1ad",
  lime: "#d4f25c",
} as const;
const BENTO_HEIGHT = 64;
const BENTO_DISC = 46;
const BENTO_ADD = 52;

function BentoDock({
  tabs,
  active,
  onPress,
  insetBottom,
}: BarPartProps & { insetBottom: number }) {
  const t = useT();
  const quickAdd = useQuickAdd();
  const reduce = useReducedMotion();
  const { slots, measure } = useSlots();
  const discX = useSharedValue(0);
  const shown = useSharedValue(0);
  const middle = Math.ceil(tabs.length / 2);

  const slot = active ? slots[active] : undefined;
  useEffect(() => {
    if (!slot) {
      shown.set(0);
      return;
    }
    const to = slot.x + slot.width / 2 - BENTO_DISC / 2;
    if (shown.get() === 0 || reduce) {
      discX.set(to);
      shown.set(1);
      return;
    }
    discX.set(withSpring(to, { damping: 20, stiffness: 260, mass: 0.8 }));
  }, [slot, reduce, discX, shown]);

  const disc = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateX: discX.get() }],
  }));

  const item = (tab: DesignTab) => (
    <BentoIcon
      key={tab.name}
      tab={tab}
      lit={tab.name === active}
      onLayout={measure(tab.name)}
      onPress={() => onPress(tab.name)}
    />
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.floating, { bottom: insetBottom + 12 }]}
    >
      <View style={[styles.bentoPill, { backgroundColor: BENTO.ground }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.bentoDisc, { backgroundColor: BENTO.lit }, disc]}
        />
        {tabs.slice(0, middle).map(item)}
        {quickAdd ? (
          <BentoAdd label={t("add.open")} onPress={() => quickAdd.open()} />
        ) : null}
        {tabs.slice(middle).map(item)}
      </View>
    </View>
  );
}

function BentoIcon({
  tab,
  lit,
  onPress,
  onLayout,
}: {
  tab: DesignTab;
  lit: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);

  // The icon springs in as the disc arrives under it.
  useEffect(() => {
    if (lit && !reduce) {
      scale.set(
        withSequence(
          withTiming(0.82, { duration: 90 }),
          withSpring(1, { damping: 12, stiffness: 320 }),
        ),
      );
    }
  }, [lit, reduce, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Pressable
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: lit }}
      accessibilityLabel={tab.label}
      onPressIn={() => {
        if (!reduce) scale.set(withTiming(0.88, { duration: 90 }));
      }}
      onPressOut={() => {
        if (!reduce) scale.set(withSpring(1, { damping: 14, stiffness: 300 }));
      }}
      onPress={onPress}
      style={styles.bentoSlot}
    >
      <Animated.View style={style}>
        <Ionicons
          name={lit ? tab.icon : tab.iconInactive}
          size={22}
          color={lit ? BENTO.ink : BENTO.quiet}
        />
      </Animated.View>
      {tab.waiting ? (
        <View style={[styles.bentoDot, { backgroundColor: BENTO.lime }]} />
      ) : null}
    </Pressable>
  );
}

function BentoAdd({ label, onPress }: { label: string; onPress: () => void }) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const turn = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }, { rotate: `${turn.get()}deg` }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        if (reduce) return;
        scale.set(withTiming(0.9, { duration: 90 }));
        turn.set(withTiming(90, { duration: 220, easing: Easing.out(Easing.cubic) }));
      }}
      onPressOut={() => {
        if (reduce) return;
        scale.set(withSpring(1, { damping: 12, stiffness: 300 }));
        turn.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
      }}
      onPress={() => {
        void hapticMedium();
        onPress();
      }}
      style={styles.bentoAddSlot}
    >
      <Animated.View
        style={[styles.bentoAdd, { backgroundColor: BENTO.lime }, style]}
      >
        <Ionicons name="add" size={28} color={BENTO.ground} />
      </Animated.View>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- Console */

function ConsoleBar({
  tabs,
  active,
  onPress,
  barHeight,
  insetBottom,
}: BarPartProps & { barHeight: number; insetBottom: number }) {
  const reduce = useReducedMotion();
  const glide = useGlide(reduce, 160);
  const { slots, measure } = useSlots();
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const shown = useSharedValue(0);
  const caret = useSharedValue(1);

  const slot = active ? slots[active] : undefined;
  useEffect(() => {
    if (!slot) {
      shown.set(0);
      return;
    }
    if (shown.get() === 0) {
      x.set(slot.x);
      width.set(slot.width);
      shown.set(1);
      return;
    }
    x.set(glide(slot.x));
    width.set(glide(slot.width));
  }, [slot, glide, shown, x, width]);

  // A terminal's caret after the number you are on, blinking.
  useEffect(() => {
    if (reduce) {
      caret.set(1);
      return;
    }
    caret.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1, { duration: 520 }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 420 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(caret);
  }, [reduce, caret]);

  const block = useAnimatedStyle(() => ({
    opacity: shown.get(),
    width: width.get(),
    transform: [{ translateX: x.get() }],
  }));

  return (
    <View
      style={[
        styles.docked,
        {
          height: barHeight + insetBottom,
          paddingBottom: insetBottom,
          backgroundColor: COLORS.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: COLORS.hairlineStrong,
        },
      ]}
    >
      <View style={styles.row}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.consoleBlock,
            { backgroundColor: COLORS.primary },
            block,
          ]}
        />
        {tabs.map((tab, index) => (
          <ConsoleTab
            key={tab.name}
            tab={tab}
            number={index + 1}
            lit={tab.name === active}
            caret={caret}
            onLayout={measure(tab.name)}
            onPress={() => onPress(tab.name)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * One tab of « Console »'s bar. Its layout is a fixed style — every tab an
 * equal share of the row — and the press shows as a faint wash of the
 * accent, animated: a `style` worked out from `pressed` was dropped on
 * Android in 1.10.0, and the tabs fell in a heap at the left.
 */
function ConsoleTab({
  tab,
  number,
  lit,
  caret,
  onPress,
  onLayout,
}: {
  tab: DesignTab;
  number: number;
  lit: boolean;
  /** The blinking caret's opacity, shared by the bar. */
  caret: SharedValue<number>;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const reduce = useReducedMotion();
  const wash = useSharedValue(0);
  const washStyle = useAnimatedStyle(() => ({ opacity: wash.get() }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.get() }));
  const ink = lit ? COLORS.primaryForeground : COLORS.mutedForeground;
  return (
    <Pressable
      onLayout={onLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: lit }}
      accessibilityLabel={tab.label}
      onPress={onPress}
      onPressIn={() => {
        if (lit) return;
        void hapticLight();
        wash.set(reduce ? 0.14 : withTiming(0.14, { duration: 60 }));
      }}
      onPressOut={() => {
        wash.set(reduce ? 0 : withTiming(0, { duration: 220 }));
      }}
      style={[styles.cell, styles.consoleCell]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: COLORS.primary },
          washStyle,
        ]}
      />
      <View style={styles.consoleNumberRow}>
        <Text style={[styles.consoleNumber, { color: ink }]}>{number}</Text>
        {lit ? (
          <Animated.View
            style={[styles.consoleCaret, { backgroundColor: ink }, caretStyle]}
          />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1.2}
        style={[styles.consoleLabel, { color: ink }]}
      >
        {tab.label}
      </Text>
      {tab.waiting ? (
        <View
          style={[
            styles.consoleDot,
            {
              backgroundColor: lit ? COLORS.primaryForeground : COLORS.primary,
            },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  docked: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  papierUnderline: {
    position: "absolute",
    top: -1,
    left: 0,
    height: 3,
  },
  papierDot: {
    position: "absolute",
    top: 12,
    right: 8,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  floating: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  bentoPill: {
    width: "100%",
    maxWidth: 420,
    height: BENTO_HEIGHT,
    borderRadius: BENTO_HEIGHT / 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    shadowColor: "#0f1115",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  bentoDisc: {
    position: "absolute",
    left: 0,
    top: (BENTO_HEIGHT - BENTO_DISC) / 2,
    width: BENTO_DISC,
    height: BENTO_DISC,
    borderRadius: BENTO_DISC / 2,
  },
  bentoSlot: {
    flex: 1,
    height: BENTO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  bentoDot: {
    position: "absolute",
    top: 16,
    right: "28%",
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  bentoAddSlot: {
    width: BENTO_ADD + 12,
    height: BENTO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  bentoAdd: {
    width: BENTO_ADD,
    height: BENTO_ADD,
    borderRadius: BENTO_ADD / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  consoleBlock: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  consoleCell: {
    gap: 2,
  },
  consoleNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  consoleNumber: {
    fontFamily: "IBMPlexMono-Medium",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  consoleCaret: {
    width: 6,
    height: 12,
  },
  consoleLabel: {
    fontFamily: "IBMPlexMono-Medium",
    fontSize: 9,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  consoleDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 5,
    height: 5,
  },
});
