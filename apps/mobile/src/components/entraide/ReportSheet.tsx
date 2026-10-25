import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ENTRAIDE_RULES, type EntraideRule } from "@finance/core/entraide";
import {
  entraideErrorText,
  type EntraideCopy,
} from "@finance/core/entraide-copy";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { writeEntraide } from "@/lib/entraide";
import { cn } from "@/lib/cn";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * « Signaler »: the rule a question or an answer breaks, a detail if the
 * reader wants to add one, and off it goes to the publisher — who alone
 * will know who reported it. A third member's report hides it at once.
 */
export function ReportSheet({
  target,
  copy,
  onClose,
  onReported,
}: {
  /** What is being reported; the sheet is open while there is one. */
  target: string | null;
  copy: EntraideCopy;
  onClose: () => void;
  onReported: (target: string) => void;
}) {
  const colors = useThemeColors();
  const [reason, setReason] = useState<EntraideRule | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function close() {
    setReason(null);
    setNote("");
    setError(null);
    setSent(false);
    onClose();
  }

  async function send() {
    if (!target || !reason || pending) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await writeEntraide({
      action: "report",
      target,
      reason,
      note,
    });
    setPending(false);
    if (!result.ok) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    void hapticSuccess();
    setSent(true);
    onReported(target);
  }

  return (
    <Modal
      visible={target !== null}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <Pressable
          className="flex-1"
          accessibilityLabel={copy.thread.cancel}
          onPress={close}
        />
        <View className="max-h-[90%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-3 px-5 pb-10 pt-3"
          >
            {sent ? (
              <View className="items-center gap-4 py-6">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={32}
                  color={colors.foreground}
                />
                <Text className="text-center">{copy.report.sent}</Text>
                <Button label={copy.report.close} variant="outline" onPress={close} />
              </View>
            ) : (
              <>
                <Text variant="title" accessibilityRole="header">
                  {copy.report.title}
                </Text>
                <View accessibilityRole="radiogroup" className="gap-1.5">
                  {ENTRAIDE_RULES.map((rule) => {
                    const chosen = reason === rule;
                    return (
                      <Pressable
                        key={rule}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: chosen }}
                        onPress={() => {
                          void hapticSelection();
                          setReason(rule);
                        }}
                        className={cn(
                          "min-h-11 flex-row items-center gap-3 rounded-control border px-3",
                          chosen
                            ? "border-foreground/30 bg-foreground/10"
                            : "border-border",
                        )}
                      >
                        <Ionicons
                          name={chosen ? "radio-button-on" : "radio-button-off"}
                          size={ICON.lg}
                          color={
                            chosen ? colors.foreground : colors.mutedForeground
                          }
                        />
                        <Text className="flex-1 text-sm">
                          {copy.rules[rule]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text className="px-1 pt-1 text-sm font-medium">
                  {copy.report.note}
                </Text>
                <Input
                  value={note}
                  onChangeText={setNote}
                  maxLength={500}
                  multiline
                  accessibilityLabel={copy.report.note}
                  className="min-h-20"
                  textAlignVertical="top"
                />
                {error ? (
                  <Text accessibilityRole="alert" className="text-sm">
                    {error}
                  </Text>
                ) : null}
                <View className="flex-row justify-end gap-2 pt-1">
                  <Button
                    label={copy.thread.cancel}
                    variant="ghost"
                    onPress={close}
                  />
                  <Button
                    label={pending ? copy.report.sending : copy.report.send}
                    disabled={!reason || pending}
                    onPress={() => void send()}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
