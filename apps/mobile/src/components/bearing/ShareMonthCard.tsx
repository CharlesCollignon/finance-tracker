import { useState } from "react";
import { Switch, View } from "react-native";

import { formatMonthLabel } from "@finance/core/constants";

import { HomeCard } from "@/components/bearing/card-parts";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { hapticLight } from "@/lib/haptics";
import { shareMonthImage } from "@/lib/month-share";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useOwner } from "@/providers/OwnerProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * « Partager ce mois » — the web's card, for the phone's share sheet: the
 * month as an image, with the amounts or with the shares and a sign only.
 * The page to print is the web's.
 */
export function ShareMonthCard({ year, month }: { year: number; month: number }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const { toast } = useToast();
  const { ownerId } = useOwner();
  const [withAmounts, setWithAmounts] = useState(false);
  const [pending, setPending] = useState(false);

  async function share() {
    if (!ownerId) {
      return;
    }
    void hapticLight();
    setPending(true);
    const outcome = await shareMonthImage({
      year,
      month,
      locale,
      ownerId,
      withAmounts,
      title: t("monthShare.title", {
        month: formatMonthLabel(year, month, locale),
      }),
    });
    setPending(false);
    if (outcome !== "shared") {
      toast(t("errors.couldNotSave"), "error");
    }
  }

  return (
    <HomeCard icon="share-outline" title={t("monthShare.share")}>
      <Text variant="muted" className="text-sm">
        {t("monthShare.shareHint")}
      </Text>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-sm">{t("monthShare.withAmounts")}</Text>
        <Switch
          value={withAmounts}
          onValueChange={setWithAmounts}
          accessibilityLabel={t("monthShare.withAmounts")}
          trackColor={{ true: colors.primary, false: colors.muted }}
        />
      </View>
      <Button
        label={t("monthShare.shareImage")}
        size="sm"
        icon="share-outline"
        className="self-start"
        disabled={pending}
        onPress={() => void share()}
      />
    </HomeCard>
  );
}
