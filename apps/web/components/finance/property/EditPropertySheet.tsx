"use client";

import { useState, useTransition } from "react";
import { errorsByField } from "@finance/core/property-form";
import { resolveMessage } from "@finance/core/i18n/t";
import type { Property } from "@finance/core/types/database";
import { propertySchema } from "@finance/core/validations/property";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { updateProperty } from "@/lib/actions/property";
import { useT } from "@/lib/locale-context";
import {
  HomeFields,
  PurchaseFields,
  usePropertyDraft,
} from "./property-fields";

/**
 * Changing what was said about a property — its place, its area, its share,
 * what it cost — on one page rather than in the adding's three steps, since
 * the user comes to change one thing.
 */
export function EditPropertySheet({
  property,
  open,
  onOpenChange,
  onReading,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The market is still being read, after the response: wait for it. */
  onReading?: () => void;
}) {
  const t = useT();
  if (!open) {
    return null;
  }
  return (
    <MobileSheet
      open
      onOpenChange={onOpenChange}
      title={t("property.editProperty")}
    >
      <EditPropertyForm
        property={property}
        onDone={(reading) => {
          onOpenChange(false);
          if (reading === "later") {
            onReading?.();
          }
        }}
      />
    </MobileSheet>
  );
}

function EditPropertyForm({
  property,
  onDone,
}: {
  property: Property;
  onDone: (reading: string | undefined) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const draft = usePropertyDraft(property);
  const error = (field: string) =>
    errors[field] ? resolveMessage(t, errors[field]) : undefined;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = propertySchema.safeParse(draft.payload);
        if (!parsed.success) {
          setErrors(errorsByField(parsed.error.issues));
          return;
        }
        setErrors({});
        startTransition(async () => {
          const result = await updateProperty(draft.payload);
          if (result.error) {
            toast(result.error, "error");
            return;
          }
          toast(result.message ?? t("property.saved"), "success");
          onDone(result.reading);
        });
      }}
    >
      <HomeFields draft={draft} error={error} />
      <PurchaseFields draft={draft} error={error} />
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" disabled={pending}>
          {t("property.saveValue")}
        </Button>
      </div>
    </form>
  );
}
