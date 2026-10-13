import { useEffect, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeOut, LinearTransition, useReducedMotion, ZoomIn } from "react-native-reanimated";

import { formatFullDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { DURATION } from "@finance/core/motion";
import { BANK_NAMES, isBankId } from "@finance/core/statement";
import type { InboxView, MailItem } from "@finance/data/statements";

import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { dismissMailItem, readInboxView, renewInbox, startInbox, stopInbox } from "@/lib/statements";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** How long a forwarding code is worth showing. */
const CODE_FRESH_MS = 60 * 60 * 1000;

/** How often to look for the first e-mail, or a code, while the person sets it up. */
const LISTEN_EVERY_MS = 6000;

/** And for how long. */
const LISTEN_FOR_MS = 15 * 60 * 1000;

type Service = "gmail" | "outlook" | "other";

const STEPS = {
  gmail: ["statements.mailGmail1", "statements.mailGmail2", "statements.mailGmail3"],
  outlook: ["statements.mailOutlook1", "statements.mailOutlook2", "statements.mailOutlook3"],
  other: ["statements.mailOther1", "statements.mailOther2"],
} as const;

/**
 * What came by e-mail for an account not known yet, on the phone: each to
 * open — the account picked once — or to set aside. The web's twin is
 * `MailWaiting` in `components/finance/statements/MailInbox.tsx`.
 */
export function MailWaiting({
  items,
  onOpen,
  onDismissed,
}: {
  items: readonly MailItem[];
  onOpen: (item: MailItem) => void;
  onDismissed: (itemId: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (items.length === 0) {
    return null;
  }
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(DURATION.panel)}
      layout={reduceMotion ? undefined : LinearTransition.duration(DURATION.panel)}
      className="gap-2 rounded-card border border-border bg-card/70 p-card"
    >
      <View className="flex-row items-center gap-2 pb-1">
        <Ionicons name="mail-open-outline" size={ICON.md} color={colors.primary} />
        <Text variant="head">{t("statements.mailWaitingTitle")}</Text>
      </View>
      {items.map((item, index) => {
        const bank = item.bank && isBankId(item.bank) ? BANK_NAMES[item.bank] : null;
        const lines = item.statement.blocks[0]?.lines.length ?? 0;
        return (
          <Animated.View
            key={item.id}
            entering={reduceMotion ? undefined : FadeInLeft.delay(index * 60).duration(DURATION.panel)}
            exiting={reduceMotion ? undefined : FadeOut.duration(DURATION.press)}
            className="gap-2 border-t border-border py-3"
          >
            <View className="gap-0.5">
              <Text className="text-sm font-medium">
                {item.kind === "alerts"
                  ? t("statements.mailAlerts", { count: lines, bank: bank ?? t("statements.mailYourBank") })
                  : bank
                    ? t("statements.statementOf", { bank })
                    : (item.fileName ?? t("statements.statement"))}
              </Text>
              <Text variant="micro">
                {t("statements.mailArrived", { day: formatFullDate(item.receivedAt.slice(0, 10), locale) })}
                {item.kind === "statement" ? ` · ${t("statements.lines", { count: lines })}` : ""}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Button label={t("statements.mailPick")} size="sm" disabled={busy !== null} onPress={() => onOpen(item)} />
              <Button
                label={t("statements.mailDismiss")}
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onPress={() => {
                  setBusy(item.id);
                  void dismissMailItem(item.id).then((result) => {
                    setBusy(null);
                    if (result.ok) {
                      onDismissed(item.id);
                    } else {
                      toast(resolveMessage(t, result.error ?? "errors.couldNotSave"), "error");
                    }
                  });
                }}
              />
            </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

/**
 * « Vos relevés par e-mail, tout seuls », on the phone: the person's own
 * address — selectable, and shared to their mail app in a tap — how to
 * forward their bank's e-mails there, Gmail's confirmation code the moment
 * it arrives, what has come, and the address changed or stopped. The web's
 * twin is `MailInbox` in `components/finance/statements/MailInbox.tsx`.
 */
export function MailInbox({ view: initial, onView }: { view: InboxView; onView?: (view: InboxView) => void }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const [view, setView] = useState(initial);
  const [service, setService] = useState<Service>("gmail");
  const [renewing, setRenewing] = useState(false);
  const [pending, setPending] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const inbox = view.inbox;
  const listening = Boolean(inbox?.enabled && inbox.mailsRead === 0);

  useEffect(() => {
    if (!listening) {
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > LISTEN_FOR_MS) {
        clearInterval(timer);
        return;
      }
      void readInboxView().then((next) => {
        if (next) {
          setView(next);
          onView?.(next);
        }
      });
    }, LISTEN_EVERY_MS);
    return () => clearInterval(timer);
  }, [listening, onView]);

  if (!view.available) {
    return null;
  }

  async function act(run: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const result = await run();
    if (!result.ok) {
      setPending(false);
      toast(resolveMessage(t, result.error ?? "errors.couldNotSave"), "error");
      return;
    }
    void hapticSuccess();
    const next = await readInboxView();
    setPending(false);
    if (next) {
      setView(next);
      onView?.(next);
    }
  }

  const codeFresh =
    inbox?.forwardCode && inbox.forwardCodeAt && openedAt - new Date(inbox.forwardCodeAt).getTime() < CODE_FRESH_MS;

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(DURATION.panel)}
      className="gap-5 rounded-card border border-border bg-card/70 p-card"
    >
      <View className="flex-row items-start gap-3">
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.primary }}
        >
          <Ionicons name="mail" size={ICON.lg} color={colors.primaryForeground} />
        </Animated.View>
        <View className="flex-1 gap-1">
          <Text variant="head">{t("statements.mailTitle")}</Text>
          <Text variant="muted" className="leading-5">
            {t("statements.mailBody")}
          </Text>
        </View>
      </View>

      {!inbox ? (
        <Button
          label={pending ? t("statements.mailStarting") : t("statements.mailStart")}
          icon="mail-outline"
          disabled={pending}
          onPress={() => void act(startInbox)}
        />
      ) : !inbox.enabled ? (
        <View className="gap-3">
          <Text variant="muted">{t("statements.mailStopped")}</Text>
          <Button label={t("statements.mailRestart")} size="sm" disabled={pending} onPress={() => void act(startInbox)} />
        </View>
      ) : (
        <>
          <View className="gap-2">
            <Text className="text-sm font-medium">{t("statements.mailAddress")}</Text>
            <View className="rounded-control border border-border bg-background px-3 py-2">
              <Text selectable className="font-mono text-sm">
                {view.address}
              </Text>
            </View>
            <Button
              label={t("statements.mailShare")}
              icon="share-outline"
              variant="outline"
              size="sm"
              onPress={() => {
                void hapticLight();
                void Share.share({ message: view.address ?? "" });
              }}
            />
          </View>

          {codeFresh ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.springify().damping(16)}
              accessibilityLiveRegion="polite"
              className="gap-2 rounded-control border border-primary/40 bg-accent p-4"
            >
              <Text className="text-sm font-medium">{t("statements.mailCodeTitle")}</Text>
              <Text selectable className="font-mono text-2xl tracking-widest">
                {inbox.forwardCode}
              </Text>
              <Text variant="micro">{t("statements.mailCodeBody")}</Text>
              {inbox.forwardLink ? (
                <Button
                  label={t("statements.mailCodeConfirm")}
                  icon="open-outline"
                  size="sm"
                  onPress={() => void WebBrowser.openBrowserAsync(inbox.forwardLink!)}
                />
              ) : null}
            </Animated.View>
          ) : null}

          <View className="gap-3">
            <Text className="text-sm font-medium">{t("statements.mailHow")}</Text>
            <ChoiceChips
              label={t("statements.mailHow")}
              options={[
                { value: "gmail" as const, label: "Gmail" },
                { value: "outlook" as const, label: "Outlook" },
                { value: "other" as const, label: t("statements.mailOther") },
              ]}
              value={service}
              onChange={setService}
            />
            <Animated.View key={service} entering={reduceMotion ? undefined : FadeIn.duration(DURATION.panel)} className="gap-2.5">
              {STEPS[service].map((step, index) => (
                <View key={step} className="flex-row gap-3">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-muted">
                    <Text className="text-xs font-semibold">{index + 1}</Text>
                  </View>
                  <Text variant="muted" className="flex-1 leading-5">
                    {t(step)}
                  </Text>
                </View>
              ))}
            </Animated.View>
            <Text variant="micro">{t("statements.mailAlertsTip")}</Text>
          </View>

          <Text variant="muted" accessibilityLiveRegion="polite">
            {inbox.lastMailAt
              ? [
                  t("statements.mailLast", { day: formatFullDate(inbox.lastMailAt.slice(0, 10), locale) }),
                  t("statements.mailLines", { count: inbox.linesBrought }),
                  inbox.mailsIgnored > 0 ? t("statements.mailIgnored", { count: inbox.mailsIgnored }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : t("statements.mailListening")}
          </Text>

          <View className="flex-row flex-wrap gap-2">
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => {
                if (!renewing) {
                  setRenewing(true);
                  return;
                }
                setRenewing(false);
                void act(renewInbox);
              }}
              className="min-h-11 justify-center px-2"
            >
              <Text variant="muted" className="font-medium">
                {renewing ? t("statements.mailRenewSure") : t("statements.mailRenew")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => void act(stopInbox)}
              className="min-h-11 justify-center px-2"
            >
              <Text variant="muted" className="font-medium">
                {t("statements.mailStop")}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </Animated.View>
  );
}
