"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
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
  ArrowsDownUp,
  ArrowUp,
  Calculator,
  CalendarBlank,
  CaretDown,
  ChartPieSlice,
  ChatCircleText,
  Check,
  ClockCounterClockwise,
  Copy,
  HourglassMedium,
  House,
  Info,
  ListBullets,
  PiggyBank,
  Plus,
  Repeat,
  Stop,
  Storefront,
  Trash,
  TrendUp,
  X,
  type Icon,
} from "@phosphor-icons/react";
import {
  ASK_KEEP_DAYS,
  MAX_ASK_QUESTION,
  renderAskSentences,
  type AskAnswerBody,
} from "@finance/core/ask";
import type {
  AskChatBody,
  AskChatTool,
  AskStreamEvent,
} from "@finance/core/ask-chat";
import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import { EASE_STANDARD } from "@finance/core/motion";
import type { ReadSegment } from "@finance/core/month-read";
import type { AskConversation, AskMessage } from "@finance/data/ask";
import { Orb } from "@/components/brand/Orb";
import { ConnectAiInvite } from "@/components/finance/ConnectAiInvite";
import { PrivateAmount } from "@/components/layout/PrivateAmount";
import { useToast } from "@/components/layout/ToastProvider";
import { deleteConversationAction } from "@/lib/actions/ask";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { AskMarkdown } from "./AskMarkdown";

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

/** Each tool's mark, beside its name while the model is at work. */
const STEP_ICONS: Record<AskChatTool, Icon> = {
  month: CalendarBlank,
  cashflow: ArrowsDownUp,
  categories: ChartPieSlice,
  transactions: ListBullets,
  merchants: Storefront,
  recurring: Repeat,
  savings: PiggyBank,
  investments: TrendUp,
  loans: House,
  loan_prepayment: HourglassMedium,
  calculate: Calculator,
};

/** A question on its way: what was asked, what was looked at, the words so far. */
interface Live {
  question: string;
  steps: AskChatTool[];
  text: string;
  /** How many messages the conversation had when it was asked. */
  before: number;
  /** Kept on the server: drawn from the conversation once it is read back. */
  done: boolean;
}

/**
 * « Questions » (Ask Pluclair): one centred column, as a conversation reads
 * — the messages, and the question box pinned to the bottom of the screen
 * above the bar. The last thirty days' conversations slide in from the side
 * on demand.
 *
 * A question is answered as it is written (`api/ask/stream`): each thing the
 * model looks at pops in as a chip, then the answer's words arrive under
 * them; the box's button stops it. Once kept, the exchange is read back
 * from the server and the live one gives way to it. With no AI account
 * connected, the page says how to connect one instead.
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
  const [live, setLive] = useState<Live | null>(null);
  const [history, setHistory] = useState(false);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  const asking = live !== null && !live.done;
  // Once the kept exchange has been read back, the live one gives way to it.
  const shown =
    live && !(live.done && messages.length > live.before) ? live : null;
  const canAsk = writable && !asking && !pending;

  // The latest message in view as it lands, and as the answer grows.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, live?.steps.length, live?.text.length]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || !canAsk) {
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setDraft("");
    setLive({
      question: text,
      steps: [],
      text: "",
      before: currentId ? messages.length : 0,
      done: false,
    });

    const fail = (message: string) => {
      setLive(null);
      setDraft(text);
      toast(resolveMessage(t, message), "error");
    };

    try {
      const response = await fetch("/api/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, conversationId: currentId }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        fail(body?.error ?? "ask.noAnswer");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          const event = JSON.parse(line) as AskStreamEvent;
          if (event.type === "step") {
            setLive((now) =>
              now ? { ...now, steps: [...now.steps, event.tool] } : now,
            );
          } else if (event.type === "text") {
            setLive((now) =>
              now ? { ...now, text: now.text + event.text } : now,
            );
          } else if (event.type === "reset") {
            setLive((now) => (now ? { ...now, text: "" } : now));
          } else if (event.type === "error") {
            finished = true;
            fail(event.message);
          } else {
            finished = true;
            setLive((now) => (now ? { ...now, done: true } : now));
            const id = event.conversationId;
            startTransition(() => {
              if (id !== currentId) {
                router.replace(`/ask?c=${id}`);
              } else {
                router.refresh();
              }
            });
          }
        }
      }
      if (!finished) {
        fail("ask.noAnswer");
      }
    } catch {
      if (controller.signal.aborted) {
        setLive(null);
        setDraft(text);
        toast(t("ask.stopped"), "success");
      } else {
        fail("ask.noAnswer");
      }
    } finally {
      abort.current = null;
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (asking) {
      abort.current?.abort();
      return;
    }
    void ask(draft);
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

  const empty = messages.length === 0 && !shown;

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
          <section className="flex min-h-[55vh] flex-col gap-4 pb-52">
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
                      onClick={() => void ask(t(key))}
                      className="rounded-full border border-border px-3 py-1.5 text-sm transition-colors duration-hover hover:bg-muted disabled:opacity-50"
                    >
                      {t(key)}
                    </m.button>
                  ))}
                </div>
              </m.div>
            ) : (
              <ol className="flex flex-col gap-5" aria-live="polite">
                {messages.map((message, index) => (
                  <m.li
                    key={message.id}
                    {...ARRIVE}
                    // The exchange just answered live is already on screen:
                    // it takes the live one's place without arriving again.
                    initial={
                      live?.done && index >= live.before
                        ? false
                        : ARRIVE.initial
                    }
                  >
                    {message.role === "question" ? (
                      <Question text={message.body.text} />
                    ) : (
                      <Answer body={message.body} />
                    )}
                  </m.li>
                ))}
                {shown ? (
                  <>
                    <m.li key="asking" {...ARRIVE}>
                      <Question text={shown.question} />
                    </m.li>
                    <m.li key="answering" {...ARRIVE}>
                      <LiveAnswer live={shown} />
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
                      void ask(draft);
                    }
                  }}
                  rows={1}
                  maxLength={MAX_ASK_QUESTION}
                  placeholder={t("ask.placeholder")}
                  aria-label={t("ask.placeholder")}
                  className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground"
                />
                <m.button
                  type="submit"
                  whileTap={{ scale: 0.92 }}
                  disabled={!asking && (!canAsk || draft.trim().length === 0)}
                  aria-label={asking ? t("ask.stop") : t("ask.send")}
                  title={asking ? t("ask.stop") : undefined}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity duration-hover disabled:opacity-40"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <m.span
                      key={asking ? "stop" : "send"}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                      className="flex"
                    >
                      {asking ? (
                        <Stop size={ICON.md} weight="fill" />
                      ) : (
                        <ArrowUp size={ICON.md} weight="bold" />
                      )}
                    </m.span>
                  </AnimatePresence>
                </m.button>
              </div>
              <p
                className={cn("px-2 text-center text-muted-foreground", MICRO)}
              >
                {t("ask.disclaimer")}
                {" · "}
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
      <p className="max-w-[85%] whitespace-pre-wrap rounded-card rounded-br-control bg-muted px-4 py-2.5 text-sm">
        {text}
      </p>
    </div>
  );
}

/** Pluclair's side of the conversation: its mark, then what it says. */
function Turn({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">
        <Orb size="22px" tone="mark" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">{children}</div>
    </div>
  );
}

