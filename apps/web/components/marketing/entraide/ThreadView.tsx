"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  LayoutGroup,
  LazyMotion,
  m,
  MotionConfig,
} from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  EyeSlash,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  ENTRAIDE_HREF,
  ENTRAIDE_LIMITS,
  handleProblem,
  type PostKind,
} from "@finance/core/entraide";
import { maskPersonalData } from "@finance/core/entraide-mask";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import {
  ENTRAIDE_REACTIONS,
  NO_TALLY,
  postTarget,
  replyTarget,
  type ReactionTally,
} from "@finance/core/reactions";
import {
  deletePost,
  deleteReply,
  editPost,
  editReply,
  publishReply,
  setSolved,
} from "@/lib/actions/entraide";
import {
  entraideErrorText,
  type EntraideCopy,
} from "@/components/marketing/entraide-copy";
import { AuthorLine } from "@/components/marketing/entraide/AuthorLine";
import { fieldClass } from "@/components/marketing/entraide/Composer";
import { EntraideText } from "@/components/marketing/entraide/EntraideText";
import { marketingFocus } from "@/components/marketing/marketing-focus";
import { countLabel } from "@/components/marketing/nouveautes-copy";
import { Reactions } from "@/components/marketing/nouveautes/Reactions";
import { cn } from "@/lib/utils";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

const EASE = [...EASE_STANDARD] as [number, number, number, number];

/** An answer arriving, or moving to sit under the question. */
const SETTLE = { type: "spring", stiffness: 260, damping: 28 } as const;

export interface ThreadReplyData {
  id: number;
  body: string;
  handle: string | null;
  isPluclair: boolean;
  isMine: boolean;
  hidden: boolean;
  gone: boolean;
  when: string;
  edited: boolean;
}

export interface ThreadData {
  id: number;
  kind: PostKind;
  title: string;
  body: string;
  handle: string | null;
  isPluclair: boolean;
  isMine: boolean;
  hidden: boolean;
  gone: boolean;
  when: string;
  edited: boolean;
  solvedReplyId: number | null;
  guide: { title: string; href: string } | null;
  replies: ThreadReplyData[];
}

/**
 * A thread, read and answered. The question (or share) and its reactions;
 * the author's own « Modifier », « Supprimer »; then the answers, oldest
 * first — the one the asker marked « Résolu » lifted up under the question,
 * its check drawing itself and the mark in gold, a moment rather than a
 * figure. New answers arrive on a spring. Every change shows at once and
 * is sent after; a refusal puts it back and says why.
 */
