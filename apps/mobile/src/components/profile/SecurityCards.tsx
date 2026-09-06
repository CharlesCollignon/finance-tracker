import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Text } from "@/components/ui/Text";
import {
  deletePasskey,
  listPasskeys,
  registerPasskeyCeremony,
  type PasskeyItem,
} from "@/lib/passkeys";

export function PasskeysPanel() {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    const result = await listPasskeys();
    setPasskeys(result.passkeys);
    if (result.error) {
      setMessage(result.error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onAdd() {
    setMessage(null);
    setPending(true);
    const result = await registerPasskeyCeremony();
    setPending(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    await refresh();
  }

  function onDelete(id: string, label: string) {
    setConfirming({ id, label });
  }

  async function confirmDelete() {
    if (!confirming) {
      return;
    }
    setPending(true);
    const result = await deletePasskey(confirming.id);
    setPending(false);
    setConfirming(null);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    await refresh();
  }

  return (
    <View className="gap-3">
      {passkeys.length === 0 ? (
        <Text variant="micro">No passkeys yet.</Text>
      ) : (
        <View className="gap-2">
          {passkeys.map((item) => {
            const label = item.friendly_name ?? "Passkey";
            return (
              <View
                key={item.id}
                className="flex-row items-center justify-between gap-3"
              >
                <View className="flex-1">
                  <Text>{label}</Text>
                  <Text variant="muted">
                    Added {item.created_at.slice(0, 10)}
                  </Text>
                </View>
                <Button
                  label="Remove"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onPress={() => onDelete(item.id, label)}
                />
              </View>
            );
          })}
        </View>
      )}
      <Button
        label={pending ? "Please wait…" : "Add passkey"}
        variant="outline"
        disabled={pending}
        onPress={() => {
          void onAdd();
        }}
      />
      {message ? (
        <Text variant="micro" className="text-destructive">
          {message}
        </Text>
      ) : null}

      <ConfirmSheet
        open={confirming !== null}
        title="Remove passkey"
        message={
          confirming
            ? `Remove ${confirming.label}? You can add it again later.`
            : undefined
        }
        confirmLabel="Remove"
        pending={pending}
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={() => setConfirming(null)}
      />
    </View>
  );
}
