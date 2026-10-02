"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aMonthAfter,
  errorsByField,
  HOME_FIELDS,
  PURCHASE_FIELDS,
} from "@finance/core/property-form";
import { resolveMessage, type Key } from "@finance/core/i18n/t";
import { propertySchema } from "@finance/core/validations/property";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { addProperty } from "@/lib/actions/property";
import { useT } from "@/lib/locale-context";
import {
  Chips,
  HomeFields,
  LoanFields,
  PurchaseFields,
  useLoanDraft,
  usePropertyDraft,
} from "./property-fields";

type Step = 1 | 2 | 3;

const STEP_KEYS: Record<Step, Key> = {
  1: "property.stepHome",
  2: "property.stepPurchase",
  3: "property.stepLoan",
};

const STEP_FIELDS: Record<1 | 2, readonly string[]> = {
  1: HOME_FIELDS,
  2: PURCHASE_FIELDS,
};

/**
 * Adding a property in three steps — the home, the purchase, the loan — the
 * last one optional. The loan's payment is shown as it is typed, and goes
 * into the recurring entries unless the user says not to: they already told
 * the app everything it needs to write it.
 */
export function AddPropertySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  if (!open) {
    return null;
  }
  return (
    <MobileSheet open onOpenChange={onOpenChange} title={t("property.add")}>
      <AddPropertyForm onDone={() => onOpenChange(false)} />
    </MobileSheet>
  );
}

function AddPropertyForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const t = useT();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const property = usePropertyDraft(null);
  const loan = useLoanDraft(null);
  const [hasLoan, setHasLoan] = useState(true);

  /** A new step starts at the top of the sheet, under its title. */
  function moveTo(next: Step) {
    setStep(next);
    formRef.current?.closest('[role="dialog"]')?.scrollTo({ top: 0 });
  }

  function goOn() {
    if (step === 3) {
      return;
    }
    const parsed = propertySchema.safeParse(property.payload);
    const fields = STEP_FIELDS[step];
    const stepErrors = parsed.success
      ? {}
      : errorsByField(
          parsed.error.issues.filter((issue) =>
            fields.includes(String(issue.path[0])),
          ),
        );
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      return;
    }
    if (step === 2 && !loan.firstPayment && property.purchasedOn) {
      loan.setFirstPayment(aMonthAfter(property.purchasedOn));
    }
    moveTo(step === 1 ? 2 : 3);
  }

  function save() {
    if (hasLoan && !loan.parsed.success) {
      setErrors(errorsByField(loan.parsed.error.issues));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await addProperty({
        property: property.payload,
        loan: hasLoan ? loan.fields : null,
        addPayment: hasLoan && loan.addPayment,
      });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(result.message ?? t("property.add"), "success");
      onDone();
      // Its page, where the estimate arrives — still on its way, it says so.
      router.push(
        `/property/${result.propertyId}${result.reading === "later" ? "?lecture=1" : ""}`,
      );
    });
  }

  const error = (field: string) =>
    errors[field] ? resolveMessage(t, errors[field]) : undefined;

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 3) {
          save();
        } else {
          goOn();
        }
      }}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {t("property.stepLabel", { step, name: t(STEP_KEYS[step]) })}
      </p>

      {step === 1 ? <HomeFields draft={property} error={error} /> : null}
      {step === 2 ? <PurchaseFields draft={property} error={error} /> : null}
      {step === 3 ? (
        <>
          <Chips
            label={t("property.hasLoan")}
            value={hasLoan ? "yes" : "no"}
            onChange={(value) => setHasLoan(value === "yes")}
            options={[
              { value: "yes", label: t("property.withLoan") },
              { value: "no", label: t("property.noLoan") },
            ]}
          />
          {hasLoan ? (
            <LoanFields draft={loan} error={error} offerPayment />
          ) : null}
        </>
      ) : null}

      <div className="flex justify-between gap-2 border-t border-border pt-4">
        {step > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setErrors({});
              moveTo(step === 3 ? 2 : 1);
            }}
          >
            {t("property.back")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {step === 3 ? t("property.save") : t("property.next")}
        </Button>
      </div>
    </form>
  );
}
