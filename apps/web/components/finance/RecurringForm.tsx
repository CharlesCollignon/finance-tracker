"use client";

import {
  useActionState,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormLabel } from "@/components/ui/FormLabel";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/components/layout/ToastProvider";
import { MobileSheet } from "@/components/ui/MobileSheet";
import {
  deleteRecurringTemplate,
  upsertRecurringTemplate,
} from "@/lib/actions/finance";
import { CategoryPicker } from "@/components/finance/CategoryPicker";
import { OptionPicker } from "@/components/ui/Picker";
import { InstrumentSearch } from "@/components/finance/InstrumentSearch";
import { estimateSharesAmountAction } from "@/lib/actions/market";
import { formatMoney } from "@finance/core/market/fx";
import {
  BITCOIN_INSTRUMENT,
  isCryptoCategoryName,
} from "@finance/core/crypto-holdings";
import { dayOfWeekLabels, monthLabels } from "@finance/core/recurrence";
import {
  formatOccurrenceDates,
  scheduleDatesBefore,
} from "@finance/core/apply-recurring";
import { getCurrentMonth, todayIsoLocal } from "@finance/core/constants";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/use-currency";
import type {
  Category,
  PricingType,
  Recurrence,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";
import type { InstrumentSearchResult } from "@finance/core/market/yahoo";
import { useLocale, useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";
import type { FormState } from "@finance/core/action-result";

interface RecurringFormProps {
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
  /** The days this charge is already recorded on this month, up to today. */
  recordedDates?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Editing a charge, in a sheet of its own.
 *
 * Adding one happens in the shared Add sheet, which draws the same fields
 * through `RecurringFormBody` — so the two can never ask for different things.
 */
export function RecurringForm(props: RecurringFormProps) {
  if (!props.open) {
    return null;
  }

  return <RecurringFormSheet key={props.template?.id ?? "new"} {...props} />;
}

function RecurringFormSheet({
  categories,
  template,
  recordedDates,
  open,
  onOpenChange,
}: RecurringFormProps) {
  const t = useT();

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={template ? t("recurring.editTitle") : t("recurring.addTitle")}
    >
      <RecurringFormBody
        categories={categories}
        template={template}
        recordedDates={recordedDates}
        onDone={() => onOpenChange(false)}
      />
    </MobileSheet>
  );
}

interface RecurringFormBodyProps {
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
  /**
   * The days this charge is already recorded on this month, up to today.
   * When there are any, saving an edit asks whether they change too.
   */
  recordedDates?: string[];
  /** Called once the charge is saved or deleted. */
  onDone: () => void;
}

/** The charge's fields, without a sheet around them. */
export function RecurringFormBody({
  categories,
  template,
  recordedDates = [],
  onDone,
}: RecurringFormBodyProps) {
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const locale = useLocale();
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(
    upsertRecurringTemplate,
    {},
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [recurrence, setRecurrence] = useState<Recurrence>(
    template?.recurrence ?? "monthly",
  );
  // Held rather than left to the inputs, so "include this month" can say
  // which days it would record while the schedule is still being typed.
  const [dayOfMonth, setDayOfMonth] = useState(
    String(
      template?.day_of_month ?? (template?.recurrence === "yearly" ? 15 : 1),
    ),
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    String(template?.day_of_week ?? 1),
  );
  const [monthOfYear, setMonthOfYear] = useState(
    String(template?.month_of_year ?? 10),
  );
  const [startsOn, setStartsOn] = useState(template?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(template?.ends_on ?? "");
  const [applyToThisMonth, setApplyToThisMonth] = useState("false");
  const [startThisMonth, setStartThisMonth] = useState("false");
  const [categoryId, setCategoryId] = useState(template?.category_id ?? "");
  const [pricingType, setPricingType] = useState<PricingType>(
    template?.pricing_type ?? "fixed",
  );
  const [instrumentSymbol, setInstrumentSymbol] = useState(
    template?.instrument_symbol ?? "",
  );
  const [instrumentName, setInstrumentName] = useState(
    template?.instrument_name ?? "",
  );
  const [shareCount, setShareCount] = useState(
    template?.share_count ? String(template.share_count) : "1",
  );
  const [estimate, setEstimate] = useState<{
    amount: number;
    priceEur: number;
    priceOriginal: number;
    currency: string;
  } | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  // Once per result. Read through an effect event so a caller passing
  // `onDone` inline does not replay the last result on every render.
  const reportResult = useEffectEvent((result: typeof state) => {
    if (result.success) {
      toast(
        template ? t("recurring.updatedHint") : t("recurring.savedHint"),
        "success",
      );
      onDone();
    } else if (result.error) {
      toast(result.error, "error");
    }
  });

  useEffect(() => {
    reportResult(state);
  }, [state]);

  function handleDelete() {
    if (!template) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteRecurringTemplate(template.id);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(t("recurring.deletedHint"), "success");
        onDone();
      }
    });
  }

  /*
   * Every category, income included.
   *
   * This used to filter income out, which was how the app enforced "a charge
   * is something going out". The projection never agreed — it counts income
   * charges and its ingredient links here to have one added — so the form was
   * refusing the thing the rest of the product asked for.
   *
   * The filter also made the flags below right for the wrong reason. They all
   * read `selectedCategory`, and with income excluded, choosing an income
   * category made that `undefined`: not a deployment, not crypto, not yearly,
   * no shares — correct answers, arrived at through a failed lookup rather
   * than through the type checks that are sitting right there. Each of them
   * already narrows on `type`, so they give the same answers now by their own
   * logic, and a flag added later cannot inherit the accident.
   */
  const selectedCategory = categories.find((cat) => cat.id === categoryId);
  const isDeploymentCategory =
    selectedCategory?.type === "investment" &&
    selectedCategory.counts_toward_summary === false;
  const isCryptoCategory = isCryptoCategoryName(selectedCategory?.name ?? "");
  const isYearlyExpense =
    recurrence === "yearly" && selectedCategory?.type === "expense";
  /*
   * Share pricing stays investment-only, which is also what keeps it away
   * from an income template: an income that takes its amount from an
   * instrument quote is not a thing `CONTEXT.md` describes. No extra gate is
   * needed for that — the type check below is already the gate.
   */
  const supportsShares =
    selectedCategory?.type === "investment" && !isCryptoCategory;

  // Categories that don't support share pricing always behave as "fixed",
  // regardless of what the toggle state was before switching category.
  const effectivePricingType: PricingType = supportsShares
    ? pricingType
    : "fixed";

  const parsedShares = Number(shareCount);
  const sharesValid = Number.isInteger(parsedShares) && parsedShares > 0;
  const estimateActive =
    effectivePricingType === "shares" && Boolean(instrumentSymbol);

  useEffect(() => {
    if (!estimateActive || !sharesValid) {
      return;
    }

    const timer = setTimeout(async () => {
      setEstimateLoading(true);
      const response = await estimateSharesAmountAction(
        instrumentSymbol,
        parsedShares,
      );

      if ("error" in response) {
        setEstimate(null);
        setEstimateError(response.error);
      } else {
        setEstimate(response.data);
        setEstimateError(null);
      }

      setEstimateLoading(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [estimateActive, sharesValid, instrumentSymbol, parsedShares]);

  const estimateShown = estimateActive && sharesValid ? estimate : null;
  const estimateErrorShown = !estimateActive
    ? null
    : !sharesValid
      ? t("recurring.wholeSharesOnly")
      : estimateError;

  const recordedList = formatOccurrenceDates(recordedDates, locale);

  // The days this schedule has already passed this month, for a charge being
  // created: what "include this month" would record. Recomputed as the
  // schedule is typed, so the choice only appears when there is one.
  const today = todayIsoLocal();
  const { year: thisYear, month: thisMonth } = getCurrentMonth();
  const missedThisMonth = template
    ? []
    : scheduleDatesBefore(
        {
          recurrence,
          day_of_month:
            recurrence === "weekly" ? null : Number(dayOfMonth) || null,
          day_of_week: recurrence === "weekly" ? Number(dayOfWeek) : null,
          month_of_year: recurrence === "yearly" ? Number(monthOfYear) : null,
          starts_on: startsOn || null,
          ends_on: endsOn || null,
        },
        thisYear,
        thisMonth,
        today,
      );

  return (
    <form action={action} className="flex flex-col gap-4">
      {template && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="recurrence" value={recurrence} />
      <input type="hidden" name="pricingType" value={effectivePricingType} />
      <input
        type="hidden"
        name="active"
        value={template?.active === false ? "false" : "true"}
      />
      <div className="flex flex-col gap-2">
        <FormLabel htmlFor="recurring-category">
          {t("recurring.category")}
        </FormLabel>
        <CategoryPicker
          id="recurring-category"
          categories={categories}
          label={t("recurring.category")}
          value={categoryId}
          onValueChange={setCategoryId}
          required
        />
        {isDeploymentCategory && !isCryptoCategory && (
          <Text className="text-xs text-muted-foreground">
            {t("recurring.brokerDcaNote")}
          </Text>
        )}
        {isCryptoCategory && (
          <Text className="text-xs text-muted-foreground">
            {t("recurring.bitstackNote")}
          </Text>
        )}
      </div>
      {supportsShares && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            {t("recurring.amountType")}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPricingType("fixed")}
              className={cn(
                "rounded-full border px-3 py-2 text-sm font-medium",
                effectivePricingType === "fixed"
                  ? "border-foreground bg-secondary text-foreground"
                  : "border-border hover:bg-accent",
              )}
            >
              {t("recurring.fixedAmount")}
            </button>
            <button
              type="button"
              onClick={() => setPricingType("shares")}
              className={cn(
                "rounded-full border px-3 py-2 text-sm font-medium",
                effectivePricingType === "shares"
                  ? "border-foreground bg-secondary text-foreground"
                  : "border-border hover:bg-accent",
              )}
            >
              {t("recurring.sharesTimesPrice")}
            </button>
          </div>
          {effectivePricingType === "shares" && (
            <Text className="text-xs text-muted-foreground">
              {t("recurring.sharesNote")}
            </Text>
          )}
        </div>
      )}
      {effectivePricingType === "shares" ? (
        <>
          <InstrumentSearch
            symbol={instrumentSymbol}
            name={instrumentName}
            onSelect={(instrument: InstrumentSearchResult) => {
              setInstrumentSymbol(instrument.symbol);
              setInstrumentName(instrument.name);
            }}
            onClear={() => {
              setInstrumentSymbol("");
              setInstrumentName("");
            }}
            required
          />
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="shareCount">
              {t("recurring.shareCount")}
            </FormLabel>
            <Input
              id="shareCount"
              name="shareCount"
              type="number"
              step="1"
              min="1"
              required
              className="text-base"
              value={shareCount}
              onChange={(event) => setShareCount(event.target.value)}
            />
          </div>
          <div
            className={cn(
              "rounded-control border border-border bg-muted/20 p-3 text-sm",
            )}
          >
            <p className="font-medium">{t("recurring.estimatedAmount")}</p>
            {estimateLoading && (
              <p className="mt-1 text-muted-foreground">
                {t("recurring.fetchingPrice")}
              </p>
            )}
            {!estimateLoading && estimateShown && (
              <p className="privacy-sensitive mt-1 font-mono tabular-nums text-base font-semibold">
                ≈ {formatEuro(estimateShown.amount)}
                <span className="ml-2 block text-xs font-normal text-muted-foreground">
                  {t("recurring.perSharePrice", {
                    price: formatEuro(estimateShown.priceEur),
                  })}
                  {estimateShown.currency !== "EUR" &&
                    ` ${t("recurring.convertedFrom", {
                      amount: formatMoney(
                        estimateShown.priceOriginal,
                        estimateShown.currency,
                        locale,
                      ),
                    })}`}
                </span>
              </p>
            )}
            {!estimateLoading && estimateErrorShown && (
              <p className="mt-1 text-destructive">{estimateErrorShown}</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="recurring-amount">
              {recurrence === "yearly"
                ? t("recurring.annualAmount")
                : t("recurring.amount")}
            </FormLabel>
            <Input
              id="recurring-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="text-base"
              defaultValue={template?.amount ?? ""}
            />
          </div>
          {supportsShares && !isCryptoCategory && (
            <div className="flex flex-col gap-2 rounded-control border border-border bg-muted/20 p-3">
              <FormLabel>{t("recurring.trackedFund")}</FormLabel>
              <Text className="text-xs text-muted-foreground">
                {t("recurring.trackedFundNote")}
              </Text>
              <InstrumentSearch
                symbol={instrumentSymbol}
                name={instrumentName}
                onSelect={(instrument: InstrumentSearchResult) => {
                  setInstrumentSymbol(instrument.symbol);
                  setInstrumentName(instrument.name);
                }}
                onClear={() => {
                  setInstrumentSymbol("");
                  setInstrumentName("");
                }}
              />
            </div>
          )}
          {isCryptoCategory && (
            <>
              <input
                type="hidden"
                name="instrumentSymbol"
                value={BITCOIN_INSTRUMENT.symbol}
              />
              <input
                type="hidden"
                name="instrumentName"
                value={BITCOIN_INSTRUMENT.name}
              />
              <div className="rounded-control border border-border bg-muted/20 p-3 text-sm">
                <p className="font-medium">{t("recurring.bitcoinTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("recurring.bitcoinNote")}
                </p>
              </div>
            </>
          )}
        </>
      )}
      <div className="flex flex-col gap-2">
        <FormLabel htmlFor="recurring-description">
          {t("recurring.descriptionOptional")}
        </FormLabel>
        <Input
          id="recurring-description"
          name="description"
          type="text"
          maxLength={500}
          className="text-base"
          defaultValue={template?.description ?? ""}
          placeholder={t("recurring.descriptionPlaceholder")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("recurring.schedule")}</span>
        <div className="grid grid-cols-3 gap-2">
          {(["monthly", "weekly", "yearly"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRecurrence(value)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm font-medium",
                recurrence === value
                  ? "border-foreground bg-secondary text-foreground"
                  : "border-border hover:bg-accent",
              )}
            >
              {t(`recurring.${value}`)}
            </button>
          ))}
        </div>
        {isYearlyExpense && (
          <Text className="text-xs text-muted-foreground">
            {t("recurring.yearlyNote")}
          </Text>
        )}
      </div>
      {recurrence === "monthly" ? (
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="dayOfMonth">
            {t("recurring.dayOfMonth")}
          </FormLabel>
          <Input
            id="dayOfMonth"
            name="dayOfMonth"
            type="number"
            min="1"
            max="31"
            required
            className="text-base"
            value={dayOfMonth}
            onChange={(event) => setDayOfMonth(event.target.value)}
          />
        </div>
      ) : recurrence === "weekly" ? (
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="dayOfWeek">{t("recurring.dayOfWeek")}</FormLabel>
          <OptionPicker
            id="dayOfWeek"
            name="dayOfWeek"
            required
            panelLabel={t("recurring.dayOfWeek")}
            label={t("recurring.dayOfWeek")}
            options={Object.entries(dayOfWeekLabels(locale)).map(
              ([value, label]) => ({ value, label }),
            )}
            value={dayOfWeek}
            onValueChange={setDayOfWeek}
            columns={2}
            searchable={false}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="monthOfYear">
              {t("recurring.monthOfYear")}
            </FormLabel>
            <OptionPicker
              id="monthOfYear"
              name="monthOfYear"
              required
              panelLabel={t("recurring.monthOfYear")}
              label={t("recurring.monthOfYear")}
              options={Object.entries(monthLabels(locale)).map(
                ([value, label]) => ({ value, label }),
              )}
              value={monthOfYear}
              onValueChange={setMonthOfYear}
              columns={3}
              searchable={false}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="dayOfMonth">
              {t("recurring.dayOfMonth")}
            </FormLabel>
            <Input
              id="dayOfMonth"
              name="dayOfMonth"
              type="number"
              min="1"
              max="31"
              required
              className="text-base"
              value={dayOfMonth}
              onChange={(event) => setDayOfMonth(event.target.value)}
            />
          </div>
        </>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          {t("recurring.activePeriod")}
        </span>
        <Text className="text-xs text-muted-foreground">
          {t("recurring.activePeriodNote")}
        </Text>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="startsOn">{t("recurring.startsOn")}</FormLabel>
            <Input
              id="startsOn"
              name="startsOn"
              type="date"
              className="text-base"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="endsOn">{t("recurring.endsOn")}</FormLabel>
            <Input
              id="endsOn"
              name="endsOn"
              type="date"
              className="text-base"
              value={endsOn}
              onChange={(event) => setEndsOn(event.target.value)}
            />
          </div>
        </div>
      </div>
      {template && recordedDates.length > 0 ? (
        <ChoiceGroup
          legend={t("recurring.applyTo")}
          name="applyToThisMonth"
          value={applyToThisMonth}
          onValueChange={setApplyToThisMonth}
          options={[
            {
              value: "false",
              label: t("recurring.scopeUpcoming"),
              hint: t("recurring.scopeUpcomingHint", { dates: recordedList }),
            },
            {
              value: "true",
              label: t("recurring.scopeThisMonth"),
              hint: t("recurring.scopeThisMonthHint", { dates: recordedList }),
            },
          ]}
          footnote={t("recurring.pastMonthsNote")}
        />
      ) : null}
      {!template && missedThisMonth.length > 0 ? (
        <ChoiceGroup
          legend={t("recurring.startFrom")}
          name="startThisMonth"
          value={startThisMonth}
          onValueChange={setStartThisMonth}
          options={[
            {
              value: "false",
              label: t("recurring.startNow"),
              hint: t("recurring.startNowHint"),
            },
            {
              value: "true",
              label: t("recurring.startThisMonth"),
              hint: t("recurring.startThisMonthHint", {
                count: missedThisMonth.length,
                dates: formatOccurrenceDates(missedThisMonth, locale),
              }),
            },
          ]}
        />
      ) : null}
      {state.error && (
        <Text className="text-sm text-destructive">
          {resolveMessage(t, state.error)}
        </Text>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t("recurring.saving") : t("recurring.save")}
      </Button>

      {template && (
        <div className="border-t border-border pt-4">
          {confirmDelete ? (
            <div className="flex flex-col gap-2">
              <Text className="text-sm text-muted-foreground">
                {t("recurring.deleteExplanation")}
              </Text>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1 border-destructive text-destructive"
                  onClick={handleDelete}
                  disabled={deletePending}
                >
                  {deletePending
                    ? t("recurring.deleting")
                    : t("recurring.confirmDelete")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deletePending}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full border-destructive text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              {t("recurring.deleteItem")}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

/**
 * A choice between two answers that each need a sentence, as two cards.
 *
 * Real radio inputs under the cards, so the group has a name a screen reader
 * announces, the arrow keys move between the two, and the form posts the
 * answer without any of it being rebuilt here. The inputs are visually
 * hidden; the card they sit in is what shows the answer and the focus.
 */
function ChoiceGroup({
  legend,
  name,
  value,
  onValueChange,
  options,
  footnote,
}: {
  legend: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string; hint: string }[];
  footnote?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer flex-col gap-0.5 rounded-control border px-3 py-2.5",
              "transition-colors duration-hover",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              "has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
              value === option.value
                ? "border-foreground bg-secondary"
                : "border-border hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onValueChange(option.value)}
              className="sr-only"
            />
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.hint}</span>
          </label>
        ))}
      </div>
      {footnote ? (
        <p className="text-xs text-muted-foreground">{footnote}</p>
      ) : null}
    </fieldset>
  );
}
