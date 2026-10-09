"use client";

import type { ReactNode } from "react";
import { ArrowUp, ClockCounterClockwise } from "@phosphor-icons/react";
import { Orb } from "@/components/brand/Orb";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import {
  ACTIVE_NAV,
  MOBILE_HEIGHT,
  MOBILE_WIDTH,
  MockViewport,
  WEB_HEIGHT,
  WEB_WIDTH,
  MobileShell,
  type Variant,
  WebShell,
  useEuro,
} from "@/components/marketing/mocks/frame";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/** « Questions », as a landing mock (`./frame.tsx`). */

/**
 * A sentence of the answer with its figures put in, the way the app puts
 * them: the model names a figure, Pluclair writes its own value, set apart
 * in gold so the reader sees which words are numbers the app vouches for.
 */
function AnswerSentence({
  text,
  figures,
}: {
  text: string;
  figures: Record<string, string>;
}) {
  const parts = text.split(/(\{\w+\})/);
  return (
    <p>
      {parts.map((part, index) => {
        const name = part.match(/^\{(\w+)\}$/)?.[1];
        return name && figures[name] ? (
          <span
            key={index}
            className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-primary tabular-nums"
          >
            {figures[name]}
          </span>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </p>
  );
}

function Conversation({ compact }: { compact: boolean }) {
  const t = useT();
  const euro = useEuro();
  const { questions } = landingSampleFor(useLocale());
  const figures = Object.fromEntries(
    Object.entries(questions.figures).map(([key, value]) => [key, euro(value)]),
  );
  return (
    <div className={cn("flex flex-1 flex-col", compact ? "gap-4" : "gap-6")}>
      <div className="flex justify-end">
        <p
          className={cn(
            "max-w-[80%] rounded-2xl rounded-br-md bg-secondary text-foreground",
            compact ? "px-3.5 py-2.5 text-sm" : "px-4 py-3 text-base",
          )}
        >
          {questions.question}
        </p>
      </div>
      <div className="flex items-start gap-3">
        <Orb
          tone="mark"
          size={compact ? "22px" : "26px"}
          className="mt-0.5 shrink-0"
        />
        <div
          className={cn(
            "flex flex-col gap-2 leading-relaxed",
            compact ? "text-sm" : "text-base",
          )}
        >
          {questions.answer.map((sentence) => (
            <AnswerSentence key={sentence} text={sentence} figures={figures} />
          ))}
        </div>
      </div>
      <Composer compact={compact} placeholder={t("ask.placeholder")}>
        {t("ask.kept", { days: 30 })}
      </Composer>
    </div>
  );
}

function Composer({
  compact,
  placeholder,
  children,
}: {
  compact: boolean;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-auto flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5">
        <span
          className={cn(
            "flex-1 truncate text-muted-foreground",
            compact ? "text-sm" : "text-base",
          )}
        >
          {placeholder}
        </span>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ArrowUp size={16} weight="bold" />
        </span>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

export function QuestionsMock({ variant = "web" }: { variant?: Variant }) {
  const t = useT();
  if (variant === "mobile") {
    return (
      <MockViewport width={MOBILE_WIDTH} height={MOBILE_HEIGHT}>
        <MobileShell active={ACTIVE_NAV.questions}>
          <Conversation compact />
        </MobileShell>
      </MockViewport>
    );
  }
  return (
    <MockViewport width={WEB_WIDTH} height={WEB_HEIGHT}>
      <WebShell active={ACTIVE_NAV.questions}>
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <ClockCounterClockwise size={14} />
            {t("ask.history")}
          </span>
          <Conversation compact={false} />
        </div>
      </WebShell>
    </MockViewport>
  );
}
