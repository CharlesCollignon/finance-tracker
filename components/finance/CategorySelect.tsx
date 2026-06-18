"use client";

import type { ChangeEvent } from "react";
import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@/lib/categories";
import type { Category, CategoryType } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export const CATEGORY_SELECT_CLASS =
  "h-11 w-full rounded border-2 border-border bg-background px-3 text-base text-foreground shadow-md";

interface CategorySelectProps {
  id: string;
  name?: string;
  categories: Category[];
  excludeTypes?: CategoryType[];
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}

export function CategorySelect({
  id,
  name = "categoryId",
  categories,
  excludeTypes,
  value,
  defaultValue,
  required,
  disabled,
  placeholder = "Select category",
  className,
  onChange,
}: CategorySelectProps) {
  const groups = groupCategoriesByType(categories, { excludeTypes });

  return (
    <select
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      className={cn(CATEGORY_SELECT_CLASS, className)}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      onChange={onChange}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {groups.map((group) => (
        <optgroup key={group.type} label={group.label}>
          {group.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {formatCategoryOptionLabel(cat)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
