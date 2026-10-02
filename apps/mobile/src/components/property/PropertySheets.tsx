import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatEuro } from "@finance/core/constants";
import { resolveMessage, type Key } from "@finance/core/i18n/t";
import { loanPaymentCategoryName } from "@finance/core/property";
import {
  aMonthAfter,
  errorsByField,
  HOME_FIELDS,
  PURCHASE_FIELDS,
} from "@finance/core/property-form";
import type { Property, PropertyLoan } from "@finance/core/types/database";
import { propertySchema } from "@finance/core/validations/property";

import { Button } from "@/components/ui/Button";
import { ChipRow } from "@/components/ui/ChipRow";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { Text } from "@/components/ui/Text";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import {
  addPropertyWithLoan,
  requestMarketReading,
  saveLoan,
  updateProperty,
} from "@/lib/properties";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

import {
  Field,
  HomeFields,
  LoanFields,
  PurchaseFields,
  useLoanDraft,
  usePropertyDraft,
} from "./fields";

/**
 * Adding a property, changing one, and adding or changing a loan: the web's
 * three sheets, on the phone's sheet. The writes are `@finance/data`'s, so a
 * loan's payment lands among the recurring entries the same way here.
 */

function SheetFrame({
  open,
  title,
  onClose,
  onBack,
  scrollKey,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  /** A step back, drawn as a chevron before the title. */
  onBack?: () => void;
  /** Changing it starts the content again at the top: a new step. */
  scrollKey?: string;
  children: ReactNode;
}) {
  const t = useT();
  const colors = useThemeColors();
  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable
          className="flex-1"
          accessibilityLabel={t("position.close")}
          onPress={onClose}
        />
        <View className="max-h-[92%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("property.back")}
                  onPress={onBack}
                  className="-ml-2 h-11 w-11 items-center justify-center"
                >
                  <Ionicons name="chevron-back" size={ICON.lg} color={colors.foreground} />
                </Pressable>
              ) : null}
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                className="min-w-0 flex-1 font-semibold"
                style={{ fontSize: 18 }}
              >
                {title}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("position.close")}
              className="h-11 justify-center pl-3"
            >
              <Text variant="muted">{t("position.close")}</Text>
            </Pressable>
          </View>
          <ScrollView
            key={scrollKey}
            className="px-5"
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-5 pb-8">{children}</View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

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

/** Adding a property: the home, the purchase, the loan if there was one. */
export function AddPropertySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Mounted only while open, so every opening starts from empty fields.
  return open ? <AddPropertyFlow onClose={onClose} /> : null;
}

function AddPropertyFlow({ onClose }: { onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const property = usePropertyDraft(null);
  const loan = useLoanDraft(null);
  const [hasLoan, setHasLoan] = useState(true);
  const error = (field: string) => errors[field];

  function goOn() {
    if (step === 3) {
      return;
    }
    const parsed = propertySchema.safeParse(property.payload);
    const fields = STEP_FIELDS[step];
    const stepErrors = parsed.success
      ? {}
      : errorsByField(
          parsed.error.issues.filter((issue) => fields.includes(String(issue.path[0]))),
        );
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      void hapticWarning();
      return;
    }
    if (step === 2 && !loan.firstPayment && property.purchasedOn) {
      loan.setFirstPayment(aMonthAfter(property.purchasedOn));
    }
    setStep(step === 1 ? 2 : 3);
  }

  async function save() {
    if (hasLoan && !loan.parsed.success) {
      setErrors(errorsByField(loan.parsed.error.issues));
      void hapticWarning();
      return;
    }
    setErrors({});
    setPending(true);
    const result = await addPropertyWithLoan({
      property: property.payload,
      loan: hasLoan ? loan.fields : null,
      payment:
        hasLoan && loan.addPayment
          ? { categoryName: loanPaymentCategoryName(locale) }
          : null,
    });
    setPending(false);
    if (!result.success) {
      setErrors({ form: result.error });
      void hapticWarning();
      return;
    }
    void hapticSuccess();
    void requestMarketReading(result.propertyId);
    const name = property.name.trim();
    toast(
      result.paymentAmount === null
        ? t("property.added", { name })
        : t("property.addedWithPayment", {
            name,
            amount: formatEuro(result.paymentAmount, locale),
          }),
    );
    onClose();
  }

  return (
    <SheetFrame
      open
      title={t("property.add")}
      onClose={onClose}
      onBack={
        step > 1
          ? () => {
              setErrors({});
              setStep(step === 3 ? 2 : 1);
            }
          : undefined
      }
      scrollKey={String(step)}
    >
      <Text variant="muted" className="text-xs">
        {t("property.stepLabel", { step, name: t(STEP_KEYS[step]) })}
      </Text>
      {step === 1 ? <HomeFields draft={property} error={error} /> : null}
      {step === 2 ? <PurchaseFields draft={property} error={error} /> : null}
      {step === 3 ? (
        <>
          <Field label={t("property.hasLoan")}>
            <ChipRow
              label={t("property.hasLoan")}
              value={hasLoan ? "yes" : "no"}
              onChange={(value) => setHasLoan(value === "yes")}
              options={[
                { value: "yes", label: t("property.withLoan") },
                { value: "no", label: t("property.noLoan") },
              ]}
            />
          </Field>
          {hasLoan ? <LoanFields draft={loan} error={error} offerPayment /> : null}
        </>
      ) : null}
      <FormError error={errors.form} />
      <Button
        label={
          pending
            ? t("common.working")
            : step === 3
              ? t("property.save")
              : t("property.next")
        }
        size="lg"
        disabled={pending}
        onPress={() => (step === 3 ? void save() : goOn())}
      />
    </SheetFrame>
  );
}

