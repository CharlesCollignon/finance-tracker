import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";

import { isCryptoCategoryName } from "@finance/core/crypto-holdings";
import { formatRecurrenceSchedule } from "@finance/core/recurrence";
import { rollUpRecurring } from "@finance/core/recurring-rollup";
import { formatSharesLabel } from "@finance/core/recurring-shares";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { todayIsoLocal } from "@finance/core/constants";
import { DURATION } from "@finance/core/motion";
import type { RecurringProposal } from "@finance/core/recurring-detection";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import type {
  Category,
  CategoryType,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

import { StaggerItem } from "@/components/motion/Stagger";
import { cn } from "@/lib/cn";
import {
  enableReminders,
  markRemindersAsked,
  remindersAsked,
  syncRecurringReminders,
} from "@/lib/notifications";
import { hapticLight } from "@/lib/haptics";
import { RecurringFormModal } from "@/components/RecurringFormModal";
import { RecurringProposals } from "@/components/RecurringProposals";
import { PrivateAmount } from "@/components/PrivateAmount";
import { WhereItGoes } from "@/components/WhereItGoes";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { ScreenError } from "@/components/ScreenError";
import { Text } from "@/components/ui/Text";
import { useFlag } from "@/hooks/useFlag";
import { useRefreshable } from "@/hooks/useRefreshable";
import { getPropertyNames } from "@/lib/properties";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useQuickAdd } from "@/providers/QuickAddProvider";
import { toggleRecurringActive } from "@/lib/mutations";
import {
  getCategories,
  getRecordedChargeDates,
  getRecurringProposals,
  getRecurringTemplates,
  hasBankFeed,
} from "@/lib/queries";
import { useTabBarClearance } from "@/theme/chrome";
import { useLocale, useT } from "@/providers/LocaleProvider";
import type { Translate } from "@finance/core/i18n/t";

/** Income first, as on the web: it is what the other three are paid from. */
const GROUP_ORDER: CategoryType[] = [
  "income",
  "expense",
  "savings",
  "investment",
];

/**
 * What each of the four kinds of charge is called.
 *
 * A function of the locale, and drawn from the same `allocation.*` messages
 * the flow chart and the caps use, so the four kinds are named identically
 * wherever they appear.
 */
function groupLabels(t: Translate): Record<CategoryType, string> {
  return {
    income: t("allocation.income"),
    expense: t("allocation.expenses"),
    savings: t("allocation.savings"),
    investment: t("allocation.investments"),
  };
}

