import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { AttentionItem } from "@finance/core/attention";
import type { Key } from "@finance/core/i18n/t";
import type { MonthStanding } from "@finance/core/month-pulse";
import type { SpineState } from "@finance/core/spine";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

type ThemeColors = ReturnType<typeof useThemeColors>;

interface SpineProps {
  state: SpineState;
  attention: AttentionItem[];
}

/**
 * The fixed spine above the bearing tiles, on the phone: one figure, one
 * ring, one flame, and — if anything is waiting — the one thing most worth
 * doing next.
 *
 * The web twin (`apps/web/components/finance/bearing/Spine.tsx`) carries the
 * ladder's own reasoning in full; this component draws the same four ring
 * states for the same reason but in the phone's own idiom rather than its
 * markup — no `Card`, no bento chrome, a hairline border underneath is the
 * only edge it draws, and the streak chip reuses the exact shape
 * `MonthScore.tsx` already drew for the same figure rather than the web
 * Spine's own `FlameBadge`.
 *
 * Mounted above `ReorderableList`, outside it, in `(tabs)/index.tsx` — see
 * that file's own comment for why.
 */
export function Spine({ state, attention }: SpineProps) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  const formatMoney = useFormatCurrency();

  const top = attention[0];
  const rest = attention.length - 1;

  const negative = state.headline.figure === "free" && state.headline.value < 0;

  return (
    <View className="gap-3 border-b border-border pb-4">
      <View className="flex-row flex-wrap items-end justify-between gap-3">
        <View className="flex-row items-end gap-4">
          <View className="gap-0.5">
            <Text variant="muted" className="text-sm">
              {t(headlineLabelKey(state.headline))}
            </Text>
            <AnimatedAmount
              value={state.headline.value}
              format={formatMoney}
              style={[TYPE.hero, negative ? { color: colors.destructive } : null]}
            />
          </View>

          <Ring ring={state.ring} />
        </View>

        {state.flame ? <FlameBadge flame={state.flame} /> : null}
      </View>

      {top ? (
        <Pressable
          onPress={() => router.push(attentionHref(top.href) as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${t(top.messageKey, top.params)}. ${t(top.actionKey)}`}
          className="flex-row items-center gap-3 py-1"
          hitSlop={8}
        >
          <View
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              top.tone === "wrong" ? "bg-destructive" : "bg-primary",
            )}
          />
          <Text numberOfLines={1} className="flex-1 text-sm">
            {t(top.messageKey, top.params)}
          </Text>
          {rest > 0 ? (
            <Text style={TYPE.micro} className="shrink-0 text-muted-foreground">
              {t("bearing.spine.moreWaiting", { count: rest })}
            </Text>
          ) : null}
          <View className="shrink-0 flex-row items-center gap-1">
            <Text className="text-sm font-medium text-primary-ink">
              {t(top.actionKey)}
            </Text>
            <Ionicons name="arrow-forward" size={ICON.sm} color={colors.primaryInk} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Where an attention row's action leads, on the phone.
 *
 * `buildAttention`'s `href`s are a web route from a fixed, closed set of
 * five (`/transactions`, `/transactions?review=inbox`, `/budgets` twice,
 * `/recurring`) — a different vocabulary from a bearing tile's, and NOT
 * covered by `phoneHref` from `@finance/core/bearing-tiles`, which is
 * documented as a translation of that catalogue's own paths, not a general
 * web-to-phone router. So this checks the attention set by hand against
 * `apps/mobile/src/app/(tabs)/`: `transactions.tsx` and `recurring.tsx` are
 * real tabs and answer `/transactions`, `/transactions?review=inbox` and
 * `/recurring` unchanged; there is no `budgets` route at all, and its
 * answer — the caps, the close and the ready-to-close prompt this item is
 * about — lives on `planning.tsx`, so `/budgets` alone is redirected there.
 */
function attentionHref(href: string): string {
  return href === "/budgets" ? "/planning" : href;
}

/** Mirrors `pulseHeadline` in `month-pulse.ts` off the fields `resolveSpine` already reduced it to. */
function headlineLabelKey(headline: SpineState["headline"]): Key {
  if (headline.figure === "remaining") {
    return "pulse.headlineLeft";
  }
  return headline.value < 0 ? "pulse.headlineShort" : "pulse.headlineFree";
}

/**
 * The streak chip, in the same shape `MonthScore.tsx` already drew for the
 * same two figures — the phone's own idiom for a streak, not a port of the
 * web Spine's `FlameBadge`.
 */
function FlameBadge({ flame }: { flame: NonNullable<SpineState["flame"]> }) {
  const t = useT();
  const colors = useThemeColors();
  const { streak, best } = flame;

  if (streak <= 1 && best <= 1) {
    return null;
  }

  return (
    <View className="flex-row items-center gap-2">
      {streak > 1 ? (
        <View className="flex-row items-center gap-1 rounded-full bg-accent px-2 py-0.5">
          <Ionicons name="flame" size={ICON.xs} color={colors.primaryInk} />
          <Text className="text-xs font-medium text-accent-foreground">
            {t("month.streakInARow", { count: streak })}
          </Text>
        </View>
      ) : null}
      {best > streak && best > 1 ? (
        <View className="flex-row items-center gap-1 rounded-full border border-border px-2 py-0.5">
          <Ionicons name="trophy-outline" size={ICON.xs} color={colors.mutedForeground} />
          <Text className="text-xs text-muted-foreground">
            {t("month.bestStreak", { count: best })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The colour token a ring's tone draws in, once `over` has been ruled out. */
function toneStroke(tone: MonthStanding, colors: ThemeColors): string {
  switch (tone) {
    case "short":
      return colors.destructive;
    case "tight":
      return colors.warning;
    case "clear":
      return colors.success;
    // Structurally unreachable — see the web twin's identical comment on its
    // own `toneStroke`. Kept rather than asserted away, so an exhaustiveness
    // check stays a compile error instead of a runtime one.
    case "unknown":
      return colors.success;
  }
}

/** The sentence a `proportion` ring's tone reads out, once `over` is ruled out. */
function toneKey(tone: MonthStanding): Key {
  switch (tone) {
    case "short":
      return "bearing.spine.ringShort";
    case "tight":
      return "bearing.spine.ringTight";
    case "clear":
      return "bearing.spine.ringClear";
    case "unknown":
      return "bearing.spine.ringClear";
  }
}

const SIZE = 52;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ROTATE = [{ rotate: "-90deg" }];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Draws whichever rung `resolveSpine` already settled on — nothing here
 * re-derives the ladder. `absent` renders no ring element at all, matching
 * the core module's own point that a measurement with no target must never
 * be drawn as though it were one.
 */
function Ring({ ring }: { ring: SpineState["ring"] }) {
  const t = useT();
  const colors = useThemeColors();

  if (ring.kind === "absent") {
    return null;
  }

  if (ring.kind === "dark") {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={t("bearing.spine.ringUnmeasured")}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.hairlineStrong}
            strokeWidth={STROKE}
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  if (ring.kind === "arc") {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={t("bearing.spine.ringMeasuring")}>
        <ArcRing colors={colors} />
      </View>
    );
  }

  const clamped = Math.min(1, Math.max(0, ring.ratio));
  const percent = Math.round(clamped * 100);
  // Two separate spec rows, two separate signals: the stroke colour reads
  // off `tone` alone, always, and the fill (how much of the ring is drawn)
  // is `over`'s channel — `clamped` already caps an over-100% ratio at a
  // full ring, which is what "fills it" means without a second colour to
  // say so again. For the label both facts are said, joined, never one
  // substituted for the other.
  const toneSentence = t(toneKey(ring.tone), { percent });
  const label = ring.over
    ? `${toneSentence} · ${t("bearing.spine.ringOver")}`
    : toneSentence;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <ProportionRing clamped={clamped} stroke={toneStroke(ring.tone, colors)} colors={colors} />
    </View>
  );
}

/** The `arc` ring: a complete, unproportioned circle with no colour that could read as a verdict — see `spine.ts`. */
function ArcRing({ colors }: { colors: ThemeColors }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: DURATION.enter,
      easing: Easing.bezier(...EASE_STANDARD),
    });
    // Only ever runs once per mount: `reduceMotion` is the sole dependency
    // and an `arc` ring never changes shape once drawn, unlike `proportion`.
  }, [reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <Svg width={SIZE} height={SIZE} style={{ transform: ROTATE }}>
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={colors.hairlineStrong}
        strokeWidth={STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        // Blue reads as "measuring" everywhere else this app uses `--info`
        // on the web; `colors.info` is its phone twin.
        stroke={colors.info}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

/** The `proportion` ring, filled to `clamped` and re-animating whenever it changes, not only on mount. */
function ProportionRing({
  clamped,
  stroke,
  colors,
}: {
  clamped: number;
  stroke: string;
  colors: ThemeColors;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = clamped;
      return;
    }
    progress.value = withTiming(clamped, {
      duration: DURATION.enter,
      easing: Easing.bezier(...EASE_STANDARD),
    });
  }, [clamped, reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <Svg width={SIZE} height={SIZE} style={{ transform: ROTATE }}>
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={colors.hairlineStrong}
        strokeWidth={STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={stroke}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
