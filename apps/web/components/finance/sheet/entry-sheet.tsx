"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { CheckCircle, Trash } from "@phosphor-icons/react";
import { parseTypedAmount } from "@finance/core/amount-input";
import { INTL_LOCALES, type Locale } from "@finance/core/i18n/locale";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { inkAt } from "../add/parts";
import styles from "../add/add-sheet.module.css";

/**
 * The pieces every entry sheet shares since November 2026 — Ajouter, and
 * the sheets that edit an operation, a recurring entry or a position — so
 * the four read as one family: the money as the figure at the top, lit in
 * its kind's colour; fields named above them; one orange button that says
 * what it will do; removing at the bottom, in words.
 */

/** An amount as the reader would type it: "1500,5" in French, no grouping. */
export function typedAmount(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(amount);
}

/** The class a text field takes inside an entry sheet. */
export const SHEET_FIELD =
  "min-h-11 rounded-2xl bg-foreground/5 px-3.5 text-base";

/**
 * The faint light of the money's colour behind the figure. Sits at the top
 * of a sheet's body, under its header.
 */
export function SheetGlow({ ink }: { ink: string }) {
  return (
    <div
      aria-hidden
      style={{ "--kind": ink } as CSSProperties}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-56",
        styles.glow,
      )}
    />
  );
}

/**
 * The amount as the subject of the sheet, and the field that edits it: the
 * figure in the money serif and its kind's colour, an invisible input over
 * it, and a line under it in the same colour while it is being typed into.
 * `name` posts the amount as a plain number, whichever shape it was typed in.
 */
export function SheetFigure({
  id,
  name,
  value,
  onChange,
  ink,
  sign = "",
  symbol = "€",
  label,
  caption,
}: {
  id: string;
  /** The form field the amount is posted as. */
  name?: string;
  /** As typed: "42,5". */
  value: string;
  onChange: (value: string) => void;
  ink: string;
  sign?: string;
  symbol?: string;
  label: string;
  caption?: string;
}) {
  const empty = value.trim() === "";
  const parsed = parseTypedAmount(value);
  return (
    <div className="relative pb-1 pt-5 text-center">
      <div className="group relative mx-auto flex w-fit max-w-full items-center justify-center px-2 pb-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) =>
            onChange(event.target.value.replace(/[^\d.,\s-]/g, ""))
          }
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
        {name ? (
          <input
            type="hidden"
            name={name}
            value={parsed === null ? "" : String(parsed)}
          />
        ) : null}
        <div
          aria-hidden
          className="pointer-events-none flex items-baseline gap-0.5 whitespace-nowrap font-serif tabular-nums tracking-[-0.035em]"
          style={{
            color: empty
              ? `color-mix(in srgb, ${ink} 45%, var(--muted-foreground))`
              : ink,
          }}
        >
          {sign ? (
            <span className="mr-1 text-[1.75rem] font-medium">{sign}</span>
          ) : null}
          <span className="text-[3.25rem] font-semibold leading-none">
            {empty ? "0" : value}
          </span>
          <span className="ml-1.5 text-[1.625rem] font-medium">{symbol}</span>
        </div>
        {/* The focus indicator (SC 2.4.7): the input itself is invisible. */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full opacity-0 transition-opacity duration-hover group-focus-within:opacity-100"
          style={{ background: ink }}
        />
      </div>
      {caption ? (
        <p className="mt-1.5 truncate text-[13px] text-muted-foreground">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/** A figure that is read rather than typed: a position's value today. */
export function SheetValue({
  value,
  ink,
  caption,
}: {
  value: string;
  ink: string;
  caption?: string;
}) {
  return (
    <div className="relative pb-1 pt-5 text-center">
      <p
        className="privacy-sensitive font-serif text-[3rem] font-semibold leading-none tabular-nums tracking-[-0.035em]"
        style={{ color: ink }}
      >
        {value}
      </p>
      {caption ? (
        <p className="privacy-sensitive mt-2.5 truncate text-[13px] text-muted-foreground">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/** A field with its name above it, and a hint under the name when it needs one. */
export function SheetField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold tracking-[0.015em] text-muted-foreground"
      >
        {label}
      </label>
      {hint ? (
        <p className="-mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

/**
 * The orange button an entry sheet ends on, saying what it will do — or,
 * greyed, what it is waiting for.
 */
export function SheetSave({
  label,
  figure,
  disabled,
  type = "submit",
  onClick,
  saved = false,
}: {
  label: string;
  /** Set after the label in the money serif: « Enregistrer −42,50 € ». */
  figure?: string;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  saved?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-[52px] w-full min-w-0 items-center justify-center gap-2 rounded-2xl px-3 text-[0.97rem] font-semibold",
        "transition-[background-color,color,transform] duration-press",
        disabled
          ? "bg-secondary text-muted-foreground"
          : "bg-primary text-primary-foreground hover:bg-primary-hover active:scale-[0.98]",
      )}
    >
      {saved ? <CheckCircle size={ICON.xl} weight="fill" /> : null}
      <span className="truncate">{label}</span>
      {figure ? (
        <span className="font-serif tabular-nums tracking-[-0.02em]">
          {figure}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Removing what the sheet holds, at the bottom and in words: a quiet line in
 * the destructive colour, then what removing it does and the two answers.
 */
export function SheetDanger({
  label,
  explanation,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
}: {
  label: string;
  explanation: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(true)}
        className="flex min-h-10 items-center gap-2 self-start rounded-control text-sm font-medium text-destructive transition-opacity duration-hover hover:opacity-80"
      >
        <Trash size={ICON.md} />
        {label}
      </button>
    );
  }
  return (
    <div
      className="fade-in flex flex-col gap-3 rounded-2xl border p-3.5"
      style={{
        borderColor: inkAt("var(--destructive)", 40),
        background: inkAt("var(--destructive)", 6),
      }}
    >
      <p className="text-sm">{explanation}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="h-11 flex-1 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground transition-opacity duration-hover hover:opacity-90 disabled:opacity-60"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking(false)}
          className="h-11 flex-1 rounded-xl border border-border text-sm font-medium transition-colors duration-hover hover:bg-secondary"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
