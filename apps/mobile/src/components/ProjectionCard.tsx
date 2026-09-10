import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import {
  formatRunway,
  type ForwardProjection,
  type ProjectionIngredient,
  type ProjectionPoint,
  type Runway,
} from "@finance/core/projection";

import { Card } from "@/components/ui/Card";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

interface ProjectionCardProps {
  projection: ForwardProjection | null;
  runway: Runway | null;
}

/** Where each ingredient is edited. Kept out of core: the web's routes differ. */
const INGREDIENT_ROUTE: Record<ProjectionIngredient["kind"], string> = {
  income: "/(tabs)/recurring",
  committed: "/(tabs)/recurring",
  "set-aside": "/(tabs)/recurring",
  deployed: "/(tabs)/investments",
  unrecorded: "/(tabs)/month",
};

/**
 * Where the months ahead lead.
 *
 * Two figures rather than one. A single line answering "what will the
 * account hold" counted every euro moved into savings or a wallet as money
 * gone, so a diligent saver watched it sink; the second line is that plus
 * everything set aside, and the gap between them is what has been put by.
 *
 * Still arithmetic rather than a forecast — which is why it says "if nothing
 * changes" and why the market is nowhere in it. The one figure here the user
 * did not schedule is their unrecorded spending, and that is measured from
 * closed months rather than guessed, which the card says out loud rather
 * than asking to be trusted.
 *
 * The ingredients are the point, not trim. This card's real failure was
 * arriving at a number with no way to see what was missing from it: someone
 * whose pay is not a charge got a line sliding downhill and no reason for
 * it. Now the reason comes first, above the figures it invalidates.
 *
 * Mirrors `apps/web/components/finance/ProjectionCard.tsx` line for line.
 */