export function ThreadView({
  thread,
  tallies,
  copy,
  signedIn,
  handle,
  loginHref,
}: {
  thread: ThreadData;
  tallies: Record<string, ReactionTally>;
  copy: EntraideCopy;
  signedIn: boolean;
  handle: string | null;
  loginHref: string;
}) {
  const router = useRouter();
  const [solvedId, setSolvedId] = useState(thread.solvedReplyId);
  const [shownFor, setShownFor] = useState(thread.solvedReplyId);
  const [failed, setFailed] = useState<string | null>(null);
  if (shownFor !== thread.solvedReplyId) {
    setShownFor(thread.solvedReplyId);
    setSolvedId(thread.solvedReplyId);
  }
  const canSolve = thread.isMine && thread.kind === "question" && !thread.gone;
  const solved = thread.replies.find((reply) => reply.id === solvedId) ?? null;
  const others = thread.replies.filter((reply) => reply.id !== solvedId);
  const count = thread.replies.filter((reply) => !reply.gone).length;

  async function toggleSolved(replyId: number) {
    const before = solvedId;
    const next = solvedId === replyId ? null : replyId;
    setSolvedId(next);
    setFailed(null);
    const result = await setSolved(thread.id, next);
    if (!result.success) {
      setSolvedId(before);
      setFailed(entraideErrorText(copy, result.error));
      return;
    }
    router.refresh();
  }

  const reactionsFor = (target: string) => (
    <Reactions
      target={target}
      kinds={ENTRAIDE_REACTIONS}
      initial={tallies[target] ?? NO_TALLY}
      copy={copy.reactions}
      signedIn={signedIn}
      loginHref={loginHref}
    />
  );

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <article className="mx-auto flex max-w-3xl flex-col gap-10">
          <Link
            href={ENTRAIDE_HREF}
            className={cn(
              "group inline-flex min-h-11 items-center gap-2 self-start rounded-full text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
              marketingFocus,
            )}
          >
            <ArrowLeft
              size={14}
              aria-hidden
              className="transition-transform duration-hover group-hover:-translate-x-0.5"
            />
            {copy.thread.back}
          </Link>

          <PostBlock
            thread={thread}
            solved={solvedId !== null}
            copy={copy}
            reactions={reactionsFor(postTarget(thread.id))}
          />

          <p className="text-sm text-marketing-faint">{copy.thread.views}</p>

          <LayoutGroup>
            <section className="flex flex-col gap-4" aria-labelledby="answers">
              <h2 id="answers" className="font-head text-xl text-marketing-ink">
                {count > 0
                  ? countLabel(copy.thread.answers, count)
                  : copy.thread.noAnswers}
              </h2>

              {failed ? (
                <p role="alert" className="text-sm text-marketing-ink">
                  {failed}
                </p>
              ) : null}

              <AnimatePresence initial={false}>
                {solved ? (
                  <m.div
                    key="solved"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-[1.75rem] border border-primary/40 bg-primary/[0.06] p-1"
                  >
                    <p className="flex items-center gap-2 px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                      <DrawnCheck />
                      {copy.thread.solvedAnswer}
                    </p>
                    <ReplyItem
                      reply={solved}
                      copy={copy}
                      isSolved
                      canSolve={canSolve}
                      onSolve={() => void toggleSolved(solved.id)}
                      reactions={reactionsFor(replyTarget(solved.id))}
                    />
                  </m.div>
                ) : null}
              </AnimatePresence>

              <ul className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {others.map((reply) => (
                    <m.li
                      key={reply.id}
                      layout
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={SETTLE}
                    >
                      <ReplyItem
                        reply={reply}
                        copy={copy}
                        isSolved={false}
                        canSolve={canSolve && !reply.gone && !reply.hidden}
                        onSolve={() => void toggleSolved(reply.id)}
                        reactions={reactionsFor(replyTarget(reply.id))}
                      />
                    </m.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          </LayoutGroup>

          {thread.hidden || (thread.gone && thread.isMine) ? null : (
            <ReplyComposer
              postId={thread.id}
              copy={copy}
              signedIn={signedIn}
              handle={handle}
              loginHref={loginHref}
              onSent={() => router.refresh()}
            />
          )}
        </article>
      </MotionConfig>
    </LazyMotion>
  );
}

function PostBlock({
  thread,
  solved,
  copy,
  reactions,
}: {
  thread: ThreadData;
  solved: boolean;
  copy: EntraideCopy;
  reactions: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(thread.title);
  const [body, setBody] = useState(thread.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    const result = await editPost(thread.id, { title, body });
    setPending(false);
    if (!result.success) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <header className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-marketing-faint">
        <span>{copy.kinds[thread.kind]}</span>
        <AnimatePresence initial={false}>
          {solved ? (
            <m.span
              key="solved"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 520, damping: 22 }}
              className="inline-flex items-center gap-1 text-primary"
            >
              <DrawnCheck />
              {copy.list.solved}
            </m.span>
          ) : null}
        </AnimatePresence>
      </p>

      {thread.hidden ? (
        <p
          role="note"
          className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-marketing-ink"
        >
          <EyeSlash size={18} aria-hidden className="mt-px shrink-0" />
          {copy.thread.hidden}
        </p>
      ) : null}

      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={ENTRAIDE_LIMITS.titleMax}
            aria-label={copy.composer.titleQuestion}
            className={cn(fieldClass, "font-head text-lg")}
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={ENTRAIDE_LIMITS.bodyMax}
            rows={6}
            aria-label={copy.composer.bodyLabel}
            className={cn(fieldClass, "min-h-32 resize-y leading-relaxed")}
          />
          <MaskNotice text={`${title}\n${body}`} copy={copy} />
          {error ? (
            <p role="alert" className="text-sm text-marketing-ink">
              {error}
            </p>
          ) : null}
          <FormButtons
            copy={copy}
            pending={pending}
            ready={title.trim().length >= ENTRAIDE_LIMITS.titleMin}
            submit={copy.thread.save}
            onCancel={() => {
              setEditing(false);
              setTitle(thread.title);
              setBody(thread.body);
            }}
          />
        </form>
      ) : (
        <>
          <h1
            className={cn(
              "marketing-display text-display-sub",
              thread.gone && "italic text-marketing-faint",
            )}
          >
            {thread.gone ? copy.list.gone : thread.title}
          </h1>
          <AuthorLine
            handle={thread.handle}
            isPluclair={thread.isPluclair}
            when={thread.when}
            edited={thread.edited ? copy.list.edited : undefined}
            pluclairLabel={copy.list.pluclair}
          />
          {!thread.gone && thread.body ? (
            <EntraideText markdown={thread.body} className="text-base" />
          ) : null}
        </>
      )}

      {thread.guide ? (
        <Link
          href={thread.guide.href}
          className={cn(
            "group inline-flex min-h-11 items-center gap-2 self-start rounded-full text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
            marketingFocus,
          )}
        >
          <BookOpenText size={16} aria-hidden />
          {copy.thread.aboutGuide} · {thread.guide.title}
        </Link>
      ) : null}

      {thread.gone || editing ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {reactions}
          {thread.isMine && !thread.hidden ? (
            <OwnActions
              copy={copy}
              onEdit={() => setEditing(true)}
              onDelete={async () => {
                const result = await deletePost(thread.id);
                if (result.success) {
                  router.refresh();
                }
                return result.success
                  ? null
                  : entraideErrorText(copy, result.error);
              }}
            />
          ) : null}
        </div>
      )}
    </header>
  );
}

