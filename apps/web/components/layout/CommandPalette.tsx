"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarBlank,
  ChatCircleText,
  Compass,
  Plus,
  Repeat,
  Storefront,
  Tag,
} from "@phosphor-icons/react";
import {
  formatMonthLabel,
  monthSearchParams,
  todayIsoLocal,
} from "@finance/core/constants";
import {
  buildPaletteItems,
  paletteItemId,
  type PaletteItem,
  type PaletteSource,
} from "@finance/core/palette";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { Input } from "@/components/ui/Input";
import { ICON } from "@/lib/icon-scale";
import { MICRO } from "@/lib/type-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

/**
 * « Palette »: what Cmd+K opens — the add, a question, every page, and
 * what the words typed name: an amount to add, a month to open in the
 * Journal or on Le point, a shop, a charge, a category
 * (`@finance/core/palette`). Keyboard throughout: the arrows choose, Enter
 * opens, Escape closes. Web only; the phone has its search.
 */
export function CommandPalette({
  open,
  onOpenChange,
  source,
  onAdd,
  onAddCharge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: PaletteSource;
  /** Open the add sheet, with an amount already typed when there is one. */
  onAdd: (amount: number | null) => void;
  onAddCharge: () => void;
}) {
  if (!open) {
    return null;
  }
  return (
    <PaletteSheet
      onOpenChange={onOpenChange}
      source={source}
      onAdd={onAdd}
      onAddCharge={onAddCharge}
    />
  );
}

function PaletteSheet({
  onOpenChange,
  source,
  onAdd,
  onAddCharge,
}: {
  onOpenChange: (open: boolean) => void;
  source: PaletteSource;
  onAdd: (amount: number | null) => void;
  onAddCharge: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const today = todayIsoLocal();
  const items = useMemo(
    () => buildPaletteItems(query, source, { today, locale }),
    [query, source, today, locale],
  );
  const current = Math.min(active, Math.max(0, items.length - 1));

  function close() {
    onOpenChange(false);
  }

  function run(item: PaletteItem) {
    close();
    switch (item.kind) {
      case "add":
        onAdd(item.amount);
        return;
      case "addCharge":
        onAddCharge();
        return;
      case "ask":
        router.push("/ask");
        return;
      case "page":
        router.push(item.href);
        return;
      case "month":
        router.push(
          `${item.target === "ledger" ? "/transactions" : "/bearing"}${monthSearchParams(item.year, item.month)}`,
        );
        return;
      case "shop":
        router.push(`/merchants?q=${encodeURIComponent(item.label)}`);
        return;
      case "charge":
        router.push(`/recurring?edit=${encodeURIComponent(item.id)}`);
        return;
      case "category":
        router.push(`/history?open=${encodeURIComponent(item.id)}`);
        return;
    }
  }

  function label(item: PaletteItem): string {
    switch (item.kind) {
      case "add":
        return item.amount === null
          ? t("palette.add")
          : t("palette.addAmount", { amount: format(item.amount) });
      case "addCharge":
        return t("palette.addCharge");
      case "ask":
        return t("palette.ask");
      case "page":
        return item.label;
      case "month":
        return t(
          item.target === "ledger"
            ? "palette.ledgerMonth"
            : "palette.bearingMonth",
          { month: formatMonthLabel(item.year, item.month, locale) },
        );
      case "shop":
        return t("palette.shop", { name: item.label });
      case "charge":
        return t("palette.charge", { name: item.name });
      case "category":
        return t("palette.category", { name: item.name });
    }
  }

  function Icon({ item }: { item: PaletteItem }) {
    const size = ICON.md;
    switch (item.kind) {
      case "add":
      case "addCharge":
        return <Plus size={size} weight="bold" />;
      case "ask":
        return <ChatCircleText size={size} />;
      case "page":
        return <Compass size={size} />;
      case "month":
        return <CalendarBlank size={size} />;
      case "shop":
        return <Storefront size={size} />;
      case "charge":
        return <Repeat size={size} />;
      case "category":
        return <Tag size={size} />;
    }
  }

  return (
    <MobileSheet open onOpenChange={onOpenChange} title={t("palette.title")}>
      <div className="flex flex-col gap-3">
        <Input
          type="text"
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={
            items[current] ? `${listId}-${paletteItemId(items[current])}` : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={t("palette.placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(value + 1, items.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const item = items[current];
              if (item) {
                run(item);
              }
            } else if (event.key === "Escape") {
              close();
            }
          }}
          className="text-base"
        />
        {items.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            {t("palette.empty", { query: query.trim() })}
          </p>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label={t("palette.title")}
            className="flex max-h-[55vh] flex-col overflow-y-auto"
          >
            {items.map((item, index) => {
              const id = `${listId}-${paletteItemId(item)}`;
              const selected = index === current;
              return (
                <li
                  key={paletteItemId(item)}
                  id={id}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-sm",
                    selected ? "bg-muted text-foreground" : "text-foreground/90",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    <Icon item={item} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{label(item)}</span>
                  {selected ? (
                    <ArrowRight size={ICON.sm} className="shrink-0 text-muted-foreground" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className={cn(MICRO, "hidden text-muted-foreground md:block")}>
          {t("palette.hint")}
        </p>
      </div>
    </MobileSheet>
  );
}
