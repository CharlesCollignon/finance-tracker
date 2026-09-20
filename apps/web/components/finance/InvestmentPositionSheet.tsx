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
import { InstrumentLogo } from "@/components/finance/InstrumentLogo";
import {
  removeInvestmentPosition,
  saveInvestmentPosition,
} from "@/lib/actions/investments";
import { estimateSharesAmountAction } from "@/lib/actions/market";
import { useFormatCurrency } from "@/lib/use-currency";
import { formatMoney } from "@finance/core/market/fx";
import {
  BITCOIN_INSTRUMENT,
  isCryptoWallet,
} from "@finance/core/crypto-holdings";
import { parseShareCountInput } from "@finance/core/share-count";
import { chargeLookupUrl, chargeToInput } from "@finance/core/fund-costs";
import {
  displayNameForRecurringTemplate,
  type InvestmentPositionItem,
} from "@finance/core/investment-positions";
import type { InvestmentWalletId } from "@finance/core/investments";
import type { RecurringTemplateWithCategory } from "@finance/core/types/database";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";
import type { Key } from "@finance/core/i18n/t";

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
  const t = useT();
  const isEdit = item !== null;
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const locale = useLocale();
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
  /**
   * The ISIN behind the symbol.
   *
   * The search has always returned it and always dropped it here, which left
   * positions identified only by one vendor's ticker — enough to price them,
   * not enough to look up what they hold. The look-through joins a reading to
   * a position on this and nothing else.
   */
  const [isin, setIsin] = useState(item?.isin ?? "");
  /**
   * Whether the broker figure should outrank the market.
   *
   * Separate from the figure itself, because the two are separate decisions —
   * see migration `034`. Unpinned is the default, so a value typed once stops
   * quietly winning forever.
   */
  const [valuePinned, setValuePinned] = useState(item?.valuePinned ?? false);
  const [brokerValue, setBrokerValue] = useState(
    item?.currentValue === null || item?.currentValue === undefined
      ? ""
      : String(item.currentValue),
  );
  const [shareCount, setShareCount] = useState(
    item?.shareCount ? String(item.shareCount) : "",
  );
  const [ongoingCharge, setOngoingCharge] = useState(
    chargeToInput(item?.ongoingCharge ?? null),
  );
  const [estimate, setEstimate] = useState<{
    amount: number;
    priceEur: number;
    priceOriginal: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    if (state.success) {
      toast(
        isEdit
          ? t("position.itemUpdated", { name: item?.name ?? "" })
          : t("position.itemAdded"),
        "success",
      );
      onOpenChange(false);
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state.success, state.error, isEdit, item?.name, onOpenChange, toast, t]);

  const parsedShares = shareCount ? parseShareCountInput(shareCount) : null;
  const estimateActive = Boolean(instrumentSymbol) && parsedShares !== null;

  useEffect(() => {
    if (!estimateActive || parsedShares === null) {
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
  }, [estimateActive, instrumentSymbol, parsedShares]);

  const estimateShown = estimateActive ? estimate : null;

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
  const title = isEdit
    ? item.name
    : isCrypto
      ? t("position.addCryptoItem")
      : t("position.addItem");
  const isRecurringLinked = isEdit && Boolean(item.recurringTemplateId);
  const instrumentFromRecurring =
    isRecurringLinked && Boolean(item.instrumentSymbol || isCrypto);

  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} title={title}>
      <form action={action} className="flex flex-col gap-4">
        {isEdit && <input type="hidden" name="positionId" value={item.id} />}
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
            <FormLabel>{t("position.itemType")}</FormLabel>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={sourceType === "recurring" ? "default" : "outline"}
                onClick={() => setSourceType("recurring")}
              >
                {t("position.fromRecurring")}
              </Button>
              <Button
                type="button"
                variant={sourceType === "custom" ? "default" : "outline"}
                onClick={() => setSourceType("custom")}
              >
                {t("position.customHolding")}
              </Button>
            </div>
          </div>
        )}

        {!isEdit && sourceType === "recurring" && (
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="recurringTemplateId">
              {t("position.recurringItem")}
            </FormLabel>
            {recurringOptions.length > 0 ? (
              <select
                id="recurringTemplateId"
                name="recurringTemplateId"
                required
                className="h-10 min-h-11 lg:min-h-0 w-full rounded-control border border-border bg-input px-3 text-base"
                value={recurringTemplateId}
                onChange={(event) => setRecurringTemplateId(event.target.value)}
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
                {t("position.noRecurringAvailable")}
              </Text>
            )}
          </div>
        )}

        {isRecurringLinked ? (
          <div className="flex items-center gap-3 rounded-card p-row border border-border">
            <InstrumentLogo
              symbol={item.instrumentSymbol}
              name={item.name}
              fallbackIcon={item.icon}
            />
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {isCrypto ? t("position.dcaBitcoin") : t("position.dcaEtf")}
              </p>
            </div>
          </div>
        ) : null}

        {(!isEdit && sourceType === "custom") ||
        (isEdit && !item.recurringTemplateId) ? (
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="name">{t("position.nameLabel")}</FormLabel>
            <Input
              id="name"
              name="name"
              required={!isEdit}
              className="text-base"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("position.namePlaceholder")}
            />
          </div>
        ) : (
          <input type="hidden" name="name" value={name} />
        )}

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="initialBalance">
            {t("position.costBasis")}
          </FormLabel>
          <Text className="text-xs text-muted-foreground">
            {t("position.costBasisHint")}
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
          <div className="rounded-card p-row border border-border bg-muted/20 text-sm">
            <p className="font-medium">
              {isCrypto ? t("position.trackedAsset") : t("position.trackedEtf")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {isCrypto
                ? BITCOIN_INSTRUMENT.name
                : (item.instrumentName ?? item.instrumentSymbol)}
            </p>
            {!isCrypto && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("position.changeFundPrefix")}{" "}
                <Link href="/recurring" className="font-medium underline">
                  {t("position.changeFundLink")}
                </Link>
                {/* The suffix carries its own leading space when it needs
                    one: English continues with " page.", French has already
                    said "page" before the link and only needs the stop. */}
                {t("position.changeFundSuffix")}
              </p>
            )}
            <input
              type="hidden"
              name="instrumentSymbol"
              value={isCrypto ? BITCOIN_INSTRUMENT.symbol : instrumentSymbol}
            />
            <input
              type="hidden"
              name="instrumentName"
              value={isCrypto ? BITCOIN_INSTRUMENT.name : instrumentName}
            />
          </div>
        ) : isRecurringLinked && !isCrypto ? (
          <Text className="text-sm text-muted-foreground">
            {t("position.linkEtfPrefix")}{" "}
            <Link href="/recurring" className="font-medium underline">
              {t("position.linkEtfLink", { name: item.name })}
            </Link>
            {t("position.linkEtfSuffix")}
          </Text>
        ) : isCrypto ? (
          <>
            <div className="rounded-card p-row border border-border bg-muted/20 text-sm">
              <p className="font-medium">{t("position.bitcoin")}</p>
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
                // Kept when the search did not return one rather than
                // cleared: a symbol changing does not make a known ISIN
                // wrong, and an ISIN search is how most of these are found.
                setIsin(instrument.isin ?? isin);
              }}
              onClear={() => {
                setInstrumentSymbol("");
                setInstrumentName("");
                setIsin("");
              }}
            />
            <input
              type="hidden"
              name="instrumentSymbol"
              value={instrumentSymbol}
            />
            <input type="hidden" name="instrumentName" value={instrumentName} />
          </>
        )}

        {/* Outside the branches above, so it survives every shape the form
            takes — including the recurring-linked one, where the instrument
            fields are rendered read-only further up.

            Typed, not hidden. The instrument search fills it only when the
            query was itself an ISIN, because Yahoo's search returns a symbol
            and a name and never an identifier — so for everything found by
            name this field is the only way one is ever set, and the
            look-through is blind without it. Bitcoin has no ISIN to give, so
            the crypto shape keeps the hidden input and says nothing. */}
        {isCrypto ? (
          <input type="hidden" name="isin" value={isin} />
        ) : (
          <div className="flex flex-col gap-2">
            <FormLabel htmlFor="isin">{t("position.isinLabel")}</FormLabel>
            <Input
              id="isin"
              name="isin"
              type="text"
              className="text-base font-mono"
              value={isin}
              onChange={(event) => setIsin(event.target.value.toUpperCase())}
              placeholder="IE00B4L5Y983"
              maxLength={12}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <Text className="text-xs text-muted-foreground">
              {t("position.isinHint")}
            </Text>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="shareCount">
            {isCrypto
              ? t("position.totalBtcHeld")
              : instrumentSymbol
                ? t("position.totalSharesHeld")
                : t("position.sharesHeldOptional")}
          </FormLabel>
          {(instrumentSymbol || isCrypto) && (
            <Text className="text-xs text-muted-foreground">
              {isCrypto ? t("position.btcHint") : t("position.sharesHint")}
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

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="ongoingCharge">
            {t("position.ongoingChargeLabel")}
          </FormLabel>
          <Text className="text-xs text-muted-foreground">
            {t("position.ongoingChargeHint")}
          </Text>
          <div className="flex items-center gap-2">
            <Input
              id="ongoingCharge"
              name="ongoingCharge"
              type="text"
              inputMode="decimal"
              className="text-base"
              value={ongoingCharge}
              onChange={(event) => setOngoingCharge(event.target.value)}
              placeholder={t("position.chargePlaceholder")}
            />
            <span className="text-sm text-muted-foreground">
              {t("position.perYear")}
            </span>
          </div>
          {chargeLookupUrl(instrumentSymbol, instrumentName) ? (
            <a
              href={chargeLookupUrl(instrumentSymbol, instrumentName)!}
              target="_blank"
              rel="noreferrer noopener"
              className="self-start text-xs text-primary-ink underline underline-offset-4"
            >
              {t("position.lookUpCharge")}
            </a>
          ) : null}
        </div>

        {estimateShown !== null && (
          <Text className="text-sm text-muted-foreground">
            Live market estimate:{" "}
            <span className="font-mono font-semibold text-foreground">
              ≈ {formatEuro(estimateShown.amount)}
            </span>
            {isCrypto ? (
              <span className="block font-mono text-xs">
                @ {formatEuro(estimateShown.priceEur)} / BTC
              </span>
            ) : (
              estimateShown.currency !== "EUR" && (
                <span className="block font-mono text-xs">
                  {formatMoney(
                    estimateShown.priceOriginal,
                    estimateShown.currency,
                    locale,
                  )}{" "}
                  / share → {formatEuro(estimateShown.priceEur)} / share
                </span>
              )
            )}
          </Text>
        )}

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="currentValue">
            {t("position.brokerValue")}
          </FormLabel>
          <Text className="text-xs text-muted-foreground">
            {t("position.brokerValueHint")}
          </Text>
          <Input
            id="currentValue"
            name="currentValue"
            type="number"
            step="0.01"
            min="0"
            className="text-base"
            value={brokerValue}
            onChange={(event) => setBrokerValue(event.target.value)}
            placeholder={t("position.manualValuePlaceholder")}
          />

          {/* Pinning nothing is meaningless, so the control only exists once
              there is a figure to pin. */}
          {brokerValue.trim() !== "" && Number(brokerValue) > 0 ? (
            <label className="mt-1 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                name="valuePinned"
                checked={valuePinned}
                onChange={(event) => setValuePinned(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm">{t("position.pinValue")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("position.pinValueHint")}
                </span>
              </span>
            </label>
          ) : null}

          {/* Where the figure on the dashboard will actually come from. */}
          {item ? (
            <Text className="text-xs text-muted-foreground">
              {t(valuationNote(brokerValue, valuePinned, item.hasMarketQuote))}
            </Text>
          ) : null}
        </div>

        {state.error && (
          <Text className="text-sm text-destructive">
            {resolveMessage(t, state.error)}
          </Text>
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
          {pending
            ? t("position.saving")
            : isEdit
              ? t("position.saveItem")
              : t("position.addItem")}
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
            <Trash size={ICON.md} weight="light" />
            {deletePending
              ? t("position.removing")
              : t("position.removeFromPortfolio")}
          </Button>
        )}
      </form>
    </MobileSheet>
  );
}

/**
 * Which of the four valuations this position will get, in words.
 *
 * Mirrors the precedence in `buildPositionItem` so the sheet can say where
 * the number comes from while it is being edited, rather than the reader
 * discovering it on the dashboard afterwards. Computed from the form's
 * current state, not from the saved item, so it updates as you type.
 */
function valuationNote(
  brokerValue: string,
  pinned: boolean,
  hasMarketQuote: boolean,
): Key {
  const hasFigure = brokerValue.trim() !== "" && Number(brokerValue) > 0;

  if (hasFigure && pinned) {
    return "position.valuedPinned";
  }
  if (hasMarketQuote) {
    return "position.valuedLive";
  }
  if (hasFigure) {
    return "position.valuedManual";
  }
  return "position.valuedCost";
}
