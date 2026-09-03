import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { progressTone } from "@/lib/progress-tone";
import { useThemeColors } from "@/theme/useThemeColors";

interface ProgressRingProps {
  ratio: number;
  label: string;
  detail: string;
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
  className?: string;
}

/*
 * Both apps draw this ring by hand — web in inline SVG, here in
 * react-native-svg — at the same 72%–88% radius, so a cap looks like a cap on
 * either. Web's used to be an ECharts gauge, which meant loading a charting
 * runtime to draw two arcs and a percentage; nothing here ever did.
 */
const SIZE = 112;
const OUTER = SIZE * 0.44;
const INNER = SIZE * 0.36;
const STROKE = OUTER - INNER;
const RADIUS = (OUTER + INNER) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Thin donut with a centered percent, label and mono detail underneath. */
export function ProgressRing({
  ratio,
  label,
  detail,
  color,
  meaning = "limit",
  over = false,
  className,
}: ProgressRingProps) {
  const colors = useThemeColors();
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const danger =
    meaning === "limit" && progressTone(clamped, over) === "danger";
  const percent = Math.round(clamped * 100);
  const fill = danger ? colors.destructive : (color ?? colors.primary);

  return (
    <View className={cn("w-32 items-center", className)}>
      <View
        className="items-center justify-center"
        style={{ width: SIZE, height: SIZE }}
      >
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.hairlineStrong}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={fill}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE * clamped} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Text
          className={cn(
            "text-lg font-semibold",
            danger ? "text-destructive" : "text-foreground",
          )}
        >
          {`${percent}%`}
        </Text>
      </View>
      <Text numberOfLines={1} className="mt-1 text-sm font-medium">
        {label}
      </Text>
      <PrivateAmount
        numberOfLines={1}
        className="mt-0.5 font-mono text-xs text-muted-foreground"
      >
        {detail}
      </PrivateAmount>
    </View>
  );
}
