import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { amountSign } from "@finance/core/amount-sign";
import { TYPE_AMOUNT_CLASS } from "@finance/core/category-styles";
import {
  formatMonthLabel,
  formatShortDate,
  shiftMonth,
} from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import { balanceExplanation } from "@finance/core/month-balance";
import { EASE_STANDARD } from "@finance/core/motion";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ConnectBankInvite } from "@/components/bank/ConnectBankInvite";
import { BalanceCurve } from "@/components/bearing/BalanceCurve";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import type { BankState } from "@/hooks/useBankState";
import { shouldInvite } from "@/lib/bank-connect";
import { cn } from "@/lib/cn";
import { hapticLight } from "@/lib/haptics";
import type { HomeMonth } from "@/lib/home-data";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

type IconName = ComponentProps<typeof Ionicons>["name"];

const EASING = Easing.bezier(...EASE_STANDARD);
/** The web's `.grow-in`: 800ms on the standard curve, after a 150ms beat. */
const GROW_MS = 800;
const GROW_DELAY_MS = 150;

/** How many recurring entries still to come the card lists before "+N more". */
const UPCOMING_SHOWN = 4;

/* ------------------------------------------------------------ the shells */

/**
 * A card on this screen: a small icon and title, and — where another screen
 * explains its figures — an arrow there. The web's own card, translated.
 */
function HomeCard({
  icon,
  title,
  href,
  hrefLabel,
  children,
}: {
  icon: IconName;
  title: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View className="gap-4 rounded-card border border-border bg-card/70 p-card">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Ionicons name={icon} size={ICON.sm} color={colors.foreground} />
          </View>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="shrink text-sm font-medium text-muted-foreground"
          >
            {title}
          </Text>
        </View>
        {href ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={hrefLabel ?? title}
            hitSlop={6}
            onPress={() => {
              void hapticLight();
              router.push(href as Href);
            }}
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Ionicons
              name="arrow-forward"
              size={ICON.md}
              color={colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A signed difference, as a pill: up is green and down is red, with an arrow. */
function DeltaChip({ value, label }: { value: number; label: string }) {
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const up = value >= 0;
  return (
    <View
      accessible
      accessibilityLabel={label}
      className={cn(
        "flex-row items-center gap-1 self-start rounded-full px-2.5 py-1",
        up ? "bg-success/10" : "bg-destructive/10",
      )}
    >
      <Ionicons
        name={up ? "arrow-up" : "arrow-down"}
        size={ICON.xs}
        color={up ? colors.success : colors.destructive}
      />
      <PrivateAmount
        className={cn(
          "text-xs font-medium",
          up ? "text-success" : "text-destructive",
        )}
      >
        {`${up ? "+" : "−"}${format(Math.abs(value))}`}
      </PrivateAmount>
    </View>
  );
}

/** A label-and-dot pill under the balance: the lowest day, what is to come. */
function Pill({
  children,
  dot,
  tone = "default",
}: {
  children: string;
  dot?: string;
  tone?: "default" | "danger";
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-1.5 rounded-full border px-3 py-1.5",
        tone === "danger" ? "border-destructive/40" : "border-border",
      )}
    >
      {dot ? (
        <View
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dot }}
        />
      ) : null}
      <PrivateAmount
        className={cn(
          "text-xs",
          tone === "danger" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {children}
      </PrivateAmount>
    </View>
  );
}

/**
 * A thin meter that grows from its start to its value on arrival, as the
 * web's `.grow-in` does, and simply is its value under reduced motion.
 */
function GrowBar({ ratio, color }: { ratio: number; color: string }) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  const clamped = Math.max(0, Math.min(1, ratio));

  useEffect(() => {
    progress.value = reduce
      ? 1
      : withDelay(
          GROW_DELAY_MS,
          withTiming(1, { duration: GROW_MS, easing: EASING }),
        );
  }, [reduce, progress]);

  const style = useAnimatedStyle(() => ({
    width: `${clamped * 100 * progress.value}%`,
  }));

  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
      <Animated.View
        className="h-full rounded-full"
        style={[{ backgroundColor: color }, style]}
      />
    </View>
  );
}

