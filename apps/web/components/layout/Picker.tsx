"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SOLID_PANEL } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * The app's replacement for `<select>`: a button that shows the choice, and a
 * panel under it to make one, the way the month picker in the header works.
 *
 * A native select scrolled a long list in the operating system's own menu,
 * looked like nothing else in the app, and closed whenever anything moved
 * focus. The panel is drawn by the app, so it can search, group and lay
 * options out in a grid instead of one tall column.
 */

export const PICKER_TRIGGER_CLASS = cn(
  "flex h-11 w-full min-w-0 items-center gap-2 rounded-control border border-border",
  "bg-background px-3 text-base text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/** One option button inside a panel. */
export const PICKER_OPTION_CLASS = cn(
  "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-control px-2 text-left text-sm",
  "transition-colors duration-hover hover:bg-muted",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

interface PickerShellProps {
  /** The trigger's id, so a `<label htmlFor>` names it. */
  id: string;
  /** What the panel is for, read out when it opens. */
  panelLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the trigger shows: the current choice, or a prompt. */
  display: ReactNode;
  disabled?: boolean;
  /** The id of a hint that describes the trigger. */
  describedBy?: string;
  /**
   * The trigger's accessible name, "Category: Groceries". Without it a
   * `<label>` names the button and the current choice is never read out.
   */
  triggerLabel?: string;
  triggerClassName?: string;
  panelClassName?: string;
  /**
   * Where the panel goes when there is room on both sides. It flips when the
   * preferred side is short of space, so "top" is for a trigger that sits at
   * the bottom of the screen.
   */
  side?: "bottom" | "top";
  /**
   * A form field inside the wrapper: the input carrying the value, so the
   * picker posts like the select it replaces and a `required` refusal is
   * shown against the trigger.
   */
  field?: ReactNode;
  /** On the outer wrapper, for sizing the picker inside a row. */
  className?: string;
  children: ReactNode;
}

/** Keeps the panel this far inside the viewport and off the trigger. */
const EDGE = 8;
const GAP = 4;

export function PickerShell({
  id,
  panelLabel,
  open,
  onOpenChange,
  display,
  disabled,
  describedBy,
  triggerLabel,
  triggerClassName,
  panelClassName,
  side = "bottom",
  field,
  className,
  children,
}: PickerShellProps) {
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const requestClose = useEffectEvent(() => onOpenChange(false));

  // Drawn in a portal at a fixed position, so no scrolling parent clips it:
  // the sheets scroll, and the import table sits in a horizontal scroller.
  // Placed by writing to the panel's style, not through state, and again on
  // every scroll or resize so it stays against the trigger.
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    function place() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      panel.style.minWidth = `${rect.width}px`;
      const height = panel.offsetHeight;
      const width = panel.offsetWidth;
      const below = window.innerHeight - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      const upwards =
        side === "top"
          ? above >= height || above > below
          : below < height && above > below;
      const top = upwards ? rect.top - GAP - height : rect.bottom + GAP;
      const left = Math.min(
        Math.max(EDGE, rect.left),
        window.innerWidth - EDGE - width,
      );
      panel.style.top = `${Math.max(EDGE, top)}px`;
      panel.style.left = `${Math.max(EDGE, left)}px`;
      panel.style.visibility = "visible";
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, side]);

  // An outside press closes the panel. Deferred a frame, as the month picker
  // does: the press that opened it is still propagating.
  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        requestClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("touchstart", onPointerDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function closeToTrigger() {
    onOpenChange(false);
    triggerRef.current?.focus();
  }

  // The portal's key presses still bubble here through React's tree.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) {
      return;
    }
    if (event.key === "Escape") {
      // Before the sheet's own listener on the document, which would close
      // the whole form: React's handlers are registered on the document
      // first, so stopping the rest there leaves only the panel closed.
      event.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
      closeToTrigger();
    } else if (
      event.key === "Tab" &&
      panelRef.current?.contains(event.target as Node)
    ) {
      // Out of the panel and back to its field, as a menu does: the panel
      // lives at the end of the document, where the next tab stop would be
      // outside the sheet it was opened from.
      event.preventDefault();
      closeToTrigger();
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={cn("relative min-w-0", className)}
      onKeyDown={handleKeyDown}
    >
      {field}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-describedby={describedBy}
        aria-label={triggerLabel}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
        className={cn(PICKER_TRIGGER_CLASS, triggerClassName)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {display}
        </span>
        <CaretDown
          size={ICON.sm}
          aria-hidden
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-hover",
            open && "rotate-180",
          )}
        />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={panelLabel}
              // Hidden until placed, so it never flashes at the corner.
              style={{ visibility: "hidden" }}
              className={cn(
                // Above the sheets (z-60), which a picker often opens from.
                "fixed z-[70] flex max-w-[calc(100vw-1rem)] flex-col gap-2 rounded-card p-2",
                "min-w-[min(18rem,calc(100vw-2rem))]",
                SOLID_PANEL,
                "account-menu-panel",
                panelClassName,
              )}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/**
 * Arrow keys between the option buttons of a grid of `columns`, so a panel
 * can be crossed without tabbing through every option.
 */
export function moveFocusInGrid(
  event: KeyboardEvent<HTMLElement>,
  columns: number,
): void {
  const steps: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: columns,
    ArrowUp: -columns,
  };
  const step = steps[event.key];
  if (step === undefined) {
    return;
  }
  const options = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("[data-picker-option]"),
  );
  const index = options.indexOf(document.activeElement as HTMLElement);
  if (index === -1) {
    return;
  }
  const next = options[index + step];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

