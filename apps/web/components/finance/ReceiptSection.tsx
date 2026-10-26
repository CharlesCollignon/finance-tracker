"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip } from "@phosphor-icons/react";
import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import type { ReceiptReading } from "@finance/core/receipts";
import type { Transaction } from "@finance/core/types/database";
import { useToast } from "@/components/layout/ToastProvider";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { Button } from "@/components/ui/Button";
import {
  applyReceiptReading,
  attachReceipt,
  readReceiptAction,
  receiptUrl,
  removeReceipt,
} from "@/lib/actions/receipts";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";

/**
 * « Justificatif » (migration 079): the picture or the PDF behind a row —
 * attached from here, opened, removed, and read on the person's own AI
 * account when they ask, the three things read then applied or not. The
 * phone draws the same row.
 */
export function ReceiptSection({
  transaction,
  onApplied,
}: {
  transaction: Transaction;
  /** The row changed from the reading: the sheet closes. */
  onApplied: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [reading, setReading] = useState<ReceiptReading | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const has = Boolean(transaction.receipt_path);

  function attach(file: File) {
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await attachReceipt(transaction.id, formData);
      toast(
        resolveMessage(t, result.error ?? result.message ?? "transaction.receiptAttached"),
        result.error ? "error" : "success",
      );
    });
  }

  function open() {
    startTransition(async () => {
      const result = await receiptUrl(transaction.id);
      if (!result.success) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      window.open(result.url, "_blank", "noopener");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeReceipt(transaction.id);
      toast(
        resolveMessage(t, result.error ?? result.message ?? "transaction.receiptRemoved"),
        result.error ? "error" : "success",
      );
      setReading(null);
    });
  }

  function read() {
    startTransition(async () => {
      const result = await readReceiptAction(transaction.id);
      if (!result.success) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      setReading(result.reading);
    });
  }

  function apply(current: ReceiptReading) {
    startTransition(async () => {
      const result = await applyReceiptReading(transaction.id, current);
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(t("transaction.receiptApplied"), "success");
      onApplied();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Paperclip size={ICON.sm} aria-hidden />
        {t("transaction.receipt")}
      </p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        aria-label={t("transaction.receiptAttach")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            attach(file);
          }
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        {has ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={open}>
              {t("transaction.receiptView")}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={read}>
              {pending ? t("transaction.receiptReading") : t("transaction.receiptRead")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => input.current?.click()}
            >
              {t("transaction.receiptAttach")}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}>
              {t("transaction.receiptRemove")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            {pending ? t("transaction.receiptAttaching") : t("transaction.receiptAttach")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {has ? t("transaction.receiptReadHint") : t("transaction.receiptKind")}
      </p>
      {reading ? (
        <div className="flex flex-col gap-2 rounded-control border border-border p-3">
          <PrivateAmount className="text-sm">
            {t("transaction.receiptReadResult", {
              merchant: reading.merchant ?? "—",
              date: reading.date ? formatShortDate(reading.date, locale) : "—",
              amount: reading.total !== null ? format(reading.total) : "—",
            })}
          </PrivateAmount>
          <Button
            type="button"
            size="sm"
            className="self-start"
            disabled={pending}
            onClick={() => apply(reading)}
          >
            {t("transaction.receiptApply")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
