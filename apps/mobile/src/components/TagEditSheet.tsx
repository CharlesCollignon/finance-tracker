import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { findRenameConflict, type TagUsage } from "@finance/core/tags";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { deleteTag, mergeTags, renameTag } from "@/lib/mutations";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

interface TagEditSheetProps {
  /** The tag being edited; null closes the sheet. */
  tag: TagUsage | null;
  /** Every tag: the merge targets, and what a rename could clash with. */
  tags: TagUsage[];
  onClose: () => void;
  /** After a rename, merge or delete, so every screen reloads. */
  onChanged: () => void;
}

/**
 * Rename, merge or delete one tag (`tags.manage`).
 *
 * The delete asks inside the sheet rather than in a ConfirmSheet on top of
 * it: two modals in a row is the case React Native on iOS drops the second
 * of, and the web asks inline too.
 */
export function TagEditSheet({
  tag,
  tags,
  onClose,
  onChanged,
}: TagEditSheetProps) {
  const t = useT();
  return (
    <Modal
      visible={tag !== null}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel={t("common.closeSheet")}
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          {tag ? (
            <TagEditor
              key={tag.id}
              tag={tag}
              tags={tags}
              onClose={onClose}
              onChanged={onChanged}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function TagEditor({
  tag,
  tags,
  onClose,
  onChanged,
}: {
  tag: TagUsage;
  tags: TagUsage[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [name, setName] = useState(tag.name);
  const [clash, setClash] = useState<TagUsage | null>(null);
  const [intoId, setIntoId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const others = tags.filter((other) => other.id !== tag.id);
  const into = others.find((other) => other.id === intoId) ?? null;

  async function run(action: () => Promise<{ error?: string }>, done: string) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(done, "success");
    onChanged();
    onClose();
  }

  function handleRename() {
    const found = findRenameConflict(tags, tag.id, name);
    if (found) {
      setClash(found);
      return;
    }
    void run(() => renameTag(tag.id, name), t("plan.tagRenamed"));
  }

  function merge(target: TagUsage) {
    void run(() => mergeTags(tag.id, target.id), t("plan.tagMerged"));
  }

  return (
    <>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
        <Text className="font-semibold" style={{ fontSize: 18 }}>
          {t("plan.editTag")}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          hitSlop={8}
          className="min-h-11 justify-center"
        >
          <Text variant="muted">{t("common.close")}</Text>
        </Pressable>
      </View>

      <ScrollView
        className="px-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="muted" className="mb-4 text-sm">
          {t("ledger.entryCount", { count: tag.uses })}
        </Text>

        <Text variant="label" className="mb-2">
          {t("plan.tagName")}
        </Text>
        <Input
          value={name}
          onChangeText={(value) => {
            setName(value);
            setClash(null);
          }}
          maxLength={40}
          accessibilityLabel={t("plan.tagName")}
          className="mb-3"
        />
        {clash ? (
          <View className="mb-3 gap-2" accessibilityLiveRegion="polite">
            <Text className="text-sm">
              {t("plan.tagNameExists", { name: clash.name })}
            </Text>
            <Button
              label={t("plan.mergeIntoNamed", { name: clash.name })}
              variant="outline"
              disabled={pending}
              onPress={() => merge(clash)}
            />
          </View>
        ) : null}
        <Button
          label={t("plan.renameTag")}
          variant="outline"
          disabled={pending}
          onPress={handleRename}
          className="mb-6"
        />

        {others.length > 0 ? (
          <>
            <Text variant="label" className="mb-2">
              {t("plan.mergeTagInto")}
            </Text>
            <View className="mb-2 flex-row flex-wrap gap-2">
              {others.map((other) => {
                const selected = other.id === intoId;
                return (
                  <Pressable
                    key={other.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setIntoId(selected ? null : other.id)}
                    className={cn(
                      "min-h-11 justify-center rounded-full border px-4",
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
                      {other.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="muted" className="mb-3 text-xs">
              {t("plan.mergeTagHint", { name: tag.name })}
            </Text>
            <Button
              label={t("plan.mergeTag")}
              variant="outline"
              disabled={pending || into === null}
              onPress={() => {
                if (into) {
                  merge(into);
                }
              }}
              className="mb-6"
            />
          </>
        ) : null}

        {confirmingDelete ? (
          <View className="mb-8 gap-2">
            <Text className="text-sm">
              {tag.uses === 0
                ? t("plan.deleteTagUnused")
                : t("plan.deleteTagUses", { count: tag.uses })}
            </Text>
            <Button
              label={pending ? t("common.working") : t("plan.confirmDeleteTag")}
              variant="outline"
              className="border-destructive"
              disabled={pending}
              onPress={() =>
                void run(() => deleteTag(tag.id), t("plan.tagDeleted"))
              }
            />
            <Button
              label={t("common.cancel")}
              variant="ghost"
              disabled={pending}
              onPress={() => setConfirmingDelete(false)}
            />
          </View>
        ) : (
          <Button
            label={t("plan.deleteTag")}
            variant="ghost"
            className="mb-8"
            disabled={pending}
            onPress={() => setConfirmingDelete(true)}
          />
        )}
      </ScrollView>
    </>
  );
}
