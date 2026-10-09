import { useCallback, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  BANK_CONSENT_VERSION,
  consentIsCurrent,
} from "@finance/core/bank-consent";
import { formatShortDate } from "@finance/core/constants";
import {
  awaitingRole,
  importsMovements,
  isFollowed,
} from "@finance/core/bank-accounts";
import { resolveMessage } from "@finance/core/i18n/t";

import { AddBankSheet } from "@/components/bank/AddBankSheet";
import { BankAccountsSection } from "@/components/bank/BankAccountsSection";
import { BankImport } from "@/components/bank/BankImport";
import { ConnectBankSheet } from "@/components/bank/ConnectBankSheet";
import { NewAccountsCard } from "@/components/bank/NewAccountsCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenError } from "@/components/ScreenError";
import { Screen } from "@/components/ui/Screen";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useBankState, type BankState } from "@/hooks/useBankState";
import { useRefreshable } from "@/hooks/useRefreshable";
import {
  confirmBankConsent,
  disconnectBank,
  OPEN_BANKING_APP,
  readBankServerFacts,
} from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { getBankAccounts } from "@/lib/queries";
import { getSavingsState } from "@/lib/savings-accounts";
import { useAuth } from "@/providers/AuthProvider";
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

  const { bank, reload } = useBankState();
  const { data, error, loading, refreshing, onRefresh } = useRefreshable(
    async () => {
      if (!user) {
        return { accounts: [], livrets: [] };
      }
      const [accounts, savings] = await Promise.all([
        getBankAccounts(user.id),
        getSavingsState(user.id),
      ]);
      return {
        accounts,
        livrets: savings.accounts.map(({ account }) => ({
          kind: account.kind,
          bankAccountId: account.bank_account_id,
        })),
      };
    },
    [user?.id],
    { reads: ["bank", "accounts"] },
  );
  const accounts = data?.accounts ?? null;

  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const refreshAll = useCallback(() => {
    if (user) {
      // A pull is someone asking again, so the deployment's answer is
      // asked again too rather than taken from the cache.
      void readBankServerFacts(user.id, { fresh: true }).then(() => reload());
    }
    onRefresh();
  }, [user, reload, onRefresh]);

  const connection = bank?.connection ?? null;
  const live = connection !== null && connection.status !== "revoked";
  const ownerCredentials = bank?.ownerCredentials ?? false;
  const syncing = ownerCredentials || (live && connection.status === "active");
  const waiting = useMemo(
    () =>
      (accounts ?? [])
        .filter(
          (account) =>
            importsMovements(account.role) &&
            account.history_imported_at === null &&
            !account.needs_reconnect,
        )
        .map((account) => account.provider_account_id),
    [accounts],
  );
  const awaiting = useMemo(() => awaitingRole(accounts ?? []), [accounts]);
  // A current account whose history is not in yet — of a first connection,
  // one made current since, or at a bank added since — or a first import
  // that has not yet found what to ask about. Not while accounts wait for
  // their role: nothing of theirs comes in before, and the question is the
  // new-accounts card's. Kept on screen once shown, so the walk's last word,
  // what is left to review, outlives the reload that finishing it causes.
  const needsImport =
    syncing &&
    (waiting.length > 0 ||
      (live && connection.backfilled_at === null && awaiting.length === 0));
  // The consent the reminder counts down to is the earliest among followed
  // banks; with more than one bank, the status says which.
  const consentBank = useMemo(() => {
    const followed = (accounts ?? []).filter(
      (account) =>
        isFollowed(account.role) &&
        account.bank_name,
    );
    if (new Set(followed.map((account) => account.bank_name)).size < 2) {
      return null;
    }
    const due = connection?.consent_valid_until?.slice(0, 10);
    return (
      followed.find(
        (account) => account.consent_valid_until?.slice(0, 10) === due,
      )?.bank_name ?? null
    );
  }, [accounts, connection?.consent_valid_until]);
  const [importShown, setImportShown] = useState(needsImport);
  if (needsImport && !importShown) {
    setImportShown(true);
  }

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
      ) : error && !accounts ? (
        // Offline, or the read failed: say so, with a way to try again,
        // rather than a page that looks like a bank with nothing in it.
        <View className="flex-1 justify-center">
          <ScreenError message={error} onRetry={onRefresh} />
        </View>
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

          {live && !consentIsCurrent(connection.consent_version) ? (
            <ConsentCard />
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
              consentBank={consentBank}
              ownerCredentials={ownerCredentials}
              onReplace={bank.available ? () => setConnectOpen(true) : null}
            />
          ) : null}

          {syncing && awaiting.length > 0 ? (
            <NewAccountsCard accounts={awaiting} />
          ) : null}

          {syncing && importShown ? <BankImport waiting={waiting} /> : null}

          <BankAccountsSection
            accounts={accounts ?? []}
            livrets={data?.livrets ?? []}
            onAddBank={syncing ? () => setAddOpen(true) : null}
          />

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
      <AddBankSheet open={addOpen} onOpenChange={setAddOpen} />
      <DisconnectSheet open={disconnectOpen} onOpenChange={setDisconnectOpen} />
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

/**
 * Today's consent, for a connection with none on record — the web's card,
 * the same words and the same stored version.
 */
function ConsentCard() {
  const t = useT();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function agree() {
    if (pending) {
      return;
    }
    setPending(true);
    const result = await confirmBankConsent(BANK_CONSENT_VERSION);
    setPending(false);
    if (result.error) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    // The consent announces itself, so this card goes on every screen
    // that drew one, not only here.
    void hapticSuccess();
  }

  return (
    <Card className="gap-3">
      <Text className="text-base font-semibold">
        {t("bankConnect.consentMissingTitle")}
      </Text>
      <Text variant="muted" className="text-sm">
        {t("bankConnect.consentMissingBody")}
      </Text>
      <Text className="rounded-control border border-border p-3 text-xs leading-relaxed">
        {t("bankConnect.consentLabel")}
      </Text>
      <Button
        label={t("bankConnect.consentConfirm")}
        className="self-start"
        disabled={pending}
        onPress={() => void agree()}
      />
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
  consentBank,
  ownerCredentials,
  onReplace,
}: {
  bank: BankState;
  /** The bank whose consent ends first, when the accounts say. */
  consentBank: string | null;
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
              {consentBank
                ? t("bankConnect.consentSoonAt", {
                    bank: consentBank,
                    date: consentDate,
                  })
                : t("bankConnect.consentSoon", { date: consentDate })}
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
            {consentBank
              ? t("bankConnect.consentUntilAt", {
                  bank: consentBank,
                  date: consentDate,
                })
              : t("bankConnect.consentUntil", { date: consentDate })}
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

/** Disconnect, asked: keep what the bank brought in (the default) or not. */
function DisconnectSheet({
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
