import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import {
  AI_BRAND_MARKS,
  aiBrandOf,
  type AiBrand,
} from "@finance/core/ai-brands";

import { useThemeColors } from "@/theme/useThemeColors";

/**
 * A model's maker, as its mark (`@finance/core/ai-brands`): in its own
 * colour on a dark ground, or in `color` — the text's, on a gold button,
 * where an orange mark would not read.
 */
export function AiMark({
  brand,
  size = 16,
  color,
}: {
  brand: AiBrand;
  size?: number;
  color?: string;
}) {
  const colors = useThemeColors();
  const mark = AI_BRAND_MARKS[brand];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path d={mark.path} fill={color ?? mark.color ?? colors.foreground} />
    </Svg>
  );
}

/**
 * The leading mark of a button that spends a call, from the writer's name or
 * id: its maker's mark, else the house sparkle for "a model does this".
 */
export function WriterMark({
  model,
  size,
  color,
}: {
  model: string | null;
  size: number;
  color: string;
}) {
  const brand = aiBrandOf(model);
  return brand ? (
    <AiMark brand={brand} size={size - 2} color={color} />
  ) : (
    <Ionicons name="sparkles" size={size} color={color} />
  );
}

/** The mark before « Écrit par … », when the maker is one of the three. */
export function BylineMark({ model }: { model: string | null }) {
  const colors = useThemeColors();
  const brand = aiBrandOf(model);
  return brand ? (
    <AiMark brand={brand} size={12} color={colors.mutedForeground} />
  ) : null;
}
