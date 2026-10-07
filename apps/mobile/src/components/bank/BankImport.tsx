import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { resolveMessage } from "@finance/core/i18n/t";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import {
  OPEN_BANKING_APP,
  finishBankImport,
  importAccountHistory,
  listImportAccounts,
} from "@/lib/bank-connect";
import { notifyDataChanged } from "@/lib/data-version";
import { hapticSuccess } from "@/lib/haptics";
import { reviewAsk } from "@/lib/review-ask";
import { useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

type AccountState =
  | { id: string; label: string; state: "waiting" | "running" }
  | { id: string; label: string; state: "done"; entries: number }
  | { id: string; label: string; state: "failed"; message: string };

/**
 * The first import of a whole history, driven from the phone.
 *
 * The web's walk, one account per request so no request outlasts the
 * server's time limit, each account shown as it goes. Leaving costs nothing:
 * an account's history is marked in only once it is, so the Bank screen
 * starts this again next time and rows already written are recognised and
 * skipped. Only current accounts come in, once the user has said which
 * those are, and the walk runs again when another starts waiting. An empty
 * list — a working file on an open-banking.io account with no bank
 * connected yet — waits rather than finishing, for the reason the web's
 * walk gives.
 */
export function BankImport({
  waiting,
}: {
  /** The current accounts whose history is not in yet, as the screen knows. */
  waiting: readonly string[];
}) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  const [accounts, setAccounts] = useState<AccountState[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [done, setDone] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [undecided, setUndecided] = useState(false);
  const [checking, setChecking] = useState(false);
  // Which accounts a walk has already been started for, and whether one is
  // under way: a walk is never started beside another, which would bring the
  // same account in twice. `walks` counts finished ones, so an account
  // ticked during one is looked at once it ends.
  const seen = useRef<Set<string> | null>(null);
  const running = useRef(false);
  const [walks, setWalks] = useState(0);

  const run = useCallback(async () => {
    setError(null);
    setEmpty(false);
    setUndecided(false);
    setChecking(true);
    const listed = await listImportAccounts();
    setChecking(false);
    if ("error" in listed) {
      setError(listed.error);
      return;
    }
    if (listed.accounts.length === 0) {
      // Accounts the bank shows but the user has not said what they are:
      // nothing of theirs comes in before that. Listing them just recorded
      // them, so the screen reads them again to show them.
      if (listed.undecided > 0) {
        setUndecided(true);
        notifyDataChanged("bank");
      } else {
        setEmpty(true);
      }
      return;
    }
    let rows: AccountState[] = listed.accounts.map((account) => ({
      ...account,
      state: "waiting",
    }));
    setAccounts(rows);

    let waiting = 0;
    for (const account of listed.accounts) {
      rows = rows.map((row) =>
        row.id === account.id ? { ...row, state: "running" } : row,
      );
      setAccounts(rows);
      const result = await importAccountHistory(account.id);
      rows = rows.map((row) =>
        row.id !== account.id
          ? row
          : "error" in result
            ? {
                id: row.id,
                label: row.label,
                state: "failed",
                message: result.error,
              }
            : {
                id: row.id,
                label: row.label,
                state: "done",
                entries: result.imported + result.pending,
              },
      );
      if (!("error" in result)) {
        waiting += result.pending;
      }
      setAccounts(rows);
    }

    setPending(waiting);
    if (rows.every((row) => row.state === "done")) {
      await finishBankImport();
      void hapticSuccess();
      setDone(true);
    }
    // Every account that came in announced itself as it landed, so every
    // screen's figures follow — those of a walk that stopped half-way too.
  }, []);

  const start = useCallback(() => {
    if (running.current) {
      return;
    }
    running.current = true;
    void run().finally(() => {
      running.current = false;
      setWalks((count) => count + 1);
    });
  }, [run]);

  // Once on arrival, then again whenever an account the walks have not seen
  // starts waiting — the screen read again after the user ticked one.
  useEffect(() => {
    if (running.current) {
      return;
    }
    const first = seen.current === null;
    const known = (seen.current ??= new Set());
    if (!first && waiting.every((id) => known.has(id))) {
      return;
    }
    for (const id of waiting) {
      known.add(id);
    }
    start();
  }, [waiting, walks, start]);

  return (
    <Card bezel innerClassName="gap-4 p-5" accessibilityLiveRegion="polite">
      <View className="gap-1">
        <Text className="text-base font-semibold">
          {done ? t("bankConnect.importDone") : t("bankConnect.importTitle")}
        </Text>
        {!done ? (
          <Text variant="muted" className="text-sm">
            {t("bankConnect.importBody")}
          </Text>
        ) : null}
      </View>

      {error ? (
        <Text className="text-sm text-destructive">
          {resolveMessage(t, error)}
        </Text>
      ) : null}

      {undecided ? (
        <Text className="text-sm">{t("bankConnect.importChooseAccounts")}</Text>
      ) : null}

      {empty ? (
        <View className="gap-3">
          <Text className="text-sm">{t("bankConnect.noAccountsYet")}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Button
              label={t("bankConnect.openSite")}
              onPress={() => void Linking.openURL(OPEN_BANKING_APP)}
            />
            <Button
              label={t("bankConnect.checkAgain")}
              variant="outline"
              disabled={checking}
              onPress={start}
            />
          </View>
        </View>
      ) : null}

      {accounts ? (
        <View className="gap-2">
          {accounts.map((account) => (
            <View
              key={account.id}
              className="min-h-11 flex-row items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5"
            >
              <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
                {account.state === "done" ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={ICON.md}
                    color={colors.success}
                  />
                ) : account.state === "failed" ? (
                  <Ionicons
                    name="alert-circle"
                    size={ICON.md}
                    color={colors.destructive}
                  />
                ) : account.state === "running" ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.mutedForeground}
                  />
                ) : (
                  <Ionicons
                    name="ellipse-outline"
                    size={ICON.md}
                    color={colors.mutedForeground}
                  />
                )}
                <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
                  {account.label}
                </Text>
              </View>
              <Text variant="muted" className="shrink-0 text-xs">
                {account.state === "done"
                  ? t("bankConnect.importAccountDone", {
                      count: account.entries,
                    })
                  : account.state === "failed"
                    ? resolveMessage(t, account.message)
                    : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {done ? (
        <View className="gap-2">
          {pending > 0 ? (
            <Button
              label={t("bankConnect.reviewCta", { count: pending })}
              onPress={() =>
                router.navigate({
                  pathname: "/transactions",
                  params: reviewAsk(),
                } as Href)
              }
            />
          ) : null}
          <Button
            label={t("bankConnect.toBearing")}
            variant={pending > 0 ? "outline" : "default"}
            onPress={() => router.navigate("/" as Href)}
          />
        </View>
      ) : null}
    </Card>
  );
}
