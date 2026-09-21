"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { searchInstrumentsAction } from "@/lib/actions/market";
import { FormLabel } from "@/components/layout/FormLabel";
import { InstrumentLogo } from "@/components/finance/InstrumentLogo";
import { canSearchInstruments } from "@finance/core/market/yahoo";
import { cn } from "@/lib/utils";
import type { InstrumentSearchResult } from "@finance/core/market/yahoo";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { resolveMessage } from "@finance/core/i18n/t";

interface InstrumentSearchProps {
  symbol: string;
  name: string;
  onSelect: (instrument: InstrumentSearchResult) => void;
  onClear: () => void;
  required?: boolean;
}

/**
 * Finding the ETF, the fund or the share a template is priced from.
 *
 * A real combobox, and the reason this one earns the roles where four other
 * surfaces in this app gave theirs up is that the contract actually fits.
 * `SegmentedControl` dropped `role="radiogroup"` and the ledger's filters
 * dropped `role="tablist"` because in both cases the promise was wrong at the
 * root: those are one tab stop per control and always were, so implementing
 * the arrow keys would have meant inventing a behaviour nobody wanted. Here
 * the opposite holds. A text field with a list of matches under it *is* the
 * shape ARIA's combobox describes, the reader's hands are already on the
 * keyboard because they are typing a name, and Down-Down-Enter is how anybody
 * who has used a search box expects to pick the second result. The honest fix
 * was to keep the roles and write the model they were claiming.
 *
 * What that means concretely: focus never leaves the input. The options are
 * `<li role="option">` rather than buttons, the active one is named by
 * `aria-activedescendant`, and `aria-selected` says which — where before it
 * was hardcoded `false` on every row, which told a screen reader that none of
 * the results was ever the one. Arrow keys wrap, Enter takes the active
 * option, Escape closes the list without closing the sheet the field sits in,
 * and Tab leaves with the list shut.
 *
 * The status lines — searching, no matches, the ISIN hint, an error from the
 * quote source — sit outside the listbox in their own live region. Inside it
 * they were children of a `role="listbox"` that are not options, which is
 * invalid, and they were announced as if they were results.
 */
