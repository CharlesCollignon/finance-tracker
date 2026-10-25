"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import {
  ArrowSquareOut,
  Check,
  Copy,
  EnvelopeSimple,
  EnvelopeSimpleOpen,
  X,
} from "@phosphor-icons/react";
import { formatFullDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { BANK_NAMES, isBankId } from "@finance/core/statement";
import type { MailItem } from "@finance/data/statements";
import { useToast } from "@/components/layout/ToastProvider";
import { FADE, FADE_IN, FADE_OUT } from "@/components/motion/fade";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceChips } from "@/components/ui/Picker";
import {
  dismissStatementMail,
  readStatementInbox,
  renewStatementInbox,
  startStatementInbox,
  stopStatementInbox,
} from "@/lib/actions/statements";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import type { InboxView } from "@finance/data/statements";

/** How long a forwarding code is worth showing. */
const CODE_FRESH_MS = 60 * 60 * 1000;

/** How often to look for the first e-mail, or a code, while the person sets it up. */
const LISTEN_EVERY_MS = 6000;

/** And for how long, before leaving it to a reload. */
const LISTEN_FOR_MS = 15 * 60 * 1000;

type Service = "gmail" | "outlook" | "other";

const STEPS: Record<Service, readonly string[]> = {
  gmail: ["statements.mailGmail1", "statements.mailGmail2", "statements.mailGmail3"],
  outlook: ["statements.mailOutlook1", "statements.mailOutlook2", "statements.mailOutlook3"],
  other: ["statements.mailOther1", "statements.mailOther2"],
};

/**
 * What came by e-mail for an account not known yet, at the top of the
 * import: each to open — the account picked once, the rest as any file —
 * or to set aside.
 */
export function MailWaiting({
  items,
  onOpen,
  onDismissed,
}: {
  items: readonly MailItem[];
  onOpen: (item: MailItem) => void;
  /** Told when one is set aside. */
  onDismissed: (itemId: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  if (items.length === 0) {
    return null;
  }
  return (
    <Card.Bezel className="w-full" innerClassName="flex flex-col gap-3 p-6">
      <h2 className="flex items-center gap-2 font-head text-base">
        <EnvelopeSimpleOpen size={ICON.md} aria-hidden className="text-primary" />
        {t("statements.mailWaitingTitle")}
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const bank = item.bank && isBankId(item.bank) ? BANK_NAMES[item.bank] : null;
            const lines = item.statement.blocks[0]?.lines.length ?? 0;
            return (
              <m.li
                key={item.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0, transition: FADE_OUT }}
                transition={FADE_IN}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {item.kind === "alerts"
                      ? t("statements.mailAlerts", {
                          count: lines,
                          bank: bank ?? t("statements.mailYourBank"),
                        })
                      : bank
                        ? t("statements.statementOf", { bank })
                        : (item.fileName ?? t("statements.statement"))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("statements.mailArrived", {
                      day: formatFullDate(item.receivedAt.slice(0, 10), locale),
                    })}
                    {item.kind === "statement"
                      ? ` · ${t("statements.lines", { count: lines })}`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" onClick={() => onOpen(item)} disabled={pending}>
                    {t("statements.mailPick")}
                  </Button>
                  <button
                    type="button"
                    aria-label={t("statements.mailDismiss")}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await dismissStatementMail(item.id);
                        if (result.error) {
                          toast(resolveMessage(t, result.error), "error");
                        } else {
                          onDismissed(item.id);
                        }
                      })
                    }
                    className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
                  >
                    <X size={ICON.sm} aria-hidden />
                  </button>
                </div>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Card.Bezel>
  );
}

/**
 * « Vos relevés par e-mail, tout seuls » (`docs/plans/STATEMENTS_PLAN.md`,
 * Phase 4): the person's own address, how to have their mail service
 * forward their bank's e-mails there — Gmail's confirmation code shown the
 * moment it arrives, with its link — what has come so far, and the address
 * changed or stopped. Absent where no inbound service is set up.
 */
