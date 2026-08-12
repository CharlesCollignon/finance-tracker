"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { formatEuro } from "@finance/core/constants";
import { CATEGORY_TYPE_LABELS } from "@finance/core/category-styles";
import type { CategoryType } from "@finance/core/types/database";
import { chartMotion, chartTextStyle } from "@/lib/echarts-theme";
import { readCssVar } from "@/lib/css-var";
import {
  useCompactViewport,
  useEchartsSize,
} from "@/lib/use-echarts-size";

export interface TypeTotals {
  income: number;
  expense: number;
  savings: number;
  investment: number;
}

interface TransactionTypeSankeyProps {
  typeTotals: TypeTotals;
  remaining: number;
}

interface Palette {
  income: string;
  expense: string;
  savings: string;
  investment: string;
  remaining: string;
  foreground: string;
  card: string;
  border: string;
}

function readPalette(): Palette {
  return {
    income: readCssVar("--success", "#16a34a"),
    expense: readCssVar("--destructive", "#dc2626"),
    savings: readCssVar("--primary", "#ffc300"),
    investment: readCssVar("--info", "#2563eb"),
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

const OUTFLOW_TYPES: CategoryType[] = ["expense", "savings", "investment"];

/** Type-level Income → Expense/Savings/Investment/Remaining sankey (or donut fallback). */
export function TransactionTypeSankey({
  typeTotals,
  remaining,
}: TransactionTypeSankeyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);
  const [palette, setPalette] = useState<Palette>(readPalette);
  useEchartsSize(containerRef, chartRef);
  const compact = useCompactViewport(419);

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

  const hasIncome = typeTotals.income > 0;
  const remainingPositive = remaining > 0 ? remaining : 0;

  const option = useMemo<EChartsOption | null>(() => {
    const outflows = OUTFLOW_TYPES.map((type) => ({
      label: CATEGORY_TYPE_LABELS[type],
      value: typeTotals[type],
    })).filter((row) => row.value > 0);

    const hasAny =
      hasIncome || outflows.length > 0 || remainingPositive > 0;
    if (!hasAny) {
      return null;
    }

    const colorByName: Record<string, string> = {
      Income: palette.income,
      [CATEGORY_TYPE_LABELS.expense]: palette.expense,
      [CATEGORY_TYPE_LABELS.savings]: palette.savings,
      [CATEGORY_TYPE_LABELS.investment]: palette.investment,
      Remaining: palette.remaining,
    };

    if (!hasIncome) {
      const pieData = outflows.map((row) => ({
        name: row.label,
        value: row.value,
        itemStyle: { color: colorByName[row.label] },
      }));
      if (pieData.length === 0) {
        return null;
      }
      return {
        ...chartMotion(400),
        tooltip: {
          trigger: "item",
          backgroundColor: palette.card,
          borderColor: palette.border,
          textStyle: {
            ...chartTextStyle(),
            color: palette.foreground,
          },
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number };
            return `${p.name}<br/><strong>${formatEuro(p.value)}</strong>`;
          },
        },
        series: [
          {
            type: "pie",
            radius: ["52%", "72%"],
            center: ["50%", "50%"],
            label: { show: false },
            labelLine: { show: false },
            data: pieData,
          },
        ],
      };
    }

    const nodes = [
      { name: "Income" },
      ...outflows.map((row) => ({ name: row.label })),
      ...(remainingPositive > 0 ? [{ name: "Remaining" }] : []),
    ];

    const links = [
      ...outflows.map((row) => ({
        source: "Income",
        target: row.label,
        value: row.value,
      })),
      ...(remainingPositive > 0
        ? [
            {
              source: "Income",
              target: "Remaining",
              value: remainingPositive,
            },
          ]
        : []),
    ];

    if (links.length === 0) {
      return null;
    }

    return {
      ...chartMotion(400),
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
            return `${p.data.source} → ${p.data.target}<br/><strong>${formatEuro(p.data.value ?? 0)}</strong>`;
          }
          return `${p.name}<br/><strong>${formatEuro(Number(p.value ?? 0))}</strong>`;
        },
      },
      series: [
        {
          type: "sankey",
          emphasis: { focus: "adjacency" },
          nodeAlign: "justify",
          nodeGap: compact ? 10 : 12,
          nodeWidth: compact ? 12 : 14,
          layoutIterations: 0,
          // Room for outside labels (Income left, outflows right).
          left: compact ? 52 : 72,
          right: compact ? 64 : 88,
          top: 8,
          bottom: 8,
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.4,
          },
          label: {
            color: palette.foreground,
            fontSize: compact ? 10 : 11,
            formatter: (params: unknown) => {
              const p = params as { name: string; value?: unknown };
              const amount = formatEuro(Number(p.value ?? 0));
              return compact ? `${p.name}\n${amount}` : `${p.name}: ${amount}`;
            },
          },
          data: nodes.map((node) => ({
            name: node.name,
            label: {
              position: node.name === "Income" ? "left" : "right",
            },
            itemStyle: {
              color: colorByName[node.name] ?? palette.remaining,
            },
          })),
          links,
        },
      ],
    };
  }, [compact, hasIncome, palette, remainingPositive, typeTotals]);

  if (!option) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Add income or spending to see the flow.
      </p>
    );
  }

  const height = hasIncome ? (compact ? 280 : 260) : 220;

  return (
    <div ref={containerRef} className="privacy-sensitive w-full min-w-0">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "svg" }}
        notMerge
      />
    </div>
  );
}
