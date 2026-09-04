import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { MonthFacts } from "@finance/core/month-facts";
import {
  renderMonthRead,
  type MonthRead as MonthReadValue,
  type ReadSegment,
} from "@finance/core/month-read";
import type { ReadFreshness } from "@finance/core/month-read-budget";

import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { writeMonthRead } from "@/lib/month-read";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useToast } from "@/providers/ToastProvider";
import { useThemeColors } from "@/theme/useThemeColors";

interface MonthReadProps {
  year: number;
  month: number;
  monthLabel: string;
  read: MonthReadValue | null;
  freshness: ReadFreshness | null;
  /** The figures as they stand now — what the read renders against. */
  facts: MonthFacts;
  writesLeft: number;
  /** Whether a read can be written from this build at all. */
  writable: boolean;
  onWritten: () => void;
}

/**
 * A month, in words.
 *
 * The web twin carries the reasoning. In short: the prose is a model's and
 * every figure in it is the app's, because the model writes
 * `{{fact:expenses}}` and never a number. That is what lets the currency
 * toggle and the privacy blur work on a written paragraph, and what keeps a
 * figure nobody computed off the screen.
 *
 * The substitution and the verification are shared in
 * `@finance/core/month-read`, so the two apps cannot drift on what a read is
 * allowed to say.
 */
export function MonthRead({
  year,
  month,
  monthLabel,
  read,
  freshness,
  facts,
  writesLeft,
  writable,
  onWritten,
}: MonthReadProps) {
  const { toast } = useToast();
  const formatEuro = useFormatCurrency();
  const colors = useThemeColors();
  const [pending, setPending] = useState(false);
  const [left, setLeft] = useState(writesLeft);

  const rendered = read ? renderMonthRead(read, facts, formatEuro) : null;

  // Nothing to show and no way to write one.
  if (!rendered && (!writable || facts.thin)) {
    return null;
  }

  function write() {
    if (pending) {
      return;
    }
    setPending(true);
    void (async () => {
      const outcome = await writeMonthRead(year, month);
      setPending(false);
      if (outcome.writesLeft !== null) {
        setLeft(outcome.writesLeft);
      }
      if (outcome.written) {
        void hapticSuccess();
        onWritten();
      }
      if (outcome.message || outcome.written) {
        toast(
          outcome.message ?? `Written for ${monthLabel}`,
          outcome.written ? "success" : "error",
        );
      }
    })();
  }

  return (
    <Card bezel innerClassName="gap-4 p-5">
      <View className="gap-1">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="sparkles-outline" size={13} color={colors.primary} />
          <Text className="text-sm font-medium">The read</Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          Written by a model, from the figures on this screen. It cannot see
          your accounts.
        </Text>
      </View>

      {rendered ? (
        <>
          <Text className="text-lg font-semibold leading-snug">
            <Segments segments={rendered.headline} />
          </Text>

          <View className="gap-2">
            {rendered.observations.map((row, index) => (
              <View key={index} className="flex-row items-start gap-2">
                <View
                  className={cn(
                    "mt-2 h-1.5 w-1.5 rounded-full",
                    row.tone === "good"
                      ? "bg-success"
                      : row.tone === "watch"
                        ? "bg-destructive"
                        : "bg-muted-foreground",
                  )}
                />
                <Text className="min-w-0 flex-1 text-sm">
                  <Segments segments={row.segments} />
                </Text>
              </View>
            ))}
          </View>

          {/* Under a heading of its own, below a rule. Advice was asked for,
              and a reader should still be able to tell which lines are
              measurements and which are opinions. */}
          {rendered.suggestions.length > 0 ? (
            <View className="gap-2 border-t border-foreground/10 pt-3">
              <Text className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                What to change
              </Text>
              {rendered.suggestions.map((row, index) => (
                <View key={index} className="flex-row items-start gap-2">
                  <View className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
                  <Text className="min-w-0 flex-1 text-sm">
                    <Segments segments={row.segments} />
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <Text className="text-sm text-muted-foreground">
          {`Nothing has been written about ${monthLabel} yet.`}
        </Text>
      )}

      <View className="gap-2 border-t border-foreground/10 pt-3">
        {freshness ? <Standing freshness={freshness} /> : null}

        {writable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              rendered ? "Write the read again" : "Write the read"
            }
            accessibilityState={{ disabled: pending || left <= 0 }}
            disabled={pending || left <= 0}
            onPress={() => {
              void hapticLight();
              write();
            }}
            className={cn(
              "min-h-11 flex-row items-center justify-center gap-1.5 rounded-full px-4",
              left > 0 ? "bg-primary" : "border border-border",
              (pending || left <= 0) && "opacity-60",
            )}
          >
            <Ionicons
              name="create-outline"
              size={15}
              color={
                left > 0 ? colors.primaryForeground : colors.mutedForeground
              }
            />
            <Text
              className={cn(
                "text-sm font-medium",
                left > 0 ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {pending
                ? "Writing…"
                : left <= 0
                  ? "No reads left this month"
                  : rendered
                    ? `Write it again (${left} left)`
                    : `Write one (${left} left)`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * How well the read still stands.
 *
 * A month in progress is never called stale, however much has moved — its
 * figures change whenever anything is recorded, and a warning that is always
 * on is one nobody reads.
 */
function Standing({ freshness }: { freshness: ReadFreshness }) {
  if (freshness.standing === "moved") {
    const count = freshness.moved.length;
    return (
      <Text className="text-xs text-primary-ink">
        {`${count === 1 ? "One figure" : `${count} figures`} this rests on ${
          count === 1 ? "has" : "have"
        } moved since it was written, ${freshness.writtenAge}.`}
      </Text>
    );
  }

  return (
    <Text className="text-xs text-muted-foreground">
      {freshness.standing === "provisional"
        ? `Written ${freshness.writtenAge}, from the figures as they stood then.`
        : `Written ${freshness.writtenAge}.`}
    </Text>
  );
}

/**
 * Prose and figures, interleaved.
 *
 * Each figure is its own element so privacy mode can blur it — which is not
 * something prose can do, and one of the reasons the model is never allowed
 * to write a number itself.
 */
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
