import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { closeInvitation } from "@finance/core/month-close";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The month's close, in the Plan footer as on the web's `MonthCloseCard`:
 * the one place the app asks for something it cannot work out itself. It was
 * the first thing on the phone's Plan, above the budgets, and had no streak.
 *
 * Which of the four invitations it opens with is `closeInvitation`'s call, the
 * same one the web makes. The sheet stays with the screen, which freezes the
 * figures it reads while it is open.
 */
export function MonthCloseCard({
  monthLabel,
  isBaseline,
  unrecordedCap,
  baseline,
  streak,
  onOpen,
}: {
  monthLabel: string;
  isBaseline: boolean;
  unrecordedCap: number | null;
  baseline: number | null;
  /** Months closed in a row; the chip shows from two. */
  streak: number;
  onOpen: () => void;
}) {
  const t = useT();
  const formatMoney = useFormatCurrency();
  const colors = useThemeColors();
  const { hidden } = usePrivacy();

  const invitation = closeInvitation({ isBaseline, unrecordedCap, baseline });
  const detail =
    invitation.kind === "baseline"
      ? t("monthClose.inviteBaseline")
      : invitation.kind === "allowance"
        ? t("monthClose.inviteAllowance", { cap: formatMoney(invitation.cap) })
        : invitation.kind === "normal"
          ? t("monthClose.inviteNormal", {
              amount: formatMoney(invitation.baseline),
            })
          : t("monthClose.inviteBare");
  // Two of the four name a figure of the user's own — their allowance, or
  // what a normal month has cost them — and go under the mask with it.
  const detailHasAmount =
    invitation.kind === "allowance" || invitation.kind === "normal";

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text
            accessibilityRole="header"
            className="shrink font-semibold"
            style={{ fontSize: 17 }}
          >
            {isBaseline
              ? t("monthClose.setStartingBalance")
              : t("month.attentionReadyToClose", { month: monthLabel })}
          </Text>
          {streak > 1 ? (
            <View
              accessible
              accessibilityLabel={t("monthClose.monthsInARow", {
                count: streak,
              })}
              className="flex-row items-center gap-1 rounded-full bg-accent px-2 py-0.5"
            >
              <Ionicons
                name="flame"
                size={ICON.xs}
                color={colors.accentForeground}
              />
              <Text className="text-xs font-medium tabular-nums text-accent-foreground">
                {String(streak)}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="muted" className="text-sm">
          {hidden && detailHasAmount ? "••••••" : detail}
        </Text>
      </View>
      <Button
        label={t("monthClose.closeTheMonth")}
        variant="pill"
        icon="arrow-forward"
        className="self-start"
        onPress={onOpen}
      />
    </Card>
  );
}
