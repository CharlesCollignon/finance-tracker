"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/** The small pieces a property's page is built of, on the web. */

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

/** A button that opens into one amount and a save. */
export function AmountEditor({
  label,
  hint,
  initial,
  save,
}: {
  label: string;
  hint: string;
  initial: string;
  save: (value: number) => Promise<{ error?: string; message?: string }>;
}) {
  const t = useT();
  const id = useId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const typed = parseTypedAmount(value);
  const valid = typed !== null && typed > 0;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          setValue(initial);
          setOpen(true);
        }}
      >
        <PencilSimple size={ICON.sm} aria-hidden className="mr-1.5" />
        {label}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          return;
        }
        startTransition(async () => {
          const result = await save(typed);
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          toast(result.message ?? t("property.saved"), "success");
          setOpen(false);
        });
      }}
    >
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-48">
          <Input
            id={id}
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={valid || value === "" ? undefined : true}
            className="privacy-sensitive pr-8 text-base tabular-nums"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            €
          </span>
        </div>
        <Button type="submit" size="sm" disabled={!valid || pending}>
          {t("property.saveValue")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          {t("common.cancel")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </form>
  );
}
