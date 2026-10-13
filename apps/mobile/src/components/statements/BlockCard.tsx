import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";

import { formatFullDate } from "@finance/core/constants";
import { DURATION, STAGGER_STEP_MS } from "@finance/core/motion";
import {
  accountTail,
  BANK_NAMES,
  initialAccountChoice,
  statementKey,
  type AccountChoice,
  type BankId,
  type StatementBlock,
} from "@finance/core/statement";
import type { StatementOutcome } from "@finance/core/validations/statements";
import type { FileAccount } from "@finance/data/statements";

import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { useTweenedCount } from "@/components/review/useTweenedCount";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

export interface BlockChoice {
  account: AccountChoice;
  /** For amounts written without their sign: which way they went. */
  direction: "out" | "in";
}

/** The choice to start from (`initialAccountChoice`), as money out. */
export function initialChoice(
  block: StatementBlock,
  bank: BankId | null,
  accounts: readonly FileAccount[],
  mine: string,
): BlockChoice {
  return { account: initialAccountChoice(block, bank, accounts, mine), direction: "out" };
}

type Figure =
  | "statements.filed"
  | "statements.waiting"
  | "statements.likelyTyped"
  | "statements.known"
  | "statements.left";

/** One figure of the summary, its count tweening to each new answer. */
function FigureLine({ label, count, strong }: { label: Figure; count: number; strong: boolean }) {
  const t = useT();
  const shown = useTweenedCount(count);
  return (
    <Text className={strong ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
      {t(label, { count: shown })}
    </Text>
  );
}

function dayOf(iso: string, locale: "fr" | "en", withYear: boolean): string {
  const full = formatFullDate(iso, locale);
  return withYear ? full : full.replace(/ \d{4}$/, "");
}

/**
 * One account's part of a file on the phone: whose statement, which
 * account, how many lines over which days — then which of the person's
 * accounts it is, and what importing it would do, figures tweening in as
 * the server answers. The web's `StatementBlockCard`, in the phone's own
 * components.
 */
export function BlockCard({
  block,
  bank,
  accounts,
  choice,
  onChoice,
  outcome,
  index,
}: {
  block: StatementBlock;
  bank: BankId | null;
  accounts: readonly FileAccount[];
  choice: BlockChoice;
  onChoice: (choice: BlockChoice) => void;
  outcome: StatementOutcome | null;
  index: number;
}) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const key = statementKey(block.account);
  const tail = accountTail(key);
  const known = key ? accounts.find((account) => account.key === key) : undefined;
  const sameYear = block.from?.slice(0, 4) === block.to?.slice(0, 4);
  const current = choice.account.kind === "existing" ? choice.account.providerAccountId : "new";

  const figures: [Figure, number][] = outcome
    ? ([
        ["statements.filed", outcome.filed + outcome.matched],
        ["statements.waiting", outcome.waiting],
        ["statements.likelyTyped", outcome.likelyTyped],
        ["statements.known", outcome.known],
        ["statements.left", outcome.left],
      ] as [Figure, number][]).filter(([, count]) => count > 0)
    : [];

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.duration(DURATION.enter).delay(index * STAGGER_STEP_MS * 2)
      }
      className="gap-4 rounded-card border border-border bg-card/70 p-card"
    >
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Ionicons name="business-outline" size={ICON.lg} color={colors.foreground} />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="head">
            {bank ? t("statements.statementOf", { bank: BANK_NAMES[bank] }) : t("statements.statement")}
          </Text>
          <Text variant="muted">
            {tail ? `${tail} · ` : ""}
            {t("statements.lines", { count: block.lines.length })}
            {block.from && block.to
              ? ` ${
                  block.from === block.to
                    ? t("statements.onDay", { day: dayOf(block.from, locale, true) })
                    : t("statements.period", {
                        from: dayOf(block.from, locale, !sameYear),
                        to: dayOf(block.to, locale, true),
                      })
                }`
              : ""}
          </Text>
        </View>
      </View>

      {known ? (
        <View className="flex-row items-center gap-2">
          <Ionicons name="checkmark-circle" size={ICON.md} color={colors.success} />
          <Text className="flex-1 text-sm">
            {known.label} · {t("statements.accountKnown")}
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {accounts.length > 0 ? (
            <View className="gap-2">
              <Text className="text-sm font-medium">{t("statements.accountPick")}</Text>
              <ChoiceChips
                label={t("statements.accountPick")}
                options={[
                  ...accounts.map((account) => ({ value: account.providerAccountId, label: account.label })),
                  { value: "new", label: t("statements.accountNew") },
                ]}
                value={current}
                onChange={(value) =>
                  onChoice({
                    ...choice,
                    account:
                      value === "new"
                        ? initialAccountChoice(block, bank, [], t("statements.accountMine"))
                        : { kind: "existing", providerAccountId: value },
                  })
                }
              />
            </View>
          ) : null}
          {choice.account.kind === "new" ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Text className="text-sm font-medium">{t("statements.accountName")}</Text>
                <Input
                  value={choice.account.label}
                  maxLength={80}
                  accessibilityLabel={t("statements.accountName")}
                  onChangeText={(label) =>
                    choice.account.kind === "new" &&
                    onChoice({ ...choice, account: { ...choice.account, label } })
                  }
                />
              </View>
              <View className="gap-2">
                <Text className="text-sm font-medium">
                  {t("bankAccounts.roleGroup", {
                    account: choice.account.label || t("statements.accountMine"),
                  })}
                </Text>
                <ChoiceChips
                  label={t("bankAccounts.roleGroup", { account: choice.account.label })}
                  options={[
                    { value: "spending" as const, label: t("bankAccounts.roleSpending") },
                    { value: "savings" as const, label: t("bankAccounts.roleSavings") },
                    { value: "ignored" as const, label: t("bankAccounts.roleIgnored") },
                  ]}
                  value={choice.account.role}
                  onChange={(role) =>
                    choice.account.kind === "new" &&
                    onChoice({ ...choice, account: { ...choice.account, role } })
                  }
                />
              </View>
            </View>
          ) : null}
        </View>
      )}

      {block.signUnknown ? (
        <View className="gap-2">
          <Text className="text-sm font-medium">{t("statements.signQuestion")}</Text>
          <ChoiceChips
            label={t("statements.signQuestion")}
            options={[
              { value: "out" as const, label: t("statements.signOut") },
              { value: "in" as const, label: t("statements.signIn") },
            ]}
            value={choice.direction}
            onChange={(direction) => onChoice({ ...choice, direction })}
          />
        </View>
      ) : null}

      <View accessibilityLiveRegion="polite" className="min-h-6 gap-1">
        {outcome && !outcome.kept ? (
          <Text variant="muted">
            {choice.account.kind === "new" && choice.account.role === "ignored"
              ? t("statements.ignoredKept")
              : t("statements.savingsKept")}
          </Text>
        ) : (
          figures.map(([label, count], at) => (
            <Animated.View
              key={label}
              entering={reduceMotion ? undefined : FadeInDown.duration(DURATION.press).delay(at * STAGGER_STEP_MS)}
            >
              <FigureLine label={label} count={count} strong={label === "statements.waiting"} />
            </Animated.View>
          ))
        )}
      </View>
    </Animated.View>
  );
}
