import { RefreshControl, ScrollView, View } from "react-native";

import { getMonthBounds, todayIsoLocal } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";

import { ArrivedCharges } from "@/components/ArrivedCharges";
import { MonthPicker } from "@/components/MonthPicker";
import { MonthRead } from "@/components/MonthRead";
import { BankAttentionBanner } from "@/components/bank/BankAttentionBanner";
import { AttentionRow } from "@/components/bearing/AttentionRow";
import {
  BalanceCard,
  MomentumCard,
  SetUpCard,
  SpentCard,
  UpcomingCard,
  WhereItWentCard,
} from "@/components/bearing/MonthCards";
import { WeeklyRecapCard } from "@/components/bearing/WeeklyRecapCard";
import { StaggerItem } from "@/components/motion/Stagger";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useBankState } from "@/hooks/useBankState";
import { useRefreshable } from "@/hooks/useRefreshable";
import {
  gatherHomeMonth,
  gatherHomeRead,
  gatherHomeRecap,
} from "@/lib/home-data";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useTabBarClearance } from "@/theme/chrome";
import { useThemeColors } from "@/theme/useThemeColors";
import { useScreenMonth } from "@/providers/MonthProvider";

/**
 * Le point: what is on the account, where the month ends, and what it went
 * on — one month at a time, as the web's Bearing tells it.
 *
 * It opens on the month in progress, always: it is the landing tab, and a
 * landing tab that opened on whatever month was last browsed would answer
 * last March's question on the first of October. Another month is one press
 * of the same picker the Journal has.
 *
 * The two questions the screen is opened for lead — the balance today and
 * where the month ends, as big figures over the curve that joins them — and
 * everything else is a card only when it has something to say. A month that
 * has ended tells what it did; one ahead tells what its recurring entries
 * call for; the month in progress tells both, joined at today.
 *
 * It replaces the twelve-tile, five-family Bearing with panels fetched on the
 * press, which the web had already left behind: most of it was true and
 * almost none of it was what the screen is opened for.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const bottom = useTabBarClearance();
  // Shared with the Journal and its calendar, so changing tab keeps the month.
  const { year, month, setMonth } = useScreenMonth();

  const { data, error, refreshing, onRefreshAll } = useRefreshable(
    async () =>
      user ? await gatherHomeMonth(user.id, year, month, locale) : null,
    [user?.id, year, month, locale],
  );

  // A month ahead has nothing to read yet: nothing has happened in it.
  const readable = getMonthBounds(year, month).start <= todayIsoLocal();
  // Apart from the month, and after it: the read's fact pack is the slowest
  // thing the screen asks for, and the balance should not wait on it.
  const { data: read, reload: reloadRead } = useRefreshable(
    async () =>
      user && readable
        ? await gatherHomeRead(user.id, year, month, locale)
        : null,
    [user?.id, year, month, locale, readable],
  );

  // The week's recap: its own load too, and nothing on most days.
  const { data: recap } = useRefreshable(
    async () => (user ? await gatherHomeRecap(user.id, locale) : null),
    [user?.id, locale],
    { reads: ["transactions", "templates", "bank", "preferences"] },
  );

  // Whether a bank can be connected here at all is the deployment's to say.
  const { bank } = useBankState();

  // Kept on screen while the next month loads, dimmed, so the picker does not
  // flash the screen empty on every step.
  const stale = data !== null && (data.year !== year || data.month !== month);
  const period = data?.balance.period;
  const current = period === "current";
  const past = period === "past";

  let index = 0;
  const next = () => index++;

  return (
    <Screen title={t("nav.bearing")} className="px-4 py-0">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshAll}
            tintColor={colors.mutedForeground}
          />
        }
        contentContainerClassName="gap-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: bottom }}
        showsVerticalScrollIndicator={false}
      >
        <MonthPicker prominent year={year} month={month} onChange={setMonth} />

        {/* Above the figures, because a bank feed that has stopped leaves
            every one of them quietly stale. */}
        {bank?.attention ? (
          <BankAttentionBanner attention={bank.attention} />
        ) : null}

        {data ? (
          <View
            // Replayed per month: a new month is a new set of figures arriving.
            key={`${data.year}-${data.month}`}
            className="gap-4"
            style={stale ? { opacity: 0.5 } : undefined}
          >
            {data.attention.length > 0 ? (
              <AttentionRow attention={data.attention} />
            ) : null}

            {/* Before the figures, because answering one changes them: a
                salary confirmed as arrived stops being counted as still to
                come. */}
            {data.arrived ? (
              <View className="rounded-card border border-border bg-card/70 p-card">
                <ArrivedCharges
                  proposals={data.arrived.proposals}
                  misses={data.arrived.misses}
                />
              </View>
            ) : null}

            <StaggerItem index={next()}>
              <BalanceCard data={data} bank={bank} />
            </StaggerItem>

            {/* The week is this month's to recap, not a month browsed to. */}
            {current && recap ? (
              <WeeklyRecapCard key={recap.weekOf} recap={recap} />
            ) : null}

            {data.empty ? (
              <StaggerItem index={next()}>
                <SetUpCard />
              </StaggerItem>
            ) : null}

            {!data.empty && period !== "future" ? (
              <StaggerItem index={next()}>
                <SpentCard data={data} />
              </StaggerItem>
            ) : null}

            {!past && data.upcoming ? (
              <StaggerItem index={next()}>
                <UpcomingCard data={data} />
              </StaggerItem>
            ) : null}

            {current && (data.run !== null || data.invested !== null) ? (
              <StaggerItem index={next()}>
                <MomentumCard data={data} />
              </StaggerItem>
            ) : null}

            {data.spending.total > 0 ? (
              <StaggerItem index={next()}>
                <WhereItWentCard data={data} />
              </StaggerItem>
            ) : null}

            {read && read.year === year && read.month === month && !stale ? (
              <StaggerItem index={next()}>
                <View className="rounded-card border border-border bg-card/70 p-card">
                  <MonthRead
                    year={year}
                    month={month}
                    monthLabel={read.monthLabel}
                    read={read.read}
                    freshness={read.freshness}
                    facts={read.facts}
                    readFacts={read.readFacts}
                    readLocale={read.readLocale}
                    writesLeft={read.writesLeft}
                    writable={read.configured}
                    writerBrand={read.writerBrand}
                    readModel={read.readModel}
                    onWritten={() => {
                      void reloadRead();
                    }}
                  />
                </View>
              </StaggerItem>
            ) : null}
          </View>
        ) : error ? (
          <Text className="text-destructive">{resolveMessage(t, error)}</Text>
        ) : (
          <ScreenSkeleton />
        )}
      </ScrollView>
    </Screen>
  );
}
