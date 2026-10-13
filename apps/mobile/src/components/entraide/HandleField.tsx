import { View } from "react-native";

import { ENTRAIDE_LIMITS, handleProblem } from "@finance/core/entraide";
import type { EntraideCopy } from "@finance/core/entraide-copy";

import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

/**
 * The pseudonym, asked once, with a first message: what is wrong with it
 * said as it is typed, and otherwise that it is all others will see.
 */
export function HandleField({
  value,
  onChange,
  copy,
}: {
  value: string;
  onChange: (value: string) => void;
  copy: EntraideCopy;
}) {
  const issue = value ? handleProblem(value) : null;
  return (
    <View className="gap-2">
      <Text className="px-1 text-sm font-medium">
        {copy.composer.handleLabel}
      </Text>
      <Input
        value={value}
        onChangeText={onChange}
        maxLength={ENTRAIDE_LIMITS.handleMax}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        accessibilityLabel={copy.composer.handleLabel}
        accessibilityHint={copy.composer.handleHint}
        invalid={issue !== null}
      />
      <Text
        variant="muted"
        className={cn("px-1 text-xs", issue && "text-foreground")}
      >
        {issue ? copy.composer.handleProblems[issue] : copy.composer.handleHint}
      </Text>
    </View>
  );
}

/** Whether a write may go: a pseudonym already, or one that can be taken. */
export function handleReady(handle: string | null, typed: string): boolean {
  return handle !== null || handleProblem(typed) === null;
}
