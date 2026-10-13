"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { Flag } from "@phosphor-icons/react";
import { ENTRAIDE_RULES, type EntraideRule } from "@finance/core/entraide";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import { reportTarget } from "@/lib/actions/entraide";
import {
  entraideErrorText,
  type EntraideCopy,
} from "@/components/marketing/entraide-copy";
import { fieldClass } from "@/components/marketing/entraide/Composer";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/**
 * « Signaler », under a question or an answer that is not the reader's: it
 * opens in place on the rules to choose from and a line for a detail, and
 * says thank you once sent. A visitor is pointed to signing in, or to the
 * email address anyone may write to.
 */
export function ReportButton({
  target,
  copy,
  signedIn,
  loginHref,
  reported,
}: {
  target: string;
  copy: EntraideCopy;
  signedIn: boolean;
  loginHref: string;
  /** Already reported by the reader: the thanks stand in for the button. */
  reported: boolean;
}) {
  const words = copy.report;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<EntraideRule | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(reported);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  async function send() {
    if (!reason) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await reportTarget(target, reason, note);
    setPending(false);
    if (!result.success) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    setSent(true);
    setOpen(false);
  }

  return (
    <div className="flex w-full flex-col items-end">
      {sent ? (
        <p className="text-sm text-marketing-faint">{words.sent}</p>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-marketing-faint transition-colors duration-hover hover:text-white",
            marketingFocus,
          )}
        >
          <Flag size={14} aria-hidden />
          {words.button}
        </button>
      )}
      <AnimatePresence initial={false}>
        {open && !sent ? (
          <m.div
            key="report"
            className="w-full overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.panel / 1000, ease: EASE }}
          >
            {signedIn ? (
              <form
                className="mt-2 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium text-marketing-ink">
                    {words.title}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {ENTRAIDE_RULES.map((rule) => (
                      <label
                        key={rule}
                        className={cn(
                          "inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3 text-sm transition-colors duration-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white/40",
                          reason === rule
                            ? "border-white/25 bg-white/[0.1] text-marketing-ink"
                            : "border-white/10 text-marketing-muted hover:text-white",
                        )}
                      >
                        <input
                          type="radio"
                          name={`${ids}-reason`}
                          value={rule}
                          checked={reason === rule}
                          onChange={() => setReason(rule)}
                          className="sr-only"
                        />
                        {copy.rules[rule]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-marketing-muted">
                    {words.note}
                  </span>
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={500}
                    className={fieldClass}
                  />
                </label>
                {error ? (
                  <p role="alert" className="text-sm text-marketing-ink">
                    {error}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "min-h-11 rounded-full px-4 text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
                      marketingFocus,
                    )}
                  >
                    {copy.thread.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!reason || pending}
                    className={cn(
                      "min-h-11 rounded-full border border-white/15 px-5 text-sm text-marketing-ink transition-opacity duration-hover disabled:opacity-40",
                      marketingFocus,
                    )}
                  >
                    {pending ? words.sending : words.send}
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-2 text-right text-sm text-marketing-muted">
                {words.signIn}{" "}
                <Link
                  href={loginHref}
                  className={cn(
                    "rounded-control text-marketing-ink underline decoration-white/30 underline-offset-4",
                    marketingFocus,
                  )}
                >
                  {copy.composer.signInCta}
                </Link>
              </p>
            )}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
