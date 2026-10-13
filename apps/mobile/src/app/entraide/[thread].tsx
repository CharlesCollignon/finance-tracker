import { useRef, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useReducedMotion,
  ZoomIn,
} from "react-native-reanimated";

import {
  ENTRAIDE_LIMITS,
  threadIdOf,
  type EntraidePost,
  type EntraideReply,
} from "@finance/core/entraide";
import {
  countWords,
  entraideCopyFor,
  entraideErrorText,
  entraideWhen,
  type EntraideCopy,
} from "@finance/core/entraide-copy";
import { maskPersonalData } from "@finance/core/entraide-mask";
import { DURATION, STAGGER_STEP_MS } from "@finance/core/motion";
import {
  ENTRAIDE_REACTIONS,
  postTarget,
  replyTarget,
} from "@finance/core/reactions";

import { AskMarkdown } from "@/components/AskMarkdown";
import { HandleField, handleReady } from "@/components/entraide/HandleField";
import { DecisionNotice, MaskNotice } from "@/components/entraide/Notices";
import { AuthorLine } from "@/components/entraide/PostCard";
import { ReportSheet } from "@/components/entraide/ReportSheet";
import { ReactionRow } from "@/components/ReactionRow";
import { ScreenError } from "@/components/ScreenError";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { readThreadFor, writeEntraide } from "@/lib/entraide";
import { WEB_APP_URL } from "@/lib/env";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useReactions } from "@/lib/nouveautes";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale } from "@/providers/LocaleProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/** Past this, an answer waits no longer to rise than the eighth did. */
const STAGGER_CAP = 8;

/** What is being edited: the question, or one answer. */
type Editing = { kind: "post" } | { kind: "reply"; id: number } | null;

/** An answer as drawn: `sending` while it is still on its way. */
type ShownReply = EntraideReply & { sending?: boolean };

/**
 * What this visit wrote, drawn at once rather than after the next read
 * brings it back: answers sent (an in-flight one with a negative id), and
 * the question's or an answer's new words, or its deletion.
 */
interface Local {
  added: ShownReply[];
  post: { title: string; body: string } | "deleted" | null;
  replies: ReadonlyMap<number, { body: string } | "deleted">;
}

const NO_LOCAL: Local = { added: [], post: null, replies: new Map() };

/** The words as the server saves them: masked, then trimmed. */
function saved(text: string): string {
  return maskPersonalData(text).text.trim();
}

function withLocal(
  post: EntraidePost,
  replies: readonly EntraideReply[],
  local: Local,
): { post: EntraidePost; replies: ShownReply[] } {
  const now = new Date().toISOString();
  const gone = <T extends EntraidePost | EntraideReply>(row: T): T => ({
    ...row,
    gone: true,
    status: "deleted",
    body: "",
  });
  const known = new Set(replies.map((reply) => reply.id));
  return {
    post:
      local.post === "deleted"
        ? gone(post)
        : local.post
          ? { ...post, ...local.post, editedAt: post.editedAt ?? now }
          : post,
    replies: [
      ...replies.map((reply) => {
        const patch = local.replies.get(reply.id);
        return patch === "deleted"
          ? gone(reply)
          : patch
            ? { ...reply, body: patch.body, editedAt: reply.editedAt ?? now }
            : reply;
      }),
      ...local.added.filter((reply) => !known.has(reply.id)),
    ],
  };
}

/**
 * A thread on the phone, read and answered as on the site: the question
 * (or share) and its reactions; the author's own « Modifier » and
 * « Supprimer »; the answers, oldest first, the one the asker marked
 * « Résolu » lifted under the question in gold — a moment rather than a
 * figure. Every change shows at once and is sent after; a refusal puts it
 * back and says why. The answer field stays at the foot of the screen.
 */
