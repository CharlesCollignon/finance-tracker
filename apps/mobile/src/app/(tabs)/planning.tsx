import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";

import {
  buildCushion,
  buildMilestones,
  cushionEnvelopes,
  cushionSavings,
  MILESTONE_TIERS,
  monthsUntil,
  projectEnvelopes,
  wealthToday,
} from "@finance/core/future-plan";
import { todayIsoLocal } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import type { CloseableMonth } from "@finance/core/month-close";
import { buildRunway } from "@finance/core/projection";

import { ConnectBankInvite } from "@/components/bank/ConnectBankInvite";
import { MonthCloseHistoryCard } from "@/components/MonthCloseHistoryCard";
import { MonthCloseSheet } from "@/components/MonthCloseSheet";
import { StaggerItem } from "@/components/motion/Stagger";
import { CushionCard } from "@/components/plan/CushionCard";
import { LongViewCard, MAX_YEARS } from "@/components/plan/LongViewCard";
import { MilestonesCard } from "@/components/plan/MilestonesCard";
import { MonthsCard } from "@/components/plan/MonthsCard";
import {
  NetWorthCard,
  PropertyLongViewCard,
} from "@/components/plan/PropertyPlanCards";
import { RunCard } from "@/components/plan/RunCard";
import {
  YearAheadCard,
  type MilestoneSooner,
} from "@/components/plan/YearAheadCard";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useBankState } from "@/hooks/useBankState";
import { useFlag } from "@/hooks/useFlag";
import { useRefreshable } from "@/hooks/useRefreshable";
import { hapticSuccess } from "@/lib/haptics";
import {
  DEFAULT_PLAN_SETTINGS,
  gatherPlanBase,
  gatherPlanWealth,
  loadPlanSettings,
  loadSeenMilestone,
  planEnvelopes,
  savePlanSettings,
  saveSeenMilestone,
  type PlanSettings,
} from "@/lib/plan-future-data";
import { getProperties } from "@/lib/properties";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useTabBarClearance } from "@/theme/chrome";

/**
 * One close, and every figure the sheet reads while it is open. Assembled
 * from live data to render the trigger, and frozen the moment it is pressed:
 * recording a close rewrites the very figures the open sheet is showing —
 * `closes.next` usually empties, and the baseline is a median the new close
 * is one of — and driving the mounted sheet off them would tear it away,
 * reveal and undo included, the instant the refresh landed.
 */
interface ClosePrompt {
  month: CloseableMonth;
  monthlyCommitted: number;
  unrecordedCap: number | null;
  baseline: number | null;
}

/**
 * Plan: where the money is heading, and the reasons to come back and look.
 *
 * A year from now first, counting up over the curve that gets there, with a
 * "what if" to slide; then the milestones on the way and the cushion the
 * savings make; then the long view after French tax, prefilled from the
 * user's own figures; and last the run of month-ends, with the close that
 * keeps it going and the months it is made of. With a property, net worth
 * follows the cushion and the homes' own long view follows the long view —
 * beside the savings and investments, never counted in them.
 *
 * Every figure comes from `@finance/core/future-plan` and the projection,
 * the same arithmetic as the web's Plan, so both clients show one future.
 * It replaces a screen of budgets, goals and tags: forms to fill in, where
 * this is a picture to look at.
 */
