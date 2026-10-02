"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "@phosphor-icons/react";
import {
  ADDRESS_QUERY_MIN,
  type AddressMatch,
} from "@finance/core/address-search";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { findAddresses } from "@/lib/actions/property";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** Long enough that a word being typed is not searched letter by letter. */
const PAUSE_MS = 300;

/**
 * An address, typed and picked from what the geocoder finds for it. Once
 * picked it is said back, with a way to look again; without one the form
 * carries on, and the property simply has no market to be priced by.
 */
export function AddressField({
  value,
  onChange,
}: {
  value: AddressMatch | null;
  onChange: (match: AddressMatch | null) => void;
}) {
  const t = useT();
  const id = useId();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{
    query: string;
    matches: AddressMatch[];
  } | null>(null);
  // The latest query asked, so an answer that comes back late, for what was
  // typed before, is not shown over the one that matters.
  const latest = useRef("");

  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < ADDRESS_QUERY_MIN) {
      return;
    }
    const timer = setTimeout(() => {
      latest.current = trimmed;
      void findAddresses(trimmed).then((matches) => {
        if (latest.current === trimmed) {
          setAnswer({ query: trimmed, matches });
        }
      });
    }, PAUSE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);

  if (value) {
    return (
      <div className="flex min-w-0 items-center gap-3 rounded-control border border-border bg-input px-3 py-2">
        <MapPin size={ICON.md} aria-hidden className="shrink-0" />
        <p className="min-w-0 flex-1 truncate text-sm">{value.label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery(value.label);
            onChange(null);
          }}
        >
          {t("property.addressChange")}
        </Button>
      </div>
    );
  }

  const searchable = trimmed.length >= ADDRESS_QUERY_MIN;
  const current = searchable && answer?.query === trimmed ? answer : null;
  const listId = `${id}-matches`;

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={id}
        type="search"
        autoComplete="off"
        value={query}
        placeholder={t("property.addressPlaceholder")}
        aria-label={t("property.address")}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div id={listId} aria-live="polite">
        {searchable && !current ? (
          <p className="text-xs text-muted-foreground">
            {t("property.addressSearching")}
          </p>
        ) : null}
        {current && current.matches.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("property.addressNone")}
          </p>
        ) : null}
        {current && current.matches.length > 0 ? (
          <ul className="flex flex-col overflow-hidden rounded-control border border-border">
            {current.matches.map((match) => (
              <li key={`${match.citycode}-${match.label}`}>
                <button
                  type="button"
                  onClick={() => onChange(match)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm",
                    "transition-colors duration-hover hover:bg-foreground/5",
                    "focus-visible:bg-foreground/5 focus-visible:outline-none",
                  )}
                >
                  <MapPin
                    size={ICON.sm}
                    aria-hidden
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 truncate">{match.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
