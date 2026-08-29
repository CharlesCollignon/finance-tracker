import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { type Href, useRouter } from "expo-router";

import { parseMonthParams } from "@finance/core/constants";
import { applyRecurringPlanCounts } from "@finance/core/apply-recurring";
import { isCryptoCategoryName } from "@finance/core/crypto-holdings";
import {
  estimateMonthlyAmount,
  formatRecurrenceSchedule,
} from "@finance/core/recurrence";
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
import { StatHero } from "@/components/StatHero";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import {
  previewApplyRecurringForMonth,
  toggleRecurringActive,
} from "@/lib/mutations";
import { getCategories, getRecurringTemplates } from "@/lib/queries";

/** Recurring only covers allocations; income has no recurring template. */
type AllocType = Exclude<CategoryType, "income">;

const GROUP_ORDER: AllocType[] = ["expense", "savings", "investment"];

const GROUP_LABELS: Record<AllocType, string> = {
  expense: "Expenses",
  savings: "Savings",
  investment: "Investments",
};

export default function RecurringScreen() {
  const { user } = useAuth();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTemplateWithCategory | null>(
    null,
  );
  const [applyPending, setApplyPending] = useState(false);
  const { year, month } = parseMonthParams();

  const { data, loading, refreshing, onRefresh, reload, error } =
    useRefreshable(async () => {
      if (!user) {
        return {
          templates: [] as RecurringTemplateWithCategory[],
          categories: [] as Category[],
        };
      }
      const [templates, categories] = await Promise.all([
        getRecurringTemplates(user.id),
        getCategories(user.id),
      ]);
      return { templates, categories };
    }, [user?.id]);

  const templates = data?.templates ?? [];
  const categories = data?.categories ?? [];

  const refreshApplyPending = useCallback(async () => {
    const result = await previewApplyRecurringForMonth(year, month);
    if (result.error || !result.plan) {
      return;
    }
    const counts = applyRecurringPlanCounts(result.plan);
    setApplyPending(counts.creates + counts.updates > 0);
  }, [month, year]);

  useEffect(() => {
    void refreshApplyPending();
  }, [refreshApplyPending, templates]);

  const budgetMonthly = useMemo(
    () =>
      templates
        .filter((t) => t.active && t.categories.counts_toward_summary !== false)
        .reduce((sum, t) => sum + estimateMonthlyAmount(t), 0),
    [templates],
  );

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((type) => ({
        type,
        label: GROUP_LABELS[type],
        items: templates.filter((t) => t.categories.type === type),
      })),
    [templates],
  );

  const defaultTab = useMemo<AllocType>(
    () => groups.find((group) => group.items.length > 0)?.type ?? "expense",
    [groups],
  );

  // Derived rather than synced through an effect: the tab follows the first
  // non-empty group until the user picks one.
  const [tabOverride, setTabOverride] = useState<AllocType | null>(null);
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

  async function handleEnableReminders() {
    const granted = await enableReminders();
    setRemindersPrompt(false);
    if (!granted) {
      toast("Reminders need notification permission", "error");
      return;
    }
    await syncRecurringReminders(templates, formatEuro);
    toast("Reminders on — you'll hear the evening before", "success");
  }

  return (
    <Screen title="Recurring">
      {applyPending ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open Transactions to apply recurring changes"
          onPress={() => router.push("/(tabs)/transactions" as Href)}
          className="mb-3"
        >
          <Text variant="muted" className="text-center text-sm">
            Recurring changes need apply. Open Transactions and tap Apply
            recurring.
          </Text>
        </Pressable>
      ) : null}

      {remindersPrompt ? (
        <Card bezel className="mb-4" innerClassName="gap-3 p-4">
          <Text className="text-sm font-medium">
            Want a nudge before these post?
          </Text>
          <Text variant="muted" className="text-sm">
            One reminder the evening before each item is due, so nothing lands
            unnoticed. Entirely on your device.
          </Text>
          <View className="flex-row gap-2">
            <Button
              label="Remind me"
              size="sm"
              className="flex-1"
              onPress={() => {
                void handleEnableReminders();
              }}
            />
            <Button
              label="No thanks"
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
        <Card bezel className="my-5" innerClassName="p-6">
          <StatHero
            label="Expected budget impact"
            amount={formatEuro(budgetMonthly)}
          />
        </Card>
      ) : null}

      <Button
        label="Add recurring item"
        variant="pill"
        icon="add"
        className="mb-4 self-center"
        onPress={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      />

      <View className="mb-4 flex-row flex-wrap justify-center gap-2">
        {groups.map(({ type, label, items }) => {
          const selected = activeTab === type;
          return (
            <Pressable
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
        <Text className="text-destructive">{error}</Text>
      ) : (
        <FlatList
          data={activeItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No recurring items yet"
              description="Rent, salary, subscriptions, DCA contributions — anything that repeats. Add them once and Pluclair fills each month for you."
            >
              <Button
                label="Add recurring item"
                variant="pill"
                icon="add"
                onPress={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              />
            </EmptyState>
          }
          contentContainerClassName="gap-4 pb-28"
          renderItem={({ item, index }) => (
            <StaggerItem index={index}>
              <Card
                bezel
                className={item.active ? "" : "opacity-60"}
                innerClassName="flex-row items-start gap-3 p-3"
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.categories.name}`}
                  className="min-w-0 flex-1"
                  onPress={() => {
                    void hapticLight();
                    setEditing(item);
                    setFormOpen(true);
                  }}
                >
                  <Text className="text-sm font-medium">
                    {item.categories.name}
                  </Text>
                  {isCryptoCategoryName(item.categories.name) ? (
                    <Text variant="muted" className="mt-0.5 text-xs">
                      Fixed EUR → Bitcoin
                    </Text>
                  ) : null}
                  {item.description ? (
                    <Text variant="muted" className="mt-0.5 text-xs">
                      {item.description}
                    </Text>
                  ) : null}
                  <Text variant="muted" className="mt-1 text-xs">
                    {formatRecurrenceSchedule(item)}
                  </Text>
                </Pressable>

                <View className="shrink-0 items-end gap-2">
                  <PrivateAmount className="font-mono text-sm font-semibold">
                    {`${item.pricing_type === "shares" ? "≈" : ""}${formatEuro(Number(item.amount))}`}
                  </PrivateAmount>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.active }}
                    accessibilityLabel={`${item.active ? "Deactivate" : "Activate"} ${item.categories.name}`}
                    onPress={async () => {
                      const result = await toggleRecurringActive(
                        item.id,
                        !item.active,
                      );
                      if (result.error) {
                        toast(result.error, "error");
                        return;
                      }
                      await reload();
                      await refreshApplyPending();
                    }}
                  >
                    <Badge
                      label={item.active ? "On" : "Off"}
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

      {formOpen ? (
        <RecurringFormModal
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await reload();
            await refreshApplyPending();
          }}
          categories={categories}
          template={editing}
        />
      ) : null}
    </Screen>
  );
}
