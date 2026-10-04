import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  AI_MODELS,
  type AiCreditState,
  type AiModel,
} from "@finance/core/ai-models";
import { aiBrandOf } from "@finance/core/ai-brands";
import { formatCurrency } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";

import { AiMark } from "@/components/AiMark";
import { Button } from "@/components/ui/Button";
import { ListRow, ListSection } from "@/components/ui/ListRow";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import {
  connectAiAccount,
  getAiCredit,
  OUTCOME_MESSAGES,
} from "@/lib/ai-account";
import { cn } from "@/lib/cn";
import { chooseAiModel, disconnectAiAccount } from "@/lib/mutations";
import { getAiConnection } from "@/lib/queries";
import { useLocaleContext } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

/** The rows of this section that open an editor under them. */
export type AiAccountRow = "aiConnect" | "aiModel" | "aiDisconnect";

/**
 * The user's own AI account (docs/plans/AI_ACCOUNT_PLAN.md, Phase 3), as on
 * the web's Profile: not connected, one row and the consent under it;
 * connected, the model, what the key has spent, and the way out. OpenRouter
 * opens in a browser session and hands back to the app by its link.
 */
export function AiAccountSection({
  userId,
  open,
  onToggle,
  onClose,
}: {
  userId: string;
  /** The Profile's open row: one at a time, across every section. */
  open: string | null;
  onToggle: (row: AiAccountRow) => void;
  onClose: () => void;
}) {
  const { locale, t } = useLocaleContext();
  const { toast } = useToast();
  const colors = useThemeColors();
  const [pending, setPending] = useState(false);

  const { data: model, loading } = useRefreshable(
    () => getAiConnection(userId),
    [userId],
    { reads: ["preferences"] },
  );
  const connected = model !== null;
  // Asked of OpenRouter through the server whenever the connection changes;
  // never stored, so a stale figure is never shown as current.
  const { data: credit } = useRefreshable(
    async () => (connected ? await getAiCredit() : null),
    [userId, connected],
    { reads: ["preferences"] },
  );

  async function connect() {
    setPending(true);
    const result = await connectAiAccount();
    setPending(false);
    if ("error" in result) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    if (result.outcome === "cancelled") {
      return;
    }
    toast(
      t(OUTCOME_MESSAGES[result.outcome]),
      result.outcome === "connected" ? "success" : "error",
    );
    if (result.outcome === "connected") {
      onClose();
    }
  }

  async function choose(next: AiModel) {
    if (next.id === model?.id) {
      onClose();
      return;
    }
    setPending(true);
    const result = await chooseAiModel(next.id);
    setPending(false);
    if (!result.success) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    toast(t("aiAccount.modelChosen", { model: next.name }), "success");
    onClose();
  }

  async function disconnect() {
    setPending(true);
    const result = await disconnectAiAccount();
    setPending(false);
    if (!result.success) {
      toast(resolveMessage(t, result.error), "error");
      return;
    }
    toast(t("aiAccount.disconnected"), "success");
    onClose();
  }

  // Nothing until the connection is known: a Connect row that turns into a
  // Model row a moment later reads as the Profile changing its mind.
  if (loading && model === null) {
    return null;
  }

  const consent =
    open === "aiConnect" ? (
      <View className="gap-3">
        <Text>{t("aiAccount.consentWhat")}</Text>
        <Text variant="micro">{t("aiAccount.consentSent")}</Text>
        <Text variant="micro">{t("aiAccount.consentWhere")}</Text>
        <Button
          label={pending ? t("aiAccount.continuing") : t("aiAccount.continue")}
          disabled={pending}
          onPress={() => void connect()}
        />
        <Button
          label={t("common.cancel")}
          variant="ghost"
          disabled={pending}
          onPress={onClose}
        />
      </View>
    ) : null;

  if (!connected) {
    return (
      <ListSection
        title={t("aiAccount.section")}
        footer={t("aiAccount.footer")}
      >
        <ListRow
          icon="sparkles-outline"
          label={t("aiAccount.connect")}
          hint={t("aiAccount.connectHint")}
          onPress={() => onToggle("aiConnect")}
          expanded={consent}
        />
      </ListSection>
    );
  }

  const dollars = (amount: number) => formatCurrency(amount, "USD", locale);
  const refused = credit?.state === "refused";

  return (
    <ListSection
      title={t("aiAccount.section")}
      footer={t("aiAccount.footerConnected")}
    >
      <ListRow
        icon="sparkles-outline"
        label={t("aiAccount.model")}
        value={open === "aiModel" ? undefined : model.name}
        valueMark={<ModelMark model={model} />}
        onPress={() => onToggle("aiModel")}
        expanded={
          open === "aiModel" ? (
            <View accessibilityRole="radiogroup">
              {AI_MODELS.map((option) => {
                const chosen = option.id === model.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: chosen }}
                    disabled={pending}
                    onPress={() => void choose(option)}
                    className="min-h-12 flex-row items-center justify-between gap-3 py-2.5"
                  >
                    <ModelMark model={option} />
                    <Text className={cn("flex-1", chosen && "font-semibold")}>
                      {option.name}
                    </Text>
                    <Ionicons
                      name={chosen ? "radio-button-on" : "radio-button-off"}
                      size={ICON.md}
                      color={
                        chosen ? colors.foreground : colors.mutedForeground
                      }
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null
        }
      />
      {/* A key OpenRouter refuses writes nothing, so that row is the way
          back in: the consent again, and a new key on the same model. */}
      <ListRow
        icon="wallet-outline"
        {...creditRow(credit, dollars, t)}
        destructive={refused}
        onPress={refused ? () => onToggle("aiConnect") : undefined}
        expanded={refused ? consent : null}
      />
      <ListRow
        icon="unlink-outline"
        label={t("aiAccount.disconnect")}
        destructive
        onPress={() => onToggle("aiDisconnect")}
        expanded={
          open === "aiDisconnect" ? (
            <View className="gap-3">
              <Text variant="micro">{t("aiAccount.disconnectBlurb")}</Text>
              <Button
                label={t("aiAccount.disconnect")}
                variant="outline"
                disabled={pending}
                onPress={() => void disconnect()}
              />
            </View>
          ) : null
        }
      />
    </ListSection>
  );
}

/** A model's maker, as its mark in its own colour. */
function ModelMark({ model }: { model: AiModel }) {
  const brand = aiBrandOf(model.id);
  return brand ? <AiMark brand={brand} /> : null;
}

/** The credit row's words: spent this month, and what the limit leaves. */
function creditRow(
  credit: AiCreditState | null,
  dollars: (amount: number) => string,
  t: ReturnType<typeof useLocaleContext>["t"],
): { label: string; hint?: string; value?: string } {
  if (credit?.state === "refused") {
    return {
      label: t("aiAccount.keyRefused"),
      hint: t("aiAccount.keyRefusedHint"),
    };
  }
  if (credit?.state === "ok") {
    const { usageMonthly, limit, limitRemaining } = credit.credit;
    return {
      label: t("aiAccount.credit"),
      hint:
        limit !== null && limitRemaining !== null
          ? t("aiAccount.creditLeft", {
              left: dollars(limitRemaining),
              limit: dollars(limit),
            })
          : t("aiAccount.creditNoLimit"),
      value: dollars(usageMonthly),
    };
  }
  return {
    label: t("aiAccount.credit"),
    hint: credit ? t("aiAccount.creditUnknown") : undefined,
    value: credit ? "—" : "…",
  };
}
