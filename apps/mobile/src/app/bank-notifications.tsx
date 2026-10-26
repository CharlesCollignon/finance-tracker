import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";

import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { BANK_NAMES, type BankId } from "@finance/core/statement";
import type { FileAccount } from "@finance/data/statements";

import { ScreenError } from "@/components/ScreenError";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAppForeground } from "@/hooks/useAppForeground";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  drainBankNotifications,
  installedBankApps,
  readListenerAccount,
  readListenerStats,
  writeListenerAccount,
  type ListenerAccount,
  type ListenerStats,
} from "@/lib/bank-notifications";
import { readFileAccounts } from "@/lib/statements";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import {
  listenedPackages,
  listenerAvailable,
  listenerEnabled,
  openListenerSettings,
  setListenedPackages,
  waitingCount,
} from "../../modules/notification-listener";

/**
 * « Les notifications de votre banque » (Android, behind `listener.android`;
 * docs/plans/STATEMENTS_PLAN.md Phase 5): the access to grant on Android's
 * own page, the bank apps to read among those installed, the account their
 * lines go on, and what has been read so far. Reading happens on its own
 * each time the app comes back; the button here reads at once.
 */
export default function BankNotificationsScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const colors = useThemeColors();
  const { toast } = useToast();
  const { user } = useAuth();
  const { ownerId } = useOwner();
  const userId = user?.id ?? null;

  const [enabled, setEnabled] = useState(listenerEnabled());
  const [waiting, setWaiting] = useState(waitingCount());
  const [chosen, setChosen] = useState<string[]>(listenedPackages());
  const [apps] = useState<{ bank: BankId; packageName: string }[]>(() =>
    listenerAvailable ? installedBankApps() : [],
  );
  const [accounts, setAccounts] = useState<FileAccount[] | null>(null);
  const [account, setAccount] = useState<ListenerAccount | null>(null);
  const [stats, setStats] = useState<ListenerStats>({ lastReadAt: null, broughtSoFar: 0 });
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read when the screen opens and each time the app comes back — from
  // Android's settings page, where the access is granted — as `useFlag`
  // does: a count the return bumps, an effect that loads on it.
  const [asked, setAsked] = useState(0);
  useAppForeground(() => setAsked((count) => count + 1));
  const refresh = useCallback(() => setAsked((count) => count + 1), []);

  useEffect(() => {
    let live = true;
    const settle = () => {
      if (!live) {
        return;
      }
      setEnabled(listenerEnabled());
      setWaiting(waitingCount());
    };
    if (!userId) {
      void Promise.resolve().then(settle);
      return () => {
        live = false;
      };
    }
    void Promise.all([
      readFileAccounts(userId),
      readListenerAccount(userId),
      readListenerStats(userId),
    ])
      .then(([known, stored, kept]) => {
        settle();
        if (!live) {
          return;
        }
        setAccounts(
          known.filter((one) => one.role === "spending" || one.role === "joint"),
        );
        setAccount(stored);
        setStats(kept);
        setError(null);
      })
      .catch((cause: unknown) => {
        settle();
        if (live) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      live = false;
    };
  }, [userId, asked]);

  async function readNow() {
    if (!userId || !ownerId) {
      return;
    }
    setReading(true);
    const result = await drainBankNotifications(userId, ownerId);
    setReading(false);
    refresh();
    const skipped =
      "skipped" in result && result.skipped > 0
        ? ` · ${t("listener.skipped", { count: result.skipped })}`
        : "";
    if (result.kind === "error") {
      toast(resolveMessage(t, result.error) + skipped, "error");
      return;
    }
    if (result.kind === "read" && result.brought > 0) {
      void hapticSuccess();
      toast(t("listener.read", { count: result.brought }) + skipped);
      return;
    }
    toast(t("listener.readNone") + skipped);
  }

  function toggleApp(packageName: string) {
    void hapticLight();
    const next = chosen.includes(packageName)
      ? chosen.filter((one) => one !== packageName)
      : [...chosen, packageName];
    setChosen(next);
    setListenedPackages(next);
  }

  async function chooseAccount(one: FileAccount) {
    if (!userId) {
      return;
    }
    const choice: ListenerAccount = { kind: "existing", providerAccountId: one.providerAccountId };
    setAccount(choice);
    await writeListenerAccount(userId, choice);
  }

  const back = {
    label: t("pages.import"),
    onPress: () => (router.canGoBack() ? router.back() : router.replace("/import" as Href)),
  };

  if (Platform.OS !== "android" || !listenerAvailable) {
    return (
      <Screen title={t("listener.title")} back={back} showRefresh={false}>
        <EmptyState title={t("listener.notHere")} description={t("listener.notHereBody")} />
      </Screen>
    );
  }

  const chosenAccountId = account?.kind === "existing" ? account.providerAccountId : null;

  return (
    <Screen title={t("listener.title")} back={back} showRefresh={false} className="px-0 py-0">
      <ScrollView contentContainerClassName="gap-4 px-4 pb-24 pt-4">
        {error ? <ScreenError message={error} onRetry={refresh} /> : null}

        <Text variant="muted" className="leading-5">
          {t("listener.intro")}
        </Text>

        {/* The access. */}
        <View className="gap-3 rounded-card border border-border bg-card/70 p-card">
          <View className="flex-row items-center gap-2">
            <Ionicons
              name={enabled ? "notifications-outline" : "notifications-off-outline"}
              size={ICON.md}
              color={enabled ? colors.primary : colors.mutedForeground}
            />
            <Text variant="head">{t("listener.accessTitle")}</Text>
          </View>
          <Text variant="muted" className="text-sm">
            {enabled ? t("listener.accessOn") : t("listener.accessOff")}
          </Text>
          <View className="flex-row">
            <Button
              label={t("listener.openSettings")}
              variant={enabled ? "outline" : "default"}
              size="sm"
              onPress={() => openListenerSettings()}
            />
          </View>
        </View>

        {/* The apps. */}
        <View className="gap-2 rounded-card border border-border bg-card/70 p-card">
          <Text variant="head">{t("listener.appsTitle")}</Text>
          {apps.length === 0 ? (
            <Text variant="muted" className="text-sm">
              {t("listener.appsNone")}
            </Text>
          ) : (
            <>
              {apps.map((app) => {
                const on = chosen.includes(app.packageName);
                return (
                  <Pressable
                    key={app.packageName}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={BANK_NAMES[app.bank]}
                    onPress={() => toggleApp(app.packageName)}
                    className="min-h-11 flex-row items-center justify-between gap-3 py-1"
                  >
                    <Text className="text-sm">{BANK_NAMES[app.bank]}</Text>
                    <Ionicons
                      name={on ? "checkbox" : "square-outline"}
                      size={ICON.md}
                      color={on ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                );
              })}
              <Text variant="muted" className="text-xs">
                {t("listener.appsHint")}
              </Text>
            </>
          )}
        </View>

        {/* The account. */}
        <View className="gap-2 rounded-card border border-border bg-card/70 p-card">
          <Text variant="head">{t("listener.accountTitle")}</Text>
          {accounts === null ? null : accounts.length === 0 ? (
            <Text variant="muted" className="text-sm">
              {t("listener.accountNone")}
            </Text>
          ) : (
            accounts.map((one) => {
              const on = chosenAccountId === one.providerAccountId;
              return (
                <Pressable
                  key={one.providerAccountId}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={one.label}
                  onPress={() => void chooseAccount(one)}
                  className="min-h-11 flex-row items-center justify-between gap-3 py-1"
                >
                  <Text className={cn("text-sm", on && "font-medium")}>{one.label}</Text>
                  <Ionicons
                    name={on ? "radio-button-on" : "radio-button-off"}
                    size={ICON.md}
                    color={on ? colors.primary : colors.mutedForeground}
                  />
                </Pressable>
              );
            })
          )}
        </View>

        {/* Reading. */}
        <View className="gap-2 rounded-card border border-border bg-card/70 p-card">
          <Text variant="muted" className="text-sm">
            {t("listener.waiting", { count: waiting })}
            {stats.lastReadAt
              ? ` · ${t("listener.lastRead", { date: formatShortDate(new Date(stats.lastReadAt).toISOString().slice(0, 10), locale) })}`
              : ""}
            {stats.broughtSoFar > 0
              ? ` · ${t("listener.broughtSoFar", { count: stats.broughtSoFar })}`
              : ""}
          </Text>
          <View className="flex-row">
            <Button
              label={reading ? t("listener.reading") : t("listener.readNow")}
              size="sm"
              disabled={reading || !enabled || account === null}
              onPress={() => void readNow()}
            />
          </View>
          <Text variant="muted" className="text-xs">
            {t("listener.unverified")}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