/** Changing what was said about a property, on one page. */
export function EditPropertySheet({
  property,
  open,
  onClose,
}: {
  property: Property;
  open: boolean;
  onClose: () => void;
}) {
  return open ? <EditPropertyForm property={property} onClose={onClose} /> : null;
}

function EditPropertyForm({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const draft = usePropertyDraft(property);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function save() {
    const parsed = propertySchema.safeParse(draft.payload);
    if (!parsed.success) {
      setErrors(errorsByField(parsed.error.issues));
      void hapticWarning();
      return;
    }
    setErrors({});
    setPending(true);
    const result = await updateProperty(draft.payload);
    setPending(false);
    if (!result.success) {
      setErrors({ form: result.error });
      void hapticWarning();
      return;
    }
    void hapticSuccess();
    // A new place, kind or area is a new reading.
    void requestMarketReading(result.propertyId);
    toast(t("property.saved"));
    onClose();
  }

  return (
    <SheetFrame open title={t("property.editProperty")} onClose={onClose}>
      <HomeFields draft={draft} error={(field) => errors[field]} />
      <PurchaseFields draft={draft} error={(field) => errors[field]} />
      <FormError error={errors.form} />
      <Button
        label={pending ? t("common.working") : t("property.saveValue")}
        size="lg"
        disabled={pending}
        onPress={() => void save()}
      />
    </SheetFrame>
  );
}

/**
 * A loan added to a property that exists, or one whose terms change. A new
 * one offers its payment to the recurring entries; a changed one keeps its
 * template, which the property's screen then says is out of step.
 */
export function LoanSheet({
  propertyId,
  propertyName,
  loan,
  open,
  onClose,
}: {
  propertyId: string;
  propertyName: string;
  loan: PropertyLoan | null;
  open: boolean;
  onClose: () => void;
}) {
  return open ? (
    <LoanForm
      propertyId={propertyId}
      propertyName={propertyName}
      loan={loan}
      onClose={onClose}
    />
  ) : null;
}

function LoanForm({
  propertyId,
  propertyName,
  loan,
  onClose,
}: {
  propertyId: string;
  propertyName: string;
  loan: PropertyLoan | null;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const draft = useLoanDraft(loan);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function save() {
    if (!draft.parsed.success) {
      setErrors(errorsByField(draft.parsed.error.issues));
      void hapticWarning();
      return;
    }
    setErrors({});
    setPending(true);
    const addPayment = !loan && draft.addPayment;
    const result = await saveLoan(
      draft.payload(propertyId),
      addPayment
        ? {
            categoryName: loanPaymentCategoryName(locale),
            description: `${draft.label.trim()} · ${propertyName}`,
          }
        : null,
    );
    setPending(false);
    if (!result.success) {
      setErrors({ form: result.error });
      void hapticWarning();
      return;
    }
    void hapticSuccess();
    toast(
      loan
        ? t("property.loanSaved")
        : result.templateId && addPayment
          ? t("property.loanAddedWithPayment")
          : t("property.loanAdded"),
    );
    onClose();
  }

  return (
    <SheetFrame
      open
      title={loan ? t("property.editLoan") : t("property.addLoan")}
      onClose={onClose}
    >
      <LoanFields draft={draft} error={(field) => errors[field]} offerPayment={!loan} />
      <FormError error={errors.form} />
      <Button
        label={pending ? t("common.working") : t("property.saveValue")}
        size="lg"
        disabled={pending}
        onPress={() => void save()}
      />
    </SheetFrame>
  );
}

function FormError({ error }: { error?: string }) {
  const t = useT();
  return error ? (
    <Text accessibilityRole="alert" className="text-sm text-destructive">
      {resolveMessage(t, error)}
    </Text>
  ) : null;
}
