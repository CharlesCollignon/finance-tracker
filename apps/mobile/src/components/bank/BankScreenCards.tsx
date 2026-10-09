import { useState } from "react";
import { Linking, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BANK_CONSENT_VERSION } from "@finance/core/bank-consent";
import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import type { BankState } from "@/hooks/useBankState";
import { confirmBankConsent, OPEN_BANKING_APP } from "@/lib/bank-connect";
import { hapticSuccess } from "@/lib/haptics";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The bank page's cards: the invitation to connect, the consent to renew,
 * a connection's trouble, and its state.
 */

/** What connecting unlocks — only what already exists for a bank-fed ledger. */
export function Invitation({
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
export function ConsentCard() {
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

export function ProblemCard({
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

export function StatusCard({
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
