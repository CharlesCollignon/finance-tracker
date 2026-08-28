import { useMemo } from "react";
import { View } from "react-native";
import type { EChartsCoreOption } from "echarts/core";

import { savingsRatePercent } from "@finance/core/constants";
import { buildIncomeSankey } from "@finance/core/income-sankey";
import type { MonthlySummary } from "@finance/core/types/database";

import { EChart } from "@/components/charts/EChart";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface IncomeSankeyCardProps {
  summary: MonthlySummary;
}

export function IncomeSankeyCard({ summary }: IncomeSankeyCardProps) {
  const colors = useThemeColors();
  const { hidden } = usePrivacy();
  const formatEuro = useFormatCurrency();
  const graph = useMemo(() => buildIncomeSankey(summary), [summary]);
  const rate = savingsRatePercent(
    summary.savings,
    summary.investments,
    summary.investmentDeployments,
    summary.income,
  );

  const labelByName = useMemo(() => {
    const map = new Map<string, string>();
    if (!graph) {
      return map;
    }
    for (const node of graph.nodes) {
      map.set(node.name, node.label);
    }
    return map;
  }, [graph]);

  const depthByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of graph?.nodes ?? []) {
      map.set(node.name, node.depth ?? 0);
    }
    return map;
  }, [graph]);

  const option = useMemo<EChartsCoreOption | null>(() => {
    if (!graph) {
      return null;
    }

    const colorByKey: Record<string, string> = {
      income: colors.success,
      expenses: colors.destructive,
      savings: colors.primary,
      investments: colors.info,
      remaining: colors.mutedForeground,
    };

    return {
      animationDuration: 300,
      series: [
        {
          type: "sankey",
          // The deepest column labels sit in this right margin. ECharts
          // defaults to 20%, which clips them at phone widths.
          left: 8,
          right: 96,
          top: 8,
          bottom: 8,
          emphasis: { focus: "adjacency" },
          nodeAlign: "justify",
          nodeGap: 8,
          nodeWidth: 14,
          layoutIterations: 0,
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.4,
          },
          label: {
            color: colors.foreground,
            fontSize: 10,
            position: "right",
            formatter: (params: { name: string; value?: number }) => {
              const label = labelByName.get(params.name) ?? params.name;
              if (hidden) {
                return label;
              }
              const value = formatEuro(Number(params.value ?? 0));
              // Stack the value under the name on the last column so the pair
              // fits the right margin instead of running off the canvas.
              return depthByName.get(params.name) === 2
                ? `${label}\n${value}`
                : `${label}: ${value}`;
            },
          },
          data: graph.nodes.map((node) => {
            const midKey = node.name.split(":")[0];
            return {
              name: node.name,
              depth: node.depth,
              itemStyle: {
                color:
                  colorByKey[midKey] ??
                  colorByKey[node.name] ??
                  colors.mutedForeground,
              },
            };
          }),
          links: graph.links,
        },
      ],
    };
  }, [colors, depthByName, formatEuro, graph, hidden, labelByName]);

  const legend = [
    { label: "Income", value: summary.income, color: colors.success },
    { label: "Expenses", value: summary.expenses, color: colors.destructive },
    { label: "Savings", value: summary.savings, color: colors.primary },
    { label: "Investments", value: graph?.invested ?? 0, color: colors.info },
    ...(summary.remaining > 0
      ? [
          {
            label: "Remaining",
            value: summary.remaining,
            color: colors.mutedForeground,
          },
        ]
      : []),
  ].filter((row) => row.value > 0);

  const header = (
    <View className="flex-row items-center gap-4">
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-muted-foreground">
          Where your income goes
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Flow from income into spending, savings, and investments
        </Text>
      </View>
      {rate != null ? (
        // Circular savings-rate ring, matching the web allocation card.
        <View
          accessibilityLabel={`Savings rate ${rate}%`}
          className="h-20 w-20 items-center justify-center rounded-full border-2 border-primary"
        >
          <Text className="text-[9px] font-medium uppercase text-muted-foreground">
            Savings
          </Text>
          <PrivateAmount className="font-serif text-xl text-primary-ink">
            {`${rate}%`}
          </PrivateAmount>
        </View>
      ) : null}
    </View>
  );

  if (!option) {
    return (
      <Card bezel innerClassName="p-4">
        {header}
        <Text variant="muted" className="mt-4 text-center text-sm">
          Add income to see how your money is allocated.
        </Text>
      </Card>
    );
  }

  return (
    <Card bezel innerClassName="p-4">
      {header}
      <EChart option={option} height={280} className="mt-4" />
      <View className="mt-4 gap-2">
        {legend.map((row) => (
          <View
            key={row.label}
            className="flex-row items-center justify-between gap-2"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <View
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: row.color }}
              />
              <Text numberOfLines={1} className="flex-1 text-sm">
                {row.label}
              </Text>
            </View>
            <PrivateAmount className="font-mono text-sm font-medium">
              {formatEuro(row.value)}
            </PrivateAmount>
          </View>
        ))}
      </View>
    </Card>
  );
}
