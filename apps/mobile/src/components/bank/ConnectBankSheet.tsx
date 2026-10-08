import { useEffect, useState } from "react";
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
  readBankWizardStep,
  saveBankWizardStep,
} from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { BANK_CONSENT_VERSION } from "@finance/core/bank-consent";
import {
  BANK_WIZARD_STEPS,
  bankWizardStepFor,
  type BankWizardStep,
} from "@finance/core/bank-wizard";
import { resolveMessage } from "@finance/core/i18n/t";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
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
 * Setting up a bank, from nothing to syncing — the web's wizard, step for
 * step.
 *
 * The user brings their own open-banking.io account: sign up and pay there,
 * connect the bank there, download the credentials file, then choose it
 * here. One step at a time, each with « C'est fait »; the price is
 * open-banking.io's and paid to them, and is said on the first. The site
 * opens in the in-app browser, and the file is picked from wherever it was
 * downloaded. The step reached is remembered for the account, so a setup
 * begun on the computer carries on here.
 *
 * "Choose the file" sends it to the server, which checks it against
 * open-banking.io before keeping it. A connection lands on the Bank screen,
 * where the history comes in; a refusal is said on the step where it is put
 * right (`bankWizardStepFor`), and trying again is one press.
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
  const [step, setStep] = useState<BankWizardStep>(1);
  const colors = useThemeColors();
  const locale = useLocale();
  const { user } = useAuth();

  // Where this account stopped, on whichever device, each time it opens.
  useEffect(() => {
    if (!open || !user) {
      return;
    }
    let current = true;
    void readBankWizardStep(user.id).then((reached) => {
      if (current) {
        setStep(reached);
      }
    });
    return () => {
      current = false;
    };
  }, [open, user]);

  function goTo(next: BankWizardStep) {
    void hapticLight();
    setProblem(null);
    setStep(next);
    if (user) {
      void saveBankWizardStep(user.id, next, locale);
    }
  }

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
      setStep(bankWizardStepFor(result.error));
      setProblem(resolveMessage(t, result.error));
      return;
    }
    if (result.outcome === "connected" && result.accounts === 0) {
      // The file works; the bank is what is missing. Back to connecting it,
      // from where « C'est fait » leads on to the file again.
      void hapticWarning();
      setStep(2);
      setProblem(t("bankConnect.noAccountsYet"));
      return;
    }
    void hapticSuccess();
    onOpenChange(false);
    toast(
      result.outcome === "paused"
        ? t("bankConnect.connectedPaused")
        : t("bankConnect.connected"),
      result.outcome === "connected" ? "success" : "default",
    );
    if (onConnected) {
      onConnected();
      return;
    }
    router.navigate("/bank" as Href);
  }

  const steps: Record<
    BankWizardStep,
    { title: string; body: string; href?: string }
  > = {
    1: {
      title: t("bankConnect.step1Title"),
      body: t("bankConnect.step1Body"),
      href: OPEN_BANKING_APP,
    },
    2: { title: t("bankConnect.step2Title"), body: t("bankConnect.step2Body") },
    3: {
      title: t("bankConnect.step3Title"),
      body: t("bankConnect.step3Body"),
      href: OPEN_BANKING_DEVELOPERS,
    },
    4: { title: t("bankConnect.step4Title"), body: t("bankConnect.step4Body") },
  };
  const shown = steps[step];

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
            {step === 1 ? (
              <Text variant="muted" className="text-sm">
                {t("bankConnect.sheetLead")}
              </Text>
            ) : null}

            <View className="flex-row items-center justify-between gap-3">
              <Text variant="muted" className="text-xs font-medium">
                {t("bankConnect.stepOf", { step, total: BANK_WIZARD_STEPS })}
              </Text>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="flex-row gap-1.5"
              >
                {[1, 2, 3, 4].map((dot) => (
                  <View
                    key={dot}
                    className={cn(
                      "h-1.5 w-6 rounded-full",
                      dot <= step ? "bg-primary" : "bg-muted",
                    )}
                  />
                ))}
              </View>
            </View>

            <View accessibilityLiveRegion="polite" className="flex-row gap-3">
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="h-7 w-7 items-center justify-center rounded-full bg-primary"
              >
                <Text className="text-sm font-semibold text-primary-foreground">
                  {String(step)}
                </Text>
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <Text accessibilityRole="header" className="text-sm font-medium">
                  {shown.title}
                </Text>
                <Text variant="muted" className="text-sm">
                  {shown.body}
                </Text>
                {shown.href ? (
                  <Button
                    label={t("bankConnect.openSite")}
                    variant="outline"
                    size="sm"
                    className="mt-3 self-start"
                    onPress={() =>
                      void WebBrowser.openBrowserAsync(shown.href!)
                    }
                  />
                ) : null}
              </View>
            </View>

            {step === 3 ? <RightFile /> : null}

            {step === 4 ? (
              <>
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
                {/* Last before the file goes: who the data comes from, what
                    is done with it, how it is withdrawn. Its version is
                    stored. */}
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
                    color={
                      consented ? colors.primaryInk : colors.mutedForeground
                    }
                  />
                  <Text className="min-w-0 flex-1 text-xs leading-relaxed">
                    {t("bankConnect.consentLabel")}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>

          {problem ? (
            <Text
              accessibilityRole="alert"
              className="mt-3 rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm"
            >
              {problem}
            </Text>
          ) : null}

          {step === 4 ? (
            <Button
              label={
                pending ? t("bankConnect.checking") : t("bankConnect.chooseFile")
              }
              size="lg"
              className="mt-4"
              disabled={pending || !consented}
              onPress={() => void choose()}
            />
          ) : null}

          <View className="mt-3 flex-row items-center justify-between gap-3">
            {step > 1 ? (
              <Button
                label={t("bankConnect.previous")}
                variant="ghost"
                size="sm"
                onPress={() => goTo((step - 1) as BankWizardStep)}
              />
            ) : (
              <View />
            )}
            {step < 4 ? (
              <Button
                label={t("bankConnect.done")}
                size="sm"
                onPress={() => goTo((step + 1) as BankWizardStep)}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The trap of the third step, drawn, as on the web: the file to take comes
 * from the API key's window, and the « Clé de chiffrement » card gives one
 * with the same name and no key.
 */
function RightFile() {
  const t = useT();
  const colors = useThemeColors();
  return (
    <View className="gap-2">
      <Text variant="muted" className="text-xs font-medium">
        {t("bankConnect.trapTitle")}
      </Text>
      <View className="gap-2 rounded-control border border-success/50 p-3">
        <Text variant="muted" className="text-xs">
          {t("bankConnect.trapRight")}
        </Text>
        <Text className="rounded-control bg-muted px-2 py-1.5 font-mono text-xs">
          {t("bankConnect.trapFile")}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="checkmark-circle" size={ICON.sm} color={colors.success} />
          <Text className="text-xs font-medium text-success">
            {t("bankConnect.trapRightNote")}
          </Text>
        </View>
      </View>
      <View className="gap-2 rounded-control border border-destructive/40 p-3">
        <Text variant="muted" className="text-xs">
          {t("bankConnect.trapWrong")}
        </Text>
        <Text className="rounded-control bg-muted px-2 py-1.5 font-mono text-xs opacity-70">
          {t("bankConnect.trapFile")}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="close-circle" size={ICON.sm} color={colors.destructive} />
          <Text className="text-xs font-medium text-destructive">
            {t("bankConnect.trapWrongNote")}
          </Text>
        </View>
      </View>
    </View>
  );
}
