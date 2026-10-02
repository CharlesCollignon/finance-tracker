import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import {
  connectBankFromFile,
  OPEN_BANKING_APP,
  OPEN_BANKING_DEVELOPERS,
} from "@/lib/bank-connect";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { BANK_CONSENT_VERSION } from "@finance/core/bank-consent";
import { resolveMessage } from "@finance/core/i18n/t";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface ConnectBankSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * What a connection leads to, when not the Bank screen. Setup passes its
   * own: the navigator sends an unfinished setup straight back to itself,
   * so leaving for the Bank screen from there would bounce.
   */
  onConnected?: () => void;
}

/**
 * Setting up a bank, from nothing to syncing — the web's sheet, step for step.
 *
 * The user brings their own open-banking.io account: sign up and pay there,
 * connect the bank there, download the credentials file, then choose it
 * here. The price is open-banking.io's and paid to them, and is said before
 * anyone leaves.
 *
 * "Choose the file" sends it to the server, which checks it against
 * open-banking.io before keeping it. A connection lands on the Bank screen,
 * where the history comes in; a refusal is said here, with its reason, and
 * the sheet stays, so trying again is one press.
 */
export function ConnectBankSheet({
  open,
  onOpenChange,
  onConnected,
}: ConnectBankSheetProps) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const colors = useThemeColors();

  async function choose() {
    if (pending) {
      return;
    }
    if (!consented) {
      setProblem(t("bankConnect.consentRequired"));
      return;
    }
    setProblem(null);
    setPending(true);
    const result = await connectBankFromFile(BANK_CONSENT_VERSION);
    setPending(false);

    if ("canceled" in result) {
      return;
    }
    if ("error" in result) {
      void hapticWarning();
      setProblem(resolveMessage(t, result.error));
      return;
    }
    void hapticSuccess();
    onOpenChange(false);
    toast(
      result.outcome === "paused"
        ? t("bankConnect.connectedPaused")
        : result.accounts === 0
          ? t("bankConnect.noAccountsYet")
          : t("bankConnect.connected"),
      result.outcome === "connected" && result.accounts > 0
        ? "success"
        : "default",
    );
    if (onConnected) {
      onConnected();
      return;
    }
    router.navigate("/bank" as Href);
  }

  const steps = [
    {
      title: t("bankConnect.step1Title"),
      body: t("bankConnect.step1Body"),
      href: OPEN_BANKING_APP,
    },
    { title: t("bankConnect.step2Title"), body: t("bankConnect.step2Body") },
    {
      title: t("bankConnect.step3Title"),
      body: t("bankConnect.step3Body"),
      href: OPEN_BANKING_DEVELOPERS,
    },
    { title: t("bankConnect.step4Title"), body: t("bankConnect.step4Body") },
  ];

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => onOpenChange(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          accessibilityLabel={t("common.cancel")}
          className="flex-1"
          onPress={() => onOpenChange(false)}
        />
        <View className="max-h-[88%] rounded-t-card border border-border bg-card p-card">
          <SheetGrabber />
          <Text className="font-semibold" style={{ fontSize: 18 }}>
            {t("bankConnect.sheetTitle")}
          </Text>
          <ScrollView
            className="mt-2"
            contentContainerClassName="gap-5 pb-2"
            showsVerticalScrollIndicator={false}
          >
            <Text variant="muted" className="text-sm">
              {t("bankConnect.sheetLead")}
            </Text>

            <View className="gap-4">
              {steps.map((step, index) => (
                <View key={step.title} className="flex-row gap-3">
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    className="h-7 w-7 items-center justify-center rounded-full bg-primary"
                  >
                    <Text className="text-sm font-semibold text-primary-foreground">
                      {String(index + 1)}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-sm font-medium">{step.title}</Text>
                    <Text variant="muted" className="text-sm">
                      {step.body}
                    </Text>
                    {step.href ? (
                      <Button
                        label={t("bankConnect.openSite")}
                        variant="ghost"
                        size="sm"
                        className="-ml-3 self-start"
                        onPress={() =>
                          void WebBrowser.openBrowserAsync(step.href)
                        }
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>

            <View className="gap-2 rounded-control border border-border p-3">
              {[
                t("bankConnect.factReadOnly"),
                t("bankConnect.factKey"),
                t("bankConnect.factConsent"),
                t("bankConnect.factHistory"),
                t("bankConnect.notRegulated"),
              ].map((fact) => (
                <Text key={fact} variant="muted" className="text-xs">
                  {fact}
                </Text>
              ))}
            </View>
            {/* Last before the file goes: who the data comes from, what is done
                with it, how it is withdrawn. Its version is stored. */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consented }}
              onPress={() => {
                setConsented((value) => !value);
                setProblem(null);
              }}
              className="flex-row gap-3 rounded-control border border-border p-3"
            >
              <Ionicons
                name={consented ? "checkbox" : "square-outline"}
                size={ICON.lg}
                color={consented ? colors.primaryInk : colors.mutedForeground}
              />
              <Text className="min-w-0 flex-1 text-xs leading-relaxed">
                {t("bankConnect.consentLabel")}
              </Text>
            </Pressable>
          </ScrollView>

          {problem ? (
            <Text
              accessibilityRole="alert"
              className="mt-3 rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm"
            >
              {problem}
            </Text>
          ) : null}

          <Button
            label={
              pending ? t("bankConnect.checking") : t("bankConnect.chooseFile")
            }
            size="lg"
            className="mt-4"
            disabled={pending || !consented}
            onPress={() => void choose()}
          />
        </View>
      </View>
    </Modal>
  );
}
