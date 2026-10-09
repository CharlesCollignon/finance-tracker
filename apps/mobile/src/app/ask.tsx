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
import { formatShortDate } from "@finance/core/constants";
import { resolveMessage } from "@finance/core/i18n/t";
import type { ReadSegment } from "@finance/core/month-read";

import { ConnectAiInvite } from "@/components/ConnectAiInvite";
import { Orb } from "@/components/Orb";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ScreenError } from "@/components/ScreenError";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import {
  askQuestion,
  deleteConversation,
  getConversationMessages,
  listConversations,
} from "@/lib/ask";
import { getWriterState } from "@/lib/ai-writer";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
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

/**
 * « Questions » — Ask Pluclair on the phone, the twin of the web's `/ask`:
 * the conversations of the last thirty days along the top, the one open
 * below, a question at the bottom. The question in flight shows at once,
 * with Pluclair looking at the figures until the answer lands. The person's
 * own money, never the space's.
 */
export default function AskScreen() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ c?: string }>();
  const [currentId, setCurrentId] = useState<string | null>(params.c ?? null);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

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
  const canAsk = writable && asking === null;

  async function ask(question: string) {
    const text = question.trim();
    if (!text || !canAsk) {
      return;
    }
    void hapticLight();
    setAsking(text);
    setDraft("");
    const outcome = await askQuestion(text, currentId, locale);
    setAsking(null);
    if (outcome.message) {
      toast(resolveMessage(t, outcome.message), "error");
      setDraft(text);
      return;
    }
    void hapticSuccess();
    if (outcome.conversationId && outcome.conversationId !== currentId) {
      setCurrentId(outcome.conversationId);
    } else {
      void reloadMessages();
    }
    void reloadSide();
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

  // The latest message in view as it lands.
  useEffect(() => {
    const timer = setTimeout(
      () => scroll.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(timer);
  }, [messages, asking]);

  const shown = currentId ? (messages ?? []) : [];
  const empty = shown.length === 0 && !asking;

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
              {shown.map((message) => (
                <Animated.View
                  key={message.id}
                  entering={FadeInDown.springify().damping(18)}
                >
                  {message.role === "question" ? (
                    <Question text={message.body.text} />
                  ) : (
                    <Answer body={message.body} />
                  )}
                </Animated.View>
              ))}
              {asking ? (
                <>
                  <Animated.View entering={FadeInDown.springify().damping(18)}>
                    <Question text={asking} />
                  </Animated.View>
                  <Animated.View entering={FadeIn} exiting={FadeOut}>
                    <Thinking label={t("ask.thinking")} />
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
                accessibilityLabel={t("ask.send")}
                disabled={!canAsk || draft.trim().length === 0}
                onPress={() => void ask(draft)}
                className="mb-1 h-9 w-9 items-center justify-center rounded-full bg-primary"
                style={{
                  opacity: canAsk && draft.trim().length > 0 ? 1 : 0.4,
                }}
              >
                <Ionicons
                  name="arrow-up"
                  size={ICON.md}
                  color={colors.primaryForeground}
                />
              </Pressable>
            </View>
            <Text variant="micro" className="text-center">
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

function AnswerBody({ body }: { body: AskAnswerBody }) {
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
 * way, and only then; with reduced motion, the words alone.
 */
function Thinking({ label }: { label: string }) {
  const reduced = useReducedMotion();
  return (
    <View className="flex-row items-center gap-3">
      <Orb size="sm" />
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
