"use client";

import { useState } from "react";
import { AnimatePresence, LazyMotion, m, MotionConfig } from "motion/react";
import { EnvelopeSimple, Flag } from "@phosphor-icons/react";
import {
  ENTRAIDE_RULES,
  threadHref,
  type EntraideRule,
} from "@finance/core/entraide";
import type { ModerationItem } from "@finance/data/entraide-moderation";
import { moderate } from "@/lib/actions/entraide-moderation";
import {
  entraideErrorText,
  type EntraideCopy,
} from "@finance/core/entraide-copy";
import { fieldClass } from "@/components/marketing/entraide/Composer";
import { EntraideText } from "@/components/marketing/entraide/EntraideText";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { countLabel } from "@/components/marketing/nouveautes-copy";
import { FADE_HEIGHT } from "@/components/motion/fade";
import { cn } from "@/lib/utils";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

type Measure = "hide" | "bar";

type Decision =
  | { action: "keep" }
  | { action: "unbar" }
  | { action: "hide"; rule: EntraideRule; facts: string }
  | { action: "bar"; rule: EntraideRule; facts: string };

/**
 * The queue, one reported thing at a time: its words, who wrote them, the
 * reports and their reasons. « Garder », « Masquer », « Exclure le
 * pseudonyme »: a measure asks for the rule and the facts, which its author
 * reads on the message; once decided, the same reason is ready to send by
 * email.
 */
export function ModerationQueue({
  items,
  copy,
}: {
  items: ModerationItem[];
  copy: EntraideCopy;
}) {
  // What was decided on this visit stays, with its email to send, even
  // once the queue read again no longer lists it.
  const [decided, setDecided] = useState<
    { item: ModerationItem; decision: Decision }[]
  >([]);
  const open = items.filter(
    (item) => !decided.some((done) => done.item.target === item.target),
  );
  if (open.length + decided.length === 0) {
    return <p className="text-marketing-muted">{copy.moderation.empty}</p>;
  }
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <ul className="flex flex-col gap-4">
          {decided.map(({ item, decision }) => (
            <Item
              key={item.target}
              item={item}
              copy={copy}
              decided={decision}
              onDecided={() => undefined}
            />
          ))}
          {open.map((item) => (
            <Item
              key={item.target}
              item={item}
              copy={copy}
              decided={null}
              onDecided={(decision) =>
                setDecided((current) => [...current, { item, decision }])
              }
            />
          ))}
        </ul>
      </MotionConfig>
    </LazyMotion>
  );
}

