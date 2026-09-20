import { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { Key } from "@finance/core/i18n/t";
import type { MonthStanding } from "@finance/core/month-pulse";
import { drawSpineRing, type SpineState } from "@finance/core/spine";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";

import { useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";

type ThemeColors = ReturnType<typeof useThemeColors>;

/**
 * The ring, inside the card about your run.
 *
 * It was the fixed spine above the bearing tiles and it is neither fixed nor
 * above anything now. Its headline went to `Headline`, which states the two
 * figures the screen is opened for at the top of the tab; its action row went
 * to `AttentionRow`, which the screen renders itself because the reader who
 * needs it most — a brand-new account — is served the `thin` empty state and
 * never reaches this component at all. What is left is the one mark that is
 * genuinely about the run: how much of the month's allowance has gone. It
 * lives in "Your run" because that is the card it describes.
 *
 * So it draws no surface and no edge of its own — the hairline it used to
 * rule underneath itself would be the only divider inside a card that already
 * has a border.
 *
 * The web twin (`apps/web/components/finance/bearing/Spine.tsx`) carries the
 * ladder's own reasoning in full; this draws the same four ring states for
 * the same reasons but in the phone's own idiom rather than its markup.
 *
 * It drew a streak chip beside the ring — `MonthScore.tsx`'s own shape rather
 * than a port of the web Spine's `FlameBadge` — until nothing handed it one.
 * `BearingCards` is this component's only caller and it spreads `flame: null`
 * deliberately: `streak` and `best-streak` are figures in the pack, so the run
 * card lists them as rows like every other figure on the surface rather than
 * saying them a second time as a badge. A branch whose condition is a literal
 * `null` is unreachable markup no gate in this repo can see, so it went, on
 * both clients, in the same commit. The words it drew stayed —
 * `month.streakInARow` and `month.bestStreak` are still `MonthScore`'s and
 * `MonthCloseHistoryCard`'s.
 */
export function Spine({ state }: { state: SpineState }) {
  // `justify-between` went with the chip that used to be pushed to the far
  // end; the row is what keeps the ring from stretching to the card's width.
  return (
    <View className="flex-row items-center">
      <Ring ring={state.ring} />
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

/** The clause a `proportion` ring's *colour* reads out — the standing, alone. */
function standingKey(tone: MonthStanding): Key {
  switch (tone) {
    case "short":
      return "bearing.spine.ringStandingShort";
    case "tight":
      return "bearing.spine.ringStandingTight";
    case "clear":
      return "bearing.spine.ringStandingClear";
    case "unknown":
      return "bearing.spine.ringStandingClear";
  }
}

const SIZE = 52;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ROTATE = [{ rotate: "-90deg" }];

/**
 * The overshoot lap: thinner, and inside the ring it has gone past. Same
 * geometry as the web twin, for the same reasons — the ring already reaches
 * the edge of its box, so an outer lap would need a bigger one and would
 * move the headline beside it.
 */
const OVER_STROKE = 3;
const OVER_RADIUS = RADIUS - STROKE / 2 - OVER_STROKE / 2 - 1.5;
const OVER_CIRCUMFERENCE = 2 * Math.PI * OVER_RADIUS;

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
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("bearing.spine.ringUnmeasured")}
      >
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
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("bearing.spine.ringMeasuring")}
      >
        <ArcRing colors={colors} />
      </View>
    );
  }

  // Three signals, three channels, none of them re-derived here — see the
  // web twin's `SpineRing` for the full argument. In short: the stroke
  // colour is `tone`'s and stays `tone`'s, and `over` no longer rides on
  // the fill, because a clamped ratio of 2.50 draws the same complete
  // circle as a ratio of exactly 1.00 and a reader has to be able to tell
  // those apart. It gets the inner lap instead.
  const { fill, overshoot, percent } = drawSpineRing(ring);
  // Two clauses, each stating its own basis — see `en.ts` on these keys for
  // the contradiction the single sentence could produce.
  const label = [
    t(overshoot > 0 ? "bearing.spine.ringUsedOver" : "bearing.spine.ringUsed", {
      percent,
    }),
    t(standingKey(ring.tone)),
  ].join(" · ");

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <ProportionRing
        fill={fill}
        overshoot={overshoot}
        stroke={toneStroke(ring.tone, colors)}
        colors={colors}
      />
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

/**
 * The `proportion` ring, filled to `fill` and re-animating whenever it
 * changes, not only on mount — plus the overshoot lap inside it when the
 * cap has been passed.
 *
 * Both laps animate off their own shared value and both settle immediately
 * under reduced motion, which matters more for the lap than for the ring:
 * the lap is the only thing on screen saying "past the cap", so a reader who
 * has asked for less motion must still be handed it drawn, not pending.
 */
function ProportionRing({
  fill,
  overshoot,
  stroke,
  colors,
}: {
  fill: number;
  overshoot: number;
  stroke: string;
  colors: ThemeColors;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? fill : 0);
  const spill = useSharedValue(reduceMotion ? overshoot : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = fill;
      spill.value = overshoot;
      return;
    }
    progress.value = withTiming(fill, {
      duration: DURATION.enter,
      easing: Easing.bezier(...EASE_STANDARD),
    });
    spill.value = withTiming(overshoot, {
      duration: DURATION.enter,
      easing: Easing.bezier(...EASE_STANDARD),
    });
  }, [fill, overshoot, reduceMotion, progress, spill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const spillProps = useAnimatedProps(() => ({
    strokeDashoffset: OVER_CIRCUMFERENCE * (1 - spill.value),
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
      {overshoot > 0 ? (
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={OVER_RADIUS}
          // The tone's colour, not a colour of its own: `over` is a second
          // signal about the same month, not a second verdict on it.
          stroke={stroke}
          strokeWidth={OVER_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${OVER_CIRCUMFERENCE} ${OVER_CIRCUMFERENCE}`}
          animatedProps={spillProps}
        />
      ) : null}
    </Svg>
  );
}