function ReplyItem({
  reply,
  copy,
  isSolved,
  canSolve,
  onSolve,
  reactions,
}: {
  reply: ThreadReplyData;
  copy: EntraideCopy;
  isSolved: boolean;
  canSolve: boolean;
  onSolve: () => void;
  reactions: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(reply.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    const result = await editReply(reply.id, body);
    setPending(false);
    if (!result.success) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <m.div
      layoutId={`entraide-reply-${reply.id}`}
      transition={SETTLE}
      className={cn(
        "flex flex-col gap-3 rounded-[1.5rem] p-5",
        isSolved ? "bg-transparent" : "glass-flat",
      )}
    >
      <AuthorLine
        handle={reply.handle}
        isPluclair={reply.isPluclair}
        when={reply.when}
        edited={reply.edited ? copy.list.edited : undefined}
        pluclairLabel={copy.list.pluclair}
      />
      {reply.hidden ? (
        <p className="flex items-start gap-2 text-sm text-marketing-ink">
          <EyeSlash size={16} aria-hidden className="mt-0.5 shrink-0" />
          {copy.thread.hidden}
        </p>
      ) : null}
      {reply.gone ? (
        <p className="italic text-marketing-faint">{copy.list.gone}</p>
      ) : editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={ENTRAIDE_LIMITS.replyMax}
            rows={4}
            aria-label={copy.thread.replyLabel}
            className={cn(fieldClass, "resize-y leading-relaxed")}
          />
          <MaskNotice text={body} copy={copy} />
          {error ? (
            <p role="alert" className="text-sm text-marketing-ink">
              {error}
            </p>
          ) : null}
          <FormButtons
            copy={copy}
            pending={pending}
            ready={body.trim().length >= ENTRAIDE_LIMITS.replyMin}
            submit={copy.thread.save}
            onCancel={() => {
              setEditing(false);
              setBody(reply.body);
            }}
          />
        </form>
      ) : (
        <EntraideText markdown={reply.body} />
      )}
      {reply.gone || editing ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {reactions}
          <div className="flex flex-wrap items-center gap-1">
            {canSolve ? (
              <button
                type="button"
                onClick={onSolve}
                aria-pressed={isSolved}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm transition-colors duration-hover",
                  marketingFocus,
                  isSolved
                    ? "text-primary"
                    : "text-marketing-muted hover:text-white",
                )}
              >
                {isSolved ? copy.thread.unmarkSolved : copy.thread.markSolved}
              </button>
            ) : null}
            {reply.isMine && !reply.hidden ? (
              <OwnActions
                copy={copy}
                onEdit={() => setEditing(true)}
                onDelete={async () => {
                  const result = await deleteReply(reply.id);
                  if (result.success) {
                    router.refresh();
                  }
                  return result.success
                    ? null
                    : entraideErrorText(copy, result.error);
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </m.div>
  );
}

/** « Modifier » and « Supprimer », the second asking once more, in place. */
function OwnActions({
  copy,
  onEdit,
  onDelete,
}: {
  copy: EntraideCopy;
  onEdit: () => void;
  onDelete: () => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = cn(
    "inline-flex min-h-11 items-center rounded-full px-3 text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
    marketingFocus,
  );
  if (confirming) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-marketing-ink">
        <span>{error ?? copy.thread.confirmDelete}</span>
        <button
          type="button"
          className={button}
          onClick={async () => setError(await onDelete())}
        >
          {copy.thread.delete}
        </button>
        <button
          type="button"
          className={button}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
        >
          {copy.thread.cancel}
        </button>
      </p>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={button} onClick={onEdit}>
        {copy.thread.edit}
      </button>
      <button
        type="button"
        className={button}
        onClick={() => setConfirming(true)}
      >
        {copy.thread.delete}
      </button>
    </div>
  );
}

function ReplyComposer({
  postId,
  copy,
  signedIn,
  handle,
  loginHref,
  onSent,
}: {
  postId: number;
  copy: EntraideCopy;
  signedIn: boolean;
  handle: string | null;
  loginHref: string;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-marketing-muted">
        {copy.thread.signIn}
        <Link
          href={loginHref}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-marketing-ink",
            marketingFocus,
          )}
        >
          {copy.composer.signInCta}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </p>
    );
  }

  const handleIssue = handle ? null : handleProblem(newHandle);
  const ready =
    body.trim().length >= ENTRAIDE_LIMITS.replyMin &&
    (handle !== null || handleIssue === null) &&
    !pending;

  async function send() {
    if (!ready) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await publishReply(
      postId,
      body,
      handle ? undefined : newHandle,
    );
    setPending(false);
    if (!result.success) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    setBody("");
    onSent();
  }

  return (
    <form
      className="glass-panel flex flex-col gap-4 rounded-[1.75rem] p-5 md:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {handle ? null : (
        <label className="flex flex-col gap-2">
          <span className="px-1 text-sm font-medium text-marketing-ink">
            {copy.composer.handleLabel}
          </span>
          <input
            value={newHandle}
            onChange={(event) => setNewHandle(event.target.value)}
            maxLength={ENTRAIDE_LIMITS.handleMax}
            autoComplete="nickname"
            className={cn(fieldClass, "md:max-w-xs")}
          />
          <span
            className={cn(
              "px-1 text-xs",
              newHandle && handleIssue
                ? "text-marketing-ink"
                : "text-marketing-faint",
            )}
          >
            {newHandle && handleIssue
              ? copy.composer.handleProblems[handleIssue]
              : copy.composer.handleHint}
          </span>
        </label>
      )}
      <label className="flex flex-col gap-2">
        <span className="px-1 text-sm font-medium text-marketing-ink">
          {copy.thread.replyLabel}
        </span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={ENTRAIDE_LIMITS.replyMax}
          rows={4}
          placeholder={copy.thread.replyPlaceholder}
          className={cn(fieldClass, "resize-y leading-relaxed")}
        />
        <span className="px-1 text-xs text-marketing-faint">
          {copy.composer.formatHint}
        </span>
      </label>
      <MaskNotice text={body} copy={copy} />
      {error ? (
        <p role="alert" className="text-sm text-marketing-ink">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!ready}
          className={cn(
            "min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity duration-hover disabled:opacity-40",
            marketingFocus,
          )}
        >
          {pending ? copy.thread.replying : copy.thread.reply}
        </button>
      </div>
    </form>
  );
}