function Item({
  item,
  copy,
  decided,
  onDecided,
}: {
  item: ModerationItem;
  copy: EntraideCopy;
  decided: Decision | null;
  onDecided: (decision: Decision) => void;
}) {
  const words = copy.moderation;
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [rule, setRule] = useState<EntraideRule>(
    item.reports[0]?.reason ?? "other",
  );
  const [facts, setFacts] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = threadHref(item.threadId, item.threadTitle);

  async function act(input: Decision) {
    setPending(true);
    setError(null);
    const result = await moderate(
      input.action === "keep"
        ? { action: "keep", target: item.target }
        : input.action === "unbar"
          ? {
              action: "unbar",
              target: item.target,
              authorId: item.author.id ?? "",
            }
          : input.action === "hide"
            ? {
                action: "hide",
                target: item.target,
                rule: input.rule,
                facts: input.facts,
              }
            : {
                action: "bar",
                target: item.target,
                authorId: item.author.id ?? "",
                rule: input.rule,
                facts: input.facts,
              },
    );
    setPending(false);
    if (!result.success) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    setMeasure(null);
    onDecided(input);
  }

  // The reason, as an email the moderator sends from their own address.
  const mail =
    decided &&
    (decided.action === "hide" || decided.action === "bar") &&
    item.author.email
      ? `mailto:${item.author.email}?subject=${encodeURIComponent(
          words.mailSubject,
        )}&body=${encodeURIComponent(
          [
            decided.action === "hide"
              ? words.mailHidden.replace(
                  "{where}",
                  `«\u00a0${item.threadTitle}\u00a0» (${
                    typeof window === "undefined" ? "" : window.location.origin
                  }${href})`,
                )
              : words.mailBarred,
            words.mailRule.replace("{rule}", copy.rules[decided.rule]),
            words.mailFacts.replace("{facts}", decided.facts),
            words.mailHow.replace(
              "{how}",
              item.reports.length > 0 ? words.mailReport : words.mailOwn,
            ),
            "",
            words.mailChallenge,
            "",
            "Pluclair",
          ].join("\n"),
        )}`
      : null;

  return (
    <li className="glass-flat flex flex-col gap-4 rounded-[1.5rem] p-5 md:p-6">
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
        <span>{item.kind === "post" ? words.question : words.answer}</span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Flag size={12} aria-hidden />
          {countLabel(words.reports, item.reports.length)}
        </span>
        {item.automaticallyHidden ? (
          <span className="rounded-full border border-white/15 px-2 py-0.5 normal-case tracking-normal text-marketing-ink">
            {words.auto}
          </span>
        ) : null}
      </p>

      <p className="text-sm text-marketing-muted">
        {words.in}{" "}
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className={cn(
            "rounded-control text-marketing-ink underline decoration-white/30 underline-offset-4",
            marketingFocus,
          )}
        >
          {item.threadTitle || copy.list.gone}
        </a>{" "}
        {words.by}{" "}
        <span className="text-marketing-ink">{item.author.handle ?? "—"}</span>
        {item.author.email ? (
          <>
            {" "}
            ·{" "}
            <a
              href={`mailto:${item.author.email}`}
              className="underline decoration-white/20 underline-offset-2"
            >
              {item.author.email}
            </a>
          </>
        ) : null}
        {item.author.barred ? ` · ${words.barred}` : ""}
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
        {item.title ? (
          <p className="mb-2 font-head text-marketing-ink">{item.title}</p>
        ) : null}
        <EntraideText markdown={item.body || " "} />
      </div>

      <ul className="flex flex-col gap-1.5 text-sm">
        {item.reports.map((report) => (
          <li key={report.id} className="text-marketing-muted">
            <span className="text-marketing-ink">
              {copy.rules[report.reason]}
            </span>
            {report.note ? ` — ${report.note}` : ""}
          </li>
        ))}
      </ul>

      {decided ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-marketing-ink">
          <span>{words.done}</span>
          {mail ? (
            <a
              href={mail}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4",
                marketingFocus,
              )}
            >
              <EnvelopeSimple size={16} aria-hidden />
              {words.mail}
            </a>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Choice
              label={words.keep}
              onClick={() => void act({ action: "keep" })}
              disabled={pending}
            />
            <Choice
              label={words.hide}
              onClick={() => setMeasure(measure === "hide" ? null : "hide")}
              pressed={measure === "hide"}
              disabled={pending || item.status === "deleted"}
            />
            {item.author.id && !item.author.barred ? (
              <Choice
                label={words.bar}
                onClick={() => setMeasure(measure === "bar" ? null : "bar")}
                pressed={measure === "bar"}
                disabled={pending}
              />
            ) : null}
            {item.author.id && item.author.barred ? (
              <Choice
                label={words.unbar}
                onClick={() => void act({ action: "unbar" })}
                disabled={pending}
              />
            ) : null}
          </div>
          <AnimatePresence initial={false}>
            {measure ? (
              <m.form
                key={measure}
                className="flex flex-col gap-3 overflow-hidden"
                {...FADE_HEIGHT}
                onSubmit={(event) => {
                  event.preventDefault();
                  void act(
                    measure === "hide"
                      ? { action: "hide", rule, facts }
                      : { action: "bar", rule, facts },
                  );
                }}
              >
                <label className="flex flex-col gap-1.5 pt-1">
                  <span className="text-sm text-marketing-ink">
                    {words.rule}
                  </span>
                  <select
                    value={rule}
                    onChange={(event) =>
                      setRule(event.target.value as EntraideRule)
                    }
                    className={cn(fieldClass, "md:max-w-sm")}
                  >
                    {ENTRAIDE_RULES.map((key) => (
                      <option key={key} value={key}>
                        {copy.rules[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-marketing-ink">
                    {words.facts}
                  </span>
                  <textarea
                    value={facts}
                    onChange={(event) => setFacts(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder={words.factsPlaceholder}
                    className={cn(fieldClass, "resize-y")}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <Choice
                    label={words.cancel}
                    onClick={() => setMeasure(null)}
                  />
                  <button
                    type="submit"
                    disabled={pending || facts.trim().length === 0}
                    className={cn(
                      "min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity duration-hover disabled:opacity-40",
                      marketingFocus,
                    )}
                  >
                    {words.confirm}
                  </button>
                </div>
              </m.form>
            ) : null}
          </AnimatePresence>
          {error ? (
            <p role="alert" className="text-sm text-marketing-ink">
              {error}
            </p>
          ) : null}
        </>
      )}
    </li>
  );
}

function Choice({
  label,
  onClick,
  pressed,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm transition-colors duration-hover disabled:opacity-40",
        marketingFocus,
        pressed
          ? "border-white/25 bg-white/[0.1] text-marketing-ink"
          : "border-white/10 text-marketing-muted hover:text-white",
      )}
    >
      {label}
    </button>
  );
}
