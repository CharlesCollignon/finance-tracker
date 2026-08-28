import { Modal, Pressable, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm action as destructive. */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Styled confirmation, replacing the stock platform dialog for destructive
 * actions so the app's own surfaces stay consistent.
 */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <Pressable
          accessibilityLabel="Cancel"
          className="absolute inset-0"
          onPress={onCancel}
        />
        <View className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
          <Text className="font-semibold" style={{ fontSize: 17 }}>
            {title}
          </Text>
          {message ? (
            <Text variant="muted" className="mt-2 text-sm">
              {message}
            </Text>
          ) : null}
          <View className="mt-5 gap-2">
            <Button
              label={pending ? "Working…" : confirmLabel}
              variant="outline"
              className={destructive ? "border-destructive" : undefined}
              disabled={pending}
              onPress={onConfirm}
            />
            <Button
              label={cancelLabel}
              variant="ghost"
              disabled={pending}
              onPress={onCancel}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
