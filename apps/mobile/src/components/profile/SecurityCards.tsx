import { useCallback, useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import {
  deletePasskey,
  listPasskeys,
  registerPasskeyCeremony,
  type PasskeyItem,
} from "@/lib/passkeys";
import { useBiometricLock } from "@/providers/BiometricLockProvider";

export function BiometricUnlockCard() {
  const { enabled, hardware, enrolled, ready, enable, disable } =
    useBiometricLock();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const available = hardware && enrolled;
  const toggleDisabled = !ready || pending || !available;

  async function onToggle(next: boolean) {
    setMessage(null);
    setPending(true);
    if (next) {
      const result = await enable();
      if (result.error) {
        setMessage(result.error);
      }
    } else {
      await disable();
    }
    setPending(false);
  }

  return (
    <Card className="p-4">
      <Text className="font-bold">App unlock</Text>
      <Text variant="muted" className="mt-1">
        Require Face ID or a fingerprint when opening the app. This does not
        replace your password or passkey.
      </Text>
      <View className="mt-3 flex-row items-center justify-between">
        <Text>
          {!hardware
            ? "Not available on this device"
            : !enrolled
              ? "Set up biometrics in system settings"
              : "Unlock with biometrics"}
        </Text>
        <Switch
          accessibilityLabel="Unlock with biometrics"
          value={enabled && available}
          disabled={toggleDisabled}
          onValueChange={(value) => {
            void onToggle(value);
          }}
        />
      </View>
      {message ? (
        <Text className="mt-2 text-destructive">{message}</Text>
      ) : null}
    </Card>
  );
}

export function PasskeysCard() {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    Alert.alert("Remove passkey", `Remove ${label}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setPending(true);
            const result = await deletePasskey(id);
            setPending(false);
            if (result.error) {
              setMessage(result.error);
              return;
            }
            await refresh();
          })();
        },
      },
    ]);
  }

  return (
    <Card className="p-4">
      <Text className="font-bold">Passkeys</Text>
      <Text variant="muted" className="mt-1 mb-3">
        Passwordless sign-in with this device. Requires a development build
        and the correct Relying Party domain.
      </Text>
      {passkeys.length === 0 ? (
        <Text variant="muted" className="mb-3">
          No passkeys yet.
        </Text>
      ) : (
        <View className="mb-3 gap-2">
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
        <Text className="mt-2 text-destructive">{message}</Text>
      ) : null}
    </Card>
  );
}
