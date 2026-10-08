import { useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { todayIsoLocal } from "@finance/core/constants";
import { reviewedYear, yearReviewCards } from "@finance/core/year-review";

import { PrivateAmount } from "@/components/PrivateAmount";
import { ScreenError } from "@/components/ScreenError";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { hapticLight } from "@/lib/haptics";
import { getYearReview } from "@/lib/queries";
import { shareYearImage } from "@/lib/year-review-share";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * « Votre année », as on the web: the year before in January, any year gone
 * by with `?y=` — one card a screen, swiped through, then the image to share
 * (no amount in it), through the phone's own share sheet.
 */
export default function YearScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const format = useFormatCurrency();
  const { toast } = useToast();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ y?: string }>();
  const today = todayIsoLocal();
  const current = Number(today.slice(0, 4));
  const asked = Number(params.y);
  const year =
    Number.isInteger(asked) && asked >= 2000 && asked < current
      ? asked
      : (reviewedYear(today) ?? current - 1);
  const [sharing, setSharing] = useState(false);

  const { data, error, loading, onRefresh } = useRefreshable(
    async () => (user ? await getYearReview(user.id, year, locale) : null),
    [user?.id, year, locale],
    { reads: ["transactions", "closes", "preferences"] },
  );

  async function share() {
    setSharing(true);
    void hapticLight();
    const outcome = await shareYearImage(
      year,
      locale,
      t("yearReview.imageTitle", { year }),
    );
    setSharing(false);
    if (outcome === "failed") {
      toast(t("bankConnect.unreachable"), "error");
    }
  }

  const page = width - 32;
  const cards = data ? yearReviewCards(data, { t, locale, formatMoney: format }) : [];

  return (
    <Screen
      title={t("nav.yearReview")}
      showLogo={false}
      headerActions={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("categories.back")}
          hitSlop={8}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          className="h-9 w-9 items-center justify-center rounded-control"
        >
          <Ionicons name="chevron-back" size={ICON.xl} color={colors.foreground} />
        </Pressable>
      }
    >
      {error ? (
        <ScreenError message={error} onRetry={onRefresh} />
      ) : loading ? (
        <ScreenSkeleton rows={3} />
      ) : data === null ? (
        <Text variant="muted" className="px-4 pt-6 text-sm">
          {t("yearReview.nothing", { year })}
        </Text>
      ) : (
        <View className="flex-1 gap-4 px-4 pb-6 pt-4">
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={page + 16}
            decelerationRate="fast"
            contentContainerClassName="gap-4"
            className="flex-1"
          >
            <View
              style={{ width: page }}
              className="justify-center gap-3 rounded-card border border-border bg-card/70 p-6"
            >
              <Text style={TYPE.hero} accessibilityRole="header">
                {t("yearReview.title", { year })}
              </Text>
              <Text variant="muted" className="text-base">
                {t("yearReview.lead")}
              </Text>
            </View>
            {cards.map((card) => (
              <View
                key={card.id}
                style={{ width: page }}
                className="justify-center gap-2 rounded-card border border-border bg-card/70 p-6"
              >
                <PrivateAmount style={TYPE.hero} numberOfLines={1} adjustsFontSizeToFit>
                  {card.figure}
                </PrivateAmount>
                <Text className="text-lg">{card.caption}</Text>
                {card.note ? (
                  <PrivateAmount className="text-sm text-muted-foreground">
                    {card.note}
                  </PrivateAmount>
                ) : null}
              </View>
            ))}
          </ScrollView>
          <Text variant="muted" className="text-xs">
            {t("yearReview.shareHint")}
          </Text>
          <Button
            label={t("yearReview.share")}
            icon="share-outline"
            size="lg"
            disabled={sharing}
            onPress={() => void share()}
          />
        </View>
      )}
    </Screen>
  );
}
