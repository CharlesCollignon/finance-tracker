import { useState } from "react";
import { View } from "react-native";

import { AI_BRANDS } from "@finance/core/ai-brands";
import { resolveMessage } from "@finance/core/i18n/t";

import { AiMark } from "@/components/AiMark";
import { FadeIn } from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { connectAiAccount, OUTCOME_MESSAGES } from "@/lib/ai-account";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

/**
 * The onboarding's last step, behind `ai.account`, as on the web: what the
 * written reads are, and that they are written on the reader's own AI
 * account — said before OpenRouter opens, with what is sent and where it
 * goes. OpenRouter opens in a browser session that hands back to this very
 * screen (`pluclair://onboarding`), so a refusal leaves the step here to try
 * again or to leave for later.
 */
export function AiWelcomeStep({ onDone }: { onDone: () => void }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function connect() {
    setPending(true);
    const result = await connectAiAccount("welcome");
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
      onDone();
    }
  }

  return (
    <FadeIn className="gap-6">
      <View className="gap-3">
        <View className="flex-row gap-3">
          {AI_BRANDS.map((brand) => (
            <View
              key={brand}
              className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
            >
              <AiMark brand={brand} size={20} />
            </View>
          ))}
        </View>
        <Text className="text-2xl font-bold">{t("aiAccount.welcomeTitle")}</Text>
        <Text variant="muted">{t("aiAccount.welcomeBody")}</Text>
      </View>

      <Card bezel innerClassName="gap-3 p-5">
        <Text className="text-sm">{t("aiAccount.welcomeHow")}</Text>
        <Text className="text-sm">{t("aiAccount.welcomeCost")}</Text>
        <Text variant="micro">{t("aiAccount.consentSent")}</Text>
        <Text variant="micro">{t("aiAccount.consentWhere")}</Text>
      </Card>

      <View className="gap-2">
        <Button
          label={
            pending ? t("aiAccount.continuing") : t("aiAccount.welcomeConnect")
          }
          size="lg"
          disabled={pending}
          onPress={() => void connect()}
        />
        <Button
          label={t("onboarding.skipForNow")}
          variant="ghost"
          disabled={pending}
          onPress={onDone}
        />
        <Text variant="micro" className="text-center">
          {t("aiAccount.welcomeLater")}
        </Text>
      </View>
    </FadeIn>
  );
}
