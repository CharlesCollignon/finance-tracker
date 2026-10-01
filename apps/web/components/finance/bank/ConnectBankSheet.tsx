"use client";

import { useId, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, FileArrowUp } from "@phosphor-icons/react";
import { BANK_CONSENT_VERSION } from "@finance/core/bank-consent";
import { resolveMessage } from "@finance/core/i18n/t";
import { buttonVariants } from "@/components/ui/Button";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { LEGAL_DRAFT } from "@/components/marketing/legal-status";
import { useToast } from "@/components/layout/ToastProvider";
import { connectBankFile } from "@/lib/actions/bank-connect";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

interface ConnectBankSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * What a connection leads to, when not the Bank page. Setup passes its
   * own, so accepting a file carries on with setup rather than leaving it.
   */
  onConnected?: () => void;
}

/** open-banking.io's app, and the page in it where the file is downloaded. */
const OPEN_BANKING_APP = "https://open-banking.io/app";
const OPEN_BANKING_DEVELOPERS = "https://open-banking.io/app/developers";

/** Mirrors `MAX_CREDENTIALS_BYTES`: refused here before it is ever sent. */
const MAX_FILE_BYTES = 16 * 1024;

/**
 * Setting up a bank, from nothing to syncing, on one sheet.
 *
 * The user brings their own open-banking.io account: they sign up there, pay
 * there, connect their bank there, and download the credentials file that
 * lets Pluclair read it. The four steps say so in order, each with the link it
 * needs, and the money is stated plainly and as someone else's before anyone
 * leaves.
 *
 * The last step is the whole of Pluclair's part: drop the file. It is read in
 * the browser only to be sent, once, to `connectBankFile`, which checks it
 * against open-banking.io before keeping it — so a file that cannot work is
 * refused here, with the reason, while the person is still looking.
 */
export function ConnectBankSheet({
  open,
  onOpenChange,
  onConnected,
}: ConnectBankSheetProps) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [consented, setConsented] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(file: File | undefined) {
    if (!file || pending) {
      return;
    }
    if (!consented) {
      setProblem(t("bankConnect.consentRequired"));
      return;
    }
    setProblem(null);
    if (file.size > MAX_FILE_BYTES) {
      setProblem(t("bankConnect.fileTooLarge"));
      return;
    }
    startTransition(async () => {
      const result = await connectBankFile(
        await file.text(),
        BANK_CONSENT_VERSION,
      );
      if (result.error !== undefined) {
        setProblem(resolveMessage(t, result.error));
        return;
      }
      onOpenChange(false);
      toast(
        result.outcome === "paused"
          ? t("bankConnect.connectedPaused")
          : result.accounts === 0
            ? t("bankConnect.noAccountsYet")
            : t("bankConnect.connected"),
        result.outcome === "connected" && result.accounts > 0
          ? "success"
          : "default",
      );
      if (onConnected) {
        onConnected();
        return;
      }
      router.push("/bank");
    });
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    send(event.dataTransfer.files[0]);
  }

  const steps = [
    {
      title: t("bankConnect.step1Title"),
      body: t("bankConnect.step1Body"),
      href: OPEN_BANKING_APP,
    },
    { title: t("bankConnect.step2Title"), body: t("bankConnect.step2Body") },
    {
      title: t("bankConnect.step3Title"),
      body: t("bankConnect.step3Body"),
      href: OPEN_BANKING_DEVELOPERS,
    },
    { title: t("bankConnect.step4Title"), body: t("bankConnect.step4Body") },
  ];

  return (
    <MobileSheet
      open={open}
      onOpenChange={(next) => {
        setProblem(null);
        onOpenChange(next);
      }}
      title={t("bankConnect.sheetTitle")}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {t("bankConnect.sheetLead")}
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
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "-ml-2 mt-1 gap-1.5",
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

        {/* The consent is the last thing read before the file goes: it names
            who the data comes from, what Pluclair does with it, and how it is
            withdrawn, and its version is stored with the connection. */}
        <label className="flex cursor-pointer gap-3 rounded-control border border-border p-3 text-xs leading-relaxed has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
          <input
            type="checkbox"
            checked={consented}
            onChange={(event) => {
              setConsented(event.currentTarget.checked);
              setProblem(null);
            }}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          <span>{t("bankConnect.consentLabel")}</span>
        </label>

        <label
          htmlFor={inputId}
          aria-disabled={!consented}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-busy={pending}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-6 text-center",
            "transition-colors duration-hover focus-within:ring-2 focus-within:ring-ring",
            dragging
              ? "border-primary bg-accent"
              : "border-border hover:border-primary/60",
            !consented && "cursor-not-allowed opacity-50",
            pending && "cursor-progress opacity-70",
          )}
        >
          <FileArrowUp
            size={ICON.hero}
            weight="duotone"
            aria-hidden
            className="text-primary"
          />
          <span className="text-sm font-medium">
            {pending ? t("bankConnect.checking") : t("bankConnect.dropTitle")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("bankConnect.dropHint")}
          </span>
          <span
            className={cn(buttonVariants({ size: "sm" }), "mt-1")}
            aria-hidden
          >
            {t("bankConnect.chooseFile")}
          </span>
          <input
            id={inputId}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            disabled={pending || !consented}
            onChange={(event) => {
              send(event.currentTarget.files?.[0]);
              // So choosing the same file again, after fixing it, fires.
              event.currentTarget.value = "";
            }}
          />
        </label>

        {problem ? (
          <p
            role="alert"
            className="rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm"
          >
            {problem}
          </p>
        ) : null}

        <ul className="flex flex-col gap-2 rounded-control border border-border p-3 text-xs text-muted-foreground">
          <li>{t("bankConnect.factReadOnly")}</li>
          <li>{t("bankConnect.factKey")}</li>
          <li>{t("bankConnect.factConsent")}</li>
          <li>{t("bankConnect.factHistory")}</li>
          <li>{t("bankConnect.notRegulated")}</li>
        </ul>

        {/* Only once the policy is final: a client component cannot tell a
            production deployment, where the draft is not served, from a
            preview, where it is. */}
        {LEGAL_DRAFT ? null : (
          <Link
            href="/privacy#bank"
            target="_blank"
            className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t("bankConnect.privacyLink")}
          </Link>
        )}
      </div>
    </MobileSheet>
  );
}
