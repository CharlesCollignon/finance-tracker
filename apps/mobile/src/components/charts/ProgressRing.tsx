import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { formatPercentLabel } from "@finance/core/constants";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { progressTone } from "@/lib/progress-tone";
import { CHART_COLORS } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { useLocale } from "@/providers/LocaleProvider";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASING = Easing.bezier(...EASE_STANDARD);

interface ProgressRingProps {
  ratio: number;
  label: string;
  detail: string;
  /**
   * Whether `detail` is an amount of the user's money, and so goes under the
   * privacy mask. Off by default, as on the web: the Bearing's rings give a
   * percentage there, which is not a figure worth covering; the Plan screen's
   * give "1 240 € sur 1 500 €", which is.
   */
  money?: boolean;
  /** Overrides the fill; ignored once the tone turns to danger. */
  color?: string;
  /**
   * What filling the ring means. A cap is a limit — nearing it is a warning
   * and passing it is a problem. A goal is a target: nearing it is the whole
   * point, and colouring that red tells someone their savings are going
   * wrong.
   */
  meaning?: "limit" | "target";
  over?: boolean;
  /** The ring's diameter. The Plan screen's grid uses the web's 84. */
  size?: number;
  className?: string;
}

/*
 * Both apps draw this ring by hand — web in inline SVG, here in
 * react-native-svg — at the same proportions, so a cap looks like a cap on
 * either. The fill is the web's `--chart-1` unless a caller names another; it
 * used to be the gold accent, which the phone now keeps for decisions.
 */
const DEFAULT_SIZE = 112;

/** Thin donut with a centred percent, label and detail underneath. */
export function ProgressRing({
  ratio,
  label,
  detail,
  money = false,
  color,
  meaning = "limit",
  over = false,
  size = DEFAULT_SIZE,
  className,
}: ProgressRingProps) {
  const colors = useThemeColors();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const danger =
    meaning === "limit" && progressTone(clamped, over) === "danger";
  const percent = Math.round(clamped * 100);
  const fill = danger ? colors.destructive : (color ?? CHART_COLORS[0]);

  const outer = size * 0.44;
  const inner = size * 0.36;
  const stroke = outer - inner;
  const radius = (outer + inner) / 2;
  const circumference = 2 * Math.PI * radius;

  // Fills from empty on arrival, and from where it was on a change — the
  // 650ms the counted figures use, so a ring and its number land together.
  const progress = useSharedValue(reduce ? clamped : 0);
  useEffect(() => {
    progress.value = reduce
      ? clamped
      : withTiming(clamped, { duration: DURATION.count, easing: EASING });
  }, [clamped, reduce, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View
      className={cn("items-center", className)}
      // Wide enough for "1 240 € sur 1 500 €" under a ring of any size;
      // anything longer is a category name, and truncating those is fine.
      style={{ width: Math.max(size + 44, 128) }}
    >
      <View
        className="items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Svg
          width={size}
          height={size}
          style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
        >
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.hairlineStrong}
            strokeWidth={stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={fill}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
          />
        </Svg>
        <Text
          className={cn(
            "font-semibold tabular-nums",
            size < 100 ? "text-base" : "text-lg",
            danger ? "text-destructive" : "text-foreground",
          )}
        >
          {formatPercentLabel(percent, locale)}
        </Text>
      </View>
      <Text numberOfLines={1} className="mt-1 text-sm font-medium">
        {label}
      </Text>
      {money ? (
        <PrivateAmount
          numberOfLines={1}
          className="mt-0.5 text-xs text-muted-foreground"
        >
          {detail}
        </PrivateAmount>
      ) : (
        <Text
          numberOfLines={1}
          className="mt-0.5 tabular-nums text-xs text-muted-foreground"
        >
          {detail}
        </Text>
      )}
    </View>
  );
}
