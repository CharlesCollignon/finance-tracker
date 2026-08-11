import { useMemo } from "react";
import { useColorScheme, View } from "react-native";
import type { EChartsCoreOption } from "echarts/core";

import { formatEuro, savingsRatePercent } from "@finance/core/constants";
import { buildIncomeSankey } from "@finance/core/income-sankey";
import type { MonthlySummary } from "@finance/core/types/database";

import { EChart } from "@/components/charts/EChart";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { usePrivacy } from "@/providers/PrivacyProvider";
import { colorsForScheme } from "@/theme/tokens";

interface IncomeSankeyCardProps {
  summary: MonthlySummary;
}

export function IncomeSankeyCard({ summary }: IncomeSankeyCardProps) {
  const scheme = useColorScheme();
  const colors = colorsForScheme(scheme === "light" ? "light" : "dark");
  const { hidden } = usePrivacy();
  const graph = useMemo(() => buildIncomeSankey(summary), [summary]);
  const rate = savingsRatePercent(summary.savings, summary.income);

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
          emphasis: { focus: "adjacency" },
          nodeAlign: "left",
          nodeGap: 12,
          nodeWidth: 14,
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.45,
          },
          label: {
            color: colors.foreground,
            fontSize: 10,
            formatter: (params: { name: string; value?: number }) => {
              const label = labelByName.get(params.name) ?? params.name;
              if (hidden) {
                return label;
              }
              return `${label}: ${formatEuro(Number(params.value ?? 0))}`;
            },
          },
          data: graph.nodes.map((node) => {
            const midKey = node.name.split(":")[0];
            return {
              name: node.name,
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
  }, [colors, graph, hidden, labelByName]);

  if (!option) {
    return (
      <Card className="p-4">
        <Text className="font-bold">Where your income goes</Text>
        <Text variant="muted" className="mt-2">
          Add income to see how your money is allocated.
        </Text>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <View className="flex-row items-start justify-between gap-3 p-4">
        <View className="flex-1">
          <Text className="font-bold">Where your income goes</Text>
          <Text variant="muted" className="mt-1 text-xs">
            Income → spending, savings, investments
          </Text>
        </View>
        {rate != null ? (
          <View className="rounded-md border border-border bg-primary/10 px-3 py-2">
            <Text variant="muted" className="text-[10px] uppercase">
              Savings rate
            </Text>
            <PrivateAmount className="text-lg font-bold text-primary">
              {`${rate}%`}
            </PrivateAmount>
          </View>
        ) : null}
      </View>
      <EChart option={option} height={280} className="px-1" />
    </Card>
  );
}
