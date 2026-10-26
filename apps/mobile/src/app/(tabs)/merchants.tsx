import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import {
  filterMerchants,
  MERCHANT_ROWS_SHOWN,
  type MerchantCard,
} from "@finance/core/merchant-screen";

import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ScreenError } from "@/components/ScreenError";
import { useCategoryTone } from "@/components/category/CategoryGrid";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { FadeIn } from "@/components/motion/FadeIn";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { getMerchantScreen } from "@/lib/queries";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { ICON } from "@/theme/tokens";
import { useTabBarClearance } from "@/theme/chrome";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The Ledger's by-shop view: every place the money went over the last
 * twelve months, biggest first — the web's /merchants, from the same shared
 * assembly. No month above it, like By category: it reads a year whatever
 * month is shown elsewhere. Holds two pieces of layout state: the words
 * typed, and which shop is open.
 */
export default function MerchantsScreen() {
  const t = useT();
  const locale = useLocale();
  const { ownerId } = useOwner();
  const tabBarClearance = useTabBarClearance();
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data, loading, refreshing, onRefreshAll, onRefresh, error } =
    useRefreshable(
      async () => (ownerId ? await getMerchantScreen(ownerId, locale) : null),
      [ownerId, locale],
      { reads: ["transactions", "categories"] },
    );

  const merchants = data?.merchants ?? [];
  const shown = filterMerchants(merchants, query);
  const today = todayIsoLocal();

  return (
    <Screen title={t("nav.ledger")} shared>
      <SurfaceTabs tabs={LEDGER_TABS} className="mb-3" />

      {loading && !data ? (
        <ScreenSkeleton rows={5} />
      ) : error ? (
        <ScreenError message={error} onRetry={onRefresh} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-4 pt-2"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="muted" className="text-sm">
            {t("merchants.intro")}
          </Text>

          {merchants.length === 0 ? (
            <EmptyState
              title={t("merchants.empty")}
              description={t("merchants.emptyBody")}
            />
          ) : (
            <>
              <Input
                value={query}
                placeholder={t("merchants.searchPlaceholder")}
                accessibilityLabel={t("merchants.searchLabel")}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                onChangeText={setQuery}
              />
              <Text variant="micro">
                {t("merchants.count", { count: shown.length })}
              </Text>
              {shown.length === 0 ? (
                <EmptyState
                  title={t("merchants.noMatch")}
                  description={t("merchants.noMatchBody")}
                />
              ) : (
                <FadeIn>
                  <View className="gap-2">
                    {shown.map((card) => (
                      <MerchantRow
                        key={card.key}
                        card={card}
                        today={today}
                        open={openKey === card.key}
                        onToggle={() => {
                          void hapticLight();
                          setOpenKey((current) =>
                            current === card.key ? null : card.key,
                          );
                        }}
                      />
                    ))}
                  </View>
                </FadeIn>
              )}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function MerchantRow({
  card,
  today,
  open,
  onToggle,
}: {
  card: MerchantCard;
  today: string;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const tone = useCategoryTone();
  const [allRows, setAllRows] = useState(false);
  const rows = allRows ? card.rows : card.rows.slice(0, MERCHANT_ROWS_SHOWN);
  const hidden = card.rows.length - rows.length;
  const peak =
    card.points.reduce((max, point) => Math.max(max, point.total), 0) || 1;
  const recent = card.lastOn >= today.slice(0, 7);

  return (
    <View
      className={cn(
        "rounded-card border border-border",
        open && "border-hairline-strong bg-muted/20",
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t("merchants.open", { name: card.name })}
        onPress={onToggle}
        className="min-h-16 flex-row items-center gap-3 p-3"
      >
        <CategoryIcon icon={card.categoryIcon} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-medium">
            {card.name}
          </Text>
          <Text variant="muted" className="text-xs">
            {`${card.categoryName} · ${t("merchants.visits", { count: card.visits })} · `}
            <Text className={cn("text-xs", recent ? "text-foreground" : "text-muted-foreground")}>
              {t("merchants.lastOn", {
                date: formatShortDate(card.lastOn, locale),
              })}
            </Text>
          </Text>
        </View>
        <View className="items-end">
          <PrivateAmount className="text-sm font-semibold">
            {format(card.total)}
          </PrivateAmount>
          <PrivateAmount className="text-xs text-muted-foreground">
            {t("merchants.normal", { amount: format(card.normal) })}
          </PrivateAmount>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={ICON.sm}
          color={colors.mutedForeground}
        />
      </Pressable>

      {open ? (
        <View className="gap-4 px-3 pb-3">
          <Text variant="muted" className="text-xs">
            <PrivateAmount className="text-xs text-muted-foreground">
              {t("merchants.perVisit", { amount: format(card.perVisit) })}
            </PrivateAmount>
            {" · "}
            <PrivateAmount className="text-xs text-muted-foreground">
              {t("merchants.total", { amount: format(card.total) })}
            </PrivateAmount>
            {card.mixed ? ` · ${t("merchants.mixed")}` : ""}
          </Text>

          <View
            accessible
            accessibilityLabel={t("merchants.chartLabel")}
            className="h-12 flex-row items-end gap-0.5"
          >
            {card.points.map((point) => (
              <View
                key={point.monthKey}
                className="flex-1 rounded-t-[2px]"
                style={{
                  height: point.empty
                    ? 1
                    : `${Math.max((point.total / peak) * 100, 3)}%`,
                  backgroundColor: point.empty
                    ? colors.border
                    : tone[card.categoryType],
                }}
              />
            ))}
          </View>

          <View className="border-t border-border">
            {rows.map((row, index) => (
              <View
                key={row.id}
                className={cn(
                  "flex-row items-baseline justify-between gap-3 py-2",
                  index > 0 && "border-t border-border",
                )}
              >
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm">
                    {row.note ?? card.name}
                  </Text>
                  <Text variant="muted" className="text-xs">
                    {formatShortDate(row.occurredOn, locale)}
                    {row.categoryName !== card.categoryName
                      ? ` · ${row.categoryName}`
                      : ""}
                  </Text>
                </View>
                <PrivateAmount className="text-sm">
                  {format(row.amount)}
                </PrivateAmount>
              </View>
            ))}
          </View>
          {hidden > 0 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setAllRows(true)}
              className="self-start"
            >
              <Text variant="micro">
                {t("merchants.moreRows", { count: hidden })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
