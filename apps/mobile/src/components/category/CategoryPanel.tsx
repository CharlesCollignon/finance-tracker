import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import type { CategoryFacts } from "@finance/core/category-facts";
import type { CategoryRead as CategoryReadValue } from "@finance/core/category-read";
import type {
  CategoryCard,
  PanelTransaction,
} from "@finance/core/category-screen";
import type { Locale } from "@finance/core/i18n/locale";

import { FadeIn } from "@/components/motion/FadeIn";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { useScreenMonth } from "@/providers/MonthProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import { useCategoryTone } from "./CategoryGrid";
import { CategoryRead } from "./CategoryRead";

/**
 * One category, opened in place — the web's `CategoryPanel`. Holds every
 * finding for this category rather than only the one that reached the band,
 * because the band is a shortlist and this is the whole answer.
 */
export function CategoryPanel({
  card,
  behind,
  behindMonthKey,
  behindMonthLabel,
  onClose,
  read,
  readFacts,
  readLocale,
  readThin,
  readWritesLeft,
  readWritable,
  readWriterBrand,
  readModel,
}: {
  card: CategoryCard;
  behind: PanelTransaction[];
  /** The month `behind` belongs to, as `YYYY-MM`: where the Ledger opens. */
  behindMonthKey: string;
  behindMonthLabel: string;
  onClose: () => void;
  read: CategoryReadValue | null;
  readFacts: CategoryFacts | null;
  readLocale: Locale;
  readThin: boolean;
  readWritesLeft: number;
  readWritable: boolean;
  readWriterBrand: string;
  readModel: string | null;
}) {
  const t = useT();
  const formatMoney = useFormatCurrency();
  const colors = useThemeColors();
  const tone = useCategoryTone();
  const router = useRouter();
  const { setMonth } = useScreenMonth();
  const { history, normal, drawn, findings } = card;

  return (
    <FadeIn>
      <View
        className="gap-4 rounded-card border p-card"
        style={{ borderColor: colors.hairlineStrong }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-semibold">{history.name}</Text>
            <PrivateAmount className="text-sm text-muted-foreground">
              {t(
                history.periodShifted
                  ? "categoryScreen.normalShifted"
                  : "categoryScreen.normal",
                { amount: formatMoney(normal) },
              )}
            </PrivateAmount>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("categoryScreen.close")}
            hitSlop={12}
            onPress={() => {
              void hapticLight();
              onClose();
            }}
          >
            <Ionicons name="close" size={ICON.md} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {findings.length > 0 ? (
          <View className="gap-1">
            {findings.map((finding) => (
              <Text key={finding.id} variant="muted" className="text-sm">
                {t(finding.messageKey, finding.params)}
              </Text>
            ))}
          </View>
        ) : null}

        {history.periodShifted ? (
          <Text variant="muted" className="text-xs">
            {t("categoryScreen.periodShifted")}
          </Text>
        ) : null}

        <Text variant="muted" className="text-xs">
          {t("categoryScreen.months", { count: drawn.length })}
        </Text>

        <BarSeries
          color={tone[history.type]}
          points={drawn.map((point) => ({
            key: point.monthKey,
            label: point.shortLabel,
            value: point.total,
            empty: point.empty,
          }))}
        />

        {behind.length > 0 ? (
          <View className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("categoryScreen.behindThisMonth", { month: behindMonthLabel })}
            </Text>
            {behind.map((entry, index) => (
              <View
                key={entry.id}
                className={cn(
                  "flex-row items-baseline justify-between gap-3 py-1.5",
                  index < behind.length - 1 && "border-b border-border",
                )}
              >
                <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
                  {entry.note ?? entry.occurredOn}
                </Text>
                <PrivateAmount className="text-sm">
                  {formatMoney(entry.amount)}
                </PrivateAmount>
              </View>
            ))}
          </View>
        ) : null}

        {/* The Ledger has no category filter, so this lands on the month
            the panel explains — the most it can honestly promise. */}
        {behindMonthKey ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            className="self-start"
            onPress={() => {
              const [year, month] = behindMonthKey.split("-").map(Number);
              void hapticLight();
              setMonth(year, month);
              router.push("/transactions");
            }}
          >
            <Text className="text-sm font-medium">
              {t("categoryScreen.seeInLedger")}
            </Text>
          </Pressable>
        ) : null}

        <CategoryRead
          categoryId={history.categoryId}
          categoryName={history.name}
          read={read}
          readFacts={readFacts}
          readLocale={readLocale}
          thin={readThin}
          writesLeft={readWritesLeft}
          writable={readWritable}
          writerBrand={readWriterBrand}
          readModel={readModel}
        />
      </View>
    </FadeIn>
  );
}

interface BarPoint {
  key: string;
  /** Short enough for twelve of them to fit. */
  label: string;
  value: number;
  /** Nothing was recorded, as against recorded as zero. */
  empty: boolean;
}

/**
 * One series, as bars — the web's `BarSeries` for a run of spending, which
 * never goes below zero. Scaled against its own peak, months with nothing
 * recorded drawn as gaps. Where the web shows a bar's value under the
 * pointer, a tap shows it here.
 */
function BarSeries({ points, color }: { points: BarPoint[]; color: string }) {
  const formatMoney = useFormatCurrency();
  const [picked, setPicked] = useState<string | null>(null);
  const peak = points.reduce((max, point) => Math.max(max, point.value), 0) || 1;

  return (
    <View className="flex-row items-end gap-1.5">
      {points.map((point) => {
        const shown = picked === point.key;
        return (
          <Pressable
            key={point.key}
            accessibilityRole="button"
            accessibilityLabel={`${point.label} ${
              point.empty ? "—" : formatMoney(point.value)
            }`}
            onPress={() => {
              void hapticSelection();
              setPicked(shown ? null : point.key);
            }}
            className="min-w-0 flex-1 items-center gap-1.5"
          >
            <PrivateAmount
              numberOfLines={1}
              adjustsFontSizeToFit
              className="text-muted-foreground"
              style={{ fontSize: 9, opacity: shown ? 1 : 0 }}
            >
              {point.empty ? "—" : formatMoney(point.value)}
            </PrivateAmount>
            <View className="h-32 w-full justify-end">
              {point.empty ? (
                <View className="w-full border-t border-dashed border-border" />
              ) : point.value > 0 ? (
                <View
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max((point.value / peak) * 100, 2)}%`,
                    backgroundColor: color,
                    opacity: picked === null || shown ? 1 : 0.5,
                  }}
                />
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              className="text-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {point.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
