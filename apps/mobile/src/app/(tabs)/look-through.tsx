import { RefreshControl, ScrollView } from "react-native";

import { LookThroughView } from "@/components/look-through/LookThroughView";
import { SurfaceTabs, WALLET_TABS } from "@/components/layout/SurfaceTabs";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { getLookThroughData } from "@/lib/look-through-data";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";
import { useTabBarClearance } from "@/theme/chrome";

/**
 * What the funds are made of — Placements' second view, as on the web
 * (`/investments/look-through`).
 *
 * Its own route above the tabs rather than a hidden tab, so it is pushed from
 * Placements and the Positions tab, the back gesture and Android's back
 * button all return there.
 */
export default function LookThroughScreen() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const dataVersion = useDataVersion();
  // Above the tabs, so no tab bar to clear: the home indicator only.
  const tabBarClearance = useTabBarClearance();

  const { data, loading, refreshing, onRefreshAll, reload, error } =
    useRefreshable(
      async () => (user ? getLookThroughData(user.id, locale) : null),
      [user?.id, locale, dataVersion],
    );

  return (
    <Screen title={t("nav.wallets")} className="pb-0">
      <SurfaceTabs tabs={WALLET_TABS} className="mb-3" />
      {loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : error ? (
        <Text className="text-destructive">{resolveMessage(t, error)}</Text>
      ) : data ? (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="pt-2"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
          showsVerticalScrollIndicator={false}
        >
          <LookThroughView
            data={data}
            onChanged={() => {
              // A reading changes what Placements shows too.
              notifyDataChanged();
              void reload();
            }}
          />
        </ScrollView>
      ) : null}
    </Screen>
  );
}
