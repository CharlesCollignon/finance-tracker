"use client";

import { useRef, useState, useTransition } from "react";
import { Trash, UploadSimple } from "@phosphor-icons/react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { formatSigned } from "@finance/core/amount-sign";
import { formatShortDate, todayIsoLocal } from "@finance/core/constants";
import { resolveMessage, type Key } from "@finance/core/i18n/t";
import {
  EVENT_KINDS,
  readBrokerRows,
  type BrokerReading,
  type EventKind,
  type InvestmentEvent,
} from "@finance/core/investment-events";
import type { InvestmentWalletId } from "@finance/core/investments";
import { tableRows } from "@finance/core/statement";
import { accountShortName } from "@/components/finance/accounts/account-format";
import { useToast } from "@/components/layout/ToastProvider";
import { Button } from "@/components/ui/Button";
import { FormLabel } from "@/components/ui/FormLabel";
import { Input } from "@/components/ui/Input";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { ChoiceChips } from "@/components/ui/Picker";
import {
  addInvestmentEvent,
  deleteInvestmentEvent,
  importInvestmentEvents,
} from "@/lib/actions/investment-events";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** The same ceiling as a statement: a broker's year is a few hundred lines. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const EVENT_KIND_KEYS: Record<EventKind, Key> = {
  buy: "events.kindBuy",
  sell: "events.kindSell",
  dividend: "events.kindDividend",
  fee: "events.kindFee",
};

const AMOUNT_HINT_KEYS: Record<EventKind, Key> = {
  buy: "events.amountBuy",
  sell: "events.amountSell",
  dividend: "events.amountDividend",
  fee: "events.amountFee",
};

/** Money in for a sale or a dividend, out for a buy or a fee. */
function signedAmount(event: Pick<InvestmentEvent, "kind" | "amount">): number {
  return event.kind === "sell" || event.kind === "dividend"
    ? event.amount
    : -event.amount;
}

interface Draft {
  kind: EventKind;
  occurredOn: string;
  instrumentName: string;
  isin: string;
  quantity: string;
  amount: string;
  note: string;
}

function emptyDraft(): Draft {
  return {
    kind: "buy",
    occurredOn: todayIsoLocal(),
    instrumentName: "",
    isin: "",
    quantity: "",
    amount: "",
    note: "",
  };
}

interface WalletEventsSheetProps {
  wallet: InvestmentWalletId;
  /** This wallet's events, newest first. */
  events: InvestmentEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * « Opérations »: what happened inside one wallet (migration 080) — the
 * list, one typed by hand, and the broker's export read in the browser
 * (`tableRows` + `readBrokerRows`) and shown before anything is stored.
 * A line already read is known by its fingerprint and never added twice.
 * The phone draws the same sheet.
 */
export function WalletEventsSheet({
  wallet,
  events,
  open,
  onOpenChange,
}: WalletEventsSheetProps) {
  const t = useT();
  const locale = useLocale();
  const formatEuro = useFormatCurrency();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reading, setReading] = useState<BrokerReading | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const kindOptions = EVENT_KINDS.map((kind) => ({
    value: kind,
    label: t(EVENT_KIND_KEYS[kind]),
  }));

  function save(current: Draft) {
    startTransition(async () => {
      const amount = parseTypedAmount(current.amount);
      const quantity = current.quantity.trim()
        ? parseTypedAmount(current.quantity)
        : null;
      const result = await addInvestmentEvent({
        wallet,
        kind: current.kind,
        occurredOn: current.occurredOn,
        instrumentName: current.instrumentName,
        isin: current.isin,
        quantity: quantity ?? undefined,
        amount: amount ?? Number.NaN,
        note: current.note,
      });
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(t("events.added"), "success");
      setDraft(null);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteInvestmentEvent(id);
      setConfirmId(null);
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      toast(t("events.deleted"), "success");
    });
  }

  async function readFile(file: File) {
    setProblem(null);
    setReading(null);
    if (file.size > MAX_FILE_BYTES) {
      setProblem(t("statements.tooBig"));
      return;
    }
    setBusy(true);
    try {
      const rows = tableRows(new Uint8Array(await file.arrayBuffer()));
      if (!rows) {
        setProblem(t("events.importNoTable"));
        return;
      }
      const read = readBrokerRows(rows, wallet);
      if (read.problem === "empty") {
        setProblem(t("events.importEmpty"));
        return;
      }
      if (read.problem === "columns") {
        setProblem(t("events.importNoColumns"));
        return;
      }
      setReading(read);
    } finally {
      setBusy(false);
    }
  }

