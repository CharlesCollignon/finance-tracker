import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { consentIsCurrent } from "@finance/core/bank-consent";
import {
  awaitingRole,
  importsMovements,
  isFollowed,
} from "@finance/core/bank-accounts";
import { AddBankSheet } from "@/components/bank/AddBankSheet";
import { BankAccountsSection } from "@/components/bank/BankAccountsSection";
import { BankImport } from "@/components/bank/BankImport";
import { ConnectBankSheet } from "@/components/bank/ConnectBankSheet";
import { NewAccountsCard } from "@/components/bank/NewAccountsCard";
import { Button } from "@/components/ui/Button";
import { ScreenError } from "@/components/ScreenError";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { useBankState } from "@/hooks/useBankState";
import { useRefreshable } from "@/hooks/useRefreshable";
import { readBankServerFacts } from "@/lib/bank-connect";
import { getBankAccounts } from "@/lib/queries";
import { getSavingsState } from "@/lib/savings-accounts";
import { useAuth } from "@/providers/AuthProvider";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";
import {
  ConsentCard,
  Invitation,
  ProblemCard,
  StatusCard,
} from "@/components/bank/BankScreenCards";
import { DisconnectSheet } from "@/components/bank/DisconnectSheet";

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
