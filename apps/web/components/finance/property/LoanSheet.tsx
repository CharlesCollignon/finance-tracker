"use client";

import { useState, useTransition } from "react";
import { errorsByField } from "@finance/core/property-form";
import { resolveMessage } from "@finance/core/i18n/t";
import type { PropertyLoan } from "@finance/core/types/database";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { saveLoanForProperty } from "@/lib/actions/property";
import { useT } from "@/lib/locale-context";
import { LoanFields, useLoanDraft } from "./property-fields";

/**
 * A loan added to a property that already exists — a PTZ, an Action Logement
 * loan, one left out when the property was added — or one whose terms need
 * changing. A new one offers its payment to the recurring entries; a changed
 * one keeps the template it has, which the property's page then says is out
 * of step if the payment moved.
 */
export function LoanSheet({
  propertyId,
  propertyName,
  loan,
  open,
  onOpenChange,
}: {
  propertyId: string;
  propertyName: string;
  /** The loan being changed, or null for a new one. */
  loan: PropertyLoan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  if (!open) {
    return null;
  }
  return (
    <MobileSheet
      open
      onOpenChange={onOpenChange}
      title={loan ? t("property.editLoan") : t("property.addLoan")}
    >
      <LoanForm
        propertyId={propertyId}
        propertyName={propertyName}
        loan={loan}
        onDone={() => onOpenChange(false)}
      />
    </MobileSheet>
  );
}

function LoanForm({
  propertyId,
  propertyName,
  loan,
  onDone,
}: {
  propertyId: string;
  propertyName: string;
  loan: PropertyLoan | null;
  onDone: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const draft = useLoanDraft(loan);
  const error = (field: string) =>
    errors[field] ? resolveMessage(t, errors[field]) : undefined;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.parsed.success) {
          setErrors(errorsByField(draft.parsed.error.issues));
          return;
        }
        setErrors({});
        startTransition(async () => {
          const result = await saveLoanForProperty(
            draft.payload(propertyId),
            !loan && draft.addPayment,
            `${draft.label.trim()} · ${propertyName}`,
          );
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          toast(result.message ?? t("property.saved"), "success");
          onDone();
        });
      }}
    >
      <LoanFields draft={draft} error={error} offerPayment={!loan} />
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" disabled={pending}>
          {t("property.saveValue")}
        </Button>
      </div>
    </form>
  );
}
