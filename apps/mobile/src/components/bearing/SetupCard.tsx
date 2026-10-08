import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { parseTypedAmount } from "@finance/core/amount-input";
import { formatDayMonth } from "@finance/core/constants";
import type { SetupStep } from "@finance/core/setup-steps";

import { ConnectBankInvite } from "@/components/bank/ConnectBankInvite";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import type { BankState } from "@/hooks/useBankState";
import { dismissBankInvite } from "@/lib/bank-connect";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { dismissSetupStep, saveBalanceReading } from "@/lib/mutations";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

/**
 * Le point's setup card, as on the web: the one next thing the app needs to
 * say something worth reading (`nextSetupStep`), and nothing once it has it.
 *
 * The balance is typed here, in place; the salary and the charges open the
 * welcome steps on their own (`/onboarding?from=`). « Plus tard » puts the
 * card away for good.
 */
export function SetupCard({
  step,
  firstCloseOn,
  bank,
}: {
  step: SetupStep;
  /** The reading day the first close can be made on. */
  firstCloseOn: string;
  bank: BankState | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [gone, setGone] = useState(false);

  if (gone) {
    return null;
  }

  function later() {
    void hapticLight();
    setGone(true);
    if (step === "bank") {
      if (user) {
        void dismissBankInvite(user.id, "bearing", locale);
      }
    } else {
      void dismissSetupStep(step, locale);
    }
  }

  const laterButton = (
    <Button
      label={t(step === "bank" ? "setup.withoutBank" : "setup.later")}
      variant="ghost"
      size="sm"
      className="self-start"
      onPress={later}
    />
  );

  if (step === "bank") {
    return (
      <View className="gap-3 rounded-card border border-border bg-card/70 p-card">
        <ConnectBankInvite surface="bearing" bank={bank} />
        {laterButton}
      </View>
    );
  }

  if (step === "balance") {
    return <BalanceStep laterButton={laterButton} />;
  }

  const copy = {
    salary: {
      title: t("setup.salary.title"),
      body: t("setup.salary.body"),
      href: "/onboarding?from=income",
      action: t("setup.salary.action"),
    },
    charges: {
      title: t("setup.charges.title"),
      body: t("setup.charges.body"),
      href: "/onboarding?from=recurring",
      action: t("setup.charges.action"),
    },
    close: {
      title: t("setup.close.title", {
        date: formatDayMonth(firstCloseOn, locale),
      }),
      body: t("setup.close.body"),
      href: null,
      action: null,
    },
  }[step];

  return (
    <View className="gap-3 rounded-card border border-border bg-card/70 p-card">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-semibold">
          {copy.title}
        </Text>
        <Text variant="muted" className="text-sm">
          {copy.body}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        {copy.href && copy.action ? (
          <Button
            label={copy.action}
            size="sm"
            onPress={() => router.push(copy.href as Href)}
          />
        ) : null}
        {laterButton}
      </View>
    </View>
  );
}

/** What the account holds today, typed once. */
function BalanceStep({ laterButton }: { laterButton: ReactNode }) {
  const t = useT();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const amount = parseTypedAmount(value);
  const unreadable = value.trim() !== "" && amount === null;

  async function save() {
    if (amount === null) {
      return;
    }
    setPending(true);
    const result = await saveBalanceReading(amount);
    setPending(false);
    if (result.error) {
      toast(result.error, "error");
      return;
    }
    void hapticSuccess();
    toast(t("actions.balanceSet"), "success");
  }

  return (
    <View className="gap-3 rounded-card border border-border bg-card/70 p-card">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-semibold">
          {t("setup.balance.title")}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("setup.balance.body")}
        </Text>
      </View>
      <Input
        keyboardType="decimal-pad"
        placeholder={t("monthClose.balancePlaceholder")}
        value={value}
        onChangeText={setValue}
        invalid={unreadable}
        accessibilityLabel={t("setup.balance.title")}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      {unreadable ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          {t("errors.notABalance")}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          label={t("setup.balance.save")}
          size="sm"
          disabled={pending || amount === null}
          onPress={() => void save()}
        />
        {laterButton}
      </View>
    </View>
  );
}
