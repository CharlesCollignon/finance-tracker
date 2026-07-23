"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { searchInstrumentsAction } from "@/lib/actions/market";
import { FormLabel } from "@/components/layout/FormLabel";
import { canSearchInstruments } from "@finance/core/market/yahoo";
import { cn } from "@/lib/utils";
import type { InstrumentSearchResult } from "@finance/core/market/yahoo";

interface InstrumentSearchProps {
  symbol: string;
  name: string;
  onSelect: (instrument: InstrumentSearchResult) => void;
  onClear: () => void;
  required?: boolean;
}

export function InstrumentSearch({
  symbol,
  name,
  onSelect,
  onClear,
  required,
}: InstrumentSearchProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(name || "");
  const [results, setResults] = useState<InstrumentSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIsin, setSelectedIsin] = useState<string | null>(null);

  useEffect(() => {
    setQuery(name || "");
  }, [name]);

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
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function handleSelect(instrument: InstrumentSearchResult) {
    onSelect(instrument);
    setQuery(instrument.name);
    setSelectedIsin(instrument.isin ?? null);
    setOpen(false);
    setResults([]);
  }

  function handleClear() {
    onClear();
    setQuery("");
    setSelectedIsin(null);
    setResults([]);
    setError(null);
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <FormLabel htmlFor="instrument-search">ETF / fund</FormLabel>

      {symbol ? (
        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded",
            "border-2 border-border bg-muted/20 p-3",
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
              "rounded border-2 border-border hover:bg-accent",
            )}
            aria-label="Clear selected instrument"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="instrument-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name or ISIN…"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            required={required}
            className={cn(
              "h-11 w-full rounded border-2 border-border bg-background",
              "pl-10 pr-3 text-base shadow-md",
            )}
          />

          {open && canSearchInstruments(query) && (
            <ul
              id={listId}
              role="listbox"
              className={cn(
                "absolute z-50 mt-1 max-h-56 w-full overflow-y-auto",
                "rounded border-2 border-border bg-background shadow-md",
              )}
            >
              {loading && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Searching…
                </li>
              )}
              {!loading &&
                !canSearchInstruments(query) &&
                /^[A-Za-z]{2}[A-Za-z0-9]*$/.test(
                  query.trim().replace(/\s+/g, ""),
                ) && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    ISIN is 12 characters — keep typing…
                  </li>
                )}
              {!loading && error && (
                <li className="px-3 py-2 text-sm text-destructive">{error}</li>
              )}
              {!loading && !error && results.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  No instruments found. Try a name or a 12-character ISIN.
                </li>
              )}
              {!loading &&
                results.map((instrument) => (
                  <li key={instrument.symbol}>
                    <button
                      type="button"
                      role="option"
                      onClick={() => handleSelect(instrument)}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5",
                        "px-3 py-2 text-left hover:bg-accent",
                      )}
                    >
                      <span className="text-sm font-medium leading-snug">
                        {instrument.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {instrument.symbol}
                        {instrument.isin ? ` · ${instrument.isin}` : ""}
                        {instrument.exchange ? ` · ${instrument.exchange}` : ""}
                        {instrument.quoteType ? ` · ${instrument.quoteType}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <input type="hidden" name="instrumentSymbol" value={symbol} />
      <input type="hidden" name="instrumentName" value={name} />
    </div>
  );
}
