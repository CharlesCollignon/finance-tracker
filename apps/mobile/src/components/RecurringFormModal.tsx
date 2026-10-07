import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { parseTypedAmount } from "@finance/core/amount-input";
import {
  formatOccurrenceDates,
  scheduleDatesBefore,
} from "@finance/core/apply-recurring";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { dayOfWeekLabels, monthLabels } from "@finance/core/recurrence";
import type {
  Category,
  CategoryType,
  Recurrence,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";

import { CategoryPicker } from "@/components/pickers/CategoryPicker";
import { ChoiceChips } from "@/components/pickers/ChoiceChips";
import { OptionPicker } from "@/components/pickers/OptionPicker";
import { Button } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { SheetGrabber } from "@/components/ui/SheetGrabber";
import { hapticSuccess, hapticWarning } from "@/lib/haptics";
import { useToast } from "@/providers/ToastProvider";
import {
  deleteRecurringTemplate,
  upsertRecurringTemplate,
} from "@/lib/mutations";
import { cn } from "@/lib/cn";
import { toTypedAmount } from "@/lib/typed-amount";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { resolveMessage } from "@finance/core/i18n/t";

interface RecurringFormModalProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
  /** The days this charge has been recorded on this month, today included. */
  recordedThisMonth?: string[];
  /** The user's properties, which a charge can belong to. */
  properties?: { id: string; name: string }[];
}

/**
 * Editing a charge, in a sheet of its own.
 *
 * Adding one happens in the shared Add sheet, which draws the same fields
 * through `RecurringFormBody` — so the two can never ask for different things.
 */
export function RecurringFormModal({
  open,
  onClose,
  categories,
  template = null,
  recordedThisMonth = [],
  properties = [],
}: RecurringFormModalProps) {
  const t = useT();

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
          accessibilityLabel={t("recurring.close")}
          onPress={onClose}
        />
        <View className="max-h-[90%] rounded-t-card border border-border bg-card">
          <View className="items-center pt-3">
            <SheetGrabber />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text className="font-semibold" style={{ fontSize: 18 }}>
              {template
                ? t("recurring.editTitleMobile")
                : t("recurring.addTitleMobile")}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t("recurring.close")}
              hitSlop={8}
            >
              <Text variant="muted">{t("recurring.close")}</Text>
            </Pressable>
          </View>
          <ScrollView
            className="px-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <RecurringFormBody
              categories={categories}
              template={template}
              recordedThisMonth={recordedThisMonth}
              properties={properties}
              onDone={onClose}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface RecurringFormBodyProps {
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
  /**
   * The days this charge has been recorded on this month, today included.
   * When there are any, saving an edit asks whether they change too.
   */
  recordedThisMonth?: string[];
  /**
   * The user's properties. With none — no property, or the Add sheet, which
   * does not offer it — the field is not drawn and not sent, so saving leaves
   * the charge's property as it was.
   */
  properties?: { id: string; name: string }[];
  /**
   * The kind of money the category picker opens on — a kind's « + » on
   * Récurrents opens on that kind's.
   */
  initialType?: CategoryType;
  /** Called once the sheet around these fields should close. */
  onDone: () => void;
}

/**
 * The charge's fields, without a sheet around them. Drawn inside a scroll
 * view the caller owns: this modal's when editing, the Add sheet's when
 * adding.
 */
