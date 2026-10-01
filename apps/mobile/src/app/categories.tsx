import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { categoryTypeLabels } from "@finance/core/category-styles";
import { groupCategoriesByType } from "@finance/core/categories";
import type { Category, CategoryType } from "@finance/core/types/database";
import type { Key } from "@finance/core/i18n/t";

import { CategoryFormSheet } from "@/components/CategoryFormSheet";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Badge } from "@/components/ui/Badge";
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
import { ICON } from "@/theme/tokens";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";

/**
 * What a category that does not count is, by its kind — the web's badge.
 * Income that does not count is money coming back, savings that do not count
 * is money coming out, an investment that does not count is only tracked.
 */
function notCountingKey(category: {
  type: CategoryType;
  counts_toward_summary: boolean;
}): Key | null {
  if (category.counts_toward_summary !== false) {
    return null;
  }
  switch (category.type) {
    case "investment":
      return "categories.notCountingInvestment";
    case "savings":
      return "categories.notCountingSavings";
    case "income":
      return "categories.notCountingIncome";
    default:
      return "categories.excludedFromTotals";
  }
}

/**
 * Category management. Mirrors the web categories page: a sentence on what
 * categories are for, one Add, then each kind with its rows — a badge for a
 * category that does not count or is archived, and the three actions on the
 * row itself rather than behind a long press nobody would find.
 */
export default function CategoriesScreen() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [confirming, setConfirming] = useState<Category | null>(null);

  const { data, loading, refreshing, onRefresh, onRefreshAll, error } =
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
  const groups = groupCategoriesByType(categories, { locale });

  async function toggleArchived(category: Category) {
    const result = await setCategoryArchived(category.id, !category.archived);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(
      category.archived
        ? t("categories.restoredToast")
        : t("categories.archivedToast"),
    );
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
    toast(t("categories.deleted"));
    await onRefresh();
  }

  return (
    <Screen
      title={t("pages.categories")}
      headerActions={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("categories.back")}
          hitSlop={8}
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-control"
        >
          <Ionicons
            name="chevron-back"
            size={ICON.xl}
            color={colors.foreground}
          />
        </Pressable>
      }
      showLogo={false}
    >
      {loading && categories.length === 0 ? (
        <ScreenSkeleton rows={6} />
      ) : error ? (
        <Text className="text-destructive">{resolveMessage(t, error)}</Text>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-4 pb-28"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="muted" className="text-sm">
            {t("categories.blurb")}
          </Text>
          <Button
            label={t("categories.addCategory")}
            variant="pill"
            size="lg"
            icon="add"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />

          {categories.length === 0 ? (
            <EmptyState
              title={t("categories.emptyTitle")}
              description={t("categories.emptyBody")}
            >
              <Button
                label={t("categories.newCategory")}
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
                <Text variant="label" className="mb-2 tracking-wide">
                  {categoryTypeLabels(locale)[group.type]}
                </Text>
                <Card bezel innerClassName="px-2 py-1">
                  {group.categories.map((category, index) => {
                    const notCounting = notCountingKey(category);
                    return (
                      <View
                        key={category.id}
                        className={cn(
                          "min-h-16 flex-row items-center gap-3 px-2 py-3",
                          index > 0 && "border-t border-border",
                        )}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("categories.editNamed", {
                            name: category.name,
                          })}
                          onPress={() => {
                            void hapticLight();
                            setEditing(category);
                            setFormOpen(true);
                          }}
                          className="min-w-0 flex-1 flex-row items-center gap-3"
                          style={
                            category.archived ? { opacity: 0.6 } : undefined
                          }
                        >
                          <CategoryIcon icon={category.icon} />
                          <View className="min-w-0 flex-1 gap-1">
                            <Text
                              numberOfLines={1}
                              className="text-sm font-medium"
                            >
                              {category.name}
                            </Text>
                            {notCounting || category.archived ? (
                              <View className="flex-row flex-wrap gap-1.5">
                                {notCounting ? (
                                  <Badge
                                    label={t(notCounting)}
                                    size="sm"
                                    variant="outline"
                                  />
                                ) : null}
                                {category.archived ? (
                                  <Badge
                                    label={t("categories.archived")}
                                    size="sm"
                                    variant="outline"
                                  />
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        </Pressable>
                        <View className="shrink-0 flex-row items-center gap-1.5">
                          <RowAction
                            icon="pencil-outline"
                            label={t("categories.editNamed", {
                              name: category.name,
                            })}
                            onPress={() => {
                              void hapticLight();
                              setEditing(category);
                              setFormOpen(true);
                            }}
                          />
                          <RowAction
                            icon={
                              category.archived
                                ? "arrow-undo-outline"
                                : "archive-outline"
                            }
                            label={
                              category.archived
                                ? t("categories.restoreNamed", {
                                    name: category.name,
                                  })
                                : t("categories.archiveNamed", {
                                    name: category.name,
                                  })
                            }
                            onPress={() => {
                              void toggleArchived(category);
                            }}
                          />
                          <RowAction
                            icon="trash-outline"
                            label={t("categories.deleteNamed", {
                              name: category.name,
                            })}
                            onPress={() => {
                              void hapticLight();
                              setConfirming(category);
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </StaggerItem>
            ))
          )}
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
        title={
          confirming
            ? t("categories.deleteNamed", { name: confirming.name })
            : ""
        }
        message={t("categories.deleteWarning")}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}

/** One of the three round actions at the end of a row, as on the web. */
function RowAction({
  icon,
  label,
  onPress,
}: {
  icon:
    | "pencil-outline"
    | "archive-outline"
    | "arrow-undo-outline"
    | "trash-outline";
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full border border-border"
    >
      <Ionicons name={icon} size={ICON.md} color={colors.foreground} />
    </Pressable>
  );
}
