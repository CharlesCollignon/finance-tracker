"use client";

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
import { formatEuro } from "@/lib/constants";
import {
  displayNameForRecurringTemplate,
  type InvestmentPositionItem,
} from "@/lib/investment-positions";
import type { InvestmentWalletId } from "@/lib/investments";
import type { RecurringTemplateWithCategory } from "@/lib/types/database";

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
  const [estimate, setEstimate] = useState<number | null>(null);

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

    const parsedShares = Number(shareCount);
    if (!Number.isInteger(parsedShares) || parsedShares <= 0) {
      setEstimate(null);
      return;
    }

    const timer = setTimeout(async () => {
      const response = await estimateSharesAmountAction(
        instrumentSymbol,
        parsedShares,
      );
      if ("data" in response) {
        setEstimate(response.data.amount);
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

  const title = isEdit ? item.name : "Add investment item";

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

        {isEdit && item.recurringTemplateId ? (
          <div className="flex items-center gap-3 rounded border-2 border-border p-3">
            <CategoryIcon icon={item.icon} />
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                Linked to a recurring item
              </p>
            </div>
          </div>
        ) : null}

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
            <FormLabel htmlFor="recurringTemplateId">
              Recurring item
            </FormLabel>
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

        {(!isEdit && sourceType === "custom") || (isEdit && !item.recurringTemplateId) ? (
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
            Already invested (before tracking)
          </FormLabel>
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
        <input type="hidden" name="instrumentName" value={instrumentName} />

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="shareCount">
            Shares held (optional, for live market value)
          </FormLabel>
          <Input
            id="shareCount"
            name="shareCount"
            type="number"
            step="1"
            min="1"
            className="text-base"
            value={shareCount}
            onChange={(event) => setShareCount(event.target.value)}
            placeholder="Total shares you currently hold"
          />
        </div>

        {estimate !== null && (
          <Text className="text-sm text-muted-foreground">
            Live market estimate:{" "}
            <span className="font-semibold text-foreground">
              ≈ {formatEuro(estimate)}
            </span>
          </Text>
        )}

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="currentValue">
            Current value override (optional)
          </FormLabel>
          <Input
            id="currentValue"
            name="currentValue"
            type="number"
            step="0.01"
            min="0"
            className="text-base"
            defaultValue={item?.currentValue ?? ""}
            placeholder="From your broker if different from live quote"
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
