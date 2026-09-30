import { useCallback, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { formatShortDate } from "@finance/core/constants";
import type { BankAccount } from "@finance/core/types/database";

import { BankImport } from "@/components/bank/BankImport";
import { ConnectBankSheet } from "@/components/bank/ConnectBankSheet";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useBankState, type BankState } from "@/hooks/useBankState";
import { useRefreshable } from "@/hooks/useRefreshable";
import {
  disconnectBank,
  OPEN_BANKING_APP,
  readBankServerFacts,
} from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { getBankAccounts } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The bank connection, in one place: connect it, see it working, fix it, or
 * let it go — the web's Bank page, and where every "Connect your bank" on
 * the phone and the renewal push lands.
 *
 * The status comes from the user's own `bank_connections` row; only whether
 * the deployment can connect at all, and whether this user syncs on its own
 * credentials, is asked of the server.
 */
export default function BankScreen() {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuth();
  const dataVersion = useDataVersion();

  const { bank, reload } = useBankState();
  const {
    data: accounts,
    loading,
    refreshing,
    onRefresh,
    reload: reloadAccounts,
  } = useRefreshable(
    async () => (user ? await getBankAccounts(user.id) : []),
    [user?.id, dataVersion],
  );

  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const refreshAll = useCallback(() => {
    if (user) {
      // A pull is someone asking again, so the deployment's answer is
      // asked again too rather than taken from the cache.
      void readBankServerFacts(user.id, { fresh: true }).then(() => reload());
    }
    onRefresh();
  }, [user, reload, onRefresh]);

  // Stable, because the import walk depends on it and must run once.
  const importFinished = useCallback(() => {
    void reload();
    void reloadAccounts();
  }, [reload, reloadAccounts]);

  const connection = bank?.connection ?? null;
  const live = connection !== null && connection.status !== "revoked";
  const ownerCredentials = bank?.ownerCredentials ?? false;
  const syncing = ownerCredentials || (live && connection.status === "active");

  return (
    <Screen
      title={t("pages.bank")}
      showLogo={false}
      headerActions={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("categories.back")}
          hitSlop={8}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          className="h-9 w-9 items-center justify-center rounded-control"
        >
          <Ionicons
            name="chevron-back"
            size={ICON.xl}
            color={colors.foreground}
          />
        </Pressable>
      }
    >
      {!bank || (loading && !accounts) ? (
        <ScreenSkeleton rows={4} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshAll}
              tintColor={colors.mutedForeground}
            />
          }
          contentContainerClassName="gap-4 pb-28"
          showsVerticalScrollIndicator={false}
        >
          {!live && !ownerCredentials ? (
            <Invitation
              available={bank.available}
              onConnect={() => setConnectOpen(true)}
            />
          ) : null}

          {live && connection.status !== "active" ? (
            <ProblemCard
              status={connection.status}
              onReconnect={() => setConnectOpen(true)}
            />
          ) : null}

          {syncing ? (
            <StatusCard
              bank={bank}
              ownerCredentials={ownerCredentials}
              onReplace={bank.available ? () => setConnectOpen(true) : null}
            />
          ) : null}

          {live &&
          connection.status === "active" &&
          connection.backfilled_at === null ? (
            <BankImport onFinished={importFinished} />
          ) : null}

          {accounts && accounts.length > 0 ? (
            <AccountsCard accounts={accounts} onChanged={reloadAccounts} />
          ) : null}

          {live ? (
            <Button
              label={t("bankConnect.disconnect")}
              variant="ghost"
              className="self-center"
              onPress={() => setDisconnectOpen(true)}
            />
          ) : null}
        </ScrollView>
      )}

      <ConnectBankSheet open={connectOpen} onOpenChange={setConnectOpen} />
      <DisconnectSheet
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        onDisconnected={() => {
          notifyDataChanged();
          void reload();
        }}
      />
    </Screen>
  );
}

