"use client";

import { Badge } from "@/components/retroui/Badge";
import {
  CATEGORY_TYPE_BADGE_CLASS,
  categoryTypeLabels,
} from "@finance/core/category-styles";
import type { CategoryType } from "@finance/core/types/database";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";

interface CategoryTypeBadgeProps {
  type: CategoryType;
  className?: string;
}

export function CategoryTypeBadge({ type, className }: CategoryTypeBadgeProps) {
  const locale = useLocale();
  return (
    <Badge
      size="sm"
      variant="default"
      className={cn(CATEGORY_TYPE_BADGE_CLASS[type], className)}
    >
      {categoryTypeLabels(locale)[type]}
    </Badge>
  );
}
