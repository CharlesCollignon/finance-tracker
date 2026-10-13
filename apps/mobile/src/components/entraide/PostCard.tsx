import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { excerptOf, type EntraidePostSummary } from "@finance/core/entraide";
import { countWords, type EntraideCopy } from "@finance/core/entraide-copy";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticSelection } from "@/lib/haptics";
import { ICON } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Who wrote it and when: a pseudonym, the « Pluclair » mark on the owner's
 * answers (ink, not gold: a name is not a moment), and the day in words.
 * Nothing when the account is gone — « Message supprimé » says enough.
 */
export function AuthorLine({
  handle,
  isPluclair,
  when,
  edited,
  copy,
}: {
  handle: string | null;
  isPluclair: boolean;
  when: string;
  edited?: boolean;
  copy: EntraideCopy;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
      {handle ? (
        <Text variant="muted" className="font-medium">
          {handle}
        </Text>
      ) : null}
      {isPluclair ? (
        <View className="flex-row items-center gap-1 rounded-full border border-border bg-foreground/5 px-2 py-0.5">
          <Ionicons
            name="checkmark-done-circle"
            size={ICON.xs}
            color={colors.foreground}
          />
          <Text className="text-xs">{copy.list.pluclair}</Text>
        </View>
      ) : null}
      <Text variant="muted">
        {handle ? "· " : ""}
        {when}
        {edited ? ` · ${copy.list.edited}` : ""}
      </Text>
    </View>
  );
}

/**
 * A question or a share in the list: what kind, whether it is solved, its
 * title and first words, who and when, how many answers and « Utile ». The
 * whole card opens the thread.
 */
export function PostCard({
  post,
  when,
  copy,
  onOpen,
}: {
  post: EntraidePostSummary;
  when: string;
  copy: EntraideCopy;
  onOpen: () => void;
}) {
  const colors = useThemeColors();
  const excerpt = post.gone ? "" : excerptOf(post.excerpt, 140);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void hapticSelection();
        onOpen();
      }}
      className="gap-2 rounded-card border border-border bg-card/70 p-card active:bg-card"
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <Text variant="label">{copy.kinds[post.kind]}</Text>
        {post.solved ? (
          <View className="flex-row items-center gap-1">
            <Ionicons
              name="checkmark-circle"
              size={ICON.sm}
              color={colors.primary}
            />
            <Text variant="label" className="text-primary">
              {copy.list.solved}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        variant="head"
        className={cn(post.gone && "italic text-muted-foreground")}
      >
        {post.gone ? copy.list.gone : post.title}
      </Text>
      {excerpt ? (
        <Text variant="muted" className="leading-5" numberOfLines={2}>
          {excerpt}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
        <AuthorLine
          handle={post.author.handle}
          isPluclair={post.author.isPluclair}
          when={when}
          copy={copy}
        />
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons
              name="chatbubble-outline"
              size={ICON.sm}
              color={colors.mutedForeground}
            />
            <Text variant="muted">
              {post.replyCount > 0
                ? countWords(copy.list.replies, post.replyCount)
                : copy.list.noReply}
            </Text>
          </View>
          {post.usefulCount > 0 ? (
            <View className="flex-row items-center gap-1">
              <Ionicons
                name="thumbs-up-outline"
                size={ICON.sm}
                color={colors.mutedForeground}
              />
              <Text variant="muted" className="tabular-nums">
                {post.usefulCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
