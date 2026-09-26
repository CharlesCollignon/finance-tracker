"use client";

import { useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import type { Category, CategoryType } from "@finance/core/types/database";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import {
  matchesSearch,
  moveFocusInGrid,
  PICKER_OPTION_CLASS,
  PickerField,
  PickerSearch,
  PickerShell,
} from "@/components/layout/Picker";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";

interface CategoryPickerProps {
  id: string;
  /** Posted under this name, like the select it replaces. */
  name?: string;
  categories: Category[];
  excludeTypes?: CategoryType[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (categoryId: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Shown while nothing is chosen, in place of "Select category". */
  placeholder?: string;
  /**
   * A first choice that means no category, with its own words: "All
   * expenses" for a cap, "All categories" for a filter. Its value is "".
   */
  allLabel?: string;
  /** Names the trigger together with the choice, "Category: Groceries". */
  label?: string;
  className?: string;
  triggerClassName?: string;
  side?: "bottom" | "top";
}

/**
 * Choosing a category: search, one tab per kind, and a grid of the kind's
 * categories with their icons.
 *
 * The select this replaces listed every category in one column under four
 * group headings, which is a long scroll for anybody with more than a dozen.
 * Here one kind is shown at a time, two to a row, and typing searches all of
 * them at once. The tabs are neutral rather than coloured by kind: gold on a
 * "Savings" chip would be the accent spent on navigation, which DESIGN.md's
 * Rare Accent Rule took off every chip in the app.
 */
export function CategoryPicker({
  id,
  name = "categoryId",
  categories,
  excludeTypes,
  value,
  defaultValue,
  onValueChange,
  required,
  disabled,
  placeholder,
  allLabel,
  label,
  className,
  triggerClassName,
  side,
}: CategoryPickerProps) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const current = value ?? inner;
  const chosen = categories.find((category) => category.id === current) ?? null;
  const groups = groupCategoriesByType(categories, { excludeTypes, locale });
  const [tab, setTab] = useState<CategoryType | null>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // The chosen category's kind, else expenses, else whichever kind exists.
  const activeType =
    tab ??
    (chosen && groups.some((group) => group.type === chosen.type)
      ? chosen.type
      : (groups.find((group) => group.type === "expense")?.type ??
        groups[0]?.type ??
        null));

  const searching = query.trim().length > 0;
  const results = searching
    ? groups
        .map((group) => ({
          ...group,
          categories: group.categories.filter((category) =>
            matchesSearch(category.name, query),
          ),
        }))
        .filter((group) => group.categories.length > 0)
    : groups.filter((group) => group.type === activeType);

  const displayText = chosen
    ? formatCategoryOptionLabel(chosen, locale)
    : current === "" && allLabel
      ? allLabel
      : (placeholder ?? t("transaction.selectCategory"));

  function choose(next: string) {
    if (value === undefined) {
      setInner(next);
    }
    onValueChange?.(next);
    close();
    document.getElementById(id)?.focus();
  }

  function close() {
    setOpen(false);
    setQuery("");
    setTab(null);
  }

  function option(
    key: string,
    label: string,
    selected: boolean,
    icon?: string | null,
  ) {
    return (
      <button
        key={key}
        type="button"
        data-picker-option
        aria-pressed={selected}
        onClick={() => choose(key === "__all" ? "" : key)}
        className={cn(PICKER_OPTION_CLASS, selected && "bg-muted")}
      >
        {icon !== undefined ? (
          <CategoryIcon
            icon={icon}
            className="size-7 rounded-control border-0 bg-muted [&_svg]:size-4"
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {selected ? (
          <Check size={ICON.sm} aria-hidden className="shrink-0" />
        ) : null}
      </button>
    );
  }

  return (
    <PickerShell
      id={id}
      panelLabel={t("picker.chooseCategory")}
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      disabled={disabled}
      triggerLabel={label ? `${label}: ${displayText}` : undefined}
      className={className}
      triggerClassName={triggerClassName}
      side={side}
      panelClassName="md:min-w-[22rem]"
      field={<PickerField name={name} value={current} required={required} />}
      display={
        chosen ? (
          <>
            <CategoryIcon
              icon={chosen.icon}
              className="size-6 rounded-control border-0 bg-muted [&_svg]:size-3.5"
            />
            <span className="truncate">
              {formatCategoryOptionLabel(chosen, locale)}
            </span>
          </>
        ) : current === "" && allLabel ? (
          <span className="truncate">{allLabel}</span>
        ) : (
          <span className="truncate text-muted-foreground">
            {placeholder ?? t("transaction.selectCategory")}
          </span>
        )
      }
    >
      <PickerSearch
        value={query}
        onChange={setQuery}
        placeholder={t("picker.searchCategories")}
        onArrowDown={() =>
          optionsRef.current
            ?.querySelector<HTMLElement>("[data-picker-option]")
            ?.focus()
        }
      />

      {!searching && groups.length > 1 ? (
        <div
          role="group"
          aria-label={t("picker.kindOfCategory")}
          className="flex gap-1 overflow-x-auto"
        >
          {groups.map((group) => (
            <button
              key={group.type}
              type="button"
              aria-pressed={group.type === activeType}
              onClick={() => setTab(group.type)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium",
                "transition-colors duration-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                group.type === activeType
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {group.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={optionsRef}
        onKeyDown={(event) => moveFocusInGrid(event, 2)}
        className="flex max-h-72 flex-col gap-2 overflow-y-auto"
      >
        {allLabel && !searching ? (
          <div className="grid grid-cols-1">
            {option("__all", allLabel, current === "")}
          </div>
        ) : null}
        {results.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {t("picker.noMatch", { query: query.trim() })}
          </p>
        ) : (
          results.map((group) => (
            <div key={group.type} className="flex flex-col gap-1">
              {searching ? (
                <p className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-0.5">
                {group.categories.map((category) =>
                  option(
                    category.id,
                    formatCategoryOptionLabel(category, locale),
                    category.id === current,
                    category.icon,
                  ),
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </PickerShell>
  );
}
