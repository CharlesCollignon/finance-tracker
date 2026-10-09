import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { disconnectBank } from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** Disconnecting the bank, and choosing what happens to the rows it brought. */

/** Disconnect, asked: keep what the bank brought in (the default) or not. */
export function DisconnectSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const { toast } = useToast();
  const [deleteImported, setDeleteImported] = useState(false);
  const [pending, setPending] = useState(false);

  function close() {
    if (pending) {
      return;
    }
    setDeleteImported(false);
    onOpenChange(false);
  }

  async function confirm() {
    setPending(true);
    const result = await disconnectBank(deleteImported);
    setPending(false);
    if ("error" in result) {
      toast(result.error, "error");
      return;
    }
    void hapticSuccess();
    setDeleteImported(false);
    onOpenChange(false);
    toast(t("bankConnect.disconnected"), "success");
  }

  const options = [
    {
      value: false,
      label: t("bankConnect.keepImported"),
      hint: t("bankConnect.keepImportedHint"),
    },
    {
      value: true,
      label: t("bankConnect.deleteImported"),
      hint: t("bankConnect.deleteImportedHint"),
    },
  ];

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityLabel={t("common.cancel")}
          className="flex-1"
          onPress={close}
        />
        <View className="gap-4 rounded-t-card border border-border bg-card p-card">
          <SheetGrabber />
          <View className="gap-1.5">
            <Text className="font-semibold" style={{ fontSize: 18 }}>
              {t("bankConnect.disconnectTitle")}
            </Text>
            <Text variant="muted" className="text-sm">
              {t("bankConnect.disconnectBody")}{" "}
              {t("bankConnect.disconnectApiKey")}
            </Text>
          </View>
          <View accessibilityRole="radiogroup" className="gap-2">
            {options.map((option) => {
              const selected = deleteImported === option.value;
              return (
                <Pressable
                  key={String(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: pending }}
                  disabled={pending}
                  onPress={() => {
                    void hapticLight();
                    setDeleteImported(option.value);
                  }}
                  className={cn(
                    "min-h-14 flex-row items-center gap-3 rounded-control border px-3 py-2.5",
                    selected ? "bg-secondary" : "border-border",
                  )}
                  style={
                    selected ? { borderColor: colors.foreground } : undefined
                  }
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={ICON.lg}
                    color={
                      selected ? colors.foreground : colors.mutedForeground
                    }
                  />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-sm font-medium">{option.label}</Text>
                    <Text variant="muted" className="text-xs">
                      {option.hint}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View className="gap-2">
            <Button
              label={
                pending
                  ? t("common.working")
                  : t("bankConnect.confirmDisconnect")
              }
              variant="outline"
              size="lg"
              className="border-destructive"
              disabled={pending}
              onPress={() => void confirm()}
            />
            <Button
              label={t("common.cancel")}
              variant="ghost"
              disabled={pending}
              onPress={close}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
