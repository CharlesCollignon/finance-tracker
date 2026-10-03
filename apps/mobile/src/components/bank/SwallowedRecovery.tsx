import { useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSuccess } from "@/lib/haptics";
import { reopenSwallowedFeedItems } from "@/lib/mutations";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";

/**
 * Bank rows an earlier sync merged away on its own — the web's
 * `SwallowedRecovery`, where the Ledger's review begins.
 *
 * The sync used to treat an amount matching a recurring transaction within
 * five days as proof they were the same movement. On a statement full of
 * small round figures that is not proof of anything, so those rows were
 * filed against a recurring charge and never became transactions. They are
 * not duplicates; they are spending that quietly never arrived.
 *
 * Reopening puts every one of them back in the review, where the decision
 * is the user's: some really were the debit the charge predicted, and those
 * can be left out again — a judgement nothing here is entitled to make.
 */
export function SwallowedRecovery({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  if (count === 0) {
    return null;
  }

  async function reopen() {
    setPending(true);
    const result = await reopenSwallowedFeedItems();
    setPending(false);
    if (!result.success) {
      toast(result.error, "error");
      return;
    }
    void hapticSuccess();
    toast(
      t("actions.entriesBackInInbox", { count: result.reopened }),
      "success",
    );
  }

  return (
    <Card className={cn("border-destructive/40", className)}>
      <View className="gap-3">
        <Text className="font-semibold">
          {t("swallowed.title", { count })}
        </Text>
        <Text variant="muted" className="text-sm">
          {t("swallowed.body")}
        </Text>
        <Button
          label={pending ? t("swallowed.reopening") : t("swallowed.reopenAll")}
          size="sm"
          className="self-start"
          disabled={pending}
          onPress={() => void reopen()}
        />
      </View>
    </Card>
  );
}