export function ProjectionCard({ projection, runway }: ProjectionCardProps) {
  const locale = useLocale();
  const t = useT();
  const formatEuro = useFormatCurrency();
  const router = useRouter();

  const summary = projection?.summary ?? null;
  const runwayLine = runway ? formatRunway(runway, locale) : null;

  if (!projection || !summary) {
    return null;
  }

  const { points, makeup } = projection;
  const count = points.length;
  const period = summary.grounded
    ? t("projection.by", { month: summary.endLabel })
    : t("projection.added", { count });

  return (
    <Card bezel innerClassName="gap-2 p-5">
      <View className="flex-row flex-wrap items-baseline justify-between gap-2">
        <Text className="font-bold">{t("projection.heading")}</Text>
        <Text variant="muted" className="text-xs">
          {t("projection.window", { count })}
        </Text>
      </View>

      {makeup.noIncomeScheduled ? (
        <Pressable
          onPress={() => router.push("/(tabs)/recurring" as never)}
          className="rounded-card border border-destructive/40 bg-destructive/10 p-3"
          accessibilityRole="button"
          accessibilityLabel={t("projection.noIncomeCta")}
        >
          <Text className="text-sm">{t("projection.noIncomeCharge")}</Text>
        </Pressable>
      ) : null}

      <Figure
        label={t("projection.kept")}
        value={formatEuro(
          summary.grounded ? summary.endingKept : summary.addedAltogether,
        )}
        period={period}
        tone={summary.shrinking ? "bad" : "good"}
        lead
      />
      <Figure
        label={t("projection.inAccounts")}
        value={formatEuro(
          summary.grounded ? summary.endingOnHand : summary.addedToAccounts,
        )}
        period={period}
        tone="plain"
      />

      {!summary.grounded ? (
        <Text variant="muted" className="text-xs">
          {t("projection.noOpeningBalance")}
        </Text>
      ) : null}

      <ProjectionSparkline points={points} />

      <Text variant="muted" className="text-sm">
        {t("projection.perMonth", {
          amount: `${summary.monthlyToAccounts >= 0 ? "+" : "−"}${formatEuro(
            Math.abs(summary.monthlyToAccounts),
          )}`,
        })}
        {summary.shrinking ? ` · ${t("projection.shrinking")}` : ""}
        {!summary.shrinking && summary.accountsFalling
          ? ` · ${t("projection.accountsFalling", {
              amount: formatEuro(
                Math.abs(summary.monthlyAltogether - summary.monthlyToAccounts),
              ),
            })}`
          : ""}
      </Text>

      <View className="mt-1 border-t border-border pt-3">
        <Text className="text-sm font-medium">{t("projection.madeOf")}</Text>
        {makeup.ingredients.map((ingredient) => (
          <Ingredient key={ingredient.kind} ingredient={ingredient} />
        ))}
      </View>

      {runwayLine && runway ? (
        <View className="border-t border-border pt-3">
          <Text variant="muted" className="text-sm">
            {`${t("plan.runwayLead")} `}
            <Text className="font-medium text-foreground">
              {runwayLine.replace(/\.$/, "")}
            </Text>
            {` ${t("plan.runwayRate", {
              amount: formatEuro(runway.monthlyCommitted),
            })}`}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function Figure({
  label,
  value,
  period,
  tone,
  lead = false,
}: {
  label: string;
  value: string;
  period: string;
  tone: "good" | "bad" | "plain";
  lead?: boolean;
}) {
  return (
    <View>
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <PrivateAmount
        className={cn(
          "font-mono font-bold",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-primary-ink",
        )}
        style={{ fontSize: lead ? 28 : 20 }}
      >
        {value}
      </PrivateAmount>
      <Text variant="muted" className="text-xs">
        {period}
      </Text>
    </View>
  );
}

/**
 * One ingredient, and where it is edited.
 *
 * Pressable rather than a row of text: every one of these is something the
 * user can change, and the whole reason the card lists them is so a missing
 * salary or a forgotten subscription is one press from being fixed.
 */
function Ingredient({ ingredient }: { ingredient: ProjectionIngredient }) {
  const t = useT();
  const router = useRouter();
  const colors = useThemeColors();
  const formatEuro = useFormatCurrency();

  const label = {
    income: t("projection.income"),
    committed: t("projection.committed"),
    "set-aside": t("projection.setAside"),
    deployed: t("projection.deployed"),
    unrecorded: t("projection.unrecorded"),
  }[ingredient.kind];

  const backing =
    ingredient.kind === "unrecorded"
      ? ingredient.counted
        ? t("projection.unrecordedMeasured", { count: ingredient.closes })
        : t("projection.unrecordedNotYet")
      : ingredient.charges > 0
        ? t("projection.charges", { count: ingredient.charges })
        : t("projection.noCharges");

  const note =
    ingredient.kind === "set-aside"
      ? t("projection.setAsideNote")
      : ingredient.kind === "deployed"
        ? t("projection.deployedNote")
        : null;

  // Income adds; everything else takes away. `deployed` does neither — it
  // moved inside a wallet — so it gets no sign at all.
  const sign =
    ingredient.kind === "income"
      ? "+"
      : ingredient.kind === "deployed"
        ? ""
        : "−";

  return (
    <Pressable
      onPress={() => router.push(INGREDIENT_ROUTE[ingredient.kind] as never)}
      hitSlop={8}
      className="mt-2 flex-row items-start justify-between gap-3"
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${sign}${formatEuro(ingredient.monthly)}`}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-sm">{label}</Text>
        <Text variant="muted" style={TYPE.micro}>
          {backing}
          {note ? ` · ${note}` : ""}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <PrivateAmount className="font-mono text-sm">
          {`${sign}${formatEuro(ingredient.monthly)}`}
        </PrivateAmount>
        <Ionicons
          name="chevron-forward"
          size={ICON.sm}
          color={colors.mutedForeground}
        />
      </View>
    </Pressable>
  );
}

/**
 * Both tracks, on one scale.
 *
 * Drawn by hand rather than through the chart library, which would cost more
 * than the picture is worth for twenty-four points. The accounts keep the
 * filled area they had; everything kept is a second stroke above it, dashed
 * so the two are told apart without relying on colour.
 *
 * A zero baseline appears whenever the scale reaches below it, which
 * subtracting unrecorded spending now makes reachable.
 */
function ProjectionSparkline({ points }: { points: ProjectionPoint[] }) {
  const colors = useThemeColors();

  if (points.length < 2) {
    return null;
  }

  const width = 100;
  const height = 28;
  const values = [
    ...points.map((point) => point.onHand),
    ...points.map((point) => point.kept),
  ];
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const y = (value: number) => height - ((value - min) / span) * height;
  const path = (pick: (point: ProjectionPoint) => number) =>
    `M${points
      .map(
        (point, index) =>
          `${((index / (points.length - 1)) * width).toFixed(2)},${y(
            pick(point),
          ).toFixed(2)}`,
      )
      .join(" L")}`;

  const accounts = path((point) => point.onHand);
  const kept = path((point) => point.kept);
  const last = points[points.length - 1]!;

  return (
    <View className="my-1 h-16 w-full">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="projectionFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {min < 0 ? (
          <Line
            x1={0}
            x2={width}
            y1={y(0)}
            y2={y(0)}
            stroke={colors.primary}
            strokeOpacity={0.25}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <Path
          d={`${accounts} L${width},${height} L0,${height} Z`}
          fill="url(#projectionFill)"
        />
        <Path
          d={accounts}
          fill="none"
          stroke={colors.primary}
          strokeOpacity={0.45}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d={kept}
          fill="none"
          stroke={colors.primary}
          strokeWidth={1.5}
          strokeDasharray="3 2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <Circle
          cx={width}
          cy={y(last.kept)}
          r={2}
          fill={colors.primary}
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}
