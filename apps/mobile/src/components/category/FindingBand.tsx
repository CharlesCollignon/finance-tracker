import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  findingIsGoodNews,
  type CategoryFinding,
} from "@finance/core/category-findings";
import type { CategoryBreakdown } from "@finance/core/types/database";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { rerankFindings } from "@/lib/category-screen";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { CHART_COLORS, ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** The most rows worth reading before a list becomes a page. */
const MAX_FINDINGS_SHOWN = 5;

/**
 * What moved, in the order worth reading it in — the web's `FindingBand`.
 *
 * That order is the app's own — weight a month, heaviest first — and it
 * leads until somebody asks for another. There is no automatic call: a
 * quiet button asks, and whether a stored order still describes the figures
 * under it was decided before this was handed the answer.
 */
export function FindingBand({
  findings,
  remarks,
  rerankState,
  rerankWritable,
  rerankWritesLeft,
  breakdown,
  breakdownTotal,
  openId,
  onOpen,
}: {
  /** Already in the order to read them in — the app's, or a model's. */
  findings: CategoryFinding[];
  remarks: Record<string, string>;
  rerankState: "none" | "applied" | "stale";
  rerankWritable: boolean;
  rerankWritesLeft: number;
  breakdown: CategoryBreakdown[];
  breakdownTotal: number;
  openId: string | null;
  onOpen: (categoryId: string) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const colors = useThemeColors();
  const [pending, setPending] = useState(false);
  const [left, setLeft] = useState(rerankWritesLeft);
  const shown = findings.slice(0, MAX_FINDINGS_SHOWN);

  // A note about an order is only true of an order somebody can see.
  const note =
    shown.length === 0
      ? null
      : rerankState === "applied"
        ? t("categoryFindings.reranked")
        : rerankState === "stale"
          ? t("categoryFindings.rerankStale")
          : null;

  async function rerank() {
    if (pending) {
      return;
    }
    setPending(true);
    const outcome = await rerankFindings();
    setPending(false);
    if (outcome.writesLeft !== null) {
      setLeft(outcome.writesLeft);
    }
    if (outcome.written) {
      void hapticSuccess();
    }
    if (outcome.message) {
      toast(outcome.message, outcome.written ? "success" : "error");
    }
  }

  return (
    <Card className="gap-4">
      <Text className="font-semibold">{t("categoryFindings.bandTitle")}</Text>
      <SpendStrip rows={breakdown} total={breakdownTotal} />
      {shown.length === 0 ? (
        <Text variant="muted" className="text-sm">
          {t("categoryFindings.bandEmpty")}
        </Text>
      ) : (
        <View>
          {shown.map((finding, index) => (
            <FindingRow
              key={finding.id}
              finding={finding}
              remark={remarks[finding.id]}
              open={finding.categoryId === openId}
              last={index === shown.length - 1}
              onOpen={onOpen}
            />
          ))}
        </View>
      )}

      {note !== null || rerankWritable ? (
        <View className="gap-2 border-t border-border pt-2">
          {note ? (
            <Text variant="muted" className="text-xs">
              {note}
            </Text>
          ) : null}
          {rerankWritable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending || left <= 0 }}
              disabled={pending || left <= 0}
              onPress={() => {
                void hapticLight();
                void rerank();
              }}
              className={cn(
                "min-h-11 flex-row items-center justify-center gap-1.5 self-start rounded-full px-4",
                left > 0 ? "bg-primary" : "border border-border",
                (pending || left <= 0) && "opacity-60",
              )}
            >
              <Ionicons
                name="pencil"
                size={ICON.sm}
                color={
                  left > 0 ? colors.primaryForeground : colors.mutedForeground
                }
              />
              <Text
                className={cn(
                  "text-sm font-medium",
                  left > 0 ? "text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {pending
                  ? t("categoryRead.writing")
                  : left <= 0
                    ? t("categoryRead.noReadsLeft")
                    : t("categoryFindings.rerank")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * One finding: the category, what it did, and what that is worth. The
 * sentence holds no amount — a figure in prose could not be masked or
 * follow the currency — so the weight sits beside it on its own.
 */
function FindingRow({
  finding,
  remark,
  open,
  last,
  onOpen,
}: {
  finding: CategoryFinding;
  /** A model's clause on why this one leads, when one survived. */
  remark?: string;
  open: boolean;
  last: boolean;
  onOpen: (categoryId: string) => void;
}) {
  const t = useT();
  const formatMoney = useFormatCurrency();
  // Only these two weigh a sustained monthly figure; the others weigh one
  // month's distance from normal, worth its size once.
  const perMonth = finding.kind === "drift" || finding.kind === "gone-quiet";
  // Never off `direction` alone: a salary that stopped points down, and down
  // is not good news on money coming in.
  const good = findingIsGoodNews(finding);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => {
        void hapticLight();
        onOpen(finding.categoryId);
      }}
      className={cn(
        "flex-row items-baseline gap-3 py-2.5 active:bg-muted/40",
        !last && "border-b border-border",
      )}
    >
      <Text className="text-sm font-medium">{finding.categoryName}</Text>
      <View className="min-w-0 flex-1">
        <Text variant="muted" className="text-sm">
          {t(finding.messageKey, finding.params)}
        </Text>
        {remark ? (
          <Text variant="muted" className="text-xs italic">
            {remark}
          </Text>
        ) : null}
      </View>
      <PrivateAmount
        className={cn(
          "text-sm font-semibold",
          good ? "text-success" : "text-destructive",
        )}
      >
        {t(
          perMonth
            ? "categoryFindings.weightPerMonth"
            : "categoryFindings.weightOnce",
          { amount: formatMoney(finding.severity) },
        )}
      </PrivateAmount>
    </Pressable>
  );
}

/**
 * Where the month went, as one bar — the web's `SpendStrip`. Five bands and
 * a remainder, because a band thinner than a couple of percent is a colour
 * nobody can match to a legend.
 */
function SpendStrip({
  rows,
  total,
}: {
  rows: CategoryBreakdown[];
  total: number;
}) {
  const t = useT();
  const formatMoney = useFormatCurrency();
  const colors = useThemeColors();

  if (total <= 0 || rows.length === 0) {
    return null;
  }

  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, CHART_COLORS.length);
  const rest = sorted.slice(CHART_COLORS.length);
  const restTotal = rest.reduce((sum, row) => sum + row.total, 0);
  const segments = [
    ...head.map((row, index) => ({
      key: row.categoryId,
      name: row.name,
      amount: row.total,
      color: CHART_COLORS[index % CHART_COLORS.length]!,
    })),
    ...(restTotal > 0
      ? [
          {
            key: "rest",
            name: t("spendStrip.more", { count: rest.length }),
            amount: restTotal,
            color: colors.mutedForeground,
          },
        ]
      : []),
  ];

  return (
    <View className="gap-3">
      <View
        accessible
        accessibilityLabel={t("spendStrip.label", { count: segments.length })}
        className="h-2.5 w-full flex-row overflow-hidden rounded-full"
      >
        {segments.map((segment) => (
          <View
            key={segment.key}
            style={{
              width: `${(segment.amount / total) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </View>
      <View className="gap-1.5">
        {segments.map((segment) => (
          <View
            key={segment.key}
            className="flex-row items-baseline justify-between gap-3"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <Text
                numberOfLines={1}
                variant="muted"
                className="min-w-0 flex-1 text-sm"
              >
                {segment.name}
              </Text>
            </View>
            <PrivateAmount className="text-sm">
              {formatMoney(segment.amount)}
            </PrivateAmount>
          </View>
        ))}
      </View>
    </View>
  );
}
