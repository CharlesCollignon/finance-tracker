"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, UploadSimple, Warning } from "@phosphor-icons/react";
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
import {
  guessCategoryForDescription,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import { groupCategoriesByType } from "@finance/core/categories";
import type { Category } from "@finance/core/types/database";
import { Button } from "@/components/retroui/Button";
import { Card } from "@/components/retroui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/components/layout/ToastProvider";
import {
  getExistingKeysForRange,
  importTransactions,
} from "@/lib/actions/finance";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/** A statement bigger than this is almost certainly the wrong file. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Step = "choose" | "map" | "review";

interface ImportViewProps {
  categories: Category[];
  merchants: MerchantRule[];
}

const STATUS_STYLE: Record<ImportRow["status"], string> = {
  ready: "text-success",
  duplicate: "text-muted-foreground",
  invalid: "text-destructive",
};

const STATUS_LABEL: Record<ImportRow["status"], string> = {
  ready: "Ready",
  duplicate: "Skipped",
  invalid: "Problem",
};

/**
 * Importing a bank statement.
 *
 * Pluclair has no bank connection and is not getting one, but every European
 * bank hands out a CSV — so this is the honest equivalent: the file is read in
 * the browser, the app guesses what each column means and which category each
 * line belongs to, and the user confirms before anything is written. Nothing
 * is imported that the user has not seen.
 */
export function ImportView({ categories, merchants }: ImportViewProps) {
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("choose");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [expenseSign, setExpenseSign] = useState<"negative" | "positive">(
    "negative",
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const merchantIndex = useMemo(
    () => new Map(merchants.map((rule) => [rule.key, rule])),
    [merchants],
  );

  const categoryGroups = useMemo(
    () => groupCategoriesByType(categories),
    [categories],
  );

  const headers = hasHeader ? (table[0] ?? []) : [];
  const dataRows = useMemo(
    () => (hasHeader ? table.slice(1) : table),
    [table, hasHeader],
  );

  async function handleFile(file: File) {
    setParseError(null);

    if (file.size > MAX_FILE_BYTES) {
      setParseError("That file is larger than 5 MB — is it the right export?");
      return;
    }

    const text = await file.text();
    const parsed = parseCsv(text, detectDelimiter(text));

    if (parsed.length === 0) {
      setParseError("That file has no rows in it.");
      return;
    }

    const header = looksLikeHeaderRow(parsed[0]!);

    setFileName(file.name);
    setTable(parsed);
    setHasHeader(header);
    setMapping(
      guessColumnMapping(
        header ? parsed[0]! : parsed[0]!.map((_, index) => `Column ${index + 1}`),
      ),
    );
    setStep("map");
  }

  /** Parses with the current mapping and checks the ledger for duplicates. */
  function buildReview() {
    if (!mapping) {
      return;
    }

    startTransition(async () => {
      const provisional = buildImportRows(dataRows, {
        mapping,
        expenseSign,
        guessCategory: (description) => {
          const rule = guessCategoryForDescription(merchantIndex, description);
          return rule
            ? {
                categoryId: rule.categoryId,
                categoryName: rule.categoryName,
                categoryType: rule.categoryType,
              }
            : null;
        },
      });

      const dates = provisional
        .map((row) => row.occurredOn)
        .filter((date): date is string => date !== null)
        .sort();

      if (dates.length === 0) {
        setRows(provisional);
        setStep("review");
        return;
      }

      const existing = await getExistingKeysForRange(dates[0]!, dates.at(-1)!);

      if (existing.error) {
        toast(existing.error, "error");
        return;
      }

      setRows(
        buildImportRows(dataRows, {
          mapping,
          expenseSign,
          existing: existing.keys ?? [],
          guessCategory: (description) => {
            const rule = guessCategoryForDescription(merchantIndex, description);
            return rule
              ? {
                  categoryId: rule.categoryId,
                  categoryName: rule.categoryName,
                  categoryType: rule.categoryType,
                }
              : null;
          },
        }),
      );
      setStep("review");
    });
  }

  const summary = useMemo(() => summarizeImportRows(rows), [rows]);
  const importable = rows.filter(
    (row) => row.status === "ready" && row.categoryId !== null,
  );

  function setRowCategory(line: number, categoryId: string) {
    setRows((current) =>
      current.map((row) =>
        row.line === line
          ? {
              ...row,
              categoryId: categoryId || null,
              categoryName:
                categories.find((cat) => cat.id === categoryId)?.name ?? null,
            }
          : row,
      ),
    );
  }

  /** Fills every uncategorised ready row of one direction in a single go. */
  function fillUncategorised(type: "expense" | "income", categoryId: string) {
    if (!categoryId) {
      return;
    }
    const name = categories.find((cat) => cat.id === categoryId)?.name ?? null;
    setRows((current) =>
      current.map((row) =>
        row.status === "ready" && row.categoryId === null && row.type === type
          ? { ...row, categoryId, categoryName: name }
          : row,
      ),
    );
  }

  function commit() {
    startTransition(async () => {
      const result = await importTransactions(
        importable.map((row) => ({
          categoryId: row.categoryId!,
          amount: row.amount!,
          occurredOn: row.occurredOn!,
          note: row.description || undefined,
        })),
      );

      if (result.error) {
        toast(result.error, "error");
        return;
      }

      toast(`Imported ${result.imported} transactions`, "success");
      setStep("choose");
      setRows([]);
      setTable([]);
      setFileName("");
    });
  }

  return (
    <>
      <PageHeader title="Import">
        <Button
          variant="link"
          size="sm"
          render={
            <Link href="/transactions">
              <ArrowLeft size={16} className="mr-1 inline" />
              Transactions
            </Link>
          }
        />
      </PageHeader>

      <PageContainer className="flex flex-col gap-4">
        {/* ---- 1. choose a file ------------------------------------- */}
        {step === "choose" ? (
          <Card.Bezel className="w-full" innerClassName="p-6">
            <h2 className="font-head text-lg">Import a bank statement</h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Export a CSV from your bank and drop it here. The file is read in
              your browser — nothing is uploaded, and nothing is saved until you
              have reviewed every row.
            </p>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) {
                  void handleFile(file);
                }
              }}
              className={cn(
                "mt-5 flex flex-col items-center justify-center gap-3",
                "rounded-lg border border-dashed border-border p-10 text-center",
              )}
            >
              <UploadSimple size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop a .csv file here
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                Choose a file
              </Button>
            </div>

            {parseError ? (
              <p className="mt-4 text-sm text-destructive">{parseError}</p>
            ) : null}
          </Card.Bezel>
        ) : null}

        {/* ---- 2. map the columns ------------------------------------ */}
        {step === "map" && mapping ? (
          <Card.Bezel className="w-full" innerClassName="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-head text-lg">Check the columns</h2>
              <p className="font-mono text-xs text-muted-foreground">
                {fileName} · {dataRows.length} rows
              </p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              These are the app&apos;s guesses. Change any that are wrong.
            </p>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(event) => {
                  setHasHeader(event.target.checked);
                  setMapping(
                    guessColumnMapping(
                      event.target.checked
                        ? (table[0] ?? [])
                        : (table[0] ?? []).map(
                            (_, index) => `Column ${index + 1}`,
                          ),
                    ),
                  );
                }}
                className="size-4 accent-[var(--primary)]"
              />
              The first row is column names
            </label>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                  setMapping({ ...mapping, amount: value, debit: null, credit: null })
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
                    onChange={(value) => setMapping({ ...mapping, debit: value })}
                  />
                  <ColumnPicker
                    label="Money in (credit)"
                    columns={table[0] ?? []}
                    headers={headers}
                    value={mapping.credit}
                    allowNone
                    onChange={(value) => setMapping({ ...mapping, credit: value })}
                  />
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    In this file, spending is
                  </span>
                  <select
                    value={expenseSign}
                    onChange={(event) =>
                      setExpenseSign(
                        event.target.value as "negative" | "positive",
                      )
                    }
                    className="h-11 rounded border border-border bg-background px-3 text-base"
                  >
                    <option value="negative">Negative (−12.50)</option>
                    <option value="positive">Positive (12.50)</option>
                  </select>
                </div>
              )}
            </div>

            <PreviewTable rows={dataRows.slice(0, 3)} headers={headers} />

            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={() => setStep("choose")}>
                Back
              </Button>
              <Button onClick={buildReview} disabled={pending}>
                {pending ? "Reading…" : "Continue"}
              </Button>
            </div>
          </Card.Bezel>
        ) : null}

        {/* ---- 3. review --------------------------------------------- */}
        {step === "review" ? (
          <>
            <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-head text-lg">
                    {summary.ready} of {summary.total} rows ready
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {summary.duplicate > 0
                      ? `${summary.duplicate} already in your ledger. `
                      : ""}
                    {summary.invalid > 0
                      ? `${summary.invalid} could not be read. `
                      : ""}
                    {summary.needsCategory > 0
                      ? `${summary.needsCategory} still need a category.`
                      : "Every row has a category."}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("map")}>
                    Back
                  </Button>
                  <Button
                    onClick={commit}
                    disabled={pending || importable.length === 0}
                  >
                    {pending
                      ? "Importing…"
                      : `Import ${importable.length}`}
                  </Button>
                </div>
              </div>

              {summary.needsCategory > 0 ? (
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row">
                  <BulkAssign
                    label="Set all remaining spending to"
                    groups={categoryGroups.filter((g) => g.type === "expense")}
                    onPick={(id) => fillUncategorised("expense", id)}
                  />
                  <BulkAssign
                    label="Set all remaining income to"
                    groups={categoryGroups.filter((g) => g.type === "income")}
                    onPick={(id) => fillUncategorised("income", id)}
                  />
                </div>
              ) : null}
            </Card.Bezel>

            <Card.Bezel className="w-full" innerClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium">Description</th>
                      <th className="p-3 text-right font-medium">Amount</th>
                      <th className="p-3 font-medium">Category</th>
                      <th className="p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.line}
                        className={cn(
                          "border-b border-border/60",
                          row.status !== "ready" && "opacity-60",
                        )}
                      >
                        <td className="whitespace-nowrap p-3 font-mono text-xs">
                          {row.occurredOn ?? "—"}
                        </td>
                        <td className="max-w-[18rem] truncate p-3">
                          {row.description || "—"}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap p-3 text-right font-mono tabular-nums",
                            row.type === "income"
                              ? "text-success"
                              : "text-foreground",
                          )}
                        >
                          {row.amount === null
                            ? "—"
                            : `${row.type === "income" ? "+" : "−"}${formatEuro(row.amount)}`}
                        </td>
                        <td className="p-3">
                          {row.status === "invalid" ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <select
                              aria-label={`Category for line ${row.line}`}
                              value={row.categoryId ?? ""}
                              onChange={(event) =>
                                setRowCategory(row.line, event.target.value)
                              }
                              className={cn(
                                "h-9 w-full min-w-[10rem] rounded border bg-background px-2 text-sm",
                                row.categoryId === null && row.status === "ready"
                                  ? "border-destructive"
                                  : "border-border",
                              )}
                            >
                              <option value="">Choose…</option>
                              {categoryGroups
                                .filter((group) =>
                                  row.type === "income"
                                    ? group.type === "income"
                                    : group.type !== "income",
                                )
                                .map((group) => (
                                  <optgroup
                                    key={group.type}
                                    label={group.label}
                                  >
                                    {group.categories.map((cat) => (
                                      <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                            </select>
                          )}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap p-3 text-xs",
                            STATUS_STYLE[row.status],
                          )}
                        >
                          {row.problem ?? STATUS_LABEL[row.status]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card.Bezel>
          </>
        ) : null}
      </PageContainer>
    </>
  );
}

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
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <select
        aria-label={label}
        value={value === null ? "" : String(value)}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
        className="h-11 rounded border border-border bg-background px-3 text-base"
      >
        {allowNone ? <option value="">Not in this file</option> : null}
        {columns.map((_, index) => (
          <option key={index} value={index}>
            {headers[index] ?? `Column ${index + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function BulkAssign({
  label,
  groups,
  onPick,
}: {
  label: string;
  groups: ReturnType<typeof groupCategoriesByType>;
  onPick: (categoryId: string) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <select
        defaultValue=""
        onChange={(event) => {
          onPick(event.target.value);
          event.target.value = "";
        }}
        className="h-10 rounded border border-border bg-background px-2 text-sm"
      >
        <option value="">Choose a category…</option>
        {groups.map((group) =>
          group.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          )),
        )}
      </select>
    </label>
  );
}

/** The first few rows as the file actually reads, to sanity-check the mapping. */
function PreviewTable({
  rows,
  headers,
}: {
  rows: string[][];
  headers: string[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 overflow-x-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            {(headers.length > 0 ? headers : rows[0]!).map((_, index) => (
              <th key={index} className="whitespace-nowrap p-2 font-medium">
                {headers[index] ?? `Column ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/60 last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="max-w-[12rem] truncate whitespace-nowrap p-2 font-mono"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shown when a file parses but yields nothing usable. */
export function ImportEmptyHint() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Warning size={16} />
      No rows could be read from that file.
    </p>
  );
}
