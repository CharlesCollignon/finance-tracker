import { formatEuro } from "@/lib/constants";
import type { CategoryBreakdown } from "@/lib/types/database";
import { Card } from "@/components/retroui/Card";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  amount: number;
  highlight?: boolean;
  warning?: boolean;
}

export function SummaryCard({
  label,
  amount,
  highlight,
  warning,
}: SummaryCardProps) {
  return (
    <Card
      className={cn(
        "flex w-full items-center justify-between p-4 md:p-5",
        highlight && "border-destructive bg-accent",
        warning && "border-destructive",
      )}
    >
      <span className="font-head text-base md:text-lg">{label}</span>
      <span className="tabular-nums text-lg font-semibold md:text-xl">
        {formatEuro(amount)}
      </span>
    </Card>
  );
}

interface BreakdownListProps {
  items: CategoryBreakdown[];
  incomeTotal: number;
}

export function BreakdownList({ items, incomeTotal }: BreakdownListProps) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-2 text-sm text-muted-foreground">No entries yet</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 px-4 pb-4">
      {items.map((item) => {
        const pct = incomeTotal > 0 ? (item.total / incomeTotal) * 100 : 0;

        return (
          <li key={item.categoryId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{item.name}</span>
              <span className="shrink-0 tabular-nums font-medium">
                {formatEuro(item.total)}
              </span>
            </div>
            <div className="h-2 w-full border border-border bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
