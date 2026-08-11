import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from "react-native";

import { formatEuro } from "@finance/core/constants";
import {
  estimateMonthlyAmount,
  formatRecurrenceSchedule,
} from "@finance/core/recurrence";
import type {
  Category,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

import { RecurringFormModal } from "@/components/RecurringFormModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { useAuth } from "@/providers/AuthProvider";
import { toggleRecurringActive } from "@/lib/mutations";
import { getCategories, getRecurringTemplates } from "@/lib/queries";

export default function RecurringScreen() {
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTemplateWithCategory | null>(
    null,
  );

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

  const budgetMonthly = useMemo(
    () =>
      templates
        .filter((t) => t.active && t.categories.counts_toward_summary !== false)
        .reduce((sum, t) => sum + estimateMonthlyAmount(t), 0),
    [templates],
  );

  return (
    <Screen title="Recurring">
      {templates.length > 0 ? (
        <Card className="mb-3 flex-row items-center justify-between p-4">
          <Text className="font-bold">Expected budget impact</Text>
          <Text className="text-lg font-bold tabular-nums">
            {formatEuro(budgetMonthly)}
          </Text>
        </Card>
      ) : null}

      <Button
        label="Add recurring item"
        className="mb-3"
        onPress={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      />

      {loading && !data ? (
        <ActivityIndicator />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No recurring items"
              description="Set up salary, rent, DCA contributions, and other monthly flows."
            />
          }
          contentContainerClassName="gap-2 pb-8"
          renderItem={({ item }) => (
            <Card className={`p-3 ${item.active ? "" : "opacity-60"}`}>
              <Pressable
                onPress={() => {
                  setEditing(item);
                  setFormOpen(true);
                }}
              >
                <Text className="font-semibold">{item.categories.name}</Text>
                {item.description ? (
                  <Text variant="muted">{item.description}</Text>
                ) : null}
                <Text variant="muted">{formatRecurrenceSchedule(item)}</Text>
              </Pressable>
              <View className="mt-2 flex-row items-center justify-between border-t border-border pt-2">
                <Text className="font-bold tabular-nums">
                  {formatEuro(Number(item.amount))}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.active }}
                  onPress={async () => {
                    await toggleRecurringActive(item.id, !item.active);
                    await reload();
                  }}
                  className={`border px-3 py-1 ${
                    item.active
                      ? "border-foreground bg-primary"
                      : "border-border"
                  }`}
                >
                  <Text className="text-xs font-semibold">
                    {item.active ? "On" : "Off"}
                  </Text>
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
          onSaved={reload}
          categories={categories}
          template={editing}
        />
      ) : null}
    </Screen>
  );
}
