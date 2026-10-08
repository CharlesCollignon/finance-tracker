"use client";

import {
  useEffect,
  useId,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  CheckCircle,
  FileArrowUp,
  XCircle,
} from "@phosphor-icons/react";
import { BANK_CONSENT_VERSION } from "@finance/core/bank-consent";
import {
  BANK_WIZARD_STEPS,
  bankWizardStepFor,
  type BankWizardStep,
} from "@finance/core/bank-wizard";
import { resolveMessage } from "@finance/core/i18n/t";
import { Button, buttonVariants } from "@/components/ui/Button";
import { MobileSheet } from "@/components/ui/MobileSheet";
import { LEGAL_DRAFT } from "@/components/marketing/legal-status";
import { useToast } from "@/components/layout/ToastProvider";
import {
  connectBankFile,
  readBankWizardStep,
  saveBankWizardStep,
} from "@/lib/actions/bank-connect";
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
 * Setting up a bank, from nothing to syncing, one step at a time.
 *
 * The user brings their own open-banking.io account: they sign up there, pay
 * there, connect their bank there, and download the credentials file that
 * lets Pluclair read it. Each of those is a step of its own, with the link it
 * needs and a « C'est fait », and the money is stated plainly and as someone
 * else's on the first. The third shows the one trap — a second file with the
 * same name and no API key — as a picture. The step reached is remembered
 * for the account (`bank-wizard`), so a setup begun on the phone carries on
 * here.
 *
 * The last step is the whole of Pluclair's part: drop the file. It is read in
 * the browser only to be sent, once, to `connectBankFile`, which checks it
 * against open-banking.io before keeping it — so a file that cannot work is
 * refused while the person is still looking, back on the step where it is
 * put right (`bankWizardStepFor`).
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
  const [step, setStep] = useState<BankWizardStep>(1);

  // Where this account stopped, on whichever device, each time it opens.
  useEffect(() => {
    if (!open) {
      return;
    }
    let current = true;
    void readBankWizardStep().then((reached) => {
      if (current) {
        setStep(reached);
      }
    });
    return () => {
      current = false;
    };
  }, [open]);

  function goTo(next: BankWizardStep) {
    setProblem(null);
    setStep(next);
    void saveBankWizardStep(next);
  }

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
        setStep(bankWizardStepFor(result.error));
        setProblem(resolveMessage(t, result.error));
        return;
      }
      if (result.outcome === "connected" && result.accounts === 0) {
        // The file works; the bank is what is missing. Back to connecting
        // it, from where « C'est fait » leads on to the file again.
        setStep(2);
        setProblem(t("bankConnect.noAccountsYet"));
        return;
      }
      onOpenChange(false);
      toast(
        result.outcome === "paused"
          ? t("bankConnect.connectedPaused")
          : t("bankConnect.connected"),
        result.outcome === "connected" ? "success" : "default",
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

  const steps: Record<
    BankWizardStep,
    { title: string; body: string; href?: string }
  > = {
    1: {
      title: t("bankConnect.step1Title"),
      body: t("bankConnect.step1Body"),
      href: OPEN_BANKING_APP,
    },
    2: { title: t("bankConnect.step2Title"), body: t("bankConnect.step2Body") },
    3: {
      title: t("bankConnect.step3Title"),
      body: t("bankConnect.step3Body"),
      href: OPEN_BANKING_DEVELOPERS,
    },
    4: { title: t("bankConnect.step4Title"), body: t("bankConnect.step4Body") },
  };
  const shown = steps[step];

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
        {step === 1 ? (
          <p className="text-sm text-muted-foreground">
            {t("bankConnect.sheetLead")}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t("bankConnect.stepOf", { step, total: BANK_WIZARD_STEPS })}
          </p>
          <div aria-hidden className="flex gap-1.5">
            {[1, 2, 3, 4].map((dot) => (
              <span
                key={dot}
                className={cn(
                  "h-1.5 w-6 rounded-full",
                  dot <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </div>

        <section aria-live="polite" className="flex gap-3">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {step}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium">{shown.title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{shown.body}</p>
            {shown.href ? (
              <a
                href={shown.href}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-3 gap-1.5",
                )}
              >
                {t("bankConnect.openSite")}
                <ArrowSquareOut size={ICON.sm} aria-hidden />
              </a>
            ) : null}
          </div>
        </section>

        {step === 3 ? <RightFile /> : null}

        {problem && step !== 4 ? (
          <p
            role="alert"
            className="rounded-control border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm"
          >
            {problem}
          </p>
        ) : null}

        {step === 4 ? (
          <>
            {/* The consent is the last thing read before the file goes: it
                names who the data comes from, what Pluclair does with it, and
                how it is withdrawn, and its version is stored with the
                connection. */}
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
                {pending
                  ? t("bankConnect.checking")
                  : t("bankConnect.dropTitle")}
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

            {/* Only once the policy is final: a client component cannot tell
                a production deployment, where the draft is not served, from
                a preview, where it is. */}
            {LEGAL_DRAFT ? null : (
              <Link
                href="/privacy#bank"
                target="_blank"
                className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {t("bankConnect.privacyLink")}
              </Link>
            )}
          </>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goTo((step - 1) as BankWizardStep)}
            >
              {t("bankConnect.previous")}
            </Button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => goTo((step + 1) as BankWizardStep)}
            >
              {t("bankConnect.done")}
            </Button>
          ) : null}
        </div>
      </div>
    </MobileSheet>
  );
}

/**
 * The trap of the third step, drawn: the file to take comes from the API
 * key's window, and the « Clé de chiffrement » card gives one with the same
 * name and no key. Two cards, the right one first.
 */
function RightFile() {
  const t = useT();
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {t("bankConnect.trapTitle")}
      </figcaption>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-control border border-success/50 p-3">
          <p className="text-xs text-muted-foreground">
            {t("bankConnect.trapRight")}
          </p>
          <p className="flex items-center gap-1.5 rounded-control bg-muted px-2 py-1.5 font-mono text-xs">
            <FileArrowUp size={ICON.sm} aria-hidden />
            {t("bankConnect.trapFile")}
          </p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle size={ICON.sm} weight="fill" aria-hidden />
            {t("bankConnect.trapRightNote")}
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-control border border-destructive/40 p-3">
          <p className="text-xs text-muted-foreground">
            {t("bankConnect.trapWrong")}
          </p>
          <p className="flex items-center gap-1.5 rounded-control bg-muted px-2 py-1.5 font-mono text-xs opacity-70">
            <FileArrowUp size={ICON.sm} aria-hidden />
            {t("bankConnect.trapFile")}
          </p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <XCircle size={ICON.sm} weight="fill" aria-hidden />
            {t("bankConnect.trapWrongNote")}
          </p>
        </div>
      </div>
    </figure>
  );
}
