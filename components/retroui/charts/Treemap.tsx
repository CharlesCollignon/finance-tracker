"use client";

import { cn } from "@/lib/utils";
import React from "react";
import {
  ResponsiveContainer,
  Tooltip,
  Treemap as RechartsTreemap,
} from "recharts";

export interface TreemapNode {
  name: string;
  size: number;
  fill?: string;
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  index?: number;
  fill?: string;
}

function TreemapCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name = "",
  fill = "var(--chart-2)",
}: TreemapContentProps) {
  const showLabel = width >= 56 && height >= 36;
  const showShortLabel = !showLabel && width >= 40 && height >= 24;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="var(--border)"
        strokeWidth={2}
      />
      {(showLabel || showShortLabel) && (
        <text
          x={x + 8}
          y={y + 18}
          fill="var(--foreground)"
          fontSize={showLabel ? 12 : 10}
          fontWeight={600}
        >
          {showShortLabel && name.length > 8
            ? `${name.slice(0, 7)}…`
            : name}
        </text>
      )}
    </g>
  );
}

interface TreemapProps extends React.HTMLAttributes<HTMLDivElement> {
  data: TreemapNode[];
  dataKey?: string;
  colors?: string[];
  tooltipBgColor?: string;
  tooltipBorderColor?: string;
  valueFormatter?: (value: number) => string;
  showTooltip?: boolean;
  className?: string;
}

const Treemap = React.forwardRef<HTMLDivElement, TreemapProps>(
  (
    {
      data = [],
      dataKey = "size",
      colors = [
        "var(--chart-2)",
        "var(--chart-1)",
        "var(--chart-3)",
        "var(--chart-4)",
        "var(--chart-5)",
      ],
      tooltipBgColor = "var(--background)",
      tooltipBorderColor = "var(--border)",
      valueFormatter = (value: number) => value.toString(),
      showTooltip = true,
      className,
      ...props
    },
    ref,
  ) => {
    const coloredData = data.map((entry, index) => ({
      ...entry,
      fill: colors[index % colors.length],
    }));

    return (
      <div ref={ref} className={cn("h-80 w-full", className)} {...props}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsTreemap
            data={coloredData}
            dataKey={dataKey}
            nameKey="name"
            aspectRatio={4 / 3}
            isAnimationActive={false}
            content={(cellProps: TreemapContentProps) => (
              <TreemapCell
                {...cellProps}
                fill={
                  cellProps.fill ??
                  coloredData[cellProps.index ?? 0]?.fill ??
                  colors[(cellProps.index ?? 0) % colors.length]
                }
              />
            )}
          >
            {showTooltip && (
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const node = payload[0].payload as TreemapNode;

                  return (
                    <div
                      className="border-2 p-2 shadow"
                      style={{
                        backgroundColor: tooltipBgColor,
                        borderColor: tooltipBorderColor,
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                          {node.name}
                        </span>
                        <span className="font-bold text-foreground">
                          {valueFormatter(node.size)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </RechartsTreemap>
        </ResponsiveContainer>
      </div>
    );
  },
);

Treemap.displayName = "Treemap";

export { Treemap, type TreemapProps };
