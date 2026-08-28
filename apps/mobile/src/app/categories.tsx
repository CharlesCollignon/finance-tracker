import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { CATEGORY_TYPE_LABELS } from "@finance/core/category-styles";
import { groupCategoriesByType } from "@finance/core/categories";
import type { Category } from "@finance/core/types/database";

import { CategoryFormSheet } from "@/components/CategoryFormSheet";
import { CategoryIcon } from "@/components/CategoryIcon";
import { StaggerItem } from "@/components/motion/Stagger";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { deleteCategory, setCategoryArchived } from "@/lib/mutations";
import { getCategories } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Category management — the one thing mobile could not do at all. Mirrors the
 * web categories page: create, rename, re-icon, archive and delete.
 */
export default function CategoriesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [confirming, setConfirming] = useState<Category | null>(null);

  const { data, loading, refreshing, onRefresh, error } =
    useRefreshable(async () => {
      if (!user) {
        return { categories: [] as Category[] };
      }
      const categories = await getCategories(user.id, {
        includeArchived: true,
      });
      return { categories };
    }, [user?.id]);

  const categories = data?.categories ?? [];
  const groups = groupCategoriesByType(categories);

  async function toggleArchived(category: Category) {
    const result = await setCategoryArchived(category.id, !category.archived);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(category.archived ? "Restored" : "Archived");
    await onRefresh();
  }

  async function handleDelete() {
    if (!confirming) {
      return;
    }
    const result = await deleteCategory(confirming.id);
    setConfirming(null);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast("Category deleted");
    await onRefresh();
  }

  return (
    <Screen
      title="Categories"
      headerActions={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-md"
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
      }
      showLogo={false}
    >
      {loading && categories.length === 0 ? (
        <ScreenSkeleton rows={6} />
      ) : error ? (
        <Text className="text-destructive">{error}</Text>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerClassName="gap-4 pb-6"
          showsVerticalScrollIndicator={false}
        >
          <Button
            label="New category"
            variant="pill"
            icon="add"
            className="self-center"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />

          {categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Categories group your transactions into income, spending, savings and investments."
            >
              <Button
                label="New category"
                variant="pill"
                icon="add"
                onPress={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              />
            </EmptyState>
          ) : (
            groups.map((group, groupIndex) => (
              <StaggerItem key={group.type} index={groupIndex}>
                <Text className="mb-2 text-base">
                  {CATEGORY_TYPE_LABELS[group.type]}
                </Text>
                <Card bezel innerClassName="px-2 py-1">
                  {group.categories.map((category, index) => (
                    <Pressable
                      key={category.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${category.name}`}
                      onPress={() => {
                        void hapticLight();
                        setEditing(category);
                        setFormOpen(true);
                      }}
                      onLongPress={() => setConfirming(category)}
                      className={cn(
                        "min-h-14 flex-row items-center gap-3 px-2 py-3",
                        index > 0 && "border-t border-border",
                        category.archived && "opacity-50",
                      )}
                    >
                      <CategoryIcon icon={category.icon} />
                      <View className="min-w-0 flex-1">
                        <Text numberOfLines={1} className="text-sm font-medium">
                          {category.name}
                        </Text>
                        {!category.counts_toward_summary ? (
                          <Text variant="muted" className="text-xs">
                            Excluded from totals
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          category.archived
                            ? `Restore ${category.name}`
                            : `Archive ${category.name}`
                        }
                        hitSlop={8}
                        onPress={() => {
                          void toggleArchived(category);
                        }}
                        className="h-11 w-11 items-center justify-center"
                      >
                        <Ionicons
                          name={
                            category.archived
                              ? "arrow-undo-outline"
                              : "archive-outline"
                          }
                          size={16}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                    </Pressable>
                  ))}
                </Card>
              </StaggerItem>
            ))
          )}

          <Text variant="muted" className="text-center text-xs">
            Tap to edit · long-press to delete
          </Text>
        </ScrollView>
      )}

      {formOpen ? (
        <CategoryFormSheet
          open={formOpen}
          category={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={onRefresh}
        />
      ) : null}

      <ConfirmSheet
        open={confirming !== null}
        title={`Delete ${confirming?.name ?? "category"}?`}
        message="If it is used by transactions or recurring items, archive it instead."
        onConfirm={handleDelete}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}
