import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import type { FilingDirection, FilingRule } from "@finance/core/filing-rules";
import type { Category } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { ScreenError } from "@/components/ScreenError";
import { FadeIn } from "@/components/motion/FadeIn";
import { CategoryPicker } from "@/components/pickers/CategoryPicker";
import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  addFilingRule,
  deleteFilingRule,
  updateFilingRule,
} from "@/lib/mutations";
import { getCategories, getFilingRules } from "@/lib/queries";
import { useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** What the form holds: a rule being written, or one being changed. */
interface Draft {
  id: string | null;
  words: string;
  categoryId: string;
  direction: FilingDirection;
}

const NEW_DRAFT: Draft = { id: null, words: "", categoryId: "", direction: "out" };

/**
 * « Règles de rangement »: the rules a person wrote for filing a line
 * (migration 077) — the web's screen. The words they decided, where they
 * go, and how many lines each answered for; written here or from the
 * review's « Toujours ranger ici », changed or deleted here.
 */
export default function RulesScreen() {
  const t = useT();
  const { ownerId } = useOwner();
  const router = useRouter();
  const colors = useThemeColors();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<FilingRule | null>(null);

  const { data, loading, refreshing, onRefreshAll, onRefresh, error } =
    useRefreshable(
      async () => {
        if (!ownerId) {
          return { rules: [] as FilingRule[], categories: [] as Category[] };
        }
        const [rules, categories] = await Promise.all([
          getFilingRules(ownerId),
          getCategories(ownerId),
        ]);
        return { rules, categories };
      },
      [ownerId],
      { reads: ["categories", "preferences", "bank"] },
    );

  const rules = data?.rules ?? [];
  const categories = data?.categories ?? [];
  const byId = new Map(categories.map((category) => [category.id, category]));

  async function save(current: Draft) {
    setSaving(true);
    const input = {
      words: current.words,
      categoryId: current.categoryId,
      direction: current.direction,
    };
    const result = current.id
      ? await updateFilingRule(current.id, input)
      : await addFilingRule(input);
    setSaving(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    void hapticSuccess();
    toast(t(current.id ? "rules.saved" : "rules.added"));
    setDraft(null);
    onRefresh();
  }

  async function remove() {
    if (!confirming) {
      return;
    }
    const result = await deleteFilingRule(confirming.id);
    setConfirming(null);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    void hapticWarning();
    toast(t("rules.deleted"));
    onRefresh();
  }

  return (
    <Screen
      title={t("rules.title")}
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
      {loading && !data ? (
        <ScreenSkeleton rows={4} />
      ) : error ? (
        <ScreenError message={error} onRetry={onRefresh} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />
          }
          contentContainerClassName="gap-4 pb-28"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="muted" className="text-sm">
            {t("rules.intro")}
          </Text>

          {draft ? (
            <FadeIn>
              <Card className="gap-4">
                <Text className="text-sm font-medium">
                  {draft.id ? t("rules.edit") : t("rules.add")}
                </Text>
                <View className="gap-2">
                  <Text variant="label">{t("rules.words")}</Text>
                  <Input
                    value={draft.words}
                    placeholder={t("rules.wordsPlaceholder")}
                    maxLength={80}
                    autoFocus
                    autoCapitalize="none"
                    onChangeText={(words) => setDraft({ ...draft, words })}
                  />
                </View>
                <View className="gap-2">
                  <Text variant="label">{t("rules.direction")}</Text>
                  <ChoiceChips<FilingDirection>
                    label={t("rules.direction")}
                    fill
                    options={[
                      { value: "out", label: t("rules.directionOut") },
                      { value: "in", label: t("rules.directionIn") },
                    ]}
                    value={draft.direction}
                    onChange={(direction) => setDraft({ ...draft, direction })}
                  />
                </View>
                <CategoryPicker
                  label={t("rules.category")}
                  categories={categories}
                  value={draft.categoryId}
                  onChange={(categoryId) => setDraft({ ...draft, categoryId })}
                />
                <View className="flex-row items-center gap-2">
                  <Button
                    label={
                      saving
                        ? draft.id
                          ? t("rules.saving")
                          : t("rules.adding")
                        : draft.id
                          ? t("rules.save")
                          : t("rules.add")
                    }
                    className="flex-1"
                    disabled={
                      saving ||
                      draft.words.trim().length < 2 ||
                      !draft.categoryId
                    }
                    onPress={() => void save(draft)}
                  />
                  <Button
                    label={t("common.cancel")}
                    variant="ghost"
                    onPress={() => setDraft(null)}
                  />
                </View>
              </Card>
            </FadeIn>
          ) : (
            <Button
              label={t("rules.add")}
              variant="pill"
              size="lg"
              icon="add"
              onPress={() => {
                void hapticLight();
                setDraft(NEW_DRAFT);
              }}
            />
          )}

          {rules.length === 0 ? (
            <EmptyState
              title={t("rules.empty")}
              description={t("rules.emptyBody")}
            />
          ) : (
            <FadeIn>
              <Card bezel innerClassName="px-2 py-1">
                {rules.map((rule, index) => {
                  const category = byId.get(rule.categoryId);
                  return (
                    <View
                      key={rule.id}
                      className={cn(
                        "min-h-16 flex-row items-center gap-3 px-2 py-3",
                        index > 0 && "border-t border-border",
                      )}
                    >
                      <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <Ionicons
                          name="funnel-outline"
                          size={ICON.md}
                          color={colors.foreground}
                        />
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("rules.editNamed", {
                          words: rule.words,
                        })}
                        onPress={() => {
                          void hapticLight();
                          setDraft({
                            id: rule.id,
                            words: rule.words,
                            categoryId: rule.categoryId,
                            direction: rule.direction,
                          });
                        }}
                        className="min-w-0 flex-1"
                      >
                        <Text className="text-sm font-medium">
                          {`« ${rule.words} »`}
                          <Text variant="muted" className="text-sm">
                            {` → ${rule.categoryName}`}
                          </Text>
                        </Text>
                        <Text variant="muted" className="text-xs">
                          {[
                            rule.direction === "in"
                              ? t("rules.directionIn")
                              : t("rules.directionOut"),
                            rule.appliedCount > 0
                              ? t("rules.applied", { count: rule.appliedCount })
                              : t("rules.appliedNone"),
                            rule.createdFrom
                              ? t("rules.from", { line: rule.createdFrom })
                              : null,
                          ]
                            .filter((part): part is string => part !== null)
                            .join(" · ")}
                        </Text>
                      </Pressable>
                      {category ? <CategoryIcon icon={category.icon} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("rules.deleteNamed", {
                          words: rule.words,
                        })}
                        onPress={() => setConfirming(rule)}
                        className="h-11 w-11 items-center justify-center rounded-full border border-border"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={ICON.md}
                          color={colors.foreground}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </Card>
            </FadeIn>
          )}
        </ScrollView>
      )}

      <ConfirmSheet
        open={confirming !== null}
        title={
          confirming ? t("rules.deleteNamed", { words: confirming.words }) : ""
        }
        message={t("rules.intro")}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}