/** What connecting unlocks — only what already exists for a bank-fed ledger. */
function Invitation({
  available,
  onConnect,
}: {
  available: boolean;
  onConnect: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const unlocks = [
    { icon: "business-outline", text: t("bankConnect.unlockBalance") },
    { icon: "receipt-outline", text: t("bankConnect.unlockEntries") },
    { icon: "flash-outline", text: t("bankConnect.unlockArrived") },
    { icon: "checkmark-circle-outline", text: t("bankConnect.unlockClose") },
  ] as const;

  return (
    <Card bezel innerClassName="gap-5 p-5">
      <View className="gap-2">
        <Text className="text-xl font-semibold">
          {t("bankConnect.sheetTitle")}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("bankConnect.notConnectedBody")}
        </Text>
      </View>
      <View className="gap-2">
        {unlocks.map((unlock) => (
          <View
            key={unlock.text}
            className="flex-row items-start gap-3 rounded-control border border-border px-3 py-3"
          >
            <Ionicons
              name={unlock.icon}
              size={ICON.md}
              color={colors.primaryInk}
            />
            <Text className="min-w-0 flex-1 text-sm">{unlock.text}</Text>
          </View>
        ))}
      </View>
      {available ? (
        <View className="gap-2">
          <Button
            label={t("bankConnect.sheetTitle")}
            size="lg"
            onPress={onConnect}
          />
          <Text variant="muted" className="text-center text-xs">
            {t("bankConnect.priceNote")}
          </Text>
        </View>
      ) : (
        <Text variant="muted" className="text-sm">
          {t("bankConnect.unavailable")}
        </Text>
      )}
    </Card>
  );
}

function ProblemCard({
  status,
  onReconnect,
}: {
  status: string;
  onReconnect: () => void;
}) {
  const t = useT();
  const colors = useThemeColors();
  const copy =
    status === "expired"
      ? {
          title: t("bankConnect.expiredTitle"),
          body: t("bankConnect.expiredBody"),
        }
      : status === "paused"
        ? {
            title: t("bankConnect.pausedTitle"),
            body: t("bankConnect.pausedBody"),
          }
        : {
            title: t("bankConnect.errorTitle"),
            body: t("bankConnect.errorBody"),
          };

  return (
    <Card className="gap-3" style={{ borderColor: colors.warning }}>
      <View className="flex-row items-center gap-2">
        <Ionicons name="alert-circle" size={ICON.lg} color={colors.warning} />
        <Text className="min-w-0 flex-1 text-base font-semibold">
          {copy.title}
        </Text>
      </View>
      <Text variant="muted" className="text-sm">
        {copy.body}
      </Text>
      {status === "paused" ? (
        <Button
          label={t("bankConnect.openSite")}
          className="self-start"
          onPress={() => void Linking.openURL(OPEN_BANKING_APP)}
        />
      ) : status === "expired" ? (
        <Button
          label={t("bankConnect.reconnect")}
          className="self-start"
          onPress={onReconnect}
        />
      ) : null}
    </Card>
  );
}