export default function PlanningScreen() {
  const t = useT();
  const locale = useLocale();
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const { bank } = useBankState();

  const base = useRefreshable(
    async () => (user ? await gatherPlanBase(user.id, locale) : null),
    [user?.id, locale],
  );
  // Apart, because it asks the market for prices; the rest of the screen
  // does not wait on it.
  const wealth = useRefreshable(
    async () => (user ? await gatherPlanWealth(user.id, locale) : null),
    [user?.id, locale],
  );
  // A failed price fetch leaves the long view on the savings it can see.
  const wealthSettled = !wealth.loading || wealth.data !== null;
  const tracksProperty = useFlag("property.track");
  const owned = useRefreshable(
    async () =>
      user && tracksProperty ? (await getProperties(user.id)).properties : null,
    [user?.id, tracksProperty],
    { reads: ["properties"] },
  );
  const properties =
    owned.data && owned.data.length > 0 ? owned.data : null;

  const [settings, setSettings] = useState<PlanSettings>(DEFAULT_PLAN_SETTINGS);
  const [settingsUser, setSettingsUser] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    void loadPlanSettings(user.id).then((stored) => {
      if (!cancelled) {
        setSettings(stored);
        setSettingsUser(user.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);
  const settingsReady = user !== null && settingsUser === user.id;

  function changeSettings(next: PlanSettings) {
    setSettings(next);
    if (user) {
      void savePlanSettings(user.id, next);
    }
  }

  const [extra, setExtra] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [closing, setClosing] = useState<ClosePrompt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const data = base.data;
  const dataEnvelopes = useMemo(
    () => (data ? planEnvelopes(data, wealth.data) : []),
    [data, wealth.data],
  );
  const envelopes = settings.envelopes ?? dataEnvelopes;
  // The long view's net at the horizon, for the homes' card to add to.
  const liquidNet = useMemo(
    () =>
      projectEnvelopes({
        envelopes,
        years: settings.years,
        inflation: settings.inflation,
        withdrawalRate: settings.withdrawalRate,
      }).netValue,
    [envelopes, settings.years, settings.inflation, settings.withdrawalRate],
  );

  // The milestones look as far ahead as the long view can, whatever its
  // horizon is set to, so moving the horizon does not move them; and they
  // are the user's own figures, never an edit in the long view — typing a
  // bigger number is not progress. The web reads them the same way.
  const milestoneSeries = useMemo(
    () =>
      projectEnvelopes({
        envelopes: dataEnvelopes,
        years: MAX_YEARS,
        inflation: 0,
        withdrawalRate: 0,
      }).monthly,
    [dataEnvelopes],
  );
  const current = wealthToday(dataEnvelopes);
  const milestones = useMemo(
    () => buildMilestones(current, milestoneSeries),
    [current, milestoneSeries],
  );
  const sooner = wealthSettled
    ? milestoneSooner(milestones, milestoneSeries, extra)
    : null;

  // A milestone passed since the last visit, celebrated once. Judged on the
  // user's own figures, not on an edit in the long view — typing a bigger
  // number is not progress.
  const reachedOnData =
    MILESTONE_TIERS.filter((tier) => tier <= wealthToday(dataEnvelopes)).at(
      -1,
    ) ?? 0;
  const hasData = data !== null;
  const [freshAmount, setFreshAmount] = useState<number | null>(null);
  useEffect(() => {
    if (!user || !hasData || !wealthSettled) {
      return;
    }
    let cancelled = false;
    void loadSeenMilestone(user.id).then((seen) => {
      if (cancelled) {
        return;
      }
      if (seen === null || reachedOnData > seen) {
        void saveSeenMilestone(user.id, reachedOnData, locale);
      }
      // A first visit records where things stand rather than celebrating
      // everything already behind the user.
      if (seen !== null && reachedOnData > seen) {
        setFreshAmount(reachedOnData);
        void hapticSuccess();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, hasData, wealthSettled, reachedOnData, locale]);

  // The cushion is the savings at hand — every savings account but a PEL,
  // the user's corrections in the long view included — against the fixed
  // costs; or the user's own figures, when the long view has had its
  // savings taken out. The web reads it the same way.
  const runway = data
    ? buildRunway(
        cushionSavings(cushionEnvelopes(settings.envelopes, dataEnvelopes)),
        data.templates,
        data.year,
        data.month,
      )
    : null;
  const cushion = buildCushion(runway?.months ?? null);

  const closes = data?.closes ?? null;
  const prompt: ClosePrompt | null =
    closes?.next && runway
      ? {
          month: closes.next,
          monthlyCommitted: runway.monthlyCommitted,
          unrecordedCap: closes.settings.unrecordedCap,
          baseline: closes.summary.baseline,
        }
      : null;
  const sheet = closing ?? prompt;

  return (
    <Screen title={t("nav.plan")} className="pb-0">
      {base.loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : base.error && !data ? (
        <Text className="text-destructive">
          {resolveMessage(t, base.error)}
        </Text>
      ) : data ? (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={base.refreshing}
              onRefresh={() => {
                base.onRefreshAll();
                wealth.onRefresh();
                owned.onRefresh();
              }}
            />
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerClassName="gap-4 pt-1"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
          showsVerticalScrollIndicator={false}
        >
          <Text variant="muted" className="text-sm">
            {t("futurePlan.intro")}
          </Text>

          <StaggerItem index={0}>
            <YearAheadCard
              projection={data.projection}
              hasTemplates={data.hasTemplates}
              year={data.year}
              month={data.month}
              extra={extra}
              onExtraChange={setExtra}
              sooner={sooner}
            />
          </StaggerItem>

          {wealthSettled && settingsReady ? (
            <StaggerItem index={1}>
              <MilestonesCard
                milestones={milestones}
                current={current}
                freshAmount={freshAmount}
                year={data.year}
                month={data.month}
                horizonYears={MAX_YEARS}
              />
            </StaggerItem>
          ) : (
            <Skeleton className="h-48 rounded-card" />
          )}

          <StaggerItem index={2}>
            <CushionCard cushion={cushion} />
          </StaggerItem>

          {properties && wealthSettled ? (
            <StaggerItem index={3}>
              <NetWorthCard
                liquid={current}
                properties={properties}
                today={todayIsoLocal()}
              />
            </StaggerItem>
          ) : null}

          {wealthSettled && settingsReady ? (
            <StaggerItem index={3}>
              <LongViewCard
                settings={settings}
                envelopes={envelopes}
                declaredSavings={data.savings.length > 0}
                custom={settings.envelopes !== null}
                onSettingsChange={(patch) =>
                  changeSettings({ ...settings, ...patch })
                }
                onEnvelopesChange={(next) =>
                  changeSettings({ ...settings, envelopes: next })
                }
                onReset={() => changeSettings({ ...settings, envelopes: null })}
              />
            </StaggerItem>
          ) : (
            <Skeleton className="h-96 rounded-card" />
          )}

          {/* The homes follow the long view's horizon and inflation, so a
              step there moves both cards. */}
          {properties && wealthSettled && settingsReady ? (
            <StaggerItem index={4}>
              <PropertyLongViewCard
                properties={properties}
                today={todayIsoLocal()}
                years={settings.years}
                inflation={settings.inflation}
                liquidNet={liquidNet}
              />
            </StaggerItem>
          ) : null}

          {closes ? (
            <StaggerItem index={4}>
              <RunCard
                summary={closes.summary}
                next={closes.next}
                closeWait={data?.closeWait}
                onOpen={() => {
                  if (prompt) {
                    setClosing(prompt);
                    setSheetOpen(true);
                  }
                }}
              />
            </StaggerItem>
          ) : null}

          {closes ? (
            <StaggerItem index={5}>
              <MonthsCard
                history={closes.history}
                detailsOpen={detailsOpen}
                onToggleDetails={() => setDetailsOpen((open) => !open)}
              />
            </StaggerItem>
          ) : null}

          {closes && detailsOpen ? (
            <MonthCloseHistoryCard
              history={closes.history}
              summary={closes.summary}
              unrecordedCap={closes.settings.unrecordedCap}
              closeDay={closes.settings.closeDay}
            />
          ) : null}

          {/* Beside the run, because a connected bank is what closes
              months without being asked. */}
          <ConnectBankInvite surface="plan" bank={bank} />
        </ScrollView>
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
    </Screen>
  );
}

/**
 * The first milestone ahead that the extra brings closer — not only the
 * next one, which the extra may leave where it was. The web reads it the
 * same way.
 */
function milestoneSooner(
  milestones: readonly { amount: number; reached: boolean }[],
  series: readonly number[],
  extra: number,
): MilestoneSooner | null {
  for (const milestone of milestones) {
    if (milestone.reached) {
      continue;
    }
    const without = monthsUntil(milestone.amount, series);
    const withExtra = monthsUntil(milestone.amount, series, extra);
    if (withExtra !== null && (without === null || withExtra < without)) {
      return { amount: milestone.amount, without, with: withExtra };
    }
  }
  return null;
}
