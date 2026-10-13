import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  FadeInDown,
  LinearTransition,
  useReducedMotion,
  ZoomIn,
} from "react-native-reanimated";

import {
  changelogMonths,
  changeText,
  type ChangeKind,
  type ChangelogEntry,
} from "@finance/core/changelog";
import { formatDayMonth } from "@finance/core/constants";
import { monthLong } from "@finance/core/i18n/calendar-names";
import { DURATION, STAGGER_STEP_MS } from "@finance/core/motion";
import {
  CHANGELOG_REACTIONS,
  changelogTarget,
  ROADMAP_VOTE,
  roadmapTarget,
  type NouveautesReaction,
  type ReactionKind,
  type ReactionTally,
} from "@finance/core/reactions";

import { Screen } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Text } from "@/components/ui/Text";
import { WEB_APP_URL } from "@/lib/env";
import { hapticLight } from "@/lib/haptics";
import {
  markNouveautesSeen,
  useNouveautes,
  useReactions,
} from "@/lib/nouveautes";
import { cn } from "@/lib/cn";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

type KindFilter = "all" | ChangeKind;

/** Past the first screenful a cascade is only waited for, not seen. */
const STAGGER_CAP = 8;

/** Each kind's dot, as on the site: green for what arrived, greys after. */
const KIND_DOT: Record<ChangeKind, string> = {
  new: "bg-success",
  better: "bg-foreground/85",
  fixed: "bg-foreground/50",
};

/**
 * « Nouveautés » on the phone: everything that has changed, newest first,
 * by month, from the web's list (`useNouveautes`).
 *
 * What is new for the account is marked in the status green when the screen
 * opens — frozen then, so it stays marked while it is read — and the
 * account's marker moves to the newest entry, which clears the dot on the
 * account menu here and on the web. The cards rise in a beat apart, « Plus »
 * opens one where it stands and the ones below slide down, and the filter
 * re-deals the list. Under reduced motion everything is in place.
 */