function StatusCard({
  bank,
  ownerCredentials,
  onReplace,
}: {
  bank: BankState;
  ownerCredentials: boolean;
  /** Opens the upload for a new file; null where setup is not offered. */
  onReplace: (() => void) | null;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const connection = bank.connection;
  const consent = connection?.consent_valid_until ?? null;
  // The same question the push and the banner ask, so this screen never
  // says "runs until" on a morning the phone was told "renew".
  const renewSoon = bank.attention?.kind === "renew";
  const consentDate = consent
    ? formatShortDate(consent.slice(0, 10), locale)
    : null;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <View
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: colors.success }}
        />
        <Text className="text-base font-semibold">
          {t("bankConnect.statusConnected")}
        </Text>
      </View>
      <Text variant="muted" className="text-sm">
        {connection?.last_synced_at
          ? t("bankConnect.lastSynced", {
              when: new Date(connection.last_synced_at).toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })
          : t("bankConnect.neverSynced")}
      </Text>
      {ownerCredentials ? (
        <Text variant="muted" className="text-xs">
          {t("bankConnect.sourceOwner")}
        </Text>
      ) : null}
      {consentDate ? (
        renewSoon ? (
          <View
            className="gap-3 rounded-control border px-3 py-3"
            style={{ borderColor: colors.warning }}
          >
            <Text className="text-sm">
              {t("bankConnect.consentSoon", { date: consentDate })}
            </Text>
            {/* Renewed at open-banking.io, where the consent was given: the
                file Pluclair holds does not change. */}
            <Button
              label={t("bankConnect.renew")}
              size="sm"
              className="self-start"
              onPress={() => void Linking.openURL(OPEN_BANKING_APP)}
            />
          </View>
        ) : (
          <Text variant="muted" className="text-sm">
            {t("bankConnect.consentUntil", { date: consentDate })}
          </Text>
        )
      ) : null}
      {onReplace ? (
        <Button
          label={t("bankConnect.replaceFile")}
          variant="ghost"
          size="sm"
          className="-ml-3 self-start"
          onPress={onReplace}
        />
      ) : null}
    </Card>
  );
}

/**
 * Which accounts hold spending money, and the tick that says so.
 *
 * On the phone now that the phone can connect a bank by itself: someone who
 * never opens the web app still has to say which account is the one they
 * spend from, or the Bearing's balance has nothing to read. The same column
 * the web's card writes, through the user's own row policy.
 */
function AccountsCard({
  accounts,
  onChanged,
}: {
  accounts: BankAccount[];
  onChanged: () => Promise<void>;
}) {
  const t = useT();
  const colors = useThemeColors();
  const formatMoney = useFormatCurrency();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const counted = accounts.filter((account) => account.counts_as_cash).length;

  async function toggle(account: BankAccount, next: boolean) {
    if (!user || pending) {
      return;
    }
    void hapticLight();
    setPending(true);
    const { error } = await supabase
      .from("bank_accounts")
      .update({ counts_as_cash: next })
      .eq("user_id", user.id)
      .eq("provider_account_id", account.provider_account_id);
    setPending(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    notifyDataChanged();
    await onChanged();
  }

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text className="text-base font-semibold">
          {t("bankConnect.accounts")}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("bankConnect.accountsBody")}
        </Text>
      </View>
      <View>
        {accounts.map((account, index) => (
          <View
            key={account.provider_account_id}
            className={cn(
              "min-h-14 flex-row items-center gap-3 py-2.5",
              index < accounts.length - 1 && "border-b border-border",
            )}
          >
            <View className="min-w-0 flex-1 gap-0.5">
              <Text numberOfLines={1} className="text-sm font-medium">
                {account.label}
              </Text>
              {account.needs_reconnect ? (
                <Text className="text-xs text-destructive">
                  {t("bearing.panel.cashAccountsLapsed")}
                </Text>
              ) : account.reported_balance !== null ? (
                <PrivateAmount className="text-xs text-muted-foreground">
                  {formatMoney(Number(account.reported_balance))}
                </PrivateAmount>
              ) : null}
            </View>
            <Switch
              accessibilityLabel={account.label}
              value={account.counts_as_cash}
              disabled={pending}
              trackColor={{ true: colors.primary }}
              onValueChange={(next) => void toggle(account, next)}
            />
          </View>
        ))}
      </View>
      <Text variant="muted" className="text-xs">
        {counted === 0
          ? t("cashAccounts.noneTicked")
          : t("cashAccounts.autoCloses")}
      </Text>
    </Card>
  );
}

/** Disconnect, asked: keep what the bank brought in (the default) or not. */
function DisconnectSheet({
  open,
  onOpenChange,
  onDisconnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnected: () => void;
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
    onDisconnected();
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
