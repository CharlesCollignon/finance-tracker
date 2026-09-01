import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import {
  buildImportRows,
  detectDelimiter,
  guessColumnMapping,
  looksLikeHeaderRow,
  parseCsv,
  summarizeImportRows,
  type ColumnMapping,
  type ImportRow,
} from "@finance/core/csv-import";
import { groupCategoriesByType } from "@finance/core/categories";
import { guessCategoryForDescription } from "@finance/core/merchant-memory";
import type { Category } from "@finance/core/types/database";

import { CategoryIcon } from "@/components/CategoryIcon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { cn } from "@/lib/cn";
import { notifyDataChanged } from "@/lib/data-version";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { importTransactions } from "@/lib/mutations";
import {
  getExistingKeysForRange,
  getQuickEntryContext,
} from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

/** A statement bigger than this is almost certainly the wrong file. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Step = "choose" | "map" | "review";

const STATUS_LABEL: Record<ImportRow["status"], string> = {
  ready: "Ready",
  duplicate: "Skipped",
  invalid: "Problem",
};

/**
 * Importing a bank statement on the phone.
 *
 * The same parser and the same merchant memory as the web importer — what
 * changes is the shape: a phone cannot show a mapping grid and a review table,
 * so the columns are confirmed as a short list and the rows are reviewed as
 * cards, with a bulk assignment for everything the app could not categorise.
 */
