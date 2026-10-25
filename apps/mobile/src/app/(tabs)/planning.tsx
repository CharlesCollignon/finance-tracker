import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import type { TrajectoryYears } from "@finance/core/history/plan-accounts";
import {
  TRAJECTORY_DEFAULT_SETTINGS,
  type HypothesesEdits,
  type TrajectorySettings,
} from "@finance/core/history/plan-settings";
import { resolveMessage } from "@finance/core/i18n/t";
import { resolveExtraTarget } from "@finance/core/year-ahead";
import type { PropertyRead } from "@finance/data/properties";

import { ConnectBankInvite } from "@/components/bank/ConnectBankInvite";
import { FadeIn } from "@/components/motion/FadeIn";
import { HistoryCard } from "@/components/plan/HistoryCard";
import { HypothesesPanel } from "@/components/plan/HypothesesPanel";
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
  loadHypothesesEdits,
  loadSeenMilestone,
  loadTrajectorySettings,
  planEnvelopes,
  saveHypothesesEdits,
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
 * How long the slider rests before « Et si… » is replayed: two replays of
 * five hundred starts each are too much to run on every step of a drag on
 * a phone, and the figure that lands once the finger pauses is the one
 * read.
 */
const EXTRA_SETTLE_MS = 150;

/**
 * Plan: where the money could go, replayed on what markets actually did —
 * the web's page (docs/plans/PLAN_REDESIGN_PLAN.md), with the same figures
 * from `@finance/core/history`.
 *
 * « Votre trajectoire », the accounts replayed from every start since 1970,
 * with « Et si… »; « Face à l'histoire », today's investments through the
 * great falls; « Progression », the milestones, the cushion and the run;
 * and « Hypothèses », folded, every figure the reader's to change. The month
 * close lives on Le point.
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
  const [edits, setEdits] = useState<HypothesesEdits>({});
  const [settingsUser, setSettingsUser] = useState<string | null>(null);
  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    void Promise.all([
      loadTrajectorySettings(user.id),
      loadHypothesesEdits(user.id),
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

  function changeEdits(next: HypothesesEdits) {
    setEdits(next);
    if (user) {
      void saveHypothesesEdits(user.id, next);
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
  edits: HypothesesEdits;
  onEdits: (edits: HypothesesEdits) => void;
}) {
  const locale = useLocale();
  const [extra, setExtra] = useState(0);
  // The slider answers at once; the replays follow once it rests.
  const [settledExtra, setSettledExtra] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setSettledExtra(extra), EXTRA_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [extra]);

  const hasProperty = properties !== null;
  const accounts = useMemo(() => planEnvelopes(base, wealth), [base, wealth]);
  const target = resolveExtraTarget(settings.to, accounts);
  const replay = usePlanReplay({
    base,
    wealth,
    edits,
    years: settings.years,
    extra: settledExtra,
    target,
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
          extra={extra}
          onExtra={setExtra}
          target={target}
          onTarget={(to) => onSettings({ ...settings, to })}
          targets={["current", ...accounts.map((each) => each.id)]}
          hasProperty={hasProperty}
          withProperty={settings.withProperty}
          onWithProperty={(withProperty) =>
            onSettings({ ...settings, withProperty })
          }
          year={base.year}
        />
      </FadeIn>
      <FadeIn>
        <HistoryCard crashes={replay.crashes} />
      </FadeIn>
      <FadeIn>
        <ProgressionCard
          milestones={replay.milestones}
          withExtra={replay.milestonesWithExtra}
          wealth={replay.wealth}
          cushion={replay.cushion}
          run={base.run}
          fresh={fresh}
          year={base.year}
          month={base.month}
        />
      </FadeIn>
      <FadeIn>
        <HypothesesPanel
          envelopes={replay.dataEnvelopes}
          edited={replay.envelopes}
          edits={edits}
          wallets={replay.wallets}
          onEdits={onEdits}
          properties={properties}
          onGrowthKept={onPropertiesChanged}
        />
      </FadeIn>
    </View>
  );
}
