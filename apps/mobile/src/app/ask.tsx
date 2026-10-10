import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

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
import type { ReadSegment } from "@finance/core/month-read";

import { AskMarkdown } from "@/components/AskMarkdown";
import { ConnectAiInvite } from "@/components/ConnectAiInvite";
import { Orb } from "@/components/Orb";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ScreenError } from "@/components/ScreenError";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import {
  deleteConversation,
  getConversationMessages,
  listConversations,
  streamQuestion,
} from "@/lib/ask";
import { getWriterState } from "@/lib/ai-writer";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useAuth } from "@/providers/AuthProvider";
import { useCurrency, useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

const SUGGESTIONS = [
  "ask.suggest1",
  "ask.suggest2",
  "ask.suggest3",
  "ask.suggest4",
] as const;

/** Each tool's mark, beside its name while the model is at work. */
const STEP_ICONS: Record<AskChatTool, keyof typeof Ionicons.glyphMap> = {
  month: "calendar-outline",
  cashflow: "swap-vertical-outline",
  categories: "pie-chart-outline",
  transactions: "list-outline",
  merchants: "storefront-outline",
  recurring: "repeat-outline",
  savings: "wallet-outline",
  investments: "trending-up-outline",
  loans: "home-outline",
  loan_prepayment: "hourglass-outline",
  calculate: "calculator-outline",
};

/** A question on its way: what was asked, what was looked at, the words so far. */
interface Live {
  question: string;
  steps: AskChatTool[];
  text: string;
  /**
   * The conversation it belongs to: the one it was asked in, or — asked in a
   * new one — the one it was kept in. Shown there only.
   */
  conversationId: string | null;
  /** How many messages the conversation had when it was asked. */
  before: number;
  /** Kept on the server: drawn from the conversation once it is read back. */
  done: boolean;
}

/**
 * « Questions » — Ask Pluclair on the phone, the twin of the web's `/ask`:
 * the conversations of the last thirty days along the top, the one open
 * below, a question at the bottom. The answer streams in as on the web
 * (`api/ask/stream`): each thing the model looks at pops in as a chip,
 * then the words arrive with a caret at their end; the send button turns
 * into a stop. The person's own money, never the space's.
 */
export default function AskScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currency } = useCurrency();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ c?: string }>();
  const [currentId, setCurrentId] = useState<string | null>(params.c ?? null);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const scroll = useRef<ScrollView>(null);
  const abort = useRef<AbortController | null>(null);

  const {
    data: side,
    error: sideError,
    reload: reloadSide,
  } = useRefreshable(
    async () =>
      user
        ? {
            conversations: await listConversations(user.id),
            writer: await getWriterState(user.id),
          }
        : null,
    [user?.id],
    { reads: [] },
  );
  const {
    data: messages,
    error: messagesError,
    reload: reloadMessages,
  } = useRefreshable(
    async () => (currentId ? await getConversationMessages(currentId) : []),
    [currentId],
    { reads: [] },
  );

  const writable = side?.writer.writable ?? false;
  const asking = live !== null && !live.done;
  const canAsk = writable && !asking;
  const shown = currentId ? (messages ?? []) : [];
  // In its own conversation only, and only until the kept exchange has been
  // read back: then the live one gives way to it.
  const settled = live?.done === true && live.conversationId === currentId;
  const liveShown =
    live &&
    live.conversationId === currentId &&
    !(settled && shown.length > live.before)
      ? live
      : null;

  async function ask(question: string) {
    const text = question.trim();
    if (!text || !canAsk) {
      return;
    }
    void hapticLight();
    const controller = new AbortController();
    abort.current = controller;
    const asked = currentId;
    setDraft("");
    setLive({
      question: text,
      steps: [],
      text: "",
      conversationId: asked,
      before: asked ? shown.length : 0,
      done: false,
    });

    let finished = false;
    const fail = (message: string) => {
      setLive(null);
      setDraft(text);
      toast(resolveMessage(t, message), "error");
    };
    const onEvent = (event: AskStreamEvent) => {
      switch (event.type) {
        case "step":
          setLive((now) =>
            now ? { ...now, steps: [...now.steps, event.tool] } : now,
          );
          break;
        case "text":
          setLive((now) =>
            now ? { ...now, text: now.text + event.text } : now,
          );
          break;
        case "reset":
          setLive((now) => (now ? { ...now, text: "" } : now));
          break;
        case "error":
          finished = true;
          fail(event.message);
          break;
        case "done":
          finished = true;
          void hapticSuccess();
          setLive((now) =>
            now
              ? { ...now, done: true, conversationId: event.conversationId }
              : now,
          );
          if (event.conversationId !== asked) {
            setCurrentId(event.conversationId);
          } else {
            void reloadMessages();
          }
          void reloadSide();
          break;
      }
    };

    try {
      await streamQuestion(
        { question: text, conversationId: asked, locale, currency },
        onEvent,
        controller.signal,
      );
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

  async function remove(id: string) {
    void hapticLight();
    await deleteConversation(id);
    toast(t("ask.deleted"), "success");
    if (id === currentId) {
      setCurrentId(null);
    }
    void reloadSide();
  }

  // The latest message in view as it lands, and as the answer grows.
  useEffect(() => {
    const timer = setTimeout(
      () => scroll.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(timer);
  }, [messages, live?.steps.length, live?.text.length]);

  const empty = shown.length === 0 && !liveShown;

  return (
    <Screen
      title={t("ask.title")}
      back={{
        label: t("nav.bearing"),
        onPress: () =>
          router.canGoBack() ? router.back() : router.replace("/" as Href),
      }}
      className="px-0 py-0"
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* The last thirty days: a tap opens one, a long press deletes it. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-14 grow-0"
          contentContainerClassName="items-center gap-2 px-4 py-2"
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setCurrentId(null)}
            className={cn(
              "flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5",
              currentId === null && "bg-muted",
            )}
          >
            <Ionicons name="add" size={ICON.sm} color={colors.foreground} />
            <Text className="text-sm font-medium">{t("ask.new")}</Text>
          </Pressable>
          {(side?.conversations ?? []).map((conversation) => (
            <Pressable
              key={conversation.id}
              accessibilityRole="button"
              accessibilityHint={t("ask.delete")}
              onPress={() => setCurrentId(conversation.id)}
              onLongPress={() => void remove(conversation.id)}
              className={cn(
                "max-w-52 rounded-full border border-border px-3 py-1.5",
                conversation.id === currentId && "bg-muted",
              )}
            >
              <Text numberOfLines={1} className="text-sm">
                {conversation.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          ref={scroll}
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-4 pt-2"
          keyboardShouldPersistTaps="handled"
        >
          {(!side && sideError) || (currentId && messagesError) ? (
            // Offline, or a read failed: a way to try again rather than an
            // empty conversation.
            <ScreenError
              message={!side ? sideError : messagesError}
              onRetry={() => {
                void reloadSide();
                void reloadMessages();
              }}
            />
          ) : side && !writable ? (
            // No AI account connected: how to connect one, where the
            // conversation would be.
            <View className="items-center gap-4 py-6">
              <Orb size="nav" />
              <View className="w-full">
                <ConnectAiInvite variant="card" />
              </View>
            </View>
          ) : empty ? (
            <Animated.View
              entering={FadeIn.duration(300)}
              className="items-center gap-4 py-8"
            >
              <Orb size="nav" />
              <Text variant="muted" className="text-center text-sm">
                {t("ask.intro")}
              </Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((key, index) => (
                  <Animated.View
                    key={key}
                    entering={FadeInDown.delay(80 * index).springify()}
                  >
                    <Pressable
                      accessibilityRole="button"
                      disabled={!canAsk}
                      onPress={() => void ask(t(key))}
                      className="rounded-full border border-border px-3 py-1.5"
                      style={{ opacity: canAsk ? 1 : 0.5 }}
                    >
                      <Text className="text-sm">{t(key)}</Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : (
            <>
              {shown.map((message, index) => (
                <Animated.View
                  key={message.id}
                  // The exchange just answered live is already on screen: it
                  // takes the live one's place without arriving again.
                  entering={
                    settled && index >= (live?.before ?? 0)
                      ? undefined
                      : FadeInDown.springify().damping(18)
                  }
                >
                  {message.role === "question" ? (
                    <Question text={message.body.text} />
                  ) : (
                    <Answer body={message.body} />
                  )}
                </Animated.View>
              ))}
              {liveShown ? (
                <>
                  <Animated.View entering={FadeInDown.springify().damping(18)}>
                    <Question text={liveShown.question} />
                  </Animated.View>
                  <Animated.View entering={FadeIn} exiting={FadeOut}>
                    <LiveAnswer live={liveShown} />
                  </Animated.View>
                </>
              ) : null}
            </>
          )}
        </ScrollView>

        {writable ? (
          <View className="gap-1.5 border-t border-border px-4 pb-6 pt-3">
            <View className="flex-row items-end gap-2 rounded-card border border-border px-3 py-1.5">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t("ask.placeholder")}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={t("ask.placeholder")}
                editable={writable}
                multiline
                maxLength={MAX_ASK_QUESTION}
                className="max-h-32 min-h-10 flex-1 py-2 text-base text-foreground"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={asking ? t("ask.stop") : t("ask.send")}
                disabled={!asking && (!canAsk || draft.trim().length === 0)}
                onPress={() =>
                  asking ? abort.current?.abort() : void ask(draft)
                }
                className="mb-1 h-9 w-9 items-center justify-center rounded-full bg-primary"
                style={{
                  opacity:
                    asking || (canAsk && draft.trim().length > 0) ? 1 : 0.4,
                }}
              >
                <Animated.View
                  key={asking ? "stop" : "send"}
                  entering={ZoomIn.springify().damping(14)}
                >
                  <Ionicons
                    name={asking ? "stop" : "arrow-up"}
                    size={ICON.md}
                    color={colors.primaryForeground}
                  />
                </Animated.View>
              </Pressable>
            </View>
            <Text variant="micro" className="text-center">
              {t("ask.disclaimer")}
              {" · "}
              {t("ask.onAccount")}
              {" · "}
              {t("ask.kept", { days: ASK_KEEP_DAYS })}
            </Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Question({ text }: { text: string }) {
  return (
    <View className="items-end">
      <View className="max-w-[85%] rounded-card bg-muted px-4 py-2.5">
        <Text className="text-sm">{text}</Text>
      </View>
    </View>
  );
}

function Answer({ body }: { body: AskAnswerBody }) {
  const t = useT();
  const colors = useThemeColors();
  if (body.kind === "chat") {
    return <ChatAnswer body={body} />;
  }
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5">
        <Orb size="sm" />
      </View>
      <View className="min-w-0 flex-1 gap-2">
        <AnswerBody body={body} />
        {"advice" in body && body.advice ? (
          <View className="flex-row items-start gap-1.5">
            <Ionicons
              name="information-circle-outline"
              size={ICON.sm}
              color={colors.mutedForeground}
            />
            <Text variant="micro" className="flex-1">
              {t("ask.noAdvice")}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** One thing the model looked at: its mark, its name, a tick once read. */
function StepChip({ tool, working }: { tool: AskChatTool; working: boolean }) {
  const t = useT();
  const colors = useThemeColors();
  return (
    <Animated.View entering={ZoomIn.springify().damping(16)}>
      <View
        className={cn(
          "flex-row items-center gap-1.5 rounded-full border border-border px-2.5 py-1",
          working && "bg-muted",
        )}
      >
        <Ionicons
          name={STEP_ICONS[tool]}
          size={ICON.xs}
          color={colors.mutedForeground}
        />
        <Text variant="micro">{t(`ask.step.${tool}`)}</Text>
        {working ? null : (
          <Ionicons name="checkmark" size={ICON.xs} color={colors.success} />
        )}
      </View>
    </Animated.View>
  );
}

/**
 * The answer being written: the things looked at so far, each popping in,
 * then the words with a caret at their end. Before any word, the dots say
 * Pluclair is at it.
 */
function LiveAnswer({ live }: { live: Live }) {
  const t = useT();
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5">
        <Orb size="sm" />
      </View>
      <View className="min-w-0 flex-1 gap-2.5">
        {live.steps.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {live.steps.map((tool, index) => (
              <StepChip
                key={`${tool}-${index}`}
                tool={tool}
                working={!live.text && index === live.steps.length - 1}
              />
            ))}
          </View>
        ) : null}
        {live.text ? (
          <AskMarkdown
            markdown={live.text}
            trailing={
              live.done ? null : (
                <Text variant="muted" className="text-sm">
                  {" ▍"}
                </Text>
              )
            }
          />
        ) : (
          <Thinking label={t("ask.thinking")} bare />
        )}
      </View>
    </View>
  );
}

/**
 * A conversation's answer: what was looked at, folded into one line that
 * opens; the answer; and a word on the figures the app could not find.
 */
function ChatAnswer({ body }: { body: AskChatBody }) {
  const t = useT();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5">
        <Orb size="sm" />
      </View>
      <View className="min-w-0 flex-1 gap-2.5">
        {body.steps.length > 0 ? (
          <View className="gap-1.5">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setOpen((now) => !now)}
              className="flex-row items-center gap-1 self-start"
            >
              <Text variant="micro">
                {t("ask.looked", { count: body.steps.length })}
              </Text>
              <Ionicons
                name={open ? "chevron-up" : "chevron-down"}
                size={ICON.xs}
                color={colors.mutedForeground}
              />
            </Pressable>
            {open ? (
              <View className="flex-row flex-wrap gap-1.5">
                {body.steps.map((step, index) => (
                  <StepChip
                    key={`${step.tool}-${index}`}
                    tool={step.tool}
                    working={false}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        <AskMarkdown markdown={body.markdown} untraced={body.untraced} />
        {body.untraced.length > 0 ? (
          <View className="flex-row items-start gap-1.5">
            <Ionicons
              name="information-circle-outline"
              size={ICON.sm}
              color={colors.mutedForeground}
            />
            <Text variant="micro" className="flex-1">
              {t("ask.untracedNote", { count: body.untraced.length })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function AnswerBody({ body }: { body: Exclude<AskAnswerBody, AskChatBody> }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  if (body.kind === "facts") {
    return (
      <>
        {renderAskSentences(body, format).map((segments, index) => (
          <Text key={index} className="text-sm leading-5">
            <Segments segments={segments} />
          </Text>
        ))}
      </>
    );
  }
  if (body.kind === "search") {
    if (body.count === 0) {
      return (
        <Text className="text-sm">
          {t("ask.searchNone", { query: body.query })}
        </Text>
      );
    }
    return (
      <>
        <Text className="text-sm font-medium">
          {t("ask.searchHeading", { count: body.count, query: body.query })}
        </Text>
        <View className="rounded-control border border-border">
          {body.rows.map((row, index) => (
            <View
              key={`${row.occurredOn}-${index}`}
              className={cn(
                "flex-row items-center justify-between gap-3 px-3 py-2",
                index > 0 && "border-t border-border",
              )}
            >
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm">
                  {row.note}
                </Text>
                <Text variant="micro">
                  {`${formatShortDate(row.occurredOn, locale)} · ${row.category}`}
                </Text>
              </View>
              <PrivateAmount
                className={cn("text-sm", row.amount > 0 && "text-success")}
              >
                {format(row.amount)}
              </PrivateAmount>
            </View>
          ))}
        </View>
        <PrivateAmount className="text-sm text-muted-foreground">
          {t("ask.searchSpent", { amount: format(body.spent) })}
        </PrivateAmount>
        {body.more ? (
          <Text variant="micro">{t("ask.searchMore")}</Text>
        ) : null}
      </>
    );
  }
  return (
    <Text className="text-sm">
      {body.kind === "outside" ? t("ask.outside") : t("ask.empty")}
    </Text>
  );
}

/** Prose and figures; each figure its own element, so the blur reaches it. */
function Segments({ segments }: { segments: ReadSegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <Text key={index} className="text-sm">
            {segment.text}
          </Text>
        ) : (
          <PrivateAmount key={index} className="text-sm font-medium">
            {segment.display}
          </PrivateAmount>
        ),
      )}
    </>
  );
}

/**
 * Pluclair at work: three dots rising in turn while the answer is on its
 * way, and only then; with reduced motion, the words alone. `bare` leaves
 * the orb out, for an answer that already has one.
 */
function Thinking({ label, bare = false }: { label: string; bare?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <View className="flex-row items-center gap-3">
      {bare ? null : <Orb size="sm" />}
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      {reduced ? null : (
        <View className="flex-row gap-1">
          {[0, 1, 2].map((dot) => (
            <Dot key={dot} index={dot} />
          ))}
        </View>
      )}
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const colors = useThemeColors();
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.set(
      withDelay(
        index * 150,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 300 }),
            withTiming(0, { duration: 300 }),
          ),
          -1,
        ),
      ),
    );
  }, [index, lift]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + lift.get() * 0.6,
    transform: [{ translateY: -3 * lift.get() }],
  }));
  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.mutedForeground,
        },
        style,
      ]}
    />
  );
}