export default function EntraideThreadScreen() {
  const { thread: param } = useLocalSearchParams<{ thread: string }>();
  const id = threadIdOf(String(param ?? ""));
  const locale = useLocale();
  const copy = entraideCopyFor(locale);
  const router = useRouter();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Each write announces "community" (`lib/data-version.ts`): the thread,
  // on screen, reads itself again after one, and the list once shown.
  const { data, error, loading, refreshing, onRefresh } =
    useRefreshable(
      async () => ({
        thread: id === null ? null : await readThreadFor(id, userId),
        readAt: new Date(),
      }),
      [id, userId],
      { reads: ["community"] },
    );
  const thread = data?.thread ?? null;
  const [local, setLocal] = useState<Local>(NO_LOCAL);
  const shown = thread
    ? withLocal(thread.post, thread.replies, local)
    : null;
  const post = shown?.post ?? null;
  const replies = shown?.replies ?? [];
  // A pseudonym chosen with this visit's first answer, before a read has it.
  const [handleNow, setHandleNow] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  // The ids of answers still on their way: negative, never a real one.
  const nextTemp = useRef(-1);

  const targets = post
    ? [
        postTarget(post.id),
        ...replies
          .filter((reply) => !reply.sending)
          .map((reply) => replyTarget(reply.id)),
      ]
    : [];
  const { tally, say } = useReactions(targets, userId);

  // « Résolu », shown at once and sent after; a new read takes over.
  const [solvedId, setSolvedId] = useState<number | null>(null);
  const [solvedFor, setSolvedFor] = useState<number | null | undefined>(
    undefined,
  );
  const readSolved = post?.solvedReplyId ?? null;
  if (post && solvedFor !== readSolved) {
    setSolvedFor(readSolved);
    setSolvedId(readSolved);
  }
  const [failed, setFailed] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reportedNow, setReportedNow] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const back = {
    label: copy.thread.back,
    onPress: () =>
      // Cast while the typed routes are generated by the dev server.
      router.canGoBack() ? router.back() : router.replace("/entraide" as Href),
  };

  if (loading && !data) {
    return (
      <Screen title={copy.hero.title} back={back} showRefresh={false}>
        <ScreenSkeleton rows={3} />
      </Screen>
    );
  }
  if (!post || !thread) {
    return (
      <Screen title={copy.hero.title} back={back} showRefresh={false}>
        <View className="flex-1 justify-center">
          {error ? (
            <ScreenError message={error} onRetry={onRefresh} />
          ) : (
            <View className="rounded-card border border-border bg-card/70 p-card">
              <Text variant="muted">{copy.thread.missing}</Text>
            </View>
          )}
        </View>
      </Screen>
    );
  }

  const now = data?.readAt ?? new Date(0);
  const canSolve =
    post.author.isMine && post.kind === "question" && !post.gone;
  const solved = replies.find((reply) => reply.id === solvedId) ?? null;
  const others = replies.filter((reply) => reply.id !== solvedId);
  const count = replies.filter((reply) => !reply.gone).length;
  const isReported = (target: string) =>
    thread.reported.has(target) || reportedNow.has(target);

  async function toggleSolved(replyId: number) {
    if (!post) {
      return;
    }
    const before = solvedId;
    const next = solvedId === replyId ? null : replyId;
    setSolvedId(next);
    setFailed(null);
    if (next !== null) {
      void hapticSuccess();
    }
    const result = await writeEntraide({
      action: "solve",
      postId: post.id,
      replyId: next,
    });
    if (!result.ok) {
      setSolvedId(before);
      setFailed(entraideErrorText(copy, result.error));
    }
  }

  async function confirmDelete() {
    if (!deleting) {
      return;
    }
    const [kind, raw] = deleting.split(":");
    setDeletePending(true);
    const result = await writeEntraide(
      kind === "post"
        ? { action: "deletePost", id: Number(raw) }
        : { action: "deleteReply", id: Number(raw) },
    );
    setDeletePending(false);
    setDeleting(null);
    if (!result.ok) {
      setFailed(entraideErrorText(copy, result.error));
      return;
    }
    setLocal((current) =>
      kind === "post"
        ? { ...current, post: "deleted" }
        : {
            ...current,
            replies: new Map(current.replies).set(Number(raw), "deleted"),
          },
    );
  }

  /**
   * An answer, drawn at once — dimmed while it travels — and confirmed when
   * the server has it; refused, it leaves and its words go back in the
   * field. Null when it went, or what to say.
   */
  async function sendReply(
    text: string,
    typed: string | undefined,
  ): Promise<string | null> {
    if (!post) {
      return null;
    }
    const temp = nextTemp.current;
    nextTemp.current -= 1;
    const draft: ShownReply = {
      id: temp,
      body: saved(text),
      author: {
        handle: thread?.handle ?? handleNow ?? typed?.trim() ?? null,
        isPluclair: false,
        isMine: true,
      },
      status: "visible",
      gone: false,
      createdAt: new Date().toISOString(),
      editedAt: null,
      sending: true,
    };
    setLocal((current) => ({ ...current, added: [...current.added, draft] }));
    requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
    const result = await writeEntraide<{ id: number }>({
      action: "reply",
      postId: post.id,
      text,
      handle: typed,
    });
    if (!result.ok) {
      setLocal((current) => ({
        ...current,
        added: current.added.filter((reply) => reply.id !== temp),
      }));
      return entraideErrorText(copy, result.error);
    }
    void hapticSuccess();
    if (typed) {
      setHandleNow(typed.trim());
    }
    setLocal((current) => ({
      ...current,
      added: current.added.map((reply) =>
        reply.id === temp
          ? { ...reply, id: result.value.id, sending: false }
          : reply,
      ),
    }));
    return null;
  }

  let index = 0;
  const enter = () =>
    reduceMotion
      ? undefined
      : FadeInDown.duration(DURATION.enter).delay(
          Math.min(index++, STAGGER_CAP) * STAGGER_STEP_MS,
        );
  const layout = reduceMotion
    ? undefined
    : LinearTransition.duration(DURATION.panel);

  const replyItem = (reply: ShownReply, isSolved: boolean) => {
    const target = replyTarget(reply.id);
    const hidden = reply.status === "hidden";
    if (reply.sending) {
      return (
        <View className="opacity-60">
          <ReplyItem
            reply={reply}
            when={copy.thread.replying}
            copy={copy}
            isSolved={false}
            canSolve={false}
            onSolve={() => undefined}
            notice={null}
            reactions={null}
            report={null}
            own={null}
            editor={null}
          />
        </View>
      );
    }
    return (
      <ReplyItem
        reply={reply}
        when={entraideWhen(reply.createdAt, now, locale)}
        copy={copy}
        isSolved={isSolved}
        canSolve={canSolve && !reply.gone && !hidden}
        onSolve={() => void toggleSolved(reply.id)}
        notice={
          hidden ? (
            <DecisionNotice
              decision={thread.decisions.get(target)}
              copy={copy}
            />
          ) : null
        }
        reactions={
          reply.gone || hidden ? null : (
            <ReactionRow
              kinds={ENTRAIDE_REACTIONS}
              labels={copy.reactions}
              tally={tally(target)}
              onReact={(kind) => say(target, kind)}
              failedText={copy.reactions.failed}
            />
          )
        }
        report={
          reply.author.isMine || hidden || reply.gone ? null : (
            <ReportButton
              copy={copy}
              reported={isReported(target)}
              onPress={() => setReporting(target)}
            />
          )
        }
        own={
          reply.author.isMine && !hidden && !reply.gone ? (
            <OwnActions
              copy={copy}
              onEdit={() => setEditing({ kind: "reply", id: reply.id })}
              onDelete={() => setDeleting(target)}
            />
          ) : null
        }
        editor={
          editing?.kind === "reply" && editing.id === reply.id ? (
            <ReplyEditor
              reply={reply}
              copy={copy}
              onCancel={() => setEditing(null)}
              onSaved={(body) => {
                setEditing(null);
                setLocal((current) => ({
                  ...current,
                  replies: new Map(current.replies).set(reply.id, { body }),
                }));
              }}
            />
          ) : null
        }
      />
    );
  };

  const postHidden = post.status === "hidden";

  return (
    <Screen
      title={copy.hero.title}
      back={back}
      showRefresh={false}
      className="px-0 py-0"
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-5 px-4 pb-10 pt-4"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.mutedForeground}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={enter()} className="gap-3">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text variant="label">{copy.kinds[post.kind]}</Text>
              {solvedId !== null ? (
                <Animated.View
                  entering={reduceMotion ? undefined : ZoomIn.springify()}
                  className="flex-row items-center gap-1"
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={ICON.sm}
                    color={colors.primary}
                  />
                  <Text variant="label" className="text-primary">
                    {copy.list.solved}
                  </Text>
                </Animated.View>
              ) : null}
            </View>

            {editing?.kind === "post" ? (
              <PostEditor
                post={post}
                copy={copy}
                onCancel={() => setEditing(null)}
                onSaved={(words) => {
                  setEditing(null);
                  setLocal((current) => ({ ...current, post: words }));
                }}
              />
            ) : (
              <>
                <Text
                  variant="title"
                  accessibilityRole="header"
                  className={cn(post.gone && "italic text-muted-foreground")}
                >
                  {post.gone ? copy.list.gone : post.title}
                </Text>
                <AuthorLine
                  handle={post.author.handle}
                  isPluclair={post.author.isPluclair}
                  when={entraideWhen(post.createdAt, now, locale)}
                  edited={post.editedAt !== null}
                  copy={copy}
                />
                {postHidden ? (
                  <DecisionNotice
                    decision={thread.decisions.get(postTarget(post.id))}
                    copy={copy}
                  />
                ) : null}
                {post.body && !post.gone ? (
                  <AskMarkdown markdown={post.body} community />
                ) : null}
                {post.guideSlug && WEB_APP_URL ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      void WebBrowser.openBrowserAsync(
                        `${WEB_APP_URL}/blog/${post.guideSlug}`,
                      )
                    }
                    className="min-h-11 flex-row items-center gap-1.5 self-start"
                  >
                    <Ionicons
                      name="book-outline"
                      size={ICON.md}
                      color={colors.foreground}
                    />
                    <Text className="text-sm underline">
                      {copy.thread.aboutGuide}
                    </Text>
                  </Pressable>
                ) : null}
                {post.gone || postHidden ? null : (
                  <ReactionRow
                    kinds={ENTRAIDE_REACTIONS}
                    labels={copy.reactions}
                    tally={tally(postTarget(post.id))}
                    onReact={(kind) => say(postTarget(post.id), kind)}
                    failedText={copy.reactions.failed}
                  />
                )}
                <View className="flex-row flex-wrap items-center gap-2">
                  {post.author.isMine && !postHidden && !post.gone ? (
                    <OwnActions
                      copy={copy}
                      onEdit={() => setEditing({ kind: "post" })}
                      onDelete={() => setDeleting(postTarget(post.id))}
                    />
                  ) : null}
                  {post.author.isMine || postHidden || post.gone ? null : (
                    <ReportButton
                      copy={copy}
                      reported={isReported(postTarget(post.id))}
                      onPress={() => setReporting(postTarget(post.id))}
                    />
                  )}
                </View>
              </>
            )}
          </Animated.View>

          <Text variant="muted" className="leading-5">
            {copy.thread.views}
          </Text>

          <Text variant="head" accessibilityRole="header">
            {count > 0
              ? countWords(copy.thread.answers, count)
              : copy.thread.noAnswers}
          </Text>

          {failed ? (
            <Text accessibilityRole="alert" className="text-sm">
              {failed}
            </Text>
          ) : null}

          {solved ? (
            <Animated.View
              key={`solved-${solved.id}`}
              entering={reduceMotion ? undefined : FadeIn.duration(DURATION.panel)}
              layout={layout}
              className="rounded-card border border-primary/40 bg-primary/5 p-1"
            >
              <View className="flex-row items-center gap-2 px-3 pb-1 pt-2.5">
                <Animated.View
                  entering={
                    reduceMotion ? undefined : ZoomIn.springify().damping(14)
                  }
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={ICON.md}
                    color={colors.primary}
                  />
                </Animated.View>
                <Text variant="label" className="text-primary">
                  {copy.thread.solvedAnswer}
                </Text>
              </View>
              {replyItem(solved, true)}
            </Animated.View>
          ) : null}

          {others.map((reply) => (
            <Animated.View key={reply.id} entering={enter()} layout={layout}>
              {replyItem(reply, false)}
            </Animated.View>
          ))}
        </ScrollView>

        {postHidden || (post.gone && post.author.isMine) ? null : (
          <ReplyComposer
            handle={thread.handle ?? handleNow}
            copy={copy}
            onSend={sendReply}
          />
        )}
      </KeyboardAvoidingView>

      <ReportSheet
        target={reporting}
        copy={copy}
        onClose={() => setReporting(null)}
        onReported={(target) =>
          setReportedNow((current) => new Set(current).add(target))
        }
      />
      <ConfirmSheet
        open={deleting !== null}
        title={copy.thread.confirmDelete}
        confirmLabel={copy.thread.delete}
        cancelLabel={copy.thread.cancel}
        pending={deletePending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </Screen>
  );
}

