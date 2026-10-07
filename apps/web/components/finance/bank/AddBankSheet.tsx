"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { resolveMessage } from "@finance/core/i18n/t";
import { Button, buttonVariants } from "@/components/ui/Button";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { useToast } from "@/components/layout/ToastProvider";
import { findNewBankAccounts } from "@/lib/actions/bank-connect";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

/** Where a bank is added: the user's own open-banking.io account. */
const OPEN_BANKING_APP = "https://open-banking.io/app";

type Look =
  | { state: "idle" }
  | { state: "looking" }
  | { state: "nothing" }
  | { state: "failed"; message: string };

/**
 * Adding a second bank, or a third.
 *
 * Nothing to upload: the credentials file Pluclair holds reads every bank in
 * the user's open-banking.io account, so a bank is added there and only has
 * to be found here. The sheet says so, sends them there, and looks by itself
 * the moment they are back on the tab — the press they would otherwise have
 * to remember is « Vérifier maintenant », kept for when the bank took a while.
 * When something turns up the sheet gets out of the way: the page behind it
 * is already asking what the new accounts are.
 */
export function AddBankSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [look, setLook] = useState<Look>({ state: "idle" });
  // Whether they went to open-banking.io from here: coming back to a tab
  // they never left is not a reason to ask the bank anything.
  const left = useRef(false);
  const looking = useRef(false);

  const lookNow = useCallback(async () => {
    if (looking.current) {
      return;
    }
    looking.current = true;
    setLook({ state: "looking" });
    const result = await findNewBankAccounts();
    looking.current = false;
    if (result.error !== undefined) {
      setLook({ state: "failed", message: resolveMessage(t, result.error) });
      return;
    }
    if (result.awaiting === 0) {
      setLook({ state: "nothing" });
      return;
    }
    setLook({ state: "idle" });
    left.current = false;
    onOpenChange(false);
    toast(t("bankAccounts.addFound", { count: result.awaiting }), "success");
  }, [t, toast, onOpenChange]);

  const onReturn = useEffectEvent(() => {
    if (left.current && document.visibilityState === "visible") {
      void lookNow();
    }
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const listener = () => onReturn();
    document.addEventListener("visibilitychange", listener);
    window.addEventListener("focus", listener);
    return () => {
      document.removeEventListener("visibilitychange", listener);
      window.removeEventListener("focus", listener);
    };
  }, [open]);

  const steps = [
    {
      title: t("bankAccounts.addStep1Title"),
      body: t("bankAccounts.addStep1Body"),
      href: OPEN_BANKING_APP,
    },
    {
      title: t("bankAccounts.addStep2Title"),
      body: t("bankAccounts.addStep2Body"),
    },
  ];

  return (
    <MobileSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          left.current = false;
          setLook({ state: "idle" });
        }
        onOpenChange(next);
      }}
      title={t("bankAccounts.addBank")}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {t("bankAccounts.addLead")}
        </p>

        <ol className="flex flex-col gap-4">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {step.body}
                </p>
                {step.href ? (
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      left.current = true;
                    }}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "mt-2 gap-1.5",
                    )}
                  >
                    {t("bankConnect.openSite")}
                    <ArrowSquareOut size={ICON.sm} aria-hidden />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2" aria-live="polite">
          <Button
            type="button"
            variant="outline"
            disabled={look.state === "looking"}
            aria-busy={look.state === "looking"}
            onClick={() => void lookNow()}
          >
            {look.state === "looking"
              ? t("bankAccounts.addLooking")
              : t("bankAccounts.addCheck")}
          </Button>
          {look.state === "nothing" ? (
            <p className="text-sm text-muted-foreground">
              {t("bankAccounts.addNothing")}
            </p>
          ) : look.state === "failed" ? (
            <p className="text-sm text-destructive">{look.message}</p>
          ) : null}
        </div>
      </div>
    </MobileSheet>
  );
}
