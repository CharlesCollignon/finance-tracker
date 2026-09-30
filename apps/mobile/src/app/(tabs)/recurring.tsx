import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { isCryptoCategoryName } from "@finance/core/crypto-holdings";
import { formatRecurrenceSchedule } from "@finance/core/recurrence";
import { rollUpRecurring } from "@finance/core/recurring-rollup";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import { TYPE } from "@/theme/tokens";
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
import { PrivateAmount } from "@/components/PrivateAmount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useQuickAdd } from "@/providers/QuickAddProvider";
import { toggleRecurringActive } from "@/lib/mutations";
import {
  getCategories,
  getRecordedChargeDates,
  getRecurringTemplates,
} from "@/lib/queries";
import { useTabBarClearance } from "@/theme/chrome";
import { useLocale, useT } from "@/providers/LocaleProvider";
import type { Translate } from "@finance/core/i18n/t";
import { resolveMessage } from "@finance/core/i18n/t";

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

/** One scoreboard tile: a word, a figure, and nothing else. */
function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="flex-1 gap-2">
      <Text variant="label">{label}</Text>
      {children}
    </Card>
  );
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

  const dataVersion = useDataVersion();
  const { data, loading, refreshing, onRefreshAll, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          templates: [] as RecurringTemplateWithCategory[],
          categories: [] as Category[],
          recorded: new Map<string, string[]>(),
        };
      }
      const [templates, categories, recorded] = await Promise.all([
        getRecurringTemplates(user.id),
        getCategories(user.id),
        // Which charges have already been recorded this month, so saving an
        // edit can ask whether those rows change too.
        getRecordedChargeDates(user.id),
      ]);
      return { templates, categories, recorded };
    }, [user?.id, dataVersion]);

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
   *
   * The three-across header the web now draws is deliberately not copied
   * here: three figures at this type size do not fit a phone's column, and
   * the point of this change is that the two clients agree about the
   * numbers, not that they agree about the layout.
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

  const activeItems =
    groups.find((group) => group.type === activeTab)?.items ?? [];

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
    void syncRecurringReminders(templates, formatEuro);
  }, [templates, formatEuro]);

  // The same sheet as every other Add, opened on a charge because this is
  // the screen of them. Editing one still happens in a sheet of its own.
  function openCreate() {
    quickAdd?.open({ kind: "charge" });
  }

  async function handleEnableReminders() {
    const { granted } = await enableReminders();
    setRemindersPrompt(false);
    if (!granted) {
      toast(t("charges.remindNeedsPermission"), "error");
      return;
    }
    await syncRecurringReminders(templates, formatEuro);
    // This prompt is about the charges on this screen, which are scheduled on
    // the device and work whether or not a server can reach it. Whether it
    // can is Profile's business, where the switch lives.
    toast(t("charges.remindOn"), "success");
  }

  return (
    <Screen title={t("nav.charges")}>
      {remindersPrompt ? (
        <Card bezel className="mb-4" innerClassName="gap-3 p-5">
          <Text className="text-sm font-medium">
            {t("charges.remindTitle")}
          </Text>
          <Text variant="muted" className="text-sm">
            {t("charges.remindBody")}
          </Text>
          <View className="flex-row gap-2">
            <Button
              label={t("charges.remindYes")}
              size="sm"
              className="flex-1"
              onPress={() => {
                void handleEnableReminders();
              }}
            />
            <Button
              label={t("charges.remindNo")}
              variant="ghost"
              size="sm"
              className="flex-1"
              onPress={() => {
                void markRemindersAsked();
                setRemindersPrompt(false);
              }}
            />
          </View>
        </Card>
      ) : null}

      {templates.length > 0 ? (
        /* The same four figures the web draws, two by two because a phone's
           column will not take four across. Every term of the sum is on
           screen: income, less what is committed, less everything put by,
           leaves what the month leaves in the account.

           Two rows of two rather than a wrapping row — React Native has no
           grid, and `flex-1` in a pair is the layout that does not depend on
           guessing a percentage width against the gap. */
        <View className="mb-4 gap-3">
          <View className="flex-row gap-3">
            <Tile label={t("charges.tileIncome")}>
              {rollup.income > 0 ? (
                <PrivateAmount style={TYPE.figure}>
                  {formatEuro(rollup.income)}
                </PrivateAmount>
              ) : (
                // Not a zero: nothing is measured here yet, and a figure in
                // this face would say otherwise.
                <Text variant="muted" className="text-sm">
                  {t("charges.noIncomeYet")}
                </Text>
              )}
            </Tile>
            <Tile label={t("charges.tileCommitted")}>
              <PrivateAmount style={TYPE.figure}>
                {formatEuro(rollup.committed)}
              </PrivateAmount>
            </Tile>
          </View>

          <View className="flex-row gap-3">
            <Tile label={t("charges.tileSetAside")}>
              <PrivateAmount style={TYPE.figure}>
                {formatEuro(rollup.setAside + rollup.deployed)}
              </PrivateAmount>
            </Tile>
            <Tile label={t("charges.tileLeft")}>
              <PrivateAmount style={TYPE.figure}>
                {formatEuro(rollup.left)}
              </PrivateAmount>
            </Tile>
          </View>

          <Text variant="micro" className="px-1">
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
        </View>
      ) : null}

      <Button
        label={t("charges.addCharge")}
        variant="pill"
        icon="add"
        className="mb-4 self-center"
        onPress={openCreate}
      />

      <View className="mb-4 flex-row flex-wrap justify-center gap-2">
        {groups.map(({ type, label, items }) => {
          const selected = activeTab === type;
          return (
            <Pressable
              hitSlop={8}
              key={type}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setTabOverride(type)}
              className={cn(
                "rounded-full border px-4 py-1.5",
                selected
                  ? "border-foreground bg-foreground"
                  : "border-border bg-background",
              )}
            >
              <Text
                className={cn(
                  "text-sm font-semibold",
                  selected ? "text-background" : "text-muted-foreground",
                )}
              >
                {`${label}${items.length > 0 ? ` · ${items.length}` : ""}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !data ? (
        <ScreenSkeleton rows={5} />
      ) : error ? (
        <Text className="text-destructive">{resolveMessage(t, error)}</Text>
      ) : (
        <FlatList
          data={activeItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          ListEmptyComponent={
            <EmptyState
              title={t("charges.emptyTitleMobile")}
              description={t("charges.emptyBodyMobile")}
            >
              <Button
                label={t("recurring.addTitleMobile")}
                variant="pill"
                icon="add"
                onPress={openCreate}
              />
            </EmptyState>
          }
          contentContainerClassName="gap-4"
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
          renderItem={({ item, index }) => (
            <StaggerItem index={index}>
              <Card
                bezel
                className={item.active ? "" : "opacity-60"}
                /* The one card off the 20 padding: these are list rows,
                   and a row that tall stops the list being scannable. */
                innerClassName="flex-row items-start gap-3 p-3"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("charges.editNamed", {
                    name: item.categories.name,
                  })}
                  className="min-w-0 flex-1"
                  onPress={() => {
                    void hapticLight();
                    setChosen(item);
                  }}
                >
                  <Text className="text-sm font-medium">
                    {item.categories.name}
                  </Text>
                  {isCryptoCategoryName(item.categories.name) ? (
                    <Text variant="muted" className="mt-0.5 text-xs">
                      {t("charges.fixedToBitcoin")}
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

                <View className="shrink-0 items-end gap-2">
                  {/* Coloured by kind of money, as the ledger's amounts are. */}
                  <PrivateAmount
                    className={cn(
                      "font-mono text-sm font-semibold",
                      TYPE_AMOUNT_CLASS[item.categories.type],
                    )}
                  >
                    {`${item.pricing_type === "shares" ? "≈" : ""}${formatEuro(Number(item.amount))}`}
                  </PrivateAmount>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.active }}
                    accessibilityLabel={t("charges.toggleFor", {
                      action: item.active
                        ? t("charges.deactivate")
                        : t("charges.activate"),
                      name: item.categories.name,
                    })}
                    onPress={async () => {
                      const result = await toggleRecurringActive(
                        item.id,
                        !item.active,
                      );
                      if (result.error) {
                        toast(result.error, "error");
                        return;
                      }
                      // Every screen, not just this one: switching a charge
                      // on writes this month's rows, and off removes the
                      // ones still ahead.
                      notifyDataChanged();
                    }}
                  >
                    <Badge
                      label={t(item.active ? "recurring.on" : "recurring.off")}
                      size="sm"
                      variant={item.active ? "surface" : "outline"}
                      className="rounded-full"
                    />
                  </Pressable>
                </View>
              </Card>
            </StaggerItem>
          )}
        />
      )}

      {editing ? (
        <RecurringFormModal
          open
          onClose={closeEditor}
          // Every screen: a saved charge moves the ledger's rows with it.
          onSaved={notifyDataChanged}
          categories={categories}
          template={editing}
          recordedThisMonth={data?.recorded.get(editing.id) ?? []}
        />
      ) : null}
    </Screen>
  );
}
