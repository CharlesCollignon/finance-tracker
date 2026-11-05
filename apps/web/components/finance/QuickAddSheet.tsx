"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CalendarBlank,
  CheckCircle,
  Plus,
  Repeat,
  Storefront,
  Tag,
  TextAa,
} from "@phosphor-icons/react";
import {
  amountInputToNumber,
  amountToInput,
  formatAmountInput,
  isAmountInputComplete,
  isAmountKey,
  parseTypedAmount,
  pressAmountKey,
  sanitizeAmountInput,
} from "@finance/core/amount-input";
import { amountSign } from "@finance/core/amount-sign";
import { scheduleDatesBefore } from "@finance/core/apply-recurring";
import {
  formatDayMonth,
  getCurrentMonth,
  relativeDayLabel,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  categoriesOfKind,
  entryGap,
  initialEntryKind,
  merchantsOfKind,
  offersAdvance,
  scheduleOfEntry,
  schedulePayload,
} from "@finance/core/entry-draft";
import { resolveMessage } from "@finance/core/i18n/t";
import {
  lookupMerchant,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import { formatRecurrenceSchedule } from "@finance/core/recurrence";
import type { Category, CategoryType } from "@finance/core/types/database";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { useToast } from "@/components/layout/ToastProvider";
import { AskLink } from "@/components/ask/AskLink";
import { upsertRecurringTemplate } from "@/lib/actions/finance";
import { saveWithOutbox } from "@/lib/offline-outbox";
import {
  enablePush,
  markPushOffered,
  shouldOfferPush,
} from "@/lib/push-client";
import { useCurrency, useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import {
  CategoryGrid,
  NotePanel,
  WhenPanel,
  type WhenState,
} from "./add/panels";
import { KIND_INK, KindSwitch, Tile } from "./add/parts";
import styles from "./add/add-sheet.module.css";

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", USD: "$" };

/** How long the button says « Enregistrée » before the sheet goes. */
const SAVED_BEAT_MS = 420;

/** The two ways in: something that happened, or something that repeats. */
export type AddKind = "transaction" | "charge";

type Panel = "category" | "note" | "when";

interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  recentCategoryIds: string[];
  merchants: MerchantRule[];
  /** Prefills the date — the calendar opens the sheet on the day being viewed. */
  defaultDate?: string;
  /** Prefills the amount — the palette's « Ajouter une opération de… ». */
  defaultAmount?: number;
  /** « charge » opens on « Régulièrement »: the Récurrents page's « + ». */
  kind: AddKind;
  /** The kind of money to open on — a column's « + » on Récurrents. */
  categoryType?: CategoryType;
}

/**
 * The one sheet behind every « + » and every Add button.
 *
 * Rebuilt in November 2026 around the order a person knows things in, as on
 * the phone: the kind of money first (Dépense · Revenu · Épargne ·
 * Placement), then the amount, set large in the money serif and in that
 * kind's colour, then three tiles — Catégorie, Commerce, Quand — and one
 * panel under them that answers whichever is open. The amount is typed: a
 * real input sits over the figure, so a phone browser raises its number pad
 * and a keyboard types straight in. A recurring entry is « Régulièrement »
 * under Quand and saves the template Récurrents edits.
 */
export function QuickAddSheet(props: QuickAddSheetProps) {
  // Not rendered while closed, and keyed by what it opens on, so every open
  // starts from clean state. Resetting inside an effect instead would
  // cascade a second render on every open.
  if (!props.open) {
    return null;
  }
  return (
    <AddSheet
      key={`${props.kind}:${props.categoryType ?? ""}:${props.defaultDate ?? "today"}`}
      {...props}
    />
  );
}

function freshWhen(recurring: boolean, occurredOn: string): WhenState {
  const [, month, day] = todayIsoLocal().split("-").map(Number);
  const weekday = new Date().getDay();
  return {
    recurring,
    occurredOn,
    rhythm: "monthly",
    // A recurring entry is usually set up on the day it lands.
    dayOfMonth: day!,
    dayOfWeek: weekday === 0 ? 7 : weekday,
    month: month!,
    amountVaries: false,
    withAdvance: false,
    advanceDay: 15,
    advanceAmount: "",
    startThisMonth: false,
    startsOn: "",
    endsOn: "",
  };
}

function AddSheet({
  open,
  onOpenChange,
  categories,
  recentCategoryIds,
  merchants,
  defaultDate,
  defaultAmount,
  kind: openedAs,
  categoryType,
}: QuickAddSheetProps) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const currency = useCurrency();
  const formatEuro = useFormatCurrency();
  const symbol = CURRENCY_SYMBOL[currency] ?? "€";
  const today = todayIsoLocal();
  const close = () => onOpenChange(false);

  const [kind, setKind] = useState<CategoryType>(() =>
    initialEntryKind(categoryType),
  );
  const [amount, setAmount] = useState(() =>
    defaultAmount !== undefined ? amountToInput(defaultAmount) : "",
  );
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<WhenState>(() =>
    freshWhen(openedAs === "charge", defaultDate ?? today),
  );
  const [panel, setPanel] = useState<Panel>("category");
  const [feedback, setFeedback] = useState<{
    kind: "nudge" | "refuse";
    n: number;
  }>({
    kind: "nudge",
    n: 0,
  });
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The amount is what a person knows first: the caret is there before
  // they have finished reaching for it.
  useEffect(() => {
    const timer = setTimeout(() => amountRef.current?.focus(), 50);
    return () => {
      clearTimeout(timer);
      if (closing.current) {
        clearTimeout(closing.current);
      }
    };
  }, []);

  const ink = KIND_INK[kind];
  const kindCategories = useMemo(
    () => categoriesOfKind(categories, kind, recentCategoryIds),
    [categories, kind, recentCategoryIds],
  );
  const kindMerchants = useMemo(
    () =>
      new Map(merchantsOfKind(merchants, kind).map((rule) => [rule.key, rule])),
    [merchants, kind],
  );

  // A shop already filed under this kind is enough without a category
  // picked: it says where it goes.
  const knownShop = lookupMerchant(kindMerchants, note);
  const resolvedCategoryId = categoryId || knownShop?.categoryId || "";
  const category =
    categories.find((candidate) => candidate.id === resolvedCategoryId) ?? null;
  const gap = entryGap({
    amountComplete: isAmountInputComplete(amount),
    hasCategory: resolvedCategoryId !== "",
  });

  const pastThisMonth = useMemo(() => {
    if (!when.recurring) {
      return [];
    }
    const { year, month } = getCurrentMonth();
    return scheduleDatesBefore(
      {
        ...scheduleOfEntry(when),
        starts_on: when.startsOn || null,
        ends_on: when.endsOn || null,
      },
      year,
      month,
      today,
    );
  }, [when, today]);

  const whenLabel = when.recurring
    ? formatRecurrenceSchedule(scheduleOfEntry(when), locale)
    : relativeDayLabel(when.occurredOn, formatDayMonth, locale);
  const display = formatAmountInput(amount, locale);
  const signedAmount = `${amountSign(kind)}${formatEuro(amountInputToNumber(amount))}`;
  const noteLabel = kind === "expense" ? t("entry.shop") : t("entry.label");
  const notePlaceholder =
    kind === "expense"
      ? t("quickAdd.notePlaceholder")
      : t(
          kind === "income"
            ? "entry.labelPlaceholder.income"
            : kind === "savings"
              ? "entry.labelPlaceholder.savings"
              : "entry.labelPlaceholder.investment",
        );

  function changeKind(next: CategoryType) {
    setKind(next);
    setError(null);
    if (category && category.type !== next) {
      setCategoryId("");
    }
  }

  function bump(kind: "nudge" | "refuse") {
    setFeedback((current) => ({ kind, n: current.n + 1 }));
  }

  /** Applies a typed key to the amount, wherever focus is in the sheet. */
  function typeKey(key: string): boolean {
    const normalised = key === "," ? "." : key;
    if (!isAmountKey(normalised)) {
      return false;
    }
    const next = pressAmountKey(amount, normalised);
    if (next === amount) {
      bump("refuse");
    } else {
      setAmount(next);
      bump("nudge");
    }
    return true;
  }

  function pickCategory(id: string) {
    setCategoryId(id);
    setError(null);
    if (!isAmountInputComplete(amount)) {
      amountRef.current?.focus();
    }
  }

  function pickMerchant(rule: MerchantRule) {
    setNote(rule.label);
    if (categoryId === "") {
      setCategoryId(rule.categoryId);
    }
    if (!isAmountInputComplete(amount)) {
      setAmount(sanitizeAmountInput(String(rule.lastAmount)));
    }
    setPanel("category");
    amountRef.current?.focus();
  }

  async function save(andAnother: boolean) {
    if (gap || pending || justSaved) {
      return;
    }
    setPending(true);
    setError(null);

    let failure: string | undefined;
    let queued = false;
    if (when.recurring) {
      const form = new FormData();
      const fields: Record<string, unknown> = {
        categoryId: resolvedCategoryId,
        description: note.trim(),
        active: "true",
        pricingType: "fixed",
        amount: amountInputToNumber(amount),
        amountVaries: String(when.amountVaries),
        ...schedulePayload(when),
        startsOn: when.startsOn,
        endsOn: when.endsOn,
      };
      for (const [name, value] of Object.entries(fields)) {
        if (name === "months") {
          form.set(name, Array.isArray(value) ? value.join(",") : "");
        } else if (value !== undefined && value !== null) {
          form.set(name, String(value));
        }
      }
      if (
        offersAdvance(kind, when.rhythm) &&
        when.withAdvance &&
        when.advanceAmount.trim()
      ) {
        form.set(
          "advanceAmount",
          String(parseTypedAmount(when.advanceAmount) ?? 0),
        );
        form.set("advanceDay", String(when.advanceDay));
        form.set("advanceDescription", t("recurring.advanceWord"));
      }
      // Only when the question was on screen.
      if (pastThisMonth.length > 0) {
        form.set("startThisMonth", String(when.startThisMonth));
      }
      const result = await upsertRecurringTemplate({}, form);
      failure = result.error;
    } else {
      const result = await saveWithOutbox({
        categoryId: resolvedCategoryId,
        amount: amountInputToNumber(amount),
        occurredOn: when.occurredOn,
        note: note.trim() || undefined,
      });
      failure = result.error;
      queued = Boolean(result.queued);
    }

    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setSavedCount((count) => count + 1);

    if (andAnother) {
      // Keep the kind, the category, the day and the schedule: a catch-up is
      // usually several entries from the same day, often the same shop.
      setAmount("");
      setNote("");
      amountRef.current?.focus();
      return;
    }

    setJustSaved(true);
    const message = when.recurring
      ? t("recurring.savedHint")
      : queued
        ? t("quickAdd.savedOffline")
        : t("quickAdd.saved");
    const offerPush = !when.recurring && !queued;
    closing.current = setTimeout(() => {
      void announce(message, offerPush);
      close();
    }, SAVED_BEAT_MS);
  }

  // The first save is when notifications are offered: in context, once, on
  // the toast that confirms it (`shouldOfferPush`).
  async function announce(message: string, offerPush: boolean) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
    if (offerPush && (await shouldOfferPush(publicKey))) {
      markPushOffered();
      toast({
        title: message,
        description: t("notifyAsk.question"),
        variant: "success",
        actionLabel: t("notifyAsk.enable"),
        onAction: () => {
          void enablePush(publicKey).then((outcome) => {
            toast(
              outcome.error
                ? resolveMessage(t, outcome.error)
                : t("profile.notificationsOn"),
              outcome.error ? "error" : "success",
            );
          });
        },
        duration: 12_000,
      });
      return;
    }
    toast(message, "success");
  }

  const sheetStyle = { "--kind": ink } as CSSProperties;

  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} title={t("add.title")}>
      <div
        style={sheetStyle}
        className="relative -m-4 flex flex-col md:-m-5"
        onKeyDown={(event) => {
          // Digits typed with focus on a tile or a chip still go to the
          // amount; a text field keeps its own keys.
          const target = event.target as HTMLElement;
          if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
            return;
          }
          if (event.key === "Enter" && !gap) {
            if (target.tagName !== "BUTTON") {
              event.preventDefault();
              void save(event.metaKey || event.ctrlKey);
            }
            return;
          }
          if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
          }
          if (
            event.key === "Backspace"
              ? typeKey("backspace")
              : typeKey(event.key)
          ) {
            event.preventDefault();
          }
        }}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-56",
            styles.glow,
          )}
        />

        <div className="relative flex flex-col gap-1 px-4 pt-4 md:px-5">
          <KindSwitch value={kind} onChange={changeKind} />
        </div>

        {/* ---- the figure, and the entry said back ----------------- */}
        <div className="relative px-4 pb-1 pt-5 text-center md:px-5">
          <div className="group relative mx-auto flex w-fit max-w-full items-center justify-center px-2 pb-2">
            <label htmlFor="quick-amount" className="sr-only">
              {t("quickAdd.amount")}
            </label>
            <input
              id="quick-amount"
              ref={amountRef}
              // A real input keeps the number pad on a phone and the caret on
              // a desktop; the figure under it is what is seen.
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save(event.metaKey || event.ctrlKey);
                  return;
                }
                const key = event.key === "," ? "." : event.key;
                if (
                  isAmountKey(key) &&
                  key !== "clear" &&
                  key !== "backspace"
                ) {
                  if (pressAmountKey(amount, key) === amount) {
                    event.preventDefault();
                    bump("refuse");
                  }
                }
              }}
              onChange={(event) => {
                const next = sanitizeAmountInput(event.target.value);
                if (next.length > amount.length) {
                  bump("nudge");
                }
                setAmount(next);
              }}
            />
            <div
              key={feedback.n}
              aria-hidden
              className={cn(
                "pointer-events-none flex items-baseline gap-0.5 whitespace-nowrap font-serif tabular-nums tracking-[-0.035em]",
                feedback.n > 0 && styles[feedback.kind],
              )}
              style={{
                color: display.empty
                  ? `color-mix(in srgb, ${ink} 45%, var(--muted-foreground))`
                  : ink,
              }}
            >
              <span className="mr-1 text-[2rem] font-medium">
                {amountSign(kind)}
              </span>
              <span className="text-[3.5rem] font-semibold leading-none md:text-[3.75rem]">
                {display.integer}
              </span>
              <span className="text-[1.75rem] font-semibold">
                {display.fraction}
              </span>
              <span className="ml-1.5 text-[1.75rem] font-medium">
                {symbol}
              </span>
            </div>
            {/* The focus indicator (SC 2.4.7): the input itself is
                invisible, so its focus is drawn under the figure it types
                into, in the kind's colour, while the caret is there. */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full opacity-0 transition-opacity duration-hover group-focus-within:opacity-100"
              style={{ background: ink }}
            />
          </div>
          <p
            aria-live="polite"
            className="mt-2.5 truncate text-[13px] text-muted-foreground"
          >
            {[category?.name, note.trim(), whenLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* ---- three tiles ---------------------------------------- */}
        <div className="relative flex gap-2 px-4 pt-3 md:px-5">
          <Tile
            icon={<Tag size={ICON.sm} />}
            label={t("entry.category")}
            value={category?.name ?? t("entry.choose")}
            empty={!category}
            needed={gap === "category"}
            active={panel === "category"}
            ink={ink}
            controls="add-panel"
            onClick={() => setPanel("category")}
          />
          <Tile
            icon={
              kind === "expense" ? (
                <Storefront size={ICON.sm} />
              ) : (
                <TextAa size={ICON.sm} />
              )
            }
            label={noteLabel}
            value={note.trim() || t("entry.optional")}
            empty={!note.trim()}
            active={panel === "note"}
            ink={ink}
            controls="add-panel"
            onClick={() => setPanel("note")}
          />
          <Tile
            icon={
              when.recurring ? (
                <Repeat size={ICON.sm} />
              ) : (
                <CalendarBlank size={ICON.sm} />
              )
            }
            label={t("entry.when")}
            value={whenLabel}
            active={panel === "when"}
            ink={ink}
            controls="add-panel"
            onClick={() => setPanel("when")}
          />
        </div>

        {/* ---- the panel that answers the open tile ---------------- */}
        <div
          id="add-panel"
          key={panel}
          className="fade-in mt-3 h-[19rem] overflow-y-auto border-t border-border px-4 py-3.5 md:h-[20rem] md:px-5"
        >
          {panel === "category" ? (
            <CategoryGrid
              kind={kind}
              categories={kindCategories}
              value={categoryId}
              ink={ink}
              onChange={pickCategory}
              onLeave={close}
            />
          ) : panel === "note" ? (
            <NotePanel
              value={note}
              onChange={setNote}
              merchants={kindMerchants}
              categories={categories}
              label={noteLabel}
              placeholder={notePlaceholder}
              onPick={pickMerchant}
              onSubmit={() => {
                if (knownShop && categoryId === "") {
                  setCategoryId(knownShop.categoryId);
                }
                setPanel("category");
              }}
            />
          ) : (
            <WhenPanel
              kind={kind}
              value={when}
              ink={ink}
              onChange={(patch) =>
                setWhen((current) => ({ ...current, ...patch }))
              }
              pastThisMonth={pastThisMonth}
            />
          )}
        </div>

        {error ? (
          <p
            role="alert"
            className="px-4 pt-2 text-sm text-destructive md:px-5"
          >
            {resolveMessage(t, error)}
          </p>
        ) : null}

        {/* ---- save, or save and keep going ------------------------ */}
        <div className="flex items-center gap-2 border-t border-border px-4 pb-4 pt-3 md:px-5 md:pb-5">
          <button
            type="button"
            aria-label={t("entry.saveAnother")}
            title={t("entry.saveAnother")}
            disabled={Boolean(gap) || pending || justSaved}
            onClick={() => void save(true)}
            className={cn(
              "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-hairline-strong",
              "transition-[background-color,opacity,transform] duration-press",
              "hover:bg-secondary active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent disabled:active:scale-100",
            )}
          >
            <Plus size={ICON.xl} />
          </button>
          <button
            type="button"
            disabled={Boolean(gap) || pending || justSaved}
            aria-busy={pending}
            onClick={() => void save(false)}
            className={cn(
              "flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-2xl px-3 text-[0.97rem] font-semibold",
              "transition-[background-color,color,transform] duration-press",
              justSaved
                ? "bg-primary text-primary-foreground"
                : gap || pending
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.98]",
            )}
          >
            <span
              key={justSaved ? "saved" : pending ? "pending" : (gap ?? "ready")}
              className="fade-in flex min-w-0 items-center gap-2 truncate"
            >
              {justSaved ? (
                <>
                  <CheckCircle size={ICON.xl} weight="fill" />
                  {t("entry.saved")}
                </>
              ) : pending ? (
                t("quickAdd.saving")
              ) : gap === "amount" ? (
                t("entry.gap.amount")
              ) : gap === "category" ? (
                t("entry.gap.category")
              ) : (
                <>
                  {t("quickAdd.save")}
                  <span className="font-serif tabular-nums tracking-[-0.02em]">
                    {signedAmount}
                  </span>
                </>
              )}
            </span>
          </button>
        </div>

        {savedCount > 0 && !justSaved ? (
          <p className="fade-in flex items-center justify-center gap-1.5 px-4 pb-3 text-xs font-medium text-success">
            <CheckCircle size={ICON.sm} weight="fill" />
            {t("entry.savedCount", { count: savedCount })}
          </p>
        ) : null}

        <div className="flex justify-center px-4 pb-3">
          {/* Cmd+K is the way to do something; asking is one of them. */}
          <AskLink onNavigate={close} />
        </div>
      </div>
    </MobileSheet>
  );
}
