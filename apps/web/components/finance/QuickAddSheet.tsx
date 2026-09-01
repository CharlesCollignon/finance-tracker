"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Plus } from "@phosphor-icons/react";
import {
  amountInputToNumber,
  formatAmountInput,
  isAmountInputComplete,
  sanitizeAmountInput,
} from "@finance/core/amount-input";
import {
  formatCategoryOptionLabel,
  groupCategoriesByType,
} from "@finance/core/categories";
import { todayIsoLocal } from "@finance/core/constants";
import {
  lookupMerchant,
  suggestMerchants,
  type MerchantRule,
} from "@finance/core/merchant-memory";
import type { Category, Tag } from "@finance/core/types/database";
import { Button } from "@/components/retroui/Button";
import { CategoryIcon } from "@/components/finance/CategoryIcon";
import { MobileSheet } from "@/components/layout/MobileSheet";
import { useToast } from "@/components/layout/ToastProvider";
import { saveQuickTransaction } from "@/lib/actions/finance";
import { useCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", USD: "$" };

/** Once the list is longer than this, searching beats scrolling. */
const SEARCH_THRESHOLD = 8;

function shiftDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year!, month! - 1, day! + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  tags: Tag[];
  recentCategoryIds: string[];
  merchants: MerchantRule[];
  /** Prefills the date — the calendar opens the sheet on the day being viewed. */
  defaultDate?: string;
}

/**
 * Amount-first transaction entry, reachable from anywhere in the app.
 *
 * The order is deliberate and is the whole point of the sheet: the user always
 * knows the amount — it is on the receipt in their hand — and often has to
 * think about the category. Asking for the number first lets them commit it
 * before it leaves working memory, which is why every fast expense logger is
 * built this way.
 */
export function QuickAddSheet(props: QuickAddSheetProps) {
  // Not rendered while closed, and keyed by the date it opens on, so every
  // open starts from clean state. Resetting inside an effect instead would
  // cascade a second render on every open.
  if (!props.open) {
    return null;
  }

  return <QuickAddFields key={props.defaultDate ?? "today"} {...props} />;
}

