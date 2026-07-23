"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { FormLabel } from "@/components/layout/FormLabel";
import { Text } from "@/components/retroui/Text";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { useToast } from "@/components/layout/ToastProvider";
import { InstrumentSearch } from "@/components/finance/InstrumentSearch";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import {
  removeInvestmentPosition,
  saveInvestmentPosition,
} from "@/lib/actions/investments";
import { estimateSharesAmountAction } from "@/lib/actions/market";
import { formatMoney } from "@finance/core/market/fx";
import { formatEuro } from "@finance/core/constants";
import {
  BITCOIN_INSTRUMENT,
  isCryptoWallet,
} from "@finance/core/crypto-holdings";
import { parseShareCountInput } from "@finance/core/share-count";
import {
  displayNameForRecurringTemplate,
  type InvestmentPositionItem,
} from "@finance/core/investment-positions";
import type { InvestmentWalletId } from "@finance/core/investments";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";

interface InvestmentPositionSheetProps {
  item: InvestmentPositionItem | null;
  walletId: InvestmentWalletId;
  recurringOptions: RecurringTemplateWithCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvestmentPositionSheet({
  item,
  walletId,
  recurringOptions,
  open,
  onOpenChange,
}: InvestmentPositionSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <InvestmentPositionForm
      key={item?.id ?? `new-${walletId}`}
      item={item}
      walletId={walletId}
      recurringOptions={recurringOptions}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

interface InvestmentPositionFormProps {
  item: InvestmentPositionItem | null;
  walletId: InvestmentWalletId;
  recurringOptions: RecurringTemplateWithCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InvestmentPositionForm({
  item,
  walletId,
  recurringOptions,
  open,
  onOpenChange,
}: InvestmentPositionFormProps) {
  const isEdit = item !== null;
  const { toast } = useToast();
  const [state, action, pending] = useActionState(saveInvestmentPosition, {});
  const [deletePending, startDelete] = useTransition();
  const [sourceType, setSourceType] = useState<"recurring" | "custom">(
    item?.recurringTemplateId ? "recurring" : "custom",
  );
  const [recurringTemplateId, setRecurringTemplateId] = useState(
    item?.recurringTemplateId ?? "",
  );
  const [name, setName] = useState(item?.name ?? "");
  const [instrumentSymbol, setInstrumentSymbol] = useState(
    item?.instrumentSymbol ?? "",
  );
  const [instrumentName, setInstrumentName] = useState(
    item?.instrumentName ?? "",
  );
  const [shareCount, setShareCount] = useState(
    item?.shareCount ? String(item.shareCount) : "",
  );
  const [estimate, setEstimate] = useState<{
    amount: number;
    priceEur: number;
    priceOriginal: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    if (state.success) {
      toast(isEdit ? `${item?.name} updated` : "Item added", "success");
      onOpenChange(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state.success, state.error, isEdit, item?.name, onOpenChange, toast]);

  useEffect(() => {
    if (!instrumentSymbol || !shareCount) {
      setEstimate(null);
      return;
    }

    const parsedShares = parseShareCountInput(shareCount);
    if (parsedShares === null) {
      setEstimate(null);
      return;
    }

    const timer = setTimeout(async () => {
      const response = await estimateSharesAmountAction(
        instrumentSymbol,
        parsedShares,
      );
      if ("data" in response) {
        setEstimate(response.data);
      } else {
        setEstimate(null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [instrumentSymbol, shareCount]);

  function handleDelete() {
    if (!item) {
      return;
    }

    startDelete(async () => {
      const result = await removeInvestmentPosition(item.id);
      if (result.error) {
        toast(result.error, "error");
        return;
      }

      toast(`${item.name} removed`, "success");
      onOpenChange(false);
    });
  }

  const isCrypto = isCryptoWallet(walletId);
  const title = isEdit ? item.name : isCrypto ? "Add crypto item" : "Add item";
  const isRecurringLinked = isEdit && Boolean(item.recurringTemplateId);
  const instrumentFromRecurring =
    isRecurringLinked && Boolean(item.instrumentSymbol || isCrypto);

  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} title={title}>
      <form action={action} className="flex flex-col gap-4">
        {isEdit && (
          <input type="hidden" name="positionId" value={item.id} />
        )}
        <input type="hidden" name="wallet" value={walletId} />
        <input type="hidden" name="sourceType" value={sourceType} />
        {isEdit && item.recurringTemplateId && (
          <input
            type="hidden"
            name="recurringTemplateId"
            value={item.recurringTemplateId}
          />
        )}

        {!isEdit && (
          <div className="flex flex-col gap-2">
            <FormLabel>Item type</FormLabel>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={sourceType === "recurring" ? "default" : "outline"}
                onClick={() => setSourceType("recurring")}
              >
                From recurring
              </Button>
              <Button
                type="button"
                variant={sourceType === "custom" ? "default" : "outline"}
                onClick={() => setSourceType("custom")}
              >
                Custom holding
              </Button>
            </div>
          </div>
        )}

        {!isEdit && sourceType === "recurring" && (
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="recurringTemplateId">Recurring item</FormLabel>
            {recurringOptions.length > 0 ? (
              <select
                id="recurringTemplateId"
                name="recurringTemplateId"
                required
                className="h-10 w-full border-2 border-border bg-input px-3 text-base"
                value={recurringTemplateId}
                onChange={(event) =>
                  setRecurringTemplateId(event.target.value)
                }
              >
                <option value="">Pick one…</option>
                {recurringOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {displayNameForRecurringTemplate(template)}
                  </option>
                ))}
              </select>
            ) : (
              <Text className="text-sm text-muted-foreground">
                No recurring items available for this column. Add one on the
                Recurring page or use a custom holding.
              </Text>
            )}
          </div>
        )}

        {isRecurringLinked ? (
          <div className="flex items-center gap-3 rounded border-2 border-border p-3">
            <CategoryIcon icon={item.icon} />
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {isCrypto
                  ? "Fixed EUR DCA · Bitcoin on Bitstack"
                  : "Fixed EUR DCA · ETF set on Recurring"}
              </p>
            </div>
          </div>
        ) : null}

        {(!isEdit && sourceType === "custom") ||
        (isEdit && !item.recurringTemplateId) ? (
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="name">Name</FormLabel>
            <Input
              id="name"
              name="name"
              required={!isEdit}
              className="text-base"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. MSCI World ETF"
            />
          </div>
        ) : (
          <input type="hidden" name="name" value={name} />
        )}

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="initialBalance">
            Total invested (cost basis)
          </FormLabel>
          <Text className="text-xs text-muted-foreground">
            Your broker&apos;s total invested amount for this position. Used
            for P/L — not updated from recurring transactions.
          </Text>
          <Input
            id="initialBalance"
            name="initialBalance"
            type="number"
            step="0.01"
            min="0"
            required
            className="text-base"
            defaultValue={item?.initialBalance || ""}
          />
        </div>

        {isRecurringLinked && instrumentFromRecurring ? (
          <div className="rounded border-2 border-border bg-muted/20 p-3 text-sm">
            <p className="font-medium">
              {isCrypto ? "Tracked asset" : "Tracked ETF"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {isCrypto
                ? BITCOIN_INSTRUMENT.name
                : item.instrumentName ?? item.instrumentSymbol}
            </p>
            {!isCrypto && (
              <p className="mt-2 text-xs text-muted-foreground">
                Change the fund on the{" "}
                <Link href="/recurring" className="font-medium underline">
                  Recurring
                </Link>{" "}
                page.
              </p>
            )}
            <input
              type="hidden"
              name="instrumentSymbol"
              value={
                isCrypto
                  ? BITCOIN_INSTRUMENT.symbol
                  : instrumentSymbol
              }
            />
            <input
              type="hidden"
              name="instrumentName"
              value={
                isCrypto ? BITCOIN_INSTRUMENT.name : instrumentName
              }
            />
          </div>
        ) : isRecurringLinked && !isCrypto ? (
          <Text className="text-sm text-muted-foreground">
            Link your ETF under{" "}
            <Link href="/recurring" className="font-medium underline">
              Recurring → {item.name}
            </Link>{" "}
            first, then enter total shares below.
          </Text>
        ) : isCrypto ? (
          <>
            <div className="rounded border-2 border-border bg-muted/20 p-3 text-sm">
              <p className="font-medium">Bitcoin</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Market value uses BTC-EUR live price × your total BTC.
              </p>
            </div>
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
          </>
        ) : (
          <>
            <InstrumentSearch
              symbol={instrumentSymbol}
              name={instrumentName}
              onSelect={(instrument) => {
                setInstrumentSymbol(instrument.symbol);
                setInstrumentName(instrument.name);
              }}
              onClear={() => {
                setInstrumentSymbol("");
                setInstrumentName("");
              }}
            />
            <input
              type="hidden"
              name="instrumentSymbol"
              value={instrumentSymbol}
            />
            <input
              type="hidden"
              name="instrumentName"
              value={instrumentName}
            />
          </>
        )}

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="shareCount">
            {isCrypto
              ? "Total BTC held"
              : instrumentSymbol
                ? "Total shares held"
                : "Shares held (optional)"}
          </FormLabel>
          {(instrumentSymbol || isCrypto) && (
            <Text className="text-xs text-muted-foreground">
              {isCrypto
                ? "From Bitstack — fractional BTC OK (use comma or dot)."
                : "From your broker — fractional shares OK (use comma or dot, e.g. 1,1465)."}
            </Text>
          )}
          <Input
            id="shareCount"
            name="shareCount"
            type="text"
            inputMode="decimal"
            className="text-base"
            value={shareCount}
            onChange={(event) => setShareCount(event.target.value)}
            placeholder={isCrypto ? "e.g. 0,01234" : "e.g. 42 or 1,1465"}
          />
        </div>

        {estimate !== null && (
          <Text className="text-sm text-muted-foreground">
            Live market estimate:{" "}
            <span className="font-semibold text-foreground">
              ≈ {formatEuro(estimate.amount)}
            </span>
            {isCrypto ? (
              <span className="block text-xs">
                @ {formatEuro(estimate.priceEur)} / BTC
              </span>
            ) : (
              estimate.currency !== "EUR" && (
                <span className="block text-xs">
                  {formatMoney(estimate.priceOriginal, estimate.currency)} / share
                  → {formatEuro(estimate.priceEur)} / share
                </span>
              )
            )}
          </Text>
        )}

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="currentValue">
            Broker value override (optional)
          </FormLabel>
          <Text className="text-xs text-muted-foreground">
            Usually leave empty — market value is computed from shares × live
            price. Use this only if your broker shows a different total than
            the live quote (e.g. delayed price, fees, or cash drag).
          </Text>
          <Input
            id="currentValue"
            name="currentValue"
            type="number"
            step="0.01"
            min="0"
            className="text-base"
            defaultValue={item?.currentValue ?? ""}
            placeholder="Total portfolio value from your broker"
          />
        </div>

        {state.error && (
          <Text className="text-sm text-destructive">{state.error}</Text>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={
            pending ||
            (!isEdit &&
              sourceType === "recurring" &&
              recurringOptions.length === 0)
          }
        >
          {pending ? "Saving…" : isEdit ? "Save item" : "Add item"}
        </Button>

        {isEdit && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full text-destructive"
            disabled={deletePending}
            onClick={handleDelete}
          >
            <Trash size={16} />
            {deletePending ? "Removing…" : "Remove from portfolio"}
          </Button>
        )}
      </form>
    </MobileSheet>
  );
}
