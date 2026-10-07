import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { resolveMessage } from "@finance/core/i18n/t";

import { Button } from "@/components/ui/Button";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { useAppForeground } from "@/hooks/useAppForeground";
import { findNewBankAccounts, OPEN_BANKING_APP } from "@/lib/bank-connect";
import { hapticSuccess } from "@/lib/haptics";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

type Look =
  | { state: "idle" }
  | { state: "looking" }
  | { state: "nothing" }
  | { state: "failed"; message: string };

/**
 * Adding a second bank, or a third — the web's sheet. Nothing to upload: the
 * credentials file Pluclair holds reads every bank in the user's
 * open-banking.io account, so a bank is added there, in the in-app browser,
 * and only has to be found here. The sheet looks by itself once they are
 * back — when the browser closes on iOS, when the app returns to the front
 * on Android — and « Vérifier maintenant » is kept for a bank that took a
 * while. When something turns up the sheet gets out of the way: the screen
 * behind it is already asking what the new accounts are.
 */
export function AddBankSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [look, setLook] = useState<Look>({ state: "idle" });
  // Whether they went to open-banking.io from here: coming back to an app
  // they never left is not a reason to ask the bank anything.
  const left = useRef(false);
  const looking = useRef(false);

  const close = useCallback(() => {
    left.current = false;
    setLook({ state: "idle" });
    onOpenChange(false);
  }, [onOpenChange]);

  const lookNow = useCallback(async () => {
    if (looking.current) {
      return;
    }
    looking.current = true;
    setLook({ state: "looking" });
    const result = await findNewBankAccounts();
    looking.current = false;
    if ("error" in result) {
      setLook({ state: "failed", message: resolveMessage(t, result.error) });
      return;
    }
    if (result.awaiting === 0) {
      setLook({ state: "nothing" });
      return;
    }
    void hapticSuccess();
    close();
    toast(t("bankAccounts.addFound", { count: result.awaiting }), "success");
  }, [t, toast, close]);

  useAppForeground(() => {
    if (open && left.current) {
      void lookNow();
    }
  });

  async function openSite() {
    left.current = true;
    const result = await WebBrowser.openBrowserAsync(OPEN_BANKING_APP);
    // iOS answers once the browser is closed; Android as it opens, and
    // says the app came back through the foreground instead.
    if (result.type !== WebBrowser.WebBrowserResultType.OPENED) {
      void lookNow();
    }
  }

  const steps = [
    {
      title: t("bankAccounts.addStep1Title"),
      body: t("bankAccounts.addStep1Body"),
      open: true,
    },
    {
      title: t("bankAccounts.addStep2Title"),
      body: t("bankAccounts.addStep2Body"),
      open: false,
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
        <View className="max-h-[88%] rounded-t-card border border-border bg-card p-card">
          <SheetGrabber />
          <Text className="font-semibold" style={{ fontSize: 18 }}>
            {t("bankAccounts.addBank")}
          </Text>
          <ScrollView
            className="mt-2"
            contentContainerClassName="gap-5 pb-2"
            showsVerticalScrollIndicator={false}
          >
            <Text variant="muted" className="text-sm">
              {t("bankAccounts.addLead")}
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
                    {step.open ? (
                      <Button
                        label={t("bankConnect.openSite")}
                        size="sm"
                        className="mt-2 self-start"
                        onPress={() => void openSite()}
                      />
                    ) : null}
                  </View>
                </View>
              ))}
            </View>

            <View className="gap-2" accessibilityLiveRegion="polite">
              <Button
                label={
                  look.state === "looking"
                    ? t("bankAccounts.addLooking")
                    : t("bankAccounts.addCheck")
                }
                variant="outline"
                disabled={look.state === "looking"}
                onPress={() => void lookNow()}
              />
              {look.state === "nothing" ? (
                <Text variant="muted" className="text-sm">
                  {t("bankAccounts.addNothing")}
                </Text>
              ) : look.state === "failed" ? (
                <Text className="text-sm text-destructive">
                  {look.message}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
