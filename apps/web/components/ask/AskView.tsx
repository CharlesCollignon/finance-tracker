"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import {
  ArrowUp,
  ChatCircleText,
  ClockCounterClockwise,
  Info,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import {
  ASK_KEEP_DAYS,
  MAX_ASK_QUESTION,
  renderAskSentences,
  type AskAnswerBody,
} from "@finance/core/ask";
import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { EASE_STANDARD } from "@finance/core/motion";
import type { ReadSegment } from "@finance/core/month-read";
import type { AskConversation, AskMessage } from "@finance/data/ask";
import { Orb } from "@/components/brand/Orb";
import { ConnectAiInvite } from "@/components/finance/ConnectAiInvite";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useToast } from "@/components/layout/ToastProvider";
import { askAction, deleteConversationAction } from "@/lib/actions/ask";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** A message's arrival: up a little, settled by a spring. */
const ARRIVE = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 380, damping: 30 },
} as const;

const SUGGESTIONS = [
  "ask.suggest1",
  "ask.suggest2",
  "ask.suggest3",
  "ask.suggest4",
] as const;

/**
 * « Questions » (Ask Pluclair): one centred column, as a conversation reads
 * — the messages, and the question box pinned to the bottom of the screen
 * above the bar. The last thirty days' conversations slide in from the side
 * on demand. The question in flight shows at once, with Pluclair looking at
 * the figures until the answer springs in. With no AI account connected,
 * the page says how to connect one instead.
 */
