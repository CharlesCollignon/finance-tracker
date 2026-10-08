import { useEffect, useState, type ComponentProps } from "react";
import { ScrollView, Switch, View } from "react-native";
import { type Href, useRouter } from "expo-router";
import type { Ionicons } from "@expo/vector-icons";

import { resolveMessage } from "@finance/core/i18n/t";
import {
  shownNotificationKinds,
  wantsNotification,
  type NotificationKind,
  type NotificationPrefs,
} from "@finance/core/notification-kinds";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ListRow, ListSection } from "@/components/ui/ListRow";
import { useBankState } from "@/hooks/useBankState";
import { useFlag } from "@/hooks/useFlag";
import { useRefreshable } from "@/hooks/useRefreshable";
import { disconnectBank } from "@/lib/bank-connect";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { PasskeysPanel } from "@/components/profile/SecurityCards";
import {
  AiAccountSection,
  type AiAccountRow,
} from "@/components/profile/AiAccountSection";
import { useAuth } from "@/providers/AuthProvider";
import { useBiometricLock } from "@/providers/BiometricLockProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  disableReminders,
  enableReminders,
  remindersEnabled,
} from "@/lib/notifications";
import { useCurrency } from "@/providers/CurrencyProvider";
import { CURRENCY_LABELS } from "@finance/core/constants";
import { useLocaleContext } from "@/providers/LocaleProvider";
import { LOCALE_LABELS, LOCALES } from "@finance/core/i18n/locale";
import {
  deleteAllUserData,
  setAudienceMeasurement,
  setNotificationPref,
  updateProfile,
} from "@/lib/mutations";
import {
  getNotificationSettings,
  readAudienceMeasurement,
} from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { useTabBarClearance } from "@/theme/chrome";

const KIND_ICONS: Record<
  NotificationKind,
  ComponentProps<typeof Ionicons>["name"]
> = {
  recap: "calendar-outline",
  overdraft: "alert-circle-outline",
  close: "checkmark-done-outline",
  bigCharge: "receipt-outline",
  arrived: "cash-outline",
  dca: "trending-up-outline",
  review: "file-tray-outline",
  milestone: "flag-outline",
  year: "sparkles-outline",
  property: "home-outline",
  monthOpen: "calendar-clear-outline",
  bank: "business-outline",
};

/** Which row has opened its editor. One at a time, so the list stays a list. */
type OpenRow = "name" | "passkeys" | "wipe" | "close" | AiAccountRow | null;

