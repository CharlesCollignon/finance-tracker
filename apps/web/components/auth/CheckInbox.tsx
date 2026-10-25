"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { CheckCircle, EnvelopeSimple } from "@phosphor-icons/react";
import { EASE_STANDARD } from "@finance/core/motion";
import { resendErrorKey } from "@finance/core/auth-errors";
import { resolveMessage } from "@finance/core/i18n/t";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/**
 * Seconds before « Renvoyer » can be pressed: Supabase sends at most one
 * confirmation a minute to an address, so the button waits as long as the
 * server would, rather than offering a press that can only be refused.
 */
const RESEND_COOLDOWN_S = 60;

/** Stands in for the address inside the sentence, which stays whole. */
const EMAIL_MARK = String.fromCharCode(1);

/**
 * What a sign-up turns into when the account waits for its address.
 *
 * Before, the form stayed on screen, emptied, with one grey line under it —
 * easy to read as "nothing happened". This replaces the form: the address
 * the link went to, where to look, a way to have it sent again, and a way
 * back to the form when the address was mistyped. The envelope flies off and
 * a new one lands each time another mail leaves.
 */
export function CheckInbox({
  email,
  onChangeAddress,
}: {
  email: string;
  onChangeAddress: () => void;
}) {
  const t = useT();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [pending, setPending] = useState(false);
  const [sends, setSends] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);
    return () => clearTimeout(tick);
  }, [cooldown]);

  async function resend() {
    setPending(true);
    setError(null);
    const { error: resendError } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setPending(false);
    if (resendError) {
      setError(resendErrorKey(resendError.code));
      return;
    }
    setSends((count) => count + 1);
    setCooldown(RESEND_COOLDOWN_S);
  }

  const [before, after] = t("auth.checkInboxBody", { email: EMAIL_MARK }).split(
    EMAIL_MARK,
  );

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative grid size-20 place-items-center rounded-full border border-primary/30 bg-accent">
        <AnimatePresence mode="popLayout">
          <m.span
            key={sends}
            className="text-primary"
            initial={{ opacity: 0, scale: 0.5, rotate: -14, y: 6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
            exit={{ opacity: 0, x: 36, y: -28, rotate: 18, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
          >
            <EnvelopeSimple size={36} weight="duotone" aria-hidden />
          </m.span>
        </AnimatePresence>
      </div>

      <m.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
        className="mt-5 font-head text-2xl md:text-3xl"
      >
        {t("auth.checkInboxHeading")}
      </m.h1>
      <m.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.16 }}
        className="mt-2 text-sm text-muted-foreground"
      >
        {before}
        <strong className="font-medium break-words text-foreground">
          {email}
        </strong>
        {after}
      </m.p>
      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.24 }}
        className="mt-3 text-sm text-muted-foreground"
      >
        {t("auth.checkInboxSpam")}
      </m.p>

      <Button
        type="button"
        variant="outline"
        className="mt-6 w-full tabular-nums"
        disabled={pending || cooldown > 0}
        onClick={() => void resend()}
      >
        {pending
          ? t("auth.resendingConfirmation")
          : cooldown > 0
            ? t("auth.resendIn", { seconds: cooldown })
            : t("auth.resendConfirmation")}
      </Button>

      <div aria-live="polite" className="min-h-5 pt-2 text-sm">
        {error ? (
          <p className="text-destructive">{resolveMessage(t, error)}</p>
        ) : sends > 0 ? (
          <p className="flex items-center justify-center gap-1.5 text-muted-foreground">
            <CheckCircle
              size={ICON.sm}
              weight="fill"
              className="text-primary"
              aria-hidden
            />
            {t("auth.confirmationResent")}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-1 text-sm text-muted-foreground">
        <p>
          {t("auth.wrongAddress")}{" "}
          <button
            type="button"
            onClick={onChangeAddress}
            className="cursor-pointer font-medium underline"
          >
            {t("auth.changeAddress")}
          </button>
        </p>
        <p>
          {t("auth.alreadyConfirmed")}{" "}
          <Link href="/login" className="font-medium underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
