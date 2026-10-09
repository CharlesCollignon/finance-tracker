import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import type { HomeMonth } from "@/lib/home-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { HomeCard } from "@/components/bearing/card-parts";

/* ------------------------------------------------------------ the run */

/**
 * What the month is adding up to beyond itself: the run of months closed
 * under the allowance, and what is invested.
 * The one card on the screen that keeps score, so it is the one that is
 * allowed to feel like it.
 */
export function MomentumCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <HomeCard
      icon="flame-outline"
      title={t("removal.momentumTitle")}
      href="/planning"
    >
      {data.run ? (
        <View className="flex-row items-center gap-3 rounded-control bg-secondary px-3 py-2.5">
          <View
            className={cn(
              "h-10 w-10 items-center justify-center rounded-full",
              data.run.streak > 0 ? "bg-primary" : "bg-muted",
            )}
          >
            <Ionicons
              name="flame"
              size={ICON.lg}
              color={
                data.run.streak > 0
                  ? colors.primaryForeground
                  : colors.mutedForeground
              }
            />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold">
              {data.run.streak > 0
                ? t("bearingMonth.run", { count: data.run.streak })
                : t("bearingMonth.noRunYet")}
            </Text>
            <Text variant="muted" className="text-xs">
              {t("bearingMonth.runBody")}
              {data.run.best > data.run.streak
                ? ` · ${t("bearingMonth.bestRun", { count: data.run.best })}`
                : ""}
            </Text>
          </View>
        </View>
      ) : null}

      {data.invested !== null ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void hapticLight();
            router.push("/investments" as Href);
          }}
          className="min-h-11 flex-row items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons
              name="trending-up"
              size={ICON.md}
              color={colors.mutedForeground}
            />
            <Text variant="muted" className="text-sm">
              {t("bearingMonth.invested")}
            </Text>
          </View>
          <PrivateAmount className="text-sm font-semibold">
            {format(data.invested)}
          </PrivateAmount>
        </Pressable>
      ) : null}
    </HomeCard>
  );
}