export default function NouveautesScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { feed, unseen, loaded } = useNouveautes(userId);
  const [kind, setKind] = useState<KindFilter>("all");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  // What was new on arrival, kept for the visit: set once the account's
  // marker has been read, before the marker moves.
  const [fresh, setFresh] = useState<ReadonlySet<string> | null>(null);
  if (fresh === null && loaded) {
    setFresh(new Set(unseen.map((entry) => entry.id)));
  }
  const arrived = fresh !== null;
  useEffect(() => {
    if (arrived && userId) {
      void markNouveautesSeen(userId, locale);
    }
  }, [arrived, userId, locale]);

  const targets = useMemo(
    () => [
      ...feed.entries.map((entry) => changelogTarget(entry.id)),
      ...feed.roadmap.map((item) => roadmapTarget(item.id)),
    ],
    [feed.entries, feed.roadmap],
  );
  const { tally, say } = useReactions(targets, userId);

  const months = useMemo(
    () =>
      changelogMonths(
        feed.entries.filter((entry) => kind === "all" || entry.kind === kind),
      ),
    [feed.entries, kind],
  );

  let index = 0;
  const enter = () =>
    reduceMotion
      ? undefined
      : FadeInDown.duration(DURATION.enter).delay(
          Math.min(index++, STAGGER_CAP) * STAGGER_STEP_MS,
        );
  const layout = reduceMotion
    ? undefined
    : LinearTransition.duration(DURATION.panel);

  return (
    <Screen
      title={t("nouveautes.title")}
      back={{ label: t("nouveautes.back"), onPress: () => router.back() }}
      showRefresh={false}
    >
      <ScrollView contentContainerClassName="gap-3 px-4 pb-16 pt-4">
        <SegmentedControl
          label={t("nouveautes.title")}
          value={kind}
          onChange={(next) => {
            void hapticLight();
            setKind(next);
          }}
          segments={[
            { value: "all", label: t("nouveautes.all") },
            { value: "new", label: t("nouveautes.kindNew") },
            { value: "better", label: t("nouveautes.kindBetter") },
            { value: "fixed", label: t("nouveautes.kindFixed") },
          ]}
        />

        {/* Keyed by the filter: a new filter deals the list again. */}
        <View key={kind} className="gap-3">
          {months.map((month) => (
            <View key={month.key} className="gap-3">
              <Animated.View entering={enter()} className="pt-5">
                <Text variant="title">
                  {capitalised(monthLong(month.month, locale))} {month.year}
                </Text>
              </Animated.View>
              {month.weeks.flatMap((week) =>
                week.entries.map((entry) => (
                  <Animated.View
                    key={entry.id}
                    entering={enter()}
                    layout={layout}
                  >
                    <EntryCard
                      entry={entry}
                      fresh={fresh?.has(entry.id) ?? false}
                      tally={tally(changelogTarget(entry.id))}
                      onReact={(kind) => say(changelogTarget(entry.id), kind)}
                      open={open.has(entry.id)}
                      onToggle={() => {
                        void hapticLight();
                        setOpen((current) => {
                          const next = new Set(current);
                          if (!next.delete(entry.id)) {
                            next.add(entry.id);
                          }
                          return next;
                        });
                      }}
                    />
                  </Animated.View>
                )),
              )}
            </View>
          ))}
        </View>

        {feed.roadmap.length > 0 ? (
          <Animated.View entering={enter()} className="gap-3 pt-8">
            <Text variant="title">{t("nouveautes.soon")}</Text>
            {feed.roadmap.map((item) => (
              <View
                key={item.id}
                className="gap-1.5 rounded-card border border-border bg-card/70 p-card"
              >
                <View className="h-3 w-3 rounded-full border border-dashed border-foreground/50" />
                <Text variant="head" className="pt-2">
                  {item[locale].title}
                </Text>
                <Text variant="muted">{item[locale].body}</Text>
                <ReactionRow
                  kinds={[ROADMAP_VOTE]}
                  tally={tally(roadmapTarget(item.id))}
                  onReact={(kind) => say(roadmapTarget(item.id), kind)}
                  vote
                />
              </View>
            ))}
          </Animated.View>
        ) : null}

        {WEB_APP_URL ? (
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              void WebBrowser.openBrowserAsync(`${WEB_APP_URL}/nouveautes`)
            }
            className="mt-4 min-h-11 flex-row items-center justify-center gap-2 rounded-full border border-border"
          >
            <Text className="text-sm font-medium">
              {t("nouveautes.onSite")}
            </Text>
            <Ionicons
              name="open-outline"
              size={ICON.sm}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function EntryCard({
  entry,
  fresh,
  tally,
  onReact,
  open,
  onToggle,
}: {
  entry: ChangelogEntry;
  fresh: boolean;
  tally: ReactionTally;
  onReact: (kind: ReactionKind) => Promise<{ ok: boolean }>;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const text = changeText(entry, locale);
  const kindLabel = {
    new: t("nouveautes.kindNew"),
    better: t("nouveautes.kindBetter"),
    fixed: t("nouveautes.kindFixed"),
  }[entry.kind];

  return (
    <Pressable
      accessibilityRole={text.detail ? "button" : undefined}
      accessibilityState={text.detail ? { expanded: open } : undefined}
      disabled={!text.detail}
      onPress={onToggle}
      className={cn(
        "overflow-hidden rounded-card border bg-card/70 p-card",
        entry.featured ? "border-foreground/15" : "border-border",
      )}
    >
      {fresh ? (
        <View className="absolute bottom-4 left-0 top-4 w-0.5 rounded-full bg-success" />
      ) : null}
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <View className="flex-row items-center gap-1.5">
          <View className={cn("h-1.5 w-1.5 rounded-full", KIND_DOT[entry.kind])} />
          <Text className="text-xs font-medium">{kindLabel}</Text>
        </View>
        {entry.platforms.map((platform) => (
          <Ionicons
            key={platform}
            name={platform === "web" ? "desktop-outline" : "phone-portrait-outline"}
            size={13}
            color={colors.mutedForeground}
          />
        ))}
        {fresh ? (
          <Text className="text-xs font-medium text-success">
            {t("nouveautes.fresh")}
          </Text>
        ) : null}
        <Text variant="muted" className="ml-auto text-xs">
          {formatDayMonth(entry.date, locale)}
        </Text>
      </View>
      <Text variant="head" className="pt-2">
        {text.title}
      </Text>
      <Text variant="muted" className="pt-1">
        {text.body}
      </Text>
      {open && text.detail ? (
        <Animated.View entering={FadeInDown.duration(DURATION.panel)}>
          <Text className="pt-3">{text.detail}</Text>
        </Animated.View>
      ) : null}
      {text.detail ? (
        <View className="flex-row items-center gap-1 pt-3">
          <Text className="text-sm font-medium">
            {open ? t("nouveautes.less") : t("nouveautes.more")}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={ICON.sm}
            color={colors.foreground}
          />
        </View>
      ) : null}
      <ReactionRow
        kinds={CHANGELOG_REACTIONS}
        tally={tally}
        onReact={onReact}
      />
    </Pressable>
  );
}

const REACTION_ICONS: Record<
  NouveautesReaction,
  [filled: keyof typeof Ionicons.glyphMap, outline: keyof typeof Ionicons.glyphMap]
> = {
  love: ["heart", "heart-outline"],
  useful: ["thumbs-up", "thumbs-up-outline"],
  finally: ["sparkles", "sparkles-outline"],
  want: ["hourglass", "hourglass-outline"],
};

/**
 * « J'adore », « Utile », « Enfin ! » under a change, or « J'attends ça » on
 * « Bientôt », as on the site: the mark pops filled as soon as it is
 * pressed, with a light haptic, and goes back if the write is refused.
 */
function ReactionRow({
  kinds,
  tally,
  onReact,
  vote = false,
}: {
  kinds: readonly NouveautesReaction[];
  tally: ReactionTally;
  onReact: (kind: ReactionKind) => Promise<{ ok: boolean }>;
  vote?: boolean;
}) {
  const t = useT();
  const colors = useThemeColors();
  const [pops, setPops] = useState<Partial<Record<ReactionKind, number>>>({});
  const [failed, setFailed] = useState(false);
  const labels: Record<NouveautesReaction, string> = {
    love: t("nouveautes.reactLove"),
    useful: t("nouveautes.reactUseful"),
    finally: t("nouveautes.reactFinally"),
    want: t("nouveautes.reactWant"),
  };

  return (
    <View className="gap-1 pt-3">
      <View className="flex-row flex-wrap gap-1.5">
        {kinds.map((kind) => {
          const mine = tally.mine.includes(kind);
          const count = tally.counts[kind] ?? 0;
          const [filled, outline] = REACTION_ICONS[kind];
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityState={{ selected: mine }}
              accessibilityLabel={`${labels[kind]}${count > 0 ? ` (${count})` : ""}`}
              onPress={() => {
                void hapticLight();
                setFailed(false);
                if (!mine) {
                  setPops((current) => ({
                    ...current,
                    [kind]: (current[kind] ?? 0) + 1,
                  }));
                }
                void onReact(kind).then(({ ok }) => setFailed(!ok));
              }}
              className={cn(
                "min-h-11 flex-row items-center gap-1.5 rounded-full border px-3",
                mine ? "border-foreground/20 bg-foreground/10" : "border-border",
              )}
            >
              <Animated.View
                key={pops[kind] ?? 0}
                entering={pops[kind] ? ZoomIn.springify() : undefined}
              >
                <Ionicons
                  name={mine ? filled : outline}
                  size={15}
                  color={mine ? colors.foreground : colors.mutedForeground}
                />
              </Animated.View>
              {vote ? <Text className="text-sm">{labels[kind]}</Text> : null}
              {count > 0 ? (
                <Text
                  className={cn(
                    "text-sm",
                    mine ? "text-foreground" : "text-muted-foreground",
                  )}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {count}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {failed ? (
        <Text variant="muted" className="text-xs">
          {t("nouveautes.reactFailed")}
        </Text>
      ) : null}
    </View>
  );
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