  function confirmImport(current: BrokerReading) {
    startTransition(async () => {
      const result = await importInvestmentEvents(current.events);
      if (!result.success) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      const known =
        result.known > 0
          ? ` · ${t("events.importedKnown", { count: result.known })}`
          : "";
      toast(
        result.added === 0
          ? t("events.importNone") + known
          : t("events.imported", { count: result.added }) + known,
        "success",
      );
      setReading(null);
    });
  }

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${t("events.open")} · ${accountShortName(wallet, locale)}`}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">{t("events.intro")}</p>

        {/* The broker's file. */}
        <section className="flex flex-col gap-2 rounded-card border border-border p-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.xlsx,.ods,.html,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                void readFile(file);
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || pending}
              onClick={() => fileRef.current?.click()}
            >
              <UploadSimple size={ICON.md} weight="light" className="mr-1" />
              {busy ? t("events.importing") : t("events.importFile")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("events.importHint")}
          </p>
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
          {reading ? (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-sm">
                {t("events.importRead", { count: reading.events.length })}
                {reading.skipped > 0
                  ? ` · ${t("events.importSkipped", { count: reading.skipped })}`
                  : ""}
              </p>
              <ul className="max-h-48 overflow-y-auto text-xs text-muted-foreground">
                {reading.events.slice(0, 50).map((event) => (
                  <li
                    key={event.fingerprint}
                    className="flex items-baseline justify-between gap-3 py-0.5"
                  >
                    <span className="min-w-0 truncate">
                      {formatShortDate(event.occurredOn, locale)} ·{" "}
                      {t(EVENT_KIND_KEYS[event.kind])}
                      {event.instrumentName ? ` · ${event.instrumentName}` : ""}
                    </span>
                    <span className="shrink-0 font-sans tabular-nums">
                      {formatSigned(signedAmount(event), formatEuro)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {t("events.importSynthetic")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={pending || reading.events.length === 0}
                  onClick={() => confirmImport(reading)}
                >
                  {pending ? t("events.adding") : t("events.importConfirm")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setReading(null)}
                >
                  {t("events.close")}
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        {/* One typed by hand. */}
        {draft ? (
          <form
            className="flex flex-col gap-3 rounded-card border border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              save(draft);
            }}
          >
            <h3 className="text-sm font-medium">{t("events.new")}</h3>
            <div className="flex flex-col gap-1">
              <FormLabel id="event-kind">{t("events.kind")}</FormLabel>
              <ChoiceChips
                options={kindOptions}
                value={draft.kind}
                onValueChange={(kind) => setDraft({ ...draft, kind })}
                labelledBy="event-kind"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <FormLabel htmlFor="event-date">{t("events.date")}</FormLabel>
                <Input
                  id="event-date"
                  type="date"
                  required
                  value={draft.occurredOn}
                  onChange={(event) =>
                    setDraft({ ...draft, occurredOn: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <FormLabel htmlFor="event-amount">
                  {t("events.amount")}
                </FormLabel>
                <Input
                  id="event-amount"
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  value={draft.amount}
                  onChange={(event) =>
                    setDraft({ ...draft, amount: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t(AMOUNT_HINT_KEYS[draft.kind])}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <FormLabel htmlFor="event-instrument">
                {t("events.instrument")}
              </FormLabel>
              <Input
                id="event-instrument"
                maxLength={200}
                placeholder={t("events.instrumentPlaceholder")}
                value={draft.instrumentName}
                onChange={(event) =>
                  setDraft({ ...draft, instrumentName: event.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <FormLabel htmlFor="event-isin">{t("events.isin")}</FormLabel>
                <Input
                  id="event-isin"
                  maxLength={12}
                  autoCapitalize="characters"
                  value={draft.isin}
                  onChange={(event) =>
                    setDraft({ ...draft, isin: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("events.isinHint")}
                </p>
              </div>
              {draft.kind === "buy" || draft.kind === "sell" ? (
                <div className="flex flex-col gap-1">
                  <FormLabel htmlFor="event-quantity">
                    {t("events.quantity")}
                  </FormLabel>
                  <Input
                    id="event-quantity"
                    inputMode="decimal"
                    value={draft.quantity}
                    onChange={(event) =>
                      setDraft({ ...draft, quantity: event.target.value })
                    }
                  />
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <FormLabel htmlFor="event-note">{t("events.note")}</FormLabel>
              <Input
                id="event-note"
                maxLength={500}
                value={draft.note}
                onChange={(event) =>
                  setDraft({ ...draft, note: event.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? t("events.adding") : t("events.add")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setDraft(null)}
              >
                {t("events.close")}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDraft(emptyDraft())}
            >
              {t("events.new")}
            </Button>
          </div>
        )}

        {/* The list. */}
        {events.length === 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{t("events.empty")}</p>
            <p className="text-sm text-muted-foreground">
              {t("events.emptyBody")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">
                    {t(EVENT_KIND_KEYS[event.kind])}
                    {event.instrumentName ? ` · ${event.instrumentName}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatShortDate(event.occurredOn, locale)}{" "}
                    {event.occurredOn.slice(0, 4)}
                    {event.quantity ? ` · ${event.quantity}` : ""}
                    {event.source === "file"
                      ? ` · ${t("events.fromFile")}`
                      : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "font-sans tabular-nums text-sm",
                      signedAmount(event) > 0
                        ? "text-success"
                        : "text-foreground",
                    )}
                  >
                    {formatSigned(signedAmount(event), formatEuro)}
                  </span>
                  {confirmId === event.id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => remove(event.id)}
                    >
                      {t("events.delete")}
                    </Button>
                  ) : (
                    <button
                      type="button"
                      aria-label={t("events.deleteNamed", {
                        date: formatShortDate(event.occurredOn, locale),
                      })}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground lg:h-9 lg:w-9"
                      onClick={() => setConfirmId(event.id)}
                    >
                      <Trash size={ICON.md} weight="light" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileSheet>
  );
}