export default function RecurringScreen() {
  const tabBarClearance = useTabBarClearance();
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const locale = useLocale();
  const t = useT();
  const { toast } = useToast();
  const quickAdd = useQuickAdd();
  const router = useRouter();
  /*
   * `?edit=<id>` opens that charge's editor on arrival — the Ledger's planned
   * rows link here with it. The param is cleared on close, so it opens once
   * per link rather than every time the screen renders.
   */
  const params = useLocalSearchParams<{ edit?: string }>();
  const [chosen, setChosen] = useState<RecurringTemplateWithCategory | null>(
    null,
  );

  const showProperty = useFlag("property.track");
  const { data, loading, refreshing, onRefreshAll, onRefresh, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          templates: [] as RecurringTemplateWithCategory[],
          categories: [] as Category[],
          recorded: new Map<string, string[]>(),
          properties: [] as { id: string; name: string }[],
          proposals: [] as RecurringProposal[],
        };
      }
      const [templates, categories, recorded, properties, bankFed] =
        await Promise.all([
          getRecurringTemplates(user.id),
          getCategories(user.id),
          // Which charges have already been recorded this month, so saving
          // an edit can ask whether those rows change too.
          getRecordedChargeDates(user.id),
          // What a charge can belong to, for an account that keeps
          // properties.
          showProperty ? getPropertyNames(user.id) : Promise.resolve([]),
          hasBankFeed(user.id),
        ]);
      // Only worth asking where there is a statement to read it out of, as
      // on the web. Without one the transactions are the user's own typing,
      // and they already know what repeats.
      const proposals = bankFed
        ? await getRecurringProposals(user.id, todayIsoLocal())
        : [];
      return { templates, categories, recorded, properties, proposals };
    }, [user?.id, showProperty], {
      reads: ["templates", "categories", "transactions", "properties", "bank"],
    });
  const propertyNames = useMemo(
    () => new Map((data?.properties ?? []).map(({ id, name }) => [id, name])),
    [data?.properties],
  );

  // Memoised so a render without new data keeps the same arrays, and the
  // memos and effects below do not re-run for nothing.
  const templates = useMemo(() => data?.templates ?? [], [data?.templates]);
  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);

  const fromLink = params.edit
    ? (templates.find((template) => template.id === params.edit) ?? null)
    : null;
  const editing = chosen ?? fromLink;

  function closeEditor() {
    setChosen(null);
    if (params.edit) {
      router.setParams({ edit: undefined });
    }
  }

  /*
   * The same rollup the web uses, for the same reason: `estimateMonthlyAmount`
   * knows a template's rhythm and its amount and nothing about its category,
   * so this used to sum expenses, savings and investments together under the
   * word "committed" — and would have started adding a salary to that figure
   * the moment income templates became creatable.
   *
   * `committed` is expenses only now, which is what `buildRunway` and the
   * Bearing have always meant by the word. What falls out is said below as
   * what is set aside rather than disappearing off the card.
   */
  const rollup = useMemo(() => rollUpRecurring(templates), [templates]);

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((type) => ({
        type,
        label: groupLabels(t)[type],
        items: templates.filter((t) => t.categories.type === type),
      })),
    [templates, t],
  );

  const defaultTab = useMemo<CategoryType>(
    () => groups.find((group) => group.items.length > 0)?.type ?? "expense",
    [groups],
  );

  // Derived rather than synced through an effect: the tab follows the first
  // non-empty group until the user picks one.
  const [tabOverride, setTabOverride] = useState<CategoryType | null>(null);
  const activeTab = tabOverride ?? defaultTab;

  // Only offer reminders once there is something to be reminded about, so the
  // permission prompt arrives with visible value behind it.
  const [remindersPrompt, setRemindersPrompt] = useState(false);

  useEffect(() => {
    if (templates.length === 0) {
      return;
    }
    let active = true;
    void remindersAsked().then((asked) => {
      if (active && !asked) {
        setRemindersPrompt(true);
      }
    });
    return () => {
      active = false;
    };
  }, [templates.length]);

  // Keep the schedule in step with the templates whenever they change.
  useEffect(() => {
    if (templates.length === 0) {
      return;
    }
    void syncRecurringReminders(templates, formatEuro, locale);
  }, [templates, formatEuro, locale]);

  // The same sheet as every other Add, opened on a charge because this is
  // the screen of them — on a kind's categories when its « + » asked.
  // Editing one still happens in a sheet of its own.
  function openCreate(categoryType?: CategoryType) {
    quickAdd?.open({ kind: "charge", categoryType });
  }

  async function handleEnableReminders() {
    const { granted } = await enableReminders(locale);
    setRemindersPrompt(false);
    if (!granted) {
      toast(t("charges.remindNeedsPermission"), "error");
      return;
    }
    await syncRecurringReminders(templates, formatEuro, locale);
    // This prompt is about the charges on this screen, which are scheduled on
    // the device and work whether or not a server can reach it. Whether it
    // can is Profile's business, where the switch lives.
    toast(t("charges.remindOn"), "success");
  }

  async function handleToggle(item: RecurringTemplateWithCategory) {
    void hapticLight();
    const result = await toggleRecurringActive(item.id, !item.active);
    if (result.error) {
      toast(result.error, "error");
    }
  }

  const activeGroup = groups.find((group) => group.type === activeTab);
  const kindOptions = groups.map(({ type, label, items }) => ({
    value: type,
    label: items.length > 0 ? `${label} · ${items.length}` : label,
  }));

  return (
    <Screen title={t("nav.charges")} className="pb-0">
      {loading && !data ? (
        <ScreenSkeleton rows={5} />
      ) : error ? (
        <ScreenError message={error} onRetry={onRefresh} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-4"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
        >
          {remindersPrompt ? (
            <View className="gap-3 rounded-card border border-border p-4">
              <View className="gap-1">
                <Text className="text-sm font-medium">
                  {t("charges.remindTitle")}
                </Text>
                <Text variant="muted" className="text-xs">
                  {t("charges.remindBody")}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Button
                  label={t("charges.remindYes")}
                  size="sm"
                  onPress={() => {
                    void handleEnableReminders();
                  }}
                />
                <Button
                  label={t("charges.remindNo")}
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    void markRemindersAsked();
                    setRemindersPrompt(false);
                  }}
                />
              </View>
            </View>
          ) : null}

          {templates.length > 0 ? (
            <>
              <StaggerItem index={0}>
                <WhereItGoes rollup={rollup} />
                <Text variant="micro" className="mt-2 px-1">
                  {t("charges.perMonth")}
                  {rollup.deployed > 0 ? (
                    <>
                      {" · "}
                      {t("charges.ofWhichMovedBefore")}{" "}
                      <PrivateAmount className="text-foreground">
                        {formatEuro(rollup.deployed)}
                      </PrivateAmount>{" "}
                      {t("charges.ofWhichMovedAfter")}
                    </>
                  ) : null}
                </Text>
              </StaggerItem>

              {/* One kind at a time, as on the web's phone layout: four lists
                  stacked would be a screen and a half of scrolling to reach
                  the investments, and the four are rarely read together. */}
              <ChipRow
                label={t("charges.kindOfCharge")}
                options={kindOptions}
                value={activeTab}
                onChange={setTabOverride}
              />

              {activeGroup ? (
                <StaggerItem index={1}>
                  <View className="gap-2">
                    <ColumnAdd
                      type={activeGroup.type}
                      label={activeGroup.label}
                      onAdd={openCreate}
                    />
                    <GroupCard
                      type={activeGroup.type}
                      label={activeGroup.label}
                      monthly={rollup.byType[activeGroup.type]}
                      items={activeGroup.items}
                      proposals={(data?.proposals ?? []).filter(
                        (proposal) =>
                          proposal.categoryType === activeGroup.type,
                      )}
                      propertyNames={propertyNames}
                      onEdit={(item) => {
                        void hapticLight();
                        setChosen(item);
                      }}
                      onToggle={(item) => void handleToggle(item)}
                    />
                  </View>
                </StaggerItem>
              ) : null}
            </>
          ) : (
            <EmptyState
              title={t("charges.emptyTitleMobile")}
              description={t("charges.emptyBodyMobile")}
            >
              <Button
                label={t("charges.addCharge")}
                variant="pill"
                icon="add"
                onPress={() => openCreate()}
              />
            </EmptyState>
          )}
        </ScrollView>
      )}

      {editing ? (
        <RecurringFormModal
          open
          onClose={closeEditor}
          categories={categories}
          template={editing}
          recordedThisMonth={data?.recorded.get(editing.id) ?? []}
          properties={data?.properties ?? []}
        />
      ) : null}
    </Screen>
  );
}

