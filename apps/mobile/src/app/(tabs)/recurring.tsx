import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
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

import { cn } from "@/lib/cn";
import { RecurringFormModal } from "@/components/RecurringFormModal";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
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

  return (
    <Screen title="Recurring">
      {applyPending ? (
        <Pressable
          onPress={() => router.push("/(tabs)/transactions" as Href)}
          className="mb-3"
        >
          <Text variant="muted" className="text-center text-sm">
            Recurring changes need apply. Open Transactions and tap Apply
            recurring.
          </Text>
        </Pressable>
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
        <ActivityIndicator />
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
              title="No recurring items"
              description="Set up rent, DCA contributions, and other repeating flows."
            />
          }
          contentContainerClassName="gap-2 pb-6"
          renderItem={({ item }) => (
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