function ReplyItem({
  reply,
  when,
  copy,
  isSolved,
  canSolve,
  onSolve,
  notice,
  reactions,
  report,
  own,
  editor,
}: {
  reply: EntraideReply;
  when: string;
  copy: EntraideCopy;
  isSolved: boolean;
  canSolve: boolean;
  onSolve: () => void;
  notice: ReactNode;
  reactions: ReactNode;
  report: ReactNode;
  own: ReactNode;
  editor: ReactNode;
}) {
  return (
    <View
      className={cn(
        "gap-2 rounded-card p-card",
        isSolved ? "bg-card" : "border border-border bg-card/70",
      )}
    >
      <AuthorLine
        handle={reply.author.handle}
        isPluclair={reply.author.isPluclair}
        when={when}
        edited={reply.editedAt !== null}
        copy={copy}
      />
      {notice}
      {editor ??
        (reply.gone ? (
          <Text variant="muted" className="italic">
            {copy.list.gone}
          </Text>
        ) : (
          <AskMarkdown markdown={reply.body} community />
        ))}
      {reactions}
      <View className="flex-row flex-wrap items-center gap-2">
        {canSolve ? (
          <Button
            label={isSolved ? copy.thread.unmarkSolved : copy.thread.markSolved}
            variant="outline"
            size="sm"
            onPress={onSolve}
          />
        ) : null}
        {editor ? null : own}
        {report}
      </View>
    </View>
  );
}