/**
 * A kind's way in, above its card, as on the web: a thin card in outline
 * only, that takes shape under the finger — its border drawn, its ground
 * filled, its cross a quarter turned — and opens the Add sheet on a charge
 * of that kind.
 */
function ColumnAdd({
  type,
  label,
  onAdd,
}: {
  type: CategoryType;
  label: string;
  onAdd: (type: CategoryType) => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  const crossStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get() * 90}deg` }],
  }));

  function turnTo(value: number) {
    if (!reduceMotion) {
      turn.set(withTiming(value, { duration: DURATION.hover }));
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("charges.addTo", { group: label })}
      onPressIn={() => turnTo(1)}
      onPressOut={() => turnTo(0)}
      onPress={() => {
        void hapticLight();
        onAdd(type);
      }}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {({ pressed }) => (
        <View
          className={cn(
            "h-11 items-center justify-center rounded-card border",
            pressed ? "bg-card" : "border-dashed",
          )}
          style={{
            borderColor: pressed ? colors.hairlineStrong : colors.border,
          }}
        >
          <Animated.View style={crossStyle}>
            <Ionicons
              name="add"
              size={ICON.md}
              color={pressed ? colors.foreground : colors.mutedForeground}
            />
          </Animated.View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * One kind of recurring entry, with what it adds up to a month. The monthly
 * figure is the rollup's `byType`, the same number the bar above draws, so
 * the two cannot disagree.
 */
function GroupCard({
  type,
  label,
  monthly,
  items,
  proposals,
  propertyNames,
  onEdit,
  onToggle,
}: {
  type: CategoryType;
  label: string;
  monthly: number;
  items: RecurringTemplateWithCategory[];
  /** What the statement implies of this kind, offered above the list. */
  proposals: readonly RecurringProposal[];
  /** Each property's name by id, for a charge that belongs to one. */
  propertyNames: ReadonlyMap<string, string>;
  onEdit: (item: RecurringTemplateWithCategory) => void;
  onToggle: (item: RecurringTemplateWithCategory) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <View className="rounded-card border border-border bg-card px-4 pb-1 pt-4">
      <View className="flex-row items-baseline justify-between gap-3 pb-2">
        <Text className="text-sm font-medium">{label}</Text>
        {monthly > 0 ? (
          <Text className="text-sm">
            <PrivateAmount className={cn("text-sm", TYPE_AMOUNT_CLASS[type])}>
              {formatEuro(monthly)}
            </PrivateAmount>
            <Text variant="muted" className="text-xs">
              {t("charges.perMonthSuffix")}
            </Text>
          </Text>
        ) : null}
      </View>

      <RecurringProposals proposals={proposals} />

      {items.length === 0 ? (
        <Text variant="muted" className="pb-3 text-sm">
          {t("charges.nothingHereYet")}
        </Text>
      ) : (
        items.map((item, index) => {
          const sharesLabel =
            item.pricing_type === "shares" ? formatSharesLabel(item) : null;
          return (
            <View
              key={item.id}
              className={cn(
                "flex-row items-center gap-3 py-3",
                index > 0 && "border-t border-border",
              )}
            >
              <View
                className="min-w-0 flex-1"
                style={item.active ? undefined : { opacity: 0.6 }}
              >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("charges.editNamed", {
                  name: item.categories.name,
                })}
                onPress={() => onEdit(item)}
              >
                <Text className="text-sm font-medium">
                  {item.categories.name}
                </Text>
                {sharesLabel ? (
                  <Text variant="muted" className="mt-0.5 text-xs">
                    {item.instrument_symbol
                      ? `${sharesLabel} · ${item.instrument_symbol}`
                      : sharesLabel}
                  </Text>
                ) : null}
                {isCryptoCategoryName(item.categories.name) ? (
                  <Text variant="muted" className="mt-0.5 text-xs">
                    {t("charges.fixedToBitcoin")}
                  </Text>
                ) : null}
                {item.pricing_type === "purchases" ? (
                  <Text variant="muted" className="mt-0.5 text-xs">
                    {t("recurring.followsPurchasesRow")}
                  </Text>
                ) : null}
                {item.description ? (
                  <Text variant="muted" className="mt-0.5 text-xs">
                    {item.description}
                  </Text>
                ) : null}
                <Text variant="muted" className="mt-1 text-xs">
                  {formatRecurrenceSchedule(item, locale)}
                </Text>
              </Pressable>
              {/* Its own press, beside the row's: the property it belongs to. */}
              {item.property_id && propertyNames.has(item.property_id) ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push(`/property/${item.property_id}`)}
                  hitSlop={8}
                  className="mt-1 flex-row items-center gap-1 self-start"
                >
                  <Ionicons
                    name="home-outline"
                    size={ICON.xs}
                    color={colors.mutedForeground}
                  />
                  <Text variant="muted" numberOfLines={1} className="text-xs underline">
                    {propertyNames.get(item.property_id)}
                  </Text>
                </Pressable>
              ) : null}
              </View>

              <View className="shrink-0 items-end gap-1.5">
                {/* Coloured by kind of money, as the ledger's amounts are. */}
                <PrivateAmount
                  className={cn(
                    "text-sm font-semibold",
                    TYPE_AMOUNT_CLASS[item.categories.type],
                  )}
                  style={item.active ? undefined : { opacity: 0.6 }}
                >
                  {`${item.pricing_type === "shares" ? "≈" : ""}${formatEuro(Number(item.amount))}`}
                </PrivateAmount>
                {/* Running is the ordinary case and says nothing; a pause is
                    the exception, and the only state worth a word. The
                    quiet button is still there to pause one. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.active }}
                  accessibilityLabel={t("charges.toggleFor", {
                    action: item.active
                      ? t("charges.deactivate")
                      : t("charges.activate"),
                    name: item.categories.name,
                  })}
                  hitSlop={8}
                  onPress={() => onToggle(item)}
                >
                  {item.active ? (
                    <Ionicons
                      name="pause-circle-outline"
                      size={ICON.md}
                      color={colors.mutedForeground}
                    />
                  ) : (
                    <Badge
                      label={t("recurring.off")}
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                    />
                  )}
                </Pressable>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