/**
 * The answer being written: the things looked at so far, each popping in,
 * then the words with a caret at their end. Before any word, the steps and
 * three dots say Pluclair is at it.
 */
function LiveAnswer({ live }: { live: Live }) {
  const t = useT();
  return (
    <Turn>
      {live.steps.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {live.steps.map((tool, index) => (
              <StepChip
                key={`${tool}-${index}`}
                tool={tool}
                working={!live.text && index === live.steps.length - 1}
              />
            ))}
          </AnimatePresence>
        </ul>
      ) : null}
      {live.text ? (
        <div className="relative">
          <AskMarkdown markdown={live.text} />
          {live.done ? null : <Caret />}
        </div>
      ) : (
        <Thinking label={t("ask.thinking")} />
      )}
    </Turn>
  );
}

function StepChip({ tool, working }: { tool: AskChatTool; working: boolean }) {
  const t = useT();
  const Mark = STEP_ICONS[tool];
  return (
    <m.li
      layout
      initial={{ opacity: 0, scale: 0.6, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground",
        working && "bg-muted/60",
      )}
    >
      <Mark size={ICON.sm} />
      {t(`ask.step.${tool}`)}
      {working ? null : (
        <m.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 600, damping: 22 }}
          className="flex"
        >
          <Check size={ICON.xs} weight="bold" className="text-success" />
        </m.span>
      )}
    </m.li>
  );
}

/** The end of the words still coming: a bar that breathes. */
function Caret() {
  const reduced = useReducedMotion();
  return (
    <m.span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 rounded-full bg-foreground/70 align-baseline"
      animate={reduced ? undefined : { opacity: [1, 0.2, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: EASE }}
    />
  );
}

function Answer({ body }: { body: AskAnswerBody }) {
  const t = useT();
  if (body.kind === "chat") {
    return <ChatAnswer body={body} />;
  }
  return (
    <Turn>
      <div className="flex flex-col gap-2 text-sm leading-relaxed">
        <FirstAnswerBody body={body} />
      </div>
      {"advice" in body && body.advice ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info size={ICON.sm} className="mt-0.5 shrink-0" />
          {t("ask.noAdvice")}
        </p>
      ) : null}
    </Turn>
  );
}

/**
 * A kept answer: what was looked at, folded into one line that opens; the
 * answer; a word on the figures the app could not find; and a copy.
 */
function ChatAnswer({ body }: { body: AskChatBody }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const steps = body.steps;

  async function copy() {
    try {
      await navigator.clipboard.writeText(body.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // No clipboard here (an insecure origin, a refusal): nothing to undo.
    }
  }

  return (
    <Turn>
      {steps.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((now) => !now)}
            aria-expanded={open}
            className="flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors duration-hover hover:text-foreground"
          >
            {t("ask.looked", { count: steps.length })}
            <m.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="flex"
            >
              <CaretDown size={ICON.xs} />
            </m.span>
          </button>
          <AnimatePresence initial={false}>
            {open ? (
              <m.ul
                key="steps"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="flex flex-wrap gap-1.5 overflow-hidden"
              >
                {steps.map((step, index) => (
                  <StepChip
                    key={`${step.tool}-${index}`}
                    tool={step.tool}
                    working={false}
                  />
                ))}
              </m.ul>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
      <AskMarkdown markdown={body.markdown} untraced={body.untraced} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1 rounded-full py-1 text-xs text-muted-foreground transition-colors duration-hover hover:text-foreground"
        >
          {copied ? <Check size={ICON.xs} /> : <Copy size={ICON.xs} />}
          {copied ? t("ask.copied") : t("ask.copy")}
        </button>
        {body.untraced.length > 0 ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info size={ICON.xs} className="shrink-0" />
            {t("ask.untracedNote", { count: body.untraced.length })}
          </p>
        ) : null}
      </div>
    </Turn>
  );
}

/** An answer from before the conversations: sentences, or a search's rows. */
function FirstAnswerBody({
  body,
}: {
  body: Exclude<AskAnswerBody, AskChatBody>;
}) {
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
    <div className="flex items-center gap-2" role="status">
      <span className="text-sm text-muted-foreground">{label}</span>
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
    </div>
  );
}
