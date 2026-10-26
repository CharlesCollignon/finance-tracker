import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import type { TrajectoryYears } from "@finance/core/history/plan-accounts";
import {
  TRAJECTORY_DEFAULT_SETTINGS,
  type PlanEdits,
  type TrajectorySettings,
} from "@finance/core/history/plan-settings";
import { resolveMessage } from "@finance/core/i18n/t";
import type { PropertyRead } from "@finance/data/properties";

import { ConnectBankInvite } from "@/components/bank/ConnectBankInvite";
import { FadeIn } from "@/components/motion/FadeIn";
import { PlanAccounts } from "@/components/plan/PlanAccounts";
import { ProgressionCard } from "@/components/plan/ProgressionCard";
import { TrajectoryCard } from "@/components/plan/TrajectoryCard";
import { usePlanReplay } from "@/components/plan/use-plan-replay";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useBankState } from "@/hooks/useBankState";
import { useFlag } from "@/hooks/useFlag";
import { useRefreshable } from "@/hooks/useRefreshable";
import { hapticSuccess } from "@/lib/haptics";
import {
  gatherPlanBase,
  gatherPlanWealth,
  loadPlanEdits,
  loadSeenMilestone,
  loadTrajectorySettings,
  savePlanEdits,
  saveSeenMilestone,
  saveTrajectorySettings,
  type PlanBase,
  type PlanWealth,
} from "@/lib/plan-future-data";
import { getJointPropertiesFor, getProperties } from "@/lib/properties";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useTabBarClearance } from "@/theme/chrome";

/**
 * Plan: where the money could go, replayed on what markets actually did —
 * the web's page (docs/plans/PLAN_REDESIGN_PLAN.md), with the same figures
 * from `@finance/core/history`.
 *
 * « Votre trajectoire », the accounts replayed from every start since 1970,
 * with « Vos comptes » under the chart — every figure the line is made of,
 * the reader's to change; then « Progression », the milestones, the cushion
 * and the run. The month close lives on Le point.
 *
 * The screen is drawn once the investments' market value has come, because
 * every card counts them and a figure that jumps when they land is one
 * nobody trusts.
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
  // Apart, because it asks the market for prices.
  const wealth = useRefreshable(
    async () => (user ? await gatherPlanWealth(user.id, locale) : null),
    [user?.id, locale],
  );
  // A failed price fetch leaves the screen on the savings it can see.
  const wealthSettled = !wealth.loading || wealth.data !== null;
  const tracksProperty = useFlag("property.track");
  const owned = useRefreshable(
    async () =>
      user && tracksProperty
        ? [
            ...(await getProperties(user.id)).properties,
            // The homes owned through the shared space, as this person's
            // part of each (6c).
            ...(await getJointPropertiesFor(user.id).catch(() => [])),
          ]
        : null,
    [user?.id, tracksProperty],
    { reads: ["properties"] },
  );
  const properties =
    owned.data && owned.data.length > 0 ? owned.data : null;

  const [settings, setSettings] = useState<TrajectorySettings>(
    TRAJECTORY_DEFAULT_SETTINGS,
  );
  const [edits, setEdits] = useState<PlanEdits>({});
  const [settingsUser, setSettingsUser] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    void Promise.all([
      loadTrajectorySettings(user.id),
      loadPlanEdits(user.id),
    ]).then(([stored, storedEdits]) => {
      if (!cancelled) {
        setSettings(stored);
        setEdits(storedEdits);
        setSettingsUser(user.id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);
  const settingsReady = user !== null && settingsUser === user.id;

  function changeSettings(next: TrajectorySettings) {
    setSettings(next);
    if (user) {
      void saveTrajectorySettings(user.id, next);
    }
  }

  function changeEdits(next: PlanEdits) {
    setEdits(next);
    if (user) {
      void savePlanEdits(user.id, next);
    }
  }

  const data = base.data;
  const ready = data !== null && wealthSettled && settingsReady;

  return (
    <Screen title={t("nav.plan")} className="pb-0">
      {base.error && !data ? (
        <Text className="text-destructive">
          {resolveMessage(t, base.error)}
        </Text>
      ) : !ready || !user ? (
        <ScreenSkeleton rows={4} />
      ) : (
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
            {t("trajectory.intro")}
          </Text>

          <PlanCards
            userId={user.id}
            base={data}
            wealth={wealth.data}
            properties={properties}
            onPropertiesChanged={owned.onRefresh}
            settings={settings}
            onSettings={changeSettings}
            edits={edits}
            onEdits={changeEdits}
          />

          {/* Last, because a connected bank is what makes the figures
              above the reader's own. */}
          <ConnectBankInvite surface="plan" bank={bank} />
        </ScrollView>
      )}
    </Screen>
  );
}

function PlanCards({
  userId,
  base,
  wealth,
  properties,
  onPropertiesChanged,
  settings,
  onSettings,
  edits,
  onEdits,
}: {
  userId: string;
  base: PlanBase;
  wealth: PlanWealth | null;
  properties: PropertyRead[] | null;
  onPropertiesChanged: () => void;
  settings: TrajectorySettings;
  onSettings: (settings: TrajectorySettings) => void;
  edits: PlanEdits;
  onEdits: (edits: PlanEdits) => void;
}) {
  const locale = useLocale();
  const hasProperty = properties !== null;
  const replay = usePlanReplay({
    base,
    wealth,
    edits,
    years: settings.years,
    properties: settings.withProperty ? properties : null,
  });

  // A milestone passed since the last visit, celebrated once, on whichever
  // device sees it first. A first visit records where things stand rather
  // than celebrating everything already behind the reader.
  const topReached =
    replay.milestones.filter((each) => each.reached).at(-1)?.amount ?? 0;
  const [fresh, setFresh] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadSeenMilestone(userId).then((seen) => {
      if (cancelled) {
        return;
      }
      if (seen === null || topReached > seen) {
        void saveSeenMilestone(userId, topReached, locale);
      }
      if (seen !== null && topReached > seen) {
        setFresh(topReached);
        void hapticSuccess();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, topReached, locale]);

  return (
    <View className="gap-4">
      <FadeIn>
        <TrajectoryCard
          replay={replay}
          years={settings.years}
          onYears={(years: TrajectoryYears) =>
            onSettings({ ...settings, years })
          }
          hasProperty={hasProperty}
          withProperty={settings.withProperty}
          onWithProperty={(withProperty) =>
            onSettings({ ...settings, withProperty })
          }
        >
          <PlanAccounts
            replay={replay}
            edits={edits}
            onEdits={onEdits}
            properties={properties}
            today={base.today}
            years={settings.years}
            onGrowthKept={onPropertiesChanged}
          />
        </TrajectoryCard>
      </FadeIn>
      <FadeIn>
        <ProgressionCard
          milestones={replay.milestones}
          wealth={replay.wealth}
          cushion={replay.cushion}
          run={base.run}
          fresh={fresh}
          year={base.year}
          month={base.month}
        />
      </FadeIn>
    </View>
  );
}
