"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  ChatCircle,
  Eye,
  PencilSimpleLine,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  ENTRAIDE_LIMITS,
  handleProblem,
  type PostKind,
} from "@finance/core/entraide";
import { maskPersonalData } from "@finance/core/entraide-mask";
import { publishPost, searchAlreadyAsked } from "@/lib/actions/entraide";
import type { EntraideCard } from "@/lib/entraide-cards";
import {
  entraideErrorText,
  type EntraideCopy,
} from "@finance/core/entraide-copy";
import { EntraideText } from "@/components/marketing/entraide/EntraideText";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { SegmentedPills } from "@/components/marketing/SegmentedPills";
import { FADE, FADE_HEIGHT, FADE_IN } from "@/components/motion/fade";
import { cn } from "@/lib/utils";

/** The pill growing into the editor, and the editor into the card: quick. */
const MORPH = FADE_IN;

/** How long the title rests before « Déjà demandé ? » looks. */
const SEARCH_AFTER_MS = 450;

export const fieldClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[0.975rem] text-marketing-ink placeholder:text-marketing-faint transition-colors duration-hover focus:border-white/25 focus:outline-none";

type Matches = Awaited<ReturnType<typeof searchAlreadyAsked>>;

/**
 * « Posez votre question… »: a glass pill that grows, in place, into the
 * editor (one `layoutId`), and, once published, becomes the new card at the
 * top of the list (`onPublished` hands the card that `layoutId`).
 *
 * In the editor: question or share; the pseudonym, the first time only;
 * the title, and as it is typed, « Déjà demandé ? » with the threads and
 * guides it may already be; the details, with a preview as it will read;
 * and, before anything goes out, what will be masked. A visitor's press
 * opens the way to sign in, back here after.
 */
