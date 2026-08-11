import { formatEuro } from "@finance/core/constants";
import type { CategoryBreakdown } from "@finance/core/types/database";
import { Card } from "@/components/retroui/Card";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  amount: number;
  highlight?: boolean;
  warning?: boolean;
  hint?: string;
}

export function SummaryCard({
  label,
  amount,
  highlight,
  warning,
  hint,
}: SummaryCardProps) {
  return (
    <Card
      className={cn(
        "flex w-full flex-col gap-1 p-4 md:p-5",
        highlight && !warning && "border-border bg-muted",
        warning && "border-destructive bg-destructive/10",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-head text-base md:text-lg">{label}</span>
        <PrivateAmount className="text-lg font-semibold md:text-xl">
          {formatEuro(amount)}
        </PrivateAmount>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
              <PrivateAmount className="shrink-0 font-medium">
                {formatEuro(item.total)}
              </PrivateAmount>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
