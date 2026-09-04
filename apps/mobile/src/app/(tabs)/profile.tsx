import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { type Href, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import {
  BiometricUnlockCard,
  PasskeysCard,
} from "@/components/profile/SecurityCards";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  disableReminders,
  enableReminders,
  remindersEnabled,
} from "@/lib/notifications";
import { useCurrency } from "@/providers/CurrencyProvider";
import { deleteAllUserData, updateProfile } from "@/lib/mutations";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reminders, setReminders] = useState(false);

  useEffect(() => {
    void remindersEnabled().then(setReminders);
  }, []);

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
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      "",
  );
  const { currency, setCurrency } = useCurrency();
  const [confirmData, setConfirmData] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const provider =
    (user?.app_metadata?.provider as string | undefined) ?? "email";

  async function handleSaveProfile() {
    setPending(true);
    const result = await updateProfile(fullName);
    setPending(false);
    setMessage(result.error ?? result.message ?? "Saved");
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
    toast(result.message ?? "Data deleted", "success");
  }

  async function handleDeleteAccount() {
    if (confirmAccount !== "DELETE") {
      toast("Type DELETE to confirm account deletion.", "error");
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
        "Account deletion requires the delete-account Edge Function. Your data can still be wiped below, then contact support to close the auth user.";
      toast(err instanceof Error ? err.message : fallback, "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen title="Profile">
      <ScrollView contentContainerClassName="gap-4 pb-28">
        <Card bezel>
          <Text className="text-base font-semibold">Account</Text>
          <Text variant="muted" className="mt-1">
            Signed in via {provider}
          </Text>
          <Text variant="label" className="mb-2 mt-4">
            Email
          </Text>
          <Input
            value={user?.email ?? ""}
            editable={false}
            className="mb-3 opacity-70"
          />
          <Text variant="label" className="mb-2">
            Display name
          </Text>
          <Input value={fullName} onChangeText={setFullName} className="mb-3" />
          <Button
            label={pending ? "Saving…" : "Save profile"}
            disabled={pending}
            onPress={handleSaveProfile}
          />
          {message ? (
            <Text variant="muted" className="mt-2">
              {message}
            </Text>
          ) : null}
        </Card>

        <BiometricUnlockCard />
        <PasskeysCard />

        <Card bezel>
          <Text className="text-base font-semibold">Budgets, goals & tags</Text>
          <Text variant="muted" className="mt-1 mb-3">
            Set monthly spending caps, savings goals, and tags.
          </Text>
          <Button
            label="Open planning"
            variant="outline"
            onPress={() => router.push("/planning" as Href)}
          />
        </Card>

        <Card bezel>
          <Text className="text-base font-semibold">Reminders</Text>
          <Text variant="muted" className="mb-3 mt-1">
            A nudge the evening before each recurring item is due. Scheduled on
            this device only — nothing leaves your phone.
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-sm">Recurring reminders</Text>
            <Switch
              value={reminders}
              onValueChange={(next) => {
                void handleRemindersChange(next);
              }}
            />
          </View>
        </Card>

        <Card bezel>
          <Text className="text-base font-semibold">Categories</Text>
          <Text variant="muted" className="mt-1 mb-3">
            Add, rename, archive, or remove the categories you file transactions
            under.
          </Text>
          <Button
            label="Manage categories"
            variant="outline"
            onPress={() => router.push("/categories" as Href)}
          />
        </Card>

        <Card bezel>
          <Text className="text-base font-semibold">Currency</Text>
          <Text variant="muted" className="mt-1 mb-3">
            Choose how amounts are labeled. This only changes the symbol — it
            does not convert your numbers.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(["EUR", "USD"] as const).map((value) => {
              const selected = currency === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${value} currency`}
                  onPress={() => setCurrency(value)}
                  className={`rounded-full border px-4 py-1.5 ${
                    selected
                      ? "border-foreground bg-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  <Text
                    className={`text-center text-xs font-semibold ${
                      selected ? "text-background" : ""
                    }`}
                  >
                    {value === "EUR" ? "Euro (€)" : "US Dollar ($)"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card bezel className="border-destructive/40" innerClassName="p-4">
          <Text className="font-bold text-destructive">Danger zone</Text>
          <Text variant="muted" className="mt-1">
            Delete all transactions, recurring templates, positions, and
            categories. Your account stays active.
          </Text>
          <Input
            value={confirmData}
            onChangeText={setConfirmData}
            placeholder="Type DELETE"
            autoCapitalize="characters"
            className="my-3"
          />
          <Button
            label="Delete all my data"
            variant="outline"
            disabled={pending}
            onPress={handleDeleteData}
          />
        </Card>

        <Card bezel className="border-destructive/40" innerClassName="p-4">
          <Text className="font-bold text-destructive">Delete account</Text>
          <Text variant="muted" className="mt-1">
            Permanently removes your account via the delete-account Edge
            Function.
          </Text>
          <Input
            value={confirmAccount}
            onChangeText={setConfirmAccount}
            placeholder="Type DELETE"
            autoCapitalize="characters"
            className="my-3"
          />
          <Button
            label="Delete my account"
            disabled={pending}
            onPress={handleDeleteAccount}
          />
        </Card>

        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
