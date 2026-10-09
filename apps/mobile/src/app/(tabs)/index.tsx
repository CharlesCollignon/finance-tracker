import { RefreshControl, ScrollView, View } from "react-native";

import { awaitingRole } from "@finance/core/bank-accounts";
import { getMonthBounds, todayIsoLocal } from "@finance/core/constants";

import { ArrivedCharges } from "@/components/ArrivedCharges";
import { AskLink } from "@/components/AskLink";
import { MonthPicker } from "@/components/MonthPicker";
import { MonthRead } from "@/components/MonthRead";
import { PurchasesToConfirm } from "@/components/PurchasesToConfirm";
import { BankAttentionBanner } from "@/components/bank/BankAttentionBanner";
import { NewAccountsLine } from "@/components/bank/NewAccountsLine";
import { AttentionRow } from "@/components/bearing/AttentionRow";
import { SetupCard } from "@/components/bearing/SetupCard";
import { YearReadyCard } from "@/components/bearing/YearReadyCard";
import { TaxSeasonCard } from "@/components/bearing/TaxSeasonCard";
import {
  BalanceCard,
  MomentumCard,
  SpentCard,
  UpcomingCard,
  WhereItWentCard,
} from "@/components/bearing/MonthCards";
import { WeeklyRecapCard } from "@/components/bearing/WeeklyRecapCard";
import { StaggerItem } from "@/components/motion/Stagger";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { ScreenError } from "@/components/ScreenError";
import { useBankState } from "@/hooks/useBankState";
import { useRefreshable } from "@/hooks/useRefreshable";
import { getBankAccounts } from "@/lib/queries";
import { shouldInvite } from "@/lib/bank-connect";
import { nextSetupStep } from "@finance/core/setup-steps";
import { inTaxSeason, incomeYearFor } from "@finance/core/tax-return";
import {
  gatherHomeMonth,
  gatherHomeRead,
  gatherHomeRecap,
} from "@/lib/home-data";
import { useAuth } from "@/providers/AuthProvider";
import { useOwner } from "@/providers/OwnerProvider";
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
  // Whose month: the person's, or their space's under « Commun ».
  const { ownerId, space, joint, myShare } = useOwner();
  // « Avec ma part du commun »: offered to someone in a space, under « Moi ».
  const withShare = space && !joint ? myShare : null;
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const bottom = useTabBarClearance();
  // Shared with the Journal and its calendar, so changing tab keeps the month.
  const { year, month, setMonth } = useScreenMonth();

  const { data, error, refreshing, onRefresh, onRefreshAll } = useRefreshable(
    async () =>
      ownerId
        ? await gatherHomeMonth(ownerId, year, month, locale, withShare)
        : null,
    [ownerId, year, month, locale, withShare],
  );

  // A month ahead has nothing to read yet: nothing has happened in it.
  const readable = getMonthBounds(year, month).start <= todayIsoLocal();
  // Apart from the month, and after it: the read's fact pack is the slowest
  // thing the screen asks for, and the balance should not wait on it.
  const { data: read, reload: reloadRead } = useRefreshable(
    async () =>
      user && ownerId && readable
        ? await gatherHomeRead(ownerId, year, month, locale, user.id)
        : null,
    [user?.id, ownerId, year, month, locale, readable],
  );

  // The week's recap: its own load too, and nothing on most days.
  const { data: recap } = useRefreshable(
    async () => (ownerId ? await gatherHomeRecap(ownerId, locale) : null),
    [ownerId, locale],
    { reads: ["transactions", "templates", "bank", "preferences"] },
  );

  // Whether a bank can be connected here at all is the deployment's to say.
  const { bank } = useBankState();

  // Accounts the bank shows that wait to be told what they are: nothing of
  // theirs comes in until then, so the screen says so.
  const { data: awaitingAccounts } = useRefreshable(
    async () =>
      user ? awaitingRole(await getBankAccounts(user.id)).length : 0,
    [user?.id],
    { reads: ["bank"] },
  );

  // Kept on screen while the next month loads, dimmed, so the picker does not
  // flash the screen empty on every step.
  const stale = data !== null && (data.year !== year || data.month !== month);
  const period = data?.balance.period;
  const current = period === "current";
  const past = period === "past";

  // One setup card at a time, for the month in progress.
  const setupStep = data?.setup
    ? nextSetupStep({
        ...data.setup,
        bankInvited: bank !== null && shouldInvite("bearing", bank),
      })
    : null;
  // Only what has something in it: a first visit shows the setup card, not
  // a row of zeros.
  const hasSpentBefore =
    data !== null &&
    (data.spent.total > 0 || data.spent.trend.some((entry) => entry.total > 0));

  let index = 0;
  const next = () => index++;

  return (
    <Screen title={t("nav.bearing")} className="px-4 py-0" shared>
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

        {awaitingAccounts ? (
          <NewAccountsLine count={awaitingAccounts} />
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
                />
              </View>
            ) : null}

            {/* April to June, the person's own: the return's amounts. */}
            {current && !joint && inTaxSeason(todayIsoLocal()) ? (
              <TaxSeasonCard year={incomeYearFor(todayIsoLocal())} />
            ) : null}

            {/* January: the year before, told in a few cards. */}
            {data.yearReady !== null && !data.empty ? (
              <YearReadyCard year={data.yearReady} />
            ) : null}

            {/* The same kind of question, for what the bank cannot see. */}
            {data.purchases.length > 0 ? (
              <View className="rounded-card border border-border bg-card/70 p-card">
                <PurchasesToConfirm purchases={data.purchases} />
              </View>
            ) : null}


            {setupStep && data.setup ? (
              <StaggerItem index={next()}>
                <SetupCard
                  step={setupStep}
                  firstCloseOn={data.setup.firstCloseOn}
                  bank={bank}
                />
              </StaggerItem>
            ) : null}

            {!data.empty ? (
              <StaggerItem index={next()}>
                <BalanceCard data={data} />
              </StaggerItem>
            ) : null}

            {/* The week is this month's to recap, not a month browsed to. */}
            {current && recap ? (
              <WeeklyRecapCard key={recap.weekOf} recap={recap} />
            ) : null}

            {hasSpentBefore && period !== "future" ? (
              <StaggerItem index={next()}>
                <SpentCard data={data} />
              </StaggerItem>
            ) : null}

            {!past && data.upcoming && data.recurring ? (
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
                    writable={read.writer.writable}
                    account={read.writer.account}
                    writerBrand={read.writer.name}
                    readModel={read.readModel}
                    onWritten={() => {
                      void reloadRead();
                    }}
                  />
                  {/* The questions the read leaves: the person's own money,
                      so not under « Commun ». */}
                  {joint ? null : <AskLink />}
                </View>
              </StaggerItem>
            ) : null}
          </View>
        ) : error ? (
          <ScreenError message={error} onRetry={onRefresh} />
        ) : (
          <ScreenSkeleton />
        )}
      </ScrollView>
    </Screen>
  );
}
