"use client";

import { ArrowUp, ClockCounterClockwise, Plus } from "@phosphor-icons/react";
import { Orb } from "@/components/brand/Orb";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import {
  ACTIVE_NAV,
  MobileShell,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * Questions, as a landing mock (`./frame.tsx`), drawn as `AskView` draws
 * it: the questions in their bubbles on the right, each answer beside the
 * orb with the figures in it as plain text — they are Pluclair's, put in
 * after the AI named them — and the question box with its two small lines.
 * On a desktop « Vos conversations » and « Nouvelle question » head the
 * column; on the phone it is a screen pushed over the tabs, the
 * conversations a row of chips under its header.
 */

/** A sentence with its `{figure}`s filled in, in medium weight. */
function AnswerSentence({
  text,
  figures,
}: {
  text: string;
  figures: Record<string, string>;
}) {
  return (
    <p>
      {text.split(/(\{\w+\})/).map((part, index) => {
        const name = part.match(/^\{(\w+)\}$/)?.[1];
        return name && figures[name] ? (
          <span key={index} className="font-medium tabular-nums">
            {figures[name]}
          </span>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </p>
  );
}

function Conversation() {
  const euro = useEuro();
  const { questions } = landingSampleFor(useLocale());
  const figures = Object.fromEntries(
    Object.entries(questions.figures).map(([key, value]) => [key, euro(value)]),
  );
  return (
    <ol className="flex flex-col gap-4">
      {questions.exchanges.map((exchange) => (
        <li key={exchange.question} className="flex flex-col gap-4">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-card rounded-br-control bg-muted px-4 py-2.5 text-sm">
              {exchange.question}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Orb tone="mark" size="22px" className="mt-1 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm leading-relaxed">
              {exchange.answer.map((sentence) => (
                <AnswerSentence
                  key={sentence}
                  text={sentence}
                  figures={figures}
                />
              ))}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The question box and the two lines under it. */
function Composer() {
  const t = useT();
  return (
    <div className="mt-auto flex flex-col gap-1.5">
      <div className="flex items-end gap-2 rounded-card border border-border bg-background/90 p-2 shadow-lg">
        <span className="min-h-10 flex-1 truncate px-2 py-2 text-base text-muted-foreground">
          {t("ask.placeholder")}
        </span>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ArrowUp size={16} weight="bold" />
        </span>
      </div>
      <p className="px-2 text-center text-[11px] text-muted-foreground">
        {t("ask.onAccount")}
        {" · "}
        {t("ask.kept", { days: 30 })}
      </p>
    </div>
  );
}

export function QuestionsMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();
  const { questions } = landingSampleFor(useLocale());

  if (variant === "mobile") {
    const chips = questions.exchanges.map((exchange) => exchange.question);
    return (
      <MobileShell active={ACTIVE_NAV.questions} back>
        <div className="-mx-4 -mt-2 flex gap-2 overflow-hidden px-4">
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm font-medium">
            <Plus size={14} />
            {t("ask.new")}
          </span>
          {chips.map((chip, index) => (
            <span
              key={chip}
              className={cn(
                "max-w-52 shrink-0 truncate rounded-full border border-border px-3 py-1.5 text-sm",
                index === 0 && "bg-muted",
              )}
            >
              {chip}
            </span>
          ))}
        </div>
        <Conversation />
        <Composer />
      </MobileShell>
    );
  }

  return (
    <WebShell active={ACTIVE_NAV.questions}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 pb-4">
          <span className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <ClockCounterClockwise size={16} />
            {t("ask.history")}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <Plus size={16} />
            {t("ask.new")}
          </span>
        </div>
        <Conversation />
        <Composer />
      </div>
    </WebShell>
  );
}