/* ------------------------------------------------------------ the balance */

export function BalanceCard({
  data,
  bank,
}: {
  data: HomeMonth;
  bank: BankState | null;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const router = useRouter();
  const { balance, source, upcoming } = data;
  const net = balance.basis === "net";
  const monthLabel = formatMonthLabel(data.year, data.month, locale);
  const [howOpen, setHowOpen] = useState(false);

  // The two figures, named by what they can claim.
  const figures = ((): {
    left: { label: string; value: number };
    right?: { label: string; value: number };
    delta?: number;
  } => {
    if (balance.period === "current") {
      return {
        left: {
          label: net ? t("bearingMonth.netSoFar") : t("bearingMonth.onAccount"),
          value: balance.today ?? 0,
        },
        right: {
          label: net
            ? t("bearingMonth.netByEnd")
            : t("bearingMonth.expectedEnd"),
          value: balance.end,
        },
        delta: balance.end - (balance.today ?? 0),
      };
    }
    if (balance.period === "past") {
      return net
        ? { left: { label: t("bearingMonth.netMonth"), value: balance.end } }
        : {
            left: {
              label: t("bearingMonth.startedWith"),
              value: balance.start,
            },
            right: { label: t("bearingMonth.endedWith"), value: balance.end },
            delta: balance.end - balance.start,
          };
    }
    return net
      ? { left: { label: t("bearingMonth.netByEnd"), value: balance.end } }
      : {
          left: {
            label: t("bearingMonth.expectedStart"),
            value: balance.start,
          },
          right: { label: t("bearingMonth.expectedEnd"), value: balance.end },
          delta: balance.end - balance.start,
        };
  })();

  const caption =
    balance.period === "future"
      ? t("bearingMonth.plannedOnly")
      : net
        ? t("bearingMonth.netCaption")
        : source === "bank"
          ? t("bearingMonth.fromBank")
          : t("bearingMonth.fromClose");

  // Only for a balance. A month's running net dips below zero every month
  // before payday, and flagging that as the account's lowest point would be
  // an alarm about a figure that is not a balance at all.
  const lowest = balance.lowest;
  const showLowest =
    !net &&
    lowest !== null &&
    balance.period !== "past" &&
    lowest.value < Math.min(balance.end, balance.today ?? balance.start);
  // Red only where a balance is below zero — an overdrawn account. A net
  // below zero is spending before income, which is most of every month.
  const overdrawn = (value: number) => !net && value < 0;
  const inviting =
    balance.period !== "future" &&
    bank !== null &&
    shouldInvite("bearing", bank);

  return (
    <View className="gap-5 rounded-card border border-border bg-card/70 p-card">
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-muted-foreground">
          {figures.left.label}
        </Text>
        <AnimatedAmount
          value={figures.left.value}
          format={format}
          style={TYPE.hero}
          numberOfLines={1}
          adjustsFontSizeToFit
          className={
            overdrawn(figures.left.value) ? "text-destructive" : undefined
          }
        />
        <Text variant="muted" className="text-xs">
          {caption}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: howOpen }}
          hitSlop={8}
          onPress={() => setHowOpen((open) => !open)}
          className="self-start"
        >
          <Text variant="muted" className="text-xs underline">
            {t("bearingMonth.how.title")}
          </Text>
        </Pressable>
        {howOpen ? (
          <Text variant="muted" className="text-xs leading-relaxed">
            {t(`bearingMonth.how.${balanceExplanation(balance, source)}`)}
          </Text>
        ) : null}
      </View>

      {figures.right ? (
        <View className="flex-row items-end justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-sm font-medium text-muted-foreground">
              {figures.right.label}
            </Text>
            <AnimatedAmount
              value={figures.right.value}
              format={format}
              style={TYPE.figure}
              numberOfLines={1}
              adjustsFontSizeToFit
              className={
                overdrawn(figures.right.value) ? "text-destructive" : undefined
              }
            />
          </View>
          {figures.delta !== undefined ? (
            <DeltaChip
              value={figures.delta}
              label={t("bearingMonth.fromToday", {
                amount: format(figures.delta),
              })}
            />
          ) : null}
        </View>
      ) : null}

      <BalanceCurve
        points={balance.points}
        today={balance.period === "current" ? data.today : null}
        format={format}
        label={t(
          net ? "bearingMonth.netChartLabel" : "bearingMonth.chartLabel",
          { month: monthLabel },
        )}
      />

      {showLowest ||
      (upcoming && (upcoming.arriving > 0 || upcoming.leaving > 0)) ? (
        <View className="flex-row flex-wrap gap-2">
          {showLowest && lowest ? (
            <Pill tone={lowest.value < 0 ? "danger" : "default"}>
              {t(
                balance.period === "current"
                  ? "bearingMonth.lowestAhead"
                  : "bearingMonth.lowest",
                {
                  amount: format(lowest.value),
                  date: formatShortDate(lowest.date, locale),
                },
              )}
            </Pill>
          ) : null}
          {upcoming && upcoming.arriving > 0 ? (
            <Pill dot={colors.success}>
              {t("bearingMonth.toComeIn", {
                amount: format(upcoming.arriving),
              })}
            </Pill>
          ) : null}
          {upcoming && upcoming.leaving > 0 ? (
            <Pill dot={colors.destructive}>
              {t("bearingMonth.toGoOut", { amount: format(upcoming.leaving) })}
            </Pill>
          ) : null}
        </View>
      ) : null}

      {/* Where the real balance would be: the strongest place to offer it.
          Typing a balance by hand stays the alternative for anyone who would
          rather not connect a bank. */}
      {inviting ? (
        <View className="gap-2">
          <ConnectBankInvite surface="bearing" bank={bank} />
          {net ? (
            <Pressable
              accessibilityRole="link"
              hitSlop={6}
              onPress={() => router.push("/planning" as Href)}
              className="self-start"
            >
              <Text variant="muted" className="text-xs underline">
                {t("bankConnect.orEnterBalance")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : net && balance.period !== "future" ? (
        <View className="gap-3 rounded-control border border-hairline-strong px-4 py-3">
          <Text variant="muted" className="text-sm">
            {t("bearingMonth.setBalanceBody")}
          </Text>
          <Button
            label={t("bearingMonth.setBalance")}
            variant="outline"
            size="sm"
            className="self-start"
            onPress={() => router.push("/planning" as Href)}
          />
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ the spending */

export function SpentCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { spent } = data;
  const current = data.balance.period === "current";
  const previous = shiftMonth(data.year, data.month, -1);
  const previousLabel = formatMonthLabel(previous.year, previous.month, locale);

  const comparison = (() => {
    if (spent.previous === null || spent.previous === 0) {
      return null;
    }
    const difference = spent.total - spent.previous;
    if (Math.abs(difference) < 1) {
      return {
        text: t("bearingMonth.spentSame", { month: previousLabel }),
        better: true,
      };
    }
    const amount = format(Math.abs(difference));
    const key =
      difference < 0
        ? current
          ? "bearingMonth.spentLessSoFar"
          : "bearingMonth.spentLess"
        : current
          ? "bearingMonth.spentMoreSoFar"
          : "bearingMonth.spentMore";
    return {
      text: t(key, { amount, month: previousLabel }),
      better: difference < 0,
    };
  })();

  return (
    <HomeCard
      icon="receipt-outline"
      title={t("bearingMonth.spent")}
      href="/transactions"
      hrefLabel={t("bearingMonth.seeInLedger")}
    >
      <AnimatedAmount
        value={spent.total}
        startFrom={0}
        format={format}
        style={TYPE.figure}
        numberOfLines={1}
        adjustsFontSizeToFit
      />

      {comparison ? (
        <PrivateAmount
          className={cn(
            "text-sm",
            comparison.better ? "text-success" : "text-muted-foreground",
          )}
        >
          {comparison.text}
        </PrivateAmount>
      ) : null}

      <SpendBars data={data} />
    </HomeCard>
  );
}

/**
 * Six months of spending, this one lit and the rest in the background: one
 * series, so emphasis rather than colour. Each bar grows from the floor on
 * arrival.
 */
function SpendBars({ data }: { data: HomeMonth }) {
  const locale = useLocale();
  const format = useFormatCurrency();
  const { hidden } = usePrivacy();
  const { trend } = data.spent;
  const peak = Math.max(1, ...trend.map((point) => point.total));
  const shownKey = `${data.year}-${String(data.month).padStart(2, "0")}`;

  const summary = hidden
    ? undefined
    : trend.map((point) => `${point.label} ${format(point.total)}`).join(", ");

  return (
    <View
      accessible
      accessibilityLabel={summary}
      className="h-20 flex-row items-end gap-2"
    >
      {trend.map((point) => (
        <SpendBar
          key={point.monthKey}
          ratio={point.total / peak}
          shown={point.monthKey === shownKey}
          label={monthShort(Number(point.monthKey.slice(5, 7)), locale)}
        />
      ))}
    </View>
  );
}

function SpendBar({
  ratio,
  shown,
  label,
}: {
  ratio: number;
  shown: boolean;
  label: string;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  const height = Math.max(0.05, Math.min(1, ratio));

  useEffect(() => {
    progress.value = reduce
      ? 1
      : withDelay(
          GROW_DELAY_MS,
          withTiming(1, { duration: GROW_MS, easing: EASING }),
        );
  }, [reduce, progress]);

  const style = useAnimatedStyle(() => ({
    height: `${height * 100 * progress.value}%`,
  }));

  return (
    <View className="h-full flex-1 items-center justify-end gap-1">
      <View className="w-full max-w-6 flex-1 justify-end">
        <Animated.View
          className="w-full rounded-t-[4px]"
          style={[
            {
              backgroundColor: shown ? colors.primary : colors.foreground,
              opacity: shown ? 1 : 0.15,
            },
            style,
          ]}
        />
      </View>
      <Text
        className={cn(
          "text-[11px] uppercase",
          shown ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
    </View>
  );
}

export function WhereItWentCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const { spending } = data;
  const peak = Math.max(1, ...spending.top.map((entry) => entry.total));

  return (
    <HomeCard
      icon="pie-chart-outline"
      title={t("bearingMonth.whereItWent")}
      href="/transactions"
      hrefLabel={t("bearingMonth.seeInLedger")}
    >
      <View className="gap-4">
        {spending.top.map((entry) => {
          // Against the month's largest, so the bars rank the categories.
          const ratio = entry.total / peak;
          return (
            <View
              key={entry.categoryId}
              className="flex-row items-center gap-3"
            >
              <CategoryIcon icon={entry.icon} />
              <View className="min-w-0 flex-1 gap-2">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text
                    numberOfLines={1}
                    className="shrink text-sm font-medium"
                  >
                    {entry.name}
                  </Text>
                  <PrivateAmount className="text-sm">
                    {format(entry.total)}
                  </PrivateAmount>
                </View>
                <GrowBar ratio={ratio} color={colors.mutedForeground} />
              </View>
            </View>
          );
        })}
      </View>
      {spending.rest > 0 ? (
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="muted" className="text-sm">
            {t("bearingMonth.everythingElse")}
          </Text>
          <PrivateAmount className="text-sm text-muted-foreground">
            {format(spending.rest)}
          </PrivateAmount>
        </View>
      ) : null}
    </HomeCard>
  );
}

/* ------------------------------------------------------------ what comes */

export function UpcomingCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const upcoming = data.upcoming!;
  const shown = upcoming.charges.slice(0, UPCOMING_SHOWN);
  const more = upcoming.charges.length - shown.length;

  return (
    <HomeCard
      icon="calendar-outline"
      title={
        data.balance.period === "future"
          ? t("bearingMonth.plannedThisMonth")
          : t("bearingMonth.stillToCome")
      }
      href="/transactions"
      hrefLabel={t("bearingMonth.seeInLedger")}
    >
      {shown.length === 0 ? (
        <Text variant="muted" className="text-sm">
          {t("bearingMonth.nothingToCome")}
        </Text>
      ) : (
        <View className="gap-3">
          {shown.map((charge) => (
            <View key={charge.key} className="flex-row items-center gap-3">
              <View
                accessible
                accessibilityLabel={formatShortDate(charge.occurredOn, locale)}
                className="h-10 w-10 items-center justify-center rounded-control border border-hairline-strong"
              >
                <Text className="text-sm font-semibold tabular-nums">
                  {String(Number(charge.occurredOn.slice(8, 10)))}
                </Text>
                <Text className="text-[10px] uppercase text-muted-foreground">
                  {monthShort(Number(charge.occurredOn.slice(5, 7)), locale)}
                </Text>
              </View>
              <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
                {charge.description?.trim() || charge.name}
              </Text>
              <PrivateAmount
                className={cn("text-sm", TYPE_AMOUNT_CLASS[charge.type])}
              >
                {`${amountSign(charge.type)}${format(charge.amount)}`}
              </PrivateAmount>
            </View>
          ))}
        </View>
      )}
      {more > 0 ? (
        <Text variant="muted" className="text-xs">
          {t("bearingMonth.moreToCome", { count: more })}
        </Text>
      ) : null}
    </HomeCard>
  );
}

/* ------------------------------------------------------------ the run */

/**
 * What the month is adding up to beyond itself: the run of months closed
 * under the allowance, and what is invested.
 * The one card on the screen that keeps score, so it is the one that is
 * allowed to feel like it.
 */
export function MomentumCard({ data }: { data: HomeMonth }) {
  const t = useT();
  const format = useFormatCurrency();
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <HomeCard
      icon="flame-outline"
      title={t("removal.momentumTitle")}
      href="/planning"
    >
      {data.run ? (
        <View className="flex-row items-center gap-3 rounded-control bg-secondary px-3 py-2.5">
          <View
            className={cn(
              "h-10 w-10 items-center justify-center rounded-full",
              data.run.streak > 0 ? "bg-primary" : "bg-muted",
            )}
          >
            <Ionicons
              name="flame"
              size={ICON.lg}
              color={
                data.run.streak > 0
                  ? colors.primaryForeground
                  : colors.mutedForeground
              }
            />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold">
              {data.run.streak > 0
                ? t("bearingMonth.run", { count: data.run.streak })
                : t("bearingMonth.noRunYet")}
            </Text>
            <Text variant="muted" className="text-xs">
              {t("bearingMonth.runBody")}
              {data.run.best > data.run.streak
                ? ` · ${t("bearingMonth.bestRun", { count: data.run.best })}`
                : ""}
            </Text>
          </View>
        </View>
      ) : null}

      {data.invested !== null ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void hapticLight();
            router.push("/investments" as Href);
          }}
          className="min-h-11 flex-row items-center justify-between gap-3 rounded-control border border-border px-3 py-2.5"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons
              name="trending-up"
              size={ICON.md}
              color={colors.mutedForeground}
            />
            <Text variant="muted" className="text-sm">
              {t("bearingMonth.invested")}
            </Text>
          </View>
          <PrivateAmount className="text-sm font-semibold">
            {format(data.invested)}
          </PrivateAmount>
        </Pressable>
      ) : null}
    </HomeCard>
  );
}

/* ------------------------------------------------------------ first visit */

export function SetUpCard() {
  const t = useT();
  const router = useRouter();
  return (
    <View className="gap-3 rounded-card border border-border bg-card/70 p-card">
      <View className="gap-1">
        <Text className="text-base font-semibold">{t("month.setUpTitle")}</Text>
        <Text variant="muted" className="text-sm">
          {t("month.setUpBody")}
        </Text>
      </View>
      <Button
        label={t("month.setUpCharges")}
        size="sm"
        className="self-start"
        onPress={() => router.push("/onboarding" as Href)}
      />
    </View>
  );
}
