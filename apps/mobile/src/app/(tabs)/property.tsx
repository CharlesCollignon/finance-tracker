import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { formatPercentLabel, todayIsoLocal } from "@finance/core/constants";
import {
  propertyPosition,
  valueSourceLine,
  type PropertyPosition,
} from "@finance/core/property";
import type { Property } from "@finance/core/types/database";

import { PROPERTY_KIND_KEYS, PROPERTY_USAGE_KEYS } from "@/components/property/fields";
import { AddPropertySheet } from "@/components/property/PropertySheets";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ScreenError } from "@/components/ScreenError";
import { StatHero } from "@/components/StatHero";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { getProperties } from "@/lib/properties";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useTabBarClearance } from "@/theme/chrome";

/**
 * Immobilier: what the user's properties are worth to them once the loans
 * are counted, one card each, and the way to add one. The web's `/property`,
 * read the same way through `@finance/data` and core.
 */
export default function PropertyScreen() {
  const t = useT();
  const router = useRouter();
  const format = useFormatCurrency();
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const { data, loading, refreshing, onRefreshAll, onRefresh, error } = useRefreshable(
    async () => (user ? getProperties(user.id) : null),
    [user?.id],
    { reads: ["properties", "templates"] },
  );

  const today = todayIsoLocal();
  const items = (data?.properties ?? []).map(({ property, loans, market }) => ({
    property,
    loanCount: loans.length,
    position: propertyPosition(property, loans, today, market),
  }));
  const sum = (pick: (position: PropertyPosition) => number) =>
    Math.round(items.reduce((total, item) => total + pick(item.position), 0) * 100) /
    100;

  return (
    <Screen title={t("nav.property")} className="pb-0">
      {loading && !data ? (
        <ScreenSkeleton rows={2} />
      ) : error ? (
        <ScreenError message={error} onRetry={onRefresh} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-5 pt-2"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
        >
          {items.length === 0 ? (
            <EmptyState
              title={t("property.emptyTitle")}
              description={t("property.emptyBody")}
            >
              <Button label={t("property.add")} onPress={() => setAdding(true)} />
            </EmptyState>
          ) : (
            <>
              <StatHero
                label={t("property.totalLabel")}
                amount={format(sum((position) => position.netValue))}
                animateValue={sum((position) => position.netValue)}
                format={format}
                subtitle={
                  <PrivateAmount className="text-sm text-muted-foreground">
                    {t("property.worthLine", {
                      value: format(sum((position) => position.value)),
                      owed: format(sum((position) => position.owed)),
                    })}
                  </PrivateAmount>
                }
              />
              {items.map((item) => (
                <PropertyCard
                  key={item.property.id}
                  property={item.property}
                  position={item.position}
                  loanCount={item.loanCount}
                  onPress={() => router.push(`/property/${item.property.id}`)}
                />
              ))}
              <Button
                label={t("property.add")}
                variant="outline"
                onPress={() => setAdding(true)}
              />
            </>
          )}
        </ScrollView>
      )}
      <AddPropertySheet open={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function PropertyCard({
  property,
  position,
  loanCount,
  onPress,
}: {
  property: Property;
  position: PropertyPosition;
  loanCount: number;
  onPress: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const source = position.estimate.source;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={property.name}
      onPress={onPress}
      className="active:opacity-80"
    >
      <Card bezel innerClassName="gap-3">
        <View className="gap-0.5">
          <Text numberOfLines={1} className="font-semibold" style={{ fontSize: 17 }}>
            {property.name}
          </Text>
          <Text variant="muted" numberOfLines={1} className="text-xs">
            {[
              t(PROPERTY_KIND_KEYS[property.kind]),
              t(PROPERTY_USAGE_KEYS[property.usage]),
              property.postcode,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <View className="gap-1">
          <Text variant="muted" className="text-xs">
            {t("property.netValue")}
          </Text>
          <PrivateAmount className="text-2xl font-semibold">
            {format(position.netValue)}
          </PrivateAmount>
          <PrivateAmount className="text-sm text-muted-foreground">
            {t("property.worthLine", {
              value: format(position.value),
              owed: format(position.owed),
            })}
          </PrivateAmount>
        </View>
        <Text variant="muted" className="text-xs">
          {[
            valueSourceLine(source, locale, "short"),
            property.ownership_share < 1
              ? t("property.shareLine", {
                  share: formatPercentLabel(property.ownership_share * 100, locale),
                })
              : null,
            loanCount > 0 ? t("property.loans", { count: loanCount }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </Card>
    </Pressable>
  );
}