export function RecurringFormBody({
  categories,
  template = null,
  recordedThisMonth = [],
  properties = [],
  initialType,
  onDone,
}: RecurringFormBodyProps) {
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const t = useT();
  const { toast } = useToast();
  const isEditing = template !== null;
  const [categoryId, setCategoryId] = useState(template?.category_id ?? "");
  // In the reader's own shape — "12,5" in French — so the field reads back
  // exactly what it was given.
  const [amount, setAmount] = useState(() =>
    template ? toTypedAmount(Number(template.amount), locale) : "",
  );
  // A charge priced in shares keeps its pricing when edited here: the share
  // count is editable, the fund is shown, and nothing is quietly turned into
  // a fixed amount. A fixed amount that tracks a fund keeps its fund too.
  // Choosing a different fund is done on the web, which has the search.
  const sharePriced = template?.pricing_type === "shares";
  const [shareCount, setShareCount] = useState(
    template?.share_count ? String(template.share_count) : "",
  );
  const [description, setDescription] = useState(template?.description ?? "");
  const [propertyId, setPropertyId] = useState(template?.property_id ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence>(
    template?.recurrence ?? "monthly",
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    String(template?.day_of_month ?? 1),
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    String(template?.day_of_week ?? 1),
  );
  const [monthOfYear, setMonthOfYear] = useState(
    String(template?.month_of_year ?? 10),
  );
  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );
  // A yearly charge counts a twelfth each month in what the month leaves:
  // said under the schedule, as the web does.
  const isYearlyExpense =
    recurrence === "yearly" && selectedCategory?.type === "expense";
  // The app's transfer to the broker, kept from the ticked DCAs, as on the
  // web: opened here through a link, it says so and keeps its pricing.
  const follows = template?.pricing_type === "purchases";
  const [startsOn, setStartsOn] = useState(template?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(template?.ends_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Both default to leaving this month alone: what was recorded at the old
  // amount was paid at the old amount, and a charge set up today did not
  // happen on the 5th unless the user says it did.
  const [applyToThisMonth, setApplyToThisMonth] = useState(false);
  const [startThisMonth, setStartThisMonth] = useState(false);

  /*
   * The days the schedule on screen falls on this month that are already
   * behind today — what "include this month" would record. Recomputed as the
   * fields change, so the choice only appears when it means something and
   * names the days it means.
   */
  const pastThisMonth = useMemo(() => {
    if (isEditing) {
      return [];
    }
    const day = Number(dayOfMonth);
    const weekday = Number(dayOfWeek);
    const monthNumber = Number(monthOfYear);
    const valid =
      recurrence === "weekly"
        ? Number.isInteger(weekday) && weekday >= 1 && weekday <= 7
        : Number.isInteger(day) &&
          day >= 1 &&
          day <= 31 &&
          (recurrence !== "yearly" ||
            (Number.isInteger(monthNumber) &&
              monthNumber >= 1 &&
              monthNumber <= 12));
    if (!valid) {
      return [];
    }
    const { year, month } = getCurrentMonth();
    return scheduleDatesBefore(
      {
        recurrence,
        day_of_month: recurrence === "weekly" ? null : day,
        day_of_week: recurrence === "weekly" ? weekday : null,
        month_of_year: recurrence === "yearly" ? monthNumber : null,
        starts_on: startsOn.trim() || null,
        ends_on: endsOn.trim() || null,
      },
      year,
      month,
      todayIsoLocal(),
    );
  }, [
    isEditing,
    recurrence,
    dayOfMonth,
    dayOfWeek,
    monthOfYear,
    startsOn,
    endsOn,
  ]);
  const askApplyTo = isEditing && recordedThisMonth.length > 0;
  const askStart = !isEditing && pastThisMonth.length > 0;

  // Chosen from the language's own names rather than typed as "1 = Monday"
  // or "a month from 1 to 12", which the fields used to ask for.
  const weekdayOptions = useMemo(
    () =>
      Object.entries(dayOfWeekLabels(locale)).map(([value, label]) => ({
        value,
        label,
      })),
    [locale],
  );
  const monthOptions = useMemo(
    () =>
      Object.entries(monthLabels(locale)).map(([value, label]) => ({
        value,
        label,
      })),
    [locale],
  );

  async function handleSave() {
    setPending(true);
    setError(null);
    const payload: Record<string, unknown> = {
      ...(isEditing ? { id: template.id } : {}),
      categoryId,
      description: description || undefined,
      recurrence,
      active: template?.active !== false,
      ...(sharePriced
        ? {
            pricingType: "shares",
            shareCount,
            instrumentSymbol: template?.instrument_symbol ?? undefined,
            instrumentName: template?.instrument_name ?? undefined,
          }
        : follows
        ? {
            pricingType: "purchases",
            // Worked out by the server; the figure it had stands only when
            // next month holds no DCA.
            ...(template?.pricing_type === "purchases"
              ? { amount: Number(template.amount) }
              : {}),
          }
        : {
            pricingType: "fixed",
            // Whichever shape it was typed in, « 1 234,56 » included.
            // Unreadable is sent as nothing, which the schema answers with
            // its own message.
            amount: parseTypedAmount(amount) ?? 0,
            instrumentSymbol: template?.instrument_symbol ?? undefined,
            instrumentName: template?.instrument_name ?? undefined,
          }),
    };
    if (recurrence === "monthly") {
      payload.dayOfMonth = dayOfMonth;
    } else if (recurrence === "weekly") {
      payload.dayOfWeek = dayOfWeek;
    } else {
      payload.monthOfYear = monthOfYear;
      payload.dayOfMonth = dayOfMonth;
    }
    if (startsOn.trim()) {
      payload.startsOn = startsOn.trim();
    }
    if (endsOn.trim()) {
      payload.endsOn = endsOn.trim();
    }
    // Only when the field was drawn: empty detaches, absent leaves it be.
    if (properties.length > 0) {
      payload.propertyId = propertyId;
    }
    // Only sent when the question was on screen, so an answer given to a
    // question that then disappeared is not acted on.
    if (askApplyTo) {
      payload.applyToThisMonth = applyToThisMonth;
    }
    if (askStart) {
      payload.startThisMonth = startThisMonth;
    }

    const result = await upsertRecurringTemplate(payload);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void hapticSuccess();
    toast(
      isEditing ? t("recurring.updatedHint") : t("recurring.savedHint"),
      "success",
    );
    onDone();
  }

  async function handleDelete() {
    if (!template) {
      return;
    }
    setPending(true);
    const result = await deleteRecurringTemplate(template.id);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    void hapticWarning();
    toast(t("recurring.deletedHint"));
    onDone();
  }

  return (
    <>
      {/* Income included, as on the web: a salary is a recurring entry
          too, and one opened from the Income group has to find its
          category here. */}
      <Text className="mb-2 text-sm font-medium">
        {t("recurring.category")}
      </Text>
      <CategoryPicker
        label={t("recurring.category")}
        categories={categories}
        value={categoryId}
        onChange={setCategoryId}
        initialType={initialType}
        className="mb-4"
      />

      {follows ? (
        <View className="mb-4 rounded-control border border-border p-3">
          <Text className="text-base font-semibold">
            {t("recurring.followsPurchasesNow", {
              amount: formatEuro(Number(template.amount)),
            })}
          </Text>
          <Text variant="muted" className="mt-1 text-xs">
            {t("recurring.followsPurchasesNote")}
          </Text>
        </View>
      ) : sharePriced ? (
        <>
          <Text className="mb-2 text-sm font-medium">
            {t("recurring.shareCount")}
          </Text>
          <Input
            value={shareCount}
            onChangeText={setShareCount}
            keyboardType="number-pad"
            className="mb-1"
          />
          <Text variant="muted" className="mb-4 text-xs">
            {template?.instrument_name ?? template?.instrument_symbol}
            {template?.last_quote_price
              ? ` · ${t("recurring.perSharePrice", {
                  price: formatEuro(Number(template.last_quote_price)),
                })}`
              : ""}
          </Text>
        </>
      ) : (
        <>
          <Text className="mb-2 text-sm font-medium">
            {recurrence === "yearly"
              ? t("recurring.annualAmount")
              : t("recurring.amount")}
          </Text>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            className="mb-4"
          />
        </>
      )}

      {properties.length > 0 ? (
        <>
          <Text className="mb-2 text-sm font-medium">
            {t("property.attachLabel")}
          </Text>
          <ChoiceChips
            label={t("property.attachLabel")}
            className="mb-1"
            options={[
              { value: "", label: t("property.attachNone") },
              ...properties.map(({ id, name }) => ({ value: id, label: name })),
            ]}
            value={propertyId}
            onChange={setPropertyId}
          />
          <Text variant="muted" className="mb-4 text-xs">
            {t("property.attachHint")}
          </Text>
        </>
      ) : null}

      <Text className="mb-2 text-sm font-medium">
        {t("recurring.description")}
      </Text>
      <Input
        value={description}
        onChangeText={setDescription}
        className="mb-4"
      />

      <Text className="mb-2 text-sm font-medium">
        {t("recurring.schedule")}
      </Text>
      <ChoiceChips
        label={t("recurring.schedule")}
        fill
        options={(["monthly", "weekly", "yearly"] as const).map((value) => ({
          value,
          label: t(`recurring.${value}`),
        }))}
        value={recurrence}
        onChange={setRecurrence}
        className={isYearlyExpense ? "mb-2" : "mb-4"}
      />
      {isYearlyExpense ? (
        <Text variant="muted" className="mb-4 text-xs">
          {t("recurring.yearlyNote")}
        </Text>
      ) : null}

      {recurrence === "weekly" ? (
        <>
          <Text className="mb-2 text-sm font-medium">
            {t("recurring.dayOfWeek")}
          </Text>
          <OptionPicker
            label={t("recurring.dayOfWeek")}
            options={weekdayOptions}
            value={dayOfWeek}
            onChange={setDayOfWeek}
            columns={2}
            searchable={false}
            className="mb-4"
          />
        </>
      ) : (
        <>
          {recurrence === "yearly" ? (
            <>
              <Text className="mb-2 text-sm font-medium">
                {t("recurring.monthOfYear")}
              </Text>
              <OptionPicker
                label={t("recurring.monthOfYear")}
                options={monthOptions}
                value={monthOfYear}
                onChange={setMonthOfYear}
                columns={3}
                searchable={false}
                className="mb-4"
              />
            </>
          ) : null}
          <Text className="mb-2 text-sm font-medium">
            {t("recurring.dayOfMonth")}
          </Text>
          <Input
            value={dayOfMonth}
            onChangeText={setDayOfMonth}
            keyboardType="number-pad"
            maxLength={2}
            className="mb-4"
          />
        </>
      )}

      <Text className="mb-1 text-sm font-medium">
        {t("recurring.activePeriod")}
      </Text>
      <Text variant="muted" className="mb-3 text-xs">
        {t("recurring.activePeriodNote")}
      </Text>
      <Text className="mb-2 text-sm font-medium">
        {t("recurring.startsOn")}
      </Text>
      <DateField
        value={startsOn}
        onChange={setStartsOn}
        placeholder={t("recurring.noStartDate")}
        clearable
        className="mb-4"
      />
      <Text className="mb-2 text-sm font-medium">{t("recurring.endsOn")}</Text>
      <DateField
        value={endsOn}
        onChange={setEndsOn}
        placeholder={t("recurring.noEndDate")}
        clearable
        className="mb-4"
      />

      {askApplyTo ? (
        <ThisMonthChoice
          title={t("recurring.applyTo")}
          value={applyToThisMonth}
          onChange={setApplyToThisMonth}
          no={{
            label: t("recurring.scopeUpcoming"),
            hint: t("recurring.scopeUpcomingHint", {
              dates: formatOccurrenceDates(recordedThisMonth, locale),
            }),
          }}
          yes={{
            label: t("recurring.scopeThisMonth"),
            hint: t("recurring.scopeThisMonthHint", {
              dates: formatOccurrenceDates(recordedThisMonth, locale),
            }),
          }}
          footnote={t("recurring.pastMonthsNote")}
        />
      ) : null}

      {askStart ? (
        <ThisMonthChoice
          title={t("recurring.startFrom")}
          value={startThisMonth}
          onChange={setStartThisMonth}
          no={{
            label: t("recurring.startNow"),
            hint: t("recurring.startNowHint"),
          }}
          yes={{
            label: t("recurring.startThisMonth"),
            hint: t("recurring.startThisMonthHint", {
              count: pastThisMonth.length,
              dates: formatOccurrenceDates(pastThisMonth, locale),
            }),
          }}
        />
      ) : null}

      {error ? (
        <Text className="mb-3 text-destructive">
          {resolveMessage(t, error)}
        </Text>
      ) : null}

      <Button
        label={pending ? t("recurring.saving") : t("recurring.save")}
        size="lg"
        disabled={pending}
        onPress={handleSave}
      />
      {isEditing ? (
        // Behind a second press, as on the web: deleting a recurring entry
        // also takes away what it had written ahead of today.
        <View className="mb-8 mt-6 border-t border-border pt-4">
          {confirmDelete ? (
            <View className="gap-2">
              <Text variant="muted" className="text-sm">
                {t("recurring.deleteExplanation")}
              </Text>
              <View className="flex-row gap-2">
                <Button
                  label={
                    pending
                      ? t("recurring.deleting")
                      : t("recurring.confirmDelete")
                  }
                  variant="outline"
                  className="flex-1 border-destructive"
                  disabled={pending}
                  onPress={handleDelete}
                />
                <Button
                  label={t("common.cancel")}
                  variant="outline"
                  className="flex-1"
                  disabled={pending}
                  onPress={() => setConfirmDelete(false)}
                />
              </View>
            </View>
          ) : (
            <Button
              label={t("recurring.delete")}
              variant="outline"
              className="border-destructive"
              disabled={pending}
              onPress={() => setConfirmDelete(true)}
            />
          )}
        </View>
      ) : (
        <View className="mb-8" />
      )}
    </>
  );
}

interface ChoiceOption {
  label: string;
  hint: string;
}

/**
 * The one question a charge asks about the month in progress: leave it as
 * it is (`no`, the default) or reach into it (`yes`). The same shape for
 * "apply this change to" and "start", so the two read as the same kind of
 * decision.
 *
 * Two stacked options rather than the schedule's row of pills, because each
 * carries a sentence saying which days it touches — the choice is only
 * honest if the dates it would rewrite are on screen when it is made.
 */
function ThisMonthChoice({
  title,
  value,
  onChange,
  no,
  yes,
  footnote,
}: {
  title: string;
  value: boolean;
  onChange: (next: boolean) => void;
  no: ChoiceOption;
  yes: ChoiceOption;
  footnote?: string;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium">{title}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        className="gap-2"
      >
        {[
          { chosen: !value, option: no, next: false },
          { chosen: value, option: yes, next: true },
        ].map(({ chosen, option, next }) => (
          <Pressable
            key={String(next)}
            accessibilityRole="radio"
            accessibilityState={{ selected: chosen }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            onPress={() => onChange(next)}
            className={cn(
              "min-h-12 rounded-control border px-4 py-3",
              chosen ? "border-foreground bg-secondary" : "border-border",
            )}
          >
            <Text className="text-sm font-semibold">{option.label}</Text>
            <Text variant="muted" className="mt-0.5 text-xs">
              {option.hint}
            </Text>
          </Pressable>
        ))}
      </View>
      {footnote ? (
        <Text variant="muted" className="mt-2 text-xs">
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}