export function InstrumentSearch({
  symbol,
  name,
  onSelect,
  onClear,
  required,
}: InstrumentSearchProps) {
  const t = useT();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState(name || "");
  const [results, setResults] = useState<InstrumentSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIsin, setSelectedIsin] = useState<string | null>(null);
  /** Which option `aria-activedescendant` points at; -1 is none. */
  const [active, setActive] = useState(-1);
  /**
   * The query `results` actually answer, so the list can tell "nothing
   * matched" from "nothing has been asked yet".
   *
   * The search is debounced 300ms and `loading` only goes up when the request
   * leaves, so for the first third of a second after every keystroke the
   * state was empty-and-not-loading — indistinguishable from a finished
   * search that found nothing. It read as "No instruments found" flashing
   * under the field while you typed a name that was about to match, and now
   * that the status line is a live region it would be read aloud too.
   */
  const [settled, setSettled] = useState<string | null>(null);

  // Sync the input with the externally-controlled name during render
  // (React's recommended alternative to a state-syncing effect).
  const [prevName, setPrevName] = useState(name);
  if (prevName !== name) {
    setPrevName(name);
    setQuery(name || "");
  }

  const searchable = canSearchInstruments(query);
  const normalized = query.trim().replace(/\s+/g, "");
  /**
   * A half-typed ISIN, which `canSearchInstruments` refuses on purpose — it
   * matches nothing and spends a request against an endpoint that rate-limits
   * by IP. The hint that says so used to be unreachable: it was rendered
   * inside a branch already guarded by `canSearchInstruments`, so the one
   * query it existed for was the one query that never drew it. The popup now
   * opens for this case too, with the hint and no request.
   */
  const partialIsin =
    !searchable && /^[A-Za-z]{2}[A-Za-z0-9]*$/.test(normalized);
  const expanded = open && (searchable || partialIsin);

  useEffect(() => {
    if (!open || symbol || !canSearchInstruments(query)) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);

      const response = await searchInstrumentsAction(query.trim());
      if (controller.signal.aborted) {
        return;
      }

      if ("error" in response) {
        setResults([]);
        setError(response.error);
      } else {
        setResults(response.data);
      }

      // A new set of matches is a new list; keeping the old index would put
      // the highlight on whichever instrument happened to land in that slot.
      setActive(-1);
      setSettled(query.trim());
      setLoading(false);
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open, symbol]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // The list is 56px of scroll at most, so an option reached with the arrow
  // keys is regularly outside it. `nearest` rather than `center`: it moves
  // the list by the one row that was missing instead of jumping the reader's
  // place in it.
  useEffect(() => {
    if (active < 0) {
      return;
    }
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function optionId(index: number) {
    return `${listId}-option-${index}`;
  }

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function handleSelect(instrument: InstrumentSearchResult) {
    onSelect(instrument);
    setQuery(instrument.name);
    setSelectedIsin(instrument.isin ?? null);
    setResults([]);
    close();
  }

  function handleClear() {
    onClear();
    setQuery("");
    setSelectedIsin(null);
    setResults([]);
    setError(null);
    setActive(-1);
    setSettled(null);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && !expanded) {
      setOpen(true);
      return;
    }
    if (!expanded) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (results.length === 0) {
          return;
        }
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        // Wrapping, which also gives the two openings people expect from
        // nothing highlighted: Down lands on the first match, Up on the last.
        setActive((current) => {
          const next = current + step;
          if (next < 0) {
            return results.length - 1;
          }
          if (next > results.length - 1) {
            return 0;
          }
          return next;
        });
        return;
      }
      case "Home":
      case "End": {
        if (results.length === 0) {
          return;
        }
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : results.length - 1);
        return;
      }
      case "Enter": {
        const instrument = results[active];
        if (!instrument) {
          return;
        }
        // Without this the form around the field submits on the keystroke
        // that was meant to pick a result.
        event.preventDefault();
        handleSelect(instrument);
        return;
      }
      case "Escape": {
        event.preventDefault();
        // The field lives inside a sheet that also closes on Escape. One
        // press should shut the list the reader is looking at, not the form
        // they were filling in.
        event.stopPropagation();
        close();
        return;
      }
      case "Tab": {
        close();
        return;
      }
      default:
        return;
    }
  }

  const searching = loading || settled !== query.trim();
  // Only once the answer belongs to what is in the field: an error left over
  // from the previous query must not paint the "Searching…" line red.
  const failure = !partialIsin && !searching && error;
  const status = partialIsin
    ? t("instrument.isinKeepTyping")
    : searching
      ? t("instrument.searching")
      : failure
        ? resolveMessage(t, error)
        : results.length === 0
          ? t("instrument.noResults")
          : null;

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <FormLabel htmlFor="instrument-search">{t("instrument.label")}</FormLabel>

      {symbol ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-control",
            "border border-border bg-muted/20 p-3",
          )}
        >
          <div className="min-w-0">
            <p className="font-medium leading-snug break-words">{name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {symbol}
              {selectedIsin ? ` · ${selectedIsin}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center",
              "rounded-full border border-border hover:bg-accent",
            )}
            aria-label={t("common.clearInstrument")}
          >
            <X size={ICON.md} weight="light" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <MagnifyingGlass
            size={ICON.lg}
            weight="light"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="instrument-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={t("common.searchInstrument")}
            autoComplete="off"
            role="combobox"
            // The three that were missing. `aria-expanded` now tracks whether
            // a popup is actually on screen rather than whether the field has
            // been focused; `aria-controls` is only set while there is
            // something with that id to point at; and `aria-activedescendant`
            // is the whole reason focus can stay in the input while the
            // highlight moves down the list.
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            required={required}
            className={cn(
              "h-11 w-full rounded-full border border-border bg-card",
              "pl-10 pr-3 text-base",
            )}
          />

          {expanded && (
            <div
              className={cn(
                "absolute z-50 mt-1 max-h-56 w-full overflow-y-auto",
                "rounded-card border border-border bg-card p-1",
              )}
            >
              {/* Outside the listbox, because a listbox's children are its
                  options and nothing else. `role="status"` so a reader who
                  never looks down here still hears that the search found
                  nothing. */}
              {status ? (
                <p
                  role="status"
                  className={cn(
                    "px-3 py-2 text-sm",
                    failure ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {status}
                </p>
              ) : null}

              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={t("instrument.resultsLabel")}
              >
                {results.map((instrument, index) => (
                  <li
                    key={instrument.symbol}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    data-index={index}
                    // The press must not pull focus out of the input: the
                    // combobox's whole model is that the input keeps it and
                    // `aria-activedescendant` says where the reader is.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => handleSelect(instrument)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-control",
                      "px-3 py-2 text-left aria-selected:bg-accent",
                    )}
                  >
                    <InstrumentLogo
                      symbol={instrument.symbol}
                      name={instrument.name}
                      className="size-7"
                    />
                    <span className="flex min-w-0 flex-col items-start gap-0.5">
                      <span className="text-sm font-medium leading-snug">
                        {instrument.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {instrument.symbol}
                        {instrument.isin ? ` · ${instrument.isin}` : ""}
                        {instrument.exchange ? ` · ${instrument.exchange}` : ""}
                        {instrument.quoteType
                          ? ` · ${instrument.quoteType}`
                          : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <input type="hidden" name="instrumentSymbol" value={symbol} />
      <input type="hidden" name="instrumentName" value={name} />
    </div>
  );
}
