import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  describeTransferInvitation,
  type TransferInvitation,
} from "@finance/core/dca-need";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  acceptDcaTransferInvite,
  dismissDcaTransferInvite,
} from "@/lib/mutations";
import { useToast } from "@/providers/ToastProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

/**
 * « Faire suivre vos DCA » — the web twin carries the reasoning: their
 * transfer to the broker switched to « Selon vos DCA », or one created on the
 * salary's day, in one press; « Non merci » puts it away on every device.
 */
export function TransferInvite({
  invitation,
}: {
  invitation: TransferInvitation;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const colors = useThemeColors();
  const [pending, setPending] = useState(false);
  const [answered, setAnswered] = useState(false);

  if (answered) {
    return null;
  }

  function answer(
    work: () => Promise<{ error?: string; message?: string }>,
    good: boolean,
  ) {
    if (pending) {
      return;
    }
    setAnswered(true);
    setPending(true);
    void (async () => {
      const result = await work();
      setPending(false);
      if (result.error) {
        setAnswered(false);
        toast(result.error, "error");
        return;
      }
      if (good) {
        void hapticSuccess();
      }
      if (result.message) {
        toast(result.message, "success");
      }
    })();
  }

  return (
    <View accessibilityLabel={t("dcaInvite.title")}>
      <View className="flex-row items-center justify-between border-b border-border py-1 pl-4 pr-1">
        <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("dcaInvite.title")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("dcaInvite.dismiss")}
          disabled={pending}
          onPress={() => {
            void hapticLight();
            answer(() => dismissDcaTransferInvite(locale), false);
          }}
          className="min-h-11 min-w-11 items-center justify-center rounded-full"
        >
          <Ionicons
            name="close"
            size={ICON.md}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View className="gap-3 px-4 py-3">
        <PrivateAmount className="text-sm text-muted-foreground">
          {describeTransferInvitation(invitation, t, locale)}
        </PrivateAmount>
        <View className="flex-row flex-wrap items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => {
              void hapticLight();
              answer(() => acceptDcaTransferInvite(locale), true);
            }}
            className={cn(
              "min-h-11 justify-center rounded-full bg-primary px-4",
              pending && "opacity-60",
            )}
          >
            <Text className="text-sm font-medium text-primary-foreground">
              {invitation.kind === "follow"
                ? t("dcaInvite.followAction")
                : t("dcaInvite.createAction")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => {
              void hapticLight();
              answer(() => dismissDcaTransferInvite(locale), false);
            }}
            className={cn(
              "min-h-11 justify-center rounded-full px-4",
              pending && "opacity-60",
            )}
          >
            <Text className="text-sm text-muted-foreground">
              {t("dcaInvite.dismiss")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
