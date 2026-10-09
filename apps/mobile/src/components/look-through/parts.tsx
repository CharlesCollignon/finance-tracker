import type { ComponentProps, ReactNode } from "react";
import { Text as RNText, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatPercentLabel } from "@finance/core/constants";
import { SECTOR_IDS, type SectorId } from "@finance/core/instrument-reading";
import { AXIS_COVERAGE_FLOOR } from "@finance/core/look-through";
import type { ReadSegment } from "@finance/core/month-read";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import type { Translate } from "@finance/core/i18n/t";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { sansWeightFace } from "@/lib/text-class";
import { ICON, TABULAR } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * What the look-through is drawn with on the phone: its sections and lines,
 * the part of a portfolio not yet read, the tilt against the target, a
 * read's words. The web's twin is `components/finance/look-through/parts.tsx`.
 */

type IconName = ComponentProps<typeof Ionicons>["name"];

/** "34 %" from 0.34, through Intl and the catalogue. */
export function share(weight: number, locale: Locale): string {
  return formatPercentLabel(Math.round(weight * 100), locale);
}

/** A titled block, the shape every section on this screen takes. */
export function Section({
  icon,
  title,
  tone,
  children,
}: {
  icon: IconName;
  title: string;
  tone?: "warning";
  children: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={icon}
          size={ICON.md}
          color={tone === "warning" ? colors.warning : colors.mutedForeground}
        />
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          className="min-w-0 flex-1 text-sm font-semibold"
        >
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/** One group of holdings the shares do not cover; drawn only when it has any. */
export function Uncovered({
  when,
  heading,
  body,
  rows,
  children,
}: {
  when: boolean;
  heading: string;
  body: string;
  rows: { positionId: string; name: string; value: number }[];
  children?: ReactNode;
}) {
  const formatEuro = useFormatCurrency();
  if (!when) {
    return null;
  }
  return (
    <View className="gap-2 border-t border-border pt-3">
      <Text className="text-sm font-semibold">{heading}</Text>
      <Text variant="muted" className="text-sm">
        {body}
      </Text>
      <View className="gap-1">
        {rows.map((row) => (
          <View
            key={row.positionId}
            className="flex-row items-baseline justify-between gap-3"
          >
            <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
              {row.name}
            </Text>
            <PrivateAmount className="text-sm text-muted-foreground">
              {formatEuro(row.value)}
            </PrivateAmount>
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}

/** A label and a figure on one line; only an amount of money is masked. */
export function Line({
  label,
  value,
  strong = false,
  money = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  money?: boolean;
}) {
  const figure = cn("text-sm", strong && "font-semibold");
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text variant="muted" className="min-w-0 flex-1 text-sm">
        {label}
      </Text>
      {money ? (
        <PrivateAmount className={figure}>{value}</PrivateAmount>
      ) : (
        <Text className={cn("font-sans tabular-nums", figure)}>{value}</Text>
      )}
    </View>
  );
}

/** A region's share, and what it weighs against the market. */
export function Bias({
  label,
  share: weight,
  factor,
}: {
  label: string;
  share: number;
  factor: number | null;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <View className="min-w-0 flex-1">
      <Text className="font-sans tabular-nums text-sm font-semibold">
        {share(weight, locale)}
      </Text>
      <Text variant="micro">{label}</Text>
      {factor !== null && factor > 0 ? (
        <Text variant="micro">
          {/* Within a sixth of the market's weight is "in line": the
              reference is approximate itself. */}
          {Math.abs(factor - 1) < 0.15
            ? t("lookThrough.inLineWithMarket")
            : t("lookThrough.timesMarket", {
                factor: new Intl.NumberFormat(INTL_LOCALES[locale], {
                  maximumFractionDigits: factor < 10 ? 1 : 0,
                }).format(factor),
              })}
        </Text>
      ) : null}
    </View>
  );
}

/** Said out loud when a factsheet did not publish a full breakdown. */
export function PartialAxis({ coverage, rows }: { coverage: number; rows: number }) {
  const t = useT();
  const locale = useLocale();
  if (rows === 0 || coverage >= AXIS_COVERAGE_FLOOR) {
    return null;
  }
  return (
    <Text variant="micro" className="text-warning">
      {t("lookThrough.caveats.partialAxis", {
        coverage: share(coverage, locale),
      })}
    </Text>
  );
}

export function ToneDot({ tone }: { tone: "good" | "watch" | "neutral" }) {
  const colors = useThemeColors();
  return (
    <View
      className="mt-1.5 h-1.5 w-1.5 rounded-full"
      style={{
        backgroundColor:
          tone === "good"
            ? colors.success
            : tone === "watch"
              ? colors.warning
              : colors.mutedForeground,
      }}
    />
  );
}

/**
 * A claim, with the app's own figures spliced into it. Raw text nested in the
 * caller's line, so each piece inherits its size and colour; only the figures
 * change weight.
 */
export function Segments({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <RNText key={index}>{segment.text}</RNText>
        ) : (
          <RNText key={index} style={FIGURE_STYLE}>
            {segment.display}
          </RNText>
        ),
      )}
    </>
  );
}

const FIGURE_STYLE = [TABULAR, sansWeightFace("font-sans font-semibold")];

/** A sector's name in the reader's language, or the label it came with. */
export function sectorLabel(t: Translate, id: string, fallback: string): string {
  return (SECTOR_IDS as readonly string[]).includes(id)
    ? t(`lookThrough.sectorLabels.${id as SectorId}`)
    : fallback;
}