/** « Modifier » and « Supprimer », the second asking once more. */
function OwnActions({
  copy,
  onEdit,
  onDelete,
}: {
  copy: EntraideCopy;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useThemeColors();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={onEdit}
        className="min-h-11 flex-row items-center gap-1.5 px-1"
      >
        <Ionicons
          name="create-outline"
          size={ICON.md}
          color={colors.mutedForeground}
        />
        <Text variant="muted">{copy.thread.edit}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onDelete}
        className="min-h-11 flex-row items-center gap-1.5 px-1"
      >
        <Ionicons
          name="trash-outline"
          size={ICON.md}
          color={colors.mutedForeground}
        />
        <Text variant="muted">{copy.thread.delete}</Text>
      </Pressable>
    </>
  );
}

/** « Signaler », or that it is done already. */
function ReportButton({
  copy,
  reported,
  onPress,
}: {
  copy: EntraideCopy;
  reported: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: reported }}
      accessibilityLabel={reported ? copy.report.done : copy.report.button}
      disabled={reported}
      onPress={() => {
        void hapticLight();
        onPress();
      }}
      className="min-h-11 flex-row items-center gap-1.5 px-1"
    >
      <Ionicons
        name={reported ? "flag" : "flag-outline"}
        size={ICON.md}
        color={colors.mutedForeground}
      />
      <Text variant="muted">
        {reported ? copy.report.done : copy.report.button}
      </Text>
    </Pressable>
  );
}

