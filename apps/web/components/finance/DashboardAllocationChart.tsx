"use client";

import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { formatEuro, savingsRatePercent } from "@finance/core/constants";
import { buildIncomeSankey } from "@finance/core/income-sankey";
import type { MonthlySummary } from "@finance/core/types/database";
import { chartMotion, chartTextStyle } from "@/lib/echarts-theme";
import { readCssVar } from "@/lib/css-var";

interface DashboardAllocationChartProps {
  summary: MonthlySummary;
}

interface Palette {
  income: string;
  expenses: string;
  savings: string;
  investments: string;
  remaining: string;
  foreground: string;
  card: string;
  border: string;
}

function readPalette(): Palette {
  return {
    income: readCssVar("--success", "#16a34a"),
    expenses: readCssVar("--destructive", "#dc2626"),
    savings: readCssVar("--primary", "#ffc300"),
    investments: readCssVar("--info", "#2563eb"),
    remaining: readCssVar("--chart-5", "#a1a1aa"),
    foreground: readCssVar("--foreground", "#fafafa"),
    card: readCssVar("--card", "#141414"),
    border: readCssVar("--border", "#27272a"),
  };
}

function paletteEqual(a: Palette, b: Palette): boolean {
  return (Object.keys(a) as Array<keyof Palette>).every(
    (key) => a[key] === b[key],
  );
}

export function DashboardAllocationChart({
  summary,
}: DashboardAllocationChartProps) {
  const graph = useMemo(() => buildIncomeSankey(summary), [summary]);
  const rate = savingsRatePercent(
    summary.savings,
    summary.investments,
    summary.investmentDeployments,
    summary.income,
  );
  const [palette, setPalette] = useState<Palette>(readPalette);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const next = readPalette();
      setPalette((prev) => (paletteEqual(prev, next) ? prev : next));
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "data-privacy"],
    });
    return () => observer.disconnect();
  }, []);

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

  const option = useMemo<EChartsOption | null>(() => {
    if (!graph) {
      return null;
    }

    const colorByKey: Record<string, string> = {
      income: palette.income,
      expenses: palette.expenses,
      savings: palette.savings,
      investments: palette.investments,
      remaining: palette.remaining,
    };

    return {
      ...chartMotion(350),
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        backgroundColor: palette.card,
        borderColor: palette.border,
        textStyle: {
          ...chartTextStyle(),
          color: palette.foreground,
        },
        formatter: (params: unknown) => {
          const p = params as {
            dataType?: string;
            name?: string;
            value?: number;
            data?: { source?: string; target?: string; value?: number };
          };
          if (p.dataType === "edge" && p.data) {
            const from = labelByName.get(p.data.source ?? "") ?? p.data.source;
            const to = labelByName.get(p.data.target ?? "") ?? p.data.target;
            return `${from} → ${to}<br/><strong>${formatEuro(p.data.value ?? 0)}</strong>`;
          }
          const label = labelByName.get(p.name ?? "") ?? p.name;
          return `${label}<br/><strong>${formatEuro(Number(p.value ?? 0))}</strong>`;
        },
      },
      series: [
        {
          type: "sankey",
          emphasis: { focus: "adjacency" },
          nodeAlign: "justify",
          nodeGap: 10,
          nodeWidth: 16,
          // Preserve our depth/group order — iterations scramble leaves.
          layoutIterations: 0,
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.4,
          },
          label: {
            color: palette.foreground,
            fontSize: 11,
            position: "right",
            formatter: (params: unknown) => {
              const p = params as { name: string; value?: unknown };
              const label = labelByName.get(p.name) ?? p.name;
              const value = Number(p.value ?? 0);
              return `${label}: ${formatEuro(value)}`;
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
                  palette.remaining,
              },
            };
          }),
          links: graph.links,
        },
      ],
    };
  }, [graph, labelByName, palette]);

  const legend = [
    { label: "Income", value: summary.income, color: palette.income },
    { label: "Expenses", value: summary.expenses, color: palette.expenses },
    { label: "Savings", value: summary.savings, color: palette.savings },
    {
      label: "Investments",
      value: graph?.invested ?? 0,
      color: palette.investments,
    },
    ...(summary.remaining > 0
      ? [
          {
            label: "Remaining",
            value: summary.remaining,
            color: palette.remaining,
          },
        ]
      : []),
  ].filter((row) => row.value > 0);

  return (
    <section className="flex w-full flex-col items-center">
      <div className="flex w-full max-w-lg items-center gap-4 text-left">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            Where your income goes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Flow from income into spending, savings, and investments
          </p>
        </div>
        {rate != null ? (
          <div
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-2 border-primary text-center"
            aria-label={`Savings rate ${rate}%`}
          >
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Savings
            </span>
            <span className="privacy-amount font-head text-xl leading-none text-primary tabular-nums">
              {rate}%
            </span>
          </div>
        ) : null}
      </div>
      {option ? (
        <div className="privacy-sensitive mt-4 w-full">
          <ReactECharts
            option={option}
            style={{ height: 320, width: "100%" }}
            opts={{ renderer: "svg" }}
            notMerge
          />
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Add income to see how your money is allocated.
        </p>
      )}
      {graph ? (
        <ul className="mt-4 flex w-full max-w-xs flex-col gap-2 text-left">
          {legend.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: row.color }}
                  aria-hidden
                />
                <span className="truncate">{row.label}</span>
              </span>
              <PrivateAmount className="shrink-0 font-medium">
                {formatEuro(row.value)}
              </PrivateAmount>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