export function Composer({
  copy,
  signedIn,
  handle,
  loginHref,
  layoutId,
  guideSlug,
  startOpen = false,
  onPublished,
}: {
  copy: EntraideCopy;
  signedIn: boolean;
  /** The reader's pseudonym, or null before their first post. */
  handle: string | null;
  loginHref: string;
  layoutId: string;
  /** The guide the question comes from (`/blog/entraide?guide=…`). */
  guideSlug: string | null;
  startOpen?: boolean;
  onPublished: (card: EntraideCard) => void;
}) {
  const words = copy.composer;
  const [open, setOpen] = useState(startOpen && signedIn);
  const [ask, setAsk] = useState(false);
  const [kind, setKind] = useState<PostKind>("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Matches>({ threads: [], guides: [] });
  const titleRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  // « Déjà demandé ? »: once the title has rested, ask what is close to it.
  const query = title.trim();
  useEffect(() => {
    if (!open || kind !== "question" || query.length < 12) {
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      void searchAlreadyAsked(query).then((found) => {
        if (live) {
          setMatches(found);
        }
      });
    }, SEARCH_AFTER_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [open, kind, query]);
  const shownMatches =
    open && kind === "question" && query.length >= 12
      ? matches
      : { threads: [], guides: [] };

  const masked = maskPersonalData(`${title}\n${body}`).masked;
  const handleIssue = handle ? null : handleProblem(newHandle);
  const ready =
    query.length >= ENTRAIDE_LIMITS.titleMin &&
    body.length <= ENTRAIDE_LIMITS.bodyMax &&
    (handle !== null || handleIssue === null) &&
    !pending;

  function close() {
    setOpen(false);
    setError(null);
    setPreview(false);
  }

  async function publish() {
    if (!ready) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await publishPost({
      kind,
      title,
      body,
      handle: handle ? undefined : newHandle,
      guideSlug,
    });
    setPending(false);
    if (!result.success) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    setTitle("");
    setBody("");
    setPreview(false);
    setMatches({ threads: [], guides: [] });
    setOpen(false);
    onPublished(result.card);
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-3">
        <m.button
          type="button"
          layoutId={layoutId}
          transition={MORPH}
          onClick={() => {
            if (!signedIn) {
              setAsk((current) => !current);
              return;
            }
            setOpen(true);
            window.setTimeout(() => titleRef.current?.focus(), 60);
          }}
          className={cn(
            "glass-flat glass-flat-hover group flex min-h-14 w-full items-center gap-3 rounded-full px-6 text-left text-marketing-muted md:max-w-xl",
            marketingFocus,
          )}
          style={{ borderRadius: 999 }}
        >
          <PencilSimpleLine
            size={18}
            aria-hidden
            className="text-marketing-ink"
          />
          <span className="flex-1">{words.pill}</span>
          <ArrowRight
            size={16}
            aria-hidden
            className="transition-transform duration-hover group-hover:translate-x-0.5"
          />
        </m.button>
        <AnimatePresence initial={false}>
          {ask ? (
            <Reveal key="ask">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-sm text-marketing-muted">
                {words.signIn}
                <Link
                  href={loginHref}
                  className={cn(
                    "group inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-marketing-ink",
                    marketingFocus,
                  )}
                >
                  {words.signInCta}
                  <ArrowRight size={14} aria-hidden />
                </Link>
              </p>
            </Reveal>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <m.form
      layoutId={layoutId}
      transition={MORPH}
      style={{ borderRadius: 28 }}
      onSubmit={(event) => {
        event.preventDefault();
        void publish();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          close();
        }
      }}
      className="glass-panel flex flex-col gap-5 p-5 md:p-7"
      aria-labelledby={`${ids}-title-label`}
    >
      <Appear>
        <SegmentedPills
          id="entraide-kind"
          label={words.kindLabel}
          value={kind}
          onChange={setKind}
          options={[
            { value: "question", label: copy.kinds.question },
            { value: "share", label: copy.kinds.share },
          ]}
        />
      </Appear>

      {handle ? null : (
        <Appear>
          <Field
            id={`${ids}-handle`}
            label={words.handleLabel}
            hint={
              newHandle && handleIssue
                ? words.handleProblems[handleIssue]
                : words.handleHint
            }
            warn={Boolean(newHandle && handleIssue)}
          >
            <input
              id={`${ids}-handle`}
              value={newHandle}
              onChange={(event) => setNewHandle(event.target.value)}
              maxLength={ENTRAIDE_LIMITS.handleMax}
              autoComplete="nickname"
              className={cn(fieldClass, "md:max-w-xs")}
            />
          </Field>
        </Appear>
      )}

      <Appear>
        <Field
          id={`${ids}-title`}
          labelId={`${ids}-title-label`}
          label={kind === "question" ? words.titleQuestion : words.titleShare}
        >
          <input
            ref={titleRef}
            id={`${ids}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={ENTRAIDE_LIMITS.titleMax}
            placeholder={kind === "question" ? words.titlePlaceholder : ""}
            className={cn(fieldClass, "font-head text-lg")}
          />
        </Field>
      </Appear>

      <AlreadyAsked matches={shownMatches} copy={copy} />

      <Appear>
        <Field
          id={`${ids}-body`}
          label={words.bodyLabel}
          hint={words.formatHint}
          aside={
            <button
              type="button"
              aria-pressed={preview}
              onClick={() => setPreview((current) => !current)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-hover",
                marketingFocus,
                preview
                  ? "bg-white/[0.12] text-marketing-ink"
                  : "text-marketing-muted hover:text-white",
              )}
            >
              <Eye size={15} aria-hidden />
              {words.preview}
            </button>
          }
        >
          {preview ? (
            <div className="min-h-32 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="mb-2 font-head text-lg text-marketing-ink">
                {maskPersonalData(title).text}
              </p>
              <EntraideText markdown={maskPersonalData(body).text} />
            </div>
          ) : (
            <textarea
              id={`${ids}-body`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={ENTRAIDE_LIMITS.bodyMax}
              rows={6}
              placeholder={words.bodyPlaceholder}
              className={cn(fieldClass, "min-h-32 resize-y leading-relaxed")}
            />
          )}
        </Field>
      </Appear>

      <AnimatePresence initial={false}>
        {masked.length > 0 ? (
          <Reveal key="masked">
            <p
              role="status"
              className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-marketing-ink"
            >
              <ShieldCheck size={18} aria-hidden className="mt-px shrink-0" />
              {words.masked.replace(
                "{kinds}",
                masked.map((kind) => words.maskKinds[kind]).join(", "),
              )}
            </p>
          </Reveal>
        ) : null}
        {error ? (
          <Reveal key="error">
            <p role="alert" className="px-1 text-sm text-marketing-ink">
              {error}
            </p>
          </Reveal>
        ) : null}
      </AnimatePresence>

      <Appear>
        <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-marketing-faint">{words.agree}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className={cn(
                "min-h-11 rounded-full px-4 text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
                marketingFocus,
              )}
            >
              {words.cancel}
            </button>
            <button
              type="submit"
              disabled={!ready}
              className={cn(
                "min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity duration-hover disabled:opacity-40",
                marketingFocus,
              )}
            >
              {pending ? words.publishing : words.publish}
            </button>
          </div>
        </div>
      </Appear>
    </m.form>
  );
}

function Field({
  id,
  labelId,
  label,
  hint,
  warn = false,
  aside,
  children,
}: {
  id: string;
  labelId?: string;
  label: string;
  hint?: string;
  warn?: boolean;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <label
          id={labelId}
          htmlFor={id}
          className="px-1 text-sm font-medium text-marketing-ink"
        >
          {label}
        </label>
        {aside}
      </div>
      {children}
      {hint ? (
        <p
          className={cn(
            "px-1 text-xs",
            warn ? "text-marketing-ink" : "text-marketing-faint",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** « Déjà demandé ? »: the threads and guides close to the title, sliding in. */
function AlreadyAsked({
  matches,
  copy,
}: {
  matches: Matches;
  copy: EntraideCopy;
}) {
  const items = [
    ...matches.guides.map((guide) => ({
      key: `guide-${guide.slug}`,
      href: guide.href,
      title: guide.title,
      note: copy.composer.guide,
      Icon: BookOpenText,
    })),
    ...matches.threads.map((thread) => ({
      key: `thread-${thread.id}`,
      href: thread.href,
      title: thread.title,
      note: thread.solved ? copy.list.solved : undefined,
      Icon: ChatCircle,
    })),
  ];
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 ? (
        <Reveal key="already">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
              {copy.composer.already}
            </p>
            <ul className="flex flex-col">
              {items.map((item) => (
                <m.li key={item.key} {...FADE}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener"
                    className={cn(
                      "group flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-marketing-muted transition-colors duration-hover hover:bg-white/[0.05] hover:text-white",
                      marketingFocus,
                    )}
                  >
                    <item.Icon size={16} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {item.title}
                    </span>
                    {item.note ? (
                      <span className="shrink-0 text-xs text-marketing-faint">
                        {item.note}
                      </span>
                    ) : null}
                    <ArrowUpRight size={14} aria-hidden className="shrink-0" />
                  </a>
                </m.li>
              ))}
            </ul>
          </div>
        </Reveal>
      ) : null}
    </AnimatePresence>
  );
}

/** The editor's parts, fading in as the glass grows. */
function Appear({ children }: { children: ReactNode }) {
  return <m.div {...FADE}>{children}</m.div>;
}

function Reveal({ children }: { children: ReactNode }) {
  return (
    <m.div className="overflow-hidden" {...FADE_HEIGHT}>
      {children}
    </m.div>
  );
}
