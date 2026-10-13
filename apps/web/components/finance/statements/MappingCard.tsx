"use client";

import { useId, useState } from "react";
import type { TableMapping } from "@finance/core/statement";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useT } from "@/lib/locale-context";

/**
 * The rare file whose columns could not be told apart: its first rows, and
 * three questions — which column is the date, the words, the amount (or the
 * debit and the credit) — asked once, then read as any other file.
 */
export function MappingCard({
  table,
  onRead,
}: {
  table: string[][];
  onRead: (mapping: TableMapping) => void;
}) {
  const t = useT();
  const headerId = useId();
  const width = Math.max(0, ...table.slice(0, 20).map((row) => row.length));
  const [mapping, setMapping] = useState<TableMapping>({
    header: true,
    date: 0,
    label: Math.min(1, width - 1),
    amount: Math.min(2, width - 1),
    debit: null,
    credit: null,
  });
  const split = mapping.amount === null;
  const columns = Array.from({ length: width }, (_, index) => ({
    value: index,
    label: mapping.header
      ? table[0]?.[index]?.trim() || t("statements.mapColumn", { n: index + 1 })
      : t("statements.mapColumn", { n: index + 1 }),
  }));

  const select = (
    label: string,
    value: number | null,
    onChange: (index: number) => void,
  ) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select
        value={value ?? 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 rounded-control border border-border bg-background px-3 text-sm"
      >
        {columns.map((column) => (
          <option key={column.value} value={column.value}>
            {column.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Card.Bezel className="w-full" innerClassName="flex flex-col gap-5 p-6">
      <p className="text-sm font-medium">{t("statements.columns")}</p>
      <div className="overflow-x-auto rounded-control border border-border">
        <table className="w-full text-left text-xs">
          <tbody>
            {table.slice(0, 4).map((row, index) => (
              <tr
                key={index}
                className={
                  index === 0 && mapping.header
                    ? "bg-muted font-medium"
                    : "border-t border-border"
                }
              >
                {Array.from({ length: width }, (_, column) => (
                  <td key={column} className="max-w-48 truncate px-3 py-2">
                    {row[column] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label id={headerId} className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={mapping.header}
          onChange={(event) =>
            setMapping({ ...mapping, header: event.target.checked })
          }
          className="size-4"
        />
        {t("statements.mapHeader")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {select(t("statements.mapDate"), mapping.date, (date) =>
          setMapping({ ...mapping, date }),
        )}
        {select(t("statements.mapLabel"), mapping.label, (label) =>
          setMapping({ ...mapping, label }),
        )}
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={split}
          onChange={(event) =>
            setMapping(
              event.target.checked
                ? {
                    ...mapping,
                    amount: null,
                    debit: mapping.amount ?? 0,
                    credit: Math.min((mapping.amount ?? 0) + 1, width - 1),
                  }
                : {
                    ...mapping,
                    amount: mapping.debit ?? 0,
                    debit: null,
                    credit: null,
                  },
            )
          }
          className="size-4"
        />
        {t("statements.mapSplit")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {split ? (
          <>
            {select(t("statements.mapDebit"), mapping.debit, (debit) =>
              setMapping({ ...mapping, debit }),
            )}
            {select(t("statements.mapCredit"), mapping.credit, (credit) =>
              setMapping({ ...mapping, credit }),
            )}
          </>
        ) : (
          select(t("statements.mapAmount"), mapping.amount, (amount) =>
            setMapping({ ...mapping, amount }),
          )
        )}
      </div>
      <Button className="self-end" onClick={() => onRead(mapping)}>
        {t("statements.mapApply")}
      </Button>
    </Card.Bezel>
  );
}