export function AskView({
  conversations,
  currentId,
  messages,
  writable,
}: {
  conversations: AskConversation[];
  currentId: string | null;
  messages: AskMessage[];
  /** Whether a model can be asked here at all: an AI account connected. */
  writable: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  const canAsk = writable && !pending;

  // The latest message in view as it lands.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, asking]);

  function ask(question: string) {
    const text = question.trim();
    if (!text || !canAsk) {
      return;
    }
    setAsking(text);
    setDraft("");
    startTransition(async () => {
      const outcome = await askAction(text, currentId);
      setAsking(null);
      if (outcome.message) {
        toast(resolveMessage(t, outcome.message), "error");
        setDraft(text);
        return;
      }
      if (outcome.conversationId && outcome.conversationId !== currentId) {
        router.replace(`/ask?c=${outcome.conversationId}`);
      }
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(draft);
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteConversationAction(id);
      toast(
        resolveMessage(t, result.error ?? result.message ?? "ask.deleted"),
        result.error ? "error" : "success",
      );
      if (id === currentId) {
        router.replace("/ask");
      }
    });
  }

  const empty = messages.length === 0 && !asking;

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          {/* The two ways out of this conversation: the others, or a new one. */}
          <div className="flex items-center justify-between gap-2 pb-2">
            <button
              type="button"
              onClick={() => setHistory(true)}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
            >
              <ClockCounterClockwise size={ICON.md} />
              {t("ask.history")}
            </button>
            {currentId ? (
              <Link
                href="/ask"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-hover hover:bg-muted hover:text-foreground"
              >
                <Plus size={ICON.md} />
                {t("ask.new")}
              </Link>
            ) : null}
          </div>

          {/* Room under the last message for the box pinned below. */}
          <section className="flex min-h-[55vh] flex-col gap-4 pb-48">
            {!writable ? (
              <div className="my-auto flex flex-col items-center gap-4 py-6">
                <Orb size="56px" />
                <ConnectAiInvite variant="card" className="w-full" />
              </div>
            ) : empty ? (
              <m.div
                {...ARRIVE}
                className="my-auto flex flex-col items-center gap-4 py-10 text-center"
              >
                <Orb size="56px" />
                <p className="max-w-md text-sm text-muted-foreground">
                  {t("ask.intro")}
                </p>
                <div className="flex max-w-xl flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((key, index) => (
                    <m.button
                      key={key}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        ease: EASE,
                        delay: 0.08 * index,
                      }}
                      whileTap={{ scale: 0.97 }}
                      disabled={!canAsk}
                      onClick={() => ask(t(key))}
                      className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors duration-hover hover:bg-muted disabled:opacity-50"
                    >
                      {t(key)}
                    </m.button>
                  ))}
                </div>
              </m.div>
            ) : (
              <ol className="flex flex-col gap-4" aria-live="polite">
                {messages.map((message) => (
                  <m.li key={message.id} {...ARRIVE}>
                    {message.role === "question" ? (
                      <Question text={message.body.text} />
                    ) : (
                      <Answer body={message.body} />
                    )}
                  </m.li>
                ))}
                {asking ? (
                  <>
                    <m.li key="asking" {...ARRIVE}>
                      <Question text={asking} />
                    </m.li>
                    <m.li key="thinking" {...ARRIVE}>
                      <Thinking label={t("ask.thinking")} />
                    </m.li>
                  </>
                ) : null}
              </ol>
            )}
            <div ref={end} />
          </section>
        </div>

        {/* The question box, pinned to the bottom of the screen: above the
            bar at phone width, a little off the edge from `md`. */}
        {writable ? (
          <form
            onSubmit={submit}
            className={cn(
              "fixed inset-x-0 z-30 px-4",
              "bottom-[calc(var(--shell-bottom-nav-height)+var(--shell-bottom-nav-inset)+env(safe-area-inset-bottom,0px)+0.75rem)]",
              "md:bottom-6 md:pl-[var(--scrollbar-gutter)]",
            )}
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5">
              <div className="flex items-end gap-2 rounded-card border border-border bg-background/90 p-2 shadow-lg backdrop-blur">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      ask(draft);
                    }
                  }}
                  rows={1}
                  maxLength={MAX_ASK_QUESTION}
                  placeholder={t("ask.placeholder")}
                  aria-label={t("ask.placeholder")}
                  className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground"
                />
                <m.button
                  type="submit"
                  whileTap={{ scale: 0.92 }}
                  disabled={!canAsk || draft.trim().length === 0}
                  aria-label={t("ask.send")}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-hover disabled:opacity-40"
                >
                  <ArrowUp size={ICON.md} weight="bold" />
                </m.button>
              </div>
              <p
                className={cn("px-2 text-center text-muted-foreground", MICRO)}
              >
                {t("ask.onAccount")}
                {" · "}
                {t("ask.kept", { days: ASK_KEEP_DAYS })}
              </p>
            </div>
          </form>
        ) : null}

        {/* The last thirty days, sliding in from the side. */}
        <AnimatePresence>
          {history ? (
            <>
              <m.button
                key="scrim"
                type="button"
                aria-label={t("common.close")}
                onClick={() => setHistory(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/40"
              />
              <m.aside
                key="panel"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col gap-2 border-r border-border bg-background p-4 pt-safe"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t("ask.history")}</p>
                  <button
                    type="button"
                    onClick={() => setHistory(false)}
                    aria-label={t("common.close")}
                    className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X size={ICON.md} />
                  </button>
                </div>
                <Link
                  href="/ask"
                  onClick={() => setHistory(false)}
                  className="flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm font-medium transition-colors duration-hover hover:bg-muted"
                >
                  <Plus size={ICON.md} />
                  {t("ask.new")}
                </Link>
                {conversations.length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">
                    {t("ask.historyEmpty")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1 overflow-y-auto">
                    <AnimatePresence initial={false}>
                      {conversations.map((conversation) => (
                        <m.li
                          key={conversation.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className={cn(
                            "group flex items-center gap-1 rounded-control",
                            conversation.id === currentId
                              ? "bg-muted"
                              : "hover:bg-muted/60",
                          )}
                        >
                          <Link
                            href={`/ask?c=${conversation.id}`}
                            onClick={() => setHistory(false)}
                            className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm"
                          >
                            <ChatCircleText
                              size={ICON.sm}
                              className="shrink-0 text-muted-foreground"
                            />
                            <span className="truncate">
                              {conversation.title}
                            </span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => remove(conversation.id)}
                            aria-label={t("ask.delete")}
                            title={t("ask.delete")}
                            className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive"
                          >
                            <Trash size={ICON.sm} />
                          </button>
                        </m.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </m.aside>
            </>
          ) : null}
        </AnimatePresence>
      </MotionConfig>
    </LazyMotion>
  );
}

function Question({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-card rounded-br-control bg-muted px-4 py-2.5 text-sm">
        {text}
      </p>
    </div>
  );
}

function Answer({ body }: { body: AskAnswerBody }) {
  const t = useT();
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 shrink-0">
        <Orb size="22px" tone="mark" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm leading-relaxed">
        <AnswerBody body={body} />
        {"advice" in body && body.advice ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info size={ICON.sm} className="mt-0.5 shrink-0" />
            {t("ask.noAdvice")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AnswerBody({ body }: { body: AskAnswerBody }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  if (body.kind === "facts") {
    return (
      <>
        {renderAskSentences(body, format).map((segments, index) => (
          <p key={index}>
            <Segments segments={segments} />
          </p>
        ))}
      </>
    );
  }
  if (body.kind === "search") {
    if (body.count === 0) {
      return <p>{t("ask.searchNone", { query: body.query })}</p>;
    }
    return (
      <>
        <p className="font-medium">
          {t("ask.searchHeading", { count: body.count, query: body.query })}
        </p>
        <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
          {body.rows.map((row, index) => (
            <li
              key={`${row.occurredOn}-${index}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate">{row.note}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatShortDate(row.occurredOn, locale)} · {row.category}
                </span>
              </span>
              <PrivateAmount
                className={cn(
                  "shrink-0 tabular-nums",
                  row.amount > 0 ? "text-success" : undefined,
                )}
              >
                {format(row.amount)}
              </PrivateAmount>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          <PrivateAmount>
            {t("ask.searchSpent", { amount: format(body.spent) })}
          </PrivateAmount>
        </p>
        {body.more ? (
          <p className="text-xs text-muted-foreground">{t("ask.searchMore")}</p>
        ) : null}
      </>
    );
  }
  return <p>{body.kind === "outside" ? t("ask.outside") : t("ask.empty")}</p>;
}

/** Prose and figures; each figure its own element, so the blur reaches it. */
function Segments({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <PrivateAmount
            key={index}
            title={segment.label}
            className="font-medium tabular-nums text-foreground"
          >
            {segment.display}
          </PrivateAmount>
        ),
      )}
    </>
  );
}

/**
 * Pluclair at work: three dots that rise in turn while the answer is on its
 * way — and only then; with reduced motion, the words alone.
 */
function Thinking({ label }: { label: string }) {
  const reduced = useReducedMotion();
  return (
    <div className="flex items-center gap-3" role="status">
      <Orb size="22px" tone="mark" />
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {label}
        {reduced ? null : (
          <span aria-hidden className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <m.span
                key={dot}
                className="size-1.5 rounded-full bg-muted-foreground"
                animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  delay: dot * 0.15,
                  ease: EASE,
                }}
              />
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
