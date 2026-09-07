import { useEffect, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { type Href, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ListRow, ListSection } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { PasskeysPanel } from "@/components/profile/SecurityCards";
import { useAuth } from "@/providers/AuthProvider";
import { useBiometricLock } from "@/providers/BiometricLockProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  disableReminders,
  enableReminders,
  remindersEnabled,
} from "@/lib/notifications";
import { useCurrency } from "@/providers/CurrencyProvider";
import { deleteAllUserData, updateProfile } from "@/lib/mutations";
import { supabase } from "@/lib/supabase";
import { useTabBarClearance } from "@/theme/chrome";

/** Which row has opened its editor. One at a time, so the list stays a list. */
type OpenRow = "name" | "passkeys" | "wipe" | "close" | null;

export default function ProfileScreen() {
  const tabBarClearance = useTabBarClearance();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { currency, setCurrency } = useCurrency();
  const biometrics = useBiometricLock();

  const [open, setOpen] = useState<OpenRow>(null);
  const [reminders, setReminders] = useState(false);
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      "",
  );
  const [confirmData, setConfirmData] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [pending, setPending] = useState(false);

  const provider =
    (user?.app_metadata?.provider as string | undefined) ?? "email";

  useEffect(() => {
    void remindersEnabled().then(setReminders);
  }, []);

  function toggle(row: Exclude<OpenRow, null>) {
    setOpen((current) => (current === row ? null : row));
  }

  async function handleRemindersChange(next: boolean) {
    if (!next) {
      await disableReminders();
      setReminders(false);
      toast("Reminders off");
      return;
    }
    const granted = await enableReminders();
    setReminders(granted);
    if (!granted) {
      toast("Reminders need notification permission", "error");
    }
  }

  async function handleBiometricsChange(next: boolean) {
    setPending(true);
    const result = next ? await enableBiometrics() : await disableBiometrics();
    setPending(false);
    if (result) {
      toast(result, "error");
    }
  }

  async function enableBiometrics() {
    const result = await biometrics.enable();
    return result.error ?? null;
  }

  async function disableBiometrics() {
    await biometrics.disable();
    return null;
  }

  async function handleSaveProfile() {
    setPending(true);
    const result = await updateProfile(fullName);
    setPending(false);
    toast(
      result.error ?? result.message ?? "Saved",
      result.error ? "error" : "success",
    );
    if (!result.error) {
      setOpen(null);
    }
  }

  async function handleDeleteData() {
    setPending(true);
    const result = await deleteAllUserData(confirmData);
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    setConfirmData("");
    setOpen(null);
    toast(result.message ?? "Data deleted", "success");
  }

  async function handleDeleteAccount() {
    if (confirmAccount !== "DELETE") {
      toast("Type DELETE to confirm.", "error");
      return;
    }

    setPending(true);
    // Mobile cannot hold the service role key. Call the Supabase Edge
    // Function when configured; otherwise delete user data and sign out.
    try {
      const { data, error } = await supabase.functions.invoke(
        "delete-account",
        { body: { confirmation: confirmAccount } },
      );
      if (error) {
        throw error;
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      await signOut();
    } catch (err) {
      const fallback =
        "Account deletion needs the delete-account Edge Function. Delete your data above, then contact support.";
      toast(err instanceof Error ? err.message : fallback, "error");
    } finally {
      setPending(false);
    }
  }

  const biometricsReady = biometrics.hardware && biometrics.enrolled;
  const biometricsNote = !biometrics.hardware
    ? "Not on this device"
    : !biometrics.enrolled
      ? "Set up in system settings"
      : undefined;

  return (
    <Screen title="Profile">
      <ScrollView
        contentContainerClassName="gap-6 pt-1"
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
        showsVerticalScrollIndicator={false}
      >
        {/* Who is signed in, before anything that can be changed about them. */}
        <Card bezel innerClassName="items-center gap-1 py-6">
          <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Text
              className="font-sans text-2xl font-bold text-primary-foreground"
              maxFontSizeMultiplier={1.3}
            >
              {(fullName || user?.email || "?").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text variant="head">{fullName || "No name yet"}</Text>
          <Text variant="micro">{user?.email}</Text>
        </Card>

        <ListSection title="Account">
          <ListRow
            icon="person-outline"
            label="Name"
            value={open === "name" ? undefined : fullName || "Not set"}
            onPress={() => toggle("name")}
            expanded={
              open === "name" ? (
                <View className="gap-3">
                  <Input
                    value={fullName}
                    onChangeText={setFullName}
                    accessibilityLabel="Display name"
                    placeholder="Your name"
                    returnKeyType="done"
                    onSubmitEditing={() => void handleSaveProfile()}
                  />
                  <Button
                    label={pending ? "Saving…" : "Save"}
                    disabled={pending}
                    onPress={() => void handleSaveProfile()}
                  />
                </View>
              ) : null
            }
          />
          <ListRow icon="mail-outline" label="Email" value={user?.email} />
          <ListRow
            icon="log-in-outline"
            label="Signed in with"
            value={provider}
          />
        </ListSection>

        <ListSection
          title="Money"
          footer="Currency changes the symbol, not the amounts."
        >
          <ListRow
            icon="pricetags-outline"
            label="Categories"
            onPress={() => router.push("/categories" as Href)}
          />
          <ListRow
            icon="flag-outline"
            label="Budgets & goals"
            onPress={() => router.push("/planning" as Href)}
          />
          <ListRow
            icon="cash-outline"
            label="Currency"
            value={currency === "EUR" ? "Euro (€)" : "US Dollar ($)"}
            onPress={() => setCurrency(currency === "EUR" ? "USD" : "EUR")}
          />
        </ListSection>

        <ListSection title="Security">
          <ListRow
            icon="finger-print-outline"
            label="App unlock"
            value={biometricsNote}
            disabled={!biometricsReady}
            trailing={
              <Switch
                accessibilityLabel="Unlock with biometrics"
                value={biometrics.enabled && biometricsReady}
                disabled={!biometrics.ready || pending || !biometricsReady}
                onValueChange={(next) => void handleBiometricsChange(next)}
              />
            }
          />
          <ListRow
            icon="key-outline"
            label="Passkeys"
            onPress={() => toggle("passkeys")}
            expanded={open === "passkeys" ? <PasskeysPanel /> : null}
          />
        </ListSection>

        <ListSection
          title="Notifications"
          footer="Reminders for what repeats, plus a nudge when the bank leaves something needing a category."
        >
          <ListRow
            icon="notifications-outline"
            label="Reminders and nudges"
            trailing={
              <Switch
                value={reminders}
                onValueChange={(next) => void handleRemindersChange(next)}
              />
            }
          />
        </ListSection>

        <ListSection title="Data">
          <ListRow
            icon="trash-outline"
            label="Delete all data"
            destructive
            onPress={() => toggle("wipe")}
            expanded={
              open === "wipe" ? (
                <View className="gap-3">
                  <Text variant="micro">
                    Transactions, recurring, positions and categories. Your
                    account stays.
                  </Text>
                  <Input
                    value={confirmData}
                    onChangeText={setConfirmData}
                    accessibilityLabel="Type DELETE to confirm"
                    placeholder="Type DELETE"
                    autoCapitalize="characters"
                  />
                  <Button
                    label="Delete all my data"
                    variant="outline"
                    disabled={pending}
                    onPress={() => void handleDeleteData()}
                  />
                </View>
              ) : null
            }
          />
          <ListRow
            icon="close-circle-outline"
            label="Delete account"
            destructive
            onPress={() => toggle("close")}
            expanded={
              open === "close" ? (
                <View className="gap-3">
                  <Text variant="micro">
                    Permanent. Everything above goes with it.
                  </Text>
                  <Input
                    value={confirmAccount}
                    onChangeText={setConfirmAccount}
                    accessibilityLabel="Type DELETE to confirm"
                    placeholder="Type DELETE"
                    autoCapitalize="characters"
                  />
                  <Button
                    label="Delete my account"
                    disabled={pending}
                    onPress={() => void handleDeleteAccount()}
                  />
                </View>
              ) : null
            }
          />
        </ListSection>

        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
