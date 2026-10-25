import { useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { CLOSE_WAIT_REASON_KEYS } from "@finance/core/bank-balance";
import { formatShortDate, lastDayIsoOfMonth } from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import {
  closeInvitation,
  monthWasWon,
  type CloseableMonth,
} from "@finance/core/month-close";

import { MonthCloseHistoryCard } from "@/components/MonthCloseHistoryCard";
import { MonthCloseSheet } from "@/components/MonthCloseSheet";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import type { HomeMonth } from "@/lib/home-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import { HomeCard } from "@/components/bearing/card-parts";
import { MonthsCard } from "@/components/bearing/MonthsCard";

/** How many of the latest months the run's chain shows. */
const CHAIN_LENGTH = 6;

/**
 * One close, and every figure the sheet reads while it is open. Assembled
 * from live data to render the trigger, and frozen the moment it is pressed:
 * recording a close rewrites the very figures the open sheet is showing —
 * the month due usually empties, and the baseline is a median the new close
 * is one of — and driving the mounted sheet off them would tear it away,
 * reveal and undo included, the instant the refresh landed.
 */
interface ClosePrompt {
  month: CloseableMonth;
  monthlyCommitted: number;
  unrecordedCap: number | null;
  baseline: number | null;
}

/* ------------------------------------------------------------ the run */

/**
 * What the month is adding up to beyond itself: the run of months closed
 * under the allowance, the close that keeps it going, and what is invested.
 * The one card on the screen that keeps score, so it is the one that is
 * allowed to feel like it.
 *
 * The month close lives here since October 2026, when it left the Plan: a
 * month is closed where the month is read. « Vos mois » opens under the
 * card, and the closes' detail and settings under that, as they did there.
 * The web's card is its twin, with a sheet for « Vos mois ».
 */
export function MomentumCard({
  data,
  askedAt,
}: {
  data: HomeMonth;
  /**
   * The stamp of an ask to open the close — the attention row's « Faire le
   * bilan » — so that every ask opens it again on a tab that stays mounted.
   */
  askedAt?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const router = useRouter();
  const close = data.close;
  const overview = close?.overview ?? null;
  const next = overview?.next ?? null;

  const [closing, setClosing] = useState<ClosePrompt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const prompt: ClosePrompt | null =
    close && overview && next
      ? {
          month: next,
          monthlyCommitted: close.monthlyCommitted,
          unrecordedCap: overview.settings.unrecordedCap,
          baseline: overview.summary.baseline,
        }
      : null;
  const sheet = closing ?? prompt;

  // A new ask opens the close once, adjusted while rendering.
  const [answered, setAnswered] = useState<string | undefined>(undefined);
  if (askedAt && askedAt !== answered && prompt) {
    setAnswered(askedAt);
    setClosing(prompt);
    setSheetOpen(true);
  }

  const chain = (overview?.history ?? [])
    .filter((row) => row.status !== "baseline")
    .slice(0, CHAIN_LENGTH)
    .reverse();

  return (
    <View className="gap-4">
      <HomeCard icon="flame-outline" title={t("removal.momentumTitle")}>
        {data.run ? (
          <View className="gap-3 rounded-control bg-secondary px-3 py-2.5">
            <View className="flex-row items-center gap-3">
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
            {chain.length > 0 && overview ? (
              <View className="flex-row gap-2">
                {chain.map((row) => {
                  const won = monthWasWon(
                    row,
                    overview.settings.unrecordedCap,
                  );
                  return (
                    <View
                      key={row.monthKey}
                      accessible
                      accessibilityLabel={
                        won
                          ? t("planWeb.runMonthWon", { month: row.label })
                          : t("planWeb.runMonthMissed", { month: row.label })
                      }
                      className="flex-1 items-center gap-1"
                    >
                      <View
                        className="h-1.5 w-full rounded-full"
                        style={{
                          backgroundColor: won
                            ? colors.primary
                            : colors.hairlineStrong,
                        }}
                      />
                      <Text variant="micro">
                        {monthShort(Number(row.monthKey.slice(5, 7)), locale)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {next && overview ? (
          <CloseDue
            next={next}
            overview={overview}
            wait={close?.wait ?? []}
            streak={data.run?.streak ?? 0}
            onOpen={() => {
              if (prompt) {
                setClosing(prompt);
                setSheetOpen(true);
              }
            }}
          />
        ) : null}

        {overview && overview.history.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: monthsOpen }}
            onPress={() => {
              void hapticLight();
              setMonthsOpen((open) => !open);
            }}
            className="min-h-11 flex-row items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons
                name="bar-chart-outline"
                size={ICON.md}
                color={colors.mutedForeground}
              />
              <Text variant="muted" className="text-sm">
                {t("futurePlan.monthsTitle")}
              </Text>
            </View>
            <Ionicons
              name={monthsOpen ? "chevron-up" : "chevron-down"}
              size={ICON.md}
              color={colors.mutedForeground}
            />
          </Pressable>
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

      {overview && monthsOpen ? (
        <MonthsCard
          history={overview.history}
          detailsOpen={detailsOpen}
          onToggleDetails={() => setDetailsOpen((open) => !open)}
        />
      ) : null}

      {overview && monthsOpen && detailsOpen ? (
        <MonthCloseHistoryCard
          history={overview.history}
          summary={overview.summary}
          unrecordedCap={overview.settings.unrecordedCap}
          closeDay={overview.settings.closeDay}
        />
      ) : null}

      {sheet ? (
        <MonthCloseSheet
          open={sheetOpen}
          onOpenChange={(value) => {
            if (!value) {
              setSheetOpen(false);
            }
          }}
          year={sheet.month.year}
          month={sheet.month.month}
          monthLabel={sheet.month.label}
          observeOn={sheet.month.observeOn}
          isBaseline={sheet.month.isBaseline}
          monthlyCommitted={sheet.monthlyCommitted}
          unrecordedCap={sheet.unrecordedCap}
          baseline={sheet.baseline}
        />
      ) : null}
    </View>
  );
}

/**
 * The month due: what closing it will compare against, why the bank has not
 * closed it yet when it should have, and the way in.
 */
function CloseDue({
  next,
  overview,
  wait,
  streak,
  onOpen,
}: {
  next: CloseableMonth;
  overview: NonNullable<HomeMonth["close"]>["overview"];
  wait: NonNullable<HomeMonth["close"]>["wait"];
  streak: number;
  onOpen: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const invitation = closeInvitation({
    isBaseline: next.isBaseline,
    unrecordedCap: overview.settings.unrecordedCap,
    baseline: overview.summary.baseline,
  });
  const detail =
    invitation.kind === "baseline"
      ? t("monthClose.inviteBaseline")
      : invitation.kind === "allowance"
        ? t("monthClose.inviteAllowance", { cap: format(invitation.cap) })
        : invitation.kind === "normal"
          ? t("monthClose.inviteNormal", {
              amount: format(invitation.baseline),
            })
          : t("monthClose.inviteBare");

  return (
    <View className="gap-3 rounded-control border border-border p-3">
      <View className="gap-1">
        {streak > 0 ? (
          <Text className="text-sm font-medium">
            {t("futurePlan.runKeep", { month: next.label })}
          </Text>
        ) : null}
        <Text variant="muted" className="text-sm">
          {detail}
        </Text>
      </View>
      {/* Why the bank has not closed it: named, so the fix — renewing one
          bank's consent, as a rule — is obvious. */}
      {wait.length > 0 ? (
        <View className="gap-1">
          <Text variant="muted" className="text-sm">
            {t("monthClose.waitBody", {
              month: next.label,
              date: formatShortDate(
                lastDayIsoOfMonth(next.year, next.month),
                locale,
              ),
            })}
          </Text>
          {wait.map((account) => (
            <Text key={account.name} variant="muted" className="text-sm">
              <Text className="text-sm">{account.name}</Text>
              {" · "}
              {t(CLOSE_WAIT_REASON_KEYS[account.reason])}
            </Text>
          ))}
        </View>
      ) : null}
      <Button
        label={
          next.isBaseline
            ? t("monthClose.setStartingBalance")
            : t("monthClose.closeTheMonth")
        }
        variant="pill"
        icon="arrow-forward"
        className="self-start"
        onPress={onOpen}
      />
    </View>
  );
}