export default function ProfileScreen() {
  const tabBarClearance = useTabBarClearance();
  const { user, signOut } = useAuth();
  const router = useRouter();
  // The Bank row only where it leads somewhere: setup is open to this
  // account, or a bank already syncs for it.
  const { bank } = useBankState();
  // The property's switch only for an account with the Immobilier tab.
  const tracksProperty = useFlag("property.track");
  // The AI account section, until the connection is opened to everyone.
  const connectsAi = useFlag("ai.account");
  const showBank =
    bank !== null &&
    (bank.available ||
      bank.ownerCredentials ||
      (bank.connection !== null && bank.connection.status !== "revoked"));
  const { toast } = useToast();
  const { currency, setCurrency } = useCurrency();
  const { locale, setLocale, t } = useLocaleContext();
  const biometrics = useBiometricLock();

  const [open, setOpen] = useState<OpenRow>(null);
  const [reminders, setReminders] = useState(false);
  // The account's choices, with the ones just flipped shown at once: the
  // read catches up when the write announces itself.
  const { data: notifications } = useRefreshable(
    async () => (user ? await getNotificationSettings(user.id) : null),
    [user?.id],
    { reads: ["preferences"] },
  );
  const [flipped, setFlipped] = useState<NotificationPrefs>({});
  const kindPrefs = { ...(notifications?.prefs ?? {}), ...flipped };
  // « Mesure d'audience », for the account, shown flipped at once.
  const { data: measured } = useRefreshable(
    async () => (user ? await readAudienceMeasurement(user.id) : true),
    [user?.id],
    { reads: ["preferences"] },
  );
  const [audience, setAudience] = useState<boolean | null>(null);
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
      toast(t("common.remindersOff"));
      return;
    }
    const { granted, remoteReady } = await enableReminders(locale);
    setReminders(granted);
    if (!granted) {
      toast(t("common.remindersNeedPermission"), "error");
      return;
    }
    // Said plainly rather than swallowed. Without it the switch reports
    // success and the nudges never come, which is indistinguishable from the
    // app being broken.
    toast(
      remoteReady ? t("profile.notificationsOn") : t("profile.remindersOnly"),
      remoteReady ? "success" : undefined,
    );
  }

  async function handleKindChange(kind: NotificationKind, next: boolean) {
    setFlipped((current) => ({ ...current, [kind]: next }));
    const result = await setNotificationPref(kind, next, locale);
    if (!result.success) {
      setFlipped((current) => ({ ...current, [kind]: !next }));
      toast(resolveMessage(t, result.error), "error");
    }
  }

  async function handleAudienceChange(next: boolean) {
    setAudience(next);
    const result = await setAudienceMeasurement(next, locale);
    if (!result.success) {
      setAudience(!next);
      toast(resolveMessage(t, result.error), "error");
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
      result.error ?? result.message ?? t("profile.saved"),
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
    toast(result.message ?? t("profile.dataDeleted"), "success");
  }

  async function handleDeleteAccount() {
    if (confirmAccount !== "DELETE") {
      toast(t("common.typeDeleteToConfirm"), "error");
      return;
    }

    setPending(true);
    // The bank key first, as the web's deleteAccount does: removing the
    // account deletes the stored key with it, but only the web server can
    // tell open-banking.io the key is dead. Never throws, and a failure
    // here must not stand in the way of the deletion that was asked for.
    await disconnectBank(false);
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
        // The function's own answer, which is worth showing as it is.
        toast(String(data.error), "error");
        return;
      }
      await signOut();
    } catch {
      // Supabase's own error ("Edge Function returned a non-2xx status
      // code") tells a reader nothing they can act on.
      toast(t("profile.deleteAccountUnavailable"), "error");
    } finally {
      setPending(false);
    }
  }

  const biometricsReady = biometrics.hardware && biometrics.enrolled;
  const biometricsNote = !biometrics.hardware
    ? t("profile.biometricsUnavailable")
    : !biometrics.enrolled
      ? t("profile.biometricsNeedsSetup")
      : undefined;

  return (
    <Screen title={t("nav.profile")}>
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
          <Text variant="head">{fullName || t("profile.noName")}</Text>
          <Text variant="micro">{user?.email}</Text>
        </Card>

        <ListSection title={t("profile.accountSection")}>
          <ListRow
            icon="person-outline"
            label={t("profile.name")}
            value={
              open === "name" ? undefined : fullName || t("profile.notSet")
            }
            onPress={() => toggle("name")}
            expanded={
              open === "name" ? (
                <View className="gap-3">
                  <Input
                    value={fullName}
                    onChangeText={setFullName}
                    accessibilityLabel={t("profile.displayName")}
                    placeholder={t("profile.namePlaceholder")}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleSaveProfile()}
                  />
                  <Button
                    label={pending ? t("profile.saving") : t("profile.save")}
                    disabled={pending}
                    onPress={() => void handleSaveProfile()}
                  />
                </View>
              ) : null
            }
          />
          <ListRow
            icon="mail-outline"
            label={t("profile.email")}
            value={user?.email}
          />
          <ListRow
            icon="log-in-outline"
            label={t("profile.signedInWith")}
            value={provider}
          />
          {/* The phone's way back to `/onboarding`. Its launch-time gate
              only ever pushes there once, while `onboarded === false`; once
              that flag flips there is no other route to it. Unconditional,
              not folded into the gate's guard, so it stays reachable after
              setup is done — which is the point of it. Web's account menu
              carries the same row with the same key. */}
          <ListRow
            icon="compass-outline"
            label={t("onboarding.reopen")}
            onPress={() => router.push("/onboarding" as Href)}
          />
        </ListSection>

        <ListSection
          title={t("profile.moneySection")}
          footer={t("profile.moneyFooter")}
        >
          <ListRow
            icon="pricetags-outline"
            label={t("profile.categories")}
            onPress={() => router.push("/categories" as Href)}
          />
          {showBank ? (
            <ListRow
              icon="business-outline"
              label={t("bankConnect.profileLink")}
              onPress={() => router.push("/bank" as Href)}
            />
          ) : null}
          <ListRow
            icon="cash-outline"
            label={t("profile.currency")}
            value={CURRENCY_LABELS[currency]}
            onPress={() => setCurrency(currency === "EUR" ? "USD" : "EUR")}
          />
          {/* Beside Currency because they are the two preferences that change
              how a figure reads. A cycle rather than a picker while there are
              two languages, matching the row above; it becomes a sheet when a
              third arrives. */}
          <ListRow
            icon="language-outline"
            label={t("locale.settingLabel")}
            value={LOCALE_LABELS[locale]}
            onPress={() =>
              setLocale(
                LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length]!,
              )
            }
          />
        </ListSection>

        {/* Beside the money it reads: the written reads are what an AI
            account is for. */}
        {connectsAi && user ? (
          <AiAccountSection
            userId={user.id}
            open={open}
            onToggle={toggle}
            onClose={() => setOpen(null)}
          />
        ) : null}

        <ListSection title={t("profile.securitySection")}>
          <ListRow
            icon="finger-print-outline"
            label={t("profile.appUnlock")}
            value={biometricsNote}
            disabled={!biometricsReady}
            trailing={
              <Switch
                accessibilityLabel={t("profile.unlockWithBiometrics")}
                value={biometrics.enabled && biometricsReady}
                disabled={!biometrics.ready || pending || !biometricsReady}
                onValueChange={(next) => void handleBiometricsChange(next)}
              />
            }
          />
          <ListRow
            icon="key-outline"
            label={t("profile.passkeys")}
            onPress={() => toggle("passkeys")}
            expanded={open === "passkeys" ? <PasskeysPanel /> : null}
          />
        </ListSection>

        <ListSection
          title={t("profile.notificationsSection")}
          footer={t("profile.notificationsFooterMobile")}
        >
          <ListRow
            icon="notifications-outline"
            label={t("profile.onThisPhone")}
            trailing={
              <Switch
                value={reminders}
                onValueChange={(next) => void handleRemindersChange(next)}
              />
            }
          />
          {shownNotificationKinds({ property: tracksProperty }).map((kind) => (
            <ListRow
              key={kind}
              icon={KIND_ICONS[kind]}
              label={t(`notificationKinds.${kind}.label`)}
              hint={t(`notificationKinds.${kind}.hint`)}
              trailing={
                <Switch
                  accessibilityLabel={t(`notificationKinds.${kind}.label`)}
                  value={wantsNotification(kindPrefs, kind)}
                  onValueChange={(next) => void handleKindChange(kind, next)}
                />
              }
            />
          ))}
        </ListSection>

        <ListSection title={t("profile.dataSection")}>
          <ListRow
            icon="stats-chart-outline"
            label={t("profile.audience")}
            hint={t("profile.audienceHint")}
            trailing={
              <Switch
                accessibilityLabel={t("profile.audience")}
                value={audience ?? measured ?? true}
                onValueChange={(next) => void handleAudienceChange(next)}
              />
            }
          />
          <ListRow
            icon="trash-outline"
            label={t("profile.deleteAllData")}
            destructive
            onPress={() => toggle("wipe")}
            expanded={
              open === "wipe" ? (
                <View className="gap-3">
                  <Text variant="micro">{t("profile.wipeBlurb")}</Text>
                  <Input
                    value={confirmData}
                    onChangeText={setConfirmData}
                    accessibilityLabel={t("profile.deleteConfirmLabel")}
                    placeholder={t("profile.deleteConfirmPlaceholder")}
                    autoCapitalize="characters"
                  />
                  <Button
                    label={t("profile.deleteAllMyData")}
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
            label={t("profile.deleteAccount")}
            destructive
            onPress={() => toggle("close")}
            expanded={
              open === "close" ? (
                <View className="gap-3">
                  <Text variant="micro">{t("profile.closeBlurb")}</Text>
                  <Input
                    value={confirmAccount}
                    onChangeText={setConfirmAccount}
                    accessibilityLabel={t("profile.deleteConfirmLabel")}
                    placeholder={t("profile.deleteConfirmPlaceholder")}
                    autoCapitalize="characters"
                  />
                  <Button
                    label={t("profile.deleteMyAccount")}
                    disabled={pending}
                    onPress={() => void handleDeleteAccount()}
                  />
                </View>
              ) : null
            }
          />
        </ListSection>

        <Button
          label={t("common.signOut")}
          variant="secondary"
          onPress={signOut}
        />
      </ScrollView>
    </Screen>
  );
}
