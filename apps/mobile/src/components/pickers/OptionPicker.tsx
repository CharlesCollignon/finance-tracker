import { useState } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { useT } from "@/providers/LocaleProvider";

import { matchesSearch } from "./matches-search";
import { cellWidth, PickerOptionRow } from "./PickerOptionRow";
import { PickerSearch } from "./PickerSearch";
import { PickerSheet } from "./PickerSheet";
import { PickerTrigger } from "./PickerTrigger";

export interface PickerOption {
  value: string;
  label: string;
}

interface OptionPickerProps {
  /** The field's name: the trigger's label and the sheet's heading. */
  label: string;
  options: readonly PickerOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  columns?: 1 | 2 | 3;
  /** A search box or not; by default, from nine options on. */
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Past this many options a sheet gets a search box, as on the web. */
const SEARCH_FROM = 9;

/**
 * Any short list behind a field: weekdays, months. The web's `OptionPicker`,
 * with its panel as a sheet; it replaced fields where a weekday was typed as
 * a number from 1 to 7.
 */
export function OptionPicker({
  label,
  options,
  value,
  onChange,
  placeholder,
  columns = 1,
  searchable,
  disabled,
  className,
}: OptionPickerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const chosen = options.find((option) => option.value === value) ?? null;
  const withSearch = searchable ?? options.length >= SEARCH_FROM;
  const shown = query
    ? options.filter((option) => matchesSearch(option.label, query))
    : options;

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <PickerTrigger
        label={label}
        value={chosen?.label ?? null}
        placeholder={placeholder ?? t("picker.choose")}
        open={open}
        onPress={() => setOpen(true)}
        disabled={disabled}
        className={className}
      />
      <PickerSheet
        open={open}
        title={label}
        onClose={close}
        header={
          withSearch ? (
            <PickerSearch
              value={query}
              onChange={setQuery}
              placeholder={t("picker.search")}
            />
          ) : null
        }
      >
        {shown.length === 0 ? (
          <Text variant="muted" className="px-2 py-3 text-sm">
            {t("picker.noMatch", { query: query.trim() })}
          </Text>
        ) : (
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap">
            {shown.map((option) => (
              <View
                key={option.value}
                className="p-0.5"
                style={{ width: cellWidth(columns) }}
              >
                <PickerOptionRow
                  label={option.label}
                  selected={option.value === value}
                  onPress={() => {
                    onChange(option.value);
                    close();
                  }}
                />
              </View>
            ))}
          </View>
        )}
      </PickerSheet>
    </>
  );
}
