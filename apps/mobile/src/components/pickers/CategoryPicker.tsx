import { useMemo, useState } from "react";
import { View } from "react-native";

import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import type { Category, CategoryType } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { ChipRow } from "@/components/ui/ChipRow";
import { Text } from "@/components/ui/Text";
import { useLocale, useT } from "@/providers/LocaleProvider";

import { matchesSearch } from "./matches-search";
import { cellWidth, PickerOptionRow } from "./PickerOptionRow";
import { PickerSearch } from "./PickerSearch";
import { PickerSheet } from "./PickerSheet";
import { PickerTrigger } from "./PickerTrigger";

interface CategoryPickerProps {
  /** The field's name, read out with the choice: "Catégorie : Courses". */
  label: string;
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  excludeTypes?: CategoryType[];
  /** Shown while nothing is chosen, in place of "Choisir une catégorie". */
  placeholder?: string;
  /**
   * A first choice that means no category, with its own words: "Toutes les
   * dépenses" for a cap. Its value is "".
   */
  allLabel?: string;
  /** Most-recently-used ids, newest first: offered above the kinds. */
  recentIds?: readonly string[];
  disabled?: boolean;
  className?: string;
  /** The kind it opens on while nothing is chosen, rather than expenses. */
  initialType?: CategoryType;
}

/** How many recent categories the sheet offers before the kinds. */
const RECENT_LIMIT = 4;

/**
 * Choosing a category: search, one chip per kind, and the kind's categories
 * two to a row with their icons — the web's `CategoryPicker`, in a sheet.
 *
 * The forms it replaced drew every category at once in one tall column under
 * four headings, so a person with thirty categories scrolled past twenty of
 * them to reach the amount. Here one kind shows at a time and typing searches
 * all of them. The kind chips are the foreground, not gold: choosing which
 * list to look at is navigation, not a decision.
 */
export function CategoryPicker({
  label,
  categories,
  value,
  onChange,
  excludeTypes,
  placeholder,
  allLabel,
  recentIds = [],
  disabled,
  className,
  initialType,
}: CategoryPickerProps) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<CategoryType | null>(null);

  const chosen = categories.find((category) => category.id === value) ?? null;
  const groups = useMemo(
    () => groupCategoriesByType(categories, { excludeTypes, locale }),
    [categories, excludeTypes, locale],
  );
  const recent = useMemo(
    () =>
      recentIds
        .map((id) => categories.find((category) => category.id === id))
        .filter(
          (category): category is Category =>
            category !== undefined &&
            !(excludeTypes ?? []).includes(category.type),
        )
        .slice(0, RECENT_LIMIT),
    [recentIds, categories, excludeTypes],
  );

  // The chosen category's kind, else the one asked for, else expenses, else
  // whichever kind exists.
  const opensOn = initialType ?? "expense";
  const activeType =
    tab ??
    (chosen && groups.some((group) => group.type === chosen.type)
      ? chosen.type
      : (groups.find((group) => group.type === opensOn)?.type ??
        groups.find((group) => group.type === "expense")?.type ??
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

  const display = chosen
    ? formatCategoryOptionLabel(chosen, locale)
    : value === "" && allLabel
      ? allLabel
      : null;

  function close() {
    setOpen(false);
    setQuery("");
    setTab(null);
  }

  function choose(next: string) {
    onChange(next);
    close();
  }

  function grid(items: Category[]) {
    return (
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap">
        {items.map((category) => (
          <View
            key={category.id}
            className="p-0.5"
            style={{ width: cellWidth(2) }}
          >
            <PickerOptionRow
              label={formatCategoryOptionLabel(category, locale)}
              selected={category.id === value}
              onPress={() => choose(category.id)}
              leading={
                <CategoryIcon
                  icon={category.icon}
                  className="h-8 w-8 border-0 bg-muted"
                />
              }
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <>
      <PickerTrigger
        label={label}
        value={display}
        placeholder={placeholder ?? t("transaction.selectCategory")}
        leading={
          chosen ? (
            <CategoryIcon
              icon={chosen.icon}
              className="h-7 w-7 border-0 bg-muted"
            />
          ) : null
        }
        open={open}
        onPress={() => setOpen(true)}
        disabled={disabled}
        className={className}
      />
      <PickerSheet
        open={open}
        title={t("picker.chooseCategory")}
        onClose={close}
        header={
          <>
            <PickerSearch
              value={query}
              onChange={setQuery}
              placeholder={t("picker.searchCategories")}
            />
            {!searching && groups.length > 1 && activeType ? (
              <ChipRow
                label={t("picker.kindOfCategory")}
                options={groups.map((group) => ({
                  value: group.type,
                  label: group.label,
                }))}
                value={activeType}
                onChange={setTab}
              />
            ) : null}
          </>
        }
      >
        <View className="gap-3">
          {allLabel && !searching ? (
            <PickerOptionRow
              label={allLabel}
              selected={value === ""}
              onPress={() => choose("")}
            />
          ) : null}

          {recent.length > 0 && !searching ? (
            <View className="gap-1">
              <Text variant="label" className="px-2.5">
                {t("inboxGroups.recentCategories")}
              </Text>
              {grid(recent)}
            </View>
          ) : null}

          {results.length === 0 ? (
            <Text variant="muted" className="px-2.5 py-3 text-sm">
              {t("picker.noMatch", { query: query.trim() })}
            </Text>
          ) : (
            results.map((group) => (
              <View key={group.type} className="gap-1">
                {searching || recent.length > 0 ? (
                  <Text variant="label" className="px-2.5">
                    {group.label}
                  </Text>
                ) : null}
                {grid(group.categories)}
              </View>
            ))
          )}
        </View>
      </PickerSheet>
    </>
  );
}
