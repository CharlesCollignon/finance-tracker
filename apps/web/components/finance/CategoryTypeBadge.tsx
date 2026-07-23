import { Badge } from "@/components/retroui/Badge";
import {
  CATEGORY_TYPE_BADGE_CLASS,
  CATEGORY_TYPE_LABELS,
} from "@finance/core/category-styles";
import type { CategoryType } from "@finance/core/types/database";
import { cn } from "@/lib/utils";

interface CategoryTypeBadgeProps {
  type: CategoryType;
  className?: string;
}

export function CategoryTypeBadge({ type, className }: CategoryTypeBadgeProps) {
  return (
    <Badge
      size="sm"
      variant="default"
      className={cn(CATEGORY_TYPE_BADGE_CLASS[type], className)}
    >
      {CATEGORY_TYPE_LABELS[type]}
    </Badge>
  );
}
