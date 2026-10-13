import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion, ZoomIn } from "react-native-reanimated";

import { formatCurrency, formatDayMonth, formatFullDate, type CurrencyCode } from "@finance/core/constants";
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
import { hapticSelection } from "@/lib/haptics";
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

/** The most lines listed under « Voir les opérations lues ». */
const LISTED_LINES = 150;

/**
 * The lines as read — day, words, amount — for the person to see before
 * importing: a PDF's or a picture's reading is best looked at once. Folded
 * away until asked for.
 */
function ReadLines({ block, direction }: { block: StatementBlock; direction: "out" | "in" }) {
  const t = useT();
  const locale = useLocale();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const shown = block.lines.slice(0, LISTED_LINES);
  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(DURATION.panel)} className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void hapticSelection();
          setOpen((current) => !current);
        }}
        className="min-h-11 flex-row items-center gap-1.5 self-start"
      >
        <Text variant="muted" className="font-medium">
          {open ? t("statements.hideLines") : t("statements.showLines")}
        </Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={ICON.sm} color={colors.mutedForeground} />
      </Pressable>
      {open ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(DURATION.panel)}
          exiting={reduceMotion ? undefined : FadeOut.duration(DURATION.press)}
          className="rounded-control border border-border"
        >
          {shown.map((line, at) => {
            const out = block.signUnknown ? direction === "out" : line.creditDebitIndicator === "DBIT";
            const amount = Number(line.amount);
            return (
              <View key={line.id} className={at === 0 ? "flex-row items-baseline gap-3 px-3 py-2" : "flex-row items-baseline gap-3 border-t border-border px-3 py-2"}>
                <Text variant="micro" className="w-14">
                  {line.bookingDate ? formatDayMonth(line.bookingDate, locale) : ""}
                </Text>
                <Text numberOfLines={1} className="flex-1 text-sm">
                  {line.remittanceInformation ?? line.creditorName ?? line.debtorName ?? "—"}
                </Text>
                <Text className="text-sm" style={out ? undefined : { color: colors.success }}>
                  {formatCurrency(out ? -amount : amount, block.currency as CurrencyCode, locale)}
                </Text>
              </View>
            );
          })}
          {block.lines.length > shown.length ? (
            <Text variant="micro" className="border-t border-border px-3 py-2">
              {t("statements.moreLines", { count: block.lines.length - shown.length })}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/**
 * One account's part of a file on the phone: whose statement, which
 * account, how many lines over which days, whether its own balances confirm
 * the reading — then which of the person's accounts it is, and what
 * importing it would do, figures tweening in as the server answers. The
 * web's `StatementBlockCard`, in the phone's own components.
 */
export function BlockCard({
  block,
  bank,
  accounts,
  choice,
  onChoice,
  outcome,
  index,
  readByAi = false,
  alerts = false,
}: {
  block: StatementBlock;
  bank: BankId | null;
  accounts: readonly FileAccount[];
  choice: BlockChoice;
  onChoice: (choice: BlockChoice) => void;
  outcome: StatementOutcome | null;
  index: number;
  /** Read by the person's AI account: said, and every line waits. */
  readByAi?: boolean;
  /** A bank's alert e-mails rather than a statement. */
  alerts?: boolean;
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
            {alerts
              ? t("statements.mailAlertsOf", { bank: bank ? BANK_NAMES[bank] : t("statements.mailYourBank") })
              : bank
                ? t("statements.statementOf", { bank: BANK_NAMES[bank] })
                : t("statements.statement")}
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

      {readByAi ? (
        <View className="flex-row items-start gap-2">
          <Ionicons name="sparkles" size={ICON.md} color={colors.primary} />
          <Text className="flex-1 text-sm leading-5">{t("statements.readByAi")}</Text>
        </View>
      ) : null}
      {block.check?.ok ? (
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)}
          className="flex-row items-start gap-2"
        >
          <Ionicons name="shield-checkmark" size={ICON.md} color={colors.success} />
          <Text className="flex-1 text-sm leading-5">{t("statements.checkOk")}</Text>
        </Animated.View>
      ) : block.check ? (
        <View className="flex-row items-start gap-2">
          <Ionicons name="alert-circle" size={ICON.md} color={colors.warning} />
          <Text className="flex-1 text-sm leading-5">
            {t("statements.checkOff", {
              gap: formatCurrency(Math.abs(Number(block.check.gap)), block.currency as CurrencyCode, locale),
            })}
          </Text>
        </View>
      ) : null}

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

      <ReadLines block={block} direction={choice.direction} />

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