function PostEditor({
  post,
  copy,
  onCancel,
  onSaved,
}: {
  post: EntraidePost;
  copy: EntraideCopy;
  onCancel: () => void;
  onSaved: (words: { title: string; body: string }) => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready =
    title.trim().length >= ENTRAIDE_LIMITS.titleMin &&
    title.trim().length <= ENTRAIDE_LIMITS.titleMax &&
    !pending;

  async function save() {
    setPending(true);
    setError(null);
    const result = await writeEntraide({
      action: "editPost",
      id: post.id,
      title,
      body,
    });
    setPending(false);
    if (!result.ok) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    onSaved({ title: saved(title), body: saved(body) });
  }

  return (
    <View className="gap-3">
      <Input
        value={title}
        onChangeText={setTitle}
        maxLength={ENTRAIDE_LIMITS.titleMax}
        accessibilityLabel={copy.composer.titleQuestion}
      />
      <Input
        value={body}
        onChangeText={setBody}
        maxLength={ENTRAIDE_LIMITS.bodyMax}
        multiline
        textAlignVertical="top"
        accessibilityLabel={copy.composer.bodyLabel}
        className="min-h-32"
      />
      <MaskNotice text={`${title}\n${body}`} copy={copy} />
      {error ? (
        <Text accessibilityRole="alert" className="text-sm">
          {error}
        </Text>
      ) : null}
      <View className="flex-row justify-end gap-2">
        <Button
          label={copy.thread.cancel}
          variant="ghost"
          onPress={onCancel}
        />
        <Button
          label={pending ? copy.thread.saving : copy.thread.save}
          disabled={!ready}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}

function ReplyEditor({
  reply,
  copy,
  onCancel,
  onSaved,
}: {
  reply: EntraideReply;
  copy: EntraideCopy;
  onCancel: () => void;
  onSaved: (body: string) => void;
}) {
  const [text, setText] = useState(reply.body);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = text.trim().length >= ENTRAIDE_LIMITS.replyMin && !pending;

  async function save() {
    setPending(true);
    setError(null);
    const result = await writeEntraide({
      action: "editReply",
      id: reply.id,
      text,
    });
    setPending(false);
    if (!result.ok) {
      setError(entraideErrorText(copy, result.error));
      return;
    }
    onSaved(saved(text));
  }

  return (
    <View className="gap-3">
      <Input
        value={text}
        onChangeText={setText}
        maxLength={ENTRAIDE_LIMITS.replyMax}
        multiline
        textAlignVertical="top"
        accessibilityLabel={copy.thread.replyLabel}
        className="min-h-24"
      />
      <MaskNotice text={text} copy={copy} />
      {error ? (
        <Text accessibilityRole="alert" className="text-sm">
          {error}
        </Text>
      ) : null}
      <View className="flex-row justify-end gap-2">
        <Button
          label={copy.thread.cancel}
          variant="ghost"
          onPress={onCancel}
        />
        <Button
          label={pending ? copy.thread.saving : copy.thread.save}
          disabled={!ready}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}

/**
 * The answer field at the foot of the thread: the pseudonym asked first if
 * the reader has none yet, what will be masked said before it goes, and a
 * send that springs in once there is something to send.
 */
function ReplyComposer({
  handle,
  copy,
  onSend,
}: {
  handle: string | null;
  copy: EntraideCopy;
  /** Sends the answer; what to say if it was refused, or null. */
  onSend: (text: string, handle: string | undefined) => Promise<string | null>;
}) {
  const colors = useThemeColors();
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ready =
    text.trim().length >= ENTRAIDE_LIMITS.replyMin &&
    handleReady(handle, typed);

  async function send() {
    if (!ready) {
      return;
    }
    // The field empties at once: the answer is already drawn above.
    const sent = text;
    setText("");
    setError(null);
    const refused = await onSend(sent, handle ? undefined : typed);
    if (refused) {
      setError(refused);
      setText((now) => (now ? now : sent));
    }
  }

  return (
    <View className="gap-2 border-t border-border bg-background px-4 pb-6 pt-3">
      {handle === null && text.length > 0 ? (
        <HandleField value={typed} onChange={setTyped} copy={copy} />
      ) : null}
      <MaskNotice text={text} copy={copy} />
      {error ? (
        <Text accessibilityRole="alert" className="text-sm">
          {error}
        </Text>
      ) : null}
      <View className="flex-row items-end gap-2 rounded-card border border-border px-3 py-1.5">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={copy.thread.replyPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={copy.thread.replyLabel}
          multiline
          maxLength={ENTRAIDE_LIMITS.replyMax}
          className="max-h-32 min-h-10 flex-1 py-2 text-base text-foreground"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.thread.reply}
          disabled={!ready}
          onPress={() => void send()}
          className="mb-1 h-9 w-9 items-center justify-center rounded-full bg-primary"
          style={{ opacity: ready ? 1 : 0.4 }}
        >
          <Animated.View
            key={ready ? "ready" : "idle"}
            entering={ZoomIn.springify().damping(14)}
          >
            <Ionicons
              name="arrow-up"
              size={ICON.md}
              color={colors.primaryForeground}
            />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
