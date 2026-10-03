import { useState } from "react";
import { RefreshControl, ScrollView } from "react-native";

import { DEFAULT_WRITER_MODEL, describeModel } from "@finance/core/model-name";

import { CategoryGrid } from "@/components/category/CategoryGrid";
import { CategoryPanel } from "@/components/category/CategoryPanel";
import { FindingBand } from "@/components/category/FindingBand";
import { LEDGER_TABS, SurfaceTabs } from "@/components/layout/SurfaceTabs";
import { StaggerItem } from "@/components/motion/Stagger";
import { ScreenError } from "@/components/ScreenError";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { useRefreshable } from "@/hooks/useRefreshable";
import { getCategoryScreen } from "@/lib/category-screen";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useTabBarClearance } from "@/theme/chrome";

/**
 * The Ledger's by-category view: what moved, every category's run at once,
 * and one open panel — the web's /history, from the same shared assembly.
 *
 * No month above it, unlike the list and the calendar: it reads the last
 * three years and draws the last twelve months, whatever month is shown
 * elsewhere. Holds one piece of layout state — which category is open.
 */
export default function HistoryScreen() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const tabBarClearance = useTabBarClearance();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, loading, refreshing, onRefreshAll, onRefresh, error } =
    useRefreshable(
      async () => (user ? await getCategoryScreen(user.id, locale) : null),
      [user?.id, locale],
      { reads: ["transactions", "categories", "reads"] },
    );

  const toggle = (id: string) =>
    setOpenId((current) => (current === id ? null : id));

  const screen = data?.screen ?? null;
  const openCard = screen?.cards.find(
    (card) => card.history.categoryId === openId,
  );

  return (
    <Screen title={t("nav.ledger")}>
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
          contentContainerClassName="gap-6 pt-2"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
          showsVerticalScrollIndicator={false}
        >
          {!data || !screen || screen.cards.length === 0 ? (
            <EmptyState
              title={t("categoryScreen.empty")}
              description={t("categoryScreen.emptyBody")}
            />
          ) : (
            <>
              <StaggerItem index={0}>
                <FindingBand
                  findings={screen.findings}
                  remarks={screen.remarks}
                  rerankState={screen.rerankState}
                  rerankWritable={data.rerankWritable}
                  rerankWritesLeft={data.rerankWritesLeft}
                  breakdown={screen.breakdown}
                  breakdownTotal={screen.breakdownTotal}
                  openId={openId}
                  onOpen={toggle}
                />
              </StaggerItem>
              <StaggerItem index={1}>
                <CategoryGrid
                  cards={screen.cards}
                  openId={openId}
                  onOpen={toggle}
                  panel={
                    openCard ? (
                      <CategoryPanel
                        key={openCard.history.categoryId}
                        card={openCard}
                        behind={screen.behind[openCard.history.categoryId] ?? []}
                        behindMonthKey={
                          screen.behindMonth[openCard.history.categoryId] ?? ""
                        }
                        behindMonthLabel={
                          screen.behindMonthLabel[openCard.history.categoryId] ??
                          ""
                        }
                        onClose={() => setOpenId(null)}
                        read={screen.reads[openCard.history.categoryId] ?? null}
                        readFacts={
                          screen.readFacts[openCard.history.categoryId] ?? null
                        }
                        readLocale={
                          screen.readLocale[openCard.history.categoryId] ?? locale
                        }
                        readThin={
                          screen.readThin[openCard.history.categoryId] ?? true
                        }
                        readWritesLeft={data.readWritesLeft}
                        readWritable={data.readWritable}
                        // The web's key is Mistral's, so only the model's size
                        // can differ; which model wrote a stored read is on
                        // the read itself.
                        readWriterBrand={describeModel(DEFAULT_WRITER_MODEL).brand}
                        readModel={
                          screen.readModels[openCard.history.categoryId] ?? null
                        }
                      />
                    ) : null
                  }
                />
              </StaggerItem>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
