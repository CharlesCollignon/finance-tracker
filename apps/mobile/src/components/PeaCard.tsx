import { useState } from "react";
import { Pressable, View } from "react-native";

import { todayIsoLocal } from "@finance/core/constants";
import { buildPeaStatus, peaMaturityHint } from "@finance/core/pea";
import type { WalletPlan } from "@finance/core/types/database";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { saveWalletPlan } from "@/lib/mutations";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { RADIUS } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface PeaCardProps {
  /** What has been paid into the PEA, which its ceiling is counted on. */
  invested: number;
  plan: WalletPlan | undefined;
  onSaved: () => void;
}

/**
 * The PEA's two facts of its own: the room left under the ceiling, and the
 * five-year clock from the day it was opened. Under the PEA's card on the
 * accounts view, as on the web, since both are about that one account rather
 * than the split.
 */
export function PeaCard({ invested, plan, onSaved }: PeaCardProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  const peaStatus = buildPeaStatus(
    invested,
    plan?.opened_on ?? null,
    todayIsoLocal(),
    plan?.contribution_ceiling ? Number(plan.contribution_ceiling) : undefined,
  );

  return (
    <Card bezel innerClassName="gap-3 p-5">
      <Text className="font-bold">PEA</Text>

      <View className="flex-row flex-wrap items-baseline justify-between gap-2">
        <Text variant="muted" className="text-sm">
          {`${t("position.peaPaidIn")} `}
          <PrivateAmount className="text-sm text-foreground">
            {formatEuro(peaStatus.contributed)}
          </PrivateAmount>
          {` ${t("position.peaOfCeiling", {
            ceiling: formatEuro(peaStatus.ceiling),
          })}`}
        </Text>
        <Text
          className={cn(
            "font-sans tabular-nums text-sm",
            peaStatus.nearCeiling
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {`${formatEuro(peaStatus.headroom)} ${t("position.peaRoomLeft")}`}
        </Text>
      </View>

      <View
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: colors.muted }}
      >
        <View
          style={{
            height: "100%",
            borderRadius: RADIUS.pill,
            backgroundColor: peaStatus.nearCeiling
              ? colors.destructive
              : colors.primary,
            width: `${Math.min(100, Math.round(peaStatus.ratio * 100))}%`,
          }}
        />
      </View>

      <Text variant="muted" className="text-xs">
        {t("position.peaCashOnly")}
      </Text>

      <PeaOpenedField
        openedOn={plan?.opened_on ?? null}
        hint={peaMaturityHint(peaStatus, locale)}
        onSaved={onSaved}
      />
    </Card>
  );
}

/** The one date that starts a PEA's five-year clock. */
function PeaOpenedField({
  openedOn,
  hint,
  onSaved,
}: {
  openedOn: string | null;
  hint: string | null;
  onSaved: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [value, setValue] = useState(openedOn ?? todayIsoLocal());
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const result = await saveWalletPlan({ wallet: "pea", openedOn: value });
    setPending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }
    toast(t("position.saved"), "success");
    setEditing(false);
    onSaved();
  }

  return (
    <View className="gap-2 border-t border-border pt-3">
      {editing ? (
        <>
          <Text className="text-sm font-medium">{t("position.openedOn")}</Text>
          <DateField value={value} onChange={setValue} />
          <View className="flex-row gap-2">
            <Button
              label={pending ? t("position.saving") : t("position.save")}
              size="sm"
              className="flex-1"
              disabled={pending}
              onPress={() => void save()}
            />
            <Button
              label={t("position.cancel")}
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={pending}
              onPress={() => setEditing(false)}
            />
          </View>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("position.peaOpenedLabel")}
          onPress={() => setEditing(true)}
        >
          <Text variant="muted" className="text-sm">
            {hint ?? t("position.peaOpenedHint")}
            <Text className="text-sm font-medium text-primary-ink">
              {`  ${openedOn ? t("common.change") : t("common.add")}`}
            </Text>
          </Text>
        </Pressable>
      )}
    </View>
  );
}