/** What will be masked, said before anything goes out. */
function MaskNotice({ text, copy }: { text: string; copy: EntraideCopy }) {
  const masked = maskPersonalData(text).masked;
  return (
    <AnimatePresence initial={false}>
      {masked.length > 0 ? (
        <m.p
          key="masked"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: DURATION.panel / 1000, ease: EASE }}
          className="flex items-start gap-2 overflow-hidden text-sm text-marketing-ink"
        >
          <ShieldCheck size={18} aria-hidden className="mt-px shrink-0" />
          {copy.composer.masked.replace(
            "{kinds}",
            masked.map((kind) => copy.composer.maskKinds[kind]).join(", "),
          )}
        </m.p>
      ) : null}
    </AnimatePresence>
  );
}

function FormButtons({
  copy,
  pending,
  ready,
  submit,
  onCancel,
}: {
  copy: EntraideCopy;
  pending: boolean;
  ready: boolean;
  submit: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className={cn(
          "min-h-11 rounded-full px-4 text-sm text-marketing-muted transition-colors duration-hover hover:text-white",
          marketingFocus,
        )}
      >
        {copy.thread.cancel}
      </button>
      <button
        type="submit"
        disabled={!ready || pending}
        className={cn(
          "min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity duration-hover disabled:opacity-40",
          marketingFocus,
        )}
      >
        {submit}
      </button>
    </div>
  );
}

/** A check in a ring that draws itself: « Résolu », as it happens. */
function DrawnCheck() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <m.circle
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      />
      <m.path
        d="M4.8 8.3 7 10.4l4.2-4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: EASE, delay: 0.3 }}
      />
    </svg>
  );
}