function QuickAddFields({
  open,
  onOpenChange,
  categories,
  tags,
  recentCategoryIds,
  merchants,
  defaultDate,
}: QuickAddSheetProps) {
  const { toast } = useToast();
  const currency = useCurrency();
  const symbol = CURRENCY_SYMBOL[currency] ?? "€";

  const today = todayIsoLocal();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [occurredOn, setOccurredOn] = useState(defaultDate ?? today);
  const [note, setNote] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);

  // The keypad should be up before the user has finished reaching for it.
  useEffect(() => {
    const timer = setTimeout(() => amountRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const merchantIndex = useMemo(
    () => new Map(merchants.map((rule) => [rule.key, rule])),
    [merchants],
  );

  const recentCategories = useMemo(
    () =>
      recentCategoryIds
        .map((id) => categories.find((cat) => cat.id === id))
        .filter((cat): cat is Category => cat !== undefined),
    [recentCategoryIds, categories],
  );

  const visibleCategories = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return categories;
    }
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(trimmed),
    );
  }, [categories, query]);

  const groups = useMemo(
    () => groupCategoriesByType(visibleCategories),
    [visibleCategories],
  );

  const selected = categories.find((cat) => cat.id === categoryId) ?? null;

  const noteSuggestions = useMemo(() => {
    if (!noteFocused || note.trim().length < 2) {
      return [];
    }
    return suggestMerchants(merchantIndex, note, 3);
  }, [merchantIndex, note, noteFocused]);

  const display = formatAmountInput(amount, "fr-FR");
  const canSave = isAmountInputComplete(amount) && categoryId !== "";

  /** Applies everything a remembered merchant knows, without overwriting
   * anything the user has already decided in this entry. */
  function applyMerchant(rule: MerchantRule) {
    setNote(rule.label);
    if (categoryId === "") {
      setCategoryId(rule.categoryId);
    }
    if (!isAmountInputComplete(amount)) {
      setAmount(sanitizeAmountInput(String(rule.lastAmount)));
    }
    setNoteFocused(false);
  }

  /** On leaving the note, fill in a category we already know for it. */
  function handleNoteBlur() {
    // Deferred so a click on a suggestion lands before the list unmounts.
    setTimeout(() => setNoteFocused(false), 120);

    if (categoryId !== "") {
      return;
    }
    const known = lookupMerchant(merchantIndex, note);
    if (known) {
      setCategoryId(known.categoryId);
    }
  }

  async function save(andAnother: boolean) {
    if (!canSave || pending) {
      return;
    }

    setPending(true);
    setError(null);

    const result = await saveQuickTransaction({
      categoryId,
      amount: amountInputToNumber(amount),
      occurredOn,
      note: note.trim() || undefined,
      tagIds,
    });

    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (!andAnother) {
      toast("Transaction saved", "success");
      onOpenChange(false);
      return;
    }

    // Keep the date and the category — a catch-up session is usually several
    // entries from the same day, often the same shop.
    setSavedCount((count) => count + 1);
    setAmount("");
    setNote("");
    setTagIds([]);
    amountRef.current?.focus();
  }

  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} title="Add transaction">
      <div className="flex flex-col gap-5">
        {/* ---- amount ------------------------------------------------- */}
        <div className="relative flex items-center justify-center py-2">
          <label htmlFor="quick-amount" className="sr-only">
            Amount
          </label>
          <input
            id="quick-amount"
            ref={amountRef}
            // A real input keeps the numeric keyboard on mobile and the caret
            // behaviour on desktop; the styled figure below is what is seen.
            className="absolute inset-0 h-full w-full cursor-text opacity-0"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) =>
              setAmount(sanitizeAmountInput(event.target.value))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSave) {
                event.preventDefault();
                void save(event.metaKey || event.ctrlKey);
              }
            }}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none flex items-baseline gap-1 font-mono tabular-nums",
              display.empty ? "text-muted-foreground/40" : "text-foreground",
            )}
          >
            <span className="text-2xl">{symbol}</span>
            <span className="text-5xl font-semibold tracking-tight">
              {display.integer}
            </span>
            <span className="text-2xl">{display.fraction}</span>
          </div>
        </div>

        {/* ---- date --------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Today", value: today },
            { label: "Yesterday", value: shiftDays(today, -1) },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setOccurredOn(option.value)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm transition-colors",
                occurredOn === option.value
                  ? "border-primary bg-primary/10 text-primary-ink"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
          <input
            type="date"
            aria-label="Date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
            className="min-h-9 rounded-full border border-border bg-background px-3 text-sm"
          />
        </div>

        {/* ---- category ----------------------------------------------- */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Category</span>

          {recentCategories.length > 0 && !query.trim() ? (
            <div className="flex flex-wrap gap-2">
              {recentCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={categoryId === cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm",
                    "transition-colors",
                    categoryId === cat.id
                      ? "border-primary bg-primary/10 text-primary-ink"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <CategoryIcon icon={cat.icon} className="h-4 w-4" />
                  {cat.name}
                </button>
              ))}
            </div>
          ) : null}

          {categories.length > SEARCH_THRESHOLD ? (
            <input
              type="search"
              aria-label="Search categories"
              placeholder="Search categories…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowAllCategories(true);
              }}
              className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-base"
            />
          ) : null}

          {selected && !showAllCategories && !query.trim() ? (
            <button
              type="button"
              onClick={() => setShowAllCategories(true)}
              className="self-start text-sm text-muted-foreground underline underline-offset-4"
            >
              {formatCategoryOptionLabel(selected)} — change
            </button>
          ) : null}

          {showAllCategories ||
          query.trim() ||
          recentCategories.length === 0 ? (
            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              {groups.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  No category matches “{query.trim()}”.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.type}>
                    <p className="bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                      {group.label}
                    </p>
                    {group.categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={categoryId === cat.id}
                        onClick={() => {
                          setCategoryId(cat.id);
                          setShowAllCategories(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm",
                          categoryId === cat.id
                            ? "bg-primary/10 text-primary-ink"
                            : "hover:bg-muted",
                        )}
                      >
                        <CategoryIcon icon={cat.icon} className="h-4 w-4" />
                        {cat.name}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          ) : null}

          {!selected && !showAllCategories && recentCategories.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllCategories(true)}
              className="self-start text-sm text-muted-foreground underline underline-offset-4"
            >
              All categories
            </button>
          ) : null}
        </div>

        {/* ---- note --------------------------------------------------- */}
        <div className="relative flex flex-col gap-2">
          <label htmlFor="quick-note" className="text-sm font-medium">
            Note
          </label>
          <input
            id="quick-note"
            type="text"
            autoComplete="off"
            placeholder="Where did it go?"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onFocus={() => setNoteFocused(true)}
            onBlur={handleNoteBlur}
            className="min-h-10 w-full rounded-md border border-border bg-background px-3 text-base"
          />
          {noteSuggestions.length > 0 ? (
            <ul className="absolute inset-x-0 top-full z-10 overflow-hidden rounded-md border border-border bg-background shadow-lg">
              {noteSuggestions.map((rule) => (
                <li key={rule.key}>
                  <button
                    type="button"
                    // onMouseDown fires before the input's blur, so the click
                    // is not lost to the list unmounting.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyMerchant(rule);
                    }}
                    className="flex min-h-10 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-muted"
                  >
                    <span className="truncate">{rule.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {rule.categoryName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* ---- tags --------------------------------------------------- */}
        {tags.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Tags</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const on = tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setTagIds((current) =>
                        current.includes(tag.id)
                          ? current.filter((id) => id !== tag.id)
                          : [...current, tag.id],
                      )
                    }
                    className={cn(
                      "min-h-9 rounded-full border px-3 text-sm transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-primary-ink"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {savedCount > 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle size={16} weight="fill" />
            {savedCount === 1
              ? "1 saved — keep going."
              : `${savedCount} saved — keep going.`}
          </p>
        ) : null}

        {/* ---- actions ------------------------------------------------ */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="lg"
            className="flex-1"
            disabled={!canSave || pending}
            onClick={() => void save(false)}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1 gap-2"
            disabled={!canSave || pending}
            onClick={() => void save(true)}
          >
            <Plus size={16} />
            Save &amp; add another
          </Button>
        </div>
      </div>
    </MobileSheet>
  );
}
