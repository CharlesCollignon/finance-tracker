"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { useToast } from "@/components/layout/ToastProvider";
import { MobileSheet } from "@/components/layout/MobileSheet";
import {
  deleteRecurringTemplate,
  upsertRecurringTemplate,
} from "@/lib/actions/finance";
import { CategorySelect } from "@/components/finance/CategorySelect";
import { InstrumentSearch } from "@/components/finance/InstrumentSearch";
import { estimateSharesAmountAction } from "@/lib/actions/market";
import { formatMoney } from "@finance/core/market/fx";
import { formatEuro } from "@finance/core/constants";
import {
  BITCOIN_INSTRUMENT,
  isCryptoCategoryName,
} from "@finance/core/crypto-holdings";
import { DAY_OF_WEEK_LABELS, MONTH_LABELS } from "@finance/core/recurrence";
import { cn } from "@/lib/utils";
import type {
  Category,
  PricingType,
  Recurrence,
  RecurringTemplateWithCategory,
} from "@finance/core/types/database";
import type { InstrumentSearchResult } from "@finance/core/market/yahoo";

interface RecurringFormProps {
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecurringForm({
  categories,
  template,
  open,
  onOpenChange,
}: RecurringFormProps) {
  if (!open) {
    return null;
  }

  return (
    <RecurringFormFields
      key={template?.id ?? "new"}
      categories={categories}
      template={template}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

interface RecurringFormFieldsProps {
  categories: Category[];
  template?: RecurringTemplateWithCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RecurringFormFields({
  categories,
  template,
  open,
  onOpenChange,
}: RecurringFormFieldsProps) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(upsertRecurringTemplate, {});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [recurrence, setRecurrence] = useState<Recurrence>(
    template?.recurrence ?? "monthly",
  );
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

  useEffect(() => {
    if (state.success) {
      toast(template ? "Recurring item updated" : "Recurring item added", "success");
      onOpenChange(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state.success, state.error, template, onOpenChange, toast]);

  function handleDelete() {
    if (!template) {
      return;
    }

    startDeleteTransition(async () => {
      const result = await deleteRecurringTemplate(template.id);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast("Recurring item deleted", "success");
        onOpenChange(false);
      }
    });
  }

  const allocCategories = categories.filter((c) => c.type !== "income");
  const selectedCategory = allocCategories.find((cat) => cat.id === categoryId);
  const isDeploymentCategory =
    selectedCategory?.type === "investment" &&
    selectedCategory.counts_toward_summary === false;
  const isCryptoCategory = isCryptoCategoryName(
    selectedCategory?.name ?? "",
  );
  const isYearlyExpense =
    recurrence === "yearly" && selectedCategory?.type === "expense";
  const supportsShares =
    selectedCategory?.type === "investment" && !isCryptoCategory;

  useEffect(() => {
    if (isCryptoCategory && pricingType === "shares") {
      setPricingType("fixed");
    }
  }, [isCryptoCategory, pricingType]);

  useEffect(() => {
    if (!supportsShares && pricingType === "shares") {
      setPricingType("fixed");
    }
  }, [supportsShares, pricingType]);

  useEffect(() => {
    if (pricingType !== "shares" || !instrumentSymbol) {
      setEstimate(null);
      setEstimateError(null);
      return;
    }

    const parsedShares = Number(shareCount);
    if (!Number.isInteger(parsedShares) || parsedShares <= 0) {
      setEstimate(null);
      setEstimateError("Enter a whole number of shares");
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
  }, [pricingType, instrumentSymbol, shareCount]);

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={template ? "Edit recurring" : "Add recurring"}
    >
      <form action={action} className="flex flex-col gap-4">
        {template && <input type="hidden" name="id" value={template.id} />}
        <input type="hidden" name="recurrence" value={recurrence} />
        <input type="hidden" name="pricingType" value={pricingType} />
        <input
          type="hidden"
          name="active"
          value={template?.active === false ? "false" : "true"}
        />
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="recurring-category">Category</FormLabel>
          <CategorySelect
            id="recurring-category"
            categories={categories}
            excludeTypes={["income"]}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          />
          {isDeploymentCategory && !isCryptoCategory && (
            <Text className="text-xs text-muted-foreground">
              Broker DCA entries are tracked for visibility but do not reduce
              your remaining budget.
            </Text>
          )}
          {isCryptoCategory && (
            <Text className="text-xs text-muted-foreground">
              Fixed EUR weekly buy on Bitstack. Market value on Wallets uses
              your total BTC × live BTC/EUR price.
            </Text>
          )}
        </div>
        {supportsShares && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Amount type</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPricingType("fixed")}
                className={cn(
                  "rounded border-2 px-3 py-2 text-sm font-medium",
                  pricingType === "fixed"
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent",
                )}
              >
                Fixed EUR
              </button>
              <button
                type="button"
                onClick={() => setPricingType("shares")}
                className={cn(
                  "rounded border-2 px-3 py-2 text-sm font-medium",
                  pricingType === "shares"
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent",
                )}
              >
                Shares × price
              </button>
            </div>
            {pricingType === "shares" && (
              <Text className="text-xs text-muted-foreground">
                Pick your ETF and share count. Search by name or ISIN
                (e.g. LU1681043599). The app fetches the live price and
                computes the EUR amount when saving or applying recurring.
              </Text>
            )}
          </div>
        )}
        {pricingType === "shares" && supportsShares ? (
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
              <FormLabel htmlFor="shareCount">Number of shares</FormLabel>
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
                "rounded border-2 border-border bg-muted/20 p-3 text-sm",
              )}
            >
              <p className="font-medium">Estimated amount</p>
              {estimateLoading && (
                <p className="mt-1 text-muted-foreground">Fetching price…</p>
              )}
              {!estimateLoading && estimate && (
                <p className="mt-1 tabular-nums text-base font-semibold">
                  ≈ {formatEuro(estimate.amount)}
                  <span className="ml-2 block text-xs font-normal text-muted-foreground">
                    @ {formatEuro(estimate.priceEur)} / share
                    {estimate.currency !== "EUR" &&
                      ` (${formatMoney(estimate.priceOriginal, estimate.currency)} converted)`}
                  </span>
                </p>
              )}
              {!estimateLoading && estimateError && (
                <p className="mt-1 text-destructive">{estimateError}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="recurring-amount">
                {recurrence === "yearly"
                  ? "Annual amount (EUR)"
                  : "Amount (EUR)"}
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
              <div className="flex flex-col gap-2 rounded border-2 border-border bg-muted/20 p-3">
                <FormLabel>Tracked ETF / fund</FormLabel>
                <Text className="text-xs text-muted-foreground">
                  Fixed EUR DCA: pick the ETF you buy here. On Wallets,
                  enter how many shares you hold in total for live market
                  value.
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
                <div className="rounded border-2 border-border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">Bitcoin DCA</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Each buy converts your EUR amount to BTC. Enter your
                    total BTC balance on Wallets for live value.
                  </p>
                </div>
              </>
            )}
          </>
        )}
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="recurring-description">
            Description (optional)
          </FormLabel>
          <Input
            id="recurring-description"
            name="description"
            type="text"
            maxLength={500}
            className="text-base"
            defaultValue={template?.description ?? ""}
            placeholder="e.g. Netflix, gym membership, CTO DCA"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Schedule</span>
          <div className="grid grid-cols-3 gap-2">
            {(["monthly", "weekly", "yearly"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRecurrence(value)}
                className={cn(
                  "rounded border-2 px-3 py-2 text-sm font-medium capitalize",
                  recurrence === value
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          {isYearlyExpense && (
            <Text className="text-xs text-muted-foreground">
              Counts as a monthly share in your budget (annual ÷ 12). The full
              payment is recorded once in the due month.
            </Text>
          )}
        </div>
        {recurrence === "monthly" ? (
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="dayOfMonth">Day of month</FormLabel>
            <Input
              id="dayOfMonth"
              name="dayOfMonth"
              type="number"
              min="1"
              max="31"
              required
              className="text-base"
              defaultValue={template?.day_of_month ?? 1}
            />
          </div>
        ) : recurrence === "weekly" ? (
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="dayOfWeek">Day of week</FormLabel>
            <select
              id="dayOfWeek"
              name="dayOfWeek"
              required
              className="h-11 w-full rounded border-2 border-border bg-background px-3 text-base text-foreground shadow-md"
              defaultValue={template?.day_of_week ?? 1}
            >
              {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="monthOfYear">Month</FormLabel>
              <select
                id="monthOfYear"
                name="monthOfYear"
                required
                className="h-11 w-full rounded border-2 border-border bg-background px-3 text-base text-foreground shadow-md"
                defaultValue={template?.month_of_year ?? 10}
              >
                {Object.entries(MONTH_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <FormLabel htmlFor="dayOfMonth">Day of month</FormLabel>
              <Input
                id="dayOfMonth"
                name="dayOfMonth"
                type="number"
                min="1"
                max="31"
                required
                className="text-base"
                defaultValue={template?.day_of_month ?? 15}
              />
            </div>
          </>
        )}
        {state.error && (
          <Text className="text-sm text-destructive">{state.error}</Text>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>

        {template && (
          <div className="border-t-2 border-border pt-4">
            {confirmDelete ? (
              <div className="flex flex-col gap-2">
                <Text className="text-sm text-muted-foreground">
                  Delete this recurring item? Past transactions stay in your
                  ledger.
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
                    {deletePending ? "Deleting…" : "Confirm delete"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deletePending}
                  >
                    Cancel
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
                Delete recurring item
              </Button>
            )}
          </div>
        )}
      </form>
    </MobileSheet>
  );
}