export function MailInbox({
  view: initial,
  onView,
}: {
  view: InboxView;
  /** Told whenever the view is read again, for what waits above. */
  onView?: (view: InboxView) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const stepsId = useId();
  const [view, setView] = useState(initial);
  const [service, setService] = useState<Service>("gmail");
  const [copied, setCopied] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [pending, startTransition] = useTransition();
  // Read once: the age of a code does not need to move while it is shown.
  const [openedAt] = useState(() => Date.now());

  const inbox = view.inbox;
  const listening = Boolean(inbox?.enabled && inbox.mailsRead === 0);

  // While the person sets it up, look for the first e-mail and the code.
  useEffect(() => {
    if (!listening) {
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > LISTEN_FOR_MS) {
        clearInterval(timer);
        return;
      }
      void readStatementInbox().then((next) => {
        if (next) {
          setView(next);
          onView?.(next);
        }
      });
    }, LISTEN_EVERY_MS);
    return () => clearInterval(timer);
  }, [listening, onView]);

  if (!view.available) {
    return null;
  }

  function act(run: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await run();
      if (result.error) {
        toast(resolveMessage(t, result.error), "error");
        return;
      }
      const next = await readStatementInbox();
      if (next) {
        setView(next);
        onView?.(next);
      }
    });
  }

  const codeFresh =
    inbox?.forwardCode &&
    inbox.forwardCodeAt &&
    openedAt - new Date(inbox.forwardCodeAt).getTime() < CODE_FRESH_MS;

  return (
    <Card.Bezel className="w-full" innerClassName="flex flex-col gap-5 p-6">
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <EnvelopeSimple size={ICON.lg} weight="bold" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-head text-lg">{t("statements.mailTitle")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t("statements.mailBody")}
          </p>
        </div>
      </header>

      {!inbox ? (
        <Button
          className="self-start"
          disabled={pending}
          onClick={() => act(startStatementInbox)}
        >
          {pending ? t("statements.mailStarting") : t("statements.mailStart")}
        </Button>
      ) : !inbox.enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{t("statements.mailStopped")}</p>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => act(startStatementInbox)}
          >
            {t("statements.mailRestart")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("statements.mailAddress")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all rounded-control border border-border bg-background px-3 py-2 font-mono text-sm">
                {view.address}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(view.address ?? "")
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    });
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <m.span
                    key={copied ? "done" : "copy"}
                    {...FADE}
                    className="mr-1.5 inline-flex"
                  >
                    {copied ? (
                      <Check size={ICON.sm} weight="bold" aria-hidden className="text-success" />
                    ) : (
                      <Copy size={ICON.sm} aria-hidden />
                    )}
                  </m.span>
                </AnimatePresence>
                {copied ? t("statements.mailCopied") : t("statements.mailCopy")}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {codeFresh ? (
              <m.div
                {...FADE}
                className="flex flex-col gap-2 rounded-control border border-primary/40 bg-accent p-4"
                role="status"
              >
                <p className="text-sm font-medium">{t("statements.mailCodeTitle")}</p>
                <p className="font-mono text-2xl tracking-widest tabular-nums">
                  {inbox.forwardCode}
                </p>
                <p className="text-xs text-muted-foreground">{t("statements.mailCodeBody")}</p>
                {inbox.forwardLink ? (
                  <Button
                    size="sm"
                    className="self-start"
                    render={
                      <a href={inbox.forwardLink} target="_blank" rel="noreferrer noopener">
                        {t("statements.mailCodeConfirm")}
                        <ArrowSquareOut size={ICON.sm} className="ml-1.5 inline" aria-hidden />
                      </a>
                    }
                  />
                ) : null}
              </m.div>
            ) : null}
          </AnimatePresence>

          <div className="flex flex-col gap-3">
            <p id={stepsId} className="text-sm font-medium">
              {t("statements.mailHow")}
            </p>
            <ChoiceChips
              labelledBy={stepsId}
              options={[
                { value: "gmail", label: "Gmail" },
                { value: "outlook", label: "Outlook" },
                { value: "other", label: t("statements.mailOther") },
              ]}
              value={service}
              onValueChange={setService}
            />
            <AnimatePresence mode="wait" initial={false}>
              <m.ol
                key={service}
                {...FADE}
                className="flex flex-col gap-2.5"
              >
                {STEPS[service].map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">
                      {t(step as Parameters<typeof t>[0])}
                    </span>
                  </li>
                ))}
              </m.ol>
            </AnimatePresence>
            <p className="text-xs text-muted-foreground">{t("statements.mailAlertsTip")}</p>
          </div>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {inbox.lastMailAt
              ? [
                  t("statements.mailLast", {
                    day: formatFullDate(inbox.lastMailAt.slice(0, 10), locale),
                  }),
                  inbox.linesBrought > 0 ? t("statements.mailLines", { count: inbox.linesBrought }) : null,
                  inbox.mailsIgnored > 0
                    ? t("statements.mailIgnored", { count: inbox.mailsIgnored })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : t("statements.mailListening")}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (!renewing) {
                  setRenewing(true);
                  return;
                }
                setRenewing(false);
                act(renewStatementInbox);
              }}
            >
              {renewing ? t("statements.mailRenewSure") : t("statements.mailRenew")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => act(stopStatementInbox)}
            >
              {t("statements.mailStop")}
            </Button>
          </div>
        </>
      )}
    </Card.Bezel>
  );
}