export default function ImportScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();

  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data } = useRefreshable(async () => {
    if (!user) {
      return { categories: [] as Category[], merchants: [] };
    }
    const context = await getQuickEntryContext(user.id);
    return { categories: context.categories, merchants: context.merchants };
  }, [user?.id]);

  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const merchantIndex = useMemo(
    () => new Map((data?.merchants ?? []).map((rule) => [rule.key, rule])),
    [data?.merchants],
  );
  const categoryGroups = useMemo(
    () => groupCategoriesByType(categories),
    [categories],
  );

  const headers = hasHeader ? (table[0] ?? []) : [];
  const dataRows = hasHeader ? table.slice(1) : table;

  async function pickFile() {
    setProblem(null);

    const result = await DocumentPicker.getDocumentAsync({
      // Android reports CSV under several types, and some file providers give
      // none at all, so the filter stays wide and the parser decides.
      type: ["text/csv", "text/comma-separated-values", "text/plain", "*/*"],
      // Required for the file to be readable straight after picking.
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];

    if ((asset.size ?? 0) > MAX_FILE_BYTES) {
      setProblem("That file is larger than 5 MB — is it the right export?");
      return;
    }

    let text: string;
    try {
      text = await new File(asset.uri).text();
    } catch {
      setProblem("That file could not be opened.");
      return;
    }

    const parsed = parseCsv(text, detectDelimiter(text));
    if (parsed.length === 0) {
      setProblem("That file has no rows in it.");
      return;
    }

    const header = looksLikeHeaderRow(parsed[0]!);
    setFileName(asset.name);
    setTable(parsed);
    setHasHeader(header);
    setMapping(
      guessColumnMapping(
        header
          ? parsed[0]!
          : parsed[0]!.map((_, index) => `Column ${index + 1}`),
      ),
    );
    setStep("map");
  }

  function guessCategory(description: string) {
    const rule = guessCategoryForDescription(merchantIndex, description);
    return rule
      ? {
          categoryId: rule.categoryId,
          categoryName: rule.categoryName,
          categoryType: rule.categoryType,
        }
      : null;
  }

  async function buildReview() {
    if (!mapping || !user) {
      return;
    }
    setPending(true);

    const provisional = buildImportRows(dataRows, { mapping, guessCategory });
    const dates = provisional
      .map((row) => row.occurredOn)
      .filter((date): date is string => date !== null)
      .sort();

    let existing: Awaited<ReturnType<typeof getExistingKeysForRange>> = [];
    if (dates.length > 0) {
      try {
        existing = await getExistingKeysForRange(
          user.id,
          dates[0]!,
          dates.at(-1)!,
        );
      } catch {
        // Without the check every row simply shows as ready; the user still
        // reviews them, so this is a degraded result rather than a failure.
        existing = [];
      }
    }

    setRows(buildImportRows(dataRows, { mapping, existing, guessCategory }));
    setPending(false);
    setStep("review");
  }

  const summary = useMemo(() => summarizeImportRows(rows), [rows]);
  const importable = rows.filter(
    (row) => row.status === "ready" && row.categoryId !== null,
  );

  function setRowCategory(line: number, category: Category) {
    setRows((current) =>
      current.map((row) =>
        row.line === line
          ? { ...row, categoryId: category.id, categoryName: category.name }
          : row,
      ),
    );
    setExpanded(null);
  }

  function fillUncategorised(type: "expense" | "income", category: Category) {
    setRows((current) =>
      current.map((row) =>
        row.status === "ready" && row.categoryId === null && row.type === type
          ? { ...row, categoryId: category.id, categoryName: category.name }
          : row,
      ),
    );
  }

  async function commit() {
    setPending(true);
    const result = await importTransactions(
      importable.map((row) => ({
        categoryId: row.categoryId!,
        amount: row.amount!,
        occurredOn: row.occurredOn!,
        note: row.description || undefined,
      })),
    );
    setPending(false);

    if (result.error) {
      toast(result.error, "error");
      return;
    }

    void hapticSuccess();
    notifyDataChanged();
    toast(`Imported ${result.imported} transactions`, "success");
    router.back();
  }

  return (
    <Screen title="Import">
      <ScrollView
        contentContainerClassName="gap-4 pb-16 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* ---- 1. choose a file ----------------------------------- */}
        {step === "choose" ? (
          <Card bezel innerClassName="gap-4 p-5">
            <Text className="font-bold" style={{ fontSize: 17 }}>
              Import a bank statement
            </Text>
            <Text variant="muted" className="text-sm">
              Export a CSV from your bank and pick it here. The file is read on
              your phone — nothing is uploaded, and nothing is saved until you
              have reviewed every row.
            </Text>
            <Button
              label="Choose a file"
              icon="document-outline"
              onPress={() => void pickFile()}
            />
            {problem ? (
              <Text className="text-sm text-destructive">{problem}</Text>
            ) : null}
          </Card>
        ) : null}

        {/* ---- 2. confirm the columns ------------------------------ */}
        {step === "map" && mapping ? (
          <>
            <Card bezel innerClassName="gap-3 p-5">
              <Text className="font-bold" style={{ fontSize: 17 }}>
                Check the columns
              </Text>
              <Text variant="muted" className="font-mono text-xs">
                {`${fileName} · ${dataRows.length} rows`}
              </Text>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hasHeader }}
                onPress={() => {
                  const next = !hasHeader;
                  setHasHeader(next);
                  setMapping(
                    guessColumnMapping(
                      next
                        ? (table[0] ?? [])
                        : (table[0] ?? []).map(
                            (_, index) => `Column ${index + 1}`,
                          ),
                    ),
                  );
                }}
                className="flex-row items-center gap-2 py-1"
              >
                <Ionicons
                  name={hasHeader ? "checkbox" : "square-outline"}
                  size={20}
                  color={hasHeader ? colors.primary : colors.mutedForeground}
                />
                <Text className="text-sm">The first row is column names</Text>
              </Pressable>

              <ColumnPicker
                label="Date"
                columns={table[0] ?? []}
                headers={headers}
                value={mapping.date}
                onChange={(value) =>
                  setMapping({ ...mapping, date: value ?? 0 })
                }
              />
              <ColumnPicker
                label="Description"
                columns={table[0] ?? []}
                headers={headers}
                value={mapping.description}
                onChange={(value) =>
                  setMapping({ ...mapping, description: value ?? 0 })
                }
              />
              <ColumnPicker
                label="Amount"
                columns={table[0] ?? []}
                headers={headers}
                value={mapping.amount}
                allowNone
                onChange={(value) =>
                  setMapping({
                    ...mapping,
                    amount: value,
                    debit: null,
                    credit: null,
                  })
                }
              />
              {mapping.amount === null ? (
                <>
                  <ColumnPicker
                    label="Money out (debit)"
                    columns={table[0] ?? []}
                    headers={headers}
                    value={mapping.debit}
                    allowNone
                    onChange={(value) =>
                      setMapping({ ...mapping, debit: value })
                    }
                  />
                  <ColumnPicker
                    label="Money in (credit)"
                    columns={table[0] ?? []}
                    headers={headers}
                    value={mapping.credit}
                    allowNone
                    onChange={(value) =>
                      setMapping({ ...mapping, credit: value })
                    }
                  />
                </>
              ) : null}
            </Card>

            <Card bezel innerClassName="gap-2 p-4">
              <Text variant="muted" className="text-xs">
                First rows as read
              </Text>
              {dataRows.slice(0, 3).map((row, index) => (
                <Text
                  key={index}
                  numberOfLines={1}
                  className="font-mono text-xs"
                >
                  {row.join(" · ")}
                </Text>
              ))}
            </Card>

            <View className="flex-row gap-2">
              <Button
                label="Back"
                variant="outline"
                className="flex-1"
                onPress={() => setStep("choose")}
              />
              <Button
                label={pending ? "Reading…" : "Continue"}
                className="flex-1"
                disabled={pending}
                onPress={() => void buildReview()}
              />
            </View>
          </>
        ) : null}

        {/* ---- 3. review ------------------------------------------- */}
        {step === "review" ? (
          <>
            <Card bezel innerClassName="gap-3 p-5">
              <Text className="font-bold" style={{ fontSize: 17 }}>
                {`${summary.ready} of ${summary.total} rows ready`}
              </Text>
              <Text variant="muted" className="text-sm">
                {summary.duplicate > 0
                  ? `${summary.duplicate} already in your ledger. `
                  : ""}
                {summary.invalid > 0
                  ? `${summary.invalid} could not be read. `
                  : ""}
                {summary.needsCategory > 0
                  ? `${summary.needsCategory} still need a category.`
                  : "Every row has a category."}
              </Text>

              {summary.needsCategory > 0 ? (
                <View className="gap-3 border-t border-border pt-3">
                  <BulkAssign
                    label="Set all remaining spending to"
                    categories={categories.filter((c) => c.type !== "income")}
                    onPick={(category) =>
                      fillUncategorised("expense", category)
                    }
                  />
                  <BulkAssign
                    label="Set all remaining income to"
                    categories={categories.filter((c) => c.type === "income")}
                    onPick={(category) => fillUncategorised("income", category)}
                  />
                </View>
              ) : null}

              <View className="flex-row gap-2">
                <Button
                  label="Back"
                  variant="outline"
                  className="flex-1"
                  onPress={() => setStep("map")}
                />
                <Button
                  label={pending ? "Importing…" : `Import ${importable.length}`}
                  className="flex-1"
                  disabled={pending || importable.length === 0}
                  onPress={() => void commit()}
                />
              </View>
            </Card>

            {rows.map((row) => {
              const needsCategory =
                row.status === "ready" && row.categoryId === null;

              return (
                <Card
                  key={row.line}
                  bezel
                  innerClassName={cn(
                    "gap-2 p-4",
                    row.status !== "ready" && "opacity-60",
                  )}
                >
                  <View className="flex-row items-baseline justify-between gap-3">
                    <Text
                      numberOfLines={1}
                      className="flex-1 text-sm font-medium"
                    >
                      {row.description || "—"}
                    </Text>
                    <Text
                      className={cn(
                        "font-mono text-sm",
                        row.type === "income"
                          ? "text-success"
                          : "text-foreground",
                      )}
                    >
                      {row.amount === null
                        ? "—"
                        : `${row.type === "income" ? "+" : "−"}${formatEuro(row.amount)}`}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between gap-3">
                    <Text variant="muted" className="font-mono text-xs">
                      {row.occurredOn ?? "no date"}
                    </Text>
                    <Text
                      className={cn(
                        "text-xs",
                        row.status === "invalid"
                          ? "text-destructive"
                          : row.status === "duplicate"
                            ? "text-muted-foreground"
                            : "text-success",
                      )}
                    >
                      {row.problem ?? STATUS_LABEL[row.status]}
                    </Text>
                  </View>

                  {row.status !== "invalid" ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Category for ${row.description || "row"}`}
                      onPress={() => {
                        void hapticLight();
                        setExpanded(expanded === row.line ? null : row.line);
                      }}
                      className={cn(
                        "flex-row items-center justify-between rounded-lg border px-3 py-2",
                        needsCategory
                          ? "border-destructive"
                          : "border-border bg-background",
                      )}
                    >
                      <Text className="text-sm">
                        {row.categoryName ?? "Choose a category"}
                      </Text>
                      <Ionicons
                        name={
                          expanded === row.line ? "chevron-up" : "chevron-down"
                        }
                        size={14}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  ) : null}

                  {expanded === row.line ? (
                    <View className="gap-1.5">
                      {categoryGroups
                        .filter((group) =>
                          row.type === "income"
                            ? group.type === "income"
                            : group.type !== "income",
                        )
                        .map((group) => (
                          <View key={group.type} className="gap-1.5">
                            <Text variant="muted" className="text-xs">
                              {group.label}
                            </Text>
                            {group.categories.map((cat) => (
                              <Pressable
                                key={cat.id}
                                accessibilityRole="button"
                                accessibilityLabel={cat.name}
                                onPress={() => setRowCategory(row.line, cat)}
                                className="flex-row items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                              >
                                <CategoryIcon icon={cat.icon} />
                                <Text className="text-sm">{cat.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ))}
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Which column in the file holds one field. */
function ColumnPicker({
  label,
  columns,
  headers,
  value,
  allowNone,
  onChange,
}: {
  label: string;
  columns: string[];
  headers: string[];
  value: number | null;
  allowNone?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-0.5"
      >
        {allowNone ? (
          <Chip
            label="Not in this file"
            selected={value === null}
            onPress={() => onChange(null)}
          />
        ) : null}
        {columns.map((_, index) => (
          <Chip
            key={index}
            label={headers[index] ?? `Column ${index + 1}`}
            selected={value === index}
            onPress={() => onChange(index)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        "rounded-full border px-3 py-2",
        selected
          ? "border-primary bg-primary/15"
          : "border-border bg-background",
      )}
    >
      <Text className={cn("text-xs", selected && "text-primary-ink")}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Fills every uncategorised row of one direction in a single tap. */
function BulkAssign({
  label,
  categories,
  onPick,
}: {
  label: string;
  categories: Category[];
  onPick: (category: Category) => void;
}) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-0.5"
      >
        {categories.map((cat) => (
          <Chip
            key={cat.id}
            label={cat.name}
            selected={false}
            onPress={() => onPick(cat)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