/**
 * Case- and accent-blind, so "cafe" finds "Café" and "epargne" finds
 * "Épargne".
 */
export function matchesSearch(text: string, query: string): boolean {
  const fold = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  return fold(text).includes(fold(query.trim()));
}

/** The search box at the top of a panel. Focused as the panel opens. */
export function PickerSearch({
  value,
  onChange,
  placeholder,
  onArrowDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Moves focus into the options, as a list box's down arrow would. */
  onArrowDown: () => void;
}) {
  return (
    <div className="relative">
      <MagnifyingGlass
        size={ICON.md}
        weight="light"
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onArrowDown();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-10 min-h-11 w-full rounded-full border border-border bg-background lg:min-h-0",
          "pl-9 pr-3 text-sm text-foreground outline-none focus:border-foreground",
        )}
      />
    </div>
  );
}

export interface PickerOption {
  value: string;
  label: string;
}

interface OptionPickerProps {
  id: string;
  /** What the panel is for, read out when it opens. */
  panelLabel: string;
  options: PickerOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Posts the value under this name, like the select it replaces. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  columns?: 1 | 2 | 3;
  /** Search box or not; by default, from nine options on. */
  searchable?: boolean;
  /** Names the trigger together with the choice: see `triggerLabel`. */
  label?: string;
  describedBy?: string;
  className?: string;
  triggerClassName?: string;
  side?: "bottom" | "top";
}

/** Past this many options a panel gets a search box. */
const SEARCH_FROM = 9;

/** Any short list: tags, weekdays, months, a CSV's columns. */
export function OptionPicker({
  id,
  panelLabel,
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  required,
  disabled,
  placeholder,
  columns = 1,
  searchable,
  label,
  describedBy,
  className,
  triggerClassName,
  side,
}: OptionPickerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const current = value ?? inner;
  const chosen = options.find((option) => option.value === current) ?? null;
  const shown = query
    ? options.filter((option) => matchesSearch(option.label, query))
    : options;
  const withSearch = searchable ?? options.length >= SEARCH_FROM;
  const displayText = chosen?.label ?? placeholder ?? t("picker.choose");

  function choose(next: string) {
    if (value === undefined) {
      setInner(next);
    }
    onValueChange?.(next);
    setOpen(false);
    setQuery("");
    document.getElementById(id)?.focus();
  }

  return (
    <PickerShell
      id={id}
      panelLabel={panelLabel}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
        }
      }}
      disabled={disabled}
      describedBy={describedBy}
      triggerLabel={label ? `${label}: ${displayText}` : undefined}
      className={className}
      triggerClassName={triggerClassName}
      side={side}
      field={
        name ? (
          <PickerField name={name} value={current} required={required} />
        ) : null
      }
      display={
        chosen ? (
          <span className="truncate">{chosen.label}</span>
        ) : (
          <span className="truncate text-muted-foreground">
            {placeholder ?? t("picker.choose")}
          </span>
        )
      }
    >
      {withSearch ? (
        <PickerSearch
          value={query}
          onChange={setQuery}
          placeholder={t("picker.search")}
          onArrowDown={() =>
            listRef.current
              ?.querySelector<HTMLElement>("[data-picker-option]")
              ?.focus()
          }
        />
      ) : null}
      {shown.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">
          {t("picker.noMatch", { query: query.trim() })}
        </p>
      ) : (
        <div
          ref={listRef}
          onKeyDown={(event) => moveFocusInGrid(event, columns)}
          className={cn(
            "grid max-h-64 gap-0.5 overflow-y-auto",
            columns === 3
              ? "grid-cols-3"
              : columns === 2
                ? "grid-cols-2"
                : "grid-cols-1",
          )}
        >
          {shown.map((option) => {
            const selected = option.value === current;
            return (
              <button
                key={option.value}
                type="button"
                data-picker-option
                aria-pressed={selected}
                autoFocus={selected && !withSearch}
                onClick={() => choose(option.value)}
                className={cn(PICKER_OPTION_CLASS, selected && "bg-muted")}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected ? (
                  <Check size={ICON.sm} aria-hidden className="shrink-0" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </PickerShell>
  );
}

/**
 * The value a form posts. Not `type="hidden"`: a hidden input is exempt from
 * validation, and a required picker has to refuse an empty submit the way
 * the select did, with the browser's message against the trigger. Not
 * `readOnly` either, for the same reason. It is transparent and out of the
 * tab order instead.
 */
export function PickerField({
  name,
  value,
  required,
}: {
  name: string;
  value: string;
  required?: boolean;
}) {
  return (
    <input
      name={name}
      value={value}
      required={required}
      onChange={() => undefined}
      tabIndex={-1}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-0"
    />
  );
}

/**
 * Two to four choices, laid out as the chips the ledger filters with rather
 * than hidden behind a panel. Posts under `name` when one is given.
 */
export function ChoiceChips<T extends string>({
  options,
  value,
  onValueChange,
  name,
  labelledBy,
}: {
  options: { value: T; label: string }[];
  value: T;
  onValueChange: (value: T) => void;
  name?: string;
  /** The id of the label that names the group. */
  labelledBy?: string;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-wrap gap-1.5"
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-medium lg:min-h-9",
            "transition-colors duration-hover",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === option.value
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
