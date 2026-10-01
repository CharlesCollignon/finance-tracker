import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { TagUsage } from "@finance/core/tags";

import { PlanCard, PlanCardHeader } from "@/components/plan/PlanCard";
import { TagEditSheet } from "@/components/TagEditSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import { upsertTag } from "@/lib/mutations";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The Plan screen's tags, as the web's `TagsCard` draws them.
 *
 * With `tags.manage` on, each tag is a row with how often it is used and a
 * pencil that opens rename, merge and delete; off, the names alone. The add
 * field sits on one line with its button rather than under a label of its own.
 */
export function TagsCard({
  tags,
  manage,
  onChanged,
}: {
  tags: TagUsage[];
  manage: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const colors = useThemeColors();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<TagUsage | null>(null);

  async function add() {
    if (name.trim() === "") {
      return;
    }
    setPending(true);
    const result = await upsertTag(name);
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setName("");
    toast(t("plan.tagAdded"), "success");
    // Other screens list tags too (the add sheet, the edit forms).
    onChanged();
  }

  return (
    <PlanCard className="gap-3">
      <PlanCardHeader title={t("plan.tagsHeading")} />
      <Text variant="muted" className="text-sm">
        {t("plan.tagsBlurb")}
      </Text>

      {tags.length > 0 && manage ? (
        <View>
          {tags.map((tag, index) => (
            <View
              key={tag.id}
              className={cn(
                "min-h-14 flex-row items-center justify-between gap-3",
                index > 0 && "border-t border-border",
              )}
            >
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm font-medium">
                  {tag.name}
                </Text>
                <Text variant="muted" className="text-xs">
                  {t("ledger.entryCount", { count: tag.uses })}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("plan.editTagNamed", { name: tag.name })}
                onPress={() => {
                  void hapticLight();
                  setEditing(tag);
                }}
                className="h-11 w-11 items-center justify-center rounded-full border border-border"
              >
                <Ionicons
                  name="pencil-outline"
                  size={ICON.md}
                  color={colors.foreground}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {tags.map((tag) => (
            <View
              key={tag.id}
              className="rounded-full border border-border bg-muted px-3 py-1"
            >
              <Text className="text-xs font-medium">{tag.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <Input
            value={name}
            onChangeText={setName}
            maxLength={40}
            placeholder={t("plan.newTag")}
            accessibilityLabel={t("plan.newTag")}
            returnKeyType="done"
            onSubmitEditing={() => void add()}
          />
        </View>
        <Button
          label={t("plan.addTag")}
          variant="outline"
          disabled={pending || name.trim() === ""}
          onPress={() => void add()}
        />
      </View>

      <TagEditSheet
        tag={editing}
        tags={tags}
        onClose={() => setEditing(null)}
        onChanged={onChanged}
      />
    </PlanCard>
  );
}
