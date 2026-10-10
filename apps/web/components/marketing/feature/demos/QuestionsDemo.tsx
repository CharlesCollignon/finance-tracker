"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { AskChatTool } from "@finance/core/ask-chat";
import { formatDayMonth } from "@finance/core/constants";
import { Orb } from "@/components/brand/Orb";
import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { LocalisedLandingCopy } from "@/components/marketing/landing-copy";
import { useLocale, useT } from "@/lib/locale-context";
import { useFormatCurrency } from "@/lib/use-currency";
import { Chip } from "./parts";

type Copy = LocalisedLandingCopy["demos"]["questions"];

/**
 * « Questions », played: pick one, it rises as asked, the orb looks at the
 * figures for a beat — what it looks at popping in as chips — and the
 * answer arrives word by word with its figures set in gold. The sample's
 * Markdown is read as words here: the bold and the list are the app's to
 * draw, the rhythm is the demo's.
 */
export function QuestionsDemo({ copy }: { copy: Copy }) {
  const t = useT();
  const locale = useLocale();
  const euro = useFormatCurrency();
  const still = useReducedMotion() ?? false;
  const { questions, leftToSpend } = landingSampleFor(locale);
  const exchanges: {
    question: string;
    steps: AskChatTool[];
    answer: string;
  }[] = [
    ...questions.exchanges,
    { question: copy.third, steps: ["month"], answer: copy.thirdAnswer },
  ];
  const figures: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(questions.figures).map(([key, value]) => [
        key,
        euro(value),
      ]),
    ),
    left: euro(leftToSpend.amount),
    perDay: euro(leftToSpend.perDay),
    date: formatDayMonth(leftToSpend.through, locale),
  };
  const [chosen, setChosen] = useState(0);
  const [thinkingFor, setThinkingFor] = useState<number | null>(0);
  const thinking = thinkingFor === chosen && !still;

  useEffect(() => {
    if (thinkingFor === null) return;
    const timer = setTimeout(() => setThinkingFor(null), 1000);
    return () => clearTimeout(timer);
  }, [thinkingFor]);

  function ask(index: number) {
    setChosen(index);
    setThinkingFor(index);
  }

  const exchange = exchanges[chosen]!;
  const answer = exchange.answer
    .replace(/\*\*/g, "")
    .replace(/\s*\n+(?:- )?/g, " ")
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .flatMap((part) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1];
      return name && name !== "date" && figures[name]
        ? [{ figure: true, text: figures[name]! }]
        : part
            .replace("{date}", figures.date!)
            .split(" ")
            .filter(Boolean)
            .map((text) => ({ figure: false, text }));
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        {exchanges.map((item, index) => (
          <Chip
            key={item.question}
            active={index === chosen}
            onClick={() => ask(index)}
          >
            {item.question}
          </Chip>
        ))}
      </div>
      <div className="flex min-h-56 flex-col gap-5" aria-live="polite">
        <AnimatePresence mode="wait">
          <m.div
            key={chosen}
            className="flex flex-col gap-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <m.p
              className="self-end rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-3 text-marketing-ink"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              {exchange.question}
            </m.p>
            <div className="flex items-start gap-3">
              <Orb size="34px" className="mt-0.5 shrink-0" />
              {thinking ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {exchange.steps.map((tool, index) => (
                      <m.span
                        key={tool}
                        className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-marketing-muted"
                        initial={{ opacity: 0, scale: 0.6, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 520,
                          damping: 28,
                          delay: 0.25 * index,
                        }}
                      >
                        {t(`ask.step.${tool}`)}
                      </m.span>
                    ))}
                  </div>
                  <p className="text-sm text-marketing-muted">
                    {t("ask.thinking")}
                  </p>
                </div>
              ) : (
                <m.p
                  className="max-w-xl text-lg leading-relaxed text-marketing-ink"
                  initial="hidden"
                  animate="shown"
                  transition={{ staggerChildren: 0.05 }}
                >
                  {answer.map((part, index) => (
                    <m.span
                      key={index}
                      variants={{
                        hidden: { opacity: 0, y: 6 },
                        shown: { opacity: 1, y: 0 },
                      }}
                      className={
                        part.figure
                          ? "mx-1 inline-block rounded-lg bg-primary/15 px-1.5 font-mono text-primary"
                          : "inline-block"
                      }
                    >
                      {part.text}
                      {part.figure ? null : " "}
                    </m.span>
                  ))}
                </m.p>
              )}
            </div>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
